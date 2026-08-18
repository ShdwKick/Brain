"use strict";
/* Мысленное вращение фигур: курируемый пул заранее проверенных асимметричных
   фигур (шесть хиральных пентамино + одно тетрамино) — НЕ процедурная
   генерация. У асимметричной фигуры зеркальное отражение никогда не
   совпадает ни с одним из её поворотов, поэтому ловушка гарантированно
   неверна, а не может случайно оказаться правильным ответом.

   T-образную фигуру сюда нарочно не берём: у неё есть ось зеркальной
   симметрии, из-за чего "зеркальный" вариант на деле совпадает с одним из
   настоящих поворотов — в вариантах ответа появляются визуально одинаковые
   фигуры, что и было замечено при игре. */

const SHAPES = [
  [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],           // F
  [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],           // L
  [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3]],           // N
  [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]],           // P
  [[1, 0], [0, 1], [1, 1], [1, 2], [1, 3]],           // Y
  [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],           // Z
  [[1, 0], [1, 1], [0, 2], [1, 2]],                    // J (тетрамино)
];
const ROUNDS = 8;

function normalize(cells) {
  const minX = Math.min(...cells.map(c => c[0]));
  const minY = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}
function rotate90(cells) { return normalize(cells.map(([x, y]) => [y, -x])); }
function mirror(cells) { return normalize(cells.map(([x, y]) => [-x, y])); }
function canon(cells) {
  return cells.map(c => c.join(",")).sort().join(";");
}
function renderShapeSvg(cells) {
  const cell = 16;
  const maxX = Math.max(...cells.map(c => c[0]));
  const maxY = Math.max(...cells.map(c => c[1]));
  const rects = cells.map(([x, y]) => `<rect x="${x * cell + 1}" y="${y * cell + 1}" width="${cell - 2}" height="${cell - 2}" rx="2"/>`).join("");
  return `<svg class="shape-svg" width="${(maxX + 1) * cell}" height="${(maxY + 1) * cell}" viewBox="0 0 ${(maxX + 1) * cell} ${(maxY + 1) * cell}">${rects}</svg>`;
}
function pick(arr, k) {
  const copy = arr.slice();
  const out = [];
  while (out.length < k && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}

export default {
  mount(container, api) {
    let timers = [];
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Слева — эталонная фигура. Среди четырёх вариантов справа выбери
            ВСЕ, что являются её настоящими поворотами (не зеркальным
            отражением), затем нажми «Проверить».</p>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelector("#start").addEventListener("click", () => startRun());
    }

    function startRun() {
      let round = 0;
      let scoreCorrectPicks = 0;
      let scoreWrongPicks = 0;
      let roundsFullyCorrect = 0;

      function playRound() {
        round++;
        const ref = normalize(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
        const rot90 = rotate90(ref);
        const rot180 = rotate90(rot90);
        const rot270 = rotate90(rot180);
        const trueRotations = pick([rot90, rot180, rot270], 2);
        const mirrored = mirror(ref);
        const foilRotations = [mirrored, rotate90(mirrored), rotate90(rotate90(mirrored))];
        const foils = pick(foilRotations, 2);
        const trueSet = new Set(trueRotations.map(canon));

        const candidates = [...trueRotations, ...foils]
          .map(cells => ({ cells, isTrue: trueSet.has(canon(cells)) }))
          .sort(() => Math.random() - 0.5);
        const selected = new Set();

        container.innerHTML = `
          <div class="ex-hud">
            <div class="hud-stat"><span class="v" id="round">${round}/${ROUNDS}</span><span class="l">Раунд</span></div>
          </div>
          <div class="rotation-board">
            <div class="rotation-reference">${renderShapeSvg(ref)}</div>
            <div class="rotation-candidates" id="candidates">
              ${candidates.map((c, i) => `<button class="rotation-candidate" type="button" data-i="${i}" aria-pressed="false">${renderShapeSvg(c.cells)}</button>`).join("")}
            </div>
            <button class="btn filled" id="check" type="button">Проверить</button>
          </div>
        `;
        container.querySelectorAll("#candidates .rotation-candidate").forEach(btn => {
          btn.addEventListener("click", () => {
            const i = Number(btn.dataset.i);
            if (selected.has(i)) { selected.delete(i); btn.setAttribute("aria-pressed", "false"); }
            else { selected.add(i); btn.setAttribute("aria-pressed", "true"); }
          });
        });
        container.querySelector("#check").addEventListener("click", () => checkRound(candidates, selected));
      }

      function checkRound(candidates, selected) {
        let roundGood = 0, roundBad = 0;
        candidates.forEach((c, i) => {
          const picked = selected.has(i);
          if (picked && c.isTrue) roundGood++;
          if (picked && !c.isTrue) roundBad++;
        });
        scoreCorrectPicks += roundGood;
        scoreWrongPicks += roundBad;
        const trueCount = candidates.filter(c => c.isTrue).length;
        if (roundGood === trueCount && roundBad === 0) roundsFullyCorrect++;

        container.querySelectorAll("#candidates .rotation-candidate").forEach((btn, i) => {
          if (candidates[i].isTrue) btn.style.outline = "2px solid #2e7d32";
          else if (selected.has(i)) btn.style.outline = "2px solid var(--md-sys-color-error)";
        });
        container.querySelector("#check").disabled = true;

        timers.push(setTimeout(() => {
          if (round >= ROUNDS) finish();
          else playRound();
        }, 900));
      }

      function finish() {
        api.showResult(container, {
          headline: "Готово!",
          stats: [
            { value: roundsFullyCorrect, label: `Раундов без ошибок из ${ROUNDS}` },
            { value: scoreCorrectPicks, label: "Верных выборов" },
            { value: scoreWrongPicks, label: "Неверных выборов" },
          ],
          record: { key: "rotation", value: roundsFullyCorrect, direction: "higher", format: v => `${v}/${ROUNDS}` },
          onRestart: renderIntro,
        });
      }

      playRound();
    }

    renderIntro();
    return () => { clearTimers(); };
  },
};
