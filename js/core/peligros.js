// Peligros del mapa que se aplican solos (SRD 5.2.1): trampas, caídas, hielo resbaladizo, fuego (Ardiendo) y la lava
// (regla de campaña: el SRD no la trae; el máster pone su daño en la escena). La mesa tira las salvaciones y deja el daño
// pendiente en Tiradas para que el máster lo confirme, igual que con un conjuro.
import { store, uid } from "./store.js";
import { publish } from "./dados.js";
import { charOf } from "./mesa.js";
import { quickSave } from "./salud.js";
import { currentUser } from "./session.js";
import { TERRAIN, PROPS } from "../data/mapas.js";
import { TRAPS, tierOf, TIER_TXT } from "../data/trampas.js";
import { toast } from "./ui.js";

const AB = { fue: "Fuerza", des: "Destreza", con: "Constitución", int: "Inteligencia", sab: "Sabiduría", car: "Carisma" };
const nm = (s, t) => (charOf(s, t) || t).name;
const rnd = n => 1 + Math.floor(Math.random() * n);

/** Nivel del grupo para escalar trampas: media de los personajes en la mesa (o de todos si no hay ninguno). */
export function partyLevel(s) {
  const onBoard = (s.tokens || []).filter(t => t.kind === "pc").map(t => charOf(s, t)).filter(Boolean);
  const L = (onBoard.length ? onBoard : s.characters || []).map(c => +c.level || 1);
  return L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : 1;
}

/**
 * Una tirada de peligro: daño (si lo hay) y una salvación por víctima (o «sin salvación»); quien falla recibe los estados.
 * Queda pendiente en Tiradas; el máster la aplica con «Aplicar a todos».
 */
export function hazardRoll(s, { label, expr, dtype, victims, save, dc, half, conds, note, spell }) {
  const u = currentUser(s) || {};
  let r;
  if (expr) r = publish({ kind: "spell", label, expr, dtype: dtype || "", by: null });
  else {
    r = { id: uid("tir"), at: Date.now(), who: u.id || null, whoName: u.name || "", label, expr: "", kind: "spell", dice: [], total: null, nat: null, tok: null, status: "pending", secret: false };
    store.commit("roll", st => { st.rolls = st.rolls || []; st.rolls.push(r); });
  }
  const now = store.get();
  const saves = victims.map(t => {
    if (!save) return { t: t.id, name: nm(now, t), ok: false, auto: true };
    if (save.hugeOk && (+t.size || 1) >= 3) return { t: t.id, name: nm(now, t), ok: true, auto: true, total: "—", d20: "—" };
    return quickSave(now, t, save.ab, dc);
  });
  store.commit("roll", st => { const x = st.rolls.find(y => y.id === r.id); if (x) Object.assign(x, { saves, half: !!half, dc: dc || null, sv: save ? save.ab : null, conds: conds || [], dtype: dtype || null, spell: spell || label, status: "pending", targets: victims.map(t => t.id), trap: true, note: note || null }); });
  return r;
}

/** Trampa del SRD (o personalizada) sobre quienes la pisan. */
export function springTrap(propId, tokenIds) {
  const s = store.get(), p = ((s.board && s.board.props) || []).find(x => x.id === propId); if (!p) return null;
  const victims = tokenIds.map(id => s.tokens.find(t => t.id === id)).filter(Boolean); if (!victims.length) return null;
  const tr = p.trap || {}, T = tr.srd && TRAPS[tr.srd];
  store.commit("board", st => { const x = (st.board.props || []).find(y => y.id === propId); if (x) { x.hidden = false; x.sprung = true; } });
  const who = victims.map(t => nm(s, t)).join(", ");
  if (!T) {
    // Trampa personalizada: los números que haya puesto el máster
    const save = tr.save || "des", dc = +tr.dc || 13, name = p.label || (PROPS[p.k] || {}).n || "Trampa";
    return hazardRoll(s, { label: `¡${name}! ${who} · salvación de ${AB[save]} CD ${dc}`, expr: tr.dmg || "", dtype: tr.type || "", victims, save: { ab: save }, dc, half: tr.half !== false, conds: tr.cond ? [tr.cond] : [], spell: name });
  }
  const k = tierOf(partyLevel(s)), dc = T.dc ? T.dc[k] : null;
  let expr = T.dmg ? T.dmg[k] : "";
  if (T.darts) { const n = rnd(3); expr = Array(n).fill(T.darts[k]).join("+"); }
  const extra = [`${T.sev}; números para ${TIER_TXT[k]}`, T.darts ? `${expr.split("+").length} dardo(s)` : "", T.area ? T.area[k] : "", T.depth ? `pozo de ${T.depth[k]} m` : "", T.condTxt ? `si falla: ${T.condTxt}` : "", T.note || ""].filter(Boolean).join(" · ");
  const r = hazardRoll(s, {
    label: `¡${p.label || T.n}! ${who}${T.save ? ` · salvación de ${AB[T.save]} CD ${dc}` : " · sin salvación"}`,
    expr, dtype: T.type || "", victims, save: T.save ? { ab: T.save, hugeOk: T.hugeOk } : null, dc, half: T.half, conds: T.cond ? [T.cond] : [], note: extra, spell: T.n
  });
  if (T.after) store.commit("board", st => { const x = (st.board.props || []).find(y => y.id === propId); if (x) { st.board.terrain = st.board.terrain || {}; st.board.terrain[x.c + "," + x.r] = T.after; } });
  return r;
}

/* ---------- Peligros del terreno y de los objetos ---------- */
/** Qué peligro hay en una casilla: { key, kind, ... } o null. kind: fall | slip | lava | fire */
export function hazardAt(s, c, r) {
  const g = s.board || {}, ter = (g.terrain || {})[c + "," + r], T = TERRAIN[ter];
  if ((g.props || []).some(x => x.c === c && x.r === r && (PROPS[x.k] || {}).bridge)) return null; // un puente salva el abismo o el agua
  const p = (g.props || []).find(x => x.c === c && x.r === r && (PROPS[x.k] || {}).haz);
  if (p) { const h = PROPS[p.k].haz; return { key: "p:" + p.id, kind: h, h: +p.h || PROPS[p.k].h || 3, name: p.label || PROPS[p.k].n }; }
  if (T && T.haz) return { key: "t:" + ter, kind: T.haz, h: T.haz === "fall" ? +(g.fallH || 3) : 0, name: T.n };
  return null;
}
const fallDice = m => `${Math.max(1, Math.min(20, Math.floor(m / 3)))}d6`;

/** Aplica el peligro de una casilla a una figura (al entrar o al empezar su turno). */
export function applyHazard(tokenId, hz, when = "enter") {
  const s = store.get(), t = s.tokens.find(x => x.id === tokenId); if (!t || !hz) return null;
  const n = nm(s, t);
  if (hz.kind === "fall") {
    if (when !== "enter") return null;
    return hazardRoll(s, { label: `${n} cae: ${hz.name} (${hz.h} m)`, expr: fallDice(hz.h), dtype: "contundente", victims: [t], save: null, conds: ["derribado"], spell: "Caída",
      note: "SRD «Caídas»: 1d6 de daño contundente por cada 3 m (máx. 20d6) y derribado. Si cae al agua, puede usar su reacción: Fuerza (Atletismo) o Destreza (Acrobacias) CD 15 para recibir la mitad." });
  }
  if (hz.kind === "slip") {
    return hazardRoll(s, { label: `${n} en ${hz.name} · salvación de Destreza CD 10`, expr: "", victims: [t], save: { ab: "des" }, dc: 10, conds: ["derribado"], spell: "Hielo resbaladizo",
      note: "SRD «Hielo resbaladizo»: terreno difícil; al entrar por primera vez en un turno o empezar el turno allí, salvación de Destreza CD 10 o derribado." });
  }
  if (hz.kind === "fire") {
    if ((t.conds || []).some(c => c.id === "ardiendo")) return null;
    store.commit("token", st => { const k = st.tokens.find(x => x.id === tokenId); if (k) { k.conds = (k.conds || []).filter(c => c.id !== "ardiendo"); k.conds.push({ id: "ardiendo", note: hz.name }); } });
    toast(`🔥 ${n} empieza a arder (${hz.name}).`);
    return null;
  }
  if (hz.kind === "lava") {
    const d = (s.board && s.board.lavaDmg) || "";
    if (!d) { toast(`${n} está en la lava, pero la escena no tiene daño de lava: ponlo en ⚙ Mapa.`); return null; }
    return hazardRoll(s, { label: `${n} en la lava`, expr: d, dtype: "fuego", victims: [t], save: null, spell: "Lava", note: "Regla de campaña (el SRD no trae la lava): daño de fuego al entrar y al empezar el turno en ella." });
  }
  return null;
}

/** Tras un movimiento: list = [{ t: tokenId, hz }] de quienes entraron en una casilla peligrosa. */
export function onEnter(list) { list.forEach(x => applyHazard(x.t, x.hz, "enter")); }

/** Al empezar el turno de una figura: Ardiendo (1d4 de fuego) y el peligro de la casilla en la que está. */
export function onTurnStarted(tokenId) {
  const s = store.get(), t = (s.tokens || []).find(x => x.id === tokenId); if (!t) return;
  if ((t.conds || []).some(c => c.id === "ardiendo")) hazardRoll(s, { label: `${nm(s, t)} arde`, expr: "1d4", dtype: "fuego", victims: [t], save: null, spell: "Fuego",
    note: "SRD «Fuego»: 1d4 de fuego al principio de cada turno. Con una acción se apaga: queda derribado." });
  const hz = hazardAt(s, t.c, t.r);
  if (hz && (hz.kind === "slip" || hz.kind === "lava")) applyHazard(tokenId, hz, "start");
}

/** Apagarse (SRD «Fuego»): una acción; quita Ardiendo y deja derribado. */
export async function douse(tokenId) {
  const { spend } = await import("./turnos.js");
  spend(tokenId, "act");
  store.commit("token", st => { const k = st.tokens.find(x => x.id === tokenId); if (!k) return; k.conds = (k.conds || []).filter(c => c.id !== "ardiendo"); if (!k.conds.some(c => c.id === "derribado")) k.conds.push({ id: "derribado" }); });
  toast("Rueda por el suelo y apaga el fuego: queda derribado.");
}
