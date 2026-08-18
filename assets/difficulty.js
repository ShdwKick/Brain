"use strict";
/* Автоподбор сложности: после каждого забega система предлагает следующий
   уровень — выше при явном успехе, ниже при явных трудностях, иначе тот же.
   Только предложение, не рамка: чипы выбора уровня в упражнениях остаются
   кликабельными, человек в любой момент может выбрать другой уровень сам —
   тогда именно от него оттолкнётся следующая подстройка (см. вызовы
   adjustLevel в самих упражнениях — они всегда берут уровень, на котором
   реально сыграли, а не "официально предложенный"). Хранится в localStorage,
   переживает перезагрузку, как и assets/progress.js. */

const KEY = "bh-brain-difficulty-v1";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function writeAll(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { /* приватный режим/квота — просто не запомнится до следующего визита */ }
}

export function getLevel(key, levels, fallback) {
  const stored = readAll()[key];
  return levels.includes(stored) ? stored : (fallback ?? levels[0]);
}

/** outcome: "up" | "down" | "stay". Возвращает новый уровень и сдвинулся ли он. */
export function adjustLevel(key, levels, playedLevel, outcome) {
  const idx = levels.indexOf(playedLevel);
  const base = idx === -1 ? 0 : idx;
  const nextIdx = outcome === "up" ? Math.min(levels.length - 1, base + 1)
    : outcome === "down" ? Math.max(0, base - 1)
    : base;
  const next = levels[nextIdx];
  const all = readAll();
  all[key] = next;
  writeAll(all);
  return { next, direction: nextIdx > base ? "up" : nextIdx < base ? "down" : "same" };
}
