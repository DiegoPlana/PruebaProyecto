import {
  camposHabitacion,
  camposTurno,
  camposEstancia,
  camposBloqueo,
} from './js/admin-formularios.js';
// Panel de administración: sesión, filtros y acciones del usuario.
// Las tablas y el planning se dibujan en js/admin-tablas.js.
import {
  seleccionar,
  escaparHtml,
  obtenerHoy,
  formatearFecha,
  llamarApi,
  mostrarAviso,
  ejecutarConBotonOcupado,
  obtenerDatosFormulario,
  prepararCierreDialogo,
} from './shared.js';
import { crearTablaSolicitudes, crearPlanning } from './js/admin-tablas.js';
let csrf = null,
  datosPanel = null,
  pestanaActual = 'overview',
  edicionActual = null;
prepararCierreDialogo(seleccionar('#detail-dialog'));
prepararCierreDialogo(seleccionar('#edit-dialog'));
seleccionar('#plan-date').value = obtenerHoy();
const mensajeVacio = (message) => /* HTML */ `
  <p class="fine">${message}</p>
`;

// 1. Inicio de sesión y carga de datos del panel.
async function cargarSesion() {
  try {
    const s = await llamarApi('/api/session');
    csrf = s.csrf;
    seleccionar('#admin-email').textContent = s.email;
    seleccionar('#login-view').hidden = true;
    seleccionar('#admin-view').hidden = false;
    seleccionar('#logout').hidden = false;
    await actualizarPanel();
  } catch (e) {
    if (e.status !== 401) seleccionar('#login-error').textContent = e.message;
    mostrarLogin();
  }
}
function mostrarLogin() {
  csrf = null;
  datosPanel = null;
  seleccionar('#admin-view').hidden = true;
  seleccionar('#logout').hidden = true;
  seleccionar('#login-view').hidden = false;
  seleccionar('#detail-dialog').close();
  seleccionar('#edit-dialog').close();
}
seleccionar('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await ejecutarConBotonOcupado(e.submitter, async () => {
    try {
      await llamarApi('/api/login', { method: 'POST', data: obtenerDatosFormulario(e.target) });
      e.target.reset();
      seleccionar('#login-error').textContent = '';
      await cargarSesion();
    } catch (err) {
      seleccionar('#login-error').textContent = err.message;
    }
  });
});
seleccionar('#logout').onclick = async () => {
  try {
    await llamarApi('/api/logout', { method: 'POST', data: {}, csrf });
    mostrarLogin();
  } catch (e) {
    mostrarAviso(e.message);
  }
};
async function actualizarPanel() {
  try {
    seleccionar('#admin-error').textContent = '';
    datosPanel = await llamarApi('/api/admin/data');
    mostrarPanel();
  } catch (e) {
    if (e.status === 401) mostrarLogin();
    else seleccionar('#admin-error').textContent = e.message;
  }
}
seleccionar('#refresh').onclick = () =>
  ejecutarConBotonOcupado(seleccionar('#refresh'), actualizarPanel);

// 2. Navegación entre las secciones del panel.
const titulos = {
  overview: 'Todo, en su sitio.',
  bookings: 'Estancias con nombre propio.',
  planning: 'Cada cama, cada día.',
  rooms: 'Espacio para todos.',
  restaurant: 'Alrededor de la mesa.',
  activity: 'El pulso del albergue.',
};
document.querySelectorAll('[data-tab]').forEach(
  (button) =>
    (button.onclick = () => {
      pestanaActual = button.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach((b) => {
        b.classList.toggle('active', b === button);
        b.setAttribute('aria-current', b === button ? 'page' : 'false');
      });
      document
        .querySelectorAll('.admin-section')
        .forEach((s) => (s.hidden = s.id !== 'tab-' + pestanaActual));
      seleccionar('#admin-title').textContent = titulos[pestanaActual];
    }),
);

// 3. Filtros de solicitudes.
function filtrarEstancias() {
  const q = seleccionar('#booking-search').value.toLocaleLowerCase('es'),
    state = seleccionar('#booking-status').value;
  seleccionar('#booking-list').innerHTML = crearTablaSolicitudes(
    datosPanel.bookings.filter(
      (b) =>
        (!state || b.status === state) &&
        `${b.first_name} ${b.last_name} ${b.reference}`.toLocaleLowerCase('es').includes(q),
    ),
  );
}
function filtrarRestaurante() {
  const q = seleccionar('#restaurant-filter').value.toLocaleLowerCase('es'),
    state = seleccionar('#restaurant-status').value;
  seleccionar('#restaurant-list').innerHTML = crearTablaSolicitudes(
    datosPanel.restaurant.filter(
      (b) =>
        (!state || b.status === state) &&
        `${b.first_name} ${b.last_name} ${b.reference}`.toLocaleLowerCase('es').includes(q),
    ),
    'restaurant',
  );
}
seleccionar('#booking-search').oninput = filtrarEstancias;
seleccionar('#booking-status').onchange = filtrarEstancias;
seleccionar('#restaurant-filter').oninput = filtrarRestaurante;
seleccionar('#restaurant-status').onchange = filtrarRestaurante;

// 4. Dibujar los datos recibidos del servidor.
function mostrarPanel() {
  seleccionar('#admin-date').textContent =
    `${formatearFecha(datosPanel.date)} · Datos de PostgreSQL · Ocupación por noche prevista para hoy`;
  const m = datosPanel.metrics;
  seleccionar('#metrics').innerHTML = [
    [m.pending, 'Solicitudes de alojamiento pendientes'],
    [m.occupied + '/' + m.beds, 'Camas aceptadas / camas activas hoy'],
    [m.arrivals + ' / ' + m.departures, 'Llegadas / salidas previstas hoy'],
    [m.diners, 'Comensales aceptados hoy'],
  ]
    .map(
      ([n, label]) => /* HTML */ `
        <div class="metric">
          <p>${label}</p>
          <strong>${n}</strong>
        </div>
      `,
    )
    .join('');
  seleccionar('#pending-list').innerHTML =
    crearTablaSolicitudes(datosPanel.bookings.filter((b) => b.status === 'PENDIENTE').slice(0, 8)) +
    /* HTML */ `
      <p class="fine">
        Restaurante: ${m.restaurant_pending} solicitudes pendientes. Revisa su sección para
        resolverlas.
      </p>
    `;
  filtrarEstancias();
  filtrarRestaurante();
  const selected = seleccionar('#plan-room').value;
  seleccionar('#plan-room').innerHTML =
    '<option value="">Todas</option>' +
    datosPanel.rooms
      .map(
        (r) => /* HTML */ `
          <option value="${r.id}">${escaparHtml(r.name)}</option>
        `,
      )
      .join('');
  seleccionar('#plan-room').value = selected;
  mostrarPlanning();
  seleccionar('#admin-rooms').innerHTML =
    datosPanel.rooms
      .map(
        (r) => /* HTML */ `
          <article class="admin-card">
            <h3>${escaparHtml(r.name)}</h3>
            <p>
              ${r.beds.filter((b) => b.active).length} camas activas ·
              ${r.active ? 'Activa' : 'Inactiva'}
            </p>
            <p class="fine">${escaparHtml(r.description)}</p>
            <div class="admin-actions">
              <button class="button outline small" data-edit-room="${r.id}">
                Editar habitación
              </button>
            </div>
          </article>
        `,
      )
      .join('') || mensajeVacio('Todavía no hay habitaciones.');
  seleccionar('#blocks-list').innerHTML = datosPanel.blocks.length
    ? /* HTML */ `
        <table>
          <thead>
            <tr>
              <th>Cama</th>
              <th>Periodo</th>
              <th>Motivo</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${datosPanel.blocks
              .map(
                (b) => /* HTML */ `
                  <tr>
                    <td>${escaparHtml(b.room)} · ${escaparHtml(b.label)}</td>
                    <td>
                      ${escaparHtml(formatearFecha(b.arrival))} →
                      ${escaparHtml(formatearFecha(b.departure))}
                    </td>
                    <td>${escaparHtml(b.reason)}</td>
                    <td>
                      <button class="button outline small" data-unblock="${b.id}">Retirar</button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      `
    : mensajeVacio('No hay bloqueos activos.');
  seleccionar('#slot-list').innerHTML = datosPanel.slots.length
    ? /* HTML */ `
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Plazas retenidas</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${datosPanel.slots
              .map(
                (s) => /* HTML */ `
                  <tr>
                    <td>${escaparHtml(formatearFecha(s.date))}</td>
                    <td>${escaparHtml(s.time)}</td>
                    <td>${s.used} / ${s.capacity}</td>
                    <td>${s.closed ? 'Cerrado' : 'Abierto'}</td>
                    <td>
                      <button class="button outline small" data-edit-slot="${s.id}">Editar</button>
                    </td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      `
    : mensajeVacio('No hay turnos. Crea únicamente horarios confirmados por el establecimiento.');
  seleccionar('#audit-list').innerHTML =
    datosPanel.events
      .map(
        (a) => /* HTML */ `
          <div class="audit-item">
            ${escaparHtml(a.action.replaceAll('_', ' ').toLowerCase())}
            <small>
              ${escaparHtml(new Date(a.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }))}
            </small>
            <p class="fine">${escaparHtml(a.entity_id)}</p>
          </div>
        `,
      )
      .join('') || mensajeVacio('Sin actividad registrada.');
}
function mostrarPlanning() {
  if (!datosPanel) return;
  const fechaInicio = seleccionar('#plan-date').value;
  if (!fechaInicio) return;
  const cantidadDias = Number(seleccionar('#plan-days').value);
  const habitacionElegida = seleccionar('#plan-room').value;
  seleccionar('#planning-table').innerHTML = crearPlanning(
    datosPanel,
    fechaInicio,
    cantidadDias,
    habitacionElegida,
  );
}
seleccionar('#plan-date').onchange = mostrarPlanning;
seleccionar('#plan-days').onchange = mostrarPlanning;
seleccionar('#plan-room').onchange = mostrarPlanning;

// 5. Ver el detalle de una solicitud.
function mostrarDetalle(id, domain) {
  const b = (domain === 'bookings' ? datosPanel.bookings : datosPanel.restaurant).find(
    (x) => x.id === id,
  );
  if (!b) return;
  seleccionar('#detail-title').textContent = b.reference;
  const items = [
    ['Huésped', b.first_name + ' ' + b.last_name],
    ['Estado', b.status],
    ['Email', b.email],
    ['Teléfono', b.phone],
    ['Personas', b.people],
    [
      'Fechas',
      domain === 'bookings'
        ? formatearFecha(b.arrival) + ' → ' + formatearFecha(b.departure)
        : formatearFecha(b.date) + ' · ' + b.time,
    ],
    ['Observaciones', b.notes || 'Sin observaciones'],
  ];
  if (domain === 'bookings') {
    items.push(
      ['Modalidad', b.mode === 'ROOM' ? 'Habitación completa' : 'Camas individuales'],
      [
        'Asignación actual',
        b.beds.map((x) => x.room + ' · ' + x.label).join(', ') || 'Inventario liberado',
      ],
      [
        'Entrada real',
        b.checked_in_at ? new Date(b.checked_in_at).toLocaleString('es-ES') : 'Sin registrar',
      ],
      [
        'Salida real',
        b.checked_out_at ? new Date(b.checked_out_at).toLocaleString('es-ES') : 'Sin registrar',
      ],
    );
  }
  seleccionar('#detail-body').innerHTML = /* HTML */ `
    <dl class="data-details">
      ${items
        .map(
          ([k, v]) => /* HTML */ `
            <div>
              <dt>${escaparHtml(k)}</dt>
              <dd>${escaparHtml(v)}</dd>
            </div>
          `,
        )
        .join('')}
    </dl>
    <p class="fine">Las decisiones quedan registradas. No se envía correo real en esta versión.</p>
    <div class="admin-actions">
      ${
        b.status === 'PENDIENTE'
          ? /* HTML */ `
              <button
                class="button"
                data-resolve="ACEPTADA"
                data-id="${id}"
                data-domain="${domain}"
              >
                Aceptar solicitud
              </button>
              <button
                class="button danger"
                data-resolve="RECHAZADA"
                data-id="${id}"
                data-domain="${domain}"
              >
                Rechazar solicitud
              </button>
            `
          : ''
      }${
        domain === 'bookings' && b.status !== 'RECHAZADA' && !b.checked_in_at
          ? /* HTML */ `
              <button class="button outline" data-edit-booking="${id}">Modificar estancia</button>
            `
          : ''
      }${
        domain === 'bookings' && b.status === 'ACEPTADA' && !b.checked_out_at
          ? /* HTML */ `
              <button
                class="button secondary"
                data-check="${b.checked_in_at ? 'out' : 'in'}"
                data-id="${id}"
              >
                ${b.checked_in_at ? 'Registrar salida' : 'Registrar entrada'}
              </button>
            `
          : ''
      }
    </div>
  `;
  if (!seleccionar('#detail-dialog').open) seleccionar('#detail-dialog').showModal();
}

// 6. Formularios de edición de habitaciones, turnos y estancias.

function abrirEdicion(title, fields, type, id) {
  edicionActual = { type, id };
  seleccionar('#edit-title').textContent = title;
  seleccionar('#edit-fields').innerHTML = fields;
  seleccionar('#edit-error').textContent = '';
  seleccionar('#edit-dialog').showModal();
}
function editarHabitacion(id) {
  const r = datosPanel.rooms.find((x) => x.id === id);
  abrirEdicion(r ? 'Editar habitación' : 'Nueva habitación', camposHabitacion(r), 'room', id);
}
function editarTurno(id) {
  const s = datosPanel.slots.find((x) => x.id === id);
  abrirEdicion(s ? 'Editar turno' : 'Nuevo turno', /* HTML */ camposTurno(s), 'slot', id);
}
function editarEstancia(id) {
  const b = datosPanel.bookings.find((x) => x.id === id);
  seleccionar('#detail-dialog').close();
  abrirEdicion('Modificar estancia', /* HTML */ camposEstancia(b, datosPanel), 'booking', id);
}
seleccionar('#new-room').onclick = () => editarHabitacion();
seleccionar('#new-slot').onclick = () => editarTurno();
seleccionar('#new-block').onclick = () =>
  abrirEdicion('Bloquear camas', camposBloqueo(datosPanel), 'block');

// 7. Guardar una edición, con confirmación previa.
seleccionar('#edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!confirm('¿Guardar estos cambios? Se comprobará el inventario y se registrará la acción.'))
    return;
  await ejecutarConBotonOcupado(e.submitter, async () => {
    const v = obtenerDatosFormulario(e.target);
    try {
      let path,
        method = 'POST';
      if (edicionActual.type === 'room') {
        path = '/api/admin/rooms';
        v.capacity = Number(v.capacity);
        v.active = v.active === 'true';
        if (edicionActual.id) v.id = edicionActual.id;
      }
      if (edicionActual.type === 'slot') {
        path = '/api/admin/slots';
        v.capacity = Number(v.capacity);
        v.closed = v.closed === 'true';
        if (edicionActual.id) v.id = edicionActual.id;
      }
      if (edicionActual.type === 'booking') {
        path = '/api/admin/bookings/' + edicionActual.id;
        method = 'PATCH';
        v.people = Number(v.people);
        v.roomId = Number(v.roomId);
        v.bedIds = new FormData(e.target).getAll('bedIds').map(Number);
      }
      if (edicionActual.type === 'block') {
        path = '/api/admin/blocks';
        v.bedIds = new FormData(e.target).getAll('bedIds').map(Number);
      }
      await llamarApi(path, { method, data: v, csrf });
      seleccionar('#edit-dialog').close();
      mostrarAviso('Cambios guardados.');
      await actualizarPanel();
    } catch (err) {
      seleccionar('#edit-error').textContent = err.message;
    }
  });
});

// 8. Aceptar, rechazar, registrar entradas/salidas o retirar bloqueos.
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b || !datosPanel) return;
  if (b.dataset.detail) mostrarDetalle(b.dataset.detail, b.dataset.domain);
  if (b.dataset.editRoom) editarHabitacion(Number(b.dataset.editRoom));
  if (b.dataset.editSlot) editarTurno(Number(b.dataset.editSlot));
  if (b.dataset.editBooking) editarEstancia(b.dataset.editBooking);
  let path,
    method = 'PATCH',
    payload = {},
    message;
  if (b.dataset.resolve) {
    path = `/api/admin/${b.dataset.domain}/${b.dataset.id}/status`;
    payload = { status: b.dataset.resolve };
    message =
      b.dataset.resolve === 'ACEPTADA'
        ? '¿Aceptar la solicitud? Las plazas seguirán ocupadas.'
        : '¿Rechazar la solicitud y liberar sus plazas?';
  }
  if (b.dataset.check) {
    path = `/api/admin/bookings/${b.dataset.id}/check`;
    payload = { action: b.dataset.check };
    message = '¿Registrar la ' + (b.dataset.check === 'in' ? 'entrada' : 'salida') + ' real ahora?';
  }
  if (b.dataset.unblock) {
    path = '/api/admin/blocks/' + b.dataset.unblock;
    method = 'DELETE';
    message = '¿Retirar este bloqueo y volver a ofrecer las camas?';
  }
  if (path && confirm(message))
    await ejecutarConBotonOcupado(b, async () => {
      try {
        await llamarApi(path, { method, data: payload, csrf });
        seleccionar('#detail-dialog').close();
        mostrarAviso('Operación guardada.');
        await actualizarPanel();
      } catch (err) {
        mostrarAviso(err.message);
      }
    });
});
cargarSesion();
