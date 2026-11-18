// Quién está usando esta pestaña y qué puede hacer.
// Hoy se elige en la pantalla de inicio; en el Hito 1 vendrá de la cuenta de Google.
const KEY = "lamesa:yo";
let me = null;
try { me = sessionStorage.getItem(KEY); } catch (e) { me = null; }

export const session = {
  id: () => me,
  set(id) { me = id; try { sessionStorage.setItem(KEY, id); } catch (e) { /* solo en memoria */ } },
  clear() { me = null; try { sessionStorage.removeItem(KEY); } catch (e) { /* solo en memoria */ } }
};

export const currentUser = state => state.users.find(u => u.id === me) || null;
export const isDM = state => (currentUser(state) || {}).role === "dm";

/** Reglas de permisos en un solo sitio, para que todas las vistas apliquen las mismas. */
export const can = {
  editWorld: state => isDM(state),
  present: state => isDM(state),
  seePlace: (state, place) => isDM(state) || place.visible,
  seeItem: (state, item) => isDM(state) || item.revealed,
  editCharacter: (state, ch) => isDM(state) || ch.owner === me
};
