// Catálogo del editor de mapas: terrenos (con sus reglas), muros y objetos por categorías.
// Reglas 2024: el terreno difícil cuesta 1,5 m extra por casilla; los muros bloquean paso y visión;
// el mobiliario grande da media cobertura, y lo macizo, tres cuartos.

/** Terrenos. f: color base (2D y respaldo); wall: muro (bloquea paso y vista); void: fuera del mapa;
 *  dif: terreno difícil; hz: peligro (texto para el máster); liquid: se anima; glow: emite luz.
 *  haz: peligro que la mesa aplica sola (core/peligros.js): fall (caída), slip (hielo), fire (arder), lava. */
export const TERRAIN = {
  // Suelos de interior
  piedra:   { n: "Losas de piedra", f: "#6a655d", cat: "interior" },
  adoquin:  { n: "Adoquines", f: "#5d5a55", cat: "interior", reg: ["ciudad"] },
  marmol:   { n: "Mármol", f: "#bfb8ad", cat: "interior" },
  madera:   { n: "Tablones", f: "#6b4a2e", cat: "interior" },
  alfombra: { n: "Alfombra", f: "#7a2630", cat: "interior" },
  cueva:    { n: "Suelo de cueva", f: "#4a443d", cat: "interior", reg: ["enano"] },
  escombros:{ n: "Escombros", f: "#5a534a", cat: "interior", dif: true, reg: ["cementerio"] },
  // Exterior
  hierba:   { n: "Hierba", f: "#4d6a33", cat: "exterior" },
  hierbalta:{ n: "Maleza", f: "#3e5a2a", cat: "exterior", dif: true },
  tierra:   { n: "Tierra", f: "#6e5a3f", cat: "exterior" },
  camino:   { n: "Camino", f: "#8a7556", cat: "exterior" },
  arena:    { n: "Arena", f: "#b49a64", cat: "exterior", reg: ["costa"] },
  barro:    { n: "Barro", f: "#4a3b2a", cat: "exterior", dif: true, reg: ["pantano", "orco"] },
  nieve:    { n: "Nieve", f: "#dfe6ec", cat: "exterior", dif: true, reg: ["montana"] },
  hielo:    { n: "Hielo resbaladizo", f: "#a9cfe0", cat: "exterior", dif: true, reg: ["montana"], haz: "slip", hz: "SRD: terreno difícil; al entrar por primera vez en un turno o empezar el turno, salvación de Destreza CD 10 o derribado (la mesa la tira sola)." },
  // Agua y peligros
  agua:     { n: "Agua poco profunda", f: "#2e6a84", cat: "peligro", dif: true, liquid: true, reg: ["pantano", "elfico"] },
  aguaprof: { n: "Agua profunda", f: "#1d4560", cat: "peligro", dif: true, liquid: true, reg: ["costa", "pantano"], hz: "Hay que nadar (cada casilla cuesta el doble sin velocidad nadando)." },
  lava:     { n: "Lava", f: "#d8541c", cat: "peligro", liquid: true, glow: true, reg: ["volcan"], haz: "lava", hz: "Regla de campaña (no está en el SRD): daño de fuego al entrar y al empezar el turno; el daño se pone en ⚙ Mapa." },
  abismo:   { n: "Abismo", f: "#0b0a09", cat: "peligro", haz: "fall", hz: "SRD «Caídas»: 1d6 contundente por cada 3 m (máx. 20d6) y derribado; la altura se pone en ⚙ Mapa." },
  brasas:   { n: "Brasas y escoria", f: "#7a2a10", cat: "peligro", glow: true, reg: ["volcan", "enano"], haz: "fire", hz: "Quien entra empieza a arder (SRD «Fuego»: 1d4 de fuego al principio de cada turno hasta apagarse)." },
  hielofino:{ n: "Hielo delgado", f: "#c6e4ef", cat: "peligro", dif: true, reg: ["montana"], haz: "slip", hz: "SRD: aguanta 3d10 × 5 kg por cada 3 m de lado; si se rompe, se cae al agua helada (Constitución CD 10 por minuto pasados tantos minutos como su Constitución, o cansancio). Además resbala como el hielo." },
  brea:     { n: "Brea ardiendo", f: "#2a1608", cat: "peligro", glow: true, reg: ["orco"], haz: "fire", hz: "Quien entra empieza a arder (SRD «Fuego»: 1d4 de fuego al principio de cada turno hasta apagarse)." },
  // Paquetes de región (suelos)
  runas:    { n: "Losas talladas con runas", f: "#6e6a62", cat: "interior", reg: ["enano"] },
  railes:   { n: "Raíles de mina", f: "#4a4038", cat: "interior", reg: ["enano"] },
  hojarasca:{ n: "Hojarasca", f: "#7a5a2a", cat: "exterior", reg: ["elfico"] },
  musgo:    { n: "Musgo", f: "#3e6a2e", cat: "exterior", reg: ["elfico", "pantano"] },
  raices:   { n: "Raíces", f: "#4a3a24", cat: "exterior", dif: true, reg: ["elfico"] },
  plataforma:{ n: "Plataforma élfica", f: "#b09a70", cat: "exterior", reg: ["elfico"] },
  pisoteada:{ n: "Tierra pisoteada", f: "#5a4a34", cat: "exterior", reg: ["orco"] },
  paja:     { n: "Suelo de paja", f: "#b0954e", cat: "interior", reg: ["ciudad"] },
  removida: { n: "Tierra removida", f: "#4e3e2c", cat: "exterior", dif: true, reg: ["cementerio"] },
  rocanevada:{ n: "Roca nevada", f: "#8a8e94", cat: "exterior", reg: ["montana"] },
  juncos:   { n: "Juncos", f: "#5a6a34", cat: "exterior", dif: true, reg: ["pantano"] },
  pasarela: { n: "Pasarela de tablones", f: "#6a5236", cat: "exterior", reg: ["pantano", "costa"] },
  volcanica:{ n: "Roca volcánica", f: "#2e2a28", cat: "exterior", reg: ["volcan"] },
  ceniza:   { n: "Ceniza", f: "#5e5a56", cat: "exterior", reg: ["volcan"] },
  muelle:   { n: "Muelle", f: "#6e5638", cat: "exterior", reg: ["costa"] },
  cubierta: { n: "Cubierta de barco", f: "#7a5a36", cat: "interior", reg: ["costa"] },
  // Muros
  muro:     { n: "Muro de piedra", f: "#2a2521", wall: true, cat: "muro" },
  muroladrillo: { n: "Muro de ladrillo", f: "#5a2f24", wall: true, cat: "muro" },
  muromadera:   { n: "Pared de madera", f: "#4a3220", wall: true, cat: "muro" },
  muroroca: { n: "Roca de cueva", f: "#3a3530", wall: true, cat: "muro", reg: ["enano"] },
  murorunas:{ n: "Muro tallado enano", f: "#4a4640", wall: true, cat: "muro", reg: ["enano"] },
  veta:     { n: "Roca con vetas de mineral", f: "#35302c", wall: true, cat: "muro", reg: ["enano"] },
  empalizada:{ n: "Empalizada", f: "#4e3822", wall: true, cat: "muro", reg: ["orco"] },
  muralla:  { n: "Muralla con almenas", f: "#5e5850", wall: true, cat: "muro", reg: ["ciudad"] },
  murocaido:{ n: "Muro en ruinas", f: "#4a4540", wall: true, cat: "muro", reg: ["cementerio"] },
  seto:     { n: "Seto / maleza densa", f: "#2e4a22", wall: true, cat: "muro", reg: ["elfico"] },
  vacio:    { n: "Vacío (fuera del mapa)", f: "#0a0908", wall: true, void: true, cat: "muro" }
};
export const TERRAIN_CATS = { region: "Región", interior: "Interior", exterior: "Exterior", peligro: "Agua y peligros", muro: "Muros" };

/** Objetos. i: icono 2D; cat; block: no se puede pasar; cover: "half" | "3q" (cobertura que da);
 *  hidden: nace oculto a los jugadores; door: puerta; wall: va colgado de la pared;
 *  loot / trap: tiene contenido o efecto que el máster rellena; srd: trampa del SRD (data/trampas.js);
 *  light: radio de luz en casillas; haz: "fall" (se cae: h = metros por defecto) o "fire" (empieza a arder);
 *  reg: paquetes de región en los que aparece primero; note: lo que el máster debe saber (sin regla automática). */
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
  pinchos:    { n: "Pozo con pinchos", i: "🔺", cat: "peligro", trap: true, srd: "pozopinchos", hidden: true },
  foso:       { n: "Pozo escondido", i: "⬛", cat: "peligro", trap: true, srd: "pozo", hidden: true },
  aguja:      { n: "Aguja envenenada", i: "📍", cat: "peligro", trap: true, srd: "aguja", hidden: true },
  dardos:     { n: "Dardos envenenados", i: "🎯", cat: "peligro", trap: true, srd: "dardos", hidden: true },
  estatuafuego: { n: "Estatua que escupe fuego", i: "🐲", cat: "peligro", trap: true, srd: "estatua", block: true, cover: "3q" },
  red:        { n: "Red que cae", i: "🕸", cat: "peligro", trap: true, srd: "red", hidden: true },
  rocarodante: { n: "Roca rodante", i: "🪨", cat: "peligro", trap: true, srd: "roca", hidden: true },
  techo:      { n: "Techo que se hunde", i: "🧱", cat: "peligro", trap: true, srd: "techo", hidden: true },
  // Tesoro
  cofre:      { n: "Cofre", i: "🧰", cat: "tesoro", loot: true, cover: "half" },
  oro:        { n: "Montón de oro", i: "💰", cat: "tesoro", loot: true },
  pocion:     { n: "Poción", i: "🧪", cat: "tesoro", loot: true },
  pergamino:  { n: "Pergamino", i: "📜", cat: "tesoro", loot: true },
  objeto:     { n: "Objeto mágico", i: "✨", cat: "tesoro", loot: true },
  // Paquete enano: salones y minas
  forja:      { n: "Forja", i: "⚒️", cat: "region", reg: ["enano", "volcan"], block: true, cover: "3q", light: 5 },
  yunque:     { n: "Yunque", i: "🔨", cat: "region", reg: ["enano"], cover: "half" },
  vagoneta:   { n: "Vagoneta de mina", i: "🛒", cat: "region", reg: ["enano"], cover: "half" },
  puntal:     { n: "Puntales de mina", i: "🪵", cat: "region", reg: ["enano"], block: true, cover: "3q" },
  ancestro:   { n: "Estatua de ancestro", i: "🧔", cat: "region", reg: ["enano"], block: true, cover: "3q" },
  mesapiedra: { n: "Mesa de piedra", i: "🪨", cat: "region", reg: ["enano"], cover: "half" },
  pozomina:   { n: "Pozo de mina", i: "🕳️", cat: "region", reg: ["enano"], haz: "fall", h: 9 },
  puertarunas:{ n: "Puerta rúnica de piedra", i: "🚪", cat: "puerta", reg: ["enano"], door: true, lock: true },
  // Paquete élfico: bosque y claros
  arbolgigante: { n: "Árbol gigante", i: "🌳", cat: "region", reg: ["elfico"], block: true, cover: "3q" },
  arcopiedra: { n: "Arco de piedra con enredadera", i: "🌿", cat: "region", reg: ["elfico", "cementerio"] },
  puente:     { n: "Puente colgante", i: "🌉", cat: "region", reg: ["elfico", "montana"], bridge: true },
  farolillos: { n: "Farolillos", i: "🏮", cat: "region", reg: ["elfico", "ciudad"], light: 4 },
  fuente:     { n: "Fuente", i: "⛲", cat: "region", reg: ["elfico", "ciudad"], block: true, cover: "half" },
  estatuaelfica: { n: "Estatua élfica", i: "🧝", cat: "region", reg: ["elfico"], block: true, cover: "3q" },
  flores:     { n: "Flores", i: "🌸", cat: "region", reg: ["elfico"] },
  // Paquete orco: campamentos y fortines
  tienda:     { n: "Tienda de pieles", i: "⛺", cat: "region", reg: ["orco"], block: true, cover: "3q" },
  totem:      { n: "Tótem de calaveras", i: "☠️", cat: "region", reg: ["orco"], block: true, cover: "half" },
  jaula:      { n: "Jaula", i: "🔲", cat: "region", reg: ["orco"], block: true, cover: "half" },
  granhoguera:{ n: "Gran hoguera", i: "🔥", cat: "region", reg: ["orco"], light: 8, haz: "fire" },
  barricada:  { n: "Barricada", i: "🚧", cat: "region", reg: ["orco", "ciudad"], cover: "half" },
  huesos:     { n: "Pila de huesos", i: "🦴", cat: "region", reg: ["orco", "cementerio"] },
  olla:       { n: "Olla de rancho", i: "🍲", cat: "region", reg: ["orco"], cover: "half" },
  // Ciudad y castillo
  puesto:     { n: "Puesto de mercado", i: "🏪", cat: "region", reg: ["ciudad"], cover: "half" },
  carro:      { n: "Carro", i: "🛞", cat: "region", reg: ["ciudad"], block: true, cover: "half" },
  horca:      { n: "Horca", i: "🪢", cat: "region", reg: ["ciudad"], block: true },
  montonpaja: { n: "Montón de paja", i: "🌾", cat: "region", reg: ["ciudad"], cover: "half" },
  armero:     { n: "Armero con lanzas", i: "🗡️", cat: "region", reg: ["ciudad", "orco"], block: true, cover: "half" },
  // Cementerio y ruinas
  lapida:     { n: "Lápida", i: "🪦", cat: "region", reg: ["cementerio"], cover: "half" },
  mausoleo:   { n: "Mausoleo", i: "🏚️", cat: "region", reg: ["cementerio"], block: true, cover: "3q" },
  tumbaabierta: { n: "Tumba abierta", i: "⚱️", cat: "region", reg: ["cementerio"], haz: "fall", h: 2 },
  cruz:       { n: "Cruz de piedra", i: "✝️", cat: "region", reg: ["cementerio"], cover: "half" },
  cuervos:    { n: "Cuervos", i: "🐦", cat: "region", reg: ["cementerio"] },
  niebla:     { n: "Niebla", i: "🌫️", cat: "region", reg: ["cementerio", "pantano"], note: "Zona ligeramente oscura (SRD): desventaja en las pruebas de Sabiduría (Percepción) que dependen de la vista." },
  // Montaña nevada
  pinonevado: { n: "Pino nevado", i: "🌲", cat: "region", reg: ["montana"], cover: "half" },
  monticulo:  { n: "Montículo de nieve", i: "❄️", cat: "region", reg: ["montana"], cover: "half" },
  refugio:    { n: "Refugio de montaña", i: "🛖", cat: "region", reg: ["montana"], block: true, cover: "3q" },
  grieta:     { n: "Grieta", i: "⚡", cat: "region", reg: ["montana", "volcan"], haz: "fall", h: 6 },
  // Pantano
  manglar:    { n: "Árbol de manglar", i: "🌴", cat: "region", reg: ["pantano"], cover: "half" },
  tronco:     { n: "Tronco caído", i: "🪵", cat: "region", reg: ["pantano", "elfico"], cover: "half" },
  cabana:     { n: "Cabaña sobre pilotes", i: "🏠", cat: "region", reg: ["pantano"], block: true, cover: "3q" },
  nenufares:  { n: "Nenúfares", i: "🪷", cat: "region", reg: ["pantano"] },
  // Volcán y forja
  geiser:     { n: "Géiser de vapor", i: "♨️", cat: "region", reg: ["volcan"], note: "El SRD no trae reglas de géiseres: si quema, el máster decide el daño." },
  obsidiana:  { n: "Roca de obsidiana", i: "🖤", cat: "region", reg: ["volcan"], block: true, cover: "3q" },
  // Costa y puerto
  barca:      { n: "Barca", i: "🛶", cat: "region", reg: ["costa", "pantano"], cover: "half" },
  redes:      { n: "Redes de pesca", i: "🥅", cat: "region", reg: ["costa"] },
  ancla:      { n: "Ancla", i: "⚓", cat: "region", reg: ["costa"], cover: "half" },
  mastil:     { n: "Mástil", i: "⛵", cat: "region", reg: ["costa"], block: true, cover: "3q" },
  // Marcadores del máster
  nota:       { n: "Nota del máster", i: "📌", cat: "marca", hidden: true },
  interes:    { n: "Punto de interés", i: "⭐", cat: "marca" }
};
/** Paquetes de región: luz y sonido que proponen al elegirlos en el editor. */
export const REGIONS = {
  enano: { n: "Enano: salones y minas", i: "⚒️", light: "interior", sound: "mazmorra" },
  elfico: { n: "Élfico: bosque y claros", i: "🌳", light: "dia", sound: "bosque" },
  orco: { n: "Orco: campamentos y fortines", i: "☠️", light: "noche", sound: "fuego" },
  ciudad: { n: "Ciudad y castillo", i: "🏰", light: "dia", sound: "taberna" },
  cementerio: { n: "Cementerio y ruinas", i: "🪦", light: "noche", sound: "viento" },
  montana: { n: "Montaña nevada", i: "🏔️", light: "dia", sound: "viento" },
  pantano: { n: "Pantano", i: "🐸", light: "dia", sound: "lluvia" },
  volcan: { n: "Volcán y forja", i: "🌋", light: "interior", sound: "fuego" },
  costa: { n: "Costa y puerto", i: "⚓", light: "dia", sound: "viento" }
};
export const inRegion = (v, reg) => !!(reg && v && (v.reg || []).includes(reg));
export const PROP_CATS = { region: "Región", mueble: "Mobiliario", luz: "Luz", mazmorra: "Mazmorra", natural: "Naturaleza", puerta: "Puertas", peligro: "Trampas", tesoro: "Tesoro", marca: "Marcas" };

export const isDoor = p => !!(p && PROPS[p.k] && PROPS[p.k].door);
/** Una puerta cerrada bloquea paso y vista (un rastrillo bloquea el paso, pero deja ver). */
export const doorBlocksSight = p => isDoor(p) && !p.open && !PROPS[p.k].seeThrough;
export const isWallT = t => !!(TERRAIN[t] && TERRAIN[t].wall);
export const isDifficult = t => !!(TERRAIN[t] && TERRAIN[t].dif);
/** Lo que puede ver un jugador: los objetos ocultos (trampas, puertas secretas, notas) solo si se han revelado. */
export const propVisible = (p, dm) => dm || !(p.hidden ?? (PROPS[p.k] || {}).hidden);
