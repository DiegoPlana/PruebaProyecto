import {
  seleccionar,
  escaparHtml,
  obtenerHoy,
  sumarDias,
  formatearFecha,
  llamarApi,
} from '../shared.js';

let mesActual = obtenerHoy().slice(0, 7);
let esperandoSalida = false;
let numeroConsulta = 0;

// No hay un porcentaje mínimo: con 24 camas el dorado significa de 1 a 23 libres.
export function obtenerEstadoDisponibilidad(camasLibres, camasTotales) {
  if (camasLibres === 0) return 'full';
  if (camasLibres === camasTotales) return 'free';
  return 'limited';
}

export function iniciarCalendario(alCambiarFechas) {
  const calendario = seleccionar('#calendar');
  if (!calendario) return;
  seleccionar('#prev-month').addEventListener('click', () => cambiarMes(-1));
  seleccionar('#next-month').addEventListener('click', () => cambiarMes(1));
  calendario.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-date]');
    if (!boton) return;
    elegirFecha(boton.dataset.date);
    alCambiarFechas();
    actualizarCalendario();
  });
  actualizarCalendario();
}

function cambiarMes(cantidad) {
  const fecha = new Date(mesActual + '-01T12:00:00Z');
  fecha.setUTCMonth(fecha.getUTCMonth() + cantidad);
  mesActual = fecha.toISOString().slice(0, 7);
  actualizarCalendario();
}

function elegirFecha(fecha) {
  const llegada = seleccionar('#arrival');
  const salida = seleccionar('#departure');
  const instrucciones = seleccionar('#calendar-instruction');
  if (!esperandoSalida || fecha <= llegada.value) {
    llegada.value = fecha;
    salida.value = sumarDias(fecha, 1);
    esperandoSalida = true;
    instrucciones.textContent = 'Ahora selecciona el día de salida (no ocupa noche).';
  } else {
    salida.value = fecha;
    esperandoSalida = false;
    instrucciones.textContent = 'Fechas seleccionadas. Consulta la disponibilidad para continuar.';
  }
  salida.min = sumarDias(llegada.value, 1);
}

function crearBotonDia(dia) {
  const esPasado = dia.date < obtenerHoy();
  const llegada = seleccionar('#arrival').value;
  const salida = seleccionar('#departure').value;
  const esExtremo = dia.date === llegada || dia.date === salida;
  const estaEntreFechas = dia.date > llegada && dia.date < salida;
  const estado = obtenerEstadoDisponibilidad(dia.free, dia.total);
  const descripcion = `${formatearFecha(dia.date)}, ${dia.free} camas libres de ${dia.total}`;
  return /* HTML */ `
    <button
      type="button"
      class="day ${esPasado ? 'past' : ''} ${esExtremo ? 'selected' : ''} ${estaEntreFechas ? 'between' : ''}"
      data-date="${dia.date}"
      ${esPasado ? 'disabled' : ''}
      aria-pressed="${esExtremo}"
      aria-label="${escaparHtml(descripcion)}"
    >
      <span>${Number(dia.date.slice(-2))}</span>
      <i class="dot ${estado}" aria-hidden="true"></i>
    </button>
  `;
}

export async function actualizarCalendario() {
  const calendario = seleccionar('#calendar');
  if (!calendario) return;
  // Si cambiamos de mes rápidamente, una respuesta antigua no debe tapar la nueva.
  const consultaActual = ++numeroConsulta;
  seleccionar('#month-title').textContent = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(mesActual + '-01T12:00:00Z'));
  calendario.setAttribute('aria-busy', 'true');
  try {
    const resultado = await llamarApi('/api/calendar?month=' + mesActual);
    if (consultaActual !== numeroConsulta) return;
    const primerDia = new Date(mesActual + '-01T12:00:00Z').getUTCDay();
    const huecosIniciales = (primerDia + 6) % 7; // Lunes = primera columna.
    let contenido = '<span></span>'.repeat(huecosIniciales);
    for (const dia of resultado.days) contenido += crearBotonDia(dia);
    calendario.innerHTML = contenido;
  } catch (error) {
    if (consultaActual === numeroConsulta)
      calendario.innerHTML = /* HTML */ `
        <p class="error">${escaparHtml(error.message)}</p>
      `;
  } finally {
    if (consultaActual === numeroConsulta) calendario.removeAttribute('aria-busy');
  }
}
