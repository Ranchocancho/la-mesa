// Arranque: modo (nube o demostración), cabecera, navegación y la presentación del máster.
import { store, useLocal } from "./core/store.js";
import { session, currentUser, isDM } from "./core/session.js";
import { presence } from "./core/presence.js";
import { $, esc, avatar } from "./core/ui.js";
import * as inicio from "./views/inicio.js";
import * as mundo from "./views/mundo.js";
import * as soon from "./views/soon.js";
import { renderOverlay } from "./views/presentacion.js";

const ROUTES = [
  { id: "inicio", label: "Inicio", view: inicio },
  { id: "mundo", label: "Mundo", view: mundo },
  { id: "mesa", label: "Mesa", view: soon, soon: 3 },
  { id: "personajes", label: "Personajes", view: soon, soon: 2 },
  { id: "lore", label: "Lore", view: soon, soon: 4 },
  { id: "cronica", label: "Crónica", view: soon, soon: 5 }
];

let current = null, mounted = null, cloudMod = null;
const demo = new URLSearchParams(location.search).has("demo");

function ready() {
  const s = store.get();
  if (!s) return false;
  if (store.mode() === "cloud") return cloudMod && cloudMod.cloud.status === "ready";
  return true;
}

function route() {
  const h = (location.hash || "").slice(1);
  if (!currentUser(store.get())) return "inicio";
  return ROUTES.some(r => r.id === h) ? h : "inicio";
}

function topbar(state) {
  const me = currentUser(state);
  const r = route();
  const cloudMode = store.mode() === "cloud";
  return `<header class="top">
    <div class="brand"><b>La Mesa</b><span>${esc(state.campaign.name)} · Sesión ${state.campaign.session}${cloudMode ? "" : " · demostración"}</span></div>
    ${me ? `<nav class="nav" aria-label="Secciones">${ROUTES.map(x => `<a href="#${x.id}" ${x.id === r ? 'aria-current="page"' : ""}>${x.label}${x.soon ? ` <span class="soon">· hito ${x.soon}</span>` : ""}</a>`).join("")}</nav>
    <span class="sync" title="Conectados ahora"><i></i>${presence.count()} conectado${presence.count() === 1 ? "" : "s"}</span>
    <div class="me">${avatar(me)}<div>${esc(me.name)}<small>${me.role === "dm" ? "Máster" : "Jugador"}</small></div>
      ${cloudMode ? `<button class="btn small" id="campaigns">Campañas</button>` : `<button class="btn small" id="switchme">Cambiar</button>`}</div>` : ""}
  </header><main id="main"></main>`;
}

function render() {
  if (!ready()) {
    mounted && mounted.unmount && mounted.unmount(); mounted = null; current = null;
    if (cloudMod) cloudMod.renderAccess($("#app"));
    const ov = $("#overlay"); ov.classList.remove("on"); ov.innerHTML = "";
    return;
  }
  const state = store.get();
  const r = route();
  if (r !== current || !mounted) {
    mounted && mounted.unmount && mounted.unmount();
    $("#app").innerHTML = topbar(state);
    const def = ROUTES.find(x => x.id === r);
    mounted = def.view.mount($("#main"), { route: def });
    current = r;
  } else {
    const old = $(".top");
    const tmp = document.createElement("div"); tmp.innerHTML = topbar(state);
    old.replaceWith(tmp.firstElementChild);
  }
  const sw = $("#switchme");
  if (sw) sw.onclick = () => { session.clear(); location.hash = "inicio"; current = null; render(); renderOverlay(); };
  const cp = $("#campaigns");
  if (cp) cp.onclick = () => cloudMod.toLobby();
}

store.subscribe((state, label, remote) => {
  const wasReady = !!mounted;
  render();
  if (wasReady && mounted && mounted.update) mounted.update(state, label, remote);
  if (ready()) renderOverlay();
});
presence.subscribe(() => {
  const s = $(".sync"); if (s) { const n = presence.count(); s.innerHTML = `<i></i>${n} conectado${n === 1 ? "" : "s"}`; }
  if (mounted && mounted.presence) mounted.presence();
});
window.addEventListener("hashchange", () => { render(); if (ready()) renderOverlay(); });
window.addEventListener("lamesa:login", () => { presence.beat(); current = null; render(); renderOverlay(); });
document.addEventListener("keydown", e => {
  const s = store.get();
  if (e.key === "Escape" && s && s.presentation && isDM(s)) store.commit("present", st => { st.presentation = null; });
});

async function boot() {
  if (!demo) {
    try {
      const [c, a] = await Promise.all([import("./core/cloud.js"), import("./views/acceso.js")]);
      cloudMod = { ...c, renderAccess: a.renderAccess };
      c.onCloud(() => render());
      render();
      await c.initCloud();
      return;
    } catch (e) {
      console.error(e);
      cloudMod = null;
    }
  }
  useLocal();
  render();
  renderOverlay();
  presence.beat();
}
boot();
