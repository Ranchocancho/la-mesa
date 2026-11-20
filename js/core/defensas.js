// Defensas de una criatura del SRD sacadas de su perfil: resistencias, vulnerabilidades e inmunidades (al daño
// y a estados), Regeneración, Resistencia legendaria y Resistencia mágica. Lo usan el daño, los estados y las salvaciones.
import { findMonster, norm } from "./srd.js";
import { ESTADOS } from "../data/estados.js";

const DTYPES = ["ácido", "contundente", "cortante", "frío", "fuego", "fuerza", "necrótico", "perforante", "psíquico", "radiante", "relámpago", "trueno", "veneno"];
const LABELS = "Habilidades|Resistencias|Vulnerabilidades|Inmunidades|Equipo|Sentidos|Idiomas|VD";
// Nombre del estado en el perfil → id de la mesa («cansancio» es agotamiento en la mesa)
const COND_ID = Object.fromEntries(ESTADOS.map(e => [norm(e.n.split(" (")[0]), e.id]));
COND_ID[norm("cansancio")] = "agotamiento";

const C = new Map();
/** Defensas de una ficha de criatura del compendio (null si no viene del SRD). */
export function defensesOf(t) {
  if (!t || t.kind === "pc" || !t.srd) return null;
  if (C.has(t.srd)) return C.get(t.srd);
  const m = findMonster(t.srd); if (!m) return null;
  const flat = (m.txt || "").replace(/([a-záéíóúñ])- ([a-záéíóúñ])/g, "$1$2").replace(/\s+/g, " ");
  const get = k => ((flat.match(new RegExp(`${k}: (.*?)(?= (?:${LABELS}):|$)`)) || [, ""])[1]).toLowerCase();
  const words = s => s.split(/[;,]| y /).map(x => x.trim()).filter(Boolean);
  const dmgIn = s => DTYPES.filter(d => s.includes(d));
  const inm = get("Inmunidades");
  const regen = flat.match(/Regeneración\. .*? recupera (\d+) puntos de golpe al principio de cada uno de sus turnos( si tiene al menos 1 punto de golpe)?\.(?: Si recibe daño de ([a-záéíóú]+)(?: o de ([a-záéíóú]+))?, este atributo no funcionará)?/);
  const lr = flat.match(/Resistencia legendaria \((\d+)\/día/);
  const d = {
    n: m.n,
    res: dmgIn(get("Resistencias")), vul: dmgIn(get("Vulnerabilidades")),
    inm: dmgIn(inm.includes(";") ? inm.split(";")[0] : inm),
    conds: words(inm).map(w => COND_ID[norm(w)]).filter(Boolean),
    regen: regen ? { hp: +regen[1], needsHp: !!regen[2], stop: [regen[3], regen[4]].filter(Boolean) } : null,
    lr: lr ? +lr[1] : 0,
    mr: /Resistencia mágica\. /.test(flat)
  };
  C.set(t.srd, d);
  return d;
}

/** Cómo le afecta un tipo de daño: { k: "inmune"|"resiste"|"vulnerable", txt, glos } o null. */
export function damageTraits(t, dtype) {
  const d = defensesOf(t); if (!d || !dtype) return null;
  const ty = String(dtype).toLowerCase().split(/[ +,]/)[0];
  if (d.inm.includes(ty)) return { k: "inmune", txt: `${d.n} es inmune al daño de ${ty}: no recibe daño.`, glos: "Inmunidad" };
  if (d.res.includes(ty)) return { k: "resiste", txt: `${d.n} tiene resistencia al daño de ${ty}: recibe la mitad.`, glos: "Resistencia" };
  if (d.vul.includes(ty)) return { k: "vulnerable", txt: `${d.n} es vulnerable al daño de ${ty}: recibe el doble.`, glos: "Vulnerabilidad" };
  return null;
}
/** Aplica la defensa a una cantidad de daño (SRD: la resistencia y la vulnerabilidad van después de los demás modificadores). */
export const withTraits = (amt, tr) => !tr ? amt : tr.k === "inmune" ? 0 : tr.k === "resiste" ? Math.floor(amt / 2) : tr.k === "vulnerable" ? amt * 2 : amt;
/** Acción de «decidir» sugerida para una tirada de daño según la defensa del objetivo. */
export const suggestedAction = tr => !tr ? "ok" : tr.k === "resiste" ? "half" : tr.k === "vulnerable" ? "double" : tr.k === "inmune" ? "none" : "ok";

/** ¿Es inmune a este estado? */
export function condImmune(t, condId) {
  const d = defensesOf(t); return !!(d && d.conds.includes(condId));
}
/** Resistencia legendaria: usos que le quedan hoy. */
export function lrLeft(t) {
  const d = defensesOf(t); return d && d.lr ? Math.max(0, d.lr - (+t.lrUsed || 0)) : 0;
}
/** ¿Puede regenerarse aún estando a 0 PG (como el troll)? */
export const revives = t => { const d = defensesOf(t); return !!(d && d.regen && !d.regen.needsHp && !t.regenDead); };
