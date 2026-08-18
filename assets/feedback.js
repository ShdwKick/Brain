"use strict";
/* Тактильный и звуковой отклик на "верно"/"неверно". Вибрация — сама собой,
   где её нет, просто ничего не происходит. Звук — по умолчанию выключен
   (тренажёр открывают где угодно, не у всех уместно пиликанье) и включается
   отдельным тумблером в шапке; звук синтезируется Web Audio, без файлов —
   тот же принцип, что и у остального сервиса: ни одного медиа-ассета. */

const SOUND_KEY = "bh-sound";
let audioCtx = null;

export function isSoundOn() {
  return localStorage.getItem(SOUND_KEY) === "1";
}
export function setSoundOn(on) {
  try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); }
  catch { /* приватный режим — тумблер просто не запомнится */ }
}

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration, { type = "sine", peak = 0.15, delay = 0 } = {}) {
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + delay;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Лёгкий отклик на верное действие — короткая вибрация + восходящая нота. */
export function good() {
  if ("vibrate" in navigator) navigator.vibrate(15);
  if (isSoundOn()) {
    tone(660, 0.09, { peak: 0.12 });
    tone(880, 0.12, { peak: 0.13, delay: 0.06 });
  }
}
/** Отклик на ошибку — двойная вибрация + низкий короткий гудок. */
export function bad() {
  if ("vibrate" in navigator) navigator.vibrate([20, 40, 20]);
  if (isSoundOn()) tone(160, 0.16, { type: "square", peak: 0.08 });
}
