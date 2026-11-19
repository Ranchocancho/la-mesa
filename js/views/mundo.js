// Mapa del mundo: vuestro mapa, lugares con contenido y el control del máster sobre lo que ve cada uno.
import { store, uid } from "../core/store.js";
import { isDM, can } from "../core/session.js";
import { getImage, putImage, readImageFile } from "../core/images.js";
import { exampleMap } from "../data/worldmap.js";
import { MAP_ICONS, ICON_CATS, iconURL, PIN_SIZES, PIN_TINTS, pinDefaults } from "../data/simbolos.js";
import { $, $$, esc, toast, debounce, pickFile } from "../core/ui.js";

const KINDS = ["Región", "Ciudad", "Pueblo", "Distrito", "Localización", "Mazmorra", "Punto de interés"];
const PIN = (fill) => `<svg viewBox="0 0 30 38" aria-hidden="true"><path d="M15 1C7.3 1 1 7 1 14.6 1 25 15 37 15 37s14-12 14-22.4C29 7 22.7 1 15 1z" fill="${fill}" stroke="#2b1d10" stroke-width="2"/><circle cx="15" cy="14" r="5" fill="#2b1d10"/></svg>`;

let el, vp, stage, img, pinsEl, side;
let view = { x: 0, y: 0, k: 1 }, imgW = 1600, imgH = 1000;
let sel = null, adding = false, fitted = false;

export function mount(root) {
  el = document.createElement("div");
  el.className = "world";
  el.innerHTML = `
    <div class="viewport" id="vp">
      <div class="stage" id="stage"><img id="mapimg" alt="Mapa del mundo"><div id="pins"></div></div>
      <div class="maptools" id="maptools"></div>
      <div class="mapzoom"><button id="zin" aria-label="Acercar">+</button><button id="zout" aria-label="Alejar">−</button><button id="zfit" aria-label="Ver el mapa entero" title="Ver el mapa entero">⤢</button></div>
      <div class="hintbar" id="hint" hidden>Haz clic en el mapa para colocar el nuevo lugar · Esc para cancelar</div>
    </div>
    <aside class="side" id="side" aria-label="Detalle del lugar"></aside>`;
  root.appendChild(el);
  vp = $("#vp", el); stage = $("#stage", el); img = $("#mapimg", el); pinsEl = $("#pins", el); side = $("#side", el);
  fitted = false;
  loadMap();
  bindViewport();
  drawTools(); drawPins(); drawSide();
  const onKey = e => { if (e.key === "Escape" && adding) setAdding(false); };
  document.addEventListener("keydown", onKey);
  const onResize = () => fit();
  window.addEventListener("resize", onResize);
  return {
    update(state, label, remote) {
      if (label === "map" || label === "reset") { fitted = false; loadMap(); }
      if (sel && !state.world.places.some(p => p.id === sel)) sel = null;
      drawTools(); drawPins();
      if (!(label === "field" && !remote)) drawSide();
    },
    unmount() { document.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); }
  };
}

/* ---------- Mapa, zoom y desplazamiento ---------- */
async function loadMap() {
  const state = store.get();
  let url, w, h;
  if (state.world.map) { url = await getImage(state.world.map); w = state.world.mapW; h = state.world.mapH; }
  if (!url) { const m = exampleMap(); url = m.url; w = m.w; h = m.h; }
  imgW = w; imgH = h;
  img.src = url; img.width = w; img.height = h;
  stage.style.width = w + "px"; stage.style.height = h + "px";
  if (!fitted) fit();
}
function apply() {
  stage.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`;
  stage.style.setProperty("--ik", 1 / view.k);
  $$(".pin", pinsEl).forEach(p => (p.style.transform = `translate(-50%,-100%) scale(${1 / view.k})`));
}
function fit() {
  const r = vp.getBoundingClientRect();
  if (!r.width) return;
  view.k = Math.min(r.width / imgW, r.height / imgH) * 0.96;
  view.x = (r.width - imgW * view.k) / 2; view.y = (r.height - imgH * view.k) / 2;
  fitted = true; apply();
}
function zoomAt(f, cx, cy) {
  const k = Math.max(0.15, Math.min(4, view.k * f));
  view.x = cx - (cx - view.x) * (k / view.k); view.y = cy - (cy - view.y) * (k / view.k); view.k = k; apply();
}
function bindViewport() {
  let drag = null;
  vp.addEventListener("pointerdown", e => {
    if (e.target.closest(".pin,.maptools,.mapzoom")) return;
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
    if (click && adding) {
      const r = vp.getBoundingClientRect();
      const x = (e.clientX - r.left - view.x) / view.k / imgW, y = (e.clientY - r.top - view.y) / view.k / imgH;
      if (x < 0 || y < 0 || x > 1 || y > 1) return;
      const id = uid("lugar");
      store.commit("place", s => s.world.places.push({ id, name: "Nuevo lugar", kind: "Punto de interés", x, y, visible: false, summary: "", secret: "", items: [] }));
      sel = id; setAdding(false); drawSide();
      const n = $("#f-name", side); if (n) { n.focus(); n.select(); }
    } else if (click) { sel = null; drawPins(); drawSide(); }
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
  t.innerHTML = `<button class="btn small" id="addplace" aria-pressed="${adding}">+ Añadir lugar</button>
    <button class="btn small" id="upmap">Subir vuestro mapa</button>
    ${state.world.map ? `<button class="btn small" id="exmap">Volver al mapa de ejemplo</button>` : ""}`;
  $("#addplace", t).onclick = () => setAdding(!adding);
  $("#upmap", t).onclick = async () => {
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
  const ex = $("#exmap", t);
  if (ex) ex.onclick = () => store.commit("map", s => { s.world.map = null; });
}

/* ---------- Marcadores ---------- */
function drawPins() {
  const state = store.get();
  const live = state.presentation && (state.presentation.place);
  // En el mapa del mundo solo van los lugares de primer nivel; los de dentro (distritos, posadas…) viven en el Lore
  pinsEl.innerHTML = state.world.places.filter(p => !p.parent && can.seePlace(state, p)).map(p =>
    { const d = pinDefaults(p), z = PIN_SIZES[d.size] || PIN_SIZES.normal, t = PIN_TINTS[d.tint] || PIN_TINTS.neutro;
      return `<button class="pin sz-${d.size} ${p.visible ? "" : "hidden"} ${p.id === sel ? "sel" : ""} ${p.id === live ? "live" : ""}" data-id="${p.id}" style="left:${p.x * imgW}px;top:${p.y * imgH}px;--d:${z.d}px;--f:${z.f}px;--ring:${t.ring};--bg:${t.bg};--ink:${t.ink}" aria-label="${esc(p.name)}">
      <i class="medal"><b style="-webkit-mask-image:url(${iconURL(d.icon)});mask-image:url(${iconURL(d.icon)})"></b></i><span>${esc(p.name)}</span></button>`; }).join("");
  $$(".pin", pinsEl).forEach(b => {
    b.onclick = e => { e.stopPropagation(); if (adding) return; sel = b.dataset.id; drawPins(); drawSide(); };
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
          const r = vp.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (e.clientX - r.left - view.x) / view.k / imgW)), y = Math.max(0, Math.min(1, (e.clientY - r.top - view.y) / view.k / imgH));
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
  if (!place || !can.seePlace(state, place)) return drawList(state);
  return isDM(state) ? drawEditor(state, place) : drawReader(state, place);
}

function drawList(state) {
  const dm = isDM(state);
  const list = state.world.places.filter(p => !p.parent && can.seePlace(state, p));
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
  side.innerHTML = `<button class="btn small" id="back">← Todos los lugares</button>
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
  side.innerHTML = `<div class="row"><button class="btn small" id="back">← Todos los lugares</button><a class="btn small gold" href="#lore/${place.id}">📖 Abrir en el Lore</a></div>
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
