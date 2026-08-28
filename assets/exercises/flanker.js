"use strict";
/* Фланкер-тест: реагируй на направление ЦЕНТРАЛЬНОЙ стрелки среди пяти,
   игнорируя стрелки-отвлекатели по бокам. Конгруэнтные пробы (все стрелки
   смотрят одинаково) вперемешку с неконгруэнтными (боковые — в другую
   сторону); разница в скорости/точности между ними — классическая мера
   контроля внимания ("эффект фланкера"), тот же приём сравнения подгрупп,
   что и "цена переключения" в switching.js. */

import { good, bad } from "../feedback.js";

const TOTAL_TRIALS = 40;
const PAUSE_MS = 250;

function buildTrial() {
  const centerDir = Math.random() < 0.5 ? "left" : "right";
  const congruent = Math.random() < 0.5;
  const flankerDir = congruent ? centerDir : (centerDir === "left" ? "right" : "left");
  return { centerDir, congruent, flankerDir };
}
function arrow(dir) { return dir === "left" ? "←" : "→"; }
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

export default {
  mount(container, api) {
    let timers = [];
    let keydownHandler = null;
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Пять стрелок в ряд. Реагируй на направление ТОЛЬКО центральной —
            боковые могут смотреть туда же (легче) или в другую сторону
            (сложнее и медленнее, это нормально). Жми ←/→ или кнопки.</p>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelector("#start").addEventListener("click", startRun);
    }

    function startRun() {
      clearTimers();
      if (keydownHandler) { document.removeEventListener("keydown", keydownHandler); keydownHandler = null; }
      api.setRestart(startRun);
      let trial = 0;
      const log = [];

      nextTrial();

      function nextTrial() {
        trial++;
        if (trial > TOTAL_TRIALS) { finish(); return; }
        const { centerDir, congruent, flankerDir } = buildTrial();
        const row = [flankerDir, flankerDir, centerDir, flankerDir, flankerDir].map(arrow).join(" ");

        container.innerHTML = `
          <div class="ex-hud">
            <div class="hud-stat"><span class="v" id="progress">${trial}/${TOTAL_TRIALS}</span><span class="l">Проба</span></div>
          </div>
          <p class="flanker-row">${row}</p>
          <div class="switch-answers">
            <button class="btn filled" id="leftBtn" type="button">← (←)</button>
            <button class="btn filled" id="rightBtn" type="button">→ (→)</button>
          </div>
        `;
        const shownAt = performance.now();
        let answered = false;

        function answer(dir) {
          if (answered) return;
          answered = true;
          const rtMs = performance.now() - shownAt;
          const correct = dir === centerDir;
          if (correct) good(); else bad();
          log.push({ congruent, correct, rtMs });
          if (keydownHandler) { document.removeEventListener("keydown", keydownHandler); keydownHandler = null; }
          timers.push(setTimeout(nextTrial, PAUSE_MS));
        }
        container.querySelector("#leftBtn").addEventListener("click", () => answer("left"));
        container.querySelector("#rightBtn").addEventListener("click", () => answer("right"));
        keydownHandler = e => {
          if (e.key === "ArrowLeft") answer("left");
          else if (e.key === "ArrowRight") answer("right");
        };
        document.addEventListener("keydown", keydownHandler);
      }

      function finish() {
        const answered = log; // самопаусируется, все пробы отвечены
        const correctCount = answered.filter(t => t.correct).length;
        const accuracy = answered.length ? Math.round((100 * correctCount) / answered.length) : 0;

        const congr = answered.filter(t => t.congruent);
        const incongr = answered.filter(t => !t.congruent);
        const rtCongr = mean(congr.map(t => t.rtMs));
        const rtIncongr = mean(incongr.map(t => t.rtMs));
        const accCongr = congr.length ? (100 * congr.filter(t => t.correct).length) / congr.length : 0;
        const accIncongr = incongr.length ? (100 * incongr.filter(t => t.correct).length) / incongr.length : 0;

        api.showResult(container, {
          headline: "Готово!",
          stats: [
            { value: `${accuracy}%`, label: "Точность" },
            { value: `${Math.round(rtIncongr - rtCongr)} мс`, label: "Цена конфликта" },
            { value: `${Math.round(accCongr - accIncongr)} %`, label: "Потеря точности" },
          ],
          record: { key: "flanker", value: accuracy, direction: "higher", format: v => `${v}%` },
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => {
      clearTimers();
      if (keydownHandler) document.removeEventListener("keydown", keydownHandler);
    };
  },
};
