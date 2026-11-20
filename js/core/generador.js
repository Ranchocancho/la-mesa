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
// Trampas del SRD que puede esconder una sala (data/trampas.js)
const SRD_TRAPS = [["foso", "pozo"], ["pinchos", "pozopinchos"], ["dardos", "dardos"], ["red", "red"], ["techo", "techo"]];
const randTrap = () => { const [k, srd] = SRD_TRAPS[Math.floor(Math.random() * SRD_TRAPS.length)]; return { k, srd }; };

function makeDungeon(cols, rows, floor, wall, roomKinds = ROOMS) {
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
    const kind = roomKinds[Math.floor(Math.random() * roomKinds.length)];
    kind.props.forEach(k0 => { const x = pick(); if (!x) return; const tr = k0 === "trampaoculta" ? randTrap() : null, k = tr ? tr.k : k0;
      if (k0.startsWith("t:")) { T[key(x.c, x.r)] = k0.slice(2); busy.delete(key(x.c, x.r)); return; }
      props.push({ id: pid(), c: x.c, r: x.r, k, rot: Math.floor(Math.random() * 4), hidden: !!tr,
      ...(["cofre", "oro", "sarcofago", "pergamino"].includes(k) ? { loot: "" } : {}), ...(tr ? { trap: { srd: tr.srd } } : {}), ...(k === "pozomina" ? { h: 9 } : {}) }); });
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

/* ---------- Mapas por región ---------- */
const ENANO_ROOMS = [
  { n: "forja", props: ["forja", "yunque", "barril", "t:brasas", "caja"] },
  { n: "salón", props: ["mesapiedra", "mesapiedra", "ancestro", "estandarte", "velas", "tonel"] },
  { n: "mina", props: ["vagoneta", "puntal", "puntal", "pozomina", "t:railes", "t:railes", "cristales"] },
  { n: "almacén", props: ["barril", "barril", "tonel", "caja", "caja"] },
  { n: "cripta de ancestros", props: ["ancestro", "sarcofago", "velas", "trampaoculta"] },
  { n: "tesoro", props: ["cofre", "oro", "trampaoculta"] }
];
const rint = n => Math.floor(Math.random() * n);
/** Mapa de partida para un paquete de región; se retoca a mano en el editor. */
export function generateRegion(cols, rows, region) {
  if (region === "enano") { const d = makeDungeon(cols, rows, "runas", "murorunas", ENANO_ROOMS); d.props.filter(p => p.k === "puerta" && Math.random() < 0.4).forEach(p => { p.k = "puertarunas"; }); return d; }
  const T = {}, props = [], busy = new Set();
  const inside = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  const fill = t => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) T[key(c, r)] = t; };
  const blob = (t, n, rad) => { for (let i = 0; i < n; i++) { const cc = rint(cols), rr = rint(rows), R0 = rad * (0.6 + Math.random() * 0.8);
    for (let r = rr - 4; r <= rr + 4; r++) for (let c = cc - 4; c <= cc + 4; c++) if (inside(c, r) && Math.hypot(c - cc, r - rr) <= R0 + Math.random() * 0.8) T[key(c, r)] = t; } };
  const river = (t, w, vertical, at) => { let x = at ?? Math.floor((vertical ? cols : rows) * (0.3 + Math.random() * 0.4));
    for (let i = 0; i < (vertical ? rows : cols); i++) { x += rint(3) - 1; for (let k = 0; k < w; k++) { const c = vertical ? x + k : i, r = vertical ? i : x + k; if (inside(c, r)) T[key(c, r)] = t; } } return x; };
  const free = (c, r) => inside(c, r) && !busy.has(key(c, r)) && !/^(muro|empalizada|muralla|murocaido|murorunas|veta|seto|vacio|aguaprof|lava)/.test(T[key(c, r)] || "");
  const put = (k, n, where = () => true, extra = {}) => { for (let i = 0, tries = 0; i < n && tries < 400; tries++) { const c = 1 + rint(cols - 2), r = 1 + rint(rows - 2); if (!free(c, r) || !where(c, r)) continue; busy.add(key(c, r)); props.push({ id: pid(), c, r, k, rot: rint(4), ...extra }); i++; } };
  const on = t => (c, r) => T[key(c, r)] === t, not = (...ts) => (c, r) => !ts.includes(T[key(c, r)]);
  const ring = (wall, gap) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((c === 0 || r === 0 || c === cols - 1 || r === rows - 1) && !(gap && c === 0 && Math.abs(r - Math.floor(rows / 2)) <= 1)) T[key(c, r)] = wall; };
  const note = txt => props.push({ id: pid(), c: 1, r: 1, k: "nota", rot: 0, hidden: true, label: txt });
  let start = { c: 1, r: Math.floor(rows / 2) };
  if (region === "elfico") {
    fill("hierba"); blob("musgo", 5, 3); blob("hojarasca", 4, 3); blob("raices", 3, 1.5); river("agua", 2, true);
    const cx = Math.floor(cols * 0.6), cy = Math.floor(rows / 2); for (let r = cy - 2; r <= cy + 2; r++) for (let c = cx - 2; c <= cx + 2; c++) if (inside(c, r)) T[key(c, r)] = "plataforma";
    busy.add(key(cx, cy)); props.push({ id: pid(), c: cx, r: cy, k: "fuente", rot: 0 });
    put("arbolgigante", 4, not("agua", "plataforma")); put("arbol", 10, not("agua", "plataforma")); put("flores", 6, not("agua")); put("farolillos", 3, on("plataforma")); put("estatuaelfica", 1, on("plataforma"));
    put("arcopiedra", 1, not("agua")); put("tronco", 2, not("agua")); put("arbusto", 6, not("agua")); put("puente", 1, on("agua"));
    note("Claro élfico: la plataforma central y el río cortan el paso; los árboles gigantes dan cobertura de tres cuartos.");
  } else if (region === "orco") {
    fill("pisoteada"); blob("barro", 4, 2.5); blob("tierra", 4, 3); ring("empalizada", true); blob("brea", 1, 1);
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2); busy.add(key(cx, cy)); props.push({ id: pid(), c: cx, r: cy, k: "granhoguera", rot: 0 });
    put("tienda", 5, not("brea")); put("totem", 2); put("jaula", 2); put("barricada", 3, (c, r) => c <= 3); put("huesos", 4); put("olla", 1, (c, r) => Math.hypot(c - cx, r - cy) < 4); put("armero", 1); put("estandarte", 2);
    put("pinchos", 1, (c, r) => c <= 2, { hidden: true, trap: { srd: "pozopinchos" } });
    start = { c: 1, r: Math.floor(rows / 2) };
    note("Campamento orco: la entrada está al oeste, con barricadas y un pozo con pinchos escondido. La gran hoguera ilumina el centro.");
  } else if (region === "ciudad") {
    fill("adoquin"); blob("tierra", 2, 2);
    const houses = []; for (let t = 0; t < 60 && houses.length < 4; t++) { const w = 4 + rint(3), h = 4 + rint(2), c = 1 + rint(cols - w - 1), r = 1 + rint(rows - h - 1);
      if (houses.some(o => c < o.c + o.w + 2 && c + w + 2 > o.c && r < o.r + o.h + 2 && r + h + 2 > o.r)) continue; houses.push({ c, r, w, h }); }
    houses.forEach((o, i) => { for (let r = o.r; r < o.r + o.h; r++) for (let c = o.c; c < o.c + o.w; c++) { const edge = r === o.r || c === o.c || r === o.r + o.h - 1 || c === o.c + o.w - 1; T[key(c, r)] = edge ? "muroladrillo" : i % 2 ? "madera" : "paja"; busy.add(key(c, r)); }
      const dc = o.c + Math.floor(o.w / 2), dr = o.r + o.h - 1; T[key(dc, dr)] = "madera"; props.push({ id: pid(), c: dc, r: dr, k: "puerta", rot: 0 }); });
    put("fuente", 1); put("puesto", 4); put("carro", 2); put("montonpaja", 2); put("barril", 3); put("caja", 3); put("farolillos", 2); put("barricada", 1);
    note("Plaza de la ciudad con casas: las puertas de las casas se abren desde la ✋.");
  } else if (region === "cementerio") {
    fill("hierba"); blob("tierra", 4, 2); blob("removida", 4, 1.2); ring("murocaido", true);
    for (let r = 2; r < rows - 2; r += 2) for (let c = 3; c < cols - 3; c += 2) if (Math.random() < 0.55 && free(c, r)) { busy.add(key(c, r)); props.push({ id: pid(), c, r, k: Math.random() < 0.85 ? "lapida" : "cruz", rot: 0 }); }
    put("mausoleo", 1); put("tumbaabierta", 2, () => true, { h: 2 }); put("arbolmuerto", 3); put("cuervos", 2); put("niebla", 3); put("arcopiedra", 1, (c, r) => c <= 2);
    note("Cementerio: las tumbas abiertas son caídas de 2 m; la niebla es zona ligeramente oscura.");
  } else if (region === "montana") {
    fill("nieve"); blob("rocanevada", 6, 2.5); blob("hielo", 3, 2); blob("hielofino", 1, 1.5);
    const gx = river("vacio", 1, true); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (T[key(c, r)] === "vacio") T[key(c, r)] = "abismo";
    put("puente", 2, on("abismo")); put("pinonevado", 8, not("abismo")); put("monticulo", 4, not("abismo")); put("penasco", 3, not("abismo")); put("refugio", 1, not("abismo")); put("grieta", 2, not("abismo", "hielo"), { h: 6 });
    note(`Paso de montaña: el abismo cruza el mapa (altura en ⚙ Mapa); los puentes son el paso seguro. Hielo resbaladizo y delgado en las placas azules.`);
  } else if (region === "pantano") {
    fill("barro"); blob("agua", 6, 3); blob("aguaprof", 2, 2); blob("juncos", 5, 2); blob("musgo", 3, 2); river("pasarela", 1, false);
    put("manglar", 8, not("pasarela")); put("tronco", 3, not("aguaprof", "pasarela")); put("cabana", 2, not("agua", "aguaprof")); put("nenufares", 5, on("agua")); put("niebla", 3); put("barca", 1, on("agua"));
    note("Pantano: el agua es terreno difícil; el agua profunda obliga a nadar. La pasarela es el único camino rápido.");
  } else if (region === "volcan") {
    fill("volcanica"); blob("ceniza", 5, 3); river("lava", 2, true); blob("brasas", 3, 1.2);
    put("obsidiana", 5, not("lava")); put("geiser", 2, not("lava")); put("grieta", 2, not("lava"), { h: 6 }); put("forja", 1, not("lava")); put("penasco", 3, not("lava"));
    note("Volcán: pon el daño de la lava en ⚙ Mapa (el SRD no lo trae). Las brasas hacen arder a quien las pisa.");
  } else if (region === "costa") {
    fill("arena"); const shore = Math.floor(cols * 0.55); for (let r = 0; r < rows; r++) for (let c = shore; c < cols; c++) T[key(c, r)] = c < shore + 2 ? "agua" : "aguaprof";
    const my = Math.floor(rows / 2); for (let c = shore - 2; c < cols - 2; c++) { T[key(c, my)] = "muelle"; T[key(c, my + 1)] = "muelle"; }
    put("barca", 2, (c, r) => T[key(c, r)] === "agua" || (T[key(c, r)] === "aguaprof" && Math.abs(r - my) <= 3)); put("redes", 3, on("arena")); put("ancla", 1, on("muelle")); put("caja", 4, on("arena")); put("barril", 3, on("arena")); put("roca", 3, on("arena")); put("mastil", 1, on("muelle"));
    note("Puerto: el muelle entra en el agua profunda; quien cae al agua tiene que nadar.");
  } else return generateDungeon(cols, rows, {});
  for (let i = 0; i < cols && !free(start.c, start.r); i++) start = { c: start.c + 1, r: start.r };
  return { terrain: T, props, start };
}
