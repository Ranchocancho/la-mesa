// Avisos de la mesa (Hito 66, a partir de la auditoría de diseño):
//   · ¿Está el máster conectado? Lo que afecta a fichas ajenas (daño, empujones, salvaciones, efectos) lo aplica
//     su navegador: si no está, la tirada se hace igual pero se aplicará cuando vuelva. La mesa lo dice.
//   · ¿Esta tirada espera al máster? (para marcarla «⏳» en el registro y en la barra)
//   · ¿Este conjuro dañino alcanza a aliados? Solo entonces se pide confirmación (como Baldur's Gate 3).
import { presence } from "./presence.js";
import { session } from "./session.js";
import { charOf } from "./mesa.js";
import { lrLeft } from "./defensas.js";

/** ¿Hay algún máster conectado? (en la demostración, el máster cuenta si es quien está usando la app) */
export function dmOnline(s) {
  const me = session.id && session.id();
  return (s.users || []).some(u => (u.role === "dm" || u.role === "admin") && (u.id === me || presence.online(u.id)));
}

/** Qué le falta a esta tirada para estar aplicada (texto corto) o null si no espera a nadie. */
export function awaitsDM(s, r) {
  if (!r || r.status === "void") return null;
  if (r.kind === "attack" && r.status === "pending") return "resolver el ataque";
  if (r.kind === "damage" && r.status === "pending" && r.applied == null && r.total != null) return "aplicar el daño";
  if (r.saves && r.status === "pending" && r.applied == null) {
    const lr = r.saves.some(sv => !sv.auto && !sv.ok && !sv.lr && lrLeft((s.tokens || []).find(x => x.id === sv.t) || {}) > 0);
    return lr ? "decidir la Resistencia legendaria" : "aplicar el conjuro";
  }
  if (r.kind === "mastery" && r.status === "pending") return "aplicar la maestría";
  if (r.apply && !r.applied && r.result) return "aplicar el efecto";
  if (r.kind === "travel" && !r.applied) return "llevar al grupo";
  return null;
}

/** Texto «⏳» de una tirada pendiente, o "" si no hay que decir nada.
 *  Con el máster conectado se aplica al momento: solo se avisa si tarda (más de 4 s) o si es una decisión suya. */
export function pendingTag(s, r) {
  const what = awaitsDM(s, r); if (!what) return "";
  if (!dmOnline(s)) return `⏳ Se aplicará cuando el máster esté conectado (falta ${what})`;
  if (/Resistencia legendaria/.test(what)) return `⏳ El máster decide si usa la Resistencia legendaria`;
  if (Date.now() - (r.at || 0) > 4000) return `⏳ Esperando al máster: ${what}`;
  return "";
}

/** ¿Hace daño o perjudica? (para avisar si alcanza a aliados). Curar o bendecir no avisa. */
export const harmful = m => !!m && !m.heal && !!(m.dmg || m.save || m.atk);
/** Aliados (y uno mismo) entre los objetivos de algo dañino: nombres, para el aviso. */
export function alliesHit(s, casterId, targetIds, m) {
  if (!harmful(m)) return [];
  const a = (s.tokens || []).find(t => t.id === casterId); if (!a) return [];
  const side = t => t.kind === "pc"; // el mismo criterio que las etiquetas al apuntar
  return targetIds.map(id => (s.tokens || []).find(t => t.id === id)).filter(t => t && side(t) === side(a))
    .map(t => t.id === a.id ? "ti" : String((charOf(s, t) || t).name || "").split(" ")[0]);
}
