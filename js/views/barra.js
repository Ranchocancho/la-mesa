// Barra de acciones del jugador, como la de Baldur's Gate 3: abajo, sobre la mesa.
//   · Izquierda: tu retrato, tu vida y tus estados (con su contador ⏳).
//   · Encima de los iconos: lo que te queda del turno (acción ●, acción adicional ▲, movimiento, reacción ↺,
//     espacios de conjuro y usos de rasgos). Al pasar por un icono se ilumina lo que gastaría.
//   · Iconos por grupos: ataques, conjuros, rasgos de clase y acciones. Lo que no puedes usar sale apagado
//     y al pasar por encima dice por qué. Pulsar un icono lo prepara y la mesa pide el objetivo (como ya hacía).
//   · Derecha: «Terminar turno».
// En combate la barra sustituye a las fases de la ficha (la ficha queda para consultar). En pantallas estrechas
// (menos de 900 px) no hay barra y todo sigue en la ficha.
import { store } from "../core/store.js";
import { currentUser, isDM } from "../core/session.js";
import { charOf } from "../core/mesa.js";
import { findSpell } from "../core/srd.js";
import { ESTADOS } from "../data/estados.js";
import { spellMech, freeSlots, useSlot, cast, inArea } from "../core/hechizos.js";
import { spellDC, deathSave } from "../core/salud.js";
import { attacksOf } from "../core/combate.js";
import { phase, eco, moveBudget, speedOf, spend, endTurn, rollInit, ACCIONES, attacksPerAction, toggle } from "../core/turnos.js";
import { arm, armedNow, picked, togglePick, onAim } from "../core/apuntar.js";
import { hide, search, hideCheck, hideDC, shoveDC, climbables, climbOn, climbDown, pushables, pushObject } from "../core/acciones.js";
import { topOfTok } from "../core/alturas.js";
import { rageInfo, rage, extendRage, bardicInfo, inspirable, inspire } from "../core/rasgos.js";
import { rxOpen, answerRx, RX } from "../core/reacciones.js";
import { oaOpen, answerOA } from "../core/combate.js";
import { durText, durTag } from "../core/duraciones.js";
import { getImage } from "../core/images.js";
import { $, $$, esc, toast } from "../core/ui.js";

const NOACT = ["incapacitado", "inconsciente", "aturdido", "paralizado", "petrificado", "muerto"];
const NOMOVE = ["agarrado", "apresado"];
const fm = n => (Math.round(n * 10) / 10).toLocaleString("es-ES");
const sign = n => (n >= 0 ? "+" : "") + n;
const wide = () => !window.matchMedia || window.matchMedia("(min-width: 901px)").matches;
const myTok = s => { const u = currentUser(s); return u && (s.tokens || []).find(t => t.kind === "pc" && t.owner === u.id); };
/** ¿Se juega con la barra? (jugador con figura en la mesa, combate en marcha y pantalla ancha) */
export const barOn = s => !isDM(s) && !!s.board && !!phase(s) && !!myTok(s) && wide();

let pop = null, slotPick = {}, imgUrl = {}, sig = "";

/* ---------- Iconos (dibujados con símbolos propios, sin el arte de BG3) ---------- */
function weaponIcon(w) {
  const n = (w.name || "").toLowerCase();
  if (w.improv) return "🪨";
  if (/arco/.test(n)) return "🏹"; if (/ballesta/.test(n)) return "🎯"; if (/hacha/.test(n)) return "🪓";
  if (/martillo|maza|garrote|mangual|lucero|bast[oó]n/.test(n)) return "🔨"; if (/lanza|pica|tridente|jabalina|alabarda|guja/.test(n)) return "🔱";
  if (/daga|dardo/.test(n)) return "🔪"; if (/honda/.test(n)) return "🪃"; if (/l[aá]tigo/.test(n)) return "➰";
  return w.rng && w.rng.ranged && !w.rng.melee ? "🏹" : "🗡";
}
const DT_ICON = { fuego: "🔥", frío: "❄", relámpago: "⚡", radiante: "☀", necrótico: "💀", fuerza: "✴", psíquico: "🌀", veneno: "☠", ácido: "🧪", trueno: "💥", contundente: "🔨", cortante: "🗡", perforante: "🔱" };
function spellIcon(d, m) {
  if (d.n === "Escudo") return "🛡"; if (d.n === "Contrahechizo") return "🚫"; if (/Paso brumoso|Teletransporte|Puerta/.test(d.n)) return "💨";
  if (m.heal) return "✚"; if (m.buff === "bendecido") return "🙏"; if (m.buff === "perdicion") return "🕸";
  return DT_ICON[(m.dt || "").toLowerCase()] || (m.conds && m.conds.length ? "🌀" : "✨");
}
const ACT_ICON = { Correr: "🏃", Destrabarse: "💨", Esquivar: "🤸", Ayudar: "🤝", Esconderse: "🫥", Buscar: "🔎", Estudiar: "📖", Influir: "🗣", "Preparar una acción": "⏳", Utilizar: "🧰" };
const COST = { act: { t: "Acción", k: "act" }, bonus: { t: "Acción adicional", k: "bonus" }, react: { t: "Reacción", k: "react" }, free: { t: "Gratis", k: "free" }, move: { t: "Movimiento", k: "move" } };

function mySpells(c) {
  return ((c.spells || {}).list || []).filter(x => x.prepared !== false || (x.level || 0) === 0).map(x => { const d = findSpell(x.name); return { x, d, m: spellMech(d) }; }).filter(o => o.d && o.m)
    .sort((a, b) => (a.d.lvl || 0) - (b.d.lvl || 0));
}

/** Todo lo que se puede pulsar, con por qué no (si no se puede). */
function entries(s, c, tok) {
  const live = phase(s) === "live", mine = live && s.board.turn === tok.id, e = eco(s, tok), A = armedNow();
  const ids = (tok.conds || []).map(x => x.id), incapId = ids.find(x => NOACT.includes(x));
  const incap = incapId ? `Estás ${(ESTADOS.find(y => y.id === incapId) || { n: incapId }).n.toLowerCase()}` : "";
  const notTurn = !mine ? "No es tu turno" : "";
  const nAtk = attacksPerAction(s, tok), actUsed = !!e.act && !(e.atkLeft > 0);
  const whyAct = incap || notTurn || (actUsed ? "Ya has usado tu acción" : ""), whyAtkAct = whyAct;
  const whyBonus = incap || notTurn || (e.bonus ? "Ya has usado tu acción adicional" : "");
  const G = { atk: [], spell: [], feat: [], act: [] };
  const atks = attacksOf(s, tok).map((w, i) => ({ ...w, _i: i })).filter(w => !w.spell); // _i: su sitio en attacksOf (lo usa la mesa)
  atks.forEach(w => { const i = w._i; G.atk.push({ id: "w" + i, ico: weaponIcon(w), name: w.name, cost: "act", why: whyAtkAct, on: A && A.kind === "atk" && A.i === i && (A.use || "act") === "act",
    tip: [`${sign(w.atk)} al ataque · ${w.expr} ${w.type || ""}`, w.rng.ranged ? `Alcance ${w.rng.n}/${w.rng.l} m` : `Alcance ${w.rng.l} m`, ...(w.mas ? [`Maestría: ${w.mas.n}`] : []), ...(nAtk > 1 ? [`Atacar: ${nAtk} ataques con la misma acción${e.act && e.atkLeft > 0 ? ` (te quedan ${e.atkLeft})` : ""}`] : [])],
    run: () => { const A2 = armedNow(); arm(A2 && A2.kind === "atk" && A2.i === i && (A2.use || "act") === "act" ? null : { kind: "atk", tok: tok.id, i, use: "act" }); pop = null; } }); });
  // Arma ligera en la otra mano (acción adicional, tras atacar con una ligera)
  const light = atks.map(w => ({ w, i: w._i })).filter(o => /ligera/i.test(o.w.notes || o.w.props || ""));
  if (light.length >= 2) light.forEach(o => G.atk.push({ id: "l" + o.i, ico: weaponIcon(o.w), sub: "2ª", name: `${o.w.name} (otra mano)`, cost: "bonus", why: whyBonus || (!e.act ? "Primero ataca con un arma ligera" : ""),
    on: A && A.kind === "atk" && A.i === o.i && A.use === "bonus", tip: ["Propiedad Ligera: sin sumar el modificador de característica al daño (salvo negativo)."],
    run: () => { const A2 = armedNow(); arm(A2 && A2.kind === "atk" && A2.i === o.i && A2.use === "bonus" ? null : { kind: "atk", tok: tok.id, i: o.i, use: "bonus" }); pop = null; } }));
  // Empujón (en lugar de un ataque)
  [["push", "🤚", "Empujón: apartar", "Lo apartas 1,5 m"], ["prone", "🤼", "Empujón: derribar", "Lo derribas"]].forEach(([mode, ico, name, t]) => G.atk.push({ id: "sh" + mode, ico, name, cost: "act", why: whyAtkAct,
    on: A && A.kind === "shove" && A.mode === mode, tip: [`${t}. En vez de un ataque de la acción Atacar.`, `Salvación de Fuerza o Destreza del objetivo, CD ${shoveDC(s, tok)}`],
    run: () => { const A2 = armedNow(); arm(A2 && A2.kind === "shove" && A2.mode === mode ? null : { kind: "shove", tok: tok.id, mode }); pop = null; } }));
  // Conjuros
  for (const { x, d, m } of mySpells(c)) {
    const used = m.time === "bonus" ? e.bonus : m.time === "react" ? !!e.react : e.act;
    let why = incap || (m.time === "react" ? "" : notTurn) || (used ? (m.time === "bonus" ? "Ya has usado tu acción adicional" : m.time === "react" ? "Ya has usado tu reacción" : "Ya has usado tu acción") : "");
    if (!why && m.lvl && !freeSlots(c, m.lvl).length) why = `Sin espacios de nivel ${m.lvl} o más`;
    if (!why && m.lvl && e.slotCast && m.time !== "react") why = "Ya lanzaste un conjuro con espacio este turno: solo trucos";
    if (!why && m.time === "react") why = "Es una reacción: la mesa te la ofrecerá cuando toque";
    if (!why && ids.includes("furia")) why = "En furia no puedes lanzar conjuros";
    G.spell.push({ id: "s:" + x.name, ico: spellIcon(d, m), lvl: d.lvl || 0, name: d.n, cost: m.time, why, on: pop && pop.spell === d.n,
      tip: [`${d.lvl ? `Nivel ${d.lvl}` : "Truco"} · ${d.al || "—"} · ${d.du || "—"}`, ...(m.save ? [`Salvación de ${m.save.toUpperCase()} CD ${spellDC(c)}${m.half ? " (mitad si la supera)" : ""}`] : []), ...(m.atk ? ["Tirada de ataque de conjuro"] : []), ...(m.dmg ? [`Daño ${m.dmg} ${m.dt || ""}`] : []), ...(m.heal ? [`Cura ${m.heal}`] : []), ...(m.area ? [`Área: ${m.area.shape} de ${String(m.area.size).replace(".", ",")} m`] : []), ...(m.conc ? ["Concentración"] : [])],
      run: () => { if (pop && pop.spell === d.n) { pop = null; arm(null); return; } pop = { spell: d.n }; picked.clear(); arm({ kind: "spell", name: d.n, go: () => doCast(tok.id, c.id) }); } });
  }
  // Rasgos de clase
  const R = rageInfo(c), B = bardicInfo(c), F = c.features || [];
  if (R) { const on = (tok.conds || []).find(x => x.id === "furia");
    G.feat.push(on ? { id: "ragex", ico: "🔥", sub: "+", name: "Prolongar furia", cost: "bonus", why: whyBonus, tip: [`En furia: ${durText(s, on)}.`, "Atacar a un enemigo en tu turno ya la prolonga; si no, gasta la acción adicional."], run: () => extendRage(tok.id, true) }
      : { id: "rage", ico: "🔥", name: "Furia", cost: "bonus", why: whyBonus || (!R.left ? "Sin usos: se recuperan al descansar" : ""), uses: `${R.left}/${R.max}`, tip: [`Resistencia a contundente, cortante y perforante · +${R.dmg} al daño con Fuerza · ventaja en Fuerza.`, "No puedes lanzar conjuros. Dura hasta el final de tu siguiente turno."], run: () => rage(tok.id) }); }
  if (B) G.feat.push({ id: "bard", ico: "🎵", name: "Inspiración bárdica", cost: "bonus", why: whyBonus || (!B.left ? "Sin usos" : ""), uses: `${B.left}/${B.max}`, on: pop && pop.bard,
    tip: [`Das un ${B.die} a un aliado a 18 m: lo suma a una prueba con d20 que falle.`], run: () => { pop = pop && pop.bard ? null : { bard: true }; } });
  if (F.some(f => /Acci[oó]n astuta/i.test(f.name))) ["Correr", "Destrabarse", "Esconderse"].forEach(n => G.feat.push({ id: "cun" + n, ico: ACT_ICON[n], sub: "▲", name: `Acción astuta: ${n}`, cost: "bonus",
    why: whyBonus || (n === "Esconderse" ? (hideCheck(s, tok).ok ? "" : hideCheck(s, tok).why) : ""), tip: [(ACCIONES.find(a => a[0] === n) || [, ""])[1]], run: () => cunning(tok.id, n) }));
  F.filter(f => { const t = (f.name + " " + (f.text || "")).toLowerCase(); return /acci[oó]n adicional/.test(t) && !/Acci[oó]n astuta|^Furia$|^Inspiraci[oó]n b[aá]rdica/i.test(f.name); })
    .forEach((f, i) => G.feat.push({ id: "f" + i, ico: "★", name: f.name, cost: "bonus", why: whyBonus, tip: [String(f.text || "").slice(0, 220)], run: () => { spend(tok.id, "bonus"); toast(`${f.name}: acción adicional gastada. El máster aplica el efecto.`); } }));
  // Acciones del manual
  ACCIONES.filter(([n]) => n !== "Atacar" && n !== "Magia").forEach(([n, t]) => { const hw = n === "Esconderse" ? hideCheck(s, tok) : null;
    G.act.push({ id: "a:" + n, ico: ACT_ICON[n] || "•", name: n, cost: "act", why: whyAct || (hw && !hw.ok ? hw.why : ""), tip: [t], run: () => basic(tok.id, n) }); });
  if (ids.includes("ardiendo")) G.act.push({ id: "douse", ico: "🧯", name: "Apagarse", cost: "act", why: whyAct, tip: ["SRD «Fuego»: con una acción apagas el fuego rodando por el suelo y quedas derribado."], run: () => import("../core/peligros.js").then(m => m.douse(tok.id)) });
  const moveWhy = incap || notTurn;
  climbables(s, tok).forEach(x => G.act.push({ id: "cl" + x.id, ico: "🧗", name: `Subirte a ${x.name}`, cost: "move", why: moveWhy, tip: [`Cuesta ${fm(x.cost)} m de movimiento. Alturas de objetos: regla de campaña.`], run: () => climbOn(tok.id, x.id) }));
  if (topOfTok(s.board, tok)) G.act.push({ id: "down", ico: "⬇", name: "Bajar", cost: "move", why: moveWhy, tip: ["Bajar del objeto."], run: () => climbDown(tok.id) });
  pushables(s, tok).forEach(x => G.act.push({ id: "po" + x.id, ico: "🫸", name: `Empujar ${x.name}`, cost: "act", why: whyAct || (!x.free ? "No hay sitio detrás" : ""), tip: [`Fuerza (Atletismo) CD ${x.dc} (regla de campaña): lo mueves 1,5 m.`], run: () => pushObject(tok.id, x.id) }));
  return G;
}

/* ---------- Lo que hacen los iconos ---------- */
function basic(tid, nm) {
  if (nm === "Correr") spend(tid, "dash");
  else if (nm === "Esconderse") return hide(tid, "act");
  else if (nm === "Buscar") return search(tid, "act");
  else if (nm === "Esquivar" || nm === "Destrabarse") { spend(tid, "act"); store.commit("token", st => { const t = st.tokens.find(x => x.id === tid); const id = nm === "Esquivar" ? "esquivando" : "destrabado"; t.conds = (t.conds || []).filter(x => x.id !== id); t.conds.push({ id, seq: st.board.seq }); }); }
  else spend(tid, "act");
  toast(`${nm}: ${(ACCIONES.find(x => x[0] === nm) || [, ""])[1]}`);
}
function cunning(tid, nm) {
  if (nm === "Esconderse") return hide(tid, "bonus");
  spend(tid, "bonus");
  if (nm === "Correr") store.commit("token", st => { const t = st.tokens.find(x => x.id === tid); const e = eco(st, t); e.dash = true; t.eco = e; });
  if (nm === "Destrabarse") store.commit("token", st => { const t = st.tokens.find(x => x.id === tid); t.conds = (t.conds || []).filter(x => x.id !== "destrabado"); t.conds.push({ id: "destrabado", seq: st.board.seq }); });
  toast(`Acción astuta · ${nm}: ${(ACCIONES.find(x => x[0] === nm) || [, ""])[1]}`);
}
/** Lanzar el conjuro preparado: desde el botón o al colocar el área / tocar al objetivo en la mesa (como en BG3). */
function doCast(tokId, charId) {
  const s = store.get(); if (!pop || !pop.spell) return;
  const c = s.characters.find(x => x.id === charId), d = findSpell(pop.spell), m = spellMech(d);
  const targets = m.self ? [tokId] : [...picked];
  if (!targets.length && (m.save || m.heal || m.atk || m.buff || m.dmg)) return toast("Elige al menos un objetivo en la mesa.");
  const free = m.lvl ? freeSlots(c, m.lvl) : [0], slot = m.lvl ? (free.includes(slotPick[d.n]) ? slotPick[d.n] : free[0]) : 0;
  const r = cast(tokId, d.n, slot, targets);
  if (r !== null) { pop = null; arm(null); }
}

/* ---------- Dibujo ---------- */
function slotsHTML(c) {
  const sl = Object.entries((c.spells || {}).slots || {}).filter(([, v]) => v.max > 0); if (!sl.length) return "";
  return `<span class="hbslots" data-res="slot" title="Espacios de conjuro (CD ${spellDC(c)})">${sl.map(([l, v]) => `<span><small>${["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][+l] || l}</small>${Array.from({ length: v.max }, (_, i) => `<i class="${i < v.max - v.used ? "on" : ""}"></i>`).join("")}</span>`).join("")}</span>`;
}
function iconHTML(x, k) {
  const cost = COST[x.cost] || COST.act;
  return `<button class="hbi c-${cost.k} ${x.why ? "off" : ""} ${x.on ? "on" : ""}" data-hb="${k}" data-cost="${cost.k}" aria-label="${esc(x.name)}${x.why ? ": " + esc(x.why) : ""}">
    <span class="hbg">${x.ico}</span>${x.lvl ? `<em class="hblv">${x.lvl}</em>` : ""}${x.sub ? `<em class="hbsub">${esc(x.sub)}</em>` : ""}${x.uses ? `<em class="hbuse">${x.uses}</em>` : ""}<i class="hbcost"></i></button>`;
}
function tipHTML(x) {
  const cost = COST[x.cost] || COST.act;
  return `<b>${esc(x.name)}</b><span class="hbtc c-${cost.k}"><i></i>${cost.t}</span>${x.tip.filter(Boolean).map(t => `<p>${esc(t)}</p>`).join("")}${x.why ? `<p class="hbwhy">⛔ ${esc(x.why)}</p>` : ""}`;
}
function castPanel(s, c, tok) {
  const d = findSpell(pop.spell), m = spellMech(d); if (!d || !m) return "";
  const free = m.lvl ? freeSlots(c, m.lvl) : [0];
  if (slotPick[d.n] == null || !free.includes(slotPick[d.n])) slotPick[d.n] = free[0];
  const nm = t => t.kind === "pc" ? (s.characters.find(x => x.id === t.char) || t).name : t.name;
  return `<div class="hbpop"><b>${esc(d.n)}</b>
    ${m.lvl ? `<label>Espacio <select data-hbslot="${esc(d.n)}">${free.map(l => `<option value="${l}" ${slotPick[d.n] === l ? "selected" : ""}>Nivel ${l}${l > m.lvl && m.up ? ` (+${m.up})` : ""}</option>`).join("")}</select></label>` : ""}
    ${m.self ? `<span class="hbhint">Sobre ti</span>` : `<span class="hbhint">${m.area ? "Coloca el área en la mesa" : m.atk ? "Toca al objetivo en la mesa" : "Toca los objetivos en la mesa"}</span>
      <span class="hbpicks">${[...picked].map(id => { const t = s.tokens.find(x => x.id === id); return t ? `<button class="cchip" style="--c:#d6aa4e" data-hbunpick="${id}">${esc(String(nm(t)).split(" ")[0])} ✕</button>` : ""; }).join("")}</span>
      ${m.area ? `<button class="btn small" data-hbarea title="Marca a todas las criaturas dentro del área">◎ Marcar el área</button>` : ""}`}
    <button class="btn gold small" data-hbcast>Lanzar</button><button class="ib" data-hbx aria-label="Cancelar">✕</button></div>`;
}
function bardPanel(s, tok) {
  const L = inspirable(s, tok);
  return `<div class="hbpop"><b>🎵 Inspiración bárdica</b><span class="hbhint">¿A quién?</span>${L.map(x => `<button class="btn small gold" data-hbbard="${x.id}">${esc(String(x.name || "").split(" ")[0])}</button>`).join("") || `<span class="hbhint">No hay aliados a 18 m sin dado.</span>`}<button class="ib" data-hbx aria-label="Cancelar">✕</button></div>`;
}
/** Avisos de reacción (oportunidad, Escudo…) para ti: encima de la barra, como en BG3. */
function promptHTML(s, tok) {
  const oa = (s.rolls || []).find(r => r.tok === tok.id && oaOpen(s, r));
  if (oa) { const t = s.tokens.find(x => x.id === oa.target); return `<div class="hbask"><span>⚔ <b>¡Oportunidad!</b> ${esc(t ? (t.hidden ? "Alguien" : t.name) : "Un enemigo")} sale de tu alcance.</span><button class="btn small gold" data-hboa="${oa.id}">⚔ Atacar</button><button class="btn small" data-hboano="${oa.id}">Dejar pasar</button></div>`; }
  const rx = (s.rolls || []).find(r => r.tok === tok.id && rxOpen(s, r));
  if (rx) { const X = RX[rx.rx]; return `<div class="hbask"><span>${X.i} <b>¡Reacción!</b> ${esc(X.q)}</span><button class="btn small gold" data-hbrx="${rx.id}">${X.i} ${esc(X.n)}</button><button class="btn small" data-hbrxno="${rx.id}">No</button></div>`; }
  return "";
}

function html(s) {
  const tok = myTok(s), c = tok && charOf(s, tok); if (!c) return "";
  const ph = phase(s), live = ph === "live", mine = live && s.board.turn === tok.id, e = eco(s, tok);
  const hp = c.hp, pct = Math.max(0, Math.min(100, hp.cur / Math.max(1, hp.max) * 100));
  const conds = (tok.conds || []).map(x => ({ x, e: ESTADOS.find(y => y.id === x.id) })).filter(o => o.e);
  const port = `<div class="hbport"><div class="hbface" style="--c:${esc(c.color || "#888")};${imgUrl[c.portrait] ? `background-image:url('${imgUrl[c.portrait]}')` : ""}">${imgUrl[c.portrait] ? "" : esc(c.name.slice(0, 2).toUpperCase())}</div>
    <div class="hbwho"><b>${esc(c.name.split(" ")[0])}</b><div class="hbhp ${pct < 34 ? "low" : ""}"><i style="width:${pct}%"></i><span>${hp.cur}/${hp.max}${hp.temp ? ` +${hp.temp}` : ""}</span></div>
      <div class="hbconds">${conds.map(({ x, e: E }) => `<span class="hbcond" style="--c:${E.c}" title="${esc(E.n)}: ${esc(E.t)}${x.dur ? " · " + esc(durText(s, x)) : ""}">${esc(E.n.split(" ")[0])}${x.dur ? `<sub>${durTag(s, x).replace("⏳", "")}</sub>` : ""}</span>`).join("")}</div></div></div>`;
  if (ph === "init") return `<div class="hotbar init">${port}<div class="hbmid"><p class="hbmsg">⚔️ ¡Combate! ${tok.init == null || tok.init === "" ? "" : `Tu iniciativa: <b>${tok.init}</b>. Esperad a que el máster empiece la ronda.`}</p></div>
    <div class="hbend">${tok.init == null || tok.init === "" ? `<button class="btn gold" data-hbinit>🎲 Tirar iniciativa</button>` : ""}</div></div>`;
  const G = entries(s, c, tok), all = [...G.atk, ...G.spell, ...G.feat, ...G.act];
  const max = moveBudget(s, tok), left = Math.max(0, max - (mine ? e.mov : 0)), stuck = (tok.conds || []).some(x => NOMOVE.includes(x.id));
  const nAtk = attacksPerAction(s, tok);
  const R = rageInfo(c), B = bardicInfo(c);
  const res = `<div class="hbres">
      <span class="hbr r-act ${e.act && !(e.atkLeft > 0) || !mine ? "used" : ""}" data-res="act" title="Acción"><i></i>Acción${e.act && e.atkLeft > 0 ? ` <small>×${e.atkLeft}</small>` : nAtk > 1 && !e.act ? ` <small>×${nAtk}</small>` : ""}</span>
      <span class="hbr r-bonus ${e.bonus || !mine ? "used" : ""}" data-res="bonus" title="Acción adicional"><i></i>Adicional</span>
      <span class="hbr r-move ${!mine || stuck || !left ? "used" : ""}" data-res="move" title="Movimiento: arrastra tu figura"><span class="hbmv"><i style="width:${stuck ? 0 : Math.min(100, left / Math.max(1, max) * 100)}%"></i></span>${stuck ? "0" : fm(left)}/${fm(max)} m${e.dash ? " · corriendo" : ""}</span>
      <span class="hbr r-react ${e.react ? "used" : ""}" data-res="react" title="Reacción: vuelve al empezar tu turno"><i></i>Reacción</span>
      ${slotsHTML(c)}
      ${R ? `<span class="hbr r-cls" title="Usos de Furia">🔥 ${R.left}/${R.max}</span>` : ""}${B ? `<span class="hbr r-cls" title="Usos de Inspiración bárdica (${B.die})">🎵 ${B.left}/${B.max}</span>` : ""}
      ${e.slotCast && mine ? `<span class="hbnote">Ya lanzaste un conjuro con espacio: solo trucos</span>` : ""}
    </div>`;
  let k = 0; const idx = new Map(); all.forEach(x => idx.set(x, k++));
  const group = (t, L) => L.length ? `<div class="hbgrp"><small>${t}</small><div class="hbrow ${L.length <= 3 ? "one" : ""}">${L.map(x => iconHTML(x, idx.get(x))).join("")}</div></div>` : "";
  const cur = live && s.tokens.find(t => t.id === s.board.turn), curName = cur ? (cur.kind === "pc" ? (s.characters.find(x => x.id === cur.char) || cur).name : cur.hidden ? "?" : cur.name) : "—";
  const dead = hp.cur <= 0 && !(c.death && (c.death.stable || c.death.dead));
  const popH = pop && pop.spell ? castPanel(s, c, tok) : pop && pop.bard ? bardPanel(s, tok) : "";
  return `<div class="hotbar ${mine ? "mine" : "wait"}">
    <div class="hbtop">${promptHTML(s, tok)}${popH}</div>
    ${port}
    <div class="hbmid">${res}<div class="hbicons">${group("Ataques", G.atk)}${group("Conjuros", G.spell)}${group("Rasgos", G.feat)}${group("Acciones", G.act)}</div></div>
    <div class="hbend">${mine ? (dead ? `<button class="btn gold" data-hbdeath>💀 Salvación contra muerte</button>` : "") + `<button class="btn gold hbendb" data-hbend>Terminar turno ▶</button>` : `<p class="hbmsg">Turno de<br><b>${esc(String(curName).split(" ")[0])}</b></p>`}</div>
    <div class="hbtip" hidden></div></div>`;
}

/** Monta la barra dentro de la mesa táctica (solo jugadores). */
export function mountHotbar(tac) {
  const box = document.createElement("div"); box.className = "hbbox"; tac.appendChild(box);
  let G = null;
  const render = () => {
    if (!box.isConnected) { off(); offA(); removeEventListener("resize", render); return; }
    const s = store.get(), on = barOn(s);
    tac.classList.toggle("withbar", on);
    if (!on) { if (sig) { box.innerHTML = ""; sig = ""; } return; }
    const ae = document.activeElement; if (ae && box.contains(ae) && ae.tagName === "SELECT") return;
    const tok = myTok(s), c = charOf(s, tok);
    if (c.portrait && imgUrl[c.portrait] === undefined) { imgUrl[c.portrait] = null; getImage(c.portrait).then(u => { imgUrl[c.portrait] = u || null; sig = ""; render(); }); }
    if (pop && pop.spell && !armedNow()) pop = null; // se canceló en la mesa (Esc, clic derecho) o ya se lanzó
    const h = html(s);
    if (h === sig) return;
    sig = h; box.innerHTML = h;
    G = (() => { const x = entries(s, c, tok); return [...x.atk, ...x.spell, ...x.feat, ...x.act]; })();
    tac.style.setProperty("--hb-h", (box.offsetHeight || 140) + "px");
    bind(s, tok, c);
  };
  const tipEl = () => $(".hbtip", box);
  function bind(s, tok, c) {
    $$("[data-hb]", box).forEach(b => {
      const x = G[+b.dataset.hb]; if (!x) return;
      b.onclick = () => { if (x.why) { toast(x.why); return; } x.run(); sig = ""; render(); };
      b.onmouseenter = () => { const t = tipEl(); t.innerHTML = tipHTML(x); t.hidden = false; const r = b.getBoundingClientRect(), R0 = box.getBoundingClientRect();
        t.style.left = Math.max(4, Math.min(R0.width - 300, r.left - R0.left + r.width / 2 - 150)) + "px"; box.querySelector(".hotbar").dataset.hl = b.dataset.cost; };
      b.onmouseleave = () => { tipEl().hidden = true; const hb = box.querySelector(".hotbar"); if (hb) delete hb.dataset.hl; };
    });
    const on = (sel, fn) => $$(sel, box).forEach(b => b.onclick = () => { fn(b); sig = ""; render(); });
    on("[data-hbend]", () => { arm(null); pop = null; endTurn(); });
    on("[data-hbinit]", () => rollInit(tok.id));
    on("[data-hbdeath]", () => deathSave(tok.id));
    on("[data-hbx]", () => { pop = null; arm(null); });
    on("[data-hbcast]", () => doCast(tok.id, c.id));
    on("[data-hbunpick]", b => togglePick(b.dataset.hbunpick));
    on("[data-hbarea]", () => { const st = store.get(), d = findSpell(pop.spell), m = spellMech(d), center = st.tokens.find(t => t.id === [...picked][0]);
      if (!center && !/cono|línea|emanación/.test(m.area.shape)) return toast("Marca primero la criatura del centro del área.");
      inArea(st, m, tok, center).forEach(id => picked.add(id)); });
    on("[data-hbbard]", b => { pop = null; inspire(tok.id, b.dataset.hbbard); });
    on("[data-hboa]", b => answerOA(b.dataset.hboa, true)); on("[data-hboano]", b => answerOA(b.dataset.hboano, false));
    on("[data-hbrx]", b => answerRx(b.dataset.hbrx, true)); on("[data-hbrxno]", b => answerRx(b.dataset.hbrxno, false));
    $$("[data-hbslot]", box).forEach(x => x.onchange = () => { slotPick[x.dataset.hbslot] = +x.value; });
  }
  const off = store.subscribe(() => render());
  const offA = onAim(() => { sig = ""; render(); });
  addEventListener("resize", render);
  // Los avisos de reacción caducan solos (45 s): se repinta de vez en cuando
  const iv = setInterval(() => { if (!box.isConnected) return clearInterval(iv); render(); }, 4000);
  render();
}
