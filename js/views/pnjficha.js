// «Ficha de combate» de un PNJ del Lore (solo el máster): plantilla del SRD o desde cero, retocable a mano.
// Lo que viene de la plantilla son reglas del SRD; lo que el máster cambie es regla de campaña.
import { store } from "../core/store.js";
import { setEntry } from "../core/lore.js";
import { srd, srdNow } from "../core/srd.js";
import { CRS } from "../core/bestiario.js";
import { WEAPONS } from "../data/equipo.js";
import { mod } from "../data/dnd.js";
import { TEMPLATES, SIZES, blankCombat, fromTemplate, resave, weaponAction, setMulti, multiOfC, spellBlock, addSpell, removeSpell, pbOf, npcMonster } from "../core/pnj.js";
import { $, $$, esc, toast } from "../core/ui.js";

const AB = [["fue", "FUE"], ["des", "DES"], ["con", "CON"], ["int", "INT"], ["sab", "SAB"], ["car", "CAR"]];
const GROUPS = [["act", "Acción"], ["bonus", "Acción adicional"], ["react", "Reacción"]];
const sign = n => (n >= 0 ? "+" : "") + n;
const clone = x => JSON.parse(JSON.stringify(x));
let tplPick = "Bandido";

export function combatHTML(s, e) {
  const c = e.combat;
  if (!c) return `<section class="pcomb"><h3 class="lsec">⚔ Ficha de combate</h3>
    <p class="note">Para que pueda luchar (o simplemente aparecer en un mapa), dale una ficha: parte de una plantilla de las reglas y cámbiala a tu gusto, o empieza desde cero.</p>
    <div class="row"><select data-ptpl>${TEMPLATES.map(n => `<option ${n === tplPick ? "selected" : ""}>${esc(n)}</option>`).join("")}</select><button class="btn gold small" data-pmake>Crear desde la plantilla</button><button class="btn small" data-pblank>Desde cero</button></div></section>`;
  const kit = c.kit || { act: [] }, all = g => (kit[g] || []).map((a, i) => ({ a, i, g }));
  const atks = all("act").filter(x => x.a.type === "atk"), spells = (kit.act || []).find(a => a.type === "spells"), multi = multiOfC(c);
  const others = [...all("act"), ...all("bonus"), ...all("react")].filter(x => x.a.type !== "atk" && x.a.type !== "spells" && x.a.type !== "multi");
  const spellsList = (srdNow.conjuros || []).map(d => d.n);
  const onBoard = s.board && (s.tokens || []).some(t => t.npc === e.id);
  return `<section class="pcomb"><h3 class="lsec">⚔ Ficha de combate <small>${c.base ? `base: ${esc(c.base)} (SRD)` : "ficha propia"} · competencia ${sign(pbOf(c))}</small></h3>
    <div class="row pctop"><label class="switch"><input type="checkbox" data-ptable ${c.table ? "checked" : ""}> Disponible en la mesa</label>
      ${s.board ? (onBoard ? `<span class="tag">✓ Está en la mesa</span>` : `<button class="btn small gold" data-ptoboard>Poner en la mesa ahora</button>`) : ""}
      <span class="grow"></span><select data-ptpl>${TEMPLATES.map(n => `<option ${n === (c.base || tplPick) ? "selected" : ""}>${esc(n)}</option>`).join("")}</select><button class="btn small" data-pretpl title="Sustituye toda la ficha por la plantilla">Cambiar de plantilla</button><button class="btn small danger" data-pnone>Quitar ficha</button></div>
    <div class="pcstats">
      <label>CA<input type="number" data-pc="ac" value="${c.ac}"></label>
      <label>PG máx.<input type="number" data-pc="hp" value="${c.hp}"></label>
      <label title="Lo que le queda (se guarda solo al acabar en la mesa)">PG ahora<input type="number" data-pc="hpNow" value="${c.hpNow ?? ""}" placeholder="${c.hp}"></label>
      <label>Velocidad (m)<input type="number" step="1.5" data-pc="speed" value="${c.speed}"></label>
      <label>Tamaño<select data-pc="size">${SIZES.map(([n, v]) => `<option value="${v}" ${+c.size === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label title="Valor de desafío: da la competencia y los PX">VD<select data-pc="vd">${CRS.map(v => `<option ${String(c.vd) === v ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>
    <div class="pcab">${AB.map(([k, n]) => `<label><span>${n}</span><input type="number" min="1" max="30" data-pab="${k}" value="${c.ab[k]}"><small>${sign(mod(c.ab[k]))} · salv. ${sign((kit.sv || {})[k] ?? mod(c.ab[k]))}</small><span class="pcsv" title="Competente en esta salvación"><input type="checkbox" data-psv="${k}" ${(c.svProf || []).includes(k) ? "checked" : ""}>comp.</span></label>`).join("")}</div>
    <h4>Ataques ${`<label class="pcmulti">Ataque múltiple <select data-pmulti>${[1, 2, 3, 4].map(n => `<option value="${n}" ${multi === n || (n === 1 && multi < 2) ? "selected" : ""}>${n === 1 ? "no" : n + " ataques"}</option>`).join("")}</select></label>`}</h4>
    <div class="pcatks">${atks.map(({ a, i }) => `<div class="pcatk"><input data-pa="${i}|n" value="${esc(a.n)}" aria-label="Nombre"><input data-pa="${i}|atk" value="${sign(a.atk)}" aria-label="Bonificador" class="sm">
        <input data-pa="${i}|dmg" value="${esc((a.dmg || []).map(d => `${d.e} ${d.t}`).join(" + "))}" aria-label="Daño" placeholder="1d6+2 cortante"><input data-pa="${i}|rng" value="${esc(a.range && !a.melee ? a.range : a.reach + (a.range ? " o " + a.range : ""))}" aria-label="Alcance (m)" class="sm" title="1,5 = cuerpo a cuerpo · 24/96 = a distancia">
        <button class="ib danger" data-padel="act|${i}" aria-label="Quitar">✕</button></div>`).join("") || `<p class="empty">Sin ataques.</p>`}
      <div class="row"><select data-pweap>${WEAPONS.map(w => `<option>${esc(w.n)}</option>`).join("")}</select><button class="btn small" data-paddw>+ Arma del equipo</button><button class="btn small" data-paddx>+ Ataque propio</button></div></div>
    <h4>Conjuros ${spells ? `<small><label>CD <input type="number" data-pspdc value="${spells.dc}" class="sm"></label></small>` : ""}</h4>
    <div class="pcspells">${spells ? (spells.lists || []).map(L => `<div class="pcfreq"><i>${L.u === "will" ? "A voluntad" : `${L.u}/día`}</i>${L.sp.map(x => `<span class="lchip">${esc(x.n)}${x.srd === false ? " <small>(fuera del compendio)</small>" : ""}<button data-pspdel="${esc(x.n)}" aria-label="Quitar">✕</button></span>`).join("")}</div>`).join("") : `<p class="empty">No lanza conjuros.</p>`}
      <div class="row"><input list="pcsplist" data-pspn placeholder="Conjuro del compendio…"><datalist id="pcsplist">${spellsList.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
        <select data-pspu><option value="will">A voluntad</option><option value="1">1/día</option><option value="2">2/día</option><option value="3">3/día</option></select><button class="btn small" data-pspadd>+ Conjuro</button></div></div>
    <h4>Otras acciones y rasgos</h4>
    <div class="pcother">${others.map(({ a, i, g }) => `<div class="pcact"><b>${esc(a.n)}</b> <small>${GROUPS.find(x => x[0] === g)[1]}${a.type === "save" ? ` · salvación ${String(a.sv || "").toUpperCase()} CD ${a.dc}` : ""}</small><button class="ib danger" data-padel="${g}|${i}" aria-label="Quitar">✕</button><p>${esc(a.txt || "")}</p></div>`).join("") || `<p class="empty">Nada más.</p>`}
      <div class="row"><select data-pog>${GROUPS.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select><input data-pon placeholder="Nombre (p. ej. Grito de guerra)"><input data-pot placeholder="Qué hace (lo aplica el máster)" class="grow"><button class="btn small" data-poadd>+ Añadir</button></div></div>
    <p class="note">Lo que viene de la plantilla son reglas del SRD. Lo que cambies o añadas aquí es <b>regla de campaña</b>. Las acciones de texto las resuelve el máster.</p>
  </section>`;
}

export function bindCombat(root, e, done = () => {}) {
  if (!srdNow.conjuros) srd("conjuros").then(() => done());
  const edit = fn => setEntry(e.id, x => { const c = clone(x.combat || blankCombat()); fn(c); return { combat: c }; });
  const tp = $("[data-ptpl]", root); if (tp) tp.onchange = () => { tplPick = tp.value; };
  const mk = $("[data-pmake]", root); if (mk) mk.onclick = async () => { const c = await fromTemplate(tplPick); if (!c) return toast("No encuentro esa plantilla."); setEntry(e.id, { combat: c }); };
  const bl = $("[data-pblank]", root); if (bl) bl.onclick = () => setEntry(e.id, { combat: blankCombat() });
  const rt = $("[data-pretpl]", root); if (rt) rt.onclick = async () => { if (!rt.dataset.sure) { rt.dataset.sure = 1; rt.textContent = "¿Seguro? Se pierde lo cambiado"; return; } const c = await fromTemplate(tplPick); if (c) setEntry(e.id, x => ({ combat: { ...c, table: !!(x.combat && x.combat.table) } })); };
  const no = $("[data-pnone]", root); if (no) no.onclick = () => { if (!no.dataset.sure) { no.dataset.sure = 1; no.textContent = "Pulsa otra vez para quitarla"; return; } setEntry(e.id, { combat: null }); };
  const tb = $("[data-ptable]", root); if (tb) tb.onchange = () => edit(c => { c.table = tb.checked; });
  const pb = $("[data-ptoboard]", root); if (pb) pb.onclick = () => import("./reglas.js").then(m => { const s = store.get(), x = s.lore.find(y => y.id === e.id); m.addToBoard(npcMonster(s, x), 1, { hidden: false }); toast(`${x.name} está en la mesa`); });
  $$("[data-pc]", root).forEach(i => i.onchange = () => edit(c => { const k = i.dataset.pc; c[k] = k === "vd" ? i.value : k === "hpNow" ? (i.value === "" ? null : +i.value) : +i.value; if (k === "vd") resave(c); }));
  $$("[data-pab]", root).forEach(i => i.onchange = () => edit(c => { c.ab[i.dataset.pab] = Math.max(1, Math.min(30, +i.value || 10)); resave(c); }));
  $$("[data-psv]", root).forEach(i => i.onchange = () => edit(c => { const k = i.dataset.psv; c.svProf = (c.svProf || []).filter(x => x !== k); if (i.checked) c.svProf.push(k); resave(c); }));
  const mu = $("[data-pmulti]", root); if (mu) mu.onchange = () => edit(c => setMulti(c, +mu.value));
  $$("[data-pa]", root).forEach(i => i.onchange = () => edit(c => {
    const [ix, f] = i.dataset.pa.split("|"), a = c.kit.act[+ix]; if (!a) return;
    if (f === "n") a.n = i.value.trim() || a.n;
    if (f === "atk") a.atk = parseInt(i.value) || 0;
    if (f === "dmg") a.dmg = i.value.split("+").reduce((out, part) => { const m = part.trim().match(/^(\d+d\d+|\d+)(?:\s*([a-záéíóúñ]+))?$/i); if (m) { if (m[2] || !out.length) out.push({ e: m[1], t: (m[2] || "").toLowerCase() }); else out[out.length - 1].e += "+" + m[1]; } return out; }, []);
    if (f === "rng") { delete a.range; delete a.reach; a.melee = false; a.ranged = false;
      i.value.replace(/m/g, "").split(/\s+o\s+|,\s(?=\d)|;/).map(x => x.trim()).filter(Boolean).forEach(x => { if (x.includes("/")) { a.range = x; a.ranged = true; } else if (/^\d/.test(x)) { a.reach = x; a.melee = true; } });
      if (!a.melee && !a.ranged) { a.reach = "1,5"; a.melee = true; } }
    a.txt = `Tirada de ataque: ${sign(a.atk)}, alcance ${a.melee ? a.reach + " m" : ""}${a.melee && a.ranged ? " o " : ""}${a.ranged ? a.range + " m" : ""}. Acierto: ${(a.dmg || []).map(d => `${d.e} de daño ${d.t}`).join(" más ")}. (Ajustado por el máster: regla de campaña.)`;
  }));
  $$("[data-padel]", root).forEach(b => b.onclick = () => edit(c => { const [g, i] = b.dataset.padel.split("|"); c.kit[g].splice(+i, 1); }));
  const aw = $("[data-paddw]", root); if (aw) aw.onclick = () => edit(c => { const w = weaponAction(c, $("[data-pweap]", root).value); if (w) c.kit.act.push(w); });
  const ax = $("[data-paddx]", root); if (ax) ax.onclick = () => edit(c => { c.kit.act.push({ n: "Ataque", type: "atk", atk: pbOf(c) + mod(c.ab.fue), reach: "1,5", melee: true, dmg: [{ e: `1d6${mod(c.ab.fue) ? sign(mod(c.ab.fue)) : ""}`, t: "contundente" }], txt: "Ataque propio (regla de campaña)." }); });
  const sd = $("[data-pspdc]", root); if (sd) sd.onchange = () => edit(c => { const b = spellBlock(c); b.dc = +sd.value || b.dc; });
  $$("[data-pspdel]", root).forEach(b => b.onclick = () => edit(c => removeSpell(c, b.dataset.pspdel)));
  const sa = $("[data-pspadd]", root); if (sa) sa.onclick = () => { const n = $("[data-pspn]", root).value.trim(); if (!n) return toast("Escribe el conjuro."); edit(c => addSpell(c, n, $("[data-pspu]", root).value)); };
  const oa = $("[data-poadd]", root); if (oa) oa.onclick = () => { const n = $("[data-pon]", root).value.trim(); if (!n) return toast("Ponle nombre."); edit(c => { const g = $("[data-pog]", root).value; c.kit[g] = c.kit[g] || []; c.kit[g].push({ n, type: "text", txt: $("[data-pot]", root).value.trim() || "Lo resuelve el máster (regla de campaña)." }); }); };
}
