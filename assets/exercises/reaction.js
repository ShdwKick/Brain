"use strict";
/* Reaction time: жди сигнала и жми как можно быстрее. Клик до сигнала —
   фальстарт, попытка переигрывается, а не засчитывается. */

import { good, bad } from "../feedback.js";

const TRIALS = 5;

export default {
  mount(container, api) {
    let timers = [];
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Когда поле станет зелёным и появится «ЖМИ!» — жми как можно
            быстрее. Если нажать раньше времени — попытка переигрывается.
            Всего ${TRIALS} попыток.</p>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelector("#start").addEventListener("click", startRun);
    }

    function startRun() {
      let trial = 0;
      const results = [];
      runTrial();

      function runTrial() {
        let armed = false;
        let shownAt = 0;

        container.innerHTML = `
          <div class="ex-hud">
            <div class="hud-stat"><span class="v" id="progress">${trial + 1}/${TRIALS}</span><span class="l">Попытка</span></div>
          </div>
          <button class="reaction-box is-wait" id="box" type="button">Жди…</button>
          <p class="feedback" id="fb"></p>
        `;
        const box = container.querySelector("#box");
        const fb = container.querySelector("#fb");

        box.addEventListener("click", () => {
          if (!armed) {
            bad();
            fb.textContent = "Слишком рано — попытка переигрывается";
            fb.className = "feedback is-bad";
            timers.push(setTimeout(runTrial, 900));
            return;
          }
          const rt = performance.now() - shownAt;
          good();
          results.push(rt);
          trial++;
          fb.textContent = `${Math.round(rt)} мс`;
          fb.className = "feedback is-good";
          box.classList.remove("is-go");
          box.disabled = true;
          if (trial >= TRIALS) timers.push(setTimeout(finish, 700));
          else timers.push(setTimeout(runTrial, 700));
        });

        const delay = 1200 + Math.random() * 2200;
        timers.push(setTimeout(() => {
          armed = true;
          shownAt = performance.now();
          box.classList.remove("is-wait");
          box.classList.add("is-go");
          box.textContent = "ЖМИ!";
        }, delay));
      }

      function finish() {
        const avg = results.reduce((a, b) => a + b, 0) / results.length;
        const best = Math.min(...results);
        api.showResult(container, {
          headline: "Готово!",
          stats: [
            { value: `${Math.round(avg)} мс`, label: "Среднее" },
            { value: `${Math.round(best)} мс`, label: "Лучшая" },
          ],
          record: { key: "reaction", value: avg, direction: "lower", format: v => `${Math.round(v)} мс` },
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => { clearTimers(); };
  },
};
