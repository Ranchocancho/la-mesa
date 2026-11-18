// Quién está usando esta pestaña, con qué papel y qué puede hacer.
// Papeles: "admin" (quien creó el mundo), "dm" (máster) y "player" (jugador).
// El administrador y los másteres pueden "ver como" cualquier jugador para comprobar qué ve.
const KEY = "lamesa:yo", VKEY = "lamesa:vercomo";
let me = null, viewAs = null;
try { me = sessionStorage.getItem(KEY); viewAs = sessionStorage.getItem(VKEY); } catch (e) { /* solo en memoria */ }
const keep = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* solo en memoria */ } };

export const session = {
  id: () => me,
  set(id) { me = id; keep(KEY, id); },
  clear() { me = null; viewAs = null; keep(KEY, null); keep(VKEY, null); },
  viewAs: () => viewAs,
  setViewAs(id) { viewAs = id || null; keep(VKEY, viewAs); }
};

export const ROLE = { admin: "Administrador", dm: "Máster", player: "Jugador" };
export const realUser = state => state.users.find(u => u.id === me) || null;
/** Puede preparar y dirigir (administrador o máster), sin contar el "ver como". */
export const isEditor = state => { const u = realUser(state); return !!u && (u.role === "admin" || u.role === "dm"); };
export const isAdmin = state => (realUser(state) || {}).role === "admin";
export const viewingAs = state => (isEditor(state) && viewAs && state.users.find(u => u.id === viewAs && u.role === "player")) || null;
export const currentUser = state => viewingAs(state) || realUser(state);
/** Actúa como máster ahora mismo (es editor y no está viendo como un jugador). */
export const isDM = state => isEditor(state) && !viewingAs(state);

/** Reglas de permisos en un solo sitio, para que todas las vistas apliquen las mismas. */
export const can = {
  editWorld: state => isDM(state),
  present: state => isDM(state),
  seePlace: (state, place) => isDM(state) || place.visible,
  seeItem: (state, item) => isDM(state) || item.revealed,
  editCharacter: (state, ch) => isDM(state) || ch.owner === (currentUser(state) || {}).id
};
