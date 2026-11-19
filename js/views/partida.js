// La Partida: el escenario común y, para el máster, el panel con el que decide qué tenéis delante.
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { liveSession, visibleLive, lastClosed, sessionName, startSession, closeSession, show, presentationFor, addEntry } from "../core/sesiones.js";
import { loadScene, blankBoard, clearBoard, saveBoardAsScene, addPC, removePC } from "../core/mesa.js";
import { presence } from "../core/presence.js";
import { loreOf, entry, related, refName, showEntry, clockOf, clockText, advanceClock, setBackdrop } from "../core/lore.js";
import { renderStage } from "./presentacion.js";
import { mountTactical } from "./mesa.js";
import { renderRolls } from "./tiradas.js";
import { renderSheet } from "./ficha.js";
import { $, $$, esc, toast } from "../core/ui.js";

let rollsOpen = false, el, closing = false, tac = null, tacEdit = false, panelHidden = false, lastKey = null;

export function mount(root) {
  el = document.createElement("div");
  el.className = "partida";
  el.innerHTML = `<section class="stagebox"><div id="stage" class="stage-area"></div><div class="stagebar" id="sbar"></div></section><aside class="dmpanel" id="dmp" aria-label="Panel del máster"></aside>
    <aside class="plpanel" id="plp" aria-label="Tu columna: iniciativa, ficha y dados" hidden><section class="pl-ini" id="pl-ini" hidden></section><section class="pl-sheet" id="pl-sheet"></section><section class="pl-dice" id="pl-dice"></section></aside>`;
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
    const side = isDM(s) ? null : $("#pl-ini", el);
    if (side) side.hidden = false;
    if (!tac || lastKey !== k) { lastKey = k; tac = mountTactical(st, { edit: tacEdit, sideHost: side }); }
    else tac.update();
    return;
  }
  tac = null; st.classList.remove("tac");
  const pi = $("#pl-ini", el); if (pi) { pi.hidden = true; pi.innerHTML = ""; }
  let dr = $(".rolldrawer", el.querySelector(".stagebox"));
  if (rollsOpen) { if (!dr) { dr = document.createElement("div"); dr.className = "rolldrawer"; el.querySelector(".stagebox").style.position = "relative"; el.querySelector(".stagebox").appendChild(dr); } renderRolls(dr); }
  else if (dr) dr.remove();
  const key = JSON.stringify(presentationFor(s)) + JSON.stringify(s.world.places.map(p => [p.map, p.summary, p.items.length]));
  if (!force && key === lastKey && st.childElementCount) return;
  lastKey = key; renderStage(st);
}

function draw() {
  if (!el) return;
  const state = store.get();
  const dm = isDM(state);
  const live = visibleLive(state);
  el.classList.toggle("withpanel", (dm && !panelHidden) || !dm);
  // Jugadores: columna fija con su ficha y su tapete de dados (la iniciativa entra cuando hay mesa táctica)
  const plp = $("#plp", el); plp.hidden = dm;
  if (!dm) { renderSheet($("#pl-sheet", el)); renderRolls($("#pl-dice", el)); }
  const typing = box => box && box.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (!typing($("#sbar", el))) $("#sbar", el).innerHTML = `${live ? `<b>${esc(sessionName(live))}</b> en curso${live.test ? ` · <span class="tag secret">SOLO MÁSTERES</span>` : ""}` : "No hay ninguna partida en curso"}
    ${live ? `<span class="quicknote"><input id="qnote" placeholder="📜 Anotar en la crónica…" aria-label="Nota para la crónica"><button class="btn small" id="qnotego">Anotar</button></span>` : ""}
    <span class="grow"></span>${tactical(state) || !dm ? "" : `<button class="btn small" id="rollsbtn" aria-pressed="${rollsOpen}">🎲 Tiradas</button>`}${dm ? `<button class="btn small" id="togglepanel">${panelHidden ? "Mostrar panel" : "Ocultar panel"}</button>` : ""}<a class="btn small" href="#mundo">Mapa del mundo</a>`;
  const qn = $("#qnote", el), qg = $("#qnotego", el);
  if (qg) { const go = () => { if (qn.value.trim()) { addEntry(live.id, qn.value); qn.value = ""; toast("Anotado en la crónica"); } }; qg.onclick = go; qn.onkeydown = e => { if (e.key === "Enter") go(); }; }
  const rb = $("#rollsbtn", el); if (rb) rb.onclick = () => { rollsOpen = !rollsOpen; draw(); };
  const tp = $("#togglepanel", el);
  if (tp) tp.onclick = () => { panelHidden = !panelHidden; draw(); if (tac) setTimeout(() => tac.update(), 50); };
  const panel = $("#dmp", el);
  panel.hidden = !dm || panelHidden;
  if (dm && !panelHidden && !(closing && typing(panel))) {
    const open = [...$$("details[open]", panel)].map(d => d.dataset.k);
    panel.innerHTML = sessionBlock(state) + directionBlock(state) + tacticalBlock(state) + showBlock(state);
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
    <label class="field" style="margin-top:10px">Qué pasó (será el «Anteriormente…» de la próxima)<textarea id="crecap" rows="6">${esc(live.recap || notesOf(state, live.id))}</textarea></label>
    ${notesOf(state, live.id) && !live.recap ? `<p class="note" style="margin:6px 0 0">Lo he rellenado con las notas de la crónica. Retócalo a tu gusto.</p>` : ""}
    <h2 class="sec" style="margin-top:14px">Experiencia</h2>
    <div class="xpgrid xpall"><input type="number" id="xpall" min="0" placeholder="PX" aria-label="PX para todos"><input id="xpwhy" placeholder="Motivo (p. ej. derrotar a los esqueletos)" aria-label="Motivo"><button class="btn small" id="xpfill">A todos</button></div>
    <div class="xplist">${state.characters.map(c => `<div class="xpgrid"><span>${esc(c.name)}</span><input type="number" min="0" data-xpc="${c.id}" placeholder="0" aria-label="PX para ${esc(c.name)}"><input data-xpr="${c.id}" placeholder="Motivo" aria-label="Motivo para ${esc(c.name)}"></div>`).join("")}</div>`}
    <div class="row" style="margin-top:12px"><button class="btn gold" id="doclose">${live.test ? "Terminar la prueba" : "Guardar y cerrar"}</button><button class="btn" id="cancelclose">Seguir jugando</button></div></div>`;
  return `<div class="panel"><h2 class="sec">${esc(sessionName(live))} en curso</h2>
    ${live.test ? `<p class="note" style="margin:0 0 12px">Los jugadores no ven esta sesión ni lo que muestres en ella.</p>` : ""}
    <div class="row"><button class="btn" id="close">Cerrar sesión</button></div></div>`;
}

// Dirección: reloj de campaña y la carpeta de escenas preparadas para esta sesión, a un clic
function directionBlock(state) {
  const live = liveSession(state); if (!live) return "";
  const chaps = loreOf(state).filter(e => e.kind === "chapter" && (e.session === live.id || !e.session)).sort((a, b) => (a.session ? 0 : 1) - (b.session ? 0 : 1) || (a.order || 0) - (b.order || 0));
  return `<div class="panel"><h2 class="sec">Dirección</h2>
    <div class="lclock inline"><span>🕯 ${esc(clockText(clockOf(state)))}</span><div class="row">${[[10, "+10 min"], [60, "+1 h"], [480, "+8 h"]].map(([m, l]) => `<button class="btn small" data-clock="${m}">${l}</button>`).join("")}</div></div>
    ${chaps.length ? `<div class="showplaces"><details data-k="prep" open><summary><span>📂 Escenas preparadas</span><small>${chaps.length}</small></summary><ol class="prepmini">${chaps.map(c => `<li><a href="#lore/${c.id}">${esc(c.name)}</a><span>${related(state, c.id).map(r => { const n = refName(state, r), e = entry(state, r);
        return e && e.kind !== "note" && e.kind !== "chapter" ? `<button class="btn small" data-showlore="${r}" title="Mostrar a todos">${n.icon} ${esc(n.name)}</button>` : n.kind === "scene" ? `<button class="btn small" data-load="${r}" title="Cargar en la mesa">⚔️ ${esc(n.name)}</button>` : `<a class="btn small" href="#lore/${r}">${n.icon} ${esc(n.name)}</a>`; }).join("")}</span></li>`).join("")}</ol></details></div>` : `<p class="empty">Sin escenas preparadas. <a href="#lore/s:chapter">Prepáralas en el Lore</a>.</p>`}
    <div class="row" style="margin-top:8px"><a class="btn small" href="#lore">📖 Abrir el Lore</a>${state.backdrop ? `<button class="btn small" id="nobackdrop">Quitar fondo</button>` : ""}</div></div>`;
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
      </div>
      <h3 class="sub" style="margin:14px 0 6px">Personajes en la mesa</h3>
      <div class="pclist">${state.characters.map(c => { const on = state.tokens.some(t => t.kind === "pc" && t.char === c.id), live = c.owner && presence.online(c.owner);
        return `<label class="pcrow${on ? " on" : ""}"><input type="checkbox" data-pc="${c.id}" ${on ? "checked" : ""}><span class="dot${live ? " live" : ""}" title="${live ? "Conectado" : "Desconectado"}"></span><span>${esc(c.name)}</span><small>${live ? "conectado" : "fuera"}</small></label>`; }).join("") || `<p class="empty">No hay personajes.</p>`}</div>` : `<p class="empty" style="margin:0 0 8px">No hay ninguna escena en la mesa.</p>`}
    <div class="showplaces" style="margin-top:10px">${groups.map(([k, n, sc]) => `<details data-k="${k}"><summary><span>${esc(n)}</span><small>${sc.length}</small></summary>
      <div class="scenelist">${sc.map(x => `<div class="scenerow"><span>${esc(x.name)}</span><small>${x.tokens.length} fichas</small><button class="btn small gold" data-load="${x.id}">Cargar</button></div>`).join("")}</div></details>`).join("")}</div>
    <div class="row" style="margin-top:10px"><button class="btn small" id="tblank">Mesa vacía</button><a class="btn small" href="#escenas">Preparar escenas</a></div>
    <p class="note" style="margin:10px 0 0">Al cargar una escena solo aparecen los personajes de quien está conectado. Marca o desmarca arriba para meter o sacar a alguien.</p></div>`;
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
    const xp = $$("[data-xpc]", el).map(i => ({ char: i.dataset.xpc, amount: +i.value || 0, reason: ($(`[data-xpr="${i.dataset.xpc}"]`, el) || {}).value || "" }));
    closing = false; closeSession(t ? t.value.trim() : "", r ? r.value.trim() : "", xp);
    const total = xp.reduce((a, x) => a + x.amount, 0);
    toast(total ? `Sesión cerrada · ${total} PX repartidos` : "Sesión cerrada");
  });
  on("clear", () => show(null));
  on("xpfill", () => { const v = $("#xpall", el).value, why = $("#xpwhy", el).value; $$("[data-xpc]", el).forEach(i => (i.value = v)); $$("[data-xpr]", el).forEach(i => { if (!i.value) i.value = why; }); });
  on("tblank", () => { tacEdit = true; blankBoard(); });
  on("tedit", () => { tacEdit = !tacEdit; draw(); });
  $$("[data-clock]", el).forEach(b => b.onclick = () => advanceClock(+b.dataset.clock));
  $$("[data-showlore]", el).forEach(b => b.onclick = () => showEntry(b.dataset.showlore));
  on("nobackdrop", () => setBackdrop(null));
  $$("[data-pc]", el).forEach(b => b.onchange = () => b.checked ? addPC(b.dataset.pc) : removePC(b.dataset.pc));
  on("tclear", () => { const b = $("#tclear", el); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Pulsa otra vez"; return; } tacEdit = false; clearBoard(); });
  on("tsave", () => {
    const b = $("#tsave", el);
    if (!b.dataset.sure) { b.dataset.sure = 1; b.outerHTML = `<span class="savescene"><input id="tsname" placeholder="Nombre de la escena" value="${esc(state.board.name)}"><button class="btn small gold" id="tsok">Guardar</button></span>`; $("#tsok", el).onclick = () => { saveBoardAsScene($("#tsname", el).value.trim() || state.board.name, null); toast("Guardada en la biblioteca de escenas"); }; }
  });
  $$("[data-load]", el).forEach(b => b.onclick = () => { tacEdit = false; loadScene(b.dataset.load); });
  $$("[data-show]", el).forEach(b => b.onclick = () => show(JSON.parse(b.dataset.show)));
}

const notesOf = (s, sid) => (s.chronicle || []).filter(e => e.session === sid).map(e => e.text).join("\n");
