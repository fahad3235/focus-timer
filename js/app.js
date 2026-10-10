/* Focus Timer engine.
   Drift-corrected timing: every tick recomputes remaining time from a
   Date.now() deadline instead of counting intervals, so the timer stays
   accurate even when the tab is throttled.
   TEST OVERRIDE: ?t=<seconds> sets every phase to that many seconds
   (documented in README, used by the automated tests). */
(function () {
"use strict";

const $ = (s) => document.querySelector(s);
const T = () => I18N[lang];

/* ---------- persistent state ---------- */
let lang = "en";
try { lang = localStorage.getItem("ft_lang") || "en"; } catch (e) {}

const LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 90], rounds: [1, 12] };
const DEFAULTS = { focus: 25, short: 5, long: 15, rounds: 4 };

function loadJSON(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === "object" ? Object.assign({}, fallback, v) : Object.assign({}, fallback);
  } catch (e) { return Object.assign({}, fallback); }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

let settings = loadJSON("ft_settings", DEFAULTS);
let history = [];
try { history = JSON.parse(localStorage.getItem("ft_history") || "[]"); } catch (e) { history = []; }

/* ---------- test override ---------- */
const qs = new URLSearchParams(location.search);
const testSecs = parseInt(qs.get("t") || "", 10);
const useTestDur = Number.isFinite(testSecs) && testSecs > 0;

/* ---------- timer state ---------- */
let phase = "focus";            // focus | short | long
let running = false;
let totalMs = durMs("focus");
let remainingMs = totalMs;
let endAt = 0;
let tickId = null;
let doneInCycle = 0;           // completed focus sessions in current cycle

function durMs(kind) {
  if (useTestDur) return testSecs * 1000;
  return settings[kind] * 60000;
}

/* ---------- display ---------- */
const CIRC = 2 * Math.PI * 88;

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

function renderTimer() {
  $("#timeDisplay").textContent = fmt(remainingMs);
  $("#phaseLabel").textContent = T()["phase_" + phase];
  $("#cycleLabel").textContent = phase === "focus"
    ? T().cycleOf(Math.min(doneInCycle + 1, settings.rounds), settings.rounds) : "";
  const frac = totalMs > 0 ? 1 - remainingMs / totalMs : 0;
  $("#ringProg").style.strokeDashoffset = String(CIRC * (1 - Math.min(1, Math.max(0, frac))));
  const btn = $("#btnMain");
  btn.textContent = running ? T().pause : (remainingMs < totalMs ? T().resume : T().start);
  document.title = `${fmt(remainingMs)} · ${T()["phase_" + phase]} — ${T().title}`;
}

function renderStats() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 6 * 86400000;
  let today = 0, week = 0;
  for (const h of history) {
    if (h.ts >= startOfToday) today += h.minutes;
    if (h.ts >= weekAgo) week += h.minutes;
  }
  $("#statToday").textContent = `${today} ${T().minUnit}`;
  $("#statWeek").textContent = `${week} ${T().minUnit}`;
  $("#statSessions").textContent = String(history.length);
}

function renderHistory() {
  const ul = $("#historyList");
  ul.innerHTML = "";
  const items = history.slice(-20).reverse();
  $("#historyEmpty").hidden = items.length > 0;
  for (const h of items) {
    const li = document.createElement("li");
    const d = new Date(h.ts);
    const ds = d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB",
      { day: "numeric", month: "short" });
    li.textContent = T().histEntry(ds, h.minutes);
    ul.appendChild(li);
  }
}

/* ---------- alerts ---------- */
let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.frequency.value = 880; o.type = "sine";
    g.gain.setValueAtTime(0.001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    o.start(); o.stop(audioCtx.currentTime + 0.65);
  } catch (e) { /* audio unavailable — silent fallback */ }
}

let titleFlashId = null;
function flashTitle(msg) {
  let on = false;
  clearInterval(titleFlashId);
  titleFlashId = setInterval(() => {
    document.title = on ? msg : `⏰ ${msg}`;
    on = !on;
  }, 800);
  setTimeout(() => { clearInterval(titleFlashId); renderTimer(); }, 8000);
}

function alertPhase(message) {
  beep();
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(T().notifTitle, { body: message });
    } else {
      flashTitle(message);
    }
  } catch (e) { flashTitle(message); }
}

function ensureNotifPermission() {
  try {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  } catch (e) {}
}

/* ---------- phase machine ---------- */
function setPhase(p) {
  phase = p;
  totalMs = durMs(p);
  remainingMs = totalMs;
  running = false;
  clearInterval(tickId);
  renderTimer();
}

function tick() {
  remainingMs = Math.max(0, endAt - Date.now());
  if (remainingMs <= 0) { completePhase(); return; }
  renderTimer();
}

function startPause() {
  ensureNotifPermission();
  if (running) {                       // pause
    remainingMs = Math.max(0, endAt - Date.now());
    running = false;
    clearInterval(tickId);
  } else {                             // start / resume
    if (remainingMs <= 0) setPhase(phase);
    endAt = Date.now() + remainingMs;
    running = true;
    tickId = setInterval(tick, 200);
  }
  renderTimer();
}

function completePhase() {
  running = false;
  clearInterval(tickId);
  if (phase === "focus") {
    const minutes = useTestDur ? 0 : settings.focus;
    if (!useTestDur) {
      history.push({ ts: Date.now(), minutes });
      saveJSON("ft_history", history);
    }
    doneInCycle++;
    const next = (doneInCycle % settings.rounds === 0) ? "long" : "short";
    alertPhase(T().notifFocusDone);
    setPhase(next);
  } else {
    alertPhase(phase === "long" ? T().notifLongDone : T().notifShortDone);
    if (phase === "long") doneInCycle = 0;
    setPhase("focus");
  }
  renderStats();
  renderHistory();
}

function skipPhase() {
  // Skip without logging history for an unfinished focus block.
  running = false;
  clearInterval(tickId);
  if (phase === "focus") {
    doneInCycle++;
    setPhase((doneInCycle % settings.rounds === 0) ? "long" : "short");
  } else {
    if (phase === "long") doneInCycle = 0;
    setPhase("focus");
  }
}

function resetTimer() {
  running = false;
  clearInterval(tickId);
  remainingMs = totalMs = durMs(phase);
  renderTimer();
}

/* ---------- settings ---------- */
const INPUTS = { focus: "#inFocus", short: "#inShort", long: "#inLong", rounds: "#inRounds" };

function readSettings() {
  const err = $("#settingsError");
  err.hidden = true;
  const next = {};
  for (const key of Object.keys(INPUTS)) {
    const raw = $(INPUTS[key]).value.trim();
    const val = Number(raw);
    const [lo, hi] = LIMITS[key];
    if (!/^\d+$/.test(raw) || val < lo || val > hi) {
      err.textContent = T().invalid(lo, hi);
      err.hidden = false;
      $(INPUTS[key]).value = settings[key];
      return false;
    }
    next[key] = val;
  }
  settings = next;
  saveJSON("ft_settings", settings);
  if (!running) { totalMs = durMs(phase); remainingMs = totalMs; }
  renderTimer();
  return true;
}

/* ---------- language ---------- */
function applyLang() {
  document.documentElement.lang = lang === "bn" ? "bn" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (typeof T()[key] === "string") el.textContent = T()[key];
  });
  $("#langToggle").textContent = lang === "bn" ? "EN" : "বাং";
  try { localStorage.setItem("ft_lang", lang); } catch (e) {}
  renderTimer(); renderStats(); renderHistory();
}

/* ---------- init ---------- */
function init() {
  const rp = $("#ringProg");
  rp.style.strokeDasharray = String(CIRC);
  rp.style.strokeDashoffset = String(CIRC);

  for (const key of Object.keys(INPUTS)) {
    $(INPUTS[key]).value = settings[key];
    $(INPUTS[key]).addEventListener("change", readSettings);
  }
  $("#btnMain").addEventListener("click", startPause);
  $("#btnReset").addEventListener("click", resetTimer);
  $("#btnSkip").addEventListener("click", skipPhase);
  $("#langToggle").addEventListener("click", () => {
    lang = lang === "bn" ? "en" : "bn";
    applyLang();
  });

  const note = $("#permNote");
  try {
    if ("Notification" in window && Notification.permission === "default") {
      note.textContent = T().permNote;
      note.hidden = false;
    }
  } catch (e) {}

  applyLang();
  setPhase("focus");
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();
})();
