// Índice del SRD 5.2.1 en español: capítulos y subsecciones con la página donde empieza cada apartado.
// Hecho a mano siguiendo los títulos del documento y comprobado contra paginas.json (cada título aparece en su página).
// Formato de cada subsección: [título, página, nivel] (nivel 2 = apartado dentro del anterior).
export const INDICE = [
  { n: "Cómo jugar", i: "🎲", p: 5, subs: [
    ["El ritmo de juego", 5], ["Las seis características", 5], ["Pruebas de característica", 6], ["Tiradas de salvación", 7], ["Tiradas de ataque", 7],
    ["Inspiración heroica", 8], ["Ventaja y desventaja", 8], ["Competencia", 8], ["Habilidades", 9, 2],
    ["Acciones", 10], ["Acciones adicionales", 11, 2], ["Reacciones", 11, 2],
    ["Interacciones sociales", 11], ["Exploración", 12], ["Visión e iluminación", 12, 2], ["Esconderse", 12, 2], ["Interactuar con objetos", 12, 2], ["Peligros", 13, 2], ["Viajar", 13, 2],
    ["Combate", 14], ["Iniciativa", 14, 2], ["Movimiento y posición", 15, 2], ["Terreno difícil", 15, 2], ["Tamaño de una criatura", 15, 2], ["Atacar", 16, 2], ["Cobertura", 16, 2], ["Ataques a distancia", 16, 2], ["Ataques cuerpo a cuerpo", 17, 2], ["Ataques de oportunidad", 17, 2], ["Combate montado", 17, 2], ["Combate bajo el agua", 17, 2],
    ["Daño y curación", 17], ["Críticos", 18, 2], ["Tipos de daño", 18, 2], ["Resistencia y vulnerabilidad", 18, 2], ["Curación", 19, 2], ["Caer inconsciente", 19, 2], ["Tiradas de salvación contra muerte", 19, 2], ["Puntos de golpe temporales", 20, 2]
  ] },
  { n: "Creación de personajes", i: "🧝", p: 21, subs: [
    ["Crear tu personaje", 21], ["Elige un trasfondo", 21, 2], ["Elige una especie", 22, 2], ["Elige tus idiomas", 22, 2], ["Genera tus puntuaciones", 23, 2], ["Los nueve alineamientos", 24, 2],
    ["Progreso de los personajes", 25], ["Subir de nivel", 26, 2], ["Escalones del juego", 26, 2], ["Comenzar en niveles superiores", 27, 2], ["Multiclase", 27]
  ] },
  { n: "Clases", i: "⚔️", p: 32, subs: [
    ["Bárbaro", 32], ["Bardo", 35], ["Brujo", 40], ["Clérigo", 47], ["Druida", 52], ["Explorador", 58],
    ["Guerrero", 62], ["Hechicero", 64], ["Mago", 71], ["Monje", 77], ["Paladín", 81], ["Pícaro", 86]
  ] },
  { n: "Trasfondos y especies", i: "🧭", p: 89, subs: [
    ["Trasfondos de personaje", 89], ["Acólito, Criminal, Erudito, Soldado", 89, 2],
    ["Especies de personaje", 89], ["Dracónido", 90, 2], ["Elfo", 90, 2], ["Enano", 91, 2], ["Gnomo", 91, 2], ["Goliat", 92, 2], ["Humano", 92, 2], ["Mediano", 92, 2], ["Orco", 92, 2], ["Tiefling", 93, 2]
  ] },
  { n: "Dotes", i: "🏅", p: 94, subs: [["Dotes de origen", 94], ["Dotes generales", 94], ["Dotes de estilo de combate", 95], ["Dotes de don épico", 95]] },
  { n: "Equipo", i: "🎒", p: 97, subs: [
    ["Monedas", 97], ["Armas", 97], ["Propiedades", 97, 2], ["Propiedades de maestría", 98, 2], ["Armas sencillas y marciales", 99, 2],
    ["Armaduras", 100], ["Herramientas", 101], ["Equipo de aventureros", 102], ["Monturas y vehículos", 109],
    ["Gastos relativos al nivel", 110], ["Asalariados", 111], ["Servicios de lanzamiento de conjuros", 111], ["Objetos mágicos y sintonización", 111], ["Fabricar objetos", 112]
  ] },
  { n: "Conjuros", i: "✨", p: 114, subs: [
    ["Obtener conjuros", 114], ["Lanzar conjuros", 114], ["Espacios de conjuro", 114, 2], ["Escuelas mágicas", 115, 2], ["Tiempo de lanzamiento", 115, 2], ["Alcance", 115, 2], ["Componentes", 115, 2], ["Duración", 116, 2], ["Efectos y objetivos", 116, 2], ["Combinar efectos", 117, 2],
    ["Descripciones de conjuros", 118], ["→ Ver la pestaña Conjuros", "tab:conjuros"]
  ] },
  { n: "Glosario de reglas", i: "📚", p: 194, subs: [["Convenciones del glosario", 194], ["→ Ver como diccionario A–Z", "tab:glosario"]] },
  { n: "Herramientas del máster", i: "🧙", p: 211, subs: [
    ["Ritmo de viaje", 211], ["Maldiciones", 212], ["Enfermedades mágicas", 213], ["Efectos ambientales", 214], ["Miedo y estrés psicológico", 215],
    ["Veneno", 216], ["Trampas", 218], ["Encuentros de combate", 221], ["Solución de problemas", 222]
  ] },
  { n: "Objetos mágicos", i: "💍", p: 223, subs: [
    ["Categorías de objetos", 223], ["Reglas de objetos mágicos", 224], ["Rareza y valor", 225, 2], ["Activar un objeto mágico", 225, 2], ["Objetos malditos", 225, 2], ["Fabricar objetos mágicos", 226, 2], ["Objetos conscientes", 227, 2],
    ["Objetos mágicos de la A a la Z", 228]
  ] },
  { n: "Monstruos", i: "🐉", p: 278, subs: [
    ["Partes de un perfil", 278], ["Valor de desafío", 280, 2], ["Acciones y notación", 281, 2], ["Acciones legendarias", 282, 2],
    ["Monstruos de la A a la Z", 283], ["→ Ver la pestaña Monstruos", "tab:monstruos"]
  ] },
  { n: "Animales", i: "🐺", p: 376, subs: [["Animales", 376], ["→ Filtrar solo animales", "tab:animales"]] }
];

/** Accesos rápidos: lo que más se consulta en la mesa. g: entrada del glosario · p: página · f: filtro del glosario. */
export const ACCESOS = [
  ["🩹 Estados", { f: "estado" }], ["⚡ Acciones", { f: "acción" }], ["🛡 Cobertura", { g: "Cobertura" }],
  ["🏕 Descanso largo", { g: "Descanso largo" }], ["☕ Descanso corto", { g: "Descanso corto" }], ["🪂 Caídas", { g: "Caídas" }],
  ["💀 Salvación contra muerte", { g: "Tirada de salvación contra muerte" }], ["🥾 Viajes", { p: 13 }], ["⚖️ Encuentros", { p: 221 }]
];
