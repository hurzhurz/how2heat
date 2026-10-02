"use strict";

// State model (state, DEFAULT_STATE, loadState, validateState, ...) lives in state.js.
let state = loadState();
const input = { watt: null, sec: 0, manualStep: null };

// Find the timing step (in seconds) that applies to a given time.
function stepForTime(tSec, timing) {
  const sorted = [...timing].sort((a, b) =>
    (a.uptoSec ?? Infinity) - (b.uptoSec ?? Infinity));
  for (const r of sorted) {
    if (r.uptoSec === null || tSec <= r.uptoSec) return r.stepSec;
  }
  return sorted[sorted.length - 1].stepSec;
}

// Round a time up to the next value the microwave can actually be set to.
function snapUp(tSec, timing) {
  const s = stepForTime(tSec, timing);
  return Math.max(s, Math.ceil(tSec / s) * s);
}

// For every level: exact time, snapped time, and relative energy deviation.
function computeOptions(wattIn, secIn) {
  const device = activeDevice();
  const eZiel = wattIn * secIn;
  return device.steps
    .slice()
    .sort((a, b) => a - b)
    .map(step => {
      const p2 = stepToWatt(device, step);
      const tExact = eZiel / p2;
      const tSnap = snapUp(tExact, state.timing);
      const dev = (p2 * tSnap - eZiel) / eZiel;
      return { step, watt: p2, tExact, tSnap, dev };
    });
}

// Pick the best level. Levels whose power is within 10% of the requested
// package wattage are preferred (the user can just press that button on the
// microwave). Among those, the one with the smallest energy deviation wins;
// ties are resolved by the configured rule. If no level is close to the
// requested wattage, a combined score decides: relative power deviation
// (squared — staying near the recommended wattage matters most, much higher
// power cooks unevenly) × relative time distortion (snapped vs. exact time).
// A perfect snap does not count as free: a small floor keeps the power
// distance in play. Levels within 25% of the best score count as equal;
// ties go to the level closest to the requested wattage.
const WATT_TOL = 0.10;
const TIE_EPS = 0.01;
const SCORE_TIE = 0.25;

function pickBest(options, targetWatt) {
  const close = options.filter(o => Math.abs(o.watt - targetWatt) <= targetWatt * WATT_TOL);
  if (!close.length) {
    const score = o => {
      const pw = Math.abs(o.watt - targetWatt) / targetWatt;
      const td = Math.abs(o.tSnap - o.tExact) / o.tExact;
      return (0.05 + pw * pw) * (0.05 + td);
    };
    const minScore = Math.min(...options.map(score));
    const tied = options.filter(o => score(o) <= minScore * (1 + SCORE_TIE));
    return tied.reduce((a, b) =>
      Math.abs(b.watt - targetWatt) < Math.abs(a.watt - targetWatt) ? b : a);
  }
  const pool0 = close;
  const minErr = Math.min(...pool0.map(o => Math.abs(o.dev)));
  const tied = pool0.filter(o => Math.abs(o.dev) <= minErr + TIE_EPS);
  const minT = Math.min(...tied.map(o => o.tSnap));
  let pool = tied;
  if (state.tieBreak === "shorter") {
    pool = tied.filter(o => o.tSnap <= minT * 1.05);
  } else if (state.tieBreak === "lower") {
    if (tied.length > 1) {
      const maxT = Math.max(...tied.map(o => o.tSnap));
      if (maxT <= 1.5 * minT) {
        pool = tied.filter(o => o.tSnap <= minT * 1.05);
      } else {
        pool = tied.filter(o => o.tSnap <= 1.5 * minT);
      }
    }
  }
  const cmp = state.tieBreak === "higher"
    ? (a, b) => b.watt - a.watt
    : (a, b) => a.watt - b.watt;
  return pool.reduce((a, b) => cmp(a, b) <= 0 ? a : b);
}
function fmt(sec) {



  sec = Math.round(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function devText(dev) {
  const pct = Math.round(dev * 100);
  if (pct === 0) return `<span class="ok">${t("energy_exact")}</span>`;
  const cls = Math.abs(pct) <= 10 ? "ok" : "bad";
  const key = pct > 0 ? "energy_over" : "energy_under";
  return `<span class="${cls}">${t(key, { pct: Math.abs(pct) })}</span>`;
}

/* ================= Render ================= */

const $ = id => document.getElementById(id);

function renderDeviceChips() {
  const box = $("device-chips");
  box.innerHTML = "";
  for (const d of state.devices) {
    const chip = document.createElement("button");
    chip.className = "chip" + (d.id === state.activeDeviceId ? " selected" : "");
    chip.textContent = `${d.name} (${d.watt}W)`;
    chip.addEventListener("click", () => {
      state.activeDeviceId = d.id;
      input.manualStep = null;
      saveState();
      renderDeviceChips();
      renderResult();
    });
    box.appendChild(chip);
  }
}

function renderPresets() {
  const box = $("preset-buttons");
  box.innerHTML = "";
  for (const w of state.presets) {
    const b = document.createElement("button");
    b.className = "btn" + (input.watt === w ? " selected" : "");
    b.textContent = w + "W";
    b.addEventListener("click", () => {
      input.watt = w;
      input.manualStep = null;
      renderPresets();
      renderResult();
    });
    box.appendChild(b);
  }
}

function renderTime() {
  $("time-display").textContent = fmt(input.sec);
  const m = Math.floor(input.sec / 60);
  const s = input.sec % 60;
  renderTimeBtns("min-btns", state.minuteButtons, "min", m);
  renderTimeBtns("sec-btns", state.secondButtons, "sec", s);
}

function renderTimeBtns(boxId, values, kind, active) {
  const box = $(boxId);
  box.innerHTML = "";
  for (const v of values) {
    const b = document.createElement("button");
    b.className = "btn" + (kind === "sec" ? " sec-btn" : " min-btn");
    if (v === active) b.classList.add("selected");
    b.textContent = kind === "sec" ? v + "s" : v;
    b.addEventListener("click", () => {
      if (kind === "min") input.sec = v * 60 + (input.sec % 60);
      else input.sec = Math.floor(input.sec / 60) * 60 + v;
      input.manualStep = null;
      renderTime(); renderResult();
    });
    box.appendChild(b);
  }
}

function renderResult() {
  const empty = $("result-empty");
  const main = $("result-main");
  if (!input.watt || input.sec <= 0) {
    empty.classList.remove("hidden");
    main.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  main.classList.remove("hidden");

  const options = computeOptions(input.watt, input.sec);
  const best = pickBest(options, input.watt);
  const chosen = input.manualStep !== null
    ? options.find(o => o.step === input.manualStep) || best
    : best;

  const device = activeDevice();
  const stepText = fmtStep(device, chosen.step);
  $("result-step").textContent = (device.mode ?? "percent") === "watt"
    ? stepText
    : t("result_step", { step: stepText, watt: Math.round(chosen.watt) });
  $("result-time").textContent = fmt(chosen.tSnap);
  $("result-energy").innerHTML =
    `${devText(chosen.dev)} · ${t("result_target", { watt: input.watt, time: fmt(input.sec) })}`;

  renderStepsTable(options, chosen);
}

function fmtStep(device, step) {
  return (device.mode ?? "percent") === "watt" ? `${step} W` : `${step}%`;
}

function renderStepsTable(options, chosen) {
  const table = $("steps-table");
  if (table.classList.contains("hidden")) return;
  table.innerHTML = "";
  const device = activeDevice();
  const wattMode = (device.mode ?? "percent") === "watt";
  for (const o of options) {
    const row = document.createElement("button");
    row.className = "step-row";
    if (o === chosen) row.classList.add(input.manualStep !== null ? "manual" : "best");
    row.innerHTML =
      `<span>${wattMode ? `${Math.round(o.watt)}W` : `${fmtStep(device, o.step)} · ${Math.round(o.watt)}W`}</span>` +
      `<span class="t">${fmt(o.tSnap)}</span>` +
      `<span class="dev ${Math.abs(o.dev) <= 0.1 ? "ok" : "bad"}">${(o.dev * 100 >= 0 ? "+" : "") + Math.round(o.dev * 100)}%</span>`;
    row.addEventListener("click", () => {
      input.manualStep = o.step;
      renderResult();
    });
    table.appendChild(row);
  }
}

/* ================= Events ================= */

function bindEvents() {
  $("btn-help").addEventListener("click", () => $("help-modal").classList.remove("hidden"));
  $("btn-theme").addEventListener("click", toggleTheme);
  $("btn-theme").setAttribute("aria-label", t("theme_toggle"));
  $("help-close").addEventListener("click", () => $("help-modal").classList.add("hidden"));
  $("help-modal").addEventListener("click", e => {
    if (e.target === $("help-modal")) $("help-modal").classList.add("hidden");
  });

  $("watt-custom-set").addEventListener("click", () => {
    const v = parseInt($("watt-custom").value, 10);
    if (Number.isFinite(v) && v > 0) {
      input.watt = v;
      input.manualStep = null;
      renderPresets();
      renderResult();
    }
  });

  const adjust = delta => {
    input.sec = Math.max(0, Math.min(59 * 60 + 59, input.sec + delta));
    input.manualStep = null;
    renderTime(); renderResult();
  };
  $("min-minus").addEventListener("click", () => adjust(-60));
  $("min-plus").addEventListener("click", () => adjust(60));
  $("sec-minus").addEventListener("click", () => adjust(-5));
  $("sec-plus").addEventListener("click", () => adjust(5));

  $("steps-toggle").addEventListener("click", () => {
    const table = $("steps-table");
    const show = table.classList.toggle("hidden") === false;
    $("steps-toggle").textContent = t(show ? "hide_levels" : "show_levels");
    if (show) renderResult();
  });
}

function renderAll() {
  renderDeviceChips();
  renderPresets();
  renderTime();
  renderResult();
}

document.documentElement.lang = currentLang;
applyStaticTranslations();
bindEvents();
renderAll();
