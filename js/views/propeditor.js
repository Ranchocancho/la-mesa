// Editar un objeto del mapa: nombre, si está oculto a los jugadores, su contenido (tesoro) o su efecto (trampa).
// En partida, el máster además puede revelarlo, anunciar el botín o disparar la trampa.
import { PROPS } from "../data/mapas.js";
import { esc, $, $$ } from "../core/ui.js";

const AB = { fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" };

export function propEditorHTML(p, { live = false } = {}) {
  const v = PROPS[p.k] || { n: p.k, i: "?" }, tr = p.trap || {};
  return `<div class="propedit"><h3><span>${v.i}</span>${esc(v.n)}</h3>
    <label class="field">Nombre o nota<input data-pe="label" value="${esc(p.label || "")}" placeholder="${v.cat === "marca" ? "Qué hay aquí, qué pasa…" : "Opcional"}"></label>
    <label class="switch"><input type="checkbox" data-pe-hidden ${p.hidden ?? v.hidden ? "checked" : ""}> Oculto a los jugadores</label>
    ${v.loot || p.loot != null ? `<label class="field">Contenido (lo que encuentran)<textarea data-pe="loot" rows="3" placeholder="120 po, una poción de curación, un mapa…">${esc(p.loot || "")}</textarea></label>` : ""}
    ${v.trap ? `<fieldset class="trapf"><legend>Trampa</legend>
      <div class="row"><label>Detectar CD<input type="number" data-tr="detect" value="${tr.detect ?? 13}"></label><label>Salvación<select data-tr="save">${Object.entries(AB).map(([k, n]) => `<option value="${k}" ${(tr.save || "des") === k ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>CD<input type="number" data-tr="dc" value="${tr.dc ?? 13}"></label></div>
      <div class="row"><label>Daño<input data-tr="dmg" value="${esc(tr.dmg || "2d10")}"></label><label>Tipo<input data-tr="type" value="${esc(tr.type || "perforante")}"></label></div>
      <p class="note">Si alguien la pisa en combate, salta sola: se revela y se tiran las salvaciones.</p></fieldset>` : ""}
    ${!live ? `<div class="row"><button class="btn small" data-pe-rot>↻ Girar (R)</button><button class="btn small danger" data-pe-del>Quitar (Supr)</button></div>` : ""}
    ${live ? `<div class="row">${p.hidden ?? v.hidden ? `<button class="btn small gold" data-pe-reveal>👁 Revelar</button>` : ""}${v.loot || p.loot ? `<button class="btn small gold" data-pe-loot>💰 Anunciar el contenido</button>` : ""}${v.trap ? `<button class="btn small red" data-pe-trap>⚠ Disparar sobre quien está ahí</button>` : ""}</div>` : ""}</div>`;
}
/** set(fn(prop)): cambia el objeto; extra: { del, rot, reveal, loot, trap } */
export function bindPropEditor(el, set, extra = {}) {
  let t = null; const later = fn => { clearTimeout(t); t = setTimeout(fn, 300); };
  $$("[data-pe]", el).forEach(i => i.addEventListener("input", () => later(() => set(p => { p[i.dataset.pe] = i.value; }))));
  const h = $("[data-pe-hidden]", el); if (h) h.onchange = () => set(p => { p.hidden = h.checked; });
  $$("[data-tr]", el).forEach(i => i.addEventListener("input", () => later(() => set(p => { p.trap = p.trap || {}; p.trap[i.dataset.tr] = i.type === "number" ? +i.value : i.value; }))));
  $$("select[data-tr]", el).forEach(i => i.onchange = () => set(p => { p.trap = p.trap || {}; p.trap[i.dataset.tr] = i.value; }));
  const on = (sel, fn) => { const b = $(sel, el); if (b && fn) b.onclick = fn; };
  on("[data-pe-rot]", extra.rot); on("[data-pe-del]", extra.del); on("[data-pe-reveal]", extra.reveal); on("[data-pe-loot]", extra.loot); on("[data-pe-trap]", extra.trap);
}
