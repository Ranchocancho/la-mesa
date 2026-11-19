// Símbolos del mapa del mundo (game-icons.net, CC BY 3.0: Delapouite y Lorc), tamaños por importancia
// y colores por pueblo o bando. Como en los editores de mapas de fantasía: el icono dice QUÉ es, el tamaño
// CUÁNTO importa y el color DE QUIÉN es.
export const MAP_ICONS = {
  capital: { n: "Capital", cat: "asentamiento" },
  ciudad: { n: "Ciudad", cat: "asentamiento" },
  pueblo: { n: "Pueblo", cat: "asentamiento" },
  aldea: { n: "Aldea", cat: "asentamiento" },
  granja: { n: "Granja", cat: "asentamiento" },
  molino: { n: "Molino", cat: "asentamiento" },
  puerto: { n: "Puerto", cat: "asentamiento" },
  elfica: { n: "Ciudad élfica", cat: "cultura" },
  arbolsagrado: { n: "Árbol sagrado", cat: "cultura" },
  enana: { n: "Fortaleza enana", cat: "cultura" },
  mina: { n: "Mina", cat: "cultura" },
  mediana: { n: "Villa mediana", cat: "cultura" },
  orca: { n: "Campamento orco / goblin", cat: "cultura" },
  barbara: { n: "Salón del norte", cat: "cultura" },
  desierto: { n: "Campamento del desierto", cat: "cultura" },
  piratas: { n: "Guarida pirata", cat: "cultura" },
  castillo: { n: "Castillo", cat: "fortaleza" },
  fuerte: { n: "Fuerte", cat: "fortaleza" },
  fortin: { n: "Fortín en la colina", cat: "fortaleza" },
  torre: { n: "Torre", cat: "fortaleza" },
  atalaya: { n: "Atalaya", cat: "fortaleza" },
  torreoscura: { n: "Torre oscura", cat: "fortaleza" },
  puerta: { n: "Puerta / muralla", cat: "fortaleza" },
  puente: { n: "Puente", cat: "fortaleza" },
  ruinas: { n: "Ruinas", cat: "fortaleza" },
  ruinasantiguas: { n: "Ruinas antiguas", cat: "fortaleza" },
  cueva: { n: "Cueva", cat: "mazmorra" },
  cuevamonte: { n: "Cueva en la montaña", cat: "mazmorra" },
  mazmorra: { n: "Mazmorra", cat: "mazmorra" },
  cripta: { n: "Cripta", cat: "mazmorra" },
  cementerio: { n: "Cementerio", cat: "mazmorra" },
  dragon: { n: "Guarida de dragón", cat: "mazmorra" },
  guarida: { n: "Guarida de monstruos", cat: "mazmorra" },
  portal: { n: "Portal", cat: "mazmorra" },
  templo: { n: "Templo", cat: "magia" },
  iglesia: { n: "Capilla", cat: "magia" },
  santuario: { n: "Santuario", cat: "magia" },
  obelisco: { n: "Obelisco", cat: "magia" },
  magia: { n: "Torre del mago", cat: "magia" },
  bruja: { n: "Cabaña de la bruja", cat: "magia" },
  ojo: { n: "Lugar maldito", cat: "magia" },
  posada: { n: "Posada", cat: "viaje" },
  campamento: { n: "Campamento", cat: "viaje" },
  hoguera: { n: "Hoguera", cat: "viaje" },
  cabana: { n: "Cabaña", cat: "viaje" },
  cruce: { n: "Cruce de caminos", cat: "viaje" },
  faro: { n: "Faro", cat: "viaje" },
  pozo: { n: "Pozo", cat: "viaje" },
  naufragio: { n: "Naufragio", cat: "viaje" },
  bosque: { n: "Bosque", cat: "natural" },
  montana: { n: "Montañas", cat: "natural" },
  colinas: { n: "Colinas", cat: "natural" },
  volcan: { n: "Volcán", cat: "natural" },
  pantano: { n: "Pantano", cat: "natural" },
  dunas: { n: "Desierto", cat: "natural" },
  oasis: { n: "Oasis", cat: "natural" },
  isla: { n: "Isla", cat: "natural" },
  cascada: { n: "Cascada", cat: "natural" },
  batalla: { n: "Campo de batalla", cat: "aventura" },
  tesoro: { n: "Tesoro", cat: "aventura" },
  mapatesoro: { n: "Mapa del tesoro", cat: "aventura" },
  mision: { n: "Misión", cat: "aventura" },
  peligro: { n: "Peligro", cat: "aventura" },
  interes: { n: "Punto de interés", cat: "aventura" }
};
export const ICON_CATS = {"asentamiento": "Asentamientos", "cultura": "Pueblos y culturas", "fortaleza": "Fortalezas y caminos", "mazmorra": "Mazmorras y guaridas", "magia": "Religión y magia", "viaje": "Viaje y descanso", "natural": "Naturaleza", "aventura": "Aventura"};
export const iconURL = k => `assets/mapa/${k}.svg`;

/** Tamaños: de capital a lugar diminuto (diámetro del medallón en píxeles y tamaño del rótulo). */
export const PIN_SIZES = {
  capital: { n: "Capital / gran lugar", d: 58, f: 15 },
  grande: { n: "Grande", d: 46, f: 13.5 },
  normal: { n: "Normal", d: 38, f: 12.5 },
  pequeno: { n: "Pequeño", d: 30, f: 11.5 },
  diminuto: { n: "Diminuto", d: 24, f: 10.5 }
};
/** Colores por pueblo o bando (aro y fondo del medallón). */
export const PIN_TINTS = {
  neutro: { n: "Neutral", ring: "#8a6a28", bg: "#efe2c2", ink: "#2b2017" },
  humanos: { n: "Humanos", ring: "#c9a14a", bg: "#f3e6c3", ink: "#3a2a10" },
  elfos: { n: "Elfos", ring: "#3f8a4a", bg: "#e3efd9", ink: "#1f3a1f" },
  enanos: { n: "Enanos", ring: "#9a5a2a", bg: "#ead9c6", ink: "#3a1f10" },
  medianos: { n: "Medianos", ring: "#7a8a3a", bg: "#eef0d4", ink: "#2f3412" },
  orcos: { n: "Orcos y goblins", ring: "#7a2a22", bg: "#e8d0c8", ink: "#3a0f0a" },
  feericos: { n: "Feéricos y magia", ring: "#7a4ab0", bg: "#e9def5", ink: "#2a1446" },
  muertos: { n: "No muertos y maldición", ring: "#4a4a52", bg: "#d8d8dc", ink: "#18181c" },
  mar: { n: "Mar y costa", ring: "#2a6a8a", bg: "#d8e8f0", ink: "#0f2a3a" },
  peligro: { n: "Peligro", ring: "#c0392b", bg: "#f2d5cf", ink: "#4a0f08" }
};
/** Si el máster no ha elegido, se deduce del tipo de lugar. */
export function pinDefaults(p) {
  const k = (p.kind || "").toLowerCase();
  const icon = k === "ciudad" ? "ciudad" : k === "pueblo" ? "pueblo" : k === "región" ? "montana" : k === "mazmorra" ? "mazmorra" : k === "distrito" ? "aldea" : k === "localización" ? "posada" : "interes";
  const size = k === "ciudad" || k === "región" ? "grande" : k === "punto de interés" ? "pequeno" : "normal";
  return { icon: p.icon || icon, size: p.size || size, tint: p.tint || "neutro" };
}
