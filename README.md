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
