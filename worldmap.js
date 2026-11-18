// Mapa del mundo de ejemplo, dibujado por código hasta que subáis el vuestro.
let cached = null;

export function exampleMap() {
  if (cached) return cached;
  const W = 1600, H = 1000, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");

  // Ruido determinista
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const smooth = t => t * t * (3 - 2 * t);
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi), b = hash(xi + 1, yi), cc = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (cc - a) * yf + (a - b - cc + d) * xf * yf;
  };
  const fbm = (x, y) => { let v = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { v += a * vnoise(x * f, y * f); a *= 0.5; f *= 2.03; } return v; };

  // Altura en una rejilla reducida y escalada
  const S = 2, w = W / S, h = H / S, hm = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x / w - 0.5, ny = y / h - 0.5;
    const fall = 1 - Math.min(1, Math.hypot(nx * 1.25, ny * 1.6) * 1.55);
    hm[y * w + x] = fbm(x / 95 + 3.1, y / 95 + 7.7) * 0.85 + fall * 0.55;
  }
  const SEA = 0.62;
  const img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = hm[y * w + x], i = (y * w + x) * 4;
    let r, gg, b;
    if (v < SEA) {
      const depth = Math.min(1, (SEA - v) * 4);
      r = 196 - depth * 40; gg = 192 - depth * 30; b = 168 - depth * 12;
      const band = (SEA - v) * 60; // líneas de costa repetidas
      if (band % 1 < 0.12 && band < 4) { r -= 22; gg -= 20; b -= 14; }
    } else {
      const k = Math.min(1, (v - SEA) * 3);
      r = 236 - k * 22; gg = 224 - k * 26; b = 190 - k * 34;
    }
    // costa en tinta
    const nb = hm[y * w + Math.min(w - 1, x + 1)], nd = hm[Math.min(h - 1, y + 1) * w + x];
    if ((v - SEA) * (nb - SEA) < 0 || (v - SEA) * (nd - SEA) < 0) { r = 70; gg = 52; b = 34; }
    const grain = (hash(x * 3.3, y * 1.7) - 0.5) * 16;
    d[i] = r + grain; d[i + 1] = gg + grain; d[i + 2] = b + grain; d[i + 3] = 255;
  }
  const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
  tmp.getContext("2d").putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(tmp, 0, 0, W, H);

  const at = (x, y) => hm[Math.min(h - 1, Math.floor(y / S)) * w + Math.min(w - 1, Math.floor(x / S))];
  g.lineCap = "round"; g.lineJoin = "round";

  // Montañas
  for (let i = 0; i < 2600; i++) {
    const x = hash(i, 1.3) * W, y = hash(i, 2.7) * H, v = at(x, y);
    if (v < SEA + 0.17 || hash(i, 5.1) > 0.45) continue;
    const s = 10 + hash(i, 3.9) * 12;
    g.fillStyle = "rgba(120,96,64,.35)";
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * 1.2); g.lineTo(x + s * 0.2, y); g.fill();
    g.strokeStyle = "#4a3824"; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * 1.2); g.lineTo(x + s, y); g.stroke();
  }
  // Bosques
  for (let i = 0; i < 9000; i++) {
    const x = hash(i, 8.1) * W, y = hash(i, 9.3) * H, v = at(x, y);
    if (v < SEA + 0.03 || v > SEA + 0.14) continue;
    if (vnoise(x / 120 + 40, y / 120 + 10) < 0.58) continue;
    g.fillStyle = "rgba(90,104,60,.55)"; g.strokeStyle = "#3e4a2a"; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.stroke();
  }
  // Río
  g.strokeStyle = "#5a6a78"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(900, 250);
  [[870, 330], [820, 380], [760, 420], [720, 470], [700, 540], [740, 600], [800, 640], [900, 700]].forEach(([x, y]) => g.lineTo(x, y));
  g.stroke();
  // Rosa de los vientos
  const cx = 1420, cy = 820, R = 70;
  g.strokeStyle = "#4a3824"; g.fillStyle = "#4a3824"; g.lineWidth = 1.5;
  g.beginPath(); g.arc(cx, cy, R * 0.75, 0, 7); g.stroke();
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.lineTo(cx + Math.cos(a + 0.25) * 14, cy + Math.sin(a + 0.25) * 14);
    g.lineTo(cx + Math.cos(a - 0.25) * 14, cy + Math.sin(a - 0.25) * 14); g.closePath();
    k % 2 ? g.stroke() : g.fill();
  }
  g.font = "bold 22px Cinzel, Georgia, serif"; g.textAlign = "center"; g.fillText("N", cx, cy - R - 8);
  // Cartela
  g.fillStyle = "rgba(236,223,193,.9)"; g.strokeStyle = "#4a3824"; g.lineWidth = 2;
  g.fillRect(70, 60, 420, 90); g.strokeRect(70, 60, 420, 90); g.strokeRect(78, 68, 404, 74);
  g.fillStyle = "#3a2a1a"; g.font = "bold 30px Cinzel, Georgia, serif"; g.fillText("Tierras de Vel Arath", 280, 112);
  g.font = "italic 16px Alegreya, Georgia, serif"; g.fillText("Mapa de ejemplo · sube el vuestro", 280, 136);
  // Viñeta
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,40,20,.45)");
  g.fillStyle = vg; g.fillRect(0, 0, W, H);

  cached = { url: c.toDataURL("image/jpeg", 0.9), w: W, h: H };
  return cached;
}
