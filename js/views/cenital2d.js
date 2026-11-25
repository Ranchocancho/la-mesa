// Hito 109: arte cenital de los objetos del plano 2D (como los recortes de Forgotten Adventures en Foundry).
// En vez de dibujar a mano casi doscientas piezas, se fotografía desde arriba la misma pieza 3D de la mesa:
// cámara ortográfica cenital, luz de arriba a la izquierda y sombra proyectada abajo a la derecha.
// Cada pieza se hace una sola vez por sesión (unas pocas decenas de milisegundos) y se guarda como imagen.
// Mientras no está lista, el plano sigue mostrando el icono de siempre.

const PX = 160;            // píxeles de la foto
const cache = new Map();   // clave → { url, span, ox, oy } | null (sin pieza 3D) | "…" (en cola)
const queue = [];
let busy = false, R = null, waiters = new Set(), failed = false;

/** Variante estable por casilla para piezas naturales (árboles, matas, rocas): tres versiones de cada una. */
const VARIED = new Set(["arbol", "arbusto", "roca", "penasco", "tocon", "setas", "arbolmuerto", "arbolgigante"]);
export const spriteKey = p => VARIED.has(p.k) ? `${p.k}:${Math.abs((p.c * 7 + p.r * 13) % 3)}` : p.k;

/** La foto de la pieza, o null si aún no está (y se pide). onReady se llama cuando haya fotos nuevas. */
export function spriteFor(p, onReady) {
  if (failed) return null;
  const k = spriteKey(p), v = cache.get(k);
  if (v && v !== "…") return v;
  if (v === undefined) { cache.set(k, "…"); queue.push(k); pump(); }
  if (onReady) waiters.add(onReady);
  return null;
}

async function setup() {
  const [THREE, mod] = await Promise.all([import("three"), import("./tablero3d.js")]);
  if (!mod.webglOK) throw new Error("sin WebGL");
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(PX, PX, false); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2a2420, 1.1));
  const sun = new THREE.DirectionalLight(0xffe8c8, 2.6); sun.position.set(-7, 9, -6); scene.add(sun); // luz de arriba a la izquierda
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200); cam.position.set(0, 80, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  return { THREE, mod, renderer, scene, cam };
}

async function pump() {
  if (busy) return; busy = true;
  try {
    if (!R) R = await setup();
    let made = 0;
    while (queue.length) {
      const k = queue.shift(), [kind, vr] = k.split(":");
      try { cache.set(k, await shoot(kind, vr ? (+vr + 1) / 4.3 : 0.5)); } catch (e) { console.warn("Pieza 2D", kind, e); cache.set(k, null); }
      made++;
      if (made % 6 === 0) { notify(); await new Promise(r => setTimeout(r, 0)); }
    }
    notify();
  } catch (e) { failed = true; console.warn("Sin arte cenital en 2D:", e.message || e); notify(); }
  busy = false;
}
function notify() { const w = [...waiters]; waiters.clear(); w.forEach(f => { try { f(); } catch (e) { /* nada */ } }); }

async function shoot(kind, seed) {
  const { THREE, mod, renderer, scene, cam } = R;
  const obj = await mod.propModel(kind, seed);
  if (!obj) return null;
  obj.traverse(o => { if (o.isPoints) o.visible = false; }); // las chispas del fuego, de arriba, son una mancha
  const holder = new THREE.Group(); holder.add(obj); scene.add(holder);
  holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(obj, true);
  if (bb.isEmpty()) { scene.remove(holder); return null; }
  const C = mod.PROP_CELL, cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  // lo que abarca la foto, en casillas (con aire para la sombra); nunca menos de una casilla
  const span = Math.max(1, Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / C * 1.12);
  const h = span * C / 2;
  cam.left = cx - h; cam.right = cx + h; cam.top = -cz + h; cam.bottom = -cz - h;
  cam.position.set(0, bb.max.y + 20, 0); cam.far = bb.max.y - bb.min.y + 60; cam.updateProjectionMatrix();
  // la cámara está centrada en el origen; se desplaza el encuadre con left/right/top/bottom
  renderer.render(scene, cam);
  scene.remove(holder);
  // sombra proyectada y un pelín de contraste, en un lienzo 2D
  const out = document.createElement("canvas"); out.width = out.height = PX; const g = out.getContext("2d");
  g.shadowColor = "rgba(0,0,0,.62)"; g.shadowBlur = PX * 0.045; g.shadowOffsetX = PX * 0.022; g.shadowOffsetY = PX * 0.03;
  g.drawImage(renderer.domElement, 0, 0);
  g.shadowColor = "transparent";
  // pieza vacía (sin píxeles): se queda con el icono
  const d = g.getImageData(0, 0, PX, PX).data; let any = false; for (let i = 3; i < d.length; i += 16) if (d[i] > 20) { any = true; break; }
  if (!any) return null;
  return { url: out.toDataURL("image/png"), span, ox: cx / C, oy: cz / C };
}
