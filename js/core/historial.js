// Historial de cambios del máster (Hito 78): quién cambió qué y cuándo, y «↶ Volver a antes de esto».
// - Lo lleva el navegador de cada administrador o máster, desde que abre la página (no se guarda al recargar).
// - Recoge los cambios de todos: los suyos y los que llegan de los jugadores.
// - Deshacer un cambio devuelve a como estaban justo las cosas que ese cambio tocó (una ficha, una figura,
//   un lugar…), sin tocar lo demás. Si después alguien volvió a cambiar esas mismas cosas, también se pierde y se avisa.
// - Límites: no recupera imágenes borradas (solo la referencia) y se olvida al recargar la página.
import { store } from "./store.js";
import { runsTable, currentUser, realUser } from "./session.js";

const MAX = 80, MERGE_MS = 4000;
let snap = null;        // path → JSON de la última versión vista
let entries = [];       // más antiguos primero
let seq = 0, undoText = null;
const listeners = new Set();
export const onHistory = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const ping = () => listeners.forEach(fn => fn());

/* ---------- Trocear el estado en piezas con nombre ---------- */
// Las listas de objetos con id se trocean por id; los objetos de primer nivel (world, board…), por clave.
const SKIP = new Set(["rev", "version"]);
const SPLIT = new Set(["world", "board", "freeTime", "loot", "mando", "campaign"]);
// JSON con las claves ordenadas: lo que vuelve de la nube trae las claves en otro orden y no es un cambio
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
const idOf = x => x && typeof x === "object" ? (typeof x.id === "string" ? x.id : typeof x.email === "string" ? x.email : null) : null;
const isIdList = v => Array.isArray(v) && v.every(x => idOf(x) != null);
function pieces(s) {
  const out = new Map();
  const put = (path, v) => {
    if (isIdList(v)) { v.forEach((x, i) => out.set(path + "#" + idOf(x), { j: canon(x), i })); out.set(path + "#", { j: "list", i: 0 }); return; }
    out.set(path, { j: canon(v === undefined ? null : v) });
  };
  for (const k of Object.keys(s)) {
    if (SKIP.has(k)) continue;
    const v = s[k];
    if (SPLIT.has(k) && v && typeof v === "object" && !Array.isArray(v)) { out.set(k + ".", { j: "obj" }); for (const kk of Object.keys(v)) put(k + "." + kk, v[kk]); }
    else put(k, v);
  }
  return out;
}

/* ---------- Describir un cambio ---------- */
const AREA = { characters: "Ficha", tokens: "Figura", rolls: "Tirada", "world.places": "Lugar", "world.regions": "Región", lore: "Lore", scenes: "Escena",
  chronicle: "Crónica", whispers: "Susurro", sessions: "Sesión", users: "Grupo", invites: "Invitación", board: "Mesa", world: "Mapa", loot: "Botín", mando: "Mando",
  freeTime: "Tiempo libre", presentation: "Lo que se muestra", clock: "Calendario", live: "Partida", dms: "Másteres", campaign: "Mundo", bestiary: "Bestiario" };
const FIELD = { hp: "PG", c: "posición", r: "posición", conds: "estados", init: "iniciativa", spells: "conjuros", coins: "monedas", inventory: "equipo", items: "objetos",
  level: "nivel", name: "nombre", visible: "visible", revealed: "revelado", secret: "secreto", owner: "jugador", inspiration: "inspiración", death: "salvaciones contra muerte",
  hdUsed: "dados de golpe", fx: "efectos", treasures: "tesoros", journal: "cuaderno", character: "personaje", role: "papel", x: "posición", y: "posición", img: "imagen", status: "estado", result: "resultado" };
const nameOf = (j, id) => { try { const o = JSON.parse(j); return ((o && (o.name || o.label || o.title || o.email || o.text)) || id || "").toString().slice(0, 60); } catch (e) { return id || ""; } };
function fieldsOf(a, b) {
  try { const x = JSON.parse(a), y = JSON.parse(b), ks = new Set([...Object.keys(x || {}), ...Object.keys(y || {})]);
    return [...new Set([...ks].filter(k => JSON.stringify(x[k]) !== JSON.stringify(y[k])).map(k => FIELD[k] || k))].slice(0, 3); } catch (e) { return []; }
}
function describe(ops) {
  const parts = [];
  for (const o of ops) {
    const [path, id] = o.key.split("#"), base = path.replace(/\.$/, "");
    if (id === "" || o.key.endsWith(".")) continue;
    const area = AREA[base] || AREA[base.split(".")[0]] || base;
    if (id) {
      const nm = nameOf(o.after ?? o.before, id);
      parts.push(o.before == null ? `＋ ${area}: ${nm}` : o.after == null ? `✕ ${area}: ${nm}` : `${area} ${nm}${(f => f.length ? ` (${f.join(", ")})` : "")(fieldsOf(o.before, o.after))}`);
    } else {
      const sub = base.includes(".") ? base.split(".")[1] : "";
      parts.push(`${area}${sub && !AREA[base] ? ` · ${FIELD[sub] || sub}` : ""}`);
    }
  }
  const uniq = [...new Set(parts)];
  return uniq.slice(0, 3).join(" · ") + (uniq.length > 3 ? ` · y ${uniq.length - 3} más` : "");
}

/* ---------- Quién ---------- */
function whoOf(s, ops, remote) {
  if (!remote) { const u = currentUser(s), r = realUser(s); return u ? (u.self ? `${r.name} (como jugador)` : u.name) : "Alguien"; }
  // un cambio que llega de fuera: se deduce por lo que toca (la tirada nueva, la ficha o la figura de quién)
  for (const o of ops) {
    if (!o.after) continue;
    try { const x = JSON.parse(o.after);
      if (o.key.startsWith("rolls#") && o.before == null && (x.whoName || x.who)) return x.whoName || (s.users.find(u => u.id === x.who) || {}).name || "Alguien";
      if ((o.key.startsWith("characters#") || o.key.startsWith("tokens#")) && x.owner) { const u = s.users.find(v => v.id === x.owner); if (u) return u.name; }
      if (o.key.startsWith("chronicle#") && x.by) { const u = s.users.find(v => v.id === x.by); if (u) return u.name; }
    } catch (e) { /* nada */ }
  }
  return "Otro participante";
}

/* ---------- Registrar ---------- */
function record(s, label, remote) {
  if (!s) return;
  const next = pieces(s);
  if (!snap || !runsTable(s)) { snap = next; return; }
  const ops = [];
  for (const [k, v] of next) { const p = snap.get(k); if (!p || p.j !== v.j) ops.push({ key: k, before: p ? p.j : null, after: v.j, i: v.i }); }
  for (const [k, p] of snap) if (!next.has(k)) ops.push({ key: k, before: p.j, after: null, i: p.i });
  snap = next;
  const real = ops.filter(o => !o.key.endsWith("#") && !o.key.endsWith("."));
  if (!real.length || label === "open" || label === "reset") return;
  const who = whoOf(s, real, remote), at = Date.now(), prev = entries[entries.length - 1];
  const sig = real.map(o => o.key).sort().join("|");
  // lo que se arrastra o se escribe letra a letra se junta en un solo cambio
  if (prev && !prev.undone && prev.who === who && prev.sig === sig && at - prev.at < MERGE_MS && !prev.isUndo && label !== "undo") {
    real.forEach(o => { const q = prev.ops.find(x => x.key === o.key); if (q) { q.after = o.after; q.i = o.i; } });
    prev.at = at; prev.what = describe(prev.ops); ping(); return;
  }
  entries.push({ id: ++seq, at, who, what: label === "undo" && undoText ? undoText : describe(real), ops: real, sig, remote: !!remote, isUndo: label === "undo" });
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  ping();
}

export function watchHistory() {
  snap = null;
  record(store.get(), "open", false);
  store.subscribe((s, label, remote) => record(s, label, remote));
}

export const historyList = () => entries.slice().reverse();

/** Cuántos cambios posteriores tocan lo mismo (también se deshacen). */
export function laterOverlap(id) {
  const e = entries.find(x => x.id === id); if (!e) return 0;
  const keys = new Set(e.ops.map(o => o.key));
  return entries.filter(x => x.id > id && x.ops.some(o => keys.has(o.key))).length;
}

/* ---------- Deshacer ---------- */
function container(st, path) {
  // "world.places" → st.world.places ; "tokens" → st.tokens
  const [a, b] = path.split(".");
  if (b === undefined) return { obj: st, key: a };
  if (!st[a] || typeof st[a] !== "object") st[a] = {};
  return { obj: st[a], key: b };
}
export function revert(id) {
  const e = entries.find(x => x.id === id); if (!e) return false;
  undoText = `↶ Deshace: ${e.what}`;
  store.commit("undo", st => {
    for (const o of e.ops) {
      const [path, itemId] = o.key.split("#");
      if (itemId !== undefined) {
        const { obj, key } = container(st, path);
        if (!Array.isArray(obj[key])) obj[key] = [];
        const list = obj[key], at = list.findIndex(x => idOf(x) === itemId);
        if (o.before == null) { if (at >= 0) list.splice(at, 1); }
        else if (at >= 0) list[at] = JSON.parse(o.before);
        else list.splice(Math.min(o.i ?? list.length, list.length), 0, JSON.parse(o.before));
      } else {
        const { obj, key } = container(st, path);
        if (o.before == null) { if (Array.isArray(JSON.parse(o.after || "null"))) obj[key] = []; else delete obj[key]; }
        else obj[key] = JSON.parse(o.before);
      }
    }
  });
  undoText = null; e.undone = true; ping();
  return true;
}
