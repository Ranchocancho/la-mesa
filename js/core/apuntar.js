// Apuntar: el jugador elige en su ficha QUÉ hace (un arma, un conjuro) y luego toca en la mesa A QUIÉN.
// Así su pestaña Personaje nunca muestra datos de los enemigos: solo lo suyo y los nombres que ha marcado.
const subs = new Set();
let armed = null;            // { kind: "atk", tok, i } | { kind: "spell", name }
export const picked = new Set(); // objetivos marcados para un conjuro

export const armedNow = () => armed;
export function arm(a) { armed = a; if (!a || a.kind !== "spell") picked.clear(); emit(); }
export function togglePick(id) { picked.has(id) ? picked.delete(id) : picked.add(id); emit(); }
export function clearPicks() { picked.clear(); emit(); }
export const onAim = fn => { subs.add(fn); return () => subs.delete(fn); };
function emit() { subs.forEach(f => { try { f(); } catch (e) { console.warn(e); } }); }
