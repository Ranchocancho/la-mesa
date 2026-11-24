// Generador de mapas (Hito 72). Dibuja por código un mapa de pergamino a partir de unos pocos datos, así que
// no se guarda ninguna imagen: solo la semilla, los ajustes, la silueta de tierra (si se calca) y los caminos.
//   · Región: calca la costa del mapa que hay debajo (el subido o el de ejemplo) dentro del recuadro de la región
//     y la amplía con más detalle: costa recortada, montañas, colinas, bosques, ríos y caminos entre los lugares.
//   · Mundo: un mapa completo (isla, continente o archipiélago), para cuando no hay mapa propio (o para otro juego).
// Los lugares (castillos, posadas, ciudades…) son los de siempre: se colocan encima como chinchetas.

/* ---------- Ruido con semilla ---------- */
function noiseFns(seed) {
  const sx = (seed % 997) * 1.37 + 11.3, sy = ((seed / 997) | 0) % 991 * 0.91 + 5.7;
  const hash = (x, y) => { const n = Math.sin((x + sx) * 127.1 + (y + sy) * 311.7) * 43758.5453; return n - Math.floor(n); };
  const sm = t => t * t * (3 - 2 * t);
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  const fbm = (x, y, o = 5) => { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return v / n; };
  return { hash, vnoise, fbm };
}

/* ---------- Silueta de tierra calcada del mapa de abajo ---------- */
/** Lee el trozo del mapa (bbox en 0–1) y separa agua de tierra por el color (método de Otsu sobre «azul − rojo»).
 *  Devuelve { w, h, cut, data: Float32Array(m) } con la medida de color; la máscara sale de comparar con cut + ajuste. */
export async function sampleSource(url, bbox, gw = 140) {
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const sw = bbox.w * W, sh = bbox.h * H, gh = Math.max(8, Math.round(gw * sh / sw));
  const c = document.createElement("canvas"); c.width = gw; c.height = gh;
  const g = c.getContext("2d", { willReadFrequently: true }); g.imageSmoothingQuality = "high";
  g.drawImage(img, bbox.x0 * W, bbox.y0 * H, sw, sh, 0, 0, gw, gh);
  const d = g.getImageData(0, 0, gw, gh).data, m = new Float32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2]; m[i] = (b - r) + (b - gg) * 0.5; } // agua: más azul que roja
  // Otsu
  let lo = Infinity, hi = -Infinity; for (const v of m) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const B = 64, hist = new Array(B).fill(0), step = (hi - lo) / B || 1;
  for (const v of m) hist[Math.min(B - 1, Math.floor((v - lo) / step))]++;
  let tot = m.length, sum = 0; hist.forEach((h, i) => { sum += i * h; });
  let sB = 0, wB = 0, best = 0, cutI = B / 2;
  for (let i = 0; i < B; i++) { wB += hist[i]; if (!wB) continue; const wF = tot - wB; if (!wF) break; sB += i * hist[i];
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; cutI = i; } }
  return { w: gw, h: gh, cut: lo + (cutI + 0.5) * step, span: hi - lo, data: m };
}
/** Máscara 0/1 (tierra = 1) con el ajuste del máster (−1 … 1: más agua … más tierra), comprimida en texto (RLE). */
export function maskFrom(sample, adj = 0) {
  const cut = sample.cut + adj * sample.span * 0.35, out = new Uint8Array(sample.w * sample.h);
  for (let i = 0; i < out.length; i++) out[i] = sample.data[i] <= cut ? 1 : 0;
  return { w: sample.w, h: sample.h, rle: rle(out) };
}
function rle(a) { let s = "", v = a[0], n = 0; s += v; for (const x of a) { if (x === v) n++; else { s += "," + n; v = x; n = 1; } } return s + "," + n; }
function unrle(m) { const p = m.rle.split(","), out = new Uint8Array(m.w * m.h); let v = +p[0], i = 0; for (let k = 1; k < p.length; k++) { const n = +p[k]; if (v) out.fill(1, i, i + n); i += n; v = 1 - v; } return out; }
function blur(a, w, h, r) { // caja separable, dos pasadas
  let src = Float32Array.from(a), tmp = new Float32Array(w * h);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += src[y * w + Math.max(0, Math.min(w - 1, x))];
      for (let x = 0; x < w; x++) { tmp[y * w + x] = acc / (2 * r + 1); acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
      for (let y = 0; y < h; y++) { src[y * w + x] = acc / (2 * r + 1); acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  }
  return src;
}
const bilin = (a, w, h, u, v) => { const x = Math.max(0, Math.min(w - 1.001, u * w - 0.5)), y = Math.max(0, Math.min(h - 1.001, v * h - 0.5)), xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
  const i = yi * w + xi; return a[i] * (1 - fx) * (1 - fy) + a[i + 1] * fx * (1 - fy) + a[i + w] * (1 - fx) * fy + a[i + w + 1] * fx * fy; };

/* ---------- Paletas ---------- */
export const CLIMAS = {
  templado: { n: "Templado", land: [236, 224, 190], hill: [214, 198, 156], sea: [188, 196, 190], deep: [150, 168, 172], forest: ["rgba(90,104,60,.6)", "#3e4a2a"], ink: "#4a3824" },
  arido: { n: "Árido", land: [240, 220, 172], hill: [222, 190, 136], sea: [190, 196, 184], deep: [150, 166, 166], forest: ["rgba(120,120,64,.55)", "#5a5228"], ink: "#5a3c20" },
  frio: { n: "Frío", land: [234, 234, 226], hill: [206, 210, 210], sea: [176, 190, 200], deep: [134, 156, 176], forest: ["rgba(70,96,84,.6)", "#2e423a"], ink: "#3a3a44" },
  tropical: { n: "Tropical", land: [230, 226, 178], hill: [206, 204, 148], sea: [170, 204, 196], deep: [118, 172, 176], forest: ["rgba(66,112,56,.62)", "#2c4a22"], ink: "#3f3a22" }
};
export const FORMAS = { calco: "Calcar la costa del mapa", tierra: "Todo tierra (interior)", isla: "Isla", continente: "Continente", archipielago: "Archipiélago" };

/* ---------- Terreno: campo de tierra (F) y de altura (E) ---------- */
// Con «items» (retocado a mano) la tierra sale siempre de la máscara, que también se retoca con el pincel.
function terrain(gen, W, H) {
  const { hash, vnoise, fbm } = noiseFns(gen.seed || 1);
  const S = 2, w = Math.round(W / S), h = Math.round(H / S), F = new Float32Array(w * h), E = new Float32Array(w * h);
  const sea = 0.5, lvl = (gen.sea ?? 0) / 100, sc = 6 / Math.max(w, h), fromMask = (gen.forma === "calco" || gen.items) && gen.mask;
  let base = null, inner = null, mw = 0, mh = 0;
  if (fromMask) { const m = unrle(gen.mask); mw = gen.mask.w; mh = gen.mask.h; base = blur(m, mw, mh, 1); inner = blur(m, mw, mh, Math.max(2, Math.round(mw / 18))); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h, n = fbm(x * sc * 1.6, y * sc * 1.6), i = y * w + x;
    let f;
    if (fromMask) f = bilin(base, mw, mh, u, v) + (fbm(x * sc * 4 + 9, y * sc * 4 + 3, 4) - 0.5) * 0.55; // el ajuste agua/tierra ya va en la máscara
    else if (gen.forma === "tierra") f = 1;
    else if (gen.forma === "archipielago") f = fbm(x * sc * 2.6 + 5, y * sc * 2.6 + 1) * 1.25 - 0.13 - lvl * 0.3 - Math.max(0, Math.hypot(u - 0.5, v - 0.5) - 0.42) * 1.5;
    else if (gen.forma === "continente") f = n * 0.9 + (1 - Math.min(1, Math.hypot((u - 0.5) * 1.05, (v - 0.5) * 1.2) * 1.45)) * 0.55 - lvl * 0.4;
    else f = n * 0.85 + (1 - Math.min(1, Math.hypot((u - 0.5) * 1.25, (v - 0.5) * 1.5) * 1.7)) * 0.6 - lvl * 0.4; // isla
    F[i] = f;
    const interior = inner ? bilin(inner, mw, mh, u, v) : gen.forma === "tierra" ? 0.8 : Math.min(1, Math.max(0, (f - sea) * 3));
    E[i] = fbm(x * sc * 1.2 + 31, y * sc * 1.2 + 17) * 0.8 + interior * 0.32 + Math.max(0, f - sea) * 0.15;
  }
  const at = (A, x, y) => A[Math.min(h - 1, Math.max(0, Math.floor(y / S))) * w + Math.min(w - 1, Math.max(0, Math.floor(x / S)))];
  const MT = 1.02 - ((gen.mont ?? 50) / 100) * 0.42;
  return { hash, vnoise, fbm, S, w, h, F, E, sea, MT, at, isLand: (x, y) => at(F, x, y) > sea };
}

/* ---------- Elementos: montañas, colinas, bosques, ríos y caminos ----------
   Se guardan en enteros 0–10000 (fracción del mapa ×10000) para que ocupen poco:
   m: [x, y, tamaño, tipo (1 montaña · 0 colina)] · f: [x, y, radio] (mancha de bosque) · r / c: [x0, y0, x1, y1…] (río / camino) */
const Q = v => Math.round(v * 10000), UQ = v => v / 10000;
function procItems(gen, T, W, H, places) {
  const { hash, vnoise, at, isLand, E, F, MT, sea } = T, area = W * H / 1.6e6, out = { m: [], f: [], r: [], c: [] };
  const bosq = (gen.bosq ?? 50) / 100, rios = (gen.rios ?? 40) / 100;
  // montañas y colinas
  const nM = Math.round(5200 * area);
  for (let i = 0; i < nM; i++) {
    const x = hash(i, 1.3) * W, y = hash(i, 2.7) * H; if (!isLand(x, y)) continue;
    const e = at(E, x, y), big = e > MT; if (e < MT - 0.06 || hash(i, 5.1) > (big ? 0.42 : 0.16)) continue;
    const s = big ? 9 + hash(i, 3.9) * 13 + (e - MT) * 30 : 6 + hash(i, 3.9) * 5;
    out.m.push([Q(x / W), Q(y / H), Q(s / W), big ? 1 : 0]);
  }
  out.m.sort((a, b) => a[1] - b[1]); // de arriba abajo: las de delante tapan a las de detrás
  // bosques en manchas
  const G = 30, FT = 0.78 - bosq * 0.36;
  for (let gy = 0; gy < H / G; gy++) for (let gx = 0; gx < W / G; gx++) {
    const x = (gx + 0.3 + hash(gx, gy) * 0.4) * G, y = (gy + 0.3 + hash(gy, gx) * 0.4) * G;
    if (!isLand(x, y) || at(E, x, y) > MT - 0.02 || at(F, x, y) < sea + 0.04) continue;
    if (vnoise(x / 110 + 40, y / 110 + 10) * 0.7 + vnoise(x / 40, y / 40) * 0.3 < FT) continue;
    out.f.push([Q(x / W), Q(y / H), Q(G * 0.72 / W)]);
  }
  // ríos
  const nR = Math.round(rios * 14 * Math.sqrt(area));
  for (let k = 0, tries = 0; out.r.length < nR && tries < 400; tries++, k++) {
    let x = hash(k, 41.1) * W, y = hash(k, 43.7) * H; if (!isLand(x, y) || at(E, x, y) < MT - 0.12) continue;
    const pts = [[x, y]]; let ok = false;
    for (let st = 0; st < 600; st++) {
      let bx = x, by = y, be = at(E, x, y) + at(F, x, y) * 0.6; const R = 7;
      for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2, nx = x + Math.cos(ang) * R, ny = y + Math.sin(ang) * R, ev = at(E, nx, ny) + at(F, nx, ny) * 0.6 + (hash(nx, ny) - 0.5) * 0.01; if (ev < be) { be = ev; bx = nx; by = ny; } }
      if (bx === x && by === y) { bx = x + (hash(st, k) - 0.5) * 10; by = y + (hash(k, st) - 0.5) * 10; }
      x = bx; y = by; pts.push([x, y]);
      if (x < 0 || y < 0 || x > W || y > H) break;
      if (!isLand(x, y)) { ok = true; break; }
    }
    if (ok && pts.length > 12) out.r.push(pts.filter((p, j) => j % 3 === 0 || j === pts.length - 1).flatMap(([px, py]) => [Q(px / W), Q(py / H)]));
  }
  // caminos: a mano (los antiguos, {x,y}) y automáticos entre lugares
  (gen.roads || []).forEach(r => out.c.push(r.flatMap(p => [Q(p.x), Q(p.y)])));
  if (gen.autoRoads && places.length > 1) autoRoads(places.map(p => [p.x * W, p.y * H]), isLand, (x, y) => at(E, x, y) > MT, W, H).forEach(r => out.c.push(r.flatMap(([px, py]) => [Q(px / W), Q(py / H)])));
  return out;
}
const pairs = a => { const o = []; for (let i = 0; i + 1 < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };

/* ---------- Dibujo ---------- */
/** Dibuja el mapa. Sin «items», todo sale de los ajustes; con «items» (retocado a mano), se dibuja exactamente lo guardado. */
export function renderMap(gen, W, H, places = [], poly = null) {
  const T = terrain(gen, W, H), { hash, S, w, h, F, E, sea, MT, isLand } = T, P = CLIMAS[gen.clima] || CLIMAS.templado;
  const it = gen.items || procItems(gen, T, W, H, places);
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  // Suelo y mar
  const img = g.createImageData(w, h), d = img.data, mix = (a, b, k) => a + (b - a) * k;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, f = F[i], o = i * 4; let col;
    if (f <= sea) { const dep = Math.min(1, (sea - f) * 3.2); col = [mix(P.sea[0], P.deep[0], dep), mix(P.sea[1], P.deep[1], dep), mix(P.sea[2], P.deep[2], dep)];
      const band = (sea - f) * 55; if (band % 1 < 0.14 && band < 4) col = col.map(v => v - 18); }
    else { const k = gen.items ? 0.15 : Math.max(0, Math.min(1, (E[i] - (MT - 0.25)) * 2.2)); col = [mix(P.land[0], P.hill[0], k), mix(P.land[1], P.hill[1], k), mix(P.land[2], P.hill[2], k)]; }
    const nb = F[y * w + Math.min(w - 1, x + 1)], nd = F[Math.min(h - 1, y + 1) * w + x];
    if ((f - sea) * (nb - sea) < 0 || (f - sea) * (nd - sea) < 0) col = [70, 52, 34];
    const gr = (hash(x * 3.3, y * 1.7) - 0.5) * 14;
    d[o] = col[0] + gr; d[o + 1] = col[1] + gr; d[o + 2] = col[2] + gr; d[o + 3] = 255;
  }
  const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h; tmp.getContext("2d").putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.drawImage(tmp, 0, 0, W, H);
  g.lineCap = "round"; g.lineJoin = "round";
  // Ríos
  g.strokeStyle = "#5a6a78";
  for (const r of it.r || []) { const pts = pairs(r).map(([x, y]) => [UQ(x) * W, UQ(y) * H]); for (let j = 1; j < pts.length; j++) { g.lineWidth = 1 + 2.6 * j / pts.length; g.beginPath(); g.moveTo(...pts[j - 1]); g.lineTo(...pts[j]); g.stroke(); } }
  // Bosques (manchas de árboles)
  g.lineWidth = 1;
  (it.f || []).forEach(([fx, fy, fr], k) => {
    const cx = UQ(fx) * W, cy = UQ(fy) * H, R = UQ(fr) * W, n = Math.max(3, Math.round(R * R / 55));
    for (let j = 0; j < n; j++) { const a = hash(k * 7.1, j * 3.3) * Math.PI * 2, rr = Math.sqrt(hash(j * 1.9, k * 5.7)) * R, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (!isLand(x, y)) continue; g.fillStyle = P.forest[0]; g.strokeStyle = P.forest[1]; g.beginPath(); g.arc(x, y, 3.6 + hash(j, k) * 1.6, 0, 7); g.fill(); g.stroke(); }
  });
  // Montañas y colinas
  for (const [mx, my, ms, mt] of it.m || []) {
    const x = UQ(mx) * W, y = UQ(my) * H, s = UQ(ms) * W, big = mt === 1;
    g.fillStyle = big ? "rgba(120,96,64,.38)" : "rgba(140,120,80,.25)";
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * (big ? 1.2 : 0.55)); g.lineTo(x + s * 0.2, y); g.fill();
    g.strokeStyle = P.ink; g.lineWidth = big ? 1.6 : 1.1;
    g.beginPath(); if (big) { g.moveTo(x - s, y); g.lineTo(x, y - s * 1.2); g.lineTo(x + s, y); } else { g.moveTo(x - s, y); g.quadraticCurveTo(x, y - s * 1.1, x + s, y); } g.stroke();
  }
  // Caminos: encima, con un borde claro para que se lean
  const trace = r => { g.beginPath(); g.moveTo(...r[0]); for (let j = 1; j < r.length - 1; j++) { const mx = (r[j][0] + r[j + 1][0]) / 2, my = (r[j][1] + r[j + 1][1]) / 2; g.quadraticCurveTo(r[j][0], r[j][1], mx, my); } g.lineTo(...r[r.length - 1]); g.stroke(); };
  for (const rr of it.c || []) { const r = pairs(rr).map(([x, y]) => [UQ(x) * W, UQ(y) * H]); if (r.length < 2) continue;
    g.setLineDash([]); g.strokeStyle = "rgba(236,224,190,.85)"; g.lineWidth = 7; trace(r); g.setLineDash([9, 5]); g.strokeStyle = "rgba(96,58,30,.95)"; g.lineWidth = 2.6; trace(r); }
  g.setLineDash([]);
  // Rótulos a mano
  for (const [lx, ly, ls, txt] of it.t || []) { g.font = `italic ${Math.round(UQ(ls) * W)}px Alegreya, Georgia, serif`; g.textAlign = "center"; g.lineWidth = 4; g.strokeStyle = "rgba(236,224,190,.8)"; g.strokeText(txt, UQ(lx) * W, UQ(ly) * H); g.fillStyle = "#3a2a1a"; g.fillText(txt, UQ(lx) * W, UQ(ly) * H); }
  // Fuera de la región: un velo, para que se vea qué es suyo
  if (poly && poly.length > 2) {
    g.save(); g.fillStyle = "rgba(40,28,16,.28)"; g.beginPath(); g.rect(0, 0, W, H); g.moveTo(poly[0].x * W, poly[0].y * H); poly.slice(1).forEach(p => g.lineTo(p.x * W, p.y * H)); g.closePath(); g.fill("evenodd");
    g.strokeStyle = "rgba(74,56,36,.7)"; g.lineWidth = 2; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(poly[0].x * W, poly[0].y * H); poly.slice(1).forEach(p => g.lineTo(p.x * W, p.y * H)); g.closePath(); g.stroke(); g.restore();
  }
  // Rosa de los vientos y viñeta
  const R = Math.min(W, H) * 0.06, cx = W - R * 1.9, cy = H - R * 1.9;
  g.strokeStyle = P.ink; g.fillStyle = P.ink; g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, R * 0.75, 0, 7); g.stroke();
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 - Math.PI / 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a + 0.25) * R * 0.2, cy + Math.sin(a + 0.25) * R * 0.2); g.lineTo(cx + Math.cos(a - 0.25) * R * 0.2, cy + Math.sin(a - 0.25) * R * 0.2); g.closePath(); k % 2 ? g.stroke() : g.fill(); }
  g.font = `bold ${Math.round(R * 0.32)}px Cinzel, Georgia, serif`; g.textAlign = "center"; g.fillText("N", cx, cy - R - 6);
  if (gen.title) { g.font = `bold ${Math.round(Math.min(W, H) * 0.035)}px Cinzel, Georgia, serif`; g.textAlign = "left"; g.fillStyle = "rgba(58,42,26,.85)"; g.fillText(gen.title, W * 0.04, H * 0.08); }
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,40,20,.42)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  return c;
}

/** «Retocar a mano»: fija todo lo generado (la tierra como máscara y cada elemento) para poder moverlo, cambiarlo de tamaño o borrarlo.
 *  Desde aquí los deslizadores ya no cambian nada; el pincel y los elementos sí. */
export function bake(gen, W, H, places = []) {
  const T = terrain(gen, W, H), items = procItems(gen, T, W, H, places);
  let mask = gen.mask;
  if (!(gen.forma === "calco" && gen.mask)) { // la tierra de una forma inventada pasa a máscara
    const mw = 220, mh = Math.max(8, Math.round(mw * H / W)), m = new Uint8Array(mw * mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) m[y * mw + x] = T.isLand((x + 0.5) / mw * W, (y + 0.5) / mh * H) ? 1 : 0;
    mask = { w: mw, h: mh, rle: rle(m) };
  }
  const out = { ...gen, mask, items: { ...items, t: [] } }; delete out.roads; return out;
}
/** Pincel de tierra o mar sobre la máscara (x, y, radio en 0–1 del mapa). */
export function paintMask(gen, x, y, r, landOn) {
  const m = unrle(gen.mask), w = gen.mask.w, h = gen.mask.h, cx = x * w, cy = y * h, rr = r * w;
  for (let j = Math.max(0, Math.floor(cy - rr)); j <= Math.min(h - 1, Math.ceil(cy + rr)); j++) for (let i = Math.max(0, Math.floor(cx - rr)); i <= Math.min(w - 1, Math.ceil(cx + rr)); i++)
    if (Math.hypot(i + 0.5 - cx, (j + 0.5 - cy)) <= rr) m[j * w + i] = landOn ? 1 : 0;
  gen.mask = { w, h, rle: rle(m) };
}
export { Q, UQ, pairs };

/** Caminos entre lugares: árbol que une cada lugar con el más cercano ya unido, por la ruta más barata
 *  (evita el agua y prefiere no cruzar montañas). */
function autoRoads(P, isLand, isMount, W, H) {
  const gw = Math.ceil(W / (W / 90)), gh = Math.ceil(H / (W / 90)), cs = W / gw;
  const cost = (cx, cy) => { const x = (cx + 0.5) * cs, y = (cy + 0.5) * cs; if (!isLand(x, y)) return Infinity; return isMount(x, y) ? 6 : 1; };
  const cell = ([x, y]) => [Math.max(0, Math.min(gw - 1, Math.floor(x / cs))), Math.max(0, Math.min(gh - 1, Math.floor(y / cs)))];
  const path = (a, b) => { // A*
    const [sx, sy] = cell(a), [tx, ty] = cell(b), key = (x, y) => y * gw + x, gS = new Map([[key(sx, sy), 0]]), from = new Map(), open = [[0, sx, sy]];
    while (open.length) { open.sort((p, q) => p[0] - q[0]); const [, x, y] = open.shift(); if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const c0 = cost(nx, ny) * (dx && dy ? 1.41 : 1); if (!isFinite(c0) && !(nx === tx && ny === ty)) continue;
        const ng = gS.get(key(x, y)) + (isFinite(c0) ? c0 : 1); if (ng < (gS.get(key(nx, ny)) ?? Infinity)) { gS.set(key(nx, ny), ng); from.set(key(nx, ny), key(x, y)); open.push([ng + Math.hypot(tx - nx, ty - ny), nx, ny]); } }
      if (open.length > 20000) return null; }
    if (!from.has(key(tx, ty))) return null;
    const out = []; let k = key(tx, ty); while (k !== key(sx, sy)) { out.push([(k % gw + 0.5) * cs, ((k / gw | 0) + 0.5) * cs]); k = from.get(k); }
    out.push(a); out.reverse(); out[out.length - 1] = b; return out.filter((p, i) => i === 0 || i === out.length - 1 || i % 2 === 0);
  };
  const done = [0], left = P.map((_, i) => i).slice(1), out = [];
  while (left.length) { let best = null; for (const i of left) for (const j of done) { const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (!best || d < best.d) best = { i, j, d }; }
    left.splice(left.indexOf(best.i), 1); done.push(best.i); const p = path(P[best.j], P[best.i]); if (p) out.push(p); }
  return out;
}

/* ---------- Caché: el mismo mapa no se vuelve a dibujar ---------- */
const cache = new Map();
export function genURL(gen, W, H, places, poly) {
  const k = JSON.stringify([gen, W, H, places, poly]);
  if (cache.has(k)) return cache.get(k);
  const url = renderMap(gen, W, H, places, poly).toDataURL("image/jpeg", 0.88);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  cache.set(k, url); return url;
}
