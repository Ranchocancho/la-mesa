// Dinero, tienda, botín del grupo y cofres.
// - Monedas del SRD: 1 po = 2 pe = 10 pp = 100 pc. Al pagar se da el cambio en monedas menores.
// - Tienda: precios y pesos de las tablas del SRD 5.2.1; se vende a la mitad de su precio (SRD, «Vender tesoros»).
//   El ajuste de precios por tienda es una regla de campaña (el SRD da precios fijos).
// - Botín del grupo (s.loot): lo que el grupo ha encontrado y aún no se ha repartido. Lo llena el máster (o un cofre
//   al abrirse); las monedas se reparten a partes iguales; cada objeto lo pide un jugador y el máster lo aprueba.
// - Dar algo a un compañero: propuesta en la ficha de quien da; al aprobarla, el máster lo pasa a la otra ficha.
import { store, uid } from "./store.js";
import { isDM, currentUser, runsTable } from "./session.js";
import { toast } from "./ui.js";
import { WEAPONS, ARMORS } from "../data/equipo.js";
import { GEAR } from "../data/tienda.js";
import { mod, prof } from "../data/dnd.js";
import { logTo } from "./propuestas.js";

export const COINS = [["po", "oro", 100], ["pe", "electro", 50], ["pp", "plata", 10], ["pc", "cobre", 1]];
export const toCp = c => COINS.reduce((a, [k, , v]) => a + (+((c || {})[k]) || 0) * v, 0);
/** «5 pp» → 50 pc. */
export const priceCp = pr => { const m = String(pr || "").match(/([\d.]+)\s*(po|pe|pp|pc)/); return m ? Math.round(+m[1].replace(".", "") * (COINS.find(x => x[0] === m[2]) || [, , 1])[2]) : null; };
/** 1234 pc → «12 po 3 pp 4 pc». */
export const fmtCp = cp => { if (!cp) return "0 pc"; const out = []; let r = Math.abs(cp); for (const [k, , v] of [["po", , 100], ["pp", , 10], ["pc", , 1]]) { const n = Math.floor(r / v); if (n) out.push(`${n} ${k}`); r -= n * v; } return (cp < 0 ? "−" : "") + out.join(" "); };
/** Paga «cost» pc: guarda las monedas grandes que puede y da el cambio en plata y cobre. null si no llega. */
export function pay(coins, cost) {
  const total = toCp(coins) - cost; if (total < 0) return null;
  const c = { po: 0, pe: 0, pp: 0, pc: 0 }; let r = total;
  c.po = Math.min(+coins.po || 0, Math.floor(r / 100)); r -= c.po * 100;
  c.pe = Math.min(+coins.pe || 0, Math.floor(r / 50)); r -= c.pe * 50;
  c.pp = Math.floor(r / 10); r -= c.pp * 10; c.pc = r;
  return c;
}
export const addCoins = (a, b) => Object.fromEntries(COINS.map(([k]) => [k, (+((a || {})[k]) || 0) + (+((b || {})[k]) || 0)]));

/* ---------- Catálogo ---------- */
export const CATS = [["arma", "⚔️ Armas"], ["armadura", "🛡 Armaduras"], ["aventura", "🎒 Aventura"], ["municion", "🏹 Munición"], ["herramienta", "🔧 Herramientas"], ["canalizador", "✨ Canalizadores"], ["montura", "🐴 Monturas"]];
let CAT = null;
export function catalog() {
  if (CAT) return CAT;
  CAT = [
    ...WEAPONS.map(w => ({ n: w.n, cat: "arma", pr: w.pr, kg: w.kg, d: `${w.d} ${w.t}${w.p ? " · " + w.p : ""}${w.m ? " · maestría: " + w.m : ""}`, w })),
    ...ARMORS.map(a => ({ n: a.n, cat: "armadura", pr: a.pr, kg: a.kg, d: `${a.cat}${a.cat === "escudo" ? ` · +${a.ca} CA` : ` · CA ${a.ca}${a.dex === null ? " + Des" : a.dex ? ` + Des (máx. ${a.dex})` : ""}`}${a.fue ? ` · Fue ${a.fue}` : ""}${a.sig ? " · desventaja en Sigilo" : ""}`, a })),
    ...GEAR.map(g => ({ ...g, d: "" }))
  ].map(x => ({ ...x, cp: priceCp(x.pr) })).filter(x => x.cp != null);
  return CAT;
}
export const findItem = n => { const k = String(n || "").toLowerCase().trim(); return catalog().find(x => x.n.toLowerCase() === k) || null; };
/** Precio con el ajuste de la tienda (regla de campaña, en %). */
export const adjCp = (cp, adj = 0) => Math.max(0, Math.round(cp * (1 + (+adj || 0) / 100)));
/** Ataque y daño de un arma del SRD para la ficha (se supone competencia; el máster lo revisa al aprobar). */
export function weaponRow(c, w) {
  const fin = /sutil/i.test(w.p || ""), rng = w.r === "dist", ab = rng ? "des" : fin ? (mod(c.abilities.des) > mod(c.abilities.fue) ? "des" : "fue") : "fue";
  const m = mod(c.abilities[ab]);
  return { id: uid("w"), name: w.n, atk: (m + prof(c.level) >= 0 ? "+" : "") + (m + prof(c.level)), dmg: `${w.d}${m ? (m > 0 ? "+" + m : m) : ""} ${w.t}`, notes: [w.p, w.m ? "Maestría: " + w.m : ""].filter(Boolean).join(" · ") };
}

/** Aplica una cesta a una copia de la ficha: compras (cantidad) y ventas (a mitad de precio). */
export function applyBasket(c0, buy, sell, adj = 0) {
  const c = JSON.parse(JSON.stringify(c0));
  const cost = buy.reduce((a, b) => a + adjCp(b.it.cp, adj) * b.q, 0), gain = sell.reduce((a, s) => a + Math.floor(s.cp / 2) * s.q, 0);
  const coins = pay(addCoins(c.coins, {}), cost - gain < 0 ? 0 : cost - gain); if (!coins) return null;
  if (cost - gain < 0) { const g = gain - cost; coins.po += Math.floor(g / 100); coins.pp += Math.floor((g % 100) / 10); coins.pc += g % 10; }
  c.coins = coins; c.inventory = c.inventory || []; c.weapons = c.weapons || [];
  for (const { it, q } of buy) {
    const inv = c.inventory.find(x => (x.name || "").toLowerCase() === it.n.toLowerCase());
    if (inv && it.cat !== "arma" && it.cat !== "armadura") inv.qty = (+inv.qty || 1) + q;
    else c.inventory.push({ id: uid("i"), name: it.n, qty: q, weight: it.kg || 0, notes: it.d || "" });
    if (it.w) c.weapons.push(weaponRow(c, it.w));
  }
  for (const s of sell) {
    const i = c.inventory.findIndex(x => x.id === s.id); if (i < 0) continue;
    const left = (+c.inventory[i].qty || 1) - s.q; if (left > 0) c.inventory[i].qty = left; else c.inventory.splice(i, 1);
  }
  return { c, cost, gain };
}

/* ---------- Botín del grupo ---------- */
/** Lo encontrado en la sesión en curso, apuntado en la propia sesión (para el centro de mando). */
function sessLoot(s, coins, items, from) {
  const l = (s.sessions || []).find(x => x.id === s.live && x.status === "open"); if (!l) return;
  const cp = toCp(coins); if (!cp && !items.length) return;
  l.loot = l.loot || []; l.loot.push({ at: Date.now(), cp, items: items.map(x => `${x.name}${(+x.qty || 1) > 1 ? " ×" + x.qty : ""}`), from: from || "" });
}
export const lootOf = s => s.loot || { coins: {}, items: [] };
/** El máster añade monedas u objetos al botín. */
export function addLoot(coins, items = [], from = "") {
  store.commit("loot", s => {
    const L = s.loot = s.loot || { coins: {}, items: [] };
    L.coins = addCoins(L.coins, coins);
    sessLoot(s, coins, items, from);
    items.forEach(x => L.items.push({ id: uid("bt"), name: x.name, qty: +x.qty || 1, weight: +x.weight || 0, notes: x.notes || "", magic: !!x.magic, attune: !!x.attune, from: from || x.from || "", at: Date.now() }));
  });
}
export const removeLootItem = id => store.commit("loot", s => { if (s.loot) s.loot.items = s.loot.items.filter(x => x.id !== id); });
/** Reparte las monedas del botín a partes iguales entre las fichas elegidas; el sobrante, para «rest» (o se queda). */
export function splitCoins(charIds, restTo = null) {
  const s0 = store.get(); if (!isDM(s0) || !charIds.length) return;
  store.commit("loot", s => {
    const L = s.loot = s.loot || { coins: {}, items: [] };
    const total = toCp(L.coins); if (!total) return;
    const each = Math.floor(total / charIds.length), rest = total - each * charIds.length;
    const share = cp => ({ po: Math.floor(cp / 100), pp: Math.floor((cp % 100) / 10), pc: cp % 10 });
    charIds.forEach(id => { const c = s.characters.find(x => x.id === id); if (!c) return;
      const g = each + (restTo === id ? rest : 0); c.coins = addCoins(c.coins, share(g));
      logTo(c, s, "maestro", [`Botín repartido: + ${fmtCp(g)}`]); });
    L.coins = restTo ? {} : share(rest);
  });
  toast("Monedas repartidas.");
}
/** El máster da un objeto del botín directamente a una ficha. */
export function assignLoot(itemId, charId) {
  store.commit("loot", s => {
    const L = s.loot, it = L && L.items.find(x => x.id === itemId), c = s.characters.find(x => x.id === charId); if (!it || !c) return;
    c.inventory = c.inventory || []; c.inventory.push(lootToInv(it));
    L.items = L.items.filter(x => x.id !== itemId);
    logTo(c, s, "maestro", [`Botín: + ${it.name}${it.qty > 1 ? " ×" + it.qty : ""}`]);
  });
}
export const lootToInv = it => ({ id: uid("i"), name: it.name, qty: it.qty || 1, weight: it.weight || 0, notes: [it.notes, it.magic ? "objeto mágico" : "", it.attune ? "requiere sintonización" : "", it.from ? "de: " + it.from : ""].filter(Boolean).join(" · "), ...(it.attune ? { attune: true } : {}) });
/** Objetos sintonizados que ya lleva (SRD: máximo 3). */
export const attunedCount = c => (c.inventory || []).filter(x => x.attuned).length;

/* ---------- Cofres de la escena ---------- */
/** Vacía un cofre en el botín del grupo y lo anuncia (lo hace el máster; si lo pide un jugador, al verlo). */
export function openChest(propId, by = "") {
  const s0 = store.get(); if (!isDM(s0)) return;
  store.commit("loot", s => {
    const p = ((s.board && s.board.props) || []).find(x => x.id === propId); if (!p || p.opened) return;
    const ch = p.chest || { coins: {}, items: [] }, name = p.label || "Cofre";
    const L = s.loot = s.loot || { coins: {}, items: [] };
    L.coins = addCoins(L.coins, ch.coins);
    sessLoot(s, ch.coins, ch.items || [], name);
    (ch.items || []).forEach(x => L.items.push({ id: uid("bt"), name: x.name, qty: +x.qty || 1, weight: +x.weight || 0, notes: x.notes || "", magic: !!x.magic, attune: !!x.attune, from: name, at: Date.now() }));
    p.opened = true; p.hidden = false;
    const lines = [toCp(ch.coins) ? COINS.filter(([k]) => +(ch.coins || {})[k]).map(([k]) => `${+ch.coins[k]} ${k}`).join(" ") : "", ...(ch.items || []).map(x => `${x.name}${x.qty > 1 ? " ×" + x.qty : ""}`), p.loot || ""].filter(Boolean);
    s.rolls = s.rolls || [];
    s.rolls.push({ id: uid("tir"), at: Date.now(), who: (currentUser(s) || {}).id || null, whoName: by || (currentUser(s) || {}).name || "", kind: "loot", label: `${name}: ${lines.join(", ") || "vacío"}`, expr: "", dice: [], total: null, status: "ok", note: "Al botín del grupo" });
  });
}
/** Petición de un jugador para abrir un cofre junto a su figura (la procesa el máster: main.js). */
export function requestOpen(propId, tokId) {
  const s = store.get(), u = currentUser(s) || {};
  store.commit("roll", st => { st.rolls = st.rolls || []; st.rolls.push({ id: uid("tir"), at: Date.now(), who: u.id || null, whoName: u.name || "", kind: "open", prop: propId, tok: tokId, label: "Abre un cofre", expr: "", dice: [], total: null, status: "pending" }); });
}

/** En el cliente del máster: atiende las peticiones de abrir cofres (el jugador debe seguir junto al cofre). */
export function watchChests() {
  let busy = false, seen = null;
  const check = () => {
    const s = store.get(), ids = ((s.loot || {}).items || []).map(x => x.id);
    if (seen === null) seen = new Set(ids);
    else { const nw = ((s.loot || {}).items || []).filter(x => !seen.has(x.id)); ids.forEach(i => seen.add(i)); if (nw.length && !isDM(s)) toast(`💰 Nuevo en el botín del grupo: ${nw.map(x => x.name).join(", ")}. Míralo en Personajes → Grupo.`); }
    if (!runsTable(s) || busy) return;
    const r = (s.rolls || []).find(x => x.kind === "open" && x.status === "pending"); if (!r) return;
    busy = true;
    queueMicrotask(() => {
      const st = store.get(), p = ((st.board && st.board.props) || []).find(x => x.id === r.prop), t = st.tokens.find(x => x.id === r.tok);
      const ok = p && !p.opened && !p.hidden && t && Math.max(Math.abs(p.c - t.c), Math.abs(p.r - t.r)) <= 1;
      if (ok) openChest(r.prop, r.whoName);
      store.commit("roll", x => { const y = (x.rolls || []).find(z => z.id === r.id); if (y) { y.status = ok ? "ok" : "fail"; y.label = ok ? "Abre el cofre" : "No llega a abrir el cofre"; } });
      busy = false;
    });
  };
  store.subscribe(check);
  setInterval(check, 2500); // por si el máster entra con peticiones ya pendientes
}
