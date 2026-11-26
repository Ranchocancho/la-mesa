// Hito 110: puertas para todos.
// Cualquier jugador abre o cierra una puerta normal desde una casilla al lado (en combate, en su turno: es la
// interacción con un objeto gratuita del SRD). Las cerradas con llave piden la llave, forzar la cerradura
// (Destreza con herramientas de ladrón) o echarla abajo (Fuerza/Atletismo). El rastrillo se levanta a pulso.
import { store } from "./store.js";
import { isDM, currentUser } from "./session.js";
import { PROPS, isDoor, doorLocked } from "../data/mapas.js";
import { publish } from "./dados.js";
import { mod, prof, skillBonus } from "../data/dnd.js";
import { phase, spend } from "./turnos.js";
import { toast, esc } from "./ui.js";

const S = () => store.get();
const near = (t, p) => Math.max(Math.abs(t.c - p.c), Math.abs(t.r - p.r)) <= 1;
const charOf = (s, t) => s.characters.find(c => c.id === t.char);
const sound = k => import("./sonido.js").then(m => m.sound.play(k)).catch(() => {});

/** Dificultades (SRD/DMG 2024): cerradura corriente 15; puerta rúnica enana 20. Romperla: madera 15, piedra 25. */
const DC = p => p.k === "puertarunas" ? { pick: 20, force: 25 } : p.k === "rastrillo" ? { pick: null, force: 20 } : { pick: 15, force: 15 };

/** Lo que tiene el grupo que sirve: la llave (cualquier objeto o tesoro con «llave» en el nombre) y herramientas de ladrón. */
function kit(s, c) {
  const names = ch => [...(ch.inventory || []), ...(ch.treasures || [])].map(i => (i.name || "") + "");
  const key = s.characters.flatMap(names).find(n => /llave/i.test(n)) || null;
  const tools = names(c).some(n => /ladr[oó]n/i.test(n));
  const toolProf = /ladr[oó]n/i.test(JSON.stringify([c.tools || "", c.profs || "", c.proficiencies || ""])) || /p[ií]caro/i.test(c.cls || "");
  return { key, tools, toolProf };
}

export function setDoor(id, fn) { store.commit("board", st => { const p = (st.board.props || []).find(x => x.id === id); if (p) fn(p); }); }

/** Clic en una puerta. Devuelve opciones para el menú si hace falta elegir (cerrada con llave o rastrillo). */
export function doorClick(id) {
  const s = S(), p = (s.board.props || []).find(x => x.id === id); if (!isDoor(p)) return null;
  if (isDM(s)) { setDoor(id, x => { x.open = !x.open; }); sound("door"); return null; }
  const me = (currentUser(s) || {}).id, mine = s.tokens.filter(t => t.kind === "pc" && t.owner && t.owner === me);
  if (!mine.length) { toast("No tienes figura en la mesa."); return null; }
  const live = phase(s) === "live";
  const t = live ? mine.find(x => x.id === s.board.turn) : mine.find(x => near(x, p)) || mine[0];
  if (live && !t) { toast("Espera a tu turno para tocar la puerta."); return null; }
  if (!near(t, p)) { toast("Acércate a la puerta (a una casilla) para abrirla."); return null; }
  if (p.open) {
    if (p.broken) { toast("Está reventada: ya no cierra."); return null; }
    if (s.tokens.some(k => k.c === p.c && k.r === p.r)) { toast("Hay alguien en el umbral: no se puede cerrar."); return null; }
    setDoor(id, x => { x.open = false; }); sound("door"); return null;
  }
  if (!doorLocked(p) && p.k !== "rastrillo") { setDoor(id, x => { x.open = true; }); sound("door"); return null; }
  // Cerrada: elegir cómo
  const c = charOf(s, t); if (!c) { toast("Esta puerta está cerrada con llave."); return null; }
  const k = kit(s, c), dc = DC(p), opts = [];
  const sb = n => (n >= 0 ? "+" : "") + n;
  if (p.k === "rastrillo") {
    const b = skillBonus(c, "atletismo", "fue");
    opts.push({ k: "force", txt: `💪 Levantarlo a pulso · Atletismo ${sb(b)} contra CD ${dc.force}` });
  } else {
    if (k.key) opts.push({ k: "key", txt: `🗝 Usar «${k.key}»` });
    if (dc.pick && k.tools) { const b = mod(c.abilities.des) + (k.toolProf ? prof(c.level) : 0); opts.push({ k: "pick", txt: `🛠 Forzar la cerradura · Destreza${k.toolProf ? " (competente)" : ""} ${sb(b)} contra CD ${dc.pick}` }); }
    const b = skillBonus(c, "atletismo", "fue");
    opts.push({ k: "force", txt: `💪 Echarla abajo · Atletismo ${sb(b)} contra CD ${dc.force}` });
  }
  return { id, tok: t.id, char: c.id, title: p.k === "rastrillo" ? "Rastrillo bajado" : `${PROPS[p.k].n}${p.label ? ` · ${esc(p.label)}` : ""}`,
    note: p.k === "rastrillo" ? "Hay que levantar la reja." : !k.tools && !k.key ? "Sin llave ni herramientas de ladrón: solo queda la fuerza bruta (o pedírsela al máster)." : "", opts, live };
}

/** Lleva a cabo la opción elegida en el menú. */
export function doorTry(o, how) {
  const s = S(), p = (s.board.props || []).find(x => x.id === o.id), t = s.tokens.find(x => x.id === o.tok), c = t && charOf(s, t);
  if (!p || !c) return;
  const dc = DC(p);
  if (how === "key") { setDoor(o.id, x => { x.locked = false; x.open = true; }); sound("door"); toast(`${c.name} abre con la llave.`); return; }
  if (o.live) spend(t.id, "act"); // forzar o romper una puerta es una acción (Utilizar un objeto / prueba)
  let e;
  if (how === "pick") { const k = kit(s, c), b = mod(c.abilities.des) + (k.toolProf ? prof(c.level) : 0);
    e = publish({ kind: "check", label: `Forzar la cerradura · ${c.name}`, expr: `1d20${b >= 0 ? "+" : ""}${b}`, dc: dc.pick, by: t.id }); }
  else { const b = skillBonus(c, "atletismo", "fue");
    e = publish({ kind: "check", label: `${p.k === "rastrillo" ? "Levantar el rastrillo" : "Echar abajo la puerta"} · ${c.name}`, expr: `1d20${b >= 0 ? "+" : ""}${b}`, dc: dc.force, by: t.id }); }
  const ok = e && e.result === "save";
  setTimeout(() => {
    if (ok) { setDoor(o.id, x => { x.locked = false; x.open = true; if (how === "force" && x.k !== "rastrillo") x.broken = true; }); sound("door");
      toast(how === "pick" ? "¡Clic! La cerradura cede." : p.k === "rastrillo" ? "La reja sube chirriando." : "¡La puerta salta en astillas!"); }
    else toast(how === "pick" ? "La cerradura se resiste." : "No cede. Hace ruido…");
  }, 900); // después de ver el dado
}
