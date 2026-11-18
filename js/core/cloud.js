// Conexión con Firebase: cuentas de Google, campañas y sincronización en tiempo real.
//
// Cómo se guarda una campaña en Firestore (las reglas están en firestore.rules):
//   campaigns/{cid}                datos generales: nombre, miembros, sesiones, presentación, mapa, personajes
//   campaigns/{cid}/places/{id}    lugares del mapa (los jugadores solo reciben los visibles)
//   campaigns/{cid}/items/{id}     contenido de los lugares (los jugadores solo reciben lo revelado)
//   campaigns/{cid}/secrets/{id}   notas secretas del máster (solo el máster)
//   campaigns/{cid}/images/{key}   imágenes troceadas en documentos de menos de 1 MB
//   campaigns/{cid}/presence/{uid} última señal de cada participante
import { firebaseConfig } from "./firebase-config.js";
import { store, useCloud } from "./store.js";
import { session } from "./session.js";
import { presence } from "./presence.js";
import { setImageBackend } from "./images.js";
import { seed } from "../data/seed.js";

const V = "10.12.2";
const BASE = `https://www.gstatic.com/firebasejs/${V}/`;
const COLORS = ["#79a85a", "#c97a3d", "#7d8fe0", "#e0d6b0", "#b4583a", "#8a9a4a", "#9b6bc4", "#4f9aa0"];

let fb, auth, db;
const unsubs = [];
const cache = { campaign: null, places: new Map(), items: new Map(), secrets: new Map(), got: new Set() };
let last = new Map();       // lo último sincronizado, para enviar solo lo que cambia
let beatTimer = null;

export const cloud = {
  status: "init",   // init | out | lobby | joining | loading | ready | error
  user: null,
  cid: null,
  campaigns: [],
  joinable: null,
  error: null,
  isDM: false
};
const watchers = new Set();
export const onCloud = fn => watchers.add(fn);
const ping = () => watchers.forEach(fn => fn());

const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignorado */ } };
const urlCid = () => new URLSearchParams(location.search).get("c");
const clean = v => JSON.parse(JSON.stringify(v));
const initials = name => (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");

export async function initCloud() {
  const [a, au, fs] = await Promise.all([import(BASE + "firebase-app.js"), import(BASE + "firebase-auth.js"), import(BASE + "firebase-firestore.js")]);
  fb = { ...a, ...au, ...fs };
  const app = fb.initializeApp(firebaseConfig);
  auth = fb.getAuth(app);
  db = fb.getFirestore(app);
  useCloud(push);
  setImageBackend({ put: putImageCloud, get: getImageCloud });
  fb.onAuthStateChanged(auth, async u => {
    cloud.user = u;
    if (!u) { stopCampaign(); session.clear(); cloud.status = "out"; ping(); return; }
    session.set(u.uid);
    const want = urlCid() || lsGet("lamesa:cid");
    if (want) await openCampaign(want);
    else await toLobby();
  });
}

export async function signIn() {
  try { await fb.signInWithPopup(auth, new fb.GoogleAuthProvider()); }
  catch (e) { cloud.error = e.code === "auth/popup-closed-by-user" ? null : "No se pudo entrar con Google. Revisa que el navegador permita ventanas emergentes."; ping(); }
}
export async function signOut() { stopCampaign(); lsSet("lamesa:cid", null); await fb.signOut(auth); }

/* ---------- Campañas ---------- */
export async function toLobby() {
  stopCampaign();
  lsSet("lamesa:cid", null);
  if (urlCid()) history.replaceState(null, "", location.pathname + location.hash);
  cloud.status = "lobby"; cloud.joinable = null; ping();
  try {
    const q = fb.query(fb.collection(db, "campaigns"), fb.where("memberIds", "array-contains", cloud.user.uid));
    const snap = await fb.getDocs(q);
    cloud.campaigns = snap.docs.map(d => ({ id: d.id, name: d.data().name, dm: d.data().dm === cloud.user.uid, session: d.data().session }));
  } catch (e) { cloud.campaigns = []; cloud.error = "No se pudieron cargar tus campañas."; }
  ping();
}

export async function openCampaign(cid) {
  stopCampaign();
  cloud.status = "loading"; cloud.error = null; ping();
  let snap;
  try { snap = await fb.getDoc(fb.doc(db, "campaigns", cid)); }
  catch (e) { cloud.error = "No se pudo abrir la campaña."; return toLobby(); }
  if (!snap.exists()) { cloud.error = "Esa campaña no existe o el enlace está mal copiado."; return toLobby(); }
  const data = snap.data();
  if (!(data.memberIds || []).includes(cloud.user.uid)) {
    cloud.status = "joining"; cloud.joinable = { cid, name: data.name }; ping(); return;
  }
  cloud.cid = cid;
  cloud.isDM = data.dm === cloud.user.uid;
  lsSet("lamesa:cid", cid);
  const url = new URL(location.href); url.searchParams.set("c", cid); history.replaceState(null, "", url);
  listen(cid);
}

export async function joinCampaign() {
  const j = cloud.joinable; if (!j) return;
  const u = cloud.user;
  const me = { role: "player", name: u.displayName || "Jugador", initials: initials(u.displayName), color: COLORS[Math.floor(Math.random() * COLORS.length)], photo: u.photoURL || null };
  try {
    await fb.updateDoc(fb.doc(db, "campaigns", j.cid), { memberIds: fb.arrayUnion(u.uid), ["members." + u.uid]: me });
    await openCampaign(j.cid);
  } catch (e) { cloud.error = "No se pudo entrar en la campaña."; ping(); }
}

export async function createCampaign(name, withExample) {
  const u = cloud.user;
  const ref = fb.doc(fb.collection(db, "campaigns"));
  const s = seed();
  const me = { role: "dm", name: u.displayName || "Máster", initials: initials(u.displayName), color: "#d6aa4e", photo: u.photoURL || null };
  s.campaign.name = name || "Nueva campaña";
  s.campaign.session = withExample ? s.campaign.session : 1;
  s.users = [{ id: u.uid, ...me }];
  s.characters = withExample ? s.characters.map(c => ({ ...c, owner: null })) : [];
  if (!withExample) { s.world.places = []; s.sessions = []; }
  const docs = docsOf(s, true);
  const batch = fb.writeBatch(db);
  batch.set(ref, { ...clean(docs.get("C")), dm: u.uid, memberIds: [u.uid], createdAt: Date.now() });
  for (const [k, v] of docs) if (k !== "C") batch.set(fb.doc(db, "campaigns", ref.id, ...k.split("/")), clean(v));
  await batch.commit();
  await openCampaign(ref.id);
}

/* ---------- Escucha en tiempo real ---------- */
function listen(cid) {
  const dm = cloud.isDM;
  const col = n => fb.collection(db, "campaigns", cid, n);
  const need = dm ? ["campaign", "places", "items", "secrets"] : ["campaign", "places", "items"];
  cache.got.clear();
  const done = k => { cache.got.add(k); if (need.every(n => cache.got.has(n))) refresh(); };
  const fail = e => { console.error(e); cloud.error = "Se perdió la conexión con la campaña. Recarga la página."; ping(); };
  unsubs.push(fb.onSnapshot(fb.doc(db, "campaigns", cid), d => { cache.campaign = d.data(); done("campaign"); }, fail));
  unsubs.push(fb.onSnapshot(dm ? col("places") : fb.query(col("places"), fb.where("visible", "==", true)), s => { cache.places = new Map(s.docs.map(d => [d.id, d.data()])); done("places"); }, fail));
  unsubs.push(fb.onSnapshot(dm ? col("items") : fb.query(col("items"), fb.where("revealed", "==", true)), s => { cache.items = new Map(s.docs.map(d => [d.id, d.data()])); done("items"); }, fail));
  if (dm) unsubs.push(fb.onSnapshot(col("secrets"), s => { cache.secrets = new Map(s.docs.map(d => [d.id, d.data()])); done("secrets"); }, fail));
  unsubs.push(fb.onSnapshot(col("presence"), s => { const m = {}; s.docs.forEach(d => (m[d.id] = d.data().t)); presence.feed(m); }, () => {}));
  const beat = () => fb.setDoc(fb.doc(db, "campaigns", cid, "presence", cloud.user.uid), { t: Date.now() }).catch(() => {});
  beat(); beatTimer = setInterval(beat, 25000);
}

function stopCampaign() {
  unsubs.splice(0).forEach(u => u());
  clearInterval(beatTimer); beatTimer = null;
  cache.campaign = null; cache.places.clear(); cache.items.clear(); cache.secrets.clear(); cache.got.clear();
  last = new Map(); cloud.cid = null; cloud.isDM = false;
}

function refresh() {
  const c = cache.campaign; if (!c) return;
  const strip = (o, ...keys) => { const r = { ...o }; keys.forEach(k => delete r[k]); return r; };
  const users = Object.entries(c.members || {}).map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => (a.role === "dm" ? -1 : b.role === "dm" ? 1 : a.name.localeCompare(b.name)));
  const items = [...cache.items.entries()].map(([id, i]) => ({ id, ...i }));
  const places = [...cache.places.entries()].map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(p => ({
      ...strip(p, "order"),
      secret: (cache.secrets.get(p.id) || {}).secret || "",
      items: items.filter(i => i.place === p.id).sort((a, b) => (a.order || 0) - (b.order || 0)).map(i => strip(i, "place", "order"))
    }));
  const prev = store.get();
  const state = {
    version: 1, rev: ((prev && prev.rev) || 0) + 1,
    campaign: { name: c.name, session: c.session, rules: c.rules || "D&D 2024" },
    users, characters: c.characters || [],
    world: { map: c.map ? c.map.key : null, mapW: c.map ? c.map.w : null, mapH: c.map ? c.map.h : null, places },
    sessions: c.sessions || [], presentation: c.presentation || null
  };
  last = new Map([...docsOf(state, cloud.isDM)].map(([k, v]) => [k, JSON.stringify(v)]));
  const first = cloud.status !== "ready";
  cloud.status = "ready";
  store.replace(state, first ? "open" : "remote");
  if (first) ping();
}

/* ---------- Envío de cambios ---------- */
function docsOf(s, dm) {
  const out = new Map();
  const members = {};
  s.users.forEach(u => { const { id, ...m } = u; members[id] = m; });
  out.set("C", {
    name: s.campaign.name, session: s.campaign.session, rules: s.campaign.rules,
    sessions: s.sessions, presentation: s.presentation || null,
    map: s.world.map ? { key: s.world.map, w: s.world.mapW, h: s.world.mapH } : null,
    characters: s.characters, members
  });
  s.world.places.forEach((p, i) => {
    const { items, secret, id, ...rest } = p;
    out.set("places/" + id, { ...rest, order: i });
    if (dm) out.set("secrets/" + id, { secret: secret || "" });
    (items || []).forEach((it, j) => { const { id: iid, ...ir } = it; out.set("items/" + iid, { ...ir, place: id, order: j }); });
  });
  return out;
}

function push(state) {
  if (!cloud.cid || !cloud.isDM) return; // de momento solo el máster modifica la campaña
  const now = docsOf(state, true);
  const batch = fb.writeBatch(db);
  let n = 0;
  const ref = k => k === "C" ? fb.doc(db, "campaigns", cloud.cid) : fb.doc(db, "campaigns", cloud.cid, ...k.split("/"));
  for (const [k, v] of now) {
    const j = JSON.stringify(v);
    if (last.get(k) !== j) { batch.set(ref(k), clean(v), k === "C" ? { merge: true } : {}); n++; }
  }
  for (const k of last.keys()) if (!now.has(k)) { batch.delete(ref(k)); n++; }
  last = new Map([...now].map(([k, v]) => [k, JSON.stringify(v)]));
  if (n) batch.commit().catch(e => { console.error(e); cloud.error = "No se pudo guardar el último cambio. Comprueba la conexión."; ping(); });
}

/* ---------- Imágenes en Firestore (troceadas) ---------- */
const CHUNK = 900000;
async function putImageCloud(key, dataURL) {
  const parts = [];
  for (let i = 0; i < dataURL.length; i += CHUNK) parts.push(dataURL.slice(i, i + CHUNK));
  const batch = fb.writeBatch(db);
  batch.set(fb.doc(db, "campaigns", cloud.cid, "images", key), { n: parts.length });
  parts.forEach((d, i) => batch.set(fb.doc(db, "campaigns", cloud.cid, "images", key, "c", String(i)), { d }));
  await batch.commit();
}
async function getImageCloud(key) {
  if (!cloud.cid) return null;
  const meta = await fb.getDoc(fb.doc(db, "campaigns", cloud.cid, "images", key));
  if (!meta.exists()) return null;
  const n = meta.data().n;
  const docs = await Promise.all(Array.from({ length: n }, (_, i) => fb.getDoc(fb.doc(db, "campaigns", cloud.cid, "images", key, "c", String(i)))));
  return docs.map(d => d.data().d).join("");
}

export const inviteLink = () => { const u = new URL(location.href); u.search = "?c=" + cloud.cid; u.hash = ""; return u.toString(); };
