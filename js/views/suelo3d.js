// Suelo de la mesa 3D (Hito 84):
// 1) Uniones entre terrenos: el terreno «blando» se mete en el vecino con un borde irregular (la hierba entre
//    las losas, el barro en la tierra, la nieve sobre la roca…), como un mapa pintado a mano. Solo entre casillas
//    a la misma altura; los suelos construidos (madera, alfombra, pasarelas), los líquidos y los peligros no se mezclan,
//    para que su borde táctico siga claro.
// 2) Menos repetición: variación de tono a gran escala (zonas más oscuras, gastadas o húmedas) y, en los terrenos
//    naturales, una segunda lectura de la textura girada que se mezcla a manchas, para que no se vea el patrón.
import * as THREE from "three";
import { TERRAIN } from "../data/mapas.js";

// Quién se mete en quién: el de número mayor invade al menor. Lo que no está aquí no se mezcla.
export const SPREAD = {
  hierbalta: 9, juncos: 9, hierba: 8, musgo: 8, flores: 8, hojarasca: 7, raices: 7, nieve: 7,
  ceniza: 6, arena: 6, barro: 5, removida: 5, pisoteada: 5, tierra: 4, camino: 4, escombros: 4, paja: 4,
  cueva: 3, rocanevada: 3, volcanica: 3, piedra: 2, adoquin: 2,
  brasas: 3.5, lava: 1 // Hito 96: las brasas se funden con la lava y con la roca de alrededor
};
// Terrenos naturales: admiten la segunda lectura girada sin que se note (no tienen dibujo regular de losas)
const ORGANIC = new Set(["hierba", "hierbalta", "musgo", "hojarasca", "raices", "nieve", "ceniza", "arena", "barro", "removida", "pisoteada", "tierra", "camino", "escombros", "cueva", "rocanevada", "volcanica", "juncos", "paja", "agua", "aguaprof", "lava", "brea", "brasas", "hielo", "hielofino"]);
// Cuánta variación de tono a gran escala (los suelos construidos, poca)
const MACRO = { madera: 0.35, alfombra: 0.25, marmol: 0.4, plataforma: 0.4, pasarela: 0.4, muelle: 0.4, cubierta: 0.35, runas: 0.4, railes: 0.5, agua: 0.5, aguaprof: 0.5, lava: 0.3 };

// Hito 89: ruido de gradiente (Perlin) con 3 octavas giradas: más suave, sin el patrón de cuadrícula del ruido de valor.
// Se reescala para cubrir casi todo 0..1 (el de gradiente se concentra en el centro), así los umbrales siguen valiendo.
const NOISE = `
float h84(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
vec2 g84(vec2 p){ float a = h84(p) * 6.2831853; return vec2(cos(a), sin(a)); }
float p84(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n00 = dot(g84(i), f), n10 = dot(g84(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float n01 = dot(g84(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), n11 = dot(g84(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return clamp(mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y) * 0.95 + 0.5, 0.0, 1.0); }
float f84(vec2 p){ float v = 0.0, amp = 0.55; mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += amp * p84(p); p = rot * p * 2.07 + vec2(13.7, 7.1); amp *= 0.48; }
  return (v - 0.5 * 0.9516) * 1.25 + 0.5; }
`;

/** Añade al material del suelo la variación a gran escala y, si es natural, la segunda lectura. `fringe`: borde que se desvanece. */
function install(m, k, fringe) {
  const bomb = ORGANIC.has(k) ? 0.62 : 0, macro = MACRO[k] ?? 1;
  m.onBeforeCompile = sh => {
    sh.uniforms.uBomb = { value: bomb }; sh.uniforms.uMacro = { value: macro };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW84;" + (fringe ? "\nattribute float edgeD;\nvarying float vE84;" : ""))
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvW84 = (modelMatrix * vec4(transformed, 1.0)).xyz;" + (fringe ? "\nvE84 = edgeD;" : ""));
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW84;\nuniform float uBomb;\nuniform float uMacro;" + (fringe ? "\nvarying float vE84;" : "") + NOISE)
      .replace("#include <map_fragment>", `
#ifdef USE_MAP
  vec4 tA = texture2D(map, vMapUv);
  vec2 uvB = mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.73 + vec2(0.37, 0.11);
  vec4 tB = texture2D(map, uvB);
  float nb = smoothstep(0.28, 0.72, f84(vW84.xz * 0.09));
  vec4 sampledDiffuseColor = tA;
  if (uBomb > 0.0) {
    // Hito 88: tercera lectura, girada y a otra escala (solo en terrenos naturales)
    vec4 tC = texture2D(map, mat2(0.6, 0.8, -0.8, 0.6) * vMapUv * 1.31 + vec2(0.19, 0.63));
    float nc = smoothstep(0.35, 0.65, f84(vW84.xz * 0.17 + 4.2));
    sampledDiffuseColor = mix(tA, mix(tB, tC, nc * 0.45), nb * uBomb);
  }
  float mac = f84(vW84.xz * 0.032) * 0.55 + f84(vW84.xz * 0.11 + 11.0) * 0.3 + f84(vW84.xz * 0.28 + 3.7) * 0.15;
  sampledDiffuseColor.rgb *= mix(1.0, 0.72 + 0.52 * mac, 0.6 * uMacro);
  // temperatura por zonas: unas algo más cálidas, otras algo más frías (de verdad, no solo más claras)
  float tmp = (f84(vW84.xz * 0.05 + 2.1) - 0.5) * uMacro;
  sampledDiffuseColor.rgb *= vec3(1.0 + tmp * 0.12, 1.0 + tmp * 0.02, 1.0 - tmp * 0.12);
  diffuseColor *= sampledDiffuseColor;
#endif
${fringe ? `
  float ne = f84(vW84.xz * 0.55) * 0.75 + f84(vW84.xz * 1.9 + 5.0) * 0.25;
  float edgeA = 1.0 - smoothstep(0.1, 0.9, vE84 + (ne - 0.5) * 1.4);
  diffuseColor.a *= edgeA;
  if (diffuseColor.a < 0.02) discard;` : ""}`);
  };
  m.customProgramCacheKey = () => "suelo89" + (fringe ? "f" : "");
  m.needsUpdate = true;
  return m;
}
export const enhanceFloor = (m, k) => install(m, k, false);

/** Material del borde que se mete en el vecino: el mismo del terreno, transparente y sin escribir profundidad. */
export function fringeMaterial(base, k) {
  const m = base.clone();
  m.transparent = true; m.depthWrite = false; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
  m.emissiveMap = base.emissiveMap; m.map = base.map; m.bumpMap = base.bumpMap; m.roughnessMap = base.roughnessMap;
  return install(m, k, true);
}

/**
 * Bordes de mezcla: por cada casilla de un terreno blando, una franja que entra en la casilla vecina de menor rango
 * (a la misma altura), con `edgeD` de 0 en la arista a 1 dentro del vecino. Devuelve { terreno: geometría }.
 */
export function fringeGeometries(g, cx, cz, CELL, elevY, isWall) {
  const ter = (c, r) => (g.terrain || {})[c + "," + r] || "piedra";
  const out = {}, h = CELL / 2, W = CELL * 0.85; // Hito 96: franja más ancha, para que no se lean cuadros
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const a = ter(c, r), pa = SPREAD[a]; if (!pa) continue;
    const ea = elevY(c, r);
    [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dc, dr]) => {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows || isWall(nc, nr)) return;
      const b = ter(nc, nr), pb = SPREAD[b];
      if (!pb || pb >= pa || Math.abs(elevY(nc, nr) - ea) > 0.01) return;
      const L = (out[a] = out[a] || { pos: [], uv: [], e: [], idx: [] });
      // franja dentro del vecino: arista compartida (edgeD 0) hacia dentro (edgeD 1); un poco más larga para cubrir esquinas
      const X = cx(c) + dc * h, Z = cz(r) + dr * h, y = ea + 0.02, ext = CELL * 0.12;
      const along = dc === 0 ? [1, 0] : [0, 1], inn = [dc, dr];
      const p = [
        [X - along[0] * (h + ext), Z - along[1] * (h + ext), 0], [X + along[0] * (h + ext), Z + along[1] * (h + ext), 0],
        [X + along[0] * (h + ext) + inn[0] * W, Z + along[1] * (h + ext) + inn[1] * W, 1], [X - along[0] * (h + ext) + inn[0] * W, Z - along[1] * (h + ext) + inn[1] * W, 1]
      ];
      const o = L.pos.length / 3;
      p.forEach(([x, z, e]) => { L.pos.push(x, y, z); L.uv.push(x / (CELL * 2), -z / (CELL * 2)); L.e.push(e); });
      L.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    // esquinas en diagonal: un cuarto redondeado en la casilla de la esquina, para que no queden escalones
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dc, dr]) => {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows || isWall(nc, nr)) return;
      const b = ter(nc, nr), pb = SPREAD[b];
      if (!pb || pb >= pa || Math.abs(elevY(nc, nr) - ea) > 0.01) return;
      if (ter(c + dc, r) === a || ter(c, r + dr) === a) return; // ya lo cubren las franjas de los lados
      const L = (out[a] = out[a] || { pos: [], uv: [], e: [], idx: [] });
      const X = cx(c) + dc * h, Z = cz(r) + dr * h, y = ea + 0.02, o = L.pos.length / 3;
      [[0, 0, 0], [W, 0, 1], [W, W, 1.35], [0, W, 1]].forEach(([u, v, e]) => { const x = X + dc * u, z = Z + dr * v; L.pos.push(x, y, z); L.uv.push(x / (CELL * 2), -z / (CELL * 2)); L.e.push(e); });
      if (dc * dr > 0) L.idx.push(o, o + 2, o + 1, o, o + 3, o + 2); else L.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
  }
  const geos = {};
  for (const [k, L] of Object.entries(out)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(L.pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(L.uv, 2));
    geo.setAttribute("edgeD", new THREE.Float32BufferAttribute(L.e, 1)); geo.setIndex(L.idx);
    const n = new Float32Array(L.pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1; geo.setAttribute("normal", new THREE.BufferAttribute(n, 3));
    geos[k] = geo;
  }
  return geos;
}
export const isSoft = k => !!SPREAD[k] && !!TERRAIN[k];
