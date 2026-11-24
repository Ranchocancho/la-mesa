// PNJ del máster: una ficha del Lore (historia) con su ficha de combate (reglas), que se puede poner en la mesa.
// La ficha de combate es una copia editable de una plantilla del SRD (bandido, mago, guerrero goblin…) o se monta
// desde cero. Guarda sus acciones en el mismo formato que las criaturas del compendio (data/acciones.js), así la
// mesa, la barra y las reglas funcionan igual que con cualquier criatura. Lo que no viene del SRD es regla de campaña.
//   combat = { base, ac, hp, hpNow, speed, size, vd, ab, svProf: [..], kit: { sv, act, bonus, react }, table, color }
import { store } from "./store.js";
import { isDM, runsTable } from "./session.js";
import { entry, loreOf, setEntry } from "./lore.js";
import { findMonster, srd } from "./srd.js";
import { loadKits } from "./criaturas.js";
import { mod, prof } from "../data/dnd.js";
import { WEAPONS } from "../data/equipo.js";
import { findSpell } from "./srd.js";

/** Plantillas del SRD con forma de persona (más goblinoides), para empezar rápido. */
export const TEMPLATES = ["Plebeyo", "Bandido", "Capitán bandido", "Pendenciero", "Jefe pendenciero", "Guardia", "Capitán de la guardia", "Guerrero de infantería", "Guerrero veterano",
  "Batidor", "Berserker", "Gladiador", "Caballero", "Noble", "Espía", "Asesino", "Pirata", "Capitán pirata", "Sacerdote acólito", "Sacerdote", "Sectario", "Fanático sectario",
  "Druida", "Mago", "Archimago", "Siervo de vampiro", "Secuaz goblin", "Guerrero goblin", "Jefe goblin", "Guerrero hobgoblin", "Capitán hobgoblin", "Guerrero kobold", "Guerrero gnoll", "Guerrero osgo", "Acechador osgo"];
export const SIZES = [["Pequeño", 0.7], ["Mediano", 1], ["Grande", 1.6], ["Enorme", 2.4]];
const AB = ["fue", "des", "con", "int", "sab", "car"];
const crNum = vd => { const v = String(vd || "1"); return v.includes("/") ? 1 : Math.max(1, parseInt(v) || 1); };
export const pbOf = c => prof(crNum(c && c.vd));
const clone = x => JSON.parse(JSON.stringify(x));

/** Ficha vacía (desde cero): un plebeyo con una daga. */
export function blankCombat() {
  const ab = { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 };
  return { base: null, ac: 10, hp: 4, speed: 9, size: 1, vd: "0", ab, svProf: [], table: false, kit: { sv: { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 }, act: [weaponAction({ vd: "0", ab }, "Daga")] } };
}
/** Copia editable de una plantilla del SRD (perfil, acciones, salvaciones). */
export async function fromTemplate(name) {
  const [ACC] = await Promise.all([loadKits(), srd("monstruos")]);
  const m = findMonster(name); if (!m) return null;
  const ab = typeof m.ab === "string" ? JSON.parse(m.ab.replace(/'/g, '"')) : { ...m.ab };
  const kit = clone(ACC[name] || { act: [] });
  kit.sv = kit.sv || Object.fromEntries(AB.map(k => [k, mod(ab[k])]));
  const pb = prof(crNum(m.vd)), svProf = AB.filter(k => kit.sv[k] >= mod(ab[k]) + pb);
  const size = /Enorme/.test(m.tipo) ? 2.4 : /Grande/.test(m.tipo) ? 1.6 : /Mediano/.test(m.tipo) ? 1 : /Pequeñ|Diminut/.test(m.tipo) ? 0.7 : 1; // «Mediano o Pequeño» = Mediano
  return { base: name, ac: +m.ca, hp: +m.pg, speed: parseFloat(String(m.vel).replace(",", ".")) || 9, size, vd: String(m.vd), ab, svProf, kit, table: false };
}
/** Al cambiar una característica: salvaciones = modificador (+ competencia si la tenía). */
export function resave(c) {
  const pb = pbOf(c); c.kit = c.kit || { act: [] };
  c.kit.sv = Object.fromEntries(AB.map(k => [k, mod(c.ab[k]) + ((c.svProf || []).includes(k) ? pb : 0)]));
}
/** Acción de ataque con un arma del equipo (SRD): competencia + Fuerza (o Destreza si es sutil o a distancia). */
export function weaponAction(c, wname) {
  const w = WEAPONS.find(x => x.n === wname); if (!w) return null;
  const fin = /sutil/i.test(w.p), dist = w.r === "dist", thrown = (w.p.match(/alcance (\d+(?:,\d+)?)\/(\d+)/) || null);
  const m = dist ? mod(c.ab.des) : fin ? Math.max(mod(c.ab.fue), mod(c.ab.des)) : mod(c.ab.fue), atk = pbOf(c) + m;
  const reach = /gran alcance/i.test(w.p) ? "3" : "1,5", range = (w.p.match(/alcance (\d+(?:,\d+)?\/\d+)/) || [])[1];
  const e = `${w.d}${m ? (m > 0 ? "+" : "") + m : ""}`;
  return { n: w.n, type: "atk", atk, dmg: [{ e, t: w.t }], ...(dist ? { range, ranged: true } : { reach, melee: true, ...(thrown ? { range: thrown[1] + "/" + thrown[2], ranged: true } : {}) }),
    txt: `Tirada de ataque ${dist ? "a distancia" : "cuerpo a cuerpo"}: ${atk >= 0 ? "+" : ""}${atk}, alcance ${dist ? range + " m" : reach + " m"}. Acierto: ${e} de daño ${w.t}.` };
}
const WORDS = ["", "un", "dos", "tres", "cuatro", "cinco", "seis"];
/** Ataque múltiple: N ataques por acción (0 o 1 = sin él). */
export function setMulti(c, n) {
  c.kit.act = (c.kit.act || []).filter(a => a.type !== "multi");
  if (n >= 2) c.kit.act.unshift({ n: "Ataque múltiple", type: "multi", txt: `Realiza ${WORDS[n] || n} ataques.` });
}
export const multiOfC = c => { const m = ((c.kit || {}).act || []).find(a => a.type === "multi"); if (!m) return 1; const w = (m.txt.match(/realiza (\w+) ataques/i) || [])[1]; return Math.max(2, WORDS.indexOf((w || "").toLowerCase())) || 2; };
/** El bloque de conjuros (lo crea si no está). */
export function spellBlock(c) {
  let b = (c.kit.act || []).find(a => a.type === "spells");
  if (!b) { b = { n: "Lanzamiento de conjuros", type: "spells", dc: 8 + pbOf(c) + mod(c.ab.int), ab: "int", lists: [], txt: "" }; c.kit.act.push(b); }
  return b;
}
export function addSpell(c, name, per) {
  const b = spellBlock(c), d = findSpell(name), u = per === "will" ? "will" : +per;
  b.lists = b.lists || [];
  let L = b.lists.find(x => x.u === u); if (!L) { L = { u, sp: [] }; b.lists.push(L); }
  if (!L.sp.some(x => x.n === name)) L.sp.push({ n: d ? d.n : name, srd: !!d });
  b.txt = spellText(b);
}
export function removeSpell(c, name) {
  const b = (c.kit.act || []).find(a => a.type === "spells"); if (!b) return;
  b.lists.forEach(L => { L.sp = L.sp.filter(x => x.n !== name); }); b.lists = b.lists.filter(L => L.sp.length);
  if (!b.lists.length) c.kit.act = c.kit.act.filter(a => a !== b); else b.txt = spellText(b);
}
const spellText = b => `Lanza estos conjuros (CD de salvación ${b.dc}): ${b.lists.map(L => `${L.u === "will" ? "A voluntad" : `${L.u}/día cada uno`}: ${L.sp.map(x => x.n.toLowerCase()).join(", ")}`).join(" · ")}`;

/* ---------- En la mesa ---------- */
/** PNJ que el máster ha marcado como disponibles en la mesa. */
export const npcsForTable = s => loreOf(s).filter(e => e.kind === "npc" && e.combat && e.combat.table && e.vital !== "muerto");
/** «Monstruo» para el selector y monsterToken (así sirve en todos los sitios donde se ponen criaturas). */
export function npcMonster(s, e) {
  const c = e.combat, hostile = e.stance === "hostil";
  const atk = ((c.kit || {}).act || []).filter(a => a.type === "atk").map(a => ({ name: a.n, atk: (a.atk >= 0 ? "+" : "") + a.atk, dmg: (a.dmg || []).map(d => `${d.e} ${d.t}`).join(" + "), rng: a.range ? a.range + " m" : (a.reach || "1,5") + " m" }));
  return { n: e.name, tipo: `PNJ${e.role ? " · " + e.role : ""}`, pg: c.hpNow != null ? c.hpNow : c.hp, pgMax: c.hp, ca: c.ac, ini: String(mod(c.ab.des)), vel: String(c.speed), vd: c.vd, atk, img: e.img || null,
    npc: e.id, srd: c.base || null, kit: clone(c.kit), ab: { ...c.ab }, size: c.size || 1, kind: hostile ? "foe" : "npc", color: hostile ? "#7a2a22" : "#3d4f8a" };
}

/** Mezclar: añade a la ficha las acciones, rasgos y conjuros de otra plantilla (híbridos a gusto del máster). */
export async function mergeTemplate(c, name) {
  const o = await fromTemplate(name); if (!o) return false;
  for (const g of ["act", "bonus", "react"]) for (const a of (o.kit[g] || [])) {
    if (a.type === "multi") continue;
    if (a.type === "spells") { (a.lists || []).forEach(L => L.sp.forEach(x => addSpell(c, x.n, L.u))); continue; }
    c.kit[g] = c.kit[g] || [];
    if (!c.kit[g].some(x => x.n === a.n)) c.kit[g].push(JSON.parse(JSON.stringify(a)));
  }
  return true;
}
/** Firma de lo que la mesa copia de la ficha (si cambia en el Lore, la figura se pone al día). */
const sheetSig = e => JSON.stringify([e.name, e.img, e.combat && [e.combat.ac, e.combat.hp, e.combat.speed, e.combat.size, e.combat.vd, e.combat.ab, e.combat.base, e.combat.kit]]);

/* ---------- Lo que pasa en la mesa vuelve al Lore ----------
   Si un PNJ cae o queda herido, su ficha lo recuerda: la próxima vez que salga, sale como quedó. */
export function watchNpcs() {
  let last = "";
  const run = () => {
    const s = store.get(); if (!runsTable(s)) return;
    const toks = (s.tokens || []).filter(t => t.npc);
    // 1) El Lore manda en la ficha: si el máster la cambia (plantilla, conjuros, ataques…), la figura en la mesa se actualiza
    const stale = toks.map(t => ({ t, e: entry(s, t.npc) })).filter(({ t, e }) => e && e.combat && t.npcSig !== sheetSig(e));
    if (stale.length) {
      store.commit("token", st => stale.forEach(({ t, e }) => { const k = st.tokens.find(x => x.id === t.id); if (!k) return;
        const m = npcMonster(st, e), wasMax = k.maxhp, hurt = (wasMax || 0) - (k.hp ?? wasMax);
        Object.assign(k, { name: m.n, kit: m.kit, ab: m.ab, ac: m.ca, maxhp: m.pgMax, speed: parseFloat(String(m.vel).replace(",", ".")) || 9, size: m.size, vd: m.vd, srd: m.srd,
          attacks: m.atk.map(a => ({ name: a.name, atk: a.atk, dmg: a.dmg, rng: a.rng })), ...(m.img ? { portrait: m.img } : {}) });
        if (k.npcSig) k.hp = Math.max(0, Math.min(k.maxhp, k.maxhp - Math.max(0, hurt))); // conserva el daño recibido
        k.npcSig = sheetSig(e); }));
      return;
    }
    const sig = JSON.stringify(toks.map(t => [t.npc, t.hp]));
    if (sig === last) return; last = sig;
    const upd = toks.map(t => ({ t, e: entry(s, t.npc) })).filter(({ t, e }) => e && e.combat && t.hp != null && e.combat.hpNow !== t.hp);
    if (!upd.length) return;
    store.commit("lore", st => upd.forEach(({ t }) => { const e = entry(st, t.npc); if (!e) return;
      e.combat.hpNow = Math.max(0, t.hp);
      if (t.hp <= 0) e.vital = "muerto"; else if (t.hp < (t.maxhp || e.combat.hp)) { if (!e.vital || e.vital === "vivo") e.vital = "herido"; } else if (e.vital === "herido") e.vital = "vivo"; }));
  };
  store.subscribe(() => queueMicrotask(run));
}
