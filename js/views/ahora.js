// «Ahora»: qué está pasando en la mesa y quién tiene que hacer qué.
// Lo lee la barra superior de la mesa (a la izquierda de la iniciativa) para que, aunque
// os pongáis a hablar, siempre se sepa qué falta por tirar o por resolver.
import { unseenFn } from "../core/vision.js";
import { nameOf, oaOpen, reactionPending } from "../core/combate.js";
import { rxOpen, RX } from "../core/reacciones.js";
import { sneakInfo, smiteInfo } from "../core/rasgos.js";
import { barOn } from "./barra.js";
import { hpOf, order } from "../core/mesa.js";
import { phase, current, pending, eco, moveBudget } from "../core/turnos.js";
import { visibleRolls } from "./tiradas.js";
import { deployOf, deployOrder, placer, isReady } from "../core/despliegue.js";

const fm = n => (Math.round(n * 10) / 10).toLocaleString("es-ES");
// Nombre corto: «Brena Martillo-Ceniza» → «Brena»; «Goblin 2 (en la maleza)» → «Goblin 2» (el número distingue a los repetidos)
const first = n => { const w = String(n || "").replace(/\s*\(.*?\)/g, "").trim().split(/\s+/); return w.length > 1 && /^\d+$/.test(w[w.length - 1]) ? `${w[0]} ${w[w.length - 1]}` : w[0]; };

/** Devuelve { head, text, tip, who, mine, tone, acts: [{k, id, label, gold}], next } */
export function nowState(s, me, dm) {
  const ph = phase(s), cur = current(s), hid = unseenFn(s, dm), N = t => (!dm && t && hid(t) ? "?" : first(nameOf(s, t)));
  const tok = id => s.tokens.find(t => t.id === id);
  const ownerOf = t => t && t.kind === "pc" ? t.owner : null; // de las criaturas se encarga el máster
  const mineT = s.tokens.find(t => t.kind === "pc" && t.owner === me);
  // Despliegue: el grupo se coloca por turnos en la zona de inicio antes de empezar
  const dep = !ph && deployOf(s);
  if (dep) {
    const L = deployOrder(s), cur = placer(s), done = L.filter(t => isReady(t, dep)).length;
    const head = `Despliegue · ${done}/${L.length} colocados`;
    if (dm) return { head, who: cur ? N(cur) : "Todos", mine: true, tone: cur ? "wait" : "go",
      text: cur ? `Coloca ${N(cur)} en la zona ⚑ (${dep.rad} casillas) o marca «Listo».` : "Todos listos. Empieza el combate o la escena.",
      tip: cur ? `Se coloca ${N(cur)}: arrastra su figura dentro de la zona marcada alrededor del ⚑ (${dep.rad} casillas). Si no responde, pulsa «Listo» por él.` : "",
      acts: [...(cur ? [{ k: "depok", id: cur.id, label: `✓ Listo ${N(cur)}` }] : []), { k: "depend", label: "Terminar despliegue" }, { k: "begin", label: "⚔️ Iniciar combate", gold: !cur }] };
    if (cur && cur.owner === me) return { head, who: "Tú", mine: true, tone: "go", text: "Arrastra tu figura dentro de la zona ⚑ y pulsa «Listo».", tip: "Te toca colocarte: arrastra tu figura a cualquier casilla iluminada de la zona de inicio, según lo que veas (delante, detrás, a cubierto), y pulsa «Listo».", acts: [{ k: "depok", id: cur.id, label: "✓ Listo", gold: true }] };
    const pos = mineT ? L.filter(t => !isReady(t, dep)).findIndex(t => t.id === mineT.id) : -1;
    return { head, who: cur ? N(cur) : "Máster", mine: false, tone: "calm",
      text: !cur ? "Todos colocados. Esperando al máster." : mineT && isReady(mineT, dep) ? `Ya estás listo. Turno de colocación: ${N(cur)}.` : `Colocando ${N(cur)}${pos > 0 ? ` · vas en ${pos} turno${pos > 1 ? "s" : ""}` : ""}.`,
      tip: !cur ? "Todos colocados. El máster empezará en cuanto esté listo." : mineT && isReady(mineT, dep) ? `Ya estás colocado. Ahora se coloca ${N(cur)}.` : `Se está colocando ${N(cur)}.${pos > 0 ? ` Vas tú dentro de ${pos}.` : ""} Mira la mesa: lo que ves te ayuda a decidir dónde ponerte.`,
      acts: mineT && isReady(mineT, dep) && cur ? [{ k: "depundo", id: mineT.id, label: "Cambiar mi sitio" }] : [] };
  }
  if (!ph) {
    // Fuera de combate también hay cosas a medias: una trampa que ha saltado, un conjuro o un aliento por resolver
    const pend = visibleRolls(s).filter(r => r.kind === "spell" && r.status === "pending" && Date.now() - (r.at || 0) < 3600e3).pop();
    if (pend) {
      const mine = (pend.targets || []).some(id => { const t = tok(id); return t && t.owner === me; });
      const sv = (pend.saves || []).map(x => `${first(x.name)} ${x.total}${x.ok ? " ✓" : " ✗"}`).join(", ");
      return dm ? { head: "Exploración · por resolver", who: "Máster", mine: true, tone: "alert", text: `${pend.label.replace(/ ·.*/, "")}${sv ? ` · ${sv} (CD ${pend.dc})` : ""}.`, tip: `${pend.label.replace(/ ·.*/, "")}${sv ? ` — salvaciones: ${sv} (CD ${pend.dc}).` : "."} Aplica el resultado.`, acts: [{ k: "rolls", label: "Resolver", gold: true }] }
        : { head: "Exploración", who: "Máster", mine: false, tone: mine ? "alert" : "wait", text: mine ? `${pend.label.replace(/ ·.*/, "")}: el máster aplica el efecto.` : "Resolviendo un efecto en curso.", tip: mine ? `${pend.label.replace(/ ·.*/, "")}: el máster está aplicando el resultado.` : "El máster está resolviendo algo.", acts: [] };
    }
    return { head: "Exploración", text: "Movimiento libre por la escena.", tip: "Movimiento libre. Habla con el máster o explora la mesa.", tone: "calm", acts: dm ? [{ k: "begin", label: "⚔️ Iniciar combate", gold: true }] : [] };
  }
  if (ph === "init") {
    const miss = pending(s), acts = [];
    let text = miss.length ? `Pendientes: ${miss.map(N).join(", ")}` : "Iniciativas listas. Inicia la ronda.", tip = miss.length ? `Faltan por tirar iniciativa: ${miss.map(N).join(", ")}` : "Todos han tirado. El máster empieza la ronda.";
    let mine = false;
    if (mineT && (mineT.init == null || mineT.init === "")) { text = "Tira iniciativa (1d20 + DES)."; tip = "Tira tu iniciativa: 1d20 + Destreza."; mine = true; acts.push({ k: "init", id: mineT.id, label: "🎲 Tirar iniciativa", gold: true }); }
    if (dm) acts.push({ k: "start", label: miss.length ? "▶ Empezar igualmente" : "▶ Empezar ronda 1", gold: !miss.length });
    return { head: "⚔️ ¡Combate! · Iniciativa", text, tip, who: mine ? "Tú" : "Todos", mine, tone: "alert", acts };
  }
  // En combate: primero, lo que está a medias en este turno (por orden de urgencia)
  // Solo cuenta lo de ESTE combate (lo de combates anteriores no puede bloquear nada)
  const since = s.board.combatAt || 0;
  const rolls = visibleRolls(s).filter(r => r.status !== "void" && (r.at || 0) >= since).slice(-40);
  const hasDmg = id => rolls.some(x => x.link === id && x.kind === "damage");
  const after = (() => { const o = order(s).filter(t => !(hpOf(s, t) && hpOf(s, t).cur <= 0 && t.kind !== "pc")); const i = o.findIndex(t => t.id === (cur && cur.id)); return o.length > 1 && i >= 0 ? o[(i + 1) % o.length] : null; })();
  const base = { head: `Ronda ${s.board.round} · turno de ${cur ? N(cur) : "—"}`, next: after && !(hid(after) && !dm) ? N(after) : null, nextMine: !!(after && after.owner === me) };
  // Turno de una criatura oculta: los jugadores no deben saber ni quién es
  if (!dm && cur && hid(cur)) return { head: `Ronda ${s.board.round}`, next: base.next, nextMine: base.nextMine, who: "Máster", text: `Turno en curso${base.nextMine ? " · vas después" : ""}.`, tip: `El máster está resolviendo un turno. Espera${base.nextMine ? ": vas tú después" : ""}.`, mine: false, acts: [], tone: "calm" };
  // Hito 92: el texto corto cabe en las dos líneas del recuadro; el largo (tip) sale al pasar el ratón
  const task = (who, text, mine, acts = [], tone = "wait", tip = "") => ({ ...base, who, text, tip, mine, acts, tone });
  // 1. Reacciones: interrumpen el turno en curso hasta que quien puede reaccionar decide (el máster puede decidir por él)
  const oa = rolls.find(r => oaOpen(s, r));
  if (oa) { const a = tok(oa.tok), t = tok(oa.target), o = ownerOf(a), mine = o ? o === me : dm, can = mine || dm;
    return task(a ? N(a) : "?", `⏸ Oportunidad: ${N(t)} sale del alcance de ${N(a)} (${o ? N(a) : "Máster"}).`, mine,
      can ? [{ k: "oa", id: oa.id, label: "⚔ Atacar", gold: true }, { k: "oapass", id: oa.id, label: "Dejar pasar" }] : [], "alert",
      `⏸ Reacción: ${N(t)} sale del alcance de ${N(a)}. ${o ? N(a) + " decide" : "El máster decide"}: ¿ataque de oportunidad o lo deja pasar? Después sigue el turno de ${cur ? N(cur) : "—"}.`); }
  // Reacciones de conjuros y rasgos (Escudo, Esquiva asombrosa, Reprensión infernal, Contrahechizo): igual, antes que nada
  const rx = (s.rolls || []).find(r => rxOpen(s, r));
  if (rx) { const a = tok(rx.tok), o = ownerOf(a), mine = o ? o === me : dm, X = RX[rx.rx] || { n: "Reacción", i: "⚡", q: "" };
    return task(a ? N(a) : "?", `⏸ Reacción de ${a ? N(a) : "?"}: ${X.q}`, mine,
      (mine || dm) ? [{ k: "rx", id: rx.id, label: `${X.i} ${X.n}`, gold: true }, { k: "rxno", id: rx.id, label: "No" }] : [], "alert",
      `⏸ Reacción de ${a ? N(a) : "?"}: ${X.q} ${o ? "" : "(Decide el máster.) "}Después sigue el turno de ${cur ? N(cur) : "—"}.`); }
  // Nada que validar: el ataque, el daño y los conjuros se resuelven solos. Solo espera por el máster la Resistencia legendaria.
  const sp = rolls.find(r => r.saves && r.status === "pending" && r.applied == null && Date.now() - (r.at || 0) > 2500);
  if (sp) { const nm = (sp.label.match(/lanza (.+?)(?: \(|·|$)/) || [, "el conjuro"])[1].trim();
    return task("Máster", `Resistencia legendaria contra ${nm}.`, dm, dm ? [{ k: "rolls", label: "Decidir", gold: true }] : [], "wait", `¿Gasta la Resistencia legendaria contra ${nm}? Decídelo en Tiradas.`); }
  const hit = rolls.find(r => r.kind === "attack" && (r.status === "ok" || r.status === "mod") && r.result && r.result !== "miss" && r.dmg && !hasDmg(r.id) && r.seq === s.board.seq);
  if (hit && !reactionPending(s, hit.id)) { const a = tok(hit.tok), mine = hit.who === me || (dm && (!a || a.kind !== "pc")), S = sneakInfo(s, hit), M = smiteInfo(s, hit);
    const extra = [S ? `🗡 Ataque furtivo: +${S.dice} (${S.why})` : "", M ? `✨ Castigo divino: gasta un espacio y la acción adicional (${M.dice(M.slots[0])} radiante)` : ""].filter(Boolean);
    const xs = [S ? `🗡 Furtivo +${S.dice}` : "", M ? `✨ Castigo nv${M.slots[0]}` : ""].filter(Boolean);
    return task(a ? N(a) : "?", `¡Impacta! Daño ${hit.dmg}${hit.result === "crit" ? " (crítico ×2)" : ""}${xs.length ? ` · ${xs.join(" · ")}` : ""}.`, mine,
      mine ? [{ k: "dmg", id: hit.id, label: "🩸 Tirar daño", gold: !S && !M }, ...(S ? [{ k: "dmgsneak", id: hit.id, label: `🗡 + Furtivo ${S.dice}`, gold: true }] : []), ...(M ? M.slots.slice(0, 2).map(l => ({ k: "dmgsmite", id: hit.id, v: l, label: `✨ + Castigo nv${l}`, gold: true })) : [])] : [], "go",
      `¡Impacta! Tira el daño: ${hit.dmg}${hit.result === "crit" ? " (crítico: dados ×2)" : ""}.${extra.length ? " Puedes añadir: " + extra.join(" · ") + "." : ""}`); }
  if (!cur) return task("Máster", "Elige quién empieza.", dm);
  const h = hpOf(s, cur), owner = ownerOf(cur), mineTurn = owner ? owner === me : dm;
  if (cur.kind === "pc" && h && h.cur <= 0) {
    const c = s.characters.find(x => x.id === cur.char), d = (c && c.death) || {};
    if (!d.stable) return task(N(cur), "Inconsciente: tira salvación contra muerte (1d20, ≥10 salva).", mineTurn, mineTurn ? [{ k: "death", id: cur.id, label: "💀 Salvación", gold: true }, { k: "end", label: "Terminar turno ▶" }] : [], "alert", "Está inconsciente: tira la salvación contra muerte (1d20, 10 o más salva).");
  }
  const e = eco(s, cur), budget = moveBudget(s, cur);
  const left = [e.act ? null : "acción", e.bonus ? null : "acción adicional", e.mov < budget ? `${fm(budget - e.mov)} m de movimiento` : null].filter(Boolean);
  const ls = [e.act ? null : "acción", e.bonus ? null : "adicional", e.mov < budget ? `${fm(budget - e.mov)} m` : null].filter(Boolean).join(" · ");
  const foe = cur.kind !== "pc";
  // Qué hay que hacer en este turno, paso a paso, según quién lo lleva
  const tip = mineTurn
    ? (foe ? (left.length ? `Lo llevas tú: muévelo arrastrándolo, elige su ataque ${barOn(s) ? "en la barra de abajo" : "(pestaña PNJ)"} y toca al objetivo. Le queda: ${left.join(", ")}.` : `${N(cur)} ya lo ha hecho todo: termina su turno.`)
      : (left.length ? `Te toca: muévete arrastrando tu figura; para atacar, elige arma o conjuro ${barOn(s) ? "en la barra de abajo" : "en «Personaje»"} y toca al enemigo. Te queda: ${left.join(", ")}.` : "Lo has gastado todo: termina tu turno."))
    : foe ? `El máster mueve a ${N(cur)} y decide qué hace. Espera${base.nextMine ? ": vas tú después" : " tu turno"}.`
    : `${N(cur)} está actuando${left.length ? ` (le queda ${left.join(", ")})` : ""}.${base.nextMine ? " Vas tú después." : ""}`;
  const text = mineTurn
    ? (foe ? (ls ? `Mueve a ${N(cur)} y actúa (${ls}).` : `${N(cur)} sin recursos: termina su turno.`)
      : (ls ? `Tu turno: muévete o actúa en ${barOn(s) ? "la barra" : "«Personaje»"} (${ls}).` : "Sin recursos: termina tu turno."))
    : foe ? `Turno de ${N(cur)} (Máster)${base.nextMine ? " · vas después" : ""}.`
    : `Actúa ${N(cur)}${ls ? ` (${ls})` : ""}${base.nextMine ? " · vas después" : ""}.`;
  const acts = mineTurn ? [...(foe && dm ? [{ k: "npc", id: cur.id, label: "👹 Sus ataques" }] : []), { k: "end", label: "Terminar turno ▶", gold: !left.length }] : [];
  return { ...task(mineTurn ? (foe ? "Máster" : "Tú") : N(cur), text, mineTurn, acts, mineTurn ? "go" : "calm", tip), eco: { act: !!e.act, bonus: !!e.bonus, mov: `${fm(e.mov)}/${fm(budget)} m` } };
}
