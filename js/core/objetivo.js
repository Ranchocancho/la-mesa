// Apuntar como en Baldur's Gate 3, pero con las reglas del SRD 5.2.1:
//  - al elegir arma o conjuro, la mesa enseña su alcance (normal y largo) y a quién puedes elegir;
//  - sobre cada objetivo, la probabilidad de impactar (d20 + ataque contra su CA, con ventaja o desventaja
//    y la cobertura), el daño posible y por qué hay ventaja o desventaja;
//  - si el objetivo está fuera de tu alcance cuerpo a cuerpo pero llegas andando, «te acercas y atacas»;
//  - las áreas de los conjuros se colocan con una plantilla que sigue al cursor y marca a quién alcanza.
import { inRange, cover, modifiers, gap, dist, eco, phase, hasCond } from "./turnos.js";
import { acOf, attacksOf } from "./combate.js";
import { reachMap } from "./movimiento.js";
import { savePlan } from "./salud.js";
import { hpOf } from "./mesa.js";
import { damageTraits } from "./defensas.js";

/** Probabilidad (0–1) de impactar: 20 natural siempre acierta, 1 natural siempre falla. extra = dados que suman (+1d4…). */
export function hitChance(bonus, ac, adv = 0, extra = []) {
  // reparto del modificador extra (p. ej. Bendición +1d4 o Perdición −1d4)
  let dist0 = new Map([[0, 1]]);
  for (const d of extra) { const n = new Map(); dist0.forEach((p, v) => { for (let i = 1; i <= Math.abs(d); i++) { const k = v + Math.sign(d) * i; n.set(k, (n.get(k) || 0) + p / Math.abs(d)); } }); dist0 = n; }
  let p1 = 0;
  dist0.forEach((p, v) => { let hits = 0; for (let r = 1; r <= 20; r++) if (r === 20 || (r !== 1 && r + bonus + v >= ac)) hits++; p1 += p * hits / 20; });
  return adv > 0 ? 1 - (1 - p1) ** 2 : adv < 0 ? p1 ** 2 : p1;
}
/** Daño mínimo y máximo de una expresión como «1d8+3+1d6». */
export function dmgRange(expr) {
  let lo = 0, hi = 0;
  String(expr || "").replace(/\s/g, "").replace(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g, (m, s1, n, f, s2, k) => {
    if (f) { const c = +(n || 1), sg = s1 === "-" ? -1 : 1; lo += sg * c; hi += sg * c * +f; } else if (k) { const sg = s2 === "-" ? -1 : 1; lo += sg * +k; hi += sg * +k; }
    return m;
  });
  return [Math.max(0, lo), Math.max(0, hi)];
}
const isMelee = rng => !rng.ranged || !!rng.melee;

/** Probabilidad de que t FALLE una salvación (en las salvaciones el 20 natural no es éxito automático). */
export function failChance(s, t, ab, dc, magic = false) {
  const p = savePlan(s, t, ab, 0, { magic }); if (p.autoFail) return 1;
  const extra = [...String(p.extra || "").matchAll(/([+-])1d(\d+)/g)].map(m => (m[1] === "-" ? -1 : 1) * +m[2]);
  let dist0 = new Map([[0, 1]]);
  for (const d of extra) { const n = new Map(); dist0.forEach((q, v) => { for (let i = 1; i <= Math.abs(d); i++) { const k = v + Math.sign(d) * i; n.set(k, (n.get(k) || 0) + q / Math.abs(d)); } }); dist0 = n; }
  let ok1 = 0; dist0.forEach((q, v) => { let n = 0; for (let r = 1; r <= 20; r++) if (r + p.bonus + v >= dc) n++; ok1 += q * n / 20; });
  const ok = p.adv > 0 ? 1 - (1 - ok1) ** 2 : p.adv < 0 ? ok1 ** 2 : ok1;
  return 1 - ok;
}
/** Daño esperado contra t (con su resistencia, vulnerabilidad o inmunidad) y si puede tumbarlo:
 *  kill 2 = cae seguro con el mínimo, 1 = puede caer con una buena tirada. */
export function dmgVs(s, t, range, dtype) {
  if (!range) return null;
  const tr = dtype ? damageTraits(t, dtype) : null, f = tr ? (tr.k === "inmune" ? 0 : tr.k === "resiste" ? 0.5 : tr.k === "vulnerable" ? 2 : 1) : 1;
  const r = [Math.floor(range[0] * f), Math.floor(range[1] * f)], hp = (hpOf(s, t) || {}).cur;
  return { dmg: r, trait: tr ? tr.k : "", kill: hp > 0 ? (r[0] >= hp ? 2 : r[1] >= hp ? 1 : 0) : 0 };
}
/** Texto de la etiqueta de un objetivo (2D y 3D): lo necesario para decidir de un vistazo, como en BG3. */
export function chipText(g, odds = true) {
  const ok = g.state === "ok" || g.state === "long";
  if (!ok) return g.state === "cover" ? "🛡 cobertura total" : `fuera · ${String(g.far || "").replace(".", ",")} m`;
  return [g.approach ? `🦶${String(g.approach.cost).replace(".", ",")} m` : "", odds && g.pct != null ? `${g.pct}%` : "", g.save || "", odds && g.fail != null ? `falla ${g.fail}%` : "",
    g.dmg ? `${g.dmg[0]}–${g.dmg[1]}` : "", g.trait === "resiste" ? "½" : g.trait === "inmune" ? "inmune" : g.trait === "vulnerable" ? "×2" : "", g.kill === 2 ? "☠ cae" : g.kill === 1 ? "☠?" : "",
    g.state === "long" ? "largo" : "", g.adv > 0 ? "▲" : g.adv < 0 ? "▼" : "", g.picked ? "✓" : ""].filter(Boolean).join(" · ");
}
/** Cómo sería atacar a t con el arma w. */
export function attackPreview(s, a, w, t, { approach = true } = {}) {
  const rng = w.rng || { n: 1.5, l: 1.5 };
  let st = inRange(rng, a, t), from = a, appr = null;
  // BG3: si no llegas pero puedes acercarte andando (sin correr), te acercas y atacas
  if (st === "out" && approach && isMelee(rng) && phase(s) === "live" && s.board.turn === a.id) {
    const R = reachMap(s, a, {});
    if (R) { let best = null; R.cells.forEach((x, k) => { if (!x.cost || x.occ || x.dash) return; const [c, r] = k.split(",").map(Number), p = { ...a, c, r };
      if (inRange({ ...rng, l: rng.n }, p, t) === "ok" && (!best || x.cost < best.cost)) best = { c, r, cost: x.cost }; });
      if (best) { appr = best; from = { ...a, c: best.c, r: best.r }; st = "ok"; } }
  }
  if (st === "out") return { state: "out", far: Math.round(gap(a, t) * 15) / 10 };
  const cov = cover(s, from, t);
  if (cov.level === "total") return { state: "cover", cov: cov.txt };
  const mods = modifiers(s, from, t, rng);
  const ex = (a.conds || []).find(c => c.id === "agotamiento"), exn = ex ? 2 * (+ex.lvl || 1) : 0;
  const extra = [...(hasCond(a, "bendecido") ? [4] : []), ...(hasCond(a, "perdicion") ? [-4] : [])];
  const ac = acOf(s, t) + (cov.bonus || 0);
  const pct = Math.round(hitChance(w.atk - exn, ac, mods.net, extra) * 100);
  const D = dmgVs(s, t, dmgRange(w.expr), w.type);
  return { state: st, pct, adv: mods.net, why: [...mods.adv.map(x => "▲ " + x), ...mods.dis.map(x => "▼ " + x), ...(D && D.trait ? [`${D.trait === "resiste" ? "Resiste" : D.trait === "inmune" ? "Inmune a" : "Vulnerable a"} ese daño`] : []), ...(D && D.kill ? [D.kill === 2 ? "☠ Con este golpe cae seguro" : "☠ Puede caer con este golpe"] : [])],
    cov: cov.txt || "", dmg: D ? D.dmg : dmgRange(w.expr), trait: D ? D.trait : "", kill: D ? D.kill : 0, crit: mods.autoCrit, approach: appr };
}

/** Lo que enseña la mesa al apuntar con un arma: alcance y, por cada criatura, cómo sería atacarla. */
export function weaponTargeting(s, a, i, visible = () => true) {
  const w = attacksOf(s, a)[i]; if (!w) return null;
  const rng = w.rng || { n: 1.5, l: 1.5 };
  const targets = s.tokens.filter(t => t.id !== a.id && visible(t)).map(t => ({ id: t.id, ally: (t.kind === "pc") === (a.kind === "pc"), ...attackPreview(s, a, w, t) }));
  return { kind: "atk", from: a.id, label: w.name, rng: { n: rng.n / 1.5, l: rng.l / 1.5, melee: isMelee(rng) }, targets };
}

/** Casillas de una plantilla de área del SRD. origin: casilla del lanzador; aim: casilla apuntada.
 *  Esfera, cilindro y emanación: radio (contado como la cuadrícula). Cono: anchura = distancia al origen.
 *  Línea: 1,5 m de ancho salvo que diga otra cosa. Cubo: centrado en la casilla apuntada. */
export function templateCells(g, origin, aim, area) {
  const out = new Set(), N = Math.max(1, Math.round(area.size / 1.5)), sh = area.shape;
  const inG = (c, r) => c >= 0 && r >= 0 && c < g.cols && r < g.rows, add = (c, r) => inG(c, r) && out.add(c + "," + r);
  if (/esfera|cilindro/.test(sh)) { for (let r = aim.r - N; r <= aim.r + N; r++) for (let c = aim.c - N; c <= aim.c + N; c++) add(c, r); }
  else if (/emanación/.test(sh)) { for (let r = origin.r - N; r <= origin.r + N; r++) for (let c = origin.c - N; c <= origin.c + N; c++) if (c !== origin.c || r !== origin.r) add(c, r); }
  else if (/cubo/.test(sh)) { const o = Math.floor((N - 1) / 2); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) add(aim.c - o + c, aim.r - o + r); }
  else { // cono o línea: desde el lanzador hacia la casilla apuntada
    let dx = aim.c - origin.c, dy = aim.r - origin.r; const L = Math.hypot(dx, dy); if (!L) return out; dx /= L; dy /= L;
    const W = /línea/.test(sh) ? Math.max(1, Math.round((area.w || 1.5) / 1.5)) : 0;
    for (let r = origin.r - N - 1; r <= origin.r + N + 1; r++) for (let c = origin.c - N - 1; c <= origin.c + N + 1; c++) {
      const ox = c - origin.c, oy = r - origin.r, t = ox * dx + oy * dy, p = Math.abs(ox * dy - oy * dx);
      if (t <= 0.25 || t > N + 0.3) continue;
      if (W ? p <= W / 2 + 0.05 : p <= t / 2 + 0.3) add(c, r);
    }
  }
  return out;
}
/** Criaturas dentro de la plantilla. */
export const tokensIn = (s, cells, skip = null) => s.tokens.filter(t => t.id !== skip && !t.hidden && cells.has(t.c + "," + t.r)).map(t => t.id);

/** ¿Se puede colocar el área ahí? (el punto de origen tiene que estar a su alcance) */
export function templateOk(s, caster, aim, area, rng) {
  if (/cono|línea|emanación/.test(area.shape) || !rng || rng.self) return true;
  return Math.max(Math.abs(aim.c - caster.c), Math.abs(aim.r - caster.r)) * 1.5 <= (rng.n || 0) + 0.01;
}
export { dist, eco };

/** Ataques de oportunidad que provocaría moverse por este camino (SRD): sales del alcance de un enemigo que te ve,
 *  que puede reaccionar y que tiene un ataque cuerpo a cuerpo. Destrabarse, o estar oculto (invisible), lo evita. */
export const oaThreats = (s, t, path) => oaThreatsAt(s, t, path).map(x => x.id);
/** Igual, con la casilla desde la que sale del alcance (el ataque de oportunidad se hace justo ANTES de que salga). */
export function oaThreatsAt(s, t, path) {
  if (!path || path.length < 2 || !s.board) return [];
  if ((t.conds || []).some(c => c.id === "destrabado" || c.id === "invisible")) return [];
  const out = [];
  for (const h of s.tokens) {
    if (h.id === t.id || h.hidden || (h.kind === "pc") === (t.kind === "pc")) continue;
    const hp = h.kind === "pc" ? null : h.hp; if (hp != null && hp <= 0) continue;
    if ((h.conds || []).some(c => ["incapacitado", "inconsciente", "aturdido", "paralizado", "petrificado", "muerto", "cegado"].includes(c.id))) continue;
    if (phase(s) === "live" && eco(s, h).react) continue;
    const melee = attacksOf(s, h).filter(w => !w.rng || !w.rng.ranged || w.rng.melee); if (!melee.length) continue;
    const reach = Math.max(1, ...melee.map(w => Math.round(((w.rng && w.rng.n) || 1.5) / 1.5)));
    for (let i = 1; i < path.length; i++) if (gap(path[i - 1], h) <= reach && gap(path[i], h) > reach) { out.push({ id: h.id, at: { c: path[i - 1].c, r: path[i - 1].r } }); break; }
  }
  return out;
}
