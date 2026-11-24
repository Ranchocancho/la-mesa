// Escaleras y pasos que llevan a algún sitio (Hito 70).
// Una escalera (o un 🧭 paso) puede llevar a otra planta del mismo mapa o a otra escena. Si no lleva a ningún sitio, es decorado.
// Fuera de combate, cuando un jugador deja a su personaje encima, le pregunta «¿Subir con el grupo?». Si dice que sí,
// todo el grupo pasa y vuelve a desplegarse junto a la escalera de llegada. El grupo va siempre junto (la mesa es una sola).
// En combate no pregunta: solo el máster lleva al grupo (desde el objeto: «Llevar al grupo»).
// Como cambiar la mesa solo lo puede hacer el máster en la nube, el jugador deja una petición («travel») que aplica su navegador.
import { store, uid } from "./store.js";
import { isDM, currentUser } from "./session.js";
import { floorsOf, floorIdx, swapFloor } from "./plantas.js";
import { travelTo } from "./mesa.js";
import { isWallT } from "../data/mapas.js";

export const LINKABLE = ["escaleras", "pasaje", "rampa"];
/** Adónde lleva un objeto: { kind: "floor"|"scene", to, name } o null. */
export function linkOf(s, g, p) {
  if (!p || !LINKABLE.includes(p.k)) return null;
  if (p.toFloor != null && floorsOf(g)[p.toFloor] && p.toFloor !== floorIdx(g)) return { kind: "floor", to: p.toFloor, name: floorsOf(g)[p.toFloor].name || "otra planta" };
  if (p.to) { const sc = (s.scenes || []).find(x => x.id === p.to); if (sc) return { kind: "scene", to: sc.id, name: sc.name }; }
  return null;
}
export const linkVerb = (g, L) => L.kind === "scene" ? "Pasar a" : L.to > floorIdx(g) ? "Subir a" : "Bajar a";
const combatOn = g => g && (g.combat === "live" || g.combat === "ini");

/** Máster: lleva al grupo (todos los personajes de la mesa) a otra planta, junto a la escalera de vuelta si la hay. */
export function partyToFloor(st, to) {
  const g = st.board, from = floorIdx(g), pcs = new Set(st.tokens.filter(t => t.kind === "pc").map(t => t.id));
  st.tokens = swapFloor(g, st.tokens, to, pcs);
  const back = (g.props || []).find(p => LINKABLE.includes(p.k) && p.toFloor === from) || null;
  if (back) gather(g, st.tokens, pcs, back.c, back.r);
}
/** Coloca a los que llegan alrededor de una casilla (sin ocupar la propia escalera, para no volver a preguntar). */
function gather(g, tokens, ids, c0, r0) {
  const busy = new Set(tokens.filter(t => !ids.has(t.id)).map(t => t.c + "," + t.r)); busy.add(c0 + "," + r0);
  const block = (c, r) => isWallT((g.terrain || {})[c + "," + r]) || (g.props || []).some(p => p.c === c && p.r === r && p.block);
  for (const t of tokens.filter(t => ids.has(t.id))) {
    let at = null;
    for (let d = 1; d < Math.max(g.cols, g.rows) && !at; d++) for (let r = r0 - d; r <= r0 + d && !at; r++) for (let c = c0 - d; c <= c0 + d && !at; c++) {
      if (c < 0 || r < 0 || c >= g.cols || r >= g.rows || Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== d) continue;
      if (!busy.has(c + "," + r) && !block(c, r)) at = { c, r };
    }
    if (at) { t.c = at.c; t.r = at.r; busy.add(at.c + "," + at.r); }
  }
}
/** Lleva al grupo adonde apunta el objeto (máster). */
export function goLink(propId) {
  const s = store.get(), g = s.board, p = g && (g.props || []).find(x => x.id === propId), L = linkOf(s, g, p); if (!L) return false;
  if (L.kind === "scene") travelTo(L.to);
  else store.commit("board", st => partyToFloor(st, L.to));
  return true;
}
/** Jugador: pide pasar (lo aplica el navegador del máster). */
export function requestTravel(tokId, propId) {
  const s = store.get(), g = s.board, p = (g.props || []).find(x => x.id === propId), L = linkOf(s, g, p), me = currentUser(s), t = s.tokens.find(x => x.id === tokId);
  if (!L || !t) return;
  if (isDM(s)) { goLink(propId); return; }
  const who = (s.characters.find(c => c.id === t.char) || t).name.split(" ")[0];
  store.commit("roll", st => { st.rolls = st.rolls || []; st.rolls.push({ id: uid("trv"), at: Date.now(), who: me ? me.id : null, whoName: me ? me.name : "", kind: "travel", tok: tokId, prop: propId, scene: g.scene || null, floor: floorIdx(g),
    label: `${who}: ${linkVerb(g, L).toLowerCase()} «${L.name}» con el grupo`, expr: "", dice: [], total: null, status: "ok", result: "ok", applied: false }); });
}

/* ---------- Vigilante: preguntar al pisar (cada cliente, sus personajes) y aplicar las peticiones (máster) ---------- */
let ask = null; // función de la vista que muestra la pregunta: ask({ L, verb, tokId, propId, name })
export const setTravelAsk = fn => { ask = fn; };
const last = new Map(); // personaje → "escena|planta|c,r" de la última vez (para preguntar solo al llegar)
function scan() {
  const s = store.get(), g = s.board, me = currentUser(s); if (!g || !me) { last.clear(); return; }
  const dm = isDM(s), where = `${g.scene || ""}|${floorIdx(g)}`;
  // máster: aplica las peticiones de los jugadores
  if (dm) for (const r of (s.rolls || []).filter(r => r.kind === "travel" && !r.applied && Date.now() - (r.at || 0) < 10 * 60000)) {
    const ok = (r.scene || null) === (g.scene || null) && r.floor === floorIdx(g) && !combatOn(g);
    store.commit("roll", st => { const x = (st.rolls || []).find(y => y.id === r.id); if (x) { x.applied = true; if (!ok) x.label += " (ya no aplica)"; } });
    if (ok) goLink(r.prop);
  }
  for (const t of s.tokens.filter(t => t.kind === "pc" && t.owner === me.id)) {
    const k = t.char || t.id, pos = `${where}|${t.c},${t.r}`, prev = last.get(k); last.set(k, pos);
    if (!prev || prev === pos || !prev.startsWith(where + "|")) continue; // recién llegado a esta planta/escena: no pregunta
    if (combatOn(g)) continue;
    const p = (g.props || []).find(x => x.c === t.c && x.r === t.r && LINKABLE.includes(x.k) && !(x.hidden ?? false)), L = p && linkOf(s, g, p);
    if (!L) continue;
    if (ask) ask({ L, verb: linkVerb(g, L), tokId: t.id, propId: p.id, name: (s.characters.find(c => c.id === t.char) || t).name.split(" ")[0] });
  }
}
export function watchTravel() { store.subscribe(() => queueMicrotask(scan)); setInterval(scan, 2000); }

