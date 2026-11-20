// Cambios en las fichas con el visto bueno del máster.
// El jugador no edita su ficha: propone cambios (gastar monedas, añadir un objeto, cambiar una competencia…)
// y el máster los aprueba o los rechaza. Todo lo que entra y sale queda en el registro de la ficha.
// La subida de nivel (concedida por el máster) y el cuaderno de notas son del jugador y no pasan por aquí.
import { store, uid } from "./store.js";
import { currentUser, isDM } from "./session.js";
import { ABILITIES, SKILLS } from "../data/dnd.js";
import { toast } from "./ui.js";

// Lo que no es de la ficha (o es del jugador, o lleva su propio circuito)
const SKIP = new Set(["id", "owner", "proposals", "log", "lvlDraft", "levelLog", "journal", "treasures", "lvlGrant", "inspiration", "death", "hdUsed", "updatedAt", "initials", "color"]);
const LISTS = { weapons: "Armas", inventory: "Equipo", features: "Rasgos", "spells.list": "Conjuros", gallery: "Recuerdos", saves: "Salvaciones" };
const AB = Object.fromEntries(ABILITIES), SK = Object.fromEntries(SKILLS.map(([k, n]) => [k, n]));
const COIN = { po: "Oro", pp: "Plata", pe: "Electro", pc: "Cobre" };
const NAMES = { name: "Nombre", species: "Especie", cls: "Clase", subclass: "Subclase", background: "Trasfondo", alignment: "Alineamiento", level: "Nivel", xp: "PX",
  ac: "CA", speed: "Velocidad", darkvision: "Visión en la oscuridad", initBonus: "Bonificador de iniciativa", languages: "Idiomas", proficiencies: "Competencias",
  notes: "Notas", story: "Historia", portrait: "Ilustración", mini: "Miniatura 3D", "hp.max": "PG máximos", "hp.cur": "PG actuales", "hp.temp": "PG temporales" };
export function labelOf(path) {
  if (NAMES[path]) return NAMES[path];
  let m;
  if ((m = path.match(/^abilities\.(\w+)$/))) return AB[m[1]] || m[1];
  if ((m = path.match(/^coins\.(\w+)$/))) return `Monedas de ${(COIN[m[1]] || m[1]).toLowerCase()}`;
  if ((m = path.match(/^skills\.(\w+)$/))) return `Competencia en ${SK[m[1]] || m[1]}`;
  if ((m = path.match(/^spells\.slots\.(\d)\.(max|used)$/))) return `Espacios de nivel ${m[1]}${m[2] === "used" ? " gastados" : ""}`;
  return LISTS[path] || path;
}
const J = v => JSON.stringify(v === undefined ? null : v);
const isObj = v => v && typeof v === "object" && !Array.isArray(v);

/** Diferencias entre dos versiones de una ficha: [{path, from, to}] (las listas, enteras). */
export function diffChar(a, b) {
  const out = [];
  const walk = (x, y, pre) => {
    const keys = new Set([...Object.keys(x || {}), ...Object.keys(y || {})]);
    for (const k of keys) {
      const p = pre ? pre + "." + k : k;
      if (!pre && SKIP.has(k)) continue;
      const u = (x || {})[k], v = (y || {})[k];
      if (LISTS[p] || Array.isArray(u) || Array.isArray(v)) { if (J(u) !== J(v)) out.push({ path: p, from: u ?? null, to: v ?? null }); continue; }
      if (isObj(u) || isObj(v)) { walk(u, v, p); continue; }
      if (J(u) !== J(v) && !((u == null || u === "" || u === 0) && (v == null || v === "" || v === 0))) out.push({ path: p, from: u ?? null, to: v ?? null });
    }
  };
  walk(a, b, "");
  return out;
}

const itemName = x => typeof x === "string" ? (AB[x] || x) : (x && (x.name || x.n || x.text)) || "(sin nombre)";
const itemKey = (x, i) => typeof x === "string" ? x : (x && (x.id || x.name)) || "#" + i;
const fmt = v => v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "sí" : "no") : String(v).length > 60 ? String(v).slice(0, 57) + "…" : String(v);
/** Una línea legible por cambio: «Oro: 120 → 70», «Equipo: + Lanza ×1 · − Antorcha». */
export function describe(ch) {
  const L = labelOf(ch.path);
  if (Array.isArray(ch.from) || Array.isArray(ch.to)) {
    const A = ch.from || [], B = ch.to || [], ka = new Map(A.map((x, i) => [itemKey(x, i), x])), kb = new Map(B.map((x, i) => [itemKey(x, i), x]));
    const parts = [];
    B.forEach((x, i) => { const k = itemKey(x, i); if (!ka.has(k)) parts.push(`+ ${itemName(x)}${x && x.qty > 1 ? " ×" + x.qty : ""}`); });
    A.forEach((x, i) => { const k = itemKey(x, i); if (!kb.has(k)) parts.push(`− ${itemName(x)}`); });
    B.forEach((x, i) => {
      const k = itemKey(x, i), y = ka.get(k); if (!y || J(x) === J(y) || typeof x !== "object") return;
      const fs = Object.keys({ ...x, ...y }).filter(f => f !== "id" && J(x[f]) !== J(y[f]));
      parts.push(`${itemName(x)}: ${fs.map(f => `${({ qty: "cant.", name: "nombre", weight: "peso", notes: "notas", equipped: "equipado", atk: "ataque", dmg: "daño", prepared: "preparado", level: "nivel", text: "texto" })[f] || f} ${fmt(y[f])} → ${fmt(x[f])}`).join(", ")}`);
    });
    return `${L}: ${parts.join(" · ") || "reordenado"}`;
  }
  if (/^skills\./.test(ch.path)) { const W = ["sin competencia", "competente", "pericia"]; return `${L}: ${W[+ch.from || 0]} → ${W[+ch.to || 0]}`; }
  if (ch.path === "portrait") return "Ilustración nueva";
  return `${L}: ${fmt(ch.from)} → ${fmt(ch.to)}`;
}

const getP = (o, path) => path.split(".").reduce((x, k) => x == null ? x : x[k], o);
function setP(o, path, v) {
  const ks = path.split("."); let x = o;
  ks.slice(0, -1).forEach(k => { if (x[k] == null || typeof x[k] !== "object") x[k] = {}; x = x[k]; });
  x[ks[ks.length - 1]] = v;
}
const who = s => (currentUser(s) || {}).name || "¿?";
/** Apunta en el registro de la ficha (lo último primero; se guardan 200). */
export function logTo(c, s, kind, lines, extra = {}) {
  c.log = [{ id: uid("lg"), at: Date.now(), by: who(s), kind, lines, ...extra }, ...(c.log || [])].slice(0, 200);
}

/** El jugador envía sus cambios al máster. */
export function propose(charId, changes, note = "") {
  if (!changes.length) { toast("No has cambiado nada."); return false; }
  store.commit("char", s => {
    const c = s.characters.find(x => x.id === charId); if (!c) return;
    c.proposals = [...(c.proposals || []), { id: uid("prop"), at: Date.now(), by: who(s), byId: (currentUser(s) || {}).id || null, note: String(note || "").slice(0, 300), changes }];
  });
  toast("Enviado al máster: lo verá en la ficha y decidirá.");
  return true;
}
/** ¿Ha cambiado la ficha en algo que toca la propuesta desde que se envió? */
export const stale = (c, ch) => J(getP(c, ch.path)) !== J(ch.from);
/** El máster aprueba: se aplica y se apunta en el registro. */
export function approve(charId, propId) {
  const s0 = store.get(); if (!isDM(s0)) return;
  store.commit("char", s => {
    const c = s.characters.find(x => x.id === charId), p = c && (c.proposals || []).find(x => x.id === propId); if (!p) return;
    p.changes.forEach(ch => setP(c, ch.path, ch.to));
    c.proposals = c.proposals.filter(x => x.id !== propId);
    logTo(c, s, "aprobado", p.changes.map(describe), { from: p.by, note: p.note || undefined });
  });
  toast("Cambios aprobados y aplicados.");
}
/** El máster rechaza (con un motivo opcional que verá el jugador en el registro). */
export function reject(charId, propId, why = "") {
  const s0 = store.get(); if (!isDM(s0)) return;
  store.commit("char", s => {
    const c = s.characters.find(x => x.id === charId), p = c && (c.proposals || []).find(x => x.id === propId); if (!p) return;
    c.proposals = c.proposals.filter(x => x.id !== propId);
    logTo(c, s, "rechazado", p.changes.map(describe), { from: p.by, note: p.note || undefined, why: String(why || "").slice(0, 200) || undefined });
  });
  toast("Propuesta rechazada.");
}
/** El jugador retira una propuesta suya que aún no se ha revisado. */
export function withdraw(charId, propId) {
  store.commit("char", s => { const c = s.characters.find(x => x.id === charId); if (c) c.proposals = (c.proposals || []).filter(x => x.id !== propId); });
}
/** Propuestas pendientes en todo el grupo (para el aviso del máster). */
export const pendingCount = s => (s.characters || []).reduce((n, c) => n + (c.proposals || []).length, 0);
