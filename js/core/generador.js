// Generador de mapas: mazmorra (salas unidas por pasillos, con puertas, luz, mobiliario y alguna sorpresa)
// o cueva (autómata celular). El resultado se puede retocar a mano en el editor.
const key = (c, r) => c + "," + r;
let n = 0; const pid = () => "p" + Date.now().toString(36) + (n++).toString(36);

const ROOMS = [
  { n: "almacén", props: ["barril", "barril", "caja", "caja", "tonel"] },
  { n: "cripta", props: ["sarcofago", "velas", "calavera", "telarana"] },
  { n: "biblioteca", props: ["estanteria", "estanteria", "mesa", "silla", "velas", "pergamino"] },
  { n: "guardia", props: ["mesa", "silla", "silla", "brasero", "baul"] },
  { n: "templo", props: ["altar", "columna", "columna", "estatua", "velas"] },
  { n: "tesoro", props: ["cofre", "oro", "trampaoculta"] },
  { n: "dormitorio", props: ["cama", "cama", "baul", "velas"] }
];

export function generateDungeon(cols, rows, { cave = false, floor = "piedra", wall = "muro" } = {}) {
  return cave ? makeCave(cols, rows) : makeDungeon(cols, rows, floor === "madera" ? "piedra" : floor, wall);
}

function makeDungeon(cols, rows, floor, wall) {
  const T = {}, props = [], rooms = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) T[key(c, r)] = "vacio";
  const want = Math.max(3, Math.min(9, Math.round(cols * rows / 70)));
  for (let tries = 0; tries < 300 && rooms.length < want; tries++) {
    const w = 4 + Math.floor(Math.random() * 5), h = 4 + Math.floor(Math.random() * 4);
    const c = 1 + Math.floor(Math.random() * (cols - w - 2)), r = 1 + Math.floor(Math.random() * (rows - h - 2));
    if (c < 1 || r < 1) continue;
    if (rooms.some(o => c < o.c + o.w + 1 && c + w + 1 > o.c && r < o.r + o.h + 1 && r + h + 1 > o.r)) continue;
    rooms.push({ c, r, w, h });
  }
  // Interior de cada sala (las paredes salen solas después)
  rooms.forEach(o => { for (let r = o.r + 1; r < o.r + o.h - 1; r++) for (let c = o.c + 1; c < o.c + o.w - 1; c++) T[key(c, r)] = floor; });
  const inRoom = (c, r) => rooms.find(o => c > o.c && c < o.c + o.w - 1 && r > o.r && r < o.r + o.h - 1);
  const onEdge = (c, r) => rooms.find(o => c >= o.c && c <= o.c + o.w - 1 && r >= o.r && r <= o.r + o.h - 1 && !inRoom(c, r));
  // Pasillos en L entre salas consecutivas (ordenadas de izquierda a derecha); puertas donde cruzan una pared
  const ctr = o => ({ c: o.c + Math.floor(o.w / 2), r: o.r + Math.floor(o.h / 2) });
  const sorted = [...rooms].sort((a, b) => a.c - b.c), doors = new Set();
  const carve = (c, r) => {
    if (c < 1 || r < 1 || c >= cols - 1 || r >= rows - 1) return;
    const e = onEdge(c, r);
    if (e && !doors.has(key(c, r))) {
      doors.add(key(c, r)); T[key(c, r)] = floor;
      const x = Math.random(), k = x < 0.62 ? "puerta" : x < 0.77 ? "puertallave" : x < 0.84 ? "puertasecreta" : x < 0.9 ? "rastrillo" : null;
      if (k) props.push({ id: pid(), c, r, k, rot: 0, hidden: k === "puertasecreta" });
      return;
    }
    if (T[key(c, r)] === "vacio") T[key(c, r)] = floor;
  };
  for (let i = 1; i < sorted.length; i++) {
    const a = ctr(sorted[i - 1]), b = ctr(sorted[i]);
    if (Math.random() < 0.5) { for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) carve(c, a.r); for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) carve(b.c, r); }
    else { for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) carve(a.c, r); for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) carve(c, b.r); }
  }
  // Paredes: todo lo vacío que toca suelo
  const isFloor = (c, r) => T[key(c, r)] && T[key(c, r)] !== "vacio" && T[key(c, r)] !== wall;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (T[key(c, r)] !== "vacio") continue;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (isFloor(c + dc, r + dr)) { T[key(c, r)] = wall; dr = dc = 2; }
  }
  // Una puerta solo tiene sentido entre dos muros: si quedó en medio de una sala, se quita
  for (let i = props.length - 1; i >= 0; i--) { const p = props[i], w = (c, r) => T[key(c, r)] === wall; if (!((w(p.c - 1, p.r) && w(p.c + 1, p.r)) || (w(p.c, p.r - 1) && w(p.c, p.r + 1)))) props.splice(i, 1); }
  // Mobiliario, luz y sorpresas en cada sala
  const busy = new Set(props.map(p => key(p.c, p.r)));
  const free = o => { const out = []; for (let r = o.r + 1; r < o.r + o.h - 1; r++) for (let c = o.c + 1; c < o.c + o.w - 1; c++) if (!busy.has(key(c, r)) && !doors.has(key(c, r))) out.push({ c, r }); return out; };
  const nextToDoor = (c, r) => [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([a, b]) => doors.has(key(c + a, r + b)));
  rooms.forEach((o, i) => {
    const f = free(o).filter(x => !nextToDoor(x.c, x.r)), pick = () => { if (!f.length) return null; const x = f.splice(Math.floor(Math.random() * f.length), 1)[0]; busy.add(key(x.c, x.r)); return x; };
    // Antorchas en las paredes
    const byWall = f.filter(x => T[key(x.c, x.r - 1)] === wall || T[key(x.c - 1, x.r)] === wall);
    for (let t = 0; t < Math.min(2, byWall.length); t++) { const x = byWall.splice(Math.floor(Math.random() * byWall.length), 1)[0]; const j = f.findIndex(y => y.c === x.c && y.r === x.r); if (j >= 0) f.splice(j, 1); props.push({ id: pid(), c: x.c, r: x.r, k: "antorcha", rot: 0, hidden: false }); }
    if (i === 0) return; // la primera sala es la entrada: despejada
    const kind = ROOMS[Math.floor(Math.random() * ROOMS.length)];
    kind.props.forEach(k => { const x = pick(); if (x) props.push({ id: pid(), c: x.c, r: x.r, k, rot: Math.floor(Math.random() * 4), hidden: k === "trampaoculta",
      ...(["cofre", "oro", "sarcofago", "pergamino"].includes(k) ? { loot: "" } : {}), ...(k === "trampaoculta" ? { trap: { dc: 13, save: "des", dmg: "2d10", type: "perforante", detect: 13 } } : {}) }); });
    props.push({ id: pid(), c: o.c + 1, r: o.r + 1, k: "nota", rot: 0, hidden: true, label: `Sala ${i + 1}: ${kind.n}` });
  });
  const s = rooms[0] ? ctr(sorted[0]) : { c: 1, r: 1 };
  return { terrain: T, props, start: s };
}

function makeCave(cols, rows) {
  let W = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => c === 0 || r === 0 || c === cols - 1 || r === rows - 1 || Math.random() < 0.45));
  for (let it = 0; it < 5; it++) W = W.map((row, r) => row.map((_, c) => { if (c === 0 || r === 0 || c === cols - 1 || r === rows - 1) return true; let n = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (W[r + dr][c + dc]) n++; return n >= 5; }));
  // Solo la zona abierta más grande (para que todo esté conectado)
  const seen = new Set(); let best = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (W[r][c] || seen.has(key(c, r))) continue;
    const reg = [], st = [[c, r]]; seen.add(key(c, r));
    while (st.length) { const [x, y] = st.pop(); reg.push([x, y]); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + b; if (!W[ny][nx] && !seen.has(key(nx, ny))) { seen.add(key(nx, ny)); st.push([nx, ny]); } } }
    if (reg.length > best.length) best = reg;
  }
  const open = new Set(best.map(([x, y]) => key(x, y))), T = {}, props = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) T[key(c, r)] = open.has(key(c, r)) ? "cueva" : "muroroca";
  // Charcos y escombros, setas, cristales, rocas y algún resto
  const cells = best.map(([c, r]) => ({ c, r })), pick = () => cells.splice(Math.floor(Math.random() * cells.length), 1)[0];
  for (let i = 0; i < 2 && cells.length > 40; i++) { const p = pick(); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (open.has(key(p.c + dc, p.r + dr)) && Math.random() < 0.75) T[key(p.c + dc, p.r + dr)] = "agua"; }
  for (let i = 0; i < 3 && cells.length > 40; i++) { const p = pick(); T[key(p.c, p.r)] = "escombros"; }
  const deco = ["setas", "setas", "cristales", "roca", "roca", "calavera", "penasco", "telarana"];
  for (let i = 0; i < Math.round(best.length / 14) && cells.length; i++) { const p = pick(); props.push({ id: pid(), c: p.c, r: p.r, k: deco[Math.floor(Math.random() * deco.length)], rot: Math.floor(Math.random() * 4), hidden: false }); }
  if (cells.length) { const p = pick(); props.push({ id: pid(), c: p.c, r: p.r, k: "cofre", rot: 0, hidden: false, loot: "" }); }
  const s = best.sort((a, b) => a[0] - b[0])[0] || [1, 1];
  return { terrain: T, props, start: { c: s[0], r: s[1] } };
}
