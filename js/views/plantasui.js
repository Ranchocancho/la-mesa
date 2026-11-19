// Panel de plantas del mapa para el máster (en su pestaña Táctica, junto a Editar y Criaturas).
import { store } from "../core/store.js";
import { floorsOf, floorIdx, swapFloor, sendToFloor, addFloor, renameFloor, removeFloor } from "../core/plantas.js";
import { nameOf } from "../core/combate.js";
import { $, $$, esc, toast } from "../core/ui.js";

let renaming = null;

export function floorsHTML(s, selId) {
  const g = s.board; if (!g) return "";
  const fl = floorsOf(g), cur = floorIdx(g), selT = selId && s.tokens.find(t => t.id === selId);
  return `<div class="flpop"><p class="note">Plantas (arriba, la más alta). Todos ven la planta marcada.</p>${fl.map((f, i) => ({ f, i })).reverse().map(({ f, i }) => `<div class="flrow${i === cur ? " on" : ""}">
      <div class="flname">${renaming === i ? `<input data-flname="${i}" value="${esc(f.name)}" maxlength="40">` : `<b>${esc(f.name)}</b>`}${i === cur ? `<small>a la vista</small>` : `<small>${(f.tokens || []).length} fichas</small>`}<button class="flic" data-flren="${i}" title="Renombrar">✎</button>${i !== cur ? `<button class="flic" data-fldel="${i}" title="Quitar esta planta">🗑</button>` : ""}</div>
      ${i !== cur ? `<div class="flacts"><button class="btn small gold" data-flgo="${i}" data-carry="pcs" title="La mesa pasa a esta planta y se lleva a los personajes">Ir con el grupo</button><button class="btn small" data-flgo="${i}" data-carry="none" title="La mesa pasa a esta planta; los personajes se quedan donde estaban">Ir sin nadie</button>${selT ? `<button class="btn small" data-flsend="${i}" title="Solo esa ficha pasa a la otra planta; la mesa no cambia">Enviar a ${esc(nameOf(s, selT))}</button>` : ""}</div>` : ""}</div>`).join("")}
    <div class="row"><button class="btn small" data-fladd="up">＋ Planta encima</button><button class="btn small" data-fladd="down">＋ Sótano</button></div></div>`;
}

export function bindFloors(root, selId, redraw) {
  const go = fn => store.commit("board", st => { if (st.board) fn(st); });
  $$("[data-flgo]", root).forEach(b => b.onclick = () => {
    const i = +b.dataset.flgo, pcs = b.dataset.carry === "pcs";
    go(st => { st.tokens = swapFloor(st.board, st.tokens, i, new Set(pcs ? st.tokens.filter(t => t.kind === "pc").map(t => t.id) : [])); });
    const g = store.get().board; toast(`Ahora en la mesa: ${floorsOf(g)[floorIdx(g)].name}`);
  });
  $$("[data-flsend]", root).forEach(b => b.onclick = () => { go(st => { st.tokens = sendToFloor(st.board, st.tokens, selId, +b.dataset.flsend); }); toast("Ficha enviada a otra planta"); });
  $$("[data-fladd]", root).forEach(b => b.onclick = () => go(st => { addFloor(st.board, b.dataset.fladd === "down"); }));
  $$("[data-flren]", root).forEach(b => b.onclick = () => { renaming = +b.dataset.flren; redraw(); const i = $("[data-flname]", root); if (i) { i.focus(); i.select(); } });
  $$("[data-flname]", root).forEach(i => {
    const ok = () => { const v = i.value.trim(), n = +i.dataset.flname; renaming = null; if (v) go(st => renameFloor(st.board, n, v)); else redraw(); };
    i.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } if (e.key === "Escape") { renaming = null; redraw(); } };
    i.onblur = () => { if (renaming != null) ok(); };
  });
  $$("[data-fldel]", root).forEach(b => b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "¿Seguro?"; return; } go(st => removeFloor(st.board, +b.dataset.fldel)); });
}
