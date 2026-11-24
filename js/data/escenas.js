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

/* ---------- Escenas de ejemplo (criaturas del SRD 5.2.1 con sus estadísticas y acciones reales) ---------- */
// [PG, CA, iniciativa, velocidad (m), VD, tamaño] tomados de cada perfil del SRD (velocidad: la mayor que tenga)
const SRD = {
  "Gárgola": [67, 15, 2, 18, "2", 1], "Diablillo": [21, 13, 3, 12, "1", 0.5], "Mago": [81, 15, 2, 9, "6", 1], "Esqueleto": [13, 14, 3, 9, "1/4", 1],
  "Guerrero veterano": [65, 17, 3, 9, "3", 1], "Berserker": [67, 13, 1, 9, "2", 1], "Pendenciero": [32, 12, 1, 9, "1/2", 1], "Sacerdote": [38, 13, 0, 9, "2", 1],
  "Zombi": [15, 8, -2, 6, "1/4", 1], "Gul": [22, 12, 2, 9, "1", 1], "Ghast": [36, 13, 3, 9, "2", 1], "Tumulario": [82, 14, 4, 9, "3", 1],
  "Jefe goblin": [21, 17, 2, 9, "1", 0.7], "Guerrero goblin": [10, 15, 2, 9, "1/4", 0.7], "Lobo terrible": [22, 14, 2, 15, "1", 1.6],
  "Guerrero osgo": [33, 14, 2, 9, "1", 1], "Ogro": [68, 11, -1, 12, "2", 1.6],
  // Hito 90: más criaturas para las escenas nuevas
  "Sombra": [27, 12, 2, 12, "1/2", 1], "Espectro": [22, 12, 2, 15, "1", 1], "Araña gigante": [26, 14, 3, 9, "1", 1.6], "Mimeto": [58, 12, 3, 6, "2", 1],
  "Troll": [94, 15, 1, 9, "5", 1.6], "Oso lechuza": [59, 13, 1, 12, "3", 1.6], "Enjambre de murciélagos": [11, 12, 2, 9, "1/4", 1.6],
  "Bandido": [11, 12, 1, 9, "1/8", 1], "Capitán bandido": [52, 15, 3, 9, "2", 1], "Espía": [27, 12, 4, 9, "1", 1], "Jefe pendenciero": [82, 16, 2, 9, "4", 1],
  "Centinela azer": [39, 17, 1, 9, "2", 1], "Magmin": [13, 14, 2, 9, "1/2", 0.7], "Mephit de magma": [18, 11, 1, 9, "1/2", 0.7], "Cría de dragón rojo": [75, 17, 2, 18, "4", 1],
  "Merrow": [45, 13, 2, 12, "2", 1.6], "Guerrero sahuagin": [22, 12, 0, 12, "1/2", 1], "Pirata": [33, 14, 5, 9, "1", 1], "Saga cetrina": [82, 17, 1, 9, "3", 1],
  "Cocodrilo": [13, 12, 0, 9, "1/2", 1.6], "Enjambre de insectos": [19, 11, 1, 9, "1/2", 1], "Enjambre de ratas": [14, 10, 0, 9, "1/4", 1], "Cieno gris": [22, 9, -2, 3, "1/2", 1],
  "Fanático sectario": [44, 13, 2, 9, "2", 1], "Sectario": [9, 12, 1, 9, "1/8", 1], "Huargo": [26, 13, 1, 15, "1/2", 1.6]
};
const XP = { "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300 };
/** Una criatura del SRD en la escena (name: cómo se llama en la mesa; srd: su perfil). */
function mon(srd, c, r, extra = {}) {
  const [hp, ac, ini, vel, vd, size] = SRD[srd];
  return { id: id("t"), kind: "foe", name: srd, srd, c, r, hp, maxhp: hp, ac, initBonus: ini, speed: vel, vd, xp: XP[vd], size, color: "#7a2a22", ...extra };
}
const prop = (s, k, c, r, extra = {}) => s.props.push({ id: id("p"), c, r, k, ...extra });
const rect = (s, c0, r0, c1, r1, t) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) s.terrain[k(c, r)] = t; };
/** Muros alrededor de un rectángulo (los huecos se abren después con puertas). */
const walls = (s, c0, r0, c1, r1, t = "muro") => { for (let c = c0; c <= c1; c++) { s.terrain[k(c, r0)] = t; s.terrain[k(c, r1)] = t; } for (let r = r0; r <= r1; r++) { s.terrain[k(c0, r)] = t; s.terrain[k(c1, r)] = t; } };
const door = (s, c, r, kind = "puerta", floor = "piedra", extra = {}) => { s.terrain[k(c, r)] = floor; prop(s, kind, c, r, extra); };
const trap = (s, c, r, label, t) => prop(s, "trampaoculta", c, r, { hidden: true, label, trap: { detect: 13, save: "des", half: true, ...t } });
/** Una trampa del SRD (pinchos, foso, dardos, red, techo, rocarodante): sus números salen del nivel del grupo. */
const srdTrap = (s, kind, c, r, label) => prop(s, kind, c, r, { label });
/** Alturas: el suelo de un rectángulo sube o baja `m` metros. */
const raise = (s, c0, r0, c1, r1, m) => { s.elev = s.elev || {}; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) s.elev[k(c, r)] = m; };
/** Azar con semilla: las escenas salen siempre iguales. */
const seeded = seed => { let h = 2166136261; for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; }; };
const each = (s, fn) => { for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) fn(c, r); };

/* 1 · La cripta de Morvath: se baja por unas escaleras a una cripta en ruinas; el nigromante trabaja tras su mesa de hechicería */
function cripta() {
  const s = blankScene("La cripta de Morvath el Nigromante", null, 24, 16, "muroroca");
  const R = seeded("cripta");
  // Rellano de entrada (más alto) con escaleras que bajan a la nave
  rect(s, 1, 11, 4, 14, "adoquin"); raise(s, 1, 11, 4, 14, 1.5);
  prop(s, "escaleras", 5, 12, { rot: 1, label: "Escalones gastados que bajan a la cripta" }); prop(s, "escaleras", 5, 13, { rot: 1 });
  // Nave principal, irregular: un ala derrumbada al noroeste y un ábside al noreste
  rect(s, 5, 3, 18, 14, "piedra"); rect(s, 6, 1, 11, 2, "piedra"); rect(s, 19, 2, 22, 9, "marmol");
  each(s, (c, r) => { if (c >= 5 && c <= 18 && r >= 3 && r <= 14 && R() < 0.12) s.terrain[k(c, r)] = "escombros"; });
  rect(s, 5, 3, 7, 5, "escombros"); s.terrain[k(5, 3)] = "murocaido"; s.terrain[k(6, 3)] = "murocaido"; prop(s, "estatuarota", 6, 5, { label: "Estatua derribada de un caballero" });
  s.terrain[k(17, 13)] = "muroroca"; s.terrain[k(18, 13)] = "muroroca"; s.terrain[k(18, 14)] = "muroroca"; s.terrain[k(18, 12)] = "muroroca";
  // Ábside elevado: la mesa de hechicería y el círculo ritual
  raise(s, 19, 2, 22, 9, 0.9); prop(s, "escaleras", 18, 5, { rot: 3, label: "Gradas del ábside" }); prop(s, "escaleras", 18, 6, { rot: 3 });
  prop(s, "mesaritual", 21, 5, { label: "Mesa de hechicería de Morvath", loot: "El grimorio de Morvath (libro de conjuros), 3 frascos de tinta de hueso (25 po cada uno) y una carta sellada que nombra a su maestro." });
  prop(s, "circulo", 20, 7, { label: "Círculo ritual aún encendido" }); prop(s, "caldero", 22, 8); prop(s, "estanteria", 22, 3); prop(s, "estanteria", 20, 2);
  prop(s, "cadenas", 22, 2); prop(s, "velas", 19, 3); prop(s, "velas", 19, 8); prop(s, "estandarte", 21, 2, { label: "Estandarte de la Mano Negra" });
  // Pilares con antorchas, no todos en pie
  [[8, 6], [8, 10], [12, 6], [12, 10], [16, 6]].forEach(([c, r]) => prop(s, "pilarantorcha", c, r)); prop(s, "columna", 16, 10, { label: "Columna agrietada (sin antorcha)" });
  // Nichos con sarcófagos en el muro sur y oeste; un ataúd abierto
  [[7, 14], [9, 14], [11, 14], [13, 14]].forEach(([c, r], i) => prop(s, "sarcofago", c, r, { label: i === 2 ? "Sarcófago con la tapa movida" : "Nicho funerario", ...(i === 1 ? { loot: "Un anillo de sello de oro (50 po)." } : {}) }));
  prop(s, "ataud", 14, 12, { label: "Ataúd abierto (vacío)" }); [[10, 8], [14, 4], [7, 12], [15, 9]].forEach(([c, r]) => prop(s, "huesos", c, r));
  [[9, 3], [17, 3], [5, 9]].forEach(([c, r]) => prop(s, "telarana", c, r)); prop(s, "calavera", 13, 8); prop(s, "cadenas", 5, 7, { label: "Grilletes en la pared" });
  // Cámara secreta tras el muro norte: el tesoro del nigromante
  rect(s, 13, 0, 17, 1, "piedra"); door(s, 15, 2, "puertasecreta", "piedra", { label: "Losa que gira (Sabiduría (Percepción) CD 15)" });
  prop(s, "cofre", 16, 0, { label: "Cofre de Morvath", loot: "420 po, una Poción de curación mayor, un Pergamino de conjuro (Escudo) y una daga de plata." });
  prop(s, "ataud", 13, 0, { label: "Ataúd sellado", loot: "Los restos de un paladín y su escudo de familia (75 po)." });
  srdTrap(s, "dardos", 15, 1, "Dardos envenenados ante el cofre");
  // Trampas: pinchos al pie de la escalera y un glifo en las gradas
  srdTrap(s, "pinchos", 6, 12, "Losa falsa al pie de la escalera");
  trap(s, 18, 4, "Glifo custodio de Morvath (conjuro del SRD, runas explosivas)", { dc: 14, detect: 14, dmg: "5d8", type: "frío" });
  s.tokens.push(
    mon("Mago", 21, 6, { name: "Morvath el Nigromante (Mago)" }),
    mon("Esqueleto", 18, 7, { name: "Esqueleto guardián" }), mon("Esqueleto", 18, 3, { name: "Esqueleto guardián" }),
    mon("Esqueleto", 10, 6), mon("Esqueleto", 14, 10),
    mon("Zombi", 9, 13, { hidden: true, name: "Zombi (en el nicho)" }), mon("Zombi", 11, 13, { hidden: true, name: "Zombi (en el nicho)" }),
    mon("Gul", 15, 12, { hidden: true, name: "Gul (tras el ataúd)" }),
    mon("Sombra", 6, 4, { hidden: true, name: "Sombra (entre los escombros)" }), mon("Sombra", 17, 9, { hidden: true, name: "Sombra" })
  );
  s.start = { c: 2, r: 12 }; s.ambient = "penumbra"; s.light = "dark"; s.sound = "mazmorra"; s.region = "cementerio";
  return s;
}

/* 2 · La cueva del río negro: arañas, un río que cruzar, un cofre que muerde y el troll al fondo */
function cueva() {
  const s = blankScene("La cueva del río negro", null, 26, 16, "muroroca"), R = seeded("cueva");
  // Galerías de forma orgánica
  const blobs = [[3, 12, 3.2], [6, 9, 2.6], [9, 6, 2.8], [13, 7, 3.3], [16, 10, 2.8], [19, 6, 3], [22, 9, 3.4], [10, 12, 2.2], [5, 4, 2.2], [21, 3, 2]];
  each(s, (c, r) => { if (blobs.some(([x, y, rad]) => Math.hypot(c - x, (r - y) * 1.1) < rad + R() * 0.7)) s.terrain[k(c, r)] = "cueva"; });
  // El río: cruza de norte a sur; fondo en el centro, orillas de barro
  for (let r = 0; r < 16; r++) { const c = 14 + Math.round(Math.sin(r / 3) * 1.6); [-2, -1, 0, 1, 2].forEach(d => { const cc = c + d, t = s.terrain[k(cc, r)]; if (!t) return; s.terrain[k(cc, r)] = Math.abs(d) === 2 ? (t === "muroroca" ? t : "barro") : Math.abs(d) === 1 ? "agua" : "aguaprof"; }); }
  // Cruces: piedras en un vado y un puente de tablones más arriba
  const rc = r => 14 + Math.round(Math.sin(r / 3) * 1.6);
  [-1, 0, 1].forEach(d => { s.terrain[k(rc(11) + d, 11)] = d ? "agua" : "agua"; prop(s, "piedrasrio", rc(11) + d, 11, { label: d === 0 ? "Vado de piedras resbaladizas" : "" }); });
  [-1, 0, 1].forEach(d => prop(s, "puente", rc(5) + d, 5, { label: d === 0 ? "Puente de cuerda podrida" : "" }));
  // Zona de las arañas (oeste): telarañas y capullos
  [[4, 3], [6, 4], [5, 6], [3, 5], [7, 7]].forEach(([c, r]) => { if (s.terrain[k(c, r)] === "cueva") prop(s, "telarana", c, r); });
  prop(s, "huesos", 6, 5, { label: "Capullo con los restos de un explorador", loot: "Una bolsa con 35 po y un mapa a medio dibujar de la cueva." });
  // Setas y cristales que alumbran, estalagmitas que dan cobertura
  [[2, 12], [4, 13], [9, 12], [11, 13]].forEach(([c, r]) => s.terrain[k(c, r)] === "cueva" && prop(s, "setas", c, r));
  [[18, 4], [21, 2], [24, 9], [19, 8]].forEach(([c, r]) => s.terrain[k(c, r)] === "cueva" && prop(s, "cristales", c, r));
  [[8, 6], [10, 8], [12, 5], [17, 11], [20, 11], [23, 6]].forEach(([c, r]) => s.terrain[k(c, r)] === "cueva" && prop(s, "estalagmita", c, r));
  // Un nicho con un «cofre»… que es un mimeto
  prop(s, "huesos", 10, 11); s.terrain[k(10, 13)] = "cueva";
  // Guarida del troll (este, algo más alta): huesos, botín y su cofre de verdad
  raise(s, 20, 6, 25, 12, 0.6); prop(s, "rampa", 19, 9, { rot: 1, label: "Pendiente hacia la guarida" });
  [[22, 7], [24, 8], [21, 11], [23, 11]].forEach(([c, r]) => s.terrain[k(c, r)] === "cueva" && prop(s, "huesos", c, r));
  prop(s, "cofrefuerte", 24, 10, { label: "Cofre abollado del troll", loot: "610 po en monedas de varios reinos, una Armadura de cuero tachonado +1 y un cuerno de beber de plata (40 po)." });
  prop(s, "oro", 23, 9, { label: "Monedas desperdigadas", loot: "48 po." }); prop(s, "hoguera", 22, 9, { label: "Restos de una hoguera" });
  // Trampas: techo que se hunde en el pasadizo y un pozo escondido junto al río
  srdTrap(s, "techo", 8, 7, "Techo inestable en el pasadizo"); srdTrap(s, "foso", 12, 9, "Pozo oculto bajo el barro");
  s.tokens.push(
    mon("Araña gigante", 5, 5, { hidden: true, name: "Araña gigante (en el techo)" }), mon("Araña gigante", 7, 4, { hidden: true, name: "Araña gigante (en el techo)" }),
    mon("Enjambre de murciélagos", 13, 7), mon("Mimeto", 10, 13, { name: "Cofre viejo (Mimeto)" }),
    mon("Troll", 23, 8, { name: "Grokk, el troll del río (Troll)" })
  );
  s.start = { c: 2, r: 12 }; s.ambient = "penumbra"; s.light = "dark"; s.sound = "mazmorra";
  return s;
}

/* 3 · La torre del hechicero: cuatro plantas (vestíbulo, biblioteca, laboratorio y observatorio) */
function torreRonda(name, floor, N = 15) {
  const s = { name, cols: N, rows: N, terrain: {}, props: [], tokens: [] }, m = (N - 1) / 2;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const d = Math.hypot(c - m, r - m); s.terrain[k(c, r)] = d > m + 0.4 ? "vacio" : d > m - 0.8 ? "muro" : floor; }
  return s;
}
function torre() {
  // Planta baja · Vestíbulo: el gran círculo del suelo, dos gárgolas «decorativas» y dardos tras la puerta
  const p0 = torreRonda("Planta baja · Vestíbulo", "piedra");
  door(p0, 7, 14, "puerta", "piedra", { label: "Puerta de la torre" }); rect(p0, 6, 9, 8, 12, "alfombra");
  prop(p0, "circulo", 7, 6, { label: "Mosaico arcano del suelo" }); prop(p0, "escaleras", 7, 2, { label: "Escalera de caracol: sube a la biblioteca", toFloor: 1 });
  [[3, 4], [11, 4], [3, 10], [11, 10]].forEach(([c, r]) => prop(p0, "pilarantorcha", c, r));
  prop(p0, "estatua", 2, 7, { label: "Estatua del fundador" }); prop(p0, "estatua", 12, 7, { label: "Estatua del fundador" });
  prop(p0, "estandarte", 7, 1); prop(p0, "fuente", 7, 9, { label: "Fuente de agua que nunca se acaba" }); prop(p0, "armero", 11, 11);
  srdTrap(p0, "dardos", 7, 12, "Losa de presión tras la puerta");
  p0.tokens.push(mon("Gárgola", 4, 3, { name: "Gárgola (quieta como una estatua)" }), mon("Gárgola", 10, 3, { name: "Gárgola (quieta como una estatua)" }));
  // Primer piso · Biblioteca: estanterías en abanico, un escritorio y un orbe; un diablillo invisible
  const p1 = torreRonda("Primer piso · Biblioteca", "madera");
  rect(p1, 5, 5, 9, 9, "alfombra");
  prop(p1, "escaleras", 7, 2, { label: "Baja al vestíbulo", toFloor: 0 }); prop(p1, "escaleras", 7, 12, { label: "Sube al laboratorio", toFloor: 2 });
  [[2, 5], [2, 9], [12, 5], [12, 9], [4, 3], [10, 3], [4, 11], [10, 11]].forEach(([c, r]) => prop(p1, "estanteria", c, r));
  prop(p1, "escritorio", 7, 7, { label: "Escritorio del hechicero", loot: "Notas: «La llave de la cámara no se separa de mí». Un Pergamino de conjuro (Detectar magia)." });
  prop(p1, "silla", 7, 8); prop(p1, "orbe", 4, 7, { label: "Orbe de lectura" }); prop(p1, "orbe", 10, 7, { label: "Orbe de lectura" }); prop(p1, "velas", 6, 6);
  srdTrap(p1, "red", 7, 10, "Red mágica sobre el paso a la escalera");
  p1.tokens.push(mon("Diablillo", 10, 9, { hidden: true, name: "Diablillo (invisible)" }), mon("Espectro", 3, 7, { hidden: true, name: "Espectro del bibliotecario" }));
  // Segundo piso · Laboratorio: calderos, la mesa de experimentos y dos cienos escapados de sus frascos
  const p2 = torreRonda("Segundo piso · Laboratorio", "piedra");
  prop(p2, "escaleras", 7, 12, { label: "Baja a la biblioteca", toFloor: 1 }); prop(p2, "escaleras", 7, 2, { label: "Sube al observatorio", toFloor: 3 });
  prop(p2, "caldero", 5, 6, { label: "Caldero de transmutación" }); prop(p2, "caldero", 9, 8); prop(p2, "mesaritual", 7, 5, { label: "Mesa de experimentos", loot: "Dos Pociones de curación y un frasco de Fuego de alquimista." });
  prop(p2, "jaula", 11, 6, { label: "Jaula con un pseudodragón asustado" }); prop(p2, "cadenas", 3, 8); prop(p2, "estanteria", 3, 5); prop(p2, "barril", 11, 9);
  [[4, 10], [10, 10]].forEach(([c, r]) => prop(p2, "brasero", c, r));
  srdTrap(p2, "aguja", 7, 5, "Aguja envenenada en el cajón de la mesa");
  p2.tokens.push(mon("Cieno gris", 6, 9, { name: "Cieno gris (experimento fallido)" }), mon("Cieno gris", 9, 6, { name: "Cieno gris (experimento fallido)" }), mon("Esqueleto", 4, 9), mon("Esqueleto", 10, 5));
  // Tercer piso · Observatorio: el telescopio, el trono del hechicero y su cámara del tesoro con llave
  const p3 = torreRonda("Tercer piso · Observatorio", "marmol");
  for (let c = 2; c <= 12; c++) if (p3.terrain[k(c, 4)] !== "vacio") p3.terrain[k(c, 4)] = "muro";
  door(p3, 7, 4, "puertallave", "marmol", { label: "Cámara del tesoro (la llave la lleva el hechicero)" });
  prop(p3, "escaleras", 7, 12, { label: "Baja al laboratorio", toFloor: 2 });
  prop(p3, "cofre", 7, 2, { label: "Cofre del hechicero", loot: "350 po, un Pergamino de Bola de fuego, una Varita de proyectiles mágicos y dos Pociones de curación." });
  trap(p3, 7, 3, "Glifo custodio ante el cofre (conjuro del SRD, runas explosivas)", { dc: 14, detect: 14, dmg: "5d8", type: "relámpago" });
  [[5, 2], [9, 2]].forEach(([c, r]) => prop(p3, "velas", c, r)); prop(p3, "oro", 6, 1, { loot: "120 po." });
  prop(p3, "telescopio", 11, 8, { label: "Gran telescopio" }); prop(p3, "trono", 7, 9, { label: "Sillón del hechicero" }); prop(p3, "circulo", 7, 7);
  prop(p3, "orbe", 3, 8); [[2, 6], [12, 6]].forEach(([c, r]) => prop(p3, "pilarantorcha", c, r));
  p3.tokens.push(mon("Mago", 7, 8, { name: "Valdric, el hechicero (Mago)" }), mon("Gárgola", 4, 10), mon("Diablillo", 10, 10, { name: "Diablillo (su familiar)" }));
  const s = { id: id("esc"), name: "La torre del hechicero", place: null, cols: 15, rows: 15, terrain: p0.terrain, props: p0.props, tokens: p0.tokens,
    start: { c: 7, r: 12 }, ambient: "interior", sound: "mazmorra", floor: 0, floors: [{ name: p0.name }, p1, p2, p3] };
  return s;
}

/* 4 · La taberna de la Jarra Rota: pelea con enanos; la puerta trasera da al callejón */
function taberna() {
  const s = blankScene("Pelea en la taberna de la Jarra Rota", null, 22, 14, "madera");
  walls(s, 0, 0, 21, 13, "muromadera");
  door(s, 11, 13, "puerta", "madera"); door(s, 21, 2, "puerta", "madera", { label: "Puerta trasera (al callejón)" });
  prop(s, "pasaje", 20, 2, { label: "Salir al callejón" });
  for (let r = 1; r <= 5; r++) s.terrain[k(16, r)] = "muromadera"; door(s, 16, 3, "puerta", "piedra"); rect(s, 17, 1, 20, 5, "piedra");
  prop(s, "hoguera", 18, 2, { label: "Fogón de la cocina" }); prop(s, "caldero", 19, 2, { label: "Olla del guiso" }); prop(s, "caja", 20, 4); prop(s, "barril", 17, 5); prop(s, "mesa", 19, 4); prop(s, "basura", 17, 1);
  for (let c = 9; c <= 14; c++) prop(s, "mesalarga", c, 4, { label: c === 9 ? "La barra" : "" });
  [[10, 2], [12, 2], [14, 2]].forEach(([c, r]) => prop(s, "tonel", c, r)); [[9, 1], [11, 1], [13, 1], [15, 1]].forEach(([c, r]) => prop(s, "barril", c, r));
  prop(s, "escritorio", 14, 3, { label: "Libro de cuentas del posadero", loot: "La caja: 23 po y 40 pp." });
  prop(s, "hoguera", 1, 7, { label: "Chimenea" }); prop(s, "escaleras", 2, 1, { label: "Escalera a las habitaciones" });
  rect(s, 4, 6, 8, 10, "alfombra");
  for (let c = 4; c <= 7; c++) prop(s, "mesalarga", c, 8, { label: c === 4 ? "Mesa de los enanos" : "" });
  [[4, 7], [6, 7], [5, 9], [7, 9]].forEach(([c, r]) => prop(s, "silla", c, r));
  [[12, 7], [16, 8], [13, 10], [18, 11], [9, 11]].forEach(([c, r]) => prop(s, "mesa", c, r));
  [[11, 7], [13, 7], [17, 8], [14, 10], [19, 11], [10, 11]].forEach(([c, r]) => prop(s, "silla", c, r));
  [[0, 4], [0, 10], [21, 8], [6, 0], [18, 13]].forEach(([c, r]) => prop(s, "antorcha", c, r)); prop(s, "estandarte", 11, 0, { label: "Jarra rota colgada sobre la barra" });
  prop(s, "velas", 12, 7); prop(s, "velas", 16, 8); prop(s, "montonpaja", 20, 11, { label: "Rincón del perro" });
  s.tokens.push(
    mon("Guerrero veterano", 5, 7, { name: "Thorgrim Yunquefirme (enano)" }),
    mon("Berserker", 7, 7, { name: "Brokk Barbarroja (enano)" }),
    mon("Pendenciero", 4, 9, { name: "Durin (enano)" }), mon("Pendenciero", 6, 9, { name: "Grumli (enano)" }),
    mon("Sacerdote", 3, 8, { name: "Hilda Martillo-Santo (enana)" }),
    mon("Guerrero veterano", 8, 9, { name: "Balin Rompeyunques (enano)" }),
    mon("Pendenciero", 3, 10, { name: "Nori (enano)" }), mon("Pendenciero", 8, 7, { name: "Ori (enano)" })
  );
  s.start = { c: 11, r: 12 }; s.sound = "taberna"; s.ambient = "interior"; s.region = "ciudad";
  return s;
}

/* 5 · El callejón de la Jarra Rota, de noche: una emboscada entre cajas, basura y tejados */
function callejon() {
  const s = blankScene("Emboscada en el callejón de la Jarra Rota", null, 22, 14, "adoquin"), R = seeded("callejon");
  // Edificios: la taberna al oeste (muro de madera), un almacén al norte, casas al este y al sur
  rect(s, 0, 0, 4, 13, "muromadera"); rect(s, 5, 0, 21, 2, "muroladrillo"); rect(s, 17, 3, 21, 8, "muroladrillo"); rect(s, 5, 11, 12, 13, "muroladrillo");
  rect(s, 13, 9, 21, 13, "camino"); // sale a la calle por el sureste
  door(s, 4, 6, "puerta", "adoquin", { label: "Puerta trasera de la Jarra Rota" }); prop(s, "pasaje", 5, 6, { label: "Entrar en la taberna" });
  door(s, 11, 2, "puerta", "adoquin", { label: "Puerta del almacén" }); door(s, 17, 5, "puertallave", "adoquin", { label: "Casa del prestamista (cerrada)" });
  // Charcos de barro entre los adoquines
  each(s, (c, r) => { if (s.terrain[k(c, r)] === "adoquin" && R() < 0.08) s.terrain[k(c, r)] = "barro"; });
  // Tejado del almacén bajo (2,5 m): se sube por unas cajas apiladas
  rect(s, 13, 3, 16, 4, "piedra"); raise(s, 13, 3, 16, 4, 2.5); prop(s, "caja", 12, 4, { label: "Cajas apiladas: suben al tejadillo" }); prop(s, "escaleras", 12, 3, { rot: 1 });
  // Mobiliario de callejón
  prop(s, "farol", 8, 3, { label: "Farol de aceite" }); prop(s, "farol", 15, 10);
  prop(s, "letrero", 5, 4, { label: "Letrero de la Jarra Rota" });
  [[6, 9], [7, 9], [6, 10]].forEach(([c, r]) => prop(s, "caja", c, r)); [[9, 4], [10, 4], [14, 7]].forEach(([c, r]) => prop(s, "barril", c, r));
  prop(s, "basura", 7, 7); prop(s, "basura", 15, 7, { label: "Montón de basura (huele a muerto)" }); prop(s, "carro", 19, 10, { label: "Carro volcado" }); prop(s, "montonpaja", 16, 6);
  prop(s, "barricada", 12, 8, { label: "Tablas apoyadas" }); prop(s, "telarana", 5, 3); prop(s, "cuervos", 10, 7);
  srdTrap(s, "red", 9, 6, "Red colgada entre las ventanas");
  s.tokens.push(
    mon("Jefe pendenciero", 14, 6, { name: "Mara la Tuerta (Jefe pendenciero)" }),
    mon("Bandido", 14, 3, { name: "Bandido con ballesta (en el tejado)" }), mon("Bandido", 16, 4, { name: "Bandido con ballesta (en el tejado)" }),
    mon("Bandido", 7, 10, { hidden: true, name: "Bandido (tras las cajas)" }), mon("Bandido", 11, 9, { hidden: true, name: "Bandido (tras las tablas)" }),
    mon("Pendenciero", 9, 5, { name: "Matón de Mara (Pendenciero)" }), mon("Pendenciero", 13, 8, { name: "Matón de Mara (Pendenciero)" }),
    mon("Espía", 18, 9, { hidden: true, name: "Espía (oculto en la sombra)" }), mon("Espía", 10, 3, { hidden: true, name: "Espía (en un portal)" }),
    mon("Enjambre de ratas", 15, 8, { hidden: true, name: "Enjambre de ratas (en la basura)" })
  );
  s.start = { c: 6, r: 6 }; s.ambient = "noche"; s.sound = "lluvia"; s.region = "ciudad";
  return s;
}

/* 6 · El cementerio de la colina, de noche: lápidas, un mausoleo y muertos que no descansan */
function cementerio() {
  const s = blankScene("El cementerio de la colina", null, 22, 15, "hierba"), R = seeded("cementerio");
  walls(s, 0, 0, 21, 14, "muro"); door(s, 11, 14, "rastrillo", "camino", { label: "Verja del cementerio" }); s.props[s.props.length - 1].open = true;
  for (let r = 1; r <= 13; r++) s.terrain[k(11, r)] = "camino"; for (let c = 4; c <= 17; c++) s.terrain[k(c, 8)] = "camino";
  rect(s, 2, 2, 6, 4, "tierra"); rect(s, 13, 10, 18, 12, "tierra"); rect(s, 3, 10, 7, 12, "hierbalta");
  [[1, 1], [20, 13], [1, 13], [20, 1], [14, 13], [9, 13]].forEach(([c, r]) => s.terrain[k(c, r)] = "murocaido");
  // La colina: la parte del mausoleo queda más alta
  raise(s, 13, 1, 20, 7, 1); prop(s, "rampa", 12, 7, { rot: 1, label: "Cuesta hacia el mausoleo" });
  walls(s, 14, 1, 20, 6, "muro"); rect(s, 15, 2, 19, 5, "piedra"); door(s, 17, 6, "puerta", "piedra", { label: "Puerta del mausoleo" });
  prop(s, "sarcofago", 16, 3, { loot: "Un anillo de plata (25 po) entre los huesos." }); prop(s, "sarcofago", 18, 3); prop(s, "altar", 17, 2); [[15, 2], [19, 2]].forEach(([c, r]) => prop(s, "velas", c, r));
  prop(s, "ataud", 15, 5, { label: "Ataúd volcado" }); prop(s, "telarana", 19, 5);
  // Lápidas, cruces, tumbas abiertas y árboles muertos
  [[2, 2], [4, 2], [6, 2], [2, 4], [4, 4], [6, 4], [13, 10], [15, 10], [17, 10], [14, 12], [16, 12], [18, 12]].forEach(([c, r]) => prop(s, R() < 0.3 ? "cruz" : "lapida", c, r, { label: "Tumba" }));
  [[3, 3], [5, 3], [16, 11]].forEach(([c, r]) => prop(s, "tumbaabierta", c, r, { label: "Tumba abierta" }));
  [[8, 3], [9, 11]].forEach(([c, r]) => prop(s, "estatua", c, r, { label: "Ángel de piedra" })); prop(s, "estatuarota", 13, 4, { label: "Ángel decapitado" });
  [[1, 7], [20, 9], [8, 12], [9, 1], [20, 12]].forEach(([c, r]) => prop(s, "arbolmuerto", c, r));
  prop(s, "pozo", 8, 6, { label: "Pozo de agua bendita (seco)" }); prop(s, "cuervos", 7, 9); prop(s, "cuervos", 12, 3);
  [[5, 7], [16, 9], [3, 11]].forEach(([c, r]) => prop(s, "niebla", c, r)); prop(s, "farol", 10, 13, { label: "Farol del guarda (apagándose)" }); prop(s, "huesos", 18, 8);
  srdTrap(s, "foso", 9, 9, "Fosa abierta tapada por la maleza");
  s.tokens.push(
    mon("Zombi", 3, 3), mon("Zombi", 5, 4), mon("Zombi", 14, 11, { hidden: true, name: "Zombi (bajo tierra)" }), mon("Zombi", 17, 11, { hidden: true, name: "Zombi (bajo tierra)" }),
    mon("Esqueleto", 7, 8), mon("Esqueleto", 13, 7), mon("Esqueleto", 12, 4),
    mon("Gul", 16, 9), mon("Gul", 4, 11, { hidden: true, name: "Gul (entre la maleza)" }), mon("Ghast", 16, 4, { hidden: true }), mon("Ghast", 18, 2, { hidden: true }), mon("Tumulario", 18, 4, { hidden: true, name: "Tumulario (señor del mausoleo)" })
  );
  s.start = { c: 11, r: 12 }; s.ambient = "noche"; s.sound = "viento"; s.fog = true; s.region = "cementerio";
  return s;
}

/* 7 · Emboscada en el bosque: goblins en la maleza, huargos y un vado */
function bosque() {
  const s = blankScene("Emboscada en el bosque", null, 24, 15, "hierba");
  const road = [[0, 8], [1, 8], [2, 8], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 6], [9, 6], [10, 6], [11, 7], [12, 7], [13, 7], [14, 8], [15, 8], [16, 8], [17, 7], [18, 7], [19, 6], [20, 6], [21, 6], [22, 6], [23, 6]];
  road.forEach(([c, r]) => { s.terrain[k(c, r)] = "camino"; s.terrain[k(c, r + 1)] = "tierra"; });
  const rc = r => 15 + Math.round(Math.sin(r / 2.5) * 1.5);
  for (let r = 0; r < 15; r++) { s.terrain[k(rc(r), r)] = "agua"; if (s.terrain[k(rc(r) + 1, r)] === "hierba") s.terrain[k(rc(r) + 1, r)] = "barro"; }
  [7, 8, 9].forEach(r => prop(s, "puente", rc(r), r, { label: r === 8 ? "Puente de tablones" : "" }));
  prop(s, "piedrasrio", rc(2), 2, { label: "Vado de piedras" }); prop(s, "piedrasrio", rc(12), 12);
  [[rc(4) - 1, 4], [rc(11) - 1, 11], [rc(13) - 1, 13]].forEach(([c, r]) => { s.terrain[k(c, r)] = "juncos"; });
  rect(s, 7, 2, 12, 4, "hierbalta"); rect(s, 9, 10, 14, 12, "hierbalta"); rect(s, 19, 2, 22, 4, "hierbalta"); rect(s, 1, 1, 4, 3, "hojarasca"); rect(s, 19, 10, 23, 13, "hojarasca");
  [[1, 2], [3, 4], [5, 1], [2, 12], [4, 13], [6, 11], [12, 1], [13, 13], [17, 1], [18, 12], [21, 10], [23, 2], [20, 13], [6, 4], [8, 13]].forEach(([c, r]) => prop(s, "arbol", c, r));
  prop(s, "arbolgigante", 3, 10, { label: "Roble milenario" });
  [[8, 4], [11, 3], [10, 10], [13, 11], [20, 3]].forEach(([c, r]) => prop(s, "arbusto", c, r));
  [[16, 4], [17, 4], [5, 10], [21, 8]].forEach(([c, r]) => prop(s, "roca", c, r)); prop(s, "penasco", 18, 3, { label: "Peñasco del jefe" }); prop(s, "tocon", 7, 9);
  prop(s, "tronco", 12, 6, { label: "Árbol caído sobre el camino" }); [[2, 6], [9, 9], [22, 4]].forEach(([c, r]) => prop(s, "flores", c, r)); [[1, 11], [21, 12]].forEach(([c, r]) => prop(s, "setas", c, r));
  prop(s, "hoguera", 20, 4, { label: "Hoguera apagada del campamento" }); prop(s, "olla", 21, 3); prop(s, "huesos", 22, 3);
  trap(s, 10, 7, "Lazo de cuerda escondido", { dc: 12, dmg: "1d4", type: "contundente", detect: 13, cond: "apresado" });
  s.tokens.push(
    mon("Jefe goblin", 18, 2, { name: "Jefe goblin (en el peñasco)" }),
    mon("Guerrero goblin", 9, 3, { hidden: true, name: "Goblin (en la maleza)" }), mon("Guerrero goblin", 11, 2, { hidden: true, name: "Goblin (en la maleza)" }),
    mon("Guerrero goblin", 11, 11, { hidden: true, name: "Goblin (en la maleza)" }), mon("Guerrero goblin", 13, 12, { hidden: true, name: "Goblin (en la maleza)" }),
    mon("Lobo terrible", 21, 4, { hidden: true, name: "Huargo (lobo terrible)" }), mon("Lobo terrible", 20, 9, { hidden: true, name: "Huargo (lobo terrible)" }),
    mon("Lobo terrible", 22, 11, { hidden: true, name: "Huargo (lobo terrible)" }), mon("Lobo terrible", 1, 4, { hidden: true, name: "Huargo (lobo terrible)" }),
    mon("Guerrero osgo", 6, 3, { hidden: true, name: "Osgo (tras los árboles)" }), mon("Guerrero osgo", 7, 12, { hidden: true, name: "Osgo (tras los árboles)" }),
    mon("Ogro", 13, 5, { hidden: true, name: "Ogro (tras el árbol caído)" })
  );
  s.start = { c: 2, r: 8 }; s.ambient = "dia"; s.sound = "bosque"; s.region = "elfico";
  return s;
}

/* 8 · La forja del volcán: ruinas enanas sobre un río de lava, centinelas azer y una cría de dragón rojo sobre su tesoro */
function forja() {
  const s = blankScene("La forja bajo el volcán", null, 24, 16, "volcanica"), R = seeded("forja");
  each(s, (c, r) => { if (c === 0 || r === 0 || c === 23 || r === 15) s.terrain[k(c, r)] = "muroroca"; else if (R() < 0.12) s.terrain[k(c, r)] = "ceniza"; });
  // Río de lava que cruza en diagonal con un puente de piedra y otro colgante
  for (let c = 1; c < 23; c++) { const r = Math.round(8 + Math.sin(c / 2.5) * 1.5); [-1, 0, 1].forEach(d => { if (r + d > 0 && r + d < 15) s.terrain[k(c, r + d)] = d === 0 ? "lava" : (R() < 0.6 ? "brasas" : "lava"); }); }
  const lr = c => Math.round(8 + Math.sin(c / 2.5) * 1.5);
  [-1, 0, 1].forEach(d => prop(s, "puente", 6, lr(6) + d, { label: d === 0 ? "Puente de piedra enano (agrietado)" : "" }));
  [-1, 0, 1].forEach(d => prop(s, "puente", 17, lr(17) + d, { label: d === 0 ? "Puente colgante de cadenas" : "" }));
  // Sala de la forja (lado sur): yunques, la gran forja, estatuas de ancestros
  prop(s, "forja", 4, 12, { label: "La Gran Forja de Kaz-Durum" }); prop(s, "yunque", 6, 13); prop(s, "yunque", 8, 12); prop(s, "mesapiedra", 9, 14);
  prop(s, "ancestro", 1, 14, { label: "Ancestro enano (sin cabeza)" }); prop(s, "vagoneta", 11, 13, { label: "Vagoneta con mineral", loot: "Mineral de mithril (200 po)." }); prop(s, "puntal", 13, 13);
  prop(s, "armero", 3, 14); prop(s, "barril", 12, 14);
  // Al otro lado: géiseres, obsidiana y la guarida del dragón, en alto
  [[10, 4], [14, 3]].forEach(([c, r]) => prop(s, "geiser", c, r)); [[8, 2], [12, 4], [16, 4], [20, 7]].forEach(([c, r]) => prop(s, "obsidiana", c, r));
  raise(s, 18, 1, 22, 5, 1.5); prop(s, "rampa", 17, 3, { rot: 1, label: "Rampa de roca hacia el cubil" });
  prop(s, "oro", 20, 2, { label: "Tesoro del dragón", loot: "1.800 pp, 240 po, una corona enana (750 po) y un Anillo de resistencia (fuego)." }); prop(s, "oro", 21, 4, { loot: "90 po en monedas fundidas." });
  prop(s, "huesos", 22, 2); prop(s, "cofrefuerte", 21, 1, { label: "Arcón rúnico de los enanos", loot: "El martillo ceremonial de Kaz-Durum (Martillo de guerra +1)." });
  prop(s, "brasero", 18, 1); prop(s, "brasero", 22, 5);
  srdTrap(s, "estatuafuego", 14, 12, "Estatua de ancestro que escupe fuego");
  srdTrap(s, "rocarodante", 15, 2, "Roca suelta en la pendiente");
  s.tokens.push(
    mon("Cría de dragón rojo", 20, 3, { name: "Ascuasombra (Cría de dragón rojo)" }),
    mon("Centinela azer", 5, 11, { name: "Centinela azer de la forja" }), mon("Centinela azer", 9, 13, { name: "Centinela azer de la forja" }),
    mon("Magmin", 8, 11), mon("Magmin", 12, 11, { hidden: true, name: "Magmin (entre las brasas)" }),
    mon("Mephit de magma", 14, 4), mon("Mephit de magma", 18, 11)
  );
  s.start = { c: 2, r: 12 }; s.ambient = "interior"; s.sound = "fuego"; s.region = "volcan";
  return s;
}

/* 9 · El muelle de los contrabandistas: niebla, un barco atracado y algo que sube del agua */
function muelle() {
  const s = blankScene("El muelle de los contrabandistas", null, 24, 16, "aguaprof");
  // Tierra firme al este: almacén y calle
  rect(s, 16, 0, 23, 15, "adoquin"); walls(s, 18, 2, 23, 9, "muromadera"); rect(s, 19, 3, 22, 8, "madera");
  door(s, 18, 6, "puerta", "madera", { label: "Puerta del almacén" }); door(s, 21, 9, "puertallave", "madera", { label: "Portón del almacén (cerrado)" });
  // Embarcaderos de tablones y aguas someras junto a la orilla
  rect(s, 15, 0, 15, 15, "agua"); rect(s, 8, 4, 15, 5, "muelle"); rect(s, 6, 11, 15, 12, "muelle"); rect(s, 13, 6, 14, 10, "muelle");
  // El barco atracado: cubierta con mástil
  rect(s, 2, 5, 6, 10, "cubierta"); prop(s, "mastil", 4, 7, { label: "Mástil de «La Gaviota Negra»" }); prop(s, "mastil", 4, 9);
  prop(s, "escaleras", 7, 8, { rot: 1, label: "Pasarela al barco" }); rect(s, 7, 8, 7, 8, "pasarela");
  [[3, 6], [5, 10], [6, 6]].forEach(([c, r]) => prop(s, "barril", c, r)); prop(s, "caja", 2, 9, { label: "Cajas de contrabando", loot: "Seda de Calimport (150 po) y 6 botellas de vino élfico (10 po cada una)." });
  prop(s, "ancla", 2, 5); prop(s, "redes", 5, 5);
  // Pertrechos del muelle
  [[10, 4], [11, 4], [9, 12]].forEach(([c, r]) => prop(s, "caja", c, r)); [[12, 5], [8, 11]].forEach(([c, r]) => prop(s, "barril", c, r));
  prop(s, "redes", 13, 11); prop(s, "barca", 10, 14, { label: "Bote amarrado" }); prop(s, "barca", 12, 2); prop(s, "farol", 14, 4, { label: "Farol del embarcadero" }); prop(s, "farol", 14, 12);
  prop(s, "letrero", 16, 10, { label: "«Se prohíbe atracar de noche»" }); prop(s, "basura", 17, 13); prop(s, "carro", 17, 1);
  // Dentro del almacén: el despacho de la contrabandista
  prop(s, "escritorio", 21, 4, { label: "Libro de cuentas de la contrabandista", loot: "Un listado de sobornos a la guardia (vale más que el oro) y 85 po." });
  prop(s, "cofre", 22, 7, { label: "Arcón de pago", loot: "260 po y una Poción de respirar bajo el agua." }); [[19, 4], [19, 7], [20, 8]].forEach(([c, r]) => prop(s, "caja", c, r)); prop(s, "velas", 20, 5);
  [[3, 3], [10, 8], [20, 12]].forEach(([c, r]) => prop(s, "niebla", c, r));
  srdTrap(s, "red", 14, 8, "Red de pesca colgada sobre el embarcadero");
  s.tokens.push(
    mon("Capitán bandido", 21, 5, { name: "Capitana Sela Brea (Capitán bandido)" }),
    mon("Pirata", 4, 8, { name: "Contrabandista (Pirata)" }), mon("Pirata", 11, 5, { name: "Contrabandista (Pirata)" }), mon("Pirata", 19, 5, { name: "Contrabandista (Pirata)" }),
    mon("Guerrero sahuagin", 9, 7, { hidden: true, name: "Sahuagin (bajo el agua)" }), mon("Guerrero sahuagin", 11, 9, { hidden: true, name: "Sahuagin (bajo el agua)" }),
    mon("Merrow", 8, 14, { hidden: true, name: "Merrow (bajo el muelle)" })
  );
  s.start = { c: 18, r: 12 }; s.ambient = "noche"; s.sound = "viento"; s.region = "costa";
  return s;
}

/* 10 · La cabaña de la saga del pantano: barro, juncos, cocodrilos y un caldero que hierve */
function pantano() {
  const s = blankScene("La cabaña de la saga del pantano", null, 24, 16, "barro"), R = seeded("pantano");
  each(s, (c, r) => { const n = Math.sin(c * 0.55) + Math.cos(r * 0.7 + c * 0.2) + (R() - 0.5) * 0.8; s.terrain[k(c, r)] = n > 1 ? "aguaprof" : n > 0.45 ? "agua" : n > 0.1 ? "juncos" : n > -0.6 ? "barro" : "musgo"; });
  // Isla de la cabaña (noreste, algo más alta) y una pasarela que llega
  rect(s, 17, 2, 22, 7, "tierra"); raise(s, 17, 2, 22, 7, 0.6); rect(s, 18, 8, 18, 12, "pasarela"); rect(s, 18, 13, 20, 13, "pasarela");
  prop(s, "cabana", 20, 3, { label: "Cabaña de la saga" }); prop(s, "caldero", 19, 5, { label: "Caldero de la saga (huele a algo peor que la muerte)" });
  prop(s, "totem", 22, 6, { label: "Tótem de huesos y plumas" }); prop(s, "jaula", 17, 3, { label: "Jaula con un niño del pueblo" }); prop(s, "huesos", 21, 7);
  prop(s, "mesaritual", 22, 4, { label: "Mesa de los hechizos", loot: "Un ojo de cristal que ve lo que vio su dueño, 3 Pociones de curación y un saquito con 60 po." });
  // Camino de tierra firme desde el suroeste
  [[1, 13], [2, 13], [3, 12], [4, 12], [5, 11], [6, 11], [7, 11], [8, 12], [9, 12], [10, 12], [11, 13], [12, 13], [13, 13], [14, 13], [15, 13], [16, 13], [17, 13]].forEach(([c, r]) => s.terrain[k(c, r)] = "tierra");
  prop(s, "tronco", 12, 13, { label: "Tronco caído sobre el camino" }); prop(s, "piedrasrio", 16, 13, { label: "Piedras hasta la pasarela" });
  // Manglares, nenúfares, niebla y una barca
  [[3, 4], [7, 2], [11, 5], [14, 9], [5, 8], [9, 9], [2, 10], [21, 11], [15, 3]].forEach(([c, r]) => { if (s.terrain[k(c, r)] === "aguaprof") s.terrain[k(c, r)] = "agua"; prop(s, "manglar", c, r); });
  [[8, 5], [12, 8], [6, 6], [16, 10]].forEach(([c, r]) => prop(s, "nenufares", c, r)); [[4, 6], [13, 6], [19, 10], [9, 3]].forEach(([c, r]) => prop(s, "niebla", c, r));
  prop(s, "barca", 10, 7, { label: "Barca hundida a medias" }); [[6, 13], [14, 12]].forEach(([c, r]) => { s.terrain[k(c, r)] = "musgo"; prop(s, "setas", c, r); }); prop(s, "cuervos", 22, 8);
  srdTrap(s, "foso", 9, 12, "Arenas movedizas bajo el barro"); srdTrap(s, "red", 17, 11, "Red de la saga sobre la pasarela");
  s.tokens.push(
    mon("Saga cetrina", 20, 5, { name: "Madre Ciénaga (Saga cetrina)" }),
    mon("Cocodrilo", 11, 9, { hidden: true, name: "Cocodrilo (bajo el agua)" }), mon("Cocodrilo", 15, 7, { hidden: true, name: "Cocodrilo (bajo el agua)" }), mon("Cocodrilo", 7, 7, { hidden: true, name: "Cocodrilo (bajo el agua)" }),
    mon("Enjambre de insectos", 13, 11), mon("Enjambre de insectos", 19, 9, { name: "Enjambre de mosquitos (Enjambre de insectos)" }),
    mon("Ogro", 18, 7, { name: "Bruto del pantano, siervo de la saga (Ogro)" })
  );
  s.start = { c: 2, r: 13 }; s.ambient = "penumbra"; s.sound = "lluvia"; s.region = "pantano";
  return s;
}

/** ex: versión de las escenas de ejemplo (3 = diez escenas, equilibradas para 4 PJ de nivel 5). */
export const EX_VER = 3;
export const exampleScenes = () => {
  const L = [cripta(), cueva(), torre(), taberna(), callejon(), cementerio(), bosque(), forja(), muelle(), pantano()].map(sc => Object.assign(sc, { id: sc.id || id("esc"), ex: EX_VER }));
  // La taberna y el callejón se unen por la puerta trasera (pasajes entre escenas)
  const tab = L.find(x => x.name.startsWith("Pelea en la taberna")), cal = L.find(x => x.name.startsWith("Emboscada en el callejón"));
  Object.assign(tab.props.find(p => p.k === "pasaje"), { to: cal.id, toName: cal.name }); Object.assign(cal.props.find(p => p.k === "pasaje"), { to: tab.id, toName: tab.name });
  return L;
};

/** Criaturas con el mismo nombre: «Goblin (en la maleza)» ×4 → «Goblin 1 (en la maleza)», «Goblin 2…», para distinguirlas. */
export function numberDupes(tokens) {
  const groups = {};
  const base = n => String(n).replace(/\s*\(.*\)$/, "").trim();
  tokens.filter(t => t.kind !== "pc").forEach(t => (groups[base(t.name)] = groups[base(t.name)] || []).push(t));
  Object.values(groups).forEach(g => { if (g.length < 2) return; g.forEach((t, i) => { const m = String(t.name).match(/^(.*?)(\s*\(.*\))?$/); t.name = `${m[1]} ${i + 1}${m[2] || ""}`; }); });
  return tokens;
}
/** Copia una escena preparada a la mesa en directo, colocando al grupo en su punto de inicio. */
export function sceneToBoard(scene, characters, keepPCs) {
  const floors = cloneFloors(scene, { newIds: true });
  const board = { scene: scene.id, name: scene.name, cols: scene.cols, rows: scene.rows, terrain: { ...scene.terrain }, ...(scene.elev ? { elev: { ...scene.elev } } : {}), props: scene.props.map(p => ({ ...p })), ambient: scene.ambient || "interior", sound: scene.sound || "", region: scene.region || "", lavaDmg: scene.lavaDmg || "", fallH: scene.fallH || 3, turn: null, round: 0, ...(scene.light ? { light: scene.light } : {}), ...(scene.fog === false ? { fog: false } : {}), ...(floors ? { floors, floor: scene.floor || 0 } : {}) };
  const foes = numberDupes(scene.tokens.map(t => ({ ...t, id: id("t"), init: null })));
  const spots = ring(scene.start || { c: 1, r: 1 }, scene);
  const pcs = characters.map((ch, i) => {
    const old = keepPCs && keepPCs.find(t => t.char === ch.id);
    const at = spots[i] || spots[spots.length - 1] || { c: 0, r: 0 };
    return { id: old ? old.id : id("t"), kind: "pc", char: ch.id, owner: ch.owner || null, name: ch.name, c: at.c, r: at.r, size: 1, init: null, conds: old && old.conds ? old.conds : [] };
  });
  // Despliegue: el grupo se coloca por turnos dentro de la zona de inicio (core/despliegue.js)
  const st = scene.start || { c: 1, r: 1 };
  if (pcs.length) board.deploy = { id: "dp" + Date.now().toString(36), c: st.c, r: st.r, rad: +scene.deployRad || 2, on: true };
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
