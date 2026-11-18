// Lore: el libro de campaña. El máster crea y edita lugares (región › ciudad › distrito › localización),
// personajes, facciones, eventos, galería, notas, la preparación de la sesión y las sesiones jugadas.
// Los jugadores ven lo mismo, pero solo lo que se les ha revelado y sin secretos.
import { store, uid } from "../core/store.js";
import { isDM, currentUser } from "../core/session.js";
import { LORE, EVENT_TYPES, EVENT_STATUS, PLACE_KINDS, loreOf, entry, placeOf, canSee, refName, related, placePath, childrenOf, descendants,
  newEntry, setEntry, removeEntry, link, unlink, showEntry, setBackdrop, clockOf, clockText, advanceClock } from "../core/lore.js";
import { pastSessions, liveSession, sessionName, editSession, editXP, deleteSession } from "../core/sesiones.js";
import { loadScene } from "../core/mesa.js";
import { getImage, putImage, readImageFile } from "../core/images.js";
import { $, $$, esc, toast, debounce, pickFile } from "../core/ui.js";

let el = null, q = "";
const SECTIONS = [["places", "📍", "Lugares"], ["npc"], ["faction"], ["event"], ["image"], ["note", , , true], ["chapter", , , true], ["sessions", "📜", "Sesiones"]];
const sec = k => { const x = SECTIONS.find(s => s[0] === k); return x && LORE[k] ? [k, LORE[k].icon, LORE[k].pl, x[3]] : x; };

export function mount(root) {
  el = document.createElement("div"); el.className = "lore"; root.appendChild(el);
  draw();
  const onHash = () => draw();
  addEventListener("hashchange", onHash);
  return {
    update(state, label, remote) {
      if (label === "field" && !remote) return;           // lo que estás escribiendo ya está en pantalla
      const a = document.activeElement;
      if (a && el.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== "checkbox") return;
      draw();
    },
    unmount() { removeEventListener("hashchange", onHash); el = null; }
  };
}

const target = () => decodeURIComponent((location.hash.split("/")[1] || ""));
const go = t => { location.hash = "lore" + (t ? "/" + encodeURIComponent(t) : ""); };

function draw() {
  if (!el) return;
  const s = store.get(), dm = isDM(s), t = target();
  const count = k => k === "places" ? s.world.places.filter(p => dm || p.visible).length : k === "sessions" ? pastSessions(s).length : loreOf(s).filter(e => e.kind === k && canSee(s, e)).length;
  const active = t.startsWith("s:") ? t.slice(2) : t.startsWith("ses:") ? "sessions" : placeOf(s, t) ? "places" : (entry(s, t) || {}).kind || (t ? "" : "places");
  el.innerHTML = `<aside class="lnav">
      <input type="search" id="lq" placeholder="Buscar en el lore…" value="${esc(q)}">
      ${q.length > 1 ? searchResults(s) : `<nav>${SECTIONS.map(x => sec(x[0])).filter(x => dm || !x[3]).map(([k, ic, n]) => `<a href="#lore/s:${k}" class="${active === k ? "on" : ""}"><span>${ic}</span>${n}<small>${count(k)}</small></a>`).join("")}</nav>
      <div class="ltree"><h4>Mapa del lore</h4>${tree(s, null, 0)}</div>`}
      ${clockBox(s, dm)}
    </aside>
    <section class="lmain">${page(s, t, dm)}</section>`;
  bindNav(s, dm);
  bindPage(s, t, dm);
  fillImages();
}

/* ---------- Navegación ---------- */
function tree(s, parent, depth) {
  const kids = childrenOf(s, parent).filter(p => isDM(s) || p.visible);
  if (!kids.length) return depth ? "" : `<p class="empty">Sin lugares. Créalos en el mapa o aquí.</p>`;
  return `<ul>${kids.map(p => `<li><a href="#lore/${p.id}" class="${target() === p.id ? "on" : ""}${p.visible ? "" : " hid"}">${esc(p.name)}<small>${esc(p.kind || "")}</small></a>${tree(s, p.id, depth + 1)}</li>`).join("")}</ul>`;
}
function searchResults(s) {
  const n = x => (x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""), w = n(q);
  const hits = [...s.world.places.filter(p => (isDM(s) || p.visible) && n(p.name + " " + p.summary + (isDM(s) ? " " + p.secret : "")).includes(w)).map(p => ({ id: p.id, ic: "📍", name: p.name, sub: p.kind })),
    ...loreOf(s).filter(e => canSee(s, e) && n(e.name + " " + e.summary + " " + (e.role || "") + (isDM(s) ? " " + e.secret : "")).includes(w)).map(e => ({ id: e.id, ic: LORE[e.kind].icon, name: e.name, sub: LORE[e.kind].n }))];
  return `<div class="lres">${hits.map(h => `<a href="#lore/${h.id}"><span>${h.ic}</span>${esc(h.name)}<small>${esc(h.sub || "")}</small></a>`).join("") || `<p class="empty">Nada encontrado.</p>`}</div>`;
}
function clockBox(s, dm) {
  const c = clockOf(s);
  return `<div class="lclock"><span>🕯 ${esc(clockText(c))}</span>${dm ? `<div class="row">${[[10, "+10 min"], [60, "+1 h"], [480, "+8 h"], [1440, "+1 día"]].map(([m, l]) => `<button class="btn small" data-clock="${m}">${l}</button>`).join("")}</div>` : ""}</div>`;
}
function bindNav(s, dm) {
  const lq = $("#lq", el);
  lq.oninput = () => { q = lq.value; const p = lq.selectionStart; draw(); const n = $("#lq", el); n.focus(); n.setSelectionRange(p, p); };
  $$("[data-clock]", el).forEach(b => b.onclick = () => advanceClock(+b.dataset.clock));
}

/* ---------- Páginas ---------- */
function page(s, t, dm) {
  if (!t || t === "s:places") return placesHome(s, dm);
  if (t.startsWith("s:")) return t === "s:sessions" ? sessionsPage(s, dm) : t === "s:chapter" ? prepPage(s, dm) : listPage(s, t.slice(2), dm);
  if (t.startsWith("ses:")) return sessionPage(s, t.slice(4), dm);
  const p = placeOf(s, t); if (p && (dm || p.visible)) return placePage(s, p, dm);
  const e = entry(s, t); if (e && canSee(s, e)) return entryPage(s, e, dm);
  return `<div class="lpage"><p class="empty">No se encuentra (o aún no os lo han revelado).</p></div>`;
}

const thumb = (key, cls = "") => key ? `<div class="lthumb ${cls}" data-img="${esc(key)}"></div>` : "";
function card(s, e) {
  const pl = e.place ? placeOf(s, e.place) : null;
  const sub = e.kind === "npc" ? e.role : e.kind === "event" ? `${EVENT_TYPES[e.etype] || ""} · ${EVENT_STATUS[e.status] || ""}` : pl ? pl.name : "";
  return `<a class="lcard k-${e.kind}${e.kind === "event" ? " st-" + e.status : ""}" href="#lore/${e.id}">${thumb(e.img)}<span class="li">${LORE[e.kind].icon}</span><b>${esc(e.name)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}${isDM(s) && !e.revealed && e.kind !== "note" && e.kind !== "chapter" ? `<i class="lock" title="Oculto a los jugadores">🔒</i>` : ""}</a>`;
}
const placeCard = (s, p) => `<a class="lcard k-place" href="#lore/${p.id}"><span class="li">📍</span><b>${esc(p.name)}</b><small>${esc(p.kind || "")}${childrenOf(s, p.id).length ? ` · ${childrenOf(s, p.id).length} dentro` : ""}</small>${isDM(s) && !p.visible ? `<i class="lock">🔒</i>` : ""}</a>`;

function placesHome(s, dm) {
  const top = childrenOf(s, null).filter(p => dm || p.visible);
  return `<div class="lpage"><header class="lhead"><div class="eyebrow">LIBRO DEL MUNDO</div><h1>${esc(s.campaign.name)}</h1>
      <p class="lsub">${dm ? "Todo lo que creas aquí queda a mano durante la partida. Los jugadores solo ven lo que reveles." : "Lo que sabéis del mundo. El máster os irá revelando más."}</p></header>
    <h3 class="lsec">Lugares</h3><div class="lgrid">${top.map(p => placeCard(s, p)).join("") || `<p class="empty">Aún no hay lugares.</p>`}</div>
    ${dm ? `<div class="row"><button class="btn gold small" data-newplace="">+ Lugar</button><a class="btn small" href="#mundo">Colocar en el mapa del mundo</a></div>` : ""}
    ${["npc", "faction", "event"].map(k => { const l = loreOf(s).filter(e => e.kind === k && canSee(s, e)).slice(0, 8); return l.length ? `<h3 class="lsec"><a href="#lore/s:${k}">${LORE[k].icon} ${LORE[k].pl}</a></h3><div class="lgrid">${l.map(e => card(s, e)).join("")}</div>` : ""; }).join("")}</div>`;
}

function listPage(s, k, dm) {
  if (!LORE[k]) return "";
  const list = loreOf(s).filter(e => e.kind === k && canSee(s, e));
  return `<div class="lpage"><header class="lhead"><div class="eyebrow">LORE</div><h1>${LORE[k].icon} ${LORE[k].pl}</h1><p class="lsub">${LORE[k].hint}</p></header>
    ${dm ? `<div class="row"><button class="btn gold small" data-new="${k}">+ ${LORE[k].n}</button></div>` : ""}
    <div class="lgrid">${list.map(e => card(s, e)).join("") || `<p class="empty">${dm ? "Todavía nada. Crea el primero." : "Aún no os han revelado nada."}</p>`}</div></div>`;
}

/* ---------- Un lugar: sus capas de información ---------- */
function placePage(s, p, dm) {
  const path = placePath(s, p.id), here = [p.id, ...descendants(s, p.id)];
  const of = k => loreOf(s).filter(e => e.kind === k && here.includes(e.place) && canSee(s, e));
  const kids = childrenOf(s, p.id).filter(c => dm || c.visible), scenes = (s.scenes || []).filter(x => x.place === p.id);
  const block = (k, extra = "") => { const l = of(k); if (!dm && !l.length) return ""; return `<h3 class="lsec">${LORE[k].icon} ${LORE[k].pl}</h3><div class="lgrid">${l.map(e => card(s, e)).join("") || `<p class="empty">Nada todavía.</p>`}${dm ? `<button class="lcard add" data-new="${k}" data-at="${p.id}">+ ${LORE[k].n}</button>` : ""}</div>${extra}`; };
  return `<div class="lpage"><nav class="crumbs"><a href="#lore">Lore</a>${path.map(x => ` › <a href="#lore/${x.id}">${esc(x.name)}</a>`).join("")}</nav>
    <header class="lhead">
      ${dm ? `<input class="h1" data-pf="name" value="${esc(p.name)}" aria-label="Nombre">
        <div class="row lmeta"><select data-pf="kind">${PLACE_KINDS.map(k => `<option ${k === p.kind ? "selected" : ""}>${k}</option>`).join("")}${PLACE_KINDS.includes(p.kind) ? "" : `<option selected>${esc(p.kind)}</option>`}</select>
          <label>Dentro de <select data-pf="parent"><option value="">— Mapa del mundo —</option>${s.world.places.filter(x => x.id !== p.id && !descendants(s, p.id).includes(x.id)).map(x => `<option value="${x.id}" ${x.id === p.parent ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
          <label class="switch"><input type="checkbox" data-pvis ${p.visible ? "checked" : ""}> Lo conocen los jugadores</label></div>`
        : `<div class="eyebrow">${esc((p.kind || "").toUpperCase())}</div><h1>${esc(p.name)}</h1>`}
    </header>
    ${dm ? `<div class="ltools"><button class="btn gold small" data-showplace>Mostrar a todos</button>${!p.parent ? `<a class="btn small" href="#mundo">Ver en el mapa</a>` : ""}</div>` : ""}
    ${twoCols(dm, p.summary, p.secret, "pf", "Cómo es: ambiente, sonidos, olores… (lo ven los jugadores)")}
    <h3 class="lsec">📍 Lugares dentro</h3><div class="lgrid">${kids.map(c => placeCard(s, c)).join("") || (dm ? "" : `<p class="empty">Nada más que sepáis.</p>`)}${dm ? `<button class="lcard add" data-newplace="${p.id}">+ Lugar dentro</button>` : ""}</div>
    ${block("npc")}${block("faction")}${block("event")}${block("image")}${dm ? block("note") : ""}
    ${dm && scenes.length ? `<h3 class="lsec">⚔️ Escenas tácticas (3D)</h3><div class="lgrid">${scenes.map(x => `<div class="lcard"><span class="li">⚔️</span><b>${esc(x.name)}</b><small>${x.tokens.length} fichas</small><button class="btn small gold" data-loadscene="${x.id}">Cargar en la mesa</button></div>`).join("")}</div>` : ""}
    ${(p.items || []).filter(i => dm || i.revealed).length ? `<h3 class="lsec">🗺 Contenido del mapa</h3><div class="lgrid">${p.items.filter(i => dm || i.revealed).map(i => `<a class="lcard" href="#mundo"><span class="li">${i.type === "image" ? "🖼" : "📄"}</span><b>${esc(i.title)}</b><small>${i.revealed ? "revelado" : "oculto"}</small></a>`).join("")}</div>` : ""}
    ${dm ? `<div class="row ldanger"><button class="btn small danger" data-delplace>Eliminar lugar</button></div>` : ""}</div>`;
}

function twoCols(dm, pub, secret, attr, ph) {
  if (!dm) return pub ? `<div class="lbook"><p>${esc(pub).replace(/\n/g, "<br>")}</p></div>` : "";
  return `<div class="lcols"><label class="lpub"><span>Lo que saben los jugadores</span><textarea data-${attr}="summary" rows="5" placeholder="${esc(ph)}">${esc(pub || "")}</textarea></label>
    <label class="lsecret"><span><i class="tag secret">SOLO MÁSTER</i> Secretos, pistas, lo que hay detrás</span><textarea data-${attr}="secret" rows="5">${esc(secret || "")}</textarea></label></div>`;
}

/* ---------- Una entrada: personaje, facción, evento, imagen, nota o escena preparada ---------- */
function entryPage(s, e, dm) {
  const pl = e.place ? placeOf(s, e.place) : null, rel = related(s, e.id), players = s.users.filter(u => u.role === "player");
  const shown = s.presentation && s.presentation.id === e.id;
  const relHTML = `<h3 class="lsec">🔗 Relacionado</h3><div class="lchips">${rel.filter(r => { const x = entry(s, r); return !x || canSee(s, x); }).map(r => { const n = refName(s, r); return `<span class="lchip"><a href="#lore/${n.kind === "scene" ? "" : r}">${n.icon} ${esc(n.name)}</a>${dm ? `<button data-unlink="${r}" aria-label="Quitar relación">✕</button>` : ""}${dm && e.kind === "chapter" && n.kind !== "place" && n.kind !== "scene" ? `<button data-showref="${r}" title="Mostrar a todos">👁</button>` : ""}${dm && n.kind === "scene" ? `<button data-loadscene="${r}" title="Cargar en la mesa">⚔️</button>` : ""}</span>`; }).join("") || `<span class="empty">Nada enlazado.</span>`}
      ${dm ? `<select data-link><option value="">+ Relacionar con…</option>${s.world.places.map(p => `<option value="${p.id}">📍 ${esc(p.name)}</option>`).join("")}${loreOf(s).filter(x => x.id !== e.id && !rel.includes(x.id)).map(x => `<option value="${x.id}">${LORE[x.kind].icon} ${esc(x.name)}</option>`).join("")}${e.kind === "chapter" ? (s.scenes || []).map(x => `<option value="${x.id}">⚔️ ${esc(x.name)}</option>`).join("") : ""}</select>` : ""}</div>`;
  const imgBox = e.kind === "note" || e.kind === "chapter" ? "" : `<div class="limg">${e.img ? thumb(e.img, "big") : dm ? `<div class="lthumb big empty">Sin imagen</div>` : ""}
      ${dm ? `<div class="row"><button class="btn small" data-upimg>${e.img ? "Cambiar imagen" : "+ Imagen"}</button>${e.img ? `<button class="btn small" data-noimg>Quitar</button>` : ""}</div>` : ""}</div>`;
  const tools = !dm || e.kind === "note" ? "" : e.kind === "chapter" ? "" : `<div class="ltools">
      <button class="btn gold small" data-show="">${shown ? "✓ En la mesa" : "Mostrar a todos"}</button>
      ${players.length ? `<select data-showto><option value="">Solo a…</option>${players.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select>` : ""}
      ${e.img ? `<button class="btn small" data-showimg>Mostrar solo la imagen</button><button class="btn small" data-bg>${s.backdrop === e.img ? "✓ Fondo de la escena" : "Usar de fondo"}</button>` : ""}
      ${shown || (s.backdrop && s.backdrop === e.img) ? `<button class="btn small" data-retire>Retirar de la mesa</button>` : ""}
      ${e.kind === "event" ? Object.entries(EVENT_STATUS).map(([k, n]) => `<button class="btn small st" data-status="${k}" aria-pressed="${e.status === k}">${n}</button>`).join("") : ""}</div>`;
  const kindMeta = { npc: dm ? `<input data-ef="role" value="${esc(e.role || "")}" placeholder="Quién es (oficio, cargo…)">` : e.role ? `<span>${esc(e.role)}</span>` : "",
    event: dm ? `<select data-ef="etype">${Object.entries(EVENT_TYPES).map(([k, n]) => `<option value="${k}" ${e.etype === k ? "selected" : ""}>${n}</option>`).join("")}</select>` : "",
    chapter: dm ? `<select data-ef="session"><option value="">Próxima sesión</option>${[liveSession(s), ...pastSessions(s)].filter(Boolean).map(x => `<option value="${x.id}" ${e.session === x.id ? "selected" : ""}>${esc(sessionName(x))}${x.status === "open" ? " (en curso)" : ""}</option>`).join("")}</select>` : "" }[e.kind] || "";
  return `<div class="lpage"><nav class="crumbs"><a href="#lore">Lore</a> › <a href="#lore/s:${e.kind}">${LORE[e.kind].pl}</a>${pl ? ` · en <a href="#lore/${pl.id}">${esc(pl.name)}</a>` : ""}</nav>
    <div class="lentry">${imgBox}<div class="lbody">
      <header class="lhead">${dm ? `<input class="h1" data-ef="name" value="${esc(e.name)}" aria-label="Nombre">` : `<div class="eyebrow">${esc(LORE[e.kind].n.toUpperCase())}</div><h1>${esc(e.name)}</h1>`}
        <div class="row lmeta">${kindMeta}
          ${dm ? `<label>Lugar <select data-ef="place"><option value="">—</option>${s.world.places.map(p => `<option value="${p.id}" ${p.id === e.place ? "selected" : ""}>${esc(placePath(s, p.id).map(x => x.name).join(" › "))}</option>`).join("")}</select></label>` : ""}
          ${dm && e.kind !== "note" && e.kind !== "chapter" ? `<label class="switch"><input type="checkbox" data-rev ${e.revealed ? "checked" : ""}> Revelado a los jugadores</label>` : ""}</div>
      </header>
      ${tools}
      ${e.kind === "note" || e.kind === "chapter" ? (dm ? `<label class="lsecret solo"><span>${e.kind === "chapter" ? "Qué preparar: material, descripciones, ideas" : "Apuntes"}</span><textarea data-ef="secret" rows="8">${esc(e.secret || "")}</textarea></label>` : "")
        : twoCols(dm, e.summary, e.secret, "ef", e.kind === "event" ? "Lo que ven los jugadores cuando ocurre" : "Descripción pública")}
      ${e.kind === "event" ? (dm ? `<label class="lpub"><span>Acciones posibles (una por línea)</span><textarea data-ef="actions" rows="4">${esc(e.actions || "")}</textarea></label>` : "") : ""}
      ${relHTML}
      ${dm ? `<div class="row ldanger"><button class="btn small danger" data-del>Eliminar</button></div>` : ""}
    </div></div></div>`;
}

/* ---------- Preparar sesión: la carpeta de escenas ---------- */
function prepPage(s, dm) {
  const live = liveSession(s), chaps = loreOf(s).filter(e => e.kind === "chapter").sort((a, b) => (a.order || 0) - (b.order || 0));
  const groups = [[live ? live.id : "__none", live ? `${sessionName(live)} · en curso` : null], ["", "Próxima sesión"], ...pastSessions(s).map(x => [x.id, `${sessionName(x)} · ${x.title || ""}`])];
  const html = groups.filter(([, n]) => n).map(([id, n]) => { const l = chaps.filter(c => (c.session || "") === id); if (!l.length && id !== "") return "";
    return `<h3 class="lsec">${esc(n)}</h3><ol class="lprep">${l.map((c, i) => { const pl = c.place && placeOf(s, c.place);
      return `<li><a href="#lore/${c.id}"><b>${esc(c.name)}</b>${pl ? `<small>📍 ${esc(pl.name)}</small>` : ""}</a><span class="lchips">${related(s, c.id).map(r => { const x = refName(s, r); return `<span class="lchip">${x.icon} ${esc(x.name)}</span>`; }).join("")}</span>
        <span class="lord"><button class="btn small" data-mv="${c.id}|-1" ${i ? "" : "disabled"} aria-label="Subir">↑</button><button class="btn small" data-mv="${c.id}|1" ${i < l.length - 1 ? "" : "disabled"} aria-label="Bajar">↓</button></span></li>`; }).join("")}</ol>
      ${id === "" || (live && id === live.id) ? `<button class="btn small gold" data-new="chapter" data-ses="${id === "__none" ? "" : id}">+ Escena</button>` : ""}`; }).join("");
  return `<div class="lpage"><header class="lhead"><div class="eyebrow">SOLO MÁSTER</div><h1>📂 Preparar sesión</h1>
    <p class="lsub">Una carpeta de escenas: el orden es tu guion, no un camino obligatorio. Enlaza a cada escena sus lugares, personajes, eventos, imágenes y combates para tenerlo todo a un clic.</p></header>${html}</div>`;
}

/* ---------- Sesiones jugadas ---------- */
function sessionsPage(s, dm) {
  const list = pastSessions(s);
  return `<div class="lpage"><header class="lhead"><div class="eyebrow">CRÓNICA</div><h1>📜 Sesiones</h1><p class="lsub">${dm ? "Corrige el título, la fecha, el resumen o los PX de cualquier sesión, o elimínala." : "Lo que habéis jugado."}</p></header>
    <div class="lses">${list.map(x => `<a class="lsescard" href="#lore/ses:${x.id}"><b>${esc(sessionName(x))}</b><span>${esc(x.title || "")}</span><small>${esc(x.date || "")}</small><p>${esc((x.recap || "").slice(0, 180))}${(x.recap || "").length > 180 ? "…" : ""}</p></a>`).join("") || `<p class="empty">Aún no se ha cerrado ninguna sesión.</p>`}</div></div>`;
}
function sessionPage(s, id, dm) {
  const x = s.sessions.find(y => y.id === id); if (!x) return `<div class="lpage"><p class="empty">Esa sesión ya no existe.</p></div>`;
  const notes = (s.chronicle || []).filter(c => c.session === id);
  if (!dm) return `<div class="lpage"><nav class="crumbs"><a href="#lore/s:sessions">Sesiones</a></nav><header class="lhead"><div class="eyebrow">${esc(sessionName(x).toUpperCase())} · ${esc(x.date || "")}</div><h1>${esc(x.title)}</h1></header><div class="lbook"><p>${esc(x.recap || "").replace(/\n/g, "<br>")}</p></div></div>`;
  return `<div class="lpage"><nav class="crumbs"><a href="#lore/s:sessions">Sesiones</a> › ${esc(sessionName(x))}</nav>
    <header class="lhead"><input class="h1" data-sf="title" value="${esc(x.title || "")}" aria-label="Título"><div class="row lmeta"><label>Fecha <input type="date" data-sf="date" value="${esc(x.date || "")}"></label></div></header>
    <label class="lpub"><span>Resumen (el «Anteriormente…»)</span><textarea data-sf="recap" rows="8">${esc(x.recap || "")}</textarea></label>
    <h3 class="lsec">Experiencia repartida</h3>
    <div class="lxp">${(x.xp || []).map((l, i) => `<div class="xpgrid"><span>${esc(l.name || "")}</span><input type="number" min="0" data-xpa="${i}" value="${l.amount || 0}" aria-label="PX"><input data-xpr="${i}" value="${esc(l.reason || "")}" placeholder="Motivo"></div>`).join("") || `<p class="empty">No se repartieron PX.</p>`}</div>
    <p class="note">Si cambias los PX, la ficha del personaje se ajusta en la diferencia.</p>
    <h3 class="lsec">Crónica de la sesión</h3><p class="empty">${notes.length} nota${notes.length === 1 ? "" : "s"} del grupo. <a href="#cronica">Ver la crónica</a></p>
    <div class="row ldanger"><label class="switch"><input type="checkbox" id="undoxp"> Restar también los PX que dio</label><button class="btn small danger" data-delses>Eliminar sesión</button></div></div>`;
}

/* ---------- Acciones ---------- */
function bindPage(s, t, dm) {
  $$("[data-new]", el).forEach(b => b.onclick = () => {
    const extra = {}; if (b.dataset.at) extra.place = b.dataset.at; if (b.dataset.ses != null && b.dataset.new === "chapter") extra.session = b.dataset.ses || null;
    go(newEntry(b.dataset.new, extra));
  });
  $$("[data-newplace]", el).forEach(b => b.onclick = () => {
    const id = uid("lugar"), parent = b.dataset.newplace || null, par = parent && placeOf(store.get(), parent);
    store.commit("place", st => st.world.places.push({ id, name: "Nuevo lugar", kind: par ? (par.kind === "Ciudad" || par.kind === "Pueblo" ? "Distrito" : "Localización") : "Ciudad", parent, x: 0.5, y: 0.5, visible: false, summary: "", secret: "", items: [] }));
    go(id);
  });
  $$("[data-loadscene]", el).forEach(b => b.onclick = () => { loadScene(b.dataset.loadscene); toast("Escena cargada en la mesa. Ábrela en la Partida."); });
  if (!dm || !t) return;
  // Lugar
  const p = placeOf(s, t);
  if (p) {
    const save = debounce((f, v) => store.commit("field", st => { placeOf(st, p.id)[f] = v; }), 300);
    $$("[data-pf]", el).forEach(i => {
      if (i.tagName === "SELECT") i.onchange = () => store.commit("place", st => { placeOf(st, p.id)[i.dataset.pf] = i.value || null; });
      else i.addEventListener("input", () => save(i.dataset.pf, i.value));
    });
    const v = $("[data-pvis]", el); if (v) v.onchange = () => store.commit("place", st => { placeOf(st, p.id).visible = v.checked; });
    const sp = $("[data-showplace]", el); if (sp) sp.onclick = () => store.commit("present", st => { const x = placeOf(st, p.id); x.visible = true; st.presentation = { type: "place", place: p.id }; toast("Lo ven todos en la Partida"); });
    confirmBtn($("[data-delplace]", el), () => { const par = p.parent; store.commit("place", st => { st.world.places = st.world.places.filter(x => x.id !== p.id); st.world.places.forEach(x => { if (x.parent === p.id) x.parent = par || null; }); (st.lore || []).forEach(e => { if (e.place === p.id) e.place = par || null; }); }); go(par || ""); });
    return;
  }
  // Sesión
  if (t.startsWith("ses:")) {
    const id = t.slice(4), save = debounce((f, v) => editSession(id, { [f]: v }), 300);
    $$("[data-sf]", el).forEach(i => i.addEventListener("input", () => save(i.dataset.sf, i.value)));
    $$("[data-xpa]", el).forEach(i => i.onchange = () => editXP(id, +i.dataset.xpa, Math.max(0, +i.value || 0)));
    $$("[data-xpr]", el).forEach(i => i.addEventListener("input", debounce(() => editXP(id, +i.dataset.xpr, +$(`[data-xpa="${i.dataset.xpr}"]`, el).value || 0, i.value), 400)));
    confirmBtn($("[data-delses]", el), () => { deleteSession(id, $("#undoxp", el).checked); go("s:sessions"); toast("Sesión eliminada"); });
    return;
  }
  if (t === "s:chapter") {
    $$("[data-mv]", el).forEach(b => b.onclick = () => { const [id, d] = b.dataset.mv.split("|"); moveChapter(id, +d); });
    return;
  }
  // Entrada
  const e = entry(s, t); if (!e) return;
  const save = debounce((f, v) => setEntry(e.id, { [f]: v }, "field"), 300);
  $$("[data-ef]", el).forEach(i => {
    if (i.tagName === "SELECT") i.onchange = () => setEntry(e.id, { [i.dataset.ef]: i.value || null });
    else i.addEventListener("input", () => save(i.dataset.ef, i.value));
  });
  const rev = $("[data-rev]", el); if (rev) rev.onchange = () => setEntry(e.id, { revealed: rev.checked });
  const lk = $("[data-link]", el); if (lk) lk.onchange = () => lk.value && link(e.id, lk.value);
  $$("[data-unlink]", el).forEach(b => b.onclick = () => unlink(e.id, b.dataset.unlink));
  $$("[data-showref]", el).forEach(b => b.onclick = () => { showEntry(b.dataset.showref); toast("Lo ven todos en la Partida"); });
  const sh = $("[data-show]", el); if (sh) sh.onclick = () => { showEntry(e.id); toast("Lo ven todos en la Partida"); };
  const st = $("[data-showto]", el); if (st) st.onchange = () => { if (!st.value) return; showEntry(e.id, { to: st.value }); toast("Solo lo ve " + (s.users.find(u => u.id === st.value) || {}).name); };
  const si = $("[data-showimg]", el); if (si) si.onclick = () => showEntry(e.id, { imageOnly: true });
  const bg = $("[data-bg]", el); if (bg) bg.onclick = () => setBackdrop(s.backdrop === e.img ? null : e.img);
  const rt = $("[data-retire]", el); if (rt) rt.onclick = () => store.commit("present", st2 => { if (st2.presentation && st2.presentation.id === e.id) st2.presentation = null; if (st2.backdrop === e.img) st2.backdrop = null; });
  $$("[data-status]", el).forEach(b => b.onclick = () => setEntry(e.id, { status: b.dataset.status }));
  const up = $("[data-upimg]", el); if (up) up.onclick = async () => {
    const f = await pickFile(); if (!f) return;
    try { const r = await readImageFile(f, 1800), key = uid("img"); await putImage(key, r.dataURL); setEntry(e.id, x => ({ img: key, name: e.kind === "image" && /nueva$/.test(x.name) ? f.name.replace(/\.[^.]+$/, "") : x.name })); }
    catch (err) { toast("No se pudo cargar la imagen. Prueba con un JPG o PNG."); }
  };
  const ni = $("[data-noimg]", el); if (ni) ni.onclick = () => setEntry(e.id, { img: null });
  confirmBtn($("[data-del]", el), () => { const k = e.kind, pl = e.place; removeEntry(e.id); go(pl ? pl : "s:" + k); });
}
function confirmBtn(b, fn) { if (b) b.onclick = () => { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Pulsa otra vez para confirmar"; return; } fn(); }; }
function moveChapter(id, d) {
  store.commit("lore", s => {
    const c = entry(s, id), l = loreOf(s).filter(e => e.kind === "chapter" && (e.session || "") === (c.session || "")).sort((a, b) => (a.order || 0) - (b.order || 0));
    const i = l.indexOf(c), j = i + d; if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]]; l.forEach((x, k) => { x.order = k; });
  });
}
async function fillImages() {
  for (const b of $$("[data-img]", el)) { const url = await getImage(b.dataset.img); if (url && b.isConnected) { b.style.backgroundImage = `url('${url}')`; b.classList.add("ok"); } }
}
