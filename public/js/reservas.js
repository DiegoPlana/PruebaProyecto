// Alojamiento: buscar plazas, elegir camas o habitación y abrir el formulario.
import {
  seleccionar,
  escaparHtml,
  obtenerHoy,
  sumarDias,
  formatearFecha,
  llamarApi,
  ejecutarConBotonOcupado,
  obtenerDatosFormulario,
} from '../shared.js';
import { iniciarCalendario, actualizarCalendario } from './calendario.js';
import { abrirSolicitud } from './solicitud.js';

let busquedaActual = null;

export function iniciarReservas() {
  const formulario = seleccionar('#search-form');
  if (!formulario) return;
  const llegada = seleccionar('#arrival');
  const salida = seleccionar('#departure');
  llegada.min = obtenerHoy();
  llegada.value = obtenerHoy();
  salida.min = sumarDias(obtenerHoy(), 1);
  salida.value = salida.min;

  iniciarCalendario(invalidarBusqueda);
  formulario.addEventListener('change', () => {
    if (salida.value <= llegada.value) salida.value = sumarDias(llegada.value, 1);
    salida.min = sumarDias(llegada.value, 1);
    invalidarBusqueda();
    actualizarCalendario();
  });
  formulario.addEventListener('submit', buscarDisponibilidad);
  const resultados = seleccionar('#availability-results');
  resultados.addEventListener('change', actualizarContadorCamas);
  resultados.addEventListener('click', continuarSolicitud);
}

function invalidarBusqueda() {
  busquedaActual = null;
  seleccionar('#availability-results').innerHTML =
    '<p class="fine">Has cambiado tu búsqueda. Consulta de nuevo la disponibilidad.</p>';
}

async function buscarDisponibilidad(evento) {
  evento.preventDefault();
  await ejecutarConBotonOcupado(evento.submitter, async () => {
    const datos = obtenerDatosFormulario(evento.target);
    datos.people = Number(datos.people);
    const resultados = seleccionar('#availability-results');
    resultados.innerHTML = '<p class="fine">Consultando plazas…</p>';
    try {
      const respuesta = await llamarApi(
        `/api/availability?arrival=${datos.arrival}&departure=${datos.departure}`,
      );
      busquedaActual = { ...datos, rooms: respuesta.rooms };
      mostrarDisponibilidad();
    } catch (error) {
      resultados.innerHTML = /* HTML */ `
        <p class="error">${escaparHtml(error.message)}</p>
      `;
    }
  });
}

function crearOpcionesCamas(habitacion) {
  let contenido = '<div class="beds">';
  for (const cama of habitacion.beds) {
    const descripcion = habitacion.name + ' · ' + cama.label + (cama.available ? '' : ' · ocupada');
    contenido += /* HTML */ `
      <label class="bed-option">
        <input
          type="checkbox"
          value="${cama.id}"
          ${cama.available ? '' : 'disabled'}
          aria-label="${escaparHtml(descripcion)}"
        />
        <span>${escaparHtml(cama.label)}</span>
      </label>
    `;
  }
  return contenido + '</div>';
}

function crearOpcionHabitacionCompleta(habitacion) {
  const puedeSolicitarse =
    habitacion.wholeAvailable && busquedaActual.people <= habitacion.capacity;
  let texto = 'No disponible para tu búsqueda';
  if (puedeSolicitarse) texto = 'Solicitar habitación completa';
  return /* HTML */ `
    <button
      class="button outline small"
      data-room="${habitacion.id}"
      ${puedeSolicitarse ? '' : 'disabled'}
    >
      ${texto}
    </button>
  `;
}

function mostrarDisponibilidad() {
  const busqueda = busquedaActual;
  let contenido = /* HTML */ `
    <p class="fine">
      ${escaparHtml(formatearFecha(busqueda.arrival))} →
      ${escaparHtml(formatearFecha(busqueda.departure))} · ${busqueda.people} persona(s)
    </p>
  `;

  for (const habitacion of busqueda.rooms) {
    const opciones =
      busqueda.mode === 'ROOM'
        ? crearOpcionHabitacionCompleta(habitacion)
        : crearOpcionesCamas(habitacion);
    contenido += /* HTML */ `
      <div class="result-room">
        <h4>
          <span>${escaparHtml(habitacion.name)}</span>
          <small>${habitacion.free} de ${habitacion.capacity} camas libres</small>
        </h4>
        ${opciones}
      </div>
    `;
  }

  if (busqueda.rooms.length === 0) contenido += '<p>No hay habitaciones activas.</p>';
  if (busqueda.mode === 'BEDS' && busqueda.rooms.length > 0) {
    contenido += /* HTML */ `
      <p class="selection-count" id="selection-count">
        0 de ${busqueda.people} camas seleccionadas
      </p>
      <button id="continue-beds" class="button full-width" disabled>
        Continuar con mis camas →
      </button>
    `;
  }
  seleccionar('#availability-results').innerHTML = contenido;
}

function obtenerCamasMarcadas() {
  const marcadas = seleccionar('#availability-results').querySelectorAll('input:checked');
  return Array.from(marcadas, (casilla) => Number(casilla.value));
}

function actualizarContadorCamas() {
  if (!busquedaActual) return;
  const cantidad = obtenerCamasMarcadas().length;
  seleccionar('#selection-count').textContent =
    `${cantidad} de ${busquedaActual.people} camas seleccionadas`;
  seleccionar('#continue-beds').disabled = cantidad !== busquedaActual.people;
}

function continuarSolicitud(evento) {
  const botonHabitacion = evento.target.closest('[data-room]');
  const botonCamas = evento.target.closest('#continue-beds');
  if (!busquedaActual || (!botonHabitacion && !botonCamas)) return;

  // Estas claves coinciden con el contrato de la API; no cambiamos sus nombres.
  const seleccion = {
    domain: 'lodging',
    arrival: busquedaActual.arrival,
    departure: busquedaActual.departure,
    people: busquedaActual.people,
    mode: busquedaActual.mode,
  };

  if (botonHabitacion) {
    seleccion.roomId = Number(botonHabitacion.dataset.room);
    const habitacion = busquedaActual.rooms.find(
      (habitacion) => habitacion.id === seleccion.roomId,
    );
    seleccion.label = habitacion.name + ' · Habitación completa';
  } else {
    seleccion.bedIds = obtenerCamasMarcadas();
    const nombres = [];
    for (const habitacion of busquedaActual.rooms) {
      for (const cama of habitacion.beds) {
        if (seleccion.bedIds.includes(cama.id)) nombres.push(habitacion.name + ' · ' + cama.label);
      }
    }
    seleccion.label = nombres.join(', ');
  }

  abrirSolicitud(seleccion, {
    alCompletar: () => {
      invalidarBusqueda();
      actualizarCalendario();
    },
    alConflicto: actualizarCalendario,
  });
}
