// La cajetilla de dados: cuando alguien tira, sube un desplegable desde abajo con una cámara fija sobre
// su bandeja. Todos ven rodar los mismos dados (misma semilla) y el resultado en grande.
import * as THREE from "three";
import { store } from "../core/store.js";
import { throwDice, skinFor, SKINS, TW, TD } from "./dados3d.js";
import { sound } from "../core/sonido.js";
import { RESULT, diceAnim } from "../core/dados.js";
import { esc } from "../core/ui.js";

let box = null, renderer = null, scene = null, camera = null, tick = null, raf = 0, lastT = 0;
const queue = [];
let busy = false;

function build() {
  box = document.createElement("div");
  box.className = "dicecam";
  box.innerHTML = `<div class="dc-lid"><span class="dc-who"></span><span class="dc-what"></span><button class="dc-x" aria-label="Cerrar">✕</button></div>
    <div class="dc-well"><canvas></canvas><div class="dc-res"><b></b><small></small></div></div>`;
  document.body.appendChild(box);
  box.querySelector(".dc-x").onclick = () => finish(true);
  const canvas = box.querySelector("canvas");
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a110a);
  camera = new THREE.PerspectiveCamera(32, 2, 0.1, 200);
  camera.position.set(0, 20, 3.2); camera.lookAt(0, 0, 0.2);
  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x2a1a10, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d8, 1.7); key.position.set(-6, 18, 8); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -14, right: 14, top: 7, bottom: -7, near: 1, far: 60 });
  scene.add(key);
  const warm = new THREE.PointLight(0xffa04a, 40, 30); warm.position.set(6, 6, -4); scene.add(warm);
  // Interior de la cajetilla: piel oscura bajo la bandeja
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
}

function size() {
  const c = renderer.domElement, w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  // Encaja la bandeja alargada en el hueco: lo que pida más ángulo, el ancho o el fondo
  const dist = camera.position.length(), a = w / h;
  const vW = 2 * Math.atan(Math.tan(Math.atan((TW / 2 + 0.7) / dist)) / a), vD = 2 * Math.atan((TD / 2 + 0.8) / dist);
  camera.fov = THREE.MathUtils.radToDeg(Math.max(vW, vD));
  camera.updateProjectionMatrix();
}

function loop(t) {
  const dt = Math.min(0.12, (t - (lastT || t)) / 1000); lastT = t; // en ordenadores lentos, la animación no se alarga
  if (tick && !tick(dt)) { tick = null; }
  renderer.render(scene, camera);
  raf = tick ? requestAnimationFrame(loop) : 0;
}

function finish(now) {
  if (!box) return;
  clearTimeout(box._t); clearTimeout(box._safe);
  box.classList.remove("on", "nat20", "nat1", "show");
  setTimeout(() => { tick = null; busy = false; next(); }, now ? 50 : 250);
}

function next() {
  if (busy || !queue.length) return;
  // Nunca se acumulan: lo viejo se descarta y, con la pestaña oculta, no se anima nada (al volver, solo lo último)
  const now = Date.now();
  for (let i = queue.length - 1; i >= 0; i--) if (now - queue[i].t > 12000) queue.splice(i, 1);
  if (document.hidden) { if (queue.length > 1) queue.splice(0, queue.length - 1); return; }
  if (!queue.length) return;
  // Tiradas pedidas por el máster a varios: se esperan un momento y caen juntas en la misma bandeja
  const head = queue[0];
  if (head.r.link && head.r.char && !head.waited) { head.waited = true; setTimeout(next, 900); return; }
  busy = true;
  // Si hay varias esperando, caen todas juntas en una sola bandeja (como tirar a la vez en la mesa)
  const group = head.r.link && head.r.char ? queue.filter(x => x.r.link === head.r.link) : queue.slice(0, 6);
  group.forEach(g => queue.splice(queue.indexOf(g), 1));
  const s = head.s;
  const r = group.length > 1 ? { ...head.r, id: group.map(g => g.r.id).join("+"), dice: group.flatMap(g => g.r.dice), total: null, group: group.map(g => g.r),
    whoName: "Varias tiradas", label: group.every(g => g.r.link && g.r.link === head.r.link) ? (head.r.label || "").replace(/ de [^·]+$/, "") : group.map(g => g.r.label || g.r.expr).join(" · ") } : head.r;
  if (!box) { build(); box._safe = setTimeout(() => finish(false), 6000); }
  const who = r.group ? null : s.users.find(u => u.id === r.who);
  const skin = skinFor(r);
  box.style.setProperty("--skin", "#" + SKINS[skin].c.toString(16).padStart(6, "0"));
  box.querySelector(".dc-who").innerHTML = `<i style="background:${esc((who && who.color) || "#d6aa4e")}"></i>${esc(r.whoName || (who && who.name) || "Alguien")}`;
  box.querySelector(".dc-what").textContent = (r.label || r.expr || "") + (r.secret ? " · secreta" : "");
  const res = box.querySelector(".dc-res");
  res.querySelector("b").textContent = ""; res.querySelector("small").textContent = "";
  box.classList.remove("nat20", "nat1", "show");
  // El desplegable sale centrado sobre el escenario (no encima de las columnas laterales)
  const st = document.getElementById("stage"), rc = st && st.getBoundingClientRect();
  box.style.left = rc && rc.width > 300 ? `${rc.left + rc.width / 2}px` : "50%";
  box.style.width = rc && rc.width > 300 ? `min(780px, ${Math.round(rc.width - 24)}px)` : "";
  box.classList.add("on");
  requestAnimationFrame(() => {
    size();
    const aim = r.throw ? { x: r.throw.fx, z: -r.throw.fy, power: r.throw.power } : null;
    // Limpia lo que quedara de la tirada anterior (la bandeja va siempre en el centro)
    scene.children.filter(o => o.userData.dice).forEach(o => scene.remove(o));
    const before = new Set(scene.children);
    tick = throwDice(scene, r.dice, new THREE.Vector3(0, 0, 0), {
      seed: r.id, skin, aim, toward: camera.position.clone(), total: r.total, quiet: true, stay: diceAnim() === "fast" ? 0.5 : 1.6,
      drama: !queue.length && (r.kind === "attack" || r.kind === "save"),
      onEvent: e => {
        if (e === "hit") return sound.play("clack");
        reveal(r);
        sound.play(e === "nat20" ? "fanfare" : e === "nat1" ? "fail" : "none");
      }
    });
    scene.children.forEach(o => { if (!before.has(o)) o.userData.dice = true; });
    sound.play("dice");
    if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); }
  });
}

function reveal(r) {
  const res = box.querySelector(".dc-res"), d20 = (r.dice || []).find(x => x.d === 20 && !x.drop);
  const nat = d20 && (d20.v === 20 || d20.v === 1) ? d20.v : null;
  if (r.inits && !r.group) r = { ...r, group: r.inits.map(x => ({ tok: x.id, label: "de " + x.name, total: x.total })) };
  res.querySelector("b").textContent = r.group ? "" : r.total;
  res.classList.toggle("multi", !!r.group);
  if (r.group) { const st = store.get(), nm = x => { const t = x.tok && st.tokens.find(k => k.id === x.tok), c = t && t.kind === "pc" && st.characters.find(k => k.id === t.char);
      return ((c || t || {}).name || (x.label.match(/ de (.+)$/) || [, x.whoName || "?"])[1]).split(" ")[0]; }; res.querySelector("small").innerHTML = r.group.map(x => `<span class="${x.result ? (x.result === "save" ? "ok" : "ko") : ""}">${esc(nm(x))} <b>${x.total}</b>${x.result ? (x.result === "save" ? " ✓" : " ✗") : ""}</span>`).join("");
    box.classList.add("show"); clearTimeout(box._t); box._t = setTimeout(() => finish(false), queue.length ? 1600 : 2800); return; }
  const bits = [];
  if (nat === 20) bits.push("¡20 natural!");
  if (nat === 1) bits.push("Pifia");
  if (r.kind === "attack" && r.result && (r.status !== "pending" || r.result !== "hit")) bits.push(RESULT[r.result] + (r.ac != null ? ` · CA ${r.ac}` : ""));
  else if (r.kind === "attack" && r.ac != null) bits.push(`contra CA ${r.ac}`);
  if (r.kind === "damage" && r.dtype) bits.push("de daño " + r.dtype);
  res.querySelector("small").textContent = bits.join(" · ");
  box.classList.add("show");
  if (nat === 20) box.classList.add("nat20");
  if (nat === 1) box.classList.add("nat1");
  clearTimeout(box._t);
  box._t = setTimeout(() => finish(false), queue.length || diceAnim() === "fast" ? 1000 : 2200);
}

/** Añade una tirada a la cola del desplegable. */
export function showRoll(r, s) {
  if (!r || !r.dice || !r.dice.length || diceAnim() === "off") return; // sin animación: solo el registro y los textos sobre la mesa
  queue.push({ r, s, t: Date.now() });
  if (queue.length > 10) queue.splice(0, queue.length - 10); // si llegan muchas de golpe, solo las últimas
  next();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) next(); });
addEventListener("resize", () => { if (box && box.classList.contains("on")) size(); });
