// Sesiones de juego: se abren cuando os sentáis a jugar y se cierran con un resumen.
// No hay campañas: la historia del mundo continúa de una sesión a la siguiente.
// Una "sesión de pruebas" solo la ven el administrador y los másteres.
import { store, uid } from "./store.js";
import { isEditor } from "./session.js";

export const liveSession = s => s.sessions.find(x => x.id === s.live && x.status === "open") || null;
export const lastClosed = s => [...s.sessions].reverse().find(x => x.status === "closed" && !x.test) || null;
export const pastSessions = s => s.sessions.filter(x => x.status === "closed" && !x.test).sort((a, b) => b.n - a.n);
export const nextNumber = s => Math.max(0, ...s.sessions.filter(x => !x.test && x.n).map(x => x.n)) + 1;
/** La sesión abierta, si este usuario puede verla (las de prueba quedan ocultas a los jugadores). */
export const visibleLive = s => { const l = liveSession(s); return l && (!l.test || isEditor(s)) ? l : null; };
export const sessionName = x => x.test ? "Sesión de pruebas" : `Sesión ${x.n}`;

/** Lo que el máster está mostrando, si este usuario debe verlo. */
export function presentationFor(s) {
  const p = s.presentation; if (!p) return null;
  const l = liveSession(s);
  if (l && l.test && !isEditor(s)) return null;
  return p;
}

export function presentationTitle(s, p) {
  if (!p) return "";
  if (p.type === "recap") return "Anteriormente…";
  if (p.type === "world") return "Mapa del mundo";
  if (p.type === "tactical") return "Escena táctica";
  const place = s.world.places.find(x => x.id === p.place);
  if (!place) return "";
  if (p.type === "item") { const it = place.items.find(i => i.id === p.item); return it ? it.title : place.name; }
  return place.name;
}

export function startSession(test) {
  store.commit("session", s => {
    const id = uid("ses");
    s.sessions.push({ id, n: test ? null : nextNumber(s), title: "", recap: "", status: "open", test: !!test, date: new Date().toISOString().slice(0, 10) });
    s.live = id;
    s.presentation = lastClosed(s) ? { type: "recap" } : { type: "world" };
  });
}

export function closeSession(title, recap) {
  store.commit("session", s => {
    const l = liveSession(s);
    if (l && l.test) s.sessions = s.sessions.filter(x => x.id !== l.id);
    else if (l) Object.assign(l, { status: "closed", title: title || `Sesión ${l.n}`, recap });
    s.live = null; s.presentation = null;
  });
}

export const show = p => store.commit("present", s => {
  if (p && (p.type === "place" || p.type === "item")) {
    const place = s.world.places.find(x => x.id === p.place);
    if (place) { place.visible = true; if (p.type === "item") { const it = place.items.find(i => i.id === p.item); if (it) it.revealed = true; } }
  }
  s.presentation = p;
});
