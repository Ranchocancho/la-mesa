// Tablero de casillas cuadradas (5 pies por casilla), vista plana. Lo usan el editor de escenas y la mesa en directo.
// Modelo: { grid: { cols, rows, terrain: {"c,r": tipo}, props: [{id,c,r,k}] }, tokens: [{id,kind,name,c,r,color,size,hp,maxhp,ac,char,owner,hidden,init}] }
import { getImage } from "../core/images.js";
import { esc } from "../core/ui.js";
import { estado } from "../data/estados.js";

export const TERRAIN = {
  piedra: { n: "Piedra", f: "#5f5b55" }, madera: { n: "Madera", f: "#6b4a2e" }, hierba: { n: "Hierba", f: "#4d6a33" },
  tierra: { n: "Tierra", f: "#6e5a3f" }, arena: { n: "Arena", f: "#a8915f" }, agua: { n: "Agua", f: "#2e5874" },
  barro: { n: "Barro", f: "#4a3b2a" }, muro: { n: "Muro", f: "#221d19", wall: true }
};
export const PROPS = {
  arbol: ["🌲", "Árbol"], arbusto: ["🌿", "Arbusto"], roca: ["🪨", "Roca"], barril: ["🛢️", "Barril"], caja: ["📦", "Caja"],
  mesa: ["🪵", "Mesa"], silla: ["🪑", "Silla"], cofre: ["🧰", "Cofre"], hoguera: ["🔥", "Fuego"], puerta: ["🚪", "Puerta"],
  columna: ["🏛️", "Columna"], cama: ["🛏️", "Cama"], calavera: ["💀", "Escombros"], trampa: ["⚠️", "Trampa"],
  antorcha: ["🪔", "Antorcha (en pared)"], velas: ["🕯️", "Velas"], estandarte: ["🚩", "Estandarte (en pared)"], tonel: ["🍺", "Tonel"],
  baul: ["🧳", "Baúl"], mesalarga: ["🍽️", "Mesa larga"], escaleras: ["🪜", "Escaleras"]
};
const T = 44, S = T / 2; // lado de la casilla en el plano 2D
const key = (c, r) => c + "," + r;
export const center = (c, r) => [c * T + S + 4, r * T + S + 4];
const corners = (x, y, h = S) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => (x + a * h).toFixed(1) + "," + (y + b * h).toFixed(1)).join(" ");
/** Distancia en casillas con la regla de 2024: cada diagonal cuenta como 5 pies. */
export const dist = (a, b) => Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
const pixelToHex = (x, y) => ({ c: Math.floor((x - 4) / T), r: Math.floor((y - 4) / T) });
export const healthWord = (hp, max) => hp <= 0 ? "Fuera de combate" : hp / max > 0.75 ? "Ileso" : hp / max > 0.5 ? "Herido" : hp / max > 0.25 ? "Malherido" : "Al borde";
const imgCache = new Map();

/**
 * opts: { model(): {grid,tokens}, dm: bool, edit: bool, canMove(token): bool, mutate(label, fn(model)), selected, onSelect(id), hpOf(token) }
 */
export function createBoard(host, opts) {
  host.classList.add("board");
  host.innerHTML = `<svg class="boardsvg" aria-label="Tablero"></svg>
    ${opts.edit ? `<div class="boardtools" role="toolbar"></div>` : ""}
    <div class="boardzoom"><button data-z="1.25" aria-label="Acercar">+</button><button data-z="0.8" aria-label="Alejar">−</button><button data-z="fit" aria-label="Encajar">⤢</button></div>
    <div class="dragtip" hidden></div>`;
  const svg = host.querySelector("svg"), tip = host.querySelector(".dragtip");
  let vb = null, tool = "move", brush = "piedra", prop = "arbol", drag = null, painted = null, selected = opts.selected || null;

  const size = () => { const g = opts.model().grid; return [g.cols * T + 8, g.rows * T + 8]; };
  const fit = () => { const [w, h] = size(); vb = [0, 0, w, h]; setVB(); };
  const setVB = () => svg.setAttribute("viewBox", vb.map(v => v.toFixed(1)).join(" "));
  const pt = e => { const r = svg.getBoundingClientRect(), k = Math.max(vb[2] / r.width, vb[3] / r.height); const ox = (r.width * k - vb[2]) / 2, oy = (r.height * k - vb[3]) / 2; return [vb[0] + (e.clientX - r.left) * k - ox, vb[1] + (e.clientY - r.top) * k - oy, k]; };
  const inside = h => { const g = opts.model().grid; return h.c >= 0 && h.r >= 0 && h.c < g.cols && h.r < g.rows; };

  function tools() {
    const t = host.querySelector(".boardtools"); if (!t) return;
    t.innerHTML = `<div class="tg">${[["move", "✋ Mover"], ["paint", "🖌 Terreno"], ["prop", "🌲 Escenografía"], ["foe", "👹 Enemigo"], ["erase", "🧽 Borrar"]].map(([k, n]) => `<button class="btn small" data-tool="${k}" aria-pressed="${tool === k}">${n}</button>`).join("")}</div>
      ${tool === "paint" ? `<div class="tg">${Object.entries(TERRAIN).map(([k, v]) => `<button class="sw" data-brush="${k}" aria-pressed="${brush === k}" title="${v.n}" style="background:${v.f}"><span>${v.n}</span></button>`).join("")}</div>` : ""}
      ${tool === "prop" ? `<div class="tg">${Object.entries(PROPS).map(([k, v]) => `<button class="sw prop" data-prop="${k}" aria-pressed="${prop === k}" title="${v[1]}">${v[0]}</button>`).join("")}</div>` : ""}
      ${tool === "foe" ? `<div class="tg hint">Toca una casilla para colocar un enemigo; luego edítalo a la derecha.</div>` : ""}
      ${tool === "erase" ? `<div class="tg hint">Toca para quitar escenografía, terreno o fichas.</div>` : ""}`;
    t.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => { tool = b.dataset.tool; tools(); });
    t.querySelectorAll("[data-brush]").forEach(b => b.onclick = () => { brush = b.dataset.brush; tools(); });
    t.querySelectorAll("[data-prop]").forEach(b => b.onclick = () => { prop = b.dataset.prop; tools(); });
  }

  function render() {
    if (drag && drag.token) return; // no redibujar a mitad de un arrastre
    const { grid, tokens } = opts.model();
    if (!vb) fit();
    const t = grid.terrain || {};
    let cells = "", walls = "";
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
      const [x, y] = center(c, r), ty = TERRAIN[t[key(c, r)]];
      if (ty && ty.wall) walls += `<polygon points="${corners(x, y)}" class="wall"/><polygon points="${corners(x, y, S * 0.78)}" class="walltop"/>`;
      else cells += `<polygon points="${corners(x, y)}" fill="${ty ? ty.f : "#3a332b"}" class="cell"/>`;
    }
    const props = (grid.props || []).map(p => { const [x, y] = center(p.c, p.r); return `<text x="${x}" y="${y + 9}" class="prop">${(PROPS[p.k] || ["?"])[0]}</text>`; }).join("");
    const fog = opts.fogState ? opts.fogState() : null;
    let fogSvg = "";
    if (fog) for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
      const k = key(c, r); if (fog.vis.has(k)) continue;
      const [x, y] = center(c, r);
      fogSvg += `<rect x="${x - S}" y="${y - S}" width="${T}" height="${T}" fill="${fog.exp.has(k) ? "rgba(5,7,12,.62)" : "#0c0a08"}"/>`;
    }
    const toks = tokens.filter(k => (opts.dm || !k.hidden) && (!fog || k.kind === "pc" || fog.vis.has(key(k.c, k.r)))).map(k => {
      const dk = { name: k.name, color: k.color, ...(opts.decorate ? opts.decorate(k) : {}) };
      const [x, y] = center(k.c, k.r), rad = S * 0.8 * (k.size || 1), hp = opts.hpOf(k), down = hp && hp.cur <= 0;
      const img = dk.portrait && imgCache.get(dk.portrait);
      if (dk.portrait && !imgCache.has(dk.portrait)) { imgCache.set(dk.portrait, null); getImage(dk.portrait).then(u => { imgCache.set(dk.portrait, u); render(); }); }
      const ring = k.kind === "pc" ? "#d6aa4e" : k.kind === "npc" ? "#7d8fe0" : "#b33a2e";
      const pct = hp ? Math.max(0, Math.min(1, hp.cur / Math.max(1, hp.max))) : 1;
      return `<g class="tok ${down ? "down" : ""} ${k.hidden ? "hid" : ""} ${selected === k.id ? "sel" : ""} ${opts.canMove(k) ? "mov" : ""}" data-tok="${k.id}" transform="translate(${x},${y})">
        <clipPath id="cp-${k.id}"><circle r="${rad - 2}"/></clipPath>
        <circle r="${rad + 3}" class="halo"/>
        ${(k.conds || []).map((cd, i) => { const e = estado(cd.id); return e ? `<circle r="${rad + 5 + i * 3.5}" fill="none" stroke="${e.c}" stroke-width="3"/>` : ""; }).join("")}
        <circle r="${rad}" fill="${dk.color || "#777"}" stroke="${ring}" stroke-width="3"/>
        ${img ? `<image href="${img}" x="${-rad}" y="${-rad}" width="${rad * 2}" height="${rad * 2}" clip-path="url(#cp-${k.id})" preserveAspectRatio="xMidYMid slice"/>` : `<text class="ini" y="5">${esc((dk.name || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase())}</text>`}
        ${hp && (opts.dm || k.kind === "pc") ? `<rect x="${-rad}" y="${rad + 2}" width="${rad * 2}" height="4" class="hpbg"/><rect x="${-rad}" y="${rad + 2}" width="${rad * 2 * pct}" height="4" class="hpfg ${pct <= .25 ? "low" : pct <= .5 ? "mid" : ""}"/>` : ""}
        ${dk.isTurn ? `<circle r="${rad + 7}" class="turn"/>` : ""}
      </g>`;
    }).join("");
    const mk = opts.marker && opts.marker(), mkp = mk && center(mk.c, mk.r);
    const start = mkp ? `<g class="startmk" transform="translate(${mkp[0]},${mkp[1]})"><polygon points="${corners(0, 0, S * 0.92)}"/><text y="6">⚑</text></g>` : "";
    svg.innerHTML = `<g class="cells">${cells}</g><g>${walls}</g>${start}<g class="props">${props}</g><g class="fog">${fogSvg}</g><g class="toks">${toks}</g><g class="ghost"></g>`;
  }

  // ---------- Interacción ----------
  svg.addEventListener("pointerdown", e => {
    const [x, y] = pt(e), h = pixelToHex(x, y), tokEl = e.target.closest("[data-tok]");
    const m = opts.model(), tok = tokEl && m.tokens.find(k => k.id === tokEl.dataset.tok);
    svg.setPointerCapture(e.pointerId);
    if (opts.edit && tool === "erase") { erase(h, tok); return; }
    if (opts.edit && tool === "paint" && inside(h)) { painted = new Map([[key(h.c, h.r), brush]]); drag = { paint: true }; paintPreview(); return; }
    if (opts.edit && tool === "prop" && inside(h)) { opts.mutate("board", mm => { mm.grid.props = mm.grid.props || []; mm.grid.props.push({ id: "p" + Date.now().toString(36), c: h.c, r: h.r, k: prop }); }); return; }
    if (opts.edit && tool === "foe" && inside(h)) {
      const id = "t" + Date.now().toString(36);
      opts.mutate("board", mm => mm.tokens.push({ id, kind: "foe", name: "Enemigo", c: h.c, r: h.r, color: "#7a2a22", size: 1, hp: 7, maxhp: 7, ac: 12, initBonus: 0 }));
      select(id); return;
    }
    if (tok) { drag = { token: tok, from: { c: tok.c, r: tok.r }, sx: x, sy: y, moved: false, can: opts.canMove(tok) }; return; }
    drag = { pan: true, sx: e.clientX, sy: e.clientY, vb: [...vb], moved: false };
  });
  svg.addEventListener("pointermove", e => {
    if (!drag) return;
    if (drag.pan) {
      const r = svg.getBoundingClientRect(), k = Math.max(vb[2] / r.width, vb[3] / r.height);
      const dx = (e.clientX - drag.sx) * k, dy = (e.clientY - drag.sy) * k;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      vb = [drag.vb[0] - dx, drag.vb[1] - dy, vb[2], vb[3]]; setVB(); return;
    }
    const [x, y] = pt(e), h = pixelToHex(x, y);
    if (drag.paint) { if (inside(h)) { painted.set(key(h.c, h.r), brush); paintPreview(); } return; }
    if (drag.token && drag.can) {
      if (!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) < 6) return;
      drag.moved = true;
      const g = svg.querySelector(`[data-tok="${drag.token.id}"]`); if (g) g.setAttribute("transform", `translate(${x},${y})`);
      const d = dist(drag.from, h);
      const [cx, cy] = center(h.c, h.r);
      svg.querySelector(".ghost").innerHTML = inside(h) ? `<polygon points="${corners(cx, cy)}" class="target"/>` : "";
      tip.hidden = false; tip.textContent = `${d * 5} pies (${d} casillas)`;
      const r = host.getBoundingClientRect(); tip.style.left = (e.clientX - r.left + 14) + "px"; tip.style.top = (e.clientY - r.top + 14) + "px";
    }
  });
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null; tip.hidden = true;
    if (d.paint) { const p = painted; painted = null; opts.mutate("board", mm => { mm.grid.terrain = mm.grid.terrain || {}; p.forEach((v, k) => (mm.grid.terrain[k] = v)); }); return; }
    if (d.pan) { if (!d.moved) { select(null); if (opts.onCell) { const [x, y] = pt(e), h = pixelToHex(x, y); if (inside(h)) opts.onCell(h); } } return; }
    if (d.token) {
      if (!d.moved) { select(d.token.id); return; }
      const [x, y] = pt(e), h = pixelToHex(x, y), t = (opts.model().grid.terrain || {})[key(h.c, h.r)];
      if (inside(h) && !(TERRAIN[t] && TERRAIN[t].wall)) opts.mutate("token", mm => { const k = mm.tokens.find(z => z.id === d.token.id); if (k) { k.c = h.c; k.r = h.r; } }, d.token);
      select(d.token.id); render();
    }
  };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", () => { drag = null; tip.hidden = true; render(); });
  svg.addEventListener("wheel", e => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0015), pt(e)); }, { passive: false });
  host.querySelectorAll("[data-z]").forEach(b => b.onclick = () => b.dataset.z === "fit" ? fit() : zoom(1 / +b.dataset.z, [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2]));
  function zoom(f, [x, y]) { const nw = Math.max(150, Math.min(size()[0] * 3, vb[2] * f)), k = nw / vb[2]; vb = [x - (x - vb[0]) * k, y - (y - vb[1]) * k, vb[2] * k, vb[3] * k]; setVB(); }
  function paintPreview() {
    const g = svg.querySelector(".ghost");
    g.innerHTML = [...painted.keys()].map(k => { const [c, r] = k.split(",").map(Number), [x, y] = center(c, r); return `<polygon points="${corners(x, y)}" fill="${TERRAIN[brush].f}" opacity=".85"/>`; }).join("");
  }
  function erase(h, tok) {
    if (tok) { opts.mutate("board", mm => { mm.tokens.splice(mm.tokens.findIndex(z => z.id === tok.id), 1); }); if (selected === tok.id) select(null); return; }
    opts.mutate("board", mm => {
      const i = (mm.grid.props || []).findIndex(p => p.c === h.c && p.r === h.r);
      if (i >= 0) mm.grid.props.splice(i, 1); else if (mm.grid.terrain) delete mm.grid.terrain[key(h.c, h.r)];
    });
  }
  function select(id) { selected = id; opts.onSelect && opts.onSelect(id); render(); }

  tools(); render();
  return { render, fit, select, get selected() { return selected; }, resize() { fit(); } };
}
