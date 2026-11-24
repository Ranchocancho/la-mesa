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

/* ---------- Distancia y días de viaje (Hito 77) ----------
   Escala: el máster dice cuántos km mide de ancho el mapa del mundo (world.scaleKm; si no, 600 km).
   Días: «Ritmo de viaje» del SRD 5.2.1 (por día: lento 27 km, normal 36 km, rápido 45 km). Es una estimación por la línea recta
   entre paradas; el terreno, los caminos y las monturas los ajusta el máster como siempre. */
export const PACES = { lento: ["Lento", 27], normal: ["Normal", 36], rapido: ["Rápido", 45] };
export const DEFAULT_KM = 600;
export const scaleKm = s => +(s.world && s.world.scaleKm) || DEFAULT_KM;
export const paceOf = s => (s.world && PACES[s.world.pace]) ? s.world.pace : "normal";
function mapAspect(s) { const w = s.world || {}; if (w.map && w.mapW && w.mapH) return w.mapH / w.mapW; return 1000 / 1600; }
/** Kilómetros de una lista de puntos (0–1 del mapa global). */
export function kmOf(s, pts) {
  const W = scaleKm(s), H = W * mapAspect(s); let d = 0;
  for (let i = 1; i < (pts || []).length; i++) d += Math.hypot((pts[i].x - pts[i - 1].x) * W, (pts[i].y - pts[i - 1].y) * H);
  return d;
}
export const daysOf = (s, km, pace) => km / PACES[pace || paceOf(s)][1];
const fmt = (n, d = 0) => n.toLocaleString("es-ES", { maximumFractionDigits: d, minimumFractionDigits: 0 });
/** «84 km · 2,3 días» */
export function tripText(s, pts, pace) {
  const km = kmOf(s, pts); if (km < 0.5) return "";
  const dd = daysOf(s, km, pace); return `${fmt(km)} km · ${dd < 1 ? `${fmt(dd * 8, 1)} h de marcha` : `${fmt(dd, 1)} día${dd >= 1.05 ? "s" : ""}`}`;
}
export const setScale = (km, pace) => store.commit("map", s => { if (km != null) s.world.scaleKm = Math.max(1, +km || DEFAULT_KM); if (pace) s.world.pace = pace; });
