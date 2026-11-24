// Acabado de la mesa 3D (Hito 81): reflejos de entorno y resplandor (bloom) suave.
// Escrito a mano con lo que trae three.js (sin los complementos de posprocesado, que no están en vendor/).
import * as THREE from "three";

/* ---------- Entorno: una sala sencilla con los colores del ambiente, convertida en reflejos (PMREM) ---------- */
// Cuánto reflejan las cosas según la luz elegida: de día mucho, en la oscuridad casi nada
// (bajo a propósito: el entorno también aclara un poco todo; aquí solo queremos brillos en metal, agua y hielo)
const ENV_K = { dia: 0.16, interior: 0.11, noche: 0.07, penumbra: 0.055, oscuro: 0.02 };
export function makeEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer), cache = new Map();
  return {
    get(key, sky, ground, sunColor) {
      if (cache.has(key)) return cache.get(key);
      const k = ENV_K[key] ?? 0.25, sc = new THREE.Scene();
      const room = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
      // degradado de cielo (arriba) a suelo (abajo)
      const pos = room.geometry.attributes.position, cols = [], top = new THREE.Color(sky).multiplyScalar(k), bot = new THREE.Color(ground).multiplyScalar(k * 0.8);
      for (let i = 0; i < pos.count; i++) { const c = bot.clone().lerp(top, (pos.getY(i) + 10) / 20); cols.push(c.r, c.g, c.b); }
      room.geometry.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); sc.add(room);
      // paneles de luz: el «sol» y un par de ventanas, para que metales y agua tengan brillos que reflejar
      [[0, 9.5, 0, 4, 4, Math.PI / 2, 12], [9.5, 3, -2, 2, 4, 0, 5], [-9.5, 2, 3, 2, 3, 0, 4]].forEach(([x, y, z, w, h, rx, p]) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(sunColor).multiplyScalar(k * p), side: THREE.DoubleSide }));
        m.position.set(x, y, z); if (rx) m.rotation.x = rx; else m.rotation.y = Math.PI / 2; sc.add(m);
      });
      const tex = pm.fromScene(sc, 0.04).texture;
      sc.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      cache.set(key, tex); return tex;
    },
    dispose() { cache.forEach(t => t.dispose()); cache.clear(); pm.dispose(); }
  };
}

/* ---------- Resplandor: solo lo que brilla de verdad (fuego, lava, cristales, conjuros) ---------- */
const VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const BRIGHT = `uniform sampler2D t; uniform float th, knee; varying vec2 vUv;
void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b));
  float s = clamp(l - th + knee, 0.0, 2.0 * knee); s = s * s / (4.0 * knee + 1e-4);
  gl_FragColor = vec4(c * max(s, l - th) / max(l, 1e-4), 1.0); }`;
const BLUR = `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
void main(){ vec3 c = texture2D(t, vUv).rgb * 0.2270270;
  c += texture2D(t, vUv + dir * 1.3846154).rgb * 0.3162162; c += texture2D(t, vUv - dir * 1.3846154).rgb * 0.3162162;
  c += texture2D(t, vUv + dir * 3.2307692).rgb * 0.0702703; c += texture2D(t, vUv - dir * 3.2307692).rgb * 0.0702703;
  gl_FragColor = vec4(c, 1.0); }`;
const COMP = `uniform sampler2D t, b1, b2; uniform float k; varying vec2 vUv;
void main(){ vec4 c = texture2D(t, vUv); c.rgb += (texture2D(b1, vUv).rgb * 0.7 + texture2D(b2, vUv).rgb * 0.9) * k; gl_FragColor = c;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeBloom(renderer, { threshold = 0.95, strength = 0.38 } = {}) {
  const rt = (samples = 0) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: samples > 0 });
  const main = rt(4), h1 = rt(), v1 = rt(), h2 = rt(), v2 = rt();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; sc.add(quad);
  const mk = (fs, uniforms, toneMapped = false) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, toneMapped });
  const bright = mk(BRIGHT, { t: { value: null }, th: { value: threshold }, knee: { value: 0.35 } });
  const blur = mk(BLUR, { t: { value: null }, dir: { value: new THREE.Vector2() } });
  const comp = mk(COMP, { t: { value: null }, b1: { value: null }, b2: { value: null }, k: { value: strength } }, true);
  const sz = new THREE.Vector2();
  let W = 0, H = 0;
  const pass = (m, target) => { quad.material = m; renderer.setRenderTarget(target); renderer.render(sc, cam); };
  const blurPass = (src, mid, dst, w, h) => {
    blur.uniforms.t.value = src.texture; blur.uniforms.dir.value.set(1 / w, 0); pass(blur, mid);
    blur.uniforms.t.value = mid.texture; blur.uniforms.dir.value.set(0, 1 / h); pass(blur, dst);
  };
  return {
    setStrength(v) { comp.uniforms.k.value = v; },   // Hito 89: más resplandor de noche, menos de día
    setThreshold(v) { bright.uniforms.th.value = v; },
    render(scene, camera) {
      renderer.getDrawingBufferSize(sz);
      if (sz.x !== W || sz.y !== H) {
        W = sz.x; H = sz.y; main.setSize(W, H);
        const w1 = Math.max(1, W >> 1), hh1 = Math.max(1, H >> 1), w2 = Math.max(1, W >> 2), hh2 = Math.max(1, H >> 2);
        h1.setSize(w1, hh1); v1.setSize(w1, hh1); h2.setSize(w2, hh2); v2.setSize(w2, hh2);
      }
      renderer.setRenderTarget(main); renderer.render(scene, camera);
      bright.uniforms.t.value = main.texture; pass(bright, v1);                // lo brillante, a media resolución
      blurPass(v1, h1, v1, W >> 1, H >> 1);                                     // desenfoque cercano
      blurPass(v1, h2, v2, W >> 2, H >> 2); blurPass(v2, h2, v2, W >> 2, H >> 2); // y uno más ancho, a un cuarto
      comp.uniforms.t.value = main.texture; comp.uniforms.b1.value = v1.texture; comp.uniforms.b2.value = v2.texture;
      pass(comp, null);
    },
    dispose() { [main, h1, v1, h2, v2].forEach(r => r.dispose()); [bright, blur, comp].forEach(m => m.dispose()); quad.geometry.dispose(); }
  };
}
