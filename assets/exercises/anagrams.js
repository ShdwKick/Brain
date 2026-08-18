"use strict";
/* Анаграммы: 8 слов на забег, 20 секунд на слово, без "ё" в списке — чтобы
   не спорить, засчитывать ли "е" вместо "ё" (см. Design/README.md о том,
   что упражнения ничего не сохраняют между визитами). */

import { getLevel, adjustLevel } from "../difficulty.js";
import { good, bad } from "../feedback.js";

const WORDS = {
  easy: ["стол", "речка", "город", "лампа", "книга", "сумка", "ветер", "облако"],
  medium: ["ромашка", "картина", "автобус", "дорога", "письмо", "минута", "человек", "работа"],
  hard: ["телефон", "государство", "путешествие", "справедливость", "приключение", "образование"],
};
const LEVELS = ["easy", "medium", "hard"];
const TIER_LABEL = { easy: "лёгкий", medium: "средний", hard: "сложный" };

const usedThisSession = { easy: new Set(), medium: new Set(), hard: new Set() };
const TOTAL_WORDS = 8;
const TRIAL_SECONDS = 20;

function normalize(s) {
  return s.trim().toLowerCase().replace(/ё/g, "е");
}
function scramble(word) {
  const letters = word.split("");
  let attempt = letters.slice();
  do {
    for (let i = attempt.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [attempt[i], attempt[j]] = [attempt[j], attempt[i]];
    }
  } while (attempt.join("") === word && word.length > 1);
  return attempt.join("");
}
function pickWord(tier) {
  const pool = WORDS[tier];
  const used = usedThisSession[tier];
  if (used.size >= pool.length) used.clear();
  const available = pool.filter(w => !used.has(w));
  const word = available[Math.floor(Math.random() * available.length)];
  used.add(word);
  return word;
}

export default {
  mount(container, api) {
    let tier = getLevel("anagrams", LEVELS, "medium");
    let timerId = null;
    let advanceTimer = null;

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Буквы перемешаны — набери исходное слово до истечения времени.
            Всего ${TOTAL_WORDS} слов подряд.</p>
          <div class="ex-options">
            <div class="chip-group" id="tierGroup">
              ${[["easy", "Легко"], ["medium", "Средне"], ["hard", "Сложно"]].map(([v, l]) => `<button class="chip" type="button" data-tier="${v}" aria-pressed="${v === tier}">${l}</button>`).join("")}
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
      container.querySelector("#start").addEventListener("click", startRun);
    }

    function startRun() {
      let wordIndex = 0;
      let score = 0;

      nextWord();

      function nextWord() {
        wordIndex++;
        if (wordIndex > TOTAL_WORDS) { finish(); return; }
        const word = pickWord(tier);
        const scrambled = scramble(word);
        let timeLeft = TRIAL_SECONDS;
        let answered = false;

        container.innerHTML = `
          <div class="ex-hud">
            <div class="hud-stat"><span class="v" id="idx">${wordIndex}/${TOTAL_WORDS}</span><span class="l">Слово</span></div>
            <div class="hud-stat"><span class="v" id="time">${timeLeft}</span><span class="l">Секунд</span></div>
            <div class="hud-stat"><span class="v" id="score">${score}</span><span class="l">Верно</span></div>
          </div>
          <p class="scramble-word">${scrambled.toUpperCase()}</p>
          <div class="ex-form">
            <input class="ex-input" id="guess" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Твой ответ">
            <button class="btn filled" id="submit" type="button">Ответить</button>
          </div>
          <p class="feedback" id="fb"></p>
        `;
        const input = container.querySelector("#guess");
        const fb = container.querySelector("#fb");
        const timeEl = container.querySelector("#time");
        input.focus();

        function submit() {
          if (answered) return;
          answered = true;
          clearInterval(timerId);
          const ok = normalize(input.value) === normalize(word);
          if (ok) { good(); score++; fb.textContent = "Верно!"; fb.className = "feedback is-good"; }
          else { bad(); fb.textContent = `Не то — было «${word}»`; fb.className = "feedback is-bad"; }
          input.disabled = true;
          container.querySelector("#submit").disabled = true;
          advanceTimer = setTimeout(nextWord, 1100);
        }
        container.querySelector("#submit").addEventListener("click", submit);
        input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

        timerId = setInterval(() => {
          timeLeft--;
          timeEl.textContent = String(timeLeft);
          if (timeLeft <= 0) { clearInterval(timerId); submit(); }
        }, 1000);
      }

      function finish() {
        const outcome = score >= Math.ceil(TOTAL_WORDS * 0.85) ? "up" : score <= Math.floor(TOTAL_WORDS * 0.4) ? "down" : "stay";
        const adjusted = adjustLevel("anagrams", LEVELS, tier, outcome);
        const difficultyNote = adjusted.direction === "up" ? `Почти без ошибок — в следующий раз предложим уровень «${TIER_LABEL[adjusted.next]}»`
          : adjusted.direction === "down" ? `Пока сложновато — в следующий раз предложим уровень «${TIER_LABEL[adjusted.next]}»` : null;
        api.showResult(container, {
          headline: "Готово!",
          stats: [
            { value: `${score}/${TOTAL_WORDS}`, label: "Верно" },
          ],
          record: { key: `anagrams:${tier}`, value: score, direction: "higher", format: v => `${v}/${TOTAL_WORDS}` },
          difficultyNote,
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => {
      if (timerId) clearInterval(timerId);
      if (advanceTimer) clearTimeout(advanceTimer);
    };
  },
};
