// Utilidades pequeñas de interfaz.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.style.display = "none"), 2600);
}

export function avatar(u, size) {
  const s = size ? `width:${size}px;height:${size}px;` : "";
  if (u.photo) return `<span class="av" style="${s}background:#2a1f15 url('${esc(u.photo)}') center/cover" role="img" aria-label="${esc(u.name || "")}"></span>`;
  return `<span class="av" style="${s}background:radial-gradient(circle at 35% 30%, ${u.color || "#888"}, #2a1f15 130%)">${esc(u.initials || "?")}</span>`;
}

export function debounce(fn, ms = 350) {
  let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

/** Abre el selector de archivos y devuelve el archivo elegido. */
export function pickFile(accept = "image/*") {
  return new Promise(res => {
    const i = document.createElement("input");
    i.type = "file"; i.accept = accept;
    i.onchange = () => res(i.files[0] || null);
    i.click();
  });
}
