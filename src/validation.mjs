export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function text(value, name, max = 120, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    fail(400, `${name}: valor no válido.`);
  return value.trim();
}
export function integer(value, name, min = 1, max = 500) {
  if (!Number.isInteger(value) || value < min || value > max)
    fail(400, `${name}: valor no válido.`);
  return value;
}
export function date(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    fail(400, 'Fecha no válida.');
  return value;
}
export function dates(arrival, departure, allowPast = false) {
  date(arrival);
  date(departure);
  if (
    (!allowPast && arrival < today()) ||
    departure <= arrival ||
    (Date.parse(departure) - Date.parse(arrival)) / 86400000 > 366
  )
    fail(400, 'Selecciona una estancia futura de entre 1 y 366 noches.');
  return [arrival, departure];
}
// Validación en el servidor: un usuario puede saltarse las reglas del formulario HTML.
export function contact(body) {
  const firstName = text(body.firstName, 'Nombre'),
    lastName = text(body.lastName, 'Apellidos');
  const email = text(body.email, 'Email', 254).toLowerCase(),
    phone = text(body.phone, 'Teléfono', 30);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Introduce un email válido.');
  if (!/^\+?[\d\s().-]{7,30}$/.test(phone)) fail(400, 'Introduce un teléfono válido.');
  return {
    firstName,
    lastName,
    email,
    phone,
    notes: text(body.notes ?? '', 'Observaciones', 1000, false),
  };
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value))
    fail(400, 'Identificador no válido.');
  return value;
}
