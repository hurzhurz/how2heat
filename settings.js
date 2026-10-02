"use strict";

// Settings page. The state model (state helpers, DEFAULT_STATE) lives in state.js.

let state = loadState();

const $ = id => document.getElementById(id);

function renderLangBar() {
  const bar = $("lang-bar");
  bar.innerHTML = "";
  for (const l of LANGS) {
    const b = document.createElement("button");
    b.className = "lang-btn" + (l.code === currentLang ? " selected" : "");
    b.textContent = l.label;
    b.setAttribute("aria-label", l.code);
    b.addEventListener("click", () => {
      setLang(l.code);
      renderLangBar();
      renderSettings();
    });
    bar.appendChild(b);
  }
}

function renderSettings() {
  const device = activeDevice();
  const mode = device.mode ?? "percent";
  $("set-name").value = device.name;
  $("set-watt").value = device.watt;
  $("set-tiebreak").value = state.tieBreak;
  $("mode-percent").classList.toggle("selected", mode === "percent");
  $("mode-watt").classList.toggle("selected", mode === "watt");
  const legend = $("levels-legend");
  legend.textContent = t(mode === "watt" ? "levels_watt" : "levels_pct");
  $("set-step-new").placeholder = mode === "watt" ? "W" : "%";

  const devBox = $("set-devices");
  devBox.innerHTML = "";
  for (const d of state.devices) {
    const chip = document.createElement("span");
    chip.className = "chip" + (d.id === state.activeDeviceId ? " selected" : "");
    const label = document.createElement("span");
    label.textContent = d.name;
    label.style.cursor = "pointer";
    label.addEventListener("click", () => {
      state.activeDeviceId = d.id;
      saveState(); renderSettings();
    });
    chip.appendChild(label);
    if (state.devices.length > 1) {
      const x = document.createElement("button");
      x.textContent = "×";
      x.addEventListener("click", () => {
        state.devices = state.devices.filter(dd => dd.id !== d.id);
        if (state.activeDeviceId === d.id) state.activeDeviceId = state.devices[0].id;
        saveState(); renderSettings();
      });
      chip.appendChild(x);
    }
    devBox.appendChild(chip);
  }

  const stepsBox = $("set-steps");
  stepsBox.innerHTML = "";
  for (const step of device.steps) {
    const chip = document.createElement("span");
    chip.className = "chip";
    const label = mode === "watt"
      ? `${step}W`
      : `${step}% · ${Math.round(stepWatt(device, step))}W`;
    chip.innerHTML = `<span>${label}</span>`;
    if (device.steps.length > 1) {
      const x = document.createElement("button");
      x.textContent = "×";
      x.addEventListener("click", () => {
        device.steps = device.steps.filter(p => p !== step);
        saveState(); renderSettings();
      });
      chip.appendChild(x);
    }
    stepsBox.appendChild(chip);
  }

  const timingBox = $("set-timing");
  timingBox.innerHTML = "";
  state.timing.forEach((rule, i) => {
    const row = document.createElement("div");
    row.className = "timing-row";
    const last = i === state.timing.length - 1;
    const upTo = document.createElement("span");
    upTo.textContent = t("up_to");
    const upto = document.createElement("input");
    upto.type = "number"; upto.min = "1"; upto.inputMode = "numeric";
    upto.value = rule.uptoSec ?? "";
    upto.disabled = last;
    upto.placeholder = "∞";
    const unit = document.createElement("span");
    unit.className = "unit";
    const arrow = last ? "" : "s ";
    unit.innerHTML = `<span class="u-left">${arrow}</span><span class="u-arrow">→</span><span class="u-right">${t("step_s")}</span>`;
    const step = document.createElement("input");
    step.type = "number"; step.min = "1"; step.inputMode = "numeric";
    step.value = rule.stepSec;
    const del = document.createElement("button");
    del.textContent = "×";
    del.disabled = last || state.timing.length === 1;
    del.addEventListener("click", () => {
      state.timing.splice(i, 1);
      saveState(); renderSettings();
    });
    upto.addEventListener("change", () => {
      const v = parseInt(upto.value, 10);
      if (Number.isFinite(v) && v > 0) { rule.uptoSec = v; saveState(); }
    });
    step.addEventListener("change", () => {
      const v = parseInt(step.value, 10);
      if (Number.isFinite(v) && v > 0) { rule.stepSec = v; saveState(); }
    });
    row.append(upTo, upto, unit, step, del);
    timingBox.appendChild(row);
  });

  renderChipEditor("set-presets", state.presets, w => w + "W");
  renderChipEditor("set-minbtns", state.minuteButtons, v => v + " min");
  renderChipEditor("set-secbtns", state.secondButtons, v => v + "s");
}

function renderChipEditor(boxId, arr, fmtVal) {
  const box = $(boxId);
  box.innerHTML = "";
  arr.forEach((v, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `<span>${fmtVal(v)}</span>`;
    if (arr.length > 1) {
      const x = document.createElement("button");
      x.textContent = "×";
      x.addEventListener("click", () => {
        arr.splice(i, 1);
        saveState(); renderSettings();
      });
      chip.appendChild(x);
    }
    box.appendChild(chip);
  });
}

function bindEvents() {
  $("btn-theme").addEventListener("click", toggleTheme);
  $("btn-theme").setAttribute("aria-label", t("theme_toggle"));

  $("set-name").addEventListener("change", () => {
    activeDevice().name = $("set-name").value.trim() || t("default_device_name");
    saveState(); renderSettings();
  });
  $("set-device-add").addEventListener("click", () => {
    const name = $("set-device-new").value.trim();
    if (!name) return;
    const id = "dev" + Date.now();
    state.devices.push({ id, name, watt: 900, mode: "percent", steps: [10, 30, 50, 80, 100] });
    state.activeDeviceId = id;
    $("set-device-new").value = "";
    saveState(); renderSettings();
  });
  $("set-watt").addEventListener("change", () => {
    const d = activeDevice();
    const v = parseInt($("set-watt").value, 10);
    if (Number.isFinite(v) && v > 0 && v !== d.watt) {
      const oldWatt = d.watt;
      d.watt = v;
      if ((d.mode ?? "percent") === "watt") {
        d.steps = d.steps
          .map(w => Math.min(v, Math.round(w / oldWatt * v)))
          .filter((w, i, arr) => arr.indexOf(w) === i);
      }
      saveState(); renderSettings();
    }
  });
  $("set-step-add").addEventListener("click", () => {
    const d = activeDevice();
    const mode = d.mode ?? "percent";
    const v = parseInt($("set-step-new").value, 10);
    const max = mode === "watt" ? d.watt : 100;
    if (Number.isFinite(v) && v > 0 && v <= max) {
      if (!d.steps.includes(v)) d.steps.push(v);
      d.steps.sort((a, b) => a - b);
      $("set-step-new").value = "";
      saveState(); renderSettings();
    }
  });
  const switchMode = toMode => {
    const d = activeDevice();
    if ((d.mode ?? "percent") === toMode) return;
    d.steps = convertSteps(d, toMode);
    d.mode = toMode;
    saveState(); renderSettings();
  };
  $("mode-percent").addEventListener("click", () => switchMode("percent"));
  $("mode-watt").addEventListener("click", () => switchMode("watt"));
  $("set-timing-add").addEventListener("click", () => {
    const last = state.timing[state.timing.length - 1];
    state.timing.splice(state.timing.length - 1, 0,
      { uptoSec: (last.uptoSec ?? 300) * 2, stepSec: last.stepSec });
    saveState(); renderSettings();
  });
  $("set-preset-add").addEventListener("click", () => {
    const v = parseInt($("set-preset-new").value, 10);
    if (Number.isFinite(v) && v > 0) {
      if (!state.presets.includes(v)) state.presets.push(v);
      state.presets.sort((a, b) => a - b);
      $("set-preset-new").value = "";
      saveState(); renderSettings();
    }
  });
  $("set-minbtn-add").addEventListener("click", () => {
    const v = parseInt($("set-minbtn-new").value, 10);
    if (Number.isFinite(v) && v >= 0 && v <= 59) {
      if (!state.minuteButtons.includes(v)) state.minuteButtons.push(v);
      state.minuteButtons.sort((a, b) => a - b);
      $("set-minbtn-new").value = "";
      saveState(); renderSettings();
    }
  });
  $("set-secbtn-add").addEventListener("click", () => {
    const v = parseInt($("set-secbtn-new").value, 10);
    if (Number.isFinite(v) && v >= 0 && v < 60) {
      if (!state.secondButtons.includes(v)) state.secondButtons.push(v);
      state.secondButtons.sort((a, b) => a - b);
      $("set-secbtn-new").value = "";
      saveState(); renderSettings();
    }
  });
  $("set-tiebreak").addEventListener("change", () => {
    state.tieBreak = $("set-tiebreak").value;
    saveState();
  });

  $("btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "how2heat-settings.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("btn-import").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    const msg = $("import-msg");
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!validateState(parsed)) throw new Error("schema");
      state = parsed;
      saveState();
      renderSettings();
      msg.textContent = t("import_ok");
      msg.style.color = "var(--good)";
    } catch {
      msg.textContent = t("import_bad");
      msg.style.color = "var(--bad)";
    }
  });

  $("btn-reset").addEventListener("click", () => {
    if (!confirm(t("reset_confirm"))) return;
    state = structuredClone(DEFAULT_STATE);
    saveState();
    renderSettings();
  });
}

document.documentElement.lang = currentLang;
applyStaticTranslations();
renderLangBar();
bindEvents();
renderSettings();
