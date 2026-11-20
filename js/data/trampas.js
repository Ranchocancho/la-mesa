// Las 8 trampas de ejemplo del SRD 5.2.1 en español (CC BY 4.0, «Trampas», p. 218-220), con sus números por
// rango de niveles del grupo: [1–4, 5–10, 11–16, 17–20]. save: característica de la salvación (null = no hay);
// dmg: daño por rango (null = sin daño); half: mitad si la supera; cond: estado si falla; detect / disarm: cómo se
// encuentra y se desarma (texto del SRD resumido); after: lo que deja en la casilla.
export const TRAPS = {
  aguja: { n: "Aguja envenenada", sev: "Moderada (niveles 1–4)", trig: "Abrir la cerradura sin la llave correcta o fallar al desarmarla",
    save: "con", dc: [11, 13, 15, 17], dmg: ["1d10", "2d10", "4d10", "10d10"], type: "veneno", half: true, cond: "envenenado", condTxt: "envenenado durante 1 hora",
    detect: "Buscar: Sabiduría (Percepción) CD 15 al examinar la cerradura", disarm: "Una acción: Destreza (Juego de manos) CD 15; si falla, la activa. Un conjuro abrir la evita" },
  dardos: { n: "Dardos envenenados", sev: "Mortal (niveles 1–4)", trig: "Pisar una placa de presión (por primera vez en un turno; se reinicia hasta 3 veces)",
    save: "des", dc: [13, 13, 13, 13], darts: ["1d6", "2d6", "4d6", "7d6"], type: "veneno", half: false,
    detect: "Buscar: Sabiduría (Percepción) CD 15 en las paredes (orificios) o en el suelo (placa)", disarm: "Taponar los orificios con cera o tela, o calzar la placa con una punta de hierro" },
  estatua: { n: "Estatua que escupe fuego", sev: "Mortal (niveles 1–4)", trig: "Pisar la placa de presión por primera vez en un turno o empezar el turno en ella",
    save: "des", dc: [15, 15, 15, 15], dmg: ["2d10", "4d10", "10d10", "18d10"], type: "fuego", half: true, area: ["cono de 4,5 m", "cono de 9 m", "cono de 18 m", "cono de 36 m"],
    detect: "Detectar magia: aura de evocación. Buscar a 1,5 m: Sabiduría (Percepción) CD 10 encuentra el glifo; estudiar: Inteligencia (Conocimiento arcano) CD 15", disarm: "Una acción rayando el glifo con algo afilado, o calzar la placa (Percepción CD 15 para verla)" },
  pozopinchos: { n: "Pozo con pinchos", sev: "Mortal (niveles 1–4)", trig: "Pisar la tapa del pozo (queda abierta)",
    save: null, dmg: ["1d6+2d8", "3d6+3d8", "6d6+8d8", "12d6+13d8"], type: "contundente y perforante", depth: [3, 9, 18, 36],
    detect: "Estudiar: Inteligencia (Investigación) CD 15 en el suelo", disarm: "Calzar la tapa con una punta de hierro o cerrarla con cerradura arcana. Para salir hace falta trepar" },
  pozo: { n: "Pozo escondido", sev: "Moderada (niveles 1–4)", trig: "Pisar la tapa del pozo (queda abierta)",
    save: null, dmg: ["1d6", "3d6", "6d6", "12d6"], type: "contundente", depth: [3, 9, 18, 36],
    detect: "Estudiar: Inteligencia (Investigación) CD 15 en el suelo", disarm: "Calzar la tapa con una punta de hierro o cerrarla con cerradura arcana. Para salir hace falta trepar" },
  red: { n: "Red que cae", sev: "Moderada (niveles 1–4)", trig: "La primera criatura que cruce el cable trampa",
    save: "des", dc: [10, 12, 14, 16], dmg: null, cond: "apresado", condTxt: "apresado hasta que escape (acción: Fuerza (Atletismo) con la misma CD)", hugeOk: true,
    detect: "Buscar: Sabiduría (Percepción) CD 11 encuentra el cable y la red", disarm: "Una vez visto, el cable se corta o se esquiva sin prueba" },
  roca: { n: "Roca rodante", sev: "Mortal (niveles 11–16) o moderada (17–20)", trig: "Pisar una placa de presión oculta",
    save: "des", dc: [15, 15, 15, 15], dmg: ["10d10", "10d10", "10d10", "10d10"], type: "contundente", half: false, cond: "derribado", condTxt: "derribado",
    note: "La roca tira iniciativa (+8) y rueda 18 m por turno en línea recta; golpea a quien entre en su espacio. CA 17, 100 PG, umbral de daño 10. Frenarla: acción, Fuerza (Atletismo) CD 20 (−4,5 m).",
    detect: "Estudiar: Inteligencia (Investigación) CD 15 en la placa", disarm: "Calzar la placa con una punta de hierro" },
  techo: { n: "Techo que se hunde", sev: "Mortal (niveles 1–4)", trig: "La primera criatura que cruce el cable trampa",
    save: "des", dc: [13, 15, 17, 19], dmg: ["2d10", "4d10", "10d10", "18d10"], type: "contundente", half: true, after: "escombros",
    detect: "Buscar: Sabiduría (Percepción) CD 11 encuentra el cable y el techo inestable", disarm: "Una vez visto, el cable se corta o se esquiva sin prueba" }
};
/** Rango de niveles del SRD para un nivel de grupo: 0 = 1–4, 1 = 5–10, 2 = 11–16, 3 = 17–20. */
export const tierOf = lvl => lvl >= 17 ? 3 : lvl >= 11 ? 2 : lvl >= 5 ? 1 : 0;
export const TIER_TXT = ["niveles 1–4", "niveles 5–10", "niveles 11–16", "niveles 17–20"];
