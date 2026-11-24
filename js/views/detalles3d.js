// Detalles repartidos por el suelo (Hito 85): matas y flores en la hierba, guijarros en la cueva y los caminos,
// hojas en la hojarasca, charcos en el barro, cascotes y algún hueso en la mazmorra, montículos en la nieve…
// - Sale igual para todos: se reparte con una semilla por mesa y casilla (no al azar en cada pantalla).
// - Muchas piezas en pocos dibujos (InstancedMesh): pesa poco.
// - Respeta la niebla de guerra: lo que está en casillas sin ver no se muestra.
// - No se pone en casillas con muro, objeto, puerta o líquido.
import * as THREE from "three";

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
  ember: () => { const g = new THREE.IcosahedronGeometry(0.06, 0); g.translate(0, 0.04, 0); return g; }
};
const MAT = {
  grass: () => mat(0x7aaa44), grassDry: () => mat(0xa09a50), grassDark: () => mat(0x4e7a30), reed: () => mat(0x6a7a3a),
  flowerW: () => mat(0xf0ece0), flowerY: () => mat(0xf0c840), flowerP: () => mat(0xc070d0),
  pebble: () => mat(0x8a8478), pebbleDark: () => mat(0x5a554e), sandPebble: () => mat(0xc8b48a), snowRock: () => mat(0x9a9aa0),
  leafO: () => mat(0xb0602a, { side: THREE.DoubleSide }), leafY: () => mat(0xc8a03a, { side: THREE.DoubleSide }), leafR: () => mat(0x8a3a24, { side: THREE.DoubleSide }),
  twig: () => mat(0x4a3420), puddle: () => mat(0x6a6a70, { roughness: 0.04, metalness: 0.3, flatShading: false, transparent: true, opacity: 0.55 }),
  snow: () => mat(0xeef2f6, { roughness: 0.8, flatShading: false }), bone: () => mat(0xd8cfb8), straw: () => mat(0xd0b060),
  ember: () => mat(0xff6a1a, { emissive: 0xff4a10, emissiveIntensity: 1.4 }), ash: () => mat(0x4a4642)
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
export function buildDressing({ g, cx, cz, CELL, elevY, skip, density = 1, seed = "mesa" }) {
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
