# La Mesa

Web para jugar a D&D (reglas de 2024) a distancia con el grupo, sin perder la sensación de mesa física.

## Estado: Hito 1 (conexión real)

- Pantalla de inicio: elegir quién eres (máster o jugador) y vestíbulo con «Anteriormente en…».
- Mapa del mundo: subir vuestro mapa, colocar lugares, contenido oculto o revelado y notas secretas del máster.
- Presentación del máster: lo que él muestra aparece a pantalla completa para todos.
- Cuentas de Google y campañas en Firebase: el máster crea la campaña y comparte un enlace de invitación.
- Sincronización en tiempo real entre todos los participantes (Firestore).
- Modo demostración sin cuenta: añade `?demo` a la dirección.

## Cómo probarlo en tu ordenador

Los módulos de JavaScript no funcionan abriendo el archivo con doble clic; hace falta un servidor local:

```
cd la-mesa
python3 -m http.server 8000
```

Abre `http://localhost:8000` en dos pestañas: en una entra como máster y en la otra como jugador.

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio en GitHub y sube todos los archivos de esta carpeta.
2. En el repositorio: Settings → Pages → Source: «Deploy from a branch», rama `main`, carpeta `/ (root)`.
3. En un par de minutos la web estará en `https://<tu-usuario>.github.io/<repositorio>/`.

No hay paso de compilación: lo que se sube es lo que se publica.

## Estructura

```
index.html            página única
css/app.css           estilos (tokens de color y tipografía al principio)
js/main.js            arranque, navegación y cabecera
js/core/store.js      estado compartido de la campaña
js/core/cloud.js      conexión con Firebase (cuentas, campañas, tiempo real, imágenes)
js/core/firebase-config.js  configuración pública del proyecto de Firebase
firestore.rules       reglas de seguridad (se pegan en la consola de Firebase)
js/core/session.js    quién eres y reglas de permisos
js/core/presence.js   quién está conectado
js/core/images.js     imágenes (mapas, ilustraciones)
js/data/seed.js       campaña de ejemplo
js/data/worldmap.js   mapa de ejemplo dibujado por código
js/views/             una vista por sección (acceso.js: entrar y elegir campaña)
```


## Hito 1.5 · Mundo, sesiones y permisos

- **Mundo → Sesiones.** Ya no hay campañas: se crea un mundo una vez (mapa, lugares, personajes, grupo) y dentro se juegan sesiones que duran lo que duren. Al cerrar una, el resumen pasa a ser el «Anteriormente…» de la siguiente. Las sesiones pasadas se pueden editar.
- **Papeles.** Quien crea el mundo es su **administrador**. En Inicio puede nombrar **másteres** a otros miembros; el resto son **jugadores**.
- **Ver como…** El administrador y los másteres pueden ver la app exactamente como la ve cada jugador.
- **Sesión de pruebas.** Solo la ven el administrador y los másteres; lo que se muestra en ella no llega a los jugadores.
- **Partida.** Escenario común donde el máster decide qué tenéis delante: «Anteriormente…», mapa del mundo, un lugar (con su propio mapa de ciudad o mazmorra), una ilustración o, en el próximo hito, la escena táctica. Si un jugador está en otra sección, le aparece un aviso para volver.
- **Reglas de Firestore nuevas** (`firestore.rules`): hay que publicarlas en la consola de Firebase.

## Hito 2 · Personajes (primera pasada)

- **El grupo:** tarjetas con retrato, clase y nivel, barra de PG, CA, jugador y aviso de «¡Sube de nivel!».
- **Ficha D&D 2024:** ilustración, características y modificadores, salvaciones, habilidades (competencia y pericia), CA, PG (con botones de daño y curación, que gastan primero los temporales), velocidad, iniciativa, competencia, percepción pasiva y dados de golpe.
- **Pestañas:** combate (armas y ataques), inventario (monedas, objetos, peso y capacidad de carga), conjuros (CD, ataque, espacios por nivel que se marcan al gastarlos, conjuros preparados, descanso largo) y rasgos y notas.
- **Experiencia y nivel:** el máster suma PX; al llegar al umbral aparece «Subir a nivel N» con los PG (media o tirada + CON) y los recordatorios del nivel (subclase, mejora de característica, competencia, conjuros).
- **Permisos:** todos ven todas las fichas; cada jugador edita la suya; el administrador y los másteres, todas. Las fichas se guardan aparte (`characters`) para que cada jugador pueda guardar la suya.
- Los datos de clases, conjuros y objetos se escriben a mano de momento; el catálogo del SRD 5.2 llegará en una segunda pasada.

## Hito 3 · Mesa táctica

- **Tablero de casillas** (5 pies por casilla) con terreno (piedra, madera, hierba, tierra, arena, agua, barro, muros), escenografía (árboles, rocas, mesas, barriles, puertas, fuego…) y fichas con retrato. Zoom con la rueda o los botones y desplazamiento arrastrando.
- **Escenas** (pestaña solo para el máster): se preparan por lugar o en la biblioteca para improvisar. Incluye ejemplos: *Pelea en la taberna*, *Emboscada en el camino* y *Emboscada en el puente* (en Vel Arath, con goblins ocultos). Cada escena tiene un punto de inicio del grupo.
- **En la Partida**, el máster carga una escena y todos la ven; el grupo aparece en el punto de inicio. Puede editar la mesa sobre la marcha (añadir enemigos, pintar terreno), guardarla como escena nueva o retirarla.
- **Movimiento:** cada jugador arrastra su miniatura (se ve la distancia en pies); el máster mueve todas.
- **Iniciativa** en una columna junto al tablero: cada jugador escribe su tirada, el máster tira la de los enemigos, empieza el combate y pasa turnos; se marca de quién es el turno y la ronda.
- **Mini-ficha plegable:** tu personaje y el objetivo seleccionado. Daño y curación desde la mesa (en los personajes se aplica a su ficha). Los jugadores ven el estado de los enemigos (ileso, herido, malherido) y no sus PG exactos. Los enemigos ocultos solo los ve el máster.

## Hito 4 · La mesa en 3D

- **Casillas cuadradas de 5 pies** (regla 2024: la diagonal también cuenta 5 pies).
- **Mesa 3D** sobre una mesa de madera: suelos, muros, puertas, columnas, barriles, mesas, cofres, antorchas y velas de *KayKit Dungeon Remastered*; árboles, rocas, arbustos, trampas y hoguera hechos por código.
- **Miniaturas 3D animadas** (*KayKit Adventurers* y *Skeletons*): respiran en reposo, caminan al moverse, miran al bando contrario y caen al llegar a 0 PG. Cada personaje elige su miniatura en la ficha (o se asigna según la clase); los enemigos, en su ficha de la mesa. También hay «peana con retrato».
- **Cámara:** órbita alrededor del centro de la mesa (por defecto), botón **Centrar**, vista **Cenital** y cámara **Libre** (arrastrar con el botón derecho o dos dedos, WASD o flechas, zoom hacia el cursor).
- **Ambientes** (el máster los cambia y los ven todos): Día, Interior y Noche. Antorchas, velas y hogueras con luz parpadeante y fuego de partículas; sombras reales.
- **Muros bajos o altos**, como una maqueta de mesa con los muros recortados.
- La vista 2D sigue disponible (botón «Ver plano 2D») y se usa para editar.
- Escena nueva de ejemplo: **La cripta bajo el campanario** (Vel Arath, de noche, con esqueletos y un guardián oculto).
- Créditos y licencias en `CREDITS.md`. Los modelos son CC0.

### Peanas de cartón (formato universal de miniaturas)
- Cualquier criatura sale en la mesa como **peana de cartón**: tarjeta gruesa con ilustración por las dos caras, canto del color de su bando (dorado jugadores, rojo enemigos, azul PNJ) y placa con el nombre.
- **Imagen:** la ilustración de la ficha (jugadores), la que suba el máster (enemigos y PNJ) o, si no hay, una **silueta** de una biblioteca de 45 criaturas (goblin, orco, dragón, lobo, araña, no muerto, bandido, cultista…) que se elige sola por el nombre («Jefe goblin» → goblin).
- **Vida:** la peana se tambalea al recibir daño, se inclina al moverse y cae tumbada al llegar a 0 PG. Las figuras 3D hacen lo mismo con sus animaciones (golpe recibido, caída).
- Las figuras 3D quedan como opción: se eligen en la ficha (jugadores) o en el editor del enemigo. Sin ilustración, cada jugador lleva una silueta según su clase.

## Hito 5 · Ambiente de combate

- **Estados (reglas 2024):** agarrado, apresado, asustado, aturdido, cegado, derribado, ensordecido, envenenado, hechizado, incapacitado, inconsciente, invisible, paralizado, petrificado, agotamiento (con nivel 1–6) y concentración. Cada uno con su **anillo de color en la peana** (como los anillos de estado de las mesas reales), **etiqueta escrita** sobre la figura, punto de color en la iniciativa y su explicación en la mini-ficha. Derribado tumba la figura, invisible la vuelve translúcida y petrificado la vuelve gris. Los pone el máster o el propio jugador en su personaje.
- **Efectos de conjuro:** bola de fuego, proyectil mágico, relámpago, rayo de escarcha, llama sagrada, curar heridas, escudo y onda atronadora. Se lanzan desde la mini-ficha eligiendo el objetivo en la mesa (con el área marcada); los ven todos y las figuras hacen la animación de lanzar. Con efectos de área, el máster recibe la lista de afectados para aplicar el daño completo o la mitad.
- **Niebla de guerra y oscuridad** (botón «Niebla» del máster): el grupo ve lo que alcanzan sus personajes en pie; los muros tapan la visión. De noche solo se ve lo iluminado (antorchas, hogueras, velas) o lo que alcanza la visión en la oscuridad de cada personaje (nuevo campo en la ficha, con valor por defecto según la especie). Lo ya explorado queda en penumbra; lo no explorado, oculto. Funciona también en la vista 2D.

## Hito 6 · Puertas, sonido y crónica

- **Puertas:** cerradas tapan la visión (y la luz) y los jugadores no pueden entrar en su casilla; el máster las abre o cierra con un clic en la mesa 3D.
- **Sonido generado en el navegador** (sin archivos): ambientes de lluvia, viento, hoguera, mazmorra, bosque y taberna, que elige el máster y suenan a todos; golpes, caídas, puertas y un sonido para cada conjuro. Cada uno controla su volumen o lo silencia. Cada escena de ejemplo trae su ambiente.
- **Crónica:** durante la partida cualquiera anota lo que pasa (barra inferior de la Partida o pestaña Crónica). Al cerrar la sesión, el resumen se rellena con esas notas y el máster **reparte la experiencia** a cada personaje con su motivo («A todos» para ir rápido). La crónica guarda resúmenes, notas y PX de cada sesión, y todo se puede corregir después.

## Hito 7 · Reglas en español, dados y combate

- **Reglas (nueva pestaña):** el SRD 5.2.1 oficial en español completo.
  - **Libro de reglas** por capítulos (Cómo jugar, Creación de personajes, Clases, Trasfondos y especies, Dotes, Equipo, Conjuros, Glosario, Herramientas del máster, Objetos mágicos, Monstruos, Animales) con buscador en las 398 páginas.
  - **Conjuros** (339) con filtros por nivel y clase.
  - **Monstruos** (320) con su perfil: CA, PG, velocidad, características, ataques y perfil completo. El máster los pone en la mesa con un clic (o en una escena preparada desde el editor de Escenas).
- **Medidas en metros**, como el manual en español: 1,5 m por casilla.
- **Dados 3D** que ruedan sobre la mesa junto a quien tira (d4, d6, d8, d10, d12, d20 y d100), con sonido.
- **Tabla de tiradas compartida** (pestaña 🎲 Tiradas junto a la iniciativa, o botón en la Partida): todos ven cada tirada con sus dados; los ataques y el daño quedan **pendientes del máster**, que puede confirmar, cambiar impacto↔fallo, corregir el total o anular. Bandeja de dados con modificador, ventaja/desventaja, expresiones libres y tiradas secretas del máster.
- **Combate:** el jugador toca un enemigo (objetivo) y pulsa ⚔️ Atacar con su arma o conjuro de ataque preparado; la app tira contra la CA (20 natural = crítico, 1 = fallo), el máster confirma, el jugador tira el daño (dados dobles en crítico) y al confirmarlo se resta de los PG. Los enemigos atacan con sus ataques del manual eligiendo objetivo.
- **Desde la ficha:** pulsar en una característica, salvación o habilidad tira el dado. Los conjuros se eligen del compendio (📖 para leerlos). Iniciativa con 🎲 en la columna de iniciativa.

Los datos de `js/data/srd/` se generan con `tools/srd_pages.py` y `tools/srd_parse.py` a partir del PDF oficial del SRD 5.2.1 en español.

## Hito 8 · El combate según el manual

- **Orden del combate (reglas 2024):** el máster pulsa **⚔️ Iniciar combate** → los enemigos tiran su iniciativa en secreto y a cada jugador le aparece «🎲 Tirar iniciativa» sobre la mesa → **▶ Empezar ronda 1** → turnos en orden de iniciativa (las criaturas caídas se saltan) → **Terminar turno** (lo pulsa quien tiene el turno o el máster) → nueva ronda al dar la vuelta.
- **Cola de turnos** sobre la mesa con la ronda y quién va ahora, y aviso grande «¡Es tu turno!» con sonido.
- **Tarjeta del turno:** 🦶 movimiento gastado/velocidad en metros (se descuenta al arrastrar la figura; «Correr» lo duplica), ⚡ acción, ✦ acción adicional, ↺ reacción (se recupera al empezar tu turno) y las acciones del manual (Atacar, Magia, Correr, Destrabarse, Esquivar, Ayudar, Esconderse, Buscar, Estudiar, Influir, Preparar una acción, Utilizar), cada una con su regla del glosario. Fuera de su turno, un jugador no puede mover su figura.
- **Puntería:** línea desde quien actúa hasta el objetivo con la **distancia en metros**, si está **al alcance**, a **alcance largo** o **fuera de alcance**, y la **cobertura** (media +2, tres cuartos +5, total). Cada arma o conjuro muestra ✓ ⚠ ✗ según el alcance.
- **Ventaja y desventaja automáticas** con su motivo (objetivo aturdido, derribado, cegado, invisible, esquivando; atacante envenenado, derribado…; alcance largo; disparar con un enemigo al lado). Se puede forzar a mano. Crítico automático contra paralizados o inconscientes a 1,5 m.
- **El libro abierto para el máster:** cada tirada tiene 📖 con los motivos, la cobertura, los estados del objetivo explicados, sus **resistencias, inmunidades o vulnerabilidades** al tipo de daño (con el botón de aplicar mitad o doble ya sugerido) y las entradas del glosario oficial (Ataque con arma, Crítico, Cobertura, Resistencia…).
- Glosario del SRD (157 entradas) en `js/data/srd/glosario.json` (`tools/srd_glosario.py`). Los monstruos traen el alcance de sus ataques y su velocidad.

## Hito 9 · Dados con física, jugadores en la mesa y reglas con aspecto de libro

- **Dados con física real** (cannon-es): se lanzan arrastrando sobre el tapete verde del panel de Tiradas (la fuerza y la dirección del gesto cuentan). Ruedan, rebotan y suenan en una bandeja de fieltro con bordes de madera que aparece cerca de ti en el tablero 3D. Todos ven exactamente la misma tirada: la simulación usa la misma semilla en cada pantalla.
- **Bolsa de dados**: un clic en un dado lo añade y un clic derecho lo quita. Puedes tirar varios a la vez (p. ej. 1d20 + 2d6).
- **Juegos de dados**: rubí, zafiro, esmeralda, amatista, obsidiana, oro, hueso y madera. Cada jugador elige el suyo.
- **Efectos de crítico**: un 20 natural trae destello dorado y fanfarria; un 1 natural, «Pifia» en rojo. Los últimos instantes de la tirada van a cámara lenta.
- **Jugadores en la mesa**: al cargar una escena solo bajan los personajes de quien está conectado. En «Escena táctica» el máster marca o desmarca personajes para meterlos en la situación o sacarlos de ella.
- **Reglas maquetadas**: el libro se lee como una página de pergamino.
  - Títulos y términos con etiqueta ([acción], [estado]…), tablas, viñetas y negritas de entrada.
  - Las tiradas (2d6) y las CD van resaltadas.
  - Los conjuros llevan ficha propia, y los monstruos un bloque de estadísticas al estilo del manual.

## Hito 10 · Cajetillas de dados y Lore

- **Cajetillas de dados**: cada uno tiene la suya a un lado del tablero (con el color del jugador y su juego de dados).
  - Al tirar, su tapa se abre y sube desde abajo un desplegable con una cámara fija sobre la bandeja.
  - Todos ven rodar los mismos dados, en cualquier sección de la app, y el resultado en grande.
  - Un 20 natural sale en dorado y con destello; un 1, en rojo y con sacudida.
- **Lore**, el libro de campaña:
  - **Lugares por niveles** (región › ciudad › distrito › localización). Una ciudad creada en el mapa aparece sola en el Lore, y desde ahí se le añade todo lo de dentro.
  - **Página de cada lugar**: descripción para los jugadores, secretos del máster, lugares de dentro, personajes, facciones, eventos, galería, notas y las escenas tácticas 3D que se pueden cargar.
  - **Personajes, facciones, eventos, imágenes y notas** con parte pública y parte secreta, imagen y relaciones entre ellos.
  - **Eventos** preparados, espontáneos o ambientales, con sus acciones posibles. Su estado puede ser pendiente, en juego, resuelto o guardado para después.
  - **Mostrar**: a todos, solo a un jugador, solo la imagen o como fondo de la escena, y retirarlo cuando quieras. Al mostrarlo a todos queda revelado en el Lore de los jugadores.
  - **Preparar sesión**: una carpeta de escenas ordenable, con todo lo enlazado a un clic. En la Partida, el panel «Dirección» las tiene a mano.
  - **Reloj de campaña**: día y hora, visible para todos y que el máster adelanta.
  - **Sesiones jugadas**: se corrigen el título, la fecha, el resumen y los PX (la ficha se ajusta en la diferencia), y se pueden eliminar.
- Firestore guarda el Lore en la colección `lore`; los secretos van en `secrets`. Hay que publicar las reglas nuevas.

## Hito 11 · Reglas de la partida y columna del jugador

- **Columna fija del jugador**, a la derecha y del mismo ancho que el panel del máster. El tablero, o lo que muestre el máster, ocupa el resto. Tiene tres partes:
  - **Iniciativa**, cuando hay mesa táctica.
  - **Ficha de bolsillo**: PG, CA, velocidad, estados, salvaciones y pruebas con un clic, ataques, conjuros y descansos.
  - **Tapete de dados** con la tabla de tiradas.
- **Conjuros completos**, leídos del SRD:
  - Lanzar elige el espacio de conjuro, con mejora por nivel superior, y gasta la acción, la acción adicional o la reacción que toque.
  - **Con salvación** (Bola de fuego, Rociada de color…):
    - una tirada de daño para todos y una salvación por objetivo con la CD del lanzador;
    - mitad de daño si la supera, cuando el conjuro lo dice;
    - estados a quien falla;
    - el botón «Marcar los del área» elige a quien está dentro del área;
    - el máster revisa objetivo por objetivo (con avisos de resistencia, inmunidad y vulnerabilidad) y pulsa «Aplicar a todos».
  - **Curación** (Curar heridas, Palabra de curación): dados más el modificador de aptitud mágica.
  - **Con ataque** y **daño directo** (Proyectil mágico).
  - **Beneficios**: Bendición y Perdición suman o restan 1d4 a ataques y salvaciones.
  - Los trucos escalan con el nivel del personaje.
- **Concentración**: un conjuro nuevo termina el anterior. Al recibir daño, salvación de Constitución (CD 10 o la mitad del daño); si falla, el conjuro y sus estados terminan.
- **0 PG**:
  - inconsciente y derribado;
  - salvaciones contra muerte en el turno (10 o más es éxito, un 1 cuenta dos fallos, un 20 levanta con 1 PG);
  - daño a 0 PG es un fallo, dos si es crítico;
  - muerte instantánea si el daño sobrante iguala los PG máximos;
  - cualquier curación despierta.
- **Ataques de oportunidad**: al salir del alcance de un enemigo que conserva su reacción (y sin haberse destrabado), la mesa lo ofrece; quien lo controla ataca o lo deja pasar.
- **Modificadores**:
  - el agotamiento resta 2 por nivel a ataques y salvaciones;
  - paralizado, aturdido, inconsciente o petrificado fallan las salvaciones de Fuerza y Destreza;
  - apresado da desventaja y esquivando ventaja en Destreza;
  - la cobertura suma a las salvaciones de Destreza.
- **Descansos**:
  - Corto: dados de golpe más Constitución; el brujo recupera sus espacios.
  - Largo: todo se recupera y se quita un nivel de agotamiento.

## Hito 12 · Feedback visual y lectura rápida

Con ideas de referentes: registro de combate de una frase (Baldur's Gate), probabilidad de impactar (Baldur's Gate 3), tarjetas de acción con los detalles plegados y daño aplicable desde la misma tarjeta (Foundry VTT).

- **Registro compacto**:
  - Una línea por acción: icono, «Quién → a quién · con qué», número grande y una píldora con el resultado (Impacto, Fallo, ¡Crítico!, ✓/✗ CD).
  - El daño del ataque va en la misma tarjeta, y el máster lo confirma ahí (✓, ½, ✎, ✕).
  - Los conjuros llevan una ficha por objetivo con su salvación y el daño.
  - Un clic en la línea despliega los dados, los motivos y las reglas.
  - Color por tipo de acción, y borde dorado mientras algo espera al máster.
- **Texto flotante sobre las figuras**: daño en rojo, curación en verde, «¡Cae!» o «Inconsciente», «Fallo», «¡Crítico!», «✓ Salva / ✗ Falla», «¡Oportunidad!», y los estados que se ponen o se quitan con su color. Lo que depende de los dados sale cuando la cajetilla muestra el resultado.
- **Probabilidad antes de actuar**:
  - Al apuntar, una barra con la probabilidad de impactar (con ventaja y cobertura).
  - Al elegir objetivos de un conjuro, la de que fallen la salvación.
  - El máster ve el porcentaje; los jugadores, una palabra («Probable», «Incierto»…), para no destapar la CA de los enemigos.
- Menos avisos emergentes: lo que ya se ve en la mesa no se repite en un aviso.

## Hito 13 · Editor de mapas y texturas

- **Herramientas**:
  - mover y seleccionar;
  - pincel de terreno (1×1, 2×2, 3×3 o 5×5);
  - rellenar un rectángulo;
  - **habitación** (suelo y muros de un trazo);
  - **muro en línea**;
  - objetos por categorías;
  - enemigo;
  - borrar con tamaño;
  - **deshacer y rehacer** (Ctrl+Z y Ctrl+Y).
  - Se ve una vista previa de lo que vas a pintar y de las medidas en metros.
- **Mapa**: cambiar el tamaño, rellenarlo todo, y **generar mazmorra** (salas, pasillos, puertas de varios tipos, antorchas, mobiliario según el tipo de sala, tesoro, trampa oculta y notas del máster) o **generar cueva**. Al crear una escena nueva se puede empezar por una mazmorra o una cueva generadas, o por el vacío.
- **Terrenos**: 24 tipos.
  - Interior: losas, adoquines, mármol, tablones, alfombra, suelo de cueva y escombros.
  - Exterior: hierba, maleza, tierra, camino, arena, barro, nieve y hielo.
  - Agua poco profunda y profunda, lava y abismo.
  - Muros de piedra, ladrillo, madera, roca de cueva, seto y vacío.
  - Reglas: el **terreno difícil** cuesta el doble al moverse (también en combate) y se marca con un rayado. Los peligros llevan una nota para el máster.
- **Objetos**: 46, en Mobiliario, Luz, Mazmorra, Naturaleza, Puertas, Trampas, Tesoro y Marcas.
  - **Puertas** normales, cerradas con llave, secretas y rastrillos. Al ponerlas en un muro abren el hueco solas. El rastrillo deja ver a través.
  - **Cobertura** de la escenografía: media para mesas, barriles y árboles; tres cuartos para columnas, estatuas y peñascos. Lo macizo no se puede atravesar.
  - **Ocultos** (trampas, puertas secretas, notas): el máster los ve con borde violeta discontinuo (en 3D, translúcidos) y los jugadores no los ven hasta que se revelan.
  - **Tesoros** con su contenido, y **trampas** con CD para detectarlas, salvación, CD y daño. Se editan seleccionándolos; se giran con R y se quitan con Supr.
- **En partida** (máster), tocando un objeto:
  - revelarlo;
  - **anunciar el contenido** en la mesa;
  - **disparar la trampa** sobre quien esté en esa casilla.
  - En combate, pisar una trampa la dispara sola: se revela, se tiran las salvaciones y el máster lo aplica como un conjuro.
- **Texturas nuevas**, dibujadas por código y sin costuras, iguales en 2D y 3D. En 3D llevan relieve, el agua y la lava se mueven y la lava brilla. Cada tipo de muro tiene su textura, y hay escenografía 3D nueva para todo lo que no tenía modelo.

## Hito 14 · Movimiento por turnos, combate más legible, experiencia, bestiario, Lore y personajes

- **Movimiento según las reglas**:
  - En tu turno se mide siempre desde la casilla donde empezaste. Puedes recolocarte y volver al origen, que queda marcado.
  - Las casillas a las que llegas se sombrean en un tono translúcido, el terreno difícil en ámbar, y la zona que solo alcanzas Corriendo, más tenue y en violeta.
  - Al arrastrar se ve el recorrido y un texto discreto: metros gastados, «Correr: gastas tu acción», «terreno difícil», «arrastrándote».
  - No se puede ir más allá: el jugador no pasa de su límite (el máster sí, con aviso). Si vuelves a tu alcance normal, recuperas la acción.
  - Muros, objetos macizos, puertas cerradas y enemigos bloquean el paso; los aliados se atraviesan, pero no se acaba encima de nadie.
  - Estar derribado cuesta el doble; apresado, aturdido, paralizado o inconsciente impiden moverse.
- **Combate más compacto**: el turno ocupa dos líneas (acción, adicional, reacción, movimiento y «Terminar») con las otras acciones plegadas. El jugador ve el objetivo en pequeño, con la probabilidad de impactar y sus ataques; su ficha está en la columna de la derecha.
- **Lectura del mapa**: texto flotante más grande y con brillo, peanas y etiquetas algo mayores, y estados en 3D con etiquetas grandes de alto contraste. Cada jugador pone y quita los estados de su personaje desde su ficha, y puede leer qué hacen.
- **Experiencia** (SRD 5.2.1): cada criatura vale los PX de su VD. Al terminar el combate aparece el reparto de lo derrotado a partes iguales entre los personajes que estaban en la mesa. El máster puede cambiar la cantidad y pulsa «Repartir»; se avisa si alguien puede subir de nivel.
- **Bestiario**:
  - Un selector de criaturas con búsqueda, filtros por tipo (No muerto, Bestia, Dragón…) y por VD, y la ficha completa.
  - **Ajuste de nivel (VD)** antes de desplegar: PG, CA, ataque y daño escalados, con sus PX.
  - Elegir cuántas se despliegan.
  - El máster puede **poner imagen** y cambiar CA, PG y notas de cada criatura en su mundo; la imagen sale en la peana.
  - Se usa desde Escenas, desde la Partida («👹 Añadir criaturas…») y desde Reglas › Monstruos, que ahora también filtra por tipo.
- **Lore**: nuevas secciones **Dioses** (dominio y símbolo) y **Batallas** (cuándo y resultado).
- **Personajes**: pestaña **Trasfondo** con la historia y hasta 5 recuerdos (foto con su texto).
- **Crónica**: cada sesión se pliega en una línea con su título, la fecha, un extracto, las notas y los PX. Se despliega al pulsarla, y hay botones para desplegarlo o plegarlo todo.

## Hito 15 · Símbolos del mapa y luz más natural en 3D

- **64 símbolos** para el mapa del mundo (game-icons.net, CC BY 3.0), en 8 categorías:
  - asentamientos (capital, ciudad, pueblo, aldea, granja, molino, puerto);
  - pueblos y culturas (ciudad élfica, árbol sagrado, fortaleza enana, mina, villa mediana, campamento orco, salón del norte, campamento del desierto, guarida pirata);
  - fortalezas y caminos;
  - mazmorras y guaridas;
  - religión y magia;
  - viaje y descanso (posada, campamento, faro, cruce…);
  - naturaleza;
  - aventura.
- **Tamaño por importancia**: capital (con doble aro y nombre en mayúsculas), grande, normal, pequeño y diminuto.
- **Color por pueblo o bando**: humanos, elfos, enanos, medianos, orcos y goblins, feéricos, no muertos, mar y peligro.
- Si no se elige, el símbolo y el tamaño se deducen del tipo de lugar. Los ocultos se ven con borde discontinuo (solo el máster).
- **3D**:
  - Las antorchas ya no parpadean deprisa: respiran despacio.
  - Muros y suelos son mates y con menos relieve, así que los reflejos ya no «bailan» por las paredes.

## Hito 16 · Dados que ruedan, panel del máster en dos modos, plantas y vida a la vista

- **Dados**: bandeja alargada (como una mesa de craps). Los dados entran por la izquierda y cruzan el tapete rebotando en las bandas. Son más grandes y llevan números con contorno. Al pararse, cada dado da un pequeño salto con un anillo de luz y, si hay varios, una chapa con su valor. El desplegable ocupa la mitad que antes (≈24 % de alto) y el total sale a la izquierda.
- **Tiradas sin tapete de arrastrar**: botonera de dados (clic suma, clic derecho quita), «la mano» con lo elegido y **Tirar**. El d100 se queda: el SRD lo usa en tablas como la de Teletransporte, las bagatelas o la Baraja misteriosa. Se lanza como dos d10 (decenas y unidades).
- **Panel del máster con dos modos** (en su columna secreta, la única):
  - **⚔️ Táctica de combate**: barra rápida (Editar la mesa, Criaturas) y pestañas **Iniciativa | Tiradas**. Ya no hay columna de iniciativa dentro del tablero.
  - **🎭 Roleplay**: sesión, dirección, escenas preparadas, escena táctica y mostrar al grupo.
  - El panel cambia solo a Táctica al sacar la mesa y vuelve a Roleplay al retirarla.
- **Columna del jugador**: la ficha manda (ocupa casi todo). Debajo, pestañas **🎲 Tiradas | ⚔️ Iniciativa**.
- **Tira de iniciativa** pegada al borde superior de la mesa durante el combate. Muestra el orden, quién actúa, la vida y los estados de cada uno; toca un retrato para seleccionarlo.
- **Filas de iniciativa mínimas**: número, nombre, puntos de estado y una barra de vida. Para los enemigos, la barra y el texto son aproximados («Herido»…).
- **Vida siempre visible** sobre cada figura (3D y 2D), exacta para el máster y los personajes, a ojo para los enemigos. Las heridas y curaciones lanzan una onda en la peana, una columna de luz (roja o verde) y un destello en la fila y en la tira de iniciativa.
- **Plantas del mapa** (torres, sótanos):
  - En la mesa, el selector 🏰 permite añadir una planta encima o un sótano, y renombrarlas o quitarlas.
  - **Ir con el grupo** cambia de planta llevándose a los personajes. **Ir sin nadie** cambia de planta sin moverlos. **Enviar a…** manda solo la ficha seleccionada a otra planta.
  - Las escenas preparadas también tienen plantas (panel derecho del editor) y se guardan y cargan con ellas.
- **Editar la mesa en plena partida**:
  - Los jugadores siguen viendo la mesa, con un aviso discreto («El máster está retocando la mesa…»).
  - La mesa 3D monta los cambios de uno en uno y siempre termina con la última versión. Antes, cada retoque cancelaba el montaje en curso y la mesa podía quedarse en «Montando la mesa…».
  - Una pieza que falle ya no deja la mesa vacía.

## Hito 17 · Saber siempre qué toca: barra superior, registro legible y plantas en la pestaña del máster

- **Barra superior de la mesa**, siempre en su sitio, con tres zonas:
  - **Ahora** (izquierda): ronda, de quién es el turno y quién va después. Dice qué falta por hacer y a quién le toca: tirar iniciativa, confirmar un ataque (máster), tirar el daño de un impacto, decidir un ataque de oportunidad, aplicar el daño, resolver un conjuro, la salvación contra muerte o terminar el turno.
    - Trae el botón para hacerlo cuando te toca a ti.
    - En tu turno muestra lo que te queda: acción (A), adicional (+) y metros de movimiento.
    - Se ilumina en dorado cuando algo depende de ti.
  - **Orden de turno** (centro): retratos con vida y estados, como antes.
  - **Cámara y ambiente** (derecha, tras una barra vertical): botones por pares (Centrar/Cenital, Órbita/Muros, Niebla/Sonido, volumen/ambiente) y el cambio Plano 2D / Mesa 3D.
- **Avisos momentáneos**, como hacen los módulos de turno de otras mesas virtuales:
  - «¡Es tu turno!» al empezar el tuyo.
  - «Prepárate: después te toca a ti» al que va a continuación.
  - Un cartel breve («👉 ¡Impacta! Tira el daño…») cuando algo pasa a depender de ti.
- **Iniciativa una sola vez por combate**: si ya la tienes, no se puede volver a tirar (el máster la puede corregir a mano). Las tiradas libres de un jugador durante el turno de otro salen marcadas como «fuera de turno».
- **Registro de tiradas** de un vistazo:
  - Primera línea: **quién** (con su color), **para qué** («ataca a Bandido · Estoque», «salvación de DES», «iniciativa», «tirada libre 2d6») y el total.
  - Segunda línea, solo si hace falta: impacto o fallo, el daño hecho (−5 perforante), salva o falla, y los botones del máster («✓ Vale», «✓ Aplicar»).
  - Lo que está pendiente se resalta. El detalle de los dados sigue al tocar la fila.
- **Plantas**: ahora están en la pestaña Táctica del máster («🏰 Planta baja ▾», junto a Editar y Criaturas).

## Hito 18 · Cada cosa en su sitio: consulta abajo, Personaje e Iniciativa, PNJ del máster

- **Fuera las cajetillas de dados** de los lados de la mesa: las tiradas ya se ven en el lanzamiento de dados.
- **Barra superior más compacta**: a la derecha, controles apilados de tres en tres a toda la altura (⌖ centrar, ⬇ cenital, 🔊 silencio · volumen vertical · Órbita/Libre, Muros bajos/altos, Plano 2D/Mesa 3D). La iniciativa queda centrada en el espacio libre y se encoge para que quepan todos, sin barra de desplazamiento.
- **Luz (día/noche/interior), música y niebla** las decide el máster desde su pestaña Táctica, junto a la planta.
- **Abajo en la mesa, solo consulta**: al tocar una figura (en la mesa, la tira o la iniciativa) se ve su estado actual: vida (a ojo si es enemigo), CA, velocidad, iniciativa y estados. Desde ahí nadie lanza nada, y atacar con una figura que no es tuya está bloqueado.
- **Jugador, dos pestañas arriba**:
  - **🧙 Personaje**: lo que puede hacer en su turno (acciones, movimiento, terminar), el objetivo elegido con sus ataques y probabilidad, y debajo la ficha y los dados. Los descansos solo aparecen fuera de la mesa táctica.
  - **⚔️ Iniciativa**.
- **Máster, tres pestañas en Táctica**:
  - **Iniciativa**.
  - **🎲 Tiradas**: el registro, con todo el control.
  - **👹 PNJ**: elige criatura (o se abre sola al tocar una), con su vida, estados, ataques, efectos y edición, y sus dados. Lo que tire sale a nombre de esa criatura.
