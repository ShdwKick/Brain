"use strict";
/* Локальный прогресс: личные рекорды по каждому упражнению (и режиму —
   ключ вида "nback:2", "schulte:4"), в localStorage конкретного браузера.
   Не аккаунт и не синхронизация между устройствами — просто чтобы было что
   побивать при следующем визите (см. Design/README.md: сервис без бэкенда). */

const KEY = "bh-brain-progress-v1";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function writeAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { /* приватный режим/квота — прогресс просто не переживёт визит */ }
}

export function recordBest(key, { value, direction }) {
  const all = readAll();
  const prev = all[key];
  const plays = (prev?.plays || 0) + 1;
  const isNewBest = !prev || (direction === "higher" ? value > prev.value : value < prev.value);
  all[key] = { value: isNewBest ? value : prev.value, direction, ts: Date.now(), plays };
  writeAll(all);
  return { isNewBest, best: all[key].value, plays };
}

export function getBest(key) {
  return readAll()[key] || null;
}

/** Все записи разом — для сводной страницы статистики по всем упражнениям. */
export function getAllRecords() {
  return readAll();
}

export function timesLabel(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} раз`;
  if (mod10 === 1) return `${n} раз`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} раза`;
  return `${n} раз`;
}
