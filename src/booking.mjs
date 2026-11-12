import { randomUUID } from 'node:crypto';
import { pool, tx, audit } from './db.mjs';
import { hash } from './auth.mjs';
import { dates, date, contact, integer, uuid, fail, today, text } from './validation.mjs';
// Turno de acceso al inventario: dos peticiones no pueden cambiar camas a la vez.
const inventoryLock = (db) => db.query('SELECT pg_advisory_xact_lock(741002)');
const ref = (prefix) => `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
// Reintentar el mismo formulario con la misma clave devuelve la respuesta anterior.
// Evita duplicados si la red falla después de guardar la solicitud.
export async function idempotent(db, key, body, fn) {
  uuid(key);
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [key]);
  const fingerprint = hash(JSON.stringify(body));
  const {
    rows: [previous],
  } = await db.query('SELECT * FROM idempotency WHERE key=$1', [key]);
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      fail(409, 'La petición ya existe con otros datos. Vuelve a revisar el formulario.');
    return previous.response;
  }
  const response = await fn();
  await db.query('INSERT INTO idempotency(key,fingerprint,response) VALUES($1,$2,$3)', [
    key,
    fingerprint,
    response,
  ]);
  return response;
}
// El intervalo [llegada, salida) incluye las noches, pero excluye el día de salida.
// && en PostgreSQL comprueba si dos intervalos se solapan.
export async function availability(arrival, departure) {
  dates(arrival, departure);
  const { rows } = await pool.query(
    `SELECT r.id AS room_id,r.name,r.description,b.id,b.label,
 NOT EXISTS(SELECT 1 FROM allocations a WHERE a.bed_id=b.id AND a.active AND a.period && daterange($1::date,$2::date,'[)')) AS available
 FROM rooms r JOIN beds b ON b.room_id=r.id WHERE r.active AND b.active ORDER BY r.id,b.id`,
    [arrival, departure],
  );
  const rooms = [];
  for (const row of rows) {
    let room = rooms.find((r) => r.id === row.room_id);
    if (!room) {
      room = { id: row.room_id, name: row.name, description: row.description, beds: [] };
      rooms.push(room);
    }
    room.beds.push({ id: row.id, label: row.label, available: row.available });
  }
  return rooms.map((r) => ({
    ...r,
    capacity: r.beds.length,
    free: r.beds.filter((b) => b.available).length,
    wholeAvailable: r.beds.every((b) => b.available),
  }));
}
export async function calendar(month) {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) fail(400, 'Mes no válido.');
  date(month + '-01');
  const { rows } = await pool.query(
    `SELECT to_char(d,'YYYY-MM-DD') AS date,
 count(b.id)::int AS total,
 count(b.id) FILTER(WHERE NOT EXISTS(SELECT 1 FROM allocations a WHERE a.bed_id=b.id AND a.active AND a.period @> d::date))::int AS free
 FROM generate_series($1::date,($1::date+interval '1 month - 1 day')::date,interval '1 day') d
 LEFT JOIN beds b ON b.active AND EXISTS(SELECT 1 FROM rooms r WHERE r.id=b.room_id AND r.active)
 GROUP BY d ORDER BY d`,
    [month + '-01'],
  );
  return rows;
}
// Valida una cama por persona o todas las camas de una habitación completa.
async function selectedBeds(db, body) {
  if (!['ROOM', 'BEDS'].includes(body.mode)) fail(400, 'Modalidad no válida.');
  integer(body.people, 'Personas');
  dates(body.arrival, body.departure);
  let rows;
  if (body.mode === 'ROOM') {
    integer(body.roomId, 'Habitación');
    ({ rows } = await db.query(
      'SELECT b.id,b.room_id FROM beds b JOIN rooms r ON r.id=b.room_id WHERE r.id=$1 AND b.active AND r.active ORDER BY b.id',
      [body.roomId],
    ));
  } else {
    if (!Array.isArray(body.bedIds) || !body.bedIds.length || body.bedIds.length > 500)
      fail(400, 'Selecciona las camas.');
    body.bedIds.forEach((id) => integer(id, 'Cama'));
    if (new Set(body.bedIds).size !== body.bedIds.length) fail(400, 'Hay camas repetidas.');
    ({ rows } = await db.query(
      'SELECT b.id,b.room_id FROM beds b JOIN rooms r ON r.id=b.room_id WHERE b.id=ANY($1::int[]) AND b.active AND r.active ORDER BY b.id',
      [body.bedIds],
    ));
    if (rows.length !== body.bedIds.length) fail(409, 'Alguna cama ya no está disponible.');
    if (rows.length !== body.people) fail(400, 'Selecciona una cama por persona.');
  }
  if (!rows.length || rows.length < body.people) fail(400, 'La capacidad no es suficiente.');
  return rows.map((r) => r.id);
}
async function allocate(db, id, bedIds, arrival, departure) {
  for (const bed of bedIds)
    await db.query(
      "INSERT INTO allocations(booking_id,bed_id,period) VALUES($1,$2,daterange($3::date,$4::date,'[)'))",
      [id, bed, arrival, departure],
    );
}
// Guardar contacto + solicitud + camas + auditoría es una única transacción.
// La restricción de exclusión de PostgreSQL impide solapamientos incluso con concurrencia.
export async function createBooking(body, key) {
  const c = contact(body);
  return tx(async (db) =>
    idempotent(db, key, { ...body, domain: 'lodging' }, async () => {
      await inventoryLock(db);
      const beds = await selectedBeds(db, body);
      const reference = ref('SQ');
      const {
        rows: [booking],
      } = await db.query(
        `INSERT INTO bookings(reference,mode,first_name,last_name,email,phone,notes,arrival,departure,people)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          reference,
          body.mode,
          c.firstName,
          c.lastName,
          c.email,
          c.phone,
          c.notes,
          body.arrival,
          body.departure,
          body.people,
        ],
      );
      await allocate(db, booking.id, beds, body.arrival, body.departure);
      await audit(db, null, 'ALOJAMIENTO_SOLICITADO', booking.id, { beds: beds.length });
      return {
        reference,
        status: 'PENDIENTE',
        message:
          'Solicitud recibida. Las plazas quedan retenidas hasta que administración la resuelva. No es una reserva confirmada.',
      };
    }),
  );
}
// PENDIENTE ya retiene camas. ACEPTADA las mantiene; RECHAZADA las libera.
export async function resolveBooking(id, status, actor) {
  uuid(id);
  if (!['ACEPTADA', 'RECHAZADA'].includes(status)) fail(400, 'Estado no válido.');
  return tx(async (db) => {
    await inventoryLock(db);
    const {
      rows: [booking],
    } = await db.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [id]);
    if (!booking) fail(404, 'Solicitud no encontrada.');
    if (booking.status === status) return { status };
    if (booking.status !== 'PENDIENTE') fail(409, 'Esta solicitud ya se ha resuelto.');
    if (status === 'ACEPTADA') await db.query('INSERT INTO stays(booking_id) VALUES($1)', [id]);
    else await db.query('UPDATE allocations SET active=false WHERE booking_id=$1', [id]);
    await db.query('UPDATE bookings SET status=$1 WHERE id=$2', [status, id]);
    await audit(db, actor, 'ALOJAMIENTO_' + status, id);
    return { status };
  });
}
// Si la nueva asignación falla, la transacción restaura la estancia original.
export async function modifyBooking(id, body, actor) {
  uuid(id);
  const c = contact(body);
  return tx(async (db) => {
    await inventoryLock(db);
    const {
      rows: [booking],
    } = await db.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [id]);
    if (!booking) fail(404, 'Solicitud no encontrada.');
    if (booking.status === 'RECHAZADA') fail(409, 'Una solicitud rechazada no se puede modificar.');
    if (
      (
        await db.query('SELECT 1 FROM stays WHERE booking_id=$1 AND checked_in_at IS NOT NULL', [
          id,
        ])
      ).rowCount
    )
      fail(409, 'No se puede mover una estancia iniciada.');
    const beds = await selectedBeds(db, body);
    await db.query('UPDATE allocations SET active=false WHERE booking_id=$1', [id]);
    await allocate(db, id, beds, body.arrival, body.departure);
    await db.query(
      `UPDATE bookings SET mode=$2,first_name=$3,last_name=$4,email=$5,phone=$6,notes=$7,arrival=$8,departure=$9,people=$10 WHERE id=$1`,
      [
        id,
        body.mode,
        c.firstName,
        c.lastName,
        c.email,
        c.phone,
        c.notes,
        body.arrival,
        body.departure,
        body.people,
      ],
    );
    await audit(db, actor, 'ALOJAMIENTO_MODIFICADO', id, {
      previousArrival: booking.arrival,
      previousDeparture: booking.departure,
      arrival: body.arrival,
      departure: body.departure,
      beds,
    });
    return { reference: booking.reference, status: booking.status };
  });
}
export async function checkStay(id, action, actor) {
  uuid(id);
  if (!['in', 'out'].includes(action)) fail(400, 'Acción no válida.');
  return tx(async (db) => {
    const {
      rows: [s],
    } = await db.query(
      'SELECT s.*,b.arrival,b.departure FROM stays s JOIN bookings b ON b.id=s.booking_id WHERE booking_id=$1 FOR UPDATE OF s',
      [id],
    );
    if (!s) fail(409, 'Primero acepta la solicitud.');
    if (action === 'in') {
      if (s.checked_in_at) fail(409, 'La entrada ya está registrada.');
      if (today() < s.arrival || today() >= s.departure)
        fail(409, 'La entrada debe registrarse durante las fechas de estancia.');
      await db.query('UPDATE stays SET checked_in_at=now() WHERE booking_id=$1', [id]);
    } else {
      if (!s.checked_in_at || s.checked_out_at)
        fail(409, 'La estancia no tiene una entrada activa.');
      await db.query('UPDATE stays SET checked_out_at=now() WHERE booking_id=$1', [id]);
    }
    await audit(db, actor, 'CHECK_' + action.toUpperCase(), id);
    return { ok: true };
  });
}
export async function inventory(body, actor) {
  return tx(async (db) => {
    await inventoryLock(db);
    const name = text(body.name, 'Nombre', 80),
      description = text(body.description ?? '', 'Descripción', 1000, false);
    integer(body.capacity, 'Capacidad', 1, 100);
    if (typeof body.active !== 'boolean') fail(400, 'Estado de habitación no válido.');
    let roomId = body.id;
    if (roomId) {
      integer(roomId, 'Habitación');
      if (!(await db.query('SELECT 1 FROM rooms WHERE id=$1', [roomId])).rowCount)
        fail(404, 'Habitación no encontrada.');
    } else {
      const {
        rows: [r],
      } = await db.query(
        'INSERT INTO rooms(name,description,active) VALUES($1,$2,$3) RETURNING id',
        [name, description, body.active],
      );
      roomId = r.id;
    }
    const { rows: beds } = await db.query('SELECT * FROM beds WHERE room_id=$1 ORDER BY id', [
      roomId,
    ]);
    const active = beds.filter((b) => b.active);
    const disabled = !body.active ? beds : active.slice(body.capacity);
    if (
      disabled.length &&
      (
        await db.query(
          'SELECT 1 FROM allocations WHERE bed_id=ANY($1::int[]) AND active AND upper(period)>$2::date LIMIT 1',
          [disabled.map((b) => b.id), today()],
        )
      ).rowCount
    )
      fail(
        409,
        'Hay reservas o bloqueos vigentes. Resuélvelos antes de reducir capacidad o desactivar.',
      );
    if (body.capacity < active.length)
      await db.query('UPDATE beds SET active=false WHERE id=ANY($1::int[])', [
        active.slice(body.capacity).map((b) => b.id),
      ]);
    for (let n = active.length; n < body.capacity; n++)
      await db.query('INSERT INTO beds(room_id,label) VALUES($1,$2)', [
        roomId,
        `Cama ${beds.length + (n - active.length) + 1}`,
      ]);
    await db.query('UPDATE rooms SET name=$2,description=$3,active=$4 WHERE id=$1', [
      roomId,
      name,
      description,
      body.active,
    ]);
    await audit(db, actor, 'HABITACION_GUARDADA', roomId, {
      capacity: body.capacity,
      active: body.active,
    });
    return { id: roomId };
  });
}
export async function blockBeds(body, actor) {
  dates(body.arrival, body.departure);
  const reason = text(body.reason, 'Motivo', 200);
  if (!Array.isArray(body.bedIds) || !body.bedIds.length) fail(400, 'Selecciona camas.');
  return tx(async (db) => {
    await inventoryLock(db);
    const ids = await selectedBeds(db, { ...body, mode: 'BEDS', people: body.bedIds.length });
    for (const id of ids)
      await db.query(
        "INSERT INTO allocations(bed_id,period,reason) VALUES($1,daterange($2::date,$3::date,'[)'),$4)",
        [id, body.arrival, body.departure, reason],
      );
    await audit(db, actor, 'CAMAS_BLOQUEADAS', ids.join(','), {
      arrival: body.arrival,
      departure: body.departure,
    });
    return { ok: true };
  });
}
export async function unblock(id, actor) {
  integer(id, 'Bloqueo', 1, Number.MAX_SAFE_INTEGER);
  return tx(async (db) => {
    await inventoryLock(db);
    const result = await db.query(
      'UPDATE allocations SET active=false WHERE id=$1 AND booking_id IS NULL AND active',
      [id],
    );
    if (!result.rowCount) fail(404, 'Bloqueo no encontrado.');
    await audit(db, actor, 'BLOQUEO_RETIRADO', id);
    return { ok: true };
  });
}
