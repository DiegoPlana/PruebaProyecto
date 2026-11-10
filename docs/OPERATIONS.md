# Operación y seguridad

## Entorno

No se ha desplegado públicamente ni creado infraestructura AWS. Compose publica la aplicación solo en `127.0.0.1:3000`; PostgreSQL no tiene puerto publicado. El volumen mantiene la información entre reinicios.

Para un despliegue posterior: confirmar responsable y textos legales, usar HTTPS delante de la aplicación, definir `NODE_ENV=production`, `APP_ORIGIN=https://dominio-verificado`, desactivar seed, usar credenciales únicas, establecer backups cifrados y ensayar restauración. La aplicación rechaza producción con origen sin HTTPS. Es necesario revisar capacidades, proxy, límites de tamaño, secretos y permisos de la cuenta DB antes de producción.

`ALLOW_LOCAL_PREVIEW` solo habilita el origen HTTPS del host de la previsualización cuando no se está en producción. No se configura en Compose ni en `.env.example`.

## Controles implementados

- Scrypt con salt aleatorio para contraseñas de 12–128 caracteres; comparación constante del hash.
- Sesiones aleatorias de 256 bits. Solo se persiste el hash del token. Caducidad a ocho horas. Cookie HttpOnly, SameSite=Strict y Secure en producción.
- CSRF por token de sesión y comprobación estricta de Origin en mutaciones. CORS no abierto.
- Consultas parametrizadas y validación de contactos, fechas, cantidades, IDs, transiciones e inventario en servidor.
- Límite persistente por IP: 10 intentos de login y 30 envíos de formulario en 15 minutos. No se confía en X-Forwarded-For. Con proxy, todos pueden compartir ese límite: ajustar estrategia explícitamente antes de exposición pública.
- Cuerpo JSON limitado a 16 KiB. CSP sin scripts inline, protección de contenido y frames, HSTS en producción.
- Frontend escapa todo dato persistido al generar HTML. No se incluyen fotos, fuentes, mapas ni analítica de terceros.
- Calendarios públicos sin nombre/contacto de huéspedes. Logs de errores sin SQL, valores o secretos.
- Migraciones y seed idempotentes. Seed prohibido en producción.

## Conservación y privacidad pendientes

No se promete cumplimiento legal certificado. No se han inventado responsable del tratamiento, consentimiento, contactos, cartas, precios ni dirección oficial.

Antes de datos reales hay que acordar una política de retención, implementar borrado/anonimización con integridad histórica, limpiar registros caducados de rate limits e idempotencia, establecer roles y revisar procedimientos de acceso/exportación/corrección. No hay borrado automático de solicitudes ni caducidad automática de pendientes. El DNI no se recoge.

El proyecto no envía emails: es una limitación explícita en UI y documentación. Pendiente un adaptador de notificaciones con outbox transaccional, captura local y proveedor de producción configurado solo con autorización.

## Accesibilidad y alcance de comprobaciones

HTML semántico, enlace para saltar contenido, labels, formularios nativos, estados textuales además de color, foco visible, diálogos nativos y `prefers-reduced-motion`. Los CTA dorados usan texto oscuro. La maqueta incluye puntos de adaptación a 1100, 800 y 540 px.

No se certifica WCAG AA sin auditoría completa. Hay que probar teclado y lector de pantalla, zoom al 200 %, contraste de todos los estados, móvil real y un flujo completo con base de datos. El registro de progreso distingue las pruebas ejecutadas de las pendientes.
