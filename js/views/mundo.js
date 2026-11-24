// Mapa del mundo: vuestro mapa, lugares con contenido y el control del máster sobre lo que ve cada uno.
import { store, uid } from "../core/store.js";
import { isDM, can } from "../core/session.js";
import { getImage, putImage, readImageFile } from "../core/images.js";
import { exampleMap } from "../data/worldmap.js";
import { MAP_ICONS, ICON_CATS, iconURL, PIN_SIZES, PIN_TINTS, pinDefaults } from "../data/simbolos.js";
import { $, $$, esc, toast, debounce, pickFile } from "../core/ui.js";
import { regionsOf, regionById, seeRegion, bboxOf, regionAt, toLocal, toGlobal, centroid, placesIn, addRegion, editRegion, deleteRegion, REG_COLORS } from "../core/regiones.js";
import { REGIONS } from "../data/mapas.js";

const KINDS = ["Región", "Ciudad", "Pueblo", "Distrito", "Localización", "Mazmorra", "Punto de interés"];
const PIN = (fill) => `<svg viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1C7.3 1 1 7 1 14.6 1 25 15 37 15 37s14-12 14-22.4C29 7 22.7 1 15 1z" fill="${fill}" stroke="#2b1d10" stroke-width="2"/><circle cx="15" cy="14" r="5" fill="#2b1d10"/></svg>`;

let el, vp, stage, img, pinsEl, side;
let view = { x: 0, y: 0, k: 1 }, imgW = 1600, imgH = 1000;
let sel = null, adding = false, fitted = false;
// Vistas: "global" (el mapa entero), "regions" (el mapa troceado en regiones) y "region" (dentro de una región)
let mode = "global", regId = null, drawing = null, redrawId = null, mapKey = "";

export function mount(root) {
  el = document.createElement("div");
  el.className = "world";
  el.innerHTML = `
    <div class="viewport" id="vp">
      <div class="stage" id="stage"><img id="mapimg" alt="Mapa del mundo"><svg id="regsvg" class="regsvg" aria-hidden="true"></svg><div id="pins"></div></div>
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
const ownMap = () => { const r = curRegion(); return r && r.map ? r : null; };
// Coordenadas: los lugares guardan su posición global (0–1); en una región con mapa propio se traducen
function g2i(x, y) { const r = ownMap(); if (r) { const l = toLocal(r, x, y); return [l.x * imgW, l.y * imgH]; } return [x * imgW, y * imgH]; }
function i2g(px, py) { const r = ownMap(), x = px / imgW, y = py / imgH; return r ? toGlobal(r, x, y) : { x, y }; }
function evPoint(e) { const r = vp.getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k]; }

async function loadMap() {
  const state = store.get(), own = ownMap();
  const key = own ? "r:" + own.map : "g:" + (state.world.map || "") + ":" + mode + ":" + (regId || "");
  let url, w, h;
  if (own) { url = await getImage(own.map); w = own.mapW; h = own.mapH; }
  if (!url && state.world.map) { url = await getImage(state.world.map); w = state.world.mapW; h = state.world.mapH; }
  if (!url) { const m = exampleMap(); url = m.url; w = m.w; h = m.h; }
  imgW = w; imgH = h;
  img.src = url; img.width = w; img.height = h;
  stage.style.width = w + "px"; stage.style.height = h + "px";
  if (key !== mapKey) { mapKey = key; fitted = false; }
  if (!fitted) fit();
  drawPins(); drawRegions();
}
function apply() {
  stage.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
  stage.style.setProperty("--ik", 1 / view.k);
  $$(".pin", pinsEl).forEach(p => (p.style.transform = `translate(-50%,-100%) scale(${1 / view.k})`));
}
function fit() {
  const r = vp.getBoundingClientRect();
  if (!r.width) return;
  const reg = curRegion();
  if (reg && !reg.map) { // sin mapa propio: el mapa global, acercado a la región
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
    if (e.target.closest(".pin,.maptools,.mapzoom,.maptabs")) return;
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; vp.classList.add("panning"); }
    if (drag.moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; apply(); }
  });
  vp.addEventListener("pointerup", e => {
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
    t.innerHTML = `<span class="drawhint">✏️ ${redrawId ? "Redibuja el contorno" : "Dibuja la región"}: clic para cada punto · ${drawing.length} puntos</span>
      <button class="btn small gold" id="drawok" ${drawing.length < 3 ? "disabled" : ""}>✓ Cerrar región</button><button class="btn small" id="drawundo" ${drawing.length ? "" : "disabled"}>↶ Punto</button><button class="btn small" id="drawx">Cancelar</button>`;
    $("#drawok", t).onclick = finishDrawing;
    $("#drawundo", t).onclick = () => { drawing.pop(); redraw(); };
    $("#drawx", t).onclick = () => { drawing = null; redrawId = null; redraw(); };
    return;
  }
  if (mode === "regions") {
    t.innerHTML = `<button class="btn small gold" id="drawreg">✏️ Dibujar región</button>`;
    $("#drawreg", t).onclick = () => { drawing = []; sel = null; redraw(); };
    return;
  }
  t.innerHTML = `<button class="btn small" id="addplace" aria-pressed="${adding}">+ Añadir lugar</button>
    ${reg ? `<button class="btn small" id="upreg">${reg.map ? "Cambiar mapa de la región" : "Subir mapa de la región"}</button>${reg.map ? `<button class="btn small" id="noreg">Usar el mapa global</button>` : ""}`
      : `<button class="btn small" id="upmap">Subir vuestro mapa</button>${state.world.map ? `<button class="btn small" id="exmap">Volver al mapa de ejemplo</button>` : ""}`}`;
  $("#addplace", t).onclick = () => setAdding(!adding);
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

/* ---------- Pestañas: Global · Regiones · (dentro de una región) ---------- */
function drawTabs() {
  const s = store.get(), dm = isDM(s), list = regionsOf(s).filter(r => seeRegion(s, r, dm)), reg = curRegion();
  const t = $("#maptabs", el);
  t.innerHTML = `<button data-mode="global" aria-pressed="${mode === "global"}">🌍 Mapa global</button><button data-mode="regions" aria-pressed="${mode !== "global"}">🗺 Regiones${list.length ? ` <small>${list.length}</small>` : ""}</button>
    ${reg ? `<span class="tabreg" style="--rc:${esc(reg.color)}">▸ <b>${esc(reg.name)}</b></span>${list.length > 1 ? `<select id="regjump" aria-label="Ir a otra región">${list.map(r => `<option value="${r.id}" ${r.id === reg.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>` : ""}` : ""}`;
  $$("[data-mode]", t).forEach(b => b.onclick = () => { if (drawing) return; mode = b.dataset.mode; regId = null; sel = null; setAdding(false); loadMap(); redraw(); });
  const j = $("#regjump", t); if (j) j.onchange = () => enterRegion(j.value);
}
function enterRegion(id) { mode = "region"; regId = id; sel = null; setAdding(false); loadMap(); redraw(); }
function redraw() { drawTabs(); drawTools(); drawPins(); drawRegions(); drawSide(); vp.classList.toggle("drawing", !!drawing); vp.classList.toggle("modereg", mode === "regions"); }
function finishDrawing() {
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
      return `<button class="pin sz-${d.size} ${p.visible ? "" : "hidden"} ${p.id === sel ? "sel" : ""} ${p.id === live ? "live" : ""}" data-id="${p.id}" style="left:${g2i(p.x, p.y)[0]}px;top:${g2i(p.x, p.y)[1]}px;--d:${z.d}px;--f:${z.f}px;--ring:${t.ring};--bg:${t.bg};--ink:${t.ink}" aria-label="${esc(p.name)}">
      <i class="medal"><b style="-webkit-mask-image:url(${iconURL(d.icon)});mask-image:url(${iconURL(d.icon)})"></b></i><span>${esc(p.name)}</span></button>`; }).join("");
  $$(".pin", pinsEl).forEach(b => {
    b.onclick = e => { e.stopPropagation(); if (adding || drawing) return; sel = b.dataset.id; drawPins(); drawSide(); };
    // El máster puede arrastrar los marcadores para recolocarlos
    if (isDM(state)) {
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
  apply();
}

/* ---------- Panel lateral ---------- */
function drawSide() {
  const state = store.get();
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
    <div class="row"><button class="btn gold" id="present">Mostrar este lugar a todos</button></div>
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
