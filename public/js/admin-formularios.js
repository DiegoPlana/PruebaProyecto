// Crea los campos de edición. Guardarlos corresponde a admin.js y al servidor.
import { escaparHtml, obtenerHoy, sumarDias } from '../shared.js';

function crearCampo(etiqueta, nombre, valor = '', tipo = 'text', atributos = '') {
  return /* HTML */ `
    <label>
      ${etiqueta}
      <input name="${nombre}" type="${tipo}" value="${escaparHtml(valor)}" ${atributos} required />
    </label>
  `;
}

function crearOpcionesHabitaciones(habitaciones, camasElegidas) {
  let opciones = '';
  for (const habitacion of habitaciones) {
    if (!habitacion.active) continue;
    const seleccionada = habitacion.beds.some((cama) => camasElegidas.includes(cama.id));
    opciones += /* HTML */ `
      <option value="${habitacion.id}" ${seleccionada ? 'selected' : ''}>
        ${escaparHtml(habitacion.name)}
      </option>
    `;
  }
  return opciones;
}

function crearCasillasCamas(habitaciones, camasElegidas = []) {
  let casillas = '';
  for (const habitacion of habitaciones) {
    if (!habitacion.active) continue;
    for (const cama of habitacion.beds) {
      if (!cama.active) continue;
      const marcada = camasElegidas.includes(cama.id);
      casillas += /* HTML */ `
        <label class="bed-option">
          <input type="checkbox" name="bedIds" value="${cama.id}" ${marcada ? 'checked' : ''} />
          <span>${escaparHtml(habitacion.name + ' · ' + cama.label)}</span>
        </label>
      `;
    }
  }
  return casillas;
}

export function camposHabitacion(habitacion) {
  const capacidad = habitacion ? habitacion.beds.filter((cama) => cama.active).length : 8;
  return /* HTML */ `
    ${crearCampo('Nombre', 'name', habitacion?.name ?? '', 'text', 'maxlength="80"')}
    <label>
      Descripción
      <textarea name="description" maxlength="1000">
${escaparHtml(habitacion?.description ?? '')}</textarea>
    </label>
    ${crearCampo('Camas activas', 'capacity', capacidad, 'number', 'min="1" max="100"')}
    <label>
      Estado
      <select name="active">
        <option value="true">Activa</option>
        <option value="false" ${habitacion && !habitacion.active ? 'selected' : ''}>
          Inactiva
        </option>
      </select>
    </label>
    <p class="fine">
      Reducir capacidad desactiva camas; no borra su historial. No se permite si afecta a reservas o
      bloqueos vigentes.
    </p>
  `;
}

export function camposTurno(turno) {
  return /* HTML */ `
    <div class="form-grid">
      ${crearCampo('Fecha', 'date', turno?.date ?? obtenerHoy(), 'date')}
      ${crearCampo('Hora local · Madrid', 'time', turno?.time ?? '', 'time')}
    </div>
    ${crearCampo('Capacidad', 'capacity', turno?.capacity ?? '', 'number', 'min="1" max="500"')}
    <label>
      Estado
      <select name="closed">
        <option value="false">Abierto</option>
        <option value="true" ${turno?.closed ? 'selected' : ''}>Cerrado</option>
      </select>
    </label>
    <p class="fine">
      No se puede mover o cerrar un turno con solicitudes vigentes ni reducir capacidad por debajo
      de sus plazas retenidas.
    </p>
  `;
}

export function camposEstancia(estancia, datosPanel) {
  const camasElegidas = estancia.beds.map((cama) => cama.id);
  const opcionesHabitaciones = crearOpcionesHabitaciones(datosPanel.rooms, camasElegidas);
  const casillasCamas = crearCasillasCamas(datosPanel.rooms, camasElegidas);
  return /* HTML */ `
    <div class="form-grid">
      ${crearCampo('Nombre', 'firstName', estancia.first_name)}
      ${crearCampo('Apellidos', 'lastName', estancia.last_name)}
      ${crearCampo('Email', 'email', estancia.email, 'email')}
      ${crearCampo('Teléfono', 'phone', estancia.phone, 'tel')}
      ${crearCampo('Llegada', 'arrival', estancia.arrival, 'date')}
      ${crearCampo('Salida', 'departure', estancia.departure, 'date')}
    </div>
    ${crearCampo('Personas', 'people', estancia.people, 'number', 'min="1" max="500"')}
    <label>
      Modalidad
      <select name="mode">
        <option value="BEDS" ${estancia.mode === 'BEDS' ? 'selected' : ''}>
          Camas individuales
        </option>
        <option value="ROOM" ${estancia.mode === 'ROOM' ? 'selected' : ''}>
          Habitación completa
        </option>
      </select>
    </label>
    <label>
      Habitación (solo modalidad completa)
      <select name="roomId">
        ${opcionesHabitaciones}
      </select>
    </label>
    <fieldset>
      <legend>Camas (solo modalidad individual)</legend>
      <div class="beds">${casillasCamas}</div>
    </fieldset>
    <label>
      Observaciones
      <textarea name="notes" maxlength="1000">${escaparHtml(estancia.notes)}</textarea>
    </label>
    <p class="fine">
      El servidor revalida el inventario. Si existe conflicto, la estancia original se conserva
      íntegra.
    </p>
  `;
}

export function camposBloqueo(datosPanel) {
  return /* HTML */ `
    <div class="form-grid">
      ${crearCampo('Desde', 'arrival', obtenerHoy(), 'date')}
      ${crearCampo('Hasta (no incluido)', 'departure', sumarDias(obtenerHoy(), 1), 'date')}
    </div>
    ${crearCampo('Motivo', 'reason', '', 'text', 'maxlength="200"')}
    <fieldset>
      <legend>Camas</legend>
      <div class="beds">${crearCasillasCamas(datosPanel.rooms)}</div>
    </fieldset>
  `;
}
