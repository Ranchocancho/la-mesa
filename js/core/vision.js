// Visión y niebla de guerra. El grupo comparte lo que ve: una casilla es visible si algún personaje en pie
// tiene línea de visión hasta ella (los muros y las puertas cerradas la tapan) y además está iluminada o dentro de su visión en la oscuridad.
import { TERRAIN } from "../views/tablero.js";

// Radio de luz de cada fuente, en casillas de 1,5 m (luz brillante + tenue)
export const LIGHTS = { antorcha: 8, hoguera: 8, velas: 3 };
const DARK_AMBIENT = { noche: true };

/** Visión en la oscuridad por defecto según la especie (en metros). */
export function darkvisionOf(ch) {
  if (!ch) return 0;
  if (ch.darkvision != null && ch.darkvision !== "") return +ch.darkvision || 0;
  const s = (ch.species || "").toLowerCase();
  if (/enan|orc|drow/.test(s)) return 36;
  if (/elf|gnom|tiefl|aasim|drac/.test(s)) return 18;
  return 0;
}

export function computeVision(grid, tokens, characters) {
  const doors = new Set((grid.props || []).filter(p => p.k === "puerta" && !p.open).map(p => p.c + "," + p.r));
  const wall = (c, r) => { const t = (grid.terrain || {})[c + "," + r]; return !!(TERRAIN[t] && TERRAIN[t].wall) || doors.has(c + "," + r); };
  const inside = (c, r) => c >= 0 && r >= 0 && c < grid.cols && r < grid.rows;
  // Línea de visión entre centros de casillas; los muros bloquean (la casilla del muro sí se ve)
  const los = (a, b) => {
    const dx = b.c - a.c, dy = b.r - a.r, n = Math.max(Math.abs(dx), Math.abs(dy)) * 2;
    for (let i = 1; i < n; i++) {
      const c = Math.round(a.c + dx * i / n), r = Math.round(a.r + dy * i / n);
      if ((c !== b.c || r !== b.r) && wall(c, r)) return false;
    }
    return true;
  };
  const dark = !!DARK_AMBIENT[grid.ambient];
  const lit = new Set();
  if (dark) for (const p of grid.props || []) {
    const R = LIGHTS[p.k]; if (!R) continue;
    for (let r = p.r - R; r <= p.r + R; r++) for (let c = p.c - R; c <= p.c + R; c++)
      if (inside(c, r) && Math.max(Math.abs(c - p.c), Math.abs(r - p.r)) <= R && los(p, { c, r })) lit.add(c + "," + r);
  }
  const eyes = tokens.filter(t => t.kind === "pc").map(t => {
    const ch = characters.find(x => x.id === t.char);
    return ch && ch.hp.cur <= 0 ? null : { c: t.c, r: t.r, dv: Math.floor(darkvisionOf(ch) / 1.5) };
  }).filter(Boolean);
  const vis = new Set();
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    const k = c + "," + r;
    for (const e of eyes) {
      const d = Math.max(Math.abs(c - e.c), Math.abs(r - e.r));
      if (!(d <= 1 || !dark || lit.has(k) || d <= e.dv)) continue;
      if (los(e, { c, r })) { vis.add(k); break; }
    }
  }
  return vis;
}

// Lo explorado se recuerda en este navegador, por escena
export function explored(boardKey, vis) {
  const K = "lamesa:explorado:" + boardKey;
  let set;
  try { set = new Set(JSON.parse(localStorage.getItem(K) || "[]")); } catch (e) { set = new Set(); }
  let changed = false;
  vis.forEach(k => { if (!set.has(k)) { set.add(k); changed = true; } });
  if (changed) try { localStorage.setItem(K, JSON.stringify([...set])); } catch (e) { /* sin almacenamiento */ }
  return set;
}
