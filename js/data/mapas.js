// Catálogo del editor de mapas: terrenos (con sus reglas), muros y objetos por categorías.
// Reglas 2024: el terreno difícil cuesta 1,5 m extra por casilla; los muros bloquean paso y visión;
// el mobiliario grande da media cobertura, y lo macizo, tres cuartos.

/** Terrenos. f: color base (2D y respaldo); wall: muro (bloquea paso y vista); void: fuera del mapa;
 *  dif: terreno difícil; hz: peligro (texto para el máster); liquid: se anima; glow: emite luz. */
export const TERRAIN = {
  // Suelos de interior
  piedra:   { n: "Losas de piedra", f: "#6a655d", cat: "interior" },
  adoquin:  { n: "Adoquines", f: "#5d5a55", cat: "interior" },
  marmol:   { n: "Mármol", f: "#bfb8ad", cat: "interior" },
  madera:   { n: "Tablones", f: "#6b4a2e", cat: "interior" },
  alfombra: { n: "Alfombra", f: "#7a2630", cat: "interior" },
  cueva:    { n: "Suelo de cueva", f: "#4a443d", cat: "interior" },
  escombros:{ n: "Escombros", f: "#5a534a", cat: "interior", dif: true },
  // Exterior
  hierba:   { n: "Hierba", f: "#4d6a33", cat: "exterior" },
  hierbalta:{ n: "Maleza", f: "#3e5a2a", cat: "exterior", dif: true },
  tierra:   { n: "Tierra", f: "#6e5a3f", cat: "exterior" },
  camino:   { n: "Camino", f: "#8a7556", cat: "exterior" },
  arena:    { n: "Arena", f: "#b49a64", cat: "exterior" },
  barro:    { n: "Barro", f: "#4a3b2a", cat: "exterior", dif: true },
  nieve:    { n: "Nieve", f: "#dfe6ec", cat: "exterior", dif: true },
  hielo:    { n: "Hielo", f: "#a9cfe0", cat: "exterior", dif: true, hz: "Resbaladizo: al entrar, salvación de Destreza CD 10 o caer derribado." },
  // Agua y peligros
  agua:     { n: "Agua poco profunda", f: "#2e6a84", cat: "peligro", dif: true, liquid: true },
  aguaprof: { n: "Agua profunda", f: "#1d4560", cat: "peligro", dif: true, liquid: true, hz: "Hay que nadar (cada casilla cuesta el doble sin velocidad nadando)." },
  lava:     { n: "Lava", f: "#d8541c", cat: "peligro", liquid: true, glow: true, hz: "Quien entra o empieza su turno en ella recibe daño de fuego (el máster decide cuánto)." },
  abismo:   { n: "Abismo", f: "#0b0a09", cat: "peligro", hz: "Caída: 1d6 de daño contundente por cada 3 m." },
  // Muros
  muro:     { n: "Muro de piedra", f: "#2a2521", wall: true, cat: "muro" },
  muroladrillo: { n: "Muro de ladrillo", f: "#5a2f24", wall: true, cat: "muro" },
  muromadera:   { n: "Pared de madera", f: "#4a3220", wall: true, cat: "muro" },
  muroroca: { n: "Roca de cueva", f: "#3a3530", wall: true, cat: "muro" },
  seto:     { n: "Seto / maleza densa", f: "#2e4a22", wall: true, cat: "muro" },
  vacio:    { n: "Vacío (fuera del mapa)", f: "#0a0908", wall: true, void: true, cat: "muro" }
};
export const TERRAIN_CATS = { interior: "Interior", exterior: "Exterior", peligro: "Agua y peligros", muro: "Muros" };

/** Objetos. i: icono 2D; cat; block: no se puede pasar; cover: "half" | "3q" (cobertura que da);
 *  hidden: nace oculto a los jugadores; door: puerta; wall: va colgado de la pared;
 *  loot / trap: tiene contenido o efecto que el máster rellena. */
export const PROPS = {
  // Mobiliario
  mesa:       { n: "Mesa", i: "🪵", cat: "mueble", cover: "half" },
  mesalarga:  { n: "Mesa larga", i: "🍽️", cat: "mueble", cover: "half" },
  silla:      { n: "Silla", i: "🪑", cat: "mueble" },
  cama:       { n: "Cama", i: "🛏️", cat: "mueble", cover: "half" },
  estanteria: { n: "Estantería", i: "📚", cat: "mueble", cover: "3q", block: true },
  barril:     { n: "Barril", i: "🛢️", cat: "mueble", cover: "half" },
  tonel:      { n: "Tonel", i: "🍺", cat: "mueble", cover: "half" },
  caja:       { n: "Cajas", i: "📦", cat: "mueble", cover: "half" },
  baul:       { n: "Baúl", i: "🧳", cat: "mueble", cover: "half" },
  // Luz
  antorcha:   { n: "Antorcha (en pared)", i: "🪔", cat: "luz", wall: true },
  velas:      { n: "Velas", i: "🕯️", cat: "luz" },
  hoguera:    { n: "Hoguera", i: "🔥", cat: "luz" },
  brasero:    { n: "Brasero", i: "🏮", cat: "luz", cover: "half" },
  // Mazmorra
  columna:    { n: "Columna", i: "🏛️", cat: "mazmorra", block: true, cover: "3q" },
  escaleras:  { n: "Escaleras", i: "🪜", cat: "mazmorra" },
  calavera:   { n: "Huesos y escombros", i: "💀", cat: "mazmorra" },
  estandarte: { n: "Estandarte (en pared)", i: "🚩", cat: "mazmorra", wall: true },
  estatua:    { n: "Estatua", i: "🗿", cat: "mazmorra", block: true, cover: "3q" },
  altar:      { n: "Altar", i: "⛩️", cat: "mazmorra", cover: "half" },
  sarcofago:  { n: "Sarcófago", i: "⚰️", cat: "mazmorra", cover: "half", loot: true },
  pozo:       { n: "Pozo", i: "🕳️", cat: "mazmorra", block: true },
  telarana:   { n: "Telarañas", i: "🕸️", cat: "mazmorra" },
  // Naturaleza
  arbol:      { n: "Árbol", i: "🌲", cat: "natural", cover: "half" },
  arbolmuerto:{ n: "Árbol muerto", i: "🌳", cat: "natural", cover: "half" },
  arbusto:    { n: "Arbusto", i: "🌿", cat: "natural" },
  roca:       { n: "Roca", i: "🪨", cat: "natural", cover: "half" },
  penasco:    { n: "Peñasco", i: "⛰️", cat: "natural", block: true, cover: "3q" },
  tocon:      { n: "Tocón", i: "🪵", cat: "natural" },
  setas:      { n: "Setas gigantes", i: "🍄", cat: "natural" },
  cristales:  { n: "Cristales", i: "💎", cat: "natural" },
  // Puertas
  puerta:     { n: "Puerta", i: "🚪", cat: "puerta", door: true },
  puertallave:{ n: "Puerta cerrada con llave", i: "🔒", cat: "puerta", door: true, lock: true },
  puertasecreta: { n: "Puerta secreta", i: "🧱", cat: "puerta", door: true, hidden: true },
  rastrillo:  { n: "Rastrillo (reja)", i: "⛓️", cat: "puerta", door: true, seeThrough: true },
  // Peligros
  trampa:     { n: "Trampa visible", i: "⚠️", cat: "peligro", trap: true },
  trampaoculta: { n: "Trampa oculta", i: "🪤", cat: "peligro", trap: true, hidden: true },
  pinchos:    { n: "Pinchos", i: "🔺", cat: "peligro", trap: true },
  foso:       { n: "Foso", i: "⬛", cat: "peligro", trap: true },
  // Tesoro
  cofre:      { n: "Cofre", i: "🧰", cat: "tesoro", loot: true, cover: "half" },
  oro:        { n: "Montón de oro", i: "💰", cat: "tesoro", loot: true },
  pocion:     { n: "Poción", i: "🧪", cat: "tesoro", loot: true },
  pergamino:  { n: "Pergamino", i: "📜", cat: "tesoro", loot: true },
  objeto:     { n: "Objeto mágico", i: "✨", cat: "tesoro", loot: true },
  // Marcadores del máster
  nota:       { n: "Nota del máster", i: "📌", cat: "marca", hidden: true },
  interes:    { n: "Punto de interés", i: "⭐", cat: "marca" }
};
export const PROP_CATS = { mueble: "Mobiliario", luz: "Luz", mazmorra: "Mazmorra", natural: "Naturaleza", puerta: "Puertas", peligro: "Trampas", tesoro: "Tesoro", marca: "Marcas" };

export const isDoor = p => !!(p && PROPS[p.k] && PROPS[p.k].door);
/** Una puerta cerrada bloquea paso y vista (un rastrillo bloquea el paso, pero deja ver). */
export const doorBlocksSight = p => isDoor(p) && !p.open && !PROPS[p.k].seeThrough;
export const isWallT = t => !!(TERRAIN[t] && TERRAIN[t].wall);
export const isDifficult = t => !!(TERRAIN[t] && TERRAIN[t].dif);
/** Lo que puede ver un jugador: los objetos ocultos (trampas, puertas secretas, notas) solo si se han revelado. */
export const propVisible = (p, dm) => dm || !(p.hidden ?? (PROPS[p.k] || {}).hidden);
