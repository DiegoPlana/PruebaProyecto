# API JSON

Mismo origen que el frontend. Todos los POST/PATCH/DELETE requieren `Content-Type: application/json` y `Origin` igual a `APP_ORIGIN`. Errores: `{ "error": "mensaje" }`; 400 validación, 401 sesión ausente, 403 origen/CSRF, 404 inexistente, 409 conflicto de inventario/transición/duplicado, 413 cuerpo grande, 415 contenido incorrecto, 429 límite de intentos y 500 error interno sin detalles privados.

| Método y ruta | Función |
| --- | --- |
| GET `/api/health` | Comprueba conexión PostgreSQL; no devuelve configuración |
| GET `/api/calendar?month=YYYY-MM` | Disponibilidad nocturna agregada sin huéspedes |
| GET `/api/availability?arrival=YYYY-MM-DD&departure=YYYY-MM-DD` | Habitaciones y camas disponibles para el intervalo completo |
| POST `/api/bookings` | Solicitud pendiente; cabecera `Idempotency-Key` UUID obligatoria |
| GET `/api/restaurant/availability?date=YYYY-MM-DD` | Turnos y aforo libre |
| POST `/api/restaurant/requests` | Solicitud de restaurante; misma cabecera de idempotencia |
| POST `/api/login` | `{email,password}`; cookie HttpOnly y token CSRF |
| GET `/api/session` | Email y CSRF de la sesión autenticada |
| POST `/api/logout` | Invalida la sesión y borra la cookie |
| GET `/api/admin/data` | Solicitudes, recursos, turnos, bloqueos, métricas y auditoría |
| PATCH `/api/admin/bookings/:id/status` | `{status: "ACEPTADA" o "RECHAZADA"}` |
| PATCH `/api/admin/bookings/:id` | Modificación atómica con formulario completo |
| PATCH `/api/admin/bookings/:id/check` | `{action: "in" o "out"}` |
| POST `/api/admin/rooms` | `{id?,name,description,capacity,active}` |
| POST `/api/admin/blocks` | `{bedIds,arrival,departure,reason}` |
| DELETE `/api/admin/blocks/:id` | Desactiva bloqueo administrativo |
| POST `/api/admin/slots` | `{id?,date,time,capacity,closed}` |
| PATCH `/api/admin/restaurant/:id/status` | Aceptar/rechazar solicitud de restaurante |

Todas las rutas `/api/admin/` exigen sesión. Las mutaciones autenticadas y logout exigen además `X-CSRF-Token`, recuperado de login/session. El rol único es administrador. El HTML del panel no es secreto; los datos y operaciones de su API están protegidos en backend.

Solicitud de camas:

```json
{
  "mode": "BEDS", "bedIds": [1, 2], "people": 2,
  "arrival": "2090-06-10", "departure": "2090-06-13",
  "firstName": "Persona", "lastName": "Ficticia",
  "email": "prueba@example.test", "phone": "+34 600000000", "notes": ""
}
```

Para una habitación: `mode: "ROOM"`, `roomId: 1` y personas no superiores a la capacidad; se retienen todas sus camas activas. Para restaurante: `slotId`, `people` y los mismos campos de contacto. Nunca se exige DNI.

Respuesta pública al guardar: `{reference,status:"PENDIENTE",message}`. No se devuelve ID interno de la solicitud ni datos del huésped. Las claves numéricas de cama y turno identifican recursos seleccionables, nunca clientes.

No hay consulta pública por referencia que permita enumerar huéspedes o contactos. La confirmación aparece en pantalla; no implica correo enviado ni reserva aceptada.
