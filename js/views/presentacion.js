// Lo que el máster muestra a todos a pantalla completa: "Anteriormente en…", un lugar o una ilustración.
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { getImage } from "../core/images.js";
import { exampleMap } from "../data/worldmap.js";
import { $, esc } from "../core/ui.js";

let shownKey = null;

export async function renderOverlay() {
  const state = store.get();
  const ov = $("#overlay");
  const p = state.presentation;
  if (!p) { ov.classList.remove("on"); ov.innerHTML = ""; shownKey = null; return; }
  const key = JSON.stringify(p) + (isDM(state) ? "dm" : "pj");
  if (key === shownKey) return;

  const mapURL = state.world.map ? await getImage(state.world.map) : exampleMap().url;
  let html = "";
  if (p.type === "recap") {
    const last = state.sessions[state.sessions.length - 1];
    html = `<div class="pres" style="background-image:url('${mapURL}')"><div class="shade"></div>
      <div class="body"><div class="eyebrow">ANTERIORMENTE EN ${esc(state.campaign.name.toUpperCase())}</div>
      <h2>${esc(last ? last.title : "La historia hasta ahora")}</h2><p>${esc(last ? last.recap : "")}</p></div></div>`;
  }
  if (p.type === "place" || p.type === "item") {
    const place = state.world.places.find(x => x.id === p.place);
    if (!place) { ov.classList.remove("on"); ov.innerHTML = ""; return; } // aún no ha llegado el lugar
    const item = p.type === "item" ? place.items.find(i => i.id === p.item) : null;
    if (item && item.type === "image") {
      const url = await getImage(item.img);
      html = `<div class="pres" style="background:#0a0806"><div class="art"><img src="${url || ""}" alt="${esc(item.title)}"></div>
        <div class="body"><div class="eyebrow">${esc(place.name.toUpperCase())}</div><h2>${esc(item.title)}</h2>${item.text ? `<p>${esc(item.text)}</p>` : ""}</div></div>`;
    } else if (item) {
      html = `<div class="pres" style="background-image:url('${mapURL}')"><div class="shade"></div>
        <div class="body"><div class="eyebrow">${esc(place.name.toUpperCase())}</div><h2>${esc(item.title)}</h2><p>${esc(item.text)}</p></div></div>`;
    } else {
      const img = place.items.find(i => i.type === "image" && (i.revealed || p.type === "place"));
      const bg = img ? await getImage(img.img) : mapURL;
      html = `<div class="pres" style="background-image:url('${bg}')"><div class="shade"></div>
        <div class="body"><div class="eyebrow">${esc((place.kind || "").toUpperCase())}</div><h2>${esc(place.name)}</h2><p>${esc(place.summary)}</p></div></div>`;
    }
  }
  const ctl = isDM(state)
    ? `<div class="ctl"><span class="who">Todos están viendo esto</span><button class="btn gold" id="endpres">Terminar presentación</button></div>`
    : `<div class="ctl"><span class="who">El máster os lo está mostrando</span></div>`;
  if (JSON.stringify(store.get().presentation) + (isDM(store.get()) ? "dm" : "pj") !== key) return; // cambió mientras cargaba
  shownKey = key;
  ov.innerHTML = html.replace(/<\/div>$/, ctl + "</div>");
  ov.classList.add("on");
  const b = $("#endpres");
  if (b) b.onclick = () => store.commit("present", s => { s.presentation = null; });
}
