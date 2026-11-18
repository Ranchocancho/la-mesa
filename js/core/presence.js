// Quién está conectado ahora mismo.
// En modo demostración va por un canal entre pestañas; en modo nube lo alimenta cloud.js.
import { session } from "./session.js";

const seen = new Map();
const listeners = new Set();
let ch = null, external = false, LIMIT = 12000;

function notify() { listeners.forEach(fn => fn()); }
function beat() {
  if (external) return;
  const id = session.id();
  if (id) { seen.set(id, Date.now()); try { ch && ch.postMessage({ id, t: Date.now() }); } catch (e) { /* ignorado */ } }
  for (const [k, t] of seen) if (Date.now() - t > LIMIT) seen.delete(k);
  notify();
}
try {
  ch = new BroadcastChannel("lamesa-presencia");
  ch.onmessage = e => { if (!external && e.data && e.data.id) { const isNew = !seen.has(e.data.id); seen.set(e.data.id, e.data.t); if (isNew) notify(); } };
} catch (e) { ch = null; }
setInterval(beat, 4000);

export const presence = {
  online: id => seen.has(id) && Date.now() - seen.get(id) < LIMIT,
  count: () => [...seen.values()].filter(t => Date.now() - t < LIMIT).length,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  beat,
  /** Modo nube: cloud.js entrega un mapa id → última señal. */
  feed(map) { external = true; LIMIT = 70000; seen.clear(); Object.entries(map).forEach(([k, t]) => seen.set(k, t)); notify(); }
};
