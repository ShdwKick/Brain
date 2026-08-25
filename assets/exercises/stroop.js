"use strict";
/* Струп-тест: слово-цвет в чернилах другого цвета, 4 цветные плашки-ответы
   (не подписи цветом — иначе кнопки сами станут вторым струп-эффектом),
   раунд 60 секунд. */

import { good, bad } from "../feedback.js";

const COLORS = [
  { name: "красный", hex: "#e53935" },
  { name: "синий", hex: "#1e88e5" },
  { name: "зелёный", hex: "#43a047" },
  { name: "жёлтый", hex: "#fdd835" },
];
const ROUND_SECONDS = 60;

function pickInk(wordColor) {
  // ~25% совпадений слова и цвета (конгруэнтные пробы), остальное — вразнобой.
  if (Math.random() < 0.25) return wordColor;
  const others = COLORS.filter(c => c.name !== wordColor.name);
  return others[Math.floor(Math.random() * others.length)];
}

export default {
  mount(container, api) {
    let timerId = null;

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Слово называет один цвет, но написано чернилами другого. Нажми на
            плашку того цвета, которым слово НАПИСАНО, а не то, что оно значит.</p>
          <button class="btn filled" id="start" type="button">Начать (60 сек)</button>
        </div>`;
      container.querySelector("#start").addEventListener("click", startRound);
    }

    function startRound() {
      if (timerId) { clearInterval(timerId); timerId = null; }
      api.setRestart(startRound);
      let timeLeft = ROUND_SECONDS;
      let correct = 0, incorrect = 0, streak = 0, bestStreak = 0;
      let current = null;

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="time">${timeLeft}</span><span class="l">Секунд</span></div>
          <div class="hud-stat"><span class="v" id="correct">0</span><span class="l">Верно</span></div>
          <div class="hud-stat"><span class="v" id="streak">0</span><span class="l">Подряд</span></div>
        </div>
        <p class="stroop-word" id="word"></p>
        <div class="swatch-row" id="swatches">
          ${COLORS.map(c => `<button class="swatch" type="button" data-color="${c.name}" style="background:${c.hex}" aria-label="${c.name}"></button>`).join("")}
        </div>
      `;
      const wordEl = container.querySelector("#word");
      const timeEl = container.querySelector("#time");
      const correctEl = container.querySelector("#correct");
      const streakEl = container.querySelector("#streak");

      container.querySelectorAll("#swatches .swatch").forEach(btn => {
        btn.addEventListener("click", () => answer(btn.dataset.color));
      });

      function nextTrial() {
        const wordColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        const ink = pickInk(wordColor);
        current = ink;
        wordEl.textContent = wordColor.name.toUpperCase();
        wordEl.style.color = ink.hex;
      }

      function answer(name) {
        if (!current) return;
        if (name === current.name) {
          good();
          correct++; streak++; bestStreak = Math.max(bestStreak, streak);
        } else {
          bad();
          incorrect++; streak = 0;
        }
        correctEl.textContent = String(correct);
        streakEl.textContent = String(streak);
        nextTrial();
      }

      nextTrial();
      timerId = setInterval(() => {
        timeLeft--;
        timeEl.textContent = String(timeLeft);
        if (timeLeft <= 0) finish();
      }, 1000);

      function finish() {
        clearInterval(timerId);
        timerId = null;
        const total = correct + incorrect;
        const accuracy = total ? Math.round((100 * correct) / total) : 0;
        api.showResult(container, {
          headline: "Время вышло",
          stats: [
            { value: `${accuracy}%`, label: "Точность" },
            { value: correct, label: "Верно" },
            { value: incorrect, label: "Ошибок" },
            { value: bestStreak, label: "Лучшая серия" },
          ],
          record: { key: "stroop", value: accuracy, direction: "higher", format: v => `${v}%` },
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
