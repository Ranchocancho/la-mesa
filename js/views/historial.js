// Panel del historial de cambios (Hito 78): solo el máster. Se abre desde la barra superior (🕘).
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { historyList, onHistory, revert, laterOverlap } from "../core/historial.js";
import { $, $$, esc, toast } from "../core/ui.js";

let box = null, off = null, filter = "";
const hhmm = t => new Date(t).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function openHistory() {
  if (box) { closeHistory(); return; }
  box = document.createElement("aside");
  box.className = "histpanel"; box.setAttribute("aria-label", "Historial de cambios");
  document.body.appendChild(box);
  off = onHistory(draw);
  draw();
}
export function closeHistory() { if (off) off(); off = null; if (box) box.remove(); box = null; }

function draw() {
  if (!box) return;
  if (!isDM(store.get())) { closeHistory(); return; }
  const L = historyList().filter(e => !filter || (e.who + " " + e.what).toLowerCase().includes(filter));
  const q = $("#histq", box), had = q && document.activeElement === q, pos = q ? q.selectionStart : 0;
  box.innerHTML = `<header><b>🕘 Historial de cambios</b><button class="btn small" id="histx" aria-label="Cerrar">✕</button></header>
    <p class="note">Todo lo que ha cambiado desde que abriste la página, tuyo y de los jugadores. «↶ Volver a antes de esto» deja como estaba solo lo que tocó ese cambio. No recupera imágenes borradas y se olvida al recargar.</p>
    <input id="histq" class="btn" placeholder="Buscar (Mirra, PG, lugar…)" value="${esc(filter)}">
    <div class="histlist">${L.map(e => `<div class="hrow ${e.undone ? "undone" : ""} ${e.isUndo ? "isundo" : ""}">
        <div class="hmeta"><time>${hhmm(e.at)}</time><b>${esc(e.who)}</b></div>
        <div class="hwhat">${esc(e.what)}</div>
        ${e.undone ? `<small class="hdone">Deshecho</small>` : `<button class="btn small" data-undo="${e.id}">↶ Volver a antes de esto</button>`}
      </div>`).join("") || `<p class="empty">Aún no ha cambiado nada.</p>`}</div>`;
  $("#histx", box).onclick = closeHistory;
  const nq = $("#histq", box);
  nq.oninput = () => { filter = nq.value.trim().toLowerCase(); draw(); };
  if (had) { nq.focus(); nq.setSelectionRange(pos, pos); }
  $$("[data-undo]", box).forEach(b => b.onclick = () => {
    const id = +b.dataset.undo, n = laterOverlap(id);
    if (n && !b.dataset.sure) { b.dataset.sure = "1"; b.textContent = `¿Seguro? También se pierden ${n} cambio${n > 1 ? "s" : ""} posterior${n > 1 ? "es" : ""} sobre lo mismo`; b.classList.add("danger"); return; }
    if (revert(id)) toast("↶ Deshecho");
  });
}
