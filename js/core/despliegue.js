// Despliegue inicial de una situación táctica.
// El máster marca en el mapa el punto de inicio del grupo y un radio en casillas. Al cargar la escena, cada jugador,
// por turnos, coloca su figura donde quiera dentro de esa zona según lo que ve (delante, detrás, a cubierto…) y pulsa
// «Listo». Cuando todos están colocados (o el máster lo da por terminado), empieza la escena o el combate.
// Regla de la mesa (no viene del SRD): el SRD no regula cómo se coloca el grupo antes de la iniciativa.
import { store } from "./store.js";
import { TERRAIN, PROPS } from "../data/mapas.js";

const key = (c, r) => c + "," + r;
export const DEPLOY_RAD = 2;

/** Despliegue en curso (o null). */
export const deployOf = s => (s.board && s.board.deploy && s.board.deploy.on && s.board.combat !== "live" && s.board.combat !== "init") ? s.board.deploy : null;

/** Casillas de la zona: a «rad» casillas del punto de inicio (diagonales incluidas), sin muros ni objetos macizos. */
export function zoneCells(s, d = deployOf(s)) {
  const g = s.board, out = new Set(); if (!g || !d) return out;
  for (let r = d.r - d.rad; r <= d.r + d.rad; r++) for (let c = d.c - d.rad; c <= d.c + d.rad; c++) {
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) continue;
    const T = TERRAIN[(g.terrain || {})[key(c, r)]];
    if (T && (T.wall || T.haz || T === TERRAIN.aguaprof)) continue;
    if ((g.props || []).some(p => p.c === c && p.r === r && ((PROPS[p.k] || {}).block || (PROPS[p.k] || {}).trap))) continue;
    out.add(key(c, r));
  }
  return out;
}
/** Orden en el que se colocan: el de las figuras del grupo en la mesa. */
export const deployOrder = s => (s.tokens || []).filter(t => t.kind === "pc");
export const isReady = (t, d) => !!(t.eco && t.eco.dep === d.id);
/** A quién le toca colocarse ahora (null si ya están todos). */
export function placer(s) {
  const d = deployOf(s); if (!d) return null;
  return deployOrder(s).find(t => !isReady(t, d)) || null;
}
/** Mapa de casillas para pintar la zona y validar el arrastre (mismo formato que el alcance de movimiento). */
export function zoneReach(s, t) {
  const d = deployOf(s); if (!d || !t) return null;
  const cells = new Map(), from = key(t.c, t.r);
  zoneCells(s, d).forEach(k => {
    const [c, r] = k.split(",").map(Number);
    const occ = s.tokens.some(x => x.id !== t.id && x.c === c && x.r === r);
    cells.set(k, { cost: k === from ? 0 : 0.1, dash: false, dif: false, occ, prev: k === from ? null : from });
  });
  if (!cells.has(from)) cells.set(from, { cost: 0, dash: false, dif: false, occ: false, prev: null });
  return { from: { c: t.c, r: t.r }, speed: 0, walk: 0, max: 0, prone: false, stopped: null, cells, deploy: true };
}

/** El máster abre el despliegue (al cargar una escena se abre solo si tiene punto de inicio). */
export function startDeploy(c, r, rad = DEPLOY_RAD) {
  store.commit("board", s => { if (s.board) s.board.deploy = { id: "dp" + Date.now().toString(36), c, r, rad, on: true }; });
}
export const endDeploy = () => store.commit("board", s => { if (s.board && s.board.deploy) s.board.deploy.on = false; });
/** «Listo»: el jugador (o el máster por él) da por buena su posición. */
export function markReady(tokId, v = true) {
  store.commit("token", s => {
    const d = deployOf(s), t = s.tokens.find(x => x.id === tokId); if (!d || !t) return;
    t.eco = { ...(t.eco || {}), dep: v ? d.id : null };
  });
}
/** Lleva a la zona a las figuras del grupo que estén fuera (al abrir el despliegue a mano). */
export function gatherInZone() {
  store.commit("board", s => {
    const d = deployOf(s); if (!d) return;
    const free = [...zoneCells(s, d)].filter(k => !s.tokens.some(t => key(t.c, t.r) === k));
    free.sort((a, b) => { const [ac, ar] = a.split(",").map(Number), [bc, br] = b.split(",").map(Number); return Math.max(Math.abs(ac - d.c), Math.abs(ar - d.r)) - Math.max(Math.abs(bc - d.c), Math.abs(br - d.r)); });
    for (const t of deployOrder(s)) {
      if (zoneCells(s, d).has(key(t.c, t.r))) continue;
      const k = free.shift(); if (!k) break;
      const [c, r] = k.split(",").map(Number); t.c = c; t.r = r;
    }
  });
}
