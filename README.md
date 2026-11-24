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

## Hito 19 · Pestaña Personaje clara y tiradas a petición del máster

- **Jugador, tres pestañas**: 🧙 Personaje · ⚔️ Iniciativa · 🎲 Tiradas (el registro, ahora con sitio).
- **Personaje en una sola columna**, sin cajas que se tapen:
  - Arriba, la cabecera: vida, CA, velocidad, iniciativa y estados.
  - Después, un bloque **«Tu turno»**: acción, adicional y reacción, el movimiento y Terminar turno.
  - Para **atacar**, eliges el arma (botón grande con bonificador, daño y alcance) y **tocas al enemigo en la mesa o en la tira**. Los **conjuros** igual: abres el conjuro y tocas los objetivos (solo salen sus nombres, para quitarlos).
  - En esta pestaña **nunca aparecen datos de los enemigos**.
  - Luego vienen conjuros, salvaciones y pruebas. Los descansos solo aparecen fuera de la mesa táctica.
  - **Los dados, fijos abajo del todo**.
- **Consulta de abajo, según el rol**:
  - El jugador ve a las criaturas: estados, heridas (a ojo), velocidad, iniciativa y los ataques que se les conocen.
  - El máster ve a los personajes al completo: PG, CA, percepción pasiva, salvaciones contra muerte, espacios de conjuro, ataques y lo gastado en el turno.
- **🎲 Pedir tirada** (máster; en Táctica, junto a Criaturas, y en Roleplay, junto a la sesión):
  - Puede ser cualquiera de las 18 habilidades, una prueba de característica o una salvación, con CD visible u oculta y ventaja o desventaja.
  - Se pide **a todos o a quien elijas**.
  - Al jugador le sale un **tapete** en cualquier pantalla con su bonificador, ventaja o desventaja y **Tirar**.
  - Las respuestas que llegan juntas **caen en la misma bandeja** con la lista de resultados (✓/✗ si hay CD).
  - En el registro, la petición muestra quién ha tirado y quién falta. El máster tiene «Tirar por los que faltan», o «Tirar yo por ellos» al pedirla.

## Hito 20 · Regiones en el mapa del mundo, objetos especiales y cuaderno

- **Regiones**: el máster trocea el mapa grande como quiera.
  - Arriba del mapa hay dos pestañas: **🌍 Mapa global** (todo, con los contornos suaves) y **🗺 Regiones** (el mapa coloreado por regiones; toca una para entrar).
  - Dentro de una región se ve el mapa global **acercado y recortado** a su contorno, o **su propio mapa detallado** si el máster lo sube («Subir mapa de la región»; debe abarcar el recuadro del contorno).
  - **✏️ Dibujar región**: clic para cada punto; se cierra tocando el primer punto, con «✓ Cerrar región» o Intro (Esc cancela, ↶ quita el último punto).
  - Cada región tiene nombre, color, visibilidad, descripción, notas secretas y «Redibujar contorno».
  - Los lugares que se añaden **dentro de una región** son de detalle: solo aparecen al entrar en ella.
  - Se pueden **mostrar al grupo** desde la región o desde «Mostrar al grupo → Regiones» en la Partida.
  - Vienen tres regiones de ejemplo en la demostración (una oculta).
- **✨ Objetos especiales** (sellos, ofrendas, regalos, reliquias, cartas, llaves, objetos mágicos, recuerdos, trofeos):
  - Son tarjetas con historia: quién lo dio, dónde, en qué sesión y qué se sabe.
  - Pueden tener ilustración.
  - El máster guarda **lo que aún no saben** y lo revela cuando quiere.
  - El máster los da con **🎁 Dar objeto** (Roleplay, junto a «Pedir tirada»), a uno o a varios. Al jugador le llega un aviso.
  - Están en Inventario (ficha completa) y en la pestaña Personaje fuera de la mesa táctica.
- **📓 Cuaderno**: notas sueltas con la sesión en que se escribieron.
  - Se pueden marcar como **⭐ descubrimiento** y filtrar.
  - Con **📣** se comparten con el grupo en la crónica.
  - Tiene pestaña propia en la ficha completa, y las últimas notas salen en la pestaña Personaje.

## Hito 21 · Saber siempre por dónde vamos (y reglas en orden)

- **Ataques de oportunidad arreglados**: antes, al responder un jugador, el aviso no se cerraba en la partida real (Firestore no deja a un jugador modificar el aviso). Ahora la respuesta («⚔ Atacar» o «Dejar pasar») es una tirada suya enlazada y el aviso se cierra al momento. Si nadie responde, caduca al cambiar el turno. El máster puede decidir por un jugador ausente.
- **Panel «Ahora» paso a paso**, siguiendo el orden del reglamento:
  1. Reacciones pendientes (interrumpen el turno: «⏸ Brena decide…»; luego sigue el turno).
  2. Ataque por confirmar (máster: «✓ Vale» / «Que falle»).
  3. Daño por tirar (quien atacó: «🩸 Tirar daño»).
  4. Daño por aplicar (máster: «✓ Aplicar 6», «½»).
  5. Lo que queda del turno y «Terminar turno».
  - En el turno de un enemigo: «Lo llevas tú: muévelo, elige su ataque (PNJ) y toca al objetivo». Los jugadores leen: «El máster mueve al Lobo… vas tú después».
- **El máster ataca con sus criaturas igual que los jugadores**: en la pestaña PNJ eliges el ataque (con ventaja o desventaja si hace falta) y tocas al objetivo en la mesa o en la tira. Sus ataques no necesitan que él mismo los confirme.
- **Ficha de PNJ compacta**: vida con daño/curación en línea, acciones del turno, estados, ataques como botones, y Efecto/Editar plegados. Se ve entera sin desplazarse.
- **Botonera del máster en una franja**: ✏️ 👹 🎲 🌫, luz, música y 🏰 planta, en botones pequeños con su ayuda al pasar el ratón.
- **Dados**: el campo para escribir (2d6+3) ocupa el sitio de «1d20 o elige dados»; los dados que tocas se escriben ahí.
- **Iniciativa del jugador** a toda la altura de la columna.
- **Subir de nivel lo decide el máster**:
  - Los PX marcan quién podría subir (★).
  - En 🎭 Roleplay → «⬆ Subidas de nivel», el máster concede el nivel (a uno, a todos los que tienen PX o por hitos) cuando acaba la escena o la sesión.
  - El jugador recibe un aviso y sube desde su ficha.

## Hito 22 · El combate no se atasca

- **Causa del «máster tirando sin parar»**:
  - Cada tirada de cualquiera se animaba para todos, una detrás de otra, unos 7 s cada una.
  - Al empezar el combate había una tirada por enemigo; luego, cada ataque y cada daño.
  - Llegaban más rápido de lo que se mostraban, así que la cola no se vaciaba.
  - Con la pestaña en segundo plano, todo se acumulaba y se reproducía después.
- **Ahora**:
  - **Iniciativa de las criaturas en una sola tirada** (secreta, un d20 por criatura, con la lista de resultados).
  - **Las tiradas que esperan caen juntas** en una sola bandeja (hasta 6), con la lista «Mirra 14 · Lobo 9…».
  - **Nada se acumula**: lo que lleva más de 12 s esperando se descarta (queda en el registro). Con la pestaña oculta no se anima nada y, al volver, solo se ve lo último.
  - **Más rápido**: menos tiempo de dados quietos y de resultado. Tope de 6 s por tirada pase lo que pase. En ordenadores lentos la animación no se alarga.
  - **Animación de dados a elegir** en la bandeja (solo en tu pantalla): 🎬 Animados · ⚡ Rápidos · 🚫 Sin animación (los resultados siguen en el registro y sobre la mesa).
- **Arreglado**:
  - El botón de salvación contra muerte acumulaba oyentes al volver a montar la mesa: una pulsación podía lanzar varias salvaciones.
  - La ficha del jugador se suscribía de nuevo a cada entrada en la Partida.

## Hito 22b · Ataques de oportunidad según las reglas

- Solo los provoca la criatura que **se mueve por sí misma en su turno** y sale del alcance de un enemigo con la reacción disponible.
- Recolocar figuras (el máster ordenando la mesa), mover a alguien fuera de su turno (movimiento forzado) o editar la mesa ya no provoca avisos.
- Los avisos antiguos sin turno asociado se dan por caducados.

## Hito 22c · Combate limpio y en orden

- **Un clic nunca mueve una figura** en la mesa 3D ni en el plano 2D. Antes, un pequeño temblor del ratón al seleccionar una figura (sobre todo pulsando en su carta de pie) la desplazaba una o dos casillas y podía disparar un ataque de oportunidad sin que nadie se moviera. Ahora hace falta arrastrar de verdad, y soltar en la misma casilla no mueve nada.
- **Las reacciones nunca bloquean**:
  - Caducan al cambiar el turno, o a los 30 s si nadie decide (se entiende que lo deja pasar).
  - El panel «Ahora» se refresca solo.
- **Cada combate empieza de cero**:
  - Al iniciar o terminar un combate se cierran los ataques, daños, conjuros y reacciones que quedaran a medias.
  - Se borran el origen del movimiento y los estados de turno (esquivando, destrabado).
  - El panel «Ahora» solo mira lo del combate en curso.
- **El orden de turno se respeta**:
  - En combate, una criatura solo ataca, lanza conjuros o usa efectos en su turno; fuera de él, solo reacciones. Vale también para el máster y sus PNJ.
  - En la pestaña PNJ, los ataques de una criatura a la que no le toca salen desactivados, con el aviso «No es su turno».

## Hito 23 · Asistente de subida de nivel (reglas 2024)

- **Datos de las 12 clases** sacados del SRD 5.2.1 en español (`js/data/progresion.js`):
  - Los rasgos de cada nivel con su descripción.
  - Las columnas de la tabla de clase: recursos (furias, inspiración, canalizar divinidad, forma salvaje, puntos de hechicería, concentración, ataque furtivo…), trucos, conjuros preparados y espacios por nivel (Brujo con sus espacios de pacto).
  - La subclase del SRD de cada clase con sus rasgos.
  - Las dotes (generales, de estilo de combate y dones épicos) con sus requisitos.
- **El máster concede el nivel; el jugador sube con un asistente paso a paso**:
  1. **Qué ganas**: los rasgos reales de ese nivel (automáticos, de subclase o «tendrás que elegir») y los números que cambian.
  2. **Puntos de golpe**: valor fijo o tirada del dado de golpe + Constitución.
  3. **Subclase** (nivel 3): la del SRD con sus rasgos, u otra del manual escrita a mano.
  4. **Dote o mejora de característica**, en los niveles que toca a cada clase (Guerrero también 6 y 14; Pícaro también 10): +2/+1+1 con tope 20, o una dote con sus requisitos comprobados (u otra del manual).
  5. **Don épico** (nivel 19): con su +1 (tope 30).
  6. **Magia**: espacios que cambian, nivel máximo de conjuro, trucos y conjuros nuevos a elegir de la lista de tu clase (buscador), con la regla de cambio de conjuros de cada clase.
  7. **Resumen antes/después** y confirmar: se actualizan nivel, PG, características, subclase, rasgos (a la pestaña Rasgos), espacios y conjuros. Queda un historial de subidas.
- **🔭 Lo que viene**: en la ficha, tarjetas con los próximos 3 niveles (subclase, dotes, rasgos, recursos y espacios).
- Las subclases en femenino («Campeona», «Ladrona») se reconocen como las del SRD.

## Hito 24 · El lore a mano durante la partida

- **📍 Aquí** (panel del máster, Roleplay): dónde está el grupo. Se marca solo al mostrar un lugar o cargar una escena suya, o eligiéndolo en el desplegable. Muestra quién hay (PNJ), facciones, eventos pendientes, dioses o batallas y escenas tácticas de ese lugar, de lo que contiene y de su región. Lo de los alrededores sale con borde discontinuo.
- **🔎 Ficha flotante**: botón 🔎 (también en la barra de Táctica) o tecla **/**. Busca en todo el lore y abre una ficha encima de la mesa: resumen, secretos (solo máster), lugar, relaciones navegables (‹ para volver), «Mostrar a todos» y «Abrir en el Lore». Los jugadores también pueden usarla con /: solo ven lo revelado.
- **Estado de PNJ y facciones**: vivo, herido, preso, desaparecido, muerto, y actitud aliado, neutral u hostil. Se cambia en la ficha flotante o en el Lore (solo lo ve el máster).
- **¿Qué ha cambiado en el mundo?** Al cerrar la sesión aparecen los PNJ y facciones que han salido (vistos, mostrados o de los lugares visitados). Los cambios se apuntan en la sesión («Doran: Vivo → Muerto»), se pueden añadir al resumen y quedan en la página de la sesión en el Lore.
- No cambia las reglas de Firestore: todo va en la sesión (documento de campaña) y en las entradas del lore.

## Hito 25 · Cronología del mundo

- Nueva sección **⏳ Cronología** en el Lore: una línea temporal que se desliza de izquierda a derecha (arrastrando, con la rueda, con las flechas ‹ › o con el dedo en el móvil). Cada hito tiene fecha, título, texto breve e ilustración en miniatura. Las **épocas** (p. ej. «Era de la Corona») aparecen como separadores verticales.
- El máster crea hitos con **+ Hito**: fecha en texto («Años 640–643»), un número de **orden** para colocarlo en la línea y una época opcional. Tiene, como el resto del lore, parte pública, secretos, imagen y relaciones.
- **▶ Contar en la mesa**: el hito sale en grande en la Partida (ilustración, fecha y texto) con la línea de miniaturas debajo. El máster avanza con › o salta a cualquier hito, y lo que cuenta queda revelado. También está en «Mostrar al grupo → ⏳ Cronología».
- Los jugadores solo ven los hitos revelados, sin secretos. La demo trae cinco hitos de ejemplo (con una demo ya empezada no aparecen: hay que restablecerla).

## Hito 26 · La mesa con más vida

- **Ataques que se ven**, iguales para todos en 2D y en 3D. Cuerpo a cuerpo sale un tajo de luz delante del objetivo; a distancia, una flecha con estela; los conjuros lanzan un proyectil del color del daño (fuego naranja, frío cian, necrótico violeta…). Si acierta, saltan chispas y la figura se sacude; si falla, la flecha se pasa de largo. Encima aparece el resultado: **¡Impacto!**, **¡CRÍTICO!**, **Fallo**, y **Salva** o **Falla** en las salvaciones. Tiene sonido propio (tajo, cuerda de arco, crítico) y espera a que terminen los dados.
- **Daño y curación flotantes**: «−9» en rojo o «+6» en verde sobre la figura cada vez que cambian sus PG.
- **Ambiente 3D**: motas de polvo en interior, luciérnagas de noche y polen de día. Se desactivan si el sistema pide reducir el movimiento.
- **Plano 2D más limpio**: los objetos ya no llevan un círculo oscuro detrás, fichas y objetos tienen relieve y hay una viñeta de luz según el ambiente (cálida en interior, azulada de noche).
- **📏 Regla** en 2D (botón junto al zoom) y en 3D (junto a la cámara): arrastra de una casilla a otra y verás metros y casillas, con cada diagonal a 1,5 m como en las reglas de 2024. La medida se queda a la vista hasta la siguiente.
- Solo afecta al dibujo: no cambia los datos ni las reglas de Firestore.

## Hito 27 · Figuras que se leen

- Cartulinas un 30 % más grandes (ocupan casi toda la casilla): la ilustración se ve mejor.
- Cada figura lleva encima una **placa con su nombre y su vida que mantiene el mismo tamaño en pantalla**, esté la cámara cerca o lejos. Los personajes muestran el nombre corto («Brena», «Osric»). Quien está seleccionado o tiene el turno lleva la placa resaltada en dorado.
- Los enemigos siguen mostrando la vida «a ojo» a los jugadores (Ileso, Herido, Malherido…).

## Hito 28 · El tapete de dados, rehecho

Referentes: Quantum Quest (mesa virtual con dados lanzados sobre la mesa y un panel que explica la tirada), Baldur's Gate 3 (CD visible, bonos que «llenan» el total y veredicto rotundo, pero sin su lentitud), Dice So Nice (dados 3D con materiales de verdad) y Dicey Dungeons (números enormes y legibles al instante).

- **Se lanza, se coloca y se lee.** Los dados se lanzan con ganas: salen disparados, rebotan en las bandas, saltan y giran. Mientras ruedan tienen un tamaño proporcionado al tapete para tener sitio; solo crecen al colocarse. Al pararse, **se elevan y se colocan en fila mirando a la cámara**, grandes y con la cara del resultado resaltada; las demás caras se atenúan. Con ventaja o desventaja, el dado descartado queda al lado, oscuro y más pequeño.
- **Lectura a la derecha**: dado + bonos con un contador que llena el total («13 +5 → 18»), contra qué («contra CD 14», «contra CA 12», «daño fuego») y un **sello**: ÉXITO, FALLO, IMPACTO, ¡CRÍTICO!, PIFIA o ¡20 NATURAL!
- **Tiradas en grupo** (pedidas por el máster): los dados de todos caen juntos y cada uno lleva debajo el **nombre, el total y ✓ o ✗**. Arreglado un fallo por el que a veces una respuesta salía aparte.
- **Hordas**: la iniciativa de muchas criaturas (o más de 6 tiradas a la vez) ya no lanza un montón de dados; aparece una **lista ordenada de mayor a menor**.
- **Muchos dados** (8d6…): dos filas ordenadas y el desglose de cada dado encima del total.
- **Materiales**: barniz con reflejos de estudio (sin descargas), así que rubí, zafiro, oro u obsidiana brillan como dados reales. Números grabados el doble de grandes. Cada jugador sigue eligiendo su juego.
- **Control**: un toque en el tapete salta al resultado; otro lo cierra. Nunca se queda abierto más de 9 s. Los modos Animados, Rápidos y Sin animación siguen igual.

## Hito 29 · Las criaturas actúan según el SRD

Antes, las criaturas solo tenían el primer daño de sus ataques con arma y el menú «✨ Efecto» del máster solo dibujaba el conjuro (sin dados, sin daño, sin gastar nada). Ahora cada una de las **320 criaturas del SRD 5.2.1** tiene sus acciones reales, leídas de su perfil (`js/data/acciones.js`, generado; nada inventado):

- **Ataques completos**: todos los daños («1d8+3 contundente **más** 1d4 de veneno»), alcance y distancia reales, y **efectos al acertar**: salvación automática del objetivo con su estado (la garra del gul paraliza con Con CD 10), agarre o derribo según el tamaño del objetivo.
- **Acciones con salvación** (alientos, miradas, venenos…): se tocan los objetivos o se marca el área (cono, línea, esfera, emanación). Cada objetivo tira su salvación con sus bonos reales y el máster aplica el daño desde Tiradas (mitad si la supera, estados si falla), igual que los conjuros de los jugadores.
- **Lanzamiento de conjuros**: los conjuros de cada criatura enlazados al compendio, con **su CD y su ataque de conjuro** y sus usos (**a voluntad, N/día cada uno**). Se resuelven con el mismo motor que los de los jugadores.
- **Economía del turno impuesta**: una acción por turno; el **Ataque múltiple** permite su número exacto de ataques (el dragón rojo, 3 desgarros). Una acción adicional y una reacción. **Acciones legendarias** solo fuera de su turno y con su contador (3/3), incluidas las que lanzan un conjuro o hacen un ataque.
- **Recargas**: al empezar el turno de la criatura se tira el d6 de lo gastado (Aliento de fuego, recarga 5–6) y queda apuntado. Botón «↺ Recuperar usos» tras un descanso.
- **Salvaciones de las criaturas** con sus bonos del perfil (el dragón rojo, Des +6).
- **Criaturas grandes**: el alcance se mide desde el borde de la criatura, no desde su centro (un dragón Enorme alcanza a 3 m de su borde).
- El antiguo «✨ Efecto» queda marcado como **efecto visual (sin reglas)**.

Lo que sigue en manos del máster: resistencias e inmunidades al aplicar el daño (opciones mitad/doble/nada en Tiradas), la Resistencia legendaria, los estados especiales que el SRD describe con texto (maldiciones, etc.) y qué ataques combina cada Ataque múltiple (se controla el número de ataques).

## Hito 30 · Conjuros por lista de clase, en el orden oficial

- **Reglas → Conjuros** muestra cada lista de clase como en el SRD: **por nivel de conjuro (trucos a 9) y alfabético dentro de cada nivel**, con un encabezado por nivel.
- Cada nivel dice **desde qué nivel de personaje se abre** para esa clase, sacado de su tabla de progresión (p. ej. Mago: nivel 3 de conjuro desde nivel 5; Paladín: 1, 5, 9, 13, 17; Brujo: niveles 6–9 por Arcano místico a 11, 13, 15 y 17).
- **El jugador entra directamente en la lista de su personaje**: ✓ los conjuros que ya tiene, «✓ ya a tu alcance» en los niveles que puede usar y «🔒 a nivel 7 · te faltan 2 niveles» en los siguientes, para planear cómo quiere que crezca. El desplegable permite ver cualquier otra lista.
- Cada conjuro lleva iconos de lo que hace (⚔ ataque, 🛡 salvación, ❤ cura, 💥 área, ⏳ concentración, ⚡ adicional, ↺ reacción, 📜 ritual) y su tipo de daño; filtros rápidos: Hace daño, Cura, Área, Sin concentración, Ritual, Reacción.
- Arreglado: la subida de nivel no reconocía la clase escrita en femenino «Maga».

## Hito 31 · Escenas nuevas con criaturas del SRD

Las cuatro escenas de ejemplo antiguas (con «enemigos» genéricos sin habilidades) se sustituyen por cuatro nuevas, con criaturas del SRD 5.2.1 con sus estadísticas, PX y acciones reales (pensadas para cuatro personajes de nivel 5):

- **La torre del hechicero** (3 plantas, se sube por la escalera de caracol): vestíbulo con dos **gárgolas** quietas como estatuas y una losa de dardos oculta; biblioteca con un **diablillo** invisible, dos **esqueletos** y un glifo de fuego oculto; cámara de **Valdric (Mago)** con dos esqueletos, una puerta con llave y, tras una runa de relámpagos oculta, el **cofre** (350 po, pergamino de Bola de fuego, Varita de proyectiles mágicos y dos Pociones de curación).
- **Pelea en la taberna de la Jarra Rota** (22×14): barra, cocina, chimenea y la mesa de los enanos: **Thorgrim Yunquefirme** (Guerrero veterano), **Brokk Barbarroja** (Berserker), **Durin** y **Grumli** (Pendencieros) y **Hilda Martillo-Santo** (Sacerdote).
- **El cementerio de la colina** (de noche, con niebla de guerra): tumbas abiertas, ángeles de piedra y un mausoleo. **Zombis** (dos bajo tierra), **esqueletos**, un **gul** y, ocultos en el mausoleo, un **ghast** y el **tumulario**. Una fosa oculta en la maleza.
- **Emboscada en el bosque**: camino que serpentea, arroyo con puente y un árbol caído. **Jefe goblin** en el peñasco, cuatro **goblins** ocultos en la maleza, dos **huargos** (lobos terribles) y un lazo escondido en el camino.

En **Preparar escenas**, el máster tiene **🔄 Renovar escenas de ejemplo**: quita las cuatro antiguas solo si siguen sin tocar (mismo nombre y sin criaturas del SRD) y añade las nuevas. Las escenas propias no se tocan.

Arreglos: los humanoides «Medianos o Pequeños» del SRD (mago, veterano…) salían como Pequeños; las criaturas añadidas ahora llevan sus PX según la tabla oficial por VD; iniciales y placas de nombre sin paréntesis.

## Hito 32 · Arreglos de la auditoría

- **Datos de criaturas**: cuatro perfiles del SRD traían pegado el de las criaturas siguientes de su página (el Jefe goblin tenía 9 ataques ajenos; también Grimlock, Hombre tigre y Noble): ahora cada uno solo tiene lo suyo. El **daño condicional** («más 1d4 si la tirada tenía ventaja», goblins) se suma solo cuando se ataca con ventaja, y el **daño alternativo** («o 2d4 si el enjambre está maltrecho») aparece como nota para el máster en vez de sumarse.
- **Criaturas ocultas**: los jugadores ya no ven su nombre en el panel «Ahora» cuando les toca («El máster está resolviendo un turno»).
- **Criaturas repetidas numeradas** al cargar una escena o añadirlas («Goblin 1 (en la maleza)», «Goblin 2…», «Lobo 3»), también en la tira de iniciativa («G2») y en las placas.
- **Trampas fuera de combate**: cuando salta una, el panel «Ahora» del máster lo avisa con las salvaciones y un botón «Resolver»; el jugador afectado ve que el máster lo está aplicando.

## Hito 33 · Dificultad de los encuentros
- Presupuesto de PX por nivel del SRD 5.2.1 (baja, moderada, alta) sumado para el grupo; la escena muestra los PX de sus criaturas (todas las plantas) y la dificultad: trivial, baja, moderada, alta o por encima de alta.
- En la mesa, el máster ve una etiqueta «⚖️ Dificultad · PX» con el detalle al pasar por encima.
- Escenas de ejemplo equilibradas para 4 PJ de nivel 5 (más enanos en la taberna, más gules en el cementerio, lobos terribles, osgos y un ogro en el bosque).
- «Renovar escenas de ejemplo» también cambia las de ejemplo de la versión anterior por las equilibradas, si solo tienen criaturas del SRD.

## Hito 34 · Creación de personaje guiada (SRD 5.2.1)
- «✨ Crear personaje paso a paso» en El grupo (la ficha en blanco sigue disponible).
- Pasos: clase → origen (trasfondo, especie y sus elecciones: ancestro, linaje, legado, tamaño, aptitud mágica; la dote de Versátil del humano) → características (conjunto estándar propuesto por clase, coste en puntos de 27 o 4d6 sin el menor) con los aumentos del trasfondo (+2/+1 o +1/+1/+1, máximo 20) → habilidades (trasfondo, clase, Sentidos agudos, Diestro, Habilidoso, Pericia del pícaro, sin repetir) → rasgos y dotes (Orden divina, Orden primigenia, invocación de brujo sin requisitos, estilo de combate, maestría con armas) → conjuros (trucos y conjuros de nivel 1 según la tabla de la clase, libro de 6 del mago, Iniciado en la magia, los de la especie y los rasgos) → equipo A/B(/C) de clase y trasfondo e idiomas → detalles → resumen.
- La ficha sale calculada: PG (dado máximo + CON, +1 enano), CA según la armadura del equipo (Defensa sin armadura del bárbaro y el monje, escudo, estilo Defensa), velocidad y visión en la oscuridad de la especie, salvaciones, habilidades, iniciativa con Alerta, armas con ataque y daño (sutil, a distancia, competencia, Tiro con arco, maestría), espacios de conjuro, rasgos de nivel 1 con su texto, inventario con el contenido de los paquetes, monedas e idiomas.
- Tablas nuevas del SRD: armas (p. 98) y armaduras (p. 99) en js/data/equipo.js; clases, trasfondos, especies, dotes de origen e idiomas en js/data/creacion.js.
- La iniciativa suma el bonificador de Alerta.

## Hito 35 · Copia de seguridad del mundo
- En Inicio, el máster tiene «⬇ Descargar copia»: un .json con todo el mundo (lugares, regiones, lore, fichas, escenas, sesiones, crónica, tiradas, mesa) y las imágenes que usa (mapas, retratos, ilustraciones). Recuerda cuándo se hizo la última.
- «⬆ Restaurar una copia» enseña qué trae (nombre, fecha, lugares, lore, fichas, escenas, imágenes) y pide confirmación. Sustituye el contenido del mundo abierto pero conserva miembros, másteres y la partida en curso; las fichas de jugadores que no estén en ese mundo quedan sin dueño para asignarlas.
- En la nube, los cambios grandes se guardan en lotes de 450 escrituras (Firestore no admite más de 500 por lote).

## Hito 36 · Inspiración heroica y maestría con armas
- Inspiración heroica (SRD 5.2.1): el máster la da o la quita con ✨ en la ficha y en «Personajes en la mesa»; los humanos la recuperan con el descanso largo (Ingenioso). El jugador ve el estado en su ficha.
- Gastarla: «✨ Repetir» aparece en el registro, en tu tirada, justo después de tirar (ataque ya confirmado, prueba, salvación, iniciativa o daño sin aplicar). Repite el d20 (con ventaja o desventaja, solo el más bajo de los dos) o el dado de daño más bajo, y vale el nuevo resultado aunque sea peor.
- Maestría con armas: las armas con «Maestría: X» en las notas (el asistente de creación lo pone solo; a mano también vale) la usan en combate:
  - Debilitar (al acertar) y Molestar (al causar daño): automáticas; caducan según el SRD.
  - Derribar (salvación de CON), Empujar 3 m en línea recta, Ralentizar (−3 m, sin acumular), Hender (segundo ataque a 1,5 m, sin modificador al daño, una vez por turno) y Rozar (daño igual al modificador al fallar): botón en la tirada. El máster lo aplica al momento; si lo pide un jugador, al máster le llega la petición para aceptarla.
  - Mellar: se recuerda en la tirada.
- Los estados con duración «hasta el principio de tu siguiente turno» se quitan solos al empezar ese turno.

## Hito 37 · Todo dentro de las reglas de Firestore actuales
- Un jugador no puede cambiar una tirada ya publicada (solo crearla o borrarla): «✨ Repetir» publica la tirada repetida y quita la anterior; las maestrías del jugador no marcan su tirada (se deduce de lo que ya hay).
- Molestar se guarda como estado en la ficha de la mesa del atacante (las reglas solo dejan al jugador cambiar posición, iniciativa, estados, efectos y acciones).
- En la nube, los cambios seguidos del mismo instante salen en un solo envío: una tirada que se publica y se completa a la vez (por ejemplo, un conjuro con salvación lanzado por un jugador) llega como una sola creación.
- No hay que tocar firestore.rules.

## Hito 38 · Editor de mapas más limpio
- La barra del editor de mapas cabe en una sola línea (en el móvil se desliza de lado); Mover y Enemigo ya no abren una segunda barra con la ayuda (va en el título del botón).
- El mapa se encaja justo debajo de la barra, sin hueco arriba.
- En el móvil la cabecera ocupa dos líneas: nombre y usuario arriba, secciones deslizables debajo.

## Hito 39 · Paquetes de región y peligros del terreno

- **9 paquetes de región** (Enano, Élfico, Orco, Ciudad, Cementerio, Montaña, Pantano, Volcán, Costa): 49 suelos y 98 objetos en total, con pestaña propia en Pincel y Objetos. Cada pieza indica cobertura, luz, caída o fuego.
- **Región de la escena** en ⚙ Mapa (o al crear la escena). Se hereda del Lore: cada región del mundo tiene su «Paquete de mapas» y la escena lo sugiere según su lugar. Fija luz y sonido.
- **Generadores por región**: «Generar <región>» crea un mapa con sus piezas y deja una nota oculta para el máster.
- **Peligros que se aplican solos** al entrar en la casilla (SRD 5.2.1):
  - Abismo y pozos: caída de 1d6 por cada 3 m (máx. 20d6) y derribado.
  - Hielo: salvación de Destreza CD 10 o derribado.
  - Brasas y hogueras: estado Ardiendo (1d4 de fuego al empezar el turno; «Apagarse» gasta la acción y deja derribado).
  - Lava: el daño lo fija el máster (**regla de campaña**, el SRD no la trae).
  - Un puente anula el peligro.
- **Las 8 trampas del SRD** (aguja, dardos, estatua, pozo con pinchos, pozo, red, roca rodante, techo que se derrumba) con CD y daño según el nivel del grupo.
- «Agotamiento» pasa a llamarse **Cansancio** (texto 2024); resta 1,5 m de velocidad por nivel.
- 3D: piezas nuevas modeladas; el agua, la lava y el abismo vuelven a verse (el marco de la mesa los tapaba).

## Hito 40 · Reglas y monstruos más fáciles de consultar

- **Libro con índice desplegable**: cada capítulo tiene sus subsecciones (Cómo jugar › Combate › Cobertura, las 12 clases, Equipo › Armaduras…). Al tocar una se salta a esa página y se resalta el título. Las páginas del índice están comprobadas contra el texto del SRD.
- **Migas de pan** encima de la página («Cómo jugar › Combate › Cobertura · p. 16») y resultados de búsqueda con su capítulo.
- **Accesos rápidos**: Estados, Acciones, Cobertura, Descansos, Caídas, Salvación contra muerte, Viajes y Encuentros.
- **Pestaña Glosario**: las definiciones del SRD como diccionario A–Z, filtrables por Estados, Acciones, Áreas, Peligros y Actitudes. Los «Consulta también» son enlaces, y cada entrada abre su página del libro.
- **Monstruos por categorías**: rangos de VD, tipo, tamaño, movimiento (vuela, nada, trepa, excava), rasgos (conjuros, legendaria, reacciones, anfibia, resistencia mágica), defensas y origen (Monstruos o Animales). Cada filtro muestra cuántas quedan, y se puede ordenar por nombre o por VD. Las filas llevan iconos.
- **Para tu grupo** (máster): la dificultad de una criatura con el presupuesto de PX del SRD y cuántas hacen falta para subir de categoría.
- Perfiles más limpios: la cabecera (salvaciones, habilidades, defensas, sentidos, idiomas, VD) se separa bien aunque el PDF la junte en una línea.
- **Móvil**: lista o página a pantalla completa con botón «← Lista» / «☰ Índice»; los filtros de tipo ya se ven (antes quedaban ocultos).

## Hito 41 · Defensas de las criaturas del SRD, automáticas

Todo se lee del perfil de cada criatura (SRD 5.2.1):
- **Resistencias, vulnerabilidades e inmunidades al daño**: el botón «✓ Aplicar» ya trae la defensa (½, ×2 o 0) y el resultado. Se puede aplicar el daño completo con otro botón. En conjuros y trampas con salvación, la defensa se aplica después de la mitad por salvación, con un chip por objetivo para quitarla.
- **Inmunidad a estados**: la criatura no recibe los estados a los que es inmune (zombi y envenenado, acechador y derribado…), ni a mano ni desde ataques o conjuros.
- **Regeneración** al empezar su turno (troll 15, oni 10…). El ácido o el fuego la cortan el turno siguiente. Un troll a 0 PG sigue en la iniciativa y solo muere si empieza su turno sin regenerarse; el oni no se regenera a 0.
- **Resistencia legendaria**: en la tabla del conjuro, botón «👑 Superarla (n)» en la salvación fallada, con sus usos por día («↺ Recuperar usos» los devuelve).
- **Resistencia mágica**: ventaja en las salvaciones contra conjuros, puesta por defecto y que el máster puede quitar o volver a poner con un toque.
- **Tácticas de manada** y los demás rasgos situacionales quedan a criterio del máster (se leen en el perfil).
- En el panel PNJ se ven las defensas de cada criatura.
- El inicio del turno de una criatura (recarga, Regeneración, legendarias) lo aplica siempre el máster, aunque el turno lo pase un jugador (reglas de Firestore).

## Hito 42 · Ficha de personaje nueva, con el visto bueno del máster

- **Distribución**: franja arriba con PG, CA, iniciativa, velocidad, competencia y dados de golpe; columna fija a la izquierda con características, salvaciones, habilidades, sentidos, idiomas y competencias; pestañas justo debajo (Acciones, Conjuros, Inventario, Rasgos, Historia, Cuaderno, Lo que viene). Las pestañas empiezan a 250 px en lugar de 730 (en el móvil, a 300 en lugar de 1.170, con la pestaña Atributos). La ficha recuerda la última pestaña.
- **Aquí no se tiran dados**: tirar, gastar espacios, curarse o descansar es cosa de la Partida. La subida de nivel toma el valor fijo de PG del SRD.
- **Solo el máster edita** (✎ Editar → ✓ Hecho); lo que cambia queda en el registro de la ficha.
- **El jugador propone**: «✎ Proponer un cambio» abre una copia editable, y «Enviar al máster» manda las diferencias con un motivo (p. ej. «Monedas de oro: 34 → 24 · Equipo: + Lanza»). El máster las aprueba o las rechaza con un motivo; el aviso sale en el menú (Personajes con un número) y en la ficha.
- **Registro (📜)**: cada cambio aprobado, rechazado, hecho por el máster o por subida de nivel, con quién, cuándo y el motivo.
- **Subida de nivel guiada que se guarda a medias**: cada paso se guarda en la ficha; «💾 Guardar y salir» y, otro día o en otro dispositivo, «⬆ Continuar la subida». Ya no se cierra al tocar fuera.
- El cuaderno de notas sigue siendo del jugador, sin aprobación.
- Las reglas de Firestore lo garantizan en el servidor (hito 43).

## Hito 43 · Reglas de Firestore: el jugador ya no puede cambiar su ficha por su cuenta

`firestore.rules` (hay que publicarlas en la consola de Firebase). En su propia ficha, un jugador solo puede escribir:
- lo que se gasta jugando: PG actuales y temporales (no los máximos), dados de golpe, salvaciones contra muerte, espacios de conjuro gastados (no los máximos ni la lista de conjuros) e inspiración (gastarla; los humanos la recuperan en el descanso largo);
- su cuaderno, sus propuestas al máster y la subida de nivel guardada a medias;
- la subida de nivel concedida por el máster: un nivel cada vez y como mucho hasta el concedido, con PG máximos que suben (hasta 60) y características que suben como mucho 2 en total.
Además, un jugador ya no puede borrar su ficha (solo el máster).
La app escribe ahora los cambios de un jugador documento a documento: si el servidor rechaza uno de su ficha, avisa («pídeselo al máster con ✎ Proponer un cambio») y no se pierden sus tiradas ni sus movimientos.
Comprobado simulando las reglas sobre las escrituras reales de la app (gastar espacios, descansos, curación, daño, salvaciones contra muerte, cuaderno, propuestas, subida guardada y subida completa pasan; monedas, equipo, PG máximos, espacios máximos, conjuros, habilidades, darse inspiración o subir dos niveles se rechazan).

## Hito 44 · Tu turno por fases y despliegue del grupo

**Tu turno, paso a paso** (columna Personaje de la Partida):
- Cuatro fases: 🦶 Movimiento, ⚡ Acción, ✦ Acción adicional y ↺ Reacción. Cada una dice si la tienes («quedan 6 m», «disponible», «1 ataque más») o ya la gastaste, y dentro muestra solo lo que puedes hacer con ella: tus armas, tus conjuros de ese tiempo de lanzamiento y tus rasgos (p. ej. Acción astuta del pícaro como acción adicional, o el ataque con la otra arma ligera).
- Lo que no puedes hacer aparece apagado con el motivo: «Ya usaste la acción», «Sin espacios de nivel 2», «Ya lanzaste un conjuro con espacio este turno: solo trucos», «Estás aturdido».
- Fuera de tu turno solo se abre la Reacción (ataque de oportunidad, Escudo…) y un resumen de lo que podrás hacer.
- Reglas del SRD que ahora se aplican: **Ataque adicional** (bárbaro, explorador, guerrero, monje y paladín a nivel 5; guerrero 3 y 4 ataques a 11 y 20) con la misma acción Atacar; **un solo conjuro con espacio por turno** (2024); **agarrado** deja la velocidad a 0; la mesa no deja gastar dos veces la acción, la adicional o la reacción.
- En el móvil, tocar «Personaje» baja hasta el panel (y otra vez sube a la mesa).

**Despliegue** (regla de la mesa: el SRD no regula cómo se coloca el grupo):
- En Escenas, el máster marca el ⚑ punto de inicio y elige la **zona de despliegue** (0 a 6 casillas alrededor). Se ve en el editor.
- Al cargar la escena, el grupo aparece en la zona y cada jugador, **por turnos**, arrastra su figura a cualquier casilla libre de la zona según lo que ve, y pulsa «✓ Listo». Fuera de la zona no le deja.
- El máster ve quién se está colocando, puede pulsar «Listo» por un jugador, terminar el despliegue o iniciar el combate (que lo cierra).

## Hito 45 · Tienda, botín del grupo y cofres

- **Tienda** (ficha → Inventario → 🛒 Tienda): catálogo del SRD 5.2.1 (armas, armaduras, equipo de aventura, herramientas, munición, canalizadores, monturas) con precio y peso. Cesta con + y −, venta a la mitad de precio (SRD), cambio en monedas y peso total. El jugador la envía al máster como propuesta; el máster la aplica al momento. Ajuste de precios por tienda (%) opcional, **regla de campaña**.
- **Dar a un compañero** (🤝): objetos y monedas; al aprobarlo pasan de una ficha a otra y queda en el registro de las dos.
- **Botín del grupo** (Personajes → El grupo): lo encontrado y aún sin repartir. El máster añade monedas y objetos (mágico, sintonización, de dónde sale), reparte las monedas a partes iguales (el resto a quien elija) o da un objeto a alguien. El jugador pulsa «Me lo quedo» (propuesta; aviso si ya tiene 3 objetos sintonizados). Lo que nadie coge se queda en el cofre del grupo.
- **Cofres en la escena**: el máster pone un cofre y escribe qué hay dentro (monedas, objetos del catálogo o inventados, nota). Al abrirlo, el contenido pasa al botín del grupo y se anuncia en las tiradas. Lo abre el máster desde el objeto, o un jugador con su figura junto al cofre («Abrir el cofre» en su panel); el cliente del máster comprueba que sigue al lado.
- Sin cambios en las reglas de Firestore: el botín vive en el documento de la campaña (lo escribe el máster) y el jugador solo crea propuestas y peticiones.

## Hito 46 · Ataques de oportunidad claros, PNJ por fases y tiempo libre en la ciudad

- **Fuera de tu turno ya no parece que te toque reaccionar.** La caja «Reacción» solo se destaca cuando la mesa te ofrece de verdad un ataque de oportunidad (un enemigo sale de tu alcance). Si no, verás «No es tu turno. Nada que hacer ahora». Un arma preparada deja de apuntar al acabar tu turno y, al tocar a un aliado, solo se mide la distancia (antes decía «fuera de alcance · cobertura total»).
- **El máster lleva a los PNJ y enemigos por fases**, igual que el jugador: Movimiento, Acción (ataques, Ataque múltiple, acciones del perfil y acciones comunes), Acción adicional, Reacción y Legendarias, con lo que les queda y por qué algo no se puede. Fuera de su turno, solo Reacción y Legendarias. Al empezar el turno de una criatura, el panel pasa solo a la pestaña 👹 PNJ; tocar un enemigo en la mesa (o en la iniciativa) abre su pestaña.
- **🕰 Tiempo libre** (Partida → Roleplay, con la sesión en curso). Es una herramienta de mesa, **regla de campaña**: no añade mecánicas.
  - El máster elige los sitios: taberna y mercado de entrada, los lugares que haya dentro de la ciudad y otros de un toque (biblioteca, torre de magos, catacumbas, templo, gremio…) o inventados. Cada sitio tiene lo que ven los jugadores y 🔒 notas solo para el máster.
  - Cada jugador elige a dónde va su personaje y escribe qué quiere hacer. Ve a dónde van sus compañeros, pero no sus planes: no tenéis que ir juntos.
  - El máster ve quién va a cada sitio y qué quiere hacer. Con **🤫 Contarle** le cuenta a un solo personaje lo que pasa o lo que descubre: solo lo leen ese jugador y los másteres. Puede marcarlo como ⭐ descubrimiento o contarlo también al grupo en la crónica. Con 🎲 le pide una tirada.
  - El jugador lo ve en su ficha («🤫 Lo que sabes tú») y lo puede pasar a su cuaderno. Si la mesa muestra otra cosa, un aviso en su ficha le deja elegir igualmente.
  - Al cerrarlo queda en el **📜 Registro**: quién fue a dónde, qué quería hacer y lo que se le contó.
- **Reglas de Firestore**: hay que publicarlas otra vez. Se añade la colección `whispers` (la leen solo su destinatario y los másteres) y el jugador puede guardar su elección (`ft`) en su ficha.

## Hito 47 · Visión, luz y enemigos ocultos (reglas del SRD 5.2.1)

- **Visión de los personajes activada por defecto** (👁 en la barra del máster para apagarla). Los jugadores solo ven las casillas y las criaturas que algún personaje en pie alcanza a ver: los muros y las **puertas cerradas tapan la vista** (un rastrillo deja ver), también en diagonal entre dos muros que se tocan. Lo ya explorado queda en penumbra.
- **Luz según las reglas**: la escena tiene ☀️ luz brillante, ◐ luz tenue u ● oscuridad (barra del máster y editor de escenas; de noche, oscuridad por defecto).
  - Luz tenue: se ve, en penumbra (desventaja en Sabiduría (Percepción) para ver).
  - Oscuridad: no se ve (quien intenta ver algo ahí está cegado).
  - **Visión en la oscuridad**: dentro de su alcance, la luz tenue cuenta como brillante y la oscuridad como tenue.
  - **Fuentes de luz del SRD**: vela 1,5 + 1,5 m, antorcha 6 + 6 m, lámpara 4,5 + 9 m, linterna sorda 9 + 9 m y el conjuro Luz 6 + 6 m. Las llevan los personajes (🔦 en su ficha) o las criaturas (al editarlas). Las antorchas y velas de la escenografía también iluminan; la hoguera, como una antorcha (regla de campaña).
  - En su ficha, el jugador ve qué luz hay en su casilla.
- **Enemigos ocultos**: al añadir criaturas, la casilla «🙈 Ocultas a los jugadores» (marcada por defecto) las pone en la mesa sin que se vean. En la ficha de cada PNJ, 🙈/👁 lo oculta o lo muestra, y «Mostrar ocultas» de la barra las revela todas a la vez. En la iniciativa del máster se marca 🙈 oculto y 👁‍🗨 no lo ven (fuera de la vista de los personajes). Para los jugadores, lo que no ven no sale en la mesa, en la iniciativa ni en la barra de turno.
- **Reglas de Firestore**: el jugador puede cambiar la luz que lleva su figura (`light`). Hay que publicarlas otra vez.

## Hito 48 · Una niebla sutil

- La vista de los personajes ya no se tapa con bloques negros: es un **velo suave con los bordes difuminados** y un poco de grano, como en Foundry, Owlbear Rodeo o Roll20. Es la misma imagen en el plano 2D y en la mesa 3D, pegada al suelo.
  - Lo que nunca se ha visto queda negro y, en 3D, sus muros y su escenografía ni se dibujan, para no adivinar el mapa.
  - Lo explorado que ahora no se ve queda en penumbra azulada.
  - La luz tenue, apenas un velo.
  - Las casillas a las que puedes moverte se ven por encima del velo.

## Hito 49 · Nombres y vida que se leen

- **Placas de la mesa 3D**: se dibujan a la resolución exacta con la que se ven (antes se encogían desde una imagen grande y se emborronaban). El nombre es más grande y los PG van centrados dentro de la barra, en letra de palo gruesa con contorno («27 / 33»). En los enemigos, el estado (Ileso, Herido…). Al cambiar el tamaño de la ventana se rehacen nítidas.
- **Barras de vida en las pestañas Personaje y PNJ**: más altas, con los PG centrados y en cifras del mismo ancho, legibles sobre cualquier color. También la barra de movimiento.
- **Tira de turnos**: el nombre de quien actúa sale corto («Mirra», «Osric») y en letra normal, no en versalitas cortadas.

## Hito 50 · Alturas en el mapa táctico (SRD 5.2.1)

- **Editor de mapas · ⛰ Altura**: pinta con el pincel (1×1 a 5×5) para **subir** o **bajar** 1,5 m por pasada, **fijar** una altura (de −6 a +12 m) o **allanar**. Mientras la usas, cada casilla enseña su cifra. Sirve para tarimas, riscos, galerías, colinas, fosos y zanjas. Se guarda en la escena, en cada planta y al «Guardar como escena».
- **Cómo se ve**:
  - **2D**: lo alto, algo más claro; lo hondo, más oscuro; cada desnivel con su filo de luz arriba y su sombra sobre lo bajo, y una etiqueta discreta por meseta («▲ 3 m», «▼ 3 m»).
  - **3D**: el suelo sube y baja de verdad, con paredes de roca y un filo claro en lo alto. Las figuras, los objetos, los muros y las luces se ponen a su altura. La niebla de la vista sigue el relieve, y se apunta al suelo de verdad (lo alto del risco).
- **Reglas**:
  - **Distancias**: como en la cuadrícula, cada 1,5 m cuenta una casilla en cualquier dirección. Un enemigo 3 m más arriba está a 2 casillas, así que el ataque cuerpo a cuerpo (1,5 m) no le llega; un arco, sí. Vale para el alcance de ataques y conjuros y para los ataques de oportunidad.
  - **Trepar** (SRD): cada metro de subida o bajada cuesta 1 m más de movimiento (2 m en terreno difícil). No cuesta con velocidad trepando o volando, ni por unas 🪜 Escaleras (un tramo de 1,5 m). El cursor lo dice: «trepando (+3 m) · altura +3 m».
  - **Vista y cobertura**: el relieve más alto que la línea entre los ojos (1,5 m) y el objetivo tapa la vista; lo que hay encima de un risco no se ve desde abajo. Si tapa parte del objetivo da cobertura media o de tres cuartos, y si lo tapa entero, total. El reparto entre media y tres cuartos es regla de mesa.
  - **Volar** (SRD): el máster puede poner una criatura en el aire («Vuela a» 1,5–18 m al editarla). Cuenta para distancias y en 2D lleva una etiqueta «↑3».
- Las caídas siguen como estaban: el abismo hace 1d6 por cada 3 m. Saltar desde un risco lo resuelve el máster.

## Hito 51 · Apuntar como en Baldur's Gate 3 (con las reglas del SRD) y colores de la mesa

- **Eliges arma o conjuro y la mesa enseña a quién**, en 2D y en 3D:
  - El **alcance** del arma o del conjuro va contado como la cuadrícula y con la altura: contorno continuo para el alcance normal y discontinuo para el largo (con desventaja).
  - Sobre cada enemigo, una etiqueta con la **probabilidad de impactar** (d20 + ataque contra su CA, con ventaja o desventaja, cobertura, Bendición o Perdición y cansancio), el **daño posible** («4–11»), ▲/▼ si hay ventaja o desventaja, y el porqué al pasar el ratón. Si no llega, «fuera · 12 m» o «🛡 cobertura total».
  - Los conjuros de salvación enseñan la CD («CD 15 Des»); los trucos, el daño a tu nivel.
  - **Te acercas y atacas**: si el enemigo está fuera de tu alcance cuerpo a cuerpo pero llegas andando (sin correr), la etiqueta dice «🦶4,5 m». Al tocarlo, tu figura va por el camino más corto, paga el movimiento (y provoca ataques de oportunidad si sale del alcance de alguien) y ataca.
  - **Plantillas de área**: la Bola de fuego, Manos ardientes, los alientos… siguen al cursor con su forma del SRD (esfera, cilindro, cubo, cono, línea, emanación). Marcan a quién alcanzan y avisan si hay aliados dentro («⚠ 1 aliado»), o «demasiado lejos» si el punto de origen queda fuera de alcance. Al tocar, el jugador lanza el conjuro; al máster se le marcan los objetivos para «Usar».
  - Un ataque de conjuro a un solo objetivo (Rayo de escarcha, Rayo de fuego…) se lanza al tocar al objetivo.
  - Abajo, una barra dice qué toca hacer. Se cancela con Esc, con clic derecho o con ✕.
- **🎨 Colores de la mesa** (botón en la barra de arriba): cada jugador elige los colores del movimiento, correr, el camino, el alcance, el alcance largo, los objetivos y las áreas, y la intensidad. Se guardan en su navegador y los nuevos colores por defecto son más vivos.
- **% de impacto para los jugadores**: regla de campaña. Está activado (como en BG3) y el máster puede apagarlo en 🎨, porque deja adivinar la CA.

## Hito 52 · Editor de mapas: objetos y criaturas que funcionan

- **Objetos**: la paleta salía en una sola columna enorme y sin las categorías, porque una regla de estilo de la ficha (`.props`) le cambiaba el formato desde el hito 42. Arreglado: vuelve la cuadrícula con las categorías (Mobiliario, Luz, Mazmorra, Naturaleza, Puertas, Trampas, Tesoro, Marcas, Regiones) y hay un **buscador** que busca en todas («trampa», «árbol», «puerta»…).
- **👹 Enemigo**: abre el bestiario del SRD. Eliges criatura, cuántas y si van ocultas, y **tocas el mapa donde quieras ponerlas**; si son varias, se reparten en las casillas libres de alrededor. Se puede seguir tocando para poner más; ✕ vuelve al enemigo genérico. «Añadir criaturas…» del panel de la escena hace lo mismo. Antes las ponía solas, lejos del punto de inicio. También en el retoque en directo desde Partida.

## Hito 53 · Ataques de oportunidad avisados, acciones de mesa y tesoros para diseñar mapas

- **Aviso de ataque de oportunidad (como BG3)**: al arrastrar tu figura, si el camino sale del alcance de un enemigo que puede reaccionar, el camino se pone **rojo** y la punta del cursor avisa: «⚠ provocas ataque de oportunidad: Goblin 1 (Destrabarse lo evita)». Se cuenta por el camino de verdad, casilla a casilla; antes solo se miraban el principio y el final. Tiene en cuenta las armas con alcance de 3 m. No provoca quien se ha destrabado o está oculto.
- **Acciones de mesa del SRD**:
  - **🫥 Esconderse**: la mesa comprueba que ningún enemigo te ve, ya sea por muros, puertas, cobertura de tres cuartos o total, o una zona muy oscura sin visión en la oscuridad. Si no, te dice quién te ve. Tira Destreza (Sigilo) CD 15 y, si lo consigues, quedas invisible: tu resultado es la CD para encontrarte. Atacar o lanzar un conjuro te descubre. El pícaro puede esconderse con su Acción astuta.
  - **🔎 Buscar**: Sabiduría (Percepción) contra quienes estén ocultos y a la vista.
  - **🤚 Empujón** (en vez de un ataque): «Apartar 1,5 m» o «Derribar». La etiqueta del objetivo dice la CD (8 + Fuerza + competencia), la salvación que elegirá (la mejor de Fuerza o Destreza) y la probabilidad de que falle. Solo contra alguien como mucho una categoría de tamaño mayor. Si falla, el máster lo aplica solo, y si no hay sitio detrás, no se mueve.
  - **🪨 Objeto lanzado** (arma improvisada del SRD): sin competencia, 1d4 contundente y alcance de 6/18 m. Sale siempre entre tus armas.
  - **🧗 Subirse a objetos** (trepar): mesas, barriles, cajas, rocas, peñascos, estatuas y árboles. Cuesta 1 m de movimiento por metro de altura, más 1,5 m si está al lado. Subido, cuenta la altura para el alcance y la vista; bajar cuesta lo mismo y moverte te baja. En la mesa se ve «⤒1». Las alturas de los objetos son regla de campaña.
  - **🫸 Empujar objetos**: un barril, una caja, una mesa o una roca se mueve 1,5 m con Fuerza (Atletismo). La CD según el peso es regla de campaña.
  - Fuera de combate también se puede esconderse, buscar, subirse y empujar.
- **Tesoros para diseñar mapas**: en Objetos → Tesoro hay cofre, cofre grande, cofre con cerradura, bolsa de monedas, saco, mochila abandonada, reliquia, gemas, joyas, libro o tomo, libro de conjuros, pergamino, poción, llave, mapa, carta o nota, arma en el suelo, escudo o armadura, urna, restos con pertenencias, ofrenda en un altar, montón de oro y objeto mágico. A cada uno le pones dentro monedas y objetos (catálogo del SRD o inventados, mágicos o con sintonización) y una nota. El jugador que está al lado pulsa «Abrir» o «Coger» y todo va al botín del grupo.

## Hito 54 · Reacciones, rasgos de clase y duraciones en turnos (orden de Baldur's Gate 3)
Lo que pasa en un ataque va siempre en el mismo orden: **tirada de ataque → reacciones → impacto confirmado → opciones al impactar → daño → reacciones al daño → efectos**. Mientras alguien decide una reacción, no se puede tirar el daño (la mesa lo pone el primero en «Ahora»).
- **Reacciones automáticas** (SRD 5.2.1). La mesa pregunta a quien puede, con botón en su ficha, en «Ahora» y en Tiradas; si nadie contesta en 45 s, se entiende que no reacciona:
  - *Escudo*: solo si con +5 a la CA el impacto fallaría (no contra un 20 natural). Gasta el espacio y la reacción; el ataque pasa a fallo y el +5 dura hasta el principio de tu turno (⏳).
  - *Esquiva asombrosa* (pícaro 5): el daño de ese ataque se aplica a la mitad.
  - *Reprensión infernal*: al recibir daño de una criatura a 18 m; se lanza el conjuro contra ella (salvación de Destreza, 2d10 de fuego).
  - *Contrahechizo*: cuando una criatura a 18 m lanza un conjuro, el conjuro **espera**; si lo usas, salvación de Constitución contra tu CD y, si la falla, se disipa sin efecto.
- **Rasgos de clase**:
  - *Ataque furtivo*: al impactar con arma sutil o a distancia, con ventaja o con un aliado junto al objetivo (y sin desventaja), aparece «🗡 + Furtivo Nd6». Una vez por turno; en crítico, dados dobles.
  - *Castigo divino*: al impactar cuerpo a cuerpo, «✨ + Castigo nv N» (2d8 radiante +1d8 por nivel; +1d8 contra infernales y muertos vivientes). Gasta el espacio y la acción adicional, en tu turno.
  - *Furia*: botón en la acción adicional con sus usos (tabla del bárbaro). Resistencia a contundente, cortante y perforante, +daño de furia con ataques de Fuerza, ventaja en salvaciones de Fuerza, sin conjuros. Dura hasta el final de tu siguiente turno; atacar en tu turno la prolonga (o «Prolongar furia»). Termina si quedas incapacitado.
  - *Inspiración bárdica*: da el dado (d6/d8/d10/d12 según nivel) a un aliado a 18 m; al fallar un ataque, salvación o prueba, le sale «🎵 +d8» para sumarlo.
  - Los usos de Furia e Inspiración bárdica se recuperan con los descansos (como dice cada rasgo).
- **Duraciones en turnos**: los estados pueden llevar un contador ⏳ que se ve en la figura (2D y 3D) y en el chip, y se quitan solos. Escudo y Furia la ponen solos; los conjuros con duración (1 minuto = 10 asaltos) también; el máster puede ponerla a cualquier estado desde la pestaña PNJ (hasta su turno, fin de su turno, fin del siguiente, 3 turnos, 1 minuto).
- Sin cambios en las reglas de Firestore: todo usa lo que ya puede escribir cada uno (los usos de rasgos van con los espacios de conjuro de la ficha; lo que toca algo ajeno lo aplica el máster al verlo).

## Hito 55 · Barra de acciones como Baldur's Gate 3
En combate, el jugador juega su turno desde una **barra abajo, sobre la mesa** (pantallas de más de 900 px; en pantallas estrechas sigue todo en la ficha):
- **Retrato** con la vida y los estados (con su contador ⏳).
- **Recursos del turno** encima de los iconos: acción (●), acción adicional (▲), barra de movimiento, reacción (◆), espacios de conjuro por nivel y usos de Furia / Inspiración bárdica. Al pasar por un icono se ilumina lo que gastaría.
- **Iconos** en dos filas por grupos: Ataques (armas, otra mano, empujón), Conjuros (con su nivel), Rasgos (Furia, Inspiración bárdica, Acción astuta…) y Acciones (Correr, Esquivar, Esconderse, subirse, empujar objetos…). Cada icono lleva en la esquina la forma de lo que gasta; lo que no puedes usar sale apagado y la ficha emergente dice por qué.
- Pulsar un icono lo prepara y la mesa pide el objetivo, como ya hacía. Los conjuros abren encima un panel con el espacio, los objetivos marcados y «Lanzar».
- **Avisos de reacción** (oportunidad, Escudo, Contrahechizo…) aparecen encima de la barra con sus botones.
- **Terminar turno** grande a la derecha; fuera de tu turno, a quién le toca.
- La columna de la derecha ya no repite las fases del turno: queda la ficha para consultar.
- Arreglado: con trucos de ataque en la ficha, el arma elegida podía no ser la que se tiraba (índice del ataque).

## Hito 56 · Barra compacta, barra del máster y barra superior más baja
- **Como en BG3, la barra no desaparece**: el jugador la tiene siempre que su personaje está en la mesa táctica, en combate y fuera (fuera de combate, sin recursos de turno; con cofres y bolsas cercanos para abrir o coger). Fuera de tu turno se ve apagada y con a quién le toca.
- **Arreglado**: la barra podía quedarse vacía al cambiar entre máster y jugador o tras tirar el daño (se volvía a montar la mesa y la barra creía que ya estaba pintada).
- **Más compacta**: retrato de 44 px, recursos en una línea fina, iconos de 38 px en dos filas, grupos sin títulos (el nombre sale al pasar por encima). Unos 110 px de alto.
- **Barra del máster**: la criatura que tiene el turno (o la elegida en PNJ): ataques, acciones de su perfil del SRD (alientos, conjuros con sus usos, adicional, reacciones, legendarias con su contador), acciones comunes, ataque múltiple, avisos de oportunidad y terminar turno. Al preparar un ataque, Ventaja / Desventaja encima de la barra.
- **Columna derecha**: el jugador conserva ahí su ficha para consultar (vida, CA, luz, estados, salvaciones y pruebas, dados); el máster, en PNJ, la vida, los estados con duración, las defensas y editar. Las acciones ya no se repiten.
- **Barra superior**: más espacio para la explicación del turno (izquierda) y los controles de cámara en un solo bloque de botones pegados, de una fila.

## Hito 57 · Las tiradas se resuelven solas, ventana «Táctica» y más mapa
- **Nadie valida tiradas** (como en BG3): el ataque sale resuelto al tirarlo; si impacta y no hay nada que elegir, el daño se tira solo; el daño, los conjuros con salvación y las maestrías se aplican solos (con resistencias, vulnerabilidades e inmunidades). El máster puede corregir después (✎ cambiar total, ✕ anular). Solo esperan por él las decisiones de verdad: la Resistencia legendaria de una criatura. Las reacciones (Escudo, Esquiva asombrosa…) siguen yendo antes del daño, y Ataque furtivo / Castigo divino siguen ofreciéndose con su botón.
- **Columna derecha = ventana «Táctica»**: al tocar una figura (o un objeto) su información aparece ahí, no encima del mapa. El jugador tiene «Personaje» (ficha para consultar y tirar pruebas), «Táctica» y «Tiradas»; el máster, «Iniciativa», «Tiradas» y «Táctica» (la criatura que lleva, con vida, estados y editar; o el personaje que toque).
- **Controles de la mesa** (cámara, 2D/3D, colores) en la barra de abajo de la página: arriba queda la explicación del turno y la iniciativa.
- **Barra de acciones más baja**: la fase del turno (acción, adicional, movimiento, reacción, espacios) va en una pastilla flotante encima del centro de la barra; la barra solo lleva retrato, iconos y terminar turno.

## Hito 58 · Feedback visual como en BG3
- **Cambio de turno**: sin cartel grande en mitad del mapa. Una cinta discreta bajo la barra superior («Turno de Mirra»), más vistosa y dorada cuando es el tuyo («⚔ Tu turno»), y la barra de acciones se ilumina una vez. El aviso «Te toca…» ya no tapa el mapa: parpadea el panel de arriba a la izquierda.
- **Estados con icono**: cada estado tiene su icono (⤵ derribado, ☠ envenenado, 🛡 Escudo, 😡 Furia…). Sobre cada figura sale una fila de iconos con los turnos que les quedan (2D y 3D), en la iniciativa y en las fichas, en vez de anillos de colores apilados y carteles de texto.
- **Empujón contado desde quien empuja**: «🤚 ¡Derribado!» / «¡Apartado!» o «Resiste el empujón» (antes salía «✓ Salva», que parecía un éxito tuyo cuando era del enemigo).
- Los avisos (toasts) ya no tapan la barra de acciones.

## Hito 59 · Barra organizada como BG3 y solo juega quien está en la escena
- **Pestañas como BG3** a la izquierda de los iconos: ▦ Todo · ⚔ Armas · ✨ Hechizos · ★ Habilidades (Furia, Inspiración bárdica, Acción astuta, rasgos y acciones del perfil de las criaturas) · ⚙ Comunes (Correr, Destrabarse, Esquivar, Esconderse, Ayudar, Buscar, Empujón, Lanzar objeto, subirse, empujar objetos, abrir cofres).
- Fuera de la barra lo que no es de combate (Estudiar, Influir, Preparar una acción, Utilizar): se hacen como pruebas desde la ficha.
- La fase del turno solo con símbolos, como BG3: ● acción, ▲ acción adicional, barra de movimiento, ◆ reacción y los espacios de conjuro.
- **Solo juega quien está en la escena**: en una escena táctica, un jugador cuyo personaje no está en la mesa ve la mesa pero no tiene barra, ni dados, ni pruebas («no está en esta escena»). El «Ver como» del máster y «Pedir una tirada» solo ofrecen a los personajes que están en la mesa.

## Hito 60 · Ataques de oportunidad que sí golpean
- El ataque de oportunidad se resuelve en la casilla desde la que la criatura sale del alcance (justo antes de salir, como dicen las reglas), no donde acaba su movimiento. Antes se comprobaba el alcance con la posición final y nunca llegaba a pegar.

## Hito 61 · Alturas en los mapas generados y feedback de los ataques
- **Generadores con relieve**: en ⚙ Mapa del editor y al crear una escena se elige «Alturas: sin / algunas / muchas». Interior (mazmorra, cueva): tarimas de 1,5 m y galerías de 3 m con 🪜 escaleras. Exterior (regiones): lomas de 3 m con ladera de 1,5 m y algún risco con ⛰️ rampa (nueva pieza). Deja una nota oculta para el máster. Se retoca con la herramienta de alturas.
- **Registro de combate en la mesa** (arriba a la izquierda, como el de BG3): «Guerrero → Brena: impacta · Cimitarra», «Brena recibe 7 de daño», «⤵ Goblin: Derribado», «Goblin resiste el empujón», salvaciones de conjuros, reacciones usadas, quién cae. Cada línea se desvanece a los pocos segundos. Respeta lo que no se ve (sale «Alguien»).
- **Sonidos**: el golpe se oye al salir (tajo, cuerda de arco, magia) y al llegar (impacto, crítico o fallo); salvación superada (choque metálico) o fallada; curación; alguien cae; y un aviso de dos notas cuando te toca decidir una reacción. En 2D también (antes solo sonaba en 3D).
- Sin textos duplicados: el «¡Impacto!» lo anima la mesa una sola vez; el empujón se cuenta desde quien empuja.

## Hito 62 · PNJ del Lore con ficha de combate
- **Un PNJ es una ficha del Lore**: historia (nombre, papel, lugar, estado, actitud, retrato, lo que saben los jugadores y los secretos) y, para el máster, una **«⚔ Ficha de combate»**.
- **Plantillas del SRD** para empezar: plebeyo, bandido, capitán bandido, pendenciero y su jefe, guardia y su capitán, guerreros, batidor, berserker, gladiador, caballero, noble, espía, asesino, piratas, sacerdotes, sectarios, druida, mago, archimago, siervo de vampiro y goblinoides (goblins, hobgoblins, kobold, gnoll, osgos). O **desde cero**.
- Todo se cambia: CA, PG (máximos y actuales), velocidad, tamaño, VD (da la competencia), características y salvaciones competentes, ataques (de las armas del equipo, calculados con las reglas, o propios), ataque múltiple, conjuros del compendio con sus usos (a voluntad, 1/día…), y acciones o rasgos de texto (acción, adicional o reacción). Lo que no viene de la plantilla es regla de campaña.
- **«Disponible en la mesa»**: el botón 👹 de la mesa tiene la pestaña **📖 Mis PNJ** para ponerlos (hostil = enemigo; aliado o neutral = PNJ). También «Poner en la mesa ahora» desde su ficha.
- **Recurrentes**: lo que le pasa en la mesa vuelve al Lore (PG que le quedan; herido o muerto). Los muertos ya no salen en la lista.
- En la mesa, su ficha en «Táctica» enlaza al Lore y tiene **«👁 Mostrar a los jugadores»** (para las escenas de rol, sin combate: un mapa sin iniciar combate ya es una escena de rol).
- La ficha de combate se guarda con los secretos del máster: los jugadores no ven sus números.

## Hito 63 · PNJ híbridos y al día en la mesa
- **La figura sigue a su ficha**: si el máster cambia la ficha de combate en el Lore (otra plantilla, conjuros, ataques, características, nombre o retrato) con el PNJ ya en la mesa, la figura se pone al día al momento (conserva el daño que llevaba) y su barra muestra lo nuevo.
- **＋ Mezclar con esta**: añade a la ficha los ataques, acciones, rasgos y conjuros de otra plantilla sin quitar nada, para hacer híbridos (un bandido con conjuros de mago, un goblin con rasgos de berserker…). Los conjuros se juntan en un solo bloque.

## Hito 64 · La oscuridad cuenta al atacar
- Regla del SRD («Visión y luz»): quien ataca a una criatura que no ve porque está a oscuras tiene desventaja; si es el objetivo el que no ve al atacante, el atacante tiene ventaja. La luz brillante o tenue (antorchas, faroles, luz de la escena) y la visión en la oscuridad (personajes por su especie o su ficha; criaturas por su perfil del SRD) lo deciden. Sale en el porcentaje al apuntar y en el «por qué» de la tirada. Solo con la visión de la mesa activada.

## Hito 65 · Anticipar: qué conviene hacer antes de hacerlo
- Al apuntar, cada objetivo enseña lo necesario para decidir, como en BG3: **% de impactar**, **daño posible ya ajustado** a su resistencia (½), inmunidad o vulnerabilidad (×2), y **☠** si con ese golpe puede caer («☠?») o cae seguro («☠ cae»). El «por qué» de la etiqueta lo explica.
- **Conjuros con salvación**: «CD 15 Des · falla 60%» por objetivo (con su bonificador, ventajas, Bendición/Perdición y resistencia mágica), y si el daño (o la mitad, si la supera) puede tumbarlo.
- **Áreas**: al pasar la plantilla, cada criatura de dentro lleva su etiqueta (falla %, daño, ☠) y los aliados salen marcados «⚠ aliado».

## Hito 66 · Reacciones a tu gusto, máster desconectado y confirmar lo arriesgado
A partir de la auditoría de diseño comparada con Baldur's Gate 3:
- **Reacciones configurables** (como BG3): pulsa el rombo ↺ de la reacción en la barra (o ↺ fuera de combate) y elige para cada una *Preguntar*, *Siempre* o *Nunca*: ataque de oportunidad, Escudo, Esquiva asombrosa, Reprensión infernal y Contrahechizo (solo salen las que tiene tu personaje). *Siempre* la usa sola en cuanto se puede; *Nunca* ni pregunta. Se guarda en la ficha. El máster tiene una para el ataque de oportunidad de sus criaturas. En pantallas estrechas está en la ficha («↺ Preguntar, siempre o nunca»).
- **Si el máster no está conectado, se dice**: el daño, los empujones y los efectos sobre otros los aplica su navegador. El indicador de conectados muestra «máster fuera», la barra avisa y cada tirada que espera lleva «⏳ Se aplicará cuando el máster esté conectado». Con el máster conectado solo se avisa si tarda o si es decisión suya (Resistencia legendaria). Sin internet, el indicador dice «Sin conexión».
- **Confirmar solo lo arriesgado**: si un conjuro dañino va a alcanzar a aliados (o a ti), la barra pregunta «¿Lo lanzas igualmente?» antes de gastar nada. Lo demás se lanza sin diálogos.

## Hito 67 · Iconos grabados, registro por rondas y desglose de pruebas
- **Iconos de la barra con el estilo del mapa del mundo**: armas, conjuros, rasgos, acciones, pestañas, estados y usos son ahora grabados de game-icons.net (CC BY 3.0, autores en `assets/hud/LEEME.txt`), teñidos según lo que hacen: acero para armas, naranja para el fuego, azul hielo para el frío, verde para curar o violeta para la magia. El medallón toma un reflejo de ese color.
- **Registro de tiradas por rondas**: cabeceras «⚔ Ronda N» y «Fuera de combate», un filtro «Ver» por personaje y, al tocar una tirada, su cálculo en una línea: los dados (los descartados por ventaja o desventaja salen tachados), el modificador, el total, contra qué CA o CD y qué salió.
- **Desglose de pruebas en la ficha**: ○ sin competencia, ● competente, ◆ pericia, con la característica al lado. Al pasar el ratón se ve el cálculo («Inteligencia +4 · competencia +3 = +7»). Las salvaciones en las que eres competente salen marcadas.

## Hito 68 · Centro de mando del máster, retrato grande y barras más compactas
- **Centro de mando** (pestaña «Mando» arriba, solo para el máster, y también el botón 🎛 del panel del máster en Partida, en columna):
  - **Estado del grupo**: una tarjeta por personaje con vida, CA, estados (con los turnos que quedan y el nivel de cansancio), inspiración heroica (se da o se quita con un toque), PX totales y del siguiente nivel, **PX ganados en esta sesión** y anotados sin conceder, dados de golpe gastados, salvaciones contra muerte si está a 0 y **mermas permanentes**. Las mermas son una regla de campaña (el SRD no las trae). Se anotan con Enter y el jugador las ve en su ficha.
  - **Experiencia**: notas de PX por hechos (acción heroica, buen plan…). Se marcan los personajes, los PX y el motivo, y se pueden **anotar** (se conceden cuando quieras o al cerrar la sesión, porque rellenan solas el reparto) o **conceder ya**. Aquí están ahora las **subidas de nivel**, que salen del panel de Roleplay.
  - **Botín**: lo encontrado **en esta sesión** (monedas y objetos) y el **general** sin repartir, con las mismas opciones de reparto que en Personajes.
  - **Próximas sesiones**: notas para el futuro con tipo (próxima sesión, trama, PNJ, preparar, idea), filtro y casilla de hecho.
  - **Reglas a mano**: busca en el libro (apartados del índice), el glosario, los conjuros y los monstruos del SRD y añádelos a tus accesos, en carpetas si quieres. El glosario y los conjuros se abren en una ventana allí mismo; las páginas y los monstruos, en Reglas. En Reglas, el máster tiene también un botón «📌 A mano» en cada entrada del glosario, cada conjuro y cada monstruo.
  - Lo del máster se guarda en `secrets/mando`, que los jugadores no ven. Las mermas van en la ficha.
- **Retrato grande junto a los iconos** (como BG3): la barra centra el retrato con los botones. El retrato es alto, sobresale por encima de la barra y lleva la vida abajo. Sin imagen, muestra la silueta de su clase o criatura (las mismas que las peanas).
- **Barras compactas**: el botón de planta (🏰) pasa a la primera línea de herramientas del máster y los tres selectores (luz, interior y sonido) quedan en una sola línea. Los tres botones de la sesión en curso ocupan una línea. El orden de pestañas es Táctica, Iniciativa y Tiradas.
- Los estados de la tira de iniciativa usan los iconos grabados.
- Arreglado: el formulario «Añadir al botín» cerraba una etiqueta de más y podía descolocar lo que venía detrás.

## Hito 69 · Reglas del libro a mano, una sola luz, mesa 3D a escala y pasos entre escenas
- **Apartados del libro a mano**: en Reglas, el máster tiene junto a cada título del libro un 📌 que lo guarda en sus reglas a mano, y un ☐ para marcar varios apartados y guardarlos juntos con un nombre. En Mando se abren en una ventana con su texto (del título al siguiente apartado, aunque siga en la página siguiente).
- **Una sola luz**: el selector de luz une el aspecto de la mesa y el nivel de luz de las reglas (SRD: luz tenue = desventaja en Percepción para ver; oscuridad = no se ve sin visión en la oscuridad o luz, y atacar sin ver es con desventaja). Las opciones son ☀️ Día, 🕯 Interior, ◐ Penumbra, 🌙 Noche y ● Oscuridad, y las dos últimas oscurecen de verdad la mesa 3D. La segunda línea de herramientas del máster tiene cuatro controles: luz, música, plantas y visión.
- **Peanas iluminadas**: la ilustración de las figuras de cartón brilla un poco por sí misma y ya no se apaga con la luz de interior.
- **Estados como en BG3**: en la placa de cada figura, debajo de la vida, en iconos pequeños con los turnos que quedan. Desaparece la fila de iconos que flotaba sobre la cabeza.
- **Escenario a escala de las figuras**: mesas, sillas, barriles, cofres, columnas y demás miden lo que deben junto a una figura de 1,8 m, y los muros altos pasan de 1,5 m a unos 2,4 m (también las puertas). Antes todo salía a dos tercios.
- **Mapas más grandes y pasos entre escenas**: las escenas pueden medir hasta 80 × 80 casillas (120 m). El nuevo objeto «🧭 Paso a otra escena» (en Marcas) une una mesa con otra. En partida, el máster lo toca y pulsa «Llevar al grupo», y el grupo aparece en la otra escena junto al paso de vuelta. Sirve para un castillo por alas o una mina por niveles; las plantas siguen sirviendo para lo vertical.
- **Pestañas del máster**: Escenas y Mando van juntas justo después de Partida, con fondo rojizo propio.
- **Tira de iniciativa limpia**: retrato, debajo la iniciativa y la vida en una línea, y los estados en iconos pequeños. Nada se monta encima de nada.

## Hito 70 · Escaleras que llevan a algún sitio, crónica como línea de tiempo y tira de iniciativa sin estados
- **Escaleras y pasos con destino**: en el editor de una 🪜 escalera (o una rampa, o un 🧭 paso), «Lleva a» puede ser otra planta del mismo mapa u otra escena. Sin destino, es decorado, como antes. Fuera de combate, cuando un jugador deja a su personaje encima, le sale «¿Subir a «Primera planta» con el grupo?». Si dice que sí, todo el grupo pasa y aparece alrededor de la escalera de vuelta; las criaturas se quedan en su planta. El grupo va siempre junto, porque la mesa es una sola. En combate no pregunta: el máster tiene «Llevar al grupo» en el propio objeto. Como cambiar la mesa es cosa del navegador del máster, si no está conectado la petición queda «⏳ pendiente». Al añadir un sótano o quitar una planta, los enlaces siguen apuntando bien.
- **Crónica como línea de tiempo**: arriba, el total de la campaña (sesiones, botín, experiencia, enemigos abatidos, PNJ caídos y lugares). Debajo, cada sesión es un punto de la línea, y sin desplegarla ya muestra 💰 botín · ⭐ PX · ⚔ enemigos · 💀 PNJ caídos · 📍 lugares. Desplegada, muestra el detalle (qué se encontró, a quién se abatió, por dónde se pasó) y todas las notas. El navegador del máster lo apunta solo durante la sesión: las criaturas que caen a 0 PG (las de Lore cuentan como PNJ), las escenas cargadas, los lugares del mapa del mundo y el botín. Los PX de la sesión se guardan al cerrarla. Las sesiones anteriores a esta versión solo tienen sus PX.
- **Tira de iniciativa sin estados**: rompían la barra. Siguen en la placa de la figura, en la barra de acciones y en Táctica, y al pasar el ratón por la tira.

## Hito 71 · Herramientas del mapa del mundo en la columna derecha
- En la página Mapa, las pestañas (🌍 Mapa global / 🗺 Regiones) y las herramientas (+ Añadir lugar, Subir mapa, ✏️ Dibujar región…) pasan arriba de la columna derecha, antes de la lista de regiones y lugares. Se quedan fijas al desplazar la lista y ya no tapan el mapa.
- Crónica: las sesiones jugadas antes del registro automático lo indican («sin registro de botín, enemigos ni lugares») en vez de parecer vacías.

## Hito 72 · Generador de mapas (detalle de regiones y mapas completos)
- **Detallar una región** (Mapa › Regiones › una región sin mapa propio › «🧭 Detallar la región»): lee el trozo del mapa de debajo (el vuestro o el de ejemplo) dentro del recuadro de la región, separa mar y tierra por el color y dibuja un mapa ampliado y con más detalle. Lleva costa recortada, montañas y colinas, bosques, ríos que bajan al mar y caminos entre los lugares. Fuera del contorno de la región sale velado.
  - Ajustes: forma (calcar la costa, todo tierra para el interior, isla, continente, archipiélago), un control agua ↔ tierra por si confunde el mar, montañas, bosques, ríos, clima (templado, árido, frío o tropical), caminos automáticos entre los lugares, caminos a mano («✏️ Trazar un camino») y «🎲 Otra versión».
  - Todo se ve en directo antes de guardar. Castillos, posadas, ciudades y demás se ponen como siempre con «+ Añadir lugar», y los caminos automáticos los unen.
- **Mapa completo** (Mapa global › «🧭 Generar un mapa»): isla, continente o archipiélago, con título. Se usa cuando no hay mapa subido, por ejemplo para empezar otra campaña.
- **No se guarda ninguna imagen**: solo la semilla, los ajustes, la silueta de tierra comprimida y los caminos (alrededor de 1 KB). El mapa se dibuja en cada navegador.
- Los caminos automáticos solo llegan a los lugares que cada uno ve: los de un lugar oculto no delatan nada a los jugadores.

## Hito 73 · Retocar a mano el mapa generado
- En el generador, **«✋ Retocar a mano»** fija lo generado: la tierra pasa a una máscara que se puede pintar y cada montaña, colina, mancha de bosque, río y camino pasa a ser un elemento propio. Desde ahí, herramientas en la columna derecha:
  - ✋ **Mover y cambiar de tamaño**: toca un elemento para seleccionarlo y arrástralo; abajo cambias su tamaño, conviertes una montaña en colina (o al revés) o lo borras. En ríos y caminos se arrastra un punto suelto o el trazo entero. Si no hay nada debajo, se mueve el mapa.
  - ⛰ Montañas, ◠ colinas y 🌲 bosques con pincel (clic o arrastrar; el tamaño del pincel manda).
  - 〰 Ríos y 🛣 caminos nuevos, trazando puntos.
  - 🔤 **Rótulos** con el texto y el tamaño que quieras.
  - 🟫 **Pintar tierra** y 🌊 **pintar mar**, para cambiar la costa, abrir una bahía o sacar una isla.
  - 🧽 **Borrar** lo que toque el pincel.
- Los lugares (castillos, posadas, ciudades…) se mueven como siempre, arrastrando su marcador.
- «↺ Volver a generar» descarta los retoques y vuelve a los deslizadores.
- Sigue sin guardarse ninguna imagen: un mapa retocado ocupa unos 10 KB de datos.

## Hito 74 · Ruta del grupo, escenas ordenadas, mazmorras a medida y notas privadas
- **El grupo en el mapa del mundo**: una ficha ⚑ «El grupo» marca dónde está y todos la ven. El máster la coloca («⚑ Colocar al grupo»), la arrastra (si la suelta sobre un lugar, el grupo queda en ese lugar) o pulsa «⚑ El grupo está aquí» en un lugar. También se mueve sola al marcar dónde estáis desde la partida o al mostrar un lugar.
- **Ruta de cada sesión**: con una sesión abierta, cada paso del grupo se apunta en la ruta de esa sesión y se dibuja en el mapa como un trazo discontinuo con sus paradas. Arriba de la columna derecha se elige qué ver: la ruta de esta sesión, todas, la de una sesión concreta o ninguna. «↶ Último paso» quita un paso marcado sin querer. En la Crónica, cada sesión con ruta tiene «🧭 Ver la ruta de esta sesión en el mapa».
- **Escenas ordenadas**: buscador, carpetas (campo «Carpeta» en cada escena, con sugerencias de las ya usadas), agrupar por carpeta o por lugar, plegar carpetas, orden propio (▲▼ al pasar el ratón), A–Z o recientes, y una marca «Jugada» (✓) para las que ya salieron.
- **Mazmorras a medida** (Nueva escena › «Tamaño y salas»):
  - Ancho y alto de la cuadrícula, salas pequeñas, medianas o grandes, y pocas, normales o muchas.
  - **Sala principal al final**: una sala grande al fondo, lejos de la entrada, con puerta cerrada o rastrillo, alfombra, columnas, altar y tesoro. En una cueva es una gruta abierta al fondo.
  - Tipos nuevos:
    - ⚰ **Cripta**: osarios, capillas, nichos y la cripta mayor.
    - 🗼 **Torre**: de 2 a 6 plantas redondas. Las escaleras ya llevan de una planta a otra: al pisarlas, el grupo sube o baja. La última planta es la sala principal.
- **Notas privadas**: el cuaderno de cada personaje y las nuevas «🔒 Mis notas» de cada entrada del Lore solo las ven su jugador y el máster. El máster ve en cada entrada lo que ha apuntado cada jugador. Los cuadernos que ya existían se mudan solos la primera vez que el máster abre la campaña.
- **Arreglo**: el mapa generado del mundo (Hito 72) no se guardaba en la nube. Ahora sí.
- ⚠️ **Hay que publicar las reglas de Firestore** (`firestore.rules`): añaden la colección `notes`. Sin ellas, los jugadores no pueden guardar sus notas.
