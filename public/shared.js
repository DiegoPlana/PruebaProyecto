// Utilidades compartidas por la web pública y el panel.
// El navegador consulta la API; nunca accede directamente a PostgreSQL.
export function seleccionar(selector) {
  return document.querySelector(selector);
}

// Los datos introducidos por usuarios se muestran como texto, no como HTML.
export function escaparHtml(valor) {
  const caracteres = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => caracteres[caracter]);
}

export function obtenerHoy() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function sumarDias(fecha, cantidad) {
  const resultado = new Date(fecha + 'T12:00:00Z');
  resultado.setUTCDate(resultado.getUTCDate() + cantidad);
  return resultado.toISOString().slice(0, 10);
}

export function formatearFecha(fecha) {
  if (!fecha) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(fecha.slice(0, 10) + 'T12:00:00Z'));
}

// Centralizamos fetch para no repetir el envío de JSON y el manejo de errores.
export async function llamarApi(ruta, opciones = {}) {
  const { method = 'GET', data, csrf, key } = opciones;
  const cabeceras = {};
  if (data !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (csrf) cabeceras['X-CSRF-Token'] = csrf;
  if (key) cabeceras['Idempotency-Key'] = key;
  const respuesta = await fetch(ruta, {
    method,
    headers: cabeceras,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let resultado;
  try {
    resultado = await respuesta.json();
  } catch {
    throw new Error('El servidor no ha respondido correctamente. Inténtalo de nuevo.');
  }
  if (!respuesta.ok) {
    const error = new Error(resultado.error || 'No se ha podido completar la operación.');
    error.status = respuesta.status;
    throw error;
  }
  return resultado;
}

let temporizadorAviso;
export function mostrarAviso(mensaje) {
  const aviso = seleccionar('#toast');
  aviso.textContent = mensaje;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => {
    aviso.hidden = true;
  }, 6500);
}

// Desactivamos el botón durante la petición; finally lo recupera incluso si falla.
export async function ejecutarConBotonOcupado(boton, tarea) {
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Un momento…';
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

export function obtenerDatosFormulario(formulario) {
  return Object.fromEntries(new FormData(formulario));
}

export function prepararCierreDialogo(dialogo) {
  const cerrar = dialogo.querySelector('[data-close]');
  if (cerrar) cerrar.addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('click', (evento) => {
    if (evento.target !== dialogo) return;
    const limites = dialogo.getBoundingClientRect();
    const fuera =
      evento.clientX < limites.left ||
      evento.clientX > limites.right ||
      evento.clientY < limites.top ||
      evento.clientY > limites.bottom;
    if (fuera) dialogo.close();
  });
}
