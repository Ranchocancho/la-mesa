// Dados 3D que se lanzan sobre la mesa: rebotan, giran y se quedan con el resultado hacia arriba.
import * as THREE from "three";

const GEO = {};
function d10Geometry() {
  // Trapezoedro pentagonal: dos vértices polares y un anillo de 10 vértices en zigzag
  const v = [[0, 1, 0], [0, -1, 0]];
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; v.push([Math.cos(a), i % 2 ? -0.105 : 0.105, Math.sin(a)]); }
  const idx = [];
  for (let i = 0; i < 10; i += 2) { const a = 2 + i, b = 2 + (i + 1) % 10, c = 2 + (i + 2) % 10; idx.push(0, b, a, 0, c, b); }
  for (let i = 1; i < 10; i += 2) { const a = 2 + i, b = 2 + (i + 1) % 10, c = 2 + (i + 2) % 10; idx.push(1, a, b, 1, b, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v.flat(), 3)); g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
}
function geometry(d) {
  if (GEO[d]) return GEO[d];
  let g;
  if (d === 4) g = new THREE.TetrahedronGeometry(1.15);
  else if (d === 6) g = new THREE.BoxGeometry(1.25, 1.25, 1.25).toNonIndexed();
  else if (d === 8) g = new THREE.OctahedronGeometry(1.05);
  else if (d === 10) g = d10Geometry();
  else if (d === 12) g = new THREE.DodecahedronGeometry(1.05);
  else g = new THREE.IcosahedronGeometry(1.05);
  g.computeVertexNormals();
  // Caras: agrupar triángulos con la misma normal
  const p = g.attributes.position, faces = new Map();
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const key = n.toArray().map(x => x.toFixed(2)).join(",");
    if (!faces.has(key)) faces.set(key, { n, pts: [] });
    faces.get(key).pts.push(a, b, c);
  }
  const list = [...faces.values()].map(f => ({ n: f.n, c: f.pts.reduce((s, q) => s.add(q), new THREE.Vector3()).multiplyScalar(1 / f.pts.length) }));
  return (GEO[d] = { g, faces: list });
}
const LABEL = new Map();
function labelTex(text) {
  if (LABEL.has(text)) return LABEL.get(text);
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = `bold ${text.length > 2 ? 46 : 64}px Georgia`; g.fillText(text, 64, 68);
  if (text === "6" || text === "9") g.fillRect(44, 104, 40, 6);
  const t = new THREE.CanvasTexture(c); LABEL.set(text, t); return t;
}

/** Crea un dado con sus números. labels: textos de cada cara (por defecto 1..n). */
function makeDie(d, color, labels) {
  const { g, faces } = geometry(d);
  const body = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.15, flatShading: true, transparent: true }));
  body.castShadow = true;
  const die = new THREE.Group(); die.add(body);
  const size = d === 4 ? 0.62 : d === 6 ? 0.8 : d === 20 ? 0.5 : d === 12 ? 0.62 : 0.6;
  faces.forEach((f, i) => {
    const txt = labels ? labels[i] : String(i + 1);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: labelTex(txt), transparent: true, depthWrite: false }));
    m.position.copy(f.c).add(f.n.clone().multiplyScalar(0.012));
    m.lookAt(m.position.clone().add(f.n));
    die.add(m);
  });
  return { die, faces, body };
}

/**
 * Lanza los dados de una tirada. dice: [{d, v, drop}]. at: Vector3 donde caen. Devuelve tick(dt) → sigue vivo.
 */
export function throwDice(scene, dice, at, color = 0x8a2be2, scale = 1) {
  const group = new THREE.Group(); scene.add(group);
  const items = [];
  const list = [];
  dice.forEach(x => {
    if (x.d === 100) {
      const tens = Math.floor((x.v % 100) / 10), units = x.v % 10;
      list.push({ d: 10, face: tens, labels: ["00", "10", "20", "30", "40", "50", "60", "70", "80", "90"], drop: x.drop });
      list.push({ d: 10, face: units, labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], drop: x.drop });
    } else list.push({ d: x.d, face: x.v - 1, drop: x.drop });
  });
  const n = list.length, from = new THREE.Vector3((Math.random() - 0.5) * 6, 9, 9);
  list.slice(0, 16).forEach((x, i) => {
    const sides = [4, 6, 8, 10, 12, 20].includes(x.d) ? x.d : 20;
    const { die, faces, body } = makeDie(sides, x.drop ? 0x555555 : color, x.labels);
    die.scale.setScalar(scale);
    const face = faces[Math.max(0, Math.min(faces.length - 1, x.face))];
    // Orientación final: la cara del resultado mirando hacia arriba, con un giro al azar
    const end = new THREE.Quaternion().setFromUnitVectors(face.n.clone().normalize(), new THREE.Vector3(0, 1, 0));
    end.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2));
    const start = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    const spinAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const ang = (i - (n - 1) / 2) * 1.0;
    const target = at.clone().add(new THREE.Vector3(Math.cos(ang) * 1.6 * (n > 1 ? 1 : 0) + (Math.random() - 0.5), 0, Math.sin(ang) * 1.2 + (Math.random() - 0.5)));
    const fromP = at.clone().add(from).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, 0));
    const rest = (sides === 4 ? 0.45 : sides === 6 ? 0.62 : 0.85) * scale;
    group.add(die);
    items.push({ die, body, start, end, spinAxis, fromP, target, rest, delay: i * 0.06 });
  });
  let t = 0;
  const DUR = 1.35, STAY = 5, FADE = 0.6;
  return dt => {
    t += dt;
    for (const it of items) {
      const u = Math.max(0, Math.min(1, (t - it.delay) / DUR)), e = 1 - Math.pow(1 - u, 3);
      const p = new THREE.Vector3().lerpVectors(it.fromP, it.target, e);
      const hop = Math.abs(Math.sin(u * Math.PI * 3.2)) * 6 * Math.pow(1 - u, 2);
      p.y = it.target.y + it.rest + hop + (1 - e) * (it.fromP.y - it.target.y) * (1 - u);
      it.die.position.copy(p);
      const q = it.start.clone().slerp(it.end, e);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(it.spinAxis, (1 - e) * Math.PI * 7));
      it.die.quaternion.copy(q);
      if (t > DUR + STAY) { const o = Math.max(0, 1 - (t - DUR - STAY) / FADE); it.die.traverse(m => { if (m.material) m.material.opacity = o; }); }
    }
    if (t > DUR + STAY + FADE) { scene.remove(group); group.traverse(o => { if (o.isMesh && o.geometry && !Object.values(GEO).some(x => x.g === o.geometry)) o.geometry.dispose(); }); return false; }
    return true;
  };
}
