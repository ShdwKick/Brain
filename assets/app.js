"use strict";
/**
 * Тренажёр «Пораскинем мозгами?»: хаб + hash-роутер на одной странице.
 * Без бэкенда и без сохранения прогресса — каждый забег живёт только в
 * памяти вкладки. Список упражнений — данные, а не разметка: карточки хаба
 * собираются из EXERCISES, сами упражнения грузятся динамическим import()
 * по мере открытия (см. Design/README.md про отсутствие авторизации здесь).
 */

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

/* ---------- реестр упражнений ---------- */

const EXERCISES = [
  { id: "nback", domain: "Рабочая память", name: "N-back",
    teaser: "Жми, когда текущая буква совпадает с той, что была N шагов назад.",
    load: () => import("./exercises/nback.js") },
  { id: "corsi", domain: "Рабочая память", name: "Corsi tapping",
    teaser: "Повтори мигающую последовательность блоков на сетке.",
    load: () => import("./exercises/corsi.js") },
  { id: "schulte", domain: "Внимание и скорость", name: "Таблицы Шульте",
    teaser: "Найди числа по порядку как можно быстрее.",
    load: () => import("./exercises/schulte.js") },
  { id: "stroop", domain: "Внимание и скорость", name: "Струп-тест",
    teaser: "Назови цвет чернил, а не то, что написано словом.",
    load: () => import("./exercises/stroop.js") },
  { id: "rotation", domain: "Пространственное мышление", name: "Мысленное вращение",
    teaser: "Найди все настоящие повороты фигуры среди похожих.",
    load: () => import("./exercises/rotation.js") },
  { id: "hanoi", domain: "Планирование", name: "Ханойская башня",
    teaser: "Перенеси все диски на третий стержень за минимум ходов.",
    load: () => import("./exercises/hanoi.js") },
  { id: "anagrams", domain: "Вербальные навыки", name: "Анаграммы",
    teaser: "Собери слово из перемешанных букв на время.",
    load: () => import("./exercises/anagrams.js") },
  { id: "switching", domain: "Когнитивная гибкость", name: "Переключение правил",
    teaser: "Правило меняется без предупреждения — успевай подстроиться.",
    load: () => import("./exercises/switching.js") },
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

function makeApi() {
  return {
    showResult(container, { headline, stats = [], onRestart } = {}) {
      container.innerHTML = `
        <div class="ex-result">
          <p class="headline">${headline}</p>
          <div class="stat-row">
            ${stats.map(s => `<div class="stat"><span class="v">${s.value}</span><span class="l">${s.label}</span></div>`).join("")}
          </div>
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
      <p>Восемь коротких упражнений на память, внимание и гибкость мышления.
        Без входа, без сохранения — открой и играй.</p>
    </header>
    ${[...groups.entries()].map(([domain, items], gi) => `
      <section class="domain-group">
        <h2 class="domain-title">${domain}</h2>
        <div class="hub-grid">
          ${items.map((ex, i) => `
            <button class="ex-card" type="button" data-go="${ex.id}">
              <div class="row">
                ${markSvg(`hubMark${gi}-${i}`)}
                <h2>${ex.name}</h2>
              </div>
              <p class="teaser">${ex.teaser}</p>
            </button>`).join("")}
        </div>
      </section>`).join("")}
  `;
  view.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => { location.hash = "#/" + btn.dataset.go; });
  });
}

async function renderExercise(id) {
  teardown();
  const meta = byId.get(id);
  if (!meta) { location.hash = "#/"; return; }

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
    </div>
    <div class="ex-stage" id="exStage" aria-live="polite"></div>
  `;
  $("exBack").addEventListener("click", () => { location.hash = "#/"; });
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
  else renderExercise(hash);
}

window.addEventListener("hashchange", route);
route();
