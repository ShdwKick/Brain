"use strict";
/**
 * Тренажёр «Пораскинем мозгами?»: хаб + hash-роутер на одной странице.
 * Без бэкенда и без авторизации — но личные рекорды всё же живут в
 * localStorage конкретного браузера (см. assets/progress.js), это не
 * противоречит "без сохранения" из ранних версий: там речь была про
 * серверный аккаунт, а не про то, есть ли смысл возвращаться. Список
 * упражнений — данные, а не разметка: карточки хаба собираются из
 * EXERCISES, сами упражнения грузятся динамическим import() по мере
 * открытия (см. Design/README.md про отсутствие авторизации здесь).
 */
import { recordBest, getBest, getAllRecords, timesLabel } from "./progress.js";
import { isSoundOn, setSoundOn } from "./feedback.js";

const $ = id => document.getElementById(id);
const view = $("view");

/* ---------- тема (см. Design/palette.md: рассвет — не осветлённая ночь) ---------- */

const THEME_KEY = "bh-theme";
const moonIcon = `<svg class="icon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const sunIcon = `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>`;

function currentTheme() {
  return localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  $("themeBtn").innerHTML = theme === "dark" ? sunIcon : moonIcon;
}
applyTheme(currentTheme());
$("themeBtn").addEventListener("click", () => {
  const next = currentTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

/* ---------- звук: по умолчанию выключен, тумблер запоминает выбор ---------- */

const soundOnIcon = `<svg class="icon" viewBox="0 0 24 24"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12"/></svg>`;
const soundOffIcon = `<svg class="icon" viewBox="0 0 24 24"><path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>`;
function applySoundIcon() {
  $("soundBtn").innerHTML = isSoundOn() ? soundOnIcon : soundOffIcon;
  $("soundBtn").title = isSoundOn() ? "Выключить звук" : "Включить звук";
}
applySoundIcon();
$("soundBtn").addEventListener("click", () => {
  setSoundOn(!isSoundOn());
  applySoundIcon();
});

/* ---------- тихий фон: та же анимация, но приглушённая (см. Shared/brand.css
   .bh-backdrop--quiet) — не про вестибулярную чувствительность (для этого
   есть prefers-reduced-motion), а про то, что фон иногда просто отвлекает. */

const QUIET_KEY = "bh-quiet";
function isQuiet() { return localStorage.getItem(QUIET_KEY) === "1"; }
function applyQuiet(on) {
  $("backdrop").classList.toggle("bh-backdrop--quiet", on);
  $("quietBtn").classList.toggle("is-active", on);
}
applyQuiet(isQuiet());
$("quietBtn").addEventListener("click", () => {
  const next = !isQuiet();
  localStorage.setItem(QUIET_KEY, next ? "1" : "0");
  applyQuiet(next);
});

/* ---------- PWA: офлайн-кэш и установка на экран ---------- */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* офлайн просто не заработает, страница и так рабочая */ });
  });
}

let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstall = e;
  $("installBtn").classList.remove("is-hidden");
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("installBtn").classList.add("is-hidden");
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  $("installBtn").classList.add("is-hidden");
});

/* ---------- реестр упражнений ---------- */

const TIER_LABEL = { easy: "лёгкий", medium: "средний", hard: "сложный" };
const CATEGORY_LABEL = { animals: "Животные", fruits: "Фрукты и овощи", countries: "Страны", professions: "Профессии" };

const EXERCISES = [
  { id: "nback", domain: "Рабочая память", name: "N-back",
    teaser: "Жми, когда текущая буква совпадает с той, что была N шагов назад.",
    load: () => import("./exercises/nback.js"),
    badgeKey: "nback:2", badgeFormat: v => `${v}%`, parseKey: s => `N=${s}` },
  { id: "dualnback", domain: "Рабочая память", name: "Dual n-back",
    teaser: "Позиция и буква одновременно — две независимые реакции.",
    load: () => import("./exercises/dualnback.js"),
    badgeKey: "dualnback:2", badgeFormat: v => `${v}%`, parseKey: s => `N=${s}` },
  { id: "corsi", domain: "Рабочая память", name: "Corsi tapping",
    teaser: "Повтори мигающую последовательность блоков на сетке.",
    load: () => import("./exercises/corsi.js"),
    badgeKey: "corsi:3", badgeFormat: v => `длина ${v}`, parseKey: s => `${s}×${s}` },
  { id: "pairs", domain: "Рабочая память", name: "Парная память",
    teaser: "Найди все пары карточек за минимум попыток.",
    load: () => import("./exercises/pairs.js"),
    badgeKey: "pairs:8", badgeFormat: v => `${v} попыток`, parseKey: s => `${s} пар` },
  { id: "schulte", domain: "Внимание и скорость", name: "Таблицы Шульте",
    teaser: "Найди числа по порядку как можно быстрее.",
    load: () => import("./exercises/schulte.js"),
    badgeKey: "schulte:4", badgeFormat: v => `${v.toFixed(1)} с`,
    parseKey: s => { const [size, hard] = s.split(":"); return `${size}×${size}${hard ? " (сложный)" : ""}`; } },
  { id: "stroop", domain: "Внимание и скорость", name: "Струп-тест",
    teaser: "Назови цвет чернил, а не то, что написано словом.",
    load: () => import("./exercises/stroop.js"),
    badgeKey: "stroop", badgeFormat: v => `${v}%` },
  { id: "trail", domain: "Внимание и скорость", name: "Trail Making",
    teaser: "Соединяй числа и буквы по очереди: 1, А, 2, Б, 3, В...",
    load: () => import("./exercises/trail.js"),
    badgeKey: "trail:8", badgeFormat: v => `${v.toFixed(1)} с`, parseKey: s => `${s} пар` },
  { id: "reaction", domain: "Внимание и скорость", name: "Скорость реакции",
    teaser: "Жди сигнала и жми как можно быстрее.",
    load: () => import("./exercises/reaction.js"),
    badgeKey: "reaction", badgeFormat: v => `${Math.round(v)} мс` },
  { id: "rotation", domain: "Пространственное мышление", name: "Мысленное вращение",
    teaser: "Найди все настоящие повороты фигуры среди похожих.",
    load: () => import("./exercises/rotation.js"),
    badgeKey: "rotation", badgeFormat: v => `${v}/8` },
  { id: "hanoi", domain: "Планирование", name: "Ханойская башня",
    teaser: "Перенеси все диски на третий стержень за минимум ходов.",
    load: () => import("./exercises/hanoi.js"),
    badgeKey: "hanoi", badgeFormat: v => `${v}% эффективность` },
  { id: "anagrams", domain: "Вербальные навыки", name: "Анаграммы",
    teaser: "Собери слово из перемешанных букв на время.",
    load: () => import("./exercises/anagrams.js"),
    badgeKey: "anagrams:medium", badgeFormat: v => `${v}/8`, parseKey: s => TIER_LABEL[s] || s },
  { id: "categories", domain: "Вербальные навыки", name: "Категории на скорость",
    teaser: "Назови как можно больше слов из категории за 45 секунд.",
    load: () => import("./exercises/categories.js"),
    badgeKey: null, badgeFormat: v => `${v} слов`, parseKey: s => CATEGORY_LABEL[s] || s },
  { id: "switching", domain: "Когнитивная гибкость", name: "Переключение правил",
    teaser: "Правило меняется без предупреждения — успевай подстроиться.",
    load: () => import("./exercises/switching.js"),
    badgeKey: "switching", badgeFormat: v => `${v}%` },
  { id: "mathsprint", domain: "Числовая беглость", name: "Устный счёт",
    teaser: "Решай примеры на скорость — 60 секунд на как можно больше.",
    load: () => import("./exercises/mathsprint.js"),
    badgeKey: "mathsprint:medium", badgeFormat: v => `${v} задач`, parseKey: s => TIER_LABEL[s] || s },
];
const byId = new Map(EXERCISES.map(e => [e.id, e]));

/* ---------- знак ---------- */

function markSvg(gradId) {
  return `<svg class="bh-mark" viewBox="0 0 24 24" role="img" aria-hidden="true">
    <defs><linearGradient id="${gradId}" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="var(--flame-base, #9d174d)"/><stop offset="1" stop-color="var(--flame-tip, #ff5c8a)"/>
    </linearGradient></defs>
    <path fill="url(#${gradId})" fill-rule="evenodd"
      d="M12 1.2C13.6 5 16.4 6.6 18.2 9.4C21.4 14.4 18.6 22.4 12 22.4C5.4 22.4 2.6 14.4 5.8 9.4C7.2 7.2 9.2 6 10.2 3.4C10.9 5.6 11.4 6.6 12 7.4C12.4 5.6 12.3 3.4 12 1.2ZM12 9.8 7.4 13.6V19.2H16.6V13.6Z"/>
  </svg>`;
}

/* ---------- общий "shell" для результата упражнения ----------
   Единственное, что упражнения переиспользуют готовым: экран результата и
   пара навигационных методов. Всё остальное (idle/playing) — их собственная
   разметка внутри переданного контейнера. */

const restartIcon = `<svg class="icon" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`;

// Кнопка рестарта живёт в постоянной шапке упражнения (см. renderExercise),
// а не в разметке самого упражнения — так у каждого упражнения свой смысл
// "начать заново" (перегенерировать таблицу, сбросить раунд), но кнопка и
// её видимость управляются одним и тем же местом вместо 14 копий вёрстки.
let restartHandler = null;

function makeApi() {
  return {
    showResult(container, { headline, stats = [], record, difficultyNote, onRestart } = {}) {
      this.setRestart(null);
      let recordLine = "";
      if (record) {
        const { isNewBest, best, plays } = recordBest(record.key, { value: record.value, direction: record.direction });
        const display = record.format ? record.format(best) : best;
        recordLine = `<p class="feedback${isNewBest ? " is-good" : ""}">${isNewBest ? "Новый личный рекорд: " : "Личный рекорд: "}${display} · сыграно ${timesLabel(plays)}</p>`;
      }
      const difficultyLine = difficultyNote ? `<p class="feedback">${difficultyNote}</p>` : "";
      container.innerHTML = `
        <div class="ex-result">
          <p class="headline">${headline}</p>
          <div class="stat-row">
            ${stats.map(s => `<div class="stat"><span class="v">${s.value}</span><span class="l">${s.label}</span></div>`).join("")}
          </div>
          ${recordLine}
          ${difficultyLine}
          <div class="actions">
            <button class="btn filled" id="exRestart" type="button">Сыграть ещё раз</button>
            <button class="btn outlined" id="exHub" type="button">Все упражнения</button>
          </div>
        </div>`;
      container.querySelector("#exRestart").addEventListener("click", () => onRestart && onRestart());
      container.querySelector("#exHub").addEventListener("click", () => this.navigateHub());
    },
    navigateHub() {
      location.hash = "#/";
    },
    // fn — функция без аргументов, перезапускающая текущий раунд заново
    // (например, перегенерировать таблицу Шульте); null/undefined скрывает
    // кнопку — так упражнение само решает, когда рестарт уместен.
    setRestart(fn) {
      restartHandler = typeof fn === "function" ? fn : null;
      const btn = $("exRestartBtn");
      if (btn) btn.classList.toggle("is-hidden", !restartHandler);
    },
  };
}

/* ---------- роутер ---------- */

let currentCleanup = null;
let navToken = 0;

function teardown() {
  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch (err) { console.error(err); }
  }
  currentCleanup = null;
}

function renderHub() {
  teardown();
  const groups = new Map();
  EXERCISES.forEach(ex => {
    if (!groups.has(ex.domain)) groups.set(ex.domain, []);
    groups.get(ex.domain).push(ex);
  });

  view.innerHTML = `
    <header class="hero">
      <h1>Пораскинем мозгами?</h1>
      <p>${EXERCISES.length} коротких упражнений на память, внимание, счёт и
        гибкость мышления. Без входа, без сохранения аккаунта — открой и играй.</p>
      <div class="hero-actions">
        <button class="btn filled" id="randomBtn" type="button">Случайное упражнение</button>
        <button class="btn outlined" id="statsBtn" type="button">Моя статистика</button>
      </div>
    </header>
    ${[...groups.entries()].map(([domain, items], gi) => `
      <section class="domain-group">
        <h2 class="domain-title">${domain}</h2>
        <div class="hub-grid">
          ${items.map((ex, i) => {
            const best = ex.badgeKey ? getBest(ex.badgeKey) : null;
            const badge = best ? `<p class="badge">Рекорд: ${ex.badgeFormat(best.value)}</p>` : "";
            return `
            <button class="ex-card" type="button" data-go="${ex.id}">
              <div class="row">
                ${markSvg(`hubMark${gi}-${i}`)}
                <h2>${ex.name}</h2>
              </div>
              <p class="teaser">${ex.teaser}</p>
              ${badge}
            </button>`;
          }).join("")}
        </div>
      </section>`).join("")}
  `;
  view.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => { location.hash = "#/" + btn.dataset.go; });
  });
  $("randomBtn").addEventListener("click", () => {
    const pick = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
    location.hash = "#/" + pick.id;
  });
  $("statsBtn").addEventListener("click", () => { location.hash = "#/stats"; });
}

function renderStats() {
  teardown();
  const all = getAllRecords();
  const rows = EXERCISES.map(ex => {
    const prefix = ex.id + ":";
    const entries = Object.entries(all)
      .filter(([k]) => k === ex.id || k.startsWith(prefix))
      .map(([k, v]) => ({
        label: k === ex.id ? null : (ex.parseKey ? ex.parseKey(k.slice(prefix.length)) : k.slice(prefix.length)),
        value: ex.badgeFormat ? ex.badgeFormat(v.value) : v.value,
        plays: v.plays,
      }));
    return { ex, entries };
  }).filter(r => r.entries.length);

  view.innerHTML = `
    <div class="ex-header">
      <button class="back-btn" id="statsBack" type="button" aria-label="Все упражнения">
        <svg class="icon" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="titles">
        <h1>Моя статистика</h1>
        <p class="domain-tag">Личные рекорды по всем упражнениям</p>
      </div>
    </div>
    <div class="ex-stage ex-stage--stats">
      ${rows.length ? rows.map(r => `
        <div class="stats-row">
          <h3>${r.ex.name}</h3>
          <div class="stat-row">
            ${r.entries.map(e => `
              <div class="stat">
                <span class="v">${e.value}</span>
                <span class="l">${e.label ? e.label + " · " : ""}${timesLabel(e.plays)}</span>
              </div>`).join("")}
          </div>
        </div>`).join("") : `<p class="feedback">Пока пусто — сыграй хотя бы раз в любое упражнение, и здесь появится статистика.</p>`}
    </div>
  `;
  $("statsBack").addEventListener("click", () => { location.hash = "#/"; });
}

async function renderExercise(id) {
  teardown();
  const meta = byId.get(id);
  if (!meta) { location.hash = "#/"; return; }

  restartHandler = null;
  const token = ++navToken;
  view.innerHTML = `
    <div class="ex-header">
      <button class="back-btn" id="exBack" type="button" aria-label="Все упражнения">
        <svg class="icon" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="titles">
        <h1>${meta.name}</h1>
        <p class="domain-tag">${meta.domain}</p>
      </div>
      <button class="icon-btn is-hidden" id="exRestartBtn" type="button" title="Начать заново" aria-label="Начать заново">${restartIcon}</button>
    </div>
    <div class="ex-stage" id="exStage" aria-live="polite"></div>
  `;
  $("exBack").addEventListener("click", () => { location.hash = "#/"; });
  $("exRestartBtn").addEventListener("click", () => { if (restartHandler) restartHandler(); });
  const stage = $("exStage");
  stage.innerHTML = `<p class="feedback">Загрузка…</p>`;

  const mod = await meta.load();
  if (token !== navToken) return; // ушли на другой маршрут, пока грузился модуль

  const api = makeApi();
  stage.innerHTML = "";
  const cleanup = mod.default.mount(stage, api);
  currentCleanup = typeof cleanup === "function" ? cleanup : null;
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash) renderHub();
  else if (hash === "stats") renderStats();
  else renderExercise(hash);
}

window.addEventListener("hashchange", route);
route();
