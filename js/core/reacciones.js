// Reacciones que la mesa ofrece sola, en el orden del juego (como Baldur's Gate 3): el ataque se tira,
// se pregunta a quien puede reaccionar y, hasta que decide, no se tira el daño.
//   · Escudo (conjuro, nivel 1): al recibir un impacto, +5 a la CA hasta el principio de tu turno (solo si así fallaría).
//   · Esquiva asombrosa (pícaro, nivel 5): al recibir un impacto de un atacante que ves, el daño se reduce a la mitad.
//   · Reprensión infernal (conjuro, nivel 1): al recibir daño de una criatura a 18 m, salvación de Destreza o 2d10 de fuego.
//   · Contrahechizo (conjuro, nivel 3): cuando una criatura a 18 m lanza un conjuro; salvación de Constitución o se disipa.
// El aviso es una tirada «react» que crea el máster; quien reacciona contesta con una tirada SUYA enlazada
// («rxuse» o «rxpass»), porque en la nube un jugador no puede cambiar tiradas ajenas. Lo que cambia el
// resultado (que el ataque falle, la mitad del daño) lo aplica el máster al ver la respuesta.
import { store } from "./store.js";
import { isDM, currentUser } from "./session.js";
import { charOf } from "./mesa.js";
import { eco, spend, gap, hasCond } from "./turnos.js";
import { freeSlots, useSlot, cast } from "./hechizos.js";
import { durFor } from "./duraciones.js";
import { spellDC, rollSave } from "./salud.js";
import { findSpell } from "./srd.js";
import { toast } from "./ui.js";

export const WAIT = 45000; // nunca bloquea la partida: si nadie decide en 45 s, se entiende que no reacciona
export const RX = {
  escudo: { n: "Escudo", i: "🛡", spell: "Escudo", slot: 1, q: "¿Lanzas Escudo? +5 a la CA hasta tu turno: el ataque fallaría." },
  esquiva: { n: "Esquiva asombrosa", i: "🌀", q: "¿Usas Esquiva asombrosa? El daño de este ataque se reduce a la mitad." },
  reprension: { n: "Reprensión infernal", i: "🔥", spell: "Reprensión infernal", slot: 1, q: "¿Lanzas Reprensión infernal? Salvación de Destreza o 2d10 de fuego (la mitad si la supera)." },
  contrahechizo: { n: "Contrahechizo", i: "🚫", spell: "Contrahechizo", slot: 3, q: "¿Lanzas Contrahechizo? Salvación de Constitución: si la falla, el conjuro se disipa." }
};
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const INCAP = ["incapacitado", "inconsciente", "paralizado", "petrificado", "aturdido", "muerto"];
const incap = t => (t.conds || []).some(c => INCAP.includes(c.id));
const prepared = (c, name) => ((c && c.spells && c.spells.list) || []).some(x => x.name === name && x.prepared !== false);
const reactOk = (s, t) => !!t && !incap(t) && !eco(s, t).react;
const answerOf = (s, r) => (s.rolls || []).find(x => x.link === r.id && (x.kind === "rxuse" || x.kind === "rxpass") && x.status !== "void");
const nm = (s, id) => { const t = s.tokens.find(x => x.id === id); return t ? String((charOf(s, t) || t).name || "").split(" ")[0] : "?"; };

/** ¿Sigue abierta la pregunta? (sin contestar, en este mismo turno, con la reacción libre y antes de 45 s) */
export function rxOpen(s, r) {
  if (!r || r.kind !== "react" || r.status !== "pending" || answerOf(s, r)) return false;
  if (r.seq != null && s.board && r.seq !== s.board.seq) return false;
  if (Date.now() - (r.at || 0) >= WAIT) return false;
  return reactOk(s, s.tokens.find(t => t.id === r.tok));
}
export const openReactions = s => (s.rolls || []).filter(r => rxOpen(s, r));
/** Espacio más bajo con el que lanzaría el conjuro de la reacción. */
const slotFor = (c, rx) => (freeSlots(c, RX[rx].slot || 1) || [])[0] || 0;
/** ¿Puede este personaje usar esta reacción? */
function can(s, t, rx) {
  const c = t && t.kind === "pc" && charOf(s, t); if (!c || !reactOk(s, t)) return false;
  if (RX[rx].spell) return prepared(c, RX[rx].spell) && !!slotFor(c, rx) && !hasCond(t, "furia");
  if (rx === "esquiva") return /P[ií]car[oa]/.test(c.cls || "") && c.level >= 5;
  return false;
}

function ask(st, f) {
  const me = currentUser(st) || {};
  st.rolls = st.rolls || [];
  st.rolls.push({ id: uid("rx"), at: Date.now(), who: me.id || null, whoName: me.name || "", kind: "react", expr: "", dice: [], total: null, nat: null, status: "pending", secret: false, seq: st.board ? st.board.seq : null, ...f,
    label: `${nm(st, f.tok)} puede reaccionar: ${RX[f.rx].n}` });
}

/* ---------- El máster crea los avisos al ver un impacto o un daño ---------- */
function scan() {
  const s = store.get(); if (!isDM(s) || !s.board) return;
  const now = Date.now(), fresh = r => now - (r.at || 0) < 15000;
  const todo = [];
  for (const r of s.rolls || []) {
    if (r.rxSeen || r.status === "void" || !(fresh(r) || (r.appliedAt && now - r.appliedAt < 15000))) continue;
    // Impacto de un ataque contra un personaje: Escudo (si así fallaría) o Esquiva asombrosa
    if (r.kind === "attack" && r.status !== "pending" && (r.result === "hit" || r.result === "crit")) {
      const t = s.tokens.find(x => x.id === r.target), a = s.tokens.find(x => x.id === r.tok);
      const list = [];
      if (t && t.kind === "pc" && a) {
        if (can(s, t, "escudo") && r.nat !== 20 && !hasCond(t, "escudo") && r.ac != null && r.total < r.ac + 5) list.push("escudo");
        if (can(s, t, "esquiva") && !a.hidden && !hasCond(a, "invisible")) list.push("esquiva");
      }
      todo.push({ id: r.id, ask: list.map(rx => ({ rx, tok: t.id, target: a.id, link: r.id })) });
    }
    // Daño aplicado a un personaje por una criatura a 18 m: Reprensión infernal
    if (r.kind === "damage" && r.applied > 0) {
      const t = s.tokens.find(x => x.id === r.target), a = s.tokens.find(x => x.id === r.by || x.id === r.tok);
      const ok = t && a && a.id !== t.id && t.kind === "pc" && can(s, t, "reprension") && gap(t, a) * 1.5 <= 18 && !a.hidden;
      todo.push({ id: r.id, ask: ok ? [{ rx: "reprension", tok: t.id, target: a.id, link: r.id }] : [] });
    }
  }
  if (!todo.length) return;
  store.commit("roll", st => {
    for (const x of todo) {
      const r = st.rolls.find(y => y.id === x.id); if (!r || r.rxSeen) continue;
      r.rxSeen = true;
      x.ask.forEach(f => ask(st, f));
    }
  });
}

/* ---------- Contrahechizo: el conjuro de una criatura espera a ver si alguien lo corta ---------- */
/** Personajes que podrían contrahechizar a este lanzador (a 18 m, con un espacio de nivel 3 y la reacción libre). */
export function counterers(s, casterId, spellName) {
  const a = s.tokens.find(t => t.id === casterId), d = findSpell(spellName);
  if (!a || !d || !String(d.co || "V").trim()) return [];
  return s.tokens.filter(t => t.kind === "pc" && can(s, t, "contrahechizo") && gap(t, a) * 1.5 <= 18 && !a.hidden);
}
/** Lo llama cast() antes de resolver el conjuro de una criatura: deja la pregunta hecha y guarda el conjuro. */
export function deferCast(casterId, spellName, slot, targetIds, P) {
  const s = store.get(), who = counterers(s, casterId, spellName); if (!who.length) return null;
  const grp = uid("cg");
  store.commit("roll", st => who.forEach(t => ask(st, { rx: "contrahechizo", tok: t.id, target: casterId, link: null, grp, spell: spellName,
    cast: { casterId, spellName, slot, targetIds, P } })));
  toast(`${nm(s, casterId)} lanza ${spellName}… ${who.map(t => nm(s, t.id)).join(" y ")} puede${who.length > 1 ? "n" : ""} contrahechizar.`);
  return { deferred: true, grp };
}
function resolveCounters() {
  const s = store.get(); if (!isDM(s)) return;
  const groups = new Map();
  for (const r of s.rolls || []) if (r.kind === "react" && r.grp && !r.done) { if (!groups.has(r.grp)) groups.set(r.grp, []); groups.get(r.grp).push(r); }
  for (const [grp, L] of groups) {
    const used = L.map(r => ({ r, a: answerOf(s, r) })).find(x => x.a && x.a.kind === "rxuse");
    const open = L.some(r => rxOpen(s, r));
    if (!used && open) continue;
    const c0 = L[0].cast;
    store.commit("roll", st => st.rolls.filter(x => x.grp === grp).forEach(x => { x.done = true; x.status = "ok"; }));
    const run = () => cast(c0.casterId, c0.spellName, c0.slot, c0.targetIds, { ...c0.P, noCounter: true });
    if (!used) { run(); continue; }
    const caster = s.tokens.find(t => t.id === c0.casterId); if (!caster) continue;
    const res = rollSave(caster, "con", used.a.dc || 13, `Salvación de Constitución de ${nm(s, caster.id)} contra Contrahechizo (CD ${used.a.dc || 13})`);
    if (res.ok) { toast(`${nm(s, caster.id)} supera la salvación: ${c0.spellName} sigue adelante.`); run(); }
    else toast(`🚫 Contrahechizo: ${c0.spellName} de ${nm(s, caster.id)} se disipa sin efecto.`);
  }
}

/* ---------- Contestar (quien reacciona, o el máster por él) ---------- */
export function answerRx(rxId, use) {
  const s = store.get(), r = (s.rolls || []).find(x => x.id === rxId); if (!rxOpen(s, r)) return;
  const t = s.tokens.find(x => x.id === r.tok), c = t && charOf(s, t), me = currentUser(s);
  if (!isDM(s) && !(t && me && t.owner === me.id)) return;
  const base = { at: Date.now(), who: me ? me.id : null, whoName: me ? me.name : "", expr: "", dice: [], total: null, status: "ok", secret: false, link: r.id, tok: r.tok, target: r.target, seq: r.seq };
  if (!use) { store.commit("roll", st => st.rolls.push({ ...base, id: uid("rxp"), kind: "rxpass", label: `${nm(s, r.tok)} no usa ${RX[r.rx].n}` })); return; }
  const slot = RX[r.rx].spell ? slotFor(c, r.rx) : 0;
  if (RX[r.rx].spell && !slot) { toast("No te quedan espacios para ese conjuro."); return; }
  const lbl = `${nm(s, r.tok)} usa ${RX[r.rx].n}${slot ? ` (nivel ${slot})` : ""}`;
  if (r.rx === "escudo") {
    useSlot(c.id, slot); spend(t.id, "react");
    store.commit("token", st => { const k = st.tokens.find(x => x.id === t.id); if (!k) return; k.conds = (k.conds || []).filter(x => x.id !== "escudo"); k.conds.push({ id: "escudo", dur: durFor(st, k.id, "start", 1) }); });
    store.commit("roll", st => st.rolls.push({ ...base, id: uid("rxu"), kind: "rxuse", rx: "escudo", label: lbl, result: "use", apply: { type: "shield", atk: r.link } }));
  } else if (r.rx === "esquiva") {
    spend(t.id, "react");
    store.commit("roll", st => st.rolls.push({ ...base, id: uid("rxu"), kind: "rxuse", rx: "esquiva", label: lbl, result: "use", apply: { type: "halve", atk: r.link } }));
  } else if (r.rx === "reprension") {
    store.commit("roll", st => st.rolls.push({ ...base, id: uid("rxu"), kind: "rxuse", rx: "reprension", label: lbl }));
    cast(t.id, "Reprensión infernal", slot, [r.target]); // gasta el espacio y la reacción; el máster resuelve la salvación y el daño
  } else if (r.rx === "contrahechizo") {
    useSlot(c.id, slot); spend(t.id, "react");
    store.commit("roll", st => st.rolls.push({ ...base, id: uid("rxu"), kind: "rxuse", rx: "contrahechizo", label: lbl, dc: spellDC(c) }));
  }
}

/** Lo que aplica el máster al ver la respuesta (lo llama applyEffect). */
export function applyRx(st, A) {
  const a = (st.rolls || []).find(x => x.id === A.atk); if (!a) return;
  if (A.type === "shield" && (a.result === "hit" || a.result === "crit") && a.nat !== 20 && a.total < (a.ac || 0) + 5) {
    a.ac = (a.ac || 0) + 5; a.result = "miss"; a.note = "🛡 Escudo: +5 a la CA → falla";
  }
  if (A.type === "halve") { a.halve = true; a.note = (a.note ? a.note + " · " : "") + "🌀 Esquiva asombrosa: el daño se reduce a la mitad"; }
}

export function watchReactions() {
  const run = () => { scan(); resolveCounters(); };
  store.subscribe(() => queueMicrotask(run));
  setInterval(run, 3000);
}
