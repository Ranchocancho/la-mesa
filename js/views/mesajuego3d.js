// La mesa de juego alrededor del tablero (Hito 106): cuatro puestos de jugador y el del máster, como si os
// sentarais de verdad: hojas, lápices y dados, todo plano sobre la mesa para no tapar la vista del tablero.
// Todo decorado (no se pulsa) y siempre igual para la misma mesa.
import * as THREE from "three";

let SHEET = null;
function sheetTex() { // una ficha de personaje: cabecera, recuadros de características y líneas escritas a lápiz
  if (SHEET) return SHEET;
  const c = document.createElement("canvas"); c.width = 256; c.height = 340; const g = c.getContext("2d");
  g.fillStyle = "#efe4c8"; g.fillRect(0, 0, 256, 340);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(120,90,50,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 340, 2, 2); }
  g.strokeStyle = "#5a3a22"; g.lineWidth = 2; g.strokeRect(10, 10, 236, 320);
  g.fillStyle = "#5a3a22"; g.fillRect(18, 18, 220, 26); g.fillStyle = "#efe4c8"; g.font = "bold 15px Georgia"; g.fillText("FICHA DE PERSONAJE", 46, 37);
  for (let i = 0; i < 6; i++) { g.strokeRect(20, 56 + i * 42, 40, 36); g.fillStyle = "#3a2a1a"; g.font = "bold 16px Georgia"; g.fillText(String(8 + Math.floor(Math.random() * 10)), 30, 82 + i * 42); }
  g.strokeStyle = "rgba(60,40,25,.35)"; g.lineWidth = 1;
  for (let y = 62; y < 320; y += 12) { g.beginPath(); g.moveTo(72, y); g.lineTo(236, y); g.stroke(); }
  g.strokeStyle = "rgba(40,40,60,.55)"; g.lineWidth = 1.2; // apuntes a lápiz
  for (let k = 0; k < 14; k++) { const y = 60 + k * 12 + Math.random() * 2; g.beginPath(); g.moveTo(76, y); let x = 76; while (x < 150 + Math.random() * 80) { x += 4 + Math.random() * 6; g.lineTo(x, y + (Math.random() - 0.5) * 3); } g.stroke(); }
  SHEET = new THREE.CanvasTexture(c); SHEET.colorSpace = THREE.SRGBColorSpace; return SHEET;
}
const M = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...x });

function pencil() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 8, 6), M(0xe0b02a)); b.rotation.z = Math.PI / 2; g.add(b);
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.2, 6), M(0xd8b88a)); t.rotation.z = -Math.PI / 2; t.position.x = 4.6; g.add(t);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 6), M(0x222222)); lead.rotation.z = -Math.PI / 2; lead.position.x = 5.3; g.add(lead);
  const e = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8), M(0xd87a8a)); e.rotation.z = Math.PI / 2; e.position.x = -4.4; g.add(e);
  g.position.y = 0.3; return g;
}
const DICE_COL = [0xb02a2a, 0x2a5ab0, 0x2a8a4a, 0x7a3ab0, 0xd6aa4e, 0xe8e0d0];
function die(R) {
  const col = DICE_COL[Math.floor(R() * DICE_COL.length)], kind = Math.floor(R() * 3);
  const geo = kind === 0 ? new THREE.IcosahedronGeometry(1.2, 0) : kind === 1 ? new THREE.BoxGeometry(1.5, 1.5, 1.5) : new THREE.OctahedronGeometry(1.1, 0);
  const m = new THREE.Mesh(geo, M(col, { roughness: 0.35, flatShading: true })); m.position.y = kind === 1 ? 0.75 : 0.95; m.rotation.set(R() * 3, R() * 3, R() * 3); if (kind === 1) m.rotation.set(0, R() * 3, 0);
  return m;
}
function sheet(R) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 12), new THREE.MeshStandardMaterial({ map: sheetTex(), roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = (R() - 0.5) * 0.4; const g = new THREE.Group(); g.position.y = 0.05; g.add(m); return g; // en un grupo: así el giro del puesto la deja tumbada
}

/** Puestos alrededor del tablero: W y H del tablero, y = altura del tablero de la mesa, M = margen de mesa libre. */
export function buildTableDressing({ W, H, y, margin, seed = "mesa" }) {
  let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; s = s || 7;
  const R = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const grp = new THREE.Group(), d = margin * 0.55; // centro del puesto, a media franja del borde
  // [x, z, giro hacia el tablero]
  const seats = [[-W * 0.22, H / 2 + d, Math.PI], [W * 0.22, H / 2 + d, Math.PI], [W / 2 + d, 0, -Math.PI / 2], [-W / 2 - d, 0, Math.PI / 2]];
  const put = (o, x, z, rot) => { o.position.x += x; o.position.z += z; o.position.y += y; o.rotation.y += rot; o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.raycast = () => {}; } }); grp.add(o); };
  const local = (sx, sz, rot, lx, lz) => [sx + Math.cos(rot) * lx + Math.sin(rot) * lz, sz - Math.sin(rot) * lx + Math.cos(rot) * lz];
  seats.forEach(([sx, sz, rot]) => {
    const [a, b] = local(sx, sz, rot, (R() - 0.5) * 3, 0); put(sheet(R), a, b, rot);
    const [c, e] = local(sx, sz, rot, 3 + R() * 2, -1); put(pencil(), c, e, rot + 0.6 + R());
    if (R() < 0.6) { const [f, h] = local(sx, sz, rot, -10 - R() * 2, (R() - 0.5) * 3); const s2 = sheet(R); s2.position.y += 0.02; put(s2, f, h, rot + (R() - 0.5) * 0.6); } // una hoja de apuntes
    const n = 1 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { const [p, q] = local(sx, sz, rot, 8 + R() * 4, (R() - 0.5) * 6); put(die(R), p, q, 0); }
  });
  // El máster, en la cabecera: sus hojas de notas en abanico, su lápiz y sus dados
  const mz = -H / 2 - d;
  [-11, 0, 11].forEach((x, i) => { const sh = sheet(R); sh.position.y += i * 0.02; put(sh, x, mz + (R() - 0.5) * 2, (R() - 0.5) * 0.5); });
  put(pencil(), 6, mz + 4, 0.4);
  for (let i = 0; i < 4; i++) put(die(R), 17 + R() * 5, mz + (R() - 0.5) * 6, 0);
  return grp;
}
