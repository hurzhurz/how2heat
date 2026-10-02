"use strict";

// Shared state model, used by both index.html (app.js) and settings.html.

const STORAGE_KEY = "how2heat.state";

const DEFAULT_STATE = {
  v: 1,
  activeDeviceId: "dev1",
  devices: [
    { id: "dev1", name: t("default_device_name"), watt: 900, mode: "percent", steps: [10, 30, 50, 80, 100] },
  ],
  timing: [
    { uptoSec: 60, stepSec: 5 },
    { uptoSec: 300, stepSec: 10 },
    { uptoSec: null, stepSec: 30 },
  ],
  presets: [600, 700, 750, 800, 850, 900],
  minuteButtons: [0, 1, 2, 3, 4, 5],
  secondButtons: [0, 15, 30, 45],
  tieBreak: "lower",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return validateState(parsed) ? parsed : structuredClone(DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function validateState(s) {
  return (
    s && s.v === 1 &&
    Array.isArray(s.devices) && s.devices.length >= 1 &&
    s.devices.every(d =>
      d && typeof d.id === "string" && typeof d.name === "string" &&
      Number.isFinite(d.watt) && d.watt > 0 &&
      ["percent", "watt"].includes(d.mode ?? "percent") &&
      Array.isArray(d.steps) && d.steps.length >= 1 &&
      d.steps.every(p => Number.isFinite(p) && p > 0 &&
        ((d.mode ?? "percent") === "percent" ? p <= 100 : p <= d.watt))) &&
    Array.isArray(s.timing) && s.timing.length >= 1 &&
    s.timing.every(r => r && (r.uptoSec === null || (Number.isFinite(r.uptoSec) && r.uptoSec > 0)) &&
      Number.isFinite(r.stepSec) && r.stepSec > 0) &&
    Array.isArray(s.presets) && s.presets.every(w => Number.isFinite(w) && w > 0) &&
    Array.isArray(s.minuteButtons) && s.minuteButtons.length >= 1 &&
    s.minuteButtons.every(v => Number.isFinite(v) && v >= 0 && v <= 59) &&
    Array.isArray(s.secondButtons) && s.secondButtons.length >= 1 &&
    s.secondButtons.every(v => Number.isFinite(v) && v >= 0 && v < 60) &&
    ["lower", "higher", "shorter"].includes(s.tieBreak) &&
    typeof s.activeDeviceId === "string" &&
    s.devices.some(d => d.id === s.activeDeviceId)
  );
}

function activeDevice() {
  return state.devices.find(d => d.id === state.activeDeviceId) || state.devices[0];
}

function stepWatt(device, pct) {
  return device.watt * pct / 100;
}

// Actual watt of a step, depending on how the device defines its steps.
function stepToWatt(device, step) {
  return (device.mode ?? "percent") === "watt" ? step : stepWatt(device, step);
}

// Convert step values when switching between percent and watt mode.
function convertSteps(device, toMode) {
  const from = device.mode ?? "percent";
  if (from === toMode) return device.steps.slice();
  if (toMode === "watt") {
    return device.steps.map(p => Math.round(stepWatt(device, p)));
  }
  return device.steps.map(w => Math.round(w / device.watt * 100));
}
