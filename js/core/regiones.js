// Regiones del mapa del mundo: el máster trocea el mapa grande en zonas dibujadas a mano.
// Cada región tiene su contorno (en coordenadas 0–1 del mapa global), color, textos y, si quiere,
// su propio mapa detallado. Los lugares siguen guardando su posición global; dentro de una región
// con mapa propio se pasan de unas coordenadas a otras con el recuadro de la región.
import { store, uid } from "./store.js";

export const REG_COLORS = ["#d6aa4e", "#6f9a3d", "#4f8fc0", "#b0563c", "#8a63c4", "#3f9a8c", "#c4708f", "#9a8a5a"];

export const regionsOf = s => (s.world && s.world.regions) || [];
export const regionById = (s, id) => regionsOf(s).find(r => r.id === id);
export const seeRegion = (s, r, dm) => dm || !!r.visible;

/** Recuadro de la región (en 0–1 del mapa global), con un pequeño margen. */
export function bboxOf(r, pad = 0.02) {
  const xs = r.pts.map(p => p.x), ys = r.pts.map(p => p.y);
  const x0 = Math.max(0, Math.min(...xs) - pad), y0 = Math.max(0, Math.min(...ys) - pad);
  const x1 = Math.min(1, Math.max(...xs) + pad), y1 = Math.min(1, Math.max(...ys) + pad);
  return { x0, y0, w: Math.max(0.01, x1 - x0), h: Math.max(0.01, y1 - y0) };
}
/** ¿Está el punto (global) dentro del contorno? */
export function inside(r, x, y) {
  let ok = false; const P = r.pts;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = P[i], b = P[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) ok = !ok;
  }
  return ok;
}
export const regionAt = (s, x, y, dm) => regionsOf(s).filter(r => seeRegion(s, r, dm)).find(r => inside(r, x, y));
export const toLocal = (r, x, y) => { const b = bboxOf(r); return { x: (x - b.x0) / b.w, y: (y - b.y0) / b.h }; };
export const toGlobal = (r, x, y) => { const b = bboxOf(r); return { x: b.x0 + x * b.w, y: b.y0 + y * b.h }; };
export const centroid = r => ({ x: r.pts.reduce((a, p) => a + p.x, 0) / r.pts.length, y: r.pts.reduce((a, p) => a + p.y, 0) / r.pts.length });
/** Lugares de una región (incluidos los de detalle, que solo se ven dentro). */
/** Paquete de mapas (data/mapas.js REGIONS) de la región donde está un lugar (subiendo por los lugares que lo contienen). */
export function regionPackOf(s, placeId) {
  let p = s.world.places.find(x => x.id === placeId), n = 0;
  while (p && p.parent && n++ < 10) p = s.world.places.find(x => x.id === p.parent);
  if (!p) return "";
  const r = regionsOf(s).find(x => x.id === p.region) || regionsOf(s).find(x => inside(x, p.x, p.y));
  return (r && r.pack) || "";
}
export const placesIn = (s, r) => s.world.places.filter(p => !p.parent && (p.region === r.id || (!p.region && inside(r, p.x, p.y))));

export function addRegion(pts) {
  const id = uid("region"), n = regionsOf(store.get()).length;
  store.commit("map", s => { s.world.regions = s.world.regions || []; s.world.regions.push({ id, name: `Región ${n + 1}`, color: REG_COLORS[n % REG_COLORS.length], pts, visible: false, summary: "", secret: "" }); });
  return id;
}
export const editRegion = (id, fn, label = "map") => store.commit(label, s => { const r = (s.world.regions || []).find(x => x.id === id); if (r) fn(r, s); });
export const deleteRegion = id => store.commit("map", s => {
  s.world.regions = (s.world.regions || []).filter(r => r.id !== id);
  s.world.places.forEach(p => { if (p.region === id) { delete p.region; } });
});
