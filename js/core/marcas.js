// Marcas tácticas en el suelo (Hito 82), comunes a la mesa 2D y 3D:
// - el borde de las zonas peligrosas (lava, brasas, brea, hielo, abismo…) y de los puentes,
// - la cobertura que da cada objeto (media o de tres cuartos, SRD),
// - en qué estado está cada trampa: oculta (solo el máster), descubierta o ya disparada.
import { TERRAIN, PROPS } from "../data/mapas.js";

export const HAZ_COLOR = { fire: "#ff7a2a", lava: "#ff5a14", slip: "#9fe6ff", fall: "#ffd24a", bridge: "#e8b860" };
export const HAZ_TEXT = { fire: "Arde: quien entra empieza a arder", lava: "Lava", slip: "Resbala", fall: "Caída", bridge: "Puente: borde con peligro" };
// lados: 0 arriba, 1 derecha, 2 abajo, 3 izquierda
const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const terOf = (g, c, r) => (g.terrain || {})[c + "," + r] || "piedra";
const bridged = (g, c, r) => (g.props || []).some(p => p.c === c && p.r === r && (PROPS[p.k] || {}).bridge);
/** Tipo de peligro del terreno de esa casilla (o null). Un puente lo anula. */
export function hazOfCell(g, c, r) {
  const t = TERRAIN[terOf(g, c, r)];
  return t && t.haz && !bridged(g, c, r) ? t.haz : null;
}

/** Bordes de las zonas peligrosas: [{ c, r, side, kind }] por dentro de la casilla peligrosa. */
export function hazardEdges(g) {
  const out = [];
  if (!g || !g.cols) return out;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const k = hazOfCell(g, c, r); if (!k) continue;
    SIDES.forEach(([dc, dr], side) => {
      const C = c + dc, R = r + dr;
      if (C < 0 || R < 0 || C >= g.cols || R >= g.rows) return;
      const n = TERRAIN[terOf(g, C, R)];
      if (n && n.wall) return;
      if (hazOfCell(g, C, R) !== k) out.push({ c, r, side, kind: k });
    });
  }
  // Puentes: el borde que da al agua, la lava o el abismo
  for (const p of g.props || []) {
    if (!(PROPS[p.k] || {}).bridge) continue;
    SIDES.forEach(([dc, dr], side) => {
      const C = p.c + dc, R = p.r + dr, n = TERRAIN[terOf(g, C, R)];
      if (C < 0 || R < 0 || C >= g.cols || R >= g.rows) return;
      if (bridged(g, C, R)) return;
      if (n && (n.haz || n.liquid)) out.push({ c: p.c, r: p.r, side, kind: "bridge" });
    });
  }
  return out;
}

/** Cobertura que da un objeto: "half" | "3q" | null. */
export const coverOf = p => (PROPS[p.k] || {}).cover || null;
export const COVER_TEXT = { half: "Cobertura media: +2 a la CA y a las salvaciones de Destreza", "3q": "Cobertura de tres cuartos: +5 a la CA y a las salvaciones de Destreza" };

/** Estado de una trampa: "oculta" | "descubierta" | "disparada" | null si no es trampa. */
export function trapState(p) {
  const v = PROPS[p.k] || {};
  if (!v.trap) return null;
  if (p.sprung) return "disparada";
  return (p.hidden ?? v.hidden) ? "oculta" : "descubierta";
}
export const TRAP_LOOK = {
  oculta: { color: "#b07aff", icon: "👁", text: "Trampa oculta: solo la ve el máster" },
  descubierta: { color: "#ffb02a", icon: "⚠", text: "Trampa descubierta: aún puede saltar" },
  disparada: { color: "#8a7a70", icon: "✖", text: "Trampa disparada" }
};
