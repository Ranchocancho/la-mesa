// Lore: todo lo que el máster crea alrededor de los lugares del mapa.
// Cada entrada tiene una parte pública (nombre, descripción, imagen) que los jugadores ven cuando se revela,
// y una parte secreta que solo ve el máster. Las entradas se relacionan entre sí y con los lugares.
import { store, uid } from "./store.js";
import { isDM, currentUser } from "./session.js";

export const LORE = {
  npc: { n: "Personaje", pl: "Personajes", icon: "👤", hint: "PNJ: quién es, qué quiere, qué sabe." },
  faction: { n: "Facción", pl: "Facciones", icon: "⚑", hint: "Gremios, órdenes, bandas, casas nobles…" },
  god: { n: "Dios", pl: "Dioses", icon: "☀", hint: "Deidades del mundo: dominio, símbolo, fieles y lo que piden." },
  hist: { n: "Hito", pl: "Cronologías", icon: "⏳", hint: "La historia del mundo, de la más antigua a hoy: fecha, lo que pasó y una ilustración." },
  battle: { n: "Batalla", pl: "Batallas", icon: "⚔", hint: "Batallas y guerras: los bandos y quiénes los formaban, cómo fue, cómo acabó y qué consecuencias tuvo." },
  tline: { n: "Cronología", pl: "Cronologías", icon: "🧭", hint: "Una línea temporal propia: un tramo de la campaña, las luchas de una región…" },
  event: { n: "Evento", pl: "Eventos", icon: "⚡", hint: "Situaciones preparadas que activas cuando quieras." },
  image: { n: "Imagen", pl: "Galería", icon: "🖼", hint: "Ilustraciones de lugares, personajes y escenas." },
  note: { n: "Nota", pl: "Notas", icon: "📝", hint: "Apuntes privados del máster." },
  chapter: { n: "Escena preparada", pl: "Preparar sesión", icon: "📂", hint: "La carpeta de escenas de la próxima sesión." }
};
export const EVENT_TYPES = { preparado: "Preparado", espontaneo: "Espontáneo", ambiental: "Ambiental" };
export const EVENT_STATUS = { pendiente: "Pendiente", activo: "En juego", resuelto: "Resuelto", guardado: "Guardado para después" };
export const PLACE_KINDS = ["Región", "Ciudad", "Pueblo", "Distrito", "Localización", "Mazmorra", "Punto de interés"];

export const loreOf = s => s.lore || [];
export const entry = (s, id) => loreOf(s).find(e => e.id === id) || null;
export const placeOf = (s, id) => s.world.places.find(p => p.id === id) || null;
/** Lo que un usuario puede ver: el máster todo; los jugadores, lo revelado (nunca notas ni preparación). */
export const canSee = (s, e) => isDM(s) || (e.revealed && e.kind !== "note" && e.kind !== "chapter");
/* Hito 102: dioses con presencia por lugar, PNJ con facciones y culto, cronologías con nombre */
export const MAIN_TL = "mundo"; // la cronología de siempre: «Historia del mundo»
export const tlinesOf = s => loreOf(s).filter(e => e.kind === "tline").sort((a, b) => (a.at || 0) - (b.at || 0));
/** ¿Sale esta entrada en la cronología tl? (sin marcar = solo en la del mundo) */
export const inTimeline = (e, tl) => (e.tl && e.tl.length ? e.tl : [MAIN_TL]).includes(tl);
/** Presencia de los dioses en un lugar o región: [{ god, pct }] de mayor a menor (lo que falta hasta 100, sin culto). */
export const presenceOf = (s, x) => Object.entries((x && x.presence) || {}).map(([god, pct]) => ({ god: entry(s, god), pct: +pct || 0 })).filter(r => r.god && r.pct > 0).sort((a, b) => b.pct - a.pct);

/** Nombre de cualquier cosa enlazable: entrada de lore, lugar o escena táctica. */
export function refName(s, id) {
  const e = entry(s, id); if (e) return { name: e.name, icon: LORE[e.kind].icon, kind: e.kind };
  const p = placeOf(s, id); if (p) return { name: p.name, icon: "📍", kind: "place" };
  const sc = (s.scenes || []).find(x => x.id === id); if (sc) return { name: sc.name, icon: "⚔️", kind: "scene" };
  return null;
}
/** Relaciones en los dos sentidos: lo que enlaza esta entrada y lo que la enlaza a ella. */
export function related(s, id) {
  const e = entry(s, id), out = new Set(e ? e.links || [] : []);
  loreOf(s).forEach(x => { if ((x.links || []).includes(id)) out.add(x.id); });
  out.delete(id);
  return [...out].filter(r => refName(s, r));
}
/** Ruta de un lugar hasta la raíz (Región › Ciudad › Distrito). */
export function placePath(s, id) {
  const out = []; let p = placeOf(s, id), guard = 0;
  while (p && guard++ < 10) { out.unshift(p); p = p.parent ? placeOf(s, p.parent) : null; }
  return out;
}
export const childrenOf = (s, id) => s.world.places.filter(p => (p.parent || null) === (id || null));
/** Lugares descendientes (para que «Personajes en Vel Arath» incluya a los del mercado). */
export function descendants(s, id) {
  const out = [], walk = pid => childrenOf(s, pid).forEach(c => { out.push(c.id); walk(c.id); });
  walk(id); return out;
}

export function newEntry(kind, extra = {}) {
  const id = uid(kind);
  store.commit("lore", s => {
    s.lore = s.lore || [];
    const base = { id, kind, name: `${LORE[kind].n} nuevo`.replace("Imagen nuevo", "Imagen nueva").replace("Facción nuevo", "Facción nueva").replace("Nota nuevo", "Nota nueva").replace("Escena preparada nuevo", "Escena nueva").replace("Cronología nuevo", "Cronología nueva").replace("Batalla nuevo", "Batalla nueva"),
      place: null, summary: "", secret: "", revealed: false, img: null, links: [], at: Date.now() };
    if (kind === "event") Object.assign(base, { etype: "preparado", status: "pendiente", actions: "" });
    if (kind === "npc" || kind === "god" || kind === "battle") Object.assign(base, { role: "" });
    if (kind === "battle") Object.assign(base, { sides: [{ name: "Bando 1", factions: [], npcs: [], note: "" }, { name: "Bando 2", factions: [], npcs: [], note: "" }], outcome: "", consequences: "" });
    if (kind === "tline") Object.assign(base, { name: "Nueva cronología" });
    if (kind === "hist") { const t = loreOf(s).filter(e => e.kind === "hist"); Object.assign(base, { name: "Nuevo hito", date: "", era: t.length ? t[t.length - 1].era || "" : "", year: t.length ? Math.max(...t.map(e => +e.year || 0)) + 10 : 0 }); }
    if (kind === "chapter") Object.assign(base, { session: null, order: loreOf(s).filter(e => e.kind === "chapter").length });
    s.lore.push(Object.assign(base, extra));
  });
  return id;
}
export const setEntry = (id, patch, label = "lore") => store.commit(label, s => { const e = entry(s, id); if (e) Object.assign(e, typeof patch === "function" ? patch(e) : patch); });
export const removeEntry = id => store.commit("lore", s => {
  s.lore = loreOf(s).filter(e => e.id !== id);
  s.lore.forEach(e => { if (e.links) e.links = e.links.filter(x => x !== id); });
  if (s.presentation && s.presentation.id === id) s.presentation = null;
});
export const link = (a, b) => store.commit("lore", s => { const e = entry(s, a); if (e && a !== b) { e.links = e.links || []; if (!e.links.includes(b)) e.links.push(b); } });
export const unlink = (a, b) => store.commit("lore", s => {
  const e = entry(s, a); if (e && e.links) e.links = e.links.filter(x => x !== b);
  const o = entry(s, b); if (o && o.links) o.links = o.links.filter(x => x !== a);
});

/**
 * Mostrar algo en la mesa. to: id de un jugador (solo él lo ve) o null (todos).
 * Al mostrarlo a todos, la entrada queda revelada en el Lore de los jugadores.
 * La «foto» (snap) lleva lo necesario para dibujarlo aunque el jugador aún no tenga la entrada.
 */
export function showEntry(id, { to = null, imageOnly = false } = {}) {
  store.commit("present", s => {
    const e = entry(s, id); if (!e) return;
    if (!to) e.revealed = true;
    const pl = e.place ? placeOf(s, e.place) : null;
    s.presentation = { type: "lore", id, to, snap: { eyebrow: (imageOnly ? "" : LORE[e.kind].n.toUpperCase() + (pl ? " · " + pl.name.toUpperCase() : "")), title: e.name, text: imageOnly ? "" : e.summary || "", img: e.img || null, kind: e.kind } };
  });
}
/* ---------- Cronología ---------- */
/** Hitos en orden (el «año» es solo para ordenar; lo que se lee es la fecha en texto). */
export const timeline = (s, all = false, tl = MAIN_TL) => loreOf(s).filter(e => (e.kind === "hist" || ((e.kind === "battle" || e.kind === "god") && (e.year !== undefined && e.year !== "" && e.year !== null))) && inTimeline(e, tl) && (all || canSee(s, e)))
  .sort((a, b) => (+a.year || 0) - (+b.year || 0) || (a.at || 0) - (b.at || 0));
/** El máster cuenta la historia en la mesa, hito a hito: lo que cuenta queda revelado. id null = quitarla. */
export function tellTimeline(id) {
  store.commit("present", s => {
    const e = entry(s, id); if (!e) return;
    e.revealed = true;
    s.presentation = { type: "timeline", id, snap: { title: e.name, date: e.date || "", era: e.era || "", text: e.summary || "", img: e.img || null } };
  });
}

/** Imagen de fondo de la escena (queda detrás de lo que se muestre, hasta que la quites). */
export const setBackdrop = key => store.commit("present", s => { s.backdrop = key || null; });

/* ---------- Reloj de campaña ---------- */
export const clockOf = s => s.clock || { day: 1, min: 9 * 60 };
export function clockText(c) {
  const h = Math.floor(c.min / 60), m = c.min % 60;
  const part = h < 6 ? "de madrugada" : h < 12 ? "por la mañana" : h < 14 ? "a mediodía" : h < 20 ? "por la tarde" : "de noche";
  return `Día ${c.day} · ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${part}`;
}
export const clockShort = c => `Día ${c.day} · ${String(Math.floor(c.min / 60)).padStart(2, "0")}:${String(c.min % 60).padStart(2, "0")}`;
export const advanceClock = mins => store.commit("clock", s => {
  const c = { ...clockOf(s) }; c.min += mins;
  while (c.min >= 1440) { c.min -= 1440; c.day++; }
  while (c.min < 0) { c.min += 1440; c.day = Math.max(1, c.day - 1); }
  s.clock = c;
});

/** Para quién es lo que se muestra: los jugadores que no son el destinatario no lo ven. */
export const forMe = (s, p) => !p || !p.to || isDM(s) || (currentUser(s) || {}).id === p.to;
