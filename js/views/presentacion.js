// "Lo que tenéis delante": dibuja en el escenario de la Partida lo que el máster está mostrando.
// Puede ser el «Anteriormente…», el mapa del mundo, un lugar (con su mapa local), una ilustración o la escena táctica.
import { store } from "../core/store.js";
import { getImage } from "../core/images.js";
import { exampleMap } from "../data/worldmap.js";
import { lastClosed, presentationFor } from "../core/sesiones.js";
import { esc } from "../core/ui.js";
import { bboxOf } from "../core/regiones.js";

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
    html = `<div class="pres mapstage"><div class="art"><img src="${mapURL}" alt="Mapa del mundo"></div>
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
}
