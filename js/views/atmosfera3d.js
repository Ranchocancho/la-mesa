// Atmósfera de la mesa 3D (Hito 87): niebla baja, haces de luz con polvo y fondo lejano en exteriores.
// Todo es decorado: no tapa casillas ni se puede pulsar. Lo más caro (los haces) solo en calidad alta.
import * as THREE from "three";
import { TERRAIN } from "../data/mapas.js";

const MISTY = { barro: 1, juncos: 1, agua: 0.8, aguaprof: 0.8, musgo: 0.7, cueva: 0.6, hojarasca: 0.4, raices: 0.6, brea: 0.5, ceniza: 0.6, volcanica: 0.5, nieve: 0.4 };
const AMB_MIST = { dia: 0.15, interior: 0.2, noche: 0.7, penumbra: 0.6, oscuro: 0.5 };
const MIST_COL = { dia: 0xe8eef2, interior: 0xc8b8a0, noche: 0x8a9ac8, penumbra: 0xa89a88, oscuro: 0x6a6a80 };

let PUFF = null, SHAFT = null;
function puffTex() {
  if (PUFF) return PUFF;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  for (let i = 0; i < 14; i++) { const x = 30 + Math.random() * 68, y = 40 + Math.random() * 48, r = 18 + Math.random() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  return (PUFF = new THREE.CanvasTexture(c));
}
function shaftTex() {
  if (SHAFT) return SHAFT;
  const c = document.createElement("canvas"); c.width = 64; c.height = 128; const g = c.getContext("2d");
  const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, "rgba(255,255,255,0)"); v.addColorStop(0.25, "rgba(255,255,255,.55)"); v.addColorStop(1, "rgba(255,255,255,0.05)");
  g.fillStyle = v; g.fillRect(0, 0, 64, 128);
  const h = g.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, "rgba(0,0,0,1)"); h.addColorStop(0.5, "rgba(0,0,0,0)"); h.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = h; g.fillRect(0, 0, 64, 128);
  return (SHAFT = new THREE.CanvasTexture(c));
}
const rng = seed => { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; s = s || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

/** Monta la atmósfera para la mesa `g` con el ambiente `amb`. Devuelve { group, step(dt), dispose() }. */
export function buildAtmosphere({ g, cx, cz, CELL, elevY, isWall, amb, high, seed }) {
  const group = new THREE.Group(), steps = [], shroud = [], R = rng(seed + "|" + amb);
  const floor = [], misty = [];
  let ext = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    if (isWall(c, r)) continue;
    const t = (g.terrain || {})[c + "," + r] || "piedra", T = TERRAIN[t] || {};
    floor.push([c, r]); if (T.cat === "exterior") ext++;
    if (MISTY[t]) misty.push([c, r, MISTY[t]]);
  }
  const exterior = floor.length && ext / floor.length > 0.5;

  // 1) Niebla baja: más de noche y sobre barro, juncos, agua, cueva…
  const base = AMB_MIST[amb] ?? 0.2, col = new THREE.Color(MIST_COL[amb] ?? 0xcccccc);
  const spots = [];
  misty.forEach(([c, r, k]) => { if (R() < 0.42 * k) spots.push([c, r, Math.min(1, base + k * 0.55)]); });
  if (base >= 0.45) floor.forEach(([c, r]) => { if (R() < 0.07) spots.push([c, r, base]); });
  // Hito 88: dos capas (a ras de suelo y media altura, sin pasar de la cintura de las figuras), con subida y bajada lenta
  spots.slice(0, 110).forEach(([c, r, k], idx) => {
    const layer = idx % 2;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: col, transparent: true, opacity: 0, depthWrite: false, fog: true }));
    const sc = CELL * (1.5 + R() * 1.6 + layer * 0.4); s.scale.set(sc, sc * (0.38 + layer * 0.1), 1);
    const x0 = cx(c) + (R() - 0.5) * CELL * 1.1, z0 = cz(r) + (R() - 0.5) * CELL * 1.1;
    const y0 = elevY(c, r) + (layer === 0 ? 0.35 + R() * 0.5 : 0.9 + R() * 0.5);
    s.position.set(x0, y0, z0); s.raycast = () => {}; group.add(s); shroud.push({ obj: s, c, r });
    let t = R() * 20; const sp = 0.11 + R() * 0.18, a = R() * 6.28, top = (0.18 + layer * 0.04) * k, driftY = (R() - 0.5) * 0.25;
    steps.push(dt => {
      t += dt; const wob = Math.sin(t * sp);
      s.position.set(x0 + Math.cos(a) * wob * 1.4, y0 + Math.sin(t * 0.22 + a) * driftY, z0 + Math.sin(a) * wob * 1.4);
      s.material.opacity = top * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.35 + a))) * (layer ? 0.7 : 1);
    });
  });

  // 2) Haces de luz con polvo (solo calidad alta; de día y en interiores)
  if (high && (amb === "interior" || (amb === "dia" && !exterior)) && floor.length) {
    const n = Math.min(4, 1 + Math.floor(floor.length / 60));
    for (let i = 0; i < n; i++) {
      const [c, r] = floor[Math.floor(R() * floor.length)], H = 22;
      const m = new THREE.MeshBasicMaterial({ map: shaftTex(), color: amb === "dia" ? 0xfff2d8 : 0xffd8a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
      const sh = new THREE.Group();
      [0, Math.PI / 2].forEach(rot => { const p = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 1.3, H), m); p.rotation.y = rot; p.raycast = () => {}; sh.add(p); });
      sh.position.set(cx(c), elevY(c, r) + H / 2 - 0.3, cz(r)); sh.rotation.z = 0.18; sh.rotation.x = -0.1; group.add(sh);
      let t = R() * 10;
      steps.push(dt => { t += dt; m.opacity = 0.13 + Math.sin(t * 0.5) * 0.04; });
    }
  }

  // 3) Fondo lejano en exteriores: colinas y árboles en silueta alrededor de la mesa (la niebla los difumina)
  if (exterior) {
    const W = g.cols * CELL, Hh = g.rows * CELL, R0 = Math.max(W, Hh) * 0.5 + 140;
    const dark = new THREE.Color(amb === "dia" ? 0x5a6a58 : amb === "noche" ? 0x141a24 : 0x1e1a16);
    const hillM = new THREE.MeshLambertMaterial({ color: dark, flatShading: true, fog: true }), treeM = new THREE.MeshLambertMaterial({ color: dark.clone().multiplyScalar(0.75), flatShading: true, fog: true });
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + R() * 0.2, d = R0 + R() * 50, w = 30 + R() * 50, h = 10 + R() * 26;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(w * 1.6, h, 6), hillM); hill.position.set(Math.cos(a) * d, h / 2 - 14, Math.sin(a) * d); hill.rotation.y = R() * 6; hill.scale.z = 0.6; group.add(hill);
    }
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 9, 5), treeM, 90), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < 90; i++) { const a = R() * Math.PI * 2, d = R0 - 40 + R() * 30, k = 1 + R() * 1.2; trees.setMatrixAt(i, m4.compose(p.set(Math.cos(a) * d, 4.5 * k - 9, Math.sin(a) * d), q.identity(), s.set(k, k, k))); }
    group.add(trees);
  }

  group.traverse(o => { o.raycast = () => {}; });
  return {
    group, shroud,
    step: dt => steps.forEach(f => f(dt)),
    dispose() { group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map !== PUFF && o.material.map !== SHAFT) o.material.dispose(); }); }
  };
}

/* ---------- Hito 89: tono según el entorno y la hora ---------- */
// Tipo de entorno por proporción de terrenos (no basta una casilla suelta)
export function envKindOf(g) {
  const n = { volcan: 0, cueva: 0, costa: 0, nieve: 0, interior: 0, exterior: 0 }; let tot = 0;
  for (const [, t] of Object.entries(g.terrain || {})) {
    const T = TERRAIN[t]; if (!T || T.wall) continue; tot++;
    if (["lava", "brasas", "volcanica", "ceniza", "brea"].includes(t)) n.volcan++;
    else if (["cueva", "escombros"].includes(t)) n.cueva++;
    else if (["agua", "aguaprof", "juncos", "muelle", "cubierta", "arena"].includes(t)) n.costa++;
    else if (["nieve", "hielo", "hielofino", "rocanevada"].includes(t)) n.nieve++;
    else if (T.cat === "interior") n.interior++; else n.exterior++;
  }
  const cells = (g.cols || 1) * (g.rows || 1), rest = Math.max(0, cells - tot); n.interior += rest * 0.3; // sin pintar = piedra
  if (n.volcan >= cells * 0.12) return "volcan";
  if (n.nieve >= cells * 0.25) return "nieve";
  if (n.cueva >= cells * 0.25) return "cueva";
  if (n.costa >= cells * 0.25) return "costa";
  return n.interior >= n.exterior ? "interior" : "exterior";
}
// temperatura de cada entorno: + cálido, − frío
export const ENV_TEMP = { volcan: 0.45, interior: 0.06, exterior: 0, costa: -0.12, cueva: -0.2, nieve: -0.3 };
/** Temperatura extra según la hora del reloj de campaña: cálido al amanecer y al atardecer, frío de madrugada. */
export function hourTemp(min) {
  if (min == null) return 0;
  const h = ((min / 60) % 24 + 24) % 24;
  return Math.exp(-Math.pow((h - 19) / 1.6, 2)) * 0.45 + Math.exp(-Math.pow((h - 7) / 1.4, 2)) * 0.3 - Math.exp(-Math.pow((h - 3) / 2.5, 2)) * 0.25;
}
/** Desplaza un color hacia lo cálido (temp > 0) o lo frío (temp < 0). */
export function tint(hex, temp) {
  const c = new THREE.Color(hex), t = Math.max(-1, Math.min(1, temp || 0));
  if (t >= 0) c.offsetHSL(-0.02 * t, 0.12 * t, 0.02 * t); else c.offsetHSL(0.06 * -t, 0.12 * -t, -0.02 * -t);
  return c;
}
/** Zonas de microclima para las partículas: cálidas junto a lava, brasas o fuego; frías junto a hielo o nieve. */
export function climateZones(g, cx, cz, CELL, PROPS) {
  const Z = [];
  for (const [k, t] of Object.entries(g.terrain || {})) {
    const [c, r] = k.split(",").map(Number);
    if (["lava", "brasas", "brea", "volcanica"].includes(t)) Z.push({ x: cx(c), z: cz(r), r: CELL * 1.6, warm: 1 });
    else if (["hielo", "hielofino", "nieve", "rocanevada"].includes(t)) Z.push({ x: cx(c), z: cz(r), r: CELL * 1.4, warm: -1 });
  }
  for (const p of g.props || []) if (["hoguera", "brasero", "forja", "granhoguera", "antorcha", "estatuafuego"].includes(p.k) || ((PROPS[p.k] || {}).light)) Z.push({ x: cx(p.c), z: cz(p.r), r: CELL * 2.2, warm: 1 });
  // no más de 80 (se toman salteadas)
  return Z.length > 80 ? Z.filter((_, i) => i % Math.ceil(Z.length / 80) === 0) : Z;
}
