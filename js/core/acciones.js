// Acciones de mesa del SRD 5.2.1 que no son atacar ni lanzar conjuros:
//  - Esconderse [acción]: Destreza (Sigilo) CD 15, con cobertura de tres cuartos o total, o en zona muy oscura,
//    y fuera de la línea de visión de todo enemigo. Si sale, invisible mientras sigas oculto; tu resultado es la CD
//    para encontrarte. Dejas de estar oculto al atacar, lanzar un conjuro o si te encuentran.
//  - Buscar [acción]: Sabiduría (Percepción) para encontrar a quien está oculto.
//  - Empujón (dentro de la acción de Atacar, como ataque sin armas): el objetivo, como mucho una categoría de tamaño
//    mayor, supera una salvación de Fuerza o Destreza (la que prefiera) CD 8 + tu Fuerza + competencia o lo apartas
//    1,5 m o lo derribas.
//  - Subirse a un objeto (trepar, SRD «Trepar»): cuesta 1 m de movimiento por metro de altura.
//  - Empujar un objeto (Fuerza (Atletismo); la CD según lo que pese es regla de campaña).
import { store, uid } from "./store.js";
import { isDM, runsTable } from "./session.js";
import { publish } from "./dados.js";
import { charOf } from "./mesa.js";
import { savePlan, abilitiesOf } from "./salud.js";
import { cover, dist, eco, spend, phase, hasCond, speedOf } from "./turnos.js";
import { lightMap, darkvisionOf } from "./vision.js";
import { sightLine } from "./vision.js";
import { PROPS, TERRAIN, isDoor } from "../data/mapas.js";
import { skillBonus, mod, prof } from "../data/dnd.js";
import { findMonster } from "./srd.js";
import { TOPS } from "./alturas.js";
import { moveBudget } from "./turnos.js";
import { toast } from "./ui.js";

const alive = (s, t) => t.kind === "pc" ? ((charOf(s, t) || {}).hp || {}).cur > 0 : !(t.hp != null && t.hp <= 0);
const incap = t => (t.conds || []).some(c => ["incapacitado", "inconsciente", "aturdido", "paralizado", "petrificado", "muerto"].includes(c.id));
const foes = (s, t) => s.tokens.filter(h => h.id !== t.id && !h.hidden && (h.kind === "pc") !== (t.kind === "pc") && alive(s, h) && !incap(h));
const nm = (s, t) => (charOf(s, t) || t).name;
const monDarkvision = t => { const m = t.srd && findMonster(t.srd); const x = m && /visión en la oscuridad (\d+(?:,\d+)?) m/i.exec(m.txt || ""); return x ? parseFloat(x[1].replace(",", ".")) : 0; };

/* ---------- Esconderse ---------- */
/** ¿Puede esconderse aquí? Para cada enemigo: o no te ve (muros, puertas, oscuridad sin visión en la oscuridad),
 *  o le tapa una cobertura de tres cuartos o total. */
export function hideCheck(s, t) {
  const F = foes(s, t); if (!s.board) return { ok: false, why: "No estás en la mesa." };
  const los = sightLine(s.board), L = lightMap(s.board, s.tokens), dark = L.at(t.c + "," + t.r) === 0;
  const seen = [];
  for (const h of F) {
    if (!los(h, t)) continue;                                    // no hay línea de visión
    if (dark && dist(h, t) * 1.5 > monDarkvision(h)) continue;   // zona muy oscura para él
    const cv = cover(s, h, t); if (cv.level === "3q" || cv.level === "total") continue;
    seen.push(nm(s, h));
  }
  return seen.length ? { ok: false, why: `Te ve${seen.length > 1 ? "n" : ""} ${seen.join(", ")}: necesitas cobertura de tres cuartos o total, o una zona muy oscura, y estar fuera de su vista.` } : { ok: true };
}
const hiddenCond = t => (t.conds || []).find(c => c.id === "invisible" && c.hid);
export const hideDC = t => (hiddenCond(t) || {}).dc || null;

export function hide(tokId, use = "act") {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId); if (!t) return null;
  const chk = hideCheck(s, t); if (!chk.ok) { toast(chk.why); return null; }
  if (use) spend(tokId, use);
  const c = charOf(s, t), bonus = c ? skillBonus(c, "sigilo", "des") : stealthOf(t);
  const r = publish({ kind: "check", label: `${nm(s, t)} intenta esconderse · Destreza (Sigilo) CD 15`, expr: `1d20${bonus >= 0 ? "+" : ""}${bonus}`, by: t.id, dc: 15 });
  if (r.total >= 15) {
    store.commit("token", st => { const k = st.tokens.find(x => x.id === tokId); k.conds = (k.conds || []).filter(x => !(x.id === "invisible" && x.hid)); k.conds.push({ id: "invisible", hid: true, dc: r.total }); });
    toast(`Escondido (Sigilo ${r.total}): invisible mientras sigas oculto. Quien te busque necesita Percepción ${r.total}.`);
  } else toast(`Sigilo ${r.total}: no consigues esconderte.`);
  return r;
}
function stealthOf(t) { const m = t.srd && findMonster(t.srd); const x = m && /Sigilo \+(\d+)/.exec(m.txt || ""); return x ? +x[1] : mod((m && m.ab && m.ab.des) || 10); }
function perceptionOf(s, t) { const c = charOf(s, t); if (c) return skillBonus(c, "percepcion", "sab"); const m = t.srd && findMonster(t.srd); const x = m && /Percepción \+(\d+)/.exec(m.txt || ""); if (x) return +x[1]; const p = m && /Percepción pasiva (\d+)/.exec(m.txt || ""); return p ? +p[1] - 10 : mod(abilitiesOf(s, t).sab); }
/** Deja de estar oculto (al atacar o lanzar un conjuro). Solo toca la propia figura. */
export function unhide(tokId, why = "") {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId); if (!t || !hiddenCond(t)) return;
  store.commit("token", st => { const k = st.tokens.find(x => x.id === tokId); if (k) k.conds = (k.conds || []).filter(x => !(x.id === "invisible" && x.hid)); });
  if (why) toast(`${nm(s, t)} deja de estar oculto: ${why}.`);
}
/** Buscar: Sabiduría (Percepción) contra la CD de quienes están ocultos y a la vista. */
export function search(tokId, use = "act") {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId); if (!t) return null;
  if (use) spend(tokId, use);
  const b = perceptionOf(s, t), los = sightLine(s.board);
  const r = publish({ kind: "check", label: `${nm(s, t)} busca · Sabiduría (Percepción)`, expr: `1d20${b >= 0 ? "+" : ""}${b}`, by: t.id });
  const found = s.tokens.filter(h => (h.kind === "pc") !== (t.kind === "pc") && hiddenCond(h) && los(t, h) && r.total >= hideDC(h));
  if (found.length && isDM(s)) store.commit("token", st => found.forEach(f => { const k = st.tokens.find(x => x.id === f.id); if (k) k.conds = (k.conds || []).filter(x => !(x.id === "invisible" && x.hid)); }));
  toast(found.length ? `Percepción ${r.total}: encuentra a ${found.map(f => nm(s, f)).join(", ")}.` : `Percepción ${r.total}: no encuentra a nadie.`);
  return r;
}

/* ---------- Empujón ---------- */
const sizeCat = t => { const z = +t.size || 1; return z >= 3 ? 5 : z >= 2.4 ? 4 : z >= 1.5 ? 3 : z >= 0.95 ? 2 : 1; };
export const shoveDC = (s, a) => { const c = charOf(s, a); return 8 + mod(abilitiesOf(s, a).fue) + (c ? prof(c.level) : 2); };
/** ¿Se le puede empujar? (a 1,5 m y como mucho una categoría de tamaño mayor) */
export function shoveWhy(s, a, t) {
  if (t.id === a.id) return "No puedes empujarte a ti";
  if (Math.max(Math.abs(a.c - t.c), Math.abs(a.r - t.r)) > 1) return "Tiene que estar a 1,5 m";
  if (sizeCat(t) > sizeCat(a) + 1) return "Es demasiado grande (más de una categoría por encima)";
  return "";
}
/** Lo que pasaría: CD y la salvación que elegiría el objetivo (la mejor de Fuerza y Destreza). */
export function shovePreview(s, a, t) {
  const why = shoveWhy(s, a, t); if (why) return { ok: false, why };
  const pf = savePlan(s, t, "fue"), pd = savePlan(s, t, "des"), ab = pd.bonus > pf.bonus ? "des" : "fue", p = ab === "des" ? pd : pf, dc = shoveDC(s, a);
  let fail = Math.min(19, Math.max(1, dc - 1 - p.bonus)) / 20; if (p.adv > 0) fail = fail ** 2; else if (p.adv < 0) fail = 1 - (1 - fail) ** 2;
  return { ok: true, dc, ab, pct: Math.round(fail * 100) };
}
export function shove(aId, tId, mode = "push") {
  const s = store.get(), a = s.tokens.find(x => x.id === aId), t = s.tokens.find(x => x.id === tId); if (!a || !t) return null;
  const P = shovePreview(s, a, t); if (!P.ok) { toast(P.why); return null; }
  if (phase(s) === "live" && s.board.turn === a.id) { const e = eco(s, a); if (e.act && !(e.atkLeft > 0)) { toast("Ya has usado tu acción de Atacar."); return null; } spend(a.id, { attack: true }); }
  unhide(a.id, "ha empujado");
  // Hacia dónde: en línea desde ti, si la casilla está libre
  const dc = Math.sign(t.c - a.c), dr = Math.sign(t.r - a.r), to = { c: t.c + dc, r: t.r + dr };
  const p = savePlan(s, t, P.ab);
  const r = publish({ kind: "save", label: `Empujón de ${nm(s, a)} (${mode === "push" ? "apartar 1,5 m" : "derribar"}): salvación de ${P.ab === "des" ? "Destreza" : "Fuerza"} de ${nm(s, t)} CD ${P.dc}`, expr: `1d20${p.bonus >= 0 ? "+" : ""}${p.bonus}${p.extra || ""}`, adv: p.adv, by: t.id, dc: P.dc,
    apply: { type: "shove", mode, target: t.id, to } });
  if (runsTable(store.get())) applyEffect(r.id);
  return r;
}
/** El máster aplica lo que ha salido (el jugador no puede mover ni derribar figuras ajenas). */
export function applyEffect(rollId) {
  const s = store.get(), r = (s.rolls || []).find(x => x.id === rollId); if (!r || !r.apply || r.applied) return;
  const A = r.apply;
  if (A.type === "shove") {
    if (r.result === "fail") store.commit("token", st => { const t = st.tokens.find(x => x.id === A.target); if (!t) return;
      if (A.mode === "prone") { t.conds = (t.conds || []).filter(c => c.id !== "derribado"); t.conds.push({ id: "derribado" }); return; }
      const free = A.to && cellFree(st, A.to.c, A.to.r, t.id); if (free) { t.c = A.to.c; t.r = A.to.r; } });
    if (r.result === "fail" && A.mode === "push" && !(A.to && cellFree(store.get(), A.to.c, A.to.r, A.target))) toast("No hay sitio detrás: no se mueve.");
  }
  // Reacciones (Escudo, Esquiva asombrosa) y rasgos que tocan algo ajeno: lo aplica el máster
  if (A.type === "shield" || A.type === "halve") import("./reacciones.js").then(m => store.commit("roll", st => m.applyRx(st, A)));
  if (A.type === "bardic") store.commit("token", st => { const t = st.tokens.find(x => x.id === A.target); if (!t) return; t.conds = (t.conds || []).filter(c => c.id !== "insp_bardica"); t.conds.push({ id: "insp_bardica", die: A.die, note: `${A.die} de ${A.from || "un bardo"}` }); });
  if (A.type === "pushobj" && r.result === "save") store.commit("board", st => { const p = (st.board.props || []).find(x => x.id === A.prop); if (p && cellFree(st, A.to.c, A.to.r, null, true)) { p.c = A.to.c; p.r = A.to.r; } });
  store.commit("roll", st => { const x = (st.rolls || []).find(y => y.id === rollId); if (x) x.applied = true; });
}
function cellFree(s, c, r, except, forProp = false) {
  const g = s.board; if (!g || c < 0 || r < 0 || c >= g.cols || r >= g.rows) return false;
  const tt = (g.terrain || {})[c + "," + r]; if (tt && TERRAIN[tt] && TERRAIN[tt].wall) return false;
  if (s.tokens.some(t => t.id !== except && t.c === c && t.r === r)) return false;
  if ((g.props || []).some(p => p.c === c && p.r === r && ((PROPS[p.k] || {}).block || isDoor(p) || forProp))) return false;
  return true;
}

/* ---------- Subirse a objetos ---------- */
export { TOPS };
export const topProp = (g, c, r) => (g.props || []).find(p => p.c === c && p.r === r && TOPS[p.k]);
/** Objetos a los que se puede subir desde aquí (en tu casilla o al lado), con lo que cuesta. */
export function climbables(s, t) {
  if (!s.board) return [];
  const on = (t.conds || []).find(c => c.id === "encima");
  return (s.board.props || []).filter(p => TOPS[p.k] && Math.max(Math.abs(p.c - t.c), Math.abs(p.r - t.r)) <= 1 && !(on && on.p === p.id) && !s.tokens.some(k => k.id !== t.id && k.c === p.c && k.r === p.r))
    .map(p => ({ id: p.id, name: p.label || PROPS[p.k].n, h: TOPS[p.k], cost: TOPS[p.k] + (p.c === t.c && p.r === t.r ? 0 : 1.5) }));
}
export function climbOn(tokId, propId) {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId), p = s.board && (s.board.props || []).find(x => x.id === propId); if (!t || !p || !TOPS[p.k]) return;
  const x = climbables(s, t).find(q => q.id === propId); if (!x) return toast("Tiene que estar a tu lado y libre.");
  const climber = /trep|vol/i.test(String(t.speed || ""));
  const cost = climber ? (p.c === t.c && p.r === t.r ? 0 : 1.5) : x.cost;
  if (phase(s) === "live" && s.board.turn === t.id) {
    const e = eco(s, t); if ((e.mov || 0) + cost > moveBudget(s, t) + 0.01) return toast(`No te queda movimiento: subirte cuesta ${String(cost).replace(".", ",")} m.`);
    store.commit("token", st => { const k = st.tokens.find(y => y.id === tokId); const ee = eco(st, k); ee.mov = Math.round(((ee.mov || 0) + cost) * 10) / 10; k.eco = ee; });
  }
  store.commit("token", st => { const k = st.tokens.find(y => y.id === tokId); k.c = p.c; k.r = p.r; k.conds = (k.conds || []).filter(c => c.id !== "encima"); k.conds.push({ id: "encima", p: p.id }); });
  toast(`Te subes a ${x.name} (${String(x.h).replace(".", ",")} m): ${String(cost).replace(".", ",")} m de movimiento trepando.`);
}
export function climbDown(tokId) {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId); if (!t) return;
  const on = (t.conds || []).find(c => c.id === "encima"), p = on && (s.board.props || []).find(x => x.id === on.p), h = p ? TOPS[p.k] || 0 : 0;
  store.commit("token", st => { const k = st.tokens.find(y => y.id === tokId); k.conds = (k.conds || []).filter(c => c.id !== "encima");
    if (phase(st) === "live" && st.board.turn === k.id) { const ee = eco(st, k); ee.mov = Math.round(((ee.mov || 0) + h) * 10) / 10; k.eco = ee; } });
  toast(`Bajas (${String(h).replace(".", ",")} m de movimiento).`);
}

/* ---------- Empujar un objeto ---------- */
// Lo que cuesta moverlo (regla de campaña: el SRD solo da la carga máxima y deja la prueba al máster)
export const PUSHABLE = { silla: 5, barril: 10, tonel: 15, caja: 10, baul: 15, cofre: 15, mesa: 10, mesalarga: 15, roca: 15, vagoneta: 10, sarcofago: 20, estatua: 20, yunque: 20, barricada: 15 };
export function pushables(s, t) {
  return (s.board.props || []).filter(p => PUSHABLE[p.k] && Math.max(Math.abs(p.c - t.c), Math.abs(p.r - t.r)) === 1)
    .map(p => { const to = { c: p.c + Math.sign(p.c - t.c), r: p.r + Math.sign(p.r - t.r) }; return { id: p.id, name: p.label || PROPS[p.k].n, dc: PUSHABLE[p.k], to, free: cellFree(s, to.c, to.r, null, true) }; });
}
export function pushObject(tokId, propId) {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId); if (!t) return;
  const x = pushables(s, t).find(q => q.id === propId); if (!x) return;
  if (!x.free) return toast(`No hay sitio detrás de ${x.name}.`);
  if (phase(s) === "live" && s.board.turn === t.id) spend(tokId, "act");
  const c = charOf(s, t), b = c ? skillBonus(c, "atletismo", "fue") : mod(abilitiesOf(s, t).fue);
  const r = publish({ kind: "check", label: `${nm(s, t)} empuja ${x.name} · Fuerza (Atletismo) CD ${x.dc}`, expr: `1d20${b >= 0 ? "+" : ""}${b}`, by: t.id, dc: x.dc, apply: { type: "pushobj", prop: x.id, to: x.to } });
  if (runsTable(store.get())) applyEffect(r.id);
  toast(r.total >= x.dc ? `Atletismo ${r.total}: lo mueves 1,5 m.` : `Atletismo ${r.total}: no se mueve.`);
}

/** En el cliente del máster: aplica empujones y objetos empujados que han pedido los jugadores. */
export function watchEffects() {
  const run = () => { const s = store.get(); if (!runsTable(s)) return; (s.rolls || []).filter(r => r.apply && !r.applied && r.result).forEach(r => applyEffect(r.id)); };
  store.subscribe(() => queueMicrotask(run)); setInterval(run, 2500);
}
export { uid, hasCond };

/* ---------- Levantarse (Hito 93, SRD 5.2.1 «Derribado») ----------
 * Para dejar de estar derribado gastas movimiento igual a la mitad de tu velocidad (redondeando hacia abajo).
 * Si tu velocidad es 0 no puedes levantarte. Fuera de combate no cuesta nada. */
export function standInfo(s, t) {
  if (!t || !hasCond(t, "derribado")) return null;
  const live = phase(s) === "live", speed = speedOf(s, t), cost = Math.floor(speed / 2 * 10) / 10;
  if (!live) return { ok: true, cost: 0, why: "" };
  if (speed <= 0) return { ok: false, cost, why: "Tu velocidad es 0: no puedes levantarte" };
  const left = moveBudget(s, t) - (eco(s, t).mov || 0);
  return left + 0.01 >= cost ? { ok: true, cost, why: "" } : { ok: false, cost, why: `Te faltan metros: levantarte cuesta ${String(cost).replace(".", ",")} m` };
}
export function standUp(tokId) {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId), I = standInfo(s, t); if (!I) return;
  if (!I.ok) return toast(I.why);
  if (I.cost) spend(tokId, { mov: I.cost });
  store.commit("token", st => { const k = st.tokens.find(y => y.id === tokId); if (k) k.conds = (k.conds || []).filter(c => c.id !== "derribado"); });
  toast(I.cost ? `Te levantas: gastas ${String(I.cost).replace(".", ",")} m de movimiento` : "Te levantas");
}
