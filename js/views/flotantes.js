// Texto flotante sobre las figuras (como en los videojuegos de rol): daño, curación, fallos, críticos,
// salvaciones y estados. Se lee de un vistazo sin mirar el registro.
let layer = null;
function ensure() {
  if (layer && layer.isConnected) return layer;
  layer = document.createElement("div"); layer.className = "floaters"; document.body.appendChild(layer); return layer;
}
/** Muestra un texto en (x, y) de la pantalla. kind: dmg | heal | miss | crit | hit | save | fail | cond | down | info */
export function floatAt(x, y, text, kind = "info", { delay = 0, color = null, big = false } = {}) {
  setTimeout(() => {
    const l = ensure(), f = document.createElement("div");
    f.className = `floater ${kind}${big ? " big" : ""}`; f.textContent = text;
    f.style.left = x + "px"; f.style.top = y + "px"; if (color) f.style.setProperty("--fc", color);
    // Si hay varios a la vez sobre la misma figura, que no se pisen
    const near = [...l.children].filter(o => Math.abs(parseFloat(o.style.left) - x) < 40 && Math.abs(parseFloat(o.style.top) - y) < 30).length;
    f.style.marginTop = -near * 22 + "px";
    l.appendChild(f); setTimeout(() => f.remove(), 2400);
  }, delay);
}
