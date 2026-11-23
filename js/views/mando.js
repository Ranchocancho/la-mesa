// Centro de mando del máster (Hito 68). Una página propia («Mando», solo el máster) y la misma vista, en columna,
// como tercer modo del panel del máster en Partida (🎛). Cinco bloques:
//   Estado del grupo · Experiencia (notas de PX y subidas de nivel) · Botín · Próximas sesiones · Reglas a mano.
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { $, $$, esc, toast } from "../core/ui.js";
import { liveSession, sessionName } from "../core/sesiones.js";
import { canLevelUp, levelGranted, xpFor, classInfo } from "../data/dnd.js";
import { grantLevel } from "../core/experiencia.js";
import { setInspiration } from "../core/inspiracion.js";
import { lootOf, fmtCp, toCp } from "../core/comercio.js";
import { lootHTML, bindLoot } from "./tienda.js";
import { ESTADOS } from "../data/estados.js";
import { glyph, COND } from "../data/iconos.js";
import { siluetaFor, siluetaURL } from "../data/siluetas.js";
import { INDICE, ACCESOS } from "../data/indice.js";
import { srd, srdNow, norm } from "../core/srd.js";
import { openRulePage, openRules } from "./reglas.js";
import { mandoOf, partyChars, sessionXP, ensureXP0, addXPNote, grantXPNotes, dropXPNote, FTAGS, addFuture, toggleFuture, dropFuture,
  addRule, dropRule, moveRule, addMerma, dropMerma } from "../core/mando.js";

const ui = { open: { grupo: true, xp: true, botin: true, futuro: true, reglas: true }, rq: "", rgrp: "", ftag: "", fnew: "sesion", xpSel: null };

/* ---------- Página «Mando» ---------- */
let page = null;
export function mount(root) {
  page = document.createElement("div"); page.className = "mando page";
  root.appendChild(page);
  draw(page, false);
  return { update(s, label) { if (label === "field") return; draw(page, false); }, unmount() { page = null; } };
}

/** Pinta el centro de mando en «el» (compact: en columna, para el panel del máster). */
export function draw(el, compact, force) {
  if (!el) return;
  const s = store.get();
  if (!isDM(s)) { el.innerHTML = `<p class="empty" style="padding:20px">El centro de mando es del máster.</p>`; return; }
  // no pisar lo que se está escribiendo
  if (!force && el.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.dataset.keep !== undefined) return;
  ensureXP0();
  if (!srdNow.glosario) Promise.all([srd("glosario"), srd("conjuros"), srd("monstruos")]).then(() => draw(el, compact));
  const sec = (k, icon, title, sub, body, wide) => `<section class="mpanel ${wide ? "wide" : ""}" data-mk="${k}"><h2 class="msec" data-mtog="${k}"><span>${icon} ${title}</span>${sub ? `<small>${sub}</small>` : ""}<i>${ui.open[k] ? "▾" : "▸"}</i></h2>${ui.open[k] ? `<div class="mbody">${body}</div>` : ""}</section>`;
  const live = liveSession(s);
  el.classList.toggle("compact", !!compact);
  el.innerHTML = `${compact ? "" : `<header class="mhead"><h1>🎛 Centro de mando</h1><p>${live ? `<b>${esc(sessionName(live))}</b> en curso` : "Sin sesión abierta"} · lo que llevas tú: estado del grupo, experiencia, botín, notas y reglas a mano.</p></header>`}
    <div class="mgrid">
      ${sec("grupo", "🛡", "Estado del grupo", live ? "PX de esta sesión incluidos" : "", groupHTML(s, compact), true)}
      ${sec("xp", "⭐", "Experiencia y subidas de nivel", pendingCount(s) ? `${pendingCount(s)} nota${pendingCount(s) > 1 ? "s" : ""} sin conceder` : "", xpHTML(s))}
      ${sec("botin", "💰", "Botín", "", lootPanel(s))}
      ${sec("futuro", "🔮", "Próximas sesiones", "", futureHTML(s))}
      ${sec("reglas", "📌", "Reglas a mano", "SRD 5.2.1", rulesHTML(s))}
    </div>`;
  bind(el, compact);
}
const pendingCount = s => mandoOf(s).xpn.filter(n => !n.done).length;
const first = n => String(n || "").split(" ")[0];

/* ---------- Estado del grupo ---------- */
function groupHTML(s, compact) {
  const L = partyChars(s); if (!L.length) return `<p class="empty">No hay personajes en la partida.</p>`;
  return `<div class="mcards">${L.map(c => {
    const tok = (s.tokens || []).find(t => t.kind === "pc" && t.char === c.id), hp = c.hp || { cur: 0, max: 0 }, pct = Math.max(0, Math.min(100, hp.cur / Math.max(1, hp.max) * 100));
    const conds = ((tok && tok.conds) || []).map(x => ({ x, e: ESTADOS.find(y => y.id === x.id) })).filter(o => o.e);
    const sx = sessionXP(s, c), next = c.level < 20 ? xpFor(c.level + 1) : null, sil = siluetaFor(`${c.cls} ${c.species}`);
    const lv = levelGranted(c) ? `<button class="mlv on" data-mlvl="${c.id}|0" title="Concedido: el jugador sube desde su ficha. Pulsa para retirarlo.">⬆ ${c.level + 1} ✓</button>`
      : `<button class="mlv ${canLevelUp(c) ? "ready" : ""}" data-mlvl="${c.id}|1" title="${canLevelUp(c) ? "Tiene los PX: pulsa para concederle la subida" : "Por hitos: pulsa para concederle la subida"}">⬆ ${c.level + 1}${canLevelUp(c) ? " ★" : ""}</button>`;
    const dying = hp.cur <= 0 && c.death ? ` · salvaciones contra muerte ✓${c.death.s || 0} ✗${c.death.f || 0}${c.death.stable ? " (estable)" : ""}` : "";
    return `<article class="mcard" style="--c:${esc(c.color || "#888")}">
      <div class="mface"><i style="-webkit-mask-image:url(${siluetaURL(sil)});mask-image:url(${siluetaURL(sil)})"></i></div>
      <div class="minfo">
        <div class="mname"><b>${esc(c.name)}</b>${lv}</div>
        <small>${esc(c.cls || "")} ${c.level} · ${esc(c.species || "")} · CA ${+c.ac || 10}${tok ? "" : ` · <span class="mfar">no está en la mesa</span>`}</small>
        <div class="mhp ${pct < 34 ? "low" : ""}"><i style="width:${pct}%"></i><span>${hp.cur}/${hp.max} PG${hp.temp ? ` +${hp.temp}` : ""}</span></div>
        <div class="mrow">
          <button class="mins ${c.inspiration ? "on" : ""}" data-mins="${c.id}" title="Inspiración heroica (SRD): ${c.inspiration ? "la tiene. Pulsa para quitarla." : "no la tiene. Pulsa para darla."}">✨</button>
          <span class="mxp" title="${next ? `Siguiente nivel a ${next.toLocaleString("es-ES")} PX` : "Nivel máximo"}">⭐ ${(c.xp || 0).toLocaleString("es-ES")}${next ? `<small>/${next.toLocaleString("es-ES")}</small>` : ""}${sx.got ? ` <em>+${sx.got} hoy</em>` : ""}${sx.pend ? ` <em class="pend">+${sx.pend} anotados</em>` : ""}</span>
          ${c.hdUsed ? `<span class="mhd" title="Dados de golpe gastados">🎲 ${c.level - c.hdUsed}/${c.level} d${classInfo(c.cls).hd}</span>` : ""}
        </div>
        ${conds.length || dying ? `<div class="mconds">${conds.map(({ x, e: E }) => `<span class="hbcond" style="--c:${E.c}" title="${esc(E.t)}">${COND[x.id] ? glyph([COND[x.id], "#fff"], "cg") : ""} ${esc(E.n.split(" ")[0])}${x.lvl ? " " + x.lvl : ""}</span>`).join("")}${dying ? `<small class="mdie">${esc(dying)}</small>` : ""}</div>` : ""}
        <div class="mmer"><small title="Regla de campaña: el SRD no trae heridas permanentes">Mermas permanentes</small>${(c.mermas || []).map(m => `<span class="mtag" title="${esc(m.ses || "")}">🩹 ${esc(m.t)}<button data-mdelm="${c.id}|${m.id}" aria-label="Quitar">✕</button></span>`).join("")}
          <input data-keep data-maddm="${c.id}" placeholder="+ Añadir (Enter)" aria-label="Añadir merma a ${esc(c.name)}"></div>
      </div></article>`; }).join("")}</div>`;
}

/* ---------- Experiencia ---------- */
function xpHTML(s) {
  const L = partyChars(s), live = liveSession(s), N = mandoOf(s).xpn, pend = N.filter(n => !n.done), done = N.filter(n => n.done).slice(0, 8);
  if (!ui.xpSel) ui.xpSel = new Set(L.map(c => c.id));
  const names = ids => ids.map(id => first((s.characters.find(c => c.id === id) || {}).name)).filter(Boolean).join(", ");
  const ready = L.filter(c => canLevelUp(c) && !levelGranted(c));
  return `<div class="mform">
      <div class="mpick">${L.map(c => `<label class="mchk"><input type="checkbox" data-xpsel="${c.id}" ${ui.xpSel.has(c.id) ? "checked" : ""}> ${esc(first(c.name))}</label>`).join("")}</div>
      <div class="row"><input type="number" min="0" id="mxpv" data-keep placeholder="PX" aria-label="PX" style="width:80px"><input id="mxpt" data-keep placeholder="Qué pasó: salvó al niño del incendio, resolvió el acertijo…" style="flex:1"></div>
      <div class="row"><button class="btn small" id="mxpadd" title="Se concede cuando quieras o al cerrar la sesión">📝 Anotar</button><button class="btn small gold" id="mxpnow">⭐ Anotar y conceder ya</button></div>
    </div>
    ${pend.length ? `<h3 class="msub">Sin conceder <button class="btn small gold" id="mxpall">Conceder todas (${pend.length})</button></h3>
      <ul class="mnotes">${pend.map(n => `<li><b>${n.xp ? `+${n.xp} PX` : "—"}</b><span>${esc(n.txt || "(sin motivo)")}<small>${esc(names(n.chars))}${n.sesName ? " · " + esc(n.sesName) : ""}</small></span><button class="btn small" data-xpg="${n.id}">Conceder</button><button class="ib danger" data-xpd="${n.id}" aria-label="Borrar">✕</button></li>`).join("")}</ul>
      <p class="note">Al cerrar la sesión se rellenan solas en el reparto de experiencia.</p>` : `<p class="note">Anota aquí los PX por hechos (una acción heroica, un buen plan, resolver un enigma). Se conceden cuando quieras o al cerrar la sesión.</p>`}
    ${done.length ? `<details class="mdone"><summary>Concedidas (${N.filter(n => n.done).length})</summary><ul class="mnotes">${done.map(n => `<li class="done"><b>+${n.xp}</b><span>${esc(n.txt)}<small>${esc(names(n.chars))}${n.sesName ? " · " + esc(n.sesName) : ""}</small></span><button class="ib" data-xpd="${n.id}" aria-label="Borrar">✕</button></li>`).join("")}</ul></details>` : ""}
    <h3 class="msub">⬆ Subidas de nivel</h3>
    <div class="lvlchips">${L.map(c => `<button class="lvlc ${levelGranted(c) ? "on" : canLevelUp(c) ? "ready" : ""}" data-mlvl="${c.id}|${levelGranted(c) ? 0 : 1}">${esc(first(c.name))} <small>${c.level}→${c.level + 1}</small>${levelGranted(c) ? " ✓" : canLevelUp(c) ? " ★" : ""}</button>`).join("")}</div>
    ${ready.length > 1 ? `<button class="btn small gold" id="mlvlall">Conceder a todos los que tienen PX (${ready.length})</button>` : ""}
    <p class="note">★ tiene los PX · ✓ concedido. El jugador sube desde su ficha cuando tú lo concedes${live ? "" : ""}.</p>`;
}

/* ---------- Botín ---------- */
function lootPanel(s) {
  const live = liveSession(s), got = (live && live.loot) || [], cp = got.reduce((a, x) => a + (+x.cp || 0), 0), items = got.flatMap(x => x.items);
  const L = lootOf(s), pool = toCp(L.coins);
  return `<div class="mloot">
    <div class="mstat"><small>Esta sesión</small><b>${cp ? fmtCp(cp) : live ? "sin monedas" : "—"}</b>${items.length ? `<span>${items.map(esc).join(", ")}</span>` : live ? `<span class="tenue">sin objetos</span>` : ""}</div>
    <div class="mstat"><small>Sin repartir (general)</small><b>${pool ? fmtCp(pool) : "sin monedas"}</b><span>${L.items.length} objeto${L.items.length === 1 ? "" : "s"}</span></div>
  </div>${lootHTML(s)}`;
}

/* ---------- Próximas sesiones ---------- */
function futureHTML(s) {
  const F = mandoOf(s).future, tg = k => FTAGS.find(t => t[0] === k) || FTAGS[4];
  const shown = F.filter(n => !ui.ftag || n.tag === ui.ftag).sort((a, b) => (a.done - b.done) || b.at - a.at);
  return `<div class="mform"><div class="row"><select id="mftag" data-keep aria-label="Tipo">${FTAGS.map(([k, i, n]) => `<option value="${k}" ${ui.fnew === k ? "selected" : ""}>${i} ${n}</option>`).join("")}</select>
      <textarea id="mftxt" data-keep rows="2" placeholder="Que el posadero reconozca el anillo · preparar la cripta · la hermana de Brena aparece…" style="flex:1"></textarea></div>
      <div class="row"><button class="btn small gold" id="mfadd">Apuntar</button><span class="grow"></span>
      <span class="mfilt">${[["", "Todo"], ...FTAGS.map(([k, i]) => [k, i])].map(([k, n]) => `<button class="${ui.ftag === k ? "on" : ""}" data-mft="${k}">${n}</button>`).join("")}</span></div></div>
    <ul class="mfut">${shown.map(n => `<li class="${n.done ? "done" : ""}"><label><input type="checkbox" data-fdone="${n.id}" ${n.done ? "checked" : ""}> <i title="${tg(n.tag)[2]}">${tg(n.tag)[1]}</i> <span>${esc(n.txt)}</span></label><button class="ib danger" data-fdel="${n.id}" aria-label="Borrar">✕</button></li>`).join("") || `<li class="empty">Nada apuntado${ui.ftag ? " de este tipo" : ""}.</li>`}</ul>`;
}

/* ---------- Reglas a mano ---------- */
const KIND = { g: "📚", p: "📖", c: "✨", m: "🐉", t: "🗂" };
function ruleResults(q) {
  const n = norm(q); if (n.length < 2) return [];
  const out = [], push = (k, ref, label, sub) => { if (out.length < 14) out.push({ k, ref, label, sub }); };
  for (const ch of INDICE) { if (norm(ch.n).includes(n)) push("p", `${ch.p}~${ch.n}`, ch.n, `Libro · pág. ${ch.p}`); for (const [t, p] of ch.subs) if (norm(t).includes(n)) push("p", `${p}~${t}`, t, `${ch.n} · pág. ${p}`); }
  for (const g of Object.keys(srdNow.glosario || {})) if (norm(g).includes(n)) push("g", g, g, "Glosario");
  for (const c of srdNow.conjuros || []) if (norm(c.n).includes(n)) push("c", c.n, c.n, `Conjuro de nivel ${c.lvl}`);
  for (const m of srdNow.monstruos || []) if (norm(m.n).includes(n)) push("m", m.n, m.n, `Monstruo · VD ${m.vd}`);
  return out;
}
function rulesHTML(s) {
  const R = mandoOf(s).rules, groups = [...new Set(R.map(r => r.grp || ""))];
  const res = ruleResults(ui.rq), has = (k, ref) => R.some(r => r.k === k && r.ref === ref);
  return `<div class="mform"><div class="row"><input id="mrq" data-keep value="${esc(ui.rq)}" placeholder="Busca: agarrar, cobertura, bola de fuego, ogro…" style="flex:1"><input id="mrg" data-keep value="${esc(ui.rgrp)}" placeholder="Carpeta (opcional)" style="width:130px" list="mrgl"><datalist id="mrgl">${groups.filter(Boolean).map(g => `<option value="${esc(g)}">`).join("")}</datalist></div>
    ${res.length ? `<ul class="mres">${res.map(r => `<li><button class="lnk" data-ropen="${r.k}|${esc(r.ref)}">${KIND[r.k]} ${esc(r.label)}</button><small>${esc(r.sub)}</small>${has(r.k, r.ref) ? `<span class="tenue">✓ ya está</span>` : `<button class="btn small" data-radd="${r.k}|${esc(r.ref)}|${esc(r.label)}">＋ A mano</button>`}</li>`).join("")}</ul>` : ui.rq.length >= 2 ? `<p class="empty">Nada con «${esc(ui.rq)}».</p>` : ""}
    ${!R.length ? `<p class="note">Busca un apartado del libro, una entrada del glosario, un conjuro o un monstruo y pulsa «＋ A mano». Algunos útiles: ${ACCESOS.slice(0, 6).map(([n, a]) => a.g ? `<button class="lnk" data-radd="g|${esc(a.g)}|${esc(n.replace(/^\S+\s/, ""))}">${esc(n)}</button>` : "").filter(Boolean).join(" · ")}</p>` : ""}</div>
    ${groups.map(g => `<div class="mrgrp">${g ? `<h3 class="msub">📁 ${esc(g)}</h3>` : R.length && groups.length > 1 ? `<h3 class="msub">Sin carpeta</h3>` : ""}<div class="mrules">${R.filter(r => (r.grp || "") === g).map(r => `<span class="mrule"><button data-ropen="${r.k}|${esc(r.ref)}" title="Abrir">${KIND[r.k]} ${esc(r.label)}</button><button class="mx" data-rup="${r.id}" aria-label="Subir">‹</button><button class="mx" data-rdel="${r.id}" aria-label="Quitar">✕</button></span>`).join("")}</div></div>`).join("")}`;
}
/** Abre un acceso: glosario y conjuros en una ventana aquí mismo (rápido); páginas y monstruos, en Reglas. */
function openRule(k, ref) {
  if (k === "p") { const [p, a] = ref.split("~"); return openRulePage(+p, a); }
  if (k === "m") return openRules("monstruos", ref);
  if (k === "t") return openRules(ref);
  let title = ref, body = "", go = () => openRules(k === "g" ? "glosario" : "conjuros", ref);
  if (k === "g") { const g = (srdNow.glosario || {})[ref]; body = g ? g.txt : ""; }
  if (k === "c") { const c = (srdNow.conjuros || []).find(x => x.n === ref); if (c) { title = `${c.n} · ${c.lvl ? `nivel ${c.lvl}` : "truco"} (${c.esc})`; body = `Tiempo: ${c.t} · Alcance: ${c.al} · Componentes: ${c.co} · Duración: ${c.du}\n${c.txt}`; } }
  if (!body) return go();
  const ov = document.createElement("div"); ov.className = "reqdlg";
  ov.innerHTML = `<div class="modalbox mrulebox"><header><h3>${KIND[k]} ${esc(title)}</h3><button class="x" data-close aria-label="Cerrar">✕</button></header>
    <div class="mrtxt">${body.split("\n").map(p => `<p>${esc(p)}</p>`).join("")}</div><div class="row"><button class="btn small" data-go>Abrir en Reglas</button><small class="srdnote">SRD 5.2.1 · CC BY 4.0</small></div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = e => { if (e.target === ov || e.target.closest("[data-close]")) close(); };
  $("[data-go]", ov).onclick = () => { close(); go(); };
}

/* ---------- Eventos ---------- */
function bind(el, compact) {
  const on = (q, f) => $$(q, el).forEach(b => b.onclick = e => f(b, e));
  const redraw = () => draw(el, compact, true);
  on("[data-mtog]", b => { ui.open[b.dataset.mtog] = !ui.open[b.dataset.mtog]; redraw(); });
  // grupo
  on("[data-mlvl]", b => { const [id, v] = b.dataset.mlvl.split("|"); grantLevel(id, v === "1"); });
  on("[data-mins]", b => { const c = store.get().characters.find(x => x.id === b.dataset.mins); if (c) setInspiration(c.id, !c.inspiration); });
  on("[data-mdelm]", b => { const [c, id] = b.dataset.mdelm.split("|"); dropMerma(c, id); });
  $$("[data-maddm]", el).forEach(i => i.onkeydown = e => { if (e.key === "Enter" && i.value.trim()) { const v = i.value; i.value = ""; i.blur(); addMerma(i.dataset.maddm, v); } });
  // experiencia
  $$("[data-xpsel]", el).forEach(i => i.onchange = () => { i.checked ? ui.xpSel.add(i.dataset.xpsel) : ui.xpSel.delete(i.dataset.xpsel); });
  const note = now => { const v = $("#mxpv", el), t = $("#mxpt", el), before = mandoOf(store.get()).xpn.length;
    document.activeElement && document.activeElement.blur();
    addXPNote([...ui.xpSel], v.value, t.value);
    const after = mandoOf(store.get()); if (after.xpn.length > before) { if (now) grantXPNotes([after.xpn[0].id]); toast(now ? "PX concedidos." : "Anotado."); } };
  on("#mxpadd", () => note(false)); on("#mxpnow", () => note(true));
  on("[data-xpg]", b => grantXPNotes([b.dataset.xpg]));
  on("#mxpall", () => grantXPNotes(mandoOf(store.get()).xpn.filter(n => !n.done).map(n => n.id)));
  on("[data-xpd]", b => dropXPNote(b.dataset.xpd));
  on("#mlvlall", () => partyChars(store.get()).filter(c => canLevelUp(c) && !levelGranted(c)).forEach(c => grantLevel(c.id, true)));
  // botín
  bindLoot(el);
  // futuro
  { const t = $("#mftag", el); if (t) t.onchange = () => { ui.fnew = t.value; }; }
  on("#mfadd", () => { const t = $("#mftxt", el); const v = t.value; t.blur(); addFuture(v, ui.fnew); });
  on("[data-mft]", b => { ui.ftag = b.dataset.mft; redraw(); });
  $$("[data-fdone]", el).forEach(i => i.onchange = () => toggleFuture(i.dataset.fdone));
  on("[data-fdel]", b => dropFuture(b.dataset.fdel));
  // reglas
  { const q = $("#mrq", el); if (q) q.oninput = () => { ui.rq = q.value; const pos = q.selectionStart; redraw(); const q2 = $("#mrq", el); if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); } }; }
  { const g = $("#mrg", el); if (g) g.oninput = () => { ui.rgrp = g.value; }; }
  on("[data-radd]", b => { const [k, ref, label] = b.dataset.radd.split("|"); addRule(k, ref, label, ui.rgrp); });
  on("[data-ropen]", b => { const i = b.dataset.ropen.indexOf("|"); openRule(b.dataset.ropen.slice(0, i), b.dataset.ropen.slice(i + 1)); });
  on("[data-rdel]", b => dropRule(b.dataset.rdel));
  on("[data-rup]", b => moveRule(b.dataset.rup, -1));
}
