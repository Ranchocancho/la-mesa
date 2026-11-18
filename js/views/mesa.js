// La mesa táctica dentro de la Partida: tablero, columna de iniciativa y mini-ficha (HUD) plegable.
import { store } from "../core/store.js";
import { isDM, currentUser } from "../core/session.js";
import { createBoard, healthWord } from "./tablero.js";
import { hpOf, charOf, order, rollFoes, startCombat, nextTurn, endCombat, applyHP } from "../core/mesa.js";
import { $, $$, esc, pickFile, toast } from "../core/ui.js";
import { putImage, readImageFile } from "../core/images.js";
import { SILUETAS } from "../data/siluetas.js";
import { ESTADOS, estado, etiqueta } from "../data/estados.js";
import { EFECTOS } from "../data/efectos.js";
import { computeVision, explored } from "../core/vision.js";

// Nombres de las miniaturas 3D (los modelos están en assets/kaykit/minis)
export const MINI_NAMES = { peana: "Peana de cartón", Skeleton_Minion: "Esqueleto", Skeleton_Warrior: "Esqueleto guerrero", Skeleton_Rogue: "Esqueleto pícaro", Skeleton_Mage: "Esqueleto mago", Knight: "Caballero", Barbarian: "Bárbaro", Mage: "Mago", Rogue: "Pícaro", Rogue_Hooded: "Encapuchado" };

let want3d = true;
let editOpen = false, condPick = null, lastArea = null;
let hudOpen = !(window.matchMedia && window.matchMedia("(max-width: 900px)").matches);

export function mountTactical(host, opts = {}) {
  host.innerHTML = `<div class="tactical"><div class="boardwrap"></div><aside class="initcol" aria-label="Iniciativa"></aside><div class="hud"></div>
    <button class="btn small viewtoggle" id="v3d" title="Cambiar entre la mesa en 3D y el plano en 2D"></button></div>`;
  const bw = $(".boardwrap", host), ini = $(".initcol", host), hud = $(".hud", host);
  let sel = null, sceneId = store.get().board && store.get().board.scene, board = null;
  const S = () => store.get();
  const me = () => (currentUser(S()) || {}).id;
  const bopts = {
    model: () => ({ grid: S().board, tokens: S().tokens }),
    dm: isDM(S()), edit: !!opts.edit && isDM(S()),
    canMove: t => isDM(S()) || (!!t.owner && t.owner === me()),
    mutate: (label, fn) => store.commit(label === "token" ? "token" : "board", s => fn({ grid: s.board, tokens: s.tokens })),
    decorate: t => { const c = charOf(S(), t); return { ...(c ? { name: c.name, color: c.color, portrait: c.portrait } : {}), isTurn: S().board.turn === t.id }; },
    hpOf: t => hpOf(S(), t),
    onSelect: id => { sel = id; drawHud(); },
    charOf: t => charOf(S(), t),
    chars: () => S().characters,
    setFog: v => store.commit("board", st => { st.board.fog = v; }),
    fogState: () => { const s = S(); if (isDM(s) || !s.board.fog) return null; const vis = computeVision(s.board, s.tokens, s.characters); return { vis, exp: explored((s.board.scene || "mesa") + "", vis) }; },
    setAmbient: k => store.commit("board", st => { st.board.ambient = k; })
  };
  const use3d = () => want3d && !opts.edit;
  function mountBoard() {
    if (board && board.dispose) board.dispose();
    bw.innerHTML = ""; bw.className = "boardwrap"; board = null;
    const tg = $("#v3d", host); tg.textContent = use3d() ? "Ver plano 2D" : "Ver mesa 3D"; tg.hidden = !!opts.edit;
    if (use3d()) import("./tablero3d.js").then(m => { if (!m.webglOK) throw new Error("sin WebGL"); board = m.createBoard3D(bw, bopts); if (sel) board.select(sel); drawHud(); })
      .catch(e => { console.warn("Vista 3D no disponible", e); want3d = false; mountBoard(); });
    else board = createBoard(bw, bopts);
  }
  $("#v3d", host).onclick = () => { want3d = !want3d; mountBoard(); };
  mountBoard();

  function drawInit() {
    const s = S(), dm = isDM(s), b = s.board;
    const vis = t => dm || !t.hidden;
    const o = order(s).filter(vis), rest = s.tokens.filter(t => vis(t) && !o.includes(t));
    const name = t => esc((charOf(s, t) || t).name);
    const row = t => {
      const h = hpOf(s, t), mine = t.owner && t.owner === me(), turn = b.turn === t.id;
      const state = !h ? "" : (dm || t.kind === "pc") ? `${h.cur}/${h.max}` : healthWord(h.cur, h.max);
      const editable = dm || mine;
      return `<div class="inirow ${turn ? "turn" : ""} ${h && h.cur <= 0 ? "down" : ""} ${t.kind}" data-sel="${t.id}">
        ${editable ? `<input type="number" class="ininum" data-init="${t.id}" value="${t.init ?? ""}" placeholder="–" aria-label="Iniciativa de ${name(t)}">` : `<b class="ininum">${t.init ?? "–"}</b>`}
        <span class="ininame">${turn ? "▶ " : ""}${name(t)}${t.hidden ? ` <small>(oculto)</small>` : ""}</span><small class="inistate">${state}${(t.conds || []).map(cd => { const e = estado(cd.id); return e ? ` <i class="cdot" style="background:${e.c}" title="${esc(etiqueta(cd.id, cd.lvl))}"></i>` : ""; }).join("")}</small></div>`;
    };
    ini.innerHTML = `<h2 class="sec">Iniciativa${b.round ? ` · ronda ${b.round}` : ""}</h2>
      <div class="inilist">${o.map(row).join("")}${rest.length ? `<div class="inisep">Sin tirar</div>${rest.map(row).join("")}` : ""}</div>
      ${dm ? `<div class="inibtns">
        <button class="btn small" id="iroll">Tirar enemigos</button>
        ${b.turn ? `<button class="btn gold small" id="inext">Siguiente turno</button><button class="btn small" id="iend">Terminar combate</button>` : `<button class="btn gold small" id="istart" ${o.length ? "" : "disabled"}>Empezar combate</button>`}
      </div>` : `<p class="note" style="margin:8px 0 0">Escribe tu tirada de iniciativa junto a tu personaje.</p>`}`;
    $$("[data-init]", ini).forEach(i => i.onchange = () => store.commit("token", st => { const t = st.tokens.find(x => x.id === i.dataset.init); if (t) t.init = i.value === "" ? null : +i.value; }));
    $$("[data-sel]", ini).forEach(r => r.onclick = e => { if (e.target.tagName !== "INPUT" && board) board.select(r.dataset.sel); });
    const on = (id, fn) => { const x = $("#" + id, ini); if (x) x.onclick = fn; };
    on("iroll", rollFoes); on("istart", startCombat); on("inext", nextTurn); on("iend", endCombat);
  }

  function drawHud() {
    const s = S(), dm = isDM(s);
    const mineT = s.tokens.find(t => t.kind === "pc" && t.owner && t.owner === me());
    const target = s.tokens.find(t => t.id === sel && (dm || !t.hidden));
    const card = (t, title) => {
      const h = hpOf(s, t), c = charOf(s, t), canHurt = dm || (t.owner && t.owner === me());
      const exact = dm || t.kind === "pc";
      const pct = h ? Math.max(0, Math.min(100, h.cur / Math.max(1, h.max) * 100)) : 0;
      return `<div class="hudcard"><small>${title}</small><b>${esc((c || t).name)}</b>
        ${h ? `<div class="hpbar ${pct <= 25 ? "low" : pct <= 50 ? "mid" : ""}"><i style="width:${exact ? pct : pct > 75 ? 100 : pct > 50 ? 70 : pct > 25 ? 45 : pct > 0 ? 15 : 0}%"></i><em>${exact ? `${h.cur}/${h.max} PG${h.temp ? ` +${h.temp}` : ""}` : healthWord(h.cur, h.max)}</em></div>` : ""}
        <div class="hudmeta">${exact ? `CA ${c ? c.ac : t.ac}` : ""}${c ? ` · ${esc(c.cls)} ${c.level}` : ""}</div>
        ${canHurt && h ? `<div class="hpquick"><input type="number" min="0" placeholder="0" data-amt="${t.id}" aria-label="Cantidad"><button class="btn small danger" data-hurt="${t.id}">Daño</button><button class="btn small" data-heal="${t.id}">Curar</button></div>` : ""}
        ${condBlock(t, canHurt)}
        ${canHurt && board && board.pick ? `<details class="castbox"><summary>✨ Lanzar efecto</summary><div class="castlist">${Object.entries(EFECTOS).map(([k, e]) => `<button class="btn small" data-cast="${t.id}|${k}" title="${e.hint || ""}">${e.n}</button>`).join("")}</div></details>` : ""}
        ${dm && t.kind !== "pc" ? `<details class="tkdetails" ${editOpen ? "open" : ""}><summary>Editar ${t.kind === "npc" ? "PNJ" : "enemigo"}</summary>${tokenEditor(t)}</details>` : ""}</div>`;
    };
    hud.classList.toggle("open", hudOpen);
    hud.innerHTML = `<button class="hudtoggle" id="hudt" aria-expanded="${hudOpen}">${hudOpen ? "▾ Ocultar" : "▸ Ficha y objetivo"}</button>
      ${hudOpen ? `<div class="hudbody">${areaBlock(s)}${mineT ? card(mineT, "Tu personaje") : ""}${target && target !== mineT ? card(target, "Objetivo") : ""}${!mineT && !target ? `<p class="empty">Toca una ficha para ver sus datos.</p>` : ""}</div>` : ""}`;
    $("#hudt", hud).onclick = () => { hudOpen = !hudOpen; drawHud(); };
    $$(".tkdetails", hud).forEach(d => d.ontoggle = () => { editOpen = d.open; });
    const amt = id => Math.max(0, +($(`[data-amt="${id}"]`, hud) || {}).value || 0);
    $$("[data-hurt]", hud).forEach(b => b.onclick = () => { const a = amt(b.dataset.hurt); if (a) applyHP(b.dataset.hurt, -a); });
    $$("[data-heal]", hud).forEach(b => b.onclick = () => { const a = amt(b.dataset.heal); if (a) applyHP(b.dataset.heal, a); });
    bindTokenEditor(hud, (id, fn) => store.commit("board", st => { const t = st.tokens.find(x => x.id === id); if (t) fn(t); }));
    const T = (id, fn) => store.commit("token", st => { const t = st.tokens.find(x => x.id === id); if (t) fn(t); });
    $$("[data-addcond]", hud).forEach(b => b.onclick = () => { condPick = condPick === b.dataset.addcond ? null : b.dataset.addcond; drawHud(); });
    $$("[data-cond]", hud).forEach(b => b.onclick = () => { const [id, cid] = b.dataset.cond.split("|"); T(id, t => { t.conds = t.conds || []; const i = t.conds.findIndex(c => c.id === cid); if (i >= 0) t.conds.splice(i, 1); else t.conds.push({ id: cid, lvl: estado(cid).levels ? 1 : undefined }); }); });
    $$("[data-condlvl]", hud).forEach(b => b.onclick = () => { const [id, cid, d] = b.dataset.condlvl.split("|"); T(id, t => { const c = (t.conds || []).find(x => x.id === cid); if (c) { c.lvl = Math.max(1, Math.min(6, (c.lvl || 1) + +d)); } }); });
    $$("[data-cast]", hud).forEach(b => b.onclick = () => {
      const [id, k] = b.dataset.cast.split("|"), e = EFECTOS[k], t = S().tokens.find(x => x.id === id);
      const cast = to => {
        if (!to) return;
        const fx = { id: "fx" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), k, to, at: Date.now() };
        T(id, tk => { tk.fx = fx; });
        if (e.area && isDM(S())) {
          const hit = S().tokens.filter(z => Math.max(Math.abs(z.c - to.c), Math.abs(z.r - to.r)) <= e.area);
          lastArea = { n: e.n, ids: hit.map(z => z.id) };
        }
        drawHud();
      };
      if (e.self) cast({ c: t.c, r: t.r });
      else { toast(`Elige el objetivo de ${e.n} en la mesa${e.area ? " (" + e.hint + ")" : ""} · Esc para cancelar`); board.pick(e.area || 0, cast); }
    });
    $$("[data-area]", hud).forEach(b => b.onclick = () => {
      const amt = Math.max(0, +($("#areadmg", hud) || {}).value || 0); if (!amt || !lastArea) return;
      const half = b.dataset.area === "half", ids = $$("[data-areaid]:checked", hud).map(x => x.dataset.areaid);
      ids.forEach(id => applyHP(id, -(half ? Math.floor(amt / 2) : amt)));
      toast(`${half ? "Mitad de daño" : "Daño"} aplicado a ${ids.length}`); lastArea = null; drawHud();
    });
    const ax = $("#areax", hud); if (ax) ax.onclick = () => { lastArea = null; drawHud(); };
  }

  drawInit(); drawHud();
  return {
    update() {
      const s = S();
      if (!s.board) return;
      if (board && s.board.scene !== sceneId) { sceneId = s.board.scene; board.fit(); }
      if (board) board.render();
      drawInit();
      if (!host.querySelector(".hud input:focus")) drawHud();
    }
  };
}

/* Estados de una ficha: chips de color con su texto, y selector para añadir */
function condBlock(t, canEdit) {
  const conds = t.conds || [];
  if (!conds.length && !canEdit) return "";
  return `<div class="conds">${conds.map(cd => { const e = estado(cd.id); if (!e) return ""; return `<span class="cond" style="--c:${e.c}" title="${esc(e.t)}">${esc(etiqueta(cd.id, cd.lvl))}${canEdit && e.levels ? `<button data-condlvl="${t.id}|${cd.id}|-1" aria-label="Bajar nivel">−</button><button data-condlvl="${t.id}|${cd.id}|1" aria-label="Subir nivel">+</button>` : ""}${canEdit ? `<button data-cond="${t.id}|${cd.id}" aria-label="Quitar ${esc(e.n)}">✕</button>` : ""}</span>`; }).join("")}
      ${canEdit ? `<button class="btn small" data-addcond="${t.id}">${condPick === t.id ? "Cerrar" : "+ Estado"}</button>` : ""}</div>
    ${condPick === t.id ? `<div class="condpick">${ESTADOS.map(e => `<button class="cond ${conds.some(c => c.id === e.id) ? "on" : ""}" style="--c:${e.c}" data-cond="${t.id}|${e.id}" title="${esc(e.t)}">${e.n}</button>`).join("")}</div>` : ""}
    ${conds.length ? `<ul class="condtxt">${conds.map(cd => { const e = estado(cd.id); return e ? `<li><b style="color:${e.c}">${esc(etiqueta(cd.id, cd.lvl))}:</b> ${esc(e.t)}</li>` : ""; }).join("")}</ul>` : ""}`;
}
function areaBlock(s) {
  if (!lastArea || !isDM(s)) return "";
  const list = lastArea.ids.map(id => s.tokens.find(t => t.id === id)).filter(Boolean);
  return `<div class="hudcard areabox"><small>Afectados por ${esc(lastArea.n)}</small>
    ${list.map(t => `<label class="switch"><input type="checkbox" data-areaid="${t.id}" checked> ${esc((charOf(s, t) || t).name)}</label>`).join("") || `<p class="empty">Nadie en el área.</p>`}
    <div class="hpquick"><input type="number" id="areadmg" min="0" placeholder="Daño"><button class="btn small danger" data-area="full">Daño</button><button class="btn small" data-area="half">Mitad (salvan)</button><button class="btn small" id="areax">✕</button></div></div>`;
}

/* Editor de la ficha de un enemigo o PNJ (también lo usa el editor de escenas) */
export function tokenEditor(t) {
  return `<div class="tokedit" data-tokedit="${t.id}">
    <label class="field">Nombre<input data-tk="name" value="${esc(t.name)}"></label>
    <div class="tkgrid">
      <label class="field">PG<input type="number" data-tk="hp" value="${t.hp ?? ""}"></label>
      <label class="field">PG máx.<input type="number" data-tk="maxhp" value="${t.maxhp ?? ""}"></label>
      <label class="field">CA<input type="number" data-tk="ac" value="${t.ac ?? ""}"></label>
      <label class="field">Inic. +<input type="number" data-tk="initBonus" value="${t.initBonus ?? 0}"></label>
      <label class="field">Tamaño<select data-tk="size">${[[1, "Mediano"], [1.6, "Grande"], [2.4, "Enorme"], [0.7, "Pequeño"]].map(([v, n]) => `<option value="${v}" ${+t.size === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="field">Miniatura<select data-tk="mini"><option value="">Automática</option>${Object.entries(MINI_NAMES).map(([k, n]) => `<option value="${k}" ${t.mini === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="field">Tipo<select data-tk="kind"><option value="foe" ${t.kind === "foe" ? "selected" : ""}>Enemigo</option><option value="npc" ${t.kind === "npc" ? "selected" : ""}>PNJ</option></select></label>
    </div>
    <div class="tkgrid" style="grid-template-columns:1fr auto"><label class="field">Silueta de la peana<select data-tk="icon"><option value="">Según el nombre</option>${SILUETAS.map(([id, n]) => `<option value="${id}" ${t.icon === id ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <div class="row" style="align-self:end"><button class="btn small" data-tkimg="${t.id}">${t.img ? "Cambiar ilustración" : "Subir ilustración"}</button>${t.img ? `<button class="btn small" data-tknoimg="${t.id}">Quitar</button>` : ""}</div></div>
    <div class="row"><label class="switch"><input type="checkbox" data-tk="hidden" ${t.hidden ? "checked" : ""}> Oculto a los jugadores</label><input type="color" data-tk="color" value="${t.color || "#7a2a22"}" aria-label="Color"></div>
  </div>`;
}
export function bindTokenEditor(root, mutate) {
  $$("[data-tkimg]", root).forEach(b => b.onclick = async () => {
    const f = await pickFile(); if (!f) return;
    try { toast("Cargando la ilustración…"); const r = await readImageFile(f, 700); const key = "ilu-" + Math.random().toString(36).slice(2, 9); await putImage(key, r.dataURL); mutate(b.dataset.tkimg, t => { t.img = key; }); }
    catch (e) { toast("No se pudo cargar la imagen. Prueba con un JPG o PNG."); }
  });
  $$("[data-tknoimg]", root).forEach(b => b.onclick = () => mutate(b.dataset.tknoimg, t => { delete t.img; }));
  $$("[data-tokedit]", root).forEach(box => {
    const id = box.dataset.tokedit;
    $$("[data-tk]", box).forEach(i => i.onchange = () => mutate(id, t => {
      const k = i.dataset.tk;
      t[k] = i.type === "checkbox" ? i.checked : i.type === "number" || k === "size" ? +i.value : i.value;
      if (k === "maxhp" && (t.hp == null || t.hp > t.maxhp)) t.hp = t.maxhp;
    }));
  });
}
