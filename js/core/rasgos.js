// Rasgos de clase que la mesa ofrece sola en el momento justo, como en Baldur's Gate 3 (SRD 5.2.1):
//   · Ataque furtivo (pícaro): al impactar, si se cumplen las condiciones, se ofrece añadir los dados.
//   · Castigo divino (paladín): al impactar cuerpo a cuerpo, se ofrece gastar un espacio y la acción adicional.
//   · Furia (bárbaro): acción adicional; resistencia y daño de furia automáticos, se prolonga al atacar.
//   · Inspiración bárdica (bardo): acción adicional para dar un dado a un aliado; él lo usa al fallar una prueba con d20.
// Los usos de Furia e Inspiración bárdica se guardan en la ficha, dentro de «spells.res»: es lo que la nube deja
// cambiar al jugador durante la partida (igual que los espacios de conjuro).
import { store } from "./store.js";
import { currentUser, isDM } from "./session.js";
import { charOf } from "./mesa.js";
import { PROG } from "../data/progresion.js";
import { eco, spend, gap, phase, hasCond } from "./turnos.js";
import { freeSlots, useSlot } from "./hechizos.js";
import { findMonster } from "./srd.js";
import { WEAPONS } from "../data/equipo.js";
import { durFor } from "./duraciones.js";
import { toast } from "./ui.js";

const mod = v => Math.floor(((+v || 10) - 10) / 2);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isCls = (c, re) => !!c && re.test(String(c.cls || ""));
const prog = (cls, col, L) => { const P = PROG[cls]; if (!P) return null; const i = P.cols.indexOf(col); return i < 0 ? null : (P.rows[Math.max(0, Math.min(19, (+L || 1) - 1))] || [])[i]; };
const resUsed = (c, k) => +(((c.spells || {}).res || {})[k] || 0);
const prepared = (c, name) => ((c && c.spells && c.spells.list) || []).some(x => x.name === name && x.prepared !== false);
const incap = t => (t.conds || []).some(c => ["incapacitado", "inconsciente", "paralizado", "petrificado", "aturdido", "muerto"].includes(c.id));
const mine = (s, t) => { const me = currentUser(s); return isDM(s) || !!(t && me && t.owner === me.id); };
/** ¿Le queda la acción adicional? (fuera de combate, siempre; en combate, solo en su turno) */
function bonusOk(s, t) {
  if (phase(s) !== "live") return true;
  return s.board.turn === t.id && !eco(s, t).bonus;
}
export function useRes(charId, k, d = 1) {
  store.commit("char", st => { const c = st.characters.find(x => x.id === charId); if (!c) return; c.spells = c.spells || { slots: {}, list: [] }; c.spells.res = { ...(c.spells.res || {}) }; c.spells.res[k] = Math.max(0, (+c.spells.res[k] || 0) + d); });
}
/** Descansos: la furia recupera 1 uso con el corto y todos con el largo; la inspiración bárdica, todo con el largo (y con el corto desde nivel 5). */
export function restRes(c, long) {
  if (!c.spells || !c.spells.res) return;
  const r = c.spells.res;
  if (long) { r.furia = 0; r.bardica = 0; return; }
  if (r.furia) r.furia = Math.max(0, r.furia - 1);
  if (isCls(c, /Bard[oa]/) && c.level >= 5) r.bardica = 0;
}

/* ---------- Qué arma era (para Ataque furtivo, Castigo y Furia) ---------- */
export function weaponKind(c, w) {
  const base = WEAPONS.find(x => String(w.name || "").toLowerCase().startsWith(x.n.toLowerCase()));
  const txt = `${(base && base.p) || ""} ${(c && (c.weapons || []).find(x => x.name === w.name) || {}).notes || ""}`;
  const fin = /sutil/i.test(txt), rng = w.rng || {}, ranged = !!rng.ranged && !rng.melee && !/arrojadiz/i.test(txt);
  const str = !w.spell && !ranged && (!fin || !c || mod(c.abilities.fue) >= mod(c.abilities.des));
  return { fin, ranged: !!rng.ranged && !rng.melee, mel: !rng.ranged || !!rng.melee, spell: !!w.spell, str, improv: !!w.improv };
}

/* ---------- Furia ---------- */
export function rageInfo(c) {
  if (!isCls(c, /B[aá]rbar/)) return null;
  const max = +prog("Bárbaro", "Furias", c.level) || 2, dmg = +String(prog("Bárbaro", "Daño de furia", c.level) || "+2").replace("+", "");
  return { max, used: resUsed(c, "furia"), left: Math.max(0, max - resUsed(c, "furia")), dmg };
}
/** Bonificador de daño de furia para este ataque (o 0). */
export function rageDamage(s, a, wk) {
  if (!hasCond(a, "furia") || !wk || !wk.str || wk.spell) return 0;
  const c = charOf(s, a), R = c && rageInfo(c); return R ? R.dmg : 0;
}
export function rage(tokId) {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId), c = t && charOf(s, t), R = c && rageInfo(c);
  if (!R || !mine(s, t)) return;
  if (hasCond(t, "furia")) return toast("Ya estás en furia.");
  if (!bonusOk(s, t)) return toast("Necesitas tu acción adicional, en tu turno.");
  if (!R.left) return toast("No te quedan usos de Furia: se recuperan con un descanso (uno con el corto, todos con el largo).");
  if (incap(t)) return toast("No puedes enfurecerte incapacitado.");
  if (phase(s) === "live") spend(t.id, "bonus");
  useRes(c.id, "furia");
  store.commit("token", st => { const k = st.tokens.find(x => x.id === tokId); if (!k) return;
    // Mientras dura no puedes concentrarte: el conjuro que mantuvieras termina
    k.conds = (k.conds || []).filter(x => x.id !== "concentracion" && x.id !== "furia");
    k.conds.push({ id: "furia", note: `+${R.dmg} daño`, dur: durFor(st, k.id, "end", 2) }); });
  toast(`🔥 ¡Furia! Resistencia a contundente, cortante y perforante; +${R.dmg} al daño con Fuerza. Dura hasta el final de tu siguiente turno: atacar la prolonga.`);
}
/** Prolongar la furia: al atacar a un enemigo en tu turno, o gastando la acción adicional. */
export function extendRage(tokId, bonus = false) {
  const s = store.get(), t = s.tokens.find(x => x.id === tokId);
  if (!t || !hasCond(t, "furia")) return;
  if (bonus) { if (!bonusOk(s, t)) return toast("Ya has usado tu acción adicional."); if (phase(s) === "live") spend(t.id, "bonus"); }
  store.commit("token", st => { const k = st.tokens.find(x => x.id === tokId), f = k && (k.conds || []).find(x => x.id === "furia"); if (f) f.dur = durFor(st, k.id, "end", 2); });
  if (bonus) toast("🔥 Furia prolongada hasta el final de tu siguiente turno.");
}

/* ---------- Ataque furtivo ---------- */
/** Si este impacto admite Ataque furtivo: { dice: "3d6", why } (o null). Una vez por turno. */
export function sneakInfo(s, r) {
  if (!r || r.kind !== "attack" || !r.tok || !(r.result === "hit" || r.result === "crit") || r.status === "pending" || r.status === "void") return null;
  const a = s.tokens.find(t => t.id === r.tok), c = a && charOf(s, a);
  if (!isCls(c, /P[ií]car[oa]/) || !r.wk || r.wk.spell || !(r.wk.fin || r.wk.ranged)) return null;
  const used = (s.rolls || []).some(x => x.kind === "damage" && x.sneak && x.tok === a.id && x.status !== "void" && (phase(s) !== "live" || x.seq === s.board.seq));
  if (used) return null;
  const dis = r.adv < 0 || (r.why || []).some(w => /^desventaja/.test(w));
  if (dis) return null;
  const tg = s.tokens.find(t => t.id === r.target); if (!tg) return null;
  let why = r.adv > 0 ? "atacas con ventaja" : "";
  if (!why) {
    const foe = x => x.kind !== "pc" && x.kind !== "npc"; // bandos: personajes y aliados contra enemigos
    const ally = s.tokens.find(x => x.id !== a.id && x.id !== tg.id && foe(x) === foe(a) && !incap(x) && !x.hidden && gap(x, tg) <= 1);
    if (ally) why = `${String(ally.name || "").split(" ")[0]} está junto al objetivo`;
  }
  if (!why) return null;
  return { dice: `${Math.ceil((+c.level || 1) / 2)}d6`, why };
}

/* ---------- Castigo divino ---------- */
/** Espacios con los que se puede lanzar Castigo divino tras este impacto (o null). */
export function smiteInfo(s, r) {
  if (!r || r.kind !== "attack" || !r.tok || !(r.result === "hit" || r.result === "crit") || r.status === "pending" || r.status === "void") return null;
  const a = s.tokens.find(t => t.id === r.tok), c = a && charOf(s, a);
  if (!c || !(prepared(c, "Castigo divino") || (isCls(c, /Palad[ií]n/) && c.level >= 2))) return null; // nivel 2: siempre preparado (Castigo de paladín)
  if (!r.wk || r.wk.spell || !r.wk.mel || r.wk.ranged && !r.wk.mel) return null;
  if ((s.rolls || []).some(x => x.kind === "damage" && x.link === r.id && x.status !== "void")) return null;
  if (phase(s) === "live") { if (s.board.turn !== a.id) return null; const e = eco(s, a); if (e.bonus || e.slotCast) return null; }
  const slots = freeSlots(c, 1); if (!slots.length) return null;
  const tg = s.tokens.find(t => t.id === r.target), m = tg && tg.srd && findMonster(tg.srd);
  const extra = !!(m && /^(Infernal|Muerto viviente)/i.test(m.tipo || ""));
  return { slots, extra, dice: lvl => `${2 + (lvl - 1) + (extra ? 1 : 0)}d8` };
}
/** Gasta lo que cuesta el castigo (espacio y acción adicional). */
export function paySmite(s, r, lvl) {
  const a = s.tokens.find(t => t.id === r.tok), c = a && charOf(s, a); if (!c) return false;
  if (!freeSlots(c, lvl).includes(lvl)) { toast(`No te quedan espacios de nivel ${lvl}.`); return false; }
  useSlot(c.id, lvl);
  if (phase(s) === "live") { spend(a.id, "bonus"); spend(a.id, { slotCast: true }); }
  return true;
}

/* ---------- Inspiración bárdica ---------- */
export function bardicInfo(c) {
  if (!isCls(c, /Bard[oa]/)) return null;
  const max = Math.max(1, mod(c.abilities.car)), die = prog("Bardo", "Inspiración bárdica", c.level) || "d6";
  return { max, used: resUsed(c, "bardica"), left: Math.max(0, max - resUsed(c, "bardica")), die };
}
/** Aliados a los que se puede inspirar: a 18 m o menos, que no tengan ya un dado. */
export function inspirable(s, t) {
  return s.tokens.filter(x => x.id !== t.id && (x.kind === "pc" || x.kind === "npc") && !x.hidden && !hasCond(x, "insp_bardica") && !hasCond(x, "muerto") && gap(t, x) * 1.5 <= 18);
}
export function inspire(bardTok, allyTok) {
  const s = store.get(), t = s.tokens.find(x => x.id === bardTok), c = t && charOf(s, t), B = c && bardicInfo(c), al = s.tokens.find(x => x.id === allyTok);
  if (!B || !al || !mine(s, t)) return;
  if (!bonusOk(s, t)) return toast("Necesitas tu acción adicional, en tu turno.");
  if (!B.left) return toast("No te quedan usos de Inspiración bárdica.");
  if (phase(s) === "live") spend(t.id, "bonus");
  useRes(c.id, "bardica");
  const me = currentUser(s);
  // El dado lo pone el máster en la figura del aliado (en la nube, un jugador solo puede tocar la suya)
  store.commit("roll", st => { st.rolls = st.rolls || []; st.rolls.push({ id: uid("bard"), at: Date.now(), who: me ? me.id : null, whoName: me ? me.name : "", kind: "feat",
    label: `${c.name} inspira a ${al.name} · Inspiración bárdica (${B.die})`, expr: "", dice: [], total: null, status: "ok", secret: false, tok: t.id, target: al.id,
    seq: st.board ? st.board.seq : null, result: "use", apply: { type: "bardic", target: al.id, die: B.die, from: c.name } }); });
  toast(`🎵 ${al.name} recibe un ${B.die} de Inspiración bárdica.`);
}
/** ¿Puede gastar ahora su dado de Inspiración bárdica en esta tirada fallida? */
export function canBardic(s, r) {
  const me = currentUser(s); if (!r || !me || r.bard || r.status === "void" || r.total == null) return null;
  if (!(r.who === me.id || isDM(s))) return null;
  const t = r.tok && s.tokens.find(x => x.id === r.tok), cd = t && (t.conds || []).find(x => x.id === "insp_bardica");
  if (!cd) return null;
  const failed = r.kind === "attack" ? r.result === "miss" && r.status !== "pending" && r.nat !== 1 : (r.kind === "save" || r.kind === "check") && r.result === "fail";
  if (!failed || Date.now() - (r.at || 0) > 120000) return null;
  return cd.die || "d6";
}
export function useBardic(rollId) {
  const s = store.get(), r0 = (s.rolls || []).find(x => x.id === rollId), die = canBardic(s, r0); if (!die) return;
  const v = 1 + Math.floor(Math.random() * +die.slice(1));
  let msg = "";
  // Como la inspiración heroica: se publica la tirada corregida con un id nuevo (la nube no deja cambiar una tirada)
  store.commit("roll", st => {
    const i = st.rolls.findIndex(x => x.id === rollId); if (i < 0) return;
    const r = JSON.parse(JSON.stringify(st.rolls[i])); r.id = uid("tir"); r.replaces = rollId; r.bard = { die, v };
    r.total += v; r.dice = [...(r.dice || []), { d: +die.slice(1), v }];
    if (r.kind === "attack" && r.ac != null) r.result = r.total >= r.ac ? "hit" : "miss";
    if ((r.kind === "save" || r.kind === "check") && r.dc != null) r.result = r.total >= r.dc ? "save" : "fail";
    st.rolls.splice(i, 1, r);
    msg = `🎵 Inspiración bárdica: +${v} → ${r.total}${r.result === "hit" ? " · ¡ahora impacta!" : r.result === "save" ? " · ¡ahora la supera!" : " · sigue fallando"}`;
  });
  store.commit("token", st => { const k = st.tokens.find(x => x.id === r0.tok); if (k) k.conds = (k.conds || []).filter(x => x.id !== "insp_bardica"); });
  toast(msg);
}
