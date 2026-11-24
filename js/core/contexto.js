// Contexto de la partida: dónde está el grupo ahora, qué hay ahí (PNJ, facciones, eventos, escenas)
// y lo que ha cambiado en el mundo durante la sesión (quién ha muerto, quién se ha vuelto hostil…).
// Todo vive en la sesión abierta (documento de campaña) y en las propias entradas del lore: no hace falta tocar reglas.
import { store } from "./store.js";
import { liveSession } from "./sesiones.js";
import { partyToPlace } from "./ruta.js";
import { loreOf, entry, placeOf, placePath, descendants, related } from "./lore.js";

export const VITAL = { vivo: ["🙂", "Vivo"], herido: ["🩸", "Herido"], preso: ["⛓", "Preso"], desaparecido: ["❔", "Desaparecido"], muerto: ["💀", "Muerto"] };
export const STANCE = { aliada: ["🤝", "Aliado"], neutral: ["◦", "Neutral"], hostil: ["⚔", "Hostil"] };
/** Qué estados admite cada tipo de entrada. */
export const fieldsOf = kind => kind === "npc" ? ["vital", "stance"] : kind === "faction" ? ["stance"] : [];
const DICT = { vital: VITAL, stance: STANCE };
export const stateLabel = (f, v) => DICT[f] && DICT[f][v] ? DICT[f][v].join(" ") : "";
/** Distintivos cortos de estado (vacío si todo es «normal»: vivo y sin postura). */
export const badges = e => [e.vital && e.vital !== "vivo" ? VITAL[e.vital] : null, e.stance && e.stance !== "neutral" ? STANCE[e.stance] : null]
  .filter(Boolean).map(([i, n]) => `<i class="lbadge" title="${n}">${i} ${n}</i>`).join("");

/** Lugar donde está ahora el grupo (lo marca el máster o se deduce al mostrar un lugar o cargar una escena). */
export const hereOf = s => { const l = liveSession(s); return l && l.here ? placeOf(s, l.here) : null; };
export function setHere(id) {
  const before = liveSession(store.get());
  store.commit("session", s => {
    const l = liveSession(s); if (!l || l.here === (id || null)) return;
    l.here = id || null;
    if (id) { l.visited = l.visited || []; if (!l.visited.includes(id)) l.visited.push(id); }
  });
  // y el grupo se mueve allí en el mapa del mundo (Hito 74), con su paso en la ruta de la sesión
  if (id && before) { const s = store.get(), pl = (s.world.places || []).find(x => x.id === id), cur = s.world.party; if (pl && !(cur && cur.p === id)) partyToPlace(s, id); }
}
/** Recuerda que una entrada ha salido en la sesión (para proponerla al cerrar). */
export function touch(id) {
  const s = store.get(), l = liveSession(s);
  if (!l || (l.touched || []).includes(id) || !entry(s, id)) return;
  store.commit("session", st => { const x = liveSession(st); if (x) { x.touched = x.touched || []; if (!x.touched.includes(id)) x.touched.push(id); } });
}

/**
 * Lo que hay alrededor de un lugar: entradas del propio lugar, de lo que contiene, de la región que lo contiene
 * y las que están relacionadas con él. Primero lo más cercano.
 */
export function contextOf(s, pid) {
  const path = placePath(s, pid), up = path.map(p => p.id), down = descendants(s, pid), area = new Set([...up, ...down]);
  const linked = new Set(related(s, pid));
  const rank = e => e.place === pid ? 0 : down.includes(e.place) ? 1 : linked.has(e.id) ? 2 : 3;
  const L = loreOf(s).filter(e => ["npc", "faction", "god", "event", "battle"].includes(e.kind) && ((e.place && area.has(e.place)) || linked.has(e.id)))
    .filter(e => !(e.kind === "event" && e.status === "resuelto") && !(e.kind === "npc" && e.vital === "muerto" && rank(e) > 0))
    .sort((a, b) => rank(a) - rank(b));
  return {
    path, npc: L.filter(e => e.kind === "npc"), faction: L.filter(e => e.kind === "faction"),
    event: L.filter(e => e.kind === "event").sort((a, b) => (a.status === "activo" ? 0 : 1) - (b.status === "activo" ? 0 : 1)),
    other: L.filter(e => e.kind === "god" || e.kind === "battle"),
    scenes: (s.scenes || []).filter(x => x.place === pid || down.includes(x.place)),
    near: rank
  };
}

/** Cambia el estado de una entrada y lo apunta en la sesión abierta («¿qué ha cambiado?»). */
export function markChange(id, f, v) {
  store.commit("lore", s => {
    const e = entry(s, id); if (!e || e[f] === v) return;
    const from = e[f] || (f === "vital" ? "vivo" : "neutral");
    e[f] = v;
    const l = liveSession(s); if (!l) return;
    l.changes = (l.changes || []).filter(c => !(c.id === id && c.f === f));
    const first = (l.changes0 = l.changes0 || {})[id + "|" + f] ??= from;  // estado al empezar la sesión
    if (first !== v) l.changes.push({ id, name: e.name, f, v, from: first, at: Date.now() });
  });
}
export const changesOf = l => (l && l.changes) || [];
export const changeText = c => `${c.name}: ${stateLabel(c.f, c.from)} → ${stateLabel(c.f, c.v)}`;

/** Entradas que conviene repasar al cerrar: las que han salido, las de los lugares visitados y las ya cambiadas. */
export function sessionCast(s) {
  const l = liveSession(s); if (!l) return [];
  const ids = new Set([...(l.touched || []), ...changesOf(l).map(c => c.id)]);
  (l.visited || []).forEach(pid => { if (placeOf(s, pid)) { const c = contextOf(s, pid); [...c.npc, ...c.faction].filter(e => c.near(e) < 2).forEach(e => ids.add(e.id)); } });
  return [...ids].map(id => entry(s, id)).filter(e => e && fieldsOf(e.kind).length);
}
