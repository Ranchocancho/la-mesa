// Entrada en modo nube: iniciar sesión con Google, elegir, crear o unirse a un mundo.
import { cloud, signIn, signOut, openCampaign, joinCampaign, createCampaign } from "../core/cloud.js";
import { $, $$, esc } from "../core/ui.js";

export function renderAccess(root) {
  const u = cloud.user;
  let body = "";
  if (cloud.status === "init" || cloud.status === "loading") {
    body = `<p class="lead">${cloud.status === "init" ? "Conectando…" : "Abriendo el mundo…"}</p>`;
  } else if (!u) {
    body = `<h1 class="title">Bienvenido a la mesa</h1>
      <p class="lead">Entra con tu cuenta de Google para unirte a tu grupo. Quien crea el mundo os pasa un enlace para uniros.</p>
      <div class="row"><button class="btn gold" id="signin">Entrar con Google</button></div>
      <p class="note">¿Solo quieres echar un vistazo? <a href="?demo" style="color:var(--oro)">Abrir el modo demostración</a>, que funciona sin cuenta en este navegador.</p>`;
  } else if (cloud.status === "joining") {
    body = `<h1 class="title">${esc(cloud.joinable.name)}</h1>
      <p class="lead">Te han invitado a este mundo. Entrarás como jugador con tu cuenta ${esc(u.email || "")}.</p>
      <div class="row"><button class="btn gold" id="join">Unirme</button><button class="btn" id="tolobby">Ahora no</button></div>`;
  } else {
    body = `<h1 class="title">Hola, ${esc((u.displayName || "").split(" ")[0] || "aventurero")}</h1>
      <p class="lead">Entra en tu mundo. Si vas a organizar uno nuevo, créalo aquí: serás su administrador y podrás nombrar másteres.</p>
      <div class="lobby">
        <section class="panel"><h2 class="sec">Tus mundos</h2>
          <div class="places">${cloud.campaigns.map(c => `<button class="place" data-cid="${c.id}"><span>${esc(c.name)}</span><small>${{ admin: "Administrador", dm: "Máster", player: "Jugador" }[c.role] || "Jugador"}${c.live ? " · partida en curso" : ""}</small></button>`).join("") || `<p class="empty">Todavía no estás en ningún mundo. Si eres jugador, pide el enlace de invitación.</p>`}</div>
        </section>
        <section class="panel"><h2 class="sec">Crear un mundo</h2>
          <form id="newc" style="display:flex;flex-direction:column;gap:12px">
            <label class="field">Nombre del mundo<input id="cname" required placeholder="Tierras de Vel Arath"></label>
            <label class="switch"><input type="checkbox" id="cex" checked> Empezar con contenido de ejemplo (lugares, personajes y una sesión anterior)</label>
            <div class="row"><button class="btn gold">Crear mundo</button></div>
          </form>
        </section>
      </div>
      <p class="note">Has entrado como ${esc(u.email || "")}. <button class="btn small" id="signout">Salir</button></p>`;
  }
  root.innerHTML = `<header class="top"><div class="brand"><b>La Mesa</b><span>D&amp;D a distancia</span></div></header>
    <main><div class="page"><div class="wrap">
      ${cloud.error ? `<p class="note" style="border-color:var(--sangre);color:#e9a196;margin:0 0 16px">${esc(cloud.error)}</p>` : ""}
      ${body}
    </div></div></main>`;
  const on = (id, fn) => { const b = $("#" + id, root); if (b) b.onclick = fn; };
  on("signin", signIn);
  on("signout", signOut);
  on("join", joinCampaign);
  on("tolobby", () => { history.replaceState(null, "", location.pathname); location.reload(); });
  $$("[data-cid]", root).forEach(b => b.onclick = () => openCampaign(b.dataset.cid));
  const f = $("#newc", root);
  if (f) f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Creando…";
    try { await createCampaign($("#cname", root).value.trim(), $("#cex", root).checked); }
    catch (err) { console.error(err); cloud.error = "No se pudo crear el mundo."; btn.disabled = false; btn.textContent = "Crear mundo"; renderAccess(root); }
  };
}
