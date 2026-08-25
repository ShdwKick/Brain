"use strict";
/* Устный счёт: примеры на время, 60 секунд, три уровня сложности. */

import { getLevel, adjustLevel } from "../difficulty.js";
import { good, bad } from "../feedback.js";

const LEVELS = ["easy", "medium", "hard"];
const TIER_LABEL = { easy: "лёгкий", medium: "средний", hard: "сложный" };
const ROUND_SECONDS = 60;

function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

function makeProblem(tier) {
  if (tier === "easy") {
    const a = randInt(2, 20), b = randInt(1, Math.min(a, 20));
    return Math.random() < 0.5 ? { text: `${a} + ${b}`, answer: a + b } : { text: `${a} - ${b}`, answer: a - b };
  }
  if (tier === "medium") {
    if (Math.random() < 0.5) {
      const a = randInt(2, 12), b = randInt(2, 12);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    const a = randInt(20, 99), b = randInt(10, 99);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  // hard
  if (Math.random() < 0.5) {
    const a = randInt(11, 20), b = randInt(2, 9);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  const b = randInt(2, 12), q = randInt(2, 12), a = b * q;
  return { text: `${a} ÷ ${b}`, answer: q };
}

export default {
  mount(container, api) {
    let tier = getLevel("mathsprint", LEVELS, "medium");
    let timerId = null;

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Решай примеры в уме и вводи ответ — чем быстрее, тем больше
            успеешь за ${ROUND_SECONDS} секунд.</p>
          <div class="ex-options">
            <div class="chip-group" id="tierGroup">
              ${[["easy", "Лёгкий"], ["medium", "Средний"], ["hard", "Сложный"]].map(([v, l]) => `<button class="chip" type="button" data-tier="${v}" aria-pressed="${v === tier}">${l}</button>`).join("")}
            </div>
          </div>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelectorAll("#tierGroup .chip").forEach(chip => {
        chip.addEventListener("click", () => {
          tier = chip.dataset.tier;
          container.querySelectorAll("#tierGroup .chip").forEach(c => c.setAttribute("aria-pressed", String(c === chip)));
        });
      });
      container.querySelector("#start").addEventListener("click", startRound);
    }

    function startRound() {
      if (timerId) { clearInterval(timerId); timerId = null; }
      api.setRestart(startRound);
      let timeLeft = ROUND_SECONDS;
      let correct = 0, total = 0;
      let current = null;

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="time">${timeLeft}</span><span class="l">Секунд</span></div>
          <div class="hud-stat"><span class="v" id="correct">0</span><span class="l">Верно</span></div>
        </div>
        <p class="math-expr" id="expr"></p>
        <div class="ex-form">
          <input class="ex-input" id="answer" type="number" inputmode="numeric" autocomplete="off" placeholder="Ответ">
          <button class="btn filled" id="submit" type="button">Ответить</button>
        </div>
      `;
      const exprEl = container.querySelector("#expr");
      const input = container.querySelector("#answer");
      const correctEl = container.querySelector("#correct");
      input.focus();

      function nextProblem() {
        current = makeProblem(tier);
        exprEl.textContent = current.text;
        input.value = "";
        input.style.color = "";
      }

      function submit() {
        if (!current) return;
        total++;
        const val = Number(input.value);
        if (val === current.answer) {
          good();
          correct++;
          correctEl.textContent = String(correct);
          input.style.color = "#2e7d32";
        } else {
          bad();
          input.style.color = "var(--md-sys-color-error)";
        }
        nextProblem();
      }
      container.querySelector("#submit").addEventListener("click", submit);
      input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

      nextProblem();
      timerId = setInterval(() => {
        timeLeft--;
        container.querySelector("#time").textContent = String(timeLeft);
        if (timeLeft <= 0) finish();
      }, 1000);

      function finish() {
        clearInterval(timerId);
        timerId = null;
        const accuracy = total ? correct / total : 0;
        const outcome = total >= 8 && accuracy >= 0.85 ? "up" : total >= 4 && accuracy < 0.5 ? "down" : "stay";
        const adjusted = adjustLevel("mathsprint", LEVELS, tier, outcome);
        const difficultyNote = adjusted.direction === "up" ? `Быстро и точно — в следующий раз предложим уровень «${TIER_LABEL[adjusted.next]}»`
          : adjusted.direction === "down" ? `Пока сложновато — в следующий раз предложим уровень «${TIER_LABEL[adjusted.next]}»` : null;
        api.showResult(container, {
          headline: "Время вышло",
          stats: [
            { value: correct, label: "Решено верно" },
            { value: total, label: "Всего попыток" },
          ],
          record: { key: `mathsprint:${tier}`, value: correct, direction: "higher", format: v => `${v} задач` },
          difficultyNote,
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => { if (timerId) clearInterval(timerId); };
  },
};
