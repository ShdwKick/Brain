"use strict";
/* Парная память: перевёрнутые карточки, найти пары за минимум попыток.
   Символы — буквы (без картинок, ничего лишнего не грузим). */

import { getLevel, adjustLevel } from "../difficulty.js";
import { good, bad } from "../feedback.js";

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К", "Л", "М"];
const LEVELS = [6, 8, 12];
const MISMATCH_MS = 700;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default {
  mount(container, api) {
    let pairsCount = getLevel("pairs", LEVELS, 8);
    let timerId = null;
    let timers = [];
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Открывай по две карточки за раз. Совпали — остаются открытыми,
            не совпали — переворачиваются обратно. Найди все пары за
            минимум попыток.</p>
          <div class="ex-options">
            <div class="chip-group" id="countGroup">
              ${[6, 8, 12].map(v => `<button class="chip" type="button" data-count="${v}" aria-pressed="${v === pairsCount}">${v} пар</button>`).join("")}
            </div>
          </div>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelectorAll("#countGroup .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          pairsCount = Number(chip.dataset.count);
          renderIntro();
        });
      });
      container.querySelector("#start").addEventListener("click", startRound);
    }

    function startRound() {
      const cols = pairsCount <= 8 ? 4 : 6;
      const values = shuffle([...LETTERS.slice(0, pairsCount), ...LETTERS.slice(0, pairsCount)]);
      const cards = values.map(value => ({ value, revealed: false, matched: false }));
      let firstPick = null;
      let flips = 0;
      let matchedPairs = 0;
      let locked = false;
      const startedAt = performance.now();

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="elapsed">0.0 с</span><span class="l">Время</span></div>
          <div class="hud-stat"><span class="v" id="flips">0</span><span class="l">Попытки</span></div>
        </div>
        <div class="tile-grid" id="grid" style="--cols:${cols}"></div>
      `;
      const grid = container.querySelector("#grid");
      const flipsEl = container.querySelector("#flips");

      cards.forEach((card, i) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "tile";
        tile.textContent = "•";
        tile.addEventListener("click", () => onPick(i, tile));
        grid.append(tile);
      });
      const tileEls = [...grid.children];

      timerId = setInterval(() => {
        container.querySelector("#elapsed").textContent = `${((performance.now() - startedAt) / 1000).toFixed(1)} с`;
      }, 100);

      function onPick(i, tile) {
        if (locked || cards[i].matched || cards[i].revealed) return;
        cards[i].revealed = true;
        tile.textContent = cards[i].value;
        tile.classList.add("is-lit");
        if (firstPick === null) { firstPick = i; return; }
        flips++;
        flipsEl.textContent = String(flips);
        const a = firstPick, b = i;
        firstPick = null;
        if (cards[a].value === cards[b].value) {
          good();
          cards[a].matched = true; cards[b].matched = true;
          tileEls[a].classList.add("is-done"); tileEls[a].classList.remove("is-lit");
          tileEls[b].classList.add("is-done"); tileEls[b].classList.remove("is-lit");
          tileEls[a].disabled = true; tileEls[b].disabled = true;
          matchedPairs++;
          if (matchedPairs >= pairsCount) timers.push(setTimeout(finish, 250));
        } else {
          bad();
          locked = true;
          timers.push(setTimeout(() => {
            cards[a].revealed = false; cards[b].revealed = false;
            tileEls[a].textContent = "•"; tileEls[b].textContent = "•";
            tileEls[a].classList.remove("is-lit"); tileEls[b].classList.remove("is-lit");
            locked = false;
          }, MISMATCH_MS));
        }
      }

      function finish() {
        clearInterval(timerId);
        timerId = null;
        const elapsed = (performance.now() - startedAt) / 1000;
        const efficiency = (100 * pairsCount) / flips;
        const outcome = efficiency >= 70 ? "up" : efficiency < 40 ? "down" : "stay";
        const { direction, next } = adjustLevel("pairs", LEVELS, pairsCount, outcome);
        const difficultyNote = direction === "up" ? `Мало промахов — в следующий раз предложим ${next} пар`
          : direction === "down" ? `Пока сложновато — в следующий раз предложим ${next} пар` : null;
        api.showResult(container, {
          headline: "Все пары найдены!",
          stats: [
            { value: flips, label: "Попытки" },
            { value: `${elapsed.toFixed(1)} с`, label: "Время" },
            { value: `${pairsCount} пар`, label: "Сложность" },
          ],
          record: { key: `pairs:${pairsCount}`, value: flips, direction: "lower", format: v => `${v} попыток` },
          difficultyNote,
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => { if (timerId) clearInterval(timerId); clearTimers(); };
  },
};
