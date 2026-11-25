// Detalles repartidos por el suelo (Hito 85): matas y flores en la hierba, guijarros en la cueva y los caminos,
// hojas en la hojarasca, charcos en el barro, cascotes y algún hueso en la mazmorra, montículos en la nieve…
// - Sale igual para todos: se reparte con una semilla por mesa y casilla (no al azar en cada pantalla).
// - Muchas piezas en pocos dibujos (InstancedMesh): pesa poco.
// - Respeta la niebla de guerra: lo que está en casillas sin ver no se muestra.
// - No se pone en casillas con muro, objeto, puerta o líquido.
import * as THREE from "three";
import { TERRAIN } from "../data/mapas.js";

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, ...extra });

/* ---------- Piezas (una geometría por tipo; el tamaño y el giro van en cada copia) ---------- */
function merge(parts) {
  // une geometrías no indexadas en una sola (para que cada mata sea una sola pieza)
  const pos = [], nor = [];
  parts.forEach(g => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); pos.push(...n.attributes.position.array); nor.push(...n.attributes.normal.array); });
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return out;
}
const GEO = {
  tuft: () => merge([0, 1, 2, 3, 4].map(i => { const c = new THREE.ConeGeometry(0.05, 0.55 + (i % 3) * 0.12, 3); const a = i / 5 * Math.PI * 2; c.rotateZ(Math.cos(a) * 0.35); c.rotateX(Math.sin(a) * 0.35); c.translate(Math.cos(a) * 0.08, 0.27, Math.sin(a) * 0.08); return c; })),
  flower: () => merge([(() => { const s = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 3); s.translate(0, 0.2, 0); return s; })(), (() => { const h = new THREE.IcosahedronGeometry(0.07, 0); h.translate(0, 0.42, 0); return h; })()]),
  pebble: () => { const g = new THREE.DodecahedronGeometry(0.12, 0); g.scale(1, 0.55, 0.8); g.translate(0, 0.04, 0); return g; },
  stone: () => { const g = new THREE.DodecahedronGeometry(0.26, 0); g.scale(1.1, 0.6, 0.85); g.translate(0, 0.08, 0); return g; },
  leaf: () => { const g = new THREE.CircleGeometry(0.11, 5); g.scale(1, 0.6, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0.03, 0); return g; },
  twig: () => { const g = new THREE.CylinderGeometry(0.02, 0.03, 0.7, 4); g.rotateZ(Math.PI / 2); g.translate(0, 0.04, 0); return g; },
  puddle: () => { const g = new THREE.CircleGeometry(0.45, 12); g.rotateX(-Math.PI / 2); g.translate(0, 0.025, 0); return g; },
  mound: () => { const g = new THREE.SphereGeometry(0.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.35, 0.8); return g; },
  bone: () => merge([(() => { const s = new THREE.CylinderGeometry(0.035, 0.035, 0.5, 5); s.rotateZ(Math.PI / 2); s.translate(0, 0.04, 0); return s; })(), ...[-0.25, 0.25].map(x => { const b = new THREE.SphereGeometry(0.06, 5, 4); b.translate(x, 0.05, 0); return b; })]),
  straw: () => merge([0, 1, 2].map(i => { const s = new THREE.CylinderGeometry(0.012, 0.012, 0.5, 3); s.rotateZ(Math.PI / 2); s.rotateY(i * 1.1); s.translate(0, 0.02 + i * 0.01, 0); return s; })),
  ember: () => { const g = new THREE.IcosahedronGeometry(0.06, 0); g.translate(0, 0.04, 0); return g; },
  // Hito 97b (fase 4): atrezzo según el sitio
  patch: () => { const g = new THREE.CircleGeometry(0.55, 9); const p = g.attributes.position; for (let i = 1; i < p.count; i++) { const k = 0.7 + ((i * 7919) % 13) / 30; p.setXY(i, p.getX(i) * k, p.getY(i) * k); } g.rotateX(-Math.PI / 2); g.translate(0, 0.02, 0); return g; },
  candle: () => { const g = new THREE.CylinderGeometry(0.05, 0.06, 0.3, 6); g.translate(0, 0.15, 0); return g; },
  flame: () => { const g = new THREE.ConeGeometry(0.035, 0.1, 5); g.translate(0, 0.36, 0); return g; },
  web: () => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([-0.7, 1.4, 0, 0.7, 1.4, 0, 0, 0.35, 0], 3)); g.computeVertexNormals(); return g; },
  ingot: () => { const g = new THREE.BoxGeometry(0.3, 0.1, 0.14); g.translate(0, 0.05, 0); return g; },
  log: () => { const g = new THREE.CylinderGeometry(0.09, 0.1, 0.9, 6); g.rotateZ(Math.PI / 2); g.translate(0, 0.09, 0); return g; },
  bedroll: () => { const g = new THREE.CapsuleGeometry(0.16, 0.8, 3, 6); g.rotateZ(Math.PI / 2); g.scale(1, 0.55, 1.4); g.translate(0, 0.09, 0); return g; },
  blade: () => merge([(() => { const b = new THREE.BoxGeometry(0.8, 0.02, 0.07); b.translate(0.1, 0.03, 0); return b; })(), (() => { const h = new THREE.BoxGeometry(0.05, 0.03, 0.28); h.translate(-0.3, 0.03, 0); return h; })()]),
  ring: () => { const g = new THREE.RingGeometry(0.62, 0.7, 24); g.rotateX(-Math.PI / 2); g.translate(0, 0.025, 0); return g; }
};
const MAT = {
  grass: () => mat(0x7aaa44), grassDry: () => mat(0xa09a50), grassDark: () => mat(0x4e7a30), reed: () => mat(0x6a7a3a),
  flowerW: () => mat(0xf0ece0), flowerY: () => mat(0xf0c840), flowerP: () => mat(0xc070d0),
  pebble: () => mat(0x8a8478), pebbleDark: () => mat(0x5a554e), sandPebble: () => mat(0xc8b48a), snowRock: () => mat(0x9a9aa0),
  leafO: () => mat(0xb0602a, { side: THREE.DoubleSide }), leafY: () => mat(0xc8a03a, { side: THREE.DoubleSide }), leafR: () => mat(0x8a3a24, { side: THREE.DoubleSide }),
  twig: () => mat(0x4a3420), puddle: () => mat(0x6a6a70, { roughness: 0.04, metalness: 0.3, flatShading: false, transparent: true, opacity: 0.55 }),
  snow: () => mat(0xeef2f6, { roughness: 0.8, flatShading: false }), bone: () => mat(0xd8cfb8), straw: () => mat(0xd0b060),
  ember: () => mat(0xff6a1a, { emissive: 0xff4a10, emissiveIntensity: 1.4 }), ash: () => mat(0x4a4642),
  wetStone: () => mat(0x4a4e4c, { roughness: 0.25, metalness: 0.15 }), moss: () => mat(0x3e5a2a, { transparent: true, opacity: 0.75, depthWrite: false }),
  damp: () => mat(0x141210, { transparent: true, opacity: 0.32, depthWrite: false }), blood: () => mat(0x3a0806, { transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.4 }),
  burn: () => mat(0x0a0806, { transparent: true, opacity: 0.6, depthWrite: false }), ashDisk: () => mat(0x3a3634, { transparent: true, opacity: 0.85, depthWrite: false }),
  wax: () => mat(0xeee2c4, { flatShading: false }), flame: () => new THREE.MeshBasicMaterial({ color: 0xffc860 }),
  web: () => new THREE.MeshBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  gold: () => mat(0xc89a3a, { metalness: 0.7, roughness: 0.35 }), iron: () => mat(0x5a5652, { metalness: 0.6, roughness: 0.45 }),
  log: () => mat(0x4a3420), cloth: () => mat(0x6a3a2a), salt: () => mat(0xf2efe8, { transparent: true, opacity: 0.8, depthWrite: false }),
  dryFlower: () => mat(0x8a5a3a), stoneRing: () => mat(0x6a655e)
};
// Qué lleva cada terreno: [pieza, material, cuántas por casilla (media), escala mín, escala máx]
const DRESS = {
  hierba: [["tuft", "grass", 3.2, 1.1, 1.8], ["tuft", "grassDark", 1.2, 1.2, 1.9], ["flower", "flowerW", 0.35, 0.8, 1.2], ["flower", "flowerY", 0.3, 0.8, 1.2]],
  hierbalta: [["tuft", "grass", 5, 1.2, 1.9], ["tuft", "grassDry", 1.5, 1.1, 1.7], ["flower", "flowerP", 0.3, 1, 1.4]],
  musgo: [["tuft", "grassDark", 1.6, 0.5, 0.8], ["pebble", "pebbleDark", 0.6, 0.8, 1.4]],
  juncos: [["tuft", "reed", 4, 1.6, 2.4]],
  hojarasca: [["leaf", "leafO", 5, 0.8, 1.4], ["leaf", "leafY", 3, 0.8, 1.3], ["leaf", "leafR", 2, 0.8, 1.3], ["twig", "twig", 0.5, 0.7, 1.2]],
  raices: [["twig", "twig", 2, 1, 1.8], ["tuft", "grassDark", 0.6, 0.6, 1]],
  tierra: [["pebble", "pebble", 1.4, 0.7, 1.4], ["twig", "twig", 0.25, 0.6, 1], ["tuft", "grassDry", 0.35, 0.6, 1]],
  camino: [["pebble", "pebble", 2, 0.6, 1.2], ["tuft", "grass", 0.25, 0.5, 0.8]],
  pisoteada: [["pebble", "pebble", 1.2, 0.6, 1.1], ["tuft", "grassDry", 0.4, 0.5, 0.8]],
  removida: [["pebble", "pebbleDark", 1.5, 0.7, 1.4], ["stone", "pebbleDark", 0.25, 0.6, 1]],
  barro: [["puddle", "puddle", 0.35, 0.5, 1.1], ["pebble", "pebbleDark", 0.6, 0.6, 1]],
  arena: [["pebble", "sandPebble", 0.9, 0.5, 1], ["tuft", "grassDry", 0.15, 0.6, 1]],
  nieve: [["mound", "snow", 0.6, 0.6, 1.3], ["stone", "snowRock", 0.15, 0.6, 1]],
  rocanevada: [["mound", "snow", 0.5, 0.5, 1], ["stone", "snowRock", 0.6, 0.6, 1.2]],
  cueva: [["pebble", "pebbleDark", 2.2, 0.7, 1.5], ["stone", "pebbleDark", 0.45, 0.6, 1.3], ["bone", "bone", 0.04, 0.8, 1.1]],
  escombros: [["stone", "pebble", 1.2, 0.6, 1.4], ["pebble", "pebble", 2.4, 0.7, 1.4]],
  volcanica: [["pebble", "ash", 1.8, 0.7, 1.4], ["ember", "ember", 0.5, 0.6, 1.2]],
  ceniza: [["pebble", "ash", 1, 0.6, 1.1], ["ember", "ember", 0.35, 0.5, 1]],
  paja: [["straw", "straw", 3, 0.8, 1.3]],
  piedra: [["pebble", "pebble", 0.35, 0.6, 1.1], ["stone", "pebbleDark", 0.06, 0.6, 1], ["bone", "bone", 0.025, 0.8, 1]],
  adoquin: [["pebble", "pebble", 0.25, 0.5, 0.9], ["tuft", "grass", 0.12, 0.4, 0.7]]
};
export const DENSITY = { 0: 0, 1: 1, 2: 1.8 };

// semilla por casilla: siempre la misma para la misma mesa
function rngFor(seed, c, r) {
  let h = 2166136261 >>> 0; const s = seed + "|" + c + "," + r;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}

/**
 * Monta los detalles. `skip(c, r)`: casillas donde no va nada. Devuelve { group, shroud: [{ im, i, c, r, m }] }.
 */
export function buildDressing({ g, cx, cz, CELL, elevY, skip, density = 1, seed = "mesa", wallH = 2, high = false }) {
  const group = new THREE.Group(), shroud = [], k = DENSITY[density] ?? 1;
  if (!k) return { group, shroud };
  const lists = new Map(); // "pieza|material" → [{ m, c, r }]
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    if (skip(c, r)) continue;
    const t = (g.terrain || {})[c + "," + r] || "piedra", D = DRESS[t]; if (!D) continue;
    const R = rngFor(seed, c, r), y0 = elevY(c, r), X = cx(c), Z = cz(r), h = CELL / 2 - 0.25;
    for (const [geo, mt, avg, s0, s1] of D) {
      const want = avg * k; let n = Math.floor(want); if (R() < want - n) n++;
      for (let i = 0; i < n; i++) {
        const sc = s0 + R() * (s1 - s0);
        // reparto menos regular, inclinación natural y un leve hundimiento para que asienten en el terreno
        const ox = (R() * 2 - 1) * h * (0.75 + R() * 0.25), oz = (R() * 2 - 1) * h * (0.75 + R() * 0.25);
        const yOff = geo === "puddle" ? 0 : geo === "mound" ? -0.02 : (R() - 0.4) * 0.06;
        p.set(X + ox, y0 + yOff, Z + oz);
        const tilt = geo === "tuft" || geo === "flower" || geo === "stone" || geo === "pebble" ? (R() - 0.5) * 0.35 : 0;
        e.set(tilt, R() * Math.PI * 2, geo === "tuft" ? (R() - 0.5) * 0.3 : geo === "leaf" || geo === "straw" ? (R() - 0.5) * 0.4 : 0);
        s.set(sc * (0.9 + R() * 0.2), geo === "puddle" || geo === "leaf" ? 1 : sc * (0.8 + R() * 0.35), sc * (0.9 + R() * 0.2));
        m4.compose(p, q.setFromEuler(e), s);
        // Hito 89: cada pieza con su tono (algo más clara u oscura, cálida o fría)
        const shade = 0.84 + R() * 0.32, warm = 0.97 + R() * 0.06;
        const key = geo + "|" + mt; if (!lists.has(key)) lists.set(key, []);
        lists.get(key).push({ m: m4.clone(), c, r, col: new THREE.Color(shade * warm, shade, shade * (2 - warm)) });
      }
    }
  }
  contextual({ g, cx, cz, CELL, elevY, skip, k, seed, lists, wallH, high });
  const geos = {}, mats = {};
  for (const [key, L] of lists) {
    const [geo, mt] = key.split("|");
    const im = new THREE.InstancedMesh(geos[geo] = geos[geo] || GEO[geo](), mats[mt] = mats[mt] || MAT[mt](), L.length);
    L.forEach((x, i) => { im.setMatrixAt(i, x.m); im.setColorAt(i, x.col); shroud.push({ im, i, c: x.c, r: x.r, m: x.m }); });
    im.receiveShadow = true; im.castShadow = false; im.raycast = () => {};
    group.add(im);
  }
  return { group, shroud };
}

/* ---------- Hito 97b (fase 4): atrezzo según el sitio ----------
   E1 juncos y piedras mojadas en la orilla · E2 musgo o humedad al pie de los muros · E3 brasas y ceniza alrededor del fuego
   C1 telarañas en las esquinas de mazmorra y cueva · C3 velas y huesos junto a altares, lingotes junto a la forja, flores
   secas junto a tumbas · C4 manchas de sangre y quemaduras · E6 escenas: campamento apagado, rincón de ritual, restos de pelea.
   Todo con la misma semilla que el resto: sale igual para todos y no cambia al recargar. */
const OUTDOOR = new Set(["hierba", "hierbalta", "musgo", "barro", "tierra", "camino", "juncos", "arena", "hojarasca", "raices", "pisoteada", "removida", "nieve"]);
const DUNGEON = new Set(["piedra", "cueva", "escombros", "adoquin", "marmol", "losas"]);
const FIRE = new Set(["hoguera", "granhoguera", "brasero", "forja", "estatuafuego", "caldero"]);
const HOLY = new Set(["altar", "mesaritual", "sarcofago", "ataud", "circulo", "trono"]), SMITH = new Set(["forja", "yunque", "lingotes"]), GRAVE = new Set(["lapida", "tumbaabierta", "mausoleo", "cruz"]);
function contextual({ g, cx, cz, CELL, elevY, skip, k, seed, lists, wallH, high }) {
  const T = g.terrain || {}, ter = (c, r) => T[c + "," + r] || "piedra";
  const inG = (c, r) => c >= 0 && r >= 0 && c < g.cols && r < g.rows;
  const wall = (c, r) => !inG(c, r) || !!(TERRAIN[ter(c, r)] && TERRAIN[ter(c, r)].wall);
  const water = (c, r) => inG(c, r) && ["agua", "aguaprof"].includes(ter(c, r));
  const near = new Map(); // casilla → tipos de objeto a 1 casilla o menos
  for (const p of g.props || []) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const kk = (p.c + dc) + "," + (p.r + dr); if (!near.has(kk)) near.set(kk, new Set()); near.get(kk).add(p.k); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
  const put = (geo, mt, x, y, z, sc = 1, ry = 0, c = 0, r = 0, tilt = 0, sy = sc) => {
    m4.compose(P.set(x, y, z), q.setFromEuler(e.set(tilt, ry, 0)), S.set(sc, sy, sc));
    const key = geo + "|" + mt; if (!lists.has(key)) lists.set(key, []);
    const sh = 0.88 + ((x * 13.1 + z * 7.7) % 1 + 1) % 1 * 0.24; lists.get(key).push({ m: m4.clone(), c, r, col: new THREE.Color(sh, sh, sh) });
  };
  const scenes = []; let budget = Math.max(1, Math.round(g.cols * g.rows / 260));
  const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    if (skip(c, r)) continue;
    const t = ter(c, r), R = rngFor(seed + "#ctx", c, r), X = cx(c), Z = cz(r), y0 = elevY(c, r), h = CELL / 2;
    const out = OUTDOOR.has(t), dun = DUNGEON.has(t), nb = near.get(c + "," + r) || new Set();
    const wallSides = SIDES.filter(([dc, dr]) => wall(c + dc, r + dr) && inG(c + dc, r + dr));
    const wetSides = SIDES.filter(([dc, dr]) => water(c + dc, r + dr));
    // E1: orilla
    if (wetSides.length && (out || t === "cueva")) wetSides.forEach(([dc, dr]) => {
      const n = Math.round((2 + R() * 2) * k);
      for (let i = 0; i < n; i++) { const along = (R() - 0.5) * CELL * 0.9, x = X + dc * h * (0.6 + R() * 0.35) + (dc ? 0 : along), z = Z + dr * h * (0.6 + R() * 0.35) + (dr ? 0 : along);
        if (t === "cueva" || R() < 0.35) put("stone", "wetStone", x, y0 + 0.02, z, 0.6 + R() * 0.7, R() * 6, c, r); else put("tuft", "reed", x, y0, z, 1.5 + R() * 0.9, R() * 6, c, r, (R() - 0.5) * 0.3); }
    });
    // E2: al pie de los muros
    wallSides.forEach(([dc, dr]) => {
      if (R() > 0.55 * k) return;
      const along = (R() - 0.5) * CELL * 0.7, x = X + dc * h * 0.62 + (dc ? 0 : along), z = Z + dr * h * 0.62 + (dr ? 0 : along);
      put("patch", out || t === "cueva" ? "moss" : "damp", x, y0 + 0.005 + R() * 0.004, z, 0.8 + R() * 0.7, R() * 6, c, r);
      if (out && R() < 0.6) put("tuft", "grassDark", x, y0, z, 0.8 + R() * 0.5, R() * 6, c, r);
    });
    // C1: telarañas en las esquinas
    if (dun && wallSides.length >= 2 && R() < 0.45) {
      for (let i = 0; i < wallSides.length; i++) { const [a, b] = wallSides[i], [a2, b2] = wallSides[(i + 1) % wallSides.length]; if (a * a2 + b * b2 !== 0) continue;
        const dx = a + a2, dz = b + b2, x = X + dx * (h - 0.55), z = Z + dz * (h - 0.55), hh = Math.min(1, wallH / 1.6);
        put("web", "web", x, y0 + Math.max(0, wallH - 1.5) * 0.4, z, 0.9, Math.atan2(dx, dz), c, r, 0, hh); break; }
    }
    // E3: fuego cerca
    const hot = [...nb].some(x => FIRE.has(x)) || SIDES.some(([dc, dr]) => ["lava", "brasas"].includes(ter(c + dc, r + dr)));
    if (hot) { const n = Math.round((2 + R() * 3) * k); for (let i = 0; i < n; i++) put(R() < 0.55 ? "ember" : "pebble", R() < 0.55 ? "ember" : "ash", X + (R() - 0.5) * CELL * 0.9, y0, Z + (R() - 0.5) * CELL * 0.9, 0.7 + R() * 0.6, R() * 6, c, r); }
    // C3: junto a objetos importantes
    if ([...nb].some(x => HOLY.has(x)) && R() < 0.75) { const n = 2 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const x = X + (R() - 0.5) * CELL * 0.8, z = Z + (R() - 0.5) * CELL * 0.8, sc = 0.7 + R() * 0.8; put("candle", "wax", x, y0, z, 1, 0, c, r, 0, sc); put("flame", "flame", x, y0 + 0.3 * (sc - 1), z, 1, 0, c, r); } if (R() < 0.4) put("bone", "bone", X + (R() - 0.5) * 2, y0, Z + (R() - 0.5) * 2, 1, R() * 6, c, r); }
    if ([...nb].some(x => SMITH.has(x)) && R() < 0.6) { put("ingot", R() < 0.5 ? "gold" : "iron", X + (R() - 0.5) * 2, y0, Z + (R() - 0.5) * 2, 1, R() * 6, c, r); put("twig", "iron", X + (R() - 0.5) * 2, y0, Z + (R() - 0.5) * 2, 0.8, R() * 6, c, r); }
    if ([...nb].some(x => GRAVE.has(x)) && R() < 0.6) for (let i = 0; i < 3; i++) put("flower", "dryFlower", X + (R() - 0.5) * 1.6, y0, Z + (R() - 0.5) * 1.6, 0.9 + R() * 0.4, R() * 6, c, r, (R() - 0.5) * 0.8);
    // C4: manchas
    if (dun) { const v = R(); if (v < 0.035) put("patch", "blood", X + (R() - 0.5) * 2, y0 + 0.012, Z + (R() - 0.5) * 2, 0.5 + R() * 0.6, R() * 6, c, r); else if (v < 0.065) put("patch", "burn", X + (R() - 0.5) * 2, y0 + 0.011, Z + (R() - 0.5) * 2, 0.7 + R() * 0.8, R() * 6, c, r); }
    // E6: escenas (pocas y separadas)
    if (budget > 0 && !wallSides.length && !nb.size && R() < 0.02 && !scenes.some(([a, b]) => Math.abs(a - c) < 7 && Math.abs(b - r) < 7)) {
      const kind = out ? "camp" : dun ? (R() < 0.5 ? "ritual" : "fight") : "fight";
      scenes.push([c, r]); budget--;
      if (kind === "camp") {
        put("patch", "ashDisk", X, y0 + 0.012, Z, 1.1, 0, c, r);
        for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; put("stone", "stoneRing", X + Math.cos(a) * 0.78, y0 + 0.02, Z + Math.sin(a) * 0.78, 0.75, a, c, r); }
        put("log", "log", X, y0 + 0.02, Z, 1, 0.6, c, r); put("log", "log", X, y0 + 0.11, Z, 1, -0.7, c, r); put("ember", "ember", X + 0.1, y0 + 0.08, Z, 1.2, 0, c, r);
        put("bedroll", "cloth", X + 1.6, y0, Z + 0.6, 1, 0.4, c, r);
      } else if (kind === "ritual") {
        put("ring", "salt", X, y0, Z, 1.6, 0, c, r);
        for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 - 1.57, x = X + Math.cos(a) * 1.08, z = Z + Math.sin(a) * 1.08, sc = 0.6 + R() * 0.7; put("candle", "wax", x, y0, z, 1, 0, c, r, 0, sc); put("flame", "flame", x, y0 + 0.3 * (sc - 1), z, 1, 0, c, r); }
        put("bone", "bone", X + 0.1, y0, Z, 1, R() * 6, c, r); put("patch", "blood", X - 0.2, y0 + 0.012, Z + 0.1, 0.5, 0, c, r);
      } else {
        put("blade", "iron", X + (R() - 0.5), y0, Z + (R() - 0.5), 1, R() * 6, c, r); put("blade", "iron", X + (R() - 0.5) * 1.5, y0, Z + (R() - 0.5) * 1.5, 0.9, R() * 6, c, r);
        for (let i = 0; i < 3; i++) put("bone", "bone", X + (R() - 0.5) * 2, y0, Z + (R() - 0.5) * 2, 1, R() * 6, c, r);
        put("patch", "blood", X, y0 + 0.012, Z, 0.9, R() * 6, c, r);
      }
    }
  }
}
