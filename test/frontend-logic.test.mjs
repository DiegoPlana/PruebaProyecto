import test from 'node:test';
import assert from 'node:assert/strict';
import { obtenerEstadoDisponibilidad } from '../public/js/calendario.js';
import { crearPlanning, crearTablaSolicitudes } from '../public/js/admin-tablas.js';
import { camposHabitacion, camposTurno, camposEstancia } from '../public/js/admin-formularios.js';

test('calendario: el dorado indica disponibilidad parcial, sin umbral de porcentaje', () => {
  assert.equal(obtenerEstadoDisponibilidad(24, 24), 'free');
  assert.equal(obtenerEstadoDisponibilidad(23, 24), 'limited');
  assert.equal(obtenerEstadoDisponibilidad(1, 24), 'limited');
  assert.equal(obtenerEstadoDisponibilidad(0, 24), 'full');
  assert.equal(obtenerEstadoDisponibilidad(0, 0), 'full');
});

const estancia = {
  id: 'solicitud-prueba',
  reference: 'SQ-PRUEBA',
  status: 'PENDIENTE',
  mode: 'BEDS',
  arrival: '2030-06-10',
  departure: '2030-06-12',
  people: 1,
  first_name: '<script>alert(1)</script>',
  last_name: 'Prueba',
  notes: '<img src=x>',
  email: 'prueba@example.test',
  phone: '600000000',
  beds: [{ id: 1 }],
};
const datos = {
  rooms: [
    {
      id: 1,
      name: 'Abeto',
      active: true,
      beds: [
        { id: 1, label: 'Cama 1', active: true },
        { id: 2, label: 'Inactiva', active: false },
      ],
    },
  ],
  bookings: [estancia],
  blocks: [],
};

test('planning: llegada incluida, salida libre y camas inactivas ocultas', () => {
  const html = crearPlanning(datos, '2030-06-10', 3, '');
  assert.equal((html.match(/plan-cell PENDIENTE/g) || []).length, 2);
  assert.equal((html.match(/plan-cell LIBRE/g) || []).length, 1);
  assert.equal(html.includes('Inactiva'), false);
  assert.equal(crearPlanning(datos, '2030-06-10', 3, '2').includes('Cama 1'), false);
});

test('planning: rechazo libera y el bloqueo administrativo ocupa su intervalo', () => {
  const bloqueados = {
    ...datos,
    bookings: [{ ...estancia, status: 'RECHAZADA' }],
    blocks: [{ bed_id: 1, arrival: '2030-06-10', departure: '2030-06-11', reason: '<prueba>' }],
  };
  const html = crearPlanning(bloqueados, '2030-06-10', 2, '');
  assert.equal((html.match(/plan-cell BLOQUEO/g) || []).length, 1);
  assert.equal((html.match(/plan-cell LIBRE/g) || []).length, 1);
  assert.match(html, /&lt;prueba&gt;/);
  assert.equal(html.includes('data-detail='), false);
});

test('tabla y formularios muestran texto de usuario escapado y conservan los campos de la API', () => {
  const tabla = crearTablaSolicitudes([estancia]);
  assert.match(tabla, /&lt;script&gt;/);
  assert.equal(tabla.includes('<script>'), false);
  const campos = camposEstancia(estancia, datos);
  assert.match(campos, /&lt;img src=x&gt;/);
  for (const nombre of [
    'firstName',
    'lastName',
    'email',
    'phone',
    'arrival',
    'departure',
    'people',
    'mode',
    'roomId',
    'bedIds',
    'notes',
  ]) {
    assert.match(campos, new RegExp(`name="${nombre}"`));
  }
  assert.match(camposHabitacion(), /name="capacity"/);
  assert.match(camposTurno(), /name="time"/);
});
