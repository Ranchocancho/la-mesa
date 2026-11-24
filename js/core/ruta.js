// Ruta del grupo (Hito 74): dónde está el grupo en el mapa del mundo y el camino que va haciendo.
//   · world.party = { x, y, p? }: la posición actual (0–1 del mapa global; p = lugar, si está en uno). Dura entre sesiones.
//   · sesión.route = [{ x, y, p?, at }]: los pasos de esa sesión, en orden. Así cada sesión tiene su tramo.
// Lo mueve el máster (arrastrando la ficha del grupo, o con «El grupo está aquí» en un lugar); al marcar un lugar
// como «aquí» desde la partida, el grupo también va allí.
import { store } from "./store.js";
import { liveSession, pastSessions, sessionName } from "./sesiones.js";

export const partyPos = s => (s.world && s.world.party) || null;
/** Mueve al grupo (y apunta el paso en la sesión en curso). */
const hist = []; // posiciones anteriores (en esta pestaña), para deshacer aunque no haya sesión abierta
export const canUndoParty = () => hist.length > 0;
export function moveParty(x, y, placeId = null) {
  hist.push(JSON.parse(JSON.stringify(store.get().world.party || null))); if (hist.length > 50) hist.shift();
  store.commit("map", s => {
    const p = { x: +(+x).toFixed(4), y: +(+y).toFixed(4), ...(placeId ? { p: placeId } : {}) };
    const prev = s.world.party; s.world.party = p;
    const l = liveSession(s); if (!l) return;
    l.route = l.route || [];
    if (!l.route.length && prev) l.route.push({ ...prev, at: Date.now() - 1 }); // de dónde salió el grupo
    const last = l.route[l.route.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 0.002) l.route.push({ ...p, at: Date.now() });
  });
}
/** Lleva al grupo a un lugar del mapa. */
export function partyToPlace(s, placeId) { const pl = (s.world.places || []).find(x => x.id === placeId); if (pl) moveParty(pl.x, pl.y, pl.id); }
/** Deshacer el último movimiento del grupo: vuelve adonde estaba y quita ese paso de la ruta de la sesión. */
export function undoStep() {
  const prev = hist.length ? hist.pop() : undefined;
  store.commit("map", s => {
    const l = liveSession(s), cur = s.world.party;
    if (l && l.route && l.route.length && cur) { const last = l.route[l.route.length - 1]; if (Math.hypot(last.x - cur.x, last.y - cur.y) < 0.002) l.route.pop(); }
    if (prev !== undefined) s.world.party = prev;
    else if (l && l.route && l.route.length) { const b = l.route[l.route.length - 1]; s.world.party = { x: b.x, y: b.y, ...(b.p ? { p: b.p } : {}) }; }
  });
}
/** Rutas para dibujar: la de la sesión en curso y las anteriores (de la más nueva a la más vieja). */
export function routesOf(s) {
  const l = liveSession(s), out = [];
  if (l && (l.route || []).length) out.push({ id: l.id, name: sessionName(l), pts: l.route, live: true });
  pastSessions(s).forEach(x => { if ((x.route || []).length) out.push({ id: x.id, name: sessionName(x), pts: x.route, live: false }); });
  return out;
}
