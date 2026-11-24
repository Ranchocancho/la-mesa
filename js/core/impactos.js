// Impactos (Hito 79): cuando a alguien le cambian los PG, ¿quién ha sido y con qué?
// Lo deduce de las tiradas compartidas (todos ven lo mismo): la tirada de daño, de curación o el conjuro
// más reciente que tenga a esa figura como objetivo. Si no hay ninguna (el máster lo cambió a mano), es «Máster».
import { dcolor } from "./golpes.js";

const RECENT = 20000;
const PHYS = new Set(["cortante", "perforante", "contundente", ""]);

/** La tirada que explica el cambio de PG de `id` (o null). `heal`: si fue curación. */
export function causeOf(s, id, heal) {
  const now = Date.now(), rolls = s.rolls || [];
  for (let i = rolls.length - 1; i >= 0; i--) {
    const r = rolls[i];
    if (!r || r.status === "void" || now - (r.at || 0) > RECENT) continue;
    if (heal) {
      if (r.kind === "heal" && (r.target === id || (!r.target && r.tok === id))) return r;
      continue;
    }
    if (r.kind === "damage" && r.target === id) return r;
    if (r.kind === "spell" && Array.isArray(r.saves) && r.saves.some(sv => sv.t === id)) return r;
    if (r.kind === "attack" && r.target === id && (r.result === "hit" || r.result === "crit")) return r;
  }
  return null;
}

/**
 * Lo que hay que enseñar de un cambio de PG: { d, heal, by (id de ficha o null), dtype, color, crit, round }.
 * `color` es el del tipo de daño (los físicos, rojo); para curar, verde.
 */
export function impactOf(s, id, before, after) {
  const d = after - before, heal = d > 0, r = causeOf(s, id, heal);
  const dtype = r && r.dtype ? String(r.dtype).toLowerCase() : "";
  const color = heal ? "#7dff9a" : PHYS.has(dtype) ? "#ff5a48" : dcolor(dtype);
  return { d, heal, by: r ? r.tok || null : null, manual: !r, dtype, color, crit: !!(r && r.crit),
    round: s.board && s.board.combat === "live" ? s.board.round || 1 : null, at: Date.now() };
}
