"use strict";
/* Ханойская башня: перенос — перетаскиванием верхнего диска (Pointer Events,
   работает и мышью, и тачем без полифилла) или по-прежнему клик-клик, кому
   как удобнее. Недопустимые ходы не считаются в moveCount, иначе сравнение
   с минимумом 2^n-1 враньё. Число дисков — через общий автоподбор
   (assets/difficulty.js), а не свой ad-hoc счётчик: так уровень переживает
   перезагрузку и умеет не только расти, но и снижаться, если не заходит. */

import { getLevel, adjustLevel } from "../difficulty.js";
import { bad } from "../feedback.js";

const LEVELS = [3, 4, 5, 6];
const DRAG_THRESHOLD = 6; // px, отделяет драг от простого клика/тапа

export default {
  mount(container, api) {
    let level = getLevel("hanoi", LEVELS, 3);
    let timers = [];
    let ghostEl = null;
    const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
    const removeGhost = () => { if (ghostEl) { ghostEl.remove(); ghostEl = null; } };
    const clearDropTargets = () => container.querySelectorAll(".hanoi-peg.is-drop-target").forEach(p => p.classList.remove("is-drop-target"));

    function renderIntro() {
      container.innerHTML = `
        <div class="ex-intro">
          <p>Перенеси все диски со стержня 1 на стержень 3. За один ход можно
            брать только верхний диск, и класть его можно только на диск
            большего размера или на пустой стержень. Перетащи диск на другой
            стержень или кликни: сначала откуда, потом куда.</p>
          <p class="feedback">Уровень: ${level} диск${level === 1 ? "" : level < 5 ? "а" : "ов"}</p>
          <button class="btn filled" id="start" type="button">Начать</button>
        </div>`;
      container.querySelector("#start").addEventListener("click", startRun);
    }

    function startRun() {
      const n = level;
      const pegs = [Array.from({ length: n }, (_, i) => n - i), [], []];
      let selected = null;
      let moveCount = 0;
      let justDragged = false;
      const minMoves = 2 ** n - 1;

      function renderBoard() {
        const pegEls = pegs.map((disks, pi) => `
          <button class="hanoi-peg${selected === pi ? " is-selected" : ""}" type="button" data-peg="${pi}">
            ${disks.slice().reverse().map((size, di) => `<div class="hanoi-disk${di === 0 ? " is-top" : ""}" style="width:${28 + (size / n) * 68}%;--tone:${20 + Math.round((size / n) * 60)}%"></div>`).join("")}
          </button>`).join("");
        container.innerHTML = `
          <div class="ex-hud">
            <div class="hud-stat"><span class="v" id="moves">${moveCount}</span><span class="l">Ходы</span></div>
            <div class="hud-stat"><span class="v">${minMoves}</span><span class="l">Минимум</span></div>
          </div>
          <div class="hanoi-board">${pegEls}</div>
        `;
        container.querySelectorAll(".hanoi-peg").forEach(btn => {
          const pi = Number(btn.dataset.peg);
          btn.addEventListener("click", () => {
            if (justDragged) { justDragged = false; return; }
            onPegClick(pi);
          });
          const topDisk = btn.querySelector(".hanoi-disk.is-top");
          if (topDisk) attachDrag(topDisk, pi);
        });
      }

      function attachDrag(diskEl, fromPeg) {
        diskEl.addEventListener("pointerdown", e => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          const startX = e.clientX, startY = e.clientY;
          const rect = diskEl.getBoundingClientRect();
          const offsetX = e.clientX - rect.left, offsetY = e.clientY - rect.top;
          let moved = false;
          diskEl.setPointerCapture(e.pointerId);

          function onMove(ev) {
            if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD) {
              moved = true;
              diskEl.classList.add("is-dragging");
              if (!ghostEl) { ghostEl = document.createElement("div"); document.body.append(ghostEl); }
              ghostEl.className = "hanoi-drag-ghost";
              ghostEl.style.width = rect.width + "px";
              ghostEl.style.height = rect.height + "px";
              ghostEl.style.display = "block";
            }
            if (moved) {
              ghostEl.style.left = ev.clientX - offsetX + "px";
              ghostEl.style.top = ev.clientY - offsetY + "px";
              clearDropTargets();
              const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".hanoi-peg");
              if (target) target.classList.add("is-drop-target");
            }
          }
          function cleanup() {
            diskEl.removeEventListener("pointermove", onMove);
            diskEl.removeEventListener("pointerup", onUp);
            diskEl.removeEventListener("pointercancel", onCancel);
            diskEl.classList.remove("is-dragging");
            removeGhost();
            clearDropTargets();
          }
          function onUp(ev) {
            const target = moved ? document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".hanoi-peg") : null;
            cleanup();
            if (moved) {
              justDragged = true;
              selected = null;
              const toPeg = target ? Number(target.dataset.peg) : null;
              if (toPeg !== null && toPeg !== fromPeg) attemptMove(fromPeg, toPeg);
              else renderBoard();
            }
          }
          function onCancel() { cleanup(); }
          diskEl.addEventListener("pointermove", onMove);
          diskEl.addEventListener("pointerup", onUp);
          diskEl.addEventListener("pointercancel", onCancel);
        });
      }

      function onPegClick(pi) {
        if (selected === null) {
          if (pegs[pi].length) { selected = pi; renderBoard(); }
          return;
        }
        if (selected === pi) { selected = null; renderBoard(); return; }
        attemptMove(selected, pi);
      }

      function attemptMove(from, to) {
        selected = null;
        const fromArr = pegs[from], toArr = pegs[to];
        const moving = fromArr[fromArr.length - 1];
        const legal = toArr.length === 0 || toArr[toArr.length - 1] > moving;
        if (legal) {
          fromArr.pop();
          toArr.push(moving);
          moveCount++;
          renderBoard();
          if (pegs[2].length === n) {
            timers.push(setTimeout(finish, 300));
          }
        } else {
          bad();
          renderBoard();
          const targetEl = container.querySelector(`.hanoi-peg[data-peg="${to}"]`);
          if (targetEl) {
            targetEl.style.outline = "2px solid var(--md-sys-color-error)";
            timers.push(setTimeout(() => { targetEl.style.outline = ""; }, 260));
          }
        }
      }

      function finish() {
        const efficiency = Math.round((minMoves / moveCount) * 100);
        const outcome = efficiency >= 70 ? "up" : efficiency < 40 ? "down" : "stay";
        const adjusted = adjustLevel("hanoi", LEVELS, n, outcome);
        level = adjusted.next;
        const difficultyNote = adjusted.direction === "up" ? `Уверенно решил — в следующий раз предложим ${adjusted.next} дисков`
          : adjusted.direction === "down" ? `Пока сложновато — в следующий раз предложим ${adjusted.next} диска` : null;
        api.showResult(container, {
          headline: "Собрано!",
          stats: [
            { value: moveCount, label: "Ходы" },
            { value: minMoves, label: "Минимум" },
            { value: n, label: "Дисков" },
          ],
          record: { key: "hanoi", value: efficiency, direction: "higher", format: v => `${v}% эффективность` },
          difficultyNote,
          onRestart: renderIntro,
        });
      }

      renderBoard();
    }

    renderIntro();
    return () => { clearTimers(); removeGhost(); };
  },
};
