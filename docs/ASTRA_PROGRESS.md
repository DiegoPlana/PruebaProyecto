# Progreso · Santa Quiteria

## 2026-11-10 · fase inicial
- Destino autorizado: DiegoPlana/PruebaProyecto. Repositorio vacío en la inspección inicial.
- Rama: feat/albergue-mvp. Se inicializó main con un README para poder crear la rama.
- El repositorio original Los-Murlocs no estaba accesible; el usuario ha indicado trabajar en este repositorio. El documento adjunto es la especificación disponible.
- Stack elegido al no haber código: Node.js, JavaScript nativo, PostgreSQL, Docker Compose. Monolito modular y API del mismo origen.
- Primera entrega: alojamiento transaccional, calendario público, administración y pruebas concurrentes; extender restaurante por capacidad cuando ese flujo esté validado.
- Estado: EN DESARROLLO. No publicado ni conectado a correo real. No afirmar MVP completo antes de ejecutar las comprobaciones.

## 2026-11-10 · diseño y navegación multipágina
- Rama independiente: `design/santa-quiteria-multipagina`, basada en `feat/albergue-mvp` / `b703f94fad05517362a310ef57b4da7c32b1d2ac`.
- Ocho páginas independientes con URL propias, header/footer comunes, estado activo y navegación móvil. Paleta oficial conservada; CSS público separado del panel.
- Formularios y calendario reutilizados en sus páginas; API y datos sin modificaciones. Único ajuste de servidor: mapa de documentos públicos para URL limpias.
- `npm run build:pages`, `npm run check` y `npm test` ejecutados localmente: nueve pruebas aprobadas, catorce de PostgreSQL omitidas sin base configurada.
- Verificación remota del commit `28ca77908a9a67b69ecfadf0540036cd283b81aa`: PostgreSQL 23/23 aprobadas y navegador 50 comprobaciones aprobadas, cero errores JS, tres formularios con fixtures. Capturas de escritorio y móvil inspeccionadas. Ver enlaces e informe en `docs/DESIGN_NAVIGATION.md`.
- Registro detallado, archivos modificados y guía para el otro desarrollador: `docs/DESIGN_NAVIGATION.md`. No hay despliegue ni fusión con main.
- Propuesta de integración: https://github.com/DiegoPlana/PruebaProyecto/pull/1 (base `feat/albergue-mvp`, sin fusionar).
- Siguiente tarea: revisar e integrar la propuesta cuando el otro desarrollador esté preparado. Para continuar la interfaz: `git switch design/santa-quiteria-multipagina`, leer `docs/DESIGN_NAVIGATION.md` y editar `frontend/`; después `npm run build:pages && npm run check`.


## 2026-11-12 · Código legible para 2.º de DAW

- Rama independiente: `refactor/codigo-claro-daw`, creada sobre `main` (`a5de2eb5`). Incluye el diseño multipágina anterior (`c0e72bef`), todavía pendiente de integrar, y esta reorganización. No se modifica la rama funcional de la otra cuenta.
- Frontend público separado en calendario, habitaciones, reservas, restaurante y solicitud. Panel dividido entre eventos, tablas/planning y formularios. Nombres descriptivos, bucles explícitos y comentarios en español.
- Consultas del panel extraídas a `src/admin-data.mjs`; formato y comentarios en el servidor. Mismo contrato HTTP, transacciones, sesiones y reglas de disponibilidad. Sin migraciones ni cambios de esquema.
- HTML, CSS, JavaScript, scripts y pruebas con sangría uniforme. Prettier es solo una dependencia de desarrollo. `npm run format` regenera las páginas y `format:check` verifica el formato.
- Guía de lectura: `docs/GUIA_PARA_ENTENDER_EL_PROYECTO.md`. El README apunta a esta rama y explica los archivos fuente y generados.
- Validación local inicial: 27 pruebas, 13 aprobadas y 14 de integración omitidas por no configurar PostgreSQL local. Se añaden comprobaciones del calendario, planning y formularios; la ejecución completa de GitHub Actions y del navegador se documentará tras publicar.

### Validación de esta entrega

Código comprobado: `967d3b07f52645c728b83e6fa3fe55a1893e1443`.

- [Pruebas PostgreSQL](https://github.com/DiegoPlana/PruebaProyecto/actions/runs/43214977995): **27/27 aprobadas, 0 omitidas**. Sintaxis, páginas generadas, formato, migraciones repetidas y seed repetido correctos.
- [Pruebas de navegador](https://github.com/DiegoPlana/PruebaProyecto/actions/runs/43214978054): **51 comprobaciones, 0 errores JavaScript**. Ocho rutas a 320, 390, 768, 1024 y 1440 px; menús, recarga, historial, estados vacíos/errores y navegación sin JavaScript. Formularios de cama, habitación completa y restaurante; panel con sesión, tablas, estructura del planning, detalle, formularios de edición y cierre de sesión. API ficticia en el navegador; PostgreSQL real en la suite anterior.
- El informe de navegador registra cuatro POST ficticios: tres solicitudes públicas y el cierre de sesión del panel. No son reservas reales.
- Artefacto `evidencias-diseno` (`13943096807`): informe JSON y capturas de inicio, reservas y menú. Revisadas visualmente las capturas de escritorio y móvil. Retención de GitHub: 14 días.
- Comparación del árbol de sintaxis: autenticación, validación, reservas, restaurante, transacciones y scripts de migración/seed/administrador conservan la misma lógica; sus cambios son formato y comentarios.
- [PR de revisión #3](https://github.com/DiegoPlana/PruebaProyecto/pull/3), hacia `main`. Esta entrega contiene el trabajo multipágina anterior; revisar como entrega conjunta para evitar integrar dos veces el mismo diseño. No se ha fusionado ninguna rama.

La anotación de resultados es posterior a las pruebas y solo modifica este documento.
