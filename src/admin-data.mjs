// Consultas de lectura para el panel. Aquí no se modifican reservas.
import { pool } from './db.mjs';
import { today } from './validation.mjs';

export async function adminData() {
  // Cada solicitud incluye sus camas activas y, si existe, su entrada/salida real.
  const bookings = (
    await pool.query(`
    SELECT b.*, s.checked_in_at, s.checked_out_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', bed.id, 'label', bed.label, 'room', r.name))
        FROM allocations a
        JOIN beds bed ON bed.id = a.bed_id
        JOIN rooms r ON r.id = bed.room_id
        WHERE a.booking_id = b.id AND a.active
      ), '[]') AS beds
    FROM bookings b
    LEFT JOIN stays s ON s.booking_id = b.id
    ORDER BY b.created_at DESC
    LIMIT 500
  `)
  ).rows;

  // jsonb_agg agrupa las camas en una lista dentro de cada habitación.
  // COALESCE devuelve [] cuando no hay camas, en lugar de null.
  const rooms = (
    await pool.query(`
    SELECT r.*,
      COALESCE(
        jsonb_agg(jsonb_build_object('id', b.id, 'label', b.label, 'active', b.active) ORDER BY b.id)
          FILTER (WHERE b.id IS NOT NULL), '[]'
      ) AS beds
    FROM rooms r
    LEFT JOIN beds b ON b.room_id = r.id
    GROUP BY r.id
    ORDER BY r.id
  `)
  ).rows;

  const restaurant = (
    await pool.query(`
    SELECT r.*, s.date, to_char(s.time, 'HH24:MI') AS time
    FROM restaurant_requests r
    JOIN restaurant_slots s ON s.id = r.slot_id
    ORDER BY r.created_at DESC
    LIMIT 500
  `)
  ).rows;

  // Las solicitudes pendientes y aceptadas cuentan para el aforo retenido.
  const slots = (
    await pool.query(`
    SELECT s.*, to_char(s.time, 'HH24:MI') AS time,
      COALESCE(sum(r.people) FILTER (WHERE r.status <> 'RECHAZADA'), 0)::int AS used
    FROM restaurant_slots s
    LEFT JOIN restaurant_requests r ON r.slot_id = s.id
    GROUP BY s.id
    ORDER BY s.date DESC, s.time
    LIMIT 500
  `)
  ).rows;

  const blocks = (
    await pool.query(`
    SELECT a.id, a.bed_id, b.label, r.name AS room,
      lower(a.period) AS arrival, upper(a.period) AS departure, a.reason
    FROM allocations a
    JOIN beds b ON b.id = a.bed_id
    JOIN rooms r ON r.id = b.room_id
    WHERE a.booking_id IS NULL AND a.active
    ORDER BY lower(a.period)
  `)
  ).rows;

  const events = (
    await pool.query(`
    SELECT action, entity_id, details, created_at
    FROM audit
    ORDER BY id DESC
    LIMIT 40
  `)
  ).rows;

  // @> significa «el intervalo contiene esta fecha». $1 es la fecha de hoy.
  // Estas métricas de ocupación cuentan aceptadas; el calendario también retiene pendientes.
  const resultadoMetricas = await pool.query(
    `
    SELECT
      (SELECT count(*) FROM rooms WHERE active)::int AS rooms,
      (SELECT count(*) FROM beds b JOIN rooms r ON r.id = b.room_id
        WHERE b.active AND r.active)::int AS beds,
      (SELECT count(*) FROM allocations a JOIN bookings b ON b.id = a.booking_id
        WHERE a.active AND a.period @> $1::date AND b.status = 'ACEPTADA')::int AS occupied,
      (SELECT count(*) FROM bookings WHERE status = 'PENDIENTE')::int AS pending,
      (SELECT count(*) FROM bookings
        WHERE status = 'ACEPTADA' AND arrival = $1::date)::int AS arrivals,
      (SELECT count(*) FROM bookings
        WHERE status = 'ACEPTADA' AND departure = $1::date)::int AS departures,
      (SELECT count(*) FROM restaurant_requests
        WHERE status = 'PENDIENTE')::int AS restaurant_pending,
      (SELECT COALESCE(sum(r.people), 0)::int
        FROM restaurant_requests r JOIN restaurant_slots s ON s.id = r.slot_id
        WHERE s.date = $1::date AND r.status = 'ACEPTADA') AS diners
  `,
    [today()],
  );
  const metrics = resultadoMetricas.rows[0];

  // Se mantienen estos nombres porque forman parte del contrato de la API.
  return { bookings, rooms, restaurant, slots, blocks, events, metrics, date: today(), limit: 500 };
}
