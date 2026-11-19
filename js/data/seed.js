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
        hp: { max: 33, cur: 27, temp: 0 }, ac: 15, speed: 7.5,
        weapons: [{ id: "w1", name: "Estoque", atk: "+7", dmg: "1d8+4 perforante", notes: "Sutil" }, { id: "w2", name: "Arco corto", atk: "+7", dmg: "1d6+4 perforante", notes: "24/96 m" }],
        inventory: [{ id: "i1", name: "Herramientas de ladrón", qty: 1, weight: 1 }, { id: "i2", name: "Llave de hierro del gremio", qty: 1, weight: 0, notes: "Encontrada en el mercado" }, { id: "i3", name: "Armadura de cuero tachonado", qty: 1, weight: 13, equipped: true }],
        coins: { po: 34, pp: 12, pe: 0, pc: 5 },
        features: [{ id: "f1", name: "Ataque furtivo (3d6)", text: "Una vez por turno, daño extra si tienes ventaja o un aliado junto al objetivo." }, { id: "f2", name: "Acción astuta", text: "Correr, Destrabarse o Esconderse como acción adicional." }] }),
      newCharacter({ id: "brena", owner: "j2", name: "Brena Martillo-Ceniza", species: "Enana", cls: "Guerrera", subclass: "Campeona", background: "Soldado", level: 5, xp: 6800, initials: "BR", color: "#c97a3d",
        abilities: { fue: 17, des: 10, con: 16, int: 8, sab: 12, car: 10 }, saves: ["fue", "con"], skills: { atletismo: 1, intimidacion: 1, percepcion: 1 },
        hp: { max: 49, cur: 49, temp: 0 }, ac: 18, speed: 9,
        weapons: [{ id: "w1", name: "Hacha de guerra", atk: "+6", dmg: "1d8+3 cortante", notes: "Versátil (1d10)" }] }),
      newCharacter({ id: "ilyas", owner: "j3", name: "Ilyas Vel", species: "Elfo", cls: "Mago", subclass: "Evocador", background: "Sabio", level: 5, xp: 6600, initials: "IV", color: "#7d8fe0",
        abilities: { fue: 8, des: 14, con: 14, int: 18, sab: 12, car: 10 }, saves: ["int", "sab"], skills: { arcanos: 1, historia: 1, investigacion: 1 },
        hp: { max: 32, cur: 32, temp: 0 }, ac: 12, speed: 9,
        spells: { slots: { 1: { max: 4, used: 1 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } },
          list: [{ id: "s1", name: "Rayo de escarcha", level: 0, prepared: true }, { id: "s2", name: "Proyectil mágico", level: 1, prepared: true }, { id: "s3", name: "Escudo", level: 1, prepared: true }, { id: "s4", name: "Paso brumoso", level: 2, prepared: true }, { id: "s5", name: "Bola de fuego", level: 3, prepared: true }] } }),
      newCharacter({ id: "osric", owner: "j4", name: "Hermano Osric", species: "Humano", cls: "Clérigo", subclass: "Dominio de la Vida", background: "Acólito", level: 5, xp: 6700, initials: "HO", color: "#e0d6b0",
        abilities: { fue: 14, des: 10, con: 14, int: 10, sab: 17, car: 12 }, saves: ["sab", "car"], skills: { medicina: 1, religion: 1, perspicacia: 1 },
        hp: { max: 38, cur: 38, temp: 0 }, ac: 18, speed: 9,
        spells: { slots: { 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 }, 3: { max: 2, used: 0 } },
          list: [{ id: "s1", name: "Llama sagrada", level: 0, prepared: true }, { id: "s2", name: "Curar heridas", level: 1, prepared: true }, { id: "s5", name: "Bendición", level: 1, prepared: true }, { id: "s6", name: "Palabra de curación", level: 1, prepared: true }, { id: "s3", name: "Arma espiritual", level: 2, prepared: true }, { id: "s4", name: "Revivir", level: 3, prepared: true }] } })
    ],
    world: {
      map: null, // null = mapa de ejemplo generado; si no, clave de la imagen subida
      // Regiones dibujadas sobre el mapa global (contornos en 0–1)
      regions: [
        { id: "reg-norte", name: "Marca de Hollín", color: "#6f9a3d", visible: true, summary: "Bosques viejos al norte del río; los elfos vigilan sus lindes.", secret: "Algo se mueve bajo las raíces del gran fresno.",
          pts: [{ x: 0.12, y: 0.12 }, { x: 0.46, y: 0.1 }, { x: 0.5, y: 0.36 }, { x: 0.36, y: 0.46 }, { x: 0.14, y: 0.42 }] },
        { id: "reg-valle", name: "Valle del Grisvela", color: "#d6aa4e", visible: true, summary: "Tierras de labor y caminos reales alrededor de Vel Arath.", secret: "",
          pts: [{ x: 0.46, y: 0.1 }, { x: 0.8, y: 0.16 }, { x: 0.78, y: 0.54 }, { x: 0.52, y: 0.58 }, { x: 0.36, y: 0.46 }, { x: 0.5, y: 0.36 }] },
        { id: "reg-sur", name: "Costa de Ceniza", color: "#b0563c", visible: false, summary: "Acantilados, sal y la vieja torre.", secret: "La torre fue un faro de los antiguos reyes.",
          pts: [{ x: 0.14, y: 0.42 }, { x: 0.36, y: 0.46 }, { x: 0.52, y: 0.58 }, { x: 0.78, y: 0.54 }, { x: 0.82, y: 0.86 }, { x: 0.2, y: 0.86 }] }
      ],
      places: [
        {
          id: "velarath", name: "Vel Arath", kind: "Ciudad", icon: "capital", size: "capital", tint: "humanos", x: 0.47, y: 0.42, visible: true,
          summary: "Ciudad amurallada sobre el río Grisvela. Sus campanas llevan tres días calladas.",
          secret: "El gremio de herreros guarda la llave de la cripta bajo el campanario.",
          items: [
            { id: "i1", type: "text", title: "El campanario", text: "Una torre de piedra negra que domina la plaza. Nadie entra desde que callaron las campanas.", revealed: true },
            { id: "i2", type: "text", title: "Rumor de la taberna", text: "Dicen que el herrero Doran Brasaviva sabe más de lo que cuenta.", revealed: false }
          ]
        },
        { id: "mercado", parent: "velarath", name: "Barrio del mercado", kind: "Distrito", x: 0.5, y: 0.5, visible: true,
          summary: "Toldos de colores, olor a pan y a hierro caliente. Los pregoneros gritan precios y los guardias vigilan con desgana.",
          secret: "Desde que callaron las campanas, alguien vende en el mercado mercancía del almacén saqueado.", items: [] },
        { id: "ciervo", parent: "mercado", name: "Posada El Ciervo Rojo", kind: "Localización", x: 0.5, y: 0.5, visible: true,
          summary: "Buena comida, habitaciones baratas y una chimenea que nunca se apaga.",
          secret: "Elvira esconde a un fugitivo en el sótano.", items: [] },
        { id: "campanario", parent: "velarath", name: "El campanario", kind: "Localización", x: 0.5, y: 0.5, visible: true,
          summary: "Una torre de piedra negra que domina la plaza.", secret: "Bajo la torre está la cripta. La llave la tiene el gremio.", items: [] },
        {
          id: "hollin", name: "Bosque de Hollín", kind: "Región", icon: "bosque", size: "grande", tint: "elfos", x: 0.3, y: 0.33, visible: true,
          summary: "Un bosque quemado que aún humea. Los caminos cambian de sitio.",
          secret: "La druida Ceniza vive en el corazón del bosque y conoce el origen del fuego.",
          items: [
            { id: "i3", type: "text", title: "Huellas en la ceniza", text: "Algo grande camina por el bosque de noche. Sus huellas tienen tres dedos.", revealed: false }
          ]
        },
        {
          id: "salobre", name: "Puerto Salobre", kind: "Pueblo", icon: "puerto", size: "normal", tint: "mar", x: 0.62, y: 0.66, visible: true,
          summary: "Puerto pesquero con mala fama y buena cerveza.",
          secret: "", items: []
        },
        {
          id: "grisvela", name: "Paso de Grisvela", kind: "Punto de interés", icon: "montana", size: "pequeno", tint: "enanos", x: 0.57, y: 0.5, visible: false,
          summary: "Un paso de montaña helado con un altar que nadie recuerda.",
          secret: "El altar es la segunda llave. Lo vigila un gigante de escarcha.",
          items: []
        },
        {
          id: "torre", name: "Torre de Ceniza", kind: "Mazmorra", icon: "torreoscura", size: "normal", tint: "peligro", x: 0.38, y: 0.62, visible: false,
          summary: "Ruinas de una torre de magos.",
          secret: "Aquí empezó el fuego del bosque.",
          items: []
        }
      ]
    },
    sessions: [
      {
        id: "s6", n: 6, status: "closed", test: false, date: "2026-11-12", xp: [{ name: "Todo el grupo", amount: 450, reason: "Pelea del mercado y pistas sobre el gremio" }], title: "La cripta bajo el campanario",
        recap: "El grupo llegó a Vel Arath y encontró la ciudad en silencio. Doran Brasaviva insinuó que el gremio sabe por qué callaron las campanas. Tras una pelea con goblins en el mercado, Mirra encontró una llave de hierro con el sello del gremio. La sesión terminó a las puertas de la cripta, bajo el campanario."
      }
    ],
    // Lore: personajes, facciones, eventos, galería, notas y la preparación de la próxima sesión
    lore: [
      { id: "elvira", kind: "npc", name: "Elvira", role: "Posadera de El Ciervo Rojo · antigua aventurera", place: "ciervo", revealed: true, img: null, at: 1,
        summary: "Mujer de pelo cano y manos de espadachina. Trata a todos como a viejos amigos.", secret: "Oculta a Tomás, aprendiz del gremio, en el sótano. Lo buscan por ver algo en el campanario.", links: ["gremio"] },
      { id: "doran", kind: "npc", name: "Doran Brasaviva", role: "Maestro herrero", place: "mercado", revealed: true, img: null, at: 2,
        summary: "Herrero enorme y nervioso. Miente fatal.", secret: "Sabe que el gremio guarda la llave de la cripta. Teme a su propio maestre.", links: ["gremio"] },
      { id: "dorian", kind: "npc", name: "Dorian", role: "Comerciante de telas", place: "mercado", revealed: false, img: null, at: 3,
        summary: "Joven, bien vestido, a la defensiva.", secret: "No es el ladrón: protege a su hermana, que robó del almacén.", links: [] },
      { id: "merek", kind: "npc", name: "Merek", role: "Comerciante de telas", place: "mercado", revealed: false, img: null, at: 4,
        summary: "Mayor, de voz potente. Se ofende con facilidad.", secret: "Quiere quitarse de en medio a un competidor.", links: [] },
      { id: "gremio", kind: "faction", name: "Gremio de herreros", place: "velarath", revealed: true, img: null, at: 5,
        summary: "El gremio más rico de Vel Arath. Su sello es un yunque con una campana.", secret: "Su maestre hizo callar las campanas para abrir la cripta sin testigos.", links: [] },
      { id: "altercado", kind: "event", name: "Un altercado en el mercado", place: "mercado", etype: "preparado", status: "pendiente", revealed: false, img: null, at: 6,
        summary: "Dos comerciantes discuten a gritos junto a un carro de telas. Uno acusa al otro de vender mercancía robada. Un guardia observa desde lejos.",
        secret: "La mercancía procede del almacén saqueado. Dorian no es el ladrón: está protegiendo a alguien. Merek intenta deshacerse de un competidor.",
        actions: "Hablar con los comerciantes\nInterrogar al guardia\nInvestigar la mercancía\nIgnorar el altercado", links: ["dorian", "merek"] },
      { id: "puertas", kind: "event", name: "Cierran las puertas al anochecer", place: "velarath", etype: "ambiental", status: "pendiente", revealed: false, img: null, at: 7,
        summary: "Suenan los cuernos de la muralla: las puertas de la ciudad se cierran hasta el alba.", secret: "Quien quede fuera tendrá que sobornar al guardia o colarse por las cloacas.", actions: "", links: [] },
      { id: "nota1", kind: "note", name: "Hilos sueltos", place: null, revealed: false, img: null, at: 8, summary: "",
        secret: "¿Quién robó el almacén? · ¿Qué vio Tomás en el campanario? · La druida Ceniza sabe algo del fuego.", links: [] },
      { id: "cap1", kind: "chapter", name: "Llegada a Vel Arath", session: null, order: 0, place: "velarath", revealed: false, img: null, at: 9, summary: "", secret: "Describir las murallas y el silencio de las campanas. Los guardias de la entrada piden el motivo de la visita.", links: ["puertas"] },
      { id: "cap2", kind: "chapter", name: "El mercado", session: null, order: 1, place: "mercado", revealed: false, img: null, at: 10, summary: "", secret: "Rumores del mercado. Si se aburren, lanzar el altercado.", links: ["altercado", "doran"] },
      { id: "cap3", kind: "chapter", name: "La posada", session: null, order: 2, place: "ciervo", revealed: false, img: null, at: 11, summary: "", secret: "Interior 3D (escena «taberna»). Elvira y el fugitivo oculto.", links: ["elvira"] },
      { id: "cap4", kind: "chapter", name: "La investigación", session: null, order: 3, place: "campanario", revealed: false, img: null, at: 12, summary: "", secret: "Pistas, las cloacas y un encuentro opcional en la cripta.", links: ["gremio"] }
    ],
    clock: { day: 3, min: 17 * 60 + 30 },
    backdrop: null,
    rolls: [], // tiradas de dados compartidas
    chronicle: [ // notas que escriben los jugadores durante cada sesión
      { id: "cr1", session: "s6", by: "j1", name: "Jugador 1", text: "Mirra le birla una llave de hierro a un goblin en plena pelea del mercado. Lleva el sello del gremio de herreros.", at: 1731430000000 },
      { id: "cr2", session: "s6", by: "j4", name: "Jugador 4", text: "Doran Brasaviva miente fatal. Osric cree que el gremio esconde algo bajo el campanario.", at: 1731431000000 }
    ],
    scenes: exampleScenes(), // escenas tácticas preparadas (por lugar) y la biblioteca (sin lugar)
    board: null,             // la mesa táctica en directo
    tokens: [],              // fichas sobre la mesa
    presentation: null, // lo que el máster está mostrando a todos
    presence: {}        // quién está conectado (por pestaña)
  };
}
