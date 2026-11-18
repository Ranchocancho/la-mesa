// Inicio: elegir quién eres y, después, el vestíbulo de la sesión con "Anteriormente en…".
import { store } from "../core/store.js";
import { session, currentUser, isDM } from "../core/session.js";
import { presence } from "../core/presence.js";
import { getImage } from "../core/images.js";
import { exampleMap } from "../data/worldmap.js";
import { $, $$, esc, avatar, toast } from "../core/ui.js";

let el = null;

export function mount(root) {
  el = document.createElement("div");
  el.className = "page";
  root.appendChild(el);
  draw();
  return { update: (s, label, remote) => { if (!(label === "recap" && !remote)) draw(); }, presence: drawParty, unmount() { el = null; } };
}

function draw() {
  if (!el) return;
  const state = store.get();
  const me = currentUser(state);
  if (!me) return drawWho(state);
  const dm = isDM(state);
  const last = state.sessions[state.sessions.length - 1];
  el.innerHTML = `<div class="wrap">
    <h1 class="title">${esc(state.campaign.name)}</h1>
    <p class="lead">Sesión ${state.campaign.session}. ${dm ? "Cuando estéis todos, empieza con el resumen de lo ocurrido." : "Esperando a que el máster empiece la sesión."}</p>
    <div class="lobby">
      <section class="recap" id="recapbg">
        <div class="in">
          <h3>Anteriormente: ${esc(last ? last.title : "")}</h3>
          <p id="recaptext">${esc(last ? last.recap : "Todavía no hay sesiones anteriores.")}</p>
          ${dm ? `<div class="row">
            <button class="btn gold" id="startrecap">Mostrar «Anteriormente en…» a todos</button>
            <a class="btn" href="#mundo">Abrir el mapa del mundo</a>
            <button class="btn" id="editrecap">Editar resumen</button>
          </div>` : `<div class="row"><a class="btn" href="#mundo">Ver el mapa del mundo</a></div>`}
        </div>
      </section>
      <section class="panel">
        <h2 class="sec">El grupo</h2>
        <div class="party" id="party"></div>
        ${dm && store.mode() === "cloud" ? `<h2 class="sec" style="margin-top:20px">Invitar al grupo</h2>
          <p class="note" style="margin:0 0 10px">Envía este enlace a tus jugadores. Entrarán con su cuenta de Google y quedarán dentro de la campaña.</p>
          <div class="row"><input id="invite" readonly class="btn" style="flex:1;min-width:0;text-align:left;font-size:13px" aria-label="Enlace de invitación"><button class="btn gold small" id="copyinv">Copiar enlace</button></div>` : ""}
        ${dm && store.mode() === "local" ? `<p class="note" style="margin-top:16px">Para probar la sincronización, abre esta misma página en otra pestaña y entra como un jugador. Lo que muestres aquí aparecerá allí al momento.</p>
          <div class="row" style="margin-top:12px"><button class="btn small danger" id="reset">Restablecer la campaña de ejemplo</button></div>` : ""}
      </section>
    </div>
  </div>`;
  drawParty();
  const bgURL = state.world.map ? null : exampleMap().url;
  if (bgURL) $("#recapbg").style.backgroundImage = `url('${bgURL}')`;
  else getImage(state.world.map).then(u => { const b = $("#recapbg"); if (b && u) b.style.backgroundImage = `url('${u}')`; });

  const sr = $("#startrecap");
  if (sr) sr.onclick = () => store.commit("present", s => { s.presentation = { type: "recap" }; });
  const er = $("#editrecap");
  if (er) er.onclick = () => {
    const p = $("#recaptext");
    p.outerHTML = `<label class="field" style="margin-bottom:12px"><span class="sr">Resumen de la sesión anterior</span><textarea id="recapedit" rows="5">${esc(last ? last.recap : "")}</textarea></label>`;
    er.textContent = "Guardar resumen";
    er.onclick = () => {
      const v = $("#recapedit").value;
      store.commit("recap", s => { const l = s.sessions[s.sessions.length - 1]; if (l) l.recap = v; });
      toast("Resumen guardado");
      draw();
    };
  };
  const inv = $("#invite");
  if (inv) {
    import("../core/cloud.js").then(m => { inv.value = m.inviteLink(); });
    $("#copyinv").onclick = async () => {
      try { await navigator.clipboard.writeText(inv.value); toast("Enlace copiado"); }
      catch (e) { inv.select(); toast("Selecciona el enlace y cópialo"); }
    };
  }
  const rs = $("#reset");
  if (rs) rs.onclick = () => { if (rs.dataset.sure) { store.reset(); toast("Campaña de ejemplo restablecida"); } else { rs.dataset.sure = "1"; rs.textContent = "Pulsa otra vez para confirmar"; } };
}

function drawParty() {
  const box = el && $("#party", el);
  if (!box) return;
  const state = store.get();
  if (store.mode() === "cloud") return drawPartyCloud(box, state);
  const dmUser = state.users.find(u => u.role === "dm");
  const rows = [`<div class="pc">${avatar(dmUser, 44)}<div><b>${esc(dmUser.name)}</b><span>Máster</span></div>${status(dmUser.id)}</div>`];
  state.characters.forEach(c => {
    const owner = state.users.find(u => u.id === c.owner);
    rows.push(`<div class="pc">${avatar(c, 44)}<div><b>${esc(c.name)}</b><span>${esc(c.species)} · ${esc(c.cls)} ${c.level} · ${esc(owner ? owner.name : "")}</span></div>${status(c.owner)}</div>`);
  });
  box.innerHTML = rows.join("");
}
function drawPartyCloud(box, state) {
  const dm = isDM(state);
  const players = state.users.filter(u => u.role !== "dm");
  const rows = state.users.map(u => {
    const ch = state.characters.find(c => c.owner === u.id);
    return `<div class="pc">${avatar(u, 44)}<div><b>${esc(u.name)}</b><span>${u.role === "dm" ? "Máster" : ch ? `${esc(ch.name)} · ${esc(ch.cls)} ${ch.level}` : "Sin personaje asignado"}</span></div>${status(u.id)}</div>`;
  });
  let assign = "";
  if (dm && state.characters.length) {
    assign = `<h2 class="sec" style="margin-top:18px">Personajes</h2>
      <p class="note" style="margin:0 0 8px">Asigna cada personaje a su jugador. La ficha completa llega en el hito 2.</p>
      ${state.characters.map(c => `<label class="pc" style="grid-template-columns:44px 1fr minmax(120px,auto)">${avatar(c, 44)}<div><b>${esc(c.name)}</b><span>${esc(c.cls)} ${c.level}</span></div>
        <select class="btn small" data-char="${c.id}" aria-label="Jugador de ${esc(c.name)}"><option value="">Sin jugador</option>${players.map(p => `<option value="${p.id}" ${c.owner === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`).join("")}`;
  }
  box.innerHTML = rows.join("") + (players.length ? "" : `<p class="empty">Aún no se ha unido ningún jugador. Mándales el enlace de invitación.</p>`) + assign;
  $$("[data-char]", box).forEach(sel => sel.onchange = () => store.commit("place", s => {
    const c = s.characters.find(x => x.id === sel.dataset.char); c.owner = sel.value || null;
    s.users.forEach(u => { if (u.character === c.id) delete u.character; });
    const u = s.users.find(x => x.id === sel.value); if (u) u.character = c.id;
  }));
}

const status = id => presence.online(id) ? `<span class="on">● conectado</span>` : `<span class="off">○ fuera</span>`;

function drawWho(state) {
  el.innerHTML = `<div class="wrap">
    <h1 class="title">¿Quién eres?</h1>
    <p class="lead">Elige con quién entras en esta pestaña. El máster ve y controla todo; cada jugador ve lo que el máster le revela.</p>
    <div class="who">
      ${state.users.map(u => {
        const c = state.characters.find(x => x.owner === u.id);
        return `<button class="whoc ${u.role === "dm" ? "dmc" : ""}" data-id="${u.id}">${avatar(c || u)}<b>${esc(c ? c.name : u.name)}</b><span>${u.role === "dm" ? "Máster de la partida" : `${esc(u.name)} · ${esc(c.cls)} ${c.level}`}</span></button>`;
      }).join("")}
    </div>
    <p class="note">En la versión real cada uno entrará con su cuenta de Google y no habrá que elegir. De momento sirve para probar la app desde varias pestañas del mismo navegador.</p>
  </div>`;
  $$(".whoc", el).forEach(b => b.onclick = () => {
    session.set(b.dataset.id);
    window.dispatchEvent(new Event("lamesa:login"));
  });
}
