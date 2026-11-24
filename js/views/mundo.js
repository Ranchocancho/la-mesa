// Mapa del mundo: vuestro mapa, lugares con contenido y el control del máster sobre lo que ve cada uno.
import { store, uid } from "../core/store.js";
import { isDM, can } from "../core/session.js";
import { getImage, putImage, readImageFile } from "../core/images.js";
import { exampleMap } from "../data/worldmap.js";
import { MAP_ICONS, ICON_CATS, iconURL, PIN_SIZES, PIN_TINTS, pinDefaults } from "../data/simbolos.js";
import { $, $$, esc, toast, debounce, pickFile } from "../core/ui.js";
import { regionsOf, regionById, seeRegion, bboxOf, regionAt, toLocal, toGlobal, centroid, placesIn, addRegion, editRegion, deleteRegion, REG_COLORS } from "../core/regiones.js";
import { REGIONS } from "../data/mapas.js";
import { partyPos, moveParty, partyToPlace, routesOf, undoStep, canUndoParty, tripText, kmOf, scaleKm, paceOf, PACES, setScale } from "../core/ruta.js";
import { liveSession } from "../core/sesiones.js";
import { sampleSource, maskFrom, genURL, CLIMAS, FORMAS, bake, paintMask, Q, UQ, pairs } from "../core/generamapa.js";

const KINDS = ["Región", "Ciudad", "Pueblo", "Distrito", "Localización", "Mazmorra", "Punto de interés"];
const PIN = (fill) => `<svg viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1C7.3 1 1 7 1 14.6 1 25 15 37 15 37s14-12 14-22.4C29 7 22.7 1 15 1z" fill="${fill}" stroke="#2b1d10" stroke-width="2"/><circle cx="15" cy="14" r="5" fill="#2b1d10"/></svg>`;

let el, vp, stage, img, pinsEl, side;
let view = { x: 0, y: 0, k: 1 }, imgW = 1600, imgH = 1000;
let sel = null, adding = false, fitted = false;
// Vistas: "global" (el mapa entero), "regions" (el mapa troceado en regiones) y "region" (dentro de una región)
let mode = "global", regId = null, drawing = null, redrawId = null, mapKey = "";
// Generador (Hito 72): borrador que se está ajustando (se ve en el mapa antes de guardarlo) y para qué es
let genDraft = null, genSample = null, drawKind = "region";
// Retoque a mano (Hito 73): herramienta, tamaño del pincel y elemento seleccionado ({ k: "m"|"f"|"r"|"c"|"t", i, v: vértice })
let gTool = "sel", gBrush = 40, gSel = null;
// Ruta del grupo (Hito 74): qué rutas se dibujan («live», «all», «none» o el id de una sesión)
let placesLocked = true; // los lugares no se mueven sin querer: se desbloquean con el candado (Hito 76)
let routeView = (() => { try { return sessionStorage.getItem("lamesa:route") || "live"; } catch (e) { return "live"; } })();

export function mount(root) {
  try { routeView = sessionStorage.getItem("lamesa:route") || routeView; } catch (e) { /* nada */ }
  el = document.createElement("div");
  el.className = "world";
  el.innerHTML = `
    <div class="viewport" id="vp">
      <div class="stage" id="stage"><img id="mapimg" alt="Mapa del mundo"><svg id="regsvg" class="regsvg" aria-hidden="true"></svg><svg id="genov" class="genov" aria-hidden="true"></svg><svg id="routesvg" class="routesvg" aria-hidden="true"></svg><div id="pins"></div></div>
      <div class="mapzoom"><button id="zin" aria-label="Acercar">+</button><button id="zout" aria-label="Alejar">−</button><button id="zfit" aria-label="Ver el mapa entero" title="Ver el mapa entero">⤢</button></div>
      <div class="hintbar" id="hint" hidden>Haz clic en el mapa para colocar el nuevo lugar · Esc para cancelar</div>
    </div>
    <aside class="side wside" aria-label="Regiones y lugares"><div class="sidetop"><div class="maptabs" id="maptabs"></div><div class="maptools" id="maptools"></div></div><div class="sidebody" id="side"></div></aside>`;
  root.appendChild(el);
  vp = $("#vp", el); stage = $("#stage", el); img = $("#mapimg", el); pinsEl = $("#pins", el); side = $("#side", el);
  fitted = false; mapKey = "";
  if (mode === "region" && !regionById(store.get(), regId)) { mode = "regions"; regId = null; }
  loadMap();
  bindViewport();
  redraw();
  const onKey = e => {
    if (e.key === "Escape" && adding) setAdding(false);
    if (drawing && e.key === "Escape") { drawing = null; redrawId = null; redraw(); }
    if (drawing && e.key === "Enter") finishDrawing();
    if (drawing && e.key === "Backspace" && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName)) { drawing.pop(); redraw(); }
  };
  document.addEventListener("keydown", onKey);
  const onResize = () => fit();
  window.addEventListener("resize", onResize);
  return {
    update(state, label, remote) {
      if (mode === "region" && !regionById(state, regId)) { mode = "regions"; regId = null; }
      if (label === "map" || label === "reset") loadMap();
      if (sel && !state.world.places.some(p => p.id === sel)) sel = null;
      drawTabs(); drawTools(); drawPins(); drawRegions();
      if (!(label === "field" && !remote)) drawSide();
    },
    unmount() { document.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); }
  };
}

/* ---------- Mapa, zoom y desplazamiento ---------- */
const curRegion = () => mode === "region" ? regionById(store.get(), regId) : null;
const ownMap = () => { const r = curRegion(); return r && (r.map || r.gen || (genDraft && genDraft.reg === r.id)) ? r : null; };
/** Imagen del mapa base del mundo (subido o de ejemplo), con su tamaño. */
async function baseMap() {
  const st = store.get(); let url = st.world.map ? await getImage(st.world.map) : null;
  if (url) return { url, w: st.world.mapW, h: st.world.mapH };
  if (st.world.gen) { const w = 1600, h = 1000; return { url: genURL(st.world.gen, w, h, [], null), w, h }; }
  const m = exampleMap(); return { url: m.url, w: m.w, h: m.h };
}
/** El mapa generado de una región: mismo encuadre que su recuadro sobre el mapa base, a más resolución. */
function regionGenImage(r, gen) {
  const st = store.get(), b = bboxOf(r), bw = st.world.map ? st.world.mapW : 1600, bh = st.world.map ? st.world.mapH : 1000;
  const W = 1800, H = Math.max(400, Math.min(2400, Math.round(W * (b.h * bh) / (b.w * bw))));
  // caminos solo hasta los lugares que cada uno ve: los de lugares ocultos no delatan nada a los jugadores
  const pl = placesIn(st, r).filter(p => can.seePlace(st, p)).map(p => toLocal(r, p.x, p.y)).map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) }));
  const poly = r.pts.map(p => toLocal(r, p.x, p.y)).map(p => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4) }));
  return { url: genURL(gen, W, H, gen.autoRoads ? pl : [], poly), w: W, h: H };
}
// Coordenadas: los lugares guardan su posición global (0–1); en una región con mapa propio se traducen
function g2i(x, y) { const r = ownMap(); if (r) { const l = toLocal(r, x, y); return [l.x * imgW, l.y * imgH]; } return [x * imgW, y * imgH]; }
function i2g(px, py) { const r = ownMap(), x = px / imgW, y = py / imgH; return r ? toGlobal(r, x, y) : { x, y }; }
function evPoint(e) { const r = vp.getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k]; }

async function loadMap() {
  const state = store.get(), own = ownMap();
  const key = own ? "r:" + (own.map || own.id) : "g:" + (state.world.map || "") + ":" + mode + ":" + (regId || "");
  let url, w, h;
  const draftReg = genDraft && genDraft.reg && own && genDraft.reg === own.id;
  if (own && (draftReg || (!own.map && own.gen))) { const m = regionGenImage(own, draftReg ? genDraft.gen : own.gen); url = m.url; w = m.w; h = m.h; }
  else if (own) { url = await getImage(own.map); w = own.mapW; h = own.mapH; }
  if (!url && genDraft && genDraft.world && mode === "global") { w = 1600; h = 1000; url = genURL(genDraft.gen, w, h, genDraft.gen.autoRoads ? state.world.places.filter(p => !p.parent && can.seePlace(state, p)).map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })) : [], null); }
  if (!url && state.world.map) { url = await getImage(state.world.map); w = state.world.mapW; h = state.world.mapH; }
  if (!url && state.world.gen) { w = 1600; h = 1000; url = genURL(state.world.gen, w, h, state.world.gen.autoRoads ? state.world.places.filter(p => !p.parent && can.seePlace(state, p)).map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })) : [], null); }
  if (!url) { const m = exampleMap(); url = m.url; w = m.w; h = m.h; }
  imgW = w; imgH = h;
  img.src = url; img.width = w; img.height = h;
  stage.style.width = w + "px"; stage.style.height = h + "px";
  if (key !== mapKey) { mapKey = key; fitted = false; }
  if (!fitted) fit();
  drawPins(); drawRegions(); drawOv();
}
function apply() {
  stage.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
  stage.style.setProperty("--ik", 1 / view.k);
  $$(".pin", pinsEl).forEach(p => (p.style.transform = `translate(-50%,-50%) scale(${1 / view.k})`)); // el punto es el centro del círculo
}
function fit() {
  const r = vp.getBoundingClientRect();
  if (!r.width) return;
  const reg = curRegion();
  if (reg && !ownMap()) { // sin mapa propio: el mapa global, acercado a la región
    const b = bboxOf(reg), bw = b.w * imgW, bh = b.h * imgH;
    view.k = Math.min(r.width / bw, r.height / bh) * 0.94;
    view.x = (r.width - bw * view.k) / 2 - b.x0 * imgW * view.k; view.y = (r.height - bh * view.k) / 2 - b.y0 * imgH * view.k;
  } else {
    view.k = Math.min(r.width / imgW, r.height / imgH) * 0.96;
    view.x = (r.width - imgW * view.k) / 2; view.y = (r.height - imgH * view.k) / 2;
  }
  fitted = true; apply();
}
function zoomAt(f, cx, cy) {
  const k = Math.max(0.15, Math.min(8, view.k * f));
  view.x = cx - (cx - view.x) * (k / view.k); view.y = cy - (cy - view.y) * (k / view.k); view.k = k; apply();
}
function bindViewport() {
  let drag = null;
  vp.addEventListener("pointerdown", e => {
    if (e.target.closest(".pin,.maptools,.mapzoom,.maptabs,.partybar")) return;
    if (genEditing() && !drawing && e.button === 0 && genDown(e)) { vp.setPointerCapture(e.pointerId); return; }
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener("pointermove", e => {
    if (genEditing()) genMove(e);
    if (gAct) return;
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; vp.classList.add("panning"); }
    if (drag.moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; apply(); }
  });
  vp.addEventListener("pointerup", e => {
    if (gAct) { genUp(e); return; }
    if (!drag) return;
    const click = !drag.moved; drag = null; vp.classList.remove("panning");
    if (!click) return;
    const [px, py] = evPoint(e), g = i2g(px, py);
    if (drawing) {
      if (px < 0 || py < 0 || px > imgW || py > imgH) return;
      const f = drawing[0];
      if (drawing.length >= 3 && Math.hypot((f.x - g.x) * imgW, (f.y - g.y) * imgH) * view.k < 14) return finishDrawing();
      drawing.push({ x: +g.x.toFixed(4), y: +g.y.toFixed(4) }); redraw(); return;
    }
    if (!adding && mode === "regions") { const r = regionAt(store.get(), g.x, g.y, isDM(store.get())); if (r) return enterRegion(r.id); }
    if (adding) {
      const { x, y } = g;
      if (px < 0 || py < 0 || px > imgW || py > imgH) return;
      const id = uid("lugar"), reg = curRegion();
      store.commit("place", s => s.world.places.push({ id, name: "Nuevo lugar", kind: "Punto de interés", x, y, visible: false, summary: "", secret: "", items: [], ...(reg ? { region: reg.id, detail: true } : {}) }));
      sel = id; setAdding(false); drawSide();
      const n = $("#f-name", side); if (n) { n.focus(); n.select(); }
    } else { sel = null; drawPins(); drawSide(); }
  });
  vp.addEventListener("wheel", e => {
    e.preventDefault();
    const r = vp.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  const center = () => { const r = vp.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
  $("#zin", el).onclick = () => zoomAt(1.25, ...center());
  $("#zout", el).onclick = () => zoomAt(0.8, ...center());
  $("#zfit", el).onclick = fit;
  vp.addEventListener("pointermove", e => { if (mode !== "regions" || drawing) return; const [px, py] = evPoint(e), g = i2g(px, py), r = regionAt(store.get(), g.x, g.y, isDM(store.get())), id = r ? r.id : "";
    if (id !== vp.dataset.hov) { vp.dataset.hov = id; $$("[data-reg]", stage).forEach(p => p.classList.toggle("hov", p.dataset.reg === id)); vp.classList.toggle("onreg", !!id); } });
}
function setAdding(on) {
  adding = on; vp.classList.toggle("adding", on); $("#hint", el).hidden = !on;
  const b = $("#addplace", el); if (b) b.setAttribute("aria-pressed", on);
}

/* ---------- Herramientas del máster ---------- */
function drawTools() {
  const state = store.get(), t = $("#maptools", el);
  if (!isDM(state)) { t.hidden = true; return; }
  t.hidden = false;
  const reg = curRegion();
  if (drawing) {
    t.innerHTML = `<span class="drawhint">✏️ ${drawKind === "road" ? "Traza el camino" : drawKind === "river" ? "Traza el río (de la fuente al mar)" : redrawId ? "Redibuja el contorno" : "Dibuja la región"}: clic para cada punto · ${drawing.length} puntos</span>
      <button class="btn small gold" id="drawok" ${drawing.length < (drawKind === "region" ? 3 : 2) ? "disabled" : ""}>${drawKind === "road" ? "✓ Terminar camino" : drawKind === "river" ? "✓ Terminar río" : "✓ Cerrar región"}</button><button class="btn small" id="drawundo" ${drawing.length ? "" : "disabled"}>↶ Punto</button><button class="btn small" id="drawx">Cancelar</button>`;
    $("#drawok", t).onclick = finishDrawing;
    $("#drawundo", t).onclick = () => { drawing.pop(); redraw(); };
    $("#drawx", t).onclick = () => { drawing = null; redrawId = null; drawKind = "region"; redraw(); };
    return;
  }
  if (mode === "regions") {
    t.innerHTML = `<button class="btn small gold" id="drawreg">✏️ Dibujar región</button>`;
    $("#drawreg", t).onclick = () => { drawing = []; sel = null; redraw(); };
    return;
  }
  if (genDraft) { t.innerHTML = `<span class="drawhint">🧭 Ajustando el mapa generado: lo ves en directo. Guárdalo abajo.</span>`; return; }
  t.innerHTML = `<button class="btn small" id="addplace" aria-pressed="${adding}">+ Añadir lugar</button>${!partyPos(state) ? `<button class="btn small" id="partyput" title="Pon la ficha del grupo en el mapa; luego arrástrala para moverla">⚑ Colocar al grupo</button>` : ""}
    ${reg && reg.map ? "" : reg ? `<button class="btn small gold" id="genopen" title="Genera un mapa detallado de la región calcando la costa del mapa de debajo: costa, montañas, bosques, ríos y caminos. Se guarda como datos, no como imagen.">🧭 ${reg.gen ? "Ajustar el detalle" : "Detallar la región"}</button>`
      : `<button class="btn small" id="genopen" title="Genera un mapa completo (isla, continente, archipiélago). Se usa si no habéis subido un mapa.">🧭 ${state.world.gen ? "Ajustar el mapa generado" : "Generar un mapa"}</button>`}
    ${reg ? `<button class="btn small" id="upreg">${reg.map ? "Cambiar mapa de la región" : "Subir mapa de la región"}</button>${reg.map ? `<button class="btn small" id="noreg">Usar el mapa global</button>` : ""}`
      : `<button class="btn small" id="upmap">Subir vuestro mapa</button>${state.world.map ? `<button class="btn small" id="exmap">Volver al mapa de ejemplo</button>` : ""}`}`;
  $("#addplace", t).onclick = () => setAdding(!adding);
  { const go = $("#genopen", t); if (go) go.onclick = () => openGen(); }
  { const pp = $("#partyput", t); if (pp) pp.onclick = () => { const r = curRegion(), c = r ? toGlobal(r, 0.5, 0.5) : { x: 0.5, y: 0.5 }; moveParty(c.x, c.y); toast("Ahí está el grupo: arrástralo adonde esté."); }; }
  { const pu = $("#partyundo", t); if (pu) pu.onclick = () => undoStep(); }
  const up = $("#upmap", t);
  if (up) up.onclick = async () => {
    const f = await pickFile(); if (!f) return;
    try {
      toast("Cargando el mapa…");
      const r = await readImageFile(f, 3200);
      const key = uid("mapa");
      await putImage(key, r.dataURL);
      store.commit("map", s => { s.world.map = key; s.world.mapW = r.w; s.world.mapH = r.h; });
      toast("Mapa cargado. Recoloca los lugares si hace falta.");
    } catch (err) { toast("No se pudo cargar la imagen. Prueba con un JPG o PNG."); }
  };
  const ur = $("#upreg", t);
  if (ur) ur.onclick = async () => {
    const f = await pickFile(); if (!f) return;
    try {
      toast("Cargando el mapa de la región…");
      const r = await readImageFile(f, 3200), key = uid("mapa");
      await putImage(key, r.dataURL);
      editRegion(reg.id, x => { x.map = key; x.mapW = r.w; x.mapH = r.h; });
      toast("Mapa de la región guardado: debe abarcar el recuadro de su contorno.");
    } catch (err) { toast("No se pudo cargar la imagen. Prueba con un JPG o PNG."); }
  };
  const nr = $("#noreg", t); if (nr) nr.onclick = () => editRegion(reg.id, x => { delete x.map; delete x.mapW; delete x.mapH; });
  const ex = $("#exmap", t);
  if (ex) ex.onclick = () => store.commit("map", s => { s.world.map = null; });
}

/* ---------- Generador de mapas (Hito 72) ---------- */
async function openGen() {
  const st = store.get(), reg = curRegion();
  if (reg) {
    const prev = reg.gen ? JSON.parse(JSON.stringify(reg.gen)) : null;
    genDraft = { reg: reg.id, gen: prev || { forma: "calco", seed: Math.floor(Math.random() * 1e6), sea: 0, mont: 50, bosq: 50, rios: 40, clima: "templado", autoRoads: true, roads: [] } };
    toast("Leyendo la costa del mapa…");
    try { const b = await baseMap(); genSample = await sampleSource(b.url, bboxOf(reg)); } catch (e) { genSample = null; }
    if (genDraft.gen.forma === "calco") { if (genSample) genDraft.gen.mask = maskFrom(genSample, (genDraft.gen.sea || 0) / 100); else genDraft.gen.forma = "tierra"; }
  } else genDraft = { world: true, gen: st.world.gen ? JSON.parse(JSON.stringify(st.world.gen)) : { forma: "isla", seed: Math.floor(Math.random() * 1e6), sea: 0, mont: 50, bosq: 50, rios: 40, clima: "templado", autoRoads: false, roads: [], title: st.world.name || "" } };
  sel = null; setAdding(false); fitted = false; loadMap(); redraw();
}
const genRefresh = debounce(() => { if (!genDraft) return; const g = genDraft.gen; if (genDraft.reg && g.forma === "calco" && genSample) g.mask = maskFrom(genSample, (g.sea || 0) / 100); loadMap(); }, 220);
function drawGenPanel(st) {
  const G = genDraft.gen, reg = genDraft.reg ? regionById(st, genDraft.reg) : null;
  const formas = Object.entries(FORMAS).filter(([k]) => reg ? true : k !== "calco" && k !== "tierra");
  const rng = (k, label, lo, hi, hint) => `<label class="field genrng">${label} <small>${hint || ""}</small><input type="range" min="${lo}" max="${hi}" value="${G[k] ?? 0}" data-gen="${k}"></label>`;
  side.innerHTML = `<div><h3>🧭 ${reg ? `Detalle de ${esc(reg.name)}` : "Mapa generado"}</h3><div class="kind">${reg ? "Calca la costa del mapa de debajo y la amplía con más detalle." : "Un mapa completo. Se usa si no habéis subido el vuestro."} No se guarda ninguna imagen: solo los ajustes.</div></div>
    ${G.items ? retouchHTML(G) : `<label class="field">Forma<select data-gens="forma">${formas.map(([k, n]) => `<option value="${k}" ${G.forma === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    ${reg && G.forma === "calco" && !genSample ? `<p class="note">No se pudo leer el mapa de debajo: usa otra forma.</p>` : ""}
    ${rng("sea", G.forma === "calco" ? "Agua ↔ tierra" : "Nivel del mar", -100, 100, G.forma === "calco" ? "si confunde mar y tierra, muévelo" : "")}
    ${rng("mont", "Montañas", 0, 100)}${rng("bosq", "Bosques", 0, 100)}${rng("rios", "Ríos", 0, 100)}
    <label class="field">Clima<select data-gens="clima">${Object.entries(CLIMAS).map(([k, c]) => `<option value="${k}" ${G.clima === k ? "selected" : ""}>${c.n}</option>`).join("")}</select></label>
    ${reg ? "" : `<label class="field">Título<input data-gent="title" value="${esc(G.title || "")}" placeholder="Nombre del mundo"></label>`}
    <label class="switch"><input type="checkbox" data-genc="autoRoads" ${G.autoRoads ? "checked" : ""}> Caminos entre los lugares</label>`}
    ${G.items ? "" : `<div class="row"><button class="btn small" id="genseed">🎲 Otra versión</button><button class="btn small" id="genroad">✏️ Trazar un camino</button>${(G.roads || []).length ? `<button class="btn small" id="genroadx">Borrar caminos (${G.roads.length})</button>` : ""}</div>
    <button class="btn gold small" id="genbake" title="Fija todo lo generado para moverlo, cambiarlo de tamaño o borrarlo uno a uno, y pintar tierra o mar">✋ Retocar a mano</button>`}
    <p class="note">Los castillos, posadas, ciudades… se ponen con «+ Añadir lugar» cuando guardes: van encima como siempre${reg ? " y los caminos automáticos los unen" : ""}.</p>
    <div class="row"><button class="btn gold" id="gensave">Guardar</button><button class="btn" id="genno">Cancelar</button>${(reg ? reg.gen : st.world.gen) ? `<button class="btn danger small" id="gendel">Quitar el mapa generado</button>` : ""}</div>`;
  $$("[data-gen]", side).forEach(i => i.oninput = () => { G[i.dataset.gen] = +i.value; genRefresh(); });
  $$("[data-gens]", side).forEach(i => i.onchange = () => { G[i.dataset.gens] = i.value; if (i.dataset.gens === "forma" && G.forma !== "calco") delete G.mask; genRefresh(); drawSide(); });
  $$("[data-gent]", side).forEach(i => i.oninput = () => { G[i.dataset.gent] = i.value; genRefresh(); });
  $$("[data-genc]", side).forEach(i => i.onchange = () => { G[i.dataset.genc] = i.checked; genRefresh(); });
  { const b = $("#genseed", side); if (b) b.onclick = () => { G.seed = Math.floor(Math.random() * 1e6); genRefresh(); }; }
  { const b = $("#genroad", side); if (b) b.onclick = () => { drawKind = "road"; drawing = []; redraw(); }; }
  { const b = $("#genbake", side); if (b) b.onclick = () => { genDraft.gen = bake(G, imgW, imgH, genPlaces()); gTool = "sel"; gSel = null; loadMap(); redraw(); }; }
  bindRetouch(G);
  const rx = $("#genroadx", side); if (rx) rx.onclick = () => { G.roads = []; genRefresh(); drawSide(); };
  $("#gensave", side).onclick = () => { const d = genDraft; genDraft = null; genSample = null; gSel = null; drawOv();
    if (d.reg) editRegion(d.reg, r => { r.gen = d.gen; }); else store.commit("map", s2 => { s2.world.gen = d.gen; });
    toast(d.reg ? "Detalle guardado. Coloca castillos, posadas y demás con «+ Añadir lugar»." : "Mapa guardado."); loadMap(); redraw(); };
  $("#genno", side).onclick = () => { genDraft = null; genSample = null; drawing = null; drawKind = "region"; gSel = null; drawOv(); fitted = false; loadMap(); redraw(); };
  const gd = $("#gendel", side); if (gd) gd.onclick = () => { const d = genDraft; genDraft = null; genSample = null;
    if (d.reg) editRegion(d.reg, r => { delete r.gen; }); else store.commit("map", s2 => { delete s2.world.gen; }); fitted = false; loadMap(); redraw(); };
}

/* ---------- Retoque a mano del mapa generado (Hito 73) ---------- */
const genEditing = () => !!(genDraft && genDraft.gen.items && isDM(store.get()));
function genPlaces() { const st = store.get(), r = ownMap(); return r ? placesIn(st, r).filter(p => can.seePlace(st, p)).map(p => toLocal(r, p.x, p.y)) : st.world.places.filter(p => !p.parent && can.seePlace(st, p)); }
const TOOLS = [["sel", "✋", "Mover y cambiar de tamaño (arrastra; luego ajusta abajo)"], ["m", "⛰", "Montaña"], ["h", "◠", "Colina"], ["f", "🌲", "Bosque"], ["r", "〰", "Río (traza puntos)"], ["c", "🛣", "Camino (traza puntos)"], ["t", "🔤", "Rótulo"], ["land", "🟫", "Pintar tierra"], ["sea", "🌊", "Pintar mar"], ["del", "🧽", "Borrar lo que toques"]];
function retouchHTML(G) {
  const it = G.items, S = gSel && selItem(G);
  return `<div class="gtools">${TOOLS.map(([k, i, n]) => `<button class="${gTool === k ? "on" : ""}" data-gtool="${k}" title="${n}">${i}</button>`).join("")}</div>
    <small class="tenue">${(TOOLS.find(t => t[0] === gTool) || [])[2] || ""}${["f", "land", "sea", "del"].includes(gTool) ? " · arrastra para pintar" : ""}</small>
    ${["f", "land", "sea", "del", "m", "h"].includes(gTool) ? `<label class="field genrng">Tamaño del pincel <input type="range" min="8" max="140" value="${gBrush}" data-gbrush></label>` : ""}
    ${S ? `<div class="gsel"><b>${{ m: "⛰ Montaña", h: "◠ Colina", f: "🌲 Bosque", r: "〰 Río", c: "🛣 Camino", t: "🔤 Rótulo" }[S.kind]}</b>
      ${S.kind === "t" ? `<input data-gtxt value="${esc(it.t[gSel.i][3])}" placeholder="Texto">` : ""}
      ${["m", "h", "f", "t"].includes(S.kind) ? `<label class="field genrng">Tamaño <input type="range" min="${S.kind === "f" ? 8 : S.kind === "t" ? 10 : 4}" max="${S.kind === "f" ? 160 : S.kind === "t" ? 90 : 70}" value="${Math.round(S.size)}" data-gsize></label>` : `<small class="tenue">Arrastra un punto para moverlo, o el trazo para moverlo entero.</small>`}
      <div class="row">${["m", "h"].includes(S.kind) ? `<button class="btn small" data-gflip>${S.kind === "m" ? "Hacer colina" : "Hacer montaña"}</button>` : ""}<button class="btn small danger" data-gdel>Borrar</button></div></div>` : ""}
    <p class="note">${it.m.length} montañas y colinas · ${it.f.length} manchas de bosque · ${it.r.length} ríos · ${it.c.length} caminos${(it.t || []).length ? ` · ${it.t.length} rótulos` : ""}. Los lugares (castillos, posadas…) se mueven como siempre, arrastrándolos.</p>
    <button class="btn small" id="genunbake" title="Descarta los retoques y vuelve a los deslizadores">↺ Volver a generar</button>`;
}
function selItem(G) {
  const it = G.items, s = gSel; if (!s) return null;
  if (s.k === "m") { const m = it.m[s.i]; if (!m) return null; return { kind: m[3] ? "m" : "h", size: UQ(m[2]) * imgW }; }
  if (s.k === "f") { const f = it.f[s.i]; return f ? { kind: "f", size: UQ(f[2]) * imgW } : null; }
  if (s.k === "t") { const t = it.t[s.i]; return t ? { kind: "t", size: UQ(t[2]) * imgW } : null; }
  return (it[s.k] || [])[s.i] ? { kind: s.k } : null;
}
function bindRetouch(G) {
  if (!G.items) return;
  $$("[data-gtool]", side).forEach(b => b.onclick = () => { gTool = b.dataset.gtool; gSel = null; if (gTool === "r" || gTool === "c") { drawKind = gTool === "r" ? "river" : "road"; drawing = []; } redraw(); drawOv(); });
  const br = $("[data-gbrush]", side); if (br) br.oninput = () => { gBrush = +br.value; };
  const sz = $("[data-gsize]", side); if (sz) sz.oninput = () => { const v = Q(+sz.value / imgW), s = gSel; if (s.k === "m") G.items.m[s.i][2] = v; else if (s.k === "f") G.items.f[s.i][2] = v; else if (s.k === "t") G.items.t[s.i][2] = v; drawOv(); genRefresh(); };
  const tx = $("[data-gtxt]", side); if (tx) tx.oninput = () => { G.items.t[gSel.i][3] = tx.value; genRefresh(); };
  const fl = $("[data-gflip]", side); if (fl) fl.onclick = () => { const m = G.items.m[gSel.i]; m[3] = m[3] ? 0 : 1; genRefresh(); drawSide(); };
  const dl = $("[data-gdel]", side); if (dl) dl.onclick = () => { G.items[gSel.k].splice(gSel.i, 1); gSel = null; genRefresh(); drawSide(); drawOv(); };
  const ub = $("#genunbake", side); if (ub) ub.onclick = () => { if (!ub.dataset.sure) { ub.dataset.sure = 1; ub.textContent = "Pulsa otra vez: se pierden los retoques"; return; } delete G.items; if (G.forma !== "calco") delete G.mask; gSel = null; genRefresh(); drawSide(); drawOv(); };
}
/** Qué hay bajo el puntero (en píxeles del mapa). */
function hitItem(G, px, py) {
  const it = G.items, tol = 10 / view.k; let best = null;
  const take = (k, i, d, v) => { if (!best || d < best.d) best = { k, i, d, v }; };
  (it.t || []).forEach((t, i) => { const d = Math.hypot(UQ(t[0]) * imgW - px, UQ(t[1]) * imgH - py); if (d < UQ(t[2]) * imgW * 1.5 + tol) take("t", i, d * 0.5); });
  it.m.forEach((m, i) => { const x = UQ(m[0]) * imgW, y = UQ(m[1]) * imgH, s = UQ(m[2]) * imgW, d = Math.hypot(x - px, (y - s * 0.5) - py); if (d < s + tol) take("m", i, d); });
  ["r", "c"].forEach(k => (it[k] || []).forEach((a, i) => { const P = pairs(a).map(([x, y]) => [UQ(x) * imgW, UQ(y) * imgH]);
    P.forEach(([x, y], v) => { const d = Math.hypot(x - px, y - py); if (d < tol * 1.2) take(k, i, d * 0.3, v); });
    for (let j = 1; j < P.length; j++) { const d = segDist(px, py, P[j - 1], P[j]); if (d < tol) take(k, i, d + 2); } }));
  if (!best) it.f.forEach((f, i) => { const d = Math.hypot(UQ(f[0]) * imgW - px, UQ(f[1]) * imgH - py); if (d < UQ(f[2]) * imgW) take("f", i, d + 20); });
  return best;
}
const segDist = (px, py, [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
let gAct = null; // gesto en curso
function genDown(e) {
  const G = genDraft.gen, [px, py] = evPoint(e), nx = px / imgW, ny = py / imgH;
  if (px < 0 || py < 0 || px > imgW || py > imgH) return false;
  if (gTool === "sel") {
    const h = hitItem(G, px, py); if (!h) { gSel = null; drawOv(); drawSide(); return false; } // sin nada debajo: se arrastra el mapa
    gSel = { k: h.k, i: h.i }; gAct = { k: "move", h, x0: px, y0: py, orig: JSON.parse(JSON.stringify(G.items[h.k][h.i])) }; drawOv(); drawSide(); return true;
  }
  if (gTool === "t") { G.items.t = G.items.t || []; G.items.t.push([Q(nx), Q(ny), Q(22 / imgW), "Rótulo"]); gSel = { k: "t", i: G.items.t.length - 1 }; gTool = "sel"; genRefresh(); redraw(); drawOv(); setTimeout(() => { const t = $("[data-gtxt]", side); if (t) { t.focus(); t.select(); } }, 50); return true; }
  gAct = { k: "paint", last: null }; paintAt(px, py); return true;
}
function paintAt(px, py) {
  const G = genDraft.gen, it = G.items, nx = px / imgW, ny = py / imgH, R = gBrush;
  if (gAct.last && Math.hypot(px - gAct.last[0], py - gAct.last[1]) < (["m", "h"].includes(gTool) ? R * 0.45 : R * 0.35)) return;
  gAct.last = [px, py];
  if (gTool === "m" || gTool === "h") { const sz = gTool === "m" ? Math.max(8, R * 0.4) : Math.max(5, R * 0.22); it.m.push([Q(nx), Q(ny), Q(sz / imgW), gTool === "m" ? 1 : 0]); it.m.sort((a, b) => a[1] - b[1]); }
  else if (gTool === "f") it.f.push([Q(nx), Q(ny), Q(R * 0.6 / imgW)]);
  else if (gTool === "land" || gTool === "sea") paintMask(G, nx, ny, R / 2 / imgW, gTool === "land");
  else if (gTool === "del") { const near = (x, y) => Math.hypot(UQ(x) * imgW - px, UQ(y) * imgH - py) < R / 2;
    it.m = it.m.filter(m => !near(m[0], m[1])); it.f = it.f.filter(f => !near(f[0], f[1])); it.t = (it.t || []).filter(t => !near(t[0], t[1]));
    ["r", "c"].forEach(k => { it[k] = it[k].filter(a => !pairs(a).some(([x, y]) => near(x, y))); }); }
  genPaintRefresh();
}
const genPaintRefresh = debounce(() => loadMap(), 260);
function genMove(e) {
  const [px, py] = evPoint(e);
  const cur = $("#genov", el); if (cur && ["m", "h", "f", "land", "sea", "del"].includes(gTool)) { const c = cur.querySelector(".gbrush"); if (c) { c.setAttribute("cx", px); c.setAttribute("cy", py); c.setAttribute("r", gBrush / 2); } }
  if (!gAct) return;
  if (gAct.k === "paint") return paintAt(px, py);
  const G = genDraft.gen, h = gAct.h, dx = Q((px - gAct.x0) / imgW), dy = Q((py - gAct.y0) / imgH), o = gAct.orig;
  if (h.k === "r" || h.k === "c") { const a = o.slice(); if (h.v != null) { a[h.v * 2] += dx; a[h.v * 2 + 1] += dy; } else for (let j = 0; j < a.length; j += 2) { a[j] += dx; a[j + 1] += dy; } G.items[h.k][h.i] = a; }
  else { const a = o.slice(); a[0] += dx; a[1] += dy; G.items[h.k][h.i] = a; }
  gAct.moved = true; drawOv();
}
function genUp() { const a = gAct; gAct = null; if (a.k === "move" && a.moved && a.h.k === "m") genDraft.gen.items.m.sort((p, q) => p[1] - q[1]), gSel = null; loadMap(); drawSide(); drawOv(); }
/** Capa de ayuda: el pincel y el elemento seleccionado. */
function drawOv() {
  const svg = $("#genov", el); if (!svg) return;
  if (!genEditing()) { svg.innerHTML = ""; return; }
  svg.setAttribute("viewBox", `0 0 ${imgW} ${imgH}`); svg.style.width = imgW + "px"; svg.style.height = imgH + "px";
  const G = genDraft.gen, it = G.items, s = gSel; let mark = "";
  if (s && it[s.k] && it[s.k][s.i]) {
    const a = it[s.k][s.i];
    if (s.k === "r" || s.k === "c") { const P = pairs(a).map(([x, y]) => [UQ(x) * imgW, UQ(y) * imgH]); mark = `<polyline points="${P.map(p => p.join(",")).join(" ")}" class="gsl"/>${P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${6 / view.k}" class="gpt"/>`).join("")}`; }
    else { const x = UQ(a[0]) * imgW, y = UQ(a[1]) * imgH, r = s.k === "f" ? UQ(a[2]) * imgW : UQ(a[2]) * imgW * (s.k === "t" ? 2 : 1.1); mark = `<circle cx="${x}" cy="${s.k === "m" ? y - r * 0.45 : y}" r="${r}" class="gsl"/>`; }
  }
  svg.innerHTML = `${mark}${["m", "h", "f", "land", "sea", "del"].includes(gTool) ? `<circle class="gbrush ${gTool}" cx="-99" cy="-99" r="${gBrush / 2}"/>` : ""}`;
}

/* ---------- Pestañas: Global · Regiones · (dentro de una región) ---------- */
function drawTabs() {
  const s = store.get(), dm = isDM(s), list = regionsOf(s).filter(r => seeRegion(s, r, dm)), reg = curRegion();
  const t = $("#maptabs", el);
  const R = routesOf(s);
  t.innerHTML = `<select id="routesel" title="Ruta del grupo en el mapa"><option value="live" ${routeView === "live" ? "selected" : ""}>🧭 Ruta de esta sesión</option><option value="all" ${routeView === "all" ? "selected" : ""}>🧭 Todas las rutas</option>${R.filter(r => !r.live).map(r => `<option value="${r.id}" ${routeView === r.id ? "selected" : ""}>🧭 ${esc(r.name)}</option>`).join("")}<option value="none" ${routeView === "none" ? "selected" : ""}>Sin rutas</option></select>
    <button data-mode="global" aria-pressed="${mode === "global"}">🌍 Mapa global</button><button data-mode="regions" aria-pressed="${mode !== "global"}">🗺 Regiones${list.length ? ` <small>${list.length}</small>` : ""}</button>
    ${reg ? `<span class="tabreg" style="--rc:${esc(reg.color)}">▸ <b>${esc(reg.name)}</b></span>${list.length > 1 ? `<select id="regjump" aria-label="Ir a otra región">${list.map(r => `<option value="${r.id}" ${r.id === reg.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>` : ""}` : ""}`;
  $$("[data-mode]", t).forEach(b => b.onclick = () => { if (drawing) return; genDraft = null; mode = b.dataset.mode; regId = null; sel = null; setAdding(false); loadMap(); redraw(); });
  const j = $("#regjump", t); if (j) j.onchange = () => { genDraft = null; enterRegion(j.value); };
  const rs = $("#routesel", t); if (rs) rs.onchange = () => { routeView = rs.value; try { sessionStorage.setItem("lamesa:route", routeView); } catch (e) { /* nada */ } drawRoutes(store.get()); };
}
function enterRegion(id) { mode = "region"; regId = id; sel = null; setAdding(false); loadMap(); redraw(); }
function redraw() { drawTabs(); drawTools(); drawPins(); drawRegions(); drawSide(); drawOv(); vp.classList.toggle("drawing", !!drawing); vp.classList.toggle("modereg", mode === "regions"); }
function finishDrawing() {
  if (drawKind === "road" || drawKind === "river") { // camino o río a mano en el mapa generado
    if (!drawing || drawing.length < 2) return toast("Hacen falta al menos 2 puntos.");
    const r = ownMap(), pts = drawing.map(p => r ? toLocal(r, p.x, p.y) : p).map(p => ({ x: +p.x.toFixed(4), y: +p.y.toFixed(4) })), kind = drawKind;
    drawing = null; drawKind = "region";
    if (genDraft) { const G = genDraft.gen;
      if (G.items) { const k = kind === "river" ? "r" : "c"; G.items[k] = [...(G.items[k] || []), pts.flatMap(p => [Q(p.x), Q(p.y)])]; gSel = { k, i: G.items[k].length - 1 }; gTool = "sel"; }
      else G.roads = [...(G.roads || []), pts];
      loadMap(); redraw(); }
    return;
  }
  if (!drawing || drawing.length < 3) return toast("Una región necesita al menos 3 puntos.");
  const pts = drawing; drawing = null;
  if (redrawId) { const id = redrawId; redrawId = null; editRegion(id, r => { r.pts = pts; }); enterRegion(id); }
  else { const id = addRegion(pts); toast("Región creada: ponle nombre y color"); enterRegion(id); }
}

/* ---------- Contornos de las regiones (SVG sobre el mapa) ---------- */
function drawRegions() {
  const svg = $("#regsvg", el); if (!svg) return;
  const s = store.get(), dm = isDM(s), own = ownMap(), reg = curRegion();
  svg.setAttribute("viewBox", `0 0 ${imgW} ${imgH}`); svg.setAttribute("width", imgW); svg.setAttribute("height", imgH);
  const pts = r => r.pts.map(p => g2i(p.x, p.y).map(v => v.toFixed(1)).join(",")).join(" ");
  const fs = Math.max(14, imgW * 0.016);
  let out = "";
  if (mode === "region" && reg && !own) {
    // Fuera de la región, el mapa se oscurece
    out += `<path d="M0 0H${imgW}V${imgH}H0Z M${reg.pts.map(p => g2i(p.x, p.y).join(" ")).join(" L")}Z" fill="rgba(8,6,4,.62)" fill-rule="evenodd"/>
      <polygon points="${pts(reg)}" fill="none" stroke="${esc(reg.color)}" stroke-width="3" vector-effect="non-scaling-stroke"/>`;
  } else if (mode !== "region") {
    out += regionsOf(s).filter(r => seeRegion(s, r, dm) && r.pts && r.pts.length > 2).map(r => {
      const c = centroid(r), [cx, cy] = g2i(c.x, c.y), full = mode === "regions";
      return `<g class="reg ${r.visible ? "" : "hid"}" data-reg="${r.id}"><polygon points="${pts(r)}" fill="${esc(r.color)}" fill-opacity="${full ? 0.26 : 0}" stroke="${esc(r.color)}" stroke-width="${full ? 3 : 2}" stroke-dasharray="${full && r.visible ? "" : "8 6"}" vector-effect="non-scaling-stroke"/>
        ${full ? `<text x="${cx}" y="${cy}" font-size="${fs * 1.6}" text-anchor="middle" class="reglabel">${esc(r.name)}${r.visible ? "" : " (oculta)"}</text>` : `<text x="${cx}" y="${cy}" font-size="${fs}" text-anchor="middle" class="reglabel faint">${esc(r.name)}</text>`}</g>`; }).join("");
  }
  if (drawing) {
    const P = drawing.map(p => g2i(p.x, p.y));
    out += `<polyline points="${P.map(p => p.join(",")).join(" ")}" fill="rgba(214,170,78,.15)" stroke="#ffd86a" stroke-width="3" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>
      ${P.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${(i === 0 ? 9 : 5) / view.k}" fill="${i === 0 ? "#ffd86a" : "#fff"}" stroke="#2b1d10" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join("")}`;
  }
  svg.innerHTML = out;
}

/* ---------- Marcadores ---------- */
function drawPins() {
  const state = store.get();
  const live = state.presentation && (state.presentation.place);
  // En el mapa del mundo solo van los lugares de primer nivel; los de dentro (distritos, posadas…) viven en el Lore
  const reg = curRegion();
  const shown = reg ? placesIn(state, reg) : state.world.places.filter(p => !p.parent && !p.detail);
  pinsEl.innerHTML = shown.filter(p => can.seePlace(state, p)).map(p =>
    { const d = pinDefaults(p), z = PIN_SIZES[d.size] || PIN_SIZES.normal, t = PIN_TINTS[d.tint] || PIN_TINTS.neutro;
      return `<button class="pin sz-${d.size} ${p.visible ? "" : "hidden"} ${p.id === sel ? "sel" : ""} ${p.id === live ? "live" : ""} ${(partyPos(state) || {}).p === p.id ? "here" : ""} ${placesLocked || !isDM(state) ? "" : "unlocked"}" data-id="${p.id}" style="left:${g2i(p.x, p.y)[0]}px;top:${g2i(p.x, p.y)[1]}px;--d:${z.d}px;--f:${z.f}px;--ring:${t.ring};--bg:${t.bg};--ink:${t.ink}" aria-label="${esc(p.name)}">
      <i class="medal"><b style="-webkit-mask-image:url(${iconURL(d.icon)});mask-image:url(${iconURL(d.icon)})"></b></i><span>${esc(p.name)}</span></button>`; }).join("");
  $$(".pin", pinsEl).forEach(b => {
    b.onclick = e => { e.stopPropagation(); if (adding || drawing) return; sel = b.dataset.id; drawPins(); drawSide(); };
    // El máster puede arrastrar los marcadores para recolocarlos, con el candado abierto
    if (isDM(state) && !placesLocked) {
      let d = null;
      b.onpointerdown = e => { e.stopPropagation(); d = { x: e.clientX, y: e.clientY, moved: false }; b.setPointerCapture(e.pointerId); };
      b.onpointermove = e => {
        if (!d) return;
        if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
        if (d.moved) { const r = vp.getBoundingClientRect(); b.style.left = (e.clientX - r.left - view.x) / view.k + "px"; b.style.top = (e.clientY - r.top - view.y) / view.k + "px"; }
      };
      b.onpointerup = e => {
        if (d && d.moved) {
          const [px, py] = evPoint(e), g = i2g(Math.max(0, Math.min(imgW, px)), Math.max(0, Math.min(imgH, py)));
          const x = Math.max(0, Math.min(1, g.x)), y = Math.max(0, Math.min(1, g.y));
          const id = b.dataset.id; sel = id;
          store.commit("place", s => { const p = s.world.places.find(q => q.id === id); p.x = x; p.y = y; });
        }
        d = null;
      };
    }
  });
  drawParty(state);
  apply();
}
/* ---------- El grupo y su ruta (Hito 74) ---------- */
const ROUTE_COLORS = ["#c0392b", "#8e5a2b", "#5a6a8e", "#6a8e5a", "#8e5a8e", "#5a8e8a"];
function drawParty(state) {
  const P = partyPos(state), dm = isDM(state);
  if (P) {
    const names = state.characters.filter(c => c.owner).map(c => c.name.split(" ")[0]).join(", "), at = P.p && $(`.pin[data-id="${P.p}"]`, pinsEl);
    const tip = `El grupo${names ? ": " + names : ""}${at ? " · está en " + ((state.world.places.find(x => x.id === P.p) || {}).name || "") : ""}${dm ? " · arrástralo para moverlo" : ""}`;
    let b;
    if (at) { // dentro de un lugar: una bandera prendida en su medallón (y el lugar, con un anillo)
      at.querySelector(".medal").insertAdjacentHTML("beforeend", `<i class="herebadge" data-party title="${esc(tip)}">⚑</i>`);
      b = $("[data-party]", at);
    } else {
      const [x, y] = g2i(P.x, P.y);
      pinsEl.insertAdjacentHTML("beforeend", `<button class="pin party" data-party style="left:${x}px;top:${y}px" title="${esc(tip)}"><i class="medal"><b>⚑</b></i><span>El grupo</span></button>`);
      b = $(".pin.party", pinsEl);
    }
    if (dm) { let d = null;
      b.onpointerdown = e => { e.stopPropagation(); e.preventDefault(); d = { x: e.clientX, y: e.clientY, moved: false, ghost: null }; b.setPointerCapture(e.pointerId); };
      b.onpointermove = e => { if (!d) return; if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) { d.moved = true; vp.classList.add("dragparty"); }
        if (d.moved) { const [px, py] = evPoint(e); if (!d.ghost) { d.ghost = document.createElement("div"); d.ghost.className = "partyghost"; d.ghost.textContent = "⚑"; pinsEl.appendChild(d.ghost); }
          d.ghost.style.left = px + "px"; d.ghost.style.top = py + "px"; d.ghost.style.transform = `translate(-50%,-50%) scale(${1 / view.k})`;
          const near = nearPlace(px, py); $$(".pin.droptarget", pinsEl).forEach(x => x.classList.remove("droptarget")); if (near) { const pn = $(`.pin[data-id="${near.id}"]`, pinsEl); if (pn) pn.classList.add("droptarget"); } } };
      b.onpointerup = e => { vp.classList.remove("dragparty"); if (d && d.ghost) d.ghost.remove();
        if (d && d.moved) { const [px, py] = evPoint(e), g = i2g(px, py), st = store.get(), near = nearPlace(px, py);
          if (near) { partyToPlace(st, near.id); toast(`El grupo entra en ${near.name}.`); } else moveParty(Math.max(0, Math.min(1, g.x)), Math.max(0, Math.min(1, g.y))); }
        d = null; };
    }
    b.onclick = e => { e.stopPropagation(); e.preventDefault(); };
  }
  drawRoutes(state);
  drawPartyBar(state);
}
/** Lugar visible cuyo círculo está bajo el puntero (para entrar en él al soltar al grupo). */
function nearPlace(px, py) {
  const st = store.get(), reg = curRegion(), shown = reg ? placesIn(st, reg) : st.world.places.filter(p => !p.parent && !p.detail);
  const hit = shown.filter(p => can.seePlace(st, p)).map(p => ({ p, d: Math.hypot(g2i(p.x, p.y)[0] - px, g2i(p.x, p.y)[1] - py) * view.k })).sort((a, b) => a.d - b.d)[0];
  return hit && hit.d < 26 ? hit.p : null;
}
/** Barra del grupo (máster): dónde está, deshacer el último movimiento y el candado de los lugares. */
function drawPartyBar(state) {
  let bar = $("#partybar", el); if (!isDM(state) || genDraft) { if (bar) bar.remove(); return; }
  if (!bar) { bar = document.createElement("div"); bar.id = "partybar"; bar.className = "partybar"; vp.appendChild(bar); }
  const P = partyPos(state), pl = P && P.p && state.world.places.find(x => x.id === P.p);
  bar.innerHTML = `<span>⚑ ${P ? (pl ? `El grupo está <b>en ${esc(pl.name)}</b>` : "El grupo está <b>de camino</b>") : "El grupo no está en el mapa"}</span>
    ${P && canUndoParty() ? `<button class="btn small" data-pundo title="Vuelve adonde estaba y quita el paso de la ruta">↶ Deshacer movimiento</button>` : ""}
    ${P && pl ? `<button class="btn small" data-pout title="Sale del lugar y se queda a sus puertas">🚪 Salir de ${esc(pl.name)}</button>` : ""}
    ${(() => { const R = routesOf(state), live = R.find(r => r.live), tot = R.reduce((a, r) => a + kmOf(state, r.pts), 0); const t = live && tripText(state, live.pts);
      return `<span class="ptrip" title="Distancia en línea recta entre paradas y días de viaje a ritmo ${PACES[paceOf(state)][0].toLowerCase()} (SRD). Escala: el mapa mide ${scaleKm(state)} km de ancho.">🧭 ${t ? `Hoy: <b>${t}</b>` : "Hoy: sin viaje"}${tot >= 1 ? ` · Total: ${Math.round(tot).toLocaleString("es-ES")} km` : ""}</span>
        <label class="pscale" title="Cuántos kilómetros mide de ancho el mapa del mundo">📏<input type="number" min="1" step="10" data-pscale value="${scaleKm(state)}"> km</label>
        <select data-ppace title="Ritmo de viaje (SRD): lento 27 km/día, normal 36, rápido 45">${Object.entries(PACES).map(([k, [n, v]]) => `<option value="${k}" ${paceOf(state) === k ? "selected" : ""}>${n} · ${v} km/día</option>`).join("")}</select>`; })()}
    <button class="btn small ${placesLocked ? "" : "gold"}" data-plock title="${placesLocked ? "Los lugares están fijos: no se mueven sin querer. Pulsa para poder moverlos." : "Ahora puedes arrastrar los lugares. Pulsa para fijarlos."}">${placesLocked ? "🔒 Lugares fijos" : "🔓 Moviendo lugares"}</button>`;
  const u = $("[data-pundo]", bar); if (u) u.onclick = () => { undoStep(); toast("Movimiento deshecho."); };
  const o = $("[data-pout]", bar); if (o) o.onclick = () => { const [x, y] = g2i(P.x, P.y), g = i2g(x + 34 / view.k, y + 20 / view.k); moveParty(g.x, g.y); };
  $("[data-plock]", bar).onclick = () => { placesLocked = !placesLocked; drawPins(); };
  const sc = $("[data-pscale]", bar); sc.onchange = () => setScale(+sc.value, null);
  const pc = $("[data-ppace]", bar); pc.onchange = () => setScale(null, pc.value);
}
function drawRoutes(state) {
  const svg = $("#routesvg", el); if (!svg) return;
  svg.setAttribute("viewBox", `0 0 ${imgW} ${imgH}`); svg.style.width = imgW + "px"; svg.style.height = imgH + "px";
  const all = routesOf(state), L = routeView === "none" ? [] : routeView === "all" ? all : routeView === "live" ? all.filter(r => r.live) : all.filter(r => r.id === routeView);
  svg.innerHTML = L.slice().reverse().map((r, k) => { const col = "#c0392b", pts = r.pts.map(p => g2i(p.x, p.y)), trip = tripText(state, r.pts); // todas en rojo: la de hoy, más marcada
    if (pts.length < 2) return "";
    return `<g class="route ${r.live ? "live" : ""}" style="--rc:${col}"><title>${esc(r.name)}${tripText(state, r.pts) ? " · " + tripText(state, r.pts) : ""}</title><polyline points="${pts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ")}" class="rline"/>
      ${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === pts.length - 1 && r.live ? 5 : 3.2}" class="rdot"/>`).join("")}
      <text x="${pts[Math.floor(pts.length / 2)][0]}" y="${pts[Math.floor(pts.length / 2)][1] - 9}" class="rlab">${esc(r.name)}${trip ? " · " + trip : ""}</text></g>`; }).join("");
}

/* ---------- Panel lateral ---------- */
function drawSide() {
  const state = store.get();
  if (genDraft && isDM(state)) return drawGenPanel(state);
  const place = state.world.places.find(p => p.id === sel);
  if (!place || !can.seePlace(state, place)) return mode === "regions" ? drawRegionList(state) : mode === "region" && curRegion() ? drawRegionPanel(state, curRegion()) : drawList(state);
  return isDM(state) ? drawEditor(state, place) : drawReader(state, place);
}

/* ---------- Panel de regiones ---------- */
function drawRegionList(state) {
  const dm = isDM(state), list = regionsOf(state).filter(r => seeRegion(state, r, dm));
  side.innerHTML = `<div><h3>Regiones</h3><div class="kind">${dm ? "Trocea el mapa en regiones con «✏️ Dibujar región». Juntas forman el mapa completo." : "Las tierras que conocéis. Toca una para verla más de cerca."}</div></div>
    <div class="places">${list.map(r => `<button class="place regitem" data-reg="${r.id}"><i class="regdot" style="background:${esc(r.color)}"></i><span>${esc(r.name)}</span><small>${placesIn(state, r).filter(p => can.seePlace(state, p)).length} lugares${dm && !r.visible ? " · oculta" : ""}</small></button>`).join("") || `<p class="empty">Todavía no hay regiones.</p>`}</div>`;
  $$("[data-reg]", side).forEach(b => b.onclick = () => enterRegion(b.dataset.reg));
}
function drawRegionPanel(state, r) {
  const dm = isDM(state), places = placesIn(state, r).filter(p => can.seePlace(state, p));
  const list = `<h2 class="sec" style="margin:4px 0 0">Lugares de la región</h2><div class="places">${places.map(p => `<button class="place" data-id="${p.id}">${PIN(p.visible ? "#d6aa4e" : "#9aa0c8").replace("<svg", '<svg width="16" height="20"')}<span>${esc(p.name)}</span><small>${esc(p.kind)}${p.detail ? " · detalle" : ""}${dm && !p.visible ? " · oculto" : ""}</small></button>`).join("") || `<p class="empty">Sin lugares todavía.</p>`}</div>`;
  if (!dm) {
    side.innerHTML = `<button class="btn small" id="rback">← Regiones</button><div><h3 style="color:${esc(r.color)}">${esc(r.name)}</h3><div class="kind">Región</div></div>${r.summary ? `<p style="margin:0">${esc(r.summary)}</p>` : ""}${list}`;
  } else {
    side.innerHTML = `<div class="row"><button class="btn small" id="rback">← Regiones</button></div>
      <label class="field">Nombre de la región<input id="r-name" value="${esc(r.name)}"></label>
      <div class="regcolors">${REG_COLORS.map(c => `<button data-rcol="${c}" style="background:${c}" aria-pressed="${r.color === c}" title="Color"></button>`).join("")}</div>
      <label class="switch"><input type="checkbox" id="r-vis" ${r.visible ? "checked" : ""}> Visible para los jugadores</label>
      <div class="row"><button class="btn gold" id="r-show">Mostrar esta región a todos</button></div>
      <label class="field">Paquete de mapas<select id="r-pack"><option value="">Ninguno</option>${Object.entries(REGIONS).map(([k, v]) => `<option value="${k}" ${r.pack === k ? "selected" : ""}>${v.i} ${v.n}</option>`).join("")}</select></label>
      <p class="note" style="margin:-6px 0 0">Las escenas de lugares de esta región usan estas piezas en el editor de mapas.</p>
      <label class="field">Descripción para los jugadores<textarea id="r-sum" rows="3">${esc(r.summary || "")}</textarea></label>
      <div class="secretbox"><label class="field"><span><span class="tag secret">SOLO MÁSTER</span> Notas secretas</span><textarea id="r-sec" rows="3">${esc(r.secret || "")}</textarea></label></div>
      <p class="note" style="margin:0">${r.map ? "Esta región tiene su propio mapa detallado." : "Sin mapa propio: se ve el mapa global acercado. Puedes subir un mapa más detallado con el botón de arriba."} Los lugares que añadas aquí dentro solo aparecen en la región.</p>
      ${list}
      <div class="row" style="margin-top:8px"><button class="btn small" id="r-redraw">✏️ Redibujar contorno</button><button class="btn small danger" id="r-del">Eliminar región</button></div>`;
    const save = debounce((k, v) => editRegion(r.id, x => { x[k] = v; }, "field"), 300);
    $("#r-name", side).oninput = e => save("name", e.target.value);
    $("#r-sum", side).oninput = e => save("summary", e.target.value);
    $("#r-sec", side).oninput = e => save("secret", e.target.value);
    $("#r-pack", side).onchange = e => editRegion(r.id, x => { x.pack = e.target.value; });
    $("#r-vis", side).onchange = e => editRegion(r.id, x => { x.visible = e.target.checked; });
    $$("[data-rcol]", side).forEach(b => b.onclick = () => editRegion(r.id, x => { x.color = b.dataset.rcol; }));
    $("#r-show", side).onclick = () => editRegion(r.id, (x, st) => { x.visible = true; st.presentation = { type: "region", region: r.id }; }, "present");
    $("#r-redraw", side).onclick = () => { redrawId = r.id; drawing = []; mode = "regions"; regId = null; loadMap(); redraw(); };
    const del = $("#r-del", side); del.onclick = () => { if (!del.dataset.sure) { del.dataset.sure = 1; del.textContent = "Pulsa otra vez para eliminar"; return; } mode = "regions"; regId = null; deleteRegion(r.id); loadMap(); redraw(); };
  }
  $("#rback", side).onclick = () => { mode = "regions"; regId = null; sel = null; loadMap(); redraw(); };
  $$("[data-id]", side).forEach(b => b.onclick = () => { sel = b.dataset.id; drawPins(); drawSide(); });
}

function drawList(state) {
  const dm = isDM(state);
  const list = state.world.places.filter(p => !p.parent && !p.detail && can.seePlace(state, p));
  side.innerHTML = `<div><h3>${esc(state.campaign.name)}</h3><div class="kind">${dm ? "Elige un lugar para editarlo o mostrarlo al grupo." : "Lugares que conocéis. El máster os irá revelando más."}</div></div>
    <div class="places">${list.map(p => `<button class="place" data-id="${p.id}">${PIN(p.visible ? "#d6aa4e" : "#9aa0c8").replace("<svg", '<svg width="16" height="20"')}<span>${esc(p.name)}</span><small>${esc(p.kind)}${dm && !p.visible ? " · oculto" : ""}</small></button>`).join("") || `<p class="empty">Todavía no hay lugares.</p>`}</div>
    ${dm ? `<p class="note" style="margin:0">Los lugares ocultos (en azul) solo los ves tú. Arrastra un marcador para moverlo.</p>` : ""}`;
  $$(".place", side).forEach(b => b.onclick = () => { sel = b.dataset.id; drawPins(); drawSide(); });
}

async function fillImages(state, place) {
  for (const it of place.items) if (it.type === "image") {
    const url = await getImage(it.img);
    const box = side.querySelector(`[data-imgfor="${it.id}"]`);
    if (box && url) box.innerHTML = `<img src="${url}" alt="${esc(it.title)}">`;
  }
}

function drawReader(state, place) {
  const items = place.items.filter(i => can.seeItem(state, i));
  side.innerHTML = `<button class="btn small" id="back">← ${mode === "region" && curRegion() ? esc(curRegion().name) : "Todos los lugares"}</button>
    <div><h3>${esc(place.name)}</h3><div class="kind">${esc(place.kind)}</div></div>
    ${place.summary ? `<p style="margin:0">${esc(place.summary)}</p>` : ""}
    <a class="btn small" href="#lore/${place.id}">📖 Ver en el Lore</a>
    <h2 class="sec" style="margin:4px 0 0">Lo que sabéis</h2>
    <div class="items">${items.map(it => `<div class="item"><div class="head"><b>${esc(it.title)}</b></div>${it.type === "image" ? `<div data-imgfor="${it.id}"><p class="empty">Cargando imagen…</p></div>${it.text ? `<p>${esc(it.text)}</p>` : ""}` : `<p>${esc(it.text)}</p>`}</div>`).join("") || `<p class="empty">El máster aún no os ha revelado nada de este lugar.</p>`}</div>`;
  $("#back", side).onclick = () => { sel = null; drawPins(); drawSide(); };
  fillImages(state, place);
}

/** Símbolo, tamaño y color del marcador en el mapa del mundo. */
let symCat = null;
function symbolPicker(place) {
  const d = pinDefaults(place), cat = symCat || MAP_ICONS[d.icon].cat;
  return `<details class="sympick" open><summary><i class="medal mini" style="--ring:${PIN_TINTS[d.tint].ring};--bg:${PIN_TINTS[d.tint].bg};--ink:${PIN_TINTS[d.tint].ink}"><b style="-webkit-mask-image:url(${iconURL(d.icon)});mask-image:url(${iconURL(d.icon)})"></b></i> Símbolo en el mapa · ${esc(MAP_ICONS[d.icon].n)}</summary>
    <div class="symcats">${Object.entries(ICON_CATS).map(([k, n]) => `<button data-symcat="${k}" aria-pressed="${cat === k}">${n}</button>`).join("")}</div>
    <div class="symgrid">${Object.entries(MAP_ICONS).filter(([, v]) => v.cat === cat).map(([k, v]) => `<button data-sym="${k}" aria-pressed="${d.icon === k}" title="${esc(v.n)}"><b style="-webkit-mask-image:url(${iconURL(k)});mask-image:url(${iconURL(k)})"></b><span>${esc(v.n)}</span></button>`).join("")}</div>
    <div class="symrow"><small>Tamaño</small>${Object.entries(PIN_SIZES).map(([k, v]) => `<button data-psize="${k}" aria-pressed="${d.size === k}" title="${v.n}"><i style="width:${v.d / 2.2}px;height:${v.d / 2.2}px"></i></button>`).join("")}<em>${PIN_SIZES[d.size].n}</em></div>
    <div class="symrow"><small>Pueblo / bando</small>${Object.entries(PIN_TINTS).map(([k, v]) => `<button data-ptint="${k}" aria-pressed="${d.tint === k}" title="${v.n}" style="--ring:${v.ring};--bg:${v.bg}"></button>`).join("")}<em>${PIN_TINTS[d.tint].n}</em></div></details>`;
}

function drawEditor(state, place) {
  side.innerHTML = `<div class="row"><button class="btn small" id="back">← ${mode === "region" && curRegion() ? esc(curRegion().name) : "Todos los lugares"}</button><a class="btn small gold" href="#lore/${place.id}">📖 Abrir en el Lore</a></div>
    <label class="field">Nombre<input id="f-name" data-f="name" value="${esc(place.name)}"></label>
    <label class="field">Tipo<select data-f="kind">${KINDS.map(k => `<option ${k === place.kind ? "selected" : ""}>${k}</option>`).join("")}</select></label>
    ${symbolPicker(place)}
    <label class="switch"><input type="checkbox" id="f-vis" ${place.visible ? "checked" : ""}> Visible para los jugadores</label>
    <div class="row"><button class="btn gold" id="present">Mostrar este lugar a todos</button><button class="btn" id="partyhere" title="Mueve la ficha del grupo aquí y lo apunta en la ruta de la sesión">⚑ El grupo está aquí</button></div>
    <div class="row"><button class="btn small" id="placemap">${place.map ? "Cambiar el mapa del lugar" : "+ Mapa del lugar (ciudad, mazmorra…)"}</button>${place.map ? `<button class="btn small danger" id="noplacemap">Quitar mapa</button>` : ""}</div>
    <label class="field">Descripción para los jugadores<textarea data-f="summary" rows="3">${esc(place.summary)}</textarea></label>
    <div class="secretbox"><label class="field"><span><span class="tag secret">SOLO MÁSTER</span> Notas secretas</span><textarea data-f="secret" rows="3">${esc(place.secret)}</textarea></label></div>
    <h2 class="sec" style="margin:4px 0 0">Contenido</h2>
    <p class="empty" style="margin-top:-8px">Los jugadores solo ven lo que marques como revelado.</p>
    <div class="items">${place.items.map(it => `<div class="item ${it.revealed ? "" : "locked"}" data-item="${it.id}">
        <div class="head"><input class="itemtitle" data-k="title" value="${esc(it.title)}" aria-label="Título" style="flex:1;min-width:0;background:transparent;border:0;border-bottom:1px solid var(--linea);font-weight:700;padding:2px 0">
          <label class="switch" title="Revelado a los jugadores"><input type="checkbox" data-k="revealed" ${it.revealed ? "checked" : ""}> ${it.revealed ? "Revelado" : "Oculto"}</label></div>
        ${it.type === "image" ? `<div data-imgfor="${it.id}"><p class="empty">Cargando imagen…</p></div>` : ""}
        <label class="field"><span class="sr">Texto</span><textarea data-k="text" rows="${it.type === "image" ? 2 : 3}" placeholder="${it.type === "image" ? "Pie de imagen (opcional)" : "Texto"}">${esc(it.text)}</textarea></label>
        <div class="row"><button class="btn small" data-show="${it.id}">Mostrar a todos</button><button class="btn small danger" data-del="${it.id}">Quitar</button></div>
      </div>`).join("") || `<p class="empty">Sin contenido todavía.</p>`}</div>
    <div class="row"><button class="btn small" id="addtext">+ Texto</button><button class="btn small" id="addimg">+ Ilustración</button></div>
    <div class="row" style="margin-top:8px"><button class="btn small danger" id="delplace">Eliminar lugar</button></div>`;

  const P = id => s => s.world.places.find(p => p.id === id);
  const pid = place.id;
  $("#back", side).onclick = () => { sel = null; drawPins(); drawSide(); };
  const saveField = debounce((f, v) => store.commit("field", s => { P(pid)(s)[f] = v; }), 300);
  $$("[data-f]", side).forEach(i => i.addEventListener("input", () => {
    saveField(i.dataset.f, i.value);
    if (i.dataset.f === "name") { const pin = pinsEl.querySelector(`[data-id="${pid}"] span`); if (pin) pin.textContent = i.value; }
  }));
  $$("[data-sym]", side).forEach(b => b.onclick = () => store.commit("place", s => { P(pid)(s).icon = b.dataset.sym; }));
  $$("[data-symcat]", side).forEach(b => b.onclick = () => { symCat = b.dataset.symcat; drawSide(); });
  $$("[data-psize]", side).forEach(b => b.onclick = () => store.commit("place", s => { P(pid)(s).size = b.dataset.psize; }));
  $$("[data-ptint]", side).forEach(b => b.onclick = () => store.commit("place", s => { P(pid)(s).tint = b.dataset.ptint; }));
  $("#f-vis", side).onchange = e => store.commit("place", s => { P(pid)(s).visible = e.target.checked; });
  $("#placemap", side).onclick = async () => {
    const f = await pickFile(); if (!f) return;
    try {
      toast("Cargando el mapa del lugar…");
      const r = await readImageFile(f, 2600);
      const key = uid("mapa"); await putImage(key, r.dataURL);
      store.commit("place", s => { Object.assign(P(pid)(s), { map: key, mapW: r.w, mapH: r.h }); });
      toast("Mapa del lugar guardado. Lo verán al mostrar este lugar.");
    } catch (err) { toast("No se pudo cargar la imagen. Prueba con un JPG o PNG."); }
  };
  const npm = $("#noplacemap", side);
  if (npm) npm.onclick = () => store.commit("place", s => { const p = P(pid)(s); delete p.map; delete p.mapW; delete p.mapH; });
  $("#present", side).onclick = () => store.commit("present", s => { const p = P(pid)(s); p.visible = true; s.presentation = { type: "place", place: pid }; });
  { const ph = $("#partyhere", side); if (ph) ph.onclick = () => { const st = store.get(); if (liveSession(st)) import("../core/contexto.js").then(m => m.setHere(pid)); else partyToPlace(st, pid); toast(liveSession(st) ? "El grupo está aquí (apuntado en la ruta de la sesión)." : "El grupo está aquí. Con una sesión abierta, sus pasos se apuntan en la ruta."); }; }

  $$("[data-item]", side).forEach(box => {
    const iid = box.dataset.item;
    const I = s => P(pid)(s).items.find(i => i.id === iid);
    const save = debounce((k, v) => store.commit("field", s => { I(s)[k] = v; }), 300);
    $$("[data-k]", box).forEach(inp => {
      if (inp.type === "checkbox") inp.onchange = () => store.commit("place", s => { I(s).revealed = inp.checked; });
      else inp.addEventListener("input", () => save(inp.dataset.k, inp.value));
    });
  });
  $$("[data-show]", side).forEach(b => b.onclick = () => store.commit("present", s => {
    const p = P(pid)(s); p.visible = true; p.items.find(i => i.id === b.dataset.show).revealed = true;
    s.presentation = { type: "item", place: pid, item: b.dataset.show };
  }));
  $$("[data-del]", side).forEach(b => b.onclick = () => store.commit("place", s => { const p = P(pid)(s); p.items = p.items.filter(i => i.id !== b.dataset.del); }));
  $("#addtext", side).onclick = () => store.commit("place", s => P(pid)(s).items.push({ id: uid("it"), type: "text", title: "Nueva nota", text: "", revealed: false }));
  $("#addimg", side).onclick = async () => {
    const f = await pickFile(); if (!f) return;
    try {
      const r = await readImageFile(f, 1800);
      const key = uid("img"); await putImage(key, r.dataURL);
      store.commit("place", s => P(pid)(s).items.push({ id: uid("it"), type: "image", title: f.name.replace(/\.[^.]+$/, ""), text: "", img: key, revealed: false }));
    } catch (err) { toast("No se pudo cargar la imagen. Prueba con un JPG o PNG."); }
  };
  const del = $("#delplace", side);
  del.onclick = () => {
    if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "Pulsa otra vez para eliminar"; return; }
    sel = null; store.commit("place", s => { s.world.places = s.world.places.filter(p => p.id !== pid); });
  };
  fillImages(state, place);
}
