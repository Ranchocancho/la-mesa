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
/** Qué fondo poner alrededor de la mesa (null = ninguno: interiores y cuevas, donde el vacío oscuro funciona). */
function backdropKind(g, floor, exterior) {
  const T = g.terrain || {}, n = floor.length || 1, share = ks => floor.filter(([c, r]) => ks.includes(T[c + "," + r] || "piedra")).length / n;
  const props = g.props || [], graves = props.filter(p => ["lapida", "cruz", "mausoleo", "tumbaabierta"].includes(p.k)).length;
  const env = envKindOf(g);
  if (env === "volcan") return "volcan";
  if (env === "cueva" || env === "nieve" && !exterior) return null;
  if (env === "costa" || share(["agua", "aguaprof", "muelle", "cubierta", "arena"]) > 0.3) return "coast";
  if (share(["adoquin"]) > 0.2) return "city";
  if (graves >= 3) return "grave";
  if (share(["barro", "juncos", "musgo", "agua"]) > 0.25) return "swamp";
  return exterior ? "forest" : null;
}
let BAND = null;
function bandTex() { // franja de horizonte: clara abajo, se desvanece hacia arriba
  if (BAND) return BAND;
  const c = document.createElement("canvas"); c.width = 4; c.height = 128; const g = c.getContext("2d"), gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.25, "rgba(255,255,255,.9)"); gr.addColorStop(0.45, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return (BAND = new THREE.CanvasTexture(c));
}
let MOON = null;
function moonTex() { // una ventana con cruz, con los bordes suaves
  if (MOON) return MOON;
  const c = document.createElement("canvas"); c.width = 128; c.height = 192; const g = c.getContext("2d");
  g.filter = "blur(10px)"; g.fillStyle = "#fff"; g.fillRect(24, 24, 80, 144); g.filter = "none";
  g.globalCompositeOperation = "destination-out"; g.filter = "blur(2px)"; g.fillRect(60, 18, 8, 156); g.fillRect(18, 88, 92, 8); g.filter = "none";
  return (MOON = new THREE.CanvasTexture(c));
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

  // 3) Hito 106: fondo lejano según el entorno (antes, solo un bosque en exteriores). Con una franja de horizonte
  //    clara detrás, para que las siluetas se recorten también de noche.
  const kind = backdropKind(g, floor, exterior);
  if (kind) {
    const W = g.cols * CELL, Hh = g.rows * CELL, R0 = Math.max(W, Hh) * 0.5 + 140;
    const HZ = { dia: 0xb8c8d0, noche: 0x31466e, penumbra: 0x5a4a3c, oscuro: 0x1e2232, interior: 0x3a2a1c }[amb] ?? 0x4a4038;
    const horizon = kind === "volcan" ? 0x7a2a10 : HZ;
    { const band = new THREE.Mesh(new THREE.CylinderGeometry(R0 + 70, R0 + 70, 120, 48, 1, true), new THREE.MeshBasicMaterial({ map: bandTex(), color: horizon, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false }));
      band.position.y = 30; band.renderOrder = -2; group.add(band); }
    if (amb === "noche" || amb === "oscuro") { // luna baja, para que haya algo de luz detrás de las siluetas
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: 0xc8d8ff, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      const a = R() * 6.28; moon.position.set(Math.cos(a) * (R0 + 60), 46, Math.sin(a) * (R0 + 60)); moon.scale.set(40, 40, 1); group.add(moon); }
    const dark = new THREE.Color(amb === "dia" ? 0x5a6a58 : amb === "noche" ? 0x0c1018 : 0x141110);
    const M = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true, fog: true }), sil = M(dark), sil2 = M(dark.clone().multiplyScalar(0.75));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
    const ring = (n, geo, mat, place) => { const im = new THREE.InstancedMesh(geo, mat, n); for (let i = 0; i < n; i++) { const [x, y, z, sx, sy, sz, ry] = place(i); im.setMatrixAt(i, m4.compose(P.set(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0), S.set(sx, sy, sz))); } group.add(im); return im; };
    const at = (spread = 50) => { const a = R() * Math.PI * 2, d = R0 + R() * spread; return [Math.cos(a) * d, Math.sin(a) * d, a]; };
    if (kind === "forest" || kind === "swamp" || kind === "grave") {
      ring(26, new THREE.ConeGeometry(1, 1, 6), sil, () => { const [x, z] = at(50), w = 40 + R() * 60, h = kind === "swamp" ? 4 + R() * 8 : 10 + R() * 26; return [x, h / 2 - 14, z, w * 1.6, h, w, R() * 6]; });
    }
    if (kind === "forest") ring(90, new THREE.ConeGeometry(2.2, 9, 5), sil2, () => { const [x, z] = at(-30), k = 1 + R() * 1.2; return [x, 4.5 * k - 9, z, k, k, k]; });
    if (kind === "swamp") { // árboles muertos y retorcidos
      const tg = new THREE.CylinderGeometry(0.25, 0.6, 1, 5); ring(60, tg, sil2, () => { const [x, z] = at(-20), h = 8 + R() * 10; return [x, h / 2 - 9, z, 1.4, h, 1.4, R() * 6]; });
      const bg2 = new THREE.CylinderGeometry(0.12, 0.25, 1, 4); bg2.rotateZ(1); ring(80, bg2, sil2, () => { const [x, z] = at(-20), h = 3 + R() * 4; return [x, 2 + R() * 6, z, 1, h, 1, R() * 6]; });
    }
    if (kind === "grave") { // colina con cruces y un árbol seco
      const cr = new THREE.BoxGeometry(0.5, 3, 0.5), cb = new THREE.BoxGeometry(2, 0.5, 0.5); 
      ring(40, cr, sil2, () => { const [x, z, a] = at(-25); return [x, -3 + R() * 2, z, 1, 1, 1, -a]; });
      ring(40, cb, sil2, () => { const [x, z, a] = at(-25); return [x, -2.2 + R() * 2, z, 1, 1, 1, -a]; });
    }
    if (kind === "volcan") { // montañas con resplandor en la cumbre
      ring(18, new THREE.ConeGeometry(1, 1, 7), sil, () => { const [x, z] = at(40), w = 50 + R() * 50, h = 30 + R() * 40; return [x, h / 2 - 14, z, w, h, w * 0.8, R() * 6]; });
      const glow = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.6, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
      ring(8, new THREE.SphereGeometry(1, 8, 6), glow, () => { const [x, z] = at(20); return [x, 18 + R() * 14, z, 10, 4, 10]; });
    }
    if (kind === "coast") { // el mar hasta el horizonte, con barcos y un faro en silueta
      const sea = new THREE.Mesh(new THREE.RingGeometry(R0 - 40, R0 + 160, 48), new THREE.MeshLambertMaterial({ color: amb === "dia" ? 0x3a6a80 : 0x0e1a28, fog: true })); sea.rotation.x = -Math.PI / 2; sea.position.y = -6; group.add(sea);
      const hull = new THREE.BoxGeometry(14, 4, 4), mast = new THREE.BoxGeometry(0.6, 16, 0.6), sail = new THREE.ConeGeometry(4, 10, 3);
      const ships = [...Array(5)].map(() => at(60));
      ring(5, hull, sil2, i => [ships[i][0], -3, ships[i][1], 1, 1, 1, R() * 6]); ring(5, mast, sil2, i => [ships[i][0], 5, ships[i][1], 1, 1, 1]); ring(5, sail, sil2, i => [ships[i][0] + 1, 6, ships[i][1], 1, 1, 0.2, R() * 6]);
      const [lx, lz] = at(10); const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 3.5, 26, 8), sil); tower.position.set(lx, 7, lz); group.add(tower);
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: 0xffd890, transparent: true, opacity: amb === "dia" ? 0.3 : 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); lamp.position.set(lx, 21, lz); lamp.scale.set(14, 14, 1); group.add(lamp);
    }
    if (kind === "city") { // tejados y chimeneas, con alguna ventana encendida
      const box = new THREE.BoxGeometry(1, 1, 1), roof = new THREE.ConeGeometry(0.75, 1, 4);
      const houses = [...Array(70)].map(() => { const [x, z, a] = at(30); return [x, z, a, 8 + R() * 8, 8 + R() * 14]; });
      ring(70, box, sil, i => { const [x, z, a, w, h] = houses[i]; return [x, h / 2 - 8, z, w, h, w * 0.8, -a]; });
      ring(70, roof, sil2, i => { const [x, z, a, w, h] = houses[i]; return [x, h - 8 + 3, z, w * 1.1, 6, w * 0.9, -a + Math.PI / 4]; });
      if (amb !== "dia") { const win = new THREE.MeshBasicMaterial({ color: 0xffc070, fog: false }); ring(40, new THREE.PlaneGeometry(1.4, 1.8), win, i => { const [x, z, a, w, h] = houses[i]; const n = new THREE.Vector3(-x, 0, -z).normalize(); return [x + n.x * w * 0.42, h * 0.5 - 6, z + n.z * w * 0.42, 1, 1, 1, Math.atan2(n.x, n.z)]; }); }
    }
  }

  // 4) Hito 97b (fase 4): vida alrededor de la luz y el fuego, hojas que caen y luz de luna
  const props = g.props || [], at = p => [cx(p.c), elevY(p.c, p.r), cz(p.r)];
  const LIGHTS = new Set(["antorcha", "farol", "farolpared", "brasero", "hoguera", "granhoguera", "pilarantorcha", "farolillos"]);
  const SMOKE = new Set(["brasero", "forja", "hoguera", "granhoguera", "caldero", "cabana", "estatuafuego"]);
  if (high) {
    // L4: humo que sube de braseros, forjas y chimeneas
    props.filter(p => SMOKE.has(p.k)).slice(0, 8).forEach(p => {
      const [x, y, z] = at(p), top = p.k === "cabana" ? 7 : p.k === "forja" ? 4 : 2.2;
      for (let i = 0; i < 6; i++) {
        const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: 0x8a8580, transparent: true, opacity: 0, depthWrite: false, fog: true }));
        sm.raycast = () => {}; group.add(sm); shroud.push({ obj: sm, c: p.c, r: p.r });
        let t = i / 6, dx = (R() - 0.5) * 0.6;
        steps.push(dt => { t += dt * 0.12; if (t > 1) { t -= 1; dx = (R() - 0.5) * 0.6; }
          const k = t; sm.position.set(x + dx + k * 1.2, y + top + k * 6, z + k * 0.6); const sc = 1.2 + k * 3.2; sm.scale.set(sc, sc, 1);
          sm.material.opacity = Math.sin(Math.min(1, k * 1.3) * Math.PI) * 0.22; });
      }
    });
    // L3: polillas alrededor de antorchas y faroles (de noche, en penumbra o en interiores)
    if (amb !== "dia") {
      const lights = props.filter(p => LIGHTS.has(p.k)).slice(0, 8);
      if (lights.length) {
        const n = lights.length * 4, pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
        pts.frustumCulled = false; group.add(pts);
        const M = lights.flatMap(p => { const [x, y, z] = at(p), hy = p.k === "farol" ? 3.2 : p.k === "hoguera" || p.k === "granhoguera" || p.k === "brasero" ? 1.8 : 2.4; return [0, 1, 2, 3].map(() => ({ x, y: y + hy, z, a: R() * 6, sp: 2 + R() * 2.5, rr: 0.35 + R() * 0.5, ph: R() * 6 })); });
        let t = 0;
        steps.push(dt => { t += dt; M.forEach((m, i) => { const a = m.a + t * m.sp; pos[i * 3] = m.x + Math.cos(a) * m.rr + Math.sin(t * 7 + m.ph) * 0.06; pos[i * 3 + 1] = m.y + Math.sin(t * 3 + m.ph) * 0.3; pos[i * 3 + 2] = m.z + Math.sin(a) * m.rr; }); geo.attributes.position.needsUpdate = true; });
      }
    }
    // E5: hojas que caen en el bosque (de día o al atardecer)
    const trees = props.filter(p => ["arbol", "arbolgigante", "arbolmuerto"].includes(p.k));
    if (exterior && (trees.length >= 2 || misty.some(([c, r]) => (g.terrain || {})[c + "," + r] === "hojarasca"))) {
      const N = 36, lg = new THREE.CircleGeometry(0.12, 5); lg.scale(1, 0.6, 1);
      const im = new THREE.InstancedMesh(lg, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: true }), N);
      const cols = [0xb0602a, 0xc8a03a, 0x8a3a24, 0x6a8a3a], L = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
      const src = trees.length ? trees : floor.map(([c, r]) => ({ c, r }));
      const spawn = l => { const p = src[Math.floor(R() * src.length)]; l.x = cx(p.c) + (R() - 0.5) * 3; l.z = cz(p.r) + (R() - 0.5) * 3; l.y = elevY(p.c, p.r) + 4 + R() * 2; l.y0 = elevY(p.c, p.r); l.s = 0.5 + R() * 0.5; l.w = R() * 6; };
      for (let i = 0; i < N; i++) { const l = {}; spawn(l); l.y -= R() * 4; L.push(l); im.setColorAt(i, new THREE.Color(cols[i % 4])); }
      im.frustumCulled = false; group.add(im);
      steps.push(dt => { L.forEach((l, i) => { l.y -= dt * l.s; l.w += dt * 2; l.x += Math.sin(l.w) * dt * 0.5 + dt * 0.25; if (l.y < l.y0 + 0.05) spawn(l);
        im.setMatrixAt(i, m4.compose(P.set(l.x, l.y, l.z), q.setFromEuler(e.set(Math.sin(l.w) * 1.2, l.w, Math.cos(l.w * 0.7))), S)); }); im.instanceMatrix.needsUpdate = true; });
    }
  }
  // L2: luz de luna por una ventana: una mancha fría en el suelo, sin luces nuevas (casi gratis)
  if (!exterior && (amb === "noche" || amb === "oscuro" || amb === "penumbra") && floor.length) {
    const byWall = floor.filter(([c, r]) => isWall(c, r - 1) && !isWall(c, r + 1) && !isWall(c, r + 2));
    for (let i = 0; i < Math.min(2, byWall.length); i++) {
      const [c, r] = byWall[Math.floor(R() * byWall.length)];
      const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 1.3, CELL * 2.2), new THREE.MeshBasicMaterial({ map: moonTex(), color: 0x9ab8ff, transparent: true, opacity: amb === "penumbra" ? 0.28 : 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = 0.25; m.position.set(cx(c) + 0.6, elevY(c, r) + 0.05, cz(r) + CELL * 0.75); m.raycast = () => {}; m.renderOrder = 2; group.add(m); shroud.push({ obj: m, c, r });
    }
  }

  group.traverse(o => { o.raycast = () => {}; });
  return {
    group, shroud,
    step: dt => steps.forEach(f => f(dt)),
    dispose() { group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map !== PUFF && o.material.map !== SHAFT && o.material.map !== MOON && o.material.map !== BAND) o.material.dispose(); }); }
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
