"use strict";
/* Категории на скорость: назвать как можно больше слов из категории за 45
   секунд. Проверка — по курируемому списку (как у анаграмм): без него
   пришлось бы верить на слово, а с полным словарём это отдельный сервис. */

const CATEGORIES = {
  animals: { label: "Животные", words: ["кот", "собака", "лошадь", "корова", "волк", "лиса", "медведь", "заяц", "белка", "олень", "тигр", "лев", "слон", "жираф", "обезьяна", "кит", "дельфин", "орёл", "сова", "змея"] },
  fruits: { label: "Фрукты и овощи", words: ["яблоко", "груша", "банан", "апельсин", "лимон", "виноград", "слива", "персик", "арбуз", "дыня", "морковь", "картофель", "огурец", "помидор", "капуста", "лук", "свёкла", "тыква", "перец", "редис"] },
  countries: { label: "Страны", words: ["россия", "франция", "германия", "испания", "италия", "китай", "япония", "индия", "бразилия", "канада", "египет", "греция", "турция", "польша", "финляндия", "норвегия", "швеция", "мексика", "аргентина", "куба"] },
  professions: { label: "Профессии", words: ["врач", "учитель", "инженер", "юрист", "повар", "водитель", "программист", "строитель", "художник", "музыкант", "актёр", "писатель", "полицейский", "пожарный", "фермер", "продавец", "механик", "пилот", "почтальон", "садовник"] },
};
const ROUND_SECONDS = 45;

function normalize(s) { return s.trim().toLowerCase().replace(/ё/g, "е"); }

export default {
  mount(container, api) {
    let timerId = null;

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Категория появится, когда начнёшь. Вводи слова по одному —
            чем больше успеешь назвать за ${ROUND_SECONDS} секунд, тем лучше.
            Засчитываются слова из заранее заданного списка, без претензий
            на энциклопедическую полноту.</p>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelector("#start").addEventListener("click", startRound);
    }

    function startRound() {
      const keys = Object.keys(CATEGORIES);
      const catKey = keys[Math.floor(Math.random() * keys.length)];
      const cat = CATEGORIES[catKey];
      const normList = new Set(cat.words.map(normalize));
      const found = new Set();
      let timeLeft = ROUND_SECONDS;

      container.innerHTML = `
        <div class="ex-hud">
          <div class="hud-stat"><span class="v" id="time">${timeLeft}</span><span class="l">Секунд</span></div>
          <div class="hud-stat"><span class="v" id="score">0</span><span class="l">Слов</span></div>
        </div>
        <p class="switch-cue">Категория: ${cat.label}</p>
        <div class="ex-form">
          <input class="ex-input" id="word" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Слово + Enter">
          <button class="btn filled" id="submit" type="button">Добавить</button>
        </div>
        <p class="feedback" id="fb"></p>
        <div class="word-list" id="list"></div>
      `;
      const input = container.querySelector("#word");
      const fb = container.querySelector("#fb");
      const list = container.querySelector("#list");
      const scoreEl = container.querySelector("#score");
      input.focus();

      function submit() {
        const raw = input.value;
        input.value = "";
        if (!raw.trim()) return;
        const norm = normalize(raw);
        if (found.has(norm)) {
          fb.textContent = "Уже называли"; fb.className = "feedback is-bad";
          return;
        }
        if (!normList.has(norm)) {
          fb.textContent = "Нет в списке для этой категории"; fb.className = "feedback is-bad";
          return;
        }
        found.add(norm);
        scoreEl.textContent = String(found.size);
        fb.textContent = ""; fb.className = "feedback";
        const chip = document.createElement("span");
        chip.className = "word-chip";
        chip.textContent = raw.trim();
        list.append(chip);
      }
      container.querySelector("#submit").addEventListener("click", submit);
      input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });

      timerId = setInterval(() => {
        timeLeft--;
        container.querySelector("#time").textContent = String(timeLeft);
        if (timeLeft <= 0) finish();
      }, 1000);

      function finish() {
        clearInterval(timerId);
        timerId = null;
        api.showResult(container, {
          headline: "Время вышло",
          stats: [
            { value: found.size, label: "Слов названо" },
            { value: cat.label, label: "Категория" },
          ],
          record: { key: `categories:${catKey}`, value: found.size, direction: "higher", format: v => `${v} слов` },
          onRestart: renderIntro,
        });
      }
    }

    renderIntro();
    return () => { if (timerId) clearInterval(timerId); };
  },
};
