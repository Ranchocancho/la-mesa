// Ficha de bolsillo: la columna fija del jugador (a la derecha, el mismo ancho que el panel del máster).
// PG, CA, estados, salvaciones contra muerte, salvaciones y pruebas, ataques, conjuros con espacios y descansos.
import { condImmune } from "../core/defensas.js";
import { store } from "../core/store.js";
import { currentUser, isDM } from "../core/session.js";
import { publish } from "../core/dados.js";
import { findSpell } from "../core/srd.js";
import { ABILITIES, AB_SHORT, SKILLS, mod, sign, saveBonus, skillBonus, classInfo, prof } from "../data/dnd.js";
import { ESTADOS } from "../data/estados.js";
import { spellMech, freeSlots, useSlot, cast, inArea } from "../core/hechizos.js";
import { savePlan, spellDC, deathSave, shortRest, longRest } from "../core/salud.js";
import { attacksOf } from "../core/combate.js";
import { inRange, dist, metres, phase, eco, moveBudget, toggle, spend, endTurn, rollInit, ACCIONES } from "../core/turnos.js";
import { arm, armedNow, picked, togglePick, clearPicks } from "../core/apuntar.js";
import { treasuresHTML, bindTreasures, journalHTML, bindJournal } from "./tesorosui.js";
import { getImage } from "../core/images.js";
import { $, $$, esc, toast } from "../core/ui.js";

let tesOpen = false, cuaOpen = false;
let condOpen = false, charSel = null, openSpell = null, slotPick = {}, accOpen = false, restOpen = false, hdN = 1, testsOpen = false;

const myChars = s => { const u = currentUser(s); return s.characters.filter(c => c.owner === (u && u.id)); };

export function renderSheet(el) {
  const a = document.activeElement; if (a && el.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
  const s = store.get(), list = myChars(s);
  if (!list.length) { el.innerHTML = `<p class="empty">No tienes personaje en este mundo. <a href="#personajes">Crea tu ficha</a>.</p>`; return; }
  const c = list.find(x => x.id === charSel) || list[0]; charSel = c.id;
  const tok = (s.tokens || []).find(t => t.kind === "pc" && t.char === c.id);
  const hpPct = Math.max(0, Math.min(100, c.hp.cur / Math.max(1, c.hp.max) * 100));
  const conds = tok ? (tok.conds || []) : [];
  const d = c.death || { s: 0, f: 0 }, pip = (on, cls) => Array.from({ length: 3 }, (_, i) => `<i class="pip ${cls} ${i < on ? "on" : ""}"></i>`).join("");
  const ab = classInfo(c.cls).cast, live = phase(s) === "live", myTurn = tok && s.board && s.board.turn === tok.id;
  el.innerHTML = `
    ${list.length > 1 ? `<select id="fsel" class="fsel">${list.map(x => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>` : ""}
    <header class="fhead"><div class="fport" data-portrait="${esc(c.portrait || "")}" style="--c:${esc(c.color || "#888")}">${c.portrait ? "" : esc(c.name.slice(0, 2).toUpperCase())}</div>
      <div><b>${esc(c.name)}</b><small>${esc(c.cls)} ${c.level}${c.species ? " · " + esc(c.species) : ""}</small></div>
      <a class="btn small" href="#personajes" title="Ficha completa">Ficha ↗</a></header>
    ${(+c.lvlGrant || 0) > c.level ? `<a class="flvl" href="#personajes">⬆ El máster te concede subir a nivel ${c.lvlGrant} · abrir la ficha</a>` : ""}
    <div class="fstats">
      <div class="fhp ${c.hp.cur === 0 ? "zero" : hpPct < 34 ? "low" : ""}"><div class="bar"><i style="width:${hpPct}%"></i></div><span><b>${c.hp.cur}</b>/${c.hp.max} PG${c.hp.temp ? ` <em>+${c.hp.temp}</em>` : ""}</span></div>
      <span class="fst"><small>CA</small><b>${c.ac}</b></span><span class="fst"><small>Vel.</small><b>${(+c.speed).toLocaleString("es-ES")} m</b></span><span class="fst"><small>Inic.</small><b>${sign(mod(c.abilities.des))}</b></span>
    </div>
    ${tok ? `<div class="fconds">${conds.map(x => { const e = ESTADOS.find(y => y.id === x.id) || { n: x.id, c: "#888", t: "" }; return `<span class="cchip big" style="--c:${e.c}" title="${esc(e.t)}"><b>${esc(e.n)}${x.lvl > 1 ? " " + x.lvl : ""}</b>${x.note ? ` · ${esc(x.note)}` : ""}<button data-uncond="${x.id}" aria-label="Quitar ${esc(e.n)}">✕</button></span>`; }).join("")}<button class="cchip add" id="faddcond">${condOpen ? "Cerrar" : "+ Estado"}</button></div>
      ${condOpen ? `<div class="fcondpick">${ESTADOS.filter(e => !conds.some(c => c.id === e.id)).map(e => `<button class="cchip" style="--c:${e.c}" data-addc="${e.id}" title="${esc(e.t)}">${esc(e.n)}</button>`).join("")}</div>` : ""}
      ${conds.length ? `<details class="fcondtxt"><summary>Qué hace${conds.length > 1 ? "n" : ""}</summary>${conds.map(x => { const e = ESTADOS.find(y => y.id === x.id); return e ? `<p><b style="color:${e.c}">${esc(e.n)}:</b> ${esc(e.t)}</p>` : ""; }).join("")}</details>` : ""}` : ""}
    ${c.hp.cur === 0 ? `<div class="fdeath ${d.dead ? "dead" : d.stable ? "stable" : ""}"><b>${d.dead ? "Muerto" : d.stable ? "Estable a 0 PG" : "A 0 PG · inconsciente"}</b>
      ${d.dead ? "" : `<div class="dsv"><span>Éxitos ${pip(d.s, "ok")}</span><span>Fallos ${pip(d.f, "ko")}</span></div>${d.stable ? "" : `<button class="btn gold small" id="fdeath" ${live && !myTurn ? "disabled title='En tu turno'" : ""}>🎲 Salvación contra muerte</button>`}`}</div>` : ""}


    ${tok && phase(s) ? turnBlock(s, c, tok) : `<section class="fsec2"><h4>⚔️ Ataques</h4>${attacksOf(s, tok || { kind: "pc", char: c.id }).map(w => `<div class="fatk"><b>${esc(w.name)}</b><span>${sign(w.atk)} · ${esc(w.expr)} ${esc(w.type || "")}</span><small>${w.rng.ranged ? `${w.rng.n}/${w.rng.l} m` : `${w.rng.l} m`}</small></div>`).join("") || `<p class="empty">Sin ataques.</p>`}</section>`}

    ${ab ? spellsBlock(s, c, tok) : ""}

    <details class="fsec" data-k="sv" ${testsOpen ? "open" : ""}><summary>Salvaciones y pruebas</summary>
      <div class="fsaves">${ABILITIES.map(([k]) => `<button class="btn small" data-save="${k}">${AB_SHORT[k]} ${sign(saveBonus(c, k))}</button>`).join("")}</div>
      <div class="fskills">${SKILLS.map(([k, n, a]) => `<button class="fsk" data-skill="${k}|${a}|${esc(n)}"><span>${esc(n)}</span><b>${sign(skillBonus(c, k, a))}</b></button>`).join("")}</div>
    </details>


    ${s.board && s.presentation && s.presentation.type === "tactical" ? "" : `<details class="fsec" data-k="tes" ${tesOpen ? "open" : ""}><summary>✨ Objetos especiales <small>${(c.treasures || []).length}</small></summary>${treasuresHTML(c, { compact: true })}</details>
    <details class="fsec" data-k="cua" ${cuaOpen ? "open" : ""}><summary>📓 Cuaderno <small>${(c.journal || []).length}</small></summary>${journalHTML(c, { limit: 4 })}</details>`}
    ${s.board && s.presentation && s.presentation.type === "tactical" ? "" : `<details class="fsec" data-k="rest" ${restOpen ? "open" : ""}><summary>Descansos</summary>
      <div class="frest"><div><b>Descanso corto</b> <small>1 hora · gasta dados de golpe (d${classInfo(c.cls).hd} + CON)</small>
        <div class="row"><input type="number" id="hdn" min="1" max="${c.level - (c.hdUsed || 0)}" value="${Math.min(hdN, Math.max(1, c.level - (c.hdUsed || 0)))}" aria-label="Dados de golpe"><span class="note">de ${c.level - (c.hdUsed || 0)} que te quedan</span><button class="btn small" id="srest" ${live ? "disabled title='No en combate'" : ""}>Descansar</button></div></div>
        <div><b>Descanso largo</b> <small>8 horas · todo: PG, dados de golpe, espacios; −1 cansancio</small><div class="row"><button class="btn small" id="lrest" ${live ? "disabled title='No en combate'" : ""}>Descansar</button></div></div></div>
    </details>`}`;
  bind(el, s, c, tok);
  const p = $(".fport", el); if (c.portrait) getImage(c.portrait).then(u => { if (u) { p.style.backgroundImage = `url('${u}')`; p.textContent = ""; } });
}

/* «Tu turno»: todo lo que puedes hacer, en un solo bloque. Primero eliges QUÉ (arma, acción…) y luego tocas A QUIÉN en la mesa. */
function turnBlock(s, c, tok) {
  const ph = phase(s), myTurn = ph === "live" && s.board.turn === tok.id, A = armedNow();
  if (ph === "init") return `<section class="fturn"><div class="ftt"><b>⚔️ ¡Combate!</b></div>${tok.init == null || tok.init === "" ? `<button class="btn gold" id="finit">🎲 Tirar iniciativa</button>` : `<p class="note">Tu iniciativa: <b>${tok.init}</b>. Esperad a que el máster empiece la ronda.</p>`}</section>`;
  const e = eco(s, tok), max = moveBudget(s, tok), pct = Math.min(100, e.mov / Math.max(1, max) * 100);
  const chip = (k, n, on) => `<button class="eco ${on ? "used" : ""}" data-feco="${k}" title="${on ? "Gastada (pulsa para devolverla)" : "Disponible"}" ${myTurn || k === "react" ? "" : "disabled"}>${n}</button>`;
  const atks = attacksOf(s, tok);
  return `<section class="fturn ${myTurn ? "mine" : ""}">
    <div class="ftt"><b>${myTurn ? "⚔️ Tu turno" : "⏳ Esperando tu turno"}</b>${myTurn ? `<button class="btn gold small" id="fend">Terminar turno ▶</button>` : ""}</div>
    <div class="fecos">${chip("act", "⚡ Acción", e.act)}${chip("bonus", "✦ Adicional", e.bonus)}${chip("react", "↺ Reacción", !!e.react)}</div>
    ${myTurn ? `<div class="movebar thin ${e.mov > max ? "over" : ""}"><i style="width:${pct}%"></i><em>🦶 ${e.mov.toLocaleString("es-ES")} / ${max.toLocaleString("es-ES")} m${e.dash ? " · corriendo" : ""} · arrastra tu figura</em></div>` : ""}
    <div class="fdo"><small class="fstep">${myTurn ? "Atacar: elige el arma y toca al enemigo en la mesa" : "Tus ataques (en tu turno)"}</small>
      <div class="fweap">${atks.map((w, i) => `<button class="fw ${A && A.kind === "atk" && A.i === i ? "armed" : ""}" data-arm="${i}" ${myTurn && !e.act ? "" : "disabled"}><b>${esc(w.name)}</b><span>${sign(w.atk)} · ${esc(w.expr)}</span><small>${w.rng.ranged ? `${w.rng.n}/${w.rng.l} m` : `${w.rng.l} m`}</small></button>`).join("") || `<p class="empty">Sin ataques.</p>`}</div>
      ${A && A.kind === "atk" ? `<div class="farmed">🎯 Ahora toca al enemigo en la mesa <button class="btn small" data-disarm>Cancelar</button></div>` : ""}
      ${tok && (tok.conds || []).some(c => c.id === "ardiendo") ? `<button class="btn small red" data-fdouse title="SRD «Fuego»: con una acción apagas el fuego rodando por el suelo y quedas derribado" ${e.act ? "disabled" : ""}>🔥 Apagarse (acción)</button>` : ""}
      ${myTurn ? `<details class="faccs" ${accOpen ? "open" : ""}><summary>Otras acciones</summary><div class="accs">${ACCIONES.filter(([n]) => n !== "Atacar" && n !== "Magia").map(([n, d]) => `<button class="btn small" data-facc="${esc(n)}" title="${esc(d)}" ${e.act ? "disabled" : ""}>${n}</button>`).join("")}</div></details>` : ""}
    </div></section>`;
}

function spellsBlock(s, c, tok) {
  const sp = c.spells || { slots: {}, list: [] }, ab = classInfo(c.cls).cast;
  const slots = Object.entries(sp.slots || {}).filter(([, v]) => v.max > 0);
  const known = (sp.list || []).filter(x => x.prepared !== false || (x.level || 0) === 0).map(x => ({ x, d: findSpell(x.name) })).sort((a, b) => ((a.d && a.d.lvl) || 0) - ((b.d && b.d.lvl) || 0));
  return `<section class="fsec2"><h4>✨ Conjuros <small>CD ${spellDC(c)} · ataque ${sign(prof(c.level) + mod(c.abilities[ab]))}</small></h4>
    ${slots.length ? `<div class="fslots">${slots.map(([l, v]) => `<span class="slotrow"><small>Nv ${l}</small>${Array.from({ length: v.max }, (_, i) => `<button class="slot ${i < v.max - v.used ? "on" : ""}" data-slot="${l}|${i < v.max - v.used ? 1 : -1}" title="${i < v.max - v.used ? "Libre (pulsa para gastarlo a mano)" : "Gastado (pulsa para recuperarlo)"}"></button>`).join("")}</span>`).join("")}</div>` : ""}
    <div class="fspells">${known.map(({ x, d }) => { const m = spellMech(d), lvl = d ? d.lvl : x.level || 0;
      const tags = m ? [m.time === "bonus" ? "adicional" : m.time === "react" ? "reacción" : "", m.conc ? "conc." : "", m.save ? "salv." : "", m.atk ? "ataque" : "", m.area ? `${m.area.shape} ${m.area.size} m` : "", m.heal ? "cura" : ""].filter(Boolean) : [];
      return `<div class="fspell ${openSpell === x.name ? "open" : ""}"><button class="fsph" data-spell="${esc(x.name)}"><i>${lvl ? lvl : "T"}</i><b>${esc(x.name)}</b><small>${tags.map(esc).join(" · ")}</small></button>
        ${openSpell === x.name ? castBox(s, c, tok, d, m) : ""}</div>`; }).join("") || `<p class="empty">Sin conjuros preparados.</p>`}</div></section>`;
}

function castBox(s, c, tok, d, m) {
  if (!d || !m) return `<div class="fcast"><p class="note">Este conjuro no está en el compendio: tíralo a mano.</p></div>`;
  const free = m.lvl ? freeSlots(c, m.lvl) : [0];
  if (slotPick[d.n] == null || !free.includes(slotPick[d.n])) slotPick[d.n] = free[0];
  const onBoard = tok && s.board;
  const cands = onBoard ? s.tokens.filter(t => !t.hidden || isDM(s)) : [];
  const nm = t => t.kind === "pc" ? (s.characters.find(x => x.id === t.char) || t).name : t.name;
  return `<div class="fcast"><p class="fdesc">${esc(d.t)} · ${esc(d.al)} · ${esc(d.du)}${m.save ? ` · salvación de ${({ fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" })[m.save]}${m.half ? " (mitad si la supera)" : ""}` : ""}</p>
    ${m.lvl ? (free.length ? `<label class="field">Espacio<select data-slotpick="${esc(d.n)}">${free.map(l => `<option value="${l}" ${slotPick[d.n] === l ? "selected" : ""}>Nivel ${l}${l > m.lvl && m.up ? ` (+${m.up} por nivel)` : ""}</option>`).join("")}</select></label>` : `<p class="note warn">No te quedan espacios de nivel ${m.lvl} o superior.</p>`) : ""}
    ${onBoard && !m.self ? `<div class="ftargets"><small>Objetivos · tócalos en la mesa</small><div class="fpicks">${[...picked].map(id => { const t = s.tokens.find(x => x.id === id); return t ? `<button class="cchip" style="--c:#d6aa4e" data-unpick="${id}" title="Quitar">${esc(nm(t))} ✕</button>` : ""; }).join("") || `<em>Ninguno todavía</em>`}</div>
      ${m.area ? `<button class="btn small" id="farea" title="Marca a todas las criaturas dentro del área (centrada en el primer objetivo, o en ti si es un cono, línea o emanación)">◎ Marcar los del área</button>` : ""}</div>` : !onBoard ? `<p class="note">Fuera de la mesa: se gasta el espacio y queda anotado.</p>` : ""}
    <button class="btn gold small" id="fcastgo" ${m.lvl && !free.length ? "disabled" : ""}>Lanzar ${esc(d.n)}</button></div>`;
}

function bind(el, s, c, tok) {
  const on = (id, fn) => { const x = $("#" + id, el); if (x) x.onclick = fn; };
  const fs = $("#fsel", el); if (fs) fs.onchange = () => { charSel = fs.value; renderSheet(el); };
  on("fdeath", () => tok && deathSave(tok.id));
  $$("details.fsec", el).forEach(dt => dt.ontoggle = () => { if (dt.dataset.k === "sv") testsOpen = dt.open; if (dt.dataset.k === "rest") restOpen = dt.open; if (dt.dataset.k === "tes") tesOpen = dt.open; if (dt.dataset.k === "cua") cuaOpen = dt.open; });
  bindTreasures(el, c, () => renderSheet(el)); bindJournal(el, c, () => renderSheet(el));
  $$("[data-save]", el).forEach(b => b.onclick = () => {
    const k = b.dataset.save, p = tok ? savePlan(s, tok, k) : { bonus: saveBonus(c, k), adv: 0, extra: "", why: [] };
    publish({ kind: "save", label: `Salvación de ${ABILITIES.find(a => a[0] === k)[1]} de ${c.name}`, expr: `1d20${p.bonus >= 0 ? "+" : ""}${p.bonus}${p.extra}`, adv: p.adv, by: tok ? tok.id : null, why: p.why.length ? p.why : null });
  });
  $$("[data-skill]", el).forEach(b => b.onclick = () => {
    const [k, a, n] = b.dataset.skill.split("|"), bonus = skillBonus(c, k, a);
    publish({ kind: "check", label: `${n} de ${c.name}`, expr: `1d20${bonus >= 0 ? "+" : ""}${bonus}`, by: tok ? tok.id : null });
  });
  $$("[data-slot]", el).forEach(b => b.onclick = () => { const [l, dlt] = b.dataset.slot.split("|"); useSlot(c.id, +l, +dlt); });
  $$("[data-spell]", el).forEach(b => b.onclick = () => { openSpell = openSpell === b.dataset.spell ? null : b.dataset.spell; arm(openSpell ? { kind: "spell", name: openSpell } : null); renderSheet(el); });
  $$("[data-unpick]", el).forEach(b => b.onclick = () => togglePick(b.dataset.unpick));
  $$("[data-arm]", el).forEach(b => b.onclick = () => { const i = +b.dataset.arm, A = armedNow(); openSpell = null; arm(A && A.kind === "atk" && A.i === i ? null : { kind: "atk", tok: tok.id, i }); renderSheet(el); });
  $$("[data-disarm]", el).forEach(b => b.onclick = () => { arm(null); renderSheet(el); });
  on("finit", () => tok && rollInit(tok.id));
  on("fend", () => { arm(null); endTurn(); });
  $$("[data-feco]", el).forEach(b => b.onclick = () => tok && toggle(tok.id, b.dataset.feco));
  $$(".faccs", el).forEach(d => d.ontoggle = () => { accOpen = d.open; });
  { const fd = $("[data-fdouse]", el); if (fd) fd.onclick = () => import("../core/peligros.js").then(m => m.douse(tok.id)).then(() => renderSheet(el)); }
  $$("[data-facc]", el).forEach(b => b.onclick = () => {
    const nm = b.dataset.facc, tid = tok.id;
    if (nm === "Correr") spend(tid, "dash");
    else if (nm === "Esquivar" || nm === "Destrabarse") { spend(tid, "act"); store.commit("token", st => { const t = st.tokens.find(x => x.id === tid); const id = nm === "Esquivar" ? "esquivando" : "destrabado"; t.conds = (t.conds || []).filter(x => x.id !== id); t.conds.push({ id, seq: st.board.seq }); }); }
    else spend(tid, "act");
    toast(`${nm}: ${(ACCIONES.find(x => x[0] === nm) || [, ""])[1]}`);
  });
  $$("[data-slotpick]", el).forEach(x => x.onchange = () => { slotPick[x.dataset.slotpick] = +x.value; });
  on("farea", () => {
    const d = findSpell(openSpell), m = spellMech(d), center = s.tokens.find(t => t.id === [...picked][0]);
    if (!center && !/cono|línea|emanación/.test(m.area.shape)) return toast("Marca primero la criatura del centro del área.");
    inArea(s, m, tok, center).forEach(id => picked.add(id)); renderSheet(el);
  });
  on("fcastgo", () => {
    const d = findSpell(openSpell), m = spellMech(d);
    if (!tok || !s.board) {           // fuera de la mesa: solo se gasta el espacio
      if (m.lvl) { const free = freeSlots(c, m.lvl); if (!free.length) return; useSlot(c.id, slotPick[d.n] || free[0]); }
      publish({ kind: "free", label: `${c.name} lanza ${d.n}`, expr: m.heal ? m.heal : "1d20", by: null });
      openSpell = null; arm(null); return;
    }
    const targets = m.self ? [tok.id] : [...picked];
    if (!targets.length && (m.save || m.heal || m.atk || m.buff || m.dmg)) return toast("Elige al menos un objetivo.");
    const r = cast(tok.id, d.n, m.lvl ? slotPick[d.n] : 0, targets);
    if (r !== null) { openSpell = null; arm(null); }
  });
  on("faddcond", () => { condOpen = !condOpen; renderSheet(el); });
  $$("[data-addc]", el).forEach(b => b.onclick = () => { condOpen = false; store.commit("token", st => { const k = st.tokens.find(x => x.id === tok.id); k.conds = k.conds || []; if (condImmune(k, b.dataset.addc)) { toast(`${k.name} es inmune a ese estado (perfil del SRD).`); return; } if (!k.conds.some(c => c.id === b.dataset.addc)) k.conds.push({ id: b.dataset.addc }); }); });
  $$("[data-uncond]", el).forEach(b => b.onclick = () => store.commit("token", st => { const k = st.tokens.find(x => x.id === tok.id); k.conds = (k.conds || []).filter(c => c.id !== b.dataset.uncond); }));
  const hd = $("#hdn", el); if (hd) hd.oninput = () => { hdN = +hd.value || 1; };
  on("srest", () => shortRest(c.id, hdN));
  on("lrest", () => { const b = $("#lrest", el); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "¿Seguro? Pulsa otra vez"; return; } longRest(c.id); });
}
