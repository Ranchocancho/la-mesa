// Centro de mando del máster (Hito 68): lo que el máster lleva durante la partida y entre sesiones.
//   · Notas de experiencia: PX por hechos (una acción heroica, resolver un enigma…) que se conceden cuando el máster quiera
//     o al cerrar la sesión (se rellenan solas en el reparto). Los PX por hitos y por historia son del SRD («Experiencia»).
//   · Notas de futuro: líneas para próximas sesiones, cosas que no olvidar o preparar.
//   · Reglas a mano: accesos rápidos del máster a apartados del SRD (glosario, páginas del libro, conjuros, monstruos).
//   · Mermas permanentes (regla de campaña: el SRD no las trae): heridas o pérdidas que quedan en la ficha del personaje.
// Lo del máster va en «secrets/mando» (los jugadores no lo ven); las mermas, en la ficha (el jugador sí las ve).
import { store, uid } from "./store.js";
import { liveSession, sessionName } from "./sesiones.js";
import { canLevelUp } from "../data/dnd.js";
import { toast } from "./ui.js";

export const mandoOf = s => s.mando || { xpn: [], future: [], rules: [] };
const M = s => { s.mando = s.mando || {}; for (const k of ["xpn", "future", "rules"]) s.mando[k] = s.mando[k] || []; return s.mando; };

/* ---------- Personajes del grupo ---------- */
/** Los personajes que juegan (tienen jugador o están en la mesa). */
export const partyChars = s => s.characters.filter(c => c.owner || (s.tokens || []).some(t => t.char === c.id));
/** PX ganados en la sesión en curso (desde que empezó), más los anotados que aún no se han concedido. */
export function sessionXP(s, c) {
  const l = liveSession(s); if (!l) return { got: 0, pend: 0 };
  const base = l.xp0 && l.xp0[c.id] != null ? l.xp0[c.id] : null;
  const got = base == null ? 0 : Math.max(0, (c.xp || 0) - base);
  const pend = mandoOf(s).xpn.filter(n => !n.done && n.ses === l.id && n.chars.includes(c.id)).reduce((a, n) => a + (+n.xp || 0), 0);
  return { got, pend };
}
/** Si la sesión empezó antes de existir el contador, se toma la foto ahora. */
export function ensureXP0() {
  const s = store.get(), l = liveSession(s); if (!l || l.xp0) return;
  store.commit("session", st => { const x = liveSession(st); if (x && !x.xp0) x.xp0 = Object.fromEntries(st.characters.map(c => [c.id, c.xp || 0])); });
}

/* ---------- Notas de experiencia ---------- */
export function addXPNote(chars, xp, txt) {
  const s = store.get(), l = liveSession(s);
  if (!chars.length) return toast("Elige al menos un personaje.");
  if (!(+xp > 0) && !txt.trim()) return toast("Pon los PX o lo que pasó.");
  store.commit("mando", st => { M(st).xpn.unshift({ id: uid("xpn"), at: Date.now(), ses: l ? l.id : null, sesName: l ? sessionName(l) : "", chars, xp: Math.max(0, +xp || 0), txt: txt.trim(), done: false }); });
}
/** Concede los PX de una nota (o de todas las pendientes) ahora mismo. */
export function grantXPNotes(ids) {
  const ups = [];
  store.commit("char", st => {
    for (const n of M(st).xpn.filter(x => ids.includes(x.id) && !x.done)) {
      for (const id of n.chars) { const c = st.characters.find(x => x.id === id); if (!c) continue; const could = canLevelUp(c); c.xp = (c.xp || 0) + (+n.xp || 0); if (!could && canLevelUp(c)) ups.push(c.name.split(" ")[0]); }
      n.done = true; n.doneAt = Date.now();
    }
  });
  if (ups.length) toast(`${ups.join(" y ")} ya tiene${ups.length > 1 ? "n" : ""} los PX para subir de nivel.`);
}
export const dropXPNote = id => store.commit("mando", st => { M(st).xpn = M(st).xpn.filter(x => x.id !== id); });
/** Al cerrar la sesión: lo pendiente de cada personaje (para rellenar el reparto) y marcarlo como hecho. */
export function pendingFor(s, charId) {
  const l = liveSession(s), L = mandoOf(s).xpn.filter(n => !n.done && (!l || n.ses === l.id || !n.ses) && n.chars.includes(charId));
  return { xp: L.reduce((a, n) => a + (+n.xp || 0), 0), why: L.map(n => n.txt).filter(Boolean).join("; ") };
}
export const closeXPNotes = () => store.commit("mando", st => { const l = liveSession(st); M(st).xpn.forEach(n => { if (!n.done && (!l || n.ses === l.id || !n.ses)) { n.done = true; n.doneAt = Date.now(); } }); });

/* ---------- Notas de futuro ---------- */
export const FTAGS = [["sesion", "📅", "Próxima sesión"], ["trama", "🧵", "Trama"], ["pnj", "🎭", "PNJ"], ["preparar", "🛠", "Preparar"], ["idea", "💡", "Idea"]];
export const addFuture = (txt, tag) => { if (!txt.trim()) return; store.commit("mando", st => { M(st).future.unshift({ id: uid("fut"), at: Date.now(), txt: txt.trim(), tag: tag || "idea", done: false }); }); };
export const toggleFuture = id => store.commit("mando", st => { const n = M(st).future.find(x => x.id === id); if (n) n.done = !n.done; });
export const dropFuture = id => store.commit("mando", st => { M(st).future = M(st).future.filter(x => x.id !== id); });

/* ---------- Reglas a mano ---------- */
// k: "g" glosario (ref = nombre) · "p" página del libro (ref = "página~título") · "c" conjuro · "m" monstruo · "t" pestaña
export const addRule = (k, ref, label, grp = "") => store.commit("mando", st => { const R = M(st).rules; if (!R.some(x => x.k === k && x.ref === ref)) R.push({ id: uid("rg"), k, ref, label, grp }); });
export const dropRule = id => store.commit("mando", st => { M(st).rules = M(st).rules.filter(x => x.id !== id); });
export const moveRule = (id, d) => store.commit("mando", st => { const R = M(st).rules, i = R.findIndex(x => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= R.length) return; [R[i], R[j]] = [R[j], R[i]]; });
export const groupRule = (id, grp) => store.commit("mando", st => { const r = M(st).rules.find(x => x.id === id); if (r) r.grp = grp.trim(); });

/* ---------- Mermas permanentes (regla de campaña) ---------- */
export const addMerma = (charId, t) => { if (!t.trim()) return; const l = liveSession(store.get()); store.commit("char", st => { const c = st.characters.find(x => x.id === charId); if (!c) return; c.mermas = c.mermas || []; c.mermas.push({ id: uid("mer"), t: t.trim(), at: Date.now(), ses: l ? sessionName(l) : "" }); }); };
export const dropMerma = (charId, id) => store.commit("char", st => { const c = st.characters.find(x => x.id === charId); if (c) c.mermas = (c.mermas || []).filter(x => x.id !== id); });
