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
import { charOf, hpOf } from "../core/mesa.js";
import { findSpell } from "../core/srd.js";
import { ESTADOS } from "../data/estados.js";
import { spellMech, freeSlots, cast, inArea } from "../core/hechizos.js";
import { spellDC, deathSave } from "../core/salud.js";
import { attacksOf } from "../core/combate.js";
import { phase, eco, moveBudget, spend, endTurn, rollInit, ACCIONES, attacksPerAction } from "../core/turnos.js";
import { arm, armedNow, picked, togglePick, onAim } from "../core/apuntar.js";
import { requestOpen } from "../core/comercio.js";
import { presentationFor } from "../core/sesiones.js";
import { PROPS } from "../data/mapas.js";
import { kitOf, multiOf, multiN, spellsOf, usesLeft, gate } from "../core/criaturas.js";
import { kitArmed, bindKit, legLeft, legMax } from "./accionesnpc.js";
import { dist } from "../core/turnos.js";
import { hide, search, hideCheck, shoveDC, climbables, climbOn, climbDown, pushables, pushObject } from "../core/acciones.js";
import { topOfTok } from "../core/alturas.js";
import { rageInfo, rage, extendRage, bardicInfo, inspirable, inspire } from "../core/rasgos.js";
import { rxOpen, answerRx, RX, PREFS, reactionsOf, prefOf, setPref, npcOAPref, setNpcOAPref, OA_X } from "../core/reacciones.js";
import { dmOnline, awaitsDM, alliesHit } from "../core/avisos.js";
import { oaOpen, answerOA } from "../core/combate.js";
import { durText, durTag } from "../core/duraciones.js";
import { getImage } from "../core/images.js";
import { siluetaFor, siluetaURL } from "../data/siluetas.js";
import { glyph, TINT, weaponGlyph, spellGlyph, ACTION, MISC, TABS, COND, DAMAGE } from "../data/iconos.js";
import { $, $$, esc, toast } from "../core/ui.js";

const NOACT = ["incapacitado", "inconsciente", "aturdido", "paralizado", "petrificado", "muerto"];
const NOMOVE = ["agarrado", "apresado"];
const fm = n => (Math.round(n * 10) / 10).toLocaleString("es-ES");
const sign = n => (n >= 0 ? "+" : "") + n;
const wide = () => !window.matchMedia || window.matchMedia("(min-width: 901px)").matches;
const myTok = s => { const u = currentUser(s); return u && (s.tokens || []).find(t => t.kind === "pc" && t.owner === u.id); };
const tactical = s => { const p = presentationFor(s); return !!s.board && !!p && p.type === "tactical"; };
/** ¿Se juega con la barra? Como en BG3, siempre que tu personaje esté en la mesa táctica (en combate y fuera),
 *  en pantallas anchas. El máster la tiene para la criatura que lleva. */
export const barOn = s => tactical(s) && wide() && (isDM(s) || !!myTok(s));

let pop = null, slotPick = {}, imgUrl = {};

/* ---------- Iconos: grabados de game-icons.net teñidos (los mismos que los símbolos del mapa) ---------- */
const weaponIcon = w => weaponGlyph(w);
const spellIcon = (d, m) => spellGlyph(d, m);
const ACT_ICON = ACTION;
// Como en BG3: en la barra solo las acciones de combate de verdad (Estudiar, Influir… se hacen como pruebas desde la ficha)
const COMMON = ["Correr", "Destrabarse", "Esquivar", "Esconderse", "Ayudar", "Buscar"];
const CATS = [["all", "Todo"], ["arm", "Armas"], ["spell", "Hechizos"], ["hab", "Habilidades"], ["com", "Comunes"]].map(([k, n]) => [k, n, glyph([TABS[k], "oro"], "tabg")]);
let hbTab = "all";
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
  const notTurn = live && !mine ? "No es tu turno" : "";
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
  [["push", MISC.push, "Empujón: apartar", "Lo apartas 1,5 m"], ["prone", MISC.prone, "Empujón: derribar", "Lo derribas"]].forEach(([mode, ico, name, t]) => G.atk.push({ id: "sh" + mode, ico, name, cost: "act", why: whyAtkAct,
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
    G.feat.push(on ? { id: "ragex", ico: MISC.rage, sub: "+", name: "Prolongar furia", cost: "bonus", why: whyBonus, tip: [`En furia: ${durText(s, on)}.`, "Atacar a un enemigo en tu turno ya la prolonga; si no, gasta la acción adicional."], run: () => extendRage(tok.id, true) }
      : { id: "rage", ico: MISC.rage, name: "Furia", cost: "bonus", why: whyBonus || (!R.left ? "Sin usos: se recuperan al descansar" : ""), uses: `${R.left}/${R.max}`, tip: [`Resistencia a contundente, cortante y perforante · +${R.dmg} al daño con Fuerza · ventaja en Fuerza.`, "No puedes lanzar conjuros. Dura hasta el final de tu siguiente turno."], run: () => rage(tok.id) }); }
  if (B) G.feat.push({ id: "bard", ico: MISC.bard, name: "Inspiración bárdica", cost: "bonus", why: whyBonus || (!B.left ? "Sin usos" : ""), uses: `${B.left}/${B.max}`, on: pop && pop.bard,
    tip: [`Das un ${B.die} a un aliado a 18 m: lo suma a una prueba con d20 que falle.`], run: () => { pop = pop && pop.bard ? null : { bard: true }; } });
  if (F.some(f => /Acci[oó]n astuta/i.test(f.name))) ["Correr", "Destrabarse", "Esconderse"].forEach(n => G.feat.push({ id: "cun" + n, ico: ACT_ICON[n], sub: "▲", name: `Acción astuta: ${n}`, cost: "bonus",
    why: whyBonus || (n === "Esconderse" ? (hideCheck(s, tok).ok ? "" : hideCheck(s, tok).why) : ""), tip: [(ACCIONES.find(a => a[0] === n) || [, ""])[1]], run: () => cunning(tok.id, n) }));
  F.filter(f => { const t = (f.name + " " + (f.text || "")).toLowerCase(); return /acci[oó]n adicional/.test(t) && !/Acci[oó]n astuta|^Furia$|^Inspiraci[oó]n b[aá]rdica/i.test(f.name); })
    .forEach((f, i) => G.feat.push({ id: "f" + i, ico: MISC.feat, name: f.name, cost: "bonus", why: whyBonus, tip: [String(f.text || "").slice(0, 220)], run: () => { spend(tok.id, "bonus"); toast(`${f.name}: acción adicional gastada. El máster aplica el efecto.`); } }));
  // Acciones del manual
  ACCIONES.filter(([n]) => COMMON.includes(n)).forEach(([n, t]) => { const hw = n === "Esconderse" ? hideCheck(s, tok) : null;
    G.act.push({ id: "a:" + n, ico: ACT_ICON[n] || MISC.feat, name: n, cost: "act", why: whyAct || (hw && !hw.ok ? hw.why : ""), tip: [t], run: () => basic(tok.id, n) }); });
  if (ids.includes("ardiendo")) G.act.push({ id: "douse", ico: MISC.douse, name: "Apagarse", cost: "act", why: whyAct, tip: ["SRD «Fuego»: con una acción apagas el fuego rodando por el suelo y quedas derribado."], run: () => import("../core/peligros.js").then(m => m.douse(tok.id)) });
  const moveWhy = incap || notTurn;
  // Cofres, bolsas y reliquias a tu lado: abrir o coger (lo resuelve el máster)
  const asked = new Set((s.rolls || []).filter(r => r.kind === "open" && r.status === "pending").map(r => r.prop));
  (s.board.props || []).filter(p => ((PROPS[p.k] || {}).loot || p.loot != null || p.chest) && !p.opened && !p.hidden && dist(p, tok) <= 1).forEach(p => { const v = PROPS[p.k] || {}, nm = p.label || v.n || "Cofre";
    G.act.push({ id: "op" + p.id, ico: MISC.chest, name: `${v.open ? "Abrir" : "Coger"} ${nm}`, cost: "free", why: asked.has(p.id) ? "Esperando al máster…" : "", tip: ["Interacción con un objeto: el máster te dice lo que hay."], run: () => { requestOpen(p.id, tok.id); toast("Se lo pides al máster: lo verá al momento"); } }); });
  climbables(s, tok).forEach(x => G.act.push({ id: "cl" + x.id, ico: MISC.climb, name: `Subirte a ${x.name}`, cost: "move", why: moveWhy, tip: [`Cuesta ${fm(x.cost)} m de movimiento. Alturas de objetos: regla de campaña.`], run: () => climbOn(tok.id, x.id) }));
  if (topOfTok(s.board, tok)) G.act.push({ id: "down", ico: MISC.down, name: "Bajar", cost: "move", why: moveWhy, tip: ["Bajar del objeto."], run: () => climbDown(tok.id) });
  pushables(s, tok).forEach(x => G.act.push({ id: "po" + x.id, ico: MISC.pushobj, name: `Empujar ${x.name}`, cost: "act", why: whyAct || (!x.free ? "No hay sitio detrás" : ""), tip: [`Fuerza (Atletismo) CD ${x.dc} (regla de campaña): lo mueves 1,5 m.`], run: () => pushObject(tok.id, x.id) }));
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
  // Solo se pide confirmación si es arriesgado: algo dañino que alcanza a aliados (o a ti)
  const al = alliesHit(s, tokId, targets, m);
  if (al.length && pop.okAllies !== targets.slice().sort().join()) { pop.warn = { names: al, key: targets.slice().sort().join() }; return; }
  const free = m.lvl ? freeSlots(c, m.lvl) : [0], slot = m.lvl ? (free.includes(slotPick[d.n]) ? slotPick[d.n] : free[0]) : 0;
  const r = cast(tokId, d.n, slot, targets);
  if (r !== null) { pop = null; arm(null); }
}

/* ---------- Criatura del máster: mismas ideas, con su perfil del SRD ---------- */
const KGROUPS = [["act", "Acciones"], ["bonus", "Adicional"], ["react", "Reacciones"], ["leg", "Legendarias"]];
const useOf = g => g === "bonus" ? "bonus" : g === "react" ? "react" : g === "leg" ? "leg" : "act";
function kitIcon(a) {
  if (a.type === "save") { const dt = (((a.dmg || [])[0] || {}).t || "").toLowerCase(); return DAMAGE[dt] ? [DAMAGE[dt], dt] : MISC.save; }
  if (a.type === "cast1") return ["sparkles", "magia"]; if (a.type === "atk") return MISC.multi;
  return /cura|regenera/i.test(a.n) ? ["healing", "cura"] : /mueve|salta|vuela|teletransporta/i.test(a.txt || "") ? MISC.move : MISC.feat;
}
function npcEntries(s, t) {
  const live = phase(s) === "live", turn = live && s.board.turn === t.id, e = live ? eco(s, t) : {}, A = armedNow(), kit = kitOf(t);
  const ids = (t.conds || []).map(x => x.id), incapId = ids.find(x => NOACT.includes(x));
  const incap = incapId ? `Está ${(ESTADOS.find(y => y.id === incapId) || { n: incapId }).n.toLowerCase()}` : "";
  const notTurn = live && !turn ? "No es su turno" : "";
  const out = [];
  // Ataques (los del perfil del SRD o los de su ficha)
  const atkWhy = incap || notTurn || (live ? (kit ? gate(s, t, "act", { attack: true }) : e.act ? "Ya ha usado su acción" : "") || "" : "");
  const W = attacksOf(s, t).map((w, i) => ({ id: "w" + i, ico: weaponIcon(w), name: w.name, cost: "act", why: atkWhy, on: A && A.kind === "atk" && A.tok === t.id && A.i === i,
    tip: [`${sign(w.atk)} al ataque · ${w.expr} ${w.type || ""}`, w.rng.ranged ? `Alcance ${w.rng.n}/${w.rng.l} m` : `Alcance ${w.rng.l} m`, ...(kit && multiOf(kit) ? [`Ataque múltiple: ${multiN(kit)} ataques por acción`] : [])],
    run: () => { const A2 = armedNow(); arm(A2 && A2.kind === "atk" && A2.tok === t.id && A2.i === i ? null : { kind: "atk", tok: t.id, i }); } }));
  out.push(["Ataques", W]);
  if (kit) {
    const armedHere = A && A.kind === "npcact" && A.tok === t.id, sp = spellsOf(kit);
    const tm = x => { const d = x.srd && findSpell(x.n), m = d && spellMech(d); return m && m.time === "bonus" ? "bonus" : m && m.time === "react" ? "react" : "act"; };
    for (const [g, gn] of KGROUPS) {
      const L = [];
      (kit[g] || []).forEach((a, i) => { if (a.type === "multi" || a.type === "spells" || (g === "act" && a.type === "atk")) return;
        const u = usesLeft(t, a), gw = live ? gate(s, t, useOf(g), { attack: a.type === "atk" }) : null;
        const why = incap || (g === "act" || g === "bonus" ? notTurn : "") || gw || (!u.ok ? `Sin usos (${u.txt})` : "");
        L.push({ id: `k${g}${i}`, ico: kitIcon(a), name: a.n, cost: g === "leg" ? "leg" : useOf(g), why, uses: u.txt || "", on: armedHere && !A.sp && A.g === g && A.i === i,
          attrs: why ? "" : `data-ka="${t.id}|${g}|${i}"`, tip: [a.type === "save" ? `Salvación de ${String(a.sv || "").toUpperCase()} CD ${a.dc}` : "", String(a.txt || "").slice(0, 260)] }); });
      if (sp && g !== "leg") (sp.lists || []).forEach(Lx => Lx.sp.filter(x => tm(x) === g).forEach(x => {
        const d = x.srd && findSpell(x.n), m = d && spellMech(d), u = usesLeft(t, sp, x.n, Lx.u), gw = live ? gate(s, t, g) : null;
        const why = incap || (g === "act" || g === "bonus" ? notTurn : "") || gw || (!d ? "No está en el compendio: tíralo a mano" : "") || (!u.ok ? "Sin usos hoy" : "");
        L.push({ id: `ks${x.n}`, ico: d && m ? spellIcon(d, m) : ["sparkles", "magia"], lvl: x.lv || (d && d.lvl) || 0, name: x.n, cost: g, why, uses: Lx.u !== "will" ? `${u.left}/${Lx.u}` : "", on: armedHere && A.sp === x.n,
          attrs: why ? "" : `data-ksp="${t.id}|${esc(x.n)}|${Lx.u}|${x.lv || ""}"`, tip: [d ? `${d.lvl ? `Nivel ${d.lvl}` : "Truco"} · ${d.al || "—"}${sp.dc ? ` · CD ${sp.dc}` : ""}` : "", Lx.u === "will" ? "A voluntad" : `${Lx.u}/día`] }); }));
      if (L.length) out.push([gn, L]);
    }
  }
  const whyAct = incap || notTurn || (live && e.act ? "Ya ha usado su acción" : "");
  out.push(["Comunes", ACCIONES.filter(([n]) => COMMON.includes(n)).map(([n, d]) => { const hw = n === "Esconderse" ? hideCheck(s, t) : null;
    return { id: "a:" + n, ico: ACT_ICON[n] || MISC.feat, name: n, cost: "act", why: whyAct || (hw && !hw.ok ? hw.why : ""), tip: [d], run: () => basic(t.id, n) }; })]);
  return out;
}

/* ---------- Dibujo ---------- */
function slotsHTML(c) {
  const sl = Object.entries((c.spells || {}).slots || {}).filter(([, v]) => v.max > 0); if (!sl.length) return "";
  return `<span class="hbslots" title="Espacios de conjuro (CD ${spellDC(c)})">${sl.map(([l, v]) => `<span><small>${["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][+l] || l}</small>${Array.from({ length: v.max }, (_, i) => `<i class="${i < v.max - v.used ? "on" : ""}"></i>`).join("")}</span>`).join("")}</span>`;
}
const COSTK = k => (COST[k] || (k === "leg" ? { t: "Acción legendaria", k: "leg" } : COST.act));
function iconHTML(x, k) {
  const cost = COSTK(x.cost);
  return `<button class="hbi c-${cost.k} ${x.why ? "off" : ""} ${x.on ? "on" : ""}" data-hb="${k}" ${x.attrs || ""} data-cost="${cost.k}" ${Array.isArray(x.ico) ? `style="--tint:${TINT[x.ico[1]] || x.ico[1]}"` : ""} aria-label="${esc(x.name)}${x.why ? ": " + esc(x.why) : ""}">
    ${Array.isArray(x.ico) ? glyph(x.ico, "hbg") : `<span class="hbg">${x.ico}</span>`}${x.lvl ? `<em class="hblv">${x.lvl}</em>` : ""}${x.sub ? `<em class="hbsub">${esc(x.sub)}</em>` : ""}${x.uses ? `<em class="hbuse">${esc(x.uses)}</em>` : ""}<i class="hbcost"></i></button>`;
}
function tipHTML(x) {
  const cost = COSTK(x.cost);
  return `<b>${esc(x.name)}</b><span class="hbtc c-${cost.k}"><i></i>${cost.t}</span>${(x.tip || []).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join("")}${x.why ? `<p class="hbwhy">⛔ ${esc(x.why)}</p>` : ""}`;
}
function castPanel(s, c, tok) {
  const d = findSpell(pop.spell), m = spellMech(d); if (!d || !m) return "";
  if (pop.warn) { const L = pop.warn.names, txt = L.map(n => n === "ti" ? "a ti" : n); return `<div class="hbask warn"><span>⚠ <b>${esc(d.n)}</b> alcanza ${L.length > 1 || L[0] !== "ti" ? "a tus aliados" : ""}: <b>${esc(txt.join(", ").replace(/, ([^,]*)$/, " y $1"))}</b>. ¿Lo lanzas igualmente?</span><button class="btn small gold" data-hbwarnok>⚠ Lanzar igualmente</button><button class="btn small" data-hbwarnno>Cambiar objetivos</button></div>`; }
  const free = m.lvl ? freeSlots(c, m.lvl) : [0];
  if (slotPick[d.n] == null || !free.includes(slotPick[d.n])) slotPick[d.n] = free[0];
  const nm = t => t.kind === "pc" ? (s.characters.find(x => x.id === t.char) || t).name : t.name;
  return `<div class="hbpop"><b>${esc(d.n)}</b>
    ${m.lvl ? `<label>Espacio <select data-hbslot="${esc(d.n)}">${free.map(l => `<option value="${l}" ${slotPick[d.n] === l ? "selected" : ""}>Nivel ${l}${l > m.lvl && m.up ? ` (+${m.up})` : ""}</option>`).join("")}</select></label>` : ""}
    ${m.self ? `<span class="hbhint">Sobre ti</span>` : `<span class="hbhint">${m.area ? "Coloca el área en la mesa" : m.atk ? "Toca al objetivo" : "Toca los objetivos"}</span>
      <span class="hbpicks">${[...picked].map(id => { const t = s.tokens.find(x => x.id === id); return t ? `<button class="cchip" style="--c:#d6aa4e" data-hbunpick="${id}">${esc(String(nm(t)).split(" ")[0])} ✕</button>` : ""; }).join("")}</span>
      ${m.area ? `<button class="btn small" data-hbarea title="Marca a todas las criaturas dentro del área">◎ Área</button>` : ""}`}
    <button class="btn gold small" data-hbcast>Lanzar</button><button class="ib" data-hbx aria-label="Cancelar">✕</button></div>`;
}
function bardPanel(s, tok) {
  const L = inspirable(s, tok);
  return `<div class="hbpop"><b>🎵 Inspiración bárdica</b><span class="hbhint">¿A quién?</span>${L.map(x => `<button class="btn small gold" data-hbbard="${x.id}">${esc(String(x.name || "").split(" ")[0])}</button>`).join("") || `<span class="hbhint">No hay aliados a 18 m sin dado.</span>`}<button class="ib" data-hbx aria-label="Cancelar">✕</button></div>`;
}
/** Avisos de reacción para esta figura (oportunidad, Escudo…): encima de la barra, como en BG3. */
function promptHTML(s, tok) {
  const oa = (s.rolls || []).find(r => r.tok === tok.id && oaOpen(s, r));
  if (oa) { const t = s.tokens.find(x => x.id === oa.target); return `<div class="hbask"><span>⚔ <b>¡Oportunidad!</b> ${esc(t ? (t.hidden && !isDM(s) ? "Alguien" : String(t.name).split(" ")[0]) : "Un enemigo")} sale del alcance.</span><button class="btn small gold" data-hboa="${oa.id}">⚔ Atacar</button><button class="btn small" data-hboano="${oa.id}">Dejar pasar</button></div>`; }
  const rx = (s.rolls || []).find(r => r.tok === tok.id && rxOpen(s, r));
  if (rx) { const X = RX[rx.rx]; return `<div class="hbask"><span>${X.i} <b>¡Reacción!</b> ${esc(X.q)}</span><button class="btn small gold" data-hbrx="${rx.id}">${X.i} ${esc(X.n)}</button><button class="btn small" data-hbrxno="${rx.id}">No</button></div>`; }
  return "";
}
/** Panel de reacciones (como el de BG3): Preguntar / Siempre / Nunca para cada una. */
function rxCfgHTML(s, c) {
  const seg = (k, v, set) => `<span class="hbseg">${PREFS.map(([p, n]) => `<button class="${v === p ? "on" : ""}" data-hbpref="${k}|${p}" ${set}>${n}</button>`).join("")}</span>`;
  const rows = c ? reactionsOf(c).map(([k, X]) => `<div class="hbcfgrow"><span title="${esc(X.q)}">${X.i} ${esc(X.n)}</span>${seg(k, prefOf(c, k), "")}</div>`).join("")
    : `<div class="hbcfgrow"><span title="Todas las criaturas que llevas">${OA_X.i} PNJ · ataque de oportunidad</span>${seg("npcoa", npcOAPref(), "")}</div>`;
  return `<div class="hbpop hbcfg"><b>↺ Reacciones</b><small class="hbhint">«Siempre» las usa sola en cuanto se puede; «Nunca» ni pregunta.</small>${rows}<button class="ib" data-hbx aria-label="Cerrar">✕</button></div>`;
}
/** Si el máster no está conectado, lo que afecta a otros (daño, efectos) espera a que vuelva: se dice. */
function offlineHTML(s, tok) {
  if (isDM(s) || dmOnline(s)) return "";
  const n = (s.rolls || []).filter(r => (r.tok === tok.id || r.by === tok.id) && awaitsDM(s, r)).length;
  return `<div class="hbask off"><span>📡 <b>El máster no está conectado.</b> Tus tiradas se hacen, pero el daño y los efectos sobre otros se aplicarán cuando vuelva${n ? ` (${n} pendiente${n > 1 ? "s" : ""})` : ""}.</span></div>`;
}
function portHTML(s, tok, name, hp, color, portrait) {
  const pct = hp ? Math.max(0, Math.min(100, hp.cur / Math.max(1, hp.max) * 100)) : 0;
  const conds = (tok.conds || []).map(x => ({ x, e: ESTADOS.find(y => y.id === x.id) })).filter(o => o.e);
  // Retrato grande junto a los iconos, como en BG3. Sin imagen: la silueta de su clase o criatura (las mismas que las peanas)
  const ch = tok.kind === "pc" ? charOf(s, tok) : null, sil = tok.icon || (ch ? siluetaFor(`${ch.cls} ${ch.species}`) : siluetaFor(name));
  return `<div class="hbport"><div class="hbface ${imgUrl[portrait] ? "img" : ""}" style="--c:${esc(color || "#888")};${imgUrl[portrait] ? `background-image:url('${imgUrl[portrait]}')` : ""}">${imgUrl[portrait] ? "" : `<i class="hbsil" style="-webkit-mask-image:url(${siluetaURL(sil)});mask-image:url(${siluetaURL(sil)})"></i>`}${hp ? `<div class="hbhp ${pct < 34 ? "low" : ""}"><i style="width:${pct}%"></i><span>${hp.cur}/${hp.max}${hp.temp ? ` +${hp.temp}` : ""}</span></div>` : ""}</div>
    <div class="hbwho"><b>${esc(String(name).split(" ")[0])}</b>
      <div class="hbconds">${conds.map(({ x, e: E }) => `<span class="hbcond" style="--c:${E.c}" title="${esc(E.n)}: ${esc(E.t)}${x.dur ? " · " + esc(durText(s, x)) : ""}">${COND[x.id] ? glyph([COND[x.id], "#fff"], "cg") : E.i || ""} ${esc(E.n.split(" ")[0])}${x.dur ? `<sub>${durTag(s, x).replace("⏳", "")}</sub>` : ""}</span>`).join("")}</div></div></div>`;
}
function resHTML(s, tok, mine, extra = "") {
  const live = phase(s) === "live", e = eco(s, tok), max = moveBudget(s, tok), left = Math.max(0, max - (mine ? e.mov : 0)), stuck = (tok.conds || []).some(x => NOMOVE.includes(x.id));
  if (!live) return extra ? `<div class="hbres">${extra}</div>` : "";
  return `<div class="hbres">
    <span class="hbr r-act ${e.act && !(e.atkLeft > 0) || !mine ? "used" : ""}" title="Acción"><i></i>${e.act && e.atkLeft > 0 ? ` <small>×${e.atkLeft}</small>` : ""}</span>
    <span class="hbr r-bonus ${e.bonus || !mine ? "used" : ""}" title="Acción adicional"><i></i></span>
    <span class="hbr r-move ${!mine || stuck || !left ? "used" : ""}" title="Movimiento: arrastra la figura"><span class="hbmv"><i style="width:${stuck ? 0 : Math.min(100, left / Math.max(1, max) * 100)}%"></i></span>${stuck ? "0" : fm(left)}/${fm(max)} m${e.dash ? " · corre" : ""}</span>
    <button class="hbr r-react ${e.react ? "used" : ""}" data-hbrxcfg title="Reacción: vuelve al empezar su turno. Pulsa para elegir cuáles usar siempre, nunca o preguntando."><i></i></button>${extra}</div>`;
}
function endHTML(s, tok, who) {
  const live = phase(s) === "live", mine = live && s.board.turn === tok.id;
  if (!live) return `<button class="ib hbrxb" data-hbrxcfg title="Reacciones: preguntar, siempre o nunca">↺</button>`;
  if (mine) return `<button class="btn gold hbendb" data-hbend title="Terminar turno">Terminar<br>turno ▶</button>`;
  const cur = s.tokens.find(t => t.id === s.board.turn), cn = cur ? (cur.kind === "pc" ? (s.characters.find(x => x.id === cur.char) || cur).name : cur.hidden && !isDM(s) ? "?" : cur.name) : "—";
  return `<p class="hbmsg">Turno de<br><b>${esc(String(cn).split(" ")[0])}</b></p>`;
}
function frame(cls, top, port, res, items, end) {
  // items: [{ ...icono, cat: "arm" | "spell" | "hab" | "com" }]. Pestañas como las de BG3 a la izquierda de los iconos.
  let k = 0; const all = [];
  const has = c => items.some(x => x.cat === c);
  if (hbTab !== "all" && !has(hbTab)) hbTab = "all";
  const cats = CATS.filter(([c]) => c === "all" || has(c));
  const shown = hbTab === "all" ? cats.filter(([c]) => c !== "all").map(([c, n]) => [n, items.filter(x => x.cat === c)]) : [[CATS.find(x => x[0] === hbTab)[1], items.filter(x => x.cat === hbTab)]];
  const body = shown.filter(([, L]) => L.length).map(([t, L]) => `<div class="hbrow ${L.length <= 2 ? "one" : ""}" title="${esc(t)}">${L.map(x => { all.push(x); return iconHTML(x, k++); }).join("")}</div>`).join("");
  const tabs = `<div class="hbtabs" role="tablist">${cats.map(([c, n, i]) => `<button role="tab" data-hbtab="${c}" aria-selected="${hbTab === c}" title="${n}">${i}</button>`).join("")}</div>`;
  return { html: `<div class="hotbar ${cls}"><div class="hbtop">${top}</div>${port}<div class="hbmid">${res}<div class="hbicons">${tabs}${body}</div></div><div class="hbend">${end}</div><div class="hbtip" hidden></div></div>`, all };
}

/** Lo que pinta la barra ahora: { html, all (iconos), tok, c } */
export function build(s, o) {
  if (!isDM(s)) {
    const tok = myTok(s), c = tok && charOf(s, tok); if (!c) return null;
    const ph = phase(s), live = ph === "live", mine = live && s.board.turn === tok.id;
    if (c.portrait && imgUrl[c.portrait] === undefined) loadImg(c.portrait);
    const port = portHTML(s, tok, c.name, c.hp, c.color, c.portrait);
    if (ph === "init") return { tok, c, all: [], html: `<div class="hotbar init">${port}<div class="hbmid"><p class="hbmsg">⚔️ ¡Combate! ${tok.init == null || tok.init === "" ? "Tira tu iniciativa." : `Tu iniciativa: <b>${tok.init}</b>. Esperad al máster.`}</p></div><div class="hbend">${tok.init == null || tok.init === "" ? `<button class="btn gold" data-hbinit>🎲 Iniciativa</button>` : ""}</div></div>` };
    const G = entries(s, c, tok), R = rageInfo(c), B = bardicInfo(c);
    const extra = `${slotsHTML(c)}${R ? `<span class="hbr r-cls" title="Usos de Furia">${glyph(MISC.rage, "rg")} ${R.left}/${R.max}</span>` : ""}${B ? `<span class="hbr r-cls" title="Usos de Inspiración bárdica (${B.die})">${glyph(MISC.bard, "rg")} ${B.left}/${B.max}</span>` : ""}${e0(s, tok).slotCast && mine ? `<span class="hbnote">Solo trucos este turno</span>` : ""}`;
    const dead = c.hp.cur <= 0 && !(c.death && (c.death.stable || c.death.dead));
    const top = offlineHTML(s, tok) + promptHTML(s, tok) + (pop && pop.spell ? castPanel(s, c, tok) : pop && pop.bard ? bardPanel(s, tok) : pop && pop.rxcfg ? rxCfgHTML(s, c) : "");
    const end = (mine && dead ? `<button class="btn gold" data-hbdeath>💀 Salvación</button>` : "") + endHTML(s, tok);
    const f = frame(mine ? "mine" : live ? "wait" : "explore", top, port, resHTML(s, tok, mine, extra), [...G.atk.map(x => ({ ...x, cat: /^sh/.test(x.id) || /Objeto lanzado/.test(x.name) ? "com" : "arm" })), ...G.spell.map(x => ({ ...x, cat: "spell" })), ...G.feat.map(x => ({ ...x, cat: "hab" })), ...G.act.map(x => ({ ...x, cat: "com" }))], end);
    return { ...f, tok, c };
  }
  // Máster: la criatura que tiene el turno o la que ha elegido en la pestaña PNJ
  const live = phase(s) === "live", cur = live && s.tokens.find(t => t.id === s.board.turn);
  const pickId = cur && cur.kind !== "pc" ? cur.id : o.npc && o.npc();
  const t = pickId && s.tokens.find(x => x.id === pickId && x.kind !== "pc"); if (!t) return null;
  const mine = live && s.board.turn === t.id, A = armedNow(), hp = hpOf(s, t);
  if (t.portrait && imgUrl[t.portrait] === undefined) loadImg(t.portrait);
  const kit = kitOf(t), ll = legLeft(t), e = live ? eco(s, t) : {};
  const extra = `${kit && multiOf(kit) && live ? `<span class="hbr r-cls" title="Ataque múltiple">${glyph(MISC.multi, "rg")} ${Math.min(e.n || 0, multiN(kit))}/${multiN(kit)}</span>` : ""}${ll != null ? `<span class="hbr r-leg ${ll <= 0 ? "used" : ""}" title="Acciones legendarias esta ronda">${glyph(["crown", "oro"], "rg")} ${ll}/${legMax(t)}</span>` : ""}`;
  let top = promptHTML(s, t) + (pop && pop.rxcfg ? rxCfgHTML(s, null) : "");
  if (A && A.kind === "npcact" && A.tok === t.id) top += `<div class="hbpop hbkit">${kitArmed(s, t)}</div>`;
  if (A && A.kind === "atk" && A.tok === t.id) { const adv = o.getAdv ? o.getAdv() : null; top += `<div class="hbpop"><b>🎯 Toca al objetivo</b><button class="btn small ${adv === 1 ? "gold" : ""}" data-hbadv="1">Ventaja</button><button class="btn small ${adv === -1 ? "gold" : ""}" data-hbadv="-1">Desventaja</button><button class="ib" data-hbx aria-label="Cancelar">✕</button></div>`; }
  const port = portHTML(s, t, t.name, hp, t.kind === "npc" ? "#7d8fe0" : "#b33a2e", t.portrait) .replace('<div class="hbwho">', `<div class="hbwho">${t.hidden ? `<small class="hbhid" title="Oculto a los jugadores">🙈 oculto</small>` : ""}`);
  const f = frame(`dm ${mine ? "mine" : live ? "wait" : "explore"}`, top, port, resHTML(s, t, mine, extra), npcEntries(s, t).flatMap(([g, L]) => L.map(x => ({ ...x, cat: g === "Ataques" ? "arm" : g === "Comunes" ? "com" : /^ks/.test(x.id) ? "spell" : "hab" }))), endHTML(s, t));
  return { ...f, tok: t, c: null };
}
const e0 = (s, t) => eco(s, t);
const loadImg = key => { imgUrl[key] = null; getImage(key).then(u => { imgUrl[key] = u || null; }); };

/** Monta la barra dentro de la mesa táctica. o: { npc() → id elegido por el máster, getAdv(), setAdv(v), redraw() } */
export function mountHotbar(tac, o = {}) {
  const box = document.createElement("div"); box.className = "hbbox"; tac.appendChild(box);
  let all = [], sig = "", seen = false, born = Date.now(), flashSeq = null; // la firma es de ESTA barra: si la mesa se vuelve a montar, se pinta de nuevo
  const render = () => {
    // La mesa puede montarse antes de entrar en la página: solo se desmonta si ya estuvo y ha desaparecido
    if (!box.isConnected) { if (seen || Date.now() - born > 15000) { off(); offA(); removeEventListener("resize", render); clearInterval(iv); } return; }
    seen = true;
    const s = store.get(), on = barOn(s), B = on ? build(s, o) : null;
    tac.classList.toggle("withbar", !!B);
    if (!B) { if (sig) { box.innerHTML = ""; sig = ""; } return; }
    const ae = document.activeElement; if (ae && box.contains(ae) && ae.tagName === "SELECT") return;
    if (pop && pop.spell && !armedNow()) { pop = null; return render(); } // se canceló en la mesa (Esc, clic derecho) o ya se lanzó
    if (B.html === sig) return;
    sig = B.html; box.innerHTML = B.html; all = B.all;
    // Empieza tu turno: la barra se ilumina una vez (y suena en la mesa)
    { const hb = box.querySelector(".hotbar.mine"); if (hb && s.board && s.board.seq !== flashSeq) { flashSeq = s.board.seq; hb.classList.add("flash"); } }
    tac.style.setProperty("--hb-h", (box.offsetHeight || 110) + "px");
    bind(B.tok, B.c);
  };
  const redraw = () => { sig = ""; render(); if (o.redraw) o.redraw(); };
  const tipEl = () => $(".hbtip", box);
  function bind(tok, c) {
    $$("[data-hb]", box).forEach(b => {
      const x = all[+b.dataset.hb]; if (!x) return;
      if (!x.attrs) b.onclick = () => { if (x.why) { toast(x.why); return; } x.run(); redraw(); };
      b.onmouseenter = () => { const t = tipEl(); t.innerHTML = tipHTML(x); t.hidden = false; const r = b.getBoundingClientRect(), R0 = box.getBoundingClientRect();
        t.style.left = Math.max(4, Math.min(R0.width - 290, r.left - R0.left + r.width / 2 - 140)) + "px"; const hb = box.querySelector(".hotbar"); if (hb) hb.dataset.hl = b.dataset.cost; };
      b.onmouseleave = () => { tipEl().hidden = true; const hb = box.querySelector(".hotbar"); if (hb) delete hb.dataset.hl; };
    });
    bindKit(box, redraw, () => (o.getAdv ? o.getAdv() : null)); // acciones del perfil de la criatura (las mismas de la pestaña PNJ)
    const on = (sel, fn) => $$(sel, box).forEach(b => b.onclick = () => { fn(b); redraw(); });
    on("[data-hbtab]", b => { hbTab = b.dataset.hbtab; });
    on("[data-hbend]", () => { arm(null); pop = null; endTurn(); });
    on("[data-hbinit]", () => rollInit(tok.id));
    on("[data-hbdeath]", () => deathSave(tok.id));
    on("[data-hbx]", () => { if (pop && pop.rxcfg) { pop = null; return; } pop = null; arm(null); });
    on("[data-hbrxcfg]", () => { if (pop && pop.spell) arm(null); pop = pop && pop.rxcfg ? null : { rxcfg: true }; });
    on("[data-hbpref]", b => { const [k, v] = b.dataset.hbpref.split("|"); if (k === "npcoa") setNpcOAPref(v); else if (c) setPref(c.id, k, v); });
    on("[data-hbadv]", b => { const v = +b.dataset.hbadv; if (o.setAdv) o.setAdv(o.getAdv && o.getAdv() === v ? null : v); });
    if (c) {
      on("[data-hbcast]", () => doCast(tok.id, c.id));
      on("[data-hbwarnok]", () => { if (!pop || !pop.warn) return; pop.okAllies = pop.warn.key; pop.warn = null; doCast(tok.id, c.id); });
      on("[data-hbwarnno]", () => { if (pop) pop.warn = null; });
      on("[data-hbarea]", () => { const st = store.get(), d = findSpell(pop.spell), m = spellMech(d), center = st.tokens.find(t => t.id === [...picked][0]);
        if (!center && !/cono|línea|emanación/.test(m.area.shape)) return toast("Marca primero la criatura del centro del área.");
        inArea(st, m, tok, center).forEach(id => picked.add(id)); });
      on("[data-hbbard]", b => { pop = null; inspire(tok.id, b.dataset.hbbard); });
    }
    on("[data-hbunpick]", b => togglePick(b.dataset.hbunpick));
    on("[data-hboa]", b => answerOA(b.dataset.hboa, true)); on("[data-hboano]", b => answerOA(b.dataset.hboano, false));
    on("[data-hbrx]", b => answerRx(b.dataset.hbrx, true)); on("[data-hbrxno]", b => answerRx(b.dataset.hbrxno, false));
    $$("[data-hbslot]", box).forEach(x => x.onchange = () => { slotPick[x.dataset.hbslot] = +x.value; });
  }
  const off = store.subscribe(() => render());
  const offA = onAim(() => { sig = ""; render(); });
  addEventListener("resize", render);
  // Los avisos caducan solos y la imagen del retrato llega tarde: se repinta de vez en cuando
  const iv = setInterval(render, 800);
  return { render: () => { sig = ""; render(); } };
}
