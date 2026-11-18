// Campaña de ejemplo para probar la app. Se sustituirá por la vuestra.
export function seed() {
  return {
    version: 1,
    rev: 1,
    campaign: { name: "Las Puertas de Vel Arath", session: 7, rules: "D&D 2024" },
    users: [
      { id: "dm", name: "El máster", role: "dm", initials: "M", color: "#d6aa4e" },
      { id: "j1", name: "Jugador 1", role: "player", initials: "J1", color: "#79a85a", character: "mirra" },
      { id: "j2", name: "Jugador 2", role: "player", initials: "J2", color: "#c97a3d", character: "brena" },
      { id: "j3", name: "Jugador 3", role: "player", initials: "J3", color: "#7d8fe0", character: "ilyas" },
      { id: "j4", name: "Jugador 4", role: "player", initials: "J4", color: "#e0d6b0", character: "osric" }
    ],
    characters: [
      { id: "mirra", owner: "j1", name: "Mirra Zarzal", species: "Mediana", cls: "Pícara", level: 5, initials: "MZ", color: "#79a85a" },
      { id: "brena", owner: "j2", name: "Brena Martillo-Ceniza", species: "Enana", cls: "Guerrera", level: 5, initials: "BR", color: "#c97a3d" },
      { id: "ilyas", owner: "j3", name: "Ilyas Vel", species: "Elfo", cls: "Mago", level: 5, initials: "IV", color: "#7d8fe0" },
      { id: "osric", owner: "j4", name: "Hermano Osric", species: "Humano", cls: "Clérigo", level: 5, initials: "HO", color: "#e0d6b0" }
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
        n: 6, title: "La cripta bajo el campanario",
        recap: "El grupo llegó a Vel Arath y encontró la ciudad en silencio. Doran Brasaviva insinuó que el gremio sabe por qué callaron las campanas. Tras una pelea con goblins en el mercado, Mirra encontró una llave de hierro con el sello del gremio. La sesión terminó a las puertas de la cripta, bajo el campanario."
      }
    ],
    presentation: null, // lo que el máster está mostrando a todos
    presence: {}        // quién está conectado (por pestaña)
  };
}
