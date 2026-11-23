// Estados (condiciones) de las reglas de 2024, resumidos. Basado en el SRD 5.2.1 (CC BY 4.0, ver CREDITS.md).
// Cada estado tiene un color de anillo, como los anillos de estado que se ponen en la peana de las miniaturas.
export const ESTADOS = [
  { id: "agarrado", i: "✊", n: "Agarrado", c: "#c98a3d", t: "Velocidad 0. Desventaja al atacar a cualquiera que no sea quien te agarra. Quien te agarra puede arrastrarte." },
  { id: "apresado", i: "⛓", n: "Apresado", c: "#8a5a2b", t: "Velocidad 0. Los ataques contra ti tienen ventaja; los tuyos, desventaja. Desventaja en salvaciones de Destreza." },
  { id: "asustado", i: "😱", n: "Asustado", c: "#7b4fb0", t: "Desventaja en pruebas y ataques mientras veas la fuente del miedo. No puedes acercarte a ella voluntariamente." },
  { id: "aturdido", i: "💫", n: "Aturdido", c: "#e0c23a", t: "Incapacitado. Fallas automáticamente las salvaciones de Fuerza y Destreza. Los ataques contra ti tienen ventaja." },
  { id: "cegado", i: "🙈", n: "Cegado", c: "#4a4a4a", t: "No ves: fallas pruebas que requieran vista. Tus ataques tienen desventaja; los ataques contra ti, ventaja." },
  { id: "derribado", i: "⤵", n: "Derribado", c: "#9a7a52", t: "Solo puedes arrastrarte o levantarte (mitad de tu movimiento). Desventaja al atacar. Ataques contra ti: ventaja a 1,5 m, desventaja más lejos." },
  { id: "ensordecido", i: "🔇", n: "Ensordecido", c: "#6f8a8a", t: "No oyes: fallas pruebas que requieran oído." },
  { id: "envenenado", i: "☠", n: "Envenenado", c: "#5e9a32", t: "Desventaja en tiradas de ataque y pruebas de característica." },
  { id: "hechizado", i: "💗", n: "Hechizado", c: "#d65a9a", t: "No puedes atacar a quien te hechiza ni dañarle. Tiene ventaja en sus pruebas sociales contigo." },
  { id: "incapacitado", i: "⛔", n: "Incapacitado", c: "#a65a3a", t: "No puedes realizar acciones, acciones adicionales ni reacciones. Se rompe la concentración. Desventaja en iniciativa." },
  { id: "inconsciente", i: "💤", n: "Inconsciente", c: "#2a2a5a", t: "Incapacitado y derribado; sueltas lo que llevas. Fallas salvaciones de Fuerza y Destreza. Ataques contra ti con ventaja; crítico a 1,5 m." },
  { id: "invisible", i: "👻", n: "Invisible", c: "#bfe4ff", t: "Ventaja en iniciativa. No te ven sin magia o sentidos especiales. Tus ataques con ventaja; los ataques contra ti, con desventaja." },
  { id: "paralizado", i: "🧊", n: "Paralizado", c: "#3a8ad6", t: "Incapacitado y velocidad 0. Fallas salvaciones de Fuerza y Destreza. Ataques contra ti con ventaja; crítico a 1,5 m." },
  { id: "petrificado", i: "🗿", n: "Petrificado", c: "#8c8c8c", t: "Convertido en piedra: incapacitado, velocidad 0, resistencia a todo el daño, inmune a veneno. Ataques contra ti con ventaja." },
  { id: "agotamiento", i: "🥵", n: "Cansancio", c: "#b33a2e", t: "Por cada nivel: −2 a las pruebas con d20 y −1,5 m de velocidad. A nivel 6 mueres. Un descanso largo quita un nivel.", levels: 6 },
  { id: "ardiendo", i: "🔥", n: "Ardiendo", c: "#e0662a", t: "SRD «Fuego»: 1d4 de daño de fuego al principio de cada uno de sus turnos. Con una acción se apaga rodando por el suelo (queda derribado)." },
  { id: "esquivando", i: "🤸", n: "Esquivando", c: "#e8e2d0", t: "Acción de Esquivar: los ataques contra ti tienen desventaja y tienes ventaja en las salvaciones de Destreza, hasta el principio de tu siguiente turno." },
  { id: "destrabado", i: "💨", n: "Destrabado", c: "#a0d0c0", t: "Acción de Destrabarse: tu movimiento no provoca ataques de oportunidad durante el resto del turno." },
  { id: "concentracion", i: "🔮", n: "Concentración", c: "#d6aa4e", t: "Mantiene un conjuro. Al recibir daño, salvación de Constitución (CD 10 o la mitad del daño, la mayor) o se pierde." },
  { id: "bendecido", i: "🙏", n: "Bendecido", c: "#f2d36b", t: "Bendición: suma 1d4 a sus tiradas de ataque y de salvación mientras dure." },
  { id: "perdicion", i: "🕸", n: "Perdición", c: "#5a2a6a", t: "Perdición: resta 1d4 a sus tiradas de ataque y de salvación mientras dure." },
  { id: "debilitado", i: "🥀", n: "Debilitado (maestría)", c: "#b08a6a", t: "Debilitar: desventaja en su próxima tirada de ataque antes del principio del siguiente turno de quien le acertó." },
  { id: "ralentizado", i: "🐌", n: "Ralentizado (maestría)", c: "#6a8ab0", t: "Ralentizar: su velocidad baja 3 m hasta el principio del siguiente turno de quien le acertó (no se acumula)." },
  { id: "molestar", i: "🎯", n: "Molestar (maestría)", c: "#c9a14a", t: "Molestar: ventaja en su siguiente tirada de ataque contra la criatura a la que dañó, antes del final de su siguiente turno." },
  { id: "escudo", i: "🛡", n: "Escudo", c: "#7fb6e8", t: "Conjuro Escudo (reacción): +5 a la CA, también contra el ataque que lo provocó, hasta el principio de su siguiente turno." },
  { id: "furia", i: "😡", n: "Furia", c: "#c0392b", t: "Furia (bárbaro, SRD 2024): resistencia al daño contundente, cortante y perforante; suma su daño de furia a los ataques que usan Fuerza; ventaja en pruebas y salvaciones de Fuerza; no puede lanzar conjuros ni concentrarse. Dura hasta el final de su siguiente turno y se prolonga si ataca a un enemigo, le obliga a una salvación o gasta una acción adicional (hasta 10 minutos). Termina si queda incapacitado." },
  { id: "insp_bardica", i: "🎵", n: "Inspiración bárdica", c: "#d98cd0", t: "Tiene un dado de Inspiración bárdica: una vez en la siguiente hora, cuando falle una prueba con d20 (ataque, salvación o prueba de característica), puede tirarlo y sumarlo, lo que puede convertir el fallo en éxito." },
  { id: "muerto", i: "💀", n: "Muerto", c: "#111111", t: "Ha fallado tres salvaciones contra muerte (o recibió daño masivo). Solo la magia puede devolverlo." }
];
export const estado = id => ESTADOS.find(e => e.id === id);
/** Icono del estado (como los de BG3 sobre la vida de cada criatura). */
export const icono = id => (ESTADOS.find(e => e.id === id) || {}).i || "•";
/** Texto corto para la etiqueta: "Aturdido", "Agotamiento 2"… */
export const etiqueta = (id, lvl) => { const e = estado(id); return e ? e.n + (e.levels && lvl ? " " + lvl : "") : id; };
