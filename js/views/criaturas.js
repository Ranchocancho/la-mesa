// Elegir criaturas para la mesa: buscar, filtrar por tipo y VD, ver su ficha (con la imagen del mundo),
// subirla o bajarla de nivel con vista previa, elegir cuántas y desplegarlas. También editar sus datos.
import { store, uid } from "../core/store.js";
import { srd, srdNow } from "../core/srd.js";
import { isDM } from "../core/session.js";
import { TYPES, CRS, typeOf, withCustom, setCustom, clearCustom, scaleMonster } from "../core/bestiario.js";
import { XP_BY_CR } from "../core/experiencia.js";
import { getImage, putImage, readImageFile } from "../core/images.js";
import { $, $$, esc, toast, pickFile } from "../core/ui.js";
import { npcsForTable, npcMonster } from "../core/pnj.js";
import { VITAL, STANCE } from "../core/contexto.js";

const st = { q: "", type: "", vd: "", sel: null, cr: null, n: 1, edit: false, tab: "bes", npc: null };
const norm = x => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Abre el selector. onAdd(criatura ya escalada, cantidad). */
let hideNew = (() => { try { return localStorage.getItem("lamesa:addhid") !== "0"; } catch (e) { return true; } })();
export async function openCreaturePicker({ onAdd, preselect = null, title = "Añadir criaturas" } = {}) {
  const M = srdNow.monstruos || await srd("monstruos");
  if (preselect) { st.sel = preselect; st.cr = null; }
  const back = document.createElement("div"); back.className = "cpmodal"; document.body.appendChild(back);
  const close = () => { back.remove(); removeEventListener("keydown", esc_); };
  const esc_ = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", esc_);
  back.onclick = e => { if (e.target === back) close(); };
  const draw = () => {
    const s = store.get(), dm = isDM(s);
    if (st.tab === "pnj") return drawNpcs(s);
    const list = M.filter(m => (!st.q || norm(m.n).includes(norm(st.q))) && (!st.type || typeOf(m) === st.type) && (!st.vd || m.vd === st.vd));
    const base = withCustom(s, M.find(m => m.n === st.sel)) || null, cur = base && scaleMonster(base, st.cr || base.vd);
    const counts = Object.fromEntries(TYPES.map(t => [t, M.filter(m => typeOf(m) === t).length]));
    const cust = base && (s.bestiary || {})[base.n] || {};
    back.innerHTML = `<div class="cpbox" role="dialog" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="x" aria-label="Cerrar">✕</button></header>
      ${tabs()}
      <div class="cpfilters"><input type="search" id="cpq" placeholder="Buscar (bandido, lobo, esqueleto…)" value="${esc(st.q)}">
        <select id="cpvd"><option value="">Cualquier VD</option>${CRS.filter(v => M.some(m => m.vd === v)).map(v => `<option ${st.vd === v ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="cptypes"><button data-ty="" aria-pressed="${!st.type}">Todas</button>${TYPES.map(t => `<button data-ty="${t}" aria-pressed="${st.type === t}">${t} <small>${counts[t]}</small></button>`).join("")}</div>
      <div class="cpbody"><div class="cplist">${list.map(m => { const c = withCustom(s, m); return `<button class="cpitem ${st.sel === m.n ? "on" : ""}" data-cm="${esc(m.n)}">${c.img ? `<i class="cpimg" data-img="${esc(c.img)}"></i>` : `<i class="cpimg ph">${esc(typeOf(m)[0])}</i>`}<span><b>${esc(m.n)}</b><small>${esc(typeOf(m))} · VD ${m.vd}</small></span><em>${c.pg} PG</em></button>`; }).join("") || `<p class="empty">Nada con esos filtros.</p>`}</div>
        <div class="cpdetail">${cur ? `
          <div class="cphead">${cur.img ? `<div class="cpport" data-img="${esc(cur.img)}"></div>` : ""}<div><h3>${esc(cur.n)}</h3><p class="note">${esc(cur.tipo)}</p></div></div>
          <div class="cpstats"><span><small>CA</small><b>${cur.ca}</b></span><span><small>PG</small><b>${cur.pg}</b></span><span><small>VD</small><b>${cur.vd}</b></span><span><small>PX</small><b>${(XP_BY_CR[String(cur.vd)] ?? 0).toLocaleString("es-ES")}</b></span><span><small>Vel.</small><b>${esc(String(cur.vel).split(", ")[0])}</b></span></div>
          <div class="cpatks">${(cur.atk || []).map(a => `<div><b>${esc(a.name)}</b> <span>${esc(a.atk)} · ${esc(a.dmg)}</span> <small>${esc(a.rng || "")}</small></div>`).join("") || `<p class="note">Sin ataques en el compendio.</p>`}</div>
          ${cur.notas ? `<p class="cpnotes">${esc(cur.notas)}</p>` : ""}
          <div class="cplevel"><label>Nivel (VD)<select id="cpcr">${CRS.map(v => `<option ${String(cur.vd) === v ? "selected" : ""} value="${v}">${v}${v === String(base.vd) ? " · original" : ""}</option>`).join("")}</select></label>
            ${cur.scaledFrom ? `<small class="note">Ajustada desde VD ${esc(cur.scaledFrom)}: PG, CA, ataque y daño escalados.</small>` : `<small class="note">Súbela o bájala de nivel para adaptarla al grupo.</small>`}</div>
          ${onAdd ? `<div class="cpadd"><label>Cuántas<input type="number" id="cpn" min="1" max="20" value="${st.n}"></label><button class="btn gold" id="cpgo">Desplegar ${st.n > 1 ? st.n + " × " : ""}${esc(cur.n)}</button><label class="chk" title="No las verán hasta que las muestres (🙈 en su ficha del máster o «Mostrar ocultos» en la barra). Además, los jugadores solo ven lo que sus personajes alcanzan a ver."><input type="checkbox" id="cphid" ${hideNew ? "checked" : ""}> 🙈 Ocultas a los jugadores</label></div>` : ""}
          ${dm ? `<details class="cpedit" ${st.edit ? "open" : ""}><summary>✎ Editar en este mundo</summary>
            <div class="row"><button class="btn small" id="cpimg">${cust.img ? "Cambiar imagen" : "+ Imagen"}</button>${cust.img ? `<button class="btn small" id="cpnoimg">Quitar imagen</button>` : ""}</div>
            <div class="row"><label>CA<input type="number" id="cpca" value="${esc(cust.ca ?? "")}" placeholder="${base.ca}"></label><label>PG<input type="number" id="cppg" value="${esc(cust.pg ?? "")}" placeholder="${M.find(m => m.n === base.n).pg}"></label></div>
            <label class="field">Notas del máster<textarea id="cpnotas" rows="2">${esc(cust.notas || "")}</textarea></label>
            <div class="row"><button class="btn small gold" id="cpsave">Guardar</button>${base.custom ? `<button class="btn small danger" id="cpreset">Volver al original</button>` : ""}</div></details>` : ""}
        ` : `<p class="empty">Elige una criatura de la lista.</p>`}</div></div></div>`;
    $(".x", back).onclick = close; bindTabs();
    const q = $("#cpq", back); q.oninput = () => { st.q = q.value; const p = q.selectionStart; draw(); const n = $("#cpq", back); n.focus(); n.setSelectionRange(p, p); };
    $("#cpvd", back).onchange = e => { st.vd = e.target.value; draw(); };
    $$("[data-ty]", back).forEach(b => b.onclick = () => { st.type = b.dataset.ty; draw(); });
    $$("[data-cm]", back).forEach(b => b.onclick = () => { st.sel = b.dataset.cm; st.cr = null; draw(); });
    const cr = $("#cpcr", back); if (cr) cr.onchange = () => { st.cr = cr.value; draw(); };
    const n = $("#cpn", back); if (n) n.oninput = () => { st.n = Math.max(1, Math.min(20, +n.value || 1)); const g = $("#cpgo", back); if (g) g.textContent = `Desplegar ${st.n > 1 ? st.n + " × " : ""}${cur.n}`; };
    { const h = $("#cphid", back); if (h) h.onchange = () => { hideNew = h.checked; try { localStorage.setItem("lamesa:addhid", hideNew ? "1" : "0"); } catch (e) { /* */ } }; }
    const go = $("#cpgo", back); if (go) go.onclick = () => { onAdd(cur, st.n, hideNew); toast(`${st.n} × ${cur.n} en la mesa${cur.scaledFrom ? ` (VD ${cur.vd})` : ""}${hideNew ? " · ocultas a los jugadores" : ""}`); close(); };
    const ed = $(".cpedit", back); if (ed) ed.ontoggle = () => { st.edit = ed.open; };
    const im = $("#cpimg", back); if (im) im.onclick = async () => { const f = await pickFile(); if (!f) return; try { const r = await readImageFile(f, 1200), key = uid("img"); await putImage(key, r.dataURL); setCustom(base.n, { img: key }); draw(); } catch (e) { toast("No se pudo cargar la imagen."); } };
    const ni = $("#cpnoimg", back); if (ni) ni.onclick = () => { setCustom(base.n, { img: null }); draw(); };
    const sv = $("#cpsave", back); if (sv) sv.onclick = () => { setCustom(base.n, { ca: $("#cpca", back).value, pg: $("#cppg", back).value, notas: $("#cpnotas", back).value }); toast("Guardado en este mundo"); draw(); };
    const rs = $("#cpreset", back); if (rs) rs.onclick = () => { clearCustom(base.n); draw(); };
    $$("[data-img]", back).forEach(async el => { const u = await getImage(el.dataset.img); if (u && el.isConnected) { el.style.backgroundImage = `url('${u}')`; el.textContent = ""; } });
    const on = $(".cpitem.on", back); if (on) on.scrollIntoView({ block: "nearest" });
  };
  // Pestañas: el bestiario del SRD o los PNJ propios del Lore («Disponible en la mesa»)
  function tabs() { const n = npcsForTable(store.get()).length; return `<div class="cptabs"><button data-cptab="bes" aria-pressed="${st.tab === "bes"}">🐉 Bestiario</button><button data-cptab="pnj" aria-pressed="${st.tab === "pnj"}">📖 Mis PNJ <small>${n}</small></button></div>`; }
  function bindTabs() { $$("[data-cptab]", back).forEach(b => b.onclick = () => { st.tab = b.dataset.cptab; draw(); }); }
  function drawNpcs(s) {
    const L = npcsForTable(s).filter(e => !(s.tokens || []).some(t => t.npc === e.id)).filter(e => !st.q || norm(e.name + " " + (e.role || "")).includes(norm(st.q)));
    const e = L.find(x => x.id === st.npc) || L[0], m = e && npcMonster(s, e), pl = e && e.place && s.world.places.find(p => p.id === e.place);
    back.innerHTML = `<div class="cpbox" role="dialog" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="x" aria-label="Cerrar">✕</button></header>${tabs()}
      <div class="cpfilters"><input type="search" id="cpq" placeholder="Buscar PNJ por nombre o papel…" value="${esc(st.q)}"></div>
      <div class="cpbody"><div class="cplist">${L.map(x => `<button class="cpitem ${e && x.id === e.id ? "on" : ""}" data-np="${x.id}">${x.img ? `<i class="cpimg" data-img="${esc(x.img)}"></i>` : `<i class="cpimg">👤</i>`}<b>${esc(x.name)}</b><small>${esc([x.role, (STANCE[x.stance || "neutral"] || [])[1]].filter(Boolean).join(" · "))}</small></button>`).join("")
        || `<p class="empty">Aún no hay PNJ en la lista. Créalos en <a href="#lore/s:npc">Lore › Personajes</a>, rellena su «Ficha de combate» y marca «Disponible en la mesa».</p>`}</div>
        <div class="cpdetail">${m ? `<div class="cphead">${m.img ? `<div class="cpport" data-img="${esc(m.img)}"></div>` : ""}<div><h3>${esc(e.name)}</h3><p class="note">${esc([e.role, pl && pl.name, e.combat.base ? "base: " + e.combat.base : "ficha propia"].filter(Boolean).join(" · "))}</p></div></div>
          <div class="cpstats"><span><small>CA</small><b>${m.ca}</b></span><span><small>PG</small><b>${m.pg}/${m.pgMax}</b></span><span><small>VD</small><b>${esc(String(m.vd))}</b></span><span><small>Estado</small><b>${(VITAL[e.vital || "vivo"] || []).join(" ")}</b></span><span><small>Actitud</small><b>${(STANCE[e.stance || "neutral"] || []).join(" ")}</b></span></div>
          <div class="cpatks">${m.atk.map(a => `<div><b>${esc(a.name)}</b> <span>${esc(a.atk)} · ${esc(a.dmg)}</span> <small>${esc(a.rng)}</small></div>`).join("") || `<p class="note">Sin ataques.</p>`}</div>
          <p class="note">${m.kind === "foe" ? "Hostil: sale como enemigo." : "Sale como PNJ (aliado o neutral). Si se vuelve hostil, cambia su actitud en el Lore."}</p>
          ${onAdd ? `<div class="cpadd"><button class="btn gold" id="cpnpc">Poner a ${esc(e.name.split(" ")[0])} en la mesa</button><label class="chk"><input type="checkbox" id="cphid" ${hideNew ? "checked" : ""}> Oculto a los jugadores</label></div>` : ""}
          <a class="btn small" href="#lore/${e.id}">📖 Abrir su ficha en el Lore</a>` : `<p class="empty">Elige un PNJ.</p>`}</div></div></div>`;
    $(".x", back).onclick = close; bindTabs();
    const q = $("#cpq", back); q.oninput = () => { st.q = q.value; const p = q.selectionStart; draw(); const n = $("#cpq", back); n.focus(); n.setSelectionRange(p, p); };
    $$("[data-np]", back).forEach(b => b.onclick = () => { st.npc = b.dataset.np; draw(); });
    { const h = $("#cphid", back); if (h) h.onchange = () => { hideNew = h.checked; }; }
    const go = $("#cpnpc", back); if (go) go.onclick = () => { onAdd(m, 1, hideNew); toast(`${e.name} en la mesa`); close(); };
    $$("a[href^='#lore']", back).forEach(a => a.addEventListener("click", close));
    $$("[data-img]", back).forEach(async el => { const u = await getImage(el.dataset.img); if (u && el.isConnected) { el.style.backgroundImage = `url('${u}')`; el.textContent = ""; } });
  }
  draw();
}
