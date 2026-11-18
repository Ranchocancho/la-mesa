// Reglas oficiales en español: SRD 5.2.1 (CC BY 4.0, ver CREDITS.md). Se cargan solo cuando hacen falta.
const cache = {};
export const srdNow = {}; // lo ya cargado, para usarlo sin esperar
export function srd(kind) {
  if (!cache[kind]) cache[kind] = fetch(`js/data/srd/${kind}.json`).then(r => r.json()).then(d => (srdNow[kind] = d));
  return cache[kind];
}
export const preload = () => setTimeout(() => { srd("conjuros"); srd("monstruos"); }, 1500);

export const CAPITULOS = [
  ["Cómo jugar", 5, 20], ["Creación de personajes", 21, 31], ["Clases", 32, 88], ["Trasfondos y especies", 89, 93], ["Dotes", 94, 96],
  ["Equipo", 97, 113], ["Conjuros", 114, 193], ["Glosario de reglas", 194, 210], ["Herramientas del máster", 211, 222],
  ["Objetos mágicos", 223, 277], ["Monstruos", 278, 375], ["Animales", 376, 398]
];
export const ESCUELAS = ["abjuración", "adivinación", "conjuración", "encantamiento", "evocación", "ilusión", "nigromancia", "transmutación"];
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const findSpell = name => (srdNow.conjuros || []).find(x => norm(x.n) === norm(name));
export const findMonster = name => (srdNow.monstruos || []).find(x => norm(x.n) === norm(name));
export { norm };

/** Ficha de mesa a partir de un monstruo del compendio. */
export function monsterToken(m, c, r) {
  const size = /Enorme/.test(m.tipo) ? 2.4 : /Gargantu/.test(m.tipo) ? 3 : /Grande/.test(m.tipo) ? 1.6 : /Pequeñ|Diminut/.test(m.tipo) ? 0.7 : 1;
  return { id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: "foe", name: m.n, srd: m.n, c, r, hp: m.pg, maxhp: m.pg, ac: m.ca,
    initBonus: parseInt(m.ini) || 0, size, color: "#7a2a22", attacks: m.atk.map(a => ({ name: a.name, atk: a.atk, dmg: a.dmg })) };
}
