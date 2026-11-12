// Formulario de contacto común: alojamiento y restaurante comparten este diálogo.
import {
  seleccionar,
  escaparHtml,
  formatearFecha,
  llamarApi,
  ejecutarConBotonOcupado,
  obtenerDatosFormulario,
  prepararCierreDialogo,
} from '../shared.js';

let seleccionActual = null;
let claveIdempotencia = null;
let ultimosDatosEnviados = null;
let accionesDespues = {};

export function iniciarFormularioSolicitud() {
  const dialogo = seleccionar('#request-dialog');
  if (!dialogo) return;
  prepararCierreDialogo(dialogo);
  seleccionar('#request-form').addEventListener('submit', enviarSolicitud);
}

export function abrirSolicitud(seleccion, acciones = {}) {
  seleccionActual = seleccion;
  accionesDespues = acciones;
  claveIdempotencia = crypto.randomUUID();
  ultimosDatosEnviados = null;
  seleccionar('#request-form').hidden = false;
  seleccionar('#request-success').hidden = true;
  seleccionar('#request-error').textContent = '';
  seleccionar('#request-form').reset();

  const esAlojamiento = seleccion.domain === 'lodging';
  seleccionar('#request-title').textContent = esAlojamiento
    ? 'Tu estancia, paso a paso.'
    : 'Un sitio en la mesa.';
  let fechas = escaparHtml(formatearFecha(seleccion.arrival ?? seleccion.date));
  if (seleccion.departure) fechas += ' → ' + escaparHtml(formatearFecha(seleccion.departure));
  const personas = esAlojamiento ? 'persona(s)' : 'comensales';
  seleccionar('#request-summary').innerHTML = /* HTML */ `
    <strong>${escaparHtml(seleccion.label)}</strong>
    <br />
    ${fechas}
    <br />
    ${seleccion.people} ${personas} · Pendiente de aprobación
  `;
  seleccionar('#request-dialog').showModal();
}

function mostrarSolicitudRecibida(resultado) {
  seleccionar('#request-form').hidden = true;
  seleccionar('#request-success').hidden = false;
  seleccionar('#request-success').innerHTML = /* HTML */ `
    <div class="success">
      <p class="eyebrow">SOLICITUD RECIBIDA</p>
      <h3>Gracias. Ya tenemos tu solicitud.</h3>
      <strong>${escaparHtml(resultado.reference)}</strong>
      <p>${escaparHtml(resultado.message)}</p>
      <p class="fine">Guarda esta referencia. En este entorno no se envían correos.</p>
    </div>
  `;
}

async function enviarSolicitud(evento) {
  evento.preventDefault();
  await ejecutarConBotonOcupado(evento.submitter, async () => {
    seleccionar('#request-error').textContent = '';
    // domain, label y date son datos de presentación; no se envían al endpoint.
    const { domain, label, date, ...plazasSeleccionadas } = seleccionActual;
    const datos = { ...plazasSeleccionadas, ...obtenerDatosFormulario(evento.target) };
    const huella = JSON.stringify(datos);

    // Reintentar los mismos datos conserva la clave y evita duplicar la solicitud.
    // Si el usuario edita los datos tras un intento, empieza una petición distinta.
    if (ultimosDatosEnviados && ultimosDatosEnviados !== huella)
      claveIdempotencia = crypto.randomUUID();
    ultimosDatosEnviados = huella;
    const ruta = domain === 'lodging' ? '/api/bookings' : '/api/restaurant/requests';
    try {
      const resultado = await llamarApi(ruta, {
        method: 'POST',
        data: datos,
        key: claveIdempotencia,
      });
      mostrarSolicitudRecibida(resultado);
      if (accionesDespues.alCompletar) accionesDespues.alCompletar();
    } catch (error) {
      seleccionar('#request-error').textContent = error.message;
      if (error.status === 409 && accionesDespues.alConflicto) accionesDespues.alConflicto();
    }
  });
}
