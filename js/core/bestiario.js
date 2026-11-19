// Bestiario del mundo: las criaturas del compendio con los cambios del máster (imagen, CA, PG, notas)
// y la posibilidad de subirlas o bajarlas de nivel (VD) antes de ponerlas en la mesa.
import { store } from "./store.js";
import { XP_BY_CR } from "./experiencia.js";

export const CRS = ["0", "1/8", "1/4", "1/2", ...Array.from({ length: 30 }, (_, i) => String(i + 1))];
const crNum = v => ({ "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 }[v] ?? +v);
/** Estadísticas orientativas por VD (guía del máster): CA, PG medios, bonificador de ataque, daño por asalto. */
const ROW = v => {
  const n = crNum(v);
  const ac = n < 4 ? 13 : n < 5 ? 14 : n < 8 ? 15 : n < 10 ? 16 : n < 13 ? 17 : n < 17 ? 18 : 19;
  const hp = n === 0 ? 4 : n < 1 ? [0, 21, 42, 0, 60][Math.round(n * 8) === 1 ? 1 : Math.round(n * 4)] || 60 : 63 + n * 15;
  const atk = n < 3 ? 3 : n < 4 ? 4 : n < 5 ? 5 : n < 8 ? 6 : n < 11 ? 7 : n < 16 ? 8 : n < 17 ? 9 : n < 21 ? 10 : n < 24 ? 11 : n < 27 ? 12 : n < 30 ? 13 : 14;
  const dpr = n === 0 ? 1 : n < 1 ? n * 14 : 11 + (n - 1) * 6;
  return { ac, hp, atk, dpr };
};

/** Tipo de criatura en español, para agrupar (Bestia, No muerto, Dragón…). */
export function typeOf(m) {
  const w = String(m.tipo || "").split(/[ ,]/)[0];
  return w === "Muerto" ? "No muerto" : w || "Otro";
}
export const TYPES = ["Aberración", "Bestia", "Celestial", "Cieno", "Dragón", "Elemental", "Enjambre", "Feérico", "Gigante", "Humanoide", "Infernal", "Monstruosidad", "No muerto", "Planta"];

/** La criatura con lo que el máster haya cambiado en este mundo. */
export function withCustom(s, m) {
  if (!m) return m;
  const c = (s.bestiary || {})[m.n]; if (!c) return m;
  return { ...m, ...("ca" in c && c.ca !== "" ? { ca: +c.ca } : {}), ...("pg" in c && c.pg !== "" ? { pg: +c.pg } : {}), img: c.img || null, notas: c.notas || "", custom: true };
}
export const setCustom = (name, patch) => store.commit("bestiary", s => { s.bestiary = s.bestiary || {}; s.bestiary[name] = { ...(s.bestiary[name] || {}), ...patch }; });
export const clearCustom = name => store.commit("bestiary", s => { if (s.bestiary) delete s.bestiary[name]; });

/**
 * Sube o baja una criatura a otro VD: escala sus PG, ajusta CA y bonificador de ataque, y añade o quita daño
 * por ataque según la diferencia de daño por asalto. Devuelve una copia lista para la mesa.
 */
export function scaleMonster(m, toCR) {
  if (!m || !toCR || String(toCR) === String(m.vd)) return m;
  const a = ROW(m.vd), b = ROW(toCR), k = b.hp / Math.max(1, a.hp);
  // El daño se ajusta sumando (o restando) la diferencia de daño por asalto entre ambos VD: más o menos dados,
  // manteniendo el modificador y al menos un dado. Si tiene varios ataques, el ajuste se reparte un poco.
  const nAtk = Math.max(1, (m.atk || []).length), delta = (b.dpr - a.dpr) / (nAtk > 1 ? 1.5 : 1);
  const atk = (m.atk || []).map(x => {
    const bonus = (parseInt(x.atk) || 0) + (b.atk - a.atk);
    const dmg = String(x.dmg).replace(/^(\d+)d(\d+)(\s*[+-]\s*\d+)?/, (_, n, d, p) => {
      const mod = parseInt(String(p || "0").replace(/\s/g, "")) || 0, avgDie = (+d + 1) / 2, avg = +n * avgDie + mod;
      const count = Math.max(1, Math.round((avg + delta - mod) / avgDie));
      return `${count}d${d}${mod ? (mod > 0 ? "+" : "") + mod : ""}`;
    });
    return { ...x, atk: (bonus >= 0 ? "+" : "") + bonus, dmg };
  });
  return { ...m, vd: String(toCR), ca: Math.max(5, (+m.ca || 10) + (b.ac - a.ac)), pg: Math.max(1, Math.round((+m.pg || 1) * k)), atk, scaledFrom: m.vd, xp: XP_BY_CR[String(toCR)] };
}
