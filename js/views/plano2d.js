// Plano 2D al estilo de Foundry VTT (Hito 108). Tres capas que se pintan en lienzos y se ponen bajo/sobre el SVG:
//  1) Suelo: cada terreno con su textura; los naturales se funden con los vecinos con bordes irregulares (no hay
//     cuadros), los construidos (losas, madera, adoquín…) quedan nítidos; sombra de oclusión al pie de los muros y
//     muros con su canto iluminado.
//  2) Oscuridad: la escena se oscurece según su ambiente y cada luz la «abre» con su radio brillante y su radio tenue,
//     cortada por los muros y las puertas cerradas (polígono de visibilidad, como Foundry), con borde suave.
//  3) Resplandor: el color de cada luz, sumado encima (se anima con CSS: las antorchas parpadean).
import { TERRAIN, PROPS, doorBlocksSight } from "../data/mapas.js";
import { terrainCanvas } from "./texturas.js";
// Rango de derrame (el mismo orden que en la mesa 3D, suelo3d.js; copiado para no cargar three.js en el plano)
const SPREAD = { hierbalta: 9, juncos: 9, hierba: 8, musgo: 8, flores: 8, hojarasca: 7, raices: 7, nieve: 7, ceniza: 6, arena: 6, barro: 5, removida: 5, pisoteada: 5, tierra: 4, camino: 4, escombros: 4, paja: 4, cueva: 3, rocanevada: 3, volcanica: 3, brasas: 3.5, piedra: 2, adoquin: 2, lava: 1 };
import { lightSources } from "../core/vision.js";

const CRISP = new Set(["piedra", "madera", "adoquin", "marmol", "losas", "alfombra", "muelle", "cubierta", "plataforma", "pasarela", "runas", "railes", "paja"]);
const WATER = new Set(["agua", "aguaprof"]);
const key = (c, r) => c + "," + r;

function rng(seed) { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; s = s || 9; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const pat = (g, k, P) => { const tc = terrainCanvas(k), p = g.createPattern(tc, "repeat"); p.setTransform(new DOMMatrix().scale((2 * P) / tc.width)); return p; };

/** Suelo pintado. P = píxeles por casilla. */
export function floorCanvas(grid, P) {
  const W = grid.cols * P, H = grid.rows * P, T = grid.terrain || {}, R = rng((grid.scene || grid.name || "mesa") + "|2d");
  const ter = (c, r) => T[key(c, r)] || "piedra", isW = (c, r) => !!(TERRAIN[ter(c, r)] || {}).wall;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  const kinds = new Map(); for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) { const k = ter(c, r); if (!(TERRAIN[k] || {}).wall) (kinds.get(k) || kinds.set(k, []).get(k)).push([c, r]); }
  // 1) Base nítida: cada casilla con su terreno
  for (const [k, list] of kinds) { g.fillStyle = pat(g, k, P); list.forEach(([c, r]) => g.fillRect(c * P, r * P, P + 0.5, P + 0.5)); }
  // 2) Los terrenos naturales se derraman sobre sus vecinos con bordes irregulares (de menor a mayor rango)
  const organic = [...kinds.keys()].filter(k => !CRISP.has(k)).sort((a, b) => (SPREAD[a] || (WATER.has(a) ? 0.5 : 1)) - (SPREAD[b] || (WATER.has(b) ? 0.5 : 1)));
  const layer = document.createElement("canvas"); layer.width = W; layer.height = H; const L = layer.getContext("2d");
  const mask = document.createElement("canvas"); mask.width = W; mask.height = H; const Mk = mask.getContext("2d");
  for (const k of organic) {
    Mk.clearRect(0, 0, W, H); Mk.fillStyle = "#fff";
    for (const [c, r] of kinds.get(k)) {
      Mk.fillRect(c * P, r * P, P, P);
      // borde irregular: manchas que asoman a las casillas vecinas de otro terreno
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = ter(c + dc, r + dr); if (n === k || (TERRAIN[n] || {}).wall || c + dc < 0 || r + dr < 0 || c + dc >= grid.cols || r + dr >= grid.rows) continue;
        if ((SPREAD[n] || 0) > (SPREAD[k] || 0) && !CRISP.has(n)) continue; // el de más rango se derrama él
        for (let i = 0; i < 3; i++) { const t = R(), x = (c + 0.5 + dc * (0.5 + R() * 0.28) + (dr ? t - 0.5 : 0)) * P, y = (r + 0.5 + dr * (0.5 + R() * 0.28) + (dc ? t - 0.5 : 0)) * P; Mk.beginPath(); Mk.arc(x, y, P * (0.12 + R() * 0.2), 0, 7); Mk.fill(); } }
    }
    L.clearRect(0, 0, W, H); L.globalCompositeOperation = "source-over"; L.filter = `blur(${Math.round(P * 0.16)}px)`; L.drawImage(mask, 0, 0); L.filter = "none";
    L.globalCompositeOperation = "source-in"; L.fillStyle = pat(L, k, P); L.fillRect(0, 0, W, H); L.globalCompositeOperation = "source-over";
    g.drawImage(layer, 0, 0);
  }
  // 3) Agua: más oscura donde es profunda y una orilla clara donde toca tierra
  if (kinds.has("aguaprof")) { g.save(); g.globalAlpha = 0.35; g.fillStyle = "#06121c"; kinds.get("aguaprof").forEach(([c, r]) => g.fillRect(c * P, r * P, P, P)); g.restore(); }
  // 4) Oclusión al pie de los muros (sombra suave hacia el suelo)
  Mk.clearRect(0, 0, W, H); Mk.fillStyle = "#000";
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) if (isW(c, r)) Mk.fillRect(c * P, r * P, P, P);
  L.clearRect(0, 0, W, H); L.filter = `blur(${Math.round(P * 0.35)}px)`; L.globalAlpha = 0.75; L.drawImage(mask, 0, Math.round(P * 0.08)); L.filter = "none"; L.globalAlpha = 1;
  g.drawImage(layer, 0, 0);
  // 5) Muros: textura propia, oscurecida, con el canto iluminado donde dan al suelo
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    if (!isW(c, r)) continue; const k = ter(c, r), ty = TERRAIN[k] || {};
    if (ty.void) { const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => !isW(c + dc, r + dr) && c + dc >= 0 && r + dr >= 0 && c + dc < grid.cols && r + dr < grid.rows); g.fillStyle = "#0b0a09"; g.fillRect(c * P, r * P, P + 0.5, P + 0.5); if (!touches) continue; }
    else { g.fillStyle = pat(g, k, P); g.fillRect(c * P, r * P, P + 0.5, P + 0.5); g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(c * P, r * P, P + 0.5, P + 0.5); }
    g.lineWidth = Math.max(2, P * 0.07);
    [[0, -1, 0, 0, 1, 0], [1, 0, 1, 0, 1, 1], [0, 1, 0, 1, 1, 1], [-1, 0, 0, 0, 0, 1]].forEach(([dc, dr, x0, y0, x1, y1]) => {
      const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows || isW(nc, nr)) return;
      g.strokeStyle = "rgba(255,236,200,.38)"; g.beginPath(); g.moveTo((c + x0) * P, (r + y0) * P); g.lineTo((c + x1) * P, (r + y1) * P); g.stroke();
      g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = Math.max(1, P * 0.03); const o = 0.06; g.beginPath(); g.moveTo((c + x0 - dc * o) * P, (r + y0 - dr * o) * P); g.lineTo((c + x1 - dc * o) * P, (r + y1 - dr * o) * P); g.stroke(); g.lineWidth = Math.max(2, P * 0.07);
    });
  }
  return cv;
}
export const floorSig = grid => [grid.cols, grid.rows, JSON.stringify(grid.terrain || {}), grid.scene || grid.name || ""].join("|");

/* ---------- Luz ---------- */
/** Segmentos que cortan la luz: aristas entre muro (o puerta cerrada) y suelo, y el borde del mapa. En casillas. */
function blockers(grid) {
  const T = grid.terrain || {}, doors = new Set((grid.props || []).filter(doorBlocksSight).map(p => key(p.c, p.r)));
  const solid = (c, r) => c < 0 || r < 0 || c >= grid.cols || r >= grid.rows || !!(TERRAIN[T[key(c, r)]] || {}).wall || doors.has(key(c, r));
  const segs = [];
  for (let r = -1; r <= grid.rows; r++) for (let c = -1; c <= grid.cols; c++) {
    if (!solid(c, r)) continue;
    if (!solid(c, r - 1) && r - 1 >= 0) segs.push([c, r, c + 1, r]); if (!solid(c, r + 1) && r + 1 < grid.rows) segs.push([c, r + 1, c + 1, r + 1]);
    if (!solid(c - 1, r) && c - 1 >= 0) segs.push([c, r, c, r + 1]); if (!solid(c + 1, r) && c + 1 < grid.cols) segs.push([c + 1, r, c + 1, r + 1]);
  }
  return segs;
}
/** Polígono de visibilidad desde (x, y) con radio rad (casillas), como Foundry: rayos a los extremos de los segmentos. */
function visPoly(x, y, rad, segs) {
  const near = segs.filter(s => Math.min(s[0], s[2]) <= x + rad && Math.max(s[0], s[2]) >= x - rad && Math.min(s[1], s[3]) <= y + rad && Math.max(s[1], s[3]) >= y - rad);
  const angs = []; for (let i = 0; i < 48; i++) angs.push(i / 48 * Math.PI * 2);
  for (const s of near) for (const [px, py] of [[s[0], s[1]], [s[2], s[3]]]) { const a = Math.atan2(py - y, px - x); angs.push(a - 1e-4, a, a + 1e-4); }
  angs.sort((a, b) => a - b);
  const pts = [];
  for (const a of angs) {
    const dx = Math.cos(a), dy = Math.sin(a); let best = rad * 1.05;
    for (const s of near) {
      const ex = s[2] - s[0], ey = s[3] - s[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
      const t = ((s[0] - x) * ey - (s[1] - y) * ex) / den, u = ((s[0] - x) * dy - (s[1] - y) * dx) / den;
      if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
    }
    pts.push([x + dx * best, y + dy * best]);
  }
  return pts;
}
const DARK = { dia: 0, interior: 0.55, penumbra: 0.66, noche: 0.8, oscuro: 0.92 };
/** Oscuridad y resplandor. P = píxeles por casilla (bajo: la luz es suave de por sí). dm: el máster ve con menos oscuridad. */
export function lightCanvases(grid, tokens, P, { dm = false } = {}) {
  const W = grid.cols * P, H = grid.rows * P, base = grid.light === "bright" ? 0 : grid.light === "dark" ? 0.88 : grid.light === "dim" ? 0.6 : DARK[grid.ambient || "interior"] ?? 0.55;
  const amb = dm ? base * 0.55 : base, srcs = lightSources(grid, tokens);
  if (amb <= 0.02 && !srcs.length) return null;
  const segs = blockers(grid);
  const dark = document.createElement("canvas"); dark.width = W; dark.height = H; const d = dark.getContext("2d");
  const glow = document.createElement("canvas"); glow.width = W; glow.height = H; const gl = glow.getContext("2d");
  d.fillStyle = `rgba(4,5,10,${amb})`; d.fillRect(0, 0, W, H);
  for (const s of srcs) {
    const x = s.c + 0.5, y = s.r + 0.5, rad = s.d + 0.5, poly = visPoly(x, y, rad, segs);
    const path = new Path2D(); poly.forEach(([px, py], i) => i ? path.lineTo(px * P, py * P) : path.moveTo(px * P, py * P)); path.closePath();
    const cx = x * P, cy = y * P, R0 = rad * P, kb = Math.min(0.95, (s.b + 0.5) / rad);
    d.save(); d.clip(path); d.globalCompositeOperation = "destination-out";
    const gr = d.createRadialGradient(cx, cy, 0, cx, cy, R0); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(kb, "rgba(0,0,0,.95)"); gr.addColorStop(Math.min(0.99, kb + (1 - kb) * 0.5), "rgba(0,0,0,.5)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    d.fillStyle = gr; d.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2); d.restore();
    gl.save(); gl.clip(path); gl.globalCompositeOperation = "lighter";
    const gg = gl.createRadialGradient(cx, cy, 0, cx, cy, R0 * 0.85); gg.addColorStop(0, hexA(s.color, 0.42)); gg.addColorStop(kb * 0.8, hexA(s.color, 0.18)); gg.addColorStop(1, hexA(s.color, 0));
    gl.fillStyle = gg; gl.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2); gl.restore();
  }
  // bordes de la sombra suaves (como «Gradual Illumination»)
  const soft = document.createElement("canvas"); soft.width = W; soft.height = H; const so = soft.getContext("2d"); so.filter = `blur(${Math.max(2, Math.round(P * 0.25))}px)`; so.drawImage(dark, 0, 0);
  return { dark: soft, glow, flicker: srcs.some(s => /antorcha|hoguera|brasero|velas|forja/.test(s.k || "")) };
}
export const lightSig = (grid, tokens, dm) => [grid.cols, grid.rows, grid.ambient, grid.light, dm, JSON.stringify(grid.terrain || {}).length, JSON.stringify((grid.props || []).map(p => [p.k, p.c, p.r, p.open])), JSON.stringify(tokens.filter(t => t.light).map(t => [t.c, t.r, t.light, t.hidden]))].join("|");
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

/** Hito 109: sombras de la línea de visión, como en Foundry. Dentro de lo que se ve, lo que queda tapado por un muro
 *  desde todos los ojos se vela con un borde nítido (la niebla por casillas sola deja esquinas «a cuadros»). */
export function sightShade(grid, vis, P = 16) {
  const eyes = (vis.eyes || []).filter(e => !e.blind); if (!eyes.length) return null;
  const W = grid.cols * P, H = grid.rows * P, segs = blockers(grid), rad = Math.max(grid.cols, grid.rows) * 1.5;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
  g.fillStyle = "rgba(9,10,17,.6)"; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000";
  for (const e of eyes) { const poly = visPoly(e.c + 0.5, e.r + 0.5, rad, segs); g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(x * P, y * P) : g.moveTo(x * P, y * P)); g.closePath(); g.fill(); }
  // solo dentro de las casillas que se ven (fuera ya está la niebla)
  const m = document.createElement("canvas"); m.width = W; m.height = H; const mg = m.getContext("2d"); mg.fillStyle = "#fff";
  vis.forEach(k => { const [c, r] = k.split(",").map(Number); mg.fillRect(c * P - 1, r * P - 1, P + 2, P + 2); });
  g.globalCompositeOperation = "destination-in"; g.drawImage(m, 0, 0);
  const out = document.createElement("canvas"); out.width = W; out.height = H; const o = out.getContext("2d");
  try { o.filter = `blur(${Math.max(1, Math.round(P * 0.08))}px)`; } catch (e) { /* nada */ } o.drawImage(cv, 0, 0);
  return out;
}
