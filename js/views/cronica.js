// Crónica: lo que los jugadores van anotando en cada sesión, el resumen del máster y la experiencia repartida.
// Todo es editable: cada uno corrige sus notas y el máster puede corregirlo todo.
import { store } from "../core/store.js";
import { currentUser, isDM } from "../core/session.js";
import { visibleLive, pastSessions, sessionName, addEntry } from "../core/sesiones.js";
import { $, $$, esc, toast, avatar } from "../core/ui.js";

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
    ${list.map(x => { const isOpen = opened.has(x.id) || (x.status === "open" && !closedLive), n = entries(x.id).length, xp = (x.xp || []).reduce((a, g) => a + (+g.amount || 0), 0);
      if (!isOpen) return `<section class="chron folded ${x.status === "open" ? "live" : ""}"><button class="chfold" data-fold="${x.id}" aria-expanded="false">
        <span class="chn">${esc(sessionName(x))}</span><span class="cht"><b>${esc(x.title || (x.status === "open" ? "En curso" : ""))}</b><small>${x.status === "open" ? "En curso" : esc(x.date || "")}</small></span>
        <span class="chs">${esc((x.recap || "").slice(0, 150))}${(x.recap || "").length > 150 ? "…" : ""}</span>
        <span class="chm">${n ? `📝 ${n}` : ""}${xp ? ` · ⭐ ${xp} PX` : ""}</span><i>▸</i></button></section>`;
      return `<section class="chron ${x.status === "open" ? "live" : ""}">
      <header><button class="chfold open" data-fold="${x.id}" aria-expanded="true"><h2>${esc(sessionName(x))}${x.title ? ` · ${esc(x.title)}` : ""}</h2><i>▾</i></button><small>${x.status === "open" ? "En curso" : esc(x.date || "")}${x.status !== "open" && dm ? ` · <a href="#lore/ses:${x.id}">✎ Editar</a>` : ""}</small></header>
      ${x.recap ? `<p class="recaptext">${esc(x.recap)}</p>` : ""}
      ${(x.xp || []).length ? `<div class="xpgot">${x.xp.map(g => `<span><b>+${g.amount} PX</b> ${esc(g.name)}${g.reason ? ` · ${esc(g.reason)}` : ""}</span>`).join("")}</div>` : ""}
      <div class="entries">${entries(x.id).map(e => {
        const u = who(e.by) || { name: e.name, initials: "?" }, mine = e.by === me.id;
        return editing === e.id ? `<div class="entry"><textarea id="eedit" rows="3">${esc(e.text)}</textarea><div class="row"><button class="btn gold small" id="esave">Guardar</button><button class="btn small" id="ecancel">Cancelar</button><button class="btn small danger" id="edel">Borrar</button></div></div>`
          : `<div class="entry">${avatar(u, 30)}<div><b>${esc(u.name || e.name)}</b> <small>${new Date(e.at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small><p>${esc(e.text)}</p></div>${mine || dm ? `<button class="btn small" data-edit="${e.id}">Editar</button>` : ""}</div>`;
      }).join("") || `<p class="empty">Nadie ha anotado nada en esta sesión.</p>`}</div>
      <div class="addentry"><textarea data-new="${x.id}" rows="2" placeholder="${x.status === "open" ? "¿Qué acaba de pasar?" : "Añadir algo que pasó en esta sesión…"}"></textarea><button class="btn small" data-add="${x.id}">Anotar</button></div>
    </section>`; }).join("") || `<p class="empty">Todavía no hay sesiones.</p>`}
  </div>`;
  $$("[data-fold]", el).forEach(b => b.onclick = () => { const id = b.dataset.fold, x = s.sessions.find(y => y.id === id); const open = opened.has(id) || (x && x.status === "open" && !closedLive);
    if (open) { opened.delete(id); if (x && x.status === "open") closedLive = true; } else { opened.add(id); if (x && x.status === "open") closedLive = false; } draw(); });
  const ex = $("#cexp", el); if (ex) ex.onclick = () => { list.forEach(x => opened.add(x.id)); closedLive = false; draw(); };
  const co = $("#ccol", el); if (co) co.onclick = () => { opened.clear(); closedLive = true; draw(); };
  $$("[data-add]", el).forEach(b => b.onclick = () => { const t = $(`[data-new="${b.dataset.add}"]`, el); if (t.value.trim()) { addEntry(b.dataset.add, t.value); toast("Anotado en la crónica"); } });
  $$("[data-edit]", el).forEach(b => b.onclick = () => { editing = b.dataset.edit; draw(); });
  const on = (id, fn) => { const b = $("#" + id, el); if (b) b.onclick = fn; };
  on("ecancel", () => { editing = null; draw(); });
  on("esave", () => { const v = $("#eedit", el).value, id = editing; editing = null; store.commit("chronicle", st => { const e = st.chronicle.find(x => x.id === id); if (e) e.text = v; }); });
  on("edel", () => { const b = $("#edel", el); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Pulsa otra vez"; return; } const id = editing; editing = null; store.commit("chronicle", st => { st.chronicle = st.chronicle.filter(x => x.id !== id); }); });
}
