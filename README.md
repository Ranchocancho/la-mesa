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
