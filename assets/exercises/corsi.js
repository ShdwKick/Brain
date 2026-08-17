"use strict";
/* Corsi tapping: сетка выбирается один раз в idle и не меняется в течение
   забега — позиции блоков должны быть неизменны, иначе тест перестаёт
   измерять пространственную память. Растёт только длина последовательности. */

const LIT_MS = 600;
const GAP_MS = 260;

function randomSequence(cellCount, length) {
  const seq = [];
  for (let i = 0; i < length; i++) seq.push(Math.floor(Math.random() * cellCount));
  return seq;
}

export default {
  mount(container, api) {
    let gridSize = 3;
    let timers = [];
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Запомни, какие блоки загораются по порядку, и повтори ту же
            последовательность тапами. С каждым успехом она становится длиннее.</p>
          <div class="ex-options">
            <div class="chip-group" id="sizeGroup">
              ${[3, 4].map(v => `<button class="chip" type="button" data-size="${v}" aria-pressed="${v === gridSize}">${v}×${v}</button>`).join("")}
            </div>
          </div>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelectorAll("#sizeGroup .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          gridSize = Number(chip.dataset.size);
          renderIntro();
        });
      });
      container.querySelector("#start").addEventListener("click", startRun);
    }

    function startRun() {
      const cellCount = gridSize * gridSize;
      let bestSpan = 0;
      let length = 3;

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="span">${length}</span><span class="l">Длина</span></div>
        </div>
        <div class="tile-grid" id="grid" style="--cols:${gridSize}"></div>
        <p class="feedback" id="msg">Смотри внимательно…</p>
      `;
      const grid = container.querySelector("#grid");
      const spanEl = container.querySelector("#span");
      const msgEl = container.querySelector("#msg");
      const cells = [];
      for (let i = 0; i < cellCount; i++) {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "tile";
        tile.addEventListener("click", () => onCellClick(i));
        grid.append(tile);
        cells.push(tile);
      }

      let phase = "showing";
      let sequence = [];
      let userIndex = 0;

      function playLevel() {
        phase = "showing";
        userIndex = 0;
        sequence = randomSequence(cellCount, length);
        spanEl.textContent = String(length);
        msgEl.textContent = "Смотри внимательно…";
        let i = 0;
        function showNext() {
          if (i >= sequence.length) {
            timers.push(setTimeout(() => {
              phase = "input";
              msgEl.textContent = "Теперь повтори";
            }, GAP_MS));
            return;
          }
          const idx = sequence[i];
          cells[idx].classList.add("is-lit");
          timers.push(setTimeout(() => {
            cells[idx].classList.remove("is-lit");
            i++;
            timers.push(setTimeout(showNext, GAP_MS));
          }, LIT_MS));
        }
        timers.push(setTimeout(showNext, 500));
      }

      function onCellClick(i) {
        if (phase !== "input") return;
        if (sequence[userIndex] === i) {
          cells[i].classList.add("is-done");
          timers.push(setTimeout(() => cells[i].classList.remove("is-done"), 220));
          userIndex++;
          if (userIndex >= sequence.length) {
            bestSpan = length;
            length++;
            phase = "showing";
            timers.push(setTimeout(playLevel, 500));
          }
        } else {
          cells[i].classList.add("is-wrong");
          phase = "done";
          timers.push(setTimeout(() => finish(), 260));
        }
      }

      function finish() {
        api.showResult(container, {
          headline: "Забег завершён",
          stats: [
            { value: bestSpan, label: "Максимальная длина" },
            { value: `${gridSize}×${gridSize}`, label: "Сетка" },
          ],
          onRestart: renderIntro,
        });
      }

      playLevel();
    }

    renderIntro();
    return () => { clearTimers(); };
  },
};
