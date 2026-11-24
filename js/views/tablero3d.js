// La mesa en 3D: tablero de casillas de 1,5 m sobre una mesa de madera, escenografía y miniaturas de KayKit (CC0),
// luces de antorcha con parpadeo, fuego con partículas, ambientes de luz y cámara orbital o libre.
// Usa los mismos datos que la vista 2D: { grid: {cols, rows, terrain, props, ambient}, tokens: [...] }.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone as skClone } from "three/addons/utils/SkeletonUtils.js";
import { getImage } from "../core/images.js";
import { TERRAIN, dist } from "./tablero.js";
import { PROPS, isDoor, propVisible } from "../data/mapas.js";
import { pathTo, moveHint } from "../core/movimiento.js";
import { terrainCanvas, heightCanvas, roughCanvas } from "./texturas.js";
import { PROC } from "./props3d.js";
import { siluetaFor, siluetaURL } from "../data/siluetas.js";
import { COND } from "../data/iconos.js";
import { estado, etiqueta } from "../data/estados.js";
import { store } from "../core/store.js";
import { leftOf } from "../core/duraciones.js";
import { computeVision, explored, visionOn, tokenSeen } from "../core/vision.js";
import { fogCanvas } from "./niebla.js";
import { elevAt, altOf, hasElev, dist3, topOfTok } from "../core/alturas.js";
import { chipText, templateCells, templateOk } from "../core/objetivo.js";
import { colors, onColors } from "../core/colores.js";
import { playEffect, EFECTOS } from "./efectos3d.js";
import { sound, AMBIENTES } from "../core/sonido.js";
import { floatText, strike, motes, dust, healMotes } from "./golpes3d.js";
import { makeEnvironment, makeBloom } from "./brillo3d.js";
import { hazardEdges, HAZ_COLOR, coverOf, trapState, TRAP_LOOK } from "../core/marcas.js";
import { enhanceFloor, fringeMaterial, fringeGeometries } from "./suelo3d.js";
import { buildDressing } from "./detalles3d.js";
import { buildAtmosphere, envKindOf, ENV_TEMP, hourTemp, tint, climateZones } from "./atmosfera3d.js";
import { toast } from "../core/ui.js";
import { RES_TEXT, RES_COLOR, cells as cellDist } from "../core/golpes.js";
import { impactOf } from "../core/impactos.js";

const CELL = 4, BASE = "assets/kaykit/";
// Hito 81: preferencias de este navegador (cuadrícula y calidad)
const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* nada */ } };
const GRID = () => pref("lamesa:rejilla3d", "0") === "1", QUAL = () => pref("lamesa:calidad", "alta");
const DENS = () => +pref("lamesa:detalle", "1"); // Hito 85: detalles del suelo 0 sin, 1 normal, 2 muchos
const DENS_TXT = ["Sin detalles en el suelo", "Detalles del suelo: normal", "Detalles del suelo: muchos"];
const YS = 1.7; // unidades de la escena por metro de altura (3 m de risco ≈ algo más que un muro)
const loader = new GLTFLoader();
const cache = new Map();
const load = p => { if (!cache.has(p)) cache.set(p, loader.loadAsync(BASE + p + ".glb").catch(e => { console.warn("No se pudo cargar", p, e); return null; })); return cache.get(p); };

export const MINIS = {
  Knight: "Caballero", Barbarian: "Bárbaro", Mage: "Mago", Rogue: "Pícaro", Rogue_Hooded: "Encapuchado",
  Skeleton_Warrior: "Esqueleto guerrero", Skeleton_Minion: "Esqueleto", Skeleton_Rogue: "Esqueleto pícaro", Skeleton_Mage: "Esqueleto mago", peana: "Peana de cartón"
};
/** Qué miniatura usar. */
export function miniFor(t, ch) {
  // Peana de cartón por defecto para todos; la figura 3D solo si se elige en la ficha (jugadores) o en el editor (enemigos)
  return t.mini || (ch && ch.mini) || "peana";
}

// Escenografía: modelo, escala y si va colgada de la pared
// Escala de cada pieza (Hito 69: a la medida de las figuras: 1 casilla = 1,5 m = 4 unidades; una mesa ≈ 0,75 m de alto,
// un barril ≈ 1 m, una puerta ≈ 2,3 m; antes salían a dos tercios y parecían de juguete)
const PROP3D = {
  mesa: ["dungeon/table_medium", 2], mesalarga: ["dungeon/table_long_decorated_A", 1.6], silla: ["dungeon/chair", 1.9], barril: ["dungeon/barrel_large", 1.45],
  caja: ["dungeon/crates_stacked", 1.45], cofre: ["dungeon/chest", 1.7], columna: ["dungeon/pillar_decorated", 1.6], cama: ["dungeon/bed_decorated", 1.45],
  calavera: ["dungeon/rubble_large", 0.6], tonel: ["dungeon/keg", 1.45], baul: ["dungeon/trunk_large_A", 1.7], escaleras: ["dungeon/stairs", 0.8], rampa: ["dungeon/stairs", 0.8],
  velas: ["dungeon/candle_triple", 2.2], antorcha: ["dungeon/torch_mounted", 2.2, "wall"], estandarte: ["dungeon/banner_red", 1.5, "wall"], puerta: ["dungeon/wall_doorway", 1, "door"],
  puertallave: ["dungeon/wall_doorway", 1, "door"], puertasecreta: ["dungeon/wall_doorway", 1, "door"], rastrillo: ["dungeon/wall_doorway", 1, "door"], puertarunas: ["dungeon/wall_doorway", 1, "door"],
  estanteria: ["dungeon/shelf_large", 1.6]
};
const PROC_BIG = ["altar", "sarcofago", "estatua", "pozo", "brasero", "arbolmuerto", "setas", "cristales", "obsidiana"]; // piezas hechas por código que también se quedaban cortas
const WALL_TALL = 1.6; // muros altos: 6,4 unidades ≈ 2,4 m (antes 1,5 m, más bajos que las figuras)
// Texturas de terreno como materiales 3D (con relieve sacado de la propia imagen); una por tipo
const TEXMAT = new Map(), FRINGE = new Map();
// Hito 89: sombra de contacto (mancha radial suave), compartida por objetos y figuras
let CONTACT = null;
function contactMat() {
  if (CONTACT) return CONTACT;
  const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(0.5, "rgba(0,0,0,.28)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return (CONTACT = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
}
const CONTACT_GEO = (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })();
function contactShadow(size) { const m = new THREE.Mesh(CONTACT_GEO, contactMat()); m.scale.set(size, 1, size); m.position.y = 0.03; m.renderOrder = 1; m.raycast = () => {}; m.userData.keep = true; return m; }
// objetos planos o colgados que no llevan sombra de contacto
const FLATP = new Set(["trampaoculta", "aguja", "dardos", "red", "techo", "foso", "carta", "mapa", "llave", "pasaje", "nota", "interes", "telarana", "nenufares", "flores", "tumbaabierta", "grieta"]);
// piezas naturales: cada copia algo distinta (tamaño, giro, inclinación)
const NATURAL = new Set(["arbol", "arbusto", "roca", "penasco", "tocon", "arbolmuerto", "setas", "cristales", "pinonevado", "manglar", "arbolgigante", "monticulo", "juncos", "raices", "huesos"]);
// terreno → color del polvo al pisar
const DUST = { nieve: "#eef2f6", rocanevada: "#e0e6ee", hielo: "#d8eef8", hielofino: "#d8eef8", barro: "#5a4430", hierba: "#8aa060", hierbalta: "#8aa060", musgo: "#6a8a50", hojarasca: "#b07a3a", arena: "#d8c49a", ceniza: "#6a6664", volcanica: "#5a5250", agua: "#bfe0f0", aguaprof: "#bfe0f0" };
const fringeMat = k => { if (!FRINGE.has(k)) FRINGE.set(k, fringeMaterial(terrainMat(k), k)); return FRINGE.get(k); };
// Hito 82: insignias pequeñas (estado de trampa, cobertura) dibujadas en un lienzo
const BADGE = new Map();
function badgeTex(key, draw) {
  if (BADGE.has(key)) return BADGE.get(key);
  const c = document.createElement("canvas"); c.width = c.height = 96; const g = c.getContext("2d"); draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; BADGE.set(key, t); return t;
}
const trapBadge = st => badgeTex("trap:" + st, g => { const L = TRAP_LOOK[st]; g.fillStyle = L.color; g.beginPath(); g.arc(48, 48, 40, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = "rgba(20,14,10,.85)"; g.stroke(); g.fillStyle = "#1a1410"; g.font = "bold 50px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(L.icon, 48, 52); });
const coverBadge = cv => badgeTex("cov:" + cv, g => {
  const sh = () => { g.beginPath(); g.moveTo(48, 8); g.lineTo(84, 22); g.lineTo(78, 62); g.lineTo(48, 88); g.lineTo(18, 62); g.lineTo(12, 22); g.closePath(); };
  sh(); g.fillStyle = "rgba(20,16,12,.85)"; g.fill(); g.lineWidth = 5; g.strokeStyle = "#e8dfd0"; g.stroke();
  g.save(); sh(); g.clip(); g.fillStyle = "#e8dfd0"; if (cv === "3q") { g.fillRect(0, 0, 48, 96); g.fillRect(48, 48, 48, 48); } else g.fillRect(0, 0, 48, 96); g.restore();
});
function terrainMat(k) {
  if (TEXMAT.has(k)) return TEXMAT.get(k);
  const ty = TERRAIN[k] || TERRAIN.piedra, map = new THREE.CanvasTexture(terrainCanvas(k));
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  // Hito 80: relieve y rugosidad con mapas propios (antes, el relieve salía de la imagen de color)
  const rep = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const bump = rep(new THREE.CanvasTexture(heightCanvas(k))), rough = rep(new THREE.CanvasTexture(roughCanvas(k)));
  const m = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: ty.liquid ? 0.25 : ty.wall ? 0.9 : 1.6, roughness: 1, roughnessMap: rough, metalness: 0,
    ...(ty.liquid && k !== "lava" ? { transparent: true, opacity: 0.9 } : {}), ...(ty.glow ? { emissive: 0xff5a10, emissiveMap: map, emissiveIntensity: 1.1 } : {}) });
  if (!ty.wall) enhanceFloor(m, k); // Hito 84: menos repetición (tono a gran escala y segunda lectura)
  TEXMAT.set(k, m); return m;
}
/** Suelo continuo de un tipo de terreno: un cuadrado por casilla con coordenadas de textura del mundo (sin costuras). */
function floorGeometry(list, cx, cz, y) {
  const pos = [], uv = [], idx = [], h = CELL / 2;
  list.forEach(([c, r], i) => {
    const x = cx(c), z = cz(r);
    [[-h, -h], [h, -h], [h, h], [-h, h]].forEach(([a, b]) => { pos.push(x + a, y, z + b); uv.push((x + a) / (CELL * 2), -(z + b) / (CELL * 2)); });
    const o = i * 4; idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const FLOOR = { piedra: "dungeon/floor_tile_large", madera: "dungeon/floor_wood_large", tierra: "dungeon/floor_dirt_large", barro: "dungeon/floor_dirt_large" };
const FLOOR_TINT = { barro: 0x8a7458 };
const AMBIENT = {
  dia: { n: "Día", hemi: [0xdfeaff, 0x6b5a45, 1.6], sun: [0xfff1dc, 2.6], bg: 0x2b2722, torch: 0.5 },
  interior: { n: "Interior", hemi: [0xffe2c0, 0x3a2c20, 0.55], sun: [0xffc58a, 0.9], bg: 0x17120e, torch: 1 },
  noche: { n: "Noche", hemi: [0x7a8fc8, 0x1a1c26, 0.5], sun: [0x9fb4ff, 0.6], bg: 0x080a10, torch: 1.25 },
  penumbra: { n: "Penumbra", hemi: [0xc8b498, 0x231a12, 0.34], sun: [0xd6a070, 0.45], bg: 0x100c09, torch: 1.15 },
  oscuro: { n: "Oscuridad", hemi: [0x6a6a80, 0x0c0c12, 0.16], sun: [0x8a90b0, 0.12], bg: 0x050507, torch: 1.4 }
};

// ---------- Texturas procedurales (sin descargas) ----------
function noiseTex(base, spread, size = 128, grain = 1) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), col = new THREE.Color(base);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = (Math.random() - 0.5) * spread * grain + Math.sin(i * 0.013) * spread * 0.15;
    img.data[i * 4] = Math.max(0, Math.min(255, col.r * 255 + v * 255));
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, col.g * 255 + v * 255));
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, col.b * 255 + v * 255));
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function woodTex() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const g = c.getContext("2d");
  for (let p = 0; p < 8; p++) {
    const y = p * 64, base = 70 + Math.random() * 20;
    g.fillStyle = `rgb(${base + 40},${base + 10},${base - 25})`; g.fillRect(0, y, 512, 64);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(40,22,10,${0.08 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const yy = y + Math.random() * 64; g.moveTo(0, yy); g.bezierCurveTo(170, yy + Math.random() * 8 - 4, 340, yy + Math.random() * 8 - 4, 512, yy); g.stroke(); }
    g.fillStyle = "rgba(20,10,4,.6)"; g.fillRect(0, y, 512, 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let LEAF = null;
function woodLeaf() {
  if (LEAF) return LEAF;
  const c = document.createElement("canvas"); c.width = 128; c.height = 192;
  const g = c.getContext("2d"); g.fillStyle = "#6b4526"; g.fillRect(0, 0, 128, 192);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? "#5e3b20" : "#734b2a"; g.fillRect(i * 32, 0, 30, 192); }
  g.fillStyle = "#2b2b2b"; g.fillRect(0, 30, 128, 10); g.fillRect(0, 150, 128, 10); g.beginPath(); g.arc(104, 100, 6, 0, 7); g.fill();
  LEAF = new THREE.CanvasTexture(c); LEAF.colorSpace = THREE.SRGBColorSpace; return LEAF;
}
function glowTex() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,240,200,1)"); r.addColorStop(0.3, "rgba(255,160,60,.8)"); r.addColorStop(1, "rgba(255,80,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let GLOW = null;

// ---------- Elementos procedurales ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...extra });
function tree() {
  const g = new THREE.Group(), h = 0.85 + Math.random() * 0.35;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2, 7), mat(0x5a3d22)); trunk.position.y = 1; g.add(trunk);
  const leaf = mat(new THREE.Color().setHSL(0.27 + Math.random() * 0.05, 0.45, 0.22 + Math.random() * 0.06));
  [[1.9, 2.6, 2.2], [1.5, 2.2, 3.4], [1, 1.8, 4.5]].forEach(([r, hh, y]) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 8), leaf); m.position.y = y; g.add(m); });
  g.scale.setScalar(h); g.rotation.y = Math.random() * 6;
  return g;
}
function bush() { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat(0x3f5f2a)); m.scale.set(1.2, 0.7, 1.1); m.position.y = 0.6; m.rotation.y = Math.random() * 6; return m; }
function rock() { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), mat(0x77736c)); m.scale.set(1.1, 0.75 + Math.random() * 0.3, 0.9); m.position.y = 0.55; m.rotation.set(Math.random(), Math.random() * 6, Math.random() * 0.3); return m; }
function trap() {
  const g = new THREE.Group(), plate = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 3), mat(0x3a3530)); plate.position.y = 0.06; g.add(plate);
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 5), mat(0x9a9a9a, { metalness: 0.6, roughness: 0.4 })); s.position.set((i % 3 - 1) * 0.9, 0.45, (Math.floor(i / 3) - 1) * 0.9); g.add(s); }
  return g;
}
function fire(scale = 1) {
  if (!GLOW) GLOW = glowTex();
  const n = 26, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), life = new Float32Array(n);
  for (let i = 0; i < n; i++) life[i] = Math.random();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: GLOW, size: 0.9 * scale, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffa040 }));
  pts.userData.tick = dt => {
    for (let i = 0; i < n; i++) {
      life[i] += dt * (0.9 + (i % 5) * 0.12); if (life[i] > 1) life[i] -= 1;
      const l = life[i], a = i * 2.39996;
      pos[i * 3] = Math.cos(a) * 0.25 * scale * (1 - l); pos[i * 3 + 1] = l * 1.6 * scale; pos[i * 3 + 2] = Math.sin(a) * 0.25 * scale * (1 - l);
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.6, 6), mat(0x4a2e18)); l.rotation.z = Math.PI / 2; l.rotation.y = i * Math.PI / 4; l.position.y = 0.2; g.add(l); }
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), mat(0x666058)); const a = i / 8 * Math.PI * 2; s.position.set(Math.cos(a) * 1, 0.15, Math.sin(a) * 1); g.add(s); }
  const f = fire(1.3); f.position.y = 0.2; g.add(f);
  g.userData.light = { y: 1.2, power: 1.4 };
  return g;
}

// ---------- Etiqueta (nombre y vida) ----------
function labelSprite(text, sub, pct, color) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 84;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(20,15,12,.85)"; g.beginPath(); g.roundRect(2, 2, 252, 80, 12); g.fill();
  g.strokeStyle = color; g.lineWidth = 3; g.stroke();
  g.fillStyle = "#f1e6cc"; g.font = "bold 28px Georgia"; g.textAlign = "center"; g.fillText(text.slice(0, 18), 128, 34);
  if (pct != null) { g.fillStyle = "#2b1512"; g.fillRect(24, 48, 208, 14); g.fillStyle = pct > 0.5 ? "#6f9a3d" : pct > 0.25 ? "#c9a23d" : "#c4513f"; g.fillRect(24, 48, 208 * Math.max(0, pct), 14); }
  if (sub) { g.fillStyle = "#cdbb98"; g.font = "18px Georgia"; g.fillText(sub, 128, pct != null ? 78 : 62); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(3.8, 1.25, 1); s.renderOrder = 10;
  return s;
}

// Barra de vida siempre visible sobre cada figura (exacta para el máster y los personajes; aproximada para los enemigos)
function hpBarSprite(pct, txt, color) {
  const c = document.createElement("canvas"); c.width = 192; c.height = 40; const g = c.getContext("2d");
  g.fillStyle = "rgba(14,10,8,.88)"; g.beginPath(); g.roundRect(2, 4, 188, 32, 10); g.fill();
  g.strokeStyle = color; g.lineWidth = 2.5; g.stroke();
  const w = 176 * Math.max(0, Math.min(1, pct));
  g.fillStyle = "#3a1b16"; g.beginPath(); g.roundRect(8, 10, 176, 20, 6); g.fill();
  if (w > 0) { const gr = g.createLinearGradient(0, 10, 0, 30); const base = pct > 0.5 ? ["#9bd06a", "#4f7d2a"] : pct > 0.25 ? ["#f0c85a", "#a37a1e"] : ["#ff7a62", "#a3291c"]; gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]); g.fillStyle = gr; g.beginPath(); g.roundRect(8, 10, Math.max(8, w), 20, 6); g.fill(); }
  if (txt) { g.font = "bold 19px Georgia"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.85)"; g.strokeText(txt, 96, 21); g.fillStyle = "#fff"; g.fillText(txt, 96, 21); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.9, 0.6, 1); s.renderOrder = 9; return s;
}
// Placa con el nombre y la vida: mismo tamaño en pantalla esté la cámara cerca o lejos, para que siempre se lea
const PLATE_H = 0.05; // alto de la placa (sin perspectiva: × proyección/2 = fracción del alto de la vista)
const TITLES = /^(hermano|hermana|sir|lady|lord|maese|fray|sor|don|doña|capitán|capitana|madre|padre)$/i;
/** Criaturas: sin el paréntesis («Tumulario (señor del mausoleo)» → «Tumulario»); si sigue largo, la primera palabra. */
const plateName = n => { const b = String(n || "?").replace(/\s*\(.*?\)/g, "").trim() || "?"; return b.length > 16 ? b.split(/\s+/)[0] : b; };
/** Nombre corto para la placa: «Brena Martillo-Ceniza» → «Brena», «Hermano Osric» → «Osric». */
const shortName = n => { const w = (n || "?").trim().split(/\s+/); return w.length > 1 && TITLES.test(w[0]) ? w[1] : w[0].length < 3 && w[1] ? w.slice(0, 2).join(" ") : w[0]; };
/** Placa dibujada a la resolución exacta con la que se verá (pxH píxeles de alto): así el texto sale nítido, sin
 *  emborronarse al encogerse. Arriba el nombre; abajo la barra de vida con los PG centrados y grandes. */
// Iconos de estado (los grabados de la barra) para pintarlos en la placa: se cargan una vez y se tiñen de blanco
const GI = {}; let giVer = 0;
function giImg(k) {
  if (GI[k]) return GI[k].c || null;
  GI[k] = {}; const im = new Image();
  im.onload = () => { const c = document.createElement("canvas"); c.width = c.height = 96; const g = c.getContext("2d"); g.drawImage(im, 0, 0, 96, 96); g.globalCompositeOperation = "source-in"; g.fillStyle = "#fff"; g.fillRect(0, 0, 96, 96); GI[k].c = c; giVer++; };
  im.src = `assets/hud/${k}.svg`; return null;
}
// Placa sobre la figura, como en BG3: nombre, vida y debajo los estados en iconos pequeños con los turnos que les quedan
function namePlate(name, pct, txt, color, hl, pxH = 48, conds = []) {
  const list = conds.map(cd => ({ e: estado(cd.id || cd), left: cd.left, lvl: cd.lvl })).filter(x => x.e && x.e.id !== "encima");
  const U = 150, k = pxH / U, Wu = 600, CR = list.length ? 84 : 0;   // se diseña en unidades de 150 de alto y se escala al tamaño real
  const c = document.createElement("canvas"); c.width = Math.round(Wu * k); c.height = Math.round((U + CR) * k);
  const g = c.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0);
  const hasBar = pct != null;
  let fs = hasBar ? 54 : 64; g.font = `700 ${fs}px Georgia, serif`;
  while (g.measureText(name).width > Wu - 80 && fs > 32) { fs -= 2; g.font = `700 ${fs}px Georgia, serif`; }
  const w = Math.min(Wu - 8, Math.max(330, g.measureText(name).width + 70)), x0 = (Wu - w) / 2;
  // Fondo
  g.shadowColor = hl ? color : "rgba(0,0,0,.7)"; g.shadowBlur = hl ? 16 : 10;
  g.fillStyle = "rgba(12,9,7,.94)"; g.beginPath(); g.roundRect(x0, 4, w, U - 8, 24); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = color; g.lineWidth = hl ? 6 : 3.5; g.stroke();
  // Nombre
  g.fillStyle = hl ? "#ffe6a6" : "#fbf3df"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(name, Wu / 2, hasBar ? 46 : U / 2);
  if (hasBar) {
    const bx = x0 + 16, bw = w - 32, by = 80, bh = 56;
    g.fillStyle = "#2a1411"; g.beginPath(); g.roundRect(bx, by, bw, bh, 12); g.fill();
    const fw = bw * Math.max(0, Math.min(1, pct));
    if (fw > 0) { const gr = g.createLinearGradient(0, by, 0, by + bh), base = pct > 0.5 ? ["#8cc45c", "#3f6b22"] : pct > 0.25 ? ["#e8be4c", "#946c16"] : ["#f2694f", "#951f14"]; gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]); g.fillStyle = gr; g.beginPath(); g.roundRect(bx, by, Math.max(14, fw), bh, 12); g.fill(); }
    if (txt) { // PG centrados, en letra de palo y con contorno: se leen sobre cualquier color de la barra
      g.font = "800 44px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
      g.lineJoin = "round"; g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,.9)"; g.strokeText(txt, Wu / 2, by + bh / 2 + 2);
      g.fillStyle = "#fff"; g.fillText(txt, Wu / 2, by + bh / 2 + 2);
    }
  }
  if (list.length) { // fila de estados bajo la placa
    const D = 74, gap = 8, max = 6, shown = list.slice(0, max), n = shown.length + (list.length > max ? 1 : 0), x0i = (Wu - n * D - (n - 1) * gap) / 2, y = U + 6;
    shown.forEach(({ e, left, lvl }, i) => {
      const x = x0i + i * (D + gap);
      g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 6; g.fillStyle = e.c; g.beginPath(); g.roundRect(x, y, D, D, 10); g.fill(); g.shadowBlur = 0;
      g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,.75)"; g.stroke();
      const ic = COND[e.id] && giImg(COND[e.id]);
      if (ic) { g.drawImage(ic, x + 7, y + 7, D - 14, D - 14); } else { g.font = "30px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(e.i || "•", x + D / 2, y + D / 2 + 2); }
      const badge = left != null ? String(left) : lvl > 1 ? String(lvl) : "";
      if (badge) { g.fillStyle = "#111"; g.beginPath(); g.arc(x + D - 6, y + D - 6, 14, 0, Math.PI * 2); g.fill(); g.font = "800 20px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#fff"; g.fillText(badge, x + D - 6, y + D - 5); }
    });
    if (list.length > max) { const x = x0i + max * (D + gap); g.font = "800 28px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 5; g.strokeStyle = "#000"; g.strokeText("+" + (list.length - max), x + D / 2, y + D / 2); g.fillStyle = "#fff"; g.fillText("+" + (list.length - max), x + D / 2, y + D / 2); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; // sin mipmaps: no se emborrona
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
  // Ancla abajo en la fila de la placa (no en la de estados): la placa queda donde estaba y los estados cuelgan debajo, delante de la figura
  s.scale.set(PLATE_H * Wu / U, PLATE_H * (U + CR) / U, 1); s.center.set(0.5, CR / (U + CR)); s.renderOrder = 9; s.userData.base = [s.scale.x, s.scale.y]; return s;
}
function condTag(conds) {
  // Estados como iconos redondos en fila (como BG3 sobre la vida), con los turnos que les quedan
  const list = conds.map(cd => ({ e: estado(cd.id || cd), left: cd.left })).filter(x => x.e && x.e.id !== "encima").slice(0, 6);
  const D = 64, c = document.createElement("canvas"); c.width = Math.max(1, list.length) * (D + 8); c.height = D + 8;
  const g = c.getContext("2d"); g.textAlign = "center"; g.textBaseline = "middle";
  list.forEach(({ e, left }, i) => {
    const x = 4 + i * (D + 8) + D / 2, y = 4 + D / 2;
    g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 8; g.fillStyle = e.c; g.beginPath(); g.arc(x, y, D / 2 - 2, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.lineWidth = 4; g.strokeStyle = "rgba(255,255,255,.85)"; g.stroke();
    g.font = "34px sans-serif"; g.fillStyle = "#fff"; g.fillText(e.i || "•", x, y + 2);
    if (left != null) { g.fillStyle = "#111"; g.beginPath(); g.arc(x + D / 2 - 12, y + D / 2 - 12, 13, 0, Math.PI * 2); g.fill(); g.font = "bold 20px system-ui,sans-serif"; g.fillStyle = "#fff"; g.fillText(String(left), x + D / 2 - 12, y + D / 2 - 11); }
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  const h = 0.9; s.scale.set(h * c.width / c.height, h, 1); s.renderOrder = 11; s.center.set(0.5, 0);
  return s;
}

/**
 * opts: { model(), dm, canMove(t), mutate(label, fn), decorate(t), hpOf(t), onSelect(id), charOf(t), setAmbient(key) }
 */
export function createBoard3D(host, opts) {
  host.classList.add("board", "board3d");
  // Los controles de cámara y ambiente pueden ir fuera del tablero (en la barra superior de la mesa)
  const ctl = opts.controlsHost || host;
  // En la barra superior va la versión compacta: volumen vertical, ⌖ y ⬇ en cuadraditos, Órbita/Libre y Muros.
  // Niebla, música y luz (día/noche/interior) las decide el máster desde su pestaña.
  const camHTML = opts.controlsHost ? `<div class="cam3d compact" role="toolbar" aria-label="Cámara">
      <span class="camsq"><button class="sq" data-cam="center" title="Centrar la cámara en la mesa" aria-label="Centrar">⌖</button><button class="sq" data-cam="top" title="Vista cenital (desde arriba)" aria-label="Cenital">⬇</button><button class="sq" data-cam="ruler" aria-pressed="false" title="Regla: arrastra de una casilla a otra para medir" aria-label="Regla">📏</button><button class="sq" data-cam="mute" title="Silenciar">${sound.muted ? "🔇" : "🔊"}</button></span>
      <span class="volv" title="Volumen"><input type="range" min="0" max="1" step="0.05" value="${sound.volume}" data-vol aria-label="Volumen" orient="vertical"></span>
      <span class="camst"><button class="btn small" data-cam="mode" aria-pressed="false" title="Cámara en órbita (pulsa para libre)">⟳</button><button class="btn small" data-cam="walls" aria-pressed="true" title="Muros bajos (pulsa para altos)">▁</button><button class="btn small" data-cam="grid" aria-pressed="${GRID()}" title="Cuadrícula sobre el suelo">▦</button><button class="btn small" data-cam="dress" aria-pressed="${DENS() > 0}" title="${DENS_TXT[DENS()]} (pulsa para cambiar)">🌿</button><button class="btn small" data-cam="quality" aria-pressed="${QUAL() === "alta"}" title="${QUAL() === "alta" ? "Calidad alta: reflejos y resplandor (pulsa para normal)" : "Calidad normal (pulsa para alta: resplandor del fuego y la magia)"}">✨</button></span>
    </div>` : `<div class="cam3d" role="toolbar" aria-label="Cámara">
      <button class="btn small" data-cam="center" title="Centrar la cámara en la mesa">⌖ Centrar</button>
      <button class="btn small" data-cam="top" title="Vista desde arriba">⬇ Cenital</button>
      <button class="btn small" data-cam="ruler" aria-pressed="false" title="Regla: arrastra de una casilla a otra para medir">📏 Medir</button>
      <button class="btn small" data-cam="mode" aria-pressed="false" title="Órbita alrededor del centro o cámara libre">Órbita</button>
      <button class="btn small" data-cam="walls" aria-pressed="true" title="Muros bajos para ver mejor">Muros bajos</button>
      <button class="btn small" data-cam="grid" aria-pressed="${GRID()}" title="Cuadrícula sobre el suelo">▦ Cuadrícula</button>
      <button class="btn small" data-cam="dress" aria-pressed="${DENS() > 0}" title="${DENS_TXT[DENS()]} (pulsa para cambiar)">🌿 Detalles</button>
      <button class="btn small" data-cam="quality" aria-pressed="${QUAL() === "alta"}" title="Calidad alta: resplandor del fuego, la lava y la magia">✨ ${QUAL() === "alta" ? "Alta" : "Normal"}</button>
      ${opts.dm && opts.setFog ? `<button class="btn small" data-cam="fog" title="Niebla de guerra para los jugadores">Niebla</button>` : ""}
      ${opts.dm && opts.setSound ? `<select class="btn small" data-snd aria-label="Sonido ambiente">${Object.entries(AMBIENTES).map(([k, v]) => `<option value="${k}">🎵 ${v}</option>`).join("")}</select>` : ""}
      <span class="volbox"><button class="btn small" data-cam="mute" title="Silenciar">${sound.muted ? "🔇" : "🔊"}</button><input type="range" min="0" max="1" step="0.05" value="${sound.volume}" data-vol aria-label="Volumen"></span>
      ${opts.dm ? `<select class="btn small" data-amb aria-label="Ambiente">${Object.entries(AMBIENT).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join("")}</select>` : ""}
    </div>`;
  host.innerHTML = `${opts.controlsHost ? "" : camHTML}<div class="dragtip" hidden></div><div class="loading3d">Montando la mesa…</div>`;
  if (opts.controlsHost) opts.controlsHost.innerHTML = camHTML;
  const tip = host.querySelector(".dragtip"), loadingEl = host.querySelector(".loading3d");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const env = makeEnvironment(renderer); let bloom = null, quality = QUAL(), fpsProbe = { n: 0, sum: 0, done: quality !== "alta" };
  let gridObj = null, atmo = null;
  // Hito 87: niebla baja, haces de luz y fondo lejano; se rehace al cambiar de mesa, de luz o de calidad
  function refreshAtmo() {
    if (atmo) { scene.remove(atmo.group); atmo.dispose(); atmo = null; }
    if (!G || !G.cols) return;
    atmo = buildAtmosphere({ g: G, cx, cz, CELL, elevY: (c, r) => elevAt(G, c, r) * YS, isWall: (c, r) => isWallIn(G, c, r), amb: ambient || "interior", high: quality === "alta", seed: G.scene || G.name || "mesa" });
    scene.add(atmo.group);
    if (shroud && atmo.shroud.length) { shroud.push(...atmo.shroud); fogSig = ""; }
  }
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 8; controls.maxDistance = 160;
  controls.enablePan = false;
  const hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
  const world = new THREE.Group(), tokGroup = new THREE.Group(), fx = new THREE.Group(); scene.add(world, tokGroup, fx);
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96), new THREE.MeshBasicMaterial({ color: 0xd6aa4e, transparent: true, opacity: 0.35, depthWrite: false }));
  hl.rotation.x = -Math.PI / 2; hl.position.y = 0.12; hl.visible = false; scene.add(hl);

  let fogPlane = null, shroud = [], pickFloors = [], fogSurf = null;
  let trays = 0, fogGroup = new THREE.Group(), fxList = [], seenFx = new Set(), fxReady = false, pickMode = null, fogSig = "";
  scene.add(fogGroup);
  const pickRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
  pickRing.rotation.x = -Math.PI / 2; pickRing.position.y = 0.2; pickRing.visible = false; scene.add(pickRing);
  let G = null, lastSig = "", build = 0, free = false, lowWalls = true, selected = null, ambient = null, disposed = false;
  const toks = new Map(); // id -> { root, mixer, actions, mini, target, moving, down, label, labelKey }
  const torches = [];
  const clock = new THREE.Clock();
  const ticks = new Set();

  const cx = c => (c - G.cols / 2 + 0.5) * CELL, cz = r => (r - G.rows / 2 + 0.5) * CELL;
  // Alturas: el suelo de cada casilla sube o baja (YS unidades por metro); las figuras que vuelan, un poco más
  const gy = (c, r) => elevAt(G, c, r) * YS, ty = t => gy(t.c, t.r) + (altOf(t) + topOfTok(G, t)) * YS;
  const inside = h => h.c >= 0 && h.r >= 0 && h.c < G.cols && h.r < G.rows;
  const isWall = (c, r) => { const t = (G.terrain || {})[c + "," + r]; return !!(TERRAIN[t] && TERRAIN[t].wall); };

  function frame(view) {
    if (!G) return;
    const span = Math.max(G.cols, G.rows * 1.3) * CELL;
    controls.target.set(0, 0, 0);
    if (view === "top") camera.position.set(0, span * 1.25, 0.01);
    else camera.position.set(0, span * 0.62, span * 0.62);
    controls.update();
  }
  function setFree(on) {
    free = on; controls.enablePan = on; controls.screenSpacePanning = false; controls.zoomToCursor = on;
    if (!on) { const off = camera.position.clone().sub(controls.target); controls.target.set(0, 0, 0); camera.position.copy(off); }
    const b = ctl.querySelector('[data-cam="mode"]'); b.textContent = on ? "✥" : "⟳"; b.title = on ? "Cámara libre (pulsa para órbita)" : "Cámara en órbita (pulsa para libre)"; b.setAttribute("aria-pressed", on);
  }
  ctl.querySelectorAll("[data-cam]").forEach(b => b.onclick = () => {
    const k = b.dataset.cam;
    if (k === "center") { setFree(false); frame("persp"); }
    if (k === "top") frame("top");
    if (k === "mode") setFree(!free);
    if (k === "fog") { opts.setFog(!visionOn(G)); return; }
    if (k === "ruler") { measuring = !measuring; b.setAttribute("aria-pressed", measuring); renderer.domElement.style.cursor = measuring ? "crosshair" : ""; if (!measuring) drawRuler(null); return; }
    if (k === "mute") { sound.setMuted(!sound.muted); b.textContent = sound.muted ? "🔇" : "🔊"; return; }
    if (k === "grid") { const on = !GRID(); setPref("lamesa:rejilla3d", on ? "1" : "0"); b.setAttribute("aria-pressed", on); if (gridObj) gridObj.visible = on; return; }
    if (k === "dress") { const d = (DENS() + 1) % 3; setPref("lamesa:detalle", String(d)); ctl.querySelectorAll('[data-cam="dress"]').forEach(x => { x.setAttribute("aria-pressed", d > 0); x.title = DENS_TXT[d] + " (pulsa para cambiar)"; }); toast("🌿 " + DENS_TXT[d]); lastSig = ""; sync(); return; }
    if (k === "quality") { setQuality(quality === "alta" ? "normal" : "alta", true); return; }
    if (k === "walls") { lowWalls = !lowWalls; b.textContent = lowWalls ? "▁" : "▇"; b.title = lowWalls ? "Muros bajos (pulsa para altos)" : "Muros altos (pulsa para bajos)"; b.setAttribute("aria-pressed", lowWalls); lastSig = ""; sync(); }
  });
  const amb = ctl.querySelector("[data-amb]");
  if (amb) amb.onchange = () => opts.setAmbient && opts.setAmbient(amb.value);
  const snd = ctl.querySelector("[data-snd]"); if (snd) snd.onchange = () => opts.setSound(snd.value);
  ctl.querySelector("[data-vol]").oninput = e => sound.setVolume(+e.target.value);
  // Cámara libre: flechas o WASD mueven el punto de mira por la mesa
  const keys = new Set();
  const kd = e => { if (free && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) keys.add(e.key.toLowerCase()); }, ku = e => keys.delete(e.key.toLowerCase());
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);

  // Motas de ambiente (polvo, luciérnagas, polen): se rehacen al cambiar la luz o el tamaño de la mesa
  let moteFx = null, moteKey = "";
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function setMotes() {
    if (!G || calm) return;
    const zones = climateZones(G, cx, cz, CELL, PROPS);
    const k = [ambient, G.cols, G.rows, zones.length, zones.slice(0, 5).map(z => z.x + ":" + z.z).join(",")].join("|"); if (k === moteKey) return; moteKey = k;
    if (moteFx) { ticks.delete(moteFx.step); moteFx.dispose(); }
    moteFx = motes(scene, G.cols * CELL, G.rows * CELL, ambient, zones); ticks.add(moteFx.step);
  }
  function setQuality(q, byHand) {
    quality = q; setPref("lamesa:calidad", q); fpsProbe = { n: 0, sum: 0, done: !!byHand || q !== "alta" };
    if (q !== "alta" && bloom) { bloom.dispose(); bloom = null; }
    refreshAtmo();
    ctl.querySelectorAll('[data-cam="quality"]').forEach(b => { b.setAttribute("aria-pressed", q === "alta"); if (b.textContent.includes("Alta") || b.textContent.includes("Normal")) b.textContent = "✨ " + (q === "alta" ? "Alta" : "Normal"); b.title = q === "alta" ? "Calidad alta: reflejos y resplandor (pulsa para normal)" : "Calidad normal (pulsa para alta: resplandor del fuego y la magia)"; });
  }
  const EXPO = { dia: 1.05, interior: 1.0, noche: 0.96, penumbra: 0.98, oscuro: 0.93 };
  const BLOOM_K = { dia: 0.26, interior: 0.38, noche: 0.5, penumbra: 0.46, oscuro: 0.55 };
  let ambKey = "";
  function applyAmbient(k) {
    const a = AMBIENT[k] || AMBIENT.interior;
    // Hito 89: el tono depende también del entorno (volcán cálido, cueva o nieve fríos…) y de la hora del reloj de campaña
    const kind = G ? envKindOf(G) : "interior", clock = (store.get() || {}).clock, hour = clock ? Math.floor(clock.min / 30) : -1;
    const temp = (ENV_TEMP[kind] || 0) + (k === "dia" || k === "penumbra" || k === "noche" ? hourTemp(clock ? clock.min : null) : 0);
    const key = [k, kind, hour].join("|"); if (ambient === k && key === ambKey) return; ambient = k; ambKey = key;
    hemi.color.copy(tint(a.hemi[0], temp * 0.6)); hemi.groundColor.copy(tint(a.hemi[1], temp * 0.5)); hemi.intensity = a.hemi[2];
    sun.color.copy(tint(a.sun[0], temp * 0.75)); sun.intensity = a.sun[1];
    renderer.toneMappingExposure = EXPO[k] ?? 1.05;
    if (bloom && bloom.setStrength) bloom.setStrength(BLOOM_K[k] ?? 0.38);
    const bg = tint(a.bg, temp * 0.4);
    scene.background = bg; scene.fog = new THREE.Fog(bg, 90, 260);
    scene.environment = env.get(k, a.hemi[0], a.hemi[1], a.sun[0]); // Hito 81: reflejos según la luz
    if (G) refreshAtmo();
    torches.forEach(t => (t.base = t.power * 34 * a.torch));
    if (amb) amb.value = k;
  }

  // ---------- Construir el escenario ----------
  let worldTicks = new Set(); // animaciones del escenario actual (se tiran al reconstruirlo)
  async function buildWorld(g) {
    const my = ++build;
    const grp = new THREE.Group(), newTorches = [], ticks = new Set(); // estas «ticks» son las del escenario nuevo
    const W = g.cols * CELL, H = g.rows * CELL;
    // Mesa de madera y marco del tablero
    const wood = woodTex(); wood.repeat.set(3, 3);
    const table = new THREE.Mesh(new THREE.BoxGeometry(W + CELL * 8, 2.5, H + CELL * 8), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7 }));
    // La mesa queda por debajo del lecho del agua y del fondo del abismo (si no, los tapaba)
    table.position.y = -3.6; table.receiveShadow = true; grp.add(table);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.6 });
    [[W + 1.6, 0.8, 0, -(H + 0.8) / 2], [W + 1.6, 0.8, 0, (H + 0.8) / 2], [0.8, H, -(W + 0.8) / 2, 0], [0.8, H, (W + 0.8) / 2, 0]].forEach(([w, d, x, z]) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w, 3.3, d), frameMat); f.position.set(x, -1.7, z); f.receiveShadow = true; grp.add(f); });
    // Suelos: un trozo continuo por tipo de terreno, con su textura y relieve
    const cells = {};
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      const t = (g.terrain || {})[c + "," + r] || "piedra";
      if (TERRAIN[t] && TERRAIN[t].wall) continue;
      const e = elevAt(g, c, r); (cells[t + "|" + e] = cells[t + "|" + e] || []).push([c, r]);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const floorsPick = [], gridPts = [];
    for (const [tk, list] of Object.entries(cells)) {
      const [t, es] = tk.split("|"), e0 = +es * YS;
      const ty = TERRAIN[t] || TERRAIN.piedra, y = e0 + (t === "abismo" ? -1.6 : ty.liquid ? -0.18 : 0.01);
      if (t !== "abismo") { const gyv = y + (ty.liquid ? 0.1 : 0.05), h = CELL / 2; list.forEach(([c, r]) => { const X = cx(c), Z = cz(r); gridPts.push(X - h, gyv, Z - h, X + h, gyv, Z - h, X - h, gyv, Z - h, X - h, gyv, Z + h, X + h, gyv, Z - h, X + h, gyv, Z + h, X - h, gyv, Z + h, X + h, gyv, Z + h); }); }
      const mesh = new THREE.Mesh(floorGeometry(list, cx, cz, y), terrainMat(t)); mesh.receiveShadow = true; grp.add(mesh); floorsPick.push(mesh);
      if (ty.liquid || t === "abismo") { // lecho y orillas debajo del agua, la lava o el abismo
        const bed = new THREE.Mesh(floorGeometry(list, cx, cz, y - 0.5), new THREE.MeshStandardMaterial({ color: t === "lava" ? 0x1a0804 : 0x1a2a2a, roughness: 1 })); grp.add(bed);
      }
      if (ty.liquid) { const tex = mesh.material.map; ticks.add(dt => { tex.offset.x += dt * (t === "lava" ? 0.006 : 0.018); tex.offset.y += dt * (t === "lava" ? 0.004 : 0.011); }); }
      if (t === "lava") { const mm = mesh.material; let k = 0; ticks.add(dt => { k += dt; mm.emissiveIntensity = 0.95 + Math.sin(k * 1.7) * 0.25; }); }
      if (t === "brasas") { const mm = mesh.material; let k = Math.random() * 5; ticks.add(dt => { k += dt; mm.emissiveIntensity = 0.9 + Math.sin(k * 2.3) * 0.2 + Math.sin(k * 5.1) * 0.08; }); }
      // Hito 81: segunda capa que se mueve en otra dirección, para que el agua y la lava tengan fondo
      if (ty.liquid) {
        const tex2 = terrainMat(t).map.clone(); tex2.needsUpdate = true; tex2.repeat.set(0.62, 0.62);
        const lay = new THREE.Mesh(floorGeometry(list, cx, cz, y + 0.04), new THREE.MeshBasicMaterial({ map: tex2, color: t === "lava" ? 0xffa060 : 0x9fd8ff, transparent: true, opacity: t === "lava" ? 0.28 : 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
        lay.raycast = () => {}; grp.add(lay);
        let k = 0; ticks.add(dt => { k += dt; tex2.offset.x -= dt * (t === "lava" ? 0.004 : 0.012); tex2.offset.y += dt * (t === "lava" ? 0.007 : 0.02); lay.material.opacity = (t === "lava" ? 0.28 : 0.16) * (0.8 + Math.sin(k * 0.9) * 0.2); });
      }
    }
    // Desniveles: paredes de roca entre casillas de distinta altura (riscos, tarimas, fosos)
    const cliffEdges = []; // Hito 83: para rematar los desniveles (borde de piedra arriba y sombra abajo)
    if (hasElev(g)) {
      const pos = [], uv = [], h = CELL / 2, low = (c, r) => (c < 0 || r < 0 || c >= g.cols || r >= g.rows) ? Math.min(0, minE) : elevAt(g, c, r);
      let minE = 0; for (const v of Object.values(g.elev)) minE = Math.min(minE, +v || 0);
      for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        if (isWallIn(g, c, r)) continue;
        const e = elevAt(g, c, r);
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dc, dr]) => {
          const nc = c + dc, nr = r + dr, out = nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows;
          if (!out && isWallIn(g, nc, nr) && elevAt(g, nc, nr) >= e) return;
          const n = out ? Math.min(0, minE) : low(nc, nr); if (n >= e) return;
          const y1 = e * YS + 0.01, y0 = n * YS - (out ? 0.4 : 0.02), x = cx(c), z = cz(r);
          // arista compartida, vista desde la casilla vecina (la más baja)
          const A = dc === 0 ? [x - h, z + dr * h] : [x + dc * h, z - h], B = dc === 0 ? [x + h, z + dr * h] : [x + dc * h, z + h];
          const [P, Q] = (dr === -1 || dc === 1) ? [A, B] : [B, A];
          cliffEdges.push({ c, r, dc, dr, top: y1, low: y0, out, nc, nr });
          const L = CELL / 4;
          pos.push(P[0], y0, P[1], Q[0], y0, Q[1], Q[0], y1, Q[1], P[0], y0, P[1], Q[0], y1, Q[1], P[0], y1, P[1]);
          const u0 = (P[0] + P[1]) / L, u1 = (Q[0] + Q[1]) / L, v0 = y0 / L, v1 = y1 / L;
          uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
        });
      }
      if (pos.length) {
        const cg = new THREE.BufferGeometry(); cg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); cg.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); cg.computeVertexNormals();
        const base = terrainMat("muroroca"), cm = new THREE.MeshStandardMaterial({ map: base.map, bumpMap: base.bumpMap || null, bumpScale: 0.6, color: 0xcbb9a0, emissive: 0x241c14, roughness: 1, metalness: 0, side: THREE.DoubleSide });
        const cliff = new THREE.Mesh(cg, cm); cliff.castShadow = cliff.receiveShadow = true; grp.add(cliff);
      }
    }
    // Muros: bloque de piedra y caras de muro de KayKit hacia las casillas transitables
    const wallGl = await load("dungeon/wall"); if (my !== build) return;
    let wallMesh = null; wallGl && wallGl.scene.traverse(o => { if (o.isMesh && !wallMesh) wallMesh = o; });
    const wh = lowWalls ? 0.36 : WALL_TALL, faces = [], blocks = [];
    // Hito 86: cada tramo de muro con su tono (algo más claro, oscuro, cálido o frío), siempre igual para la misma casilla
    const wallTint = (c, r) => { const h = Math.abs(Math.sin(c * 12.9898 + r * 78.233) * 43758.5453) % 1, h2 = Math.abs(Math.sin(c * 39.3468 + r * 11.135) * 24634.6345) % 1; const k = 0.86 + h * 0.2; return new THREE.Color(k * (0.97 + h2 * 0.06), k, k * (1.03 - h2 * 0.06)); };
    const shroudable = []; // piezas que se esconden mientras su casilla no se haya visto nunca (niebla)
    const byType = {};
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      if (!isWallIn(g, c, r)) continue;
      const wt = (g.terrain || {})[c + "," + r];
      // El vacío no se dibuja salvo que toque suelo (entonces se ve como roca)
      const touches = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([a, b]) => { const n = (g.terrain || {})[(c + a) + "," + (r + b)]; return c + a >= 0 && r + b >= 0 && c + a < g.cols && r + b < g.rows && !(TERRAIN[n] && TERRAIN[n].wall); });
      if (TERRAIN[wt].void && !touches) continue;
      const kind = TERRAIN[wt].void ? "muroroca" : wt;
      (byType[kind] = byType[kind] || []).push([c, r]);
      if (kind !== "muro") continue;
      [[0, -1, 0], [1, 0, -Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI / 2]].forEach(([dc, dr, rot]) => {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows || isWallIn(g, nc, nr)) return;
        faces.push([cx(c) + dc * (CELL / 2 - 0.5), cz(r) + dr * (CELL / 2 - 0.5), rot, nc, nr, elevAt(g, c, r) * YS]);
      });
    }
    for (const [kind, list] of Object.entries(byType)) {
      const hgt = (kind === "seto" ? 2.6 : 4) * wh, mt = terrainMat(kind).clone(); mt.map = mt.map.clone(); mt.map.repeat.set(2, hgt / 2); mt.map.needsUpdate = true;
      mt.roughness = 1; mt.metalness = 0; mt.bumpScale = 0.5;
      const top = new THREE.MeshStandardMaterial({ color: kind === "seto" ? 0x2e4a22 : 0x2a2622, roughness: 1 });
      const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, hgt, CELL), [mt, mt, top, top, mt, mt], list.length);
      list.forEach(([c, r], i) => { bm.setMatrixAt(i, m4.compose(v.set(cx(c), hgt / 2 + elevAt(g, c, r) * YS, cz(r)), q.identity(), one)); shroudable.push({ im: bm, i, c, r, m: m4.clone() }); bm.setColorAt(i, wallTint(c, r)); });
      bm.castShadow = bm.receiveShadow = true; grp.add(bm);
    }
    if (faces.length && wallMesh) {
      // Las caras de muro de KayKit traen algo de brillo: se dejan mates para que la luz no «resbale» por ellas
      const wmat = (Array.isArray(wallMesh.material) ? wallMesh.material : [wallMesh.material]).map(x => { const c = x.clone(); if ("roughness" in c) c.roughness = 1; if ("metalness" in c) c.metalness = 0; return c; });
      const fm = new THREE.InstancedMesh(wallMesh.geometry, wmat.length === 1 ? wmat[0] : wmat, faces.length);
      const sc = new THREE.Vector3(1, wh, 1);
      faces.forEach(([x, z, rot, nc, nr, fy], i) => { fm.setMatrixAt(i, m4.compose(v.set(x, fy, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), sc)); shroudable.push({ im: fm, i, c: nc, r: nr, m: m4.clone() }); fm.setColorAt(i, wallTint(nc * 3 + x, nr * 5 + z)); });
      fm.castShadow = fm.receiveShadow = true; grp.add(fm);
    }
    // Hito 86: columnas en las esquinas y en los extremos de los muros de piedra, y algún remate roto encima
    {
      const STONE = new Set(["muro", "muroladrillo", "murorunas", "muralla"]);
      const doorAt = new Set((g.props || []).filter(p => (PROPS[p.k] || {}).door).map(p => p.c + "," + p.r));
      const V = new Map(), tops = [], plinths = [];
      const hash = (a, b) => Math.abs(Math.sin(a * 91.17 + b * 47.31) * 15731.743) % 1;
      for (const [kind, list] of Object.entries(byType)) {
        if (!STONE.has(kind)) continue;
        list.forEach(([c, r]) => [[0, -1, "h", [c, r], [c + 1, r]], [1, 0, "v", [c + 1, r], [c + 1, r + 1]], [0, 1, "h", [c, r + 1], [c + 1, r + 1]], [-1, 0, "v", [c, r], [c, r + 1]]].forEach(([dc, dr, o, A, B]) => {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows || isWallIn(g, nc, nr) || doorAt.has(nc + "," + nr)) return;
          [A, B].forEach(P => { const k = P.join(","); const e = V.get(k) || { h: 0, v: 0, c: nc, r: nr, y: elevAt(g, c, r) * YS }; e[o]++; V.set(k, e); });
          plinths.push({ x: cx(c) + dc * (CELL / 2 + 0.05), z: cz(r) + dr * (CELL / 2 + 0.05), y: elevAt(g, nc, nr) * YS, rot: dc ? Math.PI / 2 : 0, c: nc, r: nr });
          if (hash(c + dc * 0.3, r + dr * 0.3) < 0.16) tops.push({ c, r, dc, dr, nc, nr, y: elevAt(g, c, r) * YS });
        }));
      }
      const colGl = await load("dungeon/column"); if (my !== build) return;
      let colMesh = null; colGl && colGl.scene.traverse(o => { if (o.isMesh && !colMesh) colMesh = o; });
      const pts = [...V.entries()].filter(([, e]) => (e.h && e.v) || e.h + e.v === 1);
      if (colMesh && pts.length) {
        const hgt = 4 * wh + 0.35, cm = (Array.isArray(colMesh.material) ? colMesh.material[0] : colMesh.material).clone(); cm.roughness = 1; cm.metalness = 0;
        const im = new THREE.InstancedMesh(colMesh.geometry, cm, pts.length), sc = new THREE.Vector3(1.7, hgt / 1.4, 1.7);
        pts.forEach(([k, e], i) => { const [vx, vy] = k.split(",").map(Number); im.setMatrixAt(i, m4.compose(v.set((vx - g.cols / 2) * CELL, e.y, (vy - g.rows / 2) * CELL), q.identity(), sc)); shroudable.push({ im, i, c: e.c, r: e.r, m: m4.clone() }); });
        im.castShadow = im.receiveShadow = true; im.raycast = () => {}; grp.add(im);
      }
      // Hito 89: zócalo al pie de los muros altos
      if (plinths.length && wh > 1) {
        const zm = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.45, 0.3), new THREE.MeshStandardMaterial({ color: 0x5a554e, roughness: 1, flatShading: true }), plinths.length);
        plinths.forEach((P, i) => { zm.setMatrixAt(i, m4.compose(v.set(P.x, P.y + 0.22, P.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), P.rot), one)); shroudable.push({ im: zm, i, c: P.c, r: P.r, m: m4.clone() }); });
        zm.castShadow = false; zm.receiveShadow = true; zm.raycast = () => {}; grp.add(zm);
      }
      if (tops.length) {
        const bits = []; tops.forEach(T => { const n = 2 + Math.floor(hash(T.c, T.r) * 3); for (let i = 0; i < n; i++) { const u = (hash(T.c + i, T.r - i) - 0.5) * (CELL - 0.8), w = 0.4 + hash(i, T.c) * 0.5; bits.push({ x: cx(T.c) + (T.dr ? u : T.dc * (CELL / 2 - 0.5)), z: cz(T.r) + (T.dc ? u : T.dr * (CELL / 2 - 0.5)), y: T.y + 4 * wh + 0.15, s: w, rot: hash(i, T.r) * 3, c: T.nc, r: T.nr }); } });
        const bm2 = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x8a847a, roughness: 1, flatShading: true }), bits.length);
        bits.forEach((B, i) => { bm2.setMatrixAt(i, m4.compose(v.set(B.x, B.y, B.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), B.rot), new THREE.Vector3(B.s, B.s * 0.8, B.s))); shroudable.push({ im: bm2, i, c: B.c, r: B.r, m: m4.clone() }); });
        bm2.castShadow = bm2.receiveShadow = true; bm2.raycast = () => {}; grp.add(bm2);
      }
    }
    // Hito 83: remates. Un borde de piedra clara en lo alto de cada desnivel y de cada muro que da a suelo
    // (las salas y las tarimas se leen desde cualquier ángulo) y una sombra suave al pie (asienta muros y riscos).
    {
      const lips = [], aos = [], hh = CELL / 2;
      cliffEdges.forEach(e => {
        lips.push({ x: cx(e.c) + e.dc * (hh - 0.12), z: cz(e.r) + e.dr * (hh - 0.12), y: e.top + 0.05, dc: e.dc, dr: e.dr, c: e.c, r: e.r });
        if (!e.out) aos.push({ x: cx(e.c) + e.dc * (hh + 0.45), z: cz(e.r) + e.dr * (hh + 0.45), y: e.low + 0.04, dc: e.dc, dr: e.dr, c: e.nc, r: e.nr });
      });
      for (const [kind, list] of Object.entries(byType)) {
        if (kind === "seto") continue;
        const hgt = 4 * wh;
        list.forEach(([c, r]) => [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dc, dr]) => {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows || isWallIn(g, nc, nr)) return;
          const base = elevAt(g, c, r) * YS, fl = elevAt(g, nc, nr) * YS;
          lips.push({ x: cx(c) + dc * (hh - 0.12), z: cz(r) + dr * (hh - 0.12), y: base + hgt + 0.05, dc, dr, c: nc, r: nr });
          aos.push({ x: cx(c) + dc * (hh + 0.45), z: cz(r) + dr * (hh + 0.45), y: fl + 0.04, dc, dr, c: nc, r: nr });
        }));
      }
      const Y = new THREE.Vector3(0, 1, 0);
      if (lips.length) {
        const lm = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL + 0.02, 0.12, 0.26), new THREE.MeshStandardMaterial({ color: 0xcfc2a8, roughness: 0.85, emissive: 0x2a2218 }), lips.length);
        lips.forEach((L, i) => { lm.setMatrixAt(i, m4.compose(v.set(L.x, L.y, L.z), q.setFromAxisAngle(Y, L.dc ? Math.PI / 2 : 0), one)); shroudable.push({ im: lm, i, c: L.c, r: L.r, m: m4.clone() }); });
        lm.castShadow = false; lm.receiveShadow = true; lm.raycast = () => {}; grp.add(lm);
      }
      if (aos.length) {
        const gc = document.createElement("canvas"); gc.width = 4; gc.height = 64; const gx = gc.getContext("2d"), gr = gx.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, "#fff"); gr.addColorStop(0.35, "#777"); gr.addColorStop(1, "#000"); gx.fillStyle = gr; gx.fillRect(0, 0, 4, 64);
        const pg = new THREE.PlaneGeometry(CELL, 0.9); pg.rotateX(-Math.PI / 2);
        const am = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, alphaMap: new THREE.CanvasTexture(gc), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), aos.length);
        aos.forEach((A, i) => { am.setMatrixAt(i, m4.compose(v.set(A.x, A.y, A.z), q.setFromAxisAngle(Y, Math.atan2(A.dc, A.dr)), one)); });
        am.raycast = () => {}; am.renderOrder = 1; grp.add(am);
      }
    }
    // Escenografía
    for (const p of g.props || []) { try {
      if (!propVisible(p, opts.dm)) continue;
      const x = cx(p.c), z = cz(p.r);
      let obj = null;
      if (p.k === "arbol") obj = tree(); else if (p.k === "arbusto") obj = bush(); else if (p.k === "roca") obj = rock(); else if (p.k === "trampa") obj = trap();
      else if (p.k === "hoguera") obj = campfire();
      else if (PROC[p.k]) { obj = PROC[p.k](fire); if (!["telarana"].includes(p.k)) obj.rotation.y = (p.rot || 0) * Math.PI / 2; if (PROC_BIG.includes(p.k)) obj.scale.multiplyScalar(1.35); }
      else if (PROP3D[p.k]) {
        let [path, scale, how] = PROP3D[p.k];
        // Hito 86: variedad (algunas cajas son el cajón grande) y antorcha de pie cuando no hay pared cerca
        if (p.k === "caja" && (p.c * 7 + p.r * 13) % 3 === 0) { path = "dungeon/box_large"; scale = 1.3; }
        const standing = p.k === "antorcha" && ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dc, dr]) => isWallIn(g, p.c + dc, p.r + dr));
        if (standing) { path = "dungeon/torch_lit"; scale = 2; how = null; }
        const gl = await load(path); if (my !== build) return;
        if (!gl) continue;
        obj = gl.scene.clone(true); obj.scale.setScalar(scale);
        if (standing) {
          // pie de hierro de tres patas con la antorcha arriba
          const st = new THREE.Group(), iron = new THREE.MeshStandardMaterial({ color: 0x2e2a26, metalness: 0.6, roughness: 0.5 });
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6), iron); pole.position.y = 1.2; st.add(pole);
          [0, 1, 2].forEach(i => { const a = i / 3 * Math.PI * 2, l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 5), iron); l.position.set(Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3); l.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); st.add(l); });
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, 0.25, 8), iron); cup.position.y = 2.45; st.add(cup);
          obj.position.y = 2.4 + 0.8; st.add(obj); obj = st; obj.userData.firePos = new THREE.Vector3(0, 2.4 + 0.8 + 1.4, 0);
        }
        if (how === "wall") {
          // Se cuelga en la pared más cercana, mirando hacia la casilla
          const dirs = [[0, -1, 0], [1, 0, -Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI / 2]].filter(([dc, dr]) => isWallIn(g, p.c + dc, p.r + dr));
          const [dc, dr, rot] = dirs[0] || [0, -1, 0];
          obj.rotation.y = rot; obj.position.set(dc * (CELL / 2 - 0.05), p.k === "antorcha" ? 2.2 * wh + 0.6 : 0.2, dr * (CELL / 2 - 0.05));
          if (!dirs.length) obj.position.y = 0.6;
        } else if (how === "door") {
          obj.rotation.y = isWallIn(g, p.c - 1, p.r) || isWallIn(g, p.c + 1, p.r) ? 0 : Math.PI / 2;
          obj.scale.set(1, WALL_TALL, 1); // la puerta conserva su tamaño aunque los muros se vean bajos
          // Hoja de madera: cerrada tapa el hueco; abierta, girada contra el marco
          const lh = 3.1 * WALL_TALL;
          const leaf = p.k === "rastrillo" ? (() => { const bars = new THREE.Group(), iron = new THREE.MeshStandardMaterial({ color: 0x2e2c2a, metalness: 0.7, roughness: 0.45 }); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, lh, 6), iron); b.position.set(-0.95 + i * 0.38, 0, 0); bars.add(b); } [-0.3, 0.3].forEach(y => { const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.08), iron); b.position.set(0, y * lh, 0); bars.add(b); }); return bars; })()
            : new THREE.Mesh(new THREE.BoxGeometry(2.2, lh, 0.22), p.k === "puertasecreta" ? terrainMat("muro") : p.k === "puertarunas" ? terrainMat("murorunas") : new THREE.MeshStandardMaterial({ map: woodLeaf(), roughness: 0.8, ...(p.k === "puertallave" ? { color: 0xc8b0a0 } : {}) }));
          const hinge = new THREE.Group(); hinge.position.set(-1.1, 0, 0); leaf.position.set(1.1, lh / 2, 0); hinge.add(leaf);
          hinge.rotation.y = p.open ? -Math.PI / 2 * 0.92 : 0;
          obj.add(hinge);
          obj.traverse(o => { o.userData.door = p.id; });
        } else obj.rotation.y = (p.rot != null ? p.rot : (p.c * 3 + p.r * 5) % 4) * Math.PI / 2;
        if (p.k === "antorcha" || p.k === "velas") {
          const f = fire(p.k === "velas" ? 0.35 : 0.55);
          const wrap = new THREE.Group(); wrap.add(obj);
          obj.updateMatrix();
          const fpos = obj.userData.firePos ? obj.userData.firePos.clone() : (p.k === "velas" ? new THREE.Vector3(0.05, 0.95, 0.03) : new THREE.Vector3(0, 0.78, 0.42)).applyMatrix4(obj.matrix);
          f.position.copy(fpos); wrap.add(f);
          wrap.userData.light = { y: fpos.y + 0.4, dx: fpos.x, dz: fpos.z, power: p.k === "velas" ? 0.5 : 1 };
          obj = wrap;
        }
      }
      if (!obj) continue;
      const py = elevAt(g, p.c, p.r) * YS;
      const w = new THREE.Group(); w.add(obj); w.position.set(x, py, z);
      const ghostly = opts.dm && !propVisible(p, false); // oculto a los jugadores: el máster lo ve translúcido
      w.traverse(o => { o.userData.prop = p.id; if (o.isMesh) { o.castShadow = !ghostly; o.receiveShadow = true; if (ghostly) { o.material = (Array.isArray(o.material) ? o.material : [o.material]).map(mm => { const c = mm.clone(); c.transparent = true; c.opacity = 0.42; return c; }); if (o.material.length === 1) o.material = o.material[0]; } if (o.userData.spin) ticks.add(dt => { o.rotation.y += dt * 1.2; }); } if (o.isPoints) ticks.add(o.userData.tick); });
      // Hito 81: los objetos con luz en el catálogo (forja, farolillos, gran hoguera…) alumbran con su radio; parpadean como las antorchas
      const catL = (PROPS[p.k] || {}).light;
      if (obj.userData.glow || catL) {
        const G0 = obj.userData.glow || { color: 0xffa050, power: 1, y: 1.6 }, dist = catL ? catL * CELL * 1.1 : 9, pw = catL ? 10 + catL * 4 : 14 * G0.power;
        const pl = new THREE.PointLight(G0.color, pw, dist, 1.6); pl.position.set(x, G0.y + py, z); grp.add(pl);
        if (catL && !ghostly) newTorches.push({ light: pl, power: pw / 34, base: pw, seed: Math.random() * 10 });
      }
      const L = obj.userData.light;
      if (L) {
        const light = new THREE.PointLight(0xff9a4a, 30, 22, 1.6);
        light.position.set(x + (L.dx || 0), L.y + py, z + (L.dz || 0));
        grp.add(light); newTorches.push({ light, power: L.power, base: 34 * L.power, seed: Math.random() * 10 });
      }
      // Hito 89: variación en piezas naturales y sombra de contacto bajo los objetos que se apoyan en el suelo
      if (NATURAL.has(p.k)) { const h = (a, b) => Math.abs(Math.sin(p.c * a + p.r * b) * 43758.5453) % 1; const k = 0.85 + h(12.9, 78.2) * 0.3; obj.scale.multiplyScalar(k); obj.rotation.y += h(39.3, 11.1) * Math.PI * 2; obj.rotation.x += (h(7.1, 3.3) - 0.5) * 0.12; obj.rotation.z += (h(5.7, 9.9) - 0.5) * 0.12; }
      { const pv = PROPS[p.k] || {}; if (!pv.door && !FLATP.has(p.k) && !(PROP3D[p.k] && PROP3D[p.k][2] === "wall") && !ghostly) w.add(contactShadow(CELL * (PROC_BIG.includes(p.k) || pv.block ? 0.95 : 0.62))); }
      // Hito 82: estado de la trampa (anillo + insignia) y cobertura (escudo pequeño)
      const ts = trapState(p), cv = coverOf(p);
      if (ts) {
        const col = new THREE.Color(TRAP_LOOK[ts].color);
        const ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.4, CELL * 0.47, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: ts === "disparada" ? 0.55 : 0.8, depthWrite: false, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ring.raycast = () => {}; w.add(ring);
        if (ts === "descubierta") { let k = Math.random() * 3; ticks.add(dt => { k += dt; ring.material.opacity = 0.55 + Math.sin(k * 3.6) * 0.3; }); }
        const bd = new THREE.Sprite(new THREE.SpriteMaterial({ map: trapBadge(ts), depthWrite: false, transparent: true })); bd.scale.setScalar(0.95); bd.position.set(CELL * 0.32, 2.4, -CELL * 0.32); bd.raycast = () => {}; w.add(bd);
        if (ts === "disparada") w.traverse(o => { if (o.isMesh && o !== ring && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.45); if (o.material.emissive) o.material.emissive.setScalar(0); } });
      }
      if (cv && !ghostly) { const cb = new THREE.Sprite(new THREE.SpriteMaterial({ map: coverBadge(cv), depthWrite: false, transparent: true, opacity: 0.85 })); cb.scale.setScalar(1); cb.position.set(-CELL * 0.38, 1.1, -CELL * 0.38); cb.raycast = () => {}; w.add(cb); }
      grp.add(w); shroudable.push({ obj: w, c: p.c, r: p.r });
    } catch (e) { console.warn("Pieza sin montar", p.k, e); } }
    if (my !== build) return;
    // Sustituir el escenario anterior de golpe (sin parpadeos)
    // Hito 89: liberar lo que ocupaba el escenario viejo en la tarjeta gráfica (sin tocar lo compartido entre mesas)
    const keepG = new Set([CONTACT_GEO]), keepM = new Set([CONTACT]);
    TEXMAT.forEach(m => keepM.add(m)); FRINGE.forEach(m => keepM.add(m));
    for (const pr of cache.values()) { const gl = await pr; if (gl) gl.scene.traverse(o => { if (o.geometry) keepG.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && keepM.add(m)); }); }
    if (my !== build) return;
    world.children.slice().forEach(o => {
      world.remove(o);
      o.traverse(x => {
        if (x.geometry && !keepG.has(x.geometry)) x.geometry.dispose();
        (Array.isArray(x.material) ? x.material : x.material ? [x.material] : []).forEach(m => { if (m && !keepM.has(m)) m.dispose(); });
      });
    });
    worldTicks = ticks;
    // Hito 84: uniones entre terrenos con borde irregular (la hierba se mete entre las losas, el barro en la tierra…)
    const FG = fringeGeometries(g, cx, cz, CELL, (c, r) => elevAt(g, c, r) * YS, (c, r) => isWallIn(g, c, r));
    for (const [k, geo] of Object.entries(FG)) { const fm = new THREE.Mesh(geo, fringeMat(k)); fm.receiveShadow = true; fm.renderOrder = 1; fm.raycast = () => {}; grp.add(fm); }
    // Hito 85: detalles repartidos por el suelo (matas, guijarros, hojas, charcos…), iguales para todos
    {
      const busy = new Set((g.props || []).map(p => p.c + "," + p.r));
      const D = buildDressing({ g, cx, cz, CELL, elevY: (c, r) => elevAt(g, c, r) * YS, density: DENS(), seed: g.scene || g.name || "mesa",
        skip: (c, r) => { if (isWallIn(g, c, r) || busy.has(c + "," + r)) return true; const t = TERRAIN[(g.terrain || {})[c + "," + r] || "piedra"]; return !t || t.liquid || t.haz === "fall"; } });
      if (D.group.children.length) { grp.add(D.group); shroudable.push(...D.shroud); }
    }
    // Hito 82: borde luminoso de las zonas peligrosas (lava, brasas, brea, hielo, abismo) y de los puentes
    const HE = hazardEdges(g);
    if (HE.length) {
      const byK = {};
      HE.forEach(e => {
        const t = TERRAIN[(g.terrain || {})[e.c + "," + e.r] || "piedra"] || {}, X = cx(e.c), Z = cz(e.r), h = CELL / 2 - 0.04, w = e.kind === "bridge" ? 0.18 : 0.34;
        const y = elevAt(g, e.c, e.r) * YS + (e.kind === "bridge" ? 0.42 : t.liquid ? -0.06 : 0.08);
        // cuatro esquinas de la banda, por dentro de la casilla
        const q = [[[-h, -h], [h, -h], [h, -h + w], [-h, -h + w]], [[h - w, -h], [h, -h], [h, h], [h - w, h]], [[-h, h - w], [h, h - w], [h, h], [-h, h]], [[-h, -h], [-h + w, -h], [-h + w, h], [-h, h]]][e.side];
        const a = (byK[e.kind] = byK[e.kind] || []);
        [0, 1, 2, 0, 2, 3].forEach(i => a.push(X + q[i][0], y, Z + q[i][1]));
      });
      for (const [kind, pts] of Object.entries(byK)) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(HAZ_COLOR[kind]).multiplyScalar(kind === "slip" || kind === "bridge" ? 1 : 1.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        mesh.raycast = () => {}; mesh.renderOrder = 2; grp.add(mesh);
        if (kind === "fire" || kind === "lava") { let k = Math.random() * 3; ticks.add(dt => { k += dt; mesh.material.opacity = 0.45 + Math.sin(k * 2.2) * 0.2; }); }
      }
    }
    // Hito 81: cuadrícula opcional (▦) sobre el suelo
    if (gridPts.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(gridPts, 3)); gridObj = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0.09, depthWrite: false })); gridObj.raycast = () => {}; gridObj.renderOrder = 2; gridObj.visible = GRID(); grp.add(gridObj); } else gridObj = null;
    world.add(grp); shroud = shroudable; setTimeout(refreshAtmo, 0); pickFloors = floorsPick; fogSurf = null; fogSig = ""; // la niebla se vuelve a aplicar sobre el escenario nuevo
    torches.length = 0; torches.push(...newTorches.slice(0, 10));
    newTorches.slice(10).forEach(t => (t.light.visible = false));
    ambient = null; applyAmbient(g.ambient || "interior");
    const span = Math.max(W, H);
    sun.position.set(span * 0.35, span * 0.9, span * 0.5);
    Object.assign(sun.shadow.camera, { left: -span * 0.7, right: span * 0.7, top: span * 0.7, bottom: -span * 0.7, near: 1, far: span * 3 });
    sun.shadow.camera.updateProjectionMatrix();
    loadingEl.hidden = true;
  }
  const isWallIn = (g, c, r) => { const t = (g.terrain || {})[c + "," + r]; return !!(TERRAIN[t] && TERRAIN[t].wall); };

  // ---------- Miniaturas ----------
  async function makeToken(t) {
    const rec = { root: new THREE.Group(), mixer: null, actions: {}, mini: null, target: new THREE.Vector3(), moving: 0, down: false };
    rec.root.userData.tok = t.id;
    const ring = t.kind === "pc" ? 0xd6aa4e : t.kind === "npc" ? 0x7d8fe0 : 0xb33a2e;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.28, 40), new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 0.5 }));
    base.position.y = 0.14; base.castShadow = base.receiveShadow = true; rec.root.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.09, 8, 48), new THREE.MeshStandardMaterial({ color: ring, emissive: ring, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.4 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.28; rec.root.add(rim);
    const sel = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.05, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    sel.rotation.x = -Math.PI / 2; sel.position.y = 0.05; sel.visible = false; rec.root.add(sel); rec.sel = sel;
    rec.shadow = contactShadow(4.3 * (+t.size || 1)); rec.root.add(rec.shadow); // Hito 89
    const turn = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 7, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    turn.position.y = 3.5; turn.visible = false; rec.root.add(turn); rec.turn = turn;
    // Efecto de herida o curación: onda en la peana y columna de luz
    const pulse = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.75, 48), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.32; pulse.visible = false; rec.root.add(pulse); rec.pulse = pulse;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 6, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x6cff8a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 3; beam.visible = false; rec.root.add(beam); rec.beam = beam; rec.fxT = 0;
    tokGroup.add(rec.root);
    rec.miniKey = miniFor(t, opts.charOf(t));
    await dressToken(rec, t);
    return rec;
  }
  async function dressToken(rec, t) {
    if (rec.mini) { rec.root.remove(rec.mini); rec.mini = null; rec.mixer = null; rec.actions = {}; }
    rec.fmats = null; rec.nudge = null; rec.flash = null;
    const key = rec.miniKey, size = +t.size || 1;
    let mini;
    if (key !== "peana") {
      const gl = await load("minis/" + key);
      if (gl) {
        mini = skClone(gl.scene);
        rec.mixer = new THREE.AnimationMixer(mini);
        gl.animations.forEach(a => (rec.actions[a.name] = rec.mixer.clipAction(a)));
        play(rec, "Idle");
      }
    }
    if (!mini) mini = await card(t);
    mini.scale.multiplyScalar(size * (key === "peana" ? 1.22 : 1.35));
    mini.position.y = 0.28;
    mini.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    { const bb = new THREE.Box3().setFromObject(mini); rec.h = Math.max(2.5, bb.max.y - bb.min.y + 0.28); } // altura real de la figura (para la placa del nombre)
    rec.tilt = 0; rec.hitT = 0;
    if (t.hidden) mini.traverse(o => { if (o.isMesh) { const see = m => { const c = m.clone(); c.transparent = true; c.opacity = 0.4; return c; }; o.material = Array.isArray(o.material) ? o.material.map(see) : see(o.material); if (mini.userData.mats) mini.userData.mats = Array.isArray(o.material) ? [...new Set(o.material)] : mini.userData.mats; } });
    rec.root.add(mini); rec.mini = mini; rec.condKey = null;
  }
  // Peana de cartón: tarjeta gruesa con la ilustración por las dos caras, canto pintado y placa con el nombre
  const KIND = { pc: ["#d6aa4e", "#5a4320"], npc: ["#7d8fe0", "#2a3160"], foe: ["#b33a2e", "#4a1712"] };
  const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  async function card(t) {
    const d = opts.decorate(t) || {}, [ring, edge] = KIND[t.kind] || KIND.foe;
    const W = 512, H = 680, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    const pg = g.createLinearGradient(0, 0, 0, H); pg.addColorStop(0, "#efe2c2"); pg.addColorStop(1, "#cbb487");
    g.fillStyle = pg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(90,60,30,${Math.random() * 0.06})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    const art = d.portrait || t.img ? await getImage(d.portrait || t.img) : null;
    const ch = opts.charOf(t);
    const im = art ? await loadImg(art) : await loadImg(siluetaURL(t.icon || (ch ? siluetaFor(`${ch.cls} ${ch.species}`) : siluetaFor(t.name))));
    const ax = 30, ay = 30, aw = W - 60, ah = H - 150;
    if (im && art) { g.save(); g.beginPath(); g.rect(ax, ay, aw, ah); g.clip(); const k = Math.max(aw / im.width, ah / im.height); g.drawImage(im, ax + (aw - im.width * k) / 2, ay + (ah - im.height * k) / 2, im.width * k, im.height * k); g.restore(); }
    else {
      const vg = g.createRadialGradient(W / 2, ah / 2 + ay, 40, W / 2, ah / 2 + ay, ah * 0.7); vg.addColorStop(0, "rgba(255,250,235,.0)"); vg.addColorStop(1, ring + "55");
      g.fillStyle = vg; g.fillRect(ax, ay, aw, ah);
      if (im) g.drawImage(im, W / 2 - 190, ay + ah / 2 - 190, 380, 380);
    }
    g.lineWidth = 6; g.strokeStyle = ring; g.strokeRect(ax, ay, aw, ah);
    g.lineWidth = 18; g.strokeStyle = edge; g.strokeRect(9, 9, W - 18, H - 18);
    g.fillStyle = edge; g.fillRect(18, H - 112, W - 36, 94);
    g.fillStyle = "#f3e7c8"; g.textAlign = "center"; g.font = "bold 46px Georgia";
    let name = d.name || t.name || "?"; while (g.measureText(name).width > W - 70 && name.length > 4) name = name.slice(0, -2) + "…";
    g.fillText(name, W / 2, H - 50);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    // La ilustración brilla un poco por sí misma: así no se apaga con la luz de interior o de noche (como una carta impresa bien iluminada)
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 }), side = new THREE.MeshStandardMaterial({ color: edge, roughness: 0.8 });
    const CW = 3.0, CH = 4.0;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, 0.09), [side, side, side, side, face, face]);
    mesh.position.y = CH / 2; mesh.castShadow = true;
    const clip = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.34), new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 0.5 }));
    clip.position.y = 0.1;
    const pivot = new THREE.Group(); pivot.add(mesh, clip);
    const grp = new THREE.Group(); grp.add(pivot); grp.userData.card = true; grp.userData.pivot = pivot; grp.userData.mats = [face, side];
    return grp;
  }
  function play(rec, name, once) {
    const a = rec.actions[name] || rec.actions.Idle || Object.values(rec.actions)[0];
    if (!a || rec.current === a) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = !!once;
    if (rec.current) a.crossFadeFrom(rec.current, 0.25, false);
    a.play(); rec.current = a;
  }

  async function syncTokens(list) {
    const vis = list.filter(t => opts.dm || !t.hidden), ids = new Set(vis.map(t => t.id));
    for (const [id, rec] of toks) if (!ids.has(id)) { tokGroup.remove(rec.root); toks.delete(id); }
    const pcs = vis.filter(t => t.kind === "pc"), foes = vis.filter(t => t.kind !== "pc");
    for (const t of vis) {
      let rec = toks.get(t.id);
      if (!rec) {
        rec = { pending: true }; toks.set(t.id, rec);
        rec = await makeToken(t); if (disposed) return;
        toks.set(t.id, rec);
        rec.root.position.set(cx(t.c), ty(t), cz(t.r)); rec.target.copy(rec.root.position);
      } else if (rec.pending) continue;
      const want = miniFor(t, opts.charOf(t)), dd = opts.decorate(t) || {};
      const dressKey = [want, t.hidden, +t.size || 1, t.img, t.icon, dd.portrait, dd.name || t.name].join("|");
      if (dressKey !== rec.dressKey) { const first = !rec.dressKey; rec.dressKey = dressKey; if (!first || want !== rec.miniKey) { rec.miniKey = want; await dressToken(rec, t); } }
      rec.hidden = !!t.hidden; rec.size = +t.size || 1;
      const tx = cx(t.c), tz = cz(t.r), tyy = ty(t);
      if (rec.target.x !== tx || rec.target.z !== tz || Math.abs(rec.target.y - tyy) > 0.01) { const walk = rec.target.x !== tx || rec.target.z !== tz; rec.target.set(tx, tyy, tz); rec.moving = 1; if (walk) play(rec, "Walking_A"); }
      // Mirar hacia el otro bando
      const others = t.kind === "pc" ? foes : pcs;
      if (others.length) { let mx = 0, mz = 0; others.forEach(o => { mx += cx(o.c); mz += cz(o.r); }); rec.face = Math.atan2(mx / others.length - tx, mz / others.length - tz); }
      const hp = opts.hpOf(t), down = !!hp && hp.cur <= 0;
      const im = hp && rec.lastHp != null && hp.cur !== rec.lastHp ? impactOf(store.get(), t.id, rec.lastHp, hp.cur) : null;
      if (im && !im.heal && fxReady) {
        // Hito 79: retrocede alejándose de quien golpea y destella en rojo (también si cae)
        const A = im.by && toks.get(im.by);
        let dx = 0, dz = 1;
        if (A && A.root && A !== rec) { dx = rec.root.position.x - A.root.position.x; dz = rec.root.position.z - A.root.position.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
        else { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dz = Math.sin(a); }
        nudge(rec, dx, dz, im.crit ? 1.25 : 0.85, "recoil"); flashRed(rec, im.crit ? 1 : 0.8);
      } else if (im && im.heal && fxReady) { flashRed(rec, 0.6, 0x5cff7a); if (!calm) fxList.push(healMotes(scene, rec.root.position.clone())); }
      if (hp && rec.lastHp != null && hp.cur < rec.lastHp && !down) {
        rec.hitT = 1.25; if (fxReady) sound.play("hit");
        if (rec.mixer) { play(rec, "Hit_A", true); setTimeout(() => { if (!rec.down) play(rec, "Idle"); }, 700); }
      }
      if (hp && rec.lastHp != null && hp.cur !== rec.lastHp && fxReady) {
        const dHp = hp.cur - rec.lastHp, top = rec.root.position.clone(); top.y = 2.6 * (+t.size || 1); top.x += 1.1;
        setTimeout(() => { if (!disposed) fxList.push(floatText(scene, top, (dHp > 0 ? "+" : "−") + Math.abs(dHp), im ? im.color : dHp > 0 ? "#7dff9a" : "#ff5a48", Math.abs(dHp) >= 15, 1.35)); }, 450);
      }
      if (hp && rec.lastHp != null && hp.cur !== rec.lastHp) {
        rec.fxT = 1; rec.fxHeal = hp.cur > rec.lastHp;
        rec.pulse.material.color.set(rec.fxHeal ? 0x5cff7a : 0xff3a2a); rec.beam.material.color.set(rec.fxHeal ? 0x6cff8a : 0xff4a2a);
      }
      rec.lastHp = hp ? hp.cur : null;
      if (down !== rec.down) {
        if (down && rec.lastHp != null) sound.play("down");
        rec.down = down; play(rec, down ? "Death_A" : "Idle", down);
        if (down && fxReady) puff(rec, true); // Hito 89: polvo al caer
        if (rec.mini && rec.mini.userData.mats) rec.mini.userData.mats.forEach(m => { m.color.setScalar(down ? 0.45 : 1); if (m.emissiveMap) m.emissiveIntensity = down ? 0.12 : 0.55; });
      }
      // Estados: anillos de color en la peana, etiqueta escrita y algunos efectos en la figura
      const conds = t.conds || [], S0 = store.get(), condKey = JSON.stringify(conds) + conds.map(cd => cd.dur ? leftOf(S0, cd) : "").join(",");
      if (condKey !== rec.condKey) {
        rec.condKey = condKey;
        (rec.rings || []).forEach(o => rec.root.remove(o)); rec.rings = [];
        // Un solo anillo fino del color del primer estado (los iconos van encima de la figura)
        { const e = conds.map(cd => estado(cd.id || cd)).find(x => x && x.id !== "encima"); if (e) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.06, 8, 48), new THREE.MeshStandardMaterial({ color: e.c, emissive: e.c, emissiveIntensity: 0.4, roughness: 0.4 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; rec.root.add(ring); rec.rings.push(ring); } }
        if (rec.tag) { rec.root.remove(rec.tag); rec.tag = null; }
        // (los estados van ahora en la placa, bajo la vida, como en BG3)
        const has = id => conds.some(cd => (cd.id || cd) === id);
        rec.prone = has("derribado") || has("inconsciente");
        const ghost = has("invisible"), stone = has("petrificado");
        if (rec.mini) rec.mini.traverse(o => { if (o.isMesh) {
          if (!o.userData.baseMat) o.userData.baseMat = o.material;
          if (ghost || stone) { const m = (Array.isArray(o.userData.baseMat) ? o.userData.baseMat : [o.userData.baseMat]).map(x => { const c = x.clone(); if (ghost) { c.transparent = true; c.opacity = 0.35; } if (stone && c.color) c.color.set(0x8c8c8c); return c; }); o.material = Array.isArray(o.userData.baseMat) ? m : m[0]; }
          else o.material = o.userData.baseMat;
        } });
      }
      const d = opts.decorate(t) || {};
      rec.turn.visible = !!d.isTurn;
      rec.sel.visible = selected === t.id;
      const hl = selected === t.id || !!d.isTurn, exact = opts.dm || t.kind === "pc", top = (rec.h || 4) + 0.35;
      const pctQ = hp ? (exact ? hp.cur / Math.max(1, hp.max) : (r => r > 0.75 ? 1 : r > 0.5 ? 0.7 : r > 0.25 ? 0.45 : r > 0 ? 0.18 : 0)(hp.cur / Math.max(1, hp.max))) : null;
      const word = hp && !exact ? (pctQ >= 1 ? "Ileso" : pctQ >= 0.7 ? "Herido" : pctQ >= 0.45 ? "Malherido" : pctQ > 0 ? "Al borde" : "Fuera de combate") : "";
      const pxH = Math.max(28, Math.min(160, Math.round(PLATE_H * camera.projectionMatrix.elements[5] / 2 * renderer.domElement.height))); // píxeles reales de la placa
      const cl = (t.conds || []).map(cd => cd.dur ? { ...cd, left: leftOf(store.get(), cd) } : cd);
      const plateKey = JSON.stringify([d.name || t.name, pctQ, exact && hp && hp.cur, exact && hp && hp.max, hl, word, pxH, cl, giVer]);
      if (plateKey !== rec.barKey) {
        if (rec.bar) { rec.root.remove(rec.bar); rec.bar.material.map.dispose(); rec.bar.material.dispose(); rec.bar = null; }
        rec.bar = namePlate(t.kind === "pc" ? shortName(d.name || t.name) : plateName(d.name || t.name), pctQ, hp ? (exact ? `${hp.cur} / ${hp.max}` : word) : "", t.kind === "pc" ? "#d6aa4e" : t.kind === "npc" ? "#7d8fe0" : "#b33a2e", hl, pxH, cl);
        rec.root.add(rec.bar); rec.barKey = plateKey;
      }
      rec.bar.position.y = top;
      if (rec.tag) rec.tag.position.y = top + 1.9;
    }
  }

  // Las obras se hacen de una en una: si el máster edita mientras tanto, se monta la última versión al acabar
  // (antes, cada cambio cancelaba la obra en curso y, editando seguido, los jugadores nunca veían la mesa)
  let building = false, pendingG = null;
  function queueBuild(g) {
    if (building) { pendingG = g; return; }
    building = true;
    Promise.resolve().then(() => buildWorld(g)).catch(e => console.warn("Mesa 3D: no se pudo montar del todo", e))
      .finally(() => { building = false; loadingEl.hidden = true; if (!disposed) { const m = opts.model(); if (m && m.grid) updateFog(m); } if (pendingG && !disposed) { const n = pendingG; pendingG = null; queueBuild(n); } });
  }
  function sync() {
    if (disposed) return;
    const m = opts.model(); if (!m || !m.grid) return;
    const first = !G; G = m.grid;
    const sig = JSON.stringify([G.cols, G.rows, G.terrain, G.props, lowWalls]);
    if (sig !== lastSig) { lastSig = sig; queueBuild(G); if (first) frame("persp"); }
    applyAmbient(G.ambient || "interior"); setMotes();
    sound.ambient(G.sound || "");
    if (snd) snd.value = G.sound || "";
    const fb = ctl.querySelector('[data-cam="fog"]'); if (fb) { fb.setAttribute("aria-pressed", visionOn(G)); fb.textContent = visionOn(G) ? "Visión: sí" : "Visión: no"; }
    syncTokens(m.tokens).then(() => updateFog(m));
    updateAim(m); drawTargeting();
    // Efectos lanzados (en la mesa o en la ficha de quien lanza). Los ve todo el mundo; no se repiten al entrar más tarde.
    const all = [G.fx, ...m.tokens.map(t => t.fx && { ...t.fx, caster: t.id })].filter(Boolean);
    for (const fx of all) {
      if (seenFx.has(fx.id)) continue;
      seenFx.add(fx.id);
      if (!(fxReady || Date.now() - fx.at < 6000)) continue;
      const caster = fx.caster && m.tokens.find(t => t.id === fx.caster);
      const from = caster ? { c: caster.c, r: caster.r } : fx.to;
      sound.fx(fx.k);
      fxList.push(playEffect(scene, fx.k, new THREE.Vector3(cx(from.c), 0, cz(from.r)), new THREE.Vector3(cx(fx.to.c), 0, cz(fx.to.r)), CELL));
      const r = fx.caster && toks.get(fx.caster);
      if (r && r.mixer) { play(r, "Spellcast_Shoot", true); setTimeout(() => { if (!r.down) play(r, "Idle"); }, 900); }
      else if (r) r.hitT = 0.5;
    }
    // Los dados ya no ruedan sobre el tablero: salen en la cajetilla (dicecam.js)
    fxReady = true;
    refreshReach();
  }

  // ---------- Hito 79: retroceso, esquiva y destello sobre la figura; temblor de cámara en críticos ----------
  let camShake = 0;
  const camOff = new THREE.Vector3();
  function nudge(rec, dx, dz, amp, kind) { rec.nudge = { dx, dz, amp, t: 0, dur: kind === "dodge" ? 0.55 : 0.45 }; }
  function flashRed(rec, k, color = 0xff2a1a) {
    if (!rec.mini) return;
    if (!rec.fmats) { rec.fmats = []; rec.mini.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m && m.emissive && !rec.fmats.some(x => x.m === m)) rec.fmats.push({ m, c: m.emissive.clone() }); }); }); }
    rec.flash = { t: 0, dur: 0.35, k, col: new THREE.Color(color) };
  }
  /** Polvo al arrancar y al llegar (del color del terreno); más grande si baja de un desnivel o cae. */
  function puff(rec, big) {
    if (!fxReady || calm || !G || DENS() === 0) return;
    const p = rec.root.position, c = Math.round(p.x / CELL + G.cols / 2 - 0.5), r = Math.round(p.z / CELL + G.rows / 2 - 0.5);
    const t = (G.terrain || {})[c + "," + r] || "piedra";
    fxList.push(dust(scene, p.clone(), DUST[t] || "#c8b89a", big));
  }
  /** Coloca la miniatura sumando el retroceso del golpe y el paso al andar (Hito 88). */
  function placeMini(rec) {
    if (!rec.mini) return;
    const n = rec.nOff, wy = rec.walkY || 0;
    if (!n && !wy && !rec.offOn) return;
    if (!rec.mini.userData.p0) rec.mini.userData.p0 = rec.mini.position.clone();
    const p0 = rec.mini.userData.p0;
    rec.mini.position.set(p0.x + (n ? n.x : 0), p0.y + (n ? n.y : 0) + wy, p0.z + (n ? n.z : 0));
    rec.offOn = !!(n || wy);
    if (rec.shadow) { // la sombra se encoge cuando la figura se separa del suelo
      if (!rec.shadowBase) rec.shadowBase = rec.shadow.scale.x;
      const lift = Math.max(0, wy + (n ? n.y : 0)), k = rec.shadowBase * Math.max(0.7, 1 - lift * 1.6); rec.shadow.scale.set(k, 1, k);
    }
  }
  function stepHitFx(rec, dt) {
    if (rec.nudge && rec.mini) {
      // Hito 88: un solo golpe con peso: sale rápido (25 %) y vuelve frenando
      const n = rec.nudge; n.t += dt; const u = Math.min(1, n.t / n.dur);
      const prof = u < 0.25 ? 1 - Math.pow(1 - u / 0.25, 2) : (() => { const v = (u - 0.25) / 0.75; return 1 - v * v * (3 - 2 * v); })();
      const off = prof * n.amp;
      // de mundo a local de la figura (la raíz está girada)
      const th = rec.root.rotation.y, lx = n.dx * Math.cos(th) - n.dz * Math.sin(th), lz = n.dx * Math.sin(th) + n.dz * Math.cos(th);
      rec.nOff = u >= 1 ? null : { x: lx * off, y: (n.dur > 0.5 ? 0.04 : 0.16) * prof, z: lz * off };
      if (u >= 1) rec.nudge = null;
    }
    if (rec.flash && rec.fmats) {
      const f = rec.flash; f.t += dt; const u = Math.min(1, f.t / f.dur), k = f.k * (1 - u * u); // se apaga de forma más natural
      rec.fmats.forEach(({ m, c }) => m.emissive.copy(c).lerp(f.col, k));
      if (u >= 1) { rec.fmats.forEach(({ m, c }) => m.emissive.copy(c)); rec.flash = null; }
    }
  }

  // ---------- Golpes: lo que pasa en cada ataque, visto por todos ----------
  function playEvents(evs) {
    for (const e of evs) setTimeout(() => {
      if (disposed || !G) return;
      const m = opts.model(), B = toks.get(e.to), tb = m.tokens.find(t => t.id === e.to);
      if (!B || !B.root || !tb || (tb.hidden && !opts.dm)) return;
      const top = B.root.position.clone(); top.y = (B.h || 4) + 1.6;
      const say = () => fxList.push(floatText(scene, top, RES_TEXT[e.res], RES_COLOR[e.res], e.res === "crit"));
      const A = e.from && toks.get(e.from), ta = e.from && m.tokens.find(t => t.id === e.from);
      if (e.type === "atk" && A && A.root && ta && e.from !== e.to) {
        const melee = cellDist(ta, tb) <= 1 + Math.max(+ta.size || 1, +tb.size || 1);
        if (A.mixer) { play(A, e.magic ? "Spellcast_Shoot" : "1H_Melee_Attack_Chop", true); setTimeout(() => { if (!A.down) play(A, "Idle"); }, 800); } else A.hitT = Math.max(A.hitT || 0, 0.35);
        sound.play(melee && !e.magic ? "whoosh" : e.magic ? "magic" : "twang");
        fxList.push(strike(scene, A.root.position.clone(), B.root.position.clone(), { melee, magic: e.magic, color: e.color, res: e.res,
          onHit: () => { B.hitT = Math.max(B.hitT || 0, e.res === "crit" ? 1.3 : 0.9); sound.play(e.res === "crit" ? "crit" : "hit"); if (e.res === "crit") camShake = 0.4; } }));
        if (e.res === "miss") setTimeout(() => {
          if (disposed) return; sound.play("miss");
          // esquiva: se aparta de lado, perpendicular al ataque
          let dx = B.root.position.x - A.root.position.x, dz = B.root.position.z - A.root.position.z; const l = Math.hypot(dx, dz) || 1;
          const sd = Math.random() < 0.5 ? 1 : -1; nudge(B, -dz / l * sd, dx / l * sd, 0.9, "dodge");
        }, melee && !e.magic ? 170 : 400);
        setTimeout(() => { if (!disposed) say(); }, melee && !e.magic ? 180 : 420);
      } else { if (e.type === "save") sound.play(e.res === "save" ? "block" : "hit"); say(); }
    }, e.delay || 0);
  }

  // ---------- Línea de puntería: distancia, alcance y cobertura hasta el objetivo ----------
  const aimLine = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x7ec850, transparent: true, opacity: 0.85, depthTest: false }));
  aimLine.renderOrder = 9; aimLine.visible = false; scene.add(aimLine);
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.2, 40), new THREE.MeshBasicMaterial({ color: 0x7ec850, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  aimRing.rotation.x = -Math.PI / 2; aimRing.position.y = 0.08; aimRing.visible = false; scene.add(aimRing);
  let aimLabel = null, aimKey = "";
  function updateAim(m) {
    const a = opts.aim ? opts.aim() : null;
    const A = a && m.tokens.find(t => t.id === a.from), B = a && m.tokens.find(t => t.id === a.to);
    if (!A || !B || (!opts.dm && B.hidden)) { aimLine.visible = aimRing.visible = false; if (aimLabel) aimLabel.visible = false; return; }
    const p0 = new THREE.Vector3(cx(A.c), 1.6, cz(A.r)), p1 = new THREE.Vector3(cx(B.c), 1.6, cz(B.r)), d = p1.clone().sub(p0), len = d.length();
    aimLine.visible = aimRing.visible = true;
    aimLine.position.copy(p0).add(p1).multiplyScalar(0.5); aimLine.scale.set(1, len, 1);
    aimLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    aimLine.material.color.set(a.color); aimRing.material.color.set(a.color); aimRing.position.x = p1.x; aimRing.position.z = p1.z;
    const key = a.label + a.color;
    if (key !== aimKey) {
      aimKey = key; if (aimLabel) scene.remove(aimLabel);
      const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = "bold 26px Georgia";
      const w = Math.min(1000, g.measureText(a.label).width + 40); c.width = w; c.height = 50;
      g.font = "bold 26px Georgia"; g.fillStyle = "rgba(15,12,10,.88)"; g.beginPath(); g.roundRect(2, 2, w - 4, 46, 12); g.fill();
      g.strokeStyle = a.color; g.lineWidth = 3; g.stroke(); g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(a.label, w / 2, 34);
      aimLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
      aimLabel.scale.set(w / 50 * 1.1, 1.1, 1); aimLabel.renderOrder = 12; scene.add(aimLabel);
    }
    aimLabel.visible = true; aimLabel.position.copy(p0).add(p1).multiplyScalar(0.5).setY(3.2);
  }

  // ---------- Niebla de guerra (solo para los jugadores) ----------
  function updateFog(m) {
    const on = !opts.dm && visionOn(G) && opts.chars;
    const vis = on ? computeVision(G, m.tokens, opts.chars()) : null;
    const exp = on ? explored((G.scene || "mesa") + "", vis) : null;
    const sig = on ? [...vis].join(";") + "|" + [...vis.dim].join(";") + "|" + exp.size + "|" + G.cols + "x" + G.rows : "off";
    for (const [id, rec] of toks) {
      if (!rec.root) continue;
      const t = m.tokens.find(k => k.id === id);
      rec.root.visible = !on || !t || t.kind === "pc" || tokenSeen(t, vis);
    }
    if (sig === fogSig) return; fogSig = sig;
    // Lo que nunca se ha visto no se dibuja (ni muros ni escenografía): así el velo puede ser fino y no un bloque
    const Z = new THREE.Matrix4().makeScale(0, 0, 0), dirty = new Set();
    for (const x of shroud) {
      const show = !on || exp.has(x.c + "," + x.r);
      if (x.obj) x.obj.visible = show;
      else { x.im.setMatrixAt(x.i, show ? x.m : Z); dirty.add(x.im); }
    }
    dirty.forEach(im => { im.instanceMatrix.needsUpdate = true; });
    if (!on) { if (fogPlane) fogPlane.visible = false; return; }
    // Un velo suave pegado al suelo, con los bordes difuminados
    const cv = fogCanvas(G.cols, G.rows, vis, exp);
    if (!fogPlane || fogSurf !== G) {
      if (fogPlane) { fogGroup.remove(fogPlane); fogPlane.geometry.dispose(); }
      fogPlane = new THREE.Mesh(fogGeometry(), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      fogPlane.renderOrder = 1; fogGroup.add(fogPlane); fogSurf = G;
    }
    if (fogPlane.material.map) fogPlane.material.map.dispose();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    fogPlane.material.map = tex; fogPlane.material.needsUpdate = true;
    fogPlane.visible = true;
  }
  /** El velo sigue el relieve: un cuadrado por casilla a su altura y, en los desniveles, la pared del risco. */
  function fogGeometry() {
    const pos = [], uv = [], h = CELL / 2, U = (c, f) => (c + f) / G.cols, V = (r, f) => 1 - (r + f) / G.rows;
    for (let r = 0; r < G.rows; r++) for (let c = 0; c < G.cols; c++) {
      const y = gy(c, r) + 0.05, x = cx(c), z = cz(r);
      const q = [[-h, -h, 0, 0], [h, -h, 1, 0], [h, h, 1, 1], [-h, -h, 0, 0], [h, h, 1, 1], [-h, h, 0, 1]];
      q.forEach(([a, b, fu, fv]) => { pos.push(x + a, y, z + b); uv.push(U(c, fu), V(r, fv)); });
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dc, dr]) => {
        const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) return;
        const y0 = gy(nc, nr) + 0.05; if (y0 >= y) return;
        const A = dc === 0 ? [x - h, z + dr * (h + 0.04)] : [x + dc * (h + 0.04), z - h], B = dc === 0 ? [x + h, z + dr * (h + 0.04)] : [x + dc * (h + 0.04), z + h];
        const u = U(c, 0.5), v = V(r, 0.5);
        [[A, y0], [B, y0], [B, y], [A, y0], [B, y], [A, y]].forEach(([P, yy]) => { pos.push(P[0], yy, P[1]); uv.push(u, v); });
      });
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }
  // ---------- Alcance del movimiento: casillas a las que llegas este turno ----------
  const reachGrp = new THREE.Group(); scene.add(reachGrp);
  let reachFor = null, reachR = null, pathMesh = null, pathOA = [];
  const RMAT = {
    walk: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    dif: new THREE.MeshBasicMaterial({ color: 0xe0b45a, transparent: true, depthWrite: false }),
    dash: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })
  };
  // Colores elegidos por cada jugador (🎨), más vivos que antes
  const TMAT = { fill: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), edge: new THREE.LineBasicMaterial({ transparent: true, depthTest: false }), long: new THREE.LineDashedMaterial({ transparent: true, dashSize: 0.8, gapSize: 0.6, depthTest: false }),
    area: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), areaEdge: new THREE.LineBasicMaterial({ transparent: true, depthTest: false }), ring: new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false }), bad: new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.3, depthWrite: false }) };
  function applyColors() {
    const c = colors(), k = +c.strength || 1, A = x => Math.min(0.95, x * k);
    RMAT.walk.color.set(c.walk); RMAT.walk.opacity = A(0.36); RMAT.dash.color.set(c.dash); RMAT.dash.opacity = A(0.26); RMAT.dif.opacity = A(0.3);
    TMAT.fill.color.set(c.range); TMAT.fill.opacity = A(0.13); TMAT.edge.color.set(c.range); TMAT.edge.opacity = A(0.95); TMAT.long.color.set(c.long); TMAT.long.opacity = A(0.85);
    TMAT.area.color.set(c.area); TMAT.area.opacity = A(0.45); TMAT.areaEdge.color.set(c.area); TMAT.areaEdge.opacity = A(1); TMAT.ring.color.set(c.target); TMAT.ring.opacity = A(0.9);
  }
  applyColors();
  const offColors = onColors(() => { applyColors(); if (pathMesh) pathMesh.material.color.set(colors().path); drawTargeting(); });
  const tileGeo = new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92).rotateX(-Math.PI / 2);
  function showReach(id) {
    reachGrp.clear(); reachFor = id; reachR = id && opts.reach ? opts.reach(id) : null;
    if (!reachR || !G) return;
    const groups = { walk: [], dif: [], dash: [] };
    reachR.cells.forEach((x, k) => { if (!x.cost || x.occ) return; const [c, r] = k.split(",").map(Number); groups[x.dash ? "dash" : x.dif ? "dif" : "walk"].push([c, r]); });
    const m4 = new THREE.Matrix4();
    for (const [k, list] of Object.entries(groups)) {
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(tileGeo, RMAT[k], list.length); im.renderOrder = 2;
      list.forEach(([c, r], i) => im.setMatrixAt(i, m4.makeTranslation(cx(c), gy(c, r) + 0.07, cz(r)))); reachGrp.add(im);
    }
    // La casilla de origen queda marcada: siempre puedes volver a ella
    const o = reachR.from, ring = new THREE.Mesh(new THREE.RingGeometry(CELL * 0.36, CELL * 0.46, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.75, depthWrite: false }));
    ring.position.set(cx(o.c), gy(o.c, o.r) + 0.09, cz(o.r)); reachGrp.add(ring);
  }
  function showPath(h) {
    if (pathMesh) { reachGrp.remove(pathMesh); pathMesh.geometry.dispose(); pathMesh = null; }
    if (!reachR || !h) return;
    const p = pathTo(reachR, h.c, h.r); if (p.length < 2) return;
    const x = reachR.cells.get(h.c + "," + h.r);
    const curve = new THREE.CatmullRomCurve3(p.map(q => new THREE.Vector3(cx(q.c), gy(q.c, q.r) + 0.3, cz(q.r))), false, "centripetal", 0.2);
    const oa = opts.oaPreview && reachFor ? opts.oaPreview(reachFor, p) : []; pathOA = oa;
    pathMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, p.length * 6, 0.2, 6), new THREE.MeshBasicMaterial({ color: oa.length ? 0xff3b30 : x && x.dash ? colors().dash : colors().path, transparent: true, opacity: 0.95, depthWrite: false }));
    pathMesh.renderOrder = 3; reachGrp.add(pathMesh);
  }

  // ---------- Apuntar (BG3): alcance, objetivos con su probabilidad y plantillas de área ----------
  const tgtGrp = new THREE.Group(); scene.add(tgtGrp);
  let TG = null, tgSig = "", tmplHover = null;
  const tileGeoT = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2);
  const clearGrp = g => { g.children.slice().forEach(o => { g.remove(o); if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); } else if (o.geometry && o.geometry !== tileGeoT && o.geometry !== ringGeoT) o.geometry.dispose(); }); };
  const ringGeoT = new THREE.RingGeometry(1.9, 2.3, 48).rotateX(-Math.PI / 2);
  function edgeLines(set, mat, lift = 0.14) {
    const pts = [], h = CELL / 2;
    set.forEach(k => { const [c, r] = k.split(",").map(Number), x = cx(c), z = cz(r), y = gy(c, r) + lift;
      if (!set.has(c + "," + (r - 1))) pts.push(x - h, y, z - h, x + h, y, z - h); if (!set.has(c + "," + (r + 1))) pts.push(x - h, y, z + h, x + h, y, z + h);
      if (!set.has((c - 1) + "," + r)) pts.push(x - h, y, z - h, x - h, y, z + h); if (!set.has((c + 1) + "," + r)) pts.push(x + h, y, z - h, x + h, y, z + h); });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const L = new THREE.LineSegments(g, mat); if (mat.isLineDashedMaterial) L.computeLineDistances(); L.renderOrder = 6; return L;
  }
  function tiles(set, mat, lift = 0.1) {
    const list = [...set]; if (!list.length) return null;
    const im = new THREE.InstancedMesh(tileGeoT, mat, list.length), m4 = new THREE.Matrix4();
    list.forEach((k, i) => { const [c, r] = k.split(",").map(Number); im.setMatrixAt(i, m4.makeTranslation(cx(c), gy(c, r) + lift, cz(r))); });
    im.renderOrder = 5; return im;
  }
  /** Etiqueta encima de un objetivo («72% · 4–11»), nítida a su tamaño real. */
  function chip(txt, color, dim) {
    const pxH = Math.max(18, Math.min(60, Math.round(0.03 * camera.projectionMatrix.elements[5] / 2 * renderer.domElement.height)));
    const fs = Math.round(pxH * 0.62), cv = document.createElement("canvas"), g0 = cv.getContext("2d");
    g0.font = `700 ${fs}px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif`;
    const w = Math.ceil(g0.measureText(txt).width + pxH * 0.9); cv.width = w; cv.height = pxH;
    const g = cv.getContext("2d"); g.font = g0.font; g.fillStyle = "rgba(14,10,8,.92)"; g.beginPath(); g.roundRect(1, 1, w - 2, pxH - 2, pxH / 2); g.fill();
    g.lineWidth = 2; g.strokeStyle = dim ? "#777" : color; g.stroke(); g.fillStyle = dim ? "#bbb" : "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, w / 2, pxH / 2 + 1);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
    const H = 0.03; sp.scale.set(H * w / pxH, H, 1); sp.center.set(0.5, 0); sp.renderOrder = 10; return sp;
  }
  function drawTargeting() {
    if (!G) return;
    const m = opts.model(); TG = opts.targeting ? opts.targeting() : null;
    const sig = JSON.stringify([TG, tmplHover, m.tokens.map(t => [t.id, t.c, t.r]), colors()]);
    if (sig === tgSig) return; tgSig = sig; clearGrp(tgtGrp);
    renderer.domElement.style.cursor = TG && TG.kind === "tmpl" ? "crosshair" : "";
    if (!TG) return;
    const a = m.tokens.find(t => t.id === TG.from); if (!a) return;
    if (TG.kind === "tmpl") {
      if (!tmplHover) return;
      const cells = templateCells(G, a, tmplHover, TG.area), ok = templateOk({ tokens: m.tokens }, a, tmplHover, TG.area, TG.rng);
      const t1 = tiles(cells, ok ? TMAT.area : TMAT.bad, 0.12); if (t1) tgtGrp.add(t1);
      tgtGrp.add(edgeLines(cells, TMAT.areaEdge, 0.16));
      const inT = m.tokens.filter(t => cells.has(t.c + "," + t.r) && (opts.dm || !t.hidden) && !(t.id === a.id && /cono|línea|emanación/.test(TG.area.shape)));
      inT.forEach(t => { const r = new THREE.Mesh(ringGeoT, TMAT.ring); r.position.set(cx(t.c), ty(t) + 0.2, cz(t.r)); r.scale.setScalar(t.size || 1); r.renderOrder = 7; tgtGrp.add(r); });
      const al = inT.filter(t => (t.kind === "pc") === (a.kind === "pc")).length;
      const sp = chip(ok ? `${inT.length} dentro${al ? ` · ⚠ ${al} aliado${al > 1 ? "s" : ""}` : ""}` : "demasiado lejos", colors().area, !ok); sp.position.set(cx(tmplHover.c), gy(tmplHover.c, tmplHover.r) + 1.2, cz(tmplHover.r)); tgtGrp.add(sp);
      return;
    }
    if (TG.kind !== "pick" && TG.rng) {
      const near = new Set(), far = new Set(), N = TG.rng.n, L = Math.max(N, TG.rng.l || N);
      for (let r = a.r - Math.ceil(L) - 1; r <= a.r + Math.ceil(L) + 1; r++) for (let c = a.c - Math.ceil(L) - 1; c <= a.c + Math.ceil(L) + 1; c++) {
        if (!inside({ c, r }) || isWallIn(G, c, r)) continue; const d = dist3(G, a, { c, r }); if (d <= N + 0.01) near.add(c + "," + r); else if (d <= L + 0.01) far.add(c + "," + r); }
      const f = tiles(near, TMAT.fill, 0.09); if (f) tgtGrp.add(f);
      tgtGrp.add(edgeLines(near, TMAT.edge)); if (far.size) tgtGrp.add(edgeLines(new Set([...near, ...far]), TMAT.long, 0.12));
    }
    const fogOn = opts.fogState ? opts.fogState() : null;
    for (const g of TG.targets || []) {
      const t = m.tokens.find(x => x.id === g.id), rec = toks.get(g.id); if (!t || (g.ally && !g.picked)) continue;
      if (fogOn && t.kind !== "pc" && !fogOn.vis.has(t.c + "," + t.r)) continue;
      const ok = g.state === "ok" || g.state === "long";
      const r = new THREE.Mesh(ringGeoT, ok ? TMAT.ring : TMAT.bad); r.position.set(cx(t.c), ty(t) + 0.2, cz(t.r)); r.scale.setScalar((t.size || 1) * (g.picked ? 1.12 : 1)); r.renderOrder = 7; r.userData.pulse = ok; tgtGrp.add(r);
      if (TG.kind === "pick") continue;
      const txt = chipText(g, TG.odds);
      const sp = chip(txt, colors().target, !ok); sp.position.set(cx(t.c), ty(t) + ((rec && rec.h) || 4) + 0.35, cz(t.r));
      sp.center.set(0.5, -(PLATE_H / 0.03) - 0.2); tgtGrp.add(sp); // justo encima de su placa (las dos tienen tamaño fijo en pantalla)
    }
  }

  // ---------- Regla: medir distancias (cada diagonal cuenta 1,5 m) ----------
  let measuring = false, measure = null; const rulerG = new THREE.Group(); scene.add(rulerG);
  const rulerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, depthTest: false });
  function drawRuler(a, b) {
    rulerG.children.slice().forEach(o => { rulerG.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== rulerMat) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    if (!a) return;
    const A = new THREE.Vector3(cx(a.c), 0.45, cz(a.r)), B = new THREE.Vector3(cx(b.c), 0.45, cz(b.r)), len = A.distanceTo(B);
    [A, B].forEach(p => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24), rulerMat); d.position.copy(p); d.renderOrder = 12; rulerG.add(d); });
    if (len > 0.01) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, len, 8), rulerMat); l.position.copy(A).lerp(B, 0.5); l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); l.renderOrder = 12; rulerG.add(l); }
    const n = dist(a, b), c = document.createElement("canvas"), g = c.getContext("2d"); c.width = 256; c.height = 72;
    g.fillStyle = "rgba(17,14,12,.92)"; g.strokeStyle = "#ffe08a"; g.lineWidth = 3; g.beginPath(); g.roundRect(4, 4, 248, 64, 32); g.fill(); g.stroke();
    g.fillStyle = "#ffe08a"; g.font = "700 34px Georgia, serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${(n * 1.5).toLocaleString("es-ES")} m · ${n}`, 128, 38);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(7, 1.97, 1); sp.position.copy(A).lerp(B, 0.5); sp.position.y = 2.4; sp.renderOrder = 13; rulerG.add(sp);
  }

  // ---------- Interacción: seleccionar y arrastrar miniaturas ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let drag = null, down = null;
  const setNdc = e => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
  // Con alturas se apunta al suelo de verdad (lo alto de un risco), no a un plano a ras de mesa
  const cellAt = () => { const f = pickFloors.length && hasElev(G) ? ray.intersectObjects(pickFloors, false)[0] : null; if (f) hit.copy(f.point); else if (!ray.ray.intersectPlane(ground, hit)) return null; return { c: Math.floor(hit.x / CELL + G.cols / 2), r: Math.floor(hit.z / CELL + G.rows / 2) }; };
  const tokenAt = () => {
    const hits = ray.intersectObjects(tokGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.tok) o = o.parent; if (o) return o.userData.tok; }
    return null;
  };
  function pickPreview(e) {
    setNdc(e); const h = cellAt(); if (!h || !inside(h)) { pickRing.visible = hl.visible = false; return; }
    const R = pickMode.area;
    if (R) { pickRing.visible = true; pickRing.scale.setScalar((R + 0.5) * CELL); pickRing.position.x = cx(h.c); pickRing.position.z = cz(h.r); hl.visible = false; }
    else { hl.visible = true; hl.position.x = cx(h.c); hl.position.z = cz(h.r); hl.material.color.set(0xff8a3a); }
  }
  renderer.domElement.addEventListener("pointermove", e => { if (pickMode && !drag) pickPreview(e);
    if (TG && TG.kind === "tmpl" && !drag) { setNdc(e); const h = cellAt(); const n = h && inside(h) ? h : null; if (!n !== !tmplHover || (n && (n.c !== tmplHover.c || n.r !== tmplHover.r))) { tmplHover = n; drawTargeting(); } } });
  renderer.domElement.addEventListener("pointerdown", e => {
    if (!G) return;
    if (TG && TG.kind === "tmpl" && e.button === 0 && opts.onTemplate) { setNdc(e); const h = cellAt(); if (h && inside(h)) { opts.onTemplate(h); e.stopPropagation(); return; } }
    if (pickMode) { setNdc(e); const h = cellAt(); const pm = pickMode; pickMode = null; pickRing.visible = hl.visible = false; renderer.domElement.style.cursor = ""; if (h && inside(h)) pm.cb(h); else pm.cb(null); e.stopPropagation(); return; }
    if (measuring) { setNdc(e); const h = cellAt(); if (h && inside(h)) { measure = { a: h, b: h }; drawRuler(h, h); controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); } return; }
    setNdc(e); down = { x: e.clientX, y: e.clientY };
    const id = tokenAt(), t = id && opts.model().tokens.find(k => k.id === id);
    if (!t && opts.dm) {
      const dh = ray.intersectObjects(world.children, true).find(h => h.object.userData.door);
      if (dh) { const did = dh.object.userData.door; opts.mutate("board", mm => { const pr = (mm.grid.props || []).find(x => x.id === did); if (pr) pr.open = !pr.open; }); sound.play("door"); return; }
      const ph = opts.onProp && ray.intersectObjects(world.children, true).find(h => h.object.userData.prop);
      if (ph) { const pr = (G.props || []).find(x => x.id === ph.object.userData.prop); if (pr && (PROPS[pr.k] || {}).loot || pr && (PROPS[pr.k] || {}).trap || pr && pr.hidden || pr && pr.label) { opts.onProp(pr); return; } }
    }
    if (t && opts.canMove(t)) { drag = { id, from: { c: t.c, r: t.r }, moved: false, t0: performance.now() }; controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); if (reachFor !== id) showReach(id); }
    else if (t) down.tok = id;
  });
  renderer.domElement.addEventListener("pointermove", e => {
    if (measure) { setNdc(e); const h = cellAt(); if (h && inside(h) && (h.c !== measure.b.c || h.r !== measure.b.r)) { measure.b = h; drawRuler(measure.a, h); } return; }
    if (!drag) return;
    setNdc(e);
    // Un clic con algo de temblor no es un arrastre: hace falta desplazar el ratón de verdad
    if (!drag.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 16) return;
    drag.moved = true;
    const h = cellAt(); if (!h) return;
    const rec = toks.get(drag.id);
    if (rec && rec.root) { rec.root.position.set(hit.x, hit.y + 1.2, hit.z); rec.target.copy(rec.root.position); }
    const ok = reachR ? reachR.cells.has(h.c + "," + h.r) && !reachR.cells.get(h.c + "," + h.r).occ : !isWall(h.c, h.r);
    if (inside(h)) { hl.visible = true; hl.position.x = cx(h.c); hl.position.z = cz(h.r); hl.material.color.set(ok ? 0xd6aa4e : 0xb33a2e); }
    if (!drag.last || drag.last.c !== h.c || drag.last.r !== h.r) { drag.last = h; showPath(h); }
    const d = dist(drag.from, h);
    tip.hidden = false; tip.textContent = (reachR ? moveHint(reachR, h.c, h.r) : `${(d * 1.5).toLocaleString("es-ES")} m (${d} casillas)`) + (pathOA.length ? ` · ⚠ provocas ataque de oportunidad: ${pathOA.join(", ")} (Destrabarse lo evita)` : "");
    const r = host.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 14) + "px"; tip.style.top = (e.clientY - r.top + 14) + "px";
  });
  const up = e => {
    controls.enabled = true; hl.visible = false; tip.hidden = true;
    if (measure) { measure = null; return; } // la medida se queda a la vista hasta la siguiente
    if (drag) {
      const d = drag; drag = null;
      setNdc(e); const h = cellAt(), rec = toks.get(d.id);
      // Seleccionar no mueve: si apenas se arrastró, o se soltó en su casilla, la figura vuelve a su sitio
      const quick = performance.now() - d.t0 < 250 && h && dist(d.from, h) <= 1;
      if (!d.moved || quick || (h && h.c === d.from.c && h.r === d.from.r)) {
        if (rec && rec.root) { rec.root.position.set(cx(d.from.c), gy(d.from.c, d.from.r), cz(d.from.r)); rec.target.copy(rec.root.position); }
        showPath(null); select(d.id); return;
      }
      const shut = (G.props || []).some(pr => isDoor(pr) && !pr.open && pr.c === h?.c && pr.r === h?.r);
      if (h && inside(h) && !isWall(h.c, h.r) && (!shut || opts.dm)) {
        if (rec && rec.root) { rec.root.position.set(cx(h.c), gy(h.c, h.r), cz(h.r)); rec.target.copy(rec.root.position); }
        opts.mutate("token", mm => { const k = mm.tokens.find(z => z.id === d.id); if (k) { k.c = h.c; k.r = h.r; } });
      } else if (rec && rec.root) { rec.root.position.set(cx(d.from.c), gy(d.from.c, d.from.r), cz(d.from.r)); rec.target.copy(rec.root.position); }
      select(d.id); return;
    }
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) select(down.tok || null);
    down = null;
  };
  renderer.domElement.addEventListener("pointerup", up);
  renderer.domElement.addEventListener("pointercancel", () => { showPath(null); drag = null; controls.enabled = true; hl.visible = false; tip.hidden = true; });
  function select(id) { selected = id; opts.onSelect && opts.onSelect(id); sync(); }
  function refreshReach() { try { if (drag) return; const id = selected && opts.reach && opts.reach(selected) ? selected : null; showReach(id); showPath(null); } catch (e) { /* aún montándose */ } }

  // ---------- Bucle de dibujo ----------
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    clearTimeout(resize.t); resize.t = setTimeout(() => { if (!disposed && G) sync(); }, 150); // placas nítidas al nuevo tamaño
  }
  const ro = new ResizeObserver(resize); ro.observe(host);
  const fwd = new THREE.Vector3(), side = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    if (!host.isConnected) return dispose();
    const dt = Math.min(0.05, clock.getDelta()), time = clock.elapsedTime;
    if (free && keys.size) {
      camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); side.crossVectors(fwd, camera.up);
      const s = dt * 30, mv = new THREE.Vector3();
      if (keys.has("w") || keys.has("arrowup")) mv.add(fwd); if (keys.has("s") || keys.has("arrowdown")) mv.sub(fwd);
      if (keys.has("d") || keys.has("arrowright")) mv.add(side); if (keys.has("a") || keys.has("arrowleft")) mv.sub(side);
      mv.multiplyScalar(s); controls.target.add(mv); camera.position.add(mv);
    }
    controls.update();
    ticks.forEach(f => f(dt)); worldTicks.forEach(f => f(dt)); if (atmo) atmo.step(dt);
    if (fxList.length) fxList = fxList.filter(f => f(dt));
    // Luz de antorcha: una respiración lenta y suave (el parpadeo rápido hacía «bailar» los reflejos de las paredes)
    torches.forEach(t => { t.light.intensity = t.base * (0.95 + 0.035 * Math.sin(time * 2.1 + t.seed) + 0.015 * Math.sin(time * 4.7 + t.seed * 2)); });
    for (const rec of toks.values()) {
      if (!rec.root) continue;
      if (rec.mixer) rec.mixer.update(dt);
      if (rec.nudge || rec.flash) stepHitFx(rec, dt);
      if (rec.settle > 0) { rec.settle = Math.max(0, rec.settle - dt); const u = 1 - rec.settle / 0.3; rec.walkY = -Math.sin(u * Math.PI) * 0.09 * (1 - u * 0.5); if (!rec.settle) rec.walkY = 0; }
      if (rec.moving && (!drag || drag.id !== rec.root.userData.tok)) {
        // Hito 88: movimiento con peso. Un instante de anticipación (se agacha y se gira), paso con balanceo
        // de la miniatura (la altura sigue subiendo o bajando de forma continua) y un asiento suave al llegar.
        const p = rec.root.position, d = rec.target.clone().sub(p);
        const len = d.length(), horiz = Math.hypot(d.x, d.z);
        rec.walkT = (rec.walkT || 0) + dt;
        const turnTo = () => { if (horiz > 0.05) { const want = Math.atan2(d.x, d.z), diff = ((want - rec.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; rec.root.rotation.y += diff * Math.min(1, dt * 12); } };
        if (len < 0.08) {
          const fell = rec.startY != null && rec.startY - rec.target.y > 1.5;
          p.copy(rec.target); rec.moving = 0; rec.walkT = 0; rec.walkY = 0; if (rec.walked) { rec.settle = 0.3; puff(rec, fell); } rec.walked = false; rec.startY = null; if (!rec.down) play(rec, "Idle");
        }
        else if (rec.walkT < 0.1 && horiz > CELL * 0.6 && !rec.walked) { turnTo(); rec.walkY = -0.1 * Math.sin(rec.walkT / 0.1 * Math.PI / 2); }
        else {
          turnTo();
          p.add(d.multiplyScalar(Math.min(1, dt * 7 / Math.max(1, len / 4))));
          if (horiz > 0.05) { if (!rec.walked) { puff(rec, false); rec.startY = p.y; } rec.walked = true; rec.bob = (rec.bob || 0) + dt * 11; rec.walkY = Math.abs(Math.sin(rec.bob)) * 0.14 * Math.min(1, horiz / 2); rec.sway = Math.cos(rec.bob) * 0.07; }
          else rec.walkY = 0;
        }
      } else if (rec.face != null && !drag) {
        const diff = ((rec.face - rec.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        rec.root.rotation.y += diff * Math.min(1, dt * 4);
      }
      // contoneo lateral al andar (Hito 89), que se apaga al parar
      if (rec.mini) { const sw = rec.moving && rec.walked ? (rec.sway || 0) : 0; rec.swayZ = (rec.swayZ || 0) + (sw - (rec.swayZ || 0)) * Math.min(1, dt * 12); if (Math.abs(rec.swayZ) > 0.001 || rec.swayOn) { rec.mini.rotation.z = rec.swayZ; rec.swayOn = Math.abs(rec.swayZ) > 0.001; } }
      placeMini(rec);
      if (rec.fxT > 0) {
        rec.fxT = Math.max(0, rec.fxT - dt / 1.1); const k = 1 - rec.fxT;
        rec.pulse.visible = rec.beam.visible = rec.fxT > 0;
        rec.pulse.scale.setScalar(1 + k * 1.4); rec.pulse.material.opacity = rec.fxT * 0.95;
        rec.beam.material.opacity = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (rec.fxHeal ? 0.32 : 0.22);
        rec.beam.scale.set(1 - k * 0.3, rec.fxHeal ? 0.6 + k * 0.7 : 1, 1 - k * 0.3); rec.beam.position.y = rec.fxHeal ? 1.8 + k * 2.5 : 3;
        if (rec.bar && rec.bar.userData.base) { const k = 1 + 0.18 * rec.fxT, [bx, by] = rec.bar.userData.base; rec.bar.scale.set(bx * k, by * k, 1); }
      }
      if (rec.sel && rec.sel.visible) rec.sel.material.opacity = 0.55 + 0.3 * Math.sin(time * 4);
      if (rec.turn && rec.turn.visible) rec.turn.material.opacity = 0.09 + 0.06 * Math.sin(time * 3);
      if (rec.mini && rec.mini.userData.card) {
        const pv = rec.mini.userData.pivot;
        if (!rec.down) rec.mini.rotation.y = Math.atan2(camera.position.x - rec.root.position.x, camera.position.z - rec.root.position.z) - rec.root.rotation.y;
        const want = rec.down ? -1.5 : rec.prone ? -1.1 : rec.moving ? -0.2 : 0;
        rec.tilt += (want - rec.tilt) * Math.min(1, dt * (rec.down ? 5 : 8));
        rec.hitT = Math.max(0, rec.hitT - dt * 1.6);
        pv.rotation.x = rec.tilt; pv.rotation.z = Math.sin(time * 30) * 0.3 * Math.min(1, rec.hitT);
      } else if (rec.mini) {
        if (rec.hitT > 0) rec.hitT = Math.max(0, rec.hitT - dt * 1.6);
        const want = rec.prone && !rec.down ? -1.35 : rec.moving && rec.walked ? 0.1 : 0; rec.mini.rotation.x += (want - rec.mini.rotation.x) * Math.min(1, dt * 6);
      }
    }
    // Si este equipo no llega (más de ~34 ms por imagen al principio), se baja solo a calidad normal
    if (!fpsProbe.done && fxReady) { fpsProbe.n++; fpsProbe.sum += dt; if (fpsProbe.n >= 150) { fpsProbe.done = true; if (fpsProbe.sum / fpsProbe.n > 0.034) { setQuality("normal"); toast("✨ La mesa 3D va justa en este equipo: paso a calidad normal (puedes volver a la alta con ✨)."); } } }
    if (camShake > 0) { camShake = Math.max(0, camShake - dt); const k = camShake / 0.4 * 0.35; camOff.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k); camera.position.add(camOff); }
    if (quality === "alta") { if (!bloom) { bloom = makeBloom(renderer); bloom.setStrength(BLOOM_K[ambient] ?? 0.38); } bloom.render(scene, camera); } else renderer.render(scene, camera);
    if (camOff.lengthSq()) { camera.position.sub(camOff); camOff.set(0, 0, 0); }
  });
  function dispose() {
    if (disposed) return; disposed = true;
    renderer.setAnimationLoop(null); ro.disconnect(); sound.ambient(""); controls.dispose(); env.dispose(); if (atmo) atmo.dispose(); if (bloom) bloom.dispose(); renderer.dispose();
    window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); offColors();
  }

  resize(); sync();
  // Para pruebas: posición en pantalla de una miniatura
  host.__screenOf = id => { const r = toks.get(id); if (!r || !r.root) return null; const v = r.root.position.clone(); v.y = 1; v.project(camera); const b = renderer.domElement.getBoundingClientRect(); return [b.left + (v.x + 1) / 2 * b.width, b.top + (1 - v.y) / 2 * b.height]; };
  const esc = e => { if (e.key === "Escape" && pickMode) { const pm = pickMode; pickMode = null; pickRing.visible = hl.visible = false; renderer.domElement.style.cursor = ""; pm.cb(null); } };
  window.addEventListener("keydown", esc);
  return {
    render: sync, fit: () => frame("persp"), select, resize, dispose, playEvents, get selected() { return selected; },
    /** Elegir casilla objetivo (con área opcional, en casillas). */
    pick(area, cb) { pickMode = { area, cb }; renderer.domElement.style.cursor = "crosshair"; },
    has3d: true
  };
}

export const webglOK = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } })();
