// Arranque: modo (nube o demostración), cabecera, navegación y aviso de lo que muestra el máster.
import { store, useLocal } from "./core/store.js";
import { pendingCount } from "./core/propuestas.js";
import { VERSION } from "./version.js";
import { session, currentUser, realUser, isDM, isEditor, viewingAs, playingSelf, runsTable, ROLE } from "./core/session.js";
import { visibleLive, sessionName, presentationFor, presentationTitle } from "./core/sesiones.js";
import { presence } from "./core/presence.js";
import { dmOnline } from "./core/avisos.js";
import { $, esc, avatar, toast } from "./core/ui.js";
import * as inicio from "./views/inicio.js";
import * as partida from "./views/partida.js";
import * as mundo from "./views/mundo.js";
import * as personajes from "./views/personajes.js";
import * as escenas from "./views/escenas.js";
import * as cronica from "./views/cronica.js";
import * as reglas from "./views/reglas.js";
import { preload } from "./core/srd.js";
import { visibleRolls } from "./views/tiradas.js";
import * as lore from "./views/lore.js";
import * as mando from "./views/mando.js";
import { clockOf, clockShort } from "./core/lore.js";

const ROUTES = [
  { id: "inicio", label: "Inicio", view: inicio },
  { id: "partida", label: "Partida", view: partida },
  { id: "escenas", label: "Escenas", view: escenas, dmOnly: true },
  { id: "mando", label: "Mando", view: mando, dmOnly: true },
  { id: "mundo", label: "Mapa", view: mundo },
  { id: "personajes", label: "Personajes", view: personajes },
  { id: "reglas", label: "Reglas", view: reglas },
  { id: "lore", label: "Lore", view: lore },
  { id: "cronica", label: "Crónica", view: cronica }
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
  const h = (location.hash || "").slice(1).split("/")[0];
  if (!currentUser(store.get())) return "inicio";
  const def = ROUTES.find(r => r.id === h);
  return def && (!def.dmOnly || isDM(store.get())) ? h : "inicio";
}

function topbar(state) {
  const me = currentUser(state), real = realUser(state), va = viewingAs(state);
  const r = route();
  const cloudMode = store.mode() === "cloud";
  const live = visibleLive(state);
  // En una escena táctica, solo los jugadores cuyo personaje está en la mesa (más el que ya se esté mirando)
  const pf0 = presentationFor(state), onBoard = pf0 && pf0.type === "tactical" && state.board ? new Set((state.tokens || []).filter(t => t.kind === "pc" && t.owner).map(t => t.owner)) : null;
  const players = state.users.filter(u => u.role === "player" && (!onBoard || onBoard.has(u.id) || u.id === session.viewAs()));
  return `<header class="top">
    <div class="brand"><b>La Mesa</b><span>${esc(state.campaign.name)} · ${live ? `${esc(sessionName(live))} en curso · ${esc(clockShort(clockOf(state)))}` : "sin partida"}${cloudMode ? "" : " · demostración"} · <small class="ver" title="Versión del código cargada en este navegador">v${VERSION}</small></span></div>
    ${me ? `<nav class="nav" aria-label="Secciones">${ROUTES.filter(x => !x.dmOnly || isDM(state)).map(x => `<a href="#${x.id}" ${x.id === r ? 'aria-current="page"' : ""} ${x.dmOnly ? 'class="dmnav" title="Solo el máster"' : ""}>${x.label}${x.id === "partida" && live ? ` <i class="livedot" title="Partida en curso"></i>` : ""}${x.id === "personajes" && isDM(state) && pendingCount(state) ? ` <i class="pendot" title="Cambios de fichas por revisar">${pendingCount(state)}</i>` : ""}${x.soon ? ` <span class="soon">· hito ${x.soon}</span>` : ""}</a>`).join("")}</nav>
    ${syncHTML(state)}
    ${isDM(state) ? `<button class="btn small" id="histbtn" title="Historial de cambios: quién cambió qué, y deshacer">🕘</button>` : ""}
    ${isEditor(state) ? `<button class="btn small playself" id="playself" title="${playingSelf(state) ? "Vuelves a ver y controlar todo como máster" : "Ves y juegas exactamente como un jugador, con tu personaje; tu permiso de máster sigue ahí"}">${playingSelf(state) ? "👑 Volver a máster" : "🎲 Jugar como jugador"}</button>` : ""}
    ${isEditor(state) && !playingSelf(state) && players.length ? `<label class="viewas">Ver como<select id="viewas" class="btn small"><option value="">${esc(ROLE[real.role])}</option>${players.map(p => `<option value="${p.id}" ${va && va.id === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : ""}
    <div class="me">${avatar(real)}<div>${esc(real.name)}<small>${esc(ROLE[real.role] || "Jugador")}</small></div>
      ${cloudMode ? `<button class="btn small" id="campaigns">Mundos</button>` : `<button class="btn small" id="switchme">Cambiar</button>`}</div>` : ""}
  </header>
  ${va && va.self ? `<div class="viewbar selfplay">${(c => c ? `Juegas como jugador con <b>${esc(c.name)}</b>` : `Juegas como jugador <b>sin personaje</b> (asígnate uno en Inicio → Personajes)`)(state.characters.find(c => c.owner === va.id))}. Sigues siendo ${esc((ROLE[real.role] || "máster").toLowerCase())}: puedes volver cuando haga falta arreglar algo. <button class="btn small" id="unplay">👑 Volver a máster</button></div>`
    : va ? `<div class="viewbar">Estás viendo la app como <b>${esc(va.name)}</b>: ves exactamente lo que ve este jugador. <button class="btn small" id="unview">Volver a mi vista</button></div>` : ""}`;
}

function render() {
  if (!ready()) {
    mounted && mounted.unmount && mounted.unmount(); mounted = null; current = null;
    if (cloudMod) cloudMod.renderAccess($("#app"));
    notice();
    return;
  }
  const state = store.get();
  const r = route();
  if (r !== current || !mounted) {
    mounted && mounted.unmount && mounted.unmount();
    $("#app").innerHTML = `<div id="bar">${topbar(state)}</div><main id="main"></main>`;
    const def = ROUTES.find(x => x.id === r);
    mounted = def.view.mount($("#main"), { route: def });
    current = r;
  } else $("#bar").innerHTML = topbar(state);
  const sw = $("#switchme");
  if (sw) sw.onclick = () => { session.clear(); location.hash = "inicio"; current = null; render(); };
  const cp = $("#campaigns");
  if (cp) cp.onclick = () => cloudMod.toLobby();
  const vs = $("#viewas");
  if (vs) vs.onchange = () => setView(vs.value);
  const uv = $("#unview");
  if (uv) uv.onclick = () => setView(null);
  const hb = $("#histbtn");
  if (hb) hb.onclick = () => import("./views/historial.js").then(m => m.openHistory());
  if (!isDM(state)) import("./views/historial.js").then(m => m.closeHistory());
  const ps = $("#playself"), up = $("#unplay");
  const play = on => { session.setPlaySelf(on); current = null; render(); toast(on ? "🎲 Ahora juegas como jugador" : "👑 Vuelves a ser máster"); };
  if (ps) ps.onclick = () => play(!playingSelf(store.get()));
  if (up) up.onclick = () => play(false);
  notice();
}

function setView(id) { session.setViewAs(id); if (!id) session.setPlaySelf(false); current = null; render(); }

// Aviso flotante cuando el máster muestra algo y tú estás en otra sección.
let dismissed = null;
function notice() {
  const ov = $("#overlay");
  const state = store.get();
  const p = ready() ? presentationFor(state) : null;
  const key = JSON.stringify(p);
  if (!p || route() === "partida" || isDM(state) || dismissed === key) { ov.classList.remove("on"); ov.innerHTML = ""; return; }
  ov.innerHTML = `<div class="pill"><span>El máster os muestra <b>${esc(presentationTitle(state, p))}</b></span><a class="btn gold small" href="#partida">Ver</a><button class="btn small" id="pillx" aria-label="Cerrar aviso">✕</button></div>`;
  ov.classList.add("on");
  $("#pillx").onclick = () => { dismissed = key; notice(); };
}

store.subscribe((state, label, remote) => {
  const wasReady = !!mounted;
  render();
  if (wasReady && mounted && mounted.update) mounted.update(state, label, remote);
});
/** Conectados, y los dos avisos que importan (Hito 66): sin conexión, o (para los jugadores) el máster fuera,
 *  porque el daño y los efectos sobre otros los aplica su navegador. */
function syncHTML(state) {
  const n = presence.count(), off = navigator.onLine === false, nodm = !off && !isDM(state) && !dmOnline(state);
  const tip = off ? "Sin conexión: lo que hagas se guardará al volver la conexión" : nodm ? "El máster no está conectado: tus tiradas se hacen, pero el daño y los efectos sobre otros se aplicarán cuando vuelva" : "Conectados ahora";
  return `<span class="sync ${off ? "offline" : nodm ? "nodm" : ""}" title="${tip}"><i></i>${off ? "Sin conexión" : `${n} conectado${n === 1 ? "" : "s"}${nodm ? " · máster fuera" : ""}`}</span>`;
}
const refreshSync = () => { const s = $(".sync"); if (s) s.outerHTML = syncHTML(store.get()); };
addEventListener("online", refreshSync); addEventListener("offline", refreshSync);
presence.subscribe(() => {
  refreshSync();
  if (mounted && mounted.presence) mounted.presence();
});
// Inicio del turno de una criatura (recarga, Regeneración, legendarias): si el turno lo pasó un jugador, lo aplica el máster
let creatureSeq = null;
store.subscribe(state => {
  const b = state.board; if (!b || b.combat !== "live" || !runsTable(state) || b.seq === creatureSeq) return;
  const t = state.tokens.find(x => x.id === b.turn); if (!t || t.kind === "pc") return;
  creatureSeq = b.seq;
  if (t.ts !== b.seq) queueMicrotask(() => import("./core/criaturas.js").then(m => store.commit("token", st => { const k = st.tokens.find(x => x.id === t.id); if (k) m.onTurnStart(st, k); })));
});
// Cajetilla de dados: cada tirada nueva (que puedas ver) sube desde abajo, estés en la sección que estés
const rollSeen = new Set(); let rollBoot = false, diceCam = null;
store.subscribe(state => {
  if (!ready() || !currentUser(state)) return;
  const fresh = visibleRolls(state).filter(r => !rollSeen.has(r.id));
  fresh.forEach(r => rollSeen.add(r.id));
  const show = fresh.filter(r => r.dice && r.dice.length && (rollBoot || Date.now() - r.at < 6000));
  rollBoot = true;
  if (!show.length) return;
  (diceCam || (diceCam = import("./views/dicecam.js"))).then(m => show.forEach(r => m.showRoll(r, store.get())));
});
// Tapete de las tiradas que pide el máster (en cualquier pantalla)
import("./views/peticiones.js").then(m => m.watchRequests());
import("./core/tesoros.js").then(m => m.watchGifts());
import("./core/comercio.js").then(m => m.watchChests());
import("./core/tiempolibre.js").then(m => m.watchFree());
import("./core/acciones.js").then(m => m.watchEffects());
// Escaleras y pasos (Hito 70): al pisarlos fuera de combate, preguntar al jugador si el grupo pasa
import("./core/viajes.js").then(m => {
  m.setTravelAsk(({ L, verb, tokId, propId, name }) => {
    document.querySelectorAll(".travelask").forEach(x => x.remove());
    const box = document.createElement("div"); box.className = "travelask"; box.setAttribute("role", "dialog");
    box.innerHTML = `<span>${L.kind === "scene" ? "🧭" : "🪜"} <b>${esc(name)}</b> llega a ${L.kind === "scene" ? "un paso" : "las escaleras"}. ¿${esc(verb)} «${esc(L.name)}» con el grupo?</span><button class="btn small gold" data-y>Sí, vamos</button><button class="btn small" data-n>No, me quedo</button>`;
    document.body.appendChild(box);
    const close = () => box.remove(); const tm = setTimeout(close, 20000);
    box.querySelector("[data-y]").onclick = () => { clearTimeout(tm); close(); m.requestTravel(tokId, propId); };
    box.querySelector("[data-n]").onclick = () => { clearTimeout(tm); close(); };
  });
  m.watchTravel();
});
import("./core/cronica.js").then(m => m.watchChronicle());
// Hito 91: ¿tiene este navegador los archivos de la última versión subida? (GitHub Pages guarda en caché unos minutos)
async function checkVersion() {
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" }); if (!r.ok) return;
    const { v } = await r.json();
    if (+v > VERSION && !document.querySelector(".verbar")) {
      const b = document.createElement("div"); b.className = "verbar";
      b.innerHTML = `Hay una versión nueva de La Mesa (v${v}); este navegador sigue con la v${VERSION}. <button class="btn small gold">Recargar sin caché</button>`;
      b.querySelector("button").onclick = async () => {
        // vuelve a pedir al servidor todos los módulos ya cargados, sin caché, y recarga
        const urls = performance.getEntriesByType("resource").map(e => e.name).filter(u => u.startsWith(location.origin) && /\.(js|css|json)(\?|$)/.test(u));
        await Promise.all(urls.map(u => fetch(u, { cache: "reload" }).catch(() => null)));
        location.reload();
      };
      document.body.appendChild(b);
    }
  } catch (e) { /* sin red: nada */ }
}
checkVersion(); setInterval(checkVersion, 5 * 60 * 1000);
import("./core/ocultos.js").then(m => m.watchHidden());
import("./core/historial.js").then(m => m.watchHistory());
import("./core/reacciones.js").then(m => m.watchReactions());
import("./core/combate.js").then(m => { m.watchAutoResolve(); m.watchAutoDamage(); });
import("./core/duraciones.js").then(m => m.watchDurations());
import("./core/pnj.js").then(m => m.watchNpcs());
window.addEventListener("hashchange", render);
window.addEventListener("lamesa:login", () => { presence.beat(); current = null; render(); });

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
  presence.beat();
}
boot();
preload();
