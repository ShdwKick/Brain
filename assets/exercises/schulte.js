"use strict";
/* Таблицы Шульте: клик по числам 1..size^2 по порядку на время, без штрафа
   за неверный клик. Личный рекорд по каждому размеру сетки — через
   assets/progress.js (переживает перезагрузку страницы). */

import { getBest } from "../progress.js";
import { getLevel, adjustLevel } from "../difficulty.js";
import { good, bad } from "../feedback.js";

const LEVELS = [3, 4, 5, 6];

function shuffled(n) {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default {
  mount(container, api) {
    let size = getLevel("schulte", LEVELS, 4);
    let timerId = null;

    let hardMode = false;

    function renderIntro() {
      const best = getBest(hardMode ? `schulte:${size}:hard` : `schulte:${size}`);
      container.innerHTML = `
        <div class="ex-intro">
          <p>Кликай по числам по порядку — от 1 до последнего — как можно быстрее.
            Ошибочный клик ничего не портит, просто продолжай.</p>
          <div class="ex-options">
            <div class="chip-group" id="sizeGroup">
              ${[3, 4, 5, 6].map(v => `<button class="chip" type="button" data-size="${v}" aria-pressed="${v === size}">${v}×${v}</button>`).join("")}
            </div>
          </div>
          <label class="check-row">
            <input type="checkbox" id="hardMode" ${hardMode ? "checked" : ""}>
            <span>Сложный режим: подсветка найденной клетки гаснет через секунду</span>
          </label>
          ${best ? `<p class="feedback">Личный рекорд на ${size}×${size}${hardMode ? " (сложный режим)" : ""}: ${best.value.toFixed(1)} с</p>` : ""}
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelectorAll("#sizeGroup .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          size = Number(chip.dataset.size);
          renderIntro();
        });
      });
      container.querySelector("#hardMode").addEventListener("change", e => {
        hardMode = e.target.checked;
        renderIntro();
      });
      container.querySelector("#start").addEventListener("click", startRound);
    }

    function startRound() {
      const total = size * size;
      const order = shuffled(total);
      let next = 1;
      const startedAt = performance.now();

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="elapsed">0.0 с</span><span class="l">Время</span></div>
          <div class="hud-stat"><span class="v" id="target">1</span><span class="l">Следующее</span></div>
        </div>
        <div class="tile-grid" id="grid" style="--cols:${size}"></div>
      `;
      const grid = container.querySelector("#grid");
      const elapsedEl = container.querySelector("#elapsed");
      const targetEl = container.querySelector("#target");

      order.forEach(num => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "tile";
        tile.textContent = String(num);
        tile.dataset.num = String(num);
        tile.addEventListener("click", () => onTileClick(tile, num));
        grid.append(tile);
      });

      timerId = setInterval(() => {
        elapsedEl.textContent = `${((performance.now() - startedAt) / 1000).toFixed(1)} с`;
      }, 100);

      function onTileClick(tile, num) {
        if (num === next) {
          good();
          tile.classList.add("is-done");
          tile.disabled = true;
          next++;
          if (hardMode) setTimeout(() => tile.classList.add("is-fading"), 550);
          if (next > total) { finish(startedAt); return; }
          targetEl.textContent = String(next);
        } else {
          bad();
          tile.classList.add("is-wrong");
          setTimeout(() => tile.classList.remove("is-wrong"), 220);
        }
      }

      function finish(startedAt) {
        clearInterval(timerId);
        timerId = null;
        const elapsed = (performance.now() - startedAt) / 1000;
        const timePerCell = elapsed / total;
        // Автоподбор сложности рассчитан на обычный режим — в сложном
        // память и так под нагрузкой, а время закономерно больше.
        let difficultyNote = null;
        if (!hardMode) {
          const outcome = timePerCell < 1.0 ? "up" : timePerCell > 2.5 ? "down" : "stay";
          const adjusted = adjustLevel("schulte", LEVELS, size, outcome);
          difficultyNote = adjusted.direction === "up" ? `Быстро прошёл — в следующий раз предложим ${adjusted.next}×${adjusted.next}`
            : adjusted.direction === "down" ? `Пока сложновато — в следующий раз предложим ${adjusted.next}×${adjusted.next}` : null;
        }
        api.showResult(container, {
          headline: "Готово!",
          stats: [
            { value: `${elapsed.toFixed(1)} с`, label: "Время" },
            { value: `${size}×${size}`, label: "Сетка" },
            { value: hardMode ? "Да" : "Нет", label: "Сложный режим" },
          ],
          record: { key: hardMode ? `schulte:${size}:hard` : `schulte:${size}`, value: elapsed, direction: "lower", format: v => `${v.toFixed(1)} с` },
          difficultyNote,
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => {
      if (timerId) clearInterval(timerId);
    };
  },
};
