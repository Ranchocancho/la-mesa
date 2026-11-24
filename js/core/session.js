// Quién está usando esta pestaña, con qué papel y qué puede hacer.
// Papeles: "admin" (quien creó el mundo), "dm" (máster) y "player" (jugador).
// El administrador y los másteres pueden "ver como" cualquier jugador para comprobar qué ve.
// El administrador y los másteres también pueden "jugar como jugador" con su propio personaje (Hito 78):
// ven y juegan exactamente como un jugador, pero conservan el permiso de máster para volver cuando haga falta.
const KEY = "lamesa:yo", VKEY = "lamesa:vercomo", PKEY = "lamesa:jugar";
let me = null, viewAs = null, playSelf = false;
try { me = sessionStorage.getItem(KEY); viewAs = sessionStorage.getItem(VKEY); playSelf = sessionStorage.getItem(PKEY) === "1"; } catch (e) { /* solo en memoria */ }
const keep = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* solo en memoria */ } };

export const session = {
  id: () => me,
  set(id) { me = id; keep(KEY, id); },
  clear() { me = null; viewAs = null; playSelf = false; keep(KEY, null); keep(VKEY, null); keep(PKEY, null); },
  viewAs: () => viewAs,
  setViewAs(id) { viewAs = id || null; keep(VKEY, viewAs); if (viewAs) { playSelf = false; keep(PKEY, null); } },
  playSelf: () => playSelf,
  setPlaySelf(on) { playSelf = !!on; keep(PKEY, playSelf ? "1" : null); if (playSelf) { viewAs = null; keep(VKEY, null); } }
};

export const ROLE = { admin: "Administrador", dm: "Máster", player: "Jugador" };
export const realUser = state => state.users.find(u => u.id === me) || null;
/** Puede preparar y dirigir (administrador o máster), sin contar el "ver como". */
export const isEditor = state => { const u = realUser(state); return !!u && (u.role === "admin" || u.role === "dm"); };
export const isAdmin = state => (realUser(state) || {}).role === "admin";
const asPlayer = new WeakMap();
/** Tú mismo, con papel de jugador (mientras juegas como jugador). */
const selfAsPlayer = u => { if (!asPlayer.has(u)) asPlayer.set(u, { ...u, role: "player", self: true }); return asPlayer.get(u); };
export const viewingAs = state => {
  if (!isEditor(state)) return null;
  if (playSelf) return selfAsPlayer(realUser(state));
  return (viewAs && state.users.find(u => u.id === viewAs && u.role === "player")) || null;
};
/** Está jugando como jugador con su propio personaje, aunque sea administrador o máster. */
export const playingSelf = state => isEditor(state) && playSelf;
/** Este navegador lleva la automatización del máster (aplicar efectos, crónica, reacciones…):
 *  cualquier administrador o máster, aunque esté jugando como jugador o viendo como otro. */
export const runsTable = state => isEditor(state);
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
