"use strict";
/* Лабиринт: recursive backtracker (рандомизированный DFS) строит "идеальный"
   лабиринт — между стартом и финишем ровно один путь, без петель и срезок,
   но с боковыми тупиками, в которые легко свернуть по ошибке. Сложность
   растёт размером сетки (длиннее путь, больше развилок) — те же чипы, что у
   Шульте. "Сложный режим" — не про размер, а про туман войны: видны только
   клетки рядом с уже пройденным маршрутом, поэтому решать приходится по
   памяти о пройденном, а не разглядыванием всего поля сразу (см. Design:
   если весь лабиринт виден целиком, путь считывается взглядом за секунды
   независимо от размера сетки — без тумана сложность была бы фиктивной). */

import { getBest } from "../progress.js";
import { getLevel, adjustLevel } from "../difficulty.js";
import { good, bad } from "../feedback.js";

const LEVELS = [8, 10, 13, 16];
const DIRS = [["N", 0, -1], ["S", 0, 1], ["E", 1, 0], ["W", -1, 0]];
const OPP = { N: "S", S: "N", E: "W", W: "E" };

function generateMaze(size) {
  const cells = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ N: false, S: false, E: false, W: false })));
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const stack = [[0, 0]];
  visited[0][0] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = DIRS
      .map(([d, dx, dy]) => [d, x + dx, y + dy])
      .filter(([, nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size && !visited[ny][nx]);
    if (!options.length) { stack.pop(); continue; }
    const [d, nx, ny] = options[Math.floor(Math.random() * options.length)];
    cells[y][x][d] = true;
    cells[ny][nx][OPP[d]] = true;
    visited[ny][nx] = true;
    stack.push([nx, ny]);
  }
  return cells;
}

// BFS старт -> финиш. В идеальном лабиринте путь единственный, поэтому это
// заодно и "оптимальное" число ходов, с которым потом сравнивается реальное.
function solveLength(cells, size) {
  const prev = Array.from({ length: size }, () => Array(size).fill(null));
  const seen = Array.from({ length: size }, () => Array(size).fill(false));
  const queue = [[0, 0]];
  seen[0][0] = true;
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === size - 1 && y === size - 1) break;
    for (const [d, dx, dy] of DIRS) {
      if (!cells[y][x][d]) continue;
      const nx = x + dx, ny = y + dy;
      if (seen[ny][nx]) continue;
      seen[ny][nx] = true;
      prev[ny][nx] = [x, y];
      queue.push([nx, ny]);
    }
  }
  let steps = 0;
  let cur = [size - 1, size - 1];
  while (prev[cur[1]][cur[0]]) { cur = prev[cur[1]][cur[0]]; steps++; }
  return steps;
}

export default {
  mount(container, api) {
    let size = getLevel("maze", LEVELS, 10);
    let timerId = null;
    let keydownHandler = null;
    let hardMode = false;

    function renderIntro() {
      const best = getBest(hardMode ? `maze:${size}:hard` : `maze:${size}`);
      container.innerHTML = `
        <div class="ex-intro">
          <p>Дойди от старта (сверху слева) до финиша (снизу справа). Ходи
            стрелками или кликай по соседней клетке — только там, где нет стены.</p>
          <div class="ex-options">
            <div class="chip-group" id="sizeGroup">
              ${LEVELS.map(v => `<button class="chip" type="button" data-size="${v}" aria-pressed="${v === size}">${v}×${v}</button>`).join("")}
            </div>
          </div>
          <label class="check-row">
            <input type="checkbox" id="hardMode" ${hardMode ? "checked" : ""}>
            <span>Сложный режим: виден только пройденный путь рядом с тобой</span>
          </label>
          ${best ? `<p class="feedback">Личный рекорд на ${size}×${size}${hardMode ? " (сложный режим)" : ""}: ${best.value.toFixed(1)} с</p>` : ""}
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelectorAll("#sizeGroup .chip").forEach(chip => {
        chip.addEventListener("click", () => { size = Number(chip.dataset.size); renderIntro(); });
      });
      container.querySelector("#hardMode").addEventListener("change", e => { hardMode = e.target.checked; renderIntro(); });
      container.querySelector("#start").addEventListener("click", startRound);
    }

    function startRound() {
      if (timerId) { clearInterval(timerId); timerId = null; }
      if (keydownHandler) { document.removeEventListener("keydown", keydownHandler); keydownHandler = null; }
      api.setRestart(startRound);

      const cells = generateMaze(size);
      const optimal = solveLength(cells, size);
      let px = 0, py = 0;
      let steps = 0;
      const revealed = new Set();
      const reveal = (x, y) => {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) revealed.add(`${nx},${ny}`);
        }
      };
      reveal(0, 0);
      const startedAt = performance.now();

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="elapsed">0.0 с</span><span class="l">Время</span></div>
          <div class="hud-stat"><span class="v" id="steps">0</span><span class="l">Ходы</span></div>
        </div>
        <div class="maze-board" id="board" style="--size:${size}"></div>
      `;
      const board = container.querySelector("#board");
      const elapsedEl = container.querySelector("#elapsed");
      const stepsEl = container.querySelector("#steps");

      function render() {
        board.innerHTML = "";
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const cell = document.createElement("div");
            cell.className = "maze-cell";
            if (hardMode && !revealed.has(`${x},${y}`)) { cell.classList.add("is-hidden-cell"); board.append(cell); continue; }
            const c = cells[y][x];
            cell.style.borderTopStyle = c.N ? "none" : "solid";
            cell.style.borderBottomStyle = c.S ? "none" : "solid";
            cell.style.borderLeftStyle = c.W ? "none" : "solid";
            cell.style.borderRightStyle = c.E ? "none" : "solid";
            if (x === px && y === py) cell.classList.add("is-player");
            if (x === size - 1 && y === size - 1) cell.classList.add("is-goal");
            cell.addEventListener("click", () => tryMove(x, y));
            board.append(cell);
          }
        }
      }
      render();

      function tryMove(tx, ty) {
        const dx = tx - px, dy = ty - py;
        const dir = dx === 1 && dy === 0 ? "E" : dx === -1 && dy === 0 ? "W" : dx === 0 && dy === 1 ? "S" : dx === 0 && dy === -1 ? "N" : null;
        if (!dir || !cells[py][px][dir]) { bad(); return; }
        px = tx; py = ty;
        steps++;
        stepsEl.textContent = String(steps);
        reveal(px, py);
        if (px === size - 1 && py === size - 1) { good(); finish(); return; }
        render();
      }

      keydownHandler = e => {
        const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
        const d = map[e.key];
        if (!d) return;
        e.preventDefault();
        tryMove(px + d[0], py + d[1]);
      };
      document.addEventListener("keydown", keydownHandler);

      timerId = setInterval(() => {
        elapsedEl.textContent = `${((performance.now() - startedAt) / 1000).toFixed(1)} с`;
      }, 100);

      function finish() {
        clearInterval(timerId);
        timerId = null;
        document.removeEventListener("keydown", keydownHandler);
        keydownHandler = null;
        const elapsed = (performance.now() - startedAt) / 1000;
        const efficiency = Math.round((100 * optimal) / steps);
        // Как и в Шульте: автоподбор рассчитан на обычный режим — в сложном
        // время и так закономерно больше из-за тумана, не из-за трудности пути.
        let difficultyNote = null;
        if (!hardMode) {
          const outcome = efficiency >= 70 ? "up" : efficiency < 40 ? "down" : "stay";
          const adjusted = adjustLevel("maze", LEVELS, size, outcome);
          difficultyNote = adjusted.direction === "up" ? `Прошёл почти без тупиков — в следующий раз предложим ${adjusted.next}×${adjusted.next}`
            : adjusted.direction === "down" ? `Пока сложновато — в следующий раз предложим ${adjusted.next}×${adjusted.next}` : null;
        }
        api.showResult(container, {
          headline: "Выход найден!",
          stats: [
            { value: `${elapsed.toFixed(1)} с`, label: "Время" },
            { value: steps, label: "Ходы" },
            { value: `${efficiency}%`, label: "Эффективность" },
          ],
          record: { key: hardMode ? `maze:${size}:hard` : `maze:${size}`, value: elapsed, direction: "lower", format: v => `${v.toFixed(1)} с` },
          difficultyNote,
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => {
      if (timerId) clearInterval(timerId);
      if (keydownHandler) document.removeEventListener("keydown", keydownHandler);
    };
  },
};
