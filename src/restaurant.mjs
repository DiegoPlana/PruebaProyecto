// Restaurante: solicitudes y aforo por turno, separados de las camas del albergue.
import { randomUUID } from 'node:crypto';
import { pool, tx, audit } from './db.mjs';
import { idempotent } from './booking.mjs';
import { date, contact, integer, uuid, fail, today } from './validation.mjs';
const used = async (db, id) =>
  (
    await db.query(
      "SELECT COALESCE(sum(people),0)::int AS used FROM restaurant_requests WHERE slot_id=$1 AND status<>'RECHAZADA'",
      [id],
    )
  ).rows[0].used;
export async function restaurantAvailability(day) {
  date(day);
  return (
    await pool.query(
      `SELECT s.id,s.date,to_char(s.time,'HH24:MI') AS time,s.capacity,s.closed,
 s.capacity-COALESCE(sum(r.people) FILTER(WHERE r.status<>'RECHAZADA'),0)::int AS free
 FROM restaurant_slots s LEFT JOIN restaurant_requests r ON r.slot_id=s.id WHERE s.date=$1 GROUP BY s.id ORDER BY s.time`,
      [day],
    )
  ).rows;
}
export async function createRestaurant(body, key) {
  const c = contact(body);
  integer(body.slotId, 'Turno');
  integer(body.people, 'Comensales');
  return tx(async (db) =>
    idempotent(db, key, { ...body, domain: 'restaurant' }, async () => {
      const {
        rows: [slot],
      } = await db.query('SELECT * FROM restaurant_slots WHERE id=$1 FOR UPDATE', [body.slotId]);
      if (!slot || slot.closed || slot.date < today()) fail(409, 'Este turno no está disponible.');
      if ((await used(db, slot.id)) + body.people > slot.capacity)
        fail(409, 'No quedan suficientes plazas en este turno.');
      const reference = 'RS-' + randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
      const {
        rows: [r],
      } = await db.query(
        `INSERT INTO restaurant_requests(reference,slot_id,people,first_name,last_name,email,phone,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [reference, slot.id, body.people, c.firstName, c.lastName, c.email, c.phone, c.notes],
      );
      await audit(db, null, 'RESTAURANTE_SOLICITADO', r.id);
      return {
        reference,
        status: 'PENDIENTE',
        message:
          'Solicitud recibida. Administración debe aceptarla. Todavía no es una reserva confirmada.',
      };
    }),
  );
}
export async function resolveRestaurant(id, status, actor) {
  uuid(id);
  if (!['ACEPTADA', 'RECHAZADA'].includes(status)) fail(400, 'Estado no válido.');
  return tx(async (db) => {
    const {
      rows: [r],
    } = await db.query('SELECT * FROM restaurant_requests WHERE id=$1 FOR UPDATE', [id]);
    if (!r) fail(404, 'Solicitud no encontrada.');
    await db.query('SELECT id FROM restaurant_slots WHERE id=$1 FOR UPDATE', [r.slot_id]);
    if (r.status === status) return { status };
    if (r.status !== 'PENDIENTE') fail(409, 'Esta solicitud ya se ha resuelto.');
    await db.query('UPDATE restaurant_requests SET status=$1 WHERE id=$2', [status, id]);
    await audit(db, actor, 'RESTAURANTE_' + status, id);
    return { status };
  });
}
export async function saveSlot(body, actor) {
  date(body.date);
  integer(body.capacity, 'Aforo');
  if (
    body.date < today() ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time) ||
    typeof body.closed !== 'boolean'
  )
    fail(400, 'Fecha, hora o estado del turno no válido.');
  return tx(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(741003)');
    if (body.id) {
      integer(body.id, 'Turno');
      const {
        rows: [s],
      } = await db.query('SELECT * FROM restaurant_slots WHERE id=$1 FOR UPDATE', [body.id]);
      if (!s) fail(404, 'Turno no encontrado.');
      const occupied = await used(db, s.id);
      if (
        body.capacity < occupied ||
        (occupied > 0 && (body.closed || s.date !== body.date || s.time.slice(0, 5) !== body.time))
      )
        fail(
          409,
          'Hay solicitudes vigentes. No puedes cerrar, mover el turno o reducir su capacidad por debajo de la ocupación.',
        );
      await db.query(
        'UPDATE restaurant_slots SET date=$2,time=$3,capacity=$4,closed=$5 WHERE id=$1',
        [body.id, body.date, body.time, body.capacity, body.closed],
      );
      await audit(db, actor, 'TURNO_MODIFICADO', body.id);
      return { id: body.id };
    }
    const {
      rows: [r],
    } = await db.query(
      'INSERT INTO restaurant_slots(date,time,capacity,closed) VALUES($1,$2,$3,$4) RETURNING id',
      [body.date, body.time, body.capacity, body.closed],
    );
    await audit(db, actor, 'TURNO_CREADO', r.id);
    return r;
  });
}
