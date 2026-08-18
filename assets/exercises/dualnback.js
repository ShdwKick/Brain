"use strict";
/* Dual n-back: позиция на сетке 3×3 и буква одновременно, две независимые
   реакции. Без звука (см. Design/README.md — только то, что можно
   реализовать без медиа-ассетов), поэтому "вторая модальность" — буква
   текстом, а не на слух, как в классическом варианте. */

import { getLevel, adjustLevel } from "../difficulty.js";

const LETTERS = ["Б", "В", "Г", "Д", "Ж", "К", "Л", "М", "Н", "П", "Р", "С"];
const LEVELS = [1, 2];
const TOTAL = 20;
const SHOW_MS = 900;
const GAP_MS = 700;

function buildTrials(n) {
  const positions = [], letters = [];
  for (let i = 0; i < TOTAL; i++) {
    positions.push(i >= n && Math.random() < 0.3 ? positions[i - n] : Math.floor(Math.random() * 9));
    letters.push(i >= n && Math.random() < 0.3 ? letters[i - n] : LETTERS[Math.floor(Math.random() * LETTERS.length)]);
  }
  return { positions, letters };
}

export default {
  mount(container, api) {
    let running = true;
    let n = getLevel("dualnback", LEVELS, 1);
    let keydownHandler = null;
    let timers = [];
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Каждая проба — это подсвеченная клетка сетки и буква одновременно.
            Жми «Позиция», если клетка совпадает с той, что была N шагов назад,
            и «Буква» — если совпадает буква. Может сработать и то, и другое
            сразу, а может ничего.</p>
          <div class="ex-options">
            <div class="chip-group" id="nGroup">
              ${[1, 2].map(v => `<button class="chip" type="button" data-n="${v}" aria-pressed="${v === n}">N=${v}</button>`).join("")}
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
      const { positions, letters } = buildTrials(n);
      let idx = -1;
      let posResponded = false, letResponded = false;
      let posHits = 0, posMisses = 0, posFalse = 0, posCorrectRej = 0;
      let letHits = 0, letMisses = 0, letFalse = 0, letCorrectRej = 0;

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="progress">0/${TOTAL}</span><span class="l">Проба</span></div>
          <div class="hud-stat"><span class="v">N=${n}</span><span class="l">Назад</span></div>
        </div>
        <p class="switch-cue" id="letter">·</p>
        <div class="tile-grid" id="grid" style="--cols:3;width:12rem"></div>
        <div class="switch-answers">
          <button class="btn filled" id="posBtn" type="button">Позиция (A)</button>
          <button class="btn filled" id="letBtn" type="button">Буква (L)</button>
        </div>
      `;
      const grid = container.querySelector("#grid");
      for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.className = "tile";
        grid.append(cell);
      }
      const cells = [...grid.children];
      const letterEl = container.querySelector("#letter");
      const progressEl = container.querySelector("#progress");

      container.querySelector("#posBtn").addEventListener("click", () => respond("pos"));
      container.querySelector("#letBtn").addEventListener("click", () => respond("let"));
      keydownHandler = e => {
        if (e.code === "KeyA") respond("pos");
        else if (e.code === "KeyL") respond("let");
      };
      document.addEventListener("keydown", keydownHandler);

      function respond(kind) {
        if (!running || idx < 0 || idx >= TOTAL) return;
        if (kind === "pos") {
          if (posResponded) return;
          posResponded = true;
          if (idx >= n && positions[idx] === positions[idx - n]) posHits++; else posFalse++;
        } else {
          if (letResponded) return;
          letResponded = true;
          if (idx >= n && letters[idx] === letters[idx - n]) letHits++; else letFalse++;
        }
      }

      function tick() {
        if (!running) return;
        idx++;
        if (idx >= TOTAL) { finish(); return; }
        posResponded = false; letResponded = false;
        cells.forEach(c => c.classList.remove("is-lit"));
        cells[positions[idx]].classList.add("is-lit");
        letterEl.textContent = letters[idx];
        progressEl.textContent = `${idx + 1}/${TOTAL}`;
        timers.push(setTimeout(() => {
          if (!running) return;
          if (idx >= n) {
            const posTarget = positions[idx] === positions[idx - n];
            const letTarget = letters[idx] === letters[idx - n];
            if (!posResponded) { if (posTarget) posMisses++; else posCorrectRej++; }
            if (!letResponded) { if (letTarget) letMisses++; else letCorrectRej++; }
          }
          cells.forEach(c => c.classList.remove("is-lit"));
          letterEl.textContent = "·";
          timers.push(setTimeout(tick, GAP_MS));
        }, SHOW_MS));
      }
      tick();

      function finish() {
        document.removeEventListener("keydown", keydownHandler);
        keydownHandler = null;
        const posAnswered = posHits + posMisses + posFalse + posCorrectRej;
        const letAnswered = letHits + letMisses + letFalse + letCorrectRej;
        const posAcc = posAnswered ? Math.round((100 * (posHits + posCorrectRej)) / posAnswered) : 0;
        const letAcc = letAnswered ? Math.round((100 * (letHits + letCorrectRej)) / letAnswered) : 0;
        const combined = Math.round((posAcc + letAcc) / 2);
        const outcome = combined >= 80 ? "up" : combined < 55 ? "down" : "stay";
        const { direction, next } = adjustLevel("dualnback", LEVELS, n, outcome);
        const difficultyNote = direction === "up" ? `Отличная точность — в следующий раз предложим N=${next}`
          : direction === "down" ? `Пока сложновато — в следующий раз предложим N=${next}` : null;
        api.showResult(container, {
          headline: "Забег завершён",
          stats: [
            { value: `${combined}%`, label: "Общая точность" },
            { value: `${posAcc}%`, label: "Позиция" },
            { value: `${letAcc}%`, label: "Буква" },
          ],
          record: { key: `dualnback:${n}`, value: combined, direction: "higher", format: v => `${v}%` },
          difficultyNote,
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
