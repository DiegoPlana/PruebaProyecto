// Punto de entrada de la web pública. Cada módulo prepara solo su parte.
import { cargarHabitaciones } from './js/habitaciones.js';
import { iniciarReservas } from './js/reservas.js';
import { iniciarRestaurante } from './js/restaurante.js';
import { iniciarFormularioSolicitud } from './js/solicitud.js';

iniciarFormularioSolicitud();
cargarHabitaciones();
iniciarReservas();
iniciarRestaurante();
