"use strict";
/* Trail Making: узлы разбросаны случайно, кликать нужно по возрастанию с
   чередованием числа/буквы — 1, А, 2, Б, 3, В... В отличие от таблиц Шульте
   это не сетка, а сканирование площади плюс переключение между двумя рядами. */

import { getLevel, adjustLevel } from "../difficulty.js";
import { good, bad } from "../feedback.js";

const LETTERS = ["А", "Б", "В", "Г", "Д", "Е", "Ж", "З", "И", "К"];
const LEVELS = [6, 8, 10];
const NODE_R = 19;
const STAGE_W = 560, STAGE_H = 320;

function buildPositions(count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0, ok = false;
    do {
      x = NODE_R + 6 + Math.random() * (STAGE_W - (NODE_R + 6) * 2);
      y = NODE_R + 6 + Math.random() * (STAGE_H - (NODE_R + 6) * 2);
      ok = points.every(p => Math.hypot(p.x - x, p.y - y) > NODE_R * 2.2);
      tries++;
    } while (!ok && tries < 200);
    points.push({ x, y });
  }
  return points;
}

export default {
  mount(container, api) {
    let pairs = getLevel("trail", LEVELS, 8);
    let timerId = null;

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Кликай по кружкам по возрастанию, чередуя числа и буквы:
            1, А, 2, Б, 3, В... Кружки разбросаны случайно — сначала найди
            глазами, потом кликай.</p>
          <div class="ex-options">
            <div class="chip-group" id="pairsGroup">
              ${[6, 8, 10].map(v => `<button class="chip" type="button" data-pairs="${v}" aria-pressed="${v === pairs}">${v} пар</button>`).join("")}
            </div>
          </div>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelectorAll("#pairsGroup .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          pairs = Number(chip.dataset.pairs);
          renderIntro();
        });
      });
      container.querySelector("#start").addEventListener("click", startRound);
    }

    function startRound() {
      const seq = [];
      for (let i = 0; i < pairs; i++) { seq.push(String(i + 1)); seq.push(LETTERS[i]); }
      const positions = buildPositions(seq.length);
      let nextIndex = 0;
      let errors = 0;
      const startedAt = performance.now();

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="elapsed">0.0 с</span><span class="l">Время</span></div>
          <div class="hud-stat"><span class="v" id="target">${seq[0]}</span><span class="l">Дальше</span></div>
          <div class="hud-stat"><span class="v" id="errors">0</span><span class="l">Ошибок</span></div>
        </div>
        <div class="trail-stage" id="stage">
          <svg class="trail-lines" id="lines"></svg>
        </div>
      `;
      const stage = container.querySelector("#stage");
      const linesEl = container.querySelector("#lines");
      const targetEl = container.querySelector("#target");
      const errorsEl = container.querySelector("#errors");
      const nodeEls = [];

      seq.forEach((label, i) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "trail-node";
        el.textContent = label;
        el.style.left = positions[i].x + "px";
        el.style.top = positions[i].y + "px";
        el.addEventListener("click", () => onNodeClick(i, el));
        stage.append(el);
        nodeEls.push(el);
      });

      timerId = setInterval(() => {
        container.querySelector("#elapsed").textContent = `${((performance.now() - startedAt) / 1000).toFixed(1)} с`;
      }, 100);

      function onNodeClick(i, el) {
        if (i === nextIndex) {
          good();
          el.classList.add("is-done");
          if (nextIndex > 0) {
            const prev = positions[nextIndex - 1], cur = positions[nextIndex];
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M${prev.x},${prev.y} L${cur.x},${cur.y}`);
            linesEl.append(path);
          }
          nextIndex++;
          if (nextIndex >= seq.length) { finish(); return; }
          targetEl.textContent = seq[nextIndex];
        } else if (!el.classList.contains("is-done")) {
          bad();
          errors++;
          errorsEl.textContent = String(errors);
          el.classList.add("is-wrong");
          setTimeout(() => el.classList.remove("is-wrong"), 220);
        }
      }

      function finish() {
        clearInterval(timerId);
        timerId = null;
        const elapsed = (performance.now() - startedAt) / 1000;
        const timePerPair = elapsed / pairs;
        const outcome = timePerPair < 2.5 && errors <= 1 ? "up" : timePerPair > 5 || errors >= 4 ? "down" : "stay";
        const adjusted = adjustLevel("trail", LEVELS, pairs, outcome);
        const difficultyNote = adjusted.direction === "up" ? `Быстро и точно — в следующий раз предложим ${adjusted.next} пар`
          : adjusted.direction === "down" ? `Пока сложновато — в следующий раз предложим ${adjusted.next} пар` : null;
        api.showResult(container, {
          headline: "Готово!",
          stats: [
            { value: `${elapsed.toFixed(1)} с`, label: "Время" },
            { value: errors, label: "Ошибок" },
            { value: `${pairs} пар`, label: "Сложность" },
          ],
          record: { key: `trail:${pairs}`, value: elapsed, direction: "lower", format: v => `${v.toFixed(1)} с` },
          difficultyNote,
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => { if (timerId) clearInterval(timerId); };
  },
};
