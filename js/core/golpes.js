// Golpes: convierte las tiradas resueltas en «lo que se ve» en la mesa (2D o 3D), igual para todos.
// Ataque → tajo, flecha o proyectil mágico del atacante al objetivo y «¡Impacto!», «Fallo» o «¡CRÍTICO!».
// Salvaciones → «Salva» o «Falla» sobre quien la tira. El daño y la curación salen solos del cambio de PG.
import { store } from "./store.js";
import { diceAnim } from "./dados.js";

const seen = new Set();
let primed = false;
const PHYS = new Set(["cortante", "perforante", "contundente", ""]);
/** Color de cada tipo de daño (para proyectiles y chispas). */
export const DCOLOR = { fuego: "#ff7a2a", frío: "#7fe3ff", relámpago: "#fff27a", ácido: "#8aff4a", veneno: "#5fd35a", necrótico: "#a065ff", radiante: "#ffe28a",
  fuerza: "#7da0ff", psíquico: "#ff7ad9", trueno: "#9ec8ff", cortante: "#f4ecd8", perforante: "#f4ecd8", contundente: "#f4ecd8" };
export const dcolor = t => DCOLOR[(t || "").toLowerCase()] || "#f4ecd8";
const isMagic = r => !!r.spell || !PHYS.has((r.dtype || "").toLowerCase());

/**
 * Eventos nuevos desde la última llamada. La primera vez solo toma nota de lo que ya había (no repite el pasado).
 * Cada evento: { id, type: "atk" | "save", from, to, res: "hit" | "crit" | "miss" | "save" | "fail", magic, color, delay }
 */
export function combatEvents(s = store.get()) {
  const out = [], rolls = s.rolls || [];
  const wait = r => { const age = Date.now() - (r.at || 0), m = diceAnim(); return age > 4000 || m === "off" ? 0 : Math.max(0, (m === "fast" ? 1000 : 1900) - age); };
  for (const r of rolls) {
    if (r.status !== "ok" && r.status !== "mod") continue;
    const key = `${r.id}:${r.status}:${r.result || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!primed) continue;
    if (Date.now() - (r.at || 0) > 120000) continue; // algo muy antiguo que llega tarde: sin espectáculo
    const base = { id: r.id, from: r.tok, magic: isMagic(r), color: dcolor(r.dtype), delay: wait(r) };
    if (r.kind === "attack" && r.tok && r.target && r.result) out.push({ ...base, type: "atk", to: r.target, res: r.result });
    else if (r.kind === "spell" && Array.isArray(r.saves) && r.saves.length) {
      r.saves.forEach((sv, i) => out.push({ ...base, id: r.id + ":" + i, type: sv.auto ? "atk" : "save", to: sv.t, res: sv.auto ? "hit" : sv.ok ? "save" : "fail", magic: true, delay: base.delay + i * 120 }));
    } else if (r.kind === "save" && r.dc != null && r.tok && r.result && !(r.apply && r.apply.type === "shove")) out.push({ ...base, type: "save", from: null, to: r.tok, res: r.result });
  }
  primed = true;
  return out;
}

export const RES_TEXT = { hit: "¡Impacto!", crit: "¡CRÍTICO!", miss: "Fallo", save: "Salva", fail: "Falla" };
export const RES_COLOR = { hit: "#ffb15a", crit: "#ffd65a", miss: "#c9c2b4", save: "#9fd8ff", fail: "#ff8a6a" };
/** Distancia en casillas entre dos fichas (para elegir tajo cuerpo a cuerpo o proyectil). */
export const cells = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
