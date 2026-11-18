// Tabla de tiradas compartida y bandeja de dados. Todos ven las tiradas; el máster confirma, cambia o anula.
import { store } from "../core/store.js";
import { isDM, currentUser } from "../core/session.js";
import { publish, RESULT } from "../core/dados.js";
import { decide, damageFor, nameOf } from "../core/combate.js";
import { $, $$, esc } from "../core/ui.js";
import { srd, srdNow, findMonster } from "../core/srd.js";
import { estado, etiqueta } from "../data/estados.js";
let GLOS = null; srd("glosario").then(g => (GLOS = g));
const openInfo = new Set();

/** Resistencias, inmunidades y vulnerabilidades del objetivo frente a un tipo de daño (del perfil del manual). */
export function damageTraits(t, dtype) {
  const m = t && t.srd && findMonster(t.srd); if (!m || !dtype) return null;
  const flat = m.txt.replace(/\s+/g, " "), get = k => (flat.match(new RegExp(k + ": ([^.;]*?)(?=;| [A-Z][a-záéíóú]+:|$)")) || [, ""])[1].toLowerCase();
  const ty = dtype.toLowerCase().split(" ")[0];
  if (get("Inmunidades").includes(ty)) return { k: "inmune", txt: `${m.n} es inmune al daño ${ty}: no recibe daño.`, glos: "Inmunidad" };
  if (get("Resistencias").includes(ty)) return { k: "resiste", txt: `${m.n} tiene resistencia al daño ${ty}: recibe la mitad.`, glos: "Resistencia" };
  if (get("Vulnerabilidades").includes(ty)) return { k: "vulnerable", txt: `${m.n} es vulnerable al daño ${ty}: recibe el doble.`, glos: "Vulnerabilidad" };
  return null;
}
function rollInfo(s, r) {
  const t = s.tokens.find(x => x.id === r.target), parts = [];
  if (r.why) parts.push(`<p>${r.why.map(w => `<span class="${w.startsWith("ventaja") ? "adv" : w.startsWith("desventaja") ? "dis" : ""}">${esc(w)}</span>`).join(" · ")}</p>`);
  if (r.cov) parts.push(`<p>🛡️ ${esc(r.cov)} (ya sumado a la CA)</p>`);
  if (r.auto) parts.push(`<p>💥 ${esc(r.auto)}</p>`);
  for (const cd of (t && t.conds) || []) { const e = estado(cd.id); if (e) parts.push(`<p><b style="color:${e.c}">${esc(etiqueta(cd.id, cd.lvl))}</b> (objetivo): ${esc(e.t)}</p>`); }
  const tr = r.kind === "damage" && damageTraits(t, r.dtype);
  if (tr) parts.push(`<p class="trait">⚠️ ${esc(tr.txt)}</p>`);
  const g = GLOS || {}, keys = r.kind === "attack" ? [/✨/.test(r.label) ? "Ataque de conjuro" : "Ataque con arma", ...(r.result === "crit" ? ["Crítico"] : []), ...(r.cov ? ["Cobertura"] : [])]
    : r.kind === "damage" ? ["Daño", ...(r.crit ? ["Crítico"] : []), ...(tr ? [tr.glos] : [])] : r.kind === "save" ? ["Tirada de salvación"] : r.kind === "init" ? ["Iniciativa"] : ["Prueba de característica"];
  for (const k of keys) if (g[k]) parts.push(`<details><summary>📖 ${esc(k)}</summary>${g[k].txt.split("\n").map(p => `<p>${esc(p)}</p>`).join("")}</details>`);
  return parts.join("") || `<p class="empty">Sin reglas especiales.</p>`;
}

let adv = 0, secret = false, editing = null;
const KIND = { attack: "Ataque", damage: "Daño", check: "Prueba", save: "Salvación", init: "Iniciativa", free: "Tirada" };

/** Lista de tiradas visibles para este usuario (las secretas, solo el máster y quien tira). */
export const visibleRolls = s => (s.rolls || []).filter(r => !r.secret || isDM(s) || r.who === (currentUser(s) || {}).id);

export function renderRolls(el) {
  if (el.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return; // no pisar lo que se escribe
  const s = store.get(), dm = isDM(s), me = currentUser(s);
  const list = visibleRolls(s).slice(-30).reverse();
  const hasDamage = id => (s.rolls || []).some(x => x.link === id && x.status !== "void");
  el.innerHTML = `<div class="tray">
      <div class="trayd">${[4, 6, 8, 10, 12, 20, 100].map(d => `<button class="die d${d}" data-d="${d}" title="Tirar d${d}">d${d}</button>`).join("")}</div>
      <div class="trayo"><input type="number" id="trmod" placeholder="+0" aria-label="Modificador">
        <button class="btn small" id="tradv" aria-pressed="${adv === 1}" title="Ventaja (d20)">Ventaja</button><button class="btn small" id="trdis" aria-pressed="${adv === -1}" title="Desventaja (d20)">Desv.</button>
        ${dm ? `<button class="btn small" id="trsec" aria-pressed="${secret}" title="Solo la ves tú">Secreta</button>` : ""}
        <input id="trexpr" placeholder="2d6+3" aria-label="Expresión de dados"><button class="btn small gold" id="trgo">Tirar</button></div>
    </div>
    <div class="rolls">${list.map(r => {
      const pend = r.status === "pending", showRes = dm || !pend || r.kind !== "attack";
      const dice = r.dice.map(x => `<span class="dv d${x.d} ${x.drop ? "drop" : ""} ${x.d === 20 && x.v === 20 && !x.drop ? "nat20" : ""} ${x.d === 20 && x.v === 1 && !x.drop ? "nat1" : ""}">${x.v}</span>`).join("");
      const res = r.kind === "attack" && r.result ? `<span class="res ${r.result}">${RESULT[r.result]}${dm && r.target ? ` <small>vs CA ${r.ac ?? "?"}</small>` : ""}</span>` : "";
      const st = r.status === "void" ? `<span class="st void">Anulada</span>` : pend && (r.kind === "attack" || r.kind === "damage") ? `<span class="st pend">Pendiente del máster</span>` : r.status === "mod" ? `<span class="st mod">Modificada</span>` : "";
      const canDmg = r.kind === "attack" && r.status !== "pending" && r.status !== "void" && r.result !== "miss" && r.dmg && !hasDamage(r.id) && (dm || r.who === me.id);
      return `<div class="roll ${r.status} k-${r.kind}">
        <div class="rh"><b>${esc(r.whoName || "")}</b> <small>${KIND[r.kind] || ""}${r.adv ? (r.adv > 0 ? " · ventaja" : " · desventaja") : ""}${r.crit ? " · crítico" : ""}${r.secret ? " · secreta" : ""}</small></div>
        <div class="rl">${esc(r.label)}${r.why ? `<br><small class="${r.adv > 0 ? "adv" : r.adv < 0 ? "dis" : ""}">${esc(r.why.join(" · "))}</small>` : ""}</div>
        <div class="rb"><span class="dice">${dice}${r.dice.length && r.expr.match(/[+-]\d+$/) ? `<span class="dmod">${r.expr.match(/[+-]\d+$/)[0]}</span>` : ""}</span>
          ${editing === r.id ? `<input type="number" id="rtot" value="${r.total}" aria-label="Nuevo total"><button class="btn small gold" id="rtotok">OK</button>` : `<span class="tot">${showRes ? r.total : "?"}</span>`}${showRes ? res : ""}</div>
        ${r.note ? `<div class="rn">${esc(r.note)}</div>` : ""}
        ${r.applied != null ? `<div class="rn">−${r.applied} PG a ${esc(nameOf(s, s.tokens.find(t => t.id === r.target)) || "")}</div>` : ""}
        ${openInfo.has(r.id) ? `<div class="rinfo">${rollInfo(s, r)}</div>` : ""}
        <div class="ra">${st}<button class="btn small" data-info="${r.id}" title="Reglas que se aplican">📖</button>
          ${dm && pend && r.kind === "attack" ? `<button class="btn small gold" data-dec="${r.id}|ok">✓ Confirmar</button><button class="btn small" data-dec="${r.id}|flip">⇄ ${r.result === "miss" ? "Impacta" : "Falla"}</button>` : ""}
          ${dm && pend && r.kind === "damage" ? (() => { const tr = damageTraits(s.tokens.find(x => x.id === r.target), r.dtype); return `<button class="btn small gold" data-dec="${r.id}|${tr && tr.k === "resiste" ? "half" : tr && tr.k === "vulnerable" ? "double" : "ok"}">✓ Aplicar${tr ? (tr.k === "resiste" ? " (mitad, resiste)" : tr.k === "vulnerable" ? " (doble, vulnerable)" : "") : ""}</button><button class="btn small" data-dec="${r.id}|half">½ Mitad</button><button class="btn small" data-dec="${r.id}|double">×2</button>${tr && tr.k === "inmune" ? `<span class="st void">Inmune</span>` : ""}`; })() : ""}
          ${dm && r.status !== "void" && !r.applied ? `<button class="btn small" data-edit="${r.id}" title="Cambiar el total">✎</button><button class="btn small danger" data-dec="${r.id}|void" title="Anular">✕</button>` : ""}
          ${canDmg ? `<button class="btn small danger" data-dmg="${r.id}">🎲 Tirar daño${r.result === "crit" ? " (crítico)" : ""}</button>` : ""}
        </div></div>`;
    }).join("") || `<p class="empty">Aún no se ha tirado nada. ¡Que rueden los dados!</p>`}</div>`;

  const mod = () => +($("#trmod", el).value || 0);
  $$("[data-d]", el).forEach(b => b.onclick = () => {
    const d = +b.dataset.d, m = mod();
    publish({ expr: `1d${d}${m ? (m > 0 ? "+" : "") + m : ""}`, label: `d${d}${m ? (m > 0 ? " +" : " ") + m : ""}`, adv: d === 20 ? adv : 0, secret, kind: "free" });
    adv = 0; renderRolls(el);
  });
  $("#trgo", el).onclick = () => { const e = $("#trexpr", el).value.trim(); if (e) { publish({ expr: e, label: e, adv, secret, kind: "free" }); adv = 0; $("#trexpr", el).value = ""; renderRolls(el); } };
  $("#trexpr", el).onkeydown = e => { if (e.key === "Enter") $("#trgo", el).click(); };
  $("#tradv", el).onclick = () => { adv = adv === 1 ? 0 : 1; renderRolls(el); };
  $("#trdis", el).onclick = () => { adv = adv === -1 ? 0 : -1; renderRolls(el); };
  const sc = $("#trsec", el); if (sc) sc.onclick = () => { secret = !secret; renderRolls(el); };
  $$("[data-dec]", el).forEach(b => b.onclick = () => { const [id, a] = b.dataset.dec.split("|"); decide(id, a); });
  $$("[data-dmg]", el).forEach(b => b.onclick = () => damageFor(b.dataset.dmg));
  $$("[data-info]", el).forEach(b => b.onclick = () => { const id = b.dataset.info; openInfo.has(id) ? openInfo.delete(id) : openInfo.add(id); renderRolls(el); });
  $$("[data-edit]", el).forEach(b => b.onclick = () => { editing = b.dataset.edit; renderRolls(el); const i = $("#rtot", el); if (i) i.focus(); });
  const ok = $("#rtotok", el); if (ok) ok.onclick = () => { const v = +$("#rtot", el).value, id = editing; editing = null; decide(id, { total: v }); };
}
