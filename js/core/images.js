// Imágenes de la campaña (mapas, ilustraciones). Se guardan aparte del estado porque pesan mucho.
// Modo demostración: IndexedDB de este navegador. Modo nube: Firestore (ver cloud.js).
const DB = "lamesa-img", STORE = "img";
const cache = new Map();
let dbp = null;
let remote = null; // { put(key, dataURL), get(key) } cuando hay nube

export function setImageBackend(b) { remote = b; }

function db() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

export async function putImage(key, dataURL) {
  cache.set(key, dataURL);
  if (remote) { await remote.put(key, dataURL); return key; }
  try {
    const d = await db();
    await new Promise((res, rej) => { const t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).put(dataURL, key); t.oncomplete = res; t.onerror = () => rej(t.error); });
  } catch (e) { /* queda en memoria */ }
  return key;
}

const pending = new Map();
export async function getImage(key) {
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);
  if (pending.has(key)) return pending.get(key);
  const p = (async () => {
    try {
      let v = null;
      if (remote) v = await remote.get(key);
      else {
        const d = await db();
        v = await new Promise((res, rej) => { const r = d.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      }
      if (v) cache.set(key, v);
      return v || null;
    } catch (e) { return null; } finally { pending.delete(key); }
  })();
  pending.set(key, p);
  return p;
}

/** Lee un archivo de imagen y lo reduce para que no pese demasiado. */
export function readImageFile(file, max = 2400, quality = 0.86) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(fr.error);
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error("No es una imagen válida"));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res({ dataURL: c.toDataURL("image/jpeg", quality), w: c.width, h: c.height });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
