// Texturas de terreno dibujadas por código (sin descargas), repetibles sin costuras.
// Las usa el plano 2D (como patrones) y la mesa 3D (como textura y relieve).
import { TERRAIN } from "../data/mapas.js";

const SIZE = 256;
const cache = new Map(), urls = new Map();

function rng(seed) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
const hex = (c, k = 0) => { const n = parseInt(c.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v + k * 255))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
/** Dibuja repitiendo en los bordes para que la textura no tenga costuras. */
const wrap = (fn, x, y, m) => { for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) if (x + dx > -m && x + dx < SIZE + m && y + dy > -m && y + dy < SIZE + m) fn(x + dx, y + dy); };
function grain(g, R, amt, scale = 1) {
  const img = g.getImageData(0, 0, SIZE, SIZE), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (R() - 0.5) * amt * 255 * scale; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  g.putImageData(img, 0, 0);
}
function blotches(g, R, color, n, rMin, rMax, alpha) {
  for (let i = 0; i < n; i++) {
    const x = R() * SIZE, y = R() * SIZE, r = rMin + R() * (rMax - rMin);
    wrap((X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, r); gr.addColorStop(0, color.replace(")", `,${alpha})`).replace("rgb", "rgba")); gr.addColorStop(1, color.replace(")", ",0)").replace("rgb", "rgba")); g.fillStyle = gr; g.fillRect(X - r, Y - r, r * 2, r * 2); }, x, y, r);
  }
}
function stones(g, R, { rows, cols, base, var: vv, mortar, jitter = 0.15, offset = 0.5, round = 3, gap = 3 }) {
  g.fillStyle = mortar; g.fillRect(0, 0, SIZE, SIZE);
  const h = SIZE / rows, w = SIZE / cols;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols + 1; c++) {
    const x = c * w + (r % 2 ? offset * w : 0), y = r * h, k = (R() - 0.5) * vv;
    const ww = w * (1 - jitter * R()), hh = h * (1 - jitter * R() * 0.5);
    wrap((X, Y) => { g.fillStyle = hex(base, k); roundRect(g, X + gap / 2, Y + gap / 2, ww - gap, hh - gap, round); g.fill();
      g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(X + gap, Y + gap, ww - gap * 2, 2); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(X + gap, Y + hh - gap - 2, ww - gap * 2, 2); }, x, y, w);
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function strokes(g, R, n, len, colors, width = 1.4, lean = 0.4) {
  for (let i = 0; i < n; i++) {
    const x = R() * SIZE, y = R() * SIZE, l = len * (0.5 + R()), a = -Math.PI / 2 + (R() - 0.5) * lean * 2;
    wrap((X, Y) => { g.strokeStyle = colors[Math.floor(R() * colors.length)]; g.lineWidth = width; g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + Math.cos(a) * l * 0.5 + (R() - .5) * 3, Y + Math.sin(a) * l * 0.5, X + Math.cos(a) * l, Y + Math.sin(a) * l); g.stroke(); }, x, y, l);
  }
}
function pebbles(g, R, n, rMin, rMax, colors) {
  for (let i = 0; i < n; i++) {
    const x = R() * SIZE, y = R() * SIZE, r = rMin + R() * (rMax - rMin), col = colors[Math.floor(R() * colors.length)], rot = R() * 3;
    wrap((X, Y) => { g.fillStyle = "rgba(0,0,0,.3)"; g.beginPath(); g.ellipse(X + 1, Y + 1.5, r, r * 0.75, rot, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); g.ellipse(X, Y, r, r * 0.75, rot, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.ellipse(X - r * .3, Y - r * .3, r * .4, r * .25, rot, 0, 7); g.fill(); }, x, y, r);
  }
}
function cracks(g, R, n, color, width = 1.2, steps = 6) {
  g.strokeStyle = color; g.lineWidth = width;
  for (let i = 0; i < n; i++) {
    let x = R() * SIZE, y = R() * SIZE; const pts = [[x, y]];
    for (let s = 0; s < steps; s++) { x += (R() - 0.5) * 40; y += (R() - 0.5) * 40; pts.push([x, y]); }
    wrap((X, Y) => { g.beginPath(); g.moveTo(X, Y); pts.slice(1).forEach(([a, b]) => g.lineTo(a - pts[0][0] + X, b - pts[0][1] + Y)); g.stroke(); }, pts[0][0], pts[0][1], 140);
  }
}
function planks(g, R, n, base, vertical = false) {
  const w = SIZE / n;
  for (let p = 0; p < n; p++) {
    const k = (R() - 0.5) * 0.12; g.fillStyle = hex(base, k);
    if (vertical) g.fillRect(p * w, 0, w, SIZE); else g.fillRect(0, p * w, SIZE, w);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(30,16,6,${0.06 + R() * 0.12})`; g.lineWidth = 0.6 + R() * 1.6; g.beginPath(); const o = p * w + R() * w;
      if (vertical) { g.moveTo(o, 0); g.bezierCurveTo(o + R() * 6 - 3, 85, o + R() * 6 - 3, 170, o, SIZE); } else { g.moveTo(0, o); g.bezierCurveTo(85, o + R() * 6 - 3, 170, o + R() * 6 - 3, SIZE, o); } g.stroke(); }
    g.fillStyle = "rgba(15,8,3,.7)"; if (vertical) g.fillRect(p * w, 0, 2, SIZE); else g.fillRect(0, p * w, SIZE, 2);
    const cut = R() * SIZE; g.fillStyle = "rgba(15,8,3,.55)"; if (vertical) g.fillRect(p * w, cut, w, 2); else g.fillRect(cut, p * w, 2, w);
    g.fillStyle = "rgba(20,12,6,.8)"; for (const o of [cut - 8, cut + 8]) { const a = ((o % SIZE) + SIZE) % SIZE; g.beginPath(); if (vertical) g.arc(p * w + w / 2, a, 1.6, 0, 7); else g.arc(a, p * w + w / 2, 1.6, 0, 7); g.fill(); }
  }
}

const DRAW = {
  piedra: (g, R) => { stones(g, R, { rows: 3, cols: 2, base: "#8d867c", var: 0.14, mortar: "#3a352f", jitter: 0.12, gap: 6, round: 5 }); grain(g, R, 0.06); cracks(g, R, 3, "rgba(40,35,30,.3)", 1, 4); },
  adoquin: (g, R) => { g.fillStyle = "#2a2622"; g.fillRect(0, 0, SIZE, SIZE); for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) { const x = c * 29 + (r % 2) * 14 + R() * 4, y = r * 29 + R() * 4; wrap((X, Y) => { g.fillStyle = hex("#6e6a64", (R() - 0.5) * 0.2); g.beginPath(); g.ellipse(X, Y, 12 + R() * 2, 11 + R() * 2, R() * 3, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.ellipse(X - 3, Y - 4, 6, 3, 0, 0, 7); g.fill(); }, x, y, 16); } grain(g, R, 0.06); },
  marmol: (g, R) => { g.fillStyle = "#cfc8bd"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(170,160,150)", 14, 20, 60, 0.35); for (let i = 0; i < 9; i++) cracks(g, R, 1, `rgba(90,85,80,${0.25 + R() * 0.3})`, 0.6 + R(), 9); g.strokeStyle = "rgba(60,55,50,.5)"; g.lineWidth = 2; g.strokeRect(1, 1, SIZE - 2, SIZE - 2); g.beginPath(); g.moveTo(SIZE / 2, 0); g.lineTo(SIZE / 2, SIZE); g.moveTo(0, SIZE / 2); g.lineTo(SIZE, SIZE / 2); g.stroke(); grain(g, R, 0.03); },
  madera: (g, R) => { planks(g, R, 5, "#7a5333"); grain(g, R, 0.05); },
  alfombra: (g, R) => { g.fillStyle = "#6e1f28"; g.fillRect(0, 0, SIZE, SIZE); g.strokeStyle = "#c9a14a"; g.lineWidth = 3; g.strokeRect(10, 10, SIZE - 20, SIZE - 20); g.strokeStyle = "#2a1a3a"; g.lineWidth = 6; g.strokeRect(20, 20, SIZE - 40, SIZE - 40);
    for (let y = 48; y < SIZE - 40; y += 40) for (let x = 48; x < SIZE - 40; x += 40) { g.fillStyle = (x + y) % 80 ? "#c9a14a" : "#2a3a6a"; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 12, y); g.lineTo(x, y + 12); g.lineTo(x - 12, y); g.closePath(); g.fill(); }
    grain(g, R, 0.08); strokes(g, R, 500, 2, ["rgba(0,0,0,.15)", "rgba(255,255,255,.06)"], 1, 2); },
  cueva: (g, R) => { g.fillStyle = "#4c463f"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(40,36,32)", 18, 15, 50, 0.5); blotches(g, R, "rgb(110,100,90)", 10, 10, 30, 0.25); pebbles(g, R, 30, 2, 5, ["#5a534b", "#3e3933"]); cracks(g, R, 6, "rgba(20,18,15,.5)", 1.5, 7); grain(g, R, 0.1); },
  escombros: (g, R) => { DRAW.piedra(g, R); pebbles(g, R, 70, 3, 11, ["#6e6860", "#57524b", "#827b72", "#4a453f"]); grain(g, R, 0.05); },
  hierba: (g, R) => { g.fillStyle = "#4a6a30"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(60,90,40)", 20, 20, 50, 0.5); blotches(g, R, "rgb(110,120,60)", 10, 15, 35, 0.3); strokes(g, R, 1400, 7, ["#3b5a24", "#5a7e36", "#6a8e3e", "#2f4a1c"], 1.2, 0.5); pebbles(g, R, 8, 1.2, 2, ["#e8d86a", "#e0e0f0", "#c86ac8"]); },
  hierbalta: (g, R) => { g.fillStyle = "#33501f"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(25,45,15)", 20, 15, 40, 0.6); strokes(g, R, 1800, 14, ["#2a4518", "#4a6e2a", "#5e7e34", "#1f3510", "#6a7a3a"], 1.6, 0.6); },
  tierra: (g, R) => { g.fillStyle = "#6e5a3f"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(90,72,50)", 22, 15, 45, 0.5); blotches(g, R, "rgb(130,110,80)", 10, 10, 30, 0.3); pebbles(g, R, 40, 1.5, 4, ["#857257", "#5a4a35", "#9a8a70"]); grain(g, R, 0.1); },
  camino: (g, R) => { DRAW.tierra(g, R); g.fillStyle = "rgba(160,140,105,.35)"; g.fillRect(0, 0, SIZE, SIZE); g.strokeStyle = "rgba(60,45,30,.35)"; g.lineWidth = 9; for (const x of [70, 186]) { g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, 90, x - 6, 170, x, SIZE); g.stroke(); } grain(g, R, 0.05); },
  arena: (g, R) => { g.fillStyle = "#c2a76e"; g.fillRect(0, 0, SIZE, SIZE); g.strokeStyle = "rgba(140,110,60,.35)"; g.lineWidth = 2; for (let y = 0; y < SIZE; y += 16) { g.beginPath(); for (let x = 0; x <= SIZE; x += 8) g.lineTo(x, y + Math.sin((x / SIZE) * Math.PI * 4 + y * 0.3) * 4); g.stroke(); } grain(g, R, 0.12); pebbles(g, R, 10, 1, 2.5, ["#8a7550", "#e8d8b0"]); },
  barro: (g, R) => { g.fillStyle = "#47382a"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(35,27,20)", 20, 15, 45, 0.6); blotches(g, R, "rgb(120,110,95)", 12, 6, 18, 0.35); grain(g, R, 0.07); },
  nieve: (g, R) => { g.fillStyle = "#e6ecf2"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(190,205,225)", 16, 20, 60, 0.45); blotches(g, R, "rgb(255,255,255)", 14, 10, 30, 0.6); grain(g, R, 0.04); },
  hielo: (g, R) => { g.fillStyle = "#b4d8e6"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(140,190,215)", 14, 20, 60, 0.45); blotches(g, R, "rgb(235,250,255)", 10, 10, 40, 0.5); cracks(g, R, 10, "rgba(255,255,255,.75)", 1.2, 6); cracks(g, R, 6, "rgba(80,130,160,.4)", 1, 5); },
  agua: (g, R) => { const gr = g.createLinearGradient(0, 0, SIZE, SIZE); gr.addColorStop(0, "#2f7a94"); gr.addColorStop(1, "#286a84"); g.fillStyle = gr; g.fillRect(0, 0, SIZE, SIZE); pebbles(g, R, 18, 3, 8, ["rgba(80,110,100,.5)", "rgba(60,90,80,.5)"]); g.strokeStyle = "rgba(200,240,255,.28)"; g.lineWidth = 1.5; for (let i = 0; i < 22; i++) { const x = R() * SIZE, y = R() * SIZE, l = 10 + R() * 26; wrap((X, Y) => { g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + l / 2, Y - 4, X + l, Y); g.stroke(); }, x, y, 40); } },
  aguaprof: (g, R) => { g.fillStyle = "#17405a"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(10,35,55)", 14, 30, 70, 0.6); g.strokeStyle = "rgba(160,210,240,.22)"; g.lineWidth = 1.5; for (let i = 0; i < 18; i++) { const x = R() * SIZE, y = R() * SIZE, l = 14 + R() * 30; wrap((X, Y) => { g.beginPath(); g.moveTo(X, Y); g.quadraticCurveTo(X + l / 2, Y - 5, X + l, Y); g.stroke(); }, x, y, 50); } },
  lava: (g, R) => { g.fillStyle = "#2a1410"; g.fillRect(0, 0, SIZE, SIZE); for (let i = 0; i < 26; i++) { const x = R() * SIZE, y = R() * SIZE, r = 14 + R() * 26; wrap((X, Y) => { g.fillStyle = hex("#3a1c14", (R() - 0.5) * 0.08); g.beginPath(); g.ellipse(X, Y, r, r * 0.8, R() * 3, 0, 7); g.fill(); }, x, y, r); }
    g.shadowColor = "#ffb030"; g.shadowBlur = 8; cracks(g, R, 14, "#ff7a1a", 3, 7); cracks(g, R, 10, "#ffd060", 1.2, 6); g.shadowBlur = 0; },
  abismo: (g, R) => { const gr = g.createRadialGradient(128, 128, 10, 128, 128, 180); gr.addColorStop(0, "#000"); gr.addColorStop(1, "#14110e"); g.fillStyle = gr; g.fillRect(0, 0, SIZE, SIZE); grain(g, R, 0.03); },
  muro: (g, R) => { stones(g, R, { rows: 6, cols: 3, base: "#5a554e", var: 0.14, mortar: "#1c1916", jitter: 0.1, gap: 4, round: 2 }); grain(g, R, 0.08); },
  muroladrillo: (g, R) => { stones(g, R, { rows: 10, cols: 4, base: "#7a3a2a", var: 0.12, mortar: "#3a2a22", jitter: 0.02, gap: 3, round: 1 }); grain(g, R, 0.07); },
  muromadera: (g, R) => { planks(g, R, 6, "#5e3f26", true); grain(g, R, 0.05); },
  muroroca: (g, R) => { g.fillStyle = "#3e3934"; g.fillRect(0, 0, SIZE, SIZE); blotches(g, R, "rgb(25,22,20)", 24, 15, 50, 0.6); blotches(g, R, "rgb(95,88,80)", 16, 10, 35, 0.4); cracks(g, R, 10, "rgba(15,13,11,.7)", 2, 6); grain(g, R, 0.12); },
  seto: (g, R) => { g.fillStyle = "#24401a"; g.fillRect(0, 0, SIZE, SIZE); for (let i = 0; i < 380; i++) { const x = R() * SIZE, y = R() * SIZE, r = 4 + R() * 7; wrap((X, Y) => { g.fillStyle = ["#2e5222", "#3c6a2a", "#1c3412", "#4a7a32"][Math.floor(R() * 4)]; g.beginPath(); g.ellipse(X, Y, r, r * 0.6, R() * 3, 0, 7); g.fill(); }, x, y, r); } },
  vacio: g => { g.fillStyle = "#0a0908"; g.fillRect(0, 0, SIZE, SIZE); }
};

/** Lienzo de la textura de un terreno (se dibuja una vez). */
export function terrainCanvas(k) {
  if (cache.has(k)) return cache.get(k);
  const c = document.createElement("canvas"); c.width = c.height = SIZE;
  const g = c.getContext("2d"), R = rng(k + "·mesa");
  (DRAW[k] || ((gg) => { gg.fillStyle = (TERRAIN[k] || TERRAIN.piedra).f; gg.fillRect(0, 0, SIZE, SIZE); grain(gg, R, 0.1); }))(g, R);
  cache.set(k, c); return c;
}
/** La misma textura como imagen (para los patrones del plano 2D). */
export function terrainURL(k) { if (!urls.has(k)) urls.set(k, terrainCanvas(k).toDataURL("image/jpeg", 0.85)); return urls.get(k); }
