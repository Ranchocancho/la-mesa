// La Partida: el escenario común y, para el máster, el panel con el que decide qué tenéis delante.
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { liveSession, visibleLive, lastClosed, sessionName, startSession, closeSession, show, presentationFor } from "../core/sesiones.js";
import { loadScene, blankBoard, clearBoard, saveBoardAsScene } from "../core/mesa.js";
import { renderStage } from "./presentacion.js";
import { mountTactical } from "./mesa.js";
import { $, $$, esc, toast } from "../core/ui.js";

let el, closing = false, tac = null, tacEdit = false, panelHidden = false, lastKey = null;

export function mount(root) {
  el = document.createElement("div");
  el.className = "partida";
  el.innerHTML = `<section class="stagebox"><div id="stage" class="stage-area"></div><div class="stagebar" id="sbar"></div></section><aside class="dmpanel" id="dmp" aria-label="Panel del máster"></aside>`;
  root.appendChild(el);
  closing = false; tac = null; lastKey = null;
  draw();
  return {
    update(state, label, remote) { if (label === "field" && !remote) return drawStage(); draw(); },
    unmount() { el = null; tac = null; }
  };
}

const tactical = s => { const p = presentationFor(s); return p && p.type === "tactical" && s.board; };

function drawStage(force) {
  const st = $("#stage", el); if (!st) return;
  const s = store.get();
  if (tactical(s)) {
    st.classList.add("tac");
    const k = "tac" + tacEdit + isDM(s);
    if (!tac || lastKey !== k) { lastKey = k; tac = mountTactical(st, { edit: tacEdit }); }
    else tac.update();
    return;
  }
  tac = null; st.classList.remove("tac");
  const key = JSON.stringify(presentationFor(s)) + JSON.stringify(s.world.places.map(p => [p.map, p.summary, p.items.length]));
  if (!force && key === lastKey && st.childElementCount) return;
  lastKey = key; renderStage(st);
}

function draw() {
  if (!el) return;
  const state = store.get();
  const dm = isDM(state);
  const live = visibleLive(state);
  el.classList.toggle("withpanel", dm && !panelHidden);
  $("#sbar", el).innerHTML = `${live ? `<b>${esc(sessionName(live))}</b> en curso${live.test ? ` · <span class="tag secret">SOLO MÁSTERES</span>` : ""}` : "No hay ninguna partida en curso"}
    <span class="grow"></span>${dm ? `<button class="btn small" id="togglepanel">${panelHidden ? "Mostrar panel" : "Ocultar panel"}</button>` : ""}<a class="btn small" href="#mundo">Mapa del mundo</a>`;
  const tp = $("#togglepanel", el);
  if (tp) tp.onclick = () => { panelHidden = !panelHidden; draw(); if (tac) setTimeout(() => tac.update(), 50); };
  const panel = $("#dmp", el);
  panel.hidden = !dm || panelHidden;
  if (dm && !panelHidden) {
    const open = [...$$("details[open]", panel)].map(d => d.dataset.k);
    panel.innerHTML = sessionBlock(state) + tacticalBlock(state) + showBlock(state);
    open.forEach(k => { const d = $(`details[data-k="${k}"]`, panel); if (d) d.open = true; });
    bind(state);
  }
  drawStage();
}

function sessionBlock(state) {
  const live = liveSession(state);
  if (!live) return `<div class="panel"><h2 class="sec">Sesión</h2>
    <p class="empty" style="margin-bottom:12px">No hay ninguna sesión abierta.</p>
    <div class="row"><button class="btn gold" id="start">Empezar sesión</button><button class="btn" id="starttest">Sesión de pruebas</button></div>
    <p class="note" style="margin:12px 0 0">La sesión de pruebas solo la ven el administrador y los másteres. Úsala para preparar y ensayar sin que el grupo vea nada.</p></div>`;
  if (closing) return `<div class="panel"><h2 class="sec">Cerrar ${esc(sessionName(live))}</h2>
    ${live.test ? `<p class="empty" style="margin-bottom:12px">La sesión de pruebas se descarta al cerrarla.</p>` : `
    <label class="field">Título<input id="ctitle" placeholder="La cripta bajo el campanario" value="${esc(live.title)}"></label>
    <label class="field" style="margin-top:10px">Qué pasó (será el «Anteriormente…» de la próxima)<textarea id="crecap" rows="6">${esc(live.recap)}</textarea></label>`}
    <div class="row" style="margin-top:12px"><button class="btn gold" id="doclose">${live.test ? "Terminar la prueba" : "Guardar y cerrar"}</button><button class="btn" id="cancelclose">Seguir jugando</button></div></div>`;
  return `<div class="panel"><h2 class="sec">${esc(sessionName(live))} en curso</h2>
    ${live.test ? `<p class="note" style="margin:0 0 12px">Los jugadores no ven esta sesión ni lo que muestres en ella.</p>` : ""}
    <div class="row"><button class="btn" id="close">Cerrar sesión</button></div></div>`;
}

function tacticalBlock(state) {
  const b = state.board, p = state.presentation || {};
  const groups = [];
  state.world.places.forEach(pl => { const sc = state.scenes.filter(x => x.place === pl.id); if (sc.length) groups.push([pl.id, pl.name, sc]); });
  const lib = state.scenes.filter(x => !x.place || !state.world.places.some(pl => pl.id === x.place));
  if (lib.length) groups.push(["lib", "Biblioteca (para improvisar)", lib]);
  return `<div class="panel"><h2 class="sec">Escena táctica</h2>
    ${b ? `<p style="margin:0 0 8px">En la mesa: <b>${esc(b.name)}</b></p>
      <div class="showlist">
        <button class="btn small" data-show='{"type":"tactical"}' ${p.type === "tactical" ? 'aria-pressed="true"' : ""}>Mostrar la mesa</button>
        <button class="btn small" id="tedit" aria-pressed="${tacEdit}">${tacEdit ? "Terminar de editar" : "Editar la mesa"}</button>
        <button class="btn small" id="tsave">Guardar como escena</button>
        <button class="btn small danger" id="tclear">Retirar la mesa</button>
      </div>` : `<p class="empty" style="margin:0 0 8px">No hay ninguna escena en la mesa.</p>`}
    <div class="showplaces" style="margin-top:10px">${groups.map(([k, n, sc]) => `<details data-k="${k}"><summary><span>${esc(n)}</span><small>${sc.length}</small></summary>
      <div class="scenelist">${sc.map(x => `<div class="scenerow"><span>${esc(x.name)}</span><small>${x.tokens.length} fichas</small><button class="btn small gold" data-load="${x.id}">Cargar</button></div>`).join("")}</div></details>`).join("")}</div>
    <div class="row" style="margin-top:10px"><button class="btn small" id="tblank">Mesa vacía</button><a class="btn small" href="#escenas">Preparar escenas</a></div>
    <p class="note" style="margin:10px 0 0">Al cargar una escena, todos la ven y el grupo aparece en su punto de inicio.</p></div>`;
}

function showBlock(state) {
  const p = state.presentation || {};
  const on = (t, extra = {}) => p.type === t && Object.entries(extra).every(([k, v]) => p[k] === v) ? ' aria-pressed="true"' : "";
  const places = state.world.places;
  return `<div class="panel"><h2 class="sec">Mostrar al grupo</h2>
    <div class="showlist">
      <button class="btn" data-show='{"type":"recap"}'${on("recap")} ${lastClosed(state) ? "" : "disabled"}>Anteriormente…</button>
      <button class="btn" data-show='{"type":"world"}'${on("world")}>Mapa del mundo</button>
    </div>
    <h2 class="sec" style="margin-top:16px">Lugares</h2>
    <div class="showplaces">${places.map(pl => `<details data-k="pl-${pl.id}"><summary><span>${esc(pl.name)}</span>${pl.visible ? "" : `<small>oculto</small>`}</summary>
        <div class="showlist">
          <button class="btn small" data-show='${JSON.stringify({ type: "place", place: pl.id })}'${on("place", { place: pl.id })}>${pl.map ? "Mapa del lugar" : "El lugar"}</button>
          ${pl.items.map(it => `<button class="btn small" data-show='${esc(JSON.stringify({ type: "item", place: pl.id, item: it.id }))}'${on("item", { item: it.id })}>${it.type === "image" ? "🖼 " : ""}${esc(it.title)}${it.revealed ? "" : " · oculto"}</button>`).join("")}
        </div></details>`).join("") || `<p class="empty">Aún no hay lugares. Créalos en el mapa del mundo.</p>`}</div>
    <p class="note" style="margin:12px 0 0">Mostrar un lugar o un contenido oculto lo revela a los jugadores.</p>
    <div class="row" style="margin-top:12px"><button class="btn small" id="clear" ${state.presentation ? "" : "disabled"}>Quitar de la mesa</button></div></div>`;
}

function bind(state) {
  const on = (id, fn) => { const b = $("#" + id, el); if (b) b.onclick = fn; };
  on("start", () => startSession(false));
  on("starttest", () => startSession(true));
  on("close", () => { closing = true; draw(); });
  on("cancelclose", () => { closing = false; draw(); });
  on("doclose", () => {
    const t = $("#ctitle", el), r = $("#crecap", el);
    if (r && !r.value.trim()) { toast("Escribe un pequeño resumen: será el «Anteriormente…» de la próxima sesión"); r.focus(); return; }
    closing = false; closeSession(t ? t.value.trim() : "", r ? r.value.trim() : "");
    toast("Sesión cerrada");
  });
  on("clear", () => show(null));
  on("tblank", () => { tacEdit = true; blankBoard(); });
  on("tedit", () => { tacEdit = !tacEdit; draw(); });
  on("tclear", () => { const b = $("#tclear", el); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Pulsa otra vez"; return; } tacEdit = false; clearBoard(); });
  on("tsave", () => {
    const b = $("#tsave", el);
    if (!b.dataset.sure) { b.dataset.sure = 1; b.outerHTML = `<span class="savescene"><input id="tsname" placeholder="Nombre de la escena" value="${esc(state.board.name)}"><button class="btn small gold" id="tsok">Guardar</button></span>`; $("#tsok", el).onclick = () => { saveBoardAsScene($("#tsname", el).value.trim() || state.board.name, null); toast("Guardada en la biblioteca de escenas"); }; }
  });
  $$("[data-load]", el).forEach(b => b.onclick = () => { tacEdit = false; loadScene(b.dataset.load); });
  $$("[data-show]", el).forEach(b => b.onclick = () => show(JSON.parse(b.dataset.show)));
}
