"use strict";
/* N-back: буквы-согласные, ~500мс показ / ~1600мс пауза, один блок ~22 пробы,
   N выбирается вручную (1..3), без автоповышения внутри забега. */

const LETTERS = ["Б","В","Г","Д","Ж","К","Л","М","Н","П","Р","С","Т","Ф","Х"];
const TOTAL = 22;
const SHOW_MS = 900;
const GAP_MS = 700;

function buildLetters(n) {
  const letters = [];
  for (let i = 0; i < TOTAL; i++) {
    if (i >= n && Math.random() < 0.3) letters.push(letters[i - n]);
    else letters.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
  }
  return letters;
}

export default {
  mount(container, api) {
    let running = true;
    let n = 2;
    let keydownHandler = null;
    let timers = [];
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Буквы появляются одна за другой. Нажми «Совпадает» (или пробел),
            когда текущая буква совпадает с той, что была N шагов назад.</p>
          <div class="ex-options">
            <div class="chip-group" id="nGroup">
              ${[1, 2, 3].map(v => `<button class="chip" type="button" data-n="${v}" aria-pressed="${v === n}">N=${v}</button>`).join("")}
            </div>
          </div>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelectorAll("#nGroup .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          n = Number(chip.dataset.n);
          container.querySelectorAll("#nGroup .chip").forEach(c => c.setAttribute("aria-pressed", String(c === chip)));
        });
      });
      container.querySelector("#start").addEventListener("click", startRound);
    }

    function startRound() {
      const letters = buildLetters(n);
      let idx = -1;
      let responded = false;
      let hits = 0, misses = 0, falseAlarms = 0, correctRejects = 0;

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="progress">0/${TOTAL}</span><span class="l">Проба</span></div>
          <div class="hud-stat"><span class="v">N=${n}</span><span class="l">Назад</span></div>
        </div>
        <div class="switch-stimulus" style="background:var(--md-sys-color-surface-container)">
          <span class="n" style="color:var(--md-sys-color-on-surface)" id="letter">·</span>
        </div>
        <button class="btn filled" id="matchBtn" type="button">Совпадает (пробел)</button>
      `;
      const letterEl = container.querySelector("#letter");
      const progressEl = container.querySelector("#progress");
      container.querySelector("#matchBtn").addEventListener("click", respond);
      keydownHandler = e => { if (e.code === "Space") { e.preventDefault(); respond(); } };
      document.addEventListener("keydown", keydownHandler);

      function respond() {
        if (!running || idx < 0 || idx >= TOTAL || responded) return;
        responded = true;
        const isTarget = idx >= n && letters[idx] === letters[idx - n];
        if (isTarget) hits++; else falseAlarms++;
      }

      function tick() {
        if (!running) return;
        idx++;
        if (idx >= TOTAL) { finish(); return; }
        responded = false;
        letterEl.textContent = letters[idx];
        progressEl.textContent = `${idx + 1}/${TOTAL}`;
        timers.push(setTimeout(() => {
          if (!running) return;
          const isTarget = idx >= n && letters[idx] === letters[idx - n];
          if (!responded) { if (isTarget) misses++; else correctRejects++; }
          letterEl.textContent = "·";
          timers.push(setTimeout(tick, GAP_MS));
        }, SHOW_MS));
      }
      tick();

      function finish() {
        document.removeEventListener("keydown", keydownHandler);
        keydownHandler = null;
        const answered = hits + misses + falseAlarms + correctRejects;
        const correct = hits + correctRejects;
        const accuracy = answered ? Math.round((100 * correct) / answered) : 0;
        api.showResult(container, {
          headline: "Забег завершён",
          stats: [
            { value: `${accuracy}%`, label: "Точность" },
            { value: hits, label: "Совпадения найдены" },
            { value: misses, label: "Пропущено" },
            { value: falseAlarms, label: "Ложных нажатий" },
          ],
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => {
      running = false;
      clearTimers();
      if (keydownHandler) document.removeEventListener("keydown", keydownHandler);
    };
  },
};
