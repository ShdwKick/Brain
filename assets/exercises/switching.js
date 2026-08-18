"use strict";
/* Переключение правил: число в цветной фигуре, правило меняется случайно
   между "чёт/нечет" и "это [цвет]?" — целевой цвет для второго правила
   генерируется заново на каждой такой пробе, а не фиксируется на блок.
   Фиксированное число проб (не таймер), чтобы ответ не обрезался часами. */

import { good, bad } from "../feedback.js";

const COLORS = [
  { name: "красный", hex: "#e53935" },
  { name: "синий", hex: "#1e88e5" },
  { name: "зелёный", hex: "#43a047" },
  { name: "жёлтый", hex: "#fdd835" },
];
const TOTAL_TRIALS = 40;
const PAUSE_MS = 220;

function randColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

export default {
  mount(container, api) {
    let timers = [];
    let keydownHandler = null;
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Сверху — правило: либо «чётное число?», либо «это нужный цвет?».
            Оно меняется без предупреждения. Отвечай Да/Нет как можно быстрее
            (можно кликать или жать ←/→).</p>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelector("#start").addEventListener("click", startRun);
    }

    function startRun() {
      let trial = 0;
      let prevRule = null;
      const log = [];

      function nextTrial() {
        trial++;
        if (trial > TOTAL_TRIALS) { finish(); return; }
        const rule = Math.random() < 0.5 ? "parity" : "color";
        const isSwitch = prevRule !== null && rule !== prevRule;
        prevRule = rule;

        const number = 1 + Math.floor(Math.random() * 9);
        const shapeColor = randColor();
        const cueColor = rule === "color" ? randColor() : null;
        const cueText = rule === "parity" ? "Чётное число?" : `Это ${cueColor.name}?`;
        const correctAnswer = rule === "parity" ? (number % 2 === 0) : (shapeColor.name === cueColor.name);

        container.innerHTML = `
          <div class="ex-hud">
            <div class="hud-stat"><span class="v" id="progress">${trial}/${TOTAL_TRIALS}</span><span class="l">Проба</span></div>
          </div>
          <p class="switch-cue">${cueText}</p>
          <div class="switch-stimulus" style="background:${shapeColor.hex}">
            <span class="n">${number}</span>
          </div>
          <div class="switch-answers">
            <button class="btn filled" id="yes" type="button">Да (←)</button>
            <button class="btn outlined" id="no" type="button">Нет (→)</button>
          </div>
        `;
        const shownAt = performance.now();
        let answered = false;

        function answer(value) {
          if (answered) return;
          answered = true;
          const rtMs = performance.now() - shownAt;
          const correct = value === correctAnswer;
          if (correct) good(); else bad();
          log.push({ isSwitch, correct, rtMs });
          if (keydownHandler) { document.removeEventListener("keydown", keydownHandler); keydownHandler = null; }
          timers.push(setTimeout(nextTrial, PAUSE_MS));
        }
        container.querySelector("#yes").addEventListener("click", () => answer(true));
        container.querySelector("#no").addEventListener("click", () => answer(false));
        keydownHandler = e => {
          if (e.key === "ArrowLeft") answer(true);
          else if (e.key === "ArrowRight") answer(false);
        };
        document.addEventListener("keydown", keydownHandler);
      }

      function finish() {
        const answered = log; // самопаусируется, все пробы отвечены
        const correctCount = answered.filter(t => t.correct).length;
        const accuracy = answered.length ? Math.round((100 * correctCount) / answered.length) : 0;
        const meanRt = Math.round(mean(answered.map(t => t.rtMs)));

        const scored = answered.filter((t, i) => i > 0); // первая проба не относится ни к switch, ни к repeat
        const switchTrials = scored.filter(t => t.isSwitch);
        const repeatTrials = scored.filter(t => !t.isSwitch);
        const rtSwitch = mean(switchTrials.map(t => t.rtMs));
        const rtRepeat = mean(repeatTrials.map(t => t.rtMs));
        const accSwitch = switchTrials.length ? (100 * switchTrials.filter(t => t.correct).length) / switchTrials.length : 0;
        const accRepeat = repeatTrials.length ? (100 * repeatTrials.filter(t => t.correct).length) / repeatTrials.length : 0;

        api.showResult(container, {
          headline: "Готово!",
          stats: [
            { value: `${accuracy}%`, label: "Точность" },
            { value: `${meanRt} мс`, label: "Средняя реакция" },
            { value: `${Math.round(rtSwitch - rtRepeat)} мс`, label: "Цена переключения" },
            { value: `${Math.round(accRepeat - accSwitch)} %`, label: "Потеря точности" },
          ],
          record: { key: "switching", value: accuracy, direction: "higher", format: v => `${v}%` },
          onRestart: renderIntro,
        });
      }

      nextTrial();
    }

    renderIntro();
    return () => {
      clearTimers();
      if (keydownHandler) document.removeEventListener("keydown", keydownHandler);
    };
  },
};
