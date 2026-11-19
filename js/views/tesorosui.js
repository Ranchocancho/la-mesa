// Interfaz de objetos especiales y cuaderno: en la ficha completa (Personajes), en la ficha de bolsillo
// (pestaña Personaje, fuera de combate) y la ventana del máster para regalar un objeto.
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { getImage, putImage, readImageFile } from "../core/images.js";
import { TKINDS, giveTreasure, editTreasure, dropTreasure, addNote, editNote, dropNote, shareNote } from "../core/tesoros.js";
import { $, $$, esc, toast, debounce, pickFile } from "../core/ui.js";

const when = t => t.session || new Date(t.at).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
let openT = null, noteFilter = "all";

/* ---------- Objetos especiales ---------- */
export function treasuresHTML(c, { dm = false, edit = false, compact = false } = {}) {
  const list = c.treasures || [];
  if (!list.length) return `<p class="empty">${compact ? "Nada especial todavía. Los sellos, regalos o reliquias que os den aparecerán aquí." : "Sin objetos especiales. Aquí van los sellos, ofrendas, cartas, reliquias o regalos que no son simple equipo."}</p>`;
  return `<div class="tes ${compact ? "compact" : ""}">${list.map(t => {
    const k = TKINDS[t.kind] || TKINDS.regalo, open = !compact || openT === t.id, showSecret = t.secret && (dm || t.revealed);
    return `<article class="tcard2 ${open ? "open" : ""}" data-tes="${t.id}">
      <header data-topen="${t.id}">${t.img ? `<i class="timg" data-timg="${esc(t.img)}"></i>` : `<i class="tic">${k[0]}</i>`}
        <div>${edit ? `<input class="tname" data-tf="name" value="${esc(t.name)}" aria-label="Nombre">` : `<b>${esc(t.name)}</b>`}<small>${k[1]}${t.from ? ` · de ${esc(t.from)}` : ""}${t.where ? ` · ${esc(t.where)}` : ""} · ${esc(when(t))}</small></div></header>
      ${open ? `<div class="tbody">
        ${edit ? `<div class="trow"><select data-tf="kind">${Object.entries(TKINDS).map(([kk, v]) => `<option value="${kk}" ${t.kind === kk ? "selected" : ""}>${v[0]} ${v[1]}</option>`).join("")}</select><input data-tf="from" value="${esc(t.from || "")}" placeholder="¿Quién te lo dio?"><input data-tf="where" value="${esc(t.where || "")}" placeholder="¿Dónde?"></div>
          <textarea data-tf="text" rows="2" placeholder="Cómo es, qué se sabe…">${esc(t.text || "")}</textarea>` : t.text ? `<p>${esc(t.text)}</p>` : ""}
        ${dm ? `<div class="tsecret"><span class="tag secret">SOLO MÁSTER</span><textarea data-tf="secret" rows="2" placeholder="Lo que aún no saben (propiedades, maldición, a quién pertenecía…)">${esc(t.secret || "")}</textarea>
          <label class="switch"><input type="checkbox" data-trev ${t.revealed ? "checked" : ""}> Revelado al jugador</label></div>` : showSecret ? `<p class="tdisc">🔍 <b>Descubierto:</b> ${esc(t.secret)}</p>` : ""}
        ${edit ? `<div class="row"><button class="btn small" data-timgup>🖼 Ilustración</button><button class="btn small danger" data-tdel>Quitar</button></div>` : ""}</div>` : ""}
    </article>`; }).join("")}</div>`;
}
export function bindTreasures(root, c, rerender) {
  $$("[data-timg]", root).forEach(i => getImage(i.dataset.timg).then(u => { if (u) i.style.backgroundImage = `url('${u}')`; }));
  $$("[data-topen]", root).forEach(h => h.onclick = e => { if (e.target.closest("input,select,textarea,button")) return; const id = h.dataset.topen; if (!root.querySelector(".tes.compact")) return; openT = openT === id ? null : id; rerender(); });
  $$("[data-tes]", root).forEach(box => {
    const tid = box.dataset.tes, save = debounce((k, v) => editTreasure(c.id, tid, t => { t[k] = v; }, "field"), 350);
    $$("[data-tf]", box).forEach(i => i.addEventListener(i.tagName === "SELECT" ? "change" : "input", () => save(i.dataset.tf, i.value)));
    const rv = $("[data-trev]", box); if (rv) rv.onchange = () => editTreasure(c.id, tid, t => { t.revealed = rv.checked; });
    const del = $("[data-tdel]", box); if (del) del.onclick = () => { if (!del.dataset.sure) { del.dataset.sure = 1; del.textContent = "¿Seguro?"; return; } dropTreasure(c.id, tid); };
    const up = $("[data-timgup]", box); if (up) up.onclick = async () => { const f = await pickFile(); if (!f) return;
      try { const r = await readImageFile(f, 900), key = "tes-" + tid + "-" + Date.now().toString(36); await putImage(key, r.dataURL); editTreasure(c.id, tid, t => { t.img = key; }); } catch (e) { toast("No se pudo cargar la imagen."); } };
  });
}

/* ---------- Cuaderno ---------- */
export function journalHTML(c, { limit = 0, edit = true } = {}) {
  let list = c.journal || [];
  if (noteFilter === "star") list = list.filter(n => n.star);
  const shown = limit ? list.slice(0, limit) : list;
  return `<div class="jour">${edit ? `<div class="jadd"><textarea id="jtext" rows="2" placeholder="Apunta algo: un nombre, una pista, una promesa…"></textarea><div class="row"><label class="chk"><input type="checkbox" id="jstar"> ⭐ Descubrimiento</label><span class="grow"></span><button class="btn small gold" id="jgo">Anotar</button></div></div>` : ""}
    <div class="jfil"><button class="btn small" data-jf="all" aria-pressed="${noteFilter === "all"}">Todas <small>${(c.journal || []).length}</small></button><button class="btn small" data-jf="star" aria-pressed="${noteFilter === "star"}">⭐ Descubrimientos <small>${(c.journal || []).filter(n => n.star).length}</small></button></div>
    ${shown.map(n => `<div class="jnote ${n.star ? "star" : ""}" data-note="${n.id}"><div class="jmeta"><small>${esc(when(n))}</small>${n.shared ? `<small class="jsh">compartida</small>` : ""}<span class="grow"></span>${edit ? `<button class="flic" data-jstar title="Descubrimiento">${n.star ? "⭐" : "☆"}</button>${n.shared ? "" : `<button class="flic" data-jshare title="Compartir con el grupo (crónica)">📣</button>`}<button class="flic" data-jdel title="Borrar">🗑</button>` : ""}</div>
      ${edit ? `<textarea data-jtext rows="${Math.min(6, Math.max(1, Math.ceil(n.text.length / 46)))}">${esc(n.text)}</textarea>` : `<p>${esc(n.text)}</p>`}</div>`).join("") || `<p class="empty">${noteFilter === "star" ? "Sin descubrimientos marcados." : "El cuaderno está vacío."}</p>`}
    ${limit && list.length > limit ? `<a class="btn small" href="#personajes">Ver todo el cuaderno (${list.length})</a>` : ""}</div>`;
}
export function bindJournal(root, c, rerender) {
  const go = $("#jgo", root);
  if (go) { const t = $("#jtext", root); go.onclick = () => { addNote(c.id, t.value, $("#jstar", root).checked); t.value = ""; }; t.onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) go.click(); }; }
  $$("[data-jf]", root).forEach(b => b.onclick = () => { noteFilter = b.dataset.jf; rerender(); });
  $$("[data-note]", root).forEach(box => {
    const nid = box.dataset.note, save = debounce(v => editNote(c.id, nid, n => { n.text = v; }, "field"), 400);
    const ta = $("[data-jtext]", box); if (ta) ta.oninput = () => save(ta.value);
    const st = $("[data-jstar]", box); if (st) st.onclick = () => editNote(c.id, nid, n => { n.star = !n.star; });
    const sh = $("[data-jshare]", box); if (sh) sh.onclick = () => shareNote(c.id, nid);
    const dl = $("[data-jdel]", box); if (dl) dl.onclick = () => { if (!dl.dataset.sure) { dl.dataset.sure = 1; dl.textContent = "¿?"; return; } dropNote(c.id, nid); };
  });
}

/* ---------- El máster regala un objeto ---------- */
export function openGiveDialog() {
  const s = store.get(); if (!isDM(s)) return;
  const pcs = s.characters; let who = new Set(), kind = "regalo", img = null;
  const ov = document.createElement("div"); ov.className = "reqdlg";
  ov.innerHTML = `<div class="modalbox"><header><h3>🎁 Dar un objeto especial</h3><button class="x" data-close aria-label="Cerrar">✕</button></header>
    <div class="rqtabs" id="gkinds">${Object.entries(TKINDS).map(([k, v]) => `<button class="btn small" data-gk="${k}" aria-pressed="${k === kind}">${v[0]} ${v[1]}</button>`).join("")}</div>
    <label class="field">Nombre<input id="gname" placeholder="Sello de la Casa Varn"></label>
    <div class="cols2"><label class="field">Quién se lo da<input id="gfrom" placeholder="Elvira, la posadera"></label><label class="field">Dónde<input id="gwhere" placeholder="El Ciervo Rojo"></label></div>
    <label class="field">Lo que ven y saben<textarea id="gtext" rows="2" placeholder="Un sello de lacre rojo con un ciervo coronado…"></textarea></label>
    <div class="secretbox"><label class="field"><span><span class="tag secret">SOLO MÁSTER</span> Lo que aún no saben</span><textarea id="gsec" rows="2" placeholder="Abre la cámara bajo el campanario."></textarea></label></div>
    <div class="row"><button class="btn small" id="gimg">🖼 Ilustración (opcional)</button><small id="gimgok" class="note" style="border:0;margin:0;padding:0"></small></div>
    <div class="rqwho">${pcs.map(c => `<button class="btn small" data-gc="${c.id}" aria-pressed="false">${esc(c.name.split(" ")[0])}</button>`).join("")}</div>
    <footer><span class="note" id="gsum">Elige a quién</span><span class="grow"></span><button class="btn gold" id="ggo">Dar objeto</button></footer></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  $("[data-close]", ov).onclick = close; ov.addEventListener("click", e => { if (e.target === ov) close(); });
  $$("[data-gk]", ov).forEach(b => b.onclick = () => { kind = b.dataset.gk; $$("[data-gk]", ov).forEach(x => x.setAttribute("aria-pressed", x === b)); });
  $$("[data-gc]", ov).forEach(b => b.onclick = () => { const id = b.dataset.gc; who.has(id) ? who.delete(id) : who.add(id); b.setAttribute("aria-pressed", who.has(id)); $("#gsum", ov).textContent = who.size ? `Para ${who.size} personaje(s)` : "Elige a quién"; });
  $("#gimg", ov).onclick = async () => { const f = await pickFile(); if (!f) return; try { const r = await readImageFile(f, 900); img = "tes-" + Date.now().toString(36); await putImage(img, r.dataURL); $("#gimgok", ov).textContent = "✓ Ilustración lista"; } catch (e) { toast("No se pudo cargar la imagen."); } };
  $("#ggo", ov).onclick = () => {
    const name = $("#gname", ov).value.trim(); if (!name) return toast("Ponle nombre al objeto.");
    if (!who.size) return toast("Elige al menos un personaje.");
    giveTreasure([...who], { kind, name, from: $("#gfrom", ov).value.trim(), where: $("#gwhere", ov).value.trim(), text: $("#gtext", ov).value.trim(), secret: $("#gsec", ov).value.trim(), img });
    toast(`🎁 ${name} entregado`); close();
  };
}
