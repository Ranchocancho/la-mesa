// El tapete de dados: cuando alguien tira, sube desde abajo un tapete con su propia cámara.
// 1) Los dados se lanzan con física (misma semilla para todos). 2) Al pararse, se colocan en fila, grandes
// y de frente. 3) A la derecha se lee la tirada: dado + bonos = total, contra qué, y el veredicto.
// Las tiradas en grupo llevan el nombre bajo cada dado; si son muchas (iniciativa de una horda), una lista ordenada.
import * as THREE from "three";
import { store } from "../core/store.js";
import { throwDice, skinFor, SKINS, TW, TD } from "./dados3d.js";
import { sound } from "../core/sonido.js";
import { diceAnim } from "../core/dados.js";
import { esc } from "../core/ui.js";

let box = null, renderer = null, scene = null, camera = null, run = null, raf = 0, lastT = 0, cur = null;
const queue = [];
let busy = false;

// Estudio de reflejos hecho a mano: una sala oscura con paneles de luz cálida (como los focos de una mesa de juego)
function studio() {
  const env = new THREE.Scene(), room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: 0x2a1c12, side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, c, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
  panel(8, 8, 0xfff1dc, 0, 5.9, 0, 0, Math.PI / 2);      // foco cenital
  panel(6, 4, 0xffc890, -9.9, 2, 2, Math.PI / 2);        // ventana cálida
  panel(5, 3, 0xbfd6ff, 9.9, 3, -3, -Math.PI / 2);       // contraluz frío
  panel(10, 1.2, 0xffe2b0, 0, 1, -9.9);                  // tira del fondo
  return env;
}

function build() {
  box = document.createElement("div");
  box.className = "dicecam";
  box.innerHTML = `<div class="dc-lid"><span class="dc-who"></span><span class="dc-what"></span><button class="dc-x" aria-label="Cerrar">✕</button></div>
    <div class="dc-well"><canvas></canvas><div class="dc-names"></div><div class="dc-read" aria-live="polite"></div><div class="dc-list"></div></div>`;
  document.body.appendChild(box);
  box.querySelector(".dc-x").onclick = e => { e.stopPropagation(); finish(true); };
  // Un toque en el tapete: si aún ruedan, salta al resultado; si ya se lee, lo cierra
  box.querySelector(".dc-well").onclick = () => { if (run && cur && !cur.lined) run.skip(); else if (cur && cur.read) finish(true); };
  const canvas = box.querySelector("canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140d08);
  // Reflejos de estudio: es lo que hace que el barniz, el metal y la gema brillen como dados de verdad
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(studio(), 0.04).texture; pm.dispose(); } catch (e) { /* sin reflejos */ }
  camera = new THREE.PerspectiveCamera(34, 2, 0.1, 200);
  camera.position.set(0, 13, 10.5); camera.lookAt(0, 0.9, 0.3);
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x2a1a10, 0.35));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.1); key.position.set(-5, 16, 9); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -12, right: 12, top: 8, bottom: -8, near: 1, far: 60 }); key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb070, 1.1); rim.position.set(8, 6, -8); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: 0x24160d, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
}

function size() {
  const c = renderer.domElement, w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // Que entre el tapete a lo ancho (con un margen) y a lo largo
  const dist = camera.position.distanceTo(new THREE.Vector3(0, 0.9, 0.3)), a = w / h;
  const vW = 2 * Math.atan((TW / 2 + 0.6) / dist / a), vD = 2 * Math.atan((TD / 2 + 1.6) / dist);
  camera.fov = THREE.MathUtils.radToDeg(Math.max(vW, vD)); camera.updateProjectionMatrix();
}

function loop(t) {
  const dt = Math.min(0.1, (t - (lastT || t)) / 1000); lastT = t; // en ordenadores lentos no se alarga
  if (run) run.tick(dt);
  renderer.render(scene, camera);
  raf = box && box.classList.contains("on") ? requestAnimationFrame(loop) : 0;
}

function finish(now) {
  if (!box) return;
  clearTimeout(box._t); clearTimeout(box._safe);
  box.classList.remove("on", "nat20", "nat1", "read", "listing");
  cur = null;
  setTimeout(() => { if (run) { run.dispose(); run = null; } busy = false; next(); }, now ? 60 : 300);
}

/* ---------- Cola ---------- */
function next() {
  if (busy || !queue.length) return;
  const now = Date.now();
  for (let i = queue.length - 1; i >= 0; i--) if (now - queue[i].t > 12000) queue.splice(i, 1);
  if (document.hidden) { if (queue.length > 1) queue.splice(0, queue.length - 1); return; }
  if (!queue.length) return;
  // Tiradas pedidas por el máster a varios: se espera un momento y caen juntas
  const head = queue[0];
  if (head.r.link && head.r.char) {
    if (!head.waitUntil) { head.waitUntil = now + 900; setTimeout(next, 920); }
    if (now < head.waitUntil) return; // aún pueden llegar respuestas de los demás: que caigan todas juntas
  }
  busy = true;
  const group = head.r.link && head.r.char ? queue.filter(x => x.r.link === head.r.link) : queue.slice(0, 6);
  group.forEach(g => queue.splice(queue.indexOf(g), 1));
  const s = head.s;
  let r = group.length > 1 ? { ...head.r, id: group.map(g => g.r.id).join("+"), dice: group.flatMap(g => g.r.dice.filter(d => !d.drop).slice(0, 1)), total: null, group: group.map(g => g.r),
    whoName: "Varias tiradas", label: group.every(g => g.r.link && g.r.link === head.r.link) ? (head.r.label || "").replace(/ de [^·]+$/, "") + (head.r.dc != null ? ` · CD ${head.r.dc}` : "") : "Varias tiradas a la vez" } : head.r;
  if (r.inits && !r.group) r = { ...r, group: r.inits.map(x => ({ tok: x.id, whoName: x.name, label: "de " + x.name, total: x.total, dice: [{ d: 20, v: Math.max(1, Math.min(20, x.total)) }] })) };
  play(r, s);
}

function play(r, s) {
  if (!box) build();
  const who = r.group ? null : s.users.find(u => u.id === r.who), skin = skinFor(r);
  box.style.setProperty("--skin", "#" + SKINS[skin].c.toString(16).padStart(6, "0"));
  box.querySelector(".dc-who").innerHTML = `<i style="background:${esc((who && who.color) || "#d6aa4e")}"></i>${esc(r.whoName || (who && who.name) || "Alguien")}`;
  box.querySelector(".dc-what").textContent = (r.label || r.expr || "") + (r.secret ? " · secreta" : "");
  const read = box.querySelector(".dc-read"), names = box.querySelector(".dc-names"), lst = box.querySelector(".dc-list");
  read.innerHTML = ""; names.innerHTML = ""; lst.innerHTML = "";
  box.classList.remove("nat20", "nat1", "read", "listing");
  // Hito 92: con sitio, el tapete es pequeño y va arriba a la izquierda de la mesa, bajo la barra de turno, para no tapar
  // la acción; en pantallas estrechas sigue subiendo desde abajo a todo lo ancho
  const st = document.getElementById("stage"), rc = st && st.getBoundingClientRect(), side = !!(rc && rc.width > 640 && rc.height > 380);
  box.classList.toggle("side", side);
  if (side) {
    const tb = st.querySelector(".topbar"), top = tb && tb.getBoundingClientRect().height ? tb.getBoundingClientRect().bottom : rc.top;
    box.style.left = `${Math.round(rc.left + 10)}px`; box.style.top = `${Math.round(top + 10)}px`;
    box.style.width = `${Math.round(Math.min(380, Math.max(300, rc.width * 0.3)))}px`;
  } else {
    box.style.top = "";
    box.style.left = rc && rc.width > 300 ? `${rc.left + rc.width / 2}px` : "50%";
    box.style.width = rc && rc.width > 300 ? `min(920px, ${Math.round(rc.width - 20)}px)` : "";
  }
  box.classList.add("on");
  cur = { r, lined: false, read: false };
  clearTimeout(box._safe); box._safe = setTimeout(() => finish(false), 11000); // pase lo que pase, no se queda abierto
  if (run) { run.dispose(); run = null; }
  const fast = diceAnim() === "fast";
  // Horda (más de 6 a la vez): sin física, una lista ordenada que aparece de golpe
  if (r.group && (r.group.length > 6 || r.inits)) {
    box.classList.add("listing");
    const nm = nameOf(store.get());
    lst.innerHTML = `<div class="dcl-grid">${[...r.group].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).map((x, i) =>
      `<span class="dcl ${x.result === "save" ? "ok" : x.result === "fail" ? "ko" : ""}" style="animation-delay:${i * 45}ms"><i>${x.total ?? "?"}</i>${esc(nm(x))}</span>`).join("")}</div>`;
    sound.play("dice");
    cur.lined = cur.read = true;
    box._t = setTimeout(() => finish(false), queue.length ? 1800 : 3600);
    if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); }
    return;
  }
  requestAnimationFrame(() => {
    size();
    const solo = !r.group;
    run = throwDice(scene, r.dice, new THREE.Vector3(0, 0, 0), {
      seed: r.id, skin, camera, speed: fast ? 2.1 : 1.35, aim: r.throw ? { power: r.throw.power } : null,
      // La fila de dados a la izquierda; a la derecha se lee el resultado
      row: solo ? { x: -TW * 0.19, w: TW * 0.6, y: 2.7, z: 0.9 } : { x: 0, w: TW - 2, y: 2.9, z: 0.4 },
      onEvent: e => {
        if (e === "hit") return sound.play("clack");
        if (e === "settle") return;
        cur.lined = true;
        sound.play(e === "nat20" ? "fanfare" : e === "nat1" ? "fail" : "clack");
        if (e === "nat20") box.classList.add("nat20");
        if (e === "nat1") box.classList.add("nat1");
      },
      onLined: slots => { if (r.group) captions(r, slots); readout(r, fast); }
    });
    sound.play("dice");
    if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); }
  });
}

const nameOf = st => x => {
  const t = x.tok && st.tokens.find(k => k.id === x.tok), c = t && t.kind === "pc" && st.characters.find(k => k.id === t.char);
  return ((c || t || {}).name || x.whoName || (String(x.label || "").match(/ de (.+)$/) || [, "?"])[1]).split(" ")[0];
};

/* ---------- Nombres bajo cada dado (tiradas en grupo) ---------- */
function captions(r, slots) {
  const el = box.querySelector(".dc-names"), c = renderer.domElement, w = c.clientWidth, h = c.clientHeight, nm = nameOf(store.get());
  el.innerHTML = slots.filter(sl => !sl.x.drop).map((sl, i) => {
    const g = r.group[sl.x.src]; if (!g) return "";
    const p = sl.pos.clone().add(new THREE.Vector3(0, -1.55 * sl.sc, 0)).project(camera), x = (p.x + 1) / 2 * w, y = (1 - p.y) / 2 * h;
    const ok = g.result === "save" ? " ok" : g.result === "fail" ? " ko" : "";
    return `<span class="dcn${ok}" style="left:${x}px;top:${y}px;animation-delay:${i * 70}ms">${esc(nm(g))}<b>${g.total ?? ""}${ok === " ok" ? " ✓" : ok === " ko" ? " ✗" : ""}</b></span>`;
  }).join("");
  cur.read = true;
  box._t = setTimeout(() => finish(false), queue.length ? 1500 : 3200);
}

/* ---------- La lectura: dado + bonos = total, contra qué y el veredicto ---------- */
function readout(r, fast) {
  if (r.group) return;
  const el = box.querySelector(".dc-read"), kept = (r.dice || []).filter(d => !d.drop);
  const sum = kept.reduce((a, d) => a + d.v, 0), mod = r.total != null ? r.total - sum : 0;
  const d20 = kept.find(d => d.d === 20), nat = d20 && kept.length === 1 && (d20.v === 20 || d20.v === 1) ? d20.v : null;
  const vs = r.kind === "attack" && r.ac != null ? `contra CA ${r.ac}` : r.dc != null ? `contra CD ${r.dc}` : r.kind === "damage" || r.dtype ? (r.dtype ? `daño ${r.dtype}` : "de daño") : r.kind === "heal" ? "de curación" : "";
  let verdict = "", tone = "";
  if (r.kind === "attack" && r.result) { verdict = r.result === "crit" ? "¡CRÍTICO!" : r.result === "hit" ? "IMPACTO" : "FALLO"; tone = r.result === "miss" ? "ko" : r.result === "crit" ? "gold" : "ok"; }
  else if (r.result === "save" || r.result === "fail") { verdict = r.result === "save" ? "ÉXITO" : "FALLO"; tone = r.result === "save" ? "ok" : "ko"; }
  else if (nat === 20) { verdict = "¡20 NATURAL!"; tone = "gold"; }
  else if (nat === 1) { verdict = "PIFIA"; tone = "ko"; }
  if (nat === 1 && verdict === "FALLO") verdict = "PIFIA";
  const parts = kept.length > 1 ? `<span class="dr-dice">${kept.slice(0, 8).map(d => `<i>${d.v}</i>`).join("")}${kept.length > 8 ? "<i>…</i>" : ""}</span>` : "";
  el.innerHTML = `${parts}${mod ? `<div class="dr-sum"><span class="dr-n">${sum}</span><span class="dr-mod">${mod > 0 ? "+" : "−"}${Math.abs(mod)}</span></div>` : ""}
    <div class="dr-total"><b>${mod ? sum : r.total ?? sum}</b></div>${vs ? `<div class="dr-vs">${esc(vs)}</div>` : ""}${verdict ? `<div class="dr-stamp ${tone}">${verdict}</div>` : ""}`;
  box.classList.add("read");
  // El total «se llena» sumando los bonos
  const b = el.querySelector(".dr-total b"), to = r.total ?? sum, fromV = mod ? sum : to, t0 = performance.now(), dur = fast ? 250 : 520;
  const step = now => { const k = Math.min(1, (now - t0) / dur); b.textContent = Math.round(fromV + (to - fromV) * k); if (k < 1) requestAnimationFrame(step); else { el.classList.add("done"); if (verdict) sound.play(tone === "ko" ? "none" : "clack"); } };
  setTimeout(() => requestAnimationFrame(step), fast ? 80 : 260);
  cur.read = true;
  clearTimeout(box._t);
  box._t = setTimeout(() => finish(false), queue.length ? 1300 : fast ? 1500 : 2700);
}

/** Añade una tirada a la cola del tapete. */
export function showRoll(r, s) {
  if (!r || !r.dice || !r.dice.length || diceAnim() === "off") return; // sin animación: solo el registro y los textos sobre la mesa
  queue.push({ r, s, t: Date.now() });
  if (queue.length > 10) queue.splice(0, queue.length - 10);
  next();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) next(); });
addEventListener("resize", () => { if (box && box.classList.contains("on")) size(); });
