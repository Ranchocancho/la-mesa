// Crónica: lo que los jugadores van anotando en cada sesión, el resumen del máster y la experiencia repartida.
// Todo es editable: cada uno corrige sus notas y el máster puede corregirlo todo.
import { store } from "../core/store.js";
import { currentUser, isDM } from "../core/session.js";
import { visibleLive, pastSessions, sessionName, addEntry } from "../core/sesiones.js";
import { $, $$, esc, toast, avatar } from "../core/ui.js";
import { sessionStats } from "../core/cronica.js";
import { tripText, kmOf } from "../core/ruta.js";
import { fmtCp } from "../core/comercio.js";

/** Fila de datos de la sesión (se ve sin desplegar): botín, PX, enemigos, PNJ caídos y lugares. */
function statChips(st, full, old) {
  const ch = [];
  if (st.cp || st.items.length) ch.push(`<span class="cst loot" title="${esc(st.items.join(", "))}">💰 ${st.cp ? fmtCp(st.cp) : ""}${st.items.length ? `${st.cp ? " · " : ""}${st.items.length} objeto${st.items.length > 1 ? "s" : ""}` : ""}</span>`);
  if (st.xp) ch.push(`<span class="cst xp">⭐ ${st.xp.toLocaleString("es-ES")} PX</span>`);
  if (st.nKills) ch.push(`<span class="cst kill" title="${esc(st.kills.map(([n, k]) => `${k} × ${n}`).join(", "))}">⚔ ${st.nKills} enemigo${st.nKills > 1 ? "s" : ""}</span>`);
  if (st.npcs.length) ch.push(`<span class="cst npc" title="PNJ caídos">💀 ${esc(st.npcs.map(k => k.n).join(", "))}</span>`);
  if (st.trip) ch.push(`<span class="cst trip" title="Distancia recorrida en el mapa del mundo y días de viaje (SRD)">🧭 ${esc(st.trip)}</span>`);
  if (st.places.length) ch.push(`<span class="cst place">📍 ${esc(full ? st.places.join(" · ") : st.places.slice(0, 3).join(" · ") + (st.places.length > 3 ? ` +${st.places.length - 3}` : ""))}</span>`);
  if (old) ch.push(`<span class="cst old" title="Esta sesión se jugó antes de que la mesa apuntara botín, enemigos, PNJ y lugares">sin registro de botín, enemigos ni lugares</span>`);
  return ch.length ? `<span class="cstats">${ch.join("")}</span>` : "";
}
/** Sesiones de antes de que la mesa apuntara estos datos (Hito 70): se dice, para que no parezca que no pasó nada. */
const noData = x => !x.loot && !x.kills && !x.scenes && !(x.visited || []).length && x.status !== "open";
/** Detalle desplegado: qué se encontró, a quién se abatió y por dónde se pasó. */
function statDetail(st) {
  const rows = [];
  if (st.cp || st.items.length) rows.push(`<div><b>💰 Botín</b><span>${[st.cp ? fmtCp(st.cp) : "", ...st.items].filter(Boolean).map(esc).join(" · ")}</span></div>`);
  if (st.nKills) rows.push(`<div><b>⚔ Enemigos abatidos</b><span>${st.kills.map(([n, k]) => `${k > 1 ? k + " × " : ""}${esc(n)}`).join(" · ")}</span></div>`);
  if (st.npcs.length) rows.push(`<div><b>💀 PNJ caídos</b><span>${st.npcs.map(k => esc(k.n)).join(" · ")}</span></div>`);
  if (st.places.length) rows.push(`<div><b>📍 Lugares</b><span>${st.places.map(esc).join(" → ")}</span></div>`);
  return rows.length ? `<div class="cdetail">${rows.join("")}</div>` : "";
}

let el = null, editing = null;

export function mount(root) {
  el = document.createElement("div"); el.className = "page"; root.appendChild(el);
  editing = null; draw();
  return { update: (s, label, remote) => { if (el && el.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && remote) return; draw(); }, unmount() { el = null; } };
}

const opened = new Set(); let closedLive = false;
function draw() {
  if (!el) return;
  const s = store.get(), me = currentUser(s), dm = isDM(s);
  const live = visibleLive(s), list = [...(live ? [live] : []), ...pastSessions(s)];
  const entries = sid => (s.chronicle || []).filter(e => e.session === sid);
  const who = id => s.users.find(u => u.id === id);
  el.innerHTML = `<div class="wrap">
    <div class="chronhead"><h1 class="title">Crónica</h1><div class="row"><button class="btn small" id="cexp">Desplegar todo</button><button class="btn small" id="ccol">Plegar todo</button></div></div>
    <p class="lead">La historia del grupo, escrita entre todos. Durante la partida, anotad lo que pasa; al cerrar la sesión, el máster lo convierte en el «Anteriormente…».</p>
    ${(() => { const A = list.map(x => sessionStats(s, x)), T = { cp: A.reduce((a, x) => a + x.cp, 0), items: A.reduce((a, x) => a + x.items.length, 0), xp: A.reduce((a, x) => a + x.xp, 0), k: A.reduce((a, x) => a + x.nKills, 0), npcs: A.flatMap(x => x.npcs.map(n => n.n)), pl: new Set(A.flatMap(x => x.places)).size, km: A.reduce((a, x) => a + (x.km || 0), 0) };
      return list.length ? `<div class="ctotals"><span><small>Sesiones</small><b>${list.length}</b></span><span><small>Botín</small><b>${T.cp ? fmtCp(T.cp) : "—"}</b>${T.items ? `<em>${T.items} objetos</em>` : ""}</span><span><small>Experiencia</small><b>${T.xp ? T.xp.toLocaleString("es-ES") + " PX" : "—"}</b></span><span><small>Enemigos abatidos</small><b>${T.k || "—"}</b></span><span><small>PNJ caídos</small><b>${T.npcs.length || "—"}</b>${T.npcs.length ? `<em>${esc(T.npcs.slice(0, 3).join(", "))}${T.npcs.length > 3 ? "…" : ""}</em>` : ""}</span><span><small>Lugares</small><b>${T.pl || "—"}</b></span><span><small>Distancia</small><b>${T.km >= 1 ? Math.round(T.km).toLocaleString("es-ES") + " km" : "—"}</b>${T.km >= 1 ? `<em>${(T.km / 36).toLocaleString("es-ES", { maximumFractionDigits: 1 })} días a ritmo normal</em>` : ""}</span></div>` : ""; })()}
    <div class="ctimeline">
    ${list.map(x => { const isOpen = opened.has(x.id) || (x.status === "open" && !closedLive), n = entries(x.id).length, xp = (x.xp || []).reduce((a, g) => a + (+g.amount || 0), 0);
      if (!isOpen) return `<section class="chron folded ${x.status === "open" ? "live" : ""}"><button class="chfold" data-fold="${x.id}" aria-expanded="false">
        <span class="chn">${esc(sessionName(x))}</span><span class="cht"><b>${esc(x.title || (x.status === "open" ? "En curso" : ""))}</b><small>${x.status === "open" ? "En curso" : esc(x.date || "")}</small></span>
        <span class="chs">${esc((x.recap || "").slice(0, 150))}${(x.recap || "").length > 150 ? "…" : ""}</span>
        <span class="chm">${n ? `📝 ${n} nota${n > 1 ? "s" : ""}` : ""}</span><i>▸</i>${statChips(sessionStats(s, x), false, noData(x))}</button></section>`;
      return `<section class="chron ${x.status === "open" ? "live" : ""}">
      <header><button class="chfold open" data-fold="${x.id}" aria-expanded="true"><h2>${esc(sessionName(x))}${x.title ? ` · ${esc(x.title)}` : ""}</h2><i>▾</i></button><small>${x.status === "open" ? "En curso" : esc(x.date || "")}${x.status !== "open" && dm ? ` · <a href="#lore/ses:${x.id}">✎ Editar</a>` : ""}</small></header>
      ${x.recap ? `<p class="recaptext">${esc(x.recap)}</p>` : ""}
      ${statChips(sessionStats(s, x), true, noData(x))}${statDetail(sessionStats(s, x))}${(x.route || []).length > 1 ? `<button class="btn small" data-route="${x.id}">🧭 Ver la ruta de esta sesión en el mapa</button>` : ""}
      ${(x.xp || []).length ? `<div class="xpgot">${x.xp.map(g => `<span><b>+${g.amount} PX</b> ${esc(g.name)}${g.reason ? ` · ${esc(g.reason)}` : ""}</span>`).join("")}</div>` : ""}
      <div class="entries">${entries(x.id).map(e => {
        const u = who(e.by) || { name: e.name, initials: "?" }, mine = e.by === me.id;
        return editing === e.id ? `<div class="entry"><textarea id="eedit" rows="3">${esc(e.text)}</textarea><div class="row"><button class="btn gold small" id="esave">Guardar</button><button class="btn small" id="ecancel">Cancelar</button><button class="btn small danger" id="edel">Borrar</button></div></div>`
          : `<div class="entry">${avatar(u, 30)}<div><b>${esc(u.name || e.name)}</b> <small>${new Date(e.at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small><p>${esc(e.text)}</p></div>${mine || dm ? `<button class="btn small" data-edit="${e.id}">Editar</button>` : ""}</div>`;
      }).join("") || `<p class="empty">Nadie ha anotado nada en esta sesión.</p>`}</div>
      <div class="addentry"><textarea data-new="${x.id}" rows="2" placeholder="${x.status === "open" ? "¿Qué acaba de pasar?" : "Añadir algo que pasó en esta sesión…"}"></textarea><button class="btn small" data-add="${x.id}">Anotar</button></div>
    </section>`; }).join("") || `<p class="empty">Todavía no hay sesiones.</p>`}
  </div></div>`;
  $$("[data-fold]", el).forEach(b => b.onclick = () => { const id = b.dataset.fold, x = s.sessions.find(y => y.id === id); const open = opened.has(id) || (x && x.status === "open" && !closedLive);
    if (open) { opened.delete(id); if (x && x.status === "open") closedLive = true; } else { opened.add(id); if (x && x.status === "open") closedLive = false; } draw(); });
  $$("[data-route]", el).forEach(b => b.onclick = () => { try { sessionStorage.setItem("lamesa:route", b.dataset.route); } catch (e) { /* nada */ } location.hash = "mundo"; });
  const ex = $("#cexp", el); if (ex) ex.onclick = () => { list.forEach(x => opened.add(x.id)); closedLive = false; draw(); };
  const co = $("#ccol", el); if (co) co.onclick = () => { opened.clear(); closedLive = true; draw(); };
  $$("[data-add]", el).forEach(b => b.onclick = () => { const t = $(`[data-new="${b.dataset.add}"]`, el); if (t.value.trim()) { addEntry(b.dataset.add, t.value); toast("Anotado en la crónica"); } });
  $$("[data-edit]", el).forEach(b => b.onclick = () => { editing = b.dataset.edit; draw(); });
  const on = (id, fn) => { const b = $("#" + id, el); if (b) b.onclick = fn; };
  on("ecancel", () => { editing = null; draw(); });
  on("esave", () => { const v = $("#eedit", el).value, id = editing; editing = null; store.commit("chronicle", st => { const e = st.chronicle.find(x => x.id === id); if (e) e.text = v; }); });
  on("edel", () => { const b = $("#edel", el); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Pulsa otra vez"; return; } const id = editing; editing = null; store.commit("chronicle", st => { st.chronicle = st.chronicle.filter(x => x.id !== id); }); });
}
