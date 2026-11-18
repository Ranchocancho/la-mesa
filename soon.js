// Secciones que llegan en hitos siguientes.
const INFO = {
  lore: { t: "Lore y panel del máster", items: ["Biblioteca de lugares, PNJ, facciones y objetos", "PNJ itinerantes que el máster mueve entre regiones", "Notas por ramas y panel de apoyo durante la partida"] },
};

export function mount(root, ctx) {
  const i = INFO[ctx.route.id];
  const el = document.createElement("div");
  el.className = "page soonpage";
  el.innerHTML = `<div class="panel"><h2 class="sec">Llega en el hito ${ctx.route.soon}</h2>
    <h1 class="title" style="font-size:26px">${i.t}</h1>
    <ul>${i.items.map(x => `<li>${x}</li>`).join("")}</ul>
    ${i.link ? `<p class="note">Mientras tanto, el prototipo de la mesa sigue disponible: <a href="https://claude.ai/artifact/W9yxnzrmLT2tZyARLbeUQ9" style="color:var(--oro)">La Mesa – prototipo</a>.</p>` : ""}
  </div>`;
  root.appendChild(el);
  return {};
}
