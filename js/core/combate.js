// Combate: ataques contra un objetivo, daño y la decisión del máster (confirmar, cambiar o anular).
import { store } from "./store.js";
import { isDM, currentUser } from "./session.js";
import { publish } from "./dados.js";
import { charOf } from "./mesa.js";
import { damage as hurt } from "./salud.js";
import { findSpell } from "./srd.js";
import { classInfo, prof } from "../data/dnd.js";
import { rangeOf, inRange, cover, modifiers, spend, dist, hasCond } from "./turnos.js";
import { toast } from "./ui.js";

const num = s => { const m = String(s || "").match(/[+-−]?\s*\d+/); return m ? +m[0].replace(/\s|−/g, s => s === "−" ? "-" : "") : 0; };
/** "1d8+4 perforante" → { expr: "1d8+4", type: "perforante" } */
export function splitDamage(s) {
  const m = String(s || "").trim().match(/^([0-9d+\-−\s]+)(.*)$/i);
  return m ? { expr: m[1].replace(/\s/g, "").replace(/−/g, "-"), type: m[2].trim() } : { expr: "", type: String(s || "") };
}
export const nameOf = (s, t) => t ? (charOf(s, t) || t).name : "";
export const acOf = (s, t) => { const c = charOf(s, t); return c ? +c.ac : +t.ac || 10; };

/** Ataques disponibles para una ficha: armas del personaje o ataques del enemigo. */
export function attacksOf(s, t) {
  const c = charOf(s, t);
  const list = c ? (c.weapons || []) : (t.attacks || []);
  const out = list.filter(w => w.name || w.atk || w.dmg).map(w => ({ name: w.name || "Ataque", atk: num(w.atk), ...splitDamage(w.dmg), rng: rangeOf(w) }));
  // Conjuros preparados con tirada de ataque (del compendio): ataque = competencia + característica de lanzamiento
  if (c) {
    const ab = classInfo(c.cls).cast, bonus = ab ? prof(c.level) + Math.floor(((+c.abilities[ab] || 10) - 10) / 2) : 0;
    for (const s of (c.spells && c.spells.list) || []) {
      const d = s.prepared !== false && findSpell(s.name);
      // Los trucos de ataque van aquí (escalan con el nivel); los de nivel 1+ se lanzan desde «Conjuros», que gasta el espacio
      if (d && d.atk && d.dmg && !d.lvl) { const k = c.level >= 17 ? 4 : c.level >= 11 ? 3 : c.level >= 5 ? 2 : 1, [, n, die] = d.dmg.match(/(\d+)d(\d+)/) || [, 1, 8];
        out.push({ name: "✨ " + d.n, atk: bonus, expr: `${n * k}d${die}`, type: d.dt, spell: true, rng: rangeOf({ al: d.al }) }); }
    }
  }
  return out;
}

/** Ataque según las reglas: alcance, cobertura y ventaja/desventaja automáticas (el jugador puede forzar una). */
export function attack(attackerId, targetId, weapon, force = null, use = "act") {
  const s = store.get(), a = s.tokens.find(t => t.id === attackerId), t = s.tokens.find(x => x.id === targetId);
  if (!a || !t) return null;
  { const me = currentUser(s); if (!isDM(s) && !(a.owner && me && a.owner === me.id)) { toast("Solo puedes atacar con tu propio personaje."); return null; } }
  const rng = weapon.rng || { n: 1.5, l: 1.5 }, reach = inRange(rng, a, t), cov = cover(s, a, t), mods = modifiers(s, a, t, rng);
  if (reach === "out") { toast(`${t.name || "El objetivo"} está a ${(dist(a, t) * 1.5).toLocaleString("es-ES")} m: fuera del alcance de ${weapon.name} (${rng.l} m)`); return null; }
  if (cov.level === "total") { toast("Cobertura total: no tienes línea hasta el objetivo"); return null; }
  const adv = force != null ? force : mods.net;
  const why = [...mods.adv.map(x => "ventaja: " + x), ...mods.dis.map(x => "desventaja: " + x)];
  if (force != null && force !== mods.net) why.push(force ? `${force > 0 ? "ventaja" : "desventaja"} elegida a mano` : "sin ventaja ni desventaja (elegido a mano)");
  if (use) spend(a.id, use);
  let extra = "";
  if (hasCond(a, "bendecido")) { extra += "+1d4"; why.push("+1d4 por Bendición"); }
  if (hasCond(a, "perdicion")) { extra += "-1d4"; why.push("−1d4 por Perdición"); }
  const ex = (a.conds || []).find(c => c.id === "agotamiento"), exn = ex ? 2 * (+ex.lvl || 1) : 0;
  if (exn) why.push(`−${exn} por agotamiento`);
  const atk = weapon.atk - exn;
  return publish({
    kind: "attack", label: `${use === "react" ? "Ataque de oportunidad: " : ""}${nameOf(s, a)} ataca a ${nameOf(s, t)} · ${weapon.name}`, expr: `1d20${atk >= 0 ? "+" : ""}${atk}${extra}`,
    adv, by: a.id, target: t.id, ac: acOf(s, t) + (cov.bonus || 0), dmg: weapon.expr, dtype: weapon.type,
    why: why.length ? why : null, cov: cov.txt || null, auto: mods.autoCrit ? "Objetivo paralizado o inconsciente a 1,5 m: si impacta, es crítico" : null
  });
}

/** Tira el daño de un ataque que ha impactado (crítico: dados dobles). */
export function damageFor(rollId) {
  const s = store.get(), r = (s.rolls || []).find(x => x.id === rollId);
  if (!r || !r.dmg) return null;
  const a = s.tokens.find(t => t.id === r.tok), t = s.tokens.find(x => x.id === r.target);
  return publish({ kind: "damage", label: `Daño a ${nameOf(s, t)}${r.dtype ? " · " + r.dtype : ""}`, expr: r.dmg, crit: r.result === "crit", by: r.tok, target: r.target, link: r.id, dtype: r.dtype });
}

/** El máster decide sobre una tirada. action: "ok" | "void" | "flip" (impacto↔fallo) | {total} | "half" (daño a la mitad) */
export function decide(rollId, action) {
  if (!isDM(store.get())) return;
  let apply = null;
  store.commit("roll", s => {
    const r = (s.rolls || []).find(x => x.id === rollId); if (!r) return;
    if (action === "void") { r.status = "void"; return; }
    if (action === "flip") { r.result = r.result === "miss" ? "hit" : "miss"; r.status = "mod"; r.note = "El máster cambia el resultado"; return; }
    if (typeof action === "object" && action.total != null) { r.note = `El máster cambia ${r.total} → ${action.total}`; r.total = action.total; r.status = "mod"; if (r.kind === "attack" && r.ac != null) r.result = r.nat === 20 ? "crit" : r.total >= r.ac ? "hit" : "miss"; return; }
    if (r.kind === "damage" && !r.applied) {
      const amt = action === "half" ? Math.floor(r.total / 2) : action === "double" ? r.total * 2 : r.total;
      r.applied = amt; r.status = action === "ok" ? "ok" : "mod"; if (action === "half") r.note = "Mitad de daño (resistencia o salvación)"; if (action === "double") r.note = "Daño doble (vulnerabilidad)";
      apply = { target: r.target, amt, crit: !!r.crit };
      return;
    }
    r.status = r.status === "pending" ? "ok" : r.status;
  });
  if (apply) hurt(apply.target, apply.amt, { crit: apply.crit });
}
