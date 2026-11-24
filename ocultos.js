// Criaturas ocultas que dejan de estarlo (Hito 91). SRD 5.2.1, acción Esconderse y estado Invisible:
// - quien está escondido deja de estarlo en cuanto hace una tirada de ataque o lanza un conjuro (y el conjuro
//   Invisibilidad acaba si ataca, hace daño o lanza un conjuro);
// - para esconderse hay que estar muy oscurecido o tras cobertura de tres cuartos, fuera de la vista de los enemigos:
//   si en combate una criatura oculta se mueve a una casilla que el grupo ve, deja de estar escondida.
// Lo hace el navegador del máster (o de quien lleve la mesa). El máster puede volver a ocultarla a mano.
import { store, uid } from "./store.js";
import { runsTable } from "./session.js";
import { computeVision, visionOn, tokenSeen, sightLine } from "./vision.js";

const ACTS = new Set(["attack", "spell", "damage", "cast"]);
let seenRolls = null;
const lastPos = new Map();

function nameOf(t) { return String(t.name || "Criatura").replace(/\s*\((?:invisible|oculto|oculta|en [^)]*|tras [^)]*|bajo [^)]*|entre [^)]*)\)\s*$/i, "").trim(); }

function reveal(ids, why) {
  if (!ids.length) return;
  store.commit("token", st => {
    const names = [];
    for (const id of ids) { const t = st.tokens.find(x => x.id === id); if (t && t.hidden) { t.hidden = false; names.push(nameOf(t)); } }
    if (!names.length) return;
    st.rolls = st.rolls || [];
    st.rolls.push({ id: uid("tir"), at: Date.now(), who: null, whoName: "Mesa", kind: "note", label: `👁 ${names.join(", ")} ${names.length > 1 ? "dejan" : "deja"} de estar ${names.length > 1 ? "ocultos" : "oculto"}: ${why}`, expr: "", dice: [], total: null, nat: null });
  });
}

/** ¿Ve alguien del grupo esa casilla? Con visión activada, según luz y muros; sin ella, por línea de visión. */
function seenByParty(s, t) {
  const g = s.board;
  if (visionOn(g)) return tokenSeen(t, computeVision(g, s.tokens || [], s.characters || []));
  const los = sightLine(g);
  return (s.tokens || []).some(p => p.kind === "pc" && los(p, t));
}

export function watchHidden() {
  store.subscribe(s => {
    if (!s || !s.board || !runsTable(s)) { seenRolls = null; lastPos.clear(); return; }
    // 1) Atacar o lanzar un conjuro delata (siempre)
    const rolls = s.rolls || [];
    if (!seenRolls) { seenRolls = new Set(rolls.map(r => r.id)); }
    const hidden = new Map((s.tokens || []).filter(t => t.hidden && t.kind !== "pc").map(t => [t.id, t]));
    const byAct = [];
    for (const r of rolls) {
      if (seenRolls.has(r.id)) continue; seenRolls.add(r.id);
      if (ACTS.has(r.kind) && r.tok && hidden.has(r.tok)) byAct.push(r.tok);
    }
    if (byAct.length) { reveal([...new Set(byAct)], "ha atacado o lanzado un conjuro"); return; }
    // 2) En combate, moverse a la vista del grupo delata
    const live = s.board.combat === "live", moved = [];
    for (const t of s.tokens || []) {
      if (t.kind === "pc") continue;
      const k = t.c + "," + t.r, was = lastPos.get(t.id); lastPos.set(t.id, k);
      if (live && t.hidden && was && was !== k && seenByParty(s, t)) moved.push(t.id);
    }
    if (moved.length) reveal(moved, "se ha movido a la vista del grupo");
  });
}
