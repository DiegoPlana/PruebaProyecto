// Presentación del panel: recibe datos y devuelve HTML. No hace peticiones HTTP.
import { escaparHtml, formatearFecha, sumarDias } from '../shared.js';

export function crearTablaSolicitudes(solicitudes, dominio = 'bookings') {
  if (solicitudes.length === 0)
    return '<p class="fine">No hay solicitudes con estos criterios.</p>';
  let filas = '';
  for (const solicitud of solicitudes) {
    const fecha = formatearFecha(solicitud.arrival ?? solicitud.date);
    const detalleFecha =
      dominio === 'bookings' ? 'hasta ' + formatearFecha(solicitud.departure) : solicitud.time;
    filas += /* HTML */ `
      <tr>
        <td>
          ${escaparHtml(solicitud.first_name + ' ' + solicitud.last_name)}
          <small>${escaparHtml(solicitud.reference)}</small>
        </td>
        <td>
          ${escaparHtml(fecha)}
          <small>${escaparHtml(detalleFecha)}</small>
        </td>
        <td>${solicitud.people}</td>
        <td>
          <span class="badge ${escaparHtml(solicitud.status)}">
            ${escaparHtml(solicitud.status)}
          </span>
        </td>
        <td>
          <button
            class="button outline small"
            data-detail="${solicitud.id}"
            data-domain="${dominio}"
          >
            Abrir →
          </button>
        </td>
      </tr>
    `;
  }
  return /* HTML */ `
    <table>
      <thead>
        <tr>
          <th>Solicitud</th>
          <th>Visita</th>
          <th>Personas</th>
          <th>Estado</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}

function crearCeldaPlanning(datos, habitacion, cama, fecha) {
  // La salida no ocupa noche: arrival <= fecha < departure.
  const solicitud = datos.bookings.find(
    (solicitud) =>
      solicitud.status !== 'RECHAZADA' &&
      solicitud.arrival <= fecha &&
      solicitud.departure > fecha &&
      solicitud.beds.some((asignacion) => asignacion.id === cama.id),
  );
  const bloqueo = datos.blocks.find(
    (bloqueo) =>
      bloqueo.bed_id === cama.id && bloqueo.arrival <= fecha && bloqueo.departure > fecha,
  );

  if (solicitud) {
    const descripcion =
      habitacion.name + ' ' + cama.label + ' ' + formatearFecha(fecha) + ' ' + solicitud.status;
    const letra = solicitud.status === 'PENDIENTE' ? 'P' : 'A';
    return /* HTML */ `
      <td>
        <button
          class="plan-cell ${solicitud.status}"
          data-detail="${solicitud.id}"
          data-domain="bookings"
          aria-label="${escaparHtml(descripcion)}"
        >
          ${letra}
        </button>
      </td>
    `;
  }
  const estado = bloqueo ? 'BLOQUEO' : 'LIBRE';
  const descripcion = estado + (bloqueo ? ' · ' + bloqueo.reason : '');
  return /* HTML */ `
    <td>
      <span class="plan-cell ${estado}" title="${escaparHtml(descripcion)}">
        ${bloqueo ? 'B' : '·'}
      </span>
    </td>
  `;
}

export function crearPlanning(datos, fechaInicio, cantidadDias, habitacionElegida) {
  const fechas = [];
  let cabecera = '<th>Habitación / cama</th>';
  for (let indice = 0; indice < cantidadDias; indice++) {
    const fecha = sumarDias(fechaInicio, indice);
    fechas.push(fecha);
    cabecera += /* HTML */ `
      <th>${fecha.slice(8)}/${fecha.slice(5, 7)}</th>
    `;
  }
  let filas = '';
  for (const habitacion of datos.rooms) {
    if (habitacionElegida && String(habitacion.id) !== habitacionElegida) continue;
    for (const cama of habitacion.beds) {
      if (!cama.active) continue;
      let celdas = '';
      for (const fecha of fechas) celdas += crearCeldaPlanning(datos, habitacion, cama, fecha);
      filas += /* HTML */ `
        <tr>
          <th>
            ${escaparHtml(habitacion.name)}
            <br />
            ${escaparHtml(cama.label)}
          </th>
          ${celdas}
        </tr>
      `;
    }
  }
  return /* HTML */ `
    <table class="planning">
      <thead>
        <tr>${cabecera}</tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}
