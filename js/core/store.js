// Estado compartido de la campaña. Las vistas leen con store.get() y escriben con store.commit().
// Dos modos:
//  - "cloud": Firebase (cada uno desde su casa). js/core/cloud.js recibe los cambios y los envía.
//  - "local": modo demostración, sincroniza pestañas del mismo navegador.
import { seed } from "../data/seed.js";

const KEY = "lamesa:mundo:v2";
const listeners = new Set();
let state = null;
let backend = "local";
let pusher = null;
let channel = null;

function loadLocal() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version === 2) return s;
  } catch (e) { /* sin almacenamiento */ }
  return seed();
}
function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* lleno o no disponible */ } }
function emit(label, remote) { listeners.forEach(fn => fn(state, label, remote)); }

export function useLocal() {
  backend = "local";
  state = loadLocal();
  try {
    channel = new BroadcastChannel("lamesa");
    channel.onmessage = e => {
      if (e.data && e.data.type === "state" && e.data.state.rev >= (state.rev || 0)) {
        state = e.data.state; saveLocal(); emit(e.data.label, true);
      }
    };
  } catch (e) { channel = null; }
}

export function useCloud(push) { backend = "cloud"; pusher = push; }

export const store = {
  get: () => state,
  mode: () => backend,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Aplica un cambio y lo envía al resto de participantes. */
  commit(label, fn) {
    if (!state) return;
    fn(state);
    state.rev = (state.rev || 0) + 1;
    if (backend === "local") {
      saveLocal();
      try { channel && channel.postMessage({ type: "state", state, label }); } catch (e) { /* ignorado */ }
    } else if (pusher) pusher(state, label);
    emit(label, false);
  },
  /** Lo usa el modo nube para entregar el estado que llega de Firebase. */
  replace(next, label = "remote") { state = next; emit(label, true); },
  reset() {
    if (backend !== "local") return;
    state = seed(); state.rev = Date.now(); saveLocal();
    try { channel && channel.postMessage({ type: "state", state, label: "reset" }); } catch (e) { /* ignorado */ }
    emit("reset", false);
  }
};

export const uid = (p = "id") => p + "-" + Math.random().toString(36).slice(2, 9);
