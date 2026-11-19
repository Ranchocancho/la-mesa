// Ficha flotante del lore: el máster busca «Mirra» en mitad de la partida y la tiene delante sin salir de la mesa.
// Una sola ventana que se superpone: buscador → ficha → (sus relaciones) → … con «‹» para volver.
// Los jugadores pueden usarla también: solo ven lo revelado y nunca los secretos.
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { LORE, EVENT_STATUS, loreOf, entry, placeOf, canSee, refName, related, placePath, showEntry, setEntry } from "../core/lore.js";
import { show } from "../core/sesiones.js";
import { liveSession } from "../core/sesiones.js";
import { VITAL, STANCE, fieldsOf, badges, markChange, hereOf, setHere, touch, contextOf } from "../core/contexto.js";
import { getImage } from "../core/images.js";
import { $, $$, esc } from "../core/ui.js";

let box = null, stack = [], q = "", off = null;
const norm = x => (x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function openLoreSearch(text = "") { q = text; stack = [null]; open(); }
export function openLoreCard(id) { if (!box) stack = []; stack.push(id); if (isDM(store.get())) touch(id); open(); }
export const closeLore = () => { if (box) box.remove(); box = null; stack = []; if (off) off(); off = null; document.removeEventListener("keydown", onKey); };
const onKey = ev => { if (ev.key === "Escape") closeLore(); };

function open() {
  if (!box) {
    box = document.createElement("div"); box.className = "lfloat"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Lore");
    document.body.appendChild(box);
    off = store.subscribe(() => { if (box && !box.contains(document.activeElement)) draw(); });
    document.addEventListener("keydown", onKey);
  }
  draw();
}

function draw() {
  const s = store.get(), cur = stack[stack.length - 1];
  const head = `<header><button class="x" data-lback ${stack.length > 1 ? "" : "hidden"} aria-label="Volver">‹</button>
    <input type="search" id="lfq" placeholder="Buscar en el lore…" value="${esc(q)}" aria-label="Buscar en el lore"><button class="x" data-lclose aria-label="Cerrar">✕</button></header>`;
  box.innerHTML = head + `<div class="lfbody">${cur ? cardHTML(s, cur) : resultsHTML(s)}</div>`;
  bind(s, cur);
}

function resultsHTML(s) {
  const dm = isDM(s), w = norm(q);
  if (w.length < 2) {
    const here = hereOf(s);
    if (!here) return `<p class="empty">Escribe un nombre: personaje, facción, lugar, dios…</p>`;
    const c = contextOf(s, here.id), list = [...c.npc, ...c.faction, ...c.event].filter(e => canSee(s, e)).slice(0, 14);
    return `<h4>📍 Cerca: ${esc(here.name)}</h4>${rows(s, list.map(e => e.id))}`;
  }
  const ids = [...s.world.places.filter(p => (dm || p.visible) && norm(p.name + " " + (p.kind || "") + " " + (p.summary || "")).includes(w)).map(p => p.id),
    ...loreOf(s).filter(e => canSee(s, e) && e.kind !== "chapter" && norm(e.name + " " + (e.role || "") + " " + (e.summary || "") + (dm ? " " + (e.secret || "") : "")).includes(w))
      .sort((a, b) => (norm(a.name).startsWith(w) ? 0 : 1) - (norm(b.name).startsWith(w) ? 0 : 1)).map(e => e.id)];
  return ids.length ? rows(s, ids.slice(0, 30)) : `<p class="empty">Nada encontrado.</p>`;
}
const rows = (s, ids) => `<div class="lfrows">${ids.map(id => { const n = refName(s, id), e = entry(s, id), p = placeOf(s, id);
  const sub = e ? (e.role || (e.place && placeOf(s, e.place) ? placeOf(s, e.place).name : LORE[e.kind].n)) : p ? p.kind || "Lugar" : "";
  return n ? `<button data-lopen="${id}"><span>${n.icon}</span><b>${esc(n.name)}</b>${e && isDM(s) ? badges(e) : ""}<small>${esc(sub || "")}</small></button>` : ""; }).join("")}</div>`;

function cardHTML(s, id) {
  const dm = isDM(s), e = entry(s, id), p = placeOf(s, id);
  if (e && !canSee(s, e) || (p && !dm && !p.visible) || (!e && !p)) return `<p class="empty">No se encuentra (o aún no os lo han revelado).</p>`;
  if (p) return placeHTML(s, p, dm);
  const pl = e.place ? placeOf(s, e.place) : null, rel = related(s, e.id).filter(r => { const x = entry(s, r), y = placeOf(s, r); return x ? canSee(s, x) : y ? dm || y.visible : true; });
  const live = !!liveSession(s), shown = s.presentation && s.presentation.id === e.id;
  const states = dm ? fieldsOf(e.kind).map(f => `<div class="lfstate">${Object.entries(f === "vital" ? VITAL : STANCE).map(([k, [i, n]]) =>
    `<button data-lstate="${f}:${k}" aria-pressed="${(e[f] || (f === "vital" ? "vivo" : "neutral")) === k}" title="${n}">${i}<span>${n}</span></button>`).join("")}</div>`).join("") : "";
  return `<article class="lfcard k-${e.kind}">
    ${e.img ? `<div class="lfimg" data-img="${esc(e.img)}"></div>` : ""}
    <div class="eyebrow">${LORE[e.kind].icon} ${esc(LORE[e.kind].n.toUpperCase())}${pl ? ` · <a data-lopen="${pl.id}">${esc(placePath(s, pl.id).map(x => x.name).join(" › "))}</a>` : ""}</div>
    <h3>${esc(e.name)}</h3>${e.role ? `<p class="lfrole">${esc(e.role)}</p>` : ""}
    ${dm && !e.revealed && e.kind !== "note" ? `<p class="note">🔒 Los jugadores aún no lo conocen</p>` : ""}
    ${states}${live && fieldsOf(e.kind).length && dm ? `<p class="note">Los cambios quedan apuntados en la sesión.</p>` : ""}
    ${e.summary ? `<p class="lftext">${esc(e.summary).replace(/\n/g, "<br>")}</p>` : ""}
    ${dm && e.secret ? `<div class="lfsecret"><i class="tag secret">SOLO MÁSTER</i><p>${esc(e.secret).replace(/\n/g, "<br>")}</p></div>` : ""}
    ${e.kind === "event" && dm ? `<div class="lfstate">${Object.entries(EVENT_STATUS).map(([k, n]) => `<button data-levst="${k}" aria-pressed="${e.status === k}">${n}</button>`).join("")}</div>
      ${(e.actions || "").trim() ? `<ul class="lfacts">${e.actions.split("\n").filter(x => x.trim()).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}` : ""}
    ${rel.length ? `<h4>🔗 Relacionado</h4>${rows(s, rel)}` : ""}
    <footer>${dm && e.kind !== "note" ? `<button class="btn small gold" data-lshow>${shown ? "✓ En la mesa" : "Mostrar a todos"}</button>` : ""}<a class="btn small" href="#lore/${e.id}" data-lgo>Abrir en el Lore</a></footer>
  </article>`;
}

function placeHTML(s, p, dm) {
  const here = hereOf(s), c = contextOf(s, p.id), live = !!liveSession(s);
  const vis = l => l.filter(e => canSee(s, e)).map(e => e.id);
  return `<article class="lfcard k-place">
    <div class="eyebrow">📍 ${esc((p.kind || "Lugar").toUpperCase())}${c.path.length > 1 ? ` · ${c.path.slice(0, -1).map(x => `<a data-lopen="${x.id}">${esc(x.name)}</a>`).join(" › ")}` : ""}</div>
    <h3>${esc(p.name)}</h3>
    ${p.summary ? `<p class="lftext">${esc(p.summary).replace(/\n/g, "<br>")}</p>` : ""}
    ${dm && p.secret ? `<div class="lfsecret"><i class="tag secret">SOLO MÁSTER</i><p>${esc(p.secret).replace(/\n/g, "<br>")}</p></div>` : ""}
    ${vis(c.npc).length ? `<h4>👤 Quién hay</h4>${rows(s, vis(c.npc))}` : ""}
    ${vis(c.faction).length ? `<h4>⚑ Facciones</h4>${rows(s, vis(c.faction))}` : ""}
    ${dm && c.event.length ? `<h4>⚡ Eventos</h4>${rows(s, c.event.map(e => e.id))}` : ""}
    <footer>${dm && live ? `<button class="btn small gold" data-lhere ${here && here.id === p.id ? "disabled" : ""}>${here && here.id === p.id ? "📍 Estáis aquí" : "📍 Estamos aquí"}</button>` : ""}
      ${dm ? `<button class="btn small" data-lshowpl>Mostrar a todos</button>` : ""}<a class="btn small" href="#lore/${p.id}" data-lgo>Abrir en el Lore</a></footer>
  </article>`;
}

function bind(s, cur) {
  const inp = $("#lfq", box);
  inp.oninput = () => { q = inp.value; stack = [null]; const pos = inp.selectionStart; draw(); const n = $("#lfq", box); n.focus(); n.setSelectionRange(pos, pos); };
  if (!cur) setTimeout(() => { const n = $("#lfq", box); if (n && document.activeElement !== n) n.focus(); }, 0);
  $("[data-lclose]", box).onclick = closeLore;
  $("[data-lback]", box).onclick = () => { stack.pop(); if (!stack.length) stack = [null]; draw(); };
  $$("[data-lopen]", box).forEach(b => b.onclick = ev => { ev.preventDefault(); openLoreCard(b.dataset.lopen); });
  $$("[data-lgo]", box).forEach(a => a.onclick = () => closeLore());
  $$("[data-lstate]", box).forEach(b => b.onclick = () => { const [f, v] = b.dataset.lstate.split(":"); markChange(cur, f, v); });
  $$("[data-levst]", box).forEach(b => b.onclick = () => setEntry(cur, { status: b.dataset.levst }));
  const sh = $("[data-lshow]", box); if (sh) sh.onclick = () => showEntry(cur);
  const sp = $("[data-lshowpl]", box); if (sp) sp.onclick = () => { show({ type: "place", place: cur }); setHere(cur); };
  const hb = $("[data-lhere]", box); if (hb) hb.onclick = () => setHere(cur);
  $$("[data-img]", box).forEach(async d => { try { const u = await getImage(d.dataset.img); if (u) d.style.backgroundImage = `url("${u}")`; } catch (e) { /* sin imagen */ } });
}
