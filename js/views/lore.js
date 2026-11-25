// Lore: el libro de campaña. El máster crea y edita lugares (región › ciudad › distrito › localización),
// personajes, facciones, eventos, galería, notas, la preparación de la sesión y las sesiones jugadas.
// Los jugadores ven lo mismo, pero solo lo que se les ha revelado y sin secretos.
import { combatHTML, bindCombat } from "./pnjficha.js";
import { store, uid } from "../core/store.js";
import { isDM, currentUser } from "../core/session.js";
import { LORE, EVENT_TYPES, EVENT_STATUS, PLACE_KINDS, loreOf, entry, placeOf, canSee, refName, related, placePath, childrenOf, descendants,
  newEntry, setEntry, removeEntry, link, unlink, showEntry, setBackdrop, timeline, tellTimeline, clockOf, clockText, advanceClock,
  MAIN_TL, tlinesOf, inTimeline, presenceOf } from "../core/lore.js";
import { regionsOf, regionById, placesIn, editRegion } from "../core/regiones.js";
import { addFuture } from "../core/mando.js";
import { pastSessions, liveSession, sessionName, editSession, editXP, deleteSession } from "../core/sesiones.js";
import { loadScene } from "../core/mesa.js";
import { getImage, putImage, readImageFile } from "../core/images.js";
import { $, $$, esc, toast, debounce, pickFile } from "../core/ui.js";
import { VITAL, STANCE, fieldsOf, badges, markChange, changesOf, changeText } from "../core/contexto.js";

let el = null, q = "";
// Hito 102: el orden que pidió el máster, en tres grupos (null = separador). Las Notas pasan a Mando.
const SECTIONS = [["places", "📍", "Lugares"], ["npc"], ["faction"], ["god"], ["event"], null, ["hist"], ["battle"], null, ["image"], ["chapter", , , true], ["sessions", "📜", "Sesiones"]];
const sec = k => { const x = SECTIONS.find(s => s && s[0] === k); return x && LORE[k] ? [k, LORE[k].icon, LORE[k].pl, x[3]] : x; };

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
  const count = k => k === "places" ? s.world.places.filter(p => dm || p.visible).length : k === "hist" ? timeline(s).length : k === "sessions" ? pastSessions(s).length : loreOf(s).filter(e => e.kind === k && canSee(s, e)).length;
  const active = t.startsWith("s:") ? t.slice(2) : t.startsWith("ses:") ? "sessions" : t.startsWith("tl:") ? "hist" : t.startsWith("reg:") || placeOf(s, t) ? "places" : (entry(s, t) || {}).kind || (t ? "" : "places");
  migrateNotes(s, dm);
  el.innerHTML = `<aside class="lnav">
      <input type="search" id="lq" placeholder="Buscar en el lore…" value="${esc(q)}">
      ${q.length > 1 ? searchResults(s) : `<nav>${SECTIONS.map(x => x ? sec(x[0]) : null).filter(x => !x || dm || !x[3]).map(x => !x ? `<hr class="lsep">` : (([k, ic, n]) => `<a href="#lore/s:${k}" class="${active === k ? "on" : ""}"><span>${ic}</span>${n}<small>${count(k)}</small></a>`)(x)).join("")}</nav>
      <div class="ltree"><h4>Mapa del lore</h4>${worldTree(s)}</div>`}
      ${clockBox(s, dm)}
    </aside>
    <section class="lmain">${page(s, t, dm)}</section>`;
  bindNav(s, dm);
  bindPage(s, t, dm);
  fillImages();
}

/* ---------- Navegación ---------- */
const seeReg = (s, r) => isDM(s) || r.visible;
/** Regiones del mapa del mundo como primer nivel del Lore; dentro, sus lugares. */
function worldTree(s) {
  const regs = regionsOf(s).filter(r => seeReg(s, r)), inReg = new Set(regs.flatMap(r => placesIn(s, r).map(p => p.id)));
  const loose = childrenOf(s, null).filter(p => (isDM(s) || p.visible) && !inReg.has(p.id));
  const li = p => `<li><a href="#lore/${p.id}" class="${target() === p.id ? "on" : ""}${p.visible ? "" : " hid"}">${esc(p.name)}<small>${esc(p.kind || "")}</small></a>${tree(s, p.id, 1)}</li>`;
  if (!regs.length && !loose.length) return `<p class="empty">Sin lugares. Créalos en el mapa o aquí.</p>`;
  return `<ul>${regs.map(r => `<li><a href="#lore/reg:${r.id}" class="${target() === "reg:" + r.id ? "on" : ""}${r.visible ? "" : " hid"}">🗺 ${esc(r.name || "Región")}<small>Región</small></a><ul>${placesIn(s, r).filter(p => isDM(s) || p.visible).map(li).join("")}</ul></li>`).join("")}${loose.map(li).join("")}</ul>`;
}
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
  if (t.startsWith("tl:")) return timelinePage(s, dm, t.slice(3));
  if (t.startsWith("reg:")) { const r = regionById(s, t.slice(4)); if (r && seeReg(s, r)) return regionPage(s, r, dm); }
  const p = placeOf(s, t); if (p && (dm || p.visible)) return placePage(s, p, dm);
  const e = entry(s, t); if (e && canSee(s, e)) return entryPage(s, e, dm);
  return `<div class="lpage"><p class="empty">No se encuentra (o aún no os lo han revelado).</p></div>`;
}

const thumb = (key, cls = "") => key ? `<div class="lthumb ${cls}" data-img="${esc(key)}"></div>` : "";
function card(s, e) {
  const pl = e.place ? placeOf(s, e.place) : null;
  const sub = e.kind === "npc" || e.kind === "god" || e.kind === "battle" ? e.role || (pl ? pl.name : "") : e.kind === "event" ? `${EVENT_TYPES[e.etype] || ""} · ${EVENT_STATUS[e.status] || ""}` : e.kind === "hist" ? e.date || "" : pl ? pl.name : "";
  return `<a class="lcard k-${e.kind}${e.kind === "event" ? " st-" + e.status : ""}" href="#lore/${e.id}">${thumb(e.img)}<span class="li">${LORE[e.kind].icon}</span><b>${esc(e.name)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}${isDM(s) ? badges(e) : ""}${isDM(s) && !e.revealed && e.kind !== "note" && e.kind !== "chapter" ? `<i class="lock" title="Oculto a los jugadores">🔒</i>` : ""}</a>`;
}
const placeCard = (s, p) => `<a class="lcard k-place" href="#lore/${p.id}"><span class="li">📍</span><b>${esc(p.name)}</b><small>${esc(p.kind || "")}${childrenOf(s, p.id).length ? ` · ${childrenOf(s, p.id).length} dentro` : ""}</small>${isDM(s) && !p.visible ? `<i class="lock">🔒</i>` : ""}</a>`;

const regCard = (s, r) => `<a class="lcard k-place" href="#lore/reg:${r.id}"><span class="li">🗺</span><b>${esc(r.name || "Región")}</b><small>Región · ${placesIn(s, r).filter(p => isDM(s) || p.visible).length} lugares</small>${isDM(s) && !r.visible ? `<i class="lock">🔒</i>` : ""}</a>`;
function placesHome(s, dm) {
  const regs = regionsOf(s).filter(r => seeReg(s, r)), inReg = new Set(regs.flatMap(r => placesIn(s, r).map(p => p.id)));
  const top = childrenOf(s, null).filter(p => (dm || p.visible) && !inReg.has(p.id));
  return `<div class="lpage"><header class="lhead"><div class="eyebrow">LIBRO DEL MUNDO</div><h1>${esc(s.campaign.name)}</h1>
      <p class="lsub">${dm ? "Todo lo que creas aquí queda a mano durante la partida. Los jugadores solo ven lo que reveles." : "Lo que sabéis del mundo. El máster os irá revelando más."}</p></header>
    ${regs.length ? `<h3 class="lsec">🗺 Regiones</h3><div class="lgrid">${regs.map(r => regCard(s, r)).join("")}</div>` : ""}
    <h3 class="lsec">📍 ${regs.length ? "Lugares sin región" : "Lugares"}</h3><div class="lgrid">${top.map(p => placeCard(s, p)).join("") || `<p class="empty">${regs.length ? "Todos están dentro de alguna región." : "Aún no hay lugares."}</p>`}</div>
    ${dm ? `<div class="row"><button class="btn gold small" data-newplace="">+ Lugar</button><a class="btn small" href="#mundo">Colocar en el mapa del mundo</a></div>` : ""}
    ${["npc", "faction", "god", "event"].map(k => { const l = loreOf(s).filter(e => e.kind === k && canSee(s, e)).slice(0, 8); return l.length ? `<h3 class="lsec"><a href="#lore/s:${k}">${LORE[k].icon} ${LORE[k].pl}</a></h3><div class="lgrid">${l.map(e => card(s, e)).join("")}</div>` : ""; }).join("")}</div>`;
}

function listPage(s, k, dm) {
  if (!LORE[k]) return "";
  if (k === "hist") return timelinePage(s, dm);
  const list = loreOf(s).filter(e => e.kind === k && canSee(s, e));
  return `<div class="lpage"><header class="lhead"><div class="eyebrow">LORE</div><h1>${LORE[k].icon} ${LORE[k].pl}</h1><p class="lsub">${LORE[k].hint}</p></header>
    ${dm ? `<div class="row"><button class="btn gold small" data-new="${k}">+ ${LORE[k].n}</button></div>` : ""}
    <div class="lgrid">${list.map(e => card(s, e)).join("") || `<p class="empty">${dm ? "Todavía nada. Crea el primero." : "Aún no os han revelado nada."}</p>`}</div></div>`;
}

/* ---------- Cronología: la historia del mundo en una línea que se desliza ---------- */
function timelinePage(s, dm, tl = MAIN_TL) {
  const tls = tlinesOf(s).filter(x => canSee(s, x)), cur = tl === MAIN_TL ? null : tls.find(x => x.id === tl);
  if (tl !== MAIN_TL && !cur) tl = MAIN_TL;
  const list = timeline(s, false, tl), live = s.presentation && s.presentation.type === "timeline" ? s.presentation.id : null;
  const tabs = `<div class="tltabs"><a href="#lore/s:hist" class="${tl === MAIN_TL ? "on" : ""}">🌍 Historia del mundo</a>${tls.map(x => `<a href="#lore/tl:${x.id}" class="${tl === x.id ? "on" : ""}${x.revealed ? "" : " hid"}">🧭 ${esc(x.name)}</a>`).join("")}${dm ? `<button class="btn small" data-newtl>+ Cronología</button>` : ""}</div>
    ${dm && cur ? `<div class="row tledit"><input data-tlname="${cur.id}" value="${esc(cur.name)}" aria-label="Nombre de la cronología"><label class="switch"><input type="checkbox" data-tlrev="${cur.id}" ${cur.revealed ? "checked" : ""}> La ven los jugadores</label><button class="btn small danger" data-tldel="${cur.id}">Eliminar cronología</button></div>` : ""}`;
  let lastEra = null;
  const items = list.map((e, i) => {
    const era = e.era && e.era !== lastEra ? `<div class="tlera"><span>${esc(e.era)}</span></div>` : ""; lastEra = e.era || lastEra;
    return `${era}<article class="tli${live === e.id ? " now" : ""}${!e.revealed ? " hid" : ""}" data-tl="${e.id}">
      <div class="tldate">${esc(e.date || (e.year != null && e.year !== "" ? "Año " + e.year : ""))}</div><i class="tldot"></i>
      <a class="tlcard k-${e.kind}" href="#lore/${e.id}" draggable="false">${e.img ? `<div class="lthumb tlimg" data-img="${esc(e.img)}"></div>` : `<div class="tlimg none">${LORE[e.kind].icon}</div>`}${e.kind !== "hist" ? `<em class="tlkind">${LORE[e.kind].icon} ${LORE[e.kind].n}</em>` : ""}
        <b>${esc(e.name)}</b>${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${dm && !e.revealed ? `<i class="lock" title="Los jugadores aún no lo conocen">🔒</i>` : ""}</a>
      ${dm ? `<button class="btn small tltell" data-tell="${e.id}" title="Contarlo en la mesa (lo revela)">${live === e.id ? "✓ En la mesa" : "▶ Contar"}</button>` : ""}</article>`;
  }).join("");
  return `<div class="lpage tlpage"><header class="lhead"><div class="eyebrow">LORE</div><h1>${LORE.hist.icon} ${cur ? esc(cur.name) : "Cronologías"}</h1>
      <p class="lsub">${dm ? "Cuenta la historia hito a hito. Las batallas y los dioses con fecha entran solos. Lo que cuentes en la mesa queda revelado para los jugadores." : "La historia, hasta donde la conocéis. Desliza para recorrerla."}</p></header>
    ${tabs}
    ${dm ? `<div class="row"><button class="btn gold small" data-new="hist"${cur ? ` data-tl="${cur.id}"` : ""}>+ Hito</button>${list.length ? `<button class="btn small" data-tell="${list[0].id}">▶ Contar desde el principio</button>` : ""}${live ? `<button class="btn small" data-tellstop>Quitar de la mesa</button>` : ""}</div>` : ""}
    ${list.length ? `<div class="tlwrap"><button class="tlnav l" data-tlscroll="-1" aria-label="Anterior">‹</button>
      <div class="tl" tabindex="0" aria-label="Línea temporal">${items}</div>
      <button class="tlnav r" data-tlscroll="1" aria-label="Siguiente">›</button></div>`
      : `<p class="empty">${dm ? "Aún no hay hitos. Crea el primero: la fundación, una guerra antigua, la caída de un reino…" : "Aún no os han contado nada de la historia del mundo."}</p>`}</div>`;
}
/** Deslizar la línea: arrastrando con el ratón, con la rueda o con las flechas. */
let drag = null, dragMoved = false, dragWired = false;
function bindTimeline() {
  const tl = $(".tl", el); if (!tl) return;
  $$("[data-tlscroll]", el).forEach(b => b.onclick = () => tl.scrollBy({ left: +b.dataset.tlscroll * tl.clientWidth * 0.8, behavior: "smooth" }));
  tl.addEventListener("wheel", ev => { if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) { tl.scrollLeft += ev.deltaY; ev.preventDefault(); } }, { passive: false });
  tl.addEventListener("pointerdown", ev => { if (ev.pointerType !== "mouse" || ev.target.closest("button")) return; drag = { tl, x0: ev.clientX, sl: tl.scrollLeft, moved: false }; tl.classList.add("drag"); });
  tl.addEventListener("click", ev => { if (dragMoved) { ev.preventDefault(); ev.stopPropagation(); dragMoved = false; } }, true);
  if (!dragWired) { dragWired = true;
    window.addEventListener("pointermove", ev => { if (!drag) return; const d = ev.clientX - drag.x0; if (Math.abs(d) > 5) drag.moved = true; drag.tl.scrollLeft = drag.sl - d; });
    window.addEventListener("pointerup", () => { if (!drag) return; dragMoved = drag.moved; drag.tl.classList.remove("drag"); drag = null; }); }
  tl.onkeydown = ev => { if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") tl.scrollBy({ left: (ev.key === "ArrowRight" ? 1 : -1) * 300, behavior: "smooth" }); };
  const now = $(".tli.now", el); if (now) tl.scrollLeft = now.offsetLeft - tl.clientWidth / 2 + now.offsetWidth / 2;
}

/* ---------- Hito 102: presencia de los dioses (en un lugar o una región) ---------- */
function presenceHTML(s, x, dm, kind) {
  const rows = presenceOf(s, x), gods = loreOf(s).filter(e => e.kind === "god" && canSee(s, e)), tot = rows.reduce((a, r) => a + r.pct, 0);
  if (!dm && !rows.length) return "";
  const bar = rows.length ? `<div class="lpres-bar">${rows.map(r => `<span style="flex:${r.pct}" title="${esc(r.god.name)} · ${r.pct} %"></span>`).join("")}${tot < 100 ? `<span class="none" style="flex:${100 - tot}" title="Sin culto · ${100 - tot} %"></span>` : ""}</div>` : "";
  return `<h3 class="lsec">☀ Presencia de los dioses</h3>${bar}
    <table class="lpres">${rows.map(r => `<tr><td><a href="#lore/${r.god.id}">${esc(r.god.name)}</a></td><td>${dm ? `<input type="number" min="0" max="100" data-pres="${kind}|${r.god.id}" value="${r.pct}"> %` : `${r.pct} %`}</td></tr>`).join("")}
      <tr class="none"><td>Sin culto o no creyentes</td><td>${Math.max(0, 100 - tot)} %</td></tr></table>
    ${dm ? `<div class="row">${gods.filter(g => !rows.some(r => r.god.id === g.id)).length ? `<select data-presadd="${kind}"><option value="">+ Dios con presencia aquí…</option>${gods.filter(g => !rows.some(r => r.god.id === g.id)).map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select>` : gods.length ? "" : `<span class="note">Crea primero algún dios en Dioses.</span>`}${tot > 100 ? `<span class="note warn">Suma ${tot} %: pasa de 100.</span>` : ""}</div>` : ""}`;
}
function regionPage(s, r, dm) {
  const pls = placesIn(s, r).filter(p => dm || p.visible), ids = pls.flatMap(p => [p.id, ...descendants(s, p.id)]);
  const of = k => loreOf(s).filter(e => e.kind === k && ids.includes(e.place) && canSee(s, e));
  const block = k => { const l = of(k); return l.length ? `<h3 class="lsec">${LORE[k].icon} ${LORE[k].pl}</h3><div class="lgrid">${l.map(e => card(s, e)).join("")}</div>` : ""; };
  return `<div class="lpage"><nav class="crumbs"><a href="#lore">Lore</a> › <a href="#lore/s:places">Mundo</a> › ${esc(r.name || "Región")}</nav>
    <header class="lhead"><div class="eyebrow">REGIÓN</div><h1>🗺 ${esc(r.name || "Región")}</h1>${r.summary ? `<p class="lsub">${esc(r.summary)}</p>` : ""}</header>
    ${dm ? `<div class="ltools"><a class="btn small" href="#mundo">Ver en el mapa del mundo</a></div>` : ""}
    <h3 class="lsec">📍 Lugares</h3><div class="lgrid">${pls.map(p => placeCard(s, p)).join("") || `<p class="empty">${dm ? "Coloca lugares dentro de la región en el mapa del mundo." : "Nada más que sepáis."}</p>`}</div>
    ${presenceHTML(s, r, dm, "reg:" + r.id)}
    ${block("npc")}${block("faction")}${block("event")}${block("battle")}</div>`;
}

/* ---------- Un lugar: sus capas de información ---------- */
function placePage(s, p, dm) {
  const path = placePath(s, p.id), here = [p.id, ...descendants(s, p.id)];
  const of = k => loreOf(s).filter(e => e.kind === k && here.includes(e.place) && canSee(s, e));
  const kids = childrenOf(s, p.id).filter(c => dm || c.visible), scenes = (s.scenes || []).filter(x => x.place === p.id);
  const block = (k, extra = "") => { const l = of(k); if (!dm && !l.length) return ""; return `<h3 class="lsec">${LORE[k].icon} ${LORE[k].pl}</h3><div class="lgrid">${l.map(e => card(s, e)).join("") || `<p class="empty">Nada todavía.</p>`}${dm ? `<button class="lcard add" data-new="${k}" data-at="${p.id}">+ ${LORE[k].n}</button>` : ""}</div>${extra}`; };
  const reg = path.length ? regionsOf(s).find(r => placesIn(s, r).some(x => x.id === path[0].id)) : null;
  return `<div class="lpage"><nav class="crumbs"><a href="#lore">Lore</a> › <a href="#lore/s:places">Mundo</a>${reg && seeReg(s, reg) ? ` › <a href="#lore/reg:${reg.id}">${esc(reg.name || "Región")}</a>` : ""}${path.map(x => ` › <a href="#lore/${x.id}">${esc(x.name)}</a>`).join("")}</nav>
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
    ${presenceHTML(s, p, dm, p.id)}
    ${block("npc")}${block("faction")}${block("battle")}${block("event")}${block("image")}
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
  const pl = e.place ? placeOf(s, e.place) : null, rel = related(s, e.id), players = s.users.filter(u => u.role === "player" || s.characters.some(c => c.owner === u.id));
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
      ${e.kind === "hist" ? `<button class="btn small" data-tell="${e.id}">▶ Contar en la mesa</button><a class="btn small" href="#lore/s:hist">⏳ Ver en la cronología</a>` : ""}
      ${e.kind === "event" ? Object.entries(EVENT_STATUS).map(([k, n]) => `<button class="btn small st" data-status="${k}" aria-pressed="${e.status === k}">${n}</button>`).join("") : ""}</div>`;
  const roleIn = ph => dm ? `<input data-ef="role" value="${esc(e.role || "")}" placeholder="${ph}">` : e.role ? `<span>${esc(e.role)}</span>` : "";
  const dateIn = dm ? `<input data-ef="date" value="${esc(e.date || "")}" placeholder="Fecha que se lee (p. ej. Año 312)" style="min-width:190px"><label>Orden <input type="number" data-ef="year" value="${esc(e.year ?? "")}" style="width:80px" title="Un número para colocarlo en la cronología (vacío = no sale)"></label>` : e.date ? `<span>${esc(e.date)}</span>` : "";
  const kindMeta = { npc: roleIn("Quién es (oficio, cargo…)"), god: roleIn("Dominio y símbolo (p. ej. Luz y sol · un disco dorado)") + dateIn, battle: roleIn("Guerra o campaña (opcional)") + dateIn,
    hist: dm ? `<input data-ef="date" value="${esc(e.date || "")}" placeholder="Fecha que se lee (p. ej. Año 312 de la Corona)" style="min-width:240px"><label>Orden <input type="number" data-ef="year" value="${esc(e.year ?? "")}" style="width:90px" title="Un número para colocarlo en la línea (año, siglo…)"></label><input data-ef="era" value="${esc(e.era || "")}" placeholder="Época (opcional)">` : `<span>${esc([e.date, e.era].filter(Boolean).join(" · "))}</span>`,
    event: dm ? `<select data-ef="etype">${Object.entries(EVENT_TYPES).map(([k, n]) => `<option value="${k}" ${e.etype === k ? "selected" : ""}>${n}</option>`).join("")}</select>` : "",
    chapter: dm ? `<select data-ef="session"><option value="">Próxima sesión</option>${[liveSession(s), ...pastSessions(s)].filter(Boolean).map(x => `<option value="${x.id}" ${e.session === x.id ? "selected" : ""}>${esc(sessionName(x))}${x.status === "open" ? " (en curso)" : ""}</option>`).join("")}</select>` : "" }[e.kind] || "";
  return `<div class="lpage"><nav class="crumbs"><a href="#lore">Lore</a> › <a href="#lore/s:${e.kind}">${LORE[e.kind].pl}</a>${pl ? ` · en <a href="#lore/${pl.id}">${esc(pl.name)}</a>` : ""}</nav>
    <div class="lentry">${imgBox}<div class="lbody">
      <header class="lhead">${dm ? `<input class="h1" data-ef="name" value="${esc(e.name)}" aria-label="Nombre">` : `<div class="eyebrow">${esc(LORE[e.kind].n.toUpperCase())}</div><h1>${esc(e.name)}</h1>`}
        <div class="row lmeta">${kindMeta}
          ${dm && e.kind !== "god" ? `<label>Lugar <select data-ef="place"><option value="">—</option>${s.world.places.map(p => `<option value="${p.id}" ${p.id === e.place ? "selected" : ""}>${esc(placePath(s, p.id).map(x => x.name).join(" › "))}</option>`).join("")}</select></label>` : ""}
          ${dm ? fieldsOf(e.kind).map(f => `<label>${f === "vital" ? "Estado" : "Actitud"} <select data-estate="${f}">${Object.entries(f === "vital" ? VITAL : STANCE).map(([k, [i, n]]) => `<option value="${k}" ${(e[f] || (f === "vital" ? "vivo" : "neutral")) === k ? "selected" : ""}>${i} ${n}</option>`).join("")}</select></label>`).join("") : ""}
          ${dm && e.kind !== "note" && e.kind !== "chapter" ? `<label class="switch"><input type="checkbox" data-rev ${e.revealed ? "checked" : ""}> Revelado a los jugadores</label>` : ""}</div>
      </header>
      ${tools}
      ${e.kind === "note" || e.kind === "chapter" ? (dm ? `<label class="lsecret solo"><span>${e.kind === "chapter" ? "Qué preparar: material, descripciones, ideas" : "Apuntes"}</span><textarea data-ef="secret" rows="8">${esc(e.secret || "")}</textarea></label>` : "")
        : twoCols(dm, e.summary, e.secret, "ef", e.kind === "event" ? "Lo que ven los jugadores cuando ocurre" : "Descripción pública")}
      ${e.kind === "npc" ? npcTiesHTML(s, e, dm) : ""}${e.kind === "faction" ? membersHTML(s, e, "faction") : ""}${e.kind === "god" ? godHTML(s, e, dm) : ""}
      ${e.kind === "battle" ? battleHTML(s, e, dm) : ""}
      ${["hist", "battle", "god"].includes(e.kind) && dm && tlinesOf(s).length ? `<div class="row tlmember"><span>Sale en:</span>${[{ id: MAIN_TL, name: "Historia del mundo" }, ...tlinesOf(s)].map(x => `<label class="switch"><input type="checkbox" data-tlm="${x.id}" ${inTimeline(e, x.id) ? "checked" : ""}> ${esc(x.name)}</label>`).join("")}</div>` : ""}
      ${e.kind === "npc" && dm ? combatHTML(s, e) : ""}
      ${e.kind === "event" ? (dm ? `<label class="lpub"><span>Acciones posibles (una por línea)</span><textarea data-ef="actions" rows="4">${esc(e.actions || "")}</textarea></label>` : "") : ""}
      ${relHTML}
      ${myNotesHTML(s, e, dm)}
      ${dm ? `<div class="row ldanger"><button class="btn small danger" data-del>Eliminar</button></div>` : ""}
    </div></div></div>`;
}

/* ---------- Hito 102: PNJ con facciones y culto; miembros y fieles; batallas con bandos ---------- */
function npcTiesHTML(s, e, dm) {
  const facs = loreOf(s).filter(x => x.kind === "faction" && canSee(s, x)), gods = loreOf(s).filter(x => x.kind === "god" && canSee(s, x));
  const mine = (e.factions || []).map((f, i) => ({ ...f, i, e: entry(s, f.id) })).filter(f => f.e && canSee(s, f.e)), god = e.god ? entry(s, e.god) : null;
  if (!dm && !mine.length && !(god && canSee(s, god))) return "";
  return `<div class="lties"><div><h4>⚑ Facciones</h4>${mine.map(f => `<span class="lchip"><a href="#lore/${f.id}">${esc(f.e.name)}</a>${dm ? `<input data-facrank="${f.i}" value="${esc(f.rank || "")}" placeholder="rango o papel">` : f.rank ? ` · <small>${esc(f.rank)}</small>` : ""}${dm ? `<button data-facdel="${f.i}" aria-label="Quitar">✕</button>` : ""}</span>`).join("") || `<span class="note">Ninguna.</span>`}
      ${dm && facs.length ? `<select data-facadd><option value="">+ Facción…</option>${facs.filter(x => !mine.some(f => f.id === x.id)).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select>` : ""}</div>
    <div><h4>☀ Culto</h4>${dm ? `<select data-ef="god"><option value="">— Ninguno —</option>${gods.map(g => `<option value="${g.id}" ${g.id === e.god ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>` : god && canSee(s, god) ? `<a class="lchip" href="#lore/${god.id}">${esc(god.name)}</a>` : `<span class="note">Ninguno.</span>`}</div></div>`;
}
function membersHTML(s, e) {
  const L = loreOf(s).filter(x => x.kind === "npc" && canSee(s, x) && (x.factions || []).some(f => f.id === e.id));
  return L.length ? `<h3 class="lsec">👤 Miembros</h3><div class="lgrid">${L.map(x => card(s, x).replace("</b>", `</b><small class="rank">${esc(((x.factions || []).find(f => f.id === e.id) || {}).rank || "")}</small>`)).join("")}</div>` : "";
}
function godHTML(s, e, dm) {
  const fol = loreOf(s).filter(x => x.kind === "npc" && x.god === e.id && canSee(s, x));
  const where = [...regionsOf(s).filter(r => seeReg(s, r)).map(r => ({ id: "reg:" + r.id, name: "🗺 " + (r.name || "Región"), pct: +((r.presence || {})[e.id]) || 0 })),
    ...s.world.places.filter(p => dm || p.visible).map(p => ({ id: p.id, name: "📍 " + p.name, pct: +((p.presence || {})[e.id]) || 0 }))].filter(x => x.pct > 0).sort((a, b) => b.pct - a.pct);
  return `<h3 class="lsec">☀ Presencia</h3>${where.length ? `<table class="lpres">${where.map(x => `<tr><td><a href="#lore/${x.id}">${esc(x.name)}</a></td><td><span class="pbar"><i style="width:${x.pct}%"></i></span> ${x.pct} %</td></tr>`).join("")}</table>` : `<p class="note">${dm ? "Aún no tiene presencia en ningún lugar. Se reparte desde cada lugar o región (apartado «Presencia de los dioses»)." : "No sabéis dónde se le rinde culto."}</p>`}
    ${fol.length ? `<h3 class="lsec">🙏 Fieles conocidos</h3><div class="lgrid">${fol.map(x => card(s, x)).join("")}</div>` : ""}`;
}
function battleHTML(s, e, dm) {
  const sides = e.sides || [], opts = loreOf(s).filter(x => (x.kind === "faction" || x.kind === "npc") && canSee(s, x));
  const who = id => { const x = entry(s, id); return x && canSee(s, x) ? x : null; };
  const side = (sd, i) => `<div class="lside"><header>${dm ? `<input data-sidename="${i}" value="${esc(sd.name || "")}" placeholder="Nombre del bando">` : `<b>${esc(sd.name || "Bando")}</b>`}${dm ? `<button class="x" data-sidedel="${i}" aria-label="Quitar bando">✕</button>` : ""}</header>
      <div class="lchips">${[...(sd.factions || []), ...(sd.npcs || [])].map(who).filter(Boolean).map(x => `<span class="lchip"><a href="#lore/${x.id}">${LORE[x.kind].icon} ${esc(x.name)}</a>${dm ? `<button data-sideout="${i}|${x.id}" aria-label="Quitar">✕</button>` : ""}</span>`).join("") || `<span class="note">Sin miembros.</span>`}</div>
      ${dm ? `<select data-sidein="${i}"><option value="">+ Facción o personaje…</option>${opts.map(x => `<option value="${x.id}">${LORE[x.kind].icon} ${esc(x.name)}</option>`).join("")}</select><textarea data-sidenote="${i}" rows="2" placeholder="Fuerzas, mandos, cómo acabó para este bando…">${esc(sd.note || "")}</textarea>` : sd.note ? `<p>${esc(sd.note)}</p>` : ""}</div>`;
  const txt = (f, label, ph) => dm ? `<label class="lpub"><span>${label}</span><textarea data-ef="${f}" rows="3" placeholder="${ph}">${esc(e[f] || "")}</textarea></label>` : e[f] ? `<h3 class="lsec">${label}</h3><div class="lbook"><p>${esc(e[f]).replace(/\n/g, "<br>")}</p></div>` : "";
  return `<h3 class="lsec">⚔ Bandos</h3><div class="lsides">${sides.map(side).join("")}${dm ? `<button class="lcard add" data-sideadd>+ Bando</button>` : ""}</div>
    ${txt("outcome", "Desenlace", "Quién ganó y cómo acabó")}${txt("consequences", "Consecuencias", "Qué cambió en el mundo: territorios, muertes, alianzas…")}`;
}
/** Las Notas del Lore pasan a Mando › Notas de futuro (una vez, sin perder nada). */
function migrateNotes(s, dm) {
  if (!dm) return; const N = loreOf(s).filter(e => e.kind === "note"); if (!N.length) return;
  setTimeout(() => { const L = loreOf(store.get()).filter(e => e.kind === "note"); if (!L.length) return;
    L.forEach(n => addFuture(`${n.name}${n.secret ? ": " + n.secret : ""}`, "idea"));
    store.commit("lore", st => { st.lore = loreOf(st).filter(e => e.kind !== "note"); });
    toast(`Tus ${L.length} notas del Lore están ahora en Mando › Notas de futuro.`); });
}

/* ---------- Notas privadas sobre una entrada (Hito 74): el jugador apunta lo que sabe; solo él y el máster las ven ---------- */
const myChar = s => { const me = currentUser(s); return me && s.characters.find(c => c.owner === me.id); };
function myNotesHTML(s, e, dm) {
  if (dm) { const L = s.characters.filter(c => c.loreNotes && (c.loreNotes[e.id] || "").trim());
    return L.length ? `<div class="lnotes dm"><h3 class="lsec">🔒 Lo que han apuntado los jugadores <small>solo lo ves tú</small></h3>${L.map(c => `<div class="lnote"><b>${esc(c.name.split(" ")[0])}</b><p>${esc(c.loreNotes[e.id])}</p></div>`).join("")}</div>` : ""; }
  const c = myChar(s); if (!c) return "";
  return `<label class="lnotes"><span>🔒 Mis notas <small>(${esc(c.name.split(" ")[0])}) · solo las ves tú y el máster</small></span><textarea data-mynote="${c.id}" rows="4" placeholder="Lo que sabes o sospechas: quién te lo contó, qué no cuadra…">${esc((c.loreNotes || {})[e.id] || "")}</textarea></label>`;
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
    ${changesOf(x).length ? `<h3 class="lsec">Cambios en el mundo</h3><ul class="lchg">${changesOf(x).map(c => `<li><a href="#lore/${c.id}">${esc(changeText(c))}</a></li>`).join("")}</ul>` : ""}
    <h3 class="lsec">Crónica de la sesión</h3><p class="empty">${notes.length} nota${notes.length === 1 ? "" : "s"} del grupo. <a href="#cronica">Ver la crónica</a></p>
    <div class="row ldanger"><label class="switch"><input type="checkbox" id="undoxp"> Restar también los PX que dio</label><button class="btn small danger" data-delses>Eliminar sesión</button></div></div>`;
}

/* ---------- Acciones ---------- */
function bindPage(s, t, dm) {
  bindTimeline();
  $$("[data-tell]", el).forEach(b => b.onclick = ev => { ev.preventDefault(); tellTimeline(b.dataset.tell); toast("En la mesa: ábrela en la Partida para contarlo"); });
  $$("[data-tellstop]", el).forEach(b => b.onclick = () => store.commit("present", st => { st.presentation = null; }));
  $$("[data-new]", el).forEach(b => b.onclick = () => {
    const extra = {}; if (b.dataset.at) extra.place = b.dataset.at; if (b.dataset.tl) extra.tl = [b.dataset.tl]; if (b.dataset.ses != null && b.dataset.new === "chapter") extra.session = b.dataset.ses || null;
    go(newEntry(b.dataset.new, extra));
  });
  $$("[data-newplace]", el).forEach(b => b.onclick = () => {
    const id = uid("lugar"), parent = b.dataset.newplace || null, par = parent && placeOf(store.get(), parent);
    store.commit("place", st => st.world.places.push({ id, name: "Nuevo lugar", kind: par ? (par.kind === "Ciudad" || par.kind === "Pueblo" ? "Distrito" : "Localización") : "Ciudad", parent, x: 0.5, y: 0.5, visible: false, summary: "", secret: "", items: [] }));
    go(id);
  });
  $$("[data-loadscene]", el).forEach(b => b.onclick = () => { loadScene(b.dataset.loadscene); toast("Escena cargada en la mesa. Ábrela en la Partida."); });
  // Notas privadas del jugador sobre esta entrada (Hito 74)
  { const mn = $("[data-mynote]", el), eid = t; if (mn && eid) { let tm = null; mn.oninput = () => { clearTimeout(tm); tm = setTimeout(() => store.commit("field", st => { const c = st.characters.find(x => x.id === mn.dataset.mynote); if (!c) return; c.loreNotes = { ...(c.loreNotes || {}) }; if (mn.value.trim()) c.loreNotes[eid] = mn.value; else delete c.loreNotes[eid]; }), 500); }; } }
  // Hito 102: cronologías con nombre
  { const nt = $("[data-newtl]", el); if (nt) nt.onclick = () => { const id = newEntry("tline"); go("tl:" + id); }; }
  { const tn = $("[data-tlname]", el); if (tn) { const sv = debounce(v => setEntry(tn.dataset.tlname, { name: v || "Cronología" }, "field"), 300); tn.addEventListener("input", () => sv(tn.value)); } }
  { const tr = $("[data-tlrev]", el); if (tr) tr.onchange = () => setEntry(tr.dataset.tlrev, { revealed: tr.checked }); }
  confirmBtn($("[data-tldel]", el), () => { const id = $("[data-tldel]", el).dataset.tldel; store.commit("lore", st => { st.lore = loreOf(st).filter(x => x.id !== id); loreOf(st).forEach(x => { if (x.tl) x.tl = x.tl.filter(y => y !== id); }); }); go("s:hist"); });
  // Hito 102: presencia de los dioses en un lugar o región
  const setPres = (kind, god, v) => { const f = o => { o.presence = { ...(o.presence || {}) }; if (v > 0) o.presence[god] = Math.min(100, v); else delete o.presence[god]; };
    if (kind.startsWith("reg:")) editRegion(kind.slice(4), r => f(r)); else store.commit("place", st => { const x = placeOf(st, kind); if (x) f(x); }); };
  if (dm) {
    $$("[data-pres]", el).forEach(i => i.onchange = () => { const [k, g] = i.dataset.pres.split("|"); setPres(k, g, Math.max(0, +i.value || 0)); });
    $$("[data-presadd]", el).forEach(i => i.onchange = () => { if (i.value) setPres(i.dataset.presadd, i.value, 10); });
  }
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
  $$("[data-estate]", el).forEach(b => b.onchange = () => markChange(e.id, b.dataset.estate, b.value));
  const up = $("[data-upimg]", el); if (up) up.onclick = async () => {
    const f = await pickFile(); if (!f) return;
    try { const r = await readImageFile(f, 1800), key = uid("img"); await putImage(key, r.dataURL); setEntry(e.id, x => ({ img: key, name: e.kind === "image" && /nueva$/.test(x.name) ? f.name.replace(/\.[^.]+$/, "") : x.name })); }
    catch (err) { toast("No se pudo cargar la imagen. Prueba con un JPG o PNG."); }
  };
  const ni = $("[data-noimg]", el); if (ni) ni.onclick = () => setEntry(e.id, { img: null });
  if (e.kind === "npc") bindCombat(el, e, () => draw());
  // Hito 102: facciones del PNJ, bandos de la batalla y en qué cronologías sale
  const facs = fn => setEntry(e.id, x => { const L = (x.factions || []).map(f => ({ ...f })); fn(L); return { factions: L }; });
  { const fa = $("[data-facadd]", el); if (fa) fa.onchange = () => fa.value && facs(L => L.push({ id: fa.value, rank: "" })); }
  $$("[data-facdel]", el).forEach(b => b.onclick = () => facs(L => L.splice(+b.dataset.facdel, 1)));
  $$("[data-facrank]", el).forEach(i => { const sv = debounce(v => setEntry(e.id, x => { const L = (x.factions || []).map(f => ({ ...f })); if (L[+i.dataset.facrank]) L[+i.dataset.facrank].rank = v; return { factions: L }; }, "field"), 400); i.addEventListener("input", () => sv(i.value)); });
  const sides = fn => setEntry(e.id, x => { const L = JSON.parse(JSON.stringify(x.sides || [])); fn(L); return { sides: L }; });
  { const sa = $("[data-sideadd]", el); if (sa) sa.onclick = () => sides(L => L.push({ name: "Bando " + (L.length + 1), factions: [], npcs: [], note: "" })); }
  $$("[data-sidedel]", el).forEach(b => b.onclick = () => sides(L => L.splice(+b.dataset.sidedel, 1)));
  $$("[data-sidein]", el).forEach(i => i.onchange = () => { const id = i.value, x = entry(store.get(), id); if (!x) return; sides(L => { const sd = L[+i.dataset.sidein]; if (!sd) return; const k = x.kind === "faction" ? "factions" : "npcs"; sd[k] = sd[k] || []; if (!sd[k].includes(id)) sd[k].push(id); }); });
  $$("[data-sideout]", el).forEach(b => b.onclick = () => { const [i, id] = b.dataset.sideout.split("|"); sides(L => { const sd = L[+i]; if (sd) { sd.factions = (sd.factions || []).filter(x => x !== id); sd.npcs = (sd.npcs || []).filter(x => x !== id); } }); });
  $$("[data-sidename]", el).forEach(i => { const sv = debounce(v => setEntry(e.id, x => { const L = JSON.parse(JSON.stringify(x.sides || [])); if (L[+i.dataset.sidename]) L[+i.dataset.sidename].name = v; return { sides: L }; }, "field"), 400); i.addEventListener("input", () => sv(i.value)); });
  $$("[data-sidenote]", el).forEach(i => { const sv = debounce(v => setEntry(e.id, x => { const L = JSON.parse(JSON.stringify(x.sides || [])); if (L[+i.dataset.sidenote]) L[+i.dataset.sidenote].note = v; return { sides: L }; }, "field"), 400); i.addEventListener("input", () => sv(i.value)); });
  $$("[data-tlm]", el).forEach(c => c.onchange = () => setEntry(e.id, x => { const cur = new Set(x.tl && x.tl.length ? x.tl : [MAIN_TL]); c.checked ? cur.add(c.dataset.tlm) : cur.delete(c.dataset.tlm); return { tl: [...cur] }; }));
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
