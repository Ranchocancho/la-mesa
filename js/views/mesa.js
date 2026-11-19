// La mesa táctica dentro de la Partida: tablero, columna de iniciativa y mini-ficha (HUD) plegable.
import { store } from "../core/store.js";
import { isDM, currentUser } from "../core/session.js";
import { createBoard, healthWord, moveCost } from "./tablero.js";
import { hpOf, charOf, order } from "../core/mesa.js";
import { changeHP as applyHP, deathSave } from "../core/salud.js";
import { $, $$, esc, pickFile, toast } from "../core/ui.js";
import { putImage, readImageFile } from "../core/images.js";
import { SILUETAS } from "../data/siluetas.js";
import { ESTADOS, estado, etiqueta } from "../data/estados.js";
import { floatAt } from "./flotantes.js";
import { PROPS } from "../data/mapas.js";
import { propEditorHTML, bindPropEditor } from "./propeditor.js";
import { triggerTrap, announceLoot } from "../core/hechizos.js";
import { EFECTOS } from "../data/efectos.js";
import { computeVision, explored } from "../core/vision.js";
import { renderRolls, visibleRolls } from "./tiradas.js";
import { attacksOf, attack, acOf, nameOf } from "../core/combate.js";
import { phase, current, pending, beginCombat, rollInit, startRounds, endTurn, stopCombat, eco, moveBudget, speedOf, spend, toggle, ACCIONES, rangeOf, inRange, cover, modifiers, dist, metres } from "../core/turnos.js";
import { srd } from "../core/srd.js";
import { publish, mySkin, SKIN_HEX } from "../core/dados.js";

// Nombres de las miniaturas 3D (los modelos están en assets/kaykit/minis)
export const MINI_NAMES = { peana: "Peana de cartón", Skeleton_Minion: "Esqueleto", Skeleton_Warrior: "Esqueleto guerrero", Skeleton_Rogue: "Esqueleto pícaro", Skeleton_Mage: "Esqueleto mago", Knight: "Caballero", Barbarian: "Bárbaro", Mage: "Mago", Rogue: "Pícaro", Rogue_Hooded: "Encapuchado" };

let want3d = true;
let editOpen = false, condPick = null, lastArea = null, sideTab = "ini", atkAdv = null, dmTarget = null, atkIdx = 0, ruleOpen = null, lastTurnSeen = null;
let GLOS = null; srd("glosario").then(g => (GLOS = g));
let hudOpen = !(window.matchMedia && window.matchMedia("(max-width: 900px)").matches);

export function mountTactical(host, opts = {}) {
  host.innerHTML = `<div class="tactical"><div class="boardwrap"></div><aside class="sidecol"><div class="sidetabs" role="tablist"><button role="tab" data-side="ini">Iniciativa</button><button role="tab" data-side="tir">🎲 Tiradas</button></div><div class="initcol" aria-label="Iniciativa"></div><div class="rollcol" hidden></div></aside><div class="hud"></div>
    <button class="btn small viewtoggle" id="v3d" title="Cambiar entre la mesa en 3D y el plano en 2D"></button><div class="turnbar" hidden></div><div class="turnbanner" hidden></div><div class="dboxes l"></div><div class="dboxes r"></div></div>`;
  // Para los jugadores, la iniciativa va en su columna fija de la derecha (opts.sideHost) y el tablero ocupa todo el ancho
  if (opts.sideHost) { $(".sidecol", host).remove(); $(".tactical", host).classList.add("noside"); opts.sideHost.innerHTML = `<div class="initcol" aria-label="Iniciativa"></div>`; }
  const sideRoot = opts.sideHost || host;
  const bw = $(".boardwrap", host), ini = $(".initcol", sideRoot), hud = $(".hud", host), rc = $(".rollcol", host), tb = $(".turnbar", host), banner = $(".turnbanner", host);
  const sideShow = () => { if (!rc) return; $$("[data-side]", host).forEach(b => b.setAttribute("aria-selected", b.dataset.side === sideTab)); ini.hidden = sideTab !== "ini"; rc.hidden = sideTab !== "tir"; if (sideTab === "tir") renderRolls(rc); };
  $$("[data-side]", host).forEach(b => b.onclick = () => { sideTab = b.dataset.side; sideShow(); });
  let rollsSeen = (store.get().rolls || []).length;
  let sel = null, selPropId = null, sceneId = store.get().board && store.get().board.scene, board = null;
  const S = () => store.get();
  const me = () => (currentUser(S()) || {}).id;
  const bopts = {
    model: () => ({ grid: S().board, tokens: S().tokens }),
    dm: isDM(S()), edit: !!opts.edit && isDM(S()),
    // En combate, cada uno mueve su figura solo en su turno; el máster, siempre
    canMove: t => isDM(S()) || (!!t.owner && t.owner === me() && (phase(S()) !== "live" || S().board.turn === t.id)),
    mutate: (label, fn) => {
      let warn = null; const oas = [], traps = [];
      store.commit(label === "token" ? "token" : "board", s => {
        const before = new Map(s.tokens.map(t => [t.id, { c: t.c, r: t.r }]));
        fn({ grid: s.board, tokens: s.tokens });
        // Ataques de oportunidad: salir del alcance de un enemigo que aún tiene su reacción (y no te has destrabado)
        if (phase(s) === "live") for (const t of s.tokens) {
          const o = before.get(t.id); if (!o || (o.c === t.c && o.r === t.r) || (t.conds || []).some(c => c.id === "destrabado")) continue;
          for (const h of s.tokens) {
            if (h.id === t.id || h.hidden || (h.kind === "pc") === (t.kind === "pc")) continue;
            const hp = hpOf(s, h); if (hp && hp.cur <= 0) continue;
            if ((h.conds || []).some(c => ["incapacitado", "inconsciente", "aturdido", "paralizado", "petrificado", "muerto"].includes(c.id)) || eco(s, h).react) continue;
            if (dist(o, h) <= 1 && dist(t, h) > 1 && attacksOf(s, h).some(w => !w.rng.ranged || w.rng.melee)) oas.push({ by: h.id, target: t.id });
          }
        }
        // Trampas: quien pisa una trampa armada la dispara (se revela y se tiran las salvaciones)
        for (const t of s.tokens) { const o = before.get(t.id); if (!o || (o.c === t.c && o.r === t.r)) continue;
          const p = (s.board.props || []).find(x => x.c === t.c && x.r === t.r && (PROPS[x.k] || {}).trap && !x.sprung && !x.disarmed); if (p) traps.push({ p: p.id, t: t.id }); }
        // Movimiento en combate: se descuenta de la velocidad de quien tiene el turno
        if (phase(s) === "live") for (const t of s.tokens) {
          const o = before.get(t.id); if (!o || (o.c === t.c && o.r === t.r) || s.board.turn !== t.id) continue;
          const e = eco(s, t); e.mov = Math.round((e.mov + moveCost(s.board, o, t) * 1.5) * 10) / 10; t.eco = e;
          if (e.mov > moveBudget(s, t) + 0.01) warn = `${nameOf(s, t)} se ha movido ${metres(e.mov / 1.5)} de ${metres(moveBudget(s, t) / 1.5)}: supera su velocidad`;
        }
      });
      if (warn) toast(warn);
      oas.forEach(o => offerOA(o.by, o.target));
      traps.forEach(tr => triggerTrap(tr.p, [tr.t]));
    },
    onProp: p => { selPropId = p.id; hudOpen = true; drawHud(); },
    onSelectProp: id => { selPropId = id; if (id) hudOpen = true; drawHud(); },
    decorate: t => { const c = charOf(S(), t); return { ...(c ? { name: c.name, color: c.color, portrait: c.portrait } : {}), isTurn: S().board.turn === t.id }; },
    hpOf: t => hpOf(S(), t),
    onSelect: id => { sel = id; drawHud(); },
    charOf: t => charOf(S(), t),
    chars: () => S().characters,
    setFog: v => store.commit("board", st => { st.board.fog = v; }),
    setSound: v => store.commit("board", st => { st.board.sound = v; }),
    rolls: () => visibleRolls(S()),
    aim: () => aimInfo(),
    rollColor: r => { const t = S().tokens.find(x => x.id === r.tok), c = t && charOf(S(), t); const u = S().users.find(x => x.id === r.who); return (c && c.color) || (u && u.role !== "player" ? "#6a3fb0" : (u && u.color) || "#8a2be2"); },
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

  // Quién actúa: el jugador, su personaje; el máster, la criatura del turno (o el enemigo que tenga seleccionado)
  function actorTok() {
    const s = S(), dm = isDM(s), cur = current(s);
    if (!dm) return s.tokens.find(t => t.kind === "pc" && t.owner === me());
    if (cur && cur.kind !== "pc") return cur;
    const st = s.tokens.find(t => t.id === sel); return st && st.kind !== "pc" ? st : cur;
  }
  function aimInfo() {
    const s = S(), a = actorTok(), t = s.tokens.find(x => x.id === (isDM(s) && a && a.kind !== "pc" ? dmTarget || sel : sel));
    if (!a || !t || a.id === t.id) return null;
    const list = attacksOf(s, a), w = list[Math.min(atkIdx, list.length - 1)];
    const rng = w ? w.rng : { n: 1.5, l: 1.5 }, st = inRange(rng, a, t), cv = cover(s, a, t);
    const col = cv.level === "total" || st === "out" ? "#c4513f" : st === "long" || cv.level ? "#d6aa4e" : "#7ec850";
    const txt = `${metres(dist(a, t))}${w ? ` · ${w.name.replace("✨ ", "")}: ${st === "ok" ? "al alcance" : st === "long" ? "alcance largo" : "fuera de alcance"}` : ""}${cv.level ? ` · ${cv.level === "total" ? "cobertura total" : "cobertura " + cv.level}` : ""}`;
    return { from: a.id, to: t.id, color: col, label: txt };
  }

  function drawInit() {
    const s = S(), dm = isDM(s), b = s.board, ph = phase(s), cur = current(s);
    const vis = t => dm || !t.hidden;
    const o = order(s).filter(vis), rest = s.tokens.filter(t => vis(t) && !o.includes(t));
    const name = t => esc((charOf(s, t) || t).name);
    const row = t => {
      const h = hpOf(s, t), mine = t.owner && t.owner === me(), turn = b.turn === t.id;
      const state = !h ? "" : (dm || t.kind === "pc") ? `${h.cur}/${h.max}` : healthWord(h.cur, h.max);
      const showInit = dm || t.kind === "pc" || ph === "live";
      return `<div class="inirow ${turn ? "turn" : ""} ${h && h.cur <= 0 ? "down" : ""} ${t.kind}" data-sel="${t.id}">
        ${mine && t.init == null && ph ? `<button class="ininum inibtn" data-iroll="${t.id}" title="Tirar iniciativa">🎲</button>` : dm ? `<input type="number" class="ininum" data-init="${t.id}" value="${t.init ?? ""}" placeholder="–" aria-label="Iniciativa de ${name(t)}">` : `<b class="ininum">${showInit ? t.init ?? "–" : "?"}</b>`}
        <span class="ininame">${turn ? "▶ " : ""}${name(t)}${t.hidden ? ` <small>(oculto)</small>` : ""}</span><small class="inistate">${state}${(t.conds || []).map(cd => { const e = estado(cd.id); return e ? ` <i class="cdot" style="background:${e.c}" title="${esc(etiqueta(cd.id, cd.lvl))}"></i>` : ""; }).join("")}</small></div>`;
    };
    const missing = pending(s);
    const step = !ph ? `<div class="phase"><b>Fuera de combate</b><span>Movimiento libre. Cuando empiece la pelea, el máster inicia el combate.</span></div>`
      : ph === "init" ? `<div class="phase init"><b>⚔️ ¡Combate! Tirad iniciativa</b><span>${missing.length ? `Faltan: ${missing.map(t => esc(nameOf(s, t))).join(", ")}` : "Todos han tirado. El máster empieza la ronda 1."}</span></div>`
      : `<div class="phase live"><b>Ronda ${b.round}</b><span>Turno de <strong>${esc(cur ? nameOf(s, cur) : "")}</strong></span></div>`;
    ini.innerHTML = `${step}
      <div class="inilist">${o.map(row).join("")}${rest.length ? `<div class="inisep">${ph ? "Sin iniciativa" : "En la mesa"}</div>${rest.map(row).join("")}` : ""}</div>
      <div class="inibtns">
        ${dm && !ph ? `<button class="btn gold" id="cbegin">⚔️ Iniciar combate</button>` : ""}
        ${dm && ph === "init" ? `<button class="btn gold" id="cstart">${missing.length ? "Empezar igualmente" : "▶ Empezar ronda 1"}</button>` : ""}
        ${ph === "live" && cur && (dm || cur.owner === me()) ? `<button class="btn gold" id="cnext">Terminar turno ▶</button>` : ""}
        ${dm && ph ? `<button class="btn small" id="cstop">Terminar combate</button>` : ""}
      </div>`;
    $$("[data-init]", ini).forEach(i => i.onchange = () => store.commit("token", st => { const t = st.tokens.find(x => x.id === i.dataset.init); if (t) t.init = i.value === "" ? null : +i.value; }));
    $$("[data-iroll]", ini).forEach(b => b.onclick = e => { e.stopPropagation(); rollInit(b.dataset.iroll); });
    $$("[data-sel]", ini).forEach(r => r.onclick = e => { if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON" && board) board.select(r.dataset.sel); });
    const on = (id, fn) => { const x = $("#" + id, ini); if (x) x.onclick = fn; };
    on("cbegin", () => { beginCombat(); toast("¡Combate! Todos tiran iniciativa"); });
    on("cstart", startRounds); on("cnext", endTurn);
    on("cstop", () => { const x = $("#cstop", ini); if (!x.dataset.sure) { x.dataset.sure = 1; x.textContent = "¿Seguro? Pulsa otra vez"; return; } stopCombat(); });
    drawTurnBar();
  }

  // Cola de turnos sobre la mesa y aviso de cambio de turno
  function drawTurnBar() {
    const s = S(), ph = phase(s), cur = current(s), dm = isDM(s);
    const mine = s.tokens.find(t => t.kind === "pc" && t.owner === me());
    if (ph === "init" && mine && mine.init == null) {
      tb.hidden = false;
      tb.innerHTML = `<div class="tbinit"><b>⚔️ ¡Combate!</b> Tira tu iniciativa <button class="btn gold" data-iroll2="${mine.id}">🎲 Tirar iniciativa</button></div>`;
      $("[data-iroll2]", tb).onclick = () => rollInit(mine.id);
      return;
    }
    if (ph !== "live" || !cur) { tb.hidden = true; return; }
    const o = order(s).filter(t => (dm || !t.hidden) && !(hpOf(s, t) && hpOf(s, t).cur <= 0 && t.kind !== "pc"));
    const i = Math.max(0, o.findIndex(t => t.id === cur.id)), seq = [...o.slice(i), ...o.slice(0, i)];
    tb.hidden = false;
    tb.innerHTML = `<span class="tbround">Ronda ${s.board.round}</span>${seq.map((t, k) => { const c = charOf(s, t); return `<span class="tbchip ${t.kind} ${k === 0 ? "now" : ""}" title="${esc(nameOf(s, t))}"><i style="background:${(c || t).color || "#777"}">${esc(((c || t).name || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase())}</i>${k === 0 ? `<em>${esc(nameOf(s, t))}</em>` : ""}</span>`; }).join("")}`;
    if (s.board.seq !== lastTurnSeen) {
      const first = lastTurnSeen === null; lastTurnSeen = s.board.seq;
      if (!first) {
        const mineNow = cur.owner === me();
        banner.textContent = mineNow ? "¡Es tu turno!" : `Turno de ${nameOf(s, cur)}`;
        banner.className = "turnbanner" + (mineNow ? " mine" : ""); banner.hidden = false;
        clearTimeout(banner._h); banner._h = setTimeout(() => (banner.hidden = true), 2200);
        if (mineNow) import("../core/sonido.js").then(m => m.sound.play("holy"));
        if (board && board.select && mineNow) { sel = null; }
      }
    }
  }

  function propCard(s) {
    if (!selPropId || !isDM(s)) return "";
    const p = (s.board.props || []).find(y => y.id === selPropId); if (!p) { selPropId = null; return ""; }
    return `<div class="hudcard hudprop"><button class="x" aria-label="Cerrar">✕</button>${propEditorHTML(p, { live: !opts.edit })}</div>`;
  }
  function drawHud() {
    const s = S(), dm = isDM(s);
    const ae = document.activeElement; if (ae && hud.contains(ae) && ae.closest(".hudprop") && /INPUT|TEXTAREA/.test(ae.tagName)) return;
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
        ${atkBlock(s, t, canHurt, sel)}
        ${canHurt && board && board.pick ? `<details class="castbox"><summary>✨ Lanzar efecto</summary><div class="castlist">${Object.entries(EFECTOS).map(([k, e]) => `<button class="btn small" data-cast="${t.id}|${k}" title="${e.hint || ""}">${e.n}</button>`).join("")}</div></details>` : ""}
        ${dm && t.kind !== "pc" ? `<details class="tkdetails" ${editOpen ? "open" : ""}><summary>Editar ${t.kind === "npc" ? "PNJ" : "enemigo"}</summary>${tokenEditor(t)}</details>` : ""}</div>`;
    };
    hud.classList.toggle("open", hudOpen);
    const act = actorTok(), cur = current(s), myTurn = phase(s) === "live" && cur && (cur.owner === me() || (dm && cur.kind !== "pc"));
    hud.innerHTML = `<button class="hudtoggle" id="hudt" aria-expanded="${hudOpen}">${hudOpen ? "▾ Ocultar" : "▸ Ficha y objetivo"}</button>
      ${hudOpen ? `<div class="hudbody">${propCard(s)}${myTurn ? turnCard(s, cur) : ""}${areaBlock(s)}${mineT ? card(mineT, "Tu personaje") : ""}${target && target !== mineT ? card(target, "Objetivo") : ""}${!mineT && !target ? `<p class="empty">Toca una ficha para ver sus datos.</p>` : ""}</div>` : ""}`;
    $("#hudt", hud).onclick = () => { hudOpen = !hudOpen; drawHud(); };
    const pc = $(".hudprop", hud);
    if (pc) {
      const id = selPropId, setP = fn => store.commit("board", st => { const x = (st.board.props || []).find(y => y.id === id); if (x) fn(x); });
      $(".hudprop .x", hud).onclick = () => { selPropId = null; drawHud(); };
      bindPropEditor(pc, setP, { reveal: () => setP(p => { p.hidden = false; }), loot: () => announceLoot(id),
        trap: () => { const st = S(), p = st.board.props.find(y => y.id === id), on = st.tokens.filter(t => p && t.c === p.c && t.r === p.r).map(t => t.id); if (!on.length) return toast("No hay nadie en esa casilla."); triggerTrap(id, on); },
        rot: () => setP(p => { p.rot = ((p.rot || 0) + 1) % 4; }), del: () => { store.commit("board", st => { st.board.props = st.board.props.filter(y => y.id !== id); }); selPropId = null; drawHud(); } });
    }
    $$(".tkdetails", hud).forEach(d => d.ontoggle = () => { editOpen = d.open; });
    const amt = id => Math.max(0, +($(`[data-amt="${id}"]`, hud) || {}).value || 0);
    $$("[data-hurt]", hud).forEach(b => b.onclick = () => { const a = amt(b.dataset.hurt); if (a) applyHP(b.dataset.hurt, -a); });
    $$("[data-heal]", hud).forEach(b => b.onclick = () => { const a = amt(b.dataset.heal); if (a) applyHP(b.dataset.heal, a); });
    bindTokenEditor(hud, (id, fn) => store.commit("board", st => { const t = st.tokens.find(x => x.id === id); if (t) fn(t); }));
    const T = (id, fn) => store.commit("token", st => { const t = st.tokens.find(x => x.id === id); if (t) fn(t); });
    $$("[data-addcond]", hud).forEach(b => b.onclick = () => { condPick = condPick === b.dataset.addcond ? null : b.dataset.addcond; drawHud(); });
    $$("[data-cond]", hud).forEach(b => b.onclick = () => { const [id, cid] = b.dataset.cond.split("|"); T(id, t => { t.conds = t.conds || []; const i = t.conds.findIndex(c => c.id === cid); if (i >= 0) t.conds.splice(i, 1); else t.conds.push({ id: cid, lvl: estado(cid).levels ? 1 : undefined }); }); });
    $$("[data-condlvl]", hud).forEach(b => b.onclick = () => { const [id, cid, d] = b.dataset.condlvl.split("|"); T(id, t => { const c = (t.conds || []).find(x => x.id === cid); if (c) { c.lvl = Math.max(1, Math.min(6, (c.lvl || 1) + +d)); } }); });
    $$("[data-atk]", hud).forEach(b => b.onclick = () => {
      const [aid, i] = b.dataset.atk.split("|"), st = S(), a = st.tokens.find(x => x.id === aid);
      const tgt = isDM(st) && a.kind !== "pc" ? dmTarget || sel : sel;
      if (!tgt || tgt === aid) { toast("Elige primero el objetivo: toca un enemigo en la mesa"); return; }
      if (phase(st) === "live" && st.board.turn !== aid && !isDM(st)) { toast("No es tu turno (los ataques fuera de turno son reacciones: márcala y avisa al máster)"); }
      atkIdx = +i;
      const r = attack(aid, tgt, attacksOf(st, a)[+i], atkAdv); atkAdv = null;
      if (r) { sideTab = "tir"; sideShow(); }
      drawHud();
    });
    $$("[data-atkpick]", hud).forEach(b => b.onmouseenter = () => { atkIdx = +b.dataset.atkpick; if (board) board.render(); });
    $$("[data-atkadv]", hud).forEach(b => b.onclick = () => { const v = +b.dataset.atkadv; atkAdv = atkAdv === v ? null : v; drawHud(); });
    $$("[data-eco]", hud).forEach(b => b.onclick = () => toggle(b.dataset.eco.split("|")[0], b.dataset.eco.split("|")[1]));
    $$("[data-acc]", hud).forEach(b => b.onclick = () => {
      const [tid, nm] = b.dataset.acc.split("|"); ruleOpen = nm;
      if (nm === "Correr") spend(tid, "dash");
      else if (nm === "Esquivar" || nm === "Destrabarse") { spend(tid, "act"); store.commit("token", st => { const t = st.tokens.find(x => x.id === tid); t.conds = (t.conds || []).filter(c => c.id !== (nm === "Esquivar" ? "esquivando" : "destrabado")); t.conds.push({ id: nm === "Esquivar" ? "esquivando" : "destrabado", seq: st.board.seq }); }); }
      else if (nm !== "Atacar" && nm !== "Magia") spend(tid, "act");
      drawHud();
    });
    $$("[data-rule]", hud).forEach(b => b.onclick = () => { ruleOpen = ruleOpen === b.dataset.rule ? null : b.dataset.rule; drawHud(); });
    const et = $("#endturn", hud); if (et) et.onclick = endTurn;
    const dt = $("#dmtarget", hud); if (dt) dt.onchange = () => { dmTarget = dt.value || null; };
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

  // Cajetillas de dados de cada uno, a los lados del tablero; se abren cuando su dueño tira
  const opened = new Map(); let boxSeen = new Set((S().rolls || []).map(r => r.id)), boxSig = "";
  function drawBoxes() {
    const s = S(), onBoard = new Set((s.tokens || []).filter(t => t.kind === "pc").map(t => t.owner));
    const people = s.users.filter(u => u.role !== "player" || onBoard.has(u.id) || u.id === me());
    visibleRolls(s).forEach(r => { if (!boxSeen.has(r.id)) { boxSeen.add(r.id); if (r.dice && r.dice.length) { opened.set(r.who, Date.now()); setTimeout(drawBoxes, 4600); } } });
    const skinOf = id => { const r = [...(s.rolls || [])].reverse().find(x => x.who === id && x.skin); return r ? r.skin : (id === me() ? mySkin() : "rubi"); };
    const html = people.map(u => { const open = Date.now() - (opened.get(u.id) || 0) < 4500, ch = s.characters.find(c => c.owner === u.id);
      return `<button class="dbox${open ? " open" : ""}${u.id === me() ? " mine" : ""}" data-dbox="${u.id}" style="--c:${esc(u.color || "#d6aa4e")};--skin:${SKIN_HEX[skinOf(u.id)] || "#a3122a"}" title="${u.id === me() ? "Tus dados: pulsa para tirar" : "Dados de " + esc(u.name)}">
        <span class="lid"></span><span class="body"><i></i><i></i><i></i></span><small>${esc(ch && u.role === "player" ? ch.name.split(" ")[0] : u.name.split(" ")[0])}</small></button>`; });
    const half = Math.ceil(html.length / 2), sig = html.join("");
    if (sig === boxSig) return; boxSig = sig;
    $(".dboxes.l", host).innerHTML = html.slice(0, half).join(""); $(".dboxes.r", host).innerHTML = html.slice(half).join("");
    $$("[data-dbox]", host).forEach(b => b.onclick = () => { if (b.dataset.dbox === me()) { sideTab = "tir"; sideShow(); const p = document.getElementById("trpad"); if (p) p.scrollIntoView({ block: "nearest" }); } });
  }
  host.addEventListener("click", e => { const b = e.target.closest("[data-death]"); if (b) deathSave(b.dataset.death); });
  // Texto flotante sobre las figuras: daño, curación, estados, fallos, críticos y salvaciones
  const screenOf = id => { if (bw.__screenOf) return bw.__screenOf(id); const g = bw.querySelector(`[data-tok="${id}"]`); if (!g) return null; const r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top]; };
  const snapOf = s => new Map(s.tokens.map(t => { const h = hpOf(s, t); return [t.id, { hp: h ? h.cur : null, conds: (t.conds || []).map(c => c.id), pc: t.kind === "pc" }]; }));
  let snap = snapOf(S()); const fbSeen = new Set(visibleRolls(S()).map(r => r.id + ":" + (r.status !== "pending")));
  function feedback() {
    const s = S(), now = snapOf(s);
    for (const [id, v] of now) {
      const o = snap.get(id), p = o && screenOf(id); if (!p) continue;
      if (o.hp != null && v.hp != null && v.hp !== o.hp) {
        const d = v.hp - o.hp; floatAt(p[0], p[1], d < 0 ? `−${-d}` : `+${d}`, d < 0 ? "dmg" : "heal", { big: Math.abs(d) >= 15 });
        if (v.hp === 0 && o.hp > 0) floatAt(p[0], p[1], v.pc ? "Inconsciente" : "¡Cae!", "down", { delay: 450 });
      }
      v.conds.filter(c => !o.conds.includes(c)).forEach((c, i) => { const e = estado(c); if (e) floatAt(p[0], p[1] - 26, "+ " + e.n, "cond", { color: e.c, delay: 300 + i * 250 }); });
      o.conds.filter(c => !v.conds.includes(c)).forEach((c, i) => { const e = estado(c); if (e) floatAt(p[0], p[1] - 26, "− " + e.n, "cond", { color: e.c, delay: 300 + i * 250 }); });
    }
    snap = now;
    for (const r of visibleRolls(s)) {
      const key = r.id + ":" + (r.status !== "pending"); if (fbSeen.has(key)) continue; fbSeen.add(key);
      const wait = r.dice && r.dice.length && r.status === "pending" ? 2600 : r.dice && r.dice.length && !fbSeen.has(r.id + ":false") ? 2600 : 0;
      if (r.kind === "attack" && r.target && r.result && (r.status !== "pending" || isDM(s))) {
        const p = screenOf(r.target); if (p) floatAt(p[0], p[1], r.result === "crit" ? "¡Crítico!" : r.result === "miss" ? "Fallo" : "Impacto", r.result === "crit" ? "crit" : r.result === "miss" ? "miss" : "hit", { delay: wait });
      }
      if (r.kind === "save" && r.tok && r.result) { const p = screenOf(r.tok); if (p) floatAt(p[0], p[1], r.result === "save" ? "✓ Salva" : "✗ Falla", r.result === "save" ? "save" : "fail", { delay: wait }); }
      if (r.saves && r.status === "pending") r.saves.forEach(sv => { if (sv.auto) return; const p = screenOf(sv.t); if (p) floatAt(p[0], p[1], sv.ok ? "✓ Salva" : "✗ Falla", sv.ok ? "save" : "fail", { delay: wait }); });
      if (r.kind === "oa" && r.status === "pending") { const p = screenOf(r.tok); if (p) floatAt(p[0], p[1], "¡Oportunidad!", "crit"); }
      if (r.kind === "death" && r.result) { const p = screenOf(r.tok); if (p) floatAt(p[0], p[1], r.result === "save" ? "✓ Resiste" : "✗ Se apaga", r.result === "save" ? "save" : "fail", { delay: wait }); }
    }
  }
  if (opts.sideHost) opts.sideHost.addEventListener("click", e => { const b = e.target.closest("[data-death]"); if (b) deathSave(b.dataset.death); });
  drawInit(); drawHud(); sideShow(); drawBoxes();
  return {
    update() {
      const s = S();
      if (!s.board) return;
      if (board && s.board.scene !== sceneId) { sceneId = s.board.scene; board.fit(); }
      if (board) board.render();
      drawInit();
      if (rc && sideTab === "tir") renderRolls(rc);
      if (s.board.seq !== lastTurnSeen) { sel = sel; drawHud(); }
      const n = (s.rolls || []).length; if (rc && n > rollsSeen && sideTab !== "tir") { const b = $('[data-side="tir"]', host); if (b) b.classList.add("ping"); } rollsSeen = n;
      if (!host.querySelector(".hud input:focus")) drawHud();
      drawBoxes();
      feedback();
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
/* Tarjeta del turno: movimiento, acción, acción adicional, reacción y acciones del manual */
function turnCard(s, t) {
  const e = eco(s, t), max = moveBudget(s, t), pct = Math.min(100, e.mov / Math.max(1, max) * 100);
  const chip = (k, n, on) => `<button class="eco ${on ? "used" : ""}" data-eco="${t.id}|${k}" title="${on ? "Gastada (pulsa para devolverla)" : "Disponible (pulsa para marcarla)"}">${n}</button>`;
  const rule = ruleOpen && GLOS && GLOS[ruleOpen];
  const ch = charOf(s, t);
  if (ch && ch.hp.cur === 0 && !(ch.death && (ch.death.dead || ch.death.stable))) {
    const d = ch.death || { s: 0, f: 0 }, pip = (n, on, cls) => Array.from({ length: 3 }, (_, i) => `<i class="pip ${cls} ${i < on ? "on" : ""}"></i>`).join("");
    return `<div class="hudcard turncard dying"><small>Turno de ${esc(ch.name)} · ronda ${s.board.round}</small>
      <b>A 0 PG: salvación contra muerte</b><div class="dsv"><span>Éxitos ${pip(3, d.s, "ok")}</span><span>Fallos ${pip(3, d.f, "ko")}</span></div>
      <p class="note">d20: 10 o más es un éxito; un 1 son dos fallos; un 20 te levanta con 1 PG. Tres éxitos te estabilizan; tres fallos…</p>
      <button class="btn gold" data-death="${t.id}">🎲 Tirar salvación contra muerte</button> <button class="btn" id="endturn">Terminar turno ▶</button></div>`;
  }
  return `<div class="hudcard turncard"><small>Turno de ${esc(nameOf(s, t))} · ronda ${s.board.round}</small>
    <div class="movebar ${e.mov > max ? "over" : ""}"><i style="width:${pct}%"></i><em>🦶 Movimiento ${e.mov.toLocaleString("es-ES")} / ${max.toLocaleString("es-ES")} m${e.dash ? " (corriendo)" : ""}</em></div>
    <div class="ecos">${chip("act", "⚡ Acción", e.act)}${chip("bonus", "✦ Acción adicional", e.bonus)}${chip("react", "↺ Reacción", !!e.react)}</div>
    <div class="accs">${ACCIONES.map(([n, d]) => `<button class="btn small" data-acc="${t.id}|${n}" title="${esc(d)}" ${e.act && n !== "Atacar" && n !== "Magia" ? "disabled" : ""}>${n}</button>`).join("")}</div>
    ${rule ? `<div class="rulebox"><b>${esc(ruleOpen)}</b> <small>[${esc(rule.tipo || "regla")}]</small>${rule.txt.split("\n").slice(0, 4).map(p => `<p>${esc(p)}</p>`).join("")}<button class="btn small" data-rule="${esc(ruleOpen)}">Cerrar</button></div>` : ""}
    <button class="btn gold" id="endturn">Terminar turno ▶</button></div>`;
}

/* Ataques: el jugador ataca al objetivo que tenga seleccionado; el máster elige objetivo para sus enemigos */
function atkBlock(s, t, canAct, sel) {
  if (!canAct) return "";
  const list = attacksOf(s, t), dm = isDM(s);
  if (!list.length) return dm && t.kind !== "pc" ? `<p class="note" style="margin:0">Añade sus ataques en «Editar enemigo».</p>` : "";
  const targets = s.tokens.filter(x => x.id !== t.id && (dm || !x.hidden));
  return `<details class="atkbox" open><summary>⚔️ Atacar</summary>
    ${dm && t.kind !== "pc" ? `<label class="field">Objetivo<select id="dmtarget"><option value="">Elige…</option>${targets.map(x => `<option value="${x.id}" ${dmTarget === x.id ? "selected" : ""}>${esc(nameOf(s, x))}</option>`).join("")}</select></label>` : ""}
    ${(() => { const tg = s.tokens.find(x => x.id === (dm && t.kind !== "pc" ? dmTarget || sel : sel)); if (!tg || tg.id === t.id) return `<p class="note" style="margin:0 0 4px">Toca un objetivo en la mesa para ver alcance, cobertura y modificadores.</p>`;
      const m = modifiers(s, t, tg, (list[atkIdx] || list[0]).rng), cv = cover(s, t, tg);
      const w = list[atkIdx] || list[0], netAdv = atkAdv != null ? atkAdv : m.net, ac = acOf(s, tg) + (cv.bonus || 0);
      const p1 = Math.min(.95, Math.max(.05, (21 - (ac - w.atk)) / 20)), pc = netAdv > 0 ? 1 - (1 - p1) ** 2 : netAdv < 0 ? p1 * p1 : p1, pct = Math.round(pc * 100);
      const band = pct >= 75 ? "Muy probable" : pct >= 55 ? "Probable" : pct >= 35 ? "Incierto" : pct >= 15 ? "Difícil" : "Casi imposible";
      const chance = `<div class="hitch" style="--p:${pct}%;--hc:${pct >= 55 ? "#5bbf6a" : pct >= 35 ? "#d6aa4e" : "#d04a3a"}"><i></i><span>${dm ? `${pct} % de impactar` : band}${netAdv ? (netAdv > 0 ? " · ventaja" : " · desventaja") : ""}</span></div>`;
      return chance + `<div class="aimbox">🎯 <b>${esc(nameOf(s, tg))}</b> a ${metres(dist(t, tg))}${cv.txt ? ` · ${esc(cv.txt)}` : ""}${m.adv.length ? `<div class="adv">▲ Ventaja: ${esc(m.adv.join(", "))}</div>` : ""}${m.dis.length ? `<div class="dis">▼ Desventaja: ${esc(m.dis.join(", "))}</div>` : ""}${m.autoCrit ? `<div class="adv">Si impacta, es crítico</div>` : ""}</div>`; })()}
    <div class="castlist">${list.map((w, i) => { const tg = s.tokens.find(x => x.id === (dm && t.kind !== "pc" ? dmTarget || sel : sel)); const st = tg && tg.id !== t.id ? inRange(w.rng, t, tg) : null;
      return `<button class="btn small rng-${st || "na"}" data-atk="${t.id}|${i}" data-atkpick="${i}" title="${esc(w.expr + " " + w.type)} · alcance ${w.rng.n === w.rng.l ? w.rng.n + " m" : w.rng.n + "/" + w.rng.l + " m"}">${esc(w.name)} <b>${w.atk >= 0 ? "+" : ""}${w.atk}</b>${st === "out" ? " ✗" : st === "long" ? " ⚠" : st === "ok" ? " ✓" : ""}</button>`; }).join("")}</div>
    <div class="row" style="margin-top:4px"><small class="note" style="margin:0;border:0;padding:0">Forzar:</small><button class="btn small" data-atkadv="1" aria-pressed="${atkAdv === 1}">Ventaja</button><button class="btn small" data-atkadv="-1" aria-pressed="${atkAdv === -1}">Desventaja</button><button class="btn small" data-atkadv="0" aria-pressed="${atkAdv === 0}">Normal</button></div>
  </details>`;
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
    <label class="field">Ataques <small>(uno por línea: nombre | ataque | daño)</small><textarea data-tkatk rows="2" placeholder="Cimitarra | +4 | 1d6+2 cortante">${esc((t.attacks || []).map(a => [a.name, a.atk, a.dmg].join(" | ")).join("\n"))}</textarea></label>
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
  $$("[data-tkatk]", root).forEach(i => i.onchange = () => { const id = i.closest("[data-tokedit]").dataset.tokedit; mutate(id, t => { t.attacks = i.value.split("\n").map(l => l.split("|").map(x => x.trim())).filter(x => x[0]).map(([name, atk, dmg]) => ({ name, atk: atk || "+0", dmg: dmg || "" })); }); });
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

/** Avisa en la mesa de un ataque de oportunidad posible: lo decide quien controla al atacante (o el máster). */
function offerOA(byId, targetId) {
  const s = store.get(), h = s.tokens.find(t => t.id === byId), t = s.tokens.find(x => x.id === targetId), u = currentUser(s) || {};
  if (!h || !t) return;
  store.commit("roll", st => { st.rolls = st.rolls || []; st.rolls.push({ id: "oa" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now(), who: u.id || null, whoName: u.name || "", kind: "oa",
    label: `${nameOf(s, t)} sale del alcance de ${nameOf(s, h)}: ataque de oportunidad`, expr: "", dice: [], total: null, nat: null, tok: h.id, target: t.id, status: "pending", secret: false }); });
}
