// Preparar escenas tácticas (solo administrador y másteres).
// Cada escena va asociada a un lugar del mundo o a la biblioteca, para improvisar.
import { store } from "../core/store.js";
import { isDM } from "../core/session.js";
import { blankScene } from "../data/escenas.js";
import { loadScene } from "../core/mesa.js";
import { createBoard, TERRAIN } from "./tablero.js";
import { tokenEditor, bindTokenEditor } from "./mesa.js";
import { $, $$, esc, toast } from "../core/ui.js";

let el = null, openId = null, board = null, sel = null, placing = false, preview3d = false;

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
        <label class="field">Suelo inicial<select id="nsfill">${Object.entries(TERRAIN).filter(([, v]) => !v.wall).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join("")}</select></label>
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
    const sc = blankScene($("#nsname", el).value.trim() || "Nueva escena", $("#nsplace", el).value || null, 16, 11, $("#nsfill", el).value);
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
      onSelect: id => { sel = id; side(); },
      onCell: h => { if (placing) { placing = false; store.commit("board", st => { st.scenes.find(y => y.id === openId).start = h; }); } },
      marker: () => scene() && scene().start
    });
    side();
  }
}

function side() {
  const box = $(".scenes-props", el), sc = scene();
  if (!box || !sc) return;
  const s = store.get(), t = sc.tokens.find(x => x.id === sel);
  box.innerHTML = `<div class="panel">
      <label class="field">Nombre<input id="scname" value="${esc(sc.name)}"></label>
      <label class="field" style="margin-top:8px">Lugar<select id="scplace"><option value="">Biblioteca (sin lugar)</option>${s.world.places.map(p => `<option value="${p.id}" ${sc.place === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <div class="tkgrid" style="margin-top:8px"><label class="field">Columnas<input type="number" min="5" max="40" id="sccols" value="${sc.cols}"></label><label class="field">Filas<input type="number" min="5" max="30" id="scrows" value="${sc.rows}"></label></div>
      <div class="row" style="margin-top:10px"><button class="btn small" id="scstart" aria-pressed="${placing}">${placing ? "Toca una casilla…" : "⚑ Punto de inicio del grupo"}</button></div>
      <div class="row" style="margin-top:10px"><button class="btn small" id="sc3d" aria-pressed="${preview3d}">${preview3d ? "✏️ Editar en 2D" : "🎲 Ver en 3D"}</button></div>
      <div class="row" style="margin-top:10px"><button class="btn gold small" id="scload">Cargar en la mesa</button><button class="btn small" id="scdup">Duplicar</button><button class="btn small danger" id="scdel">Eliminar</button></div>
    </div>
    <div class="panel" style="margin-top:12px">${t ? `<h2 class="sec">Ficha seleccionada</h2>${tokenEditor(t)}` : `<p class="empty">Usa «👹 Enemigo» para colocar enemigos y tócalos para editarlos. Con «✋ Mover» los recolocas.</p>`}</div>`;
  const M = fn => store.commit("board", st => fn(st.scenes.find(y => y.id === openId)));
  $("#scname", box).onchange = e => M(x => { x.name = e.target.value; });
  $("#scplace", box).onchange = e => M(x => { x.place = e.target.value || null; });
  $("#sccols", box).onchange = e => M(x => { x.cols = Math.max(5, Math.min(40, +e.target.value)); });
  $("#scrows", box).onchange = e => M(x => { x.rows = Math.max(5, Math.min(30, +e.target.value)); });
  $("#sc3d", box).onclick = () => { preview3d = !preview3d; board = null; draw(); };
  $("#scstart", box).onclick = () => { placing = !placing; side(); };
  $("#scload", box).onclick = () => { loadScene(openId); location.hash = "partida"; toast("Escena cargada en la mesa"); };
  $("#scdup", box).onclick = () => { const c = JSON.parse(JSON.stringify(sc)); c.id = "esc-" + Math.random().toString(36).slice(2, 8); c.name += " (copia)"; store.commit("board", st => st.scenes.push(c)); openId = c.id; board = null; draw(); };
  const del = $("#scdel", box);
  del.onclick = () => { if (!del.dataset.sure) { del.dataset.sure = 1; del.textContent = "Pulsa otra vez"; return; } store.commit("board", st => { st.scenes = st.scenes.filter(y => y.id !== openId); }); openId = null; board = null; draw(); };
  bindTokenEditor(box, (id, fn) => M(x => { const k = x.tokens.find(z => z.id === id); if (k) fn(k); }));
}
