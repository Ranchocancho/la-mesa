// Efectos de conjuro disponibles en la mesa (los dibuja views/efectos3d.js). area/line en casillas de 5 pies.
export const EFECTOS = {
  bola: { n: "Bola de fuego", area: 4, hint: "radio de 20 pies" },
  proyectil: { n: "Proyectil mágico" },
  rayo: { n: "Relámpago", line: 20, hint: "línea de 100 pies" },
  escarcha: { n: "Rayo de escarcha" },
  llama: { n: "Llama sagrada" },
  curar: { n: "Curar heridas" },
  escudo: { n: "Escudo", self: true },
  trueno: { n: "Onda atronadora", area: 1, cube: true, hint: "cubo de 15 pies" }
};
