// Tienda, botín del grupo y dar objetos a un compañero.
// El jugador prepara la compra (o el reparto) y la envía como propuesta; el máster la aprueba o la aplica él mismo.
import { store } from "../core/store.js";
import { $, $$, esc, toast } from "../core/ui.js";
import { isDM, currentUser } from "../core/session.js";
import { capacity, carried } from "../data/dnd.js";
import { catalog, CATS, adjCp, fmtCp, toCp, applyBasket, lootOf, addLoot, splitCoins, assignLoot, removeLootItem, lootToInv, attunedCount, priceCp, findItem, COINS } from "../core/comercio.js";
import { diffChar, propose, logTo, describe } from "../core/propuestas.js";

const overlay = (id, html) => { document.getElementById(id)?.remove(); const ov = document.createElement("div"); ov.className = "reqdlg"; ov.id = id; ov.innerHTML = html; document.body.appendChild(ov); return ov; };

/* ---------- Tienda ---------- */
let Q = "", CAT = "", BUY = new Map(), SELL = new Map();
export function openShop(charId) {
  Q = ""; CAT = ""; BUY = new Map(); SELL = new Map();
  const ov = overlay("shopdlg", ""); drawShop(ov, charId);
}
function drawShop(ov, charId) {
  const s = store.get(), c = s.characters.find(x => x.id === charId); if (!c) return ov.remove();
  const dm = isDM(s), adj = +s.shopAdj || 0, all = catalog();
  const list = all.filter(x => (!CAT || x.cat === CAT) && (!Q || x.n.toLowerCase().includes(Q.toLowerCase()))).slice(0, 120);
  const buy = [...BUY.entries()].map(([n, q]) => ({ it: all.find(x => x.n === n), q })).filter(x => x.it && x.q > 0);
  const sell = [...SELL.entries()].map(([id, q]) => { const i = (c.inventory || []).find(x => x.id === id), it = i && findItem(i.name); return i && it ? { id, q, cp: it.cp, name: i.name } : null; }).filter(Boolean);
  const R = applyBasket(c, buy, sell, adj);
  const w = R ? carried(R.c) : carried(c), cap = capacity(c);
  const sellable = (c.inventory || []).map(i => ({ i, it: findItem(i.name) })).filter(x => x.it);
  ov.innerHTML = `<div class="modalbox shopbox"><header><h3>🛒 Tienda · ${esc(c.name)}</h3><button class="x" data-close aria-label="Cerrar">✕</button></header>
    <div class="shopgrid"><section class="shopcat">
      <input id="shq" type="search" placeholder="Buscar (cuerda, raciones, espada…)" value="${esc(Q)}">
      <div class="cptypes side"><button data-cat="" aria-pressed="${!CAT}">Todo</button>${CATS.map(([k, n]) => `<button data-cat="${k}" aria-pressed="${CAT === k}">${n}</button>`).join("")}</div>
      <div class="shoplist">${list.map(x => { const q = BUY.get(x.n) || 0; return `<div class="shopit ${q ? "in" : ""}"><div><b>${esc(x.n)}</b>${x.d ? `<small>${esc(x.d)}</small>` : ""}</div><span class="pr">${fmtCp(adjCp(x.cp, adj))}</span><span class="kg">${x.kg ? String(x.kg).replace(".", ",") + " kg" : "—"}</span>
        <span class="qty">${q ? `<button data-dec="${esc(x.n)}" aria-label="Quitar uno">−</button><b>${q}</b>` : ""}<button data-inc="${esc(x.n)}" aria-label="Añadir">+</button></span></div>`; }).join("") || `<p class="empty">Nada con ese nombre.</p>`}</div>
      <p class="note">Precios y pesos del SRD 5.2.1${adj ? ` con un ajuste del ${adj > 0 ? "+" : ""}${adj} % en esta tienda (regla de campaña)` : ""}.${dm ? ` Ajuste de esta tienda: <input id="shadj" type="number" step="5" value="${adj}" style="width:64px"> %` : ""}</p>
    </section><section class="shopcart">
      <h4>Compras</h4>${buy.length ? `<ul>${buy.map(b => `<li>${esc(b.it.n)} ×${b.q}<span>${fmtCp(adjCp(b.it.cp, adj) * b.q)}</span></li>`).join("")}</ul>` : `<p class="empty">Añade cosas con +.</p>`}
      <h4>Vender <small>a la mitad de su precio (SRD)</small></h4>
      ${sellable.length ? `<div class="sellist">${sellable.map(({ i, it }) => { const q = SELL.get(i.id) || 0, max = +i.qty || 1; return `<div class="sellit ${q ? "in" : ""}"><span>${esc(i.name)}${max > 1 ? ` <small>(tienes ${max})</small>` : ""}</span><span>${fmtCp(Math.floor(it.cp / 2))}</span><span class="qty">${q ? `<button data-sdec="${i.id}">−</button><b>${q}</b>` : ""}${q < max ? `<button data-sinc="${i.id}">+</button>` : ""}</span></div>`; }).join("")}</div>` : `<p class="empty">Nada de tu equipo está en la lista del SRD.</p>`}
      <div class="shoptot"><div><span>Compras</span><b>${fmtCp(R ? R.cost : buy.reduce((a, b) => a + adjCp(b.it.cp, adj) * b.q, 0))}</b></div>
        <div><span>Ventas</span><b>${fmtCp(sell.reduce((a, x) => a + Math.floor(x.cp / 2) * x.q, 0))}</b></div>
        <div><span>Tienes</span><b>${fmtCoins(c.coins)}</b></div>
        <div class="${R ? "" : "bad"}"><span>Te quedará</span><b>${R ? fmtCoins(R.c.coins) : "no te llega"}</b></div>
        <div class="${w > cap ? "bad" : ""}"><span>Peso</span><b>${Math.round(w * 10) / 10} / ${cap} kg</b></div></div>
      <input id="shnote" placeholder="Dónde y a quién (opcional)" maxlength="200">
      <button class="btn gold" id="shgo" ${!R || (!buy.length && !sell.length) ? "disabled" : ""}>${dm ? "✓ Aplicar la compra" : "Enviar al máster"}</button>
      ${dm ? "" : `<p class="note">El máster la verá en tu ficha y la aprobará.</p>`}
    </section></div></div>`;
  const redraw = () => drawShop(ov, charId);
  $("[data-close]", ov).onclick = () => ov.remove();
  const q = $("#shq", ov); q.oninput = () => { Q = q.value; const p = q.selectionStart; redraw(); const n = $("#shq", ov); n.focus(); n.setSelectionRange(p, p); };
  $$("[data-cat]", ov).forEach(b => b.onclick = () => { CAT = b.dataset.cat; redraw(); });
  $$("[data-inc]", ov).forEach(b => b.onclick = () => { BUY.set(b.dataset.inc, (BUY.get(b.dataset.inc) || 0) + 1); redraw(); });
  $$("[data-dec]", ov).forEach(b => b.onclick = () => { BUY.set(b.dataset.dec, Math.max(0, (BUY.get(b.dataset.dec) || 0) - 1)); redraw(); });
  $$("[data-sinc]", ov).forEach(b => b.onclick = () => { SELL.set(b.dataset.sinc, (SELL.get(b.dataset.sinc) || 0) + 1); redraw(); });
  $$("[data-sdec]", ov).forEach(b => b.onclick = () => { SELL.set(b.dataset.sdec, Math.max(0, (SELL.get(b.dataset.sdec) || 0) - 1)); redraw(); });
  const ad = $("#shadj", ov); if (ad) ad.onchange = () => { store.commit("loot", st => { st.shopAdj = Math.max(-90, Math.min(500, +ad.value || 0)); }); redraw(); };
  const go = $("#shgo", ov); if (go) go.onclick = () => {
    if (!R) return;
    const note = ["Tienda", buy.length ? "compra " + buy.map(b => `${b.it.n}${b.q > 1 ? " ×" + b.q : ""}`).join(", ") : "", sell.length ? "vende " + sell.map(x => `${x.name}${x.q > 1 ? " ×" + x.q : ""}`).join(", ") : "", ($("#shnote", ov).value || "").trim()].filter(Boolean).join(" · ");
    const ch = diffChar(c, R.c);
    if (dm) { store.commit("char", st => { const x = st.characters.find(y => y.id === charId); if (!x) return; ch.forEach(k => { x[k.path.split(".")[0]] = JSON.parse(JSON.stringify(R.c[k.path.split(".")[0]])); }); logTo(x, st, "maestro", [note, ...ch.map(describe)]); }); toast("Compra aplicada."); ov.remove(); }
    else if (propose(charId, ch, note)) ov.remove();
  };
}

/** Monedas tal cual están en la bolsa (sin convertir), para que coincida con la ficha. */
const fmtCoins = co => COINS.filter(([k]) => +(co || {})[k]).map(([k]) => `${+co[k]} ${k}`).join(" · ") || "0";

/* ---------- Dar a un compañero ---------- */
export function openGive(charId) {
  const s = store.get(), c = s.characters.find(x => x.id === charId); if (!c) return;
  const mates = s.characters.filter(x => x.id !== charId);
  const ov = overlay("givedlg", `<div class="modalbox"><header><h3>🤝 Dar a un compañero · ${esc(c.name)}</h3><button class="x" data-close aria-label="Cerrar">✕</button></header>
    <label class="field">Para<select id="gto">${mates.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}</select></label>
    <h4>Objetos</h4><div class="sellist">${(c.inventory || []).map(i => `<label class="sellit"><span>${esc(i.name)}${(+i.qty || 1) > 1 ? ` <small>(tienes ${i.qty})</small>` : ""}</span><input type="number" min="0" max="${+i.qty || 1}" value="0" data-gq="${i.id}" style="width:64px" aria-label="Cantidad de ${esc(i.name)}"></label>`).join("") || `<p class="empty">No llevas nada.</p>`}</div>
    <h4>Monedas</h4><div class="row">${COINS.map(([k, n]) => `<label class="field" style="width:80px">${n}<input type="number" min="0" max="${+(c.coins || {})[k] || 0}" value="0" data-gc="${k}"></label>`).join("")}</div>
    <footer><span class="grow"></span><button class="btn gold" id="ggo">Enviar al máster</button></footer>
    <p class="note">El máster lo verá y, al aprobarlo, pasará de tu ficha a la de tu compañero.</p></div>`);
  $("[data-close]", ov).onclick = () => ov.remove();
  $("#ggo", ov).onclick = () => {
    const to = $("#gto", ov).value, t = s.characters.find(x => x.id === to), d = JSON.parse(JSON.stringify(c)), items = [], coins = {};
    $$("[data-gq]", ov).forEach(i => { const q = Math.max(0, Math.min(+i.max, +i.value || 0)); if (!q) return; const k = d.inventory.findIndex(x => x.id === i.dataset.gq); const it = d.inventory[k];
      items.push({ name: it.name, qty: q, weight: it.weight || 0, notes: it.notes || "" }); if ((+it.qty || 1) - q > 0) it.qty = (+it.qty || 1) - q; else d.inventory.splice(k, 1); });
    $$("[data-gc]", ov).forEach(i => { const q = Math.max(0, Math.min(+i.max, +i.value || 0)); if (q) { coins[i.dataset.gc] = q; d.coins[i.dataset.gc] = (+d.coins[i.dataset.gc] || 0) - q; } });
    if (!items.length && !Object.keys(coins).length) return toast("Elige qué das.");
    if (propose(charId, diffChar(c, d), `Dar a ${t ? t.name : "un compañero"}`, { give: { to, items, coins: Object.keys(coins).length ? coins : null } })) ov.remove();
  };
}

/* ---------- Botín del grupo ---------- */
export function lootHTML(s) {
  const L = lootOf(s), dm = isDM(s), me = currentUser(s), mine = s.characters.filter(c => me && c.owner === me.id);
  const pending = new Set(s.characters.flatMap(c => (c.proposals || []).flatMap(p => (p.meta && p.meta.lootTake) || [])));
  const coins = toCp(L.coins);
  if (!dm && !coins && !L.items.length) return "";
  return `<section class="lootbox"><h2 class="sec">💰 Botín del grupo <small>lo encontrado que aún no se ha repartido</small></h2>
    <div class="lootcoins"><span>Monedas: <b>${coins ? fmtCp(coins) : "ninguna"}</b></span>
      ${dm && coins ? `<details class="lootsplit"><summary class="btn small gold">Repartir monedas</summary><div class="splitbox">${s.characters.map(c => `<label class="mini"><input type="checkbox" data-split="${c.id}" checked> ${esc(c.name)}</label>`).join("")}
        <label class="field">El sobrante<select id="lrest"><option value="">Se queda en el botín</option>${s.characters.map(c => `<option value="${c.id}">Para ${esc(c.name)}</option>`).join("")}</select></label>
        <button class="btn small gold" id="lsplit">Repartir a partes iguales</button></div></details>` : ""}</div>
    <div class="lootitems">${L.items.map(it => `<div class="lootit"><div><b>${it.magic ? "✨ " : ""}${esc(it.name)}${it.qty > 1 ? " ×" + it.qty : ""}</b><small>${esc([it.notes, it.attune ? "requiere sintonización" : "", it.from ? "de " + it.from : ""].filter(Boolean).join(" · "))}</small></div>
      ${dm ? `<select data-assign="${it.id}" aria-label="Dar a"><option value="">Dar a…</option>${s.characters.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select><button class="btn small danger" data-ldel="${it.id}" aria-label="Quitar">✕</button>`
        : pending.has(it.id) ? `<small class="note">pedido, esperando al máster</small>` : mine.map(c => `<button class="btn small" data-claim="${it.id}|${c.id}">Me lo quedo${mine.length > 1 ? " (" + esc(c.name) + ")" : ""}</button>`).join("")}</div>`).join("") || `<p class="empty">Sin objetos.</p>`}</div>
    ${dm ? `<details class="lootadd"><summary class="btn small">+ Añadir al botín</summary><div class="row">
      ${COINS.map(([k, n]) => `<label class="field" style="width:78px">${n}<input type="number" min="0" value="0" data-lc="${k}"></label>`).join("")}</div>
      <div class="row"><input id="lname" list="lcat" placeholder="Objeto (del SRD o el que quieras)" style="flex:2"><input id="lqty" type="number" min="1" value="1" style="width:64px" aria-label="Cantidad">
        <label class="mini"><input type="checkbox" id="lmagic"> mágico</label><label class="mini"><input type="checkbox" id="latt"> sintonización</label></div>
      <div class="row"><input id="lfrom" placeholder="De dónde sale (el jefe goblin, el cofre del sótano…)" style="flex:1"><button class="btn small gold" id="ladd">Añadir</button></div>
      <datalist id="lcat">${catalog().map(x => `<option value="${esc(x.n)}">`).join("")}</datalist></details>` : ""}
  </section>`;
}
export function bindLoot(el) {
  const s = store.get();
  $$("[data-assign]", el).forEach(x => x.onchange = () => { if (x.value) assignLoot(x.dataset.assign, x.value); });
  $$("[data-ldel]", el).forEach(b => b.onclick = () => removeLootItem(b.dataset.ldel));
  const sp = $("#lsplit", el); if (sp) sp.onclick = () => splitCoins($$("[data-split]", el).filter(i => i.checked).map(i => i.dataset.split), $("#lrest", el).value || null);
  const ad = $("#ladd", el); if (ad) ad.onclick = () => {
    const coins = Object.fromEntries($$("[data-lc]", el).map(i => [i.dataset.lc, Math.max(0, +i.value || 0)]));
    const n = ($("#lname", el).value || "").trim(), it = n && findItem(n);
    const items = n ? [{ name: n, qty: Math.max(1, +$("#lqty", el).value || 1), weight: it ? it.kg || 0 : 0, notes: it ? it.d || "" : "", magic: $("#lmagic", el).checked, attune: $("#latt", el).checked }] : [];
    if (!items.length && !toCp(coins)) return toast("Pon monedas o un objeto.");
    addLoot(coins, items, ($("#lfrom", el).value || "").trim()); toast("Añadido al botín del grupo.");
  };
  $$("[data-claim]", el).forEach(b => b.onclick = () => {
    const [iid, cid] = b.dataset.claim.split("|"), st = store.get(), it = lootOf(st).items.find(x => x.id === iid), c = st.characters.find(x => x.id === cid); if (!it || !c) return;
    if (it.attune && attunedCount(c) >= 3) toast("Ya tienes 3 objetos sintonizados: tendrás que dejar uno para sintonizarte con este (SRD).");
    const d = JSON.parse(JSON.stringify(c)); d.inventory = d.inventory || []; d.inventory.push(lootToInv(it));
    propose(cid, diffChar(c, d), `Del botín del grupo: ${it.name}${it.qty > 1 ? " ×" + it.qty : ""}`, { lootTake: [iid] });
  });
}
