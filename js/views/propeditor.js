// Editar un objeto del mapa: nombre, si está oculto a los jugadores, su contenido (tesoro) o su efecto (trampa).
// En partida, el máster además puede revelarlo, anunciar el botín o disparar la trampa.
import { PROPS } from "../data/mapas.js";
import { TRAPS, TIER_TXT } from "../data/trampas.js";
import { esc, $, $$ } from "../core/ui.js";

const AB = { fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" };

export function propEditorHTML(p, { live = false } = {}) {
  const v = PROPS[p.k] || { n: p.k, i: "?" }, tr = p.trap || {};
  return `<div class="propedit"><h3><span>${v.i}</span>${esc(v.n)}</h3>
    <label class="field">Nombre o nota<input data-pe="label" value="${esc(p.label || "")}" placeholder="${v.cat === "marca" ? "Qué hay aquí, qué pasa…" : "Opcional"}"></label>
    <label class="switch"><input type="checkbox" data-pe-hidden ${p.hidden ?? v.hidden ? "checked" : ""}> Oculto a los jugadores</label>
    ${v.loot || p.loot != null ? `<label class="field">Contenido (lo que encuentran)<textarea data-pe="loot" rows="3" placeholder="120 po, una poción de curación, un mapa…">${esc(p.loot || "")}</textarea></label>` : ""}
    ${v.haz === "fall" ? `<label class="field">Altura de la caída (m)<input type="number" min="1" max="120" data-pe-h value="${+p.h || v.h || 3}"></label><p class="note">SRD «Caídas»: ${Math.max(1, Math.min(20, Math.floor((+p.h || v.h || 3) / 3)))}d6 contundente y derribado. La mesa lo tira al entrar.</p>` : ""}
    ${v.haz === "fire" ? `<p class="note">Quien entra empieza a arder (SRD «Fuego»: 1d4 de fuego al principio de cada turno hasta apagarse con una acción).</p>` : ""}
    ${v.note ? `<p class="note">${esc(v.note)}</p>` : ""}
    ${v.trap ? `<fieldset class="trapf"><legend>Trampa</legend>
      <label class="field">Trampa del SRD<select data-pe-srd><option value="">Personalizada (tus números)</option>${Object.entries(TRAPS).map(([k, t]) => `<option value="${k}" ${tr.srd === k ? "selected" : ""}>${t.n}</option>`).join("")}</select></label>
      ${tr.srd && TRAPS[tr.srd] ? (T => `<div class="trapsrd"><b>${esc(T.n)}</b> · ${esc(T.sev)}<br><b>Activador:</b> ${esc(T.trig)}<br><b>Efecto:</b> ${T.save ? `salvación de ${AB[T.save]} CD ${T.dc.join(" / ")}` : "sin salvación"}${T.dmg ? ` · ${T.dmg.join(" / ")} de ${esc(T.type)}${T.half ? " (mitad si la supera)" : ""}` : T.darts ? ` · 1d3 dardos de ${T.darts.join(" / ")} de veneno` : ""}${T.condTxt ? ` · ${esc(T.condTxt)}` : ""}<br><small>Por rangos de niveles: ${TIER_TXT.join(" / ")}. La mesa usa el nivel medio del grupo.</small><br><b>Detectar:</b> ${esc(T.detect)}<br><b>Desarmar:</b> ${esc(T.disarm)}${T.note ? `<br>${esc(T.note)}` : ""}</div>`)(TRAPS[tr.srd]) : `
      <div class="row"><label>Detectar CD<input type="number" data-tr="detect" value="${tr.detect ?? 13}"></label><label>Salvación<select data-tr="save">${Object.entries(AB).map(([k, n]) => `<option value="${k}" ${(tr.save || "des") === k ? "selected" : ""}>${n}</option>`).join("")}</select></label><label>CD<input type="number" data-tr="dc" value="${tr.dc ?? 13}"></label></div>
      <div class="row"><label>Daño<input data-tr="dmg" value="${esc(tr.dmg || "2d10")}"></label><label>Tipo<input data-tr="type" value="${esc(tr.type || "perforante")}"></label></div>`}
      <p class="note">Si alguien la pisa en combate, salta sola: se revela y se tiran las salvaciones.</p></fieldset>` : ""}
    ${!live ? `<div class="row"><button class="btn small" data-pe-rot>↻ Girar (R)</button><button class="btn small danger" data-pe-del>Quitar (Supr)</button></div>` : ""}
    ${live ? `<div class="row">${p.hidden ?? v.hidden ? `<button class="btn small gold" data-pe-reveal>👁 Revelar</button>` : ""}${v.loot || p.loot ? `<button class="btn small gold" data-pe-loot>💰 Anunciar el contenido</button>` : ""}${v.trap ? `<button class="btn small red" data-pe-trap>⚠ Disparar sobre quien está ahí</button>` : ""}</div>` : ""}</div>`;
}
/** set(fn(prop)): cambia el objeto; extra: { del, rot, reveal, loot, trap } */
export function bindPropEditor(el, set, extra = {}) {
  let t = null; const later = fn => { clearTimeout(t); t = setTimeout(fn, 300); };
  $$("[data-pe]", el).forEach(i => i.addEventListener("input", () => later(() => set(p => { p[i.dataset.pe] = i.value; }))));
  const h = $("[data-pe-hidden]", el); if (h) h.onchange = () => set(p => { p.hidden = h.checked; });
  const hh = $("[data-pe-h]", el); if (hh) hh.addEventListener("input", () => later(() => set(p => { p.h = Math.max(1, Math.min(120, +hh.value || 3)); })));
  const sr = $("[data-pe-srd]", el); if (sr) sr.onchange = () => set(p => { p.trap = sr.value ? { srd: sr.value } : { dc: 13, save: "des", dmg: "2d10", type: "perforante", detect: 13 }; });
  $$("[data-tr]", el).forEach(i => i.addEventListener("input", () => later(() => set(p => { p.trap = p.trap || {}; p.trap[i.dataset.tr] = i.type === "number" ? +i.value : i.value; }))));
  $$("select[data-tr]", el).forEach(i => i.onchange = () => set(p => { p.trap = p.trap || {}; p.trap[i.dataset.tr] = i.value; }));
  const on = (sel, fn) => { const b = $(sel, el); if (b && fn) b.onclick = fn; };
  on("[data-pe-rot]", extra.rot); on("[data-pe-del]", extra.del); on("[data-pe-reveal]", extra.reveal); on("[data-pe-loot]", extra.loot); on("[data-pe-trap]", extra.trap);
}
