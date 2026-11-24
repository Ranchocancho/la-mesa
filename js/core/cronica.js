// Datos de cada sesión para la Crónica (Hito 70): botín, experiencia, enemigos abatidos, PNJ de Lore muertos y lugares.
// El navegador del máster los va apuntando en la sesión en curso mientras se juega:
//   · kills: criaturas que caen a 0 PG (las de Lore como PNJ, aparte) · scenes: mesas por las que pasa el grupo
//   · loot (comercio.js) · visited (contexto.js: lugares del mapa del mundo) · xp0 → PX ganados (al cerrar: xpGot)
import { store } from "./store.js";
import { isDM, runsTable } from "./session.js";
import { liveSession } from "./sesiones.js";
import { hpOf } from "./mesa.js";
import { tripText, kmOf } from "./ruta.js";

const prev = new Map(); let lastLive = null;
function scan() {
  const s = store.get(); if (!runsTable(s)) return;
  const l = liveSession(s); if (!l || l.test) { prev.clear(); lastLive = null; return; }
  if (lastLive !== l.id) { prev.clear(); lastLive = l.id; }
  const add = [];
  for (const t of s.tokens || []) {
    if (t.kind === "pc") continue;
    const h = hpOf(s, t); if (!h) continue;
    const was = prev.get(t.id); prev.set(t.id, h.cur);
    if (was != null && was > 0 && h.cur <= 0 && !(l.kills || []).some(k => k.tok === t.id)) add.push({ tok: t.id, n: t.name, npc: t.npc || null, at: Date.now() });
  }
  const sc = s.board && s.board.scene && (s.scenes || []).find(x => x.id === s.board.scene);
  const newScene = sc && !(l.scenes || []).some(x => x.id === sc.id);
  if (!add.length && !newScene) return;
  store.commit("session", st => { const x = liveSession(st); if (!x) return;
    if (add.length) x.kills = [...(x.kills || []), ...add];
    if (newScene) x.scenes = [...(x.scenes || []), { id: sc.id, n: sc.name, at: Date.now() }]; });
}
export function watchChronicle() { store.subscribe(() => queueMicrotask(scan)); setInterval(scan, 3000); }

/** Resumen de una sesión para la crónica. */
export function sessionStats(s, x) {
  const loot = x.loot || [], cp = loot.reduce((a, l) => a + (+l.cp || 0), 0), items = loot.flatMap(l => l.items || []);
  let xp = x.xpGot != null ? x.xpGot : null;
  if (xp == null && x.status === "open" && x.xp0) xp = s.characters.reduce((a, c) => a + Math.max(0, (c.xp || 0) - (x.xp0[c.id] ?? (c.xp || 0))), 0);
  if (xp == null) xp = (x.xp || []).reduce((a, g) => a + (+g.amount || 0), 0);
  const kills = (x.kills || []).filter(k => !k.npc), npcs = (x.kills || []).filter(k => k.npc);
  const group = {}; kills.forEach(k => { const n = String(k.n || "?").replace(/\s+\d+$/, ""); group[n] = (group[n] || 0) + 1; });
  const places = [...(x.visited || []).map(id => ((s.world && s.world.places) || []).find(p => p.id === id)).filter(Boolean).map(p => p.name), ...(x.scenes || []).map(c => c.n)];
  return { trip: tripText(s, x.route || []), km: kmOf(s, x.route || []), cp, items, xp, kills: Object.entries(group).sort((a, b) => b[1] - a[1]), nKills: kills.length, npcs: npcs.map(k => ({ n: k.n, id: k.npc })), places: [...new Set(places)] };
}
