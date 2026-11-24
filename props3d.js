// Escenografía 3D hecha por código para lo que no tiene modelo: naturaleza, mazmorra, trampas, tesoro y marcas.
// Formas sencillas con sombreado plano, en el mismo estilo que los modelos KayKit.
import * as THREE from "three";

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...extra });
const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
const R = () => Math.random();
const stone = () => mat(0x7d776e), darkStone = () => mat(0x4a4540), gold = () => mat(0xe0b040, { metalness: 0.8, roughness: 0.3, emissive: 0x3a2400 });

export const PROC = {
  arbolmuerto() {
    const g = new THREE.Group(), w = mat(0x4a3a2c);
    g.add(M(new THREE.CylinderGeometry(0.22, 0.45, 3.4, 6), w, 0, 1.7));
    for (let i = 0; i < 4; i++) { const b = M(new THREE.CylinderGeometry(0.06, 0.14, 1.6, 5), w); b.position.set(0, 1.8 + i * 0.4, 0); b.rotation.set(0.9 + R() * 0.4, i * 1.7, 0); b.translateY(0.7); g.add(b); }
    g.rotation.y = R() * 6; return g;
  },
  penasco() { const g = new THREE.Group(), m = mat(0x6e6a63); [[0, 1.1, 0, 1.7], [0.9, 0.6, 0.6, 1], [-0.8, 0.5, -0.5, 0.9]].forEach(([x, y, z, s]) => { const r = M(new THREE.DodecahedronGeometry(s, 0), m, x, y, z); r.rotation.set(R(), R() * 6, R()); r.scale.y = 0.8; g.add(r); }); return g; },
  tocon() { const g = new THREE.Group(); g.add(M(new THREE.CylinderGeometry(0.75, 0.9, 0.7, 9), mat(0x5a3d22), 0, 0.35)); g.add(M(new THREE.CylinderGeometry(0.68, 0.68, 0.04, 9), mat(0xb08a5a), 0, 0.72)); return g; },
  setas() { const g = new THREE.Group(); [[0, 0, 1.4, 1], [0.9, 0.5, 0.9, 0.7], [-0.7, 0.6, 0.7, 0.55]].forEach(([x, z, h, s]) => { g.add(M(new THREE.CylinderGeometry(0.12 * s * 2, 0.18 * s * 2, h, 7), mat(0xe8e0cc), x, h / 2, z)); const cap = M(new THREE.SphereGeometry(0.9 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8a3ab0, { emissive: 0x2a0a40 }), x, h, z); g.add(cap); }); g.userData.glow = { color: 0xb070ff, power: 0.35, y: 1.2 }; return g; },
  cristales() { const g = new THREE.Group(), m = mat(0x7ad8ff, { emissive: 0x1a6a9a, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.88 }); [[0, 0, 1.6, 0], [0.5, 0.3, 1.1, 0.4], [-0.5, 0.2, 0.9, -0.5], [0.1, -0.5, 1.2, 0.3]].forEach(([x, z, h, t]) => { const c = M(new THREE.OctahedronGeometry(0.35, 0), m, x, h / 2, z); c.scale.set(1, h * 1.4, 1); c.rotation.z = t; g.add(c); }); g.userData.glow = { color: 0x6ad0ff, power: 0.45, y: 1 }; return g; },
  estatua() { const g = new THREE.Group(), m = stone(); g.add(M(new THREE.BoxGeometry(1.8, 0.6, 1.8), darkStone(), 0, 0.3)); g.add(M(new THREE.CylinderGeometry(0.45, 0.6, 2.2, 8), m, 0, 1.7)); g.add(M(new THREE.SphereGeometry(0.42, 8, 6), m, 0, 3.1)); const a = M(new THREE.CylinderGeometry(0.13, 0.13, 1.3, 6), m, 0.55, 2.1, 0); a.rotation.z = 0.5; g.add(a); return g; },
  altar() { const g = new THREE.Group(); g.add(M(new THREE.BoxGeometry(2.8, 1.1, 1.5), stone(), 0, 0.55)); g.add(M(new THREE.BoxGeometry(3.1, 0.18, 1.8), mat(0x6a6058), 0, 1.15)); g.add(M(new THREE.BoxGeometry(2.4, 0.04, 1.2), mat(0x7a1e24), 0, 1.26)); return g; },
  sarcofago() { const g = new THREE.Group(); g.add(M(new THREE.BoxGeometry(1.5, 1, 3.2), stone(), 0, 0.5)); const lid = M(new THREE.BoxGeometry(1.6, 0.25, 3.3), mat(0x8a847a), 0, 1.12); g.add(lid); g.add(M(new THREE.BoxGeometry(0.6, 0.12, 0.9), mat(0x6a645a), 0, 1.3, -0.9)); return g; },
  pozo() { const g = new THREE.Group(); const ring = M(new THREE.CylinderGeometry(1.3, 1.4, 1, 12, 1, true), stone(), 0, 0.5); ring.material.side = THREE.DoubleSide; g.add(ring); g.add(M(new THREE.CircleGeometry(1.2, 12), mat(0x0a0a10), 0, 0.3)); g.children[1].rotation.x = -Math.PI / 2;
    [-1.2, 1.2].forEach(x => g.add(M(new THREE.BoxGeometry(0.15, 2.4, 0.15), mat(0x5a3d22), x, 1.2))); g.add(M(new THREE.BoxGeometry(2.6, 0.15, 0.15), mat(0x5a3d22), 0, 2.4)); return g; },
  telarana() { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); x.strokeStyle = "rgba(235,235,235,.8)"; x.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 64, 64 + Math.sin(a) * 64); x.stroke(); } for (let r = 10; r < 64; r += 10) { x.beginPath(); for (let i = 0; i <= 9; i++) { const a = i / 9 * Math.PI * 2; x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } x.stroke(); }
    const t = new THREE.CanvasTexture(c); const p = M(new THREE.PlaneGeometry(3.6, 3.6), new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }), 0, 1.8); p.rotation.y = R() * 3; return p; },
  brasero(fire) { const g = new THREE.Group(), iron = mat(0x2e2a26, { metalness: 0.6, roughness: 0.5 }); [0, 1, 2].forEach(i => { const l = M(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 5), iron); const a = i / 3 * Math.PI * 2; l.position.set(Math.cos(a) * 0.45, 0.6, Math.sin(a) * 0.45); l.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); g.add(l); });
    g.add(M(new THREE.CylinderGeometry(0.75, 0.45, 0.45, 10), iron, 0, 1.3)); g.add(M(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 10), mat(0xff6a1a, { emissive: 0xff3a00, emissiveIntensity: 1.2 }), 0, 1.5)); const f = fire(0.9); f.position.y = 1.5; g.add(f); g.userData.light = { y: 2.2, power: 1.2 }; return g; },
  trampaoculta() { const g = new THREE.Group(); g.add(M(new THREE.BoxGeometry(3, 0.06, 3), mat(0x5a544c), 0, 0.03)); [[-1.45, 0], [1.45, 0], [0, -1.45], [0, 1.45]].forEach(([x, z]) => g.add(M(new THREE.BoxGeometry(x ? 0.06 : 3, 0.08, x ? 3 : 0.06), mat(0x2a2622), x, 0.05, z))); return g; },
  pinchos() { const g = new THREE.Group(), m = mat(0x9a9a9a, { metalness: 0.6, roughness: 0.35 }); g.add(M(new THREE.BoxGeometry(3.4, 0.12, 3.4), mat(0x3a3530), 0, 0.06)); for (let i = 0; i < 16; i++) g.add(M(new THREE.ConeGeometry(0.17, 0.9 + R() * 0.3, 5), m, (i % 4 - 1.5) * 0.8, 0.55, (Math.floor(i / 4) - 1.5) * 0.8)); return g; },
  foso() { const g = new THREE.Group(); const hole = M(new THREE.BoxGeometry(3.6, 0.05, 3.6), new THREE.MeshBasicMaterial({ color: 0x050403 }), 0, 0.03); g.add(hole); [[-1.8, 0], [1.8, 0], [0, -1.8], [0, 1.8]].forEach(([x, z]) => g.add(M(new THREE.BoxGeometry(x ? 0.25 : 3.85, 0.3, x ? 3.85 : 0.25), darkStone(), x, 0.1, z))); return g; },
  oro() { const g = new THREE.Group(), m = gold(); g.add(M(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0)); for (let i = 0; i < 14; i++) { const c = M(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 10), m, (R() - 0.5) * 2.2, 0.05 + R() * 0.5, (R() - 0.5) * 2.2); c.rotation.set(R() * 3, 0, R() * 3); g.add(c); } g.userData.glow = { color: 0xffc040, power: 0.3, y: 1 }; return g; },
  pocion() { const g = new THREE.Group(); g.add(M(new THREE.SphereGeometry(0.42, 12, 10), mat(0xd02a50, { emissive: 0x5a0018, transparent: true, opacity: 0.9, roughness: 0.2 }), 0, 0.45)); g.add(M(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 8), mat(0xc8d0d8, { transparent: true, opacity: 0.7 }), 0, 0.95)); g.add(M(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 8), mat(0x6a4a2a), 0, 1.2)); g.userData.glow = { color: 0xff4a70, power: 0.2, y: 0.8 }; return g; },
  pergamino() { const g = new THREE.Group(), p = mat(0xe8d8b0); const r = M(new THREE.CylinderGeometry(0.2, 0.2, 1.2, 10), p, 0, 0.2); r.rotation.z = Math.PI / 2; g.add(r); g.add(M(new THREE.CylinderGeometry(0.21, 0.21, 0.12, 10), mat(0xa02020), 0, 0.2)); g.children[1].rotation.z = Math.PI / 2; return g; },
  objeto() { const g = new THREE.Group(); g.add(M(new THREE.CylinderGeometry(0.7, 0.85, 0.7, 8), stone(), 0, 0.35)); const gem = M(new THREE.OctahedronGeometry(0.42, 0), mat(0x9a6aff, { emissive: 0x5a2aff, emissiveIntensity: 0.8, roughness: 0.1 }), 0, 1.3); gem.userData.spin = true; g.add(gem); g.userData.glow = { color: 0xa070ff, power: 0.5, y: 1.4 }; return g; },
  nota() { const g = new THREE.Group(); g.add(M(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), mat(0x777777), 0, 0.7)); g.add(M(new THREE.SphereGeometry(0.22, 8, 6), mat(0xe0402a, { emissive: 0x5a0a00 }), 0, 1.45)); return g; },
  interes() { const g = new THREE.Group(), s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.35 : 0.85; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const st = M(new THREE.ExtrudeGeometry(s, { depth: 0.15, bevelEnabled: false }), mat(0xffd24a, { emissive: 0x7a5400 }), 0, 1.6); st.userData.spin = true; g.add(st); return g; }
};

/* ---------- Paquetes de región ---------- */
const wood = () => mat(0x6a4a2c), darkWood = () => mat(0x4a321e), iron = () => mat(0x3a3632, { metalness: 0.6, roughness: 0.45 }), leaf = c => mat(c);
const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg), box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const glowMat = (c, e) => mat(c, { emissive: e, emissiveIntensity: 1.1 });
function treeShape(trunkC, leafC, h = 1, trunkW = 0.35) { const g = new THREE.Group(); g.add(M(cyl(trunkW * 0.7, trunkW, 2.2 * h, 7), mat(trunkC), 0, 1.1 * h)); [[1.6, 0], [1.2, 0.9], [0.8, 1.7]].forEach(([r, y]) => g.add(M(new THREE.ConeGeometry(r * h, 1.8 * h, 8), leaf(leafC), 0, (2.6 + y) * h))); return g; }
Object.assign(PROC, {
  // Enano
  forja(fire) { const g = new THREE.Group(); g.add(M(box(2.6, 1.3, 2), darkStone(), 0, 0.65)); g.add(M(box(2.2, 0.08, 1.6), glowMat(0xff6a1a, 0xff3a00), 0, 1.33)); g.add(M(cyl(0.45, 0.6, 2.2, 6), stone(), 0.7, 2.4, -0.5)); const f = fire(0.8); f.position.set(0, 1.35, 0); g.add(f); g.userData.light = { y: 2, power: 1.3 }; return g; },
  yunque() { const g = new THREE.Group(); g.add(M(cyl(0.45, 0.55, 0.7, 8), darkWood(), 0, 0.35)); g.add(M(box(1.2, 0.3, 0.5), iron(), 0, 0.85)); const hn = M(new THREE.ConeGeometry(0.22, 0.6, 6), iron(), 0.8, 0.9, 0); hn.rotation.z = -Math.PI / 2; g.add(hn); return g; },
  vagoneta() { const g = new THREE.Group(); g.add(M(box(1.6, 0.9, 2.2), iron(), 0, 0.85)); g.add(M(box(1.4, 0.25, 2), mat(0x4a4038), 0, 1.25)); [[-0.85, -0.7], [0.85, -0.7], [-0.85, 0.7], [0.85, 0.7]].forEach(([x, z]) => { const w = M(cyl(0.3, 0.3, 0.15, 10), darkStone(), x, 0.3, z); w.rotation.z = Math.PI / 2; g.add(w); }); return g; },
  puntal() { const g = new THREE.Group(); [-1.2, 1.2].forEach(x => g.add(M(box(0.35, 3.4, 0.35), wood(), x, 1.7))); g.add(M(box(2.9, 0.35, 0.4), wood(), 0, 3.4)); return g; },
  ancestro() { const g = PROC.estatua(); g.add(M(new THREE.ConeGeometry(0.42, 0.9, 7), stone(), 0, 2.55)); g.add(M(box(1.2, 0.18, 0.18), stone(), 0, 2, 0.45)); return g; },
  mesapiedra() { const g = new THREE.Group(); g.add(M(box(2.8, 0.25, 1.5), stone(), 0, 1)); [-1, 1].forEach(x => g.add(M(box(0.4, 0.9, 1.1), darkStone(), x, 0.45))); return g; },
  pozomina() { const g = PROC.foso(); [[-1.3, -1.3], [1.3, -1.3]].forEach(([x, z]) => g.add(M(box(0.2, 2.4, 0.2), wood(), x, 1.2, z))); g.add(M(box(2.8, 0.2, 0.2), wood(), 0, 2.4, -1.3)); return g; },
  // Élfico
  arbolgigante() { const g = treeShape(0x6a4a2c, 0x2e5a2a, 1.8, 0.7); g.rotation.y = R() * 6; return g; },
  arcopiedra() { const g = new THREE.Group(); [-1.2, 1.2].forEach(x => g.add(M(box(0.5, 3, 0.5), stone(), x, 1.5))); const a = M(new THREE.TorusGeometry(1.2, 0.25, 6, 12, Math.PI), stone(), 0, 3); g.add(a); for (let i = 0; i < 9; i++) g.add(M(new THREE.SphereGeometry(0.22, 6, 4), leaf(0x3e7a2e), (R() - 0.5) * 2.6, 1 + R() * 3, (R() - 0.5) * 0.5)); return g; },
  puente() { const g = new THREE.Group(); for (let i = 0; i < 7; i++) g.add(M(box(0.42, 0.08, 2.2), wood(), -1.5 + i * 0.5, 0.35)); [-1.1, 1.1].forEach(z => { const r = M(cyl(0.04, 0.04, 3.6, 4), mat(0xb09a70), 0, 1.1, z); r.rotation.z = Math.PI / 2; g.add(r); [-1.7, 1.7].forEach(x => g.add(M(box(0.12, 1.2, 0.12), darkWood(), x, 0.6, z))); }); return g; },
  farolillos() { const g = new THREE.Group(); g.add(M(cyl(0.05, 0.06, 2.6, 5), darkWood(), 0, 1.3)); [[0.4, 2.4], [-0.35, 2], [0.1, 1.6]].forEach(([x, y]) => g.add(M(new THREE.SphereGeometry(0.2, 8, 6), glowMat(0xffe6a0, 0xffb040), x, y))); g.userData.glow = { color: 0xffd080, y: 2.2, power: 0.7 }; return g; },
  fuente() { const g = new THREE.Group(); const b = M(cyl(1.4, 1.5, 0.6, 12), stone(), 0, 0.3); g.add(b); g.add(M(cyl(1.2, 1.2, 0.05, 12), mat(0x3a7aa0, { roughness: 0.2, transparent: true, opacity: 0.85 }), 0, 0.58)); g.add(M(cyl(0.2, 0.3, 1.6, 8), stone(), 0, 1.1)); g.add(M(cyl(0.6, 0.4, 0.25, 10), stone(), 0, 1.9)); return g; },
  estatuaelfica() { const g = new THREE.Group(), m = mat(0xd8d2c4); g.add(M(box(1.4, 0.5, 1.4), stone(), 0, 0.25)); g.add(M(cyl(0.3, 0.5, 2.4, 8), m, 0, 1.7)); g.add(M(new THREE.SphereGeometry(0.33, 8, 6), m, 0, 3.1)); g.add(M(box(0.08, 2.6, 0.08), m, 0.6, 1.9)); return g; },
  flores() { const g = new THREE.Group(), cs = [0xe86a9a, 0xf0d050, 0xffffff, 0xa070e0]; for (let i = 0; i < 12; i++) { const x = (R() - 0.5) * 2.6, z = (R() - 0.5) * 2.6; g.add(M(cyl(0.02, 0.02, 0.5, 3), leaf(0x3e7a2e), x, 0.25, z)); g.add(M(new THREE.SphereGeometry(0.13, 6, 4), mat(cs[i % 4]), x, 0.52, z)); } return g; },
  // Orco
  tienda() { const g = new THREE.Group(); const t = M(new THREE.ConeGeometry(1.7, 2.8, 6), mat(0x7a5a3a), 0, 1.4); g.add(t); g.add(M(box(0.8, 1.2, 0.05), mat(0x2a1a10), 0, 0.6, 1.45)); g.add(M(cyl(0.05, 0.05, 1, 4), darkWood(), 0, 3)); return g; },
  totem() { const g = new THREE.Group(); g.add(M(cyl(0.2, 0.25, 3.4, 6), darkWood(), 0, 1.7)); [2.3, 2.9, 3.5].forEach(y => g.add(M(new THREE.SphereGeometry(0.28, 7, 5), mat(0xe8e0cc), 0, y, 0.15))); g.add(M(box(1.6, 0.12, 0.12), darkWood(), 0, 2.6)); return g; },
  jaula() { const g = new THREE.Group(), m = iron(); g.add(M(box(2.4, 0.15, 2.4), m, 0, 0.08)); g.add(M(box(2.4, 0.15, 2.4), m, 0, 2.6)); for (let i = 0; i < 7; i++) { const t = -1.15 + i * 0.38; [[t, -1.15], [t, 1.15], [-1.15, t], [1.15, t]].forEach(([x, z]) => g.add(M(cyl(0.04, 0.04, 2.5, 4), m, x, 1.33, z))); } return g; },
  granhoguera(fire) { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const l = M(cyl(0.2, 0.2, 2.4, 6), darkWood(), 0, 0.5); l.rotation.set(0.6, i / 7 * Math.PI * 2, 0); g.add(l); } const f = fire(1.8); f.position.y = 0.3; g.add(f); g.userData.light = { y: 2, power: 2 }; return g; },
  barricada() { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const s = M(cyl(0.12, 0.12, 2.4, 5), wood(), -1.2 + i * 0.6, 0.9); s.rotation.x = 0.6; g.add(s); const t = M(new THREE.ConeGeometry(0.12, 0.4, 5), wood(), -1.2 + i * 0.6, 2, -0.75); t.rotation.x = 0.6; g.add(t); } g.add(M(box(3, 0.2, 0.2), darkWood(), 0, 0.6, 0.3)); return g; },
  huesos() { const g = new THREE.Group(), b = mat(0xe8e0cc); for (let i = 0; i < 9; i++) { const o = M(cyl(0.06, 0.06, 0.8, 4), b, (R() - 0.5) * 1.6, 0.1 + R() * 0.2, (R() - 0.5) * 1.6); o.rotation.set(R() * 3, R() * 3, Math.PI / 2); g.add(o); } g.add(M(new THREE.SphereGeometry(0.25, 7, 5), b, 0.2, 0.25, 0.1)); return g; },
  olla(fire) { const g = new THREE.Group(); g.add(M(new THREE.SphereGeometry(0.75, 10, 8, 0, Math.PI * 2, Math.PI / 3, Math.PI * 2 / 3), iron(), 0, 0.95)); g.add(M(cyl(0.62, 0.62, 0.05, 12), mat(0x6a5a2a), 0, 1.25)); [0, 2.1, 4.2].forEach(a => { const l = M(cyl(0.05, 0.05, 1.6, 4), darkWood(), Math.cos(a) * 0.8, 0.8, Math.sin(a) * 0.8); l.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); g.add(l); }); return g; },
  // Ciudad
  puesto() { const g = new THREE.Group(); g.add(M(box(2.6, 0.9, 1.2), wood(), 0, 0.45)); [-1.2, 1.2].forEach(x => g.add(M(box(0.12, 2.4, 0.12), darkWood(), x, 1.2, -0.5))); const tl = M(box(2.9, 0.06, 1.6), mat(0xb03030), 0, 2.4, -0.1); tl.rotation.x = 0.2; g.add(tl); for (let i = 0; i < 5; i++) g.add(M(new THREE.SphereGeometry(0.15, 6, 4), mat([0xd04030, 0xe0b040, 0x60a040][i % 3]), -0.9 + i * 0.45, 1, 0)); return g; },
  carro() { const g = new THREE.Group(); g.add(M(box(1.8, 0.7, 3), wood(), 0, 1)); [[-1, -0.9], [1, -0.9], [-1, 0.9], [1, 0.9]].forEach(([x, z]) => { const w = M(cyl(0.55, 0.55, 0.12, 12), darkWood(), x, 0.55, z); w.rotation.z = Math.PI / 2; g.add(w); }); g.add(M(box(0.12, 0.12, 1.6), darkWood(), 0, 0.9, 2.2)); return g; },
  horca() { const g = new THREE.Group(); g.add(M(box(2.6, 0.5, 2.6), wood(), 0, 0.25)); g.add(M(box(0.25, 4, 0.25), darkWood(), -0.9, 2.3)); g.add(M(box(1.8, 0.25, 0.25), darkWood(), -0.1, 4.2)); g.add(M(cyl(0.03, 0.03, 1.2, 4), mat(0xb09a70), 0.6, 3.5)); return g; },
  montonpaja() { const g = new THREE.Group(); g.add(M(new THREE.SphereGeometry(1.2, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd0b060), 0, 0)); return g; },
  armero() { const g = new THREE.Group(); g.add(M(box(2.4, 0.15, 0.6), darkWood(), 0, 0.6)); g.add(M(box(2.4, 0.15, 0.6), darkWood(), 0, 1.8)); for (let i = 0; i < 5; i++) { g.add(M(cyl(0.04, 0.04, 2.6, 4), wood(), -1 + i * 0.5, 1.3)); g.add(M(new THREE.ConeGeometry(0.08, 0.35, 4), iron(), -1 + i * 0.5, 2.75)); } return g; },
  // Cementerio
  lapida() { const g = new THREE.Group(); const l = M(box(1, 1.3, 0.25), stone(), 0, 0.65); l.rotation.z = (R() - 0.5) * 0.2; g.add(l); const tp = M(cyl(0.5, 0.5, 0.25, 10), stone(), 0, 1.3); tp.rotation.x = Math.PI / 2; g.add(tp); g.add(M(box(1, 0.1, 1.8), mat(0x4e3e2c), 0, 0.05, 0.9)); return g; },
  mausoleo() { const g = new THREE.Group(); g.add(M(box(3.2, 2.6, 3.2), stone(), 0, 1.3)); const r = M(new THREE.ConeGeometry(2.4, 1.2, 4), darkStone(), 0, 3.2); r.rotation.y = Math.PI / 4; g.add(r); g.add(M(box(1, 1.8, 0.1), mat(0x1a1612), 0, 0.9, 1.62)); return g; },
  tumbaabierta() { const g = new THREE.Group(); g.add(M(box(1.4, 0.05, 2.6), new THREE.MeshBasicMaterial({ color: 0x0a0806 }), 0, 0.03)); g.add(M(box(1.6, 0.4, 0.8), mat(0x4e3e2c), 1.4, 0.2, 0)); g.add(PROC.lapida().children[0]); return g; },
  cruz() { const g = new THREE.Group(); g.add(M(box(0.3, 2.2, 0.3), stone(), 0, 1.1)); g.add(M(box(1.2, 0.3, 0.3), stone(), 0, 1.6)); return g; },
  cuervos() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = M(new THREE.ConeGeometry(0.18, 0.6, 5), mat(0x101012), (R() - 0.5) * 2, 0.25, (R() - 0.5) * 2); b.rotation.x = Math.PI / 2; b.rotation.y = R() * 6; g.add(b); } return g; },
  niebla() { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xd0d6dc, transparent: true, opacity: 0.22, depthWrite: false }); for (let i = 0; i < 5; i++) { const s = M(new THREE.SphereGeometry(1 + R() * 0.6, 8, 6), m, (R() - 0.5) * 2.4, 0.5 + R() * 0.4, (R() - 0.5) * 2.4); s.scale.y = 0.35; g.add(s); } g.traverse(o => { o.castShadow = false; }); return g; },
  // Montaña
  pinonevado() { const g = treeShape(0x5a3d22, 0x2a4a34, 1, 0.3); g.children.slice(1).forEach(c => { const s = M(new THREE.ConeGeometry(c.geometry.parameters.radius * 0.7, 0.5, 8), mat(0xf0f4f8), 0, c.position.y + 0.6); g.add(s); }); g.rotation.y = R() * 6; return g; },
  monticulo() { const g = new THREE.Group(); g.add(M(new THREE.SphereGeometry(1.3, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xeef2f6), 0, 0)); return g; },
  refugio() { const g = new THREE.Group(); g.add(M(box(3, 1.8, 3), darkWood(), 0, 0.9)); const r = M(new THREE.ConeGeometry(2.6, 1.6, 4), mat(0xeef2f6), 0, 2.6); r.rotation.y = Math.PI / 4; g.add(r); g.add(M(box(0.9, 1.4, 0.1), mat(0x1a1612), 0, 0.7, 1.52)); return g; },
  grieta() { const g = new THREE.Group(); const sh = new THREE.Shape([[-0.3, -1.7], [0.3, -0.8], [-0.2, 0], [0.35, 0.8], [-0.1, 1.7], [-0.6, 0.6], [-0.2, -0.2], [-0.7, -1]].map(([x, y]) => new THREE.Vector2(x, y))); const m = M(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0x050403 }), 0, 0.04); m.rotation.x = -Math.PI / 2; g.add(m); return g; },
  // Pantano
  manglar() { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, r = M(cyl(0.06, 0.1, 1.4, 4), mat(0x4a3a24), Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5); r.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); g.add(r); } g.add(M(cyl(0.2, 0.3, 2.4, 6), mat(0x4a3a24), 0, 2.2)); const cp = M(new THREE.IcosahedronGeometry(1.4, 0), leaf(0x3a5a2a), 0, 3.8); cp.scale.y = 0.6; g.add(cp); return g; },
  tronco() { const g = new THREE.Group(); const t = M(cyl(0.45, 0.5, 3.2, 8), mat(0x5a3d22), 0, 0.45); t.rotation.z = Math.PI / 2; t.rotation.y = R() * 3; g.add(t); return g; },
  cabana() { const g = new THREE.Group(); [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(([x, z]) => g.add(M(cyl(0.12, 0.12, 1.2, 5), darkWood(), x, 0.6, z))); g.add(M(box(3, 1.6, 3), wood(), 0, 2)); const r = M(new THREE.ConeGeometry(2.5, 1.4, 4), mat(0x8a7a4a), 0, 3.5); r.rotation.y = Math.PI / 4; g.add(r); return g; },
  nenufares() { const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const l = M(new THREE.CircleGeometry(0.35, 10), mat(0x3e7a2e), (R() - 0.5) * 2.6, 0.1, (R() - 0.5) * 2.6); l.rotation.x = -Math.PI / 2; g.add(l); if (i % 2) g.add(M(new THREE.SphereGeometry(0.12, 6, 4), mat(0xf0b0c8), l.position.x, 0.18, l.position.z)); } return g; },
  // Volcán
  geiser() { const g = new THREE.Group(); g.add(M(cyl(0.6, 1, 0.5, 8), mat(0x6a5a4a), 0, 0.25)); const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }); for (let i = 0; i < 5; i++) g.add(M(new THREE.SphereGeometry(0.4 + i * 0.15, 8, 6), m, (R() - 0.5) * 0.4, 0.8 + i * 0.6, (R() - 0.5) * 0.4)); return g; },
  obsidiana() { const g = new THREE.Group(), m = mat(0x15121a, { roughness: 0.15, metalness: 0.3 }); [[0, 1, 0, 1.2], [0.7, 0.6, 0.5, 0.7]].forEach(([x, y, z, s]) => { const r = M(new THREE.OctahedronGeometry(s, 0), m, x, y, z); r.scale.y = 1.6; r.rotation.y = R() * 3; g.add(r); }); return g; },
  // Costa
  barca() { const g = new THREE.Group(); const h = M(new THREE.CylinderGeometry(0.9, 0.6, 3, 8, 1, false, 0, Math.PI), wood(), 0, 0.5); h.rotation.set(Math.PI / 2, 0, Math.PI); g.add(h); g.add(M(box(1.5, 0.08, 0.3), darkWood(), 0, 0.6)); return g; },
  redes() { const g = new THREE.Group(); const m = M(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x8a7a5a, { wireframe: true }), 0, 0); m.scale.y = 0.3; g.add(m); return g; },
  ancla() { const g = new THREE.Group(), m = iron(); g.add(M(cyl(0.08, 0.08, 1.8, 6), m, 0, 0.9)); const a = M(new THREE.TorusGeometry(0.6, 0.08, 6, 12, Math.PI), m, 0, 0.6); a.rotation.z = Math.PI; g.add(a); g.add(M(new THREE.TorusGeometry(0.2, 0.05, 6, 10), m, 0, 1.9)); g.rotation.z = 0.5; g.position.y = 0.3; return g; },
  mastil() { const g = new THREE.Group(); g.add(M(cyl(0.18, 0.25, 6, 8), wood(), 0, 3)); g.add(M(box(2.8, 0.15, 0.15), darkWood(), 0, 4.8)); const v = M(box(2.4, 2.4, 0.04), mat(0xe8e0cc), 0, 3.5, 0.2); g.add(v); return g; },
  // Trampas del SRD (las ocultas parecen una losa; la estatua y la roca se ven)
  aguja() { return PROC.trampaoculta(); }, dardos() { return PROC.trampaoculta(); }, red() { return PROC.trampaoculta(); }, techo() { return PROC.trampaoculta(); },
  rocarodante() { const g = new THREE.Group(); g.add(M(new THREE.DodecahedronGeometry(1.4, 1), stone(), 0, 1.4)); return g; },
  estatuafuego() { const g = PROC.estatua(); const mz = M(new THREE.ConeGeometry(0.25, 0.6, 6), glowMat(0xff6a1a, 0xff3a00), 0, 3.1, 0.45); mz.rotation.x = Math.PI / 2; g.add(mz); return g; }
});

/* ---------- Hito 80: tesoros y marcas que no tenían figura en 3D (no se veían) ---------- */
const cloth = c => mat(c, { roughness: 0.95 }), paper = () => mat(0xe8d8b0, { roughness: 0.95 });
const gemMat = c => mat(c, { emissive: c, emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92 });
const brass = () => mat(0xb8862e, { metalness: 0.75, roughness: 0.35 });
function chestBody(w, h, d, woodC, bands) {
  const g = new THREE.Group(), wd = mat(woodC);
  g.add(M(box(w, h, d), wd, 0, h / 2));
  const lid = M(new THREE.CylinderGeometry(d / 2, d / 2, w, 10, 1, false, 0, Math.PI), wd, 0, h, 0); lid.rotation.z = Math.PI / 2; g.add(lid);
  bands.forEach(x => { g.add(M(box(0.12, h + 0.02, d + 0.04), iron(), x, h / 2)); const b = M(new THREE.CylinderGeometry(d / 2 + 0.03, d / 2 + 0.03, 0.12, 10, 1, false, 0, Math.PI), iron(), x, h, 0); b.rotation.z = Math.PI / 2; g.add(b); });
  return g;
}
function bag(c, s = 1, tie = 0x8a6a3a) {
  const g = new THREE.Group(), m = cloth(c);
  const body = M(new THREE.SphereGeometry(0.55 * s, 9, 7), m, 0, 0.48 * s); body.scale.set(1, 0.9, 1); g.add(body);
  g.add(M(new THREE.ConeGeometry(0.22 * s, 0.35 * s, 7), m, 0, 1.05 * s));
  g.add(M(new THREE.TorusGeometry(0.17 * s, 0.04 * s, 5, 10), cloth(tie), 0, 0.92 * s)).children; g.children[2].rotation.x = Math.PI / 2;
  return g;
}
function book(c, w = 0.9, d = 1.2, t = 0.28) {
  const g = new THREE.Group();
  g.add(M(box(w, t, d), mat(c), 0, t / 2));
  g.add(M(box(w - 0.08, t - 0.08, d - 0.04), paper(), 0.03, t / 2)); // páginas, asoman por un lado
  return g;
}
Object.assign(PROC, {
  cofregrande() { const g = chestBody(2.2, 1.1, 1.4, 0x6a4424, [-0.75, 0.75]); g.add(M(box(0.3, 0.35, 0.08), brass(), 0, 1.0, 0.72)); return g; },
  cofrefuerte() {
    const g = chestBody(1.8, 1, 1.25, 0x4a2e1a, [-0.75, -0.25, 0.25, 0.75]);
    g.add(M(box(0.42, 0.5, 0.12), iron(), 0, 0.85, 0.66)); g.add(M(new THREE.TorusGeometry(0.14, 0.05, 6, 10, Math.PI), iron(), 0, 1.12, 0.7));
    return g;
  },
  bolsa() { const g = bag(0x7a4a2a, 0.75, 0xd0a040); for (let i = 0; i < 5; i++) g.add(M(cyl(0.14, 0.14, 0.04, 10), gold(), 0.5 + (R() - 0.5) * 0.5, 0.03 + i * 0.01, 0.35 + (R() - 0.5) * 0.4)); return g; },
  saco() { const g = bag(0xb89a68, 1.25); g.rotation.z = 0.12; return g; },
  mochila() {
    const g = new THREE.Group(), m = cloth(0x5a4a2e);
    g.add(M(box(1.1, 1.2, 0.6), m, 0, 0.6)); const top = M(cyl(0.3, 0.3, 1.1, 10, 1), m, 0, 1.2); top.rotation.z = Math.PI / 2; g.add(top);
    g.add(M(box(0.8, 0.45, 0.2), cloth(0x4a3a22), 0, 0.5, 0.38));
    const roll = M(cyl(0.2, 0.2, 1.2, 8), cloth(0x7a2a24), 0, 1.5); roll.rotation.z = Math.PI / 2; g.add(roll);
    g.rotation.x = -0.25; return g;
  },
  reliquia() {
    const g = new THREE.Group(); g.add(M(cyl(0.55, 0.65, 0.3, 8), mat(0x6a645a), 0, 0.15));
    g.add(M(box(0.7, 0.8, 0.5), gold(), 0, 0.7)); const roof = M(new THREE.ConeGeometry(0.55, 0.45, 4), gold(), 0, 1.32); roof.rotation.y = Math.PI / 4; g.add(roof);
    g.add(M(new THREE.OctahedronGeometry(0.16, 0), gemMat(0xd02a40), 0, 0.75, 0.27));
    return g;
  },
  gema() {
    const g = new THREE.Group(), cs = [0x3ad0ff, 0xff3a6a, 0x5aff8a, 0xb06aff, 0xffe04a];
    for (let i = 0; i < 6; i++) { const o = M(new THREE.OctahedronGeometry(0.16 + R() * 0.12, 0), gemMat(cs[i % cs.length]), (R() - 0.5) * 1.1, 0.16, (R() - 0.5) * 1.1); o.rotation.set(R(), R() * 6, R()); g.add(o); }
    const big = M(new THREE.OctahedronGeometry(0.32, 0), gemMat(0x3ad0ff), 0, 0.5); big.userData.spin = true; g.add(big);
    return g;
  },
  joyas() {
    const g = new THREE.Group(), au = gold();
    g.add(M(box(1, 0.5, 0.7), mat(0x5a1a2a), 0, 0.25)); g.add(M(box(1.02, 0.06, 0.72), au, 0, 0.5));
    const neck = M(new THREE.TorusGeometry(0.4, 0.04, 5, 16), au, 0.15, 0.56, 0); neck.rotation.x = Math.PI / 2; g.add(neck);
    g.add(M(new THREE.OctahedronGeometry(0.1, 0), gemMat(0x3a8aff), 0.15, 0.58, 0.4));
    [[0.75, 0.3], [-0.7, -0.35]].forEach(([x, z]) => { const r = M(new THREE.TorusGeometry(0.12, 0.035, 5, 12), au, x, 0.04, z); r.rotation.x = Math.PI / 2; g.add(r); });
    return g;
  },
  libro() { const g = book(0x6a2a1a); g.rotation.y = 0.4; const b2 = book(0x2a4a6a, 0.8, 1.05, 0.22); b2.position.y = 0.28; b2.rotation.y = -0.5; g.add(b2); return g; },
  grimorio() {
    const g = book(0x3a1a4a, 1.1, 1.4, 0.36);
    g.add(M(box(0.5, 0.04, 0.5), glowMat(0xb06aff, 0x7a2aff), 0, 0.37)); [[-0.5, -0.65], [0.5, -0.65], [-0.5, 0.65], [0.5, 0.65]].forEach(([x, z]) => g.add(M(box(0.16, 0.38, 0.16), brass(), x, 0.18, z)));
    g.userData.glow = { color: 0x9a5aff, power: 0.25, y: 0.8 };
    return g;
  },
  llave() {
    const g = new THREE.Group(), m = brass();
    const ring = M(new THREE.TorusGeometry(0.22, 0.06, 6, 12), m, -0.5, 0.06, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
    const shaft = M(cyl(0.05, 0.05, 0.9, 6), m, 0.05, 0.06, 0); shaft.rotation.z = Math.PI / 2; g.add(shaft);
    g.add(M(box(0.08, 0.06, 0.22), m, 0.4, 0.06, 0.1)); g.add(M(box(0.08, 0.06, 0.16), m, 0.25, 0.06, 0.08));
    g.scale.setScalar(1.4); return g;
  },
  mapa() {
    const g = new THREE.Group(), sh = M(box(1.4, 0.03, 1), mat(0xd8c08a), 0, 0.02); g.add(sh);
    [[-0.7, 0], [0.7, 0]].forEach(([x]) => { const r = M(cyl(0.1, 0.1, 1.05, 8), mat(0xc8b078), x, 0.1, 0); r.rotation.x = Math.PI / 2; g.add(r); });
    g.add(M(box(0.5, 0.035, 0.04), mat(0xa02020), 0.1, 0.04, 0.1)); g.add(M(box(0.04, 0.035, 0.4), mat(0xa02020), -0.2, 0.04, -0.05));
    return g;
  },
  carta() {
    const g = new THREE.Group(); g.add(M(box(0.9, 0.03, 0.6), mat(0xf0e4c4), 0, 0.02));
    g.add(M(cyl(0.11, 0.11, 0.05, 10), mat(0xb01a1a, { roughness: 0.4 }), 0, 0.05, 0.05));
    g.rotation.y = R() * 3; return g;
  },
  armasuelo() {
    const g = new THREE.Group(), steel = mat(0xb8bcc2, { metalness: 0.8, roughness: 0.3 });
    g.add(M(box(1.6, 0.06, 0.16), steel, 0.3, 0.06)); g.add(M(box(0.1, 0.1, 0.55), brass(), -0.5, 0.07)); g.add(M(box(0.45, 0.1, 0.1), mat(0x4a2e1a), -0.75, 0.07));
    const ax = new THREE.Group(); ax.add(M(box(1.2, 0.08, 0.08), mat(0x5a3d22), 0, 0.06)); ax.add(M(box(0.3, 0.06, 0.4), steel, 0.5, 0.06, 0.12)); ax.position.set(0, 0, 0.6); ax.rotation.y = 0.7; g.add(ax);
    return g;
  },
  escudo() {
    const g = new THREE.Group();
    const sh = M(cyl(0.65, 0.65, 0.1, 14), mat(0x7a2a24), 0, 0.12); sh.rotation.x = -0.15; g.add(sh);
    g.add(M(cyl(0.18, 0.18, 0.12, 10), mat(0xb8bcc2, { metalness: 0.8, roughness: 0.3 }), 0, 0.2)); const rim = M(new THREE.TorusGeometry(0.65, 0.05, 5, 18), iron(), 0, 0.13); rim.rotation.x = Math.PI / 2 - 0.15; g.add(rim);
    const helm = M(new THREE.SphereGeometry(0.32, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9a9ea4, { metalness: 0.7, roughness: 0.35 }), 0.9, 0, -0.4); g.add(helm);
    return g;
  },
  urna() {
    const g = new THREE.Group(), m = mat(0x8a5a3a, { roughness: 0.6 });
    const pts = [[0, 0], [0.35, 0], [0.45, 0.15], [0.6, 0.6], [0.5, 1.0], [0.28, 1.15], [0.32, 1.3], [0, 1.3]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(M(new THREE.LatheGeometry(pts, 12), m)); g.add(M(new THREE.TorusGeometry(0.6, 0.035, 5, 16), mat(0xd0a040, { metalness: 0.6 }), 0, 0.62)).children; g.children[1].rotation.x = Math.PI / 2;
    return g;
  },
  restos() {
    const g = new THREE.Group(), bone = mat(0xdcd2b8);
    g.add(M(new THREE.SphereGeometry(0.28, 8, 6), bone, -0.6, 0.25, 0)); g.add(M(box(0.12, 0.12, 0.9), bone, 0, 0.08, 0)); for (let i = 0; i < 3; i++) { const rb = M(new THREE.TorusGeometry(0.28, 0.04, 4, 8, Math.PI), bone, -0.1 + i * 0.22, 0.12, 0); rb.rotation.y = Math.PI / 2; g.add(rb); }
    [[0.55, 0.3, 0.8], [0.55, -0.3, -0.7]].forEach(([x, z, r]) => { const l = M(box(0.9, 0.09, 0.09), bone, x, 0.05, z); l.rotation.y = r; g.add(l); });
    const pk = bag(0x5a4a2e, 0.55); pk.position.set(0.3, 0, 0.75); g.add(pk);
    return g;
  },
  ofrenda(fire) {
    const g = new THREE.Group(); g.add(M(box(1.8, 0.9, 1.1), stone(), 0, 0.45)); g.add(M(box(2, 0.12, 1.3), mat(0x6a6058), 0, 0.96));
    g.add(M(cyl(0.35, 0.25, 0.15, 10), gold(), 0, 1.1)); g.add(M(new THREE.SphereGeometry(0.12, 6, 5), mat(0xb0301a), 0.05, 1.22));
    [-0.65, 0.65].forEach(x => { g.add(M(cyl(0.07, 0.07, 0.4, 6), mat(0xf0e8d0), x, 1.22)); const f = fire(0.22); f.position.set(x, 1.45, 0); g.add(f); });
    g.userData.glow = { color: 0xffb060, power: 0.35, y: 1.6 };
    return g;
  },
  pasaje() {
    // Marca de paso: un arco de luz azulada en el suelo que invita a cruzar
    const g = new THREE.Group(), m = glowMat(0x6ac8ff, 0x2a7aff);
    const arch = M(new THREE.TorusGeometry(1.3, 0.12, 6, 20, Math.PI), m, 0, 0.05); g.add(arch);
    const disc = M(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.22, depthWrite: false }), 0, 0.04); disc.rotation.x = -Math.PI / 2; g.add(disc);
    const arrow = new THREE.Shape(); arrow.moveTo(0, 0.6); arrow.lineTo(0.45, 0); arrow.lineTo(0.18, 0); arrow.lineTo(0.18, -0.6); arrow.lineTo(-0.18, -0.6); arrow.lineTo(-0.18, 0); arrow.lineTo(-0.45, 0);
    const ar = M(new THREE.ShapeGeometry(arrow), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.85, depthWrite: false }), 0, 0.06); ar.rotation.x = -Math.PI / 2; g.add(ar);
    g.userData.glow = { color: 0x4aa8ff, power: 0.3, y: 1 };
    return g;
  }
});

/* ---------- Hito 83: más detalle en las piezas hechas por código (zócalos, molduras, biseles, variantes) ---------- */
const stoneV = () => mat(0x7d776e + Math.floor((R() - 0.5) * 6) * 0x010101);
const moss = () => mat(0x4a6a32, { roughness: 1 });
/** Zócalo con moldura: un bloque, una cornisa y un bisel arriba. */
function plinth(w, h, d, m = stoneV()) {
  const g = new THREE.Group();
  g.add(M(box(w + 0.2, 0.18, d + 0.2), darkStone(), 0, 0.09));
  g.add(M(box(w, h, d), m, 0, 0.18 + h / 2));
  g.add(M(box(w + 0.14, 0.12, d + 0.14), darkStone(), 0, 0.18 + h + 0.06));
  return g;
}
Object.assign(PROC, {
  estatua() {
    const g = plinth(1.5, 0.7, 1.5), m = mat(0x8e887e), y0 = 1.06;
    g.add(M(cyl(0.38, 0.62, 1.1, 10), m, 0, y0 + 0.55));                       // faldón
    g.add(M(cyl(0.48, 0.38, 0.9, 10), m, 0, y0 + 1.55));                       // torso
    [[-1, 0.5], [1, -0.9]].forEach(([s, a]) => { const sh = M(new THREE.SphereGeometry(0.2, 8, 6), m, s * 0.5, y0 + 1.95, 0); g.add(sh); const arm = M(cyl(0.11, 0.13, 1, 7), m, s * 0.6, y0 + 1.5, 0.05); arm.rotation.z = s * 0.25; arm.rotation.x = a * 0.3; g.add(arm); });
    g.add(M(cyl(0.12, 0.14, 0.2, 8), m, 0, y0 + 2.1)); g.add(M(new THREE.SphereGeometry(0.3, 10, 8), m, 0, y0 + 2.4));
    const sw = M(box(0.12, 1.8, 0.06), mat(0x9a968e), 0.62, y0 + 1.1, 0.25); g.add(sw); g.add(M(box(0.45, 0.08, 0.1), mat(0x9a968e), 0.62, y0 + 1.95, 0.25));
    if (R() < 0.5) g.add(M(box(1.2, 0.04, 0.5), moss(), -0.3, 0.2, 0.62));
    return g;
  },
  altar() {
    const g = new THREE.Group();
    g.add(M(box(3.4, 0.25, 2.1), darkStone(), 0, 0.12)); g.add(M(box(3.0, 0.2, 1.8), stoneV(), 0, 0.35));          // gradas
    g.add(M(box(2.6, 0.9, 1.3), stoneV(), 0, 0.9)); [-1.15, 1.15].forEach(x => g.add(M(box(0.3, 0.95, 1.4), darkStone(), x, 0.92)));
    g.add(M(box(3.0, 0.2, 1.7), mat(0x6a6058), 0, 1.45)); g.add(M(box(2.8, 0.06, 1.5), mat(0x58504a), 0, 1.58));
    g.add(M(box(1.2, 0.03, 1.55), mat(0x7a1e24, { roughness: 1 }), 0, 1.62)); g.add(M(box(1.2, 0.55, 0.03), mat(0x7a1e24, { roughness: 1 }), 0, 1.35, 0.86));
    g.add(M(box(0.5, 0.04, 0.06), mat(0xd0a040, { metalness: 0.7, roughness: 0.3 }), 0, 1.4, 0.88));
    [-1.1, 1.1].forEach(x => { g.add(M(cyl(0.1, 0.12, 0.25, 8), mat(0xd0a040, { metalness: 0.7, roughness: 0.3 }), x, 1.72)); g.add(M(cyl(0.05, 0.05, 0.3, 6), mat(0xf0e8d0), x, 1.98)); });
    return g;
  },
  sarcofago() {
    const g = new THREE.Group(), m = stoneV();
    g.add(M(box(1.8, 0.2, 3.5), darkStone(), 0, 0.1));
    g.add(M(box(1.5, 0.9, 3.2), m, 0, 0.65)); [[-0.76, 0], [0.76, 0]].forEach(([x]) => { for (let i = -1; i <= 1; i++) g.add(M(box(0.04, 0.5, 0.7), darkStone(), x, 0.65, i * 1)); });
    const lid = new THREE.Group(); lid.position.y = 1.1;
    lid.add(M(box(1.65, 0.16, 3.35), mat(0x8a847a), 0, 0.08)); lid.add(M(box(1.3, 0.14, 3.0), mat(0x928c82), 0, 0.23));
    // figura yacente en relieve
    const f = mat(0x9a948a); lid.add(M(new THREE.SphereGeometry(0.24, 8, 6), f, 0, 0.38, -1.15)); lid.add(M(box(0.6, 0.18, 1.5), f, 0, 0.37, -0.15)); lid.add(M(box(0.4, 0.14, 0.7), f, 0, 0.35, 0.85));
    lid.add(M(box(0.1, 0.08, 1.2), mat(0xa8a49c), 0, 0.5, -0.2));
    lid.rotation.y = (R() - 0.5) * 0.08; g.add(lid);
    return g;
  },
  fuente() {
    const g = new THREE.Group(), water = mat(0x3a7aa0, { roughness: 0.08, transparent: true, opacity: 0.85, emissive: 0x0a2030 });
    const ring = M(cyl(1.55, 1.65, 0.7, 20, 1), stoneV(), 0, 0.35); g.add(ring);
    g.add(M(new THREE.TorusGeometry(1.55, 0.12, 6, 24), mat(0x8a847a), 0, 0.72)).children; g.children[1].rotation.x = Math.PI / 2;
    g.add(M(cyl(1.42, 1.42, 0.05, 20), water, 0, 0.62));
    g.add(M(cyl(0.22, 0.32, 1.5, 10), stoneV(), 0, 1.2)); g.add(M(cyl(0.75, 0.3, 0.3, 14), stoneV(), 0, 1.95)); g.add(M(cyl(0.68, 0.68, 0.04, 14), water, 0, 2.08));
    g.add(M(cyl(0.12, 0.18, 0.5, 8), stoneV(), 0, 2.3)); g.add(M(new THREE.SphereGeometry(0.18, 8, 6), stoneV(), 0, 2.6));
    const jet = M(cyl(0.04, 0.09, 0.55, 6), mat(0xbfe6ff, { transparent: true, opacity: 0.6, emissive: 0x2a6a9a, roughness: 0.05 }), 0, 2.95); jet.userData.spin = true; g.add(jet);
    return g;
  },
  mausoleo() {
    const g = new THREE.Group(), m = stoneV();
    g.add(M(box(3.8, 0.3, 3.8), darkStone(), 0, 0.15)); g.add(M(box(3.5, 0.2, 3.9), darkStone(), 0, 0.4));          // escalinata
    g.add(M(box(3.2, 2.4, 3.2), m, 0, 1.7));
    [[-1.45, 1.62], [1.45, 1.62], [-1.45, -1.62], [1.45, -1.62]].forEach(([x, z]) => g.add(M(cyl(0.2, 0.24, 2.5, 10), mat(0x9a948a), x, 1.75, z)));  // columnas
    g.add(M(box(3.5, 0.3, 3.5), mat(0x6a645a), 0, 3.05));                                                                   // cornisa
    const r = M(new THREE.ConeGeometry(2.4, 1.1, 4), darkStone(), 0, 3.75); r.rotation.y = Math.PI / 4; g.add(r);
    g.add(M(box(1.1, 1.8, 0.1), mat(0x1a1612), 0, 1.4, 1.62)); g.add(M(box(1.3, 0.18, 0.14), mat(0x6a645a), 0, 2.38, 1.63));  // puerta y dintel
    g.add(M(box(0.8, 0.25, 0.04), mat(0x5a544a), 0, 2.7, 1.62));                                                           // lápida del nombre
    g.add(M(box(0.12, 0.6, 0.12), stoneV(), 0, 4.5)); g.add(M(box(0.45, 0.12, 0.12), stoneV(), 0, 4.6));                    // cruz
    if (R() < 0.6) g.add(M(box(1.4, 0.05, 1), moss(), -0.9, 3.25, 0.6));
    return g;
  },
  cabana() {
    const g = new THREE.Group(), dw = darkWood(), w = wood();
    [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([x, z]) => g.add(M(cyl(0.12, 0.14, 1.3, 6), dw, x, 0.65, z)));   // pilotes
    g.add(M(box(3.3, 0.15, 3.3), dw, 0, 1.25));                                                                                       // plataforma
    for (let i = 0; i < 7; i++) g.add(M(box(3.0, 0.32, 0.28), i % 2 ? w : mat(0x5e4228), 0, 1.5 + i * 0.3, -1.4));                 // troncos
    [[-1.4, 0], [1.4, 0]].forEach(([x]) => { for (let i = 0; i < 7; i++) g.add(M(box(0.28, 0.32, 2.9), i % 2 ? w : mat(0x5e4228), x, 1.5 + i * 0.3, 0)); });
    for (let i = 0; i < 7; i++) { [-1, 1].forEach(s => g.add(M(box(0.9, 0.32, 0.28), i % 2 ? w : mat(0x5e4228), s * 0.95, 1.5 + i * 0.3, 1.4))); }
    g.add(M(box(1.0, 1.6, 0.06), mat(0x1a120a), 0, 2.1, 1.42));                                                                       // puerta
    const roof = mat(0x8a7a4a, { roughness: 1 });
    [-1, 1].forEach(s => { const p = M(box(3.6, 0.12, 2.3), roof, 0, 4.0, s * 0.85); p.rotation.x = s * 0.62; g.add(p); });
    g.add(M(cyl(0.08, 0.08, 3.7, 6), dw, 0, 4.55, 0)).children; g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    const ch = M(box(0.4, 1.1, 0.4), stoneV(), 1.1, 4.3, -0.9); g.add(ch);
    return g;
  },
  cristales() {
    const g = new THREE.Group(), m = mat(0x7ad8ff, { emissive: 0x1a6a9a, emissiveIntensity: 0.9, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.86 });
    const inner = mat(0xd8f6ff, { emissive: 0x6ad0ff, emissiveIntensity: 1.4 });
    g.add(M(new THREE.DodecahedronGeometry(0.9, 0), mat(0x5a564e), 0, 0.2)); g.children[0].scale.y = 0.4;                                 // roca madre
    const n = 5 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const h = 0.7 + R() * 1.3, a = i / n * Math.PI * 2 + R() * 0.5, d = i === 0 ? 0 : 0.35 + R() * 0.3;
      const cr = new THREE.Group(); cr.position.set(Math.cos(a) * d, 0.3, Math.sin(a) * d);
      const body = M(new THREE.CylinderGeometry(0.16 + R() * 0.08, 0.2 + R() * 0.08, h, 6), m, 0, h / 2); cr.add(body);
      cr.add(M(new THREE.ConeGeometry(0.2 + R() * 0.06, 0.35, 6), m, 0, h + 0.17));
      cr.add(M(new THREE.CylinderGeometry(0.05, 0.06, h * 0.8, 6), inner, 0, h * 0.45));                                                  // núcleo que brilla
      cr.rotation.set((R() - 0.5) * 0.7 * (d ? 1 : 0.2), R() * 6, (R() - 0.5) * 0.7 * (d ? 1 : 0.2)); g.add(cr);
    }
    g.userData.glow = { color: 0x6ad0ff, power: 0.5, y: 1 };
    return g;
  },
  setas() {
    const g = new THREE.Group(), stem = mat(0xe8e0cc), gills = mat(0xd8c8b0);
    const caps = [0x8a3ab0, 0x6a2a9a, 0xa04ac0];
    const n = 4 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const s = i === 0 ? 1 : 0.35 + R() * 0.45, a = R() * 6.28, d = i === 0 ? 0 : 0.6 + R() * 0.7, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 1.4 * s;
      const st = M(new THREE.CylinderGeometry(0.1 * s * 2, 0.16 * s * 2, h, 8), stem, x, h / 2, z); st.rotation.z = (R() - 0.5) * 0.25; g.add(st);
      const cap = M(new THREE.SphereGeometry(0.85 * s, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat(caps[i % 3], { emissive: 0x2a0a40, emissiveIntensity: 0.9 }), x, h, z); cap.scale.y = 0.75; g.add(cap);
      g.add(M(new THREE.CircleGeometry(0.82 * s, 14), gills, x, h + 0.01, z)).children; g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      for (let k = 0; k < 4; k++) { const b = k / 4 * 6.28 + R(); g.add(M(new THREE.SphereGeometry(0.07 * s + 0.03, 5, 4), mat(0xf0e0ff, { emissive: 0x8a5aff, emissiveIntensity: 1.2 }), x + Math.cos(b) * 0.5 * s, h + 0.35 * s, z + Math.sin(b) * 0.5 * s)); }
    }
    g.userData.glow = { color: 0xb070ff, power: 0.4, y: 1.2 };
    return g;
  }
});

/* ---------- Hito 90: objetos nuevos para las escenas ---------- */
const glowM = (c, e, k = 1.3) => mat(c, { emissive: e, emissiveIntensity: k });
Object.assign(PROC, {
  mesaritual(fire) {
    const g = new THREE.Group(), dw = darkWood();
    g.add(M(box(3, 0.18, 1.6), dw, 0, 1.3)); [[-1.3, -0.65], [1.3, -0.65], [-1.3, 0.65], [1.3, 0.65]].forEach(([x, z]) => g.add(M(cyl(0.09, 0.12, 1.25, 6), dw, x, 0.62, z)));
    g.add(M(box(2.6, 0.03, 1.3), mat(0x2a1a3a, { roughness: 1 }), 0, 1.41));                                     // paño morado
    const bk = book(0x3a1a1a, 0.9, 0.7, 0.12); bk.position.set(-0.5, 1.42, 0.1); bk.rotation.y = 0.3; g.add(bk);    // libro abierto
    g.add(M(new THREE.SphereGeometry(0.2, 8, 6), mat(0xdcd2b8), 0.6, 1.62, -0.25));                                 // calavera
    g.add(M(cyl(0.08, 0.1, 0.35, 8), glowM(0x5aff9a, 0x2aff6a, 1.6), 0.95, 1.6, 0.3));                              // frasco que brilla
    g.add(M(cyl(0.06, 0.06, 0.3, 6), mat(0xf0e8d0), -1.2, 1.57, -0.45)); const f = fire(0.22); f.position.set(-1.2, 1.78, -0.45); g.add(f);
    g.add(M(box(0.4, 0.3, 0.3), mat(0x4a3a24), 1.1, 1.55, -0.4));
    g.userData.glow = { color: 0x5aff9a, power: 0.4, y: 1.8 };
    return g;
  },
  circulo() {
    const g = new THREE.Group(), gm = glowM(0x9a5aff, 0x7a2aff, 1.5);
    [1.75, 1.3].forEach(r => { const t = M(new THREE.TorusGeometry(r, 0.05, 4, 48), gm, 0, 0.05); t.rotation.x = Math.PI / 2; g.add(t); });
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, b = (i + 2) / 5 * Math.PI * 2; const L = Math.hypot(Math.cos(a) - Math.cos(b), Math.sin(a) - Math.sin(b)) * 1.3; const l = M(box(L, 0.03, 0.06), gm, (Math.cos(a) + Math.cos(b)) * 0.65, 0.05, (Math.sin(a) + Math.sin(b)) * 0.65); l.rotation.y = -Math.atan2(Math.sin(b) - Math.sin(a), Math.cos(b) - Math.cos(a)); g.add(l); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(M(box(0.14, 0.03, 0.14), gm, Math.cos(a) * 1.52, 0.05, Math.sin(a) * 1.52)); }
    g.userData.glow = { color: 0x9a5aff, power: 0.35, y: 0.6 };
    return g;
  },
  pilarantorcha(fire) {
    const g = new THREE.Group(), m = stoneV();
    g.add(M(box(1.4, 0.3, 1.4), darkStone(), 0, 0.15)); g.add(M(cyl(0.5, 0.58, 4.6, 10), m, 0, 2.6)); g.add(M(box(1.3, 0.3, 1.3), darkStone(), 0, 5.0));
    const arm = M(box(0.12, 0.12, 0.7), iron(), 0, 3.4, 0.75); g.add(arm); g.add(M(cyl(0.16, 0.08, 0.3, 6), iron(), 0, 3.55, 1.05));
    const f = fire(0.6); f.position.set(0, 3.85, 1.05); g.add(f);
    return g;
  },
  caldero() {
    const g = new THREE.Group(), ir = mat(0x24221f, { metalness: 0.6, roughness: 0.5 });
    const pot = M(new THREE.SphereGeometry(0.9, 14, 10, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7), ir, 0, 0.95); pot.material.side = THREE.DoubleSide; g.add(pot);
    g.add(M(new THREE.TorusGeometry(0.78, 0.06, 6, 20), ir, 0, 1.5)).children; g.children[1].rotation.x = Math.PI / 2;
    const brew = M(new THREE.CircleGeometry(0.76, 20), glowM(0x6aff4a, 0x3aff2a, 1.4), 0, 1.42); brew.rotation.x = -Math.PI / 2; g.add(brew);
    for (let i = 0; i < 4; i++) { const b = M(new THREE.SphereGeometry(0.1 + i * 0.02, 8, 6), glowM(0x9aff7a, 0x4aff3a, 1.6), (R() - 0.5) * 0.8, 1.48, (R() - 0.5) * 0.8); b.userData.spin = true; g.add(b); }
    [0, 1, 2].forEach(i => { const a = i / 3 * Math.PI * 2; g.add(M(cyl(0.08, 0.1, 0.5, 5), ir, Math.cos(a) * 0.6, 0.2, Math.sin(a) * 0.6)); });
    g.add(M(cyl(0.5, 0.6, 0.12, 8), mat(0x3a2a1a), 0, 0.06)); // leña
    g.userData.glow = { color: 0x6aff4a, power: 0.45, y: 1.8 };
    return g;
  },
  orbe() {
    const g = new THREE.Group();
    g.add(M(cyl(0.5, 0.7, 0.3, 8), darkStone(), 0, 0.15)); g.add(M(cyl(0.18, 0.28, 1.6, 8), stoneV(), 0, 1.1));
    [0, 1, 2].forEach(i => { const c = M(new THREE.ConeGeometry(0.06, 0.6, 4), brass(), Math.cos(i * 2.1) * 0.28, 2.05, Math.sin(i * 2.1) * 0.28); c.rotation.z = Math.cos(i * 2.1) * -0.5; c.rotation.x = Math.sin(i * 2.1) * 0.5; g.add(c); });
    const o = M(new THREE.SphereGeometry(0.42, 18, 14), glowM(0x7ad8ff, 0x3a9aff, 1.8), 0, 2.55); o.material.transparent = true; o.material.opacity = 0.9; o.userData.spin = true; g.add(o);
    const ring = M(new THREE.TorusGeometry(0.62, 0.025, 4, 32), glowM(0xbfe6ff, 0x6ab8ff, 1.5), 0, 2.55); ring.rotation.x = 1.2; ring.userData.spin = true; g.add(ring);
    g.userData.glow = { color: 0x6ab8ff, power: 0.6, y: 2.6 };
    return g;
  },
  trono() {
    const g = new THREE.Group(), m = mat(0x4a3a2c), au = brass(), red = mat(0x7a1e24, { roughness: 1 });
    g.add(M(box(2.2, 0.3, 2), stoneV(), 0, 0.15)); g.add(M(box(1.6, 0.8, 1.3), m, 0, 0.7)); g.add(M(box(1.4, 0.12, 1.1), red, 0, 1.15));
    g.add(M(box(1.6, 2.6, 0.25), m, 0, 2.3, -0.55)); g.add(M(box(1.2, 2, 0.06), red, 0, 2.2, -0.41));
    [-0.85, 0.85].forEach(x => { g.add(M(box(0.22, 0.6, 1.2), m, x, 1.3, 0)); g.add(M(new THREE.SphereGeometry(0.15, 8, 6), au, x, 1.65, 0.5)); });
    [-0.6, 0, 0.6].forEach((x, i) => g.add(M(new THREE.ConeGeometry(0.12, 0.45, 5), au, x, 3.8 + (i === 1 ? 0.15 : 0), -0.55)));
    return g;
  },
  escritorio() {
    const g = new THREE.Group(), w = wood(), dw = darkWood();
    g.add(M(box(2.4, 0.14, 1.2), w, 0, 1.2)); [[-1.05, -0.5], [1.05, -0.5], [-1.05, 0.5], [1.05, 0.5]].forEach(([x, z]) => g.add(M(box(0.14, 1.15, 0.14), dw, x, 0.6, z)));
    g.add(M(box(2.4, 0.9, 0.12), dw, 0, 1.7, -0.55)); for (let i = 0; i < 4; i++) g.add(M(box(0.5, 0.25, 0.25), dw, -0.85 + i * 0.57, 1.6, -0.42));
    for (let i = 0; i < 4; i++) { const p = M(box(0.5 + R() * 0.2, 0.02, 0.35), paper(), -0.6 + R() * 1.2, 1.28 + i * 0.01, (R() - 0.3) * 0.5); p.rotation.y = (R() - 0.5) * 0.8; g.add(p); }
    const sc = M(cyl(0.08, 0.08, 0.6, 8), paper(), 0.8, 1.35, 0.25); sc.rotation.z = Math.PI / 2; g.add(sc);
    g.add(M(cyl(0.06, 0.07, 0.12, 8), mat(0x1a1a2a), -0.9, 1.33, 0.3)); const q = M(cyl(0.01, 0.03, 0.5, 4), mat(0xf0f0f0), -0.9, 1.55, 0.3); q.rotation.z = 0.4; g.add(q);
    return g;
  },
  telescopio() {
    const g = new THREE.Group(), b = brass(), w = darkWood();
    [0, 1, 2].forEach(i => { const a = i / 3 * Math.PI * 2, l = M(cyl(0.05, 0.06, 1.8, 5), w, Math.cos(a) * 0.4, 0.85, Math.sin(a) * 0.4); l.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); g.add(l); });
    const tube = new THREE.Group(); tube.position.y = 1.8; tube.rotation.z = 0.7;
    tube.add(M(cyl(0.16, 0.22, 2.2, 12), b, 0, 0.4)); tube.add(M(cyl(0.24, 0.24, 0.12, 12), b, 0, 1.5)); tube.add(M(cyl(0.08, 0.1, 0.4, 8), b, 0, -0.85));
    g.add(tube); return g;
  },
  ataud() {
    const g = new THREE.Group(), w = darkWood();
    const sh = new THREE.Shape(); sh.moveTo(-0.45, -1.3); sh.lineTo(0.45, -1.3); sh.lineTo(0.7, 0.6); sh.lineTo(0.45, 1.3); sh.lineTo(-0.45, 1.3); sh.lineTo(-0.7, 0.6); sh.closePath();
    const body = M(new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: false }), w, 0, 0.7); body.rotation.x = Math.PI / 2; g.add(body);
    const lid = M(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }), mat(0x3a2414), 0.3, 0.86, 0.15); lid.rotation.x = Math.PI / 2; lid.rotation.z = 0.25; g.add(lid);
    g.add(M(box(0.08, 0.02, 0.6), brass(), 0.3, 1.0, 0)); g.add(M(box(0.35, 0.02, 0.08), brass(), 0.3, 1.0, 0.1));
    return g;
  },
  cadenas() {
    const g = new THREE.Group(), ir = iron();
    g.add(M(box(0.25, 3.4, 0.25), darkWood(), 0, 1.7)); g.add(M(box(1.4, 0.2, 0.2), darkWood(), 0.55, 3.3));
    [-0.1, 0.4, 0.9].forEach((x, k) => { for (let i = 0; i < 6 - k; i++) { const l = M(new THREE.TorusGeometry(0.09, 0.025, 4, 8), ir, x + 0.1, 3.1 - i * 0.16, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; g.add(l); } g.add(M(new THREE.TorusGeometry(0.16, 0.04, 5, 10), ir, x + 0.1, 3.1 - (6 - k) * 0.16 - 0.1, 0)); });
    return g;
  },
  estatuarota() {
    const g = plinth(1.5, 0.7, 1.5), m = mat(0x8e887e), y0 = 1.06;
    g.add(M(cyl(0.38, 0.62, 1.1, 10), m, 0, y0 + 0.55)); const torso = M(cyl(0.48, 0.38, 0.6, 10), m, 0, y0 + 1.4); torso.rotation.z = 0.15; g.add(torso);
    const head = M(new THREE.SphereGeometry(0.3, 10, 8), m, 1.1, 0.3, 0.6); g.add(head);
    const arm = M(cyl(0.11, 0.13, 1, 7), m, -0.9, 0.12, 0.8); arm.rotation.z = Math.PI / 2; arm.rotation.y = 0.6; g.add(arm);
    for (let i = 0; i < 5; i++) { const r = M(new THREE.DodecahedronGeometry(0.15 + R() * 0.15, 0), m, (R() - 0.5) * 2.2, 0.1, (R() - 0.5) * 2.2); r.rotation.set(R(), R(), R()); g.add(r); }
    g.add(M(box(1.2, 0.04, 0.5), moss(), 0.3, 0.2, -0.62));
    return g;
  },
  estalagmita() {
    const g = new THREE.Group(), m = mat(0x6a645c);
    g.add(M(new THREE.DodecahedronGeometry(0.9, 0), m, 0, 0.1)); g.children[0].scale.y = 0.35;
    [[0, 0, 3.4, 0.55], [0.6, 0.3, 2.2, 0.38], [-0.5, 0.4, 1.6, 0.32], [0.2, -0.6, 1.2, 0.28]].forEach(([x, z, h, r]) => { const c = M(new THREE.ConeGeometry(r, h, 7), m, x, h / 2, z); c.rotation.set((R() - 0.5) * 0.12, R() * 6, (R() - 0.5) * 0.12); g.add(c); });
    return g;
  },
  piedrasrio() {
    const g = new THREE.Group(), m = mat(0x7a756c, { roughness: 0.7 });
    [[-0.9, -0.8, 0.55], [0.1, -0.2, 0.6], [0.9, 0.7, 0.5], [-0.4, 0.9, 0.4]].forEach(([x, z, r]) => { const s = M(new THREE.DodecahedronGeometry(r, 0), m, x, 0.02, z); s.scale.y = 0.35; s.rotation.y = R() * 6; g.add(s); s.add(M(new THREE.TorusGeometry(r * 1.05, 0.04, 4, 16), mat(0xdfeef5, { transparent: true, opacity: 0.6 }), 0, 0.02 / 0.35, 0)); s.children[0].rotation.x = Math.PI / 2; });
    return g;
  },
  farol() {
    const g = new THREE.Group(), ir = iron();
    g.add(M(box(0.6, 0.2, 0.6), darkStone(), 0, 0.1)); g.add(M(cyl(0.08, 0.1, 3.6, 6), ir, 0, 1.9)); g.add(M(box(0.8, 0.08, 0.08), ir, 0.35, 3.6));
    g.add(M(box(0.45, 0.55, 0.45), glowM(0xffd68a, 0xffa040, 1.6), 0.7, 3.25)); g.add(M(new THREE.ConeGeometry(0.38, 0.3, 4), ir, 0.7, 3.68)); g.children[g.children.length - 1].rotation.y = Math.PI / 4;
    g.userData.glow = { color: 0xffb060, power: 0.9, y: 3.2 };
    return g;
  },
  letrero() {
    const g = new THREE.Group(), dw = darkWood();
    g.add(M(box(0.2, 3.4, 0.2), dw, -0.9, 1.7)); g.add(M(box(1.6, 0.15, 0.15), dw, -0.15, 3.3));
    const sign = new THREE.Group(); sign.position.set(0.15, 2.65, 0); g.add(sign);
    [-0.45, 0.45].forEach(x => sign.add(M(cyl(0.015, 0.015, 0.5, 3), iron(), x, 0.4, 0)));
    sign.add(M(box(1.2, 0.8, 0.08), wood(), 0, 0)); sign.add(M(cyl(0.18, 0.15, 0.3, 10), mat(0xc8a03a, { metalness: 0.4 }), 0, 0, 0.08)); // una jarra pintada
    return g;
  },
  basura() {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) { const b = M(new THREE.DodecahedronGeometry(0.25 + R() * 0.25, 0), mat([0x4a3a24, 0x5a5040, 0x3a3428][i % 3]), (R() - 0.5) * 1.4, 0.15, (R() - 0.5) * 1.4); b.scale.y = 0.6; g.add(b); }
    g.add(M(cyl(0.3, 0.3, 0.7, 10), wood(), 0.6, 0.2, -0.3)).children; g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    g.add(M(box(0.7, 0.5, 0.5), mat(0x6a4a2c), -0.6, 0.25, 0.5));
    for (let i = 0; i < 3; i++) g.add(M(new THREE.SphereGeometry(0.08, 6, 4), mat(0xd8cfb8), (R() - 0.5), 0.1, (R() - 0.5)));
    return g;
  }
});
