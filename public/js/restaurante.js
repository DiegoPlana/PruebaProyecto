// El restaurante tiene su propia búsqueda y no utiliza las camas del alojamiento.
import {
  seleccionar,
  escaparHtml,
  obtenerHoy,
  llamarApi,
  ejecutarConBotonOcupado,
  obtenerDatosFormulario,
} from '../shared.js';
import { abrirSolicitud } from './solicitud.js';

let busquedaActual = null;

export function iniciarRestaurante() {
  const formulario = seleccionar('#restaurant-search');
  if (!formulario) return;
  const fecha = formulario.querySelector('[name=date]');
  fecha.min = obtenerHoy();
  fecha.value = obtenerHoy();
  formulario.addEventListener('change', () => {
    busquedaActual = null;
    seleccionar('#restaurant-results').innerHTML =
      '<p class="fine">Consulta de nuevo los turnos para estas condiciones.</p>';
  });
  formulario.addEventListener('submit', buscarTurnos);
  seleccionar('#restaurant-results').addEventListener('click', seleccionarTurno);
}

function mostrarTurnos(turnos, personas) {
  if (turnos.length === 0) {
    return '<p class="fine">No hay turnos publicados para esta fecha. El equipo debe configurar los horarios antes de recibir solicitudes.</p>';
  }
  let contenido = '';
  for (const turno of turnos) {
    const noDisponible = turno.closed || turno.free < personas;
    const estado = turno.closed ? 'Turno cerrado' : turno.free + ' plazas libres';
    contenido += /* HTML */ `
      <div class="slot-result">
        <span>
          <strong>${escaparHtml(turno.time)}</strong>
          <br />
          ${estado}
        </span>
        <button
          class="button outline small"
          data-slot="${turno.id}"
          ${noDisponible ? 'disabled' : ''}
        >
          Solicitar
        </button>
      </div>
    `;
  }
  return contenido;
}

async function buscarTurnos(evento) {
  evento.preventDefault();
  await ejecutarConBotonOcupado(evento.submitter, async () => {
    const datos = obtenerDatosFormulario(evento.target);
    datos.people = Number(datos.people);
    try {
      const respuesta = await llamarApi('/api/restaurant/availability?date=' + datos.date);
      busquedaActual = { ...datos, slots: respuesta.slots };
      seleccionar('#restaurant-results').innerHTML = mostrarTurnos(respuesta.slots, datos.people);
    } catch (error) {
      seleccionar('#restaurant-results').innerHTML = /* HTML */ `
        <p class="error">${escaparHtml(error.message)}</p>
      `;
    }
  });
}

function seleccionarTurno(evento) {
  const boton = evento.target.closest('[data-slot]');
  if (!boton || !busquedaActual) return;
  const id = Number(boton.dataset.slot);
  const turno = busquedaActual.slots.find((turno) => turno.id === id);
  const seleccion = {
    domain: 'restaurant',
    slotId: id,
    people: busquedaActual.people,
    date: busquedaActual.date,
    label: 'Restaurante · ' + turno.time,
  };
  abrirSolicitud(seleccion, {
    alCompletar: () => {
      seleccionar('#restaurant-results').innerHTML = '';
      busquedaActual = null;
    },
  });
}
