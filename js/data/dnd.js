// Datos y cálculos de las reglas de D&D 2024 (SRD 5.2, CC-BY-4.0) que usa la ficha.
const uid = (p = "id") => p + "-" + Math.random().toString(36).slice(2, 9);

export const ABILITIES = [["fue", "Fuerza"], ["des", "Destreza"], ["con", "Constitución"], ["int", "Inteligencia"], ["sab", "Sabiduría"], ["car", "Carisma"]];
export const AB_SHORT = { fue: "FUE", des: "DES", con: "CON", int: "INT", sab: "SAB", car: "CAR" };

export const SKILLS = [
  ["acrobacias", "Acrobacias", "des"], ["arcanos", "Arcanos", "int"], ["atletismo", "Atletismo", "fue"],
  ["engano", "Engaño", "car"], ["historia", "Historia", "int"], ["interpretacion", "Interpretación", "car"],
  ["intimidacion", "Intimidación", "car"], ["investigacion", "Investigación", "int"], ["juegomanos", "Juego de manos", "des"],
  ["medicina", "Medicina", "sab"], ["naturaleza", "Naturaleza", "int"], ["percepcion", "Percepción", "sab"],
  ["perspicacia", "Perspicacia", "sab"], ["persuasion", "Persuasión", "car"], ["religion", "Religión", "int"],
  ["sigilo", "Sigilo", "des"], ["supervivencia", "Supervivencia", "sab"], ["animales", "Trato con animales", "sab"]
];

// Clase → dado de golpe y característica de lanzamiento de conjuros (null si no lanza)
export const CLASSES = {
  "Bárbaro": { hd: 12, cast: null, saves: ["fue", "con"] },
  "Bardo": { hd: 8, cast: "car", saves: ["des", "car"] },
  "Brujo": { hd: 8, cast: "car", saves: ["sab", "car"] },
  "Clérigo": { hd: 8, cast: "sab", saves: ["sab", "car"] },
  "Druida": { hd: 8, cast: "sab", saves: ["int", "sab"] },
  "Explorador": { hd: 10, cast: "sab", saves: ["fue", "des"] },
  "Guerrero": { hd: 10, cast: null, saves: ["fue", "con"] },
  "Hechicero": { hd: 6, cast: "car", saves: ["con", "car"] },
  "Mago": { hd: 6, cast: "int", saves: ["int", "sab"] },
  "Monje": { hd: 8, cast: null, saves: ["fue", "des"] },
  "Paladín": { hd: 10, cast: "car", saves: ["sab", "car"] },
  "Pícaro": { hd: 8, cast: null, saves: ["des", "int"] }
};
export const classInfo = cls => CLASSES[cls] || CLASSES[Object.keys(CLASSES).find(k => cls && k.toLowerCase().startsWith(cls.toLowerCase().slice(0, 4)))] || { hd: 8, cast: null, saves: [] };

// Experiencia necesaria para cada nivel (1 a 20)
export const XP = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const xpFor = lvl => XP[Math.min(20, Math.max(1, lvl)) - 1];
export const canLevelUp = c => c.level < 20 && (c.xp || 0) >= xpFor(c.level + 1);
/** El máster decide cuándo se sube (al terminar la escena o la sesión): solo con su permiso. */
export const levelGranted = c => c.level < 20 && (+c.lvlGrant || 0) > c.level;

export const mod = score => Math.floor(((+score || 10) - 10) / 2);
export const sign = n => (n >= 0 ? "+" : "−") + Math.abs(n);
export const prof = lvl => 2 + Math.floor((Math.max(1, lvl) - 1) / 4);
export const skillBonus = (c, key, ab) => mod(c.abilities[ab]) + prof(c.level) * ((c.skills || {})[key] || 0);
export const saveBonus = (c, ab) => mod(c.abilities[ab]) + ((c.saves || []).includes(ab) ? prof(c.level) : 0);
export const passive = (c, key, ab) => 10 + skillBonus(c, key, ab);
export const carried = c => (c.inventory || []).reduce((t, i) => t + (+i.weight || 0) * (+i.qty || 1), 0) + (c.weapons || []).reduce((t, w) => t + (+w.weight || 0), 0);
export const capacity = c => (+c.abilities.fue || 10) * 7.5; // kg (regla 2024: Fuerza × 7,5 kg)

/** Qué revisar al llegar a un nivel (recordatorios generales de las reglas 2024). */
export function levelNotes(cls, lvl) {
  const n = [`Nuevos rasgos de ${cls || "tu clase"} de nivel ${lvl}: búscalos en la tabla de tu clase.`];
  if (lvl === 3) n.push("Nivel 3: eliges subclase.");
  if ([4, 8, 12, 16].includes(lvl)) n.push("Mejora de característica (+2 a una o +1 a dos) o una dote.");
  if (lvl === 19) n.push("Nivel 19: dote de don épico.");
  if ([5, 9, 13, 17].includes(lvl)) n.push(`Tu bonificador de competencia sube a ${sign(prof(lvl))}.`);
  if (classInfo(cls).cast) n.push("Revisa tus espacios de conjuro y los conjuros que puedes preparar.");
  return n;
}

export function newCharacter(base = {}) {
  const cls = base.cls || "Guerrero", info = classInfo(cls);
  return {
    id: uid("pj"), owner: null, name: "Nuevo personaje", species: "", cls, subclass: "", background: "",
    level: 1, xp: 0, initials: "", color: "#8a9a4a", portrait: null, alignment: "",
    abilities: { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
    saves: [...info.saves], skills: {},
    hp: { max: info.hd, cur: info.hd, temp: 0 }, ac: 10, speed: 9, hdUsed: 0,
    weapons: [], inventory: [], coins: { po: 0, pp: 0, pe: 0, pc: 0 },
    spells: { slots: {}, list: [] },
    features: [], languages: "Común", proficiencies: "", notes: "",
    ...base
  };
}
