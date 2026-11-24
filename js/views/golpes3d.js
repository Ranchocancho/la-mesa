// Golpes en la mesa 3D: tajo, flecha o proyectil mágico, chispas al impactar y texto que flota sobre la figura.
// Cada función devuelve un «paso» (dt) => sigue_vivo, para la lista de efectos del tablero.
import * as THREE from "three";

let GLOW = null;
function glowTex() {
  if (GLOW) return GLOW;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,.6)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  GLOW = new THREE.CanvasTexture(c); return GLOW;
}
const glowSprite = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.setScalar(size); return s; };
const ease = k => 1 - Math.pow(1 - k, 3);

/** Texto que sube y se desvanece sobre una figura («−8», «¡Impacto!», «Salva»…). */
export function floatText(scene, pos, text, color = "#ffffff", big = false, scale = 1) {
  const c = document.createElement("canvas"), g = c.getContext("2d"), fs = big ? 64 : 48;
  g.font = `900 ${fs}px Georgia, serif`;
  const w = Math.ceil(g.measureText(text).width) + 28; c.width = w; c.height = fs + 26;
  g.font = `900 ${fs}px Georgia, serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineWidth = 9; g.strokeStyle = "rgba(10,6,4,.9)"; g.strokeText(text, w / 2, c.height / 2);
  g.fillStyle = color; g.fillText(text, w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  const h = (big ? 2.3 : 1.6) * scale; s.scale.set(h * c.width / c.height, h, 1); s.renderOrder = 20;
  const x0 = pos.x + (Math.random() - 0.5) * 0.4; s.position.set(x0, pos.y, pos.z); scene.add(s);
  let t = 0; const dur = big ? 2.1 : 1.7;
  return dt => {
    t += dt; const k = t / dur;
    s.position.y = pos.y + ease(Math.min(1, k * 1.4)) * 2.4;
    const pop = k < 0.12 ? 0.6 + k / 0.12 * 0.55 : k < 0.22 ? 1.15 - (k - 0.12) / 0.1 * 0.15 : 1;
    s.scale.set(h * c.width / c.height * pop, h * pop, 1);
    s.material.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
    if (k >= 1) { scene.remove(s); tex.dispose(); s.material.dispose(); return false; }
    return true;
  };
}

/** Chispas que saltan del punto de impacto. */
export function sparks(scene, pos, color = "#ffb15a", n = 18, power = 1, floorY = pos.y - 1.4) {
  const g = new THREE.Group(); scene.add(g);
  const parts = Array.from({ length: n }, () => {
    const s = glowSprite(color, 0.35 + Math.random() * 0.35); s.position.copy(pos); g.add(s);
    const a = Math.random() * Math.PI * 2, up = 0.4 + Math.random() * 1.2, sp = (3 + Math.random() * 5) * power;
    return { s, v: new THREE.Vector3(Math.cos(a) * sp, up * sp * 0.8, Math.sin(a) * sp) };
  });
  const flash = glowSprite(color, 3.2 * power); flash.position.copy(pos); g.add(flash);
  let t = 0;
  return dt => {
    t += dt; const k = t / 0.7;
    parts.forEach(p => {
      p.v.y -= 14 * dt; p.s.position.addScaledVector(p.v, dt); p.s.material.opacity = Math.max(0, 1 - k);
      // Hito 89: rebotan en el suelo y se frenan
      if (p.s.position.y < floorY + 0.08 && p.v.y < 0) { p.s.position.y = floorY + 0.08; p.v.y = -p.v.y * 0.35; p.v.x *= 0.55; p.v.z *= 0.55; }
    });
    flash.material.opacity = Math.max(0, 1 - k * 3); flash.scale.setScalar(3.2 * power * (1 + k));
    if (k >= 1) { scene.remove(g); g.traverse(o => o.material && o.material.dispose()); return false; }
    return true;
  };
}

/** Tajo cuerpo a cuerpo: un arco de luz que barre delante del objetivo. */
function slash(scene, from, to, color, done) {
  const dir = to.clone().sub(from); dir.y = 0; const yaw = Math.atan2(dir.x, dir.z);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.09, 6, 40, Math.PI * 0.9),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const holder = new THREE.Group(); holder.position.copy(to).add(new THREE.Vector3(0, 2.2, 0)); holder.rotation.y = yaw; holder.add(arc);
  arc.rotation.set(0, Math.PI / 2, 0); holder.rotateX(-0.5); scene.add(holder);
  let t = 0, hit = false; const dur = 0.42;
  return dt => {
    t += dt; const k = t / dur;
    arc.rotation.z = -1.6 + ease(Math.min(1, k)) * 2.4;
    arc.material.opacity = k < 0.25 ? k / 0.25 : Math.max(0, 1 - (k - 0.25) / 0.75);
    arc.scale.setScalar(1 + k * 0.15);
    if (!hit && k > 0.45) { hit = true; done(); }
    if (k >= 1) { scene.remove(holder); arc.geometry.dispose(); arc.material.dispose(); return false; }
    return true;
  };
}

/** Proyectil (flecha o conjuro): una bola de luz con estela que viaja del atacante al objetivo. */
function bolt(scene, from, to, color, magic, miss, done) {
  const a = from.clone().add(new THREE.Vector3(0, 2.4, 0)), b = to.clone().add(new THREE.Vector3(0, 2.2, 0));
  if (miss) { const side = new THREE.Vector3(b.z - a.z, 0, a.x - b.x).normalize().multiplyScalar(1.8); b.add(side).add(b.clone().sub(a).setY(0).normalize().multiplyScalar(4)); }
  const len = a.distanceTo(b), dur = Math.min(0.75, 0.22 + len / 90);
  const head = glowSprite(color, magic ? 1.7 : 0.9); scene.add(head);
  const trail = Array.from({ length: magic ? 10 : 6 }, (_, i) => { const s = glowSprite(color, (magic ? 1.3 : 0.5) * (1 - i / 12)); scene.add(s); return s; });
  const hist = []; let t = 0, hit = false;
  return dt => {
    t += dt; const k = Math.min(1, t / dur), p = a.clone().lerp(b, k); p.y += Math.sin(k * Math.PI) * (magic ? 0.6 : 1.1);
    head.position.copy(p); hist.unshift(p.clone()); if (hist.length > 30) hist.pop();
    trail.forEach((s, i) => { const q = hist[Math.min(hist.length - 1, (i + 1) * 2)]; if (q) s.position.copy(q); s.material.opacity = (1 - i / trail.length) * (k >= 1 ? Math.max(0, 1 - (t - dur) / 0.25) : 0.8); });
    if (!hit && k >= 1) { hit = true; done(); }
    head.material.opacity = k >= 1 ? 0 : 1;
    if (t > dur + 0.25) { [head, ...trail].forEach(s => { scene.remove(s); s.material.dispose(); }); return false; }
    return true;
  };
}

/** Ataque completo: tajo o proyectil y, al llegar, chispas (si acierta) y el resultado escrito. */
export function strike(scene, from, to, { melee, magic, color, res, onHit }) {
  const hitPos = to.clone().add(new THREE.Vector3(0, 2.2, 0)), miss = res === "miss";
  const steps = [];
  const land = () => {
    if (!miss) { steps.push(sparks(scene, hitPos, res === "crit" ? "#ffd65a" : color === "#f4ecd8" ? "#ffb15a" : color, res === "crit" ? 34 : 18, res === "crit" ? 1.4 : 1)); onHit && onHit(); }
  };
  steps.push(melee && !magic ? slash(scene, from, to, miss ? "#bfb8aa" : "#fff1cf", land) : bolt(scene, from, to, color, magic, miss, land));
  return dt => { for (let i = steps.length - 1; i >= 0; i--) if (!steps[i](dt)) steps.splice(i, 1); return steps.length > 0; };
}

/** Motas de ambiente sobre el tablero: polvo (interior), luciérnagas (noche) o polen (día). */
export function motes(scene, W, H, kind, zones = []) {
  // Partículas ambientales más vivas: deriva irregular, tamaños y velocidades más variados
  const cfg = kind === "noche" ? { n: 52, color: "#d8ff7a", size: 0.55, rise: 0.16, blink: true } : kind === "dia" ? { n: 44, color: "#fff4d0", size: 0.32, rise: 0.055, blink: false } : { n: 78, color: "#ffd9a0", size: 0.28, rise: 0.045, blink: false };
  const g = new THREE.Group(); scene.add(g);
  const P = Array.from({ length: cfg.n }, () => {
    const s = glowSprite(cfg.color, cfg.size * (0.5 + Math.random() * 1.0)); g.add(s);
    s.position.set((Math.random() - 0.5) * W, 0.5 + Math.random() * 7.5, (Math.random() - 0.5) * H);
    return { s, ph: Math.random() * 12, sp: 0.22 + Math.random() * 0.75, base: 0.2 + Math.random() * 0.5, sway: 0.25 + Math.random() * 0.4 };
  });
  // Hito 89: microclimas. Junto a lava, brasas o fuego las motas se vuelven cálidas (y suben más); junto a hielo o nieve, frías
  const base = new THREE.Color(cfg.color), warmC = new THREE.Color("#ffb060"), coldC = new THREE.Color("#bfe4ff");
  const climate = p => {
    let w = 0; for (const z of zones) { const d = Math.hypot(p.s.position.x - z.x, p.s.position.z - z.z); if (d < z.r) w += z.warm * (1 - d / z.r); }
    w = Math.max(-1, Math.min(1, w)); p.w = w;
    p.s.material.color.copy(base).lerp(w > 0 ? warmC : coldC, Math.abs(w) * 0.85);
  };
  let t = 0, tick = 0;
  const step = dt => {
    t += dt; tick++;
    if (zones.length) P.forEach((p, i) => { if ((tick + i) % 20 === 0) climate(p); });
    P.forEach(p => {
      // deriva más orgánica (no solo senoidal pura)
      p.s.position.x += (Math.sin(t * p.sp + p.ph) * 0.7 + Math.sin(t * p.sp * 1.7 + p.ph * 0.6) * 0.3) * dt * p.sway;
      p.s.position.z += (Math.cos(t * p.sp * 0.85 + p.ph) * 0.7 + Math.cos(t * p.sp * 1.4 + p.ph * 0.5) * 0.3) * dt * p.sway;
      p.s.position.y += cfg.rise * dt * (Math.sin(t * 0.45 + p.ph) + 0.35 + Math.max(0, p.w || 0) * 2.5);
      if (p.s.position.y > 8.2) p.s.position.y = 0.5;
      p.s.material.opacity = cfg.blink ? Math.max(0, Math.sin(t * p.sp * 1.55 + p.ph)) * 0.95 : p.base * (0.65 + 0.35 * Math.sin(t * 1.25 + p.ph));
    });
  };
  return { group: g, step, dispose() { scene.remove(g); g.children.forEach(s => s.material.dispose()); } };
}


/* ---------- Hito 89: polvo al pisar o caer, y chispitas al curar ---------- */
/** Nubecilla de polvo con anillo en el suelo. `big`: caída. Devuelve tick(dt) → sigue vivo. */
export function dust(scene, pos, color = "#c8b89a", big = false) {
  const g = new THREE.Group(); scene.add(g);
  const n = big ? 16 : 8, col = new THREE.Color(color);
  const parts = Array.from({ length: n }, (_, i) => {
    const s = glowSprite(color, (big ? 1.1 : 0.7) * (0.7 + Math.random() * 0.6)); s.material.blending = THREE.NormalBlending; s.material.opacity = 0.5;
    s.position.set(pos.x, pos.y + 0.15, pos.z); g.add(s);
    const a = i / n * Math.PI * 2 + Math.random() * 0.4, sp = (big ? 2.6 : 1.5) * (0.6 + Math.random() * 0.7);
    return { s, v: new THREE.Vector3(Math.cos(a) * sp, (big ? 1.2 : 0.6) * Math.random(), Math.sin(a) * sp) };
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(pos.x, pos.y + 0.06, pos.z); g.add(ring);
  let t = 0; const life = big ? 0.8 : 0.5, R0 = big ? 3.2 : 1.8;
  return dt => {
    t += dt; const k = t / life;
    parts.forEach(p => { p.v.multiplyScalar(0.9); p.v.y -= 2 * dt; p.s.position.addScaledVector(p.v, dt); p.s.scale.multiplyScalar(1 + dt * 1.2); p.s.material.opacity = 0.5 * Math.max(0, 1 - k); });
    ring.scale.setScalar(1 + (R0 - 1) * (1 - Math.pow(1 - Math.min(1, k), 2))); ring.material.opacity = 0.45 * Math.max(0, 1 - k);
    if (k >= 1) { scene.remove(g); g.traverse(o => { if (o.geometry && o !== ring) o.geometry.dispose(); if (o.material) o.material.dispose(); }); ring.geometry.dispose(); return false; }
    return true;
  };
}
/** Chispitas verdes que suben al curar. */
export function healMotes(scene, pos) {
  const g = new THREE.Group(); scene.add(g);
  const parts = Array.from({ length: 14 }, (_, i) => {
    const s = glowSprite("#7dff9a", 0.4 + Math.random() * 0.3); const a = i / 14 * Math.PI * 2;
    s.position.set(pos.x + Math.cos(a) * 0.9, pos.y + 0.3 + Math.random() * 0.6, pos.z + Math.sin(a) * 0.9); g.add(s);
    return { s, a, v: 1.6 + Math.random() * 1.6 };
  });
  let t = 0;
  return dt => {
    t += dt; const k = t / 1.2;
    parts.forEach(p => { p.a += dt * 2; p.s.position.y += p.v * dt; p.s.position.x += Math.cos(p.a) * dt * 0.6; p.s.position.z += Math.sin(p.a) * dt * 0.6; p.s.material.opacity = Math.max(0, Math.sin(Math.PI * Math.min(1, k))); });
    if (k >= 1) { scene.remove(g); g.traverse(o => o.material && o.material.dispose()); return false; }
    return true;
  };
}
