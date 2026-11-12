import { seleccionar, escaparHtml, obtenerHoy, sumarDias, llamarApi } from '../shared.js';

function crearTarjetaHabitacion(habitacion, posicion) {
  return /* HTML */ `
    <article class="room-card">
      <header>
        <h3>${escaparHtml(habitacion.name)}</h3>
        <span class="pill">${habitacion.capacity} CAMAS · PROVISIONAL</span>
      </header>
      <div class="room-drawing" aria-hidden="true">
        <svg viewBox="0 0 120 110">
          <path
            d="M24 86V38a36 36 0 0 1 72 0v48M35 86V40a25 25 0 0 1 50 0v46M17 87h86M60 15v27M35 43h50M25 67h70M40 57h14v10H40zM66 57h14v10H66z"
          />
          <path d="M${18 + posicion * 4} 93h80" />
        </svg>
      </div>
      <p>${escaparHtml(habitacion.description)}</p>
      <a href="/reservas" class="text-link">
        Consulta fechas
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  `;
}

export async function cargarHabitaciones() {
  const contenedor = seleccionar('#room-cards');
  if (!contenedor) return;
  try {
    const llegada = obtenerHoy();
    const salida = sumarDias(llegada, 1);
    const resultado = await llamarApi(`/api/availability?arrival=${llegada}&departure=${salida}`);
    if (resultado.rooms.length === 0) {
      contenedor.innerHTML = '<p>El equipo todavía no ha configurado habitaciones.</p>';
      return;
    }
    let contenido = '';
    for (let posicion = 0; posicion < resultado.rooms.length; posicion++) {
      contenido += crearTarjetaHabitacion(resultado.rooms[posicion], posicion);
    }
    contenedor.innerHTML = contenido;
  } catch (error) {
    contenedor.innerHTML = /* HTML */ `
      <p class="error">No se puede cargar el inventario. ${escaparHtml(error.message)}</p>
    `;
  }
}
