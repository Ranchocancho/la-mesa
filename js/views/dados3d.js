// Dados 3D con física real (cannon-es): se lanzan, chocan, ruedan y se paran sobre una bandeja de tapete.
// Para que todos vean lo mismo, la tirada se simula con una semilla y, al terminar, la cara que queda arriba
// se rotula con el resultado ya decidido en la tabla de tiradas.
import * as THREE from "three";
import * as CANNON from "cannon-es";

/* ---------- Juegos de dados ---------- */
export const SKINS = {
  rubi: { n: "Rubí", c: 0xa3122a, e: 0x2a0008, o: 0.88, ink: "#fff", m: 0.1, r: 0.18 },
  zafiro: { n: "Zafiro", c: 0x1c46b8, e: 0x050f30, o: 0.88, ink: "#fff", m: 0.1, r: 0.18 },
  esmeralda: { n: "Esmeralda", c: 0x0f7a45, e: 0x02200f, o: 0.88, ink: "#fff", m: 0.1, r: 0.18 },
  amatista: { n: "Amatista", c: 0x6a2bb0, e: 0x16052a, o: 0.88, ink: "#fff", m: 0.1, r: 0.18 },
  obsidiana: { n: "Obsidiana", c: 0x161418, e: 0x000000, o: 1, ink: "#d6aa4e", m: 0.3, r: 0.12 },
  oro: { n: "Oro", c: 0xc99a2e, e: 0x2a1a00, o: 1, ink: "#2b1a08", m: 0.85, r: 0.3 },
  hueso: { n: "Hueso", c: 0xe8dcc0, e: 0x000000, o: 1, ink: "#3a2416", m: 0, r: 0.6 },
  madera: { n: "Madera", c: 0x8a5a2e, e: 0x000000, o: 1, ink: "#f3e6c8", m: 0, r: 0.75 }
};
export const skinFor = r => (r && r.skin && SKINS[r.skin]) ? r.skin : "rubi";

/* ---------- Geometrías y caras ---------- */
const GEO = {};
function d10Geometry() {
  const v = [[0, 1, 0], [0, -1, 0]];
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; v.push([Math.cos(a), i % 2 ? -0.105 : 0.105, Math.sin(a)]); }
  const idx = [];
  for (let i = 0; i < 10; i += 2) { const a = 2 + i, b = 2 + (i + 1) % 10, c = 2 + (i + 2) % 10; idx.push(0, b, a, 0, c, b); }
  for (let i = 1; i < 10; i += 2) { const a = 2 + i, b = 2 + (i + 1) % 10, c = 2 + (i + 2) % 10; idx.push(1, a, b, 1, b, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v.flat(), 3)); g.setIndex(idx);
  return g.toNonIndexed();
}
function geometry(d) {
  if (GEO[d]) return GEO[d];
  let g;
  if (d === 4) g = new THREE.TetrahedronGeometry(1.25);
  else if (d === 6) g = new THREE.BoxGeometry(1.35, 1.35, 1.35).toNonIndexed();
  else if (d === 8) g = new THREE.OctahedronGeometry(1.15);
  else if (d === 10) g = d10Geometry();
  else if (d === 12) g = new THREE.DodecahedronGeometry(1.15);
  else g = new THREE.IcosahedronGeometry(1.2);
  g.scale(K, K, K); g.computeVertexNormals();
  const p = g.attributes.position, faces = new Map(), verts = [], vIndex = new Map(), tris = [];
  const vid = v => { const k = v.toArray().map(x => x.toFixed(4)).join(","); if (!vIndex.has(k)) { vIndex.set(k, verts.length); verts.push(v.clone()); } return vIndex.get(k); };
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const key = n.toArray().map(x => x.toFixed(2)).join(",");
    if (!faces.has(key)) faces.set(key, { n, pts: [] });
    faces.get(key).pts.push(a, b, c);
    tris.push([vid(a), vid(b), vid(c)]);
  }
  const list = [...faces.values()].map(f => ({ n: f.n, c: f.pts.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / f.pts.length) }));
  // Forma de colisión: el box es exacto; el resto, poliedro convexo
  const shape = d === 6 ? new CANNON.Box(new CANNON.Vec3(0.675 * K, 0.675 * K, 0.675 * K))
    : new CANNON.ConvexPolyhedron({ vertices: verts.map(v => new CANNON.Vec3(v.x, v.y, v.z)), faces: tris });
  return (GEO[d] = { g, faces: list, shape });
}
const LABEL = new Map();
function labelTex(text, ink) {
  const k = text + ink; if (LABEL.has(k)) return LABEL.get(k);
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"); g.textAlign = "center"; g.textBaseline = "middle";
  // Números grandes con contorno: que se lean desde arriba aunque el dado sea pequeño
  g.font = `900 ${text.length > 2 ? 58 : text.length > 1 ? 74 : 86}px Georgia`;
  const light = /^#(f|e|d)/i.test(ink);
  g.lineJoin = "round"; g.lineWidth = 12; g.strokeStyle = light ? "rgba(0,0,0,.72)" : "rgba(255,245,220,.75)";
  g.strokeText(text, 64, 68); g.fillStyle = ink; g.fillText(text, 64, 68);
  if (text === "6" || text === "9") { g.fillStyle = ink; g.fillRect(42, 110, 44, 7); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; LABEL.set(k, t); return t;
}
function makeDie(d, skin, labels, dropped) {
  const { g, faces } = geometry(d), S = SKINS[skin] || SKINS.rubi;
  const mat = new THREE.MeshStandardMaterial({ color: dropped ? 0x55504a : S.c, emissive: S.e, roughness: S.r, metalness: S.m, flatShading: true, transparent: true, opacity: dropped ? 0.6 : S.o });
  const body = new THREE.Mesh(g, mat); body.castShadow = true;
  const die = new THREE.Group(); die.add(body);
  const size = K * (d === 4 ? 0.78 : d === 6 ? 1.05 : d === 20 ? 0.66 : d === 12 ? 0.82 : d === 10 ? 0.74 : 0.76);
  faces.forEach((f, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: labelTex(labels[i], S.ink), transparent: true, depthWrite: false }));
    m.position.copy(f.c).add(f.n.clone().multiplyScalar(0.015)); m.lookAt(m.position.clone().add(f.n));
    die.add(m);
  });
  return { die, mats: [mat] };
}

/* ---------- Azar con semilla (todos simulan lo mismo) ---------- */
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

/* ---------- Bandeja ---------- */
let FELT = null;
function feltTex() {
  if (FELT) return FELT;
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  g.fillStyle = "#2a3f2a"; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.05})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1, 1); }
  FELT = new THREE.CanvasTexture(c); FELT.colorSpace = THREE.SRGBColorSpace; FELT.wrapS = FELT.wrapT = THREE.RepeatWrapping; FELT.repeat.set(6, 2); return FELT;
}
// Bandeja alargada: los dados entran por la izquierda y la cruzan rodando (como una mesa de craps)
export const TW = 24, TD = 7;
const K = 1.22; // escala de los dados (más grandes = números legibles)
function tray() {
  const g = new THREE.Group();
  const felt = new THREE.Mesh(new THREE.BoxGeometry(TW, 0.2, TD), new THREE.MeshStandardMaterial({ map: feltTex(), roughness: 1, transparent: true }));
  felt.position.y = 0.12; felt.receiveShadow = true; g.add(felt);
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.55, metalness: 0.05, transparent: true });
  for (const [x, z, w, d] of [[0, -TD / 2, TW + 0.8, 0.4], [0, TD / 2, TW + 0.8, 0.4], [-TW / 2, 0, 0.4, TD], [TW / 2, 0, 0.4, TD]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), wood); r.position.set(x, 0.6, z); r.castShadow = r.receiveShadow = true; g.add(r);
  }
  return g;
}

/* ---------- Brillos para los críticos ---------- */
function burstFx(scene, at, color, n = 70) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { pos.set([at.x, at.y, at.z], i * 3); const a = Math.random() * 6.28, up = 4 + Math.random() * 8; vel.push([Math.cos(a) * (2 + Math.random() * 5), up, Math.sin(a) * (2 + Math.random() * 5)]); }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "#fff"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color, size: 0.7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(pts); let t = 0;
  return dt => { t += dt; for (let i = 0; i < n; i++) { vel[i][1] -= 14 * dt; pos[i * 3] += vel[i][0] * dt; pos[i * 3 + 1] += vel[i][1] * dt; pos[i * 3 + 2] += vel[i][2] * dt; } geo.attributes.position.needsUpdate = true; pts.material.opacity = Math.max(0, 1 - t / 1.6); if (t > 1.6) { scene.remove(pts); geo.dispose(); return false; } return true; };
}
// Al pararse: anillo de luz en el tapete y una chapa con el valor encima de cada dado
function haloFx(parent, p, color) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.26, p.z); parent.add(ring);
  let t = 0;
  return dt => { t += dt; const k = t / 0.9; ring.scale.setScalar(1 + k * 1.6); ring.material.opacity = Math.max(0, 0.9 * (1 - k)); if (k >= 1) { parent.remove(ring); return false; } return true; };
}
function badge(text, color) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 80; const g = c.getContext("2d");
  g.fillStyle = "rgba(14,9,5,.82)"; g.strokeStyle = color; g.lineWidth = 5;
  g.beginPath(); g.roundRect(6, 6, 116, 68, 30); g.fill(); g.stroke();
  g.font = "900 50px Georgia"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(text, 64, 43);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, opacity: 0 }));
  s.scale.set(1.5, 0.94, 1); s.renderOrder = 15; return s;
}
function bigText(text, color) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d");
  g.font = "bold 72px Georgia"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 10; g.strokeStyle = "rgba(0,0,0,.8)"; g.strokeText(text, 256, 64); g.fillStyle = color; g.fillText(text, 256, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(10, 2.5, 1); s.renderOrder = 20; return s;
}

/**
 * Lanza los dados de una tirada.
 * dice: [{d, v, drop}] · at: centro de la bandeja (Vector3) · opts: { seed, skin, aim: {x, z, power}, toward: Vector3 (cámara), total, drama, onEvent }
 * Devuelve tick(dt) → sigue vivo.
 */
export function throwDice(scene, dice, at, opts = {}) {
  const R = rng(String(opts.seed || Math.random()));
  // Lista de dados físicos (el d100 son dos d10: decenas y unidades)
  const list = [];
  dice.slice(0, 14).forEach(x => {
    if (x.d === 100) {
      const tens = Math.floor((x.v % 100) / 10), units = x.v % 10;
      list.push({ d: 10, want: tens, labels: ["00", "10", "20", "30", "40", "50", "60", "70", "80", "90"], drop: x.drop });
      list.push({ d: 10, want: units, labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], drop: x.drop });
    } else {
      const d = [4, 6, 8, 10, 12, 20].includes(x.d) ? x.d : 20;
      list.push({ d, want: x.v - 1, labels: Array.from({ length: d }, (_, i) => String(i + 1)), drop: x.drop, nat: d === 20 && !x.drop ? x.v : null });
    }
  });
  // Mundo físico: suelo de la bandeja y cuatro bandas
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -70, 0) });
  world.allowSleep = true;
  const dieMat = new CANNON.Material(), feltMat = new CANNON.Material(), railMat = new CANNON.Material();
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, feltMat, { friction: 0.24, restitution: 0.3 }));
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, railMat, { friction: 0.1, restitution: 0.6 }));
  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, { friction: 0.2, restitution: 0.4 }));
  const ground = new CANNON.Body({ mass: 0, material: feltMat, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); ground.position.set(0, 0.22, 0); world.addBody(ground);
  for (const [x, z, w, d] of [[0, -TD / 2, TW, 0.4], [0, TD / 2, TW, 0.4], [-TW / 2, 0, 0.4, TD], [TW / 2, 0, 0.4, TD]]) {
    const b = new CANNON.Body({ mass: 0, material: railMat, shape: new CANNON.Box(new CANNON.Vec3(w / 2, 6, d / 2)) }); b.position.set(x, 6, z); world.addBody(b);
  }
  // Se lanzan desde el borde izquierdo y cruzan la bandeja a lo largo (rebotan en la banda del fondo)
  const power = opts.aim ? Math.max(0.6, Math.min(1.4, opts.aim.power || 1)) : 0.95 + R() * 0.25;
  // En la mano: filas de hasta 3 a lo ancho, separadas para que no nazcan solapados
  const n = list.length, rows = Math.min(3, n);
  const bodies = list.map((x, i) => {
    const b = new CANNON.Body({ mass: 1, material: dieMat, shape: geometry(x.d).shape, angularDamping: 0.16, linearDamping: 0.04, sleepSpeedLimit: 0.4, sleepTimeLimit: 0.25 });
    const col = Math.floor(i / rows), row = i % rows, inRow = Math.min(rows, n - col * rows);
    const z = inRow > 1 ? -1.9 + (3.8 * row) / (inRow - 1) : (R() - 0.5) * 2;
    b.position.set(-TW / 2 + 1.6 + col * 2 + R() * 0.3, 1.9 + R() * 0.8, z + (R() - 0.5) * 0.3);
    b.quaternion.setFromEuler(R() * 6.28, R() * 6.28, R() * 6.28);
    b.velocity.set((31 + R() * 8) * power, -1 - R() * 2, (R() - 0.5) * 7);
    b.angularVelocity.set((R() - 0.5) * 24, (R() - 0.5) * 10, -12 - R() * 16);
    world.addBody(b); return b;
  });
  // Simulación completa por adelantado (grabamos el recorrido)
  const frames = [], hits = [];
  let lastVy = bodies.map(() => 0);
  for (let s = 0; s < 420; s++) {
    world.step(1 / 60);
    frames.push(bodies.map(b => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
    bodies.forEach((b, i) => { if (lastVy[i] < -4 && b.velocity.y > 0) hits.push(s); lastVy[i] = b.velocity.y; });
    if (s > 40 && bodies.every(b => b.sleepState === CANNON.Body.SLEEPING)) break;
  }
  if (opts.onSim) opts.onSim(frames);
  // Rotular: la cara que ha quedado arriba muestra el resultado de la tirada
  const last = frames[frames.length - 1];
  list.forEach((x, i) => {
    const q = new THREE.Quaternion(last[i][3], last[i][4], last[i][5], last[i][6]), faces = geometry(x.d).faces;
    let best = 0, by = -2; faces.forEach((f, k) => { const y = f.n.clone().applyQuaternion(q).y; if (y > by) { by = y; best = k; } });
    const want = Math.max(0, Math.min(faces.length - 1, x.want)); x.text = x.labels[want];
    if (best !== want) { const t = x.labels[best]; x.labels[best] = x.labels[want]; x.labels[want] = t; }
  });
  // Escena: bandeja + dados
  const group = new THREE.Group(); group.position.copy(at); scene.add(group);
  const tr = tray(); group.add(tr);
  const meshes = list.map(x => { const m = makeDie(x.d, opts.skin, x.labels, x.drop); group.add(m.die); return m; });
  const fade = [...meshes.flatMap(m => m.mats), ...tr.children.map(c => c.material)];
  fade.forEach(m => { m.userData.o = m.opacity; });
  const nat = list.find(x => x.nat === 20) ? 20 : list.find(x => x.nat === 1) ? 1 : null;
  const SLOW = opts.drama && list.some(x => x.d === 20) ? 0.45 : 1;
  let t = 0, f = 0, done = false, extra = [], label = null, hitIdx = 0;
  const STAY = opts.stay ?? 4.5, FADE = 0.8;
  return dt => {
    // Cámara lenta en el último tramo de un d20 importante
    const nearEnd = f > frames.length - 50;
    t += done ? dt : dt * (nearEnd ? SLOW : 1);
    f = Math.min(frames.length - 1, Math.floor(t * 60));
    frames[f].forEach((p, i) => { meshes[i].die.position.set(p[0], p[1], p[2]); meshes[i].die.quaternion.set(p[3], p[4], p[5], p[6]); });
    while (hitIdx < hits.length && hits[hitIdx] <= f) { if (opts.onEvent) opts.onEvent("hit"); hitIdx++; }
    if (!done && f >= frames.length - 1) {
      done = true; t = frames.length / 60;
      const hex = "#" + (SKINS[opts.skin] || SKINS.rubi).c.toString(16).padStart(6, "0");
      list.forEach((x, i) => {
        if (x.drop) return;
        const p = meshes[i].die.position, die = meshes[i].die;
        extra.push(haloFx(group, p, x.nat === 20 ? 0xffd86a : x.nat === 1 ? 0xff4a3a : 0xfff1d6));
        // Pequeño "salto" del dado al revelar su cara
        let k = 0; extra.push(dt2 => { k += dt2 / 0.35; die.scale.setScalar(1 + Math.sin(Math.min(1, k) * Math.PI) * 0.16); return k < 1; });
        if (list.length > 1) {
          const b = badge(x.text, x.nat === 20 ? "#ffd86a" : x.nat === 1 ? "#ff6a5a" : hex);
          b.position.set(p.x, p.y + 1.7, p.z - 1.1); group.add(b); fade.push(b.material); b.material.userData.o = 1;
          let u = 0; extra.push(dt2 => { u += dt2 / 0.25; b.material.opacity = Math.min(1, u); return u < 1; });
        }
      });
      const top = at.clone().add(new THREE.Vector3(0, 5, 0));
      if (opts.total != null && !opts.quiet) { label = bigText(String(opts.total), nat === 20 ? "#ffd86a" : nat === 1 ? "#ff6a5a" : "#fff"); label.position.copy(top); scene.add(label); }
      if (nat === 20 && opts.quiet) extra.push(burstFx(scene, at.clone().setY(1.5), 0xffd86a, 140));
      if (nat === 1 && opts.quiet) extra.push(burstFx(scene, at.clone().setY(1), 0xb33a2e, 60));
      if (nat === 20 && !opts.quiet) { extra.push(burstFx(scene, at.clone().setY(1.5), 0xffd86a, 110)); const s = bigText("¡20 NATURAL!", "#ffd86a"); s.position.copy(top).add(new THREE.Vector3(0, 2.4, 0)); scene.add(s); extra.push(dt2 => { s.material.opacity -= dt2 / 3.5; if (s.material.opacity <= 0) { scene.remove(s); return false; } return true; }); }
      if (nat === 1 && !opts.quiet) { extra.push(burstFx(scene, at.clone().setY(1), 0xb33a2e, 50)); const s = bigText("Pifia", "#ff6a5a"); s.position.copy(top).add(new THREE.Vector3(0, 2.4, 0)); scene.add(s); extra.push(dt2 => { s.material.opacity -= dt2 / 3; if (s.material.opacity <= 0) { scene.remove(s); return false; } return true; }); }
      if (opts.onEvent) opts.onEvent(nat === 20 ? "nat20" : nat === 1 ? "nat1" : "rest");
    }
    extra = extra.filter(fn => fn(dt));
    const endT = frames.length / 60 + STAY;
    if (t > endT) {
      const o = Math.max(0, 1 - (t - endT) / FADE);
      fade.forEach(m => { m.opacity = m.userData.o * o; });
      if (label) label.material.opacity = o;
    }
    if (t > endT + FADE && !extra.length) { scene.remove(group); if (label) scene.remove(label); return false; }
    return true;
  };
}
