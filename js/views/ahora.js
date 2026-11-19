// «Ahora»: qué está pasando en la mesa y quién tiene que hacer qué.
// Lo lee la barra superior de la mesa (a la izquierda de la iniciativa) para que, aunque
// os pongáis a hablar, siempre se sepa qué falta por tirar o por resolver.
import { nameOf } from "../core/combate.js";
import { hpOf, order } from "../core/mesa.js";
import { phase, current, pending, eco, moveBudget } from "../core/turnos.js";
import { visibleRolls } from "./tiradas.js";

const fm = n => (Math.round(n * 10) / 10).toLocaleString("es-ES");
const first = n => String(n || "").split(/\s+/)[0];

/** Devuelve { head, text, who, mine, tone, acts: [{k, id, label, gold}], next } */
export function nowState(s, me, dm) {
  const ph = phase(s), cur = current(s), N = t => first(nameOf(s, t));
  const tok = id => s.tokens.find(t => t.id === id);
  const ownerOf = t => t && t.kind === "pc" ? t.owner : null; // de las criaturas se encarga el máster
  const mineT = s.tokens.find(t => t.kind === "pc" && t.owner === me);
  if (!ph) return { head: "Exploración", text: "Movimiento libre. Habla con el máster o explora la mesa.", tone: "calm", acts: dm ? [{ k: "begin", label: "⚔️ Iniciar combate", gold: true }] : [] };
  if (ph === "init") {
    const miss = pending(s), acts = [];
    let text = miss.length ? `Faltan: ${miss.map(N).join(", ")}` : "Todos han tirado. El máster empieza la ronda.";
    let mine = false;
    if (mineT && (mineT.init == null || mineT.init === "")) { text = "Tira tu iniciativa: 1d20 + Destreza."; mine = true; acts.push({ k: "init", id: mineT.id, label: "🎲 Tirar iniciativa", gold: true }); }
    if (dm) acts.push({ k: "start", label: miss.length ? "▶ Empezar igualmente" : "▶ Empezar ronda 1", gold: !miss.length });
    return { head: "⚔️ ¡Combate! · Iniciativa", text, who: mine ? "Tú" : "Todos", mine, tone: "alert", acts };
  }
  // En combate: primero, lo que está a medias en este turno (por orden de urgencia)
  const rolls = visibleRolls(s).filter(r => r.status !== "void").slice(-40);
  const hasDmg = id => rolls.some(x => x.link === id);
  const after = (() => { const o = order(s).filter(t => !(hpOf(s, t) && hpOf(s, t).cur <= 0 && t.kind !== "pc")); const i = o.findIndex(t => t.id === (cur && cur.id)); return o.length > 1 && i >= 0 ? o[(i + 1) % o.length] : null; })();
  const base = { head: `Ronda ${s.board.round} · turno de ${cur ? N(cur) : "—"}`, next: after ? N(after) : null, nextMine: !!(after && after.owner === me) };
  const task = (who, text, mine, acts = [], tone = "wait") => ({ ...base, who, text, mine, acts, tone });
  const oa = rolls.find(r => r.kind === "oa" && r.status === "pending");
  if (oa) { const a = tok(oa.tok), o = ownerOf(a), mine = o ? o === me : dm; return task(a ? N(a) : "?", `Puede atacar de oportunidad a ${N(tok(oa.target))}. ¿Ataca o lo deja pasar?`, mine, mine ? [{ k: "rolls", label: "Decidir" }] : []); }
  const atk = rolls.find(r => r.kind === "attack" && r.status === "pending");
  if (atk) return task("Máster", `Confirma el ataque de ${N(tok(atk.tok))} a ${N(tok(atk.target))}.`, dm, dm ? [{ k: "rolls", label: "✓ Revisar", gold: true }] : []);
  const dmg = rolls.find(r => r.kind === "damage" && r.status === "pending");
  if (dmg) return task("Máster", `Aplica ${dmg.total} de daño a ${N(tok(dmg.target))}.`, dm, dm ? [{ k: "rolls", label: "✓ Aplicar", gold: true }] : []);
  const sp = rolls.find(r => r.saves && r.status === "pending");
  if (sp) return task("Máster", `Resuelve el conjuro de ${N(tok(sp.tok))}: salvaciones y daño.`, dm, dm ? [{ k: "rolls", label: "Resolver", gold: true }] : []);
  const hit = rolls.find(r => r.kind === "attack" && (r.status === "ok" || r.status === "mod") && r.result && r.result !== "miss" && r.dmg && !hasDmg(r.id) && r.seq === s.board.seq);
  if (hit) { const a = tok(hit.tok), mine = hit.who === me || (dm && (!a || a.kind !== "pc")); return task(a ? N(a) : "?", `¡Impacta! Tira el daño: ${hit.dmg}${hit.result === "crit" ? " (crítico: dados ×2)" : ""}.`, mine, mine ? [{ k: "dmg", id: hit.id, label: "🩸 Tirar daño", gold: true }] : [], "go"); }
  if (!cur) return task("Máster", "Elige quién empieza.", dm);
  const h = hpOf(s, cur), owner = ownerOf(cur), mineTurn = owner ? owner === me : dm;
  if (cur.kind === "pc" && h && h.cur <= 0) {
    const c = s.characters.find(x => x.id === cur.char), d = (c && c.death) || {};
    if (!d.stable) return task(N(cur), "Está inconsciente: tira la salvación contra muerte (1d20, 10 o más salva).", mineTurn, mineTurn ? [{ k: "death", id: cur.id, label: "💀 Salvación", gold: true }, { k: "end", label: "Terminar turno ▶" }] : [], "alert");
  }
  const e = eco(s, cur), budget = moveBudget(s, cur);
  const left = [e.act ? null : "acción", e.bonus ? null : "acción adicional", e.mov < budget ? `${fm(budget - e.mov)} m de movimiento` : null].filter(Boolean);
  const text = mineTurn
    ? (left.length ? `Te queda: ${left.join(", ")}. Cuando acabes, termina el turno.` : "Lo has gastado todo: termina el turno.")
    : cur.kind === "pc" ? `${N(cur)} está actuando${left.length ? ` (le queda ${left.join(", ")})` : ""}.` : `El máster mueve a ${N(cur)}.`;
  return { ...task(mineTurn ? "Tú" : N(cur), text, mineTurn, mineTurn ? [{ k: "end", label: "Terminar turno ▶", gold: !left.length }] : [], mineTurn ? "go" : "calm"), eco: { act: !!e.act, bonus: !!e.bonus, mov: `${fm(e.mov)}/${fm(budget)} m` } };
}
