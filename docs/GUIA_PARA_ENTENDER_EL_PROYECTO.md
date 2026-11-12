# Cómo entender y explicar Santa Quiteria

Esta guía está pensada para estudiar el proyecto de 2.º de DAW. Empieza por una pantalla y sigue lo que ocurre al pulsar un botón. No necesitas memorizar todos los archivos a la vez.

## 1. Las cuatro partes

| Parte | Qué hace | Dónde está |
| --- | --- | --- |
| HTML | Coloca títulos, enlaces, formularios y zonas de resultados. | `frontend/pages/` y `frontend/layout.html` |
| CSS | Decide colores, tamaños, distribución y adaptación al móvil. | `public/style.css` y `public/pages.css` |
| JavaScript del navegador | Lee formularios, consulta al servidor y actualiza la pantalla. | `public/app.js`, `public/shared.js` y `public/js/` |
| Servidor y base de datos | Validan, consultan y guardan habitaciones, solicitudes y sesiones. | `src/` y `db/` |

El navegador no se conecta a PostgreSQL. Envía una petición HTTP a nuestra API. Node recibe esa petición y utiliza `pg` para consultar la base de datos.

Usamos HTML, CSS y JavaScript sin framework de interfaz. Node también recibe las peticiones sin Express. PostgreSQL guarda los datos. Prettier solo ordena el formato del código durante el desarrollo; no interviene cuando un visitante pide una cama.

## 2. Orden recomendado de lectura

1. `frontend/pages/reservas.html`: identifica el formulario `search-form`, las fechas y `availability-results`.
2. `public/app.js`: es el inicio del JavaScript público; activa los módulos de cada pantalla.
3. `public/js/reservas.js`: sigue `iniciarReservas`, `buscarDisponibilidad` y `continuarSolicitud`.
4. `public/shared.js`: mira cómo `llamarApi` utiliza `fetch` y convierte la respuesta JSON.
5. `src/server.mjs`: busca `/api/availability` y `/api/bookings`.
6. `src/booking.mjs`: lee primero `availability` y después `createBooking`.
7. `db/001_initial.sql`: relaciona `rooms`, `beds`, `bookings` y `allocations` con lo anterior.

Para practicar, abre las herramientas del navegador con F12 y la pestaña Red/Network. Al consultar disponibilidad verás el GET con sus fechas. Al enviar el formulario verás el POST con los datos y la respuesta.

## 3. Qué archivo tocar

| Quiero entender o cambiar… | Archivo principal |
| --- | --- |
| Menú y pie compartidos | `frontend/layout.html` y lista de páginas en `scripts/build-pages.mjs` |
| Texto de una página | `frontend/pages/nombre.html` |
| Menú móvil | `public/navigation.js` |
| Colores generales, formularios y panel | `public/style.css` |
| Diseño de las páginas públicas | `public/pages.css` |
| Color de disponibilidad y elección de fechas | `public/js/calendario.js` |
| Tarjetas de habitaciones | `public/js/habitaciones.js` |
| Selección de camas o habitación completa | `public/js/reservas.js` |
| Búsqueda de turnos de restaurante | `public/js/restaurante.js` |
| Envío de datos de contacto y referencia recibida | `public/js/solicitud.js` |
| Eventos, filtros y acciones del administrador | `public/admin.js` |
| Tablas y planning del panel | `public/js/admin-tablas.js` |
| Campos de los formularios de edición | `public/js/admin-formularios.js` |
| Consultas que rellenan el panel | `src/admin-data.mjs` |
| Validación de fechas, números y contacto | `src/validation.mjs` |
| Sesiones, contraseñas y límites de intentos | `src/auth.mjs` |
| Conexión y transacciones | `src/db.mjs` |

`frontend/` contiene el HTML que editamos. `npm run build:pages` une cada página con la cabecera y el pie y guarda el resultado en `public/`. Es una sustitución de marcas como `{{content}}`, no otro framework. No edites a mano el HTML público generado: el siguiente build lo sobrescribe. `public/admin.html` sí se edita directamente.

Cada página tiene una URL propia: `/`, `/albergue`, `/habitaciones`, `/restaurante`, `/servicios`, `/galeria`, `/contacto` y `/reservas`. El servidor elige el HTML correspondiente. `aria-current="page"` marca el enlace actual; `#main` es únicamente un salto accesible al contenido.

## 4. Ejemplo: una persona solicita una cama

1. El usuario elige llegada, salida y número de personas en el HTML.
2. `buscarDisponibilidad` recoge esos valores y hace un GET a `/api/availability`.
3. `server.mjs` llama a `availability`, que busca camas activas sin una asignación que se solape con las fechas solicitadas.
4. El servidor devuelve JSON. `mostrarDisponibilidad` dibuja habitaciones y casillas. El botón de continuar se activa cuando hay una cama marcada por persona.
5. `continuarSolicitud` prepara la selección y abre el formulario de contacto mediante `abrirSolicitud`.
6. `enviarSolicitud` hace un POST a `/api/bookings`. Los campos `arrival`, `departure`, `people` y `bedIds` conservan sus nombres porque forman parte del contrato entre navegador y servidor.
7. `createBooking` vuelve a validar los datos y guarda la solicitud y las camas dentro de una transacción.
8. El navegador muestra la referencia recibida. Su estado inicial es **PENDIENTE**, no una reserva confirmada.

La pantalla informa de disponibilidad, pero el servidor decide si todavía puede guardar la solicitud. Otra persona podría haber solicitado la misma cama después de nuestra consulta.

## 5. El amarillo del calendario

La función `obtenerEstadoDisponibilidad` está escrita con condiciones sencillas:

```js
if (camasLibres === 0) return 'full';
if (camasLibres === camasTotales) return 'free';
return 'limited';
```

| Estado | Condición | Ejemplo con 24 camas |
| --- | --- | --- |
| Libre | Todas las camas están libres | 24 libres |
| Parcial, dorado `#C28B00` | Queda alguna libre, pero no están todas disponibles | Entre 1 y 23 libres |
| Completo | No queda ninguna libre | 0 libres |

**No hay un umbral del 50 % ni significa necesariamente «quedan pocas».** Con una sola cama retenida ya aparece el dorado. El color lo aplica CSS a `.dot.limited`. La marca de las fechas seleccionadas es una indicación distinta.

El calendario muestra cada día por separado. Para saber si la misma cama está libre durante toda una estancia hay que consultar el intervalo completo.

## 6. Fechas, estados y protección de los datos

La estancia del 10 al 12 ocupa las noches del 10 y del 11. El día 12 puede entrar otro huésped. Por eso se usa `[llegada, salida)`: incluye llegada y excluye salida.

| Estado de solicitud | Qué ocurre con sus plazas |
| --- | --- |
| PENDIENTE | Quedan retenidas mientras administración decide, sin caducidad automática en esta versión. |
| ACEPTADA | Siguen ocupadas. Se permite registrar entrada y salida reales. |
| RECHAZADA | Se liberan; el historial de la solicitud permanece. |

Los bloqueos administrativos también reducen disponibilidad. Una habitación completa retiene todas sus camas, aunque vayan menos personas que su capacidad.

Las partes más técnicas se conservan porque evitan errores reales:

- **Transacción (`tx`)**: o se guardan todos los pasos o ninguno. Si una modificación falla, se recupera la estancia anterior.
- **Bloqueo de inventario**: ordena las operaciones simultáneas. Además, la restricción de PostgreSQL impide dos asignaciones activas solapadas para una cama.
- **Idempotencia**: si se reintenta el mismo envío tras un fallo de red, su clave permite devolver la respuesta anterior sin duplicar la solicitud.
- **Validación en el servidor**: modificar el HTML o llamar a la API directamente no permite saltarse las reglas.
- **Consultas con `$1`, `$2`…**: los valores se envían separados del SQL; no se pega el texto del usuario en la consulta.
- **Sesión y CSRF**: el panel exige una sesión válida y un token adicional para modificar datos. Las contraseñas se guardan como hash.
- **`escaparHtml`**: los nombres y observaciones se muestran como texto, sin ejecutar etiquetas introducidas por un usuario.

No hace falta memorizar algoritmos criptográficos. Sí debes poder explicar qué problema resuelve cada protección y localizar su función.

## 7. Sintaxis que encontrarás

| Expresión | Significado |
| --- | --- |
| `async` / `await` | La función espera una operación, como una consulta o una petición HTTP. |
| `for (const cama of camas)` | Recorre las camas una por una. |
| `filter` | Se queda con los elementos que cumplen una condición. |
| `map` | Transforma cada elemento en otro valor. |
| `find` / `some` | Encuentra un elemento / comprueba si alguno cumple una condición. |
| `objeto?.propiedad` | Lee la propiedad solo si existe el objeto. |
| `valor ?? alternativa` | Usa la alternativa si el valor es `null` o `undefined`. |
| `...objeto` | Copia sus propiedades a otro objeto. |
| `try` / `catch` / `finally` | Intenta una tarea, trata un error y ejecuta la limpieza final. |
| `rows` | Lista de filas que devuelve PostgreSQL mediante `pg`. |

Los nuevos nombres del frontend son descriptivos y están en español. Las tablas, claves JSON y funciones públicas del backend conservan sus nombres para facilitar la integración con el trabajo de la otra cuenta.

## 8. Revisar esta rama desde Windows

Si ya tienes el proyecto, entra en su carpeta desde PowerShell:

```powershell
cd C:\Users\diego\Desktop\PruebaProyecto
git status
git fetch origin
git switch --track origin/refactor/codigo-claro-daw
npm ci
npm run check
npm run format:check
npm test
```

Si ya creaste la rama local, usa `git switch refactor/codigo-claro-daw`. Si `git status` muestra cambios tuyos, consérvalos antes de cambiar de rama; no uses un reset para descartarlos.

Para arrancar con tu `.env` y PostgreSQL ya configurados:

```powershell
npm start
```

Abre `http://localhost:3000`. Si usas Docker, consulta el apartado correspondiente del README y reconstruye la aplicación con `docker compose up -d --build`. No hay que borrar ni recrear la base de datos para esta reorganización.

Después de editar HTML, CSS o JavaScript:

```powershell
npm run format
npm run check
npm test
```

`format` da sangría y regenera páginas. `check` revisa sintaxis y que el HTML generado esté actualizado. Sin `RUN_DB_TESTS=true`, las 14 pruebas de base de datos se omiten; las demás sí se ejecutan. Las de integración requieren una base de pruebas desechable, porque vacían sus tablas.

## 9. Ejercicios para preparar la explicación

1. Cambia un texto en `frontend/pages/albergue.html`, regenera las páginas y comprueba dónde aparece.
2. Busca `--gold` en CSS y explica por qué cambiar un color no cambia la disponibilidad.
3. Sigue una solicitud en F12 y localiza los mismos campos en `createBooking`.
4. Explica con fechas por qué una salida el 12 permite otra llegada el 12.
5. En datos de prueba, rechaza una solicitud desde el panel y vuelve a consultar las camas.

Una explicación inicial puede ser: «La web tiene páginas independientes. JavaScript recoge los formularios y llama a una API en Node. El servidor valida los datos y consulta PostgreSQL. Las solicitudes pendientes retienen plazas hasta que un administrador las acepta o rechaza». Después demuestra el recorrido en los archivos, con tus propias palabras.
