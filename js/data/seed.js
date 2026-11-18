import { newCharacter } from "./dnd.js";
import { exampleScenes } from "./escenas.js";

// Mundo de ejemplo para probar la app. Se sustituirá por el vuestro.
export function seed() {
  return {
    version: 2,
    rev: 1,
    campaign: { name: "Tierras de Vel Arath", rules: "D&D 2024" },
    dms: [],
    live: null, // id de la sesión abierta ahora mismo
    users: [
      { id: "dm", name: "El máster", role: "dm", initials: "M", color: "#d6aa4e" },
      { id: "j1", name: "Jugador 1", role: "player", initials: "J1", color: "#79a85a", character: "mirra" },
      { id: "j2", name: "Jugador 2", role: "player", initials: "J2", color: "#c97a3d", character: "brena" },
      { id: "j3", name: "Jugador 3", role: "player", initials: "J3", color: "#7d8fe0", character: "ilyas" },
      { id: "j4", name: "Jugador 4", role: "player", initials: "J4", color: "#e0d6b0", character: "osric" }
    ],
    characters: [
      newCharacter({ id: "mirra", owner: "j1", name: "Mirra Zarzal", species: "Mediana", cls: "Pícara", subclass: "Ladrona", background: "Criminal", level: 5, xp: 14250, initials: "MZ", color: "#79a85a",
        abilities: { fue: 8, des: 18, con: 12, int: 13, sab: 12, car: 14 }, saves: ["des", "int"],
        skills: { sigilo: 2, juegomanos: 2, acrobacias: 1, percepcion: 1, engano: 1, investigacion: 1 },
        hp: { max: 33, cur: 27, temp: 0 }, ac: 15, speed: 25,
        weapons: [{ id: "w1", name: "Estoque", atk: "+7", dmg: "1d8+4 perforante", notes: "Sutil" }, { id: "w2", name: "Arco corto", atk: "+7", dmg: "1d6+4 perforante", notes: "80/320 pies" }],
        inventory: [{ id: "i1", name: "Herramientas de ladrón", qty: 1, weight: 1 }, { id: "i2", name: "Llave de hierro del gremio", qty: 1, weight: 0, notes: "Encontrada en el mercado" }, { id: "i3", name: "Armadura de cuero tachonado", qty: 1, weight: 13, equipped: true }],
        coins: { po: 34, pp: 12, pe: 0, pc: 5 },
        features: [{ id: "f1", name: "Ataque furtivo (3d6)", text: "Una vez por turno, daño extra si tienes ventaja o un aliado junto al objetivo." }, { id: "f2", name: "Acción astuta", text: "Correr, Destrabarse o Esconderse como acción adicional." }] }),
      newCharacter({ id: "brena", owner: "j2", name: "Brena Martillo-Ceniza", species: "Enana", cls: "Guerrera", subclass: "Campeona", background: "Soldado", level: 5, xp: 6800, initials: "BR", color: "#c97a3d",
        abilities: { fue: 17, des: 10, con: 16, int: 8, sab: 12, car: 10 }, saves: ["fue", "con"], skills: { atletismo: 1, intimidacion: 1, percepcion: 1 },
        hp: { max: 49, cur: 49, temp: 0 }, ac: 18, speed: 30,
        weapons: [{ id: "w1", name: "Hacha de guerra", atk: "+6", dmg: "1d8+3 cortante", notes: "Versátil (1d10)" }] }),
      newCharacter({ id: "ilyas", owner: "j3", name: "Ilyas Vel", species: "Elfo", cls: "Mago", subclass: "Evocador", background: "Sabio", level: 5, xp: 6600, initials: "IV", color: "#7d8fe0",
        abilities: { fue: 8, des: 14, con: 14, int: 18, sab: 12, car: 10 }, saves: ["int", "sab"], skills: { arcanos: 1, historia: 1, investigacion: 1 },
        hp: { max: 32, cur: 32, temp: 0 }, ac: 12, speed: 30,
        spells: { slots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } },
          list: [{ id: "s1", name: "Rayo de escarcha", level: 0, prepared: true }, { id: "s2", name: "Proyectil mágico", level: 1, prepared: true }, { id: "s3", name: "Escudo", level: 1, prepared: true }, { id: "s4", name: "Paso brumoso", level: 2, prepared: true }, { id: "s5", name: "Bola de fuego", level: 3, prepared: true }] } }),
      newCharacter({ id: "osric", owner: "j4", name: "Hermano Osric", species: "Humano", cls: "Clérigo", subclass: "Dominio de la Vida", background: "Acólito", level: 5, xp: 6700, initials: "HO", color: "#e0d6b0",
        abilities: { fue: 14, des: 10, con: 14, int: 10, sab: 17, car: 12 }, saves: ["sab", "car"], skills: { medicina: 1, religion: 1, perspicacia: 1 },
        hp: { max: 38, cur: 38, temp: 0 }, ac: 18, speed: 30,
        spells: { slots: { 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } },
          list: [{ id: "s1", name: "Llama sagrada", level: 0, prepared: true }, { id: "s2", name: "Curar heridas", level: 1, prepared: true }, { id: "s3", name: "Arma espiritual", level: 2, prepared: true }, { id: "s4", name: "Revivir", level: 3, prepared: true }] } })
    ],
    world: {
      map: null, // null = mapa de ejemplo generado; si no, clave de la imagen subida
      places: [
        {
          id: "velarath", name: "Vel Arath", kind: "Ciudad", x: 0.47, y: 0.42, visible: true,
          summary: "Ciudad amurallada sobre el río Grisvela. Sus campanas llevan tres días calladas.",
          secret: "El gremio de herreros guarda la llave de la cripta bajo el campanario.",
          items: [
            { id: "i1", type: "text", title: "El campanario", text: "Una torre de piedra negra que domina la plaza. Nadie entra desde que callaron las campanas.", revealed: true },
            { id: "i2", type: "text", title: "Rumor de la taberna", text: "Dicen que el herrero Doran Brasaviva sabe más de lo que cuenta.", revealed: false }
          ]
        },
        {
          id: "hollin", name: "Bosque de Hollín", kind: "Región", x: 0.3, y: 0.33, visible: true,
          summary: "Un bosque quemado que aún humea. Los caminos cambian de sitio.",
          secret: "La druida Ceniza vive en el corazón del bosque y conoce el origen del fuego.",
          items: [
            { id: "i3", type: "text", title: "Huellas en la ceniza", text: "Algo grande camina por el bosque de noche. Sus huellas tienen tres dedos.", revealed: false }
          ]
        },
        {
          id: "salobre", name: "Puerto Salobre", kind: "Pueblo", x: 0.62, y: 0.66, visible: true,
          summary: "Puerto pesquero con mala fama y buena cerveza.",
          secret: "", items: []
        },
        {
          id: "grisvela", name: "Paso de Grisvela", kind: "Punto de interés", x: 0.57, y: 0.5, visible: false,
          summary: "Un paso de montaña helado con un altar que nadie recuerda.",
          secret: "El altar es la segunda llave. Lo vigila un gigante de escarcha.",
          items: []
        },
        {
          id: "torre", name: "Torre de Ceniza", kind: "Mazmorra", x: 0.38, y: 0.62, visible: false,
          summary: "Ruinas de una torre de magos.",
          secret: "Aquí empezó el fuego del bosque.",
          items: []
        }
      ]
    },
    sessions: [
      {
        id: "s6", n: 6, status: "closed", test: false, date: "2026-11-12", title: "La cripta bajo el campanario",
        recap: "El grupo llegó a Vel Arath y encontró la ciudad en silencio. Doran Brasaviva insinuó que el gremio sabe por qué callaron las campanas. Tras una pelea con goblins en el mercado, Mirra encontró una llave de hierro con el sello del gremio. La sesión terminó a las puertas de la cripta, bajo el campanario."
      }
    ],
    scenes: exampleScenes(), // escenas tácticas preparadas (por lugar) y la biblioteca (sin lugar)
    board: null,             // la mesa táctica en directo
    tokens: [],              // fichas sobre la mesa
    presentation: null, // lo que el máster está mostrando a todos
    presence: {}        // quién está conectado (por pestaña)
  };
}
