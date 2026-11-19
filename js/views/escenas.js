// Preparar escenas tácticas (solo administrador y másteres).
// Cada escena va asociada a un lugar del mundo o a la biblioteca, para improvisar.
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { blankScene } from "../data/escenas.js";
import { loadScene } from "../core/mesa.js";
import { createBoard, TERRAIN } from "./tablero.js";
import { propEditorHTML, bindPropEditor } from "./propeditor.js";
import { generateDungeon } from "../core/generador.js";
import { tokenEditor, bindTokenEditor } from "./mesa.js";
import { $, $$, esc, toast } from "../core/ui.js";
import { srdNow, monsterToken, findMonster } from "../core/srd.js";

let el = null, openId = null, board = null, sel = null, selProp = null, placing = false, preview3d = false;

export function mount(root) {
  el = document.createElement("div");
  el.className = "escenas";
  root.appendChild(el);
  board = null; sel = null; placing = false;
  draw();
  return {
    update(s, label, remote) { if (label === "field" && !remote) return; if (label === "board" && board && openId && s.scenes.some(x => x.id === openId)) { board.render(); side(); return; } draw(); },
    unmount() { el = null; board = null; }
  };
}

const scene = () => store.get().scenes.find(x => x.id === openId);

function draw() {
  if (!el) return;
  const s = store.get();
  if (!isDM(s)) { el.innerHTML = `<div class="page"><div class="wrap"><h1 class="title">Escenas</h1><p class="lead">Esta sección es solo para el máster.</p></div></div>`; return; }
  if (!scene()) openId = null;
  const groups = [["", "Biblioteca (para improvisar)"], ...s.world.places.map(p => [p.id, p.name])];
  el.innerHTML = `<aside class="scenes-side">
      <h2 class="sec">Escenas</h2>
      ${groups.map(([pid, n]) => { const list = s.scenes.filter(x => (x.place || "") === pid || (!pid && x.place && !s.world.places.some(p => p.id === x.place))); return list.length || !pid ? `<div class="sgroup"><small>${esc(n)}</small>${list.map(x => `<button class="place ${x.id === openId ? "on" : ""}" data-open="${x.id}"><span>${esc(x.name)}</span><small>${x.tokens.length}</small></button>`).join("") || `<p class="empty">Ninguna todavía.</p>`}</div>` : ""; }).join("")}
      <form id="newsc" class="panel" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;padding:12px">
        <h2 class="sec" style="margin:0">Nueva escena</h2>
        <label class="field">Nombre<input id="nsname" required placeholder="Asalto al almacén"></label>
        <label class="field">Lugar<select id="nsplace"><option value="">Biblioteca (sin lugar)</option>${s.world.places.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
        <label class="field">Suelo inicial<select id="nsfill"><option value="gen:dungeon">🎲 Mazmorra generada</option><option value="gen:cave">🕳 Cueva generada</option><option value="vacio">Vacío (para dibujar salas)</option>${Object.entries(TERRAIN).filter(([, v]) => !v.wall).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join("")}</select></label>
        <button class="btn gold small">Crear</button>
      </form>
    </aside>
    <section class="scenes-main">${openId ? `<div class="board-host"></div>` : `<div class="page"><div class="wrap"><h1 class="title">Preparar escenas</h1>
      <p class="lead">Prepara los combates y situaciones tácticas de cada lugar, o deja escenas genéricas en la biblioteca (una pelea de taberna, una emboscada en el camino…) para cargarlas al momento si la partida se tuerce.</p>
      <p class="note">Elige una escena a la izquierda para editarla. Durante la partida se cargan desde el panel del máster, en la pestaña Partida.</p></div></div>`}</section>
    <aside class="scenes-props" ${openId ? "" : "hidden"}></aside>`;
  $$("[data-open]", el).forEach(b => b.onclick = () => { openId = b.dataset.open; sel = null; placing = false; board = null; draw(); });
  $("#newsc", el).onsubmit = e => {
    e.preventDefault();
    const fill = $("#nsfill", el).value, gen = fill.startsWith("gen:");
    const sc = blankScene($("#nsname", el).value.trim() || "Nueva escena", $("#nsplace", el).value || null, gen ? 26 : 16, gen ? 18 : 11, gen ? "vacio" : fill);
    if (gen) { const d = generateDungeon(sc.cols, sc.rows, { cave: fill === "gen:cave" }); sc.terrain = d.terrain; sc.props = d.props; sc.start = d.start; sc.ambient = "interior"; }
    store.commit("board", st => st.scenes.push(sc));
    openId = sc.id; board = null; draw();
  };
  if (openId && preview3d) {
    const host = $(".board-host", el);
    import("./tablero3d.js").then(m => {
      if (!el || !host.isConnected) return;
      board = m.createBoard3D(host, {
        model: () => scene() ? { grid: scene(), tokens: scene().tokens } : null, dm: true, canMove: () => true,
        mutate: (label, fn) => store.commit("board", st => { const x = st.scenes.find(y => y.id === openId); fn({ grid: x, tokens: x.tokens }); }),
        hpOf: t => t.maxhp ? { cur: t.hp, max: t.maxhp } : null, decorate: () => ({}), charOf: () => null,
        onSelect: id => { sel = id; side(); }, setAmbient: k => store.commit("board", st => { st.scenes.find(y => y.id === openId).ambient = k; })
      });
    }).catch(e => { console.warn(e); preview3d = false; draw(); });
    side();
  } else if (openId) {
    board = createBoard($(".board-host", el), {
      model: () => ({ grid: scene(), tokens: scene().tokens }),
      dm: true, edit: true, canMove: () => true,
      mutate: (label, fn) => store.commit("board", st => { const x = st.scenes.find(y => y.id === openId); fn({ grid: x, tokens: x.tokens }); }),
      hpOf: t => t.maxhp ? { cur: t.hp, max: t.maxhp } : null,
      onSelect: id => { sel = id; if (id) selProp = null; side(); },
      onSelectProp: id => { selProp = id; if (id) sel = null; side(); },
      onStart: st => store.commit("board", z => { z.scenes.find(y => y.id === openId).start = st; }),
      onCell: h => { if (placing) { placing = false; store.commit("board", st => { st.scenes.find(y => y.id === openId).start = h; }); } },
      marker: () => scene() && scene().start
    });
    side();
  }
}

function side() {
  const box = $(".scenes-props", el), sc = scene();
  if (!box || !sc) return;
  const s = store.get(), t = sc.tokens.find(x => x.id === sel), pr = selProp && (sc.props || []).find(x => x.id === selProp);
  const ae = document.activeElement; if (ae && box.contains(ae) && ae.closest(".propedit") && /INPUT|TEXTAREA/.test(ae.tagName)) return;
  box.innerHTML = `<div class="panel">
      <label class="field">Nombre<input id="scname" value="${esc(sc.name)}"></label>
      <label class="field" style="margin-top:8px">Lugar<select id="scplace"><option value="">Biblioteca (sin lugar)</option>${s.world.places.map(p => `<option value="${p.id}" ${sc.place === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <div class="tkgrid" style="margin-top:8px"><label class="field">Columnas<input type="number" min="5" max="40" id="sccols" value="${sc.cols}"></label><label class="field">Filas<input type="number" min="5" max="30" id="scrows" value="${sc.rows}"></label></div>
      <div class="row" style="margin-top:10px"><button class="btn small" id="scstart" aria-pressed="${placing}">${placing ? "Toca una casilla…" : "⚑ Punto de inicio del grupo"}</button></div>
      <div class="row" style="margin-top:10px"><button class="btn small" id="sc3d" aria-pressed="${preview3d}">${preview3d ? "✏️ Editar en 2D" : "🎲 Ver en 3D"}</button></div>
      <div class="row" style="margin-top:10px"><button class="btn gold small" id="scload">Cargar en la mesa</button><button class="btn small" id="scdup">Duplicar</button><button class="btn small danger" id="scdel">Eliminar</button></div>
    </div>
    <div class="panel" style="margin-top:12px"><h2 class="sec">Monstruo del compendio</h2>
      <div class="row"><input id="monq" list="monlist" placeholder="Bandido, Esqueleto, Lobo…" style="flex:1;min-width:0"><input type="number" id="monn" value="1" min="1" max="12" style="width:52px" aria-label="Cuántos"><button class="btn small gold" id="monadd">Añadir</button></div>
      <datalist id="monlist">${(srdNow.monstruos || []).map(m => `<option value="${esc(m.n)}">VD ${m.vd}</option>`).join("")}</datalist>
      <p class="note" style="margin:6px 0 0">Aparecen junto al punto de inicio del grupo, con sus PG, CA y ataques del manual.</p></div>
    ${pr ? `<div class="panel" style="margin-top:12px">${propEditorHTML(pr)}</div>` : ""}
    <div class="panel" style="margin-top:12px">${t ? `<h2 class="sec">Ficha seleccionada</h2>${tokenEditor(t)}` : `<p class="empty">Usa «👹 Enemigo» para colocar enemigos y tócalos para editarlos. Con «✋ Mover» los recolocas o seleccionas objetos.</p>`}</div>`;
  if (pr && board && board.editProp) bindPropEditor(box, fn => board.editProp(pr.id, fn), { rot: () => board.editProp(pr.id, p => { p.rot = ((p.rot || 0) + 1) % 4; }), del: () => { const id = pr.id; board.selectProp(null); store.commit("board", st => { const x = st.scenes.find(y => y.id === openId); x.props = (x.props || []).filter(z => z.id !== id); }); } });
  const M = fn => store.commit("board", st => fn(st.scenes.find(y => y.id === openId)));
  $("#scname", box).onchange = e => M(x => { x.name = e.target.value; });
  $("#scplace", box).onchange = e => M(x => { x.place = e.target.value || null; });
  $("#sccols", box).onchange = e => M(x => { x.cols = Math.max(5, Math.min(40, +e.target.value)); });
  $("#scrows", box).onchange = e => M(x => { x.rows = Math.max(5, Math.min(30, +e.target.value)); });
  $("#monadd", box).onclick = () => {
    const m = findMonster($("#monq", box).value); if (!m) { toast("No encuentro ese monstruo en el compendio"); return; }
    const n = Math.max(1, +$("#monn", box).value || 1);
    M(x => { const busy = new Set(x.tokens.map(k => k.c + "," + k.r)); let placed = 0;
      for (let d = 2; d < 14 && placed < n; d++) for (let r = 0; r < x.rows && placed < n; r++) for (let c = x.cols - 1; c >= 0 && placed < n; c--) {
        if (Math.max(Math.abs(c - x.start.c), Math.abs(r - x.start.r)) !== d || busy.has(c + "," + r) || x.terrain[c + "," + r] === "muro") continue;
        busy.add(c + "," + r); const t = monsterToken(m, c, r); if (n > 1) t.name = `${m.n} ${placed + 1}`; x.tokens.push(t); placed++;
      } });
    toast(`${n} × ${m.n} añadidos`);
  };
  $("#sc3d", box).onclick = () => { preview3d = !preview3d; board = null; draw(); };
  $("#scstart", box).onclick = () => { placing = !placing; side(); };
  $("#scload", box).onclick = () => { loadScene(openId); location.hash = "partida"; toast("Escena cargada en la mesa"); };
  $("#scdup", box).onclick = () => { const c = JSON.parse(JSON.stringify(sc)); c.id = "esc-" + Math.random().toString(36).slice(2, 8); c.name += " (copia)"; store.commit("board", st => st.scenes.push(c)); openId = c.id; board = null; draw(); };
  const del = $("#scdel", box);
  del.onclick = () => { if (!del.dataset.sure) { del.dataset.sure = 1; del.textContent = "Pulsa otra vez"; return; } store.commit("board", st => { st.scenes = st.scenes.filter(y => y.id !== openId); }); openId = null; board = null; draw(); };
  bindTokenEditor(box, (id, fn) => M(x => { const k = x.tokens.find(z => z.id === id); if (k) fn(k); }));
}
