import { cloneFloors } from "../core/plantas.js";
// Escenas tácticas de ejemplo y utilidades para crear escenas nuevas.
const id = p => p + "-" + Math.random().toString(36).slice(2, 8);
const k = (c, r) => c + "," + r;
const foe = (name, c, r, hp, ac, extra = {}) => ({ id: id("t"), kind: "foe", name, c, r, hp, maxhp: hp, ac, initBonus: 1, size: 1, color: "#7a2a22", ...extra });

export function blankScene(name = "Nueva escena", place = null, cols = 16, rows = 11, fill = "piedra") {
  const terrain = {};
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) terrain[k(c, r)] = fill;
  return { id: id("esc"), name, place, cols, rows, terrain, props: [], tokens: [], start: { c: 1, r: Math.floor(rows / 2) }, ambient: "interior" };
}

function taberna() {
  const s = blankScene("Pelea en la taberna", null, 16, 11, "madera");
  for (let c = 0; c < 16; c++) { s.terrain[k(c, 0)] = "muro"; s.terrain[k(c, 10)] = "muro"; }
  for (let r = 0; r < 11; r++) { s.terrain[k(0, r)] = "muro"; s.terrain[k(15, r)] = "muro"; }
  s.terrain[k(7, 10)] = "piedra"; s.props.push({ id: id("p"), c: 7, r: 10, k: "puerta" });
  for (let c = 11; c < 15; c++) s.terrain[k(c, 3)] = "muro"; // barra
  [[3, 3], [6, 5], [3, 7], [9, 7], [8, 2]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "mesa" }));
  [[4, 3], [2, 7], [7, 5], [10, 7]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "silla" }));
  [[13, 1], [14, 2], [12, 8]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "barril" }));
  s.props.push({ id: id("p"), c: 1, r: 1, k: "hoguera" });
  [[1, 5], [14, 6], [5, 1], [10, 9]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "antorcha" }));
  [[6, 1]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "estandarte" }));
  s.props.push({ id: id("p"), c: 12, r: 2, k: "tonel" });
  s.tokens.push(foe("Bandido", 9, 4, 11, 12, { attacks: [{ name: "Cimitarra", atk: "+3", dmg: "1d6+1 cortante" }] }), foe("Bandido", 10, 6, 11, 12, { attacks: [{ name: "Cimitarra", atk: "+3", dmg: "1d6+1 cortante" }] }), foe("Bandido", 11, 5, 11, 12, { attacks: [{ name: "Ballesta ligera", atk: "+3", dmg: "1d8+1 perforante", rng: "24/96 m" }] }), foe("Matón", 12, 6, 32, 12, { initBonus: 1, attacks: [{ name: "Maza", atk: "+4", dmg: "1d6+2 contundente" }] }));
  s.start = { c: 6, r: 8 }; s.sound = "taberna";
  return s;
}

function camino() {
  const s = blankScene("Emboscada en el camino", null, 18, 12, "hierba");
  for (let c = 0; c < 18; c++) { s.terrain[k(c, 5)] = "tierra"; s.terrain[k(c, 6)] = "tierra"; }
  [[2, 1], [4, 2], [7, 1], [10, 2], [13, 1], [15, 3], [3, 9], [6, 10], [9, 9], [12, 10], [16, 9], [11, 3]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "arbol" }));
  [[5, 3], [14, 8], [8, 8]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "arbusto" }));
  [[9, 4], [12, 7]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "roca" }));
  s.tokens.push(foe("Lobo", 10, 3, 11, 13, { initBonus: 2, attacks: [{ name: "Mordisco", atk: "+4", dmg: "1d6+2 perforante" }] }), foe("Lobo", 13, 8, 11, 13, { initBonus: 2, attacks: [{ name: "Mordisco", atk: "+4", dmg: "1d6+2 perforante" }] }), foe("Lobo", 15, 5, 11, 13, { initBonus: 2, attacks: [{ name: "Mordisco", atk: "+4", dmg: "1d6+2 perforante" }] }));
  s.start = { c: 2, r: 5 }; s.ambient = "dia"; s.sound = "bosque";
  return s;
}

function puente() {
  const s = blankScene("Emboscada en el puente", "velarath", 18, 12, "hierba");
  for (let r = 0; r < 12; r++) for (let c = 8; c <= 10; c++) s.terrain[k(c, r)] = "agua";
  for (let r = 0; r < 12; r++) { s.terrain[k(7, r)] = "barro"; s.terrain[k(11, r)] = "barro"; }
  for (let c = 7; c <= 11; c++) { s.terrain[k(c, 5)] = "madera"; s.terrain[k(c, 6)] = "madera"; }
  for (let c = 0; c < 7; c++) s.terrain[k(c, 6)] = "tierra";
  for (let c = 12; c < 18; c++) s.terrain[k(c, 5)] = "tierra";
  [[13, 2], [15, 3], [14, 8], [16, 9], [3, 2], [2, 9]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "arbol" }));
  [[12, 3], [13, 8]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "roca" }));
  s.tokens.push(foe("Goblin", 12, 2, 10, 15, { initBonus: 2, attacks: [{ name: "Cimitarra", atk: "+4", dmg: "1d6+2 cortante" }, { name: "Arco corto", atk: "+4", dmg: "1d6+2 perforante", rng: "24/96 m" }], hidden: true }), foe("Goblin", 14, 7, 10, 15, { initBonus: 2, attacks: [{ name: "Cimitarra", atk: "+4", dmg: "1d6+2 cortante" }, { name: "Arco corto", atk: "+4", dmg: "1d6+2 perforante", rng: "24/96 m" }], hidden: true }),
    foe("Goblin", 13, 4, 10, 15, { initBonus: 2, attacks: [{ name: "Cimitarra", atk: "+4", dmg: "1d6+2 cortante" }, { name: "Arco corto", atk: "+4", dmg: "1d6+2 perforante", rng: "24/96 m" }] }), foe("Jefe goblin", 15, 5, 21, 17, { initBonus: 2, attacks: [{ name: "Cimitarra", atk: "+4", dmg: "2d6+2 cortante" }] }));
  s.start = { c: 2, r: 6 }; s.ambient = "dia"; s.sound = "viento";
  return s;
}

function cripta() {
  const s = blankScene("La cripta bajo el campanario", "velarath", 18, 12, "piedra");
  const wall = (c, r) => (s.terrain[k(c, r)] = "muro");
  for (let c = 0; c < 18; c++) { wall(c, 0); wall(c, 11); }
  for (let r = 0; r < 12; r++) { wall(0, r); wall(17, r); }
  for (let r = 1; r < 11; r++) if (r !== 5 && r !== 6) wall(6, r); // muro con paso doble hacia la sala
  for (let c = 11; c < 17; c++) if (c !== 13) wall(c, 4);          // cámara del tesoro, con puerta
  s.props.push({ id: id("p"), c: 13, r: 4, k: "puerta" }); s.terrain[k(13, 4)] = "piedra";
  [[3, 2], [3, 9], [9, 2], [9, 9]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "columna" }));
  [[1, 3], [1, 8], [7, 1], [7, 10], [16, 7], [12, 5]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "antorcha" }));
  [[14, 2]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "cofre" }));
  [[12, 1], [16, 1]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "velas" }));
  [[10, 7], [4, 5]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "calavera" }));
  [[15, 9], [16, 10]].forEach(([c, r]) => s.props.push({ id: id("p"), c, r, k: "barril" }));
  s.props.push({ id: id("p"), c: 8, r: 10, k: "trampa" });
  s.tokens.push(foe("Esqueleto", 9, 4, 13, 13, { attacks: [{ name: "Espada corta", atk: "+5", dmg: "1d6+3 perforante" }, { name: "Arco corto", atk: "+5", dmg: "1d6+3 perforante", rng: "24/96 m" }] }), foe("Esqueleto", 10, 7, 13, 13, { attacks: [{ name: "Espada corta", atk: "+5", dmg: "1d6+3 perforante" }] }),
    foe("Esqueleto arquero", 15, 6, 13, 13, { initBonus: 3, attacks: [{ name: "Arco corto", atk: "+5", dmg: "1d6+3 perforante", rng: "24/96 m" }] }), foe("Nigromante", 14, 8, 22, 12, { initBonus: 2, attacks: [{ name: "Rayo de escarcha", atk: "+5", dmg: "2d8 frío", rng: "18 m" }, { name: "Daga", atk: "+3", dmg: "1d4+1 perforante" }] }),
    foe("Guardián de la cripta", 14, 2, 45, 16, { hidden: true, size: 1.3, icon: "nomuerto", attacks: [{ name: "Espadón", atk: "+6", dmg: "2d6+4 cortante" }] }));
  s.start = { c: 2, r: 5 }; s.ambient = "noche"; s.sound = "mazmorra";
  return s;
}

export const exampleScenes = () => [taberna(), camino(), cripta(), puente()];

/** Copia una escena preparada a la mesa en directo, colocando al grupo en su punto de inicio. */
export function sceneToBoard(scene, characters, keepPCs) {
  const floors = cloneFloors(scene, { newIds: true });
  const board = { scene: scene.id, name: scene.name, cols: scene.cols, rows: scene.rows, terrain: { ...scene.terrain }, props: scene.props.map(p => ({ ...p })), ambient: scene.ambient || "interior", sound: scene.sound || "", turn: null, round: 0, ...(floors ? { floors, floor: scene.floor || 0 } : {}) };
  const foes = scene.tokens.map(t => ({ ...t, id: id("t"), init: null }));
  const spots = ring(scene.start || { c: 1, r: 1 }, scene);
  const pcs = characters.map((ch, i) => {
    const old = keepPCs && keepPCs.find(t => t.char === ch.id);
    const at = spots[i] || spots[spots.length - 1] || { c: 0, r: 0 };
    return { id: old ? old.id : id("t"), kind: "pc", char: ch.id, owner: ch.owner || null, name: ch.name, c: at.c, r: at.r, size: 1, init: null, conds: old && old.conds ? old.conds : [] };
  });
  return { board, tokens: [...pcs, ...foes] };
}
function ring(start, scene) {
  const out = [], seen = new Set(), wall = (c, r) => scene.terrain[k(c, r)] === "muro";
  for (let d = 0; d < 6 && out.length < 12; d++) for (let r = start.r - d; r <= start.r + d; r++) for (let c = start.c - d; c <= start.c + d; c++) {
    if (c < 0 || r < 0 || c >= scene.cols || r >= scene.rows || seen.has(k(c, r)) || wall(c, r)) continue;
    if (scene.tokens.some(t => t.c === c && t.r === r)) continue;
    seen.add(k(c, r)); out.push({ c, r });
  }
  return out;
}
