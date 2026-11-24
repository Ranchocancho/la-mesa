// "Lo que tenéis delante": dibuja en el escenario de la Partida lo que el máster está mostrando.
// Puede ser el «Anteriormente…», el mapa del mundo, un lugar (con su mapa local), una ilustración o la escena táctica.
import { store } from "../core/store.js";
import { getImage } from "../core/images.js";
import { exampleMap } from "../data/worldmap.js";
import { lastClosed, presentationFor } from "../core/sesiones.js";
import { esc } from "../core/ui.js";
import { bboxOf } from "../core/regiones.js";
import { isDM } from "../core/session.js";
import { timeline, tellTimeline } from "../core/lore.js";
import { routesOf, partyPos, tripText } from "../core/ruta.js";
import { genURL } from "../core/generamapa.js";

/* ---------- La ruta del grupo sobre el mapa mostrado (Hito 75) ----------
   toPx(x, y) pasa de coordenadas del mundo (0–1) a las del dibujo (W×H). Va encima de la imagen, ajustada por código. */
function routeOverlay(state, W, H, toPx) {
  const R = routesOf(state), P = partyPos(state), dm = isDM(state);
  const lines = R.slice().reverse().map(r => { const pts = r.pts.map(p => toPx(p.x, p.y)); if (pts.length < 2) return "";
    return `<g class="route ${r.live ? "live" : ""}"><title>${esc(r.name)}${tripText(state, r.pts) ? " · " + tripText(state, r.pts) : ""}</title><polyline points="${pts.map(p => p.map(v => v.toFixed(1)).join(",")).join(" ")}" class="rline"/>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r.live ? 0.006 * W : 0.004 * W}" class="rdot"/>`).join("")}</g>`; }).join("");
  const places = (state.world.places || []).filter(p => !p.parent && !p.detail && (dm || p.visible)).map(p => { const [x, y] = toPx(p.x, p.y); return x < 0 || y < 0 || x > W || y > H ? "" : `<g class="splace"><circle cx="${x}" cy="${y}" r="${0.005 * W}"/><text x="${x}" y="${y - 0.012 * W}" style="font-size:${(0.016 * W).toFixed(1)}px">${esc(p.name)}</text></g>`; }).join("");
  let party = ""; if (P) { const [x, y] = toPx(P.x, P.y); party = `<g class="sparty"><circle cx="${x}" cy="${y}" r="${0.009 * W}"/><text x="${x}" y="${y + 0.004 * W}" style="font-size:${(0.011 * W).toFixed(1)}px">⚑</text><text class="lab" x="${x}" y="${y + 0.026 * W}" style="font-size:${(0.013 * W).toFixed(1)}px">${P.p && (state.world.places.find(q => q.id === P.p) || {}).name ? "El grupo · en " + esc(state.world.places.find(q => q.id === P.p).name) : "El grupo"}</text></g>`; }
  return `<svg class="stageroute" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Ruta del grupo">${lines}${places}${party}</svg>`;
}
/** Coloca la capa de la ruta exactamente encima de la imagen (que se ajusta a la pantalla). */
function fitOverlay(el) {
  const art = el.querySelector(".art"), img = art && art.querySelector("img, .regcrop"), svg = art && art.querySelector(".stageroute"); if (!img || !svg) return;
  const place = () => { Object.assign(svg.style, { left: img.offsetLeft + "px", top: img.offsetTop + "px", width: img.offsetWidth + "px", height: img.offsetHeight + "px" }); };
  if (img.tagName === "IMG" && !img.complete) img.addEventListener("load", place, { once: true });
  place(); new ResizeObserver(place).observe(art);
}

let token = 0;

export async function renderStage(el) {
  const my = ++token;
  const state = store.get();
  const p = presentationFor(state);
  const backURL = state.backdrop ? await getImage(state.backdrop) : null;
  const mapURL = backURL || (state.world.map ? await getImage(state.world.map) : exampleMap().url);
  let html = "";
  const caption = (eyebrow, title, text) => `<div class="body"><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ""}</div>`;

  if (p && p.type === "lore") {
    const sn = p.snap || {}, url = sn.img ? await getImage(sn.img) : null;
    const who = p.to ? (state.users.find(u => u.id === p.to) || {}).name : null;
    const tag = who ? `<div class="presto">Solo para ${esc(who)}</div>` : "";
    if (url && !sn.text && !sn.eyebrow) html = `<div class="pres" style="background:#0a0806">${tag}<div class="art"><img src="${url}" alt="${esc(sn.title)}"></div></div>`;
    else if (url) html = `<div class="pres lorepres">${tag}<div class="art"><img src="${url}" alt="${esc(sn.title)}"></div>${caption(sn.eyebrow || "", sn.title, sn.text)}</div>`;
    else html = `<div class="pres" style="background-image:url('${mapURL}')">${tag}<div class="shade"></div>${caption(sn.eyebrow || "", sn.title, sn.text)}</div>`;
  } else if (p && p.type === "timeline") {
    // La cronología contada en la mesa: el hito actual en grande y, debajo, la línea con los que ya se conocen
    const dm = isDM(state), sn = p.snap || {}, cur = (state.lore || []).find(e => e.id === p.id) || {};
    const list = timeline(state, dm), i = list.findIndex(e => e.id === p.id);
    const img = cur.img || sn.img, url = img ? await getImage(img) : null;
    const thumbs = await Promise.all(list.map(e => e.img ? getImage(e.img) : null));
    const date = [cur.date ?? sn.date, cur.era ?? sn.era].filter(Boolean).join(" · ");
    html = `<div class="pres tlstage"${url ? ` style="--tlbg:url('${url}')"` : ` style="--tlbg:url('${mapURL}')"`}><div class="tlblur"></div>
      <div class="tlhero">${url ? `<div class="tlart"><img src="${url}" alt="${esc(cur.name || sn.title || "")}"></div>` : ""}
        <div class="body"><div class="eyebrow">CRONOLOGÍA${date ? " · " + esc(date.toUpperCase()) : ""}</div><h2>${esc(cur.name || sn.title || "")}</h2>${(cur.summary ?? sn.text) ? `<p>${esc(cur.summary ?? sn.text)}</p>` : ""}</div></div>
      <div class="tlstrip">${dm && i > 0 ? `<button class="tlstep" data-tlgo="${list[i - 1].id}" aria-label="Hito anterior">‹</button>` : ""}
        <div class="tlrow">${list.map((e, k) => `<button class="tls${e.id === p.id ? " now" : ""}${!e.revealed ? " hid" : ""}" ${dm ? `data-tlgo="${e.id}"` : "tabindex=\"-1\""} title="${esc(e.name)}">
          <span class="tlsimg"${thumbs[k] ? ` style="background-image:url('${thumbs[k]}')"` : ""}>${thumbs[k] ? "" : "⏳"}</span><small>${esc(e.date || "")}</small><b>${esc(e.name)}</b></button>`).join("")}</div>
        ${dm && i >= 0 && i < list.length - 1 ? `<button class="tlstep gold" data-tlgo="${list[i + 1].id}" aria-label="Siguiente hito">›</button>` : ""}</div></div>`;
  } else if (!p && backURL) {
    html = `<div class="pres" style="background:#0a0806"><div class="art"><img src="${backURL}" alt="Escena"></div></div>`;
  } else if (!p) {
    html = `<div class="pres empty-stage"><div class="body"><div class="eyebrow">LA MESA</div><h2>Nada en la mesa</h2>
      <p>Cuando el máster muestre algo (un lugar, una ilustración o una escena) aparecerá aquí para todos.</p></div></div>`;
  } else if (p.type === "recap") {
    const last = lastClosed(state);
    html = `<div class="pres" style="background-image:url('${mapURL}')"><div class="shade"></div>
      ${caption("ANTERIORMENTE EN " + state.campaign.name.toUpperCase(), last ? last.title : "La historia hasta ahora", last ? last.recap : "Esta es vuestra primera sesión.")}</div>`;
  } else if (p.type === "world") {
    // el mapa del mundo con el grupo y su ruta encima (lo ven todos en la mesa)
    let url = state.world.map ? await getImage(state.world.map) : null, W = state.world.mapW, H = state.world.mapH;
    if (!url && state.world.gen) { W = 1600; H = 1000; url = genURL(state.world.gen, W, H, state.world.gen.autoRoads ? state.world.places.filter(x => !x.parent && (isDM(state) || x.visible)).map(x => ({ x: +x.x.toFixed(3), y: +x.y.toFixed(3) })) : [], null); }
    if (!url) { const m = exampleMap(); url = m.url; W = m.w; H = m.h; }
    html = `<div class="pres mapstage"><div class="art"><img src="${url}" alt="Mapa del mundo">${routeOverlay(state, W, H, (x, y) => [x * W, y * H])}</div>
      <div class="body slim"><div class="eyebrow">MAPA DEL MUNDO</div><h2>${esc(state.campaign.name)}</h2><p><a class="btn small" href="#mundo">Explorar el mapa y sus lugares</a></p></div></div>`;
  } else if (p.type === "region") {
    const r = (state.world.regions || []).find(x => x.id === p.region);
    if (r) {
      const own = r.map ? await getImage(r.map) : null;
      let art;
      if (own) art = `<div class="art"><img src="${own}" alt="Mapa de ${esc(r.name)}"></div>`;
      else { // el mapa global, recortado a la región
        const b = bboxOf(r), W = state.world.map ? state.world.mapW : exampleMap().w, H = state.world.map ? state.world.mapH : exampleMap().h;
        const px = b.w >= 0.999 ? 0 : b.x0 / (1 - b.w) * 100, py = b.h >= 0.999 ? 0 : b.y0 / (1 - b.h) * 100;
        art = `<div class="art"><div class="regcrop" role="img" aria-label="Mapa de ${esc(r.name)}" style="aspect-ratio:${(b.w * W).toFixed(0)}/${(b.h * H).toFixed(0)};width:min(100%, calc(72vh * ${(b.w * W / (b.h * H)).toFixed(3)}));background:url('${mapURL}') ${px.toFixed(2)}% ${py.toFixed(2)}% / ${(100 / b.w).toFixed(2)}% ${(100 / b.h).toFixed(2)}% no-repeat"></div></div>`;
      }
      if (!own) { const b = bboxOf(r), W = state.world.map ? state.world.mapW : exampleMap().w, H = state.world.map ? state.world.mapH : exampleMap().h, w = b.w * W, h = b.h * H;
        art = art.replace(/<\/div>$/, routeOverlay(state, w, h, (x, y) => [(x - b.x0) * W, (y - b.y0) * H]) + "</div>"); }
      html = `<div class="pres mapstage">${art}<div class="body slim"><div class="eyebrow">REGIÓN</div><h2>${esc(r.name)}</h2>${r.summary ? `<p>${esc(r.summary)}</p>` : ""}<p><a class="btn small" href="#mundo">Ver en el mapa</a></p></div></div>`;
    }
  } else if (p.type === "tactical") {
    html = `<div class="pres empty-stage"><div class="body"><div class="eyebrow">ESCENA TÁCTICA</div><h2>Aún no hay ninguna escena en la mesa</h2>
      <p>Aquí se cargarán las escenas preparadas en cada lugar y las improvisadas: tablero, miniaturas, escenografía e iniciativa.</p></div></div>`;
  } else {
    const place = state.world.places.find(x => x.id === p.place);
    const item = place && p.type === "item" ? place.items.find(i => i.id === p.item) : null;
    if (!place) html = "";
    else if (item && item.type === "image") {
      const url = await getImage(item.img);
      html = `<div class="pres" style="background:#0a0806"><div class="art"><img src="${url || ""}" alt="${esc(item.title)}"></div>${caption(place.name.toUpperCase(), item.title, item.text)}</div>`;
    } else if (item) {
      html = `<div class="pres" style="background-image:url('${mapURL}')"><div class="shade"></div>${caption(place.name.toUpperCase(), item.title, item.text)}</div>`;
    } else if (place.map) {
      const url = await getImage(place.map);
      html = `<div class="pres mapstage"><div class="art"><img src="${url || ""}" alt="Mapa de ${esc(place.name)}"></div>
        <div class="body slim"><div class="eyebrow">${esc((place.kind || "").toUpperCase())}</div><h2>${esc(place.name)}</h2>${place.summary ? `<p>${esc(place.summary)}</p>` : ""}</div></div>`;
    } else {
      const img = place.items.find(i => i.type === "image" && i.revealed);
      const bg = img ? await getImage(img.img) : mapURL;
      html = `<div class="pres" style="background-image:url('${bg}')"><div class="shade"></div>${caption((place.kind || "").toUpperCase(), place.name, place.summary)}</div>`;
    }
  }
  if (my !== token || !el.isConnected) return; // cambió mientras cargaban las imágenes
  el.innerHTML = html;
  fitOverlay(el);
  el.querySelectorAll("[data-tlgo]").forEach(b => b.onclick = () => tellTimeline(b.dataset.tlgo));
  const now = el.querySelector(".tls.now"), row = el.querySelector(".tlrow");
  if (now && row) row.scrollLeft = now.offsetLeft - row.clientWidth / 2 + now.offsetWidth / 2;
}
