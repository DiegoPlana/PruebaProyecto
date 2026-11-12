# Santa Quiteria · Albergue y restaurante

Aplicación DAW de Los Murlocs desarrollada en **DiegoPlana/PruebaProyecto**, a partir del documento aportado por Diego. El repositorio estaba vacío: no se ha copiado ni modificado el repositorio original del equipo.

**Estado: primera versión funcional en desarrollo. No utilizar con huéspedes reales.** La identidad usa Niebla Suave `#E8ECEB`, Verde Abeto `#0B201F`, Cerceta `#1A6566` y Oro Viejo `#C28B00`. La ilustración es conceptual y está identificada como tal.

## Empieza por aquí

Lee [la guía para entender y explicar el proyecto](docs/GUIA_PARA_ENTENDER_EL_PROYECTO.md): estructura, recorrido de una reserva, calendario, estados y comandos de trabajo. La rama de esta reorganización es `refactor/codigo-claro-daw`.

## Qué incluye

- Web pública adaptable a móvil: presentación, habitaciones de PostgreSQL, calendario mensual, selección de estancia, camas individuales o habitación completa, formulario y referencia de solicitud.
- Alojamiento: retención pendiente sin caducidad, disponibilidad para todo el intervalo, prevención de solapamientos en PostgreSQL, reintentos idempotentes y modificación atómica.
- Panel con sesiones reales: bandeja, filtros, aceptar/rechazar, modificación de estancia, entrada/salida reales, inventario, bloqueos, planning por camas, métricas y auditoría.
- Restaurante independiente: turnos configurables, aforo, solicitud, retención, aceptar/rechazar y protección contra sobreaforo concurrente.
- Docker Compose, migraciones versionadas, seed explícito de desarrollo y pruebas automáticas con PostgreSQL real en GitHub Actions.

No hay pagos, cuentas de visitantes ni correo real. Todos los administradores tienen el mismo rol en este incremento. Consulta los límites y siguientes tareas en [docs/ASTRA_PROGRESS.md](docs/ASTRA_PROGRESS.md).

## Navegación multipágina

Esta rama incorpora las ocho páginas independientes y el menú compartido. Para revisar esta entrega, usa `refactor/codigo-claro-daw` después del clonado. Consulta [rutas, archivos, comprobaciones e integración](docs/DESIGN_NAVIGATION.md).

Para editar contenido o navegación, modifica `frontend/` y ejecuta `npm run build:pages`; `public/*.html` es la salida generada. `npm run check` detecta documentos desactualizados. No se añade un framework.

## Arranque con Docker (Linux, macOS o Windows con Docker Desktop)

Necesitas Git y Docker con `docker compose`.

```bash
git clone https://github.com/DiegoPlana/PruebaProyecto.git
cd PruebaProyecto
git switch refactor/codigo-claro-daw
cp .env.example .env
```

En PowerShell, sustituye `cp` por `Copy-Item .env.example .env` si lo necesitas.

Edita `.env`:

1. Sustituye `POSTGRES_PASSWORD` por una clave aleatoria larga **alfanumérica** (evita caracteres que requieran escapar la URL).
2. Cambia `ADMIN_EMAIL` y añade una contraseña única de 12–128 caracteres en `ADMIN_PASSWORD`.
3. Mantén `ALLOW_DEMO_SEED=true` solo para los datos ficticios locales.
4. `APP_ORIGIN=http://localhost:3000` debe coincidir exactamente con la dirección usada en el navegador.

```bash
docker compose up -d --build
docker compose run --rm app npm run seed
docker compose run --rm app npm run admin
```

Abre **http://localhost:3000** y **http://localhost:3000/admin**. El seed crea Abeto, Ribera y Luz, con ocho camas cada una. Son nombres y capacidades **provisionales**, editables desde el panel. El restaurante empieza sin turnos: crea uno desde el panel con la fecha, hora y capacidad que quieras probar.

Después de crear el administrador, borra `ADMIN_PASSWORD` de `.env` y recrea el contenedor de aplicación:

```bash
docker compose up -d --force-recreate app
```

La contraseña permanece guardada como hash scrypt en PostgreSQL. Ejecutar `npm run admin` de nuevo no cambia una contraseña existente. `.env` está excluido de Git y de la imagen Docker.

```bash
docker compose logs -f app
docker compose down
```

`down` conserva los datos. No uses `down -v` salvo que quieras borrar expresamente toda la base de datos local.

## Ejecutar sin Docker

Necesitas Node.js 22 o superior y PostgreSQL 17 con la extensión `btree_gist` disponible. Crea una base de datos para desarrollo y configura `DATABASE_URL` en `.env`; el usuario debe poder crear la extensión durante la migración.

```bash
npm ci
npm run migrate
npm run seed
npm run admin
npm start
```

El servidor escucha en el puerto 3000. No requiere compilar frontend: HTML, CSS y módulos JavaScript nativos servidos desde el mismo origen que la API. No se incluyen dependencias gráficas ni fuentes externas.

## Pruebas

```bash
npm run check
npm test
```

Sin `RUN_DB_TESTS=true`, las pruebas de integración aparecen **SKIP**, no aprobadas. Sin PostgreSQL se verifican la validación, las rutas y la lógica de presentación; las pruebas de integración quedan pendientes.

Para la suite completa, crea una **base de datos exclusiva y desechable**: los tests vacían sus tablas. No uses la base del desarrollo que quieras conservar ni producción.

```bash
DATABASE_URL=postgres://usuario:clave@localhost:5432/albergue_test RUN_DB_TESTS=true npm test
```

En PowerShell:

```powershell
$env:DATABASE_URL = 'postgres://usuario:clave@localhost:5432/albergue_test'
$env:RUN_DB_TESTS = 'true'
npm test
```

El workflow [Pruebas PostgreSQL](.github/workflows/test.yml) crea PostgreSQL 17, ejecuta la suite y comprueba migraciones y seed repetidos. Incluye carreras cama/cama, cama/habitación y aforo de restaurante, idempotencia, rollback, sesiones, CSRF, privacidad pública y persistencia tras reinicio HTTP. El estado de ejecución real está en [el registro de progreso](docs/ASTRA_PROGRESS.md).

## Arquitectura

- `src/admin-data.mjs`: consultas de lectura que rellenan el panel.
- `src/server.mjs`: HTTP, API, cabeceras, archivos estáticos y autorización de rutas.
- `src/booking.mjs`: inventario, disponibilidad, solicitudes, ocupación, bloqueos y transacciones.
- `src/restaurant.mjs`: turnos, aforo y resolución de solicitudes.
- `src/auth.mjs`: scrypt, sesiones, CSRF y límites de intentos persistentes.
- `db/`: migraciones SQL. `scripts/`: migrar, datos ficticios, crear administrador y validar sintaxis.
- `public/js/`: módulos separados para calendario, habitaciones, reservas, restaurante, solicitudes y presentación del panel.
- `public/`: web y panel sin framework. `test/`: validación e integración.

Documentación: [modelo y concurrencia](docs/ARCHITECTURE.md), [API](docs/API.md), [seguridad y despliegue](docs/OPERATIONS.md), [continuidad](docs/ASTRA_PROGRESS.md).
