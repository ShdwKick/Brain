"use strict";
/* Таблицы Шульте: клик по числам 1..size^2 по порядку на время, без штрафа
   за неверный клик. "Лучшее время за сессию" — в памяти модуля (см.
   Design/README.md: сервис ничего не сохраняет между визитами). */

const bestTimes = {}; // живёт, пока открыта вкладка — сбрасывается на перезагрузке

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
    let size = 4;
    let timerId = null;

    function renderIntro() {
      const best = bestTimes[size];
      container.innerHTML = `
        <div class="ex-intro">
          <p>Кликай по числам по порядку — от 1 до последнего — как можно быстрее.
            Ошибочный клик ничего не портит, просто продолжай.</p>
          <div class="ex-options">
            <div class="chip-group" id="sizeGroup">
              ${[3, 4, 5, 6].map(v => `<button class="chip" type="button" data-size="${v}" aria-pressed="${v === size}">${v}×${v}</button>`).join("")}
            </div>
          </div>
          ${best ? `<p class="feedback">Лучшее время за сессию на ${size}×${size}: ${best.toFixed(1)} с</p>` : ""}
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelectorAll("#sizeGroup .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          size = Number(chip.dataset.size);
          renderIntro();
        });
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
          tile.classList.add("is-done");
          tile.disabled = true;
          next++;
          if (next > total) { finish(startedAt); return; }
          targetEl.textContent = String(next);
        } else {
          tile.classList.add("is-wrong");
          setTimeout(() => tile.classList.remove("is-wrong"), 220);
        }
      }

      function finish(startedAt) {
        clearInterval(timerId);
        timerId = null;
        const elapsed = (performance.now() - startedAt) / 1000;
        if (!bestTimes[size] || elapsed < bestTimes[size]) bestTimes[size] = elapsed;
        api.showResult(container, {
          headline: "Готово!",
          stats: [
            { value: `${elapsed.toFixed(1)} с`, label: "Время" },
            { value: `${bestTimes[size].toFixed(1)} с`, label: "Лучшее за сессию" },
            { value: `${size}×${size}`, label: "Сетка" },
          ],
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
