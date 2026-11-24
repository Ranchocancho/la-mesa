// Efectos de conjuro en la mesa 3D: partículas, luz y formas. Son solo visuales; el daño lo aplica el máster.
import * as THREE from "three";

import { EFECTOS } from "../data/efectos.js";
export { EFECTOS };

let GLOW = null;
function glow() {
  if (GLOW) return GLOW;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (GLOW = new THREE.CanvasTexture(c));
}
function sprite(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}
// Nube de partículas con vida propia
function burst(n, color, size, spawn) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) { const p = spawn(i); pos.set(p.pos, i * 3); vel.push(p.vel); }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: glow(), color, size, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.userData.step = (dt, drag = 0.96, grav = 0) => {
    for (let i = 0; i < n; i++) { const v = vel[i]; v[1] -= grav * dt; pos[i * 3] += v[0] * dt; pos[i * 3 + 1] += v[1] * dt; pos[i * 3 + 2] += v[2] * dt; v[0] *= drag; v[1] *= drag; v[2] *= drag; }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

// Hito 80: haz con volumen (núcleo + halo) en vez de líneas de 1 píxel, que casi no se veían
function beam(coreColor, haloColor, coreR, haloR) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.BufferGeometry(), addMat(coreColor, 1)), halo = new THREE.Mesh(new THREE.BufferGeometry(), addMat(haloColor, 0.35));
  g.add(halo, core);
  g.userData.set = pts => {
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1), seg = Math.max(8, pts.length * 4);
    core.geometry.dispose(); halo.geometry.dispose();
    core.geometry = new THREE.TubeGeometry(curve, seg, coreR, 6, false); halo.geometry = new THREE.TubeGeometry(curve, seg, haloR, 8, false);
  };
  g.userData.fade = k => { core.material.opacity = k; halo.material.opacity = 0.35 * k; };
  return g;
}
// Onda en el suelo que se abre
function shock(color, from, to) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), addMat(color, 0)); m.rotation.x = -Math.PI / 2;
  m.userData.at = (u, pos) => { const r = from + (to - from) * Math.min(1, u); m.scale.setScalar(Math.max(0.01, r)); m.material.opacity = 0.85 * Math.pow(1 - Math.min(1, u), 1.3); m.position.copy(pos).setY(0.12); };
  return m;
}

/**
 * Lanza un efecto. from/to: THREE.Vector3 en el suelo. CELL: tamaño de casilla. Devuelve una función tick(dt) → sigue vivo.
 */
export function playEffect(scene, k, from, to, CELL) {
  const root = new THREE.Group(); scene.add(root);
  const light = new THREE.PointLight(0xffffff, 0, 40, 1.6); root.add(light);
  let t = 0, life = 2;
  const parts = [];
  const add = o => { root.add(o); parts.push(o); return o; };
  const A = from.clone().setY(2.2), B = to.clone().setY(1.2);
  let tick;

  if (k === "bola") {
    const R = EFECTOS.bola.area * CELL, travel = 0.55; life = travel + 1.8;
    const bead = add(sprite(0xff8a2a, 1.6)); light.color.set(0xff7a2a);
    const ring = add(new THREE.Mesh(new THREE.RingGeometry(R - 0.25, R, 64), new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(to).setY(0.15);
    const ball = add(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })));
    ball.visible = false; ball.position.copy(to).setY(1);
    const core = add(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    core.visible = false; core.position.copy(to).setY(1);
    let sparks = null, embers = null;
    const wave = add(shock(0xffb04a, 0.5, R * 1.25)), trail = add(burst(40, 0xffa040, 0.8, () => ({ pos: [A.x, A.y, A.z], vel: [rnd(0.6), rnd(0.6), rnd(0.6)] })));
    const tpos = trail.geometry.attributes.position.array; let ti = 0;
    tick = dt => {
      if (t < travel) {
        // estela de chispas detrás de la bola
        for (let k = 0; k < 4; k++) { tpos.set([bead.position.x, bead.position.y, bead.position.z], (ti++ % 40) * 3); }
        trail.userData.step(dt, 0.9, 0);
        const u = t / travel; bead.position.lerpVectors(A, B, u); bead.position.y += Math.sin(u * Math.PI) * 4;
        light.position.copy(bead.position); light.intensity = 60;
      } else {
        if (!sparks) {
          bead.visible = false; ball.visible = true;
          sparks = add(burst(220, 0xff7a20, 1.2, () => { const d = new THREE.Vector3(rnd(), Math.random() * 0.9, rnd()).normalize().multiplyScalar(R * (0.8 + Math.random() * 1.6)); return { pos: [to.x, 1, to.z], vel: [d.x, d.y, d.z] }; }));
          light.position.copy(to).setY(4);
          embers = add(burst(90, 0xffc070, 0.7, () => ({ pos: [to.x + rnd(R * 0.6), 0.5 + Math.random(), to.z + rnd(R * 0.6)], vel: [rnd(1.2), 3 + Math.random() * 5, rnd(1.2)] })));
          trail.visible = false;
        }
        wave.userData.at((t - travel) / 0.6, to);
        embers.userData.step(dt, 0.97, -0.5); embers.material.opacity = Math.max(0, 1 - (t - travel) / (life - travel));
        const u = (t - travel) / (life - travel);
        const grow = Math.min(1, u * 4), fade = Math.pow(1 - u, 1.6);
        ball.scale.set(R * grow, R * grow * 0.75, R * grow); ball.material.opacity = 0.5 * fade;
        core.visible = true; core.scale.setScalar(R * 0.45 * grow * (1 - u * 0.5)); core.material.opacity = 0.9 * Math.pow(1 - u, 2.5);
        ring.material.opacity = 0.9 * (1 - u);
        light.intensity = 900 * Math.max(0, 1 - u * 1.6); light.distance = R * 3;
        sparks.userData.step(dt, 0.9, 6); sparks.material.opacity = 1 - u;
      }
    };
  } else if (k === "proyectil") {
    life = 1.4; light.color.set(0x9d6bff);
    const darts = [0, 1, 2].map(i => { const s = add(sprite(0xb48cff, 1.1)); s.userData.mid = A.clone().lerp(B, 0.5).add(new THREE.Vector3(rnd(5), 4 + i * 1.5, rnd(5))); s.userData.delay = i * 0.15; return s; });
    const flash = add(sprite(0xd8c2ff, 0.1)); flash.position.copy(B);
    tick = () => {
      darts.forEach(s => {
        const u = Math.min(1, Math.max(0, (t - s.userData.delay) / 0.6));
        const p = A.clone().multiplyScalar((1 - u) * (1 - u)).add(s.userData.mid.clone().multiplyScalar(2 * u * (1 - u))).add(B.clone().multiplyScalar(u * u));
        s.position.copy(p); s.visible = u > 0 && u < 1;
      });
      const hit = Math.max(0, t - 0.6);
      flash.scale.setScalar(hit > 0 ? 4 * Math.max(0, 1 - hit * 1.5) : 0.01);
      light.position.copy(B); light.intensity = hit > 0 ? 200 * Math.max(0, 1 - hit * 1.4) : 40;
    };
  } else if (k === "rayo" || k === "escarcha") {
    const ice = k === "escarcha";
    life = ice ? 1.1 : 0.9; light.color.set(ice ? 0xaee8ff : 0x9fd8ff);
    const dir = B.clone().sub(A); dir.y = 0;
    const end = ice ? B.clone() : A.clone().add(dir.normalize().multiplyScalar(EFECTOS.rayo.line * CELL)).setY(1.6);
    const bm = add(beam(ice ? 0xe8fbff : 0xf4fbff, ice ? 0x4ab8ff : 0x6a9cff, ice ? 0.1 : 0.12, ice ? 0.42 : 0.55));
    const fork = ice ? null : add(beam(0xf4fbff, 0x6a9cff, 0.06, 0.28));
    const fA = add(sprite(ice ? 0xbfefff : 0xd8ecff, 0.1)), fB = add(sprite(ice ? 0xbfefff : 0xd8ecff, 0.1)); fA.position.copy(A); fB.position.copy(end);
    const frost = ice ? add(burst(70, 0xdff6ff, 0.55, () => ({ pos: [B.x, 1.2, B.z], vel: [rnd(3), Math.random() * 3, rnd(3)] }))) : null;
    const shards = ice ? [...Array(7)].map((_, i) => { const c = add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 1, 5), new THREE.MeshStandardMaterial({ color: 0xcff4ff, emissive: 0x4ab8ff, emissiveIntensity: 0.6, transparent: true, roughness: 0.1 }))); const a = i / 7 * Math.PI * 2; c.position.set(B.x + Math.cos(a) * 0.9, 0.3, B.z + Math.sin(a) * 0.9); c.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); c.scale.setScalar(0.01); return c; }) : [];
    const wave = add(shock(ice ? 0x9fe0ff : 0x9fc8ff, 0.3, ice ? 2.2 : 3));
    let next = 0;
    const path = jitter => { const pts = [], n = ice ? 8 : 16; for (let i = 0; i <= n; i++) { const p = A.clone().lerp(end, i / n); if (i > 0 && i < n) p.add(new THREE.Vector3(rnd(jitter), rnd(jitter * 0.7), rnd(jitter))); pts.push(p); } return pts; };
    if (ice) bm.userData.set(path(0.12));
    tick = dt => {
      const u = t / life;
      // el relámpago cambia de forma a saltos; la escarcha avanza hasta el blanco
      if (!ice && t >= next) { next = t + 0.06; const pts = path(0.8); bm.userData.set(pts); const i0 = 4 + Math.floor(Math.random() * 8), q = pts[i0].clone(); fork.userData.set([q, q.clone().add(new THREE.Vector3(rnd(2.5), rnd(1), rnd(2.5))), q.clone().add(new THREE.Vector3(rnd(4), -1, rnd(4)))]); }
      if (ice) { const grow = Math.max(0.05, Math.min(1, u * 4)); bm.userData.set(path(0.12).map(p => A.clone().lerp(p, grow))); }
      bm.userData.fade(ice ? 1 - Math.max(0, (u - 0.5) * 2) : (1 - u) * (0.6 + Math.random() * 0.4)); if (fork) fork.userData.fade((1 - u) * (Math.random() < 0.6 ? 1 : 0));
      fA.scale.setScalar(4 * (1 - u)); fB.scale.setScalar((ice ? (u > 0.25 ? 4 : 0) : 5) * (1 - u));
      wave.userData.at(ice ? (u - 0.25) / 0.6 : u / 0.5, ice ? B : end);
      shards.forEach(c => { const k = Math.min(1, Math.max(0, (u - 0.25) * 5)); c.scale.setScalar(Math.max(0.01, k * (1 - Math.max(0, (u - 0.75) * 4)))); });
      light.position.copy(A.clone().lerp(end, 0.5)); light.intensity = (ice ? 140 : 360) * (1 - u) * (ice ? 1 : 0.6 + Math.random() * 0.6); light.distance = 40;
      if (frost) frost.userData.step(dt, 0.92, 2);
    };
  } else if (k === "llama") {
    life = 1.4; light.color.set(0xfff0b0);
    const col = add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })));
    col.position.copy(to).setY(7);
    const motes = add(burst(70, 0xffe08a, 0.7, () => ({ pos: [to.x + rnd(1.2), Math.random() * 2, to.z + rnd(1.2)], vel: [0, 4 + Math.random() * 6, 0] })));
    const core = add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 14, 16, 1, true), addMat(0xffffff, 0))); core.position.copy(to).setY(7);
    const rings = [0, 1, 2].map(i => { const r = add(new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 6, 32), addMat(0xffe7a0, 0))); r.rotation.x = Math.PI / 2; r.userData.d = i * 0.25; return r; });
    const wave = add(shock(0xfff0b0, 0.6, 2.6));
    tick = dt => { const u = t / life;
      core.material.opacity = 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.3));
      rings.forEach(r => { const k = Math.max(0, Math.min(1, (u - r.userData.d) / 0.6)); r.position.copy(to).setY(0.5 + k * 9); r.material.opacity = 0.8 * Math.sin(Math.PI * k); r.scale.setScalar(1 - k * 0.4); });
      wave.userData.at(u / 0.7, to);
      col.material.opacity = 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.2)); light.position.copy(to).setY(3); light.intensity = 260 * (1 - u); motes.userData.step(dt, 0.99); motes.material.opacity = 1 - u; };
  } else if (k === "curar") {
    life = 1.8; light.color.set(0xffe08a);
    const motes = add(burst(80, 0xffd86a, 0.6, i => { const a = i * 0.7; return { pos: [to.x + Math.cos(a) * 1.6, 0.3 + (i % 10) * 0.1, to.z + Math.sin(a) * 1.6], vel: [-Math.sin(a) * 1.5, 2 + Math.random() * 2.5, Math.cos(a) * 1.5] }; }));
    tick = dt => { const u = t / life; motes.userData.step(dt, 0.995); motes.material.opacity = 1 - u; light.position.copy(to).setY(2.5); light.intensity = 120 * Math.sin(Math.PI * u); };
  } else if (k === "escudo") {
    life = 3; light.color.set(0x7fb8ff);
    const bub = add(new THREE.Mesh(new THREE.SphereGeometry(2.3, 32, 16), new THREE.MeshStandardMaterial({ color: 0x7fb8ff, emissive: 0x3a7ad6, emissiveIntensity: 0.6, transparent: true, opacity: 0, roughness: 0.2, depthWrite: false })));
    bub.position.copy(to).setY(1.6);
    tick = () => { const u = t / life; bub.material.opacity = 0.35 * Math.min(1, u * 6) * (1 - Math.max(0, (u - 0.7) / 0.3)); bub.scale.setScalar(1 + Math.sin(t * 6) * 0.03); light.position.copy(to).setY(2); light.intensity = 40 * (1 - u); };
  } else if (k === "trueno") {
    life = 1; light.color.set(0xcfd8ff);
    const half = (EFECTOS.trueno.area + 0.5) * CELL;
    const box = add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xcfd8ff, transparent: true, opacity: 0.5, wireframe: false, blending: THREE.AdditiveBlending, depthWrite: false })));
    box.position.copy(to).setY(1);
    const wave = add(shock(0xdfe6ff, 0.5, half * 1.6)), wave2 = add(shock(0xa8b8ff, 0.3, half * 1.1));
    const dust = add(burst(80, 0xcfd2e0, 0.9, i => { const a = i / 80 * Math.PI * 2; return { pos: [to.x, 0.4, to.z], vel: [Math.cos(a) * (6 + Math.random() * 4), Math.random() * 1.5, Math.sin(a) * (6 + Math.random() * 4)] }; }));
    tick = dt => { const u = t / life; wave.userData.at(u / 0.45, to); wave2.userData.at((u - 0.12) / 0.5, to); dust.userData.step(dt, 0.88, 1); dust.material.opacity = 0.7 * (1 - u); box.scale.set(half * 2 * Math.min(1, u * 5), 2 + u * 2, half * 2 * Math.min(1, u * 5)); box.material.opacity = 0.45 * (1 - u); light.position.copy(to).setY(3); light.intensity = 300 * (1 - u); };
  } else { life = 0; tick = () => {}; }

  return dt => {
    t += dt; tick(dt);
    if (t >= life) { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); return false; }
    return true;
  };
}
