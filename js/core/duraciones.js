// Duraciones de los estados en turnos (como en Baldur's Gate 3): cada estado puede llevar un contador que
// baja con los turnos de alguien y se quita solo al llegar a cero.
//   dur = { who: id de la figura cuyo turno marca el tiempo, at: "start" | "end", n: turnos (sin anclar), R: asalto en que termina }
// «Hasta el principio de tu siguiente turno» → { who: tú, at: "start", n: 1 }; «1 minuto» → 10 asaltos.
// Se guarda el asalto en que termina (R) en vez de un contador que haya que ir bajando: así el estado se calcula
// a partir de la ronda y del orden de iniciativa, y da igual quién pase el turno (en la nube, un jugador
// no puede tocar las figuras de los demás; lo deja hecho el máster al verlo, sin contar dos veces).
import { store } from "./store.js";
import { isDM } from "./session.js";
import { order } from "./mesa.js";

export const ROUNDS_PER_MIN = 10; // SRD: un asalto son 6 segundos
const live = s => !!(s.board && s.board.combat === "live" && s.board.turn);
const pos = (s, id) => order(s).findIndex(t => t.id === id);
/** ¿Ya ha llegado (en esta ronda) el principio / el final del turno de «who»? */
function happened(s, who, at) {
  const pc = pos(s, s.board.turn), pw = pos(s, who);
  if (pw < 0) return true; // ya no está en la iniciativa: cuenta como pasado
  return at === "start" ? pc >= pw : pc > pw;
}
/** Asalto en que termina algo que dura n turnos de «who» a partir de ahora. */
const roundFor = (s, who, at, n) => (s.board.round || 1) + n - 1 + (happened(s, who, at) ? 1 : 0);

/** Duración nueva: n turnos de «who» (al empezar o al terminar). Fuera de combate se ancla al empezar. */
export function durFor(s, who, at, n) {
  const d = { who, at, n: Math.max(1, Math.round(n)) };
  if (live(s)) d.R = roundFor(s, who, at, d.n);
  return d;
}
/** Turnos que le quedan (1 = termina en el próximo principio/final de turno de «who»). */
export function leftOf(s, cd) {
  const d = cd && cd.dur; if (!d) return null;
  if (d.R == null || !live(s)) return d.n;
  return Math.max(0, d.R - (s.board.round || 1) + 1 - (happened(s, d.who, d.at) ? 1 : 0));
}
export const expired = (s, cd) => !!(cd && cd.dur && cd.dur.R != null && live(s) && leftOf(s, cd) <= 0);

/** Texto para la ficha: «2 turnos · termina al empezar el turno de Brena». */
export function durText(s, cd) {
  const n = leftOf(s, cd); if (n == null) return "";
  const w = (s.tokens || []).find(t => t.id === cd.dur.who), wn = w ? String(w.name || "").split(" ")[0] : "?";
  const when = cd.dur.at === "start" ? `al empezar el turno de ${wn}` : `al terminar el turno de ${wn}`;
  return `${n} turno${n === 1 ? "" : "s"} · termina ${when}`;
}
/** Etiqueta corta para la figura: «⏳2». */
export const durTag = (s, cd) => { const n = leftOf(s, cd); return n == null ? "" : `⏳${n}`; };

/** Estados que terminan por otras reglas: la furia acaba si quedas incapacitado (SRD 2024). */
const ENDS_IF = { furia: ["incapacitado", "inconsciente", "paralizado", "petrificado", "aturdido", "muerto"] };

/** Quita lo caducado y ancla lo que se puso fuera de combate. Muta el estado; devuelve si cambió algo. */
export function prune(s) {
  if (!s.board || !s.tokens) return false;
  let ch = false;
  for (const t of s.tokens) {
    if (!t.conds || !t.conds.length) continue;
    const ids = t.conds.map(c => c.id);
    const keep = t.conds.filter(c => {
      if (ENDS_IF[c.id] && ENDS_IF[c.id].some(x => ids.includes(x))) return false;
      if (c.dur && c.dur.R == null && live(s)) { c.dur.R = roundFor(s, c.dur.who, c.dur.at, c.dur.n); ch = true; }
      return !expired(s, c);
    });
    if (keep.length !== t.conds.length) { t.conds = keep; ch = true; }
  }
  return ch;
}
/** Al acabar el combate lo anclado vuelve a ser «n turnos» (el máster decide si sigue). */
export function unanchor(s) {
  for (const t of s.tokens || []) for (const c of t.conds || []) if (c.dur && c.dur.R != null) { c.dur.n = Math.max(1, leftOf(s, c) || 1); delete c.dur.R; }
}

/** El máster deja la mesa al día cuando pasa el turno otro (un jugador). */
export function watchDurations() {
  let busy = false;
  const run = () => {
    const s = store.get(); if (busy || !isDM(s) || !live(s)) return;
    const copy = JSON.parse(JSON.stringify({ board: s.board, tokens: s.tokens }));
    if (!prune(copy)) return;
    busy = true; store.commit("token", st => { prune(st); }); busy = false;
  };
  store.subscribe(() => queueMicrotask(run));
}
