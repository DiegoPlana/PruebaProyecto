# Navegación multipágina · Santa Quiteria

## Alcance e integración

Rama `design/santa-quiteria-multipagina`, basada en `feat/albergue-mvp` en el commit `b703f94fad05517362a310ef57b4da7c32b1d2ac`. La rama `main` solo contenía el README en la revisión inicial. No se sobrescribe ni se fusiona ninguna de las dos ramas.

Se mantiene HTML, CSS y JavaScript nativo. Son documentos HTML independientes, con navegación normal del navegador. No hay router de SPA, framework añadido ni navegación principal mediante anclas.

| Página | URL | Documento entregado |
| --- | --- | --- |
| Inicio | `/` | `public/index.html` |
| El albergue | `/albergue` | `public/albergue.html` |
| Habitaciones | `/habitaciones` | `public/habitaciones.html` |
| Restaurante | `/restaurante` | `public/restaurante.html` |
| Servicios | `/servicios` | `public/servicios.html` |
| Galería | `/galeria` | `public/galeria.html` |
| Contacto | `/contacto` | `public/contacto.html` |
| Reservas | `/reservas` | `public/reservas.html` |

Se conserva `/legal.html` y la administración. La privacidad adopta el mismo header y footer público. El panel mantiene su interfaz propia.

## Archivos y responsabilidades

- `frontend/layout.html`: estructura común, header, footer, enlace para saltar al contenido y carga de recursos.
- `frontend/pages/*.html`: contenido independiente de las ocho páginas y privacidad.
- `frontend/request-dialog.html`: formulario compartido existente, conservando nombres de campos y validaciones.
- `scripts/build-pages.mjs`: genera los nueve documentos públicos, títulos, descripciones, enlaces y `aria-current="page"` desde una única lista. No añade dependencias.
- `public/*.html`: salida generada y versionada. No editar manualmente; modificar las plantillas y ejecutar `npm run build:pages`.
- `public/navigation.js`: apertura/cierre del menú móvil, Escape y retorno del foco. Sin JavaScript, los enlaces permanecen visibles.
- `public/pages.css`: diseño público y responsive, aislado del panel. Reutiliza los cuatro colores oficiales de `style.css`, que no se modifica.
- `public/app.js`: inicialización condicionada a los elementos de cada página. Conserva API, payloads, idempotencia y lógica de selección; enlaces de habitaciones dirigidos a `/reservas`.
- `src/server.mjs`: único ajuste de servidor, mapa explícito de URL pública a documento. Admite barra final y peticiones HEAD. Los endpoints API, autenticación, SQL y transacciones no se modifican.
- `package.json`, `scripts/check.mjs`: generación y comprobación de coherencia del HTML.
- `test/web-routes.test.mjs`: pruebas HTTP de rutas y contratos del frontend, sin requerir PostgreSQL.
- `test/browser-ui.py`, `.github/workflows/frontend.yml`: comprobaciones de navegador con respuestas API sintéticas y capturas como artefactos de CI. No crean reservas reales.

## Mantener o integrar el diseño

```bash
git fetch origin
git switch design/santa-quiteria-multipagina
npm ci
npm run build:pages
npm run check
npm test
```

Para arrancar, utiliza la configuración de `.env` y las instrucciones del README. Los documentos generados están incluidos: `npm start` no necesita compilar nada. El despliegue debe usar el servidor Node existente para resolver las URL sin extensión.

El otro desarrollador puede revisar los cambios respecto a `feat/albergue-mvp`. Si actualiza formularios, debe hacerlo en `frontend/pages/reservas.html`, `frontend/pages/restaurante.html` o `frontend/request-dialog.html` y regenerar. Los dos puntos compartidos a revisar antes de integrar son `public/app.js` y el mapa de documentos de `src/server.mjs`.

## Verificación

- `npm run build:pages` y `npm run check`: OK local; nueve documentos coherentes y JavaScript válido.
- `npm test`: OK local; nueve pruebas aprobadas, catorce de PostgreSQL omitidas por no configurar una base de datos. No se consideran aprobadas las pruebas omitidas.
- Las pruebas HTTP verifican las ocho URL, títulos y contenido distintos, enlaces, página activa, recargas, parámetros, barra final, HEAD, recursos, privacidad, administración y 404.
- La suite de navegador cubre 320, 390, 768, 1024 y 1440 px; enlaces y recargas; menú móvil y Escape; ausencia de desbordes; atrás/adelante; formularios de cama, habitación y restaurante; estados vacíos y errores; navegación sin JavaScript. Usa fixtures explícitas: no demuestra persistencia ni concurrencia del backend.
- La revisión local de navegador quedó bloqueada por el entorno; se completó en GitHub Actions. En el commit `28ca77908a9a67b69ecfadf0540036cd283b81aa`: **50 comprobaciones de navegador aprobadas, cero errores JavaScript y tres envíos de formulario con respuestas sintéticas**. Se inspeccionaron las tres capturas: inicio de escritorio, reservas móvil y menú móvil, sin recortes ni desbordes observados.
- PostgreSQL real en GitHub Actions, mismo commit: **23 pruebas aprobadas, cero fallos y cero omitidas**; migraciones y seed idempotentes también correctos.
- [Resultado de navegador y capturas](https://github.com/DiegoPlana/PruebaProyecto/actions/runs/42831249961), [resultado PostgreSQL](https://github.com/DiegoPlana/PruebaProyecto/actions/runs/42831249965) y [artefacto de capturas](https://github.com/DiegoPlana/PruebaProyecto/actions/runs/42831249961/artifacts/13771502673). El informe de las 50 comprobaciones se conserva en `docs/design/ui-report.json`.
- Contraste calculado de las combinaciones principales: Abeto/Oro 5,63:1; Cerceta/Niebla 5,69:1; Cerceta/fondo claro 6,21:1; texto secundario/Niebla 5,06:1. Esto verifica esas combinaciones, no constituye una auditoría completa de WCAG.
- HTML revisado: sin IDs duplicados; la única ancla de navegación pública es el salto accesible `#main`.
- `test/browser-ui.py` genera `artifacts/design/ui-report.json`, `inicio-desktop.png`, `reservas-mobile.png` y `menu-mobile.png`. GitHub Actions los conserva en `evidencias-diseno` durante 14 días. Los datos de la captura de reservas son ficticios.

Para reproducir el navegador con el servidor local iniciado:

```bash
python -m pip install playwright==1.62.0
python -m playwright install chromium
python test/browser-ui.py
```

## Contenido pendiente

No se inventan fotografías, equipamientos, historia, dirección exacta, teléfono, correo, tarifas ni horarios. Galería muestra una ilustración conceptual identificada. Servicios distingue lo que permite la web de las instalaciones físicas pendientes de confirmar. Se conserva el aviso de desarrollo y el uso exclusivo de datos ficticios.
