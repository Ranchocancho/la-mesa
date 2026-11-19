// Experiencia por combate, según el SRD 5.2.1: cada monstruo vale los PX de su VD (tabla «Puntos de experiencia
// por valor de desafío») y se conceden al derrotarlo o neutralizarlo. Se reparten a partes iguales entre los
// personajes que participaron en el combate (como indica la guía del máster).
import { store, uid } from "./store.js";
import { findMonster } from "./srd.js";
import { currentUser } from "./session.js";
import { canLevelUp } from "../data/dnd.js";
import { toast } from "./ui.js";

export const XP_BY_CR = { "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
  "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000 };
/** PX de una ficha enemiga: los suyos si el máster los fijó, o los de su VD del compendio. */
export function xpOf(t) {
  if (t.xp != null) return +t.xp || 0;
  const vd = t.vd != null ? String(t.vd) : (findMonster(t.srd || t.name) || {}).vd;
  return vd != null ? XP_BY_CR[String(vd)] ?? 0 : 0;
}
/** Resumen del combate: enemigos derrotados, PX totales y cuánto toca a cada personaje que participó. */
export function combatXP(s) {
  const foes = s.tokens.filter(t => t.kind === "foe" && (+t.hp || 0) <= 0);
  const pcs = s.tokens.filter(t => t.kind === "pc" && t.char && s.characters.some(c => c.id === t.char));
  const total = foes.reduce((a, t) => a + xpOf(t), 0), share = pcs.length ? Math.floor(total / pcs.length) : 0;
  return { foes: foes.map(t => ({ name: t.name, xp: xpOf(t) })), pcs: pcs.map(t => t.char), total, share };
}
/** Deja en la tabla de tiradas el reparto de PX del combate, pendiente de que el máster lo confirme. */
export function postCombatXP() {
  const s = store.get(), x = combatXP(s); if (!x.foes.length) return null;
  const u = currentUser(s) || {}, names = x.pcs.map(id => (s.characters.find(c => c.id === id) || {}).name).filter(Boolean);
  const e = { id: uid("tir"), at: Date.now(), who: u.id || null, whoName: u.name || "", kind: "xp", label: `Fin del combate: ${x.total} PX`, expr: "", dice: [], total: x.total, nat: null,
    status: "pending", secret: false, xp: x, note: `${x.foes.map(f => `${f.name} (${f.xp})`).join(", ")} → ${x.share} PX para ${names.join(", ")}` };
  store.commit("roll", st => { st.rolls = st.rolls || []; st.rolls.push(e); });
  return e;
}
/** El máster reparte los PX (puede cambiar la cantidad por personaje). */
export function grantXP(rollId, share) {
  const ups = [];
  store.commit("char", s => {
    const r = (s.rolls || []).find(x => x.id === rollId); if (!r || r.status !== "pending") return;
    const each = share != null ? share : r.xp.share;
    r.xp.pcs.forEach(id => { const c = s.characters.find(y => y.id === id); if (!c) return; const could = canLevelUp(c); c.xp = (c.xp || 0) + each; if (!could && canLevelUp(c)) ups.push(c.name); });
    r.status = "ok"; r.note = `${each} PX para cada personaje · ${r.note.split(" → ")[0]}`;
    const live = (s.sessions || []).find(x => x.status === "open"); if (live) { live.combatXP = (live.combatXP || 0) + each; }
  });
  if (ups.length) toast(`¡${ups.join(" y ")} puede${ups.length > 1 ? "n" : ""} subir de nivel!`);
}
