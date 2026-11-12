import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const enabled = process.env.RUN_DB_TESTS === 'true';
let pool, server, base, booking, restaurant, auth, actor, beds, roomId;
const personal = {
  firstName: 'Huésped',
  lastName: 'Ficticio',
  email: 'prueba@example.test',
  phone: '+34 600000000',
  notes: '',
};
const payload = (ids = [beds[0].id], arrival = '2090-06-10', departure = '2090-06-13') => ({
  ...personal,
  mode: 'BEDS',
  bedIds: ids,
  people: ids.length,
  arrival,
  departure,
});
const roomPayload = () => ({
  ...personal,
  mode: 'ROOM',
  roomId,
  people: 4,
  arrival: '2090-06-10',
  departure: '2090-06-13',
});
async function getBooking(reference) {
  return (await pool.query('SELECT * FROM bookings WHERE reference=$1', [reference])).rows[0];
}
async function fetchApi(path, method = 'GET', body, extra = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Origin: process.env.APP_ORIGIN ?? 'http://localhost:3000',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extra,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, status: response.status, body: await response.json() };
}
before(async () => {
  if (!enabled) return;
  execFileSync(process.execPath, ['scripts/migrate.mjs'], { stdio: 'inherit' });
  ({ pool } = await import('../src/db.mjs'));
  booking = await import('../src/booking.mjs');
  restaurant = await import('../src/restaurant.mjs');
  auth = await import('../src/auth.mjs');
  ({ server } = await import('../src/server.mjs'));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
beforeEach(async () => {
  if (!enabled) return;
  await pool.query(
    'TRUNCATE rooms,bookings,restaurant_slots,admins,idempotency,rate_limits RESTART IDENTITY CASCADE',
  );
  const {
    rows: [room],
  } = await pool.query("INSERT INTO rooms(name) VALUES('Habitación de prueba') RETURNING id");
  roomId = room.id;
  for (let n = 1; n <= 8; n++)
    await pool.query('INSERT INTO beds(room_id,label) VALUES($1,$2)', [roomId, `Cama ${n}`]);
  beds = (await pool.query('SELECT * FROM beds ORDER BY id')).rows;
  const {
    rows: [admin],
  } = await pool.query('INSERT INTO admins(email,password_hash) VALUES($1,$2) RETURNING id', [
    'admin@example.test',
    await auth.passwordHash('Contraseña ficticia 2026!'),
  ]);
  actor = admin.id;
});
after(async () => {
  if (!enabled) return;
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});
const dbtest = (name, fn) => test(name, { skip: !enabled }, fn);
dbtest(
  'habitación completa bloquea todas las camas; rechazar libera y conserva historial',
  async () => {
    const r = await booking.createBooking(roomPayload(), randomUUID());
    const b = await getBooking(r.reference);
    assert.equal((await booking.availability(b.arrival, b.departure))[0].free, 0);
    await assert.rejects(booking.createBooking(payload(), randomUUID()), (e) => e.code === '23P01');
    await booking.resolveBooking(b.id, 'RECHAZADA', actor);
    assert.equal((await booking.availability(b.arrival, b.departure))[0].free, 8);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS n FROM allocations WHERE booking_id=$1', [b.id]))
        .rows[0].n,
      8,
    );
  },
);
dbtest(
  'tres camas bloqueadas dejan cinco; completa en conflicto y fechas contiguas permitidas',
  async () => {
    const p = payload(beds.slice(0, 3).map((x) => x.id));
    await booking.createBooking(p, randomUUID());
    assert.equal((await booking.availability(p.arrival, p.departure))[0].free, 5);
    await assert.rejects(
      booking.createBooking(roomPayload(), randomUUID()),
      (e) => e.code === '23P01',
    );
    await assert.rejects(
      booking.createBooking(payload([beds[0].id], '2090-06-12', '2090-06-15'), randomUUID()),
      (e) => e.code === '23P01',
    );
    await booking.createBooking(payload([beds[0].id], '2090-06-13', '2090-06-15'), randomUUID());
  },
);
dbtest('diez solicitudes simultáneas a la misma cama: una sola gana', async () => {
  const attempts = await Promise.allSettled(
    Array.from({ length: 10 }, () => booking.createBooking(payload(), randomUUID())),
  );
  assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n, 1);
});
dbtest('carrera habitación completa / cama individual: una sola gana', async () => {
  const attempts = await Promise.allSettled([
    booking.createBooking(roomPayload(), randomUUID()),
    booking.createBooking(payload(), randomUUID()),
  ]);
  assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 1);
});
dbtest(
  'idempotencia concurrente: una sola solicitud y mismo resultado; cambio con la misma clave da conflicto',
  async () => {
    const key = randomUUID(),
      p = payload();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => booking.createBooking(p, key)),
    );
    assert.equal(new Set(results.map((r) => r.reference)).size, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM bookings')).rows[0].n, 1);
    await assert.rejects(
      booking.createBooking({ ...p, notes: 'Cambió' }, key),
      (e) => e.status === 409,
    );
  },
);
dbtest(
  'aceptación conserva inventario, crea ocupación una sola vez y no admite rechazo posterior',
  async () => {
    const r = await booking.createBooking(payload(), randomUUID()),
      b = await getBooking(r.reference);
    await booking.resolveBooking(b.id, 'ACEPTADA', actor);
    await booking.resolveBooking(b.id, 'ACEPTADA', actor);
    assert.equal((await booking.availability(b.arrival, b.departure))[0].free, 7);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM stays')).rows[0].n, 1);
    await assert.rejects(booking.resolveBooking(b.id, 'RECHAZADA', actor), (e) => e.status === 409);
  },
);
dbtest(
  'modificación fallida conserva fechas y bloqueo anterior; modificación válida mueve inventario',
  async () => {
    const r = await booking.createBooking(payload(), randomUUID()),
      b = await getBooking(r.reference);
    await booking.createBooking(payload([beds[1].id]), randomUUID());
    await assert.rejects(
      booking.modifyBooking(b.id, payload([beds[1].id]), actor),
      (e) => e.code === '23P01',
    );
    assert.equal((await booking.availability(b.arrival, b.departure))[0].free, 6);
    await booking.modifyBooking(b.id, payload([beds[2].id], '2090-07-01', '2090-07-03'), actor);
    assert.equal((await booking.availability(b.arrival, b.departure))[0].free, 7);
    assert.equal((await booking.availability('2090-07-01', '2090-07-03'))[0].free, 7);
  },
);
dbtest(
  'desactivar o reducir inventario con reservas se impide; bloqueo administrativo reduce disponibilidad',
  async () => {
    await booking.createBooking(payload([beds[7].id]), randomUUID());
    await assert.rejects(
      booking.inventory({ id: roomId, name: 'Prueba', capacity: 7, active: true }, actor),
      (e) => e.status === 409,
    );
    await assert.rejects(
      booking.inventory({ id: roomId, name: 'Prueba', capacity: 8, active: false }, actor),
      (e) => e.status === 409,
    );
    await booking.blockBeds(
      {
        bedIds: [beds[0].id],
        arrival: '2090-06-10',
        departure: '2090-06-13',
        reason: 'Mantenimiento ficticio',
      },
      actor,
    );
    assert.equal((await booking.availability('2090-06-10', '2090-06-13'))[0].free, 6);
    const id = (await pool.query('SELECT id FROM allocations WHERE booking_id IS NULL')).rows[0].id;
    await booking.unblock(Number(id), actor);
    assert.equal((await booking.availability('2090-06-10', '2090-06-13'))[0].free, 7);
  },
);
dbtest('PostgreSQL impide directamente intervalos activos superpuestos', async () => {
  await pool.query(
    "INSERT INTO allocations(bed_id,period,reason) VALUES($1,'[2090-06-10,2090-06-13)'::daterange,'Prueba')",
    [beds[0].id],
  );
  await assert.rejects(
    pool.query(
      "INSERT INTO allocations(bed_id,period,reason) VALUES($1,'[2090-06-12,2090-06-15)'::daterange,'Prueba')",
      [beds[0].id],
    ),
    (e) => e.code === '23P01',
  );
});
dbtest('restaurante: seis de veinte, aceptación conserva y rechazo libera', async () => {
  const { id } = await restaurant.saveSlot(
    { date: '2090-06-10', time: '13:30', capacity: 20, closed: false },
    actor,
  );
  const r = await restaurant.createRestaurant({ ...personal, slotId: id, people: 6 }, randomUUID());
  assert.equal((await restaurant.restaurantAvailability('2090-06-10'))[0].free, 14);
  const request = (
    await pool.query('SELECT * FROM restaurant_requests WHERE reference=$1', [r.reference])
  ).rows[0];
  await restaurant.resolveRestaurant(request.id, 'ACEPTADA', actor);
  assert.equal((await restaurant.restaurantAvailability('2090-06-10'))[0].free, 14);
  const r2 = await restaurant.createRestaurant(
    { ...personal, slotId: id, people: 5 },
    randomUUID(),
  );
  const request2 = (
    await pool.query('SELECT * FROM restaurant_requests WHERE reference=$1', [r2.reference])
  ).rows[0];
  await restaurant.resolveRestaurant(request2.id, 'RECHAZADA', actor);
  assert.equal((await restaurant.restaurantAvailability('2090-06-10'))[0].free, 14);
});
dbtest('restaurante: concurrencia sin sobreaforo, reducción y cierre rechazados', async () => {
  const { id } = await restaurant.saveSlot(
    { date: '2090-06-10', time: '13:30', capacity: 20, closed: false },
    actor,
  );
  const attempts = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      restaurant.createRestaurant({ ...personal, slotId: id, people: 6 }, randomUUID()),
    ),
  );
  assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 3);
  assert.equal((await restaurant.restaurantAvailability('2090-06-10'))[0].free, 2);
  await assert.rejects(
    restaurant.saveSlot(
      { id, date: '2090-06-10', time: '13:30', capacity: 17, closed: false },
      actor,
    ),
    (e) => e.status === 409,
  );
  await assert.rejects(
    restaurant.saveSlot(
      { id, date: '2090-06-10', time: '13:30', capacity: 20, closed: true },
      actor,
    ),
    (e) => e.status === 409,
  );
  await assert.rejects(
    restaurant.saveSlot(
      { id, date: '2090-06-11', time: '13:30', capacity: 20, closed: false },
      actor,
    ),
    (e) => e.status === 409,
  );
});
dbtest('API: solicitud, conflicto 409, datos públicos sin PII, login, CSRF y logout', async () => {
  assert.equal((await fetchApi('/api/admin/data')).status, 401);
  const p = payload(),
    key = randomUUID();
  const created = await fetchApi('/api/bookings', 'POST', p, { 'Idempotency-Key': key });
  assert.equal(created.status, 201);
  assert.equal(
    (await fetchApi('/api/bookings', 'POST', p, { 'Idempotency-Key': randomUUID() })).status,
    409,
  );
  const publicData = await fetchApi('/api/availability?arrival=2090-06-10&departure=2090-06-13');
  assert.equal(publicData.status, 200);
  const cal = await fetchApi('/api/calendar?month=2090-06');
  assert.equal(cal.body.days.find((x) => x.date === '2090-06-10').free, 7);
  for (const value of [JSON.stringify(publicData.body), JSON.stringify(cal.body)])
    for (const secret of ['prueba@example.test', '600000000', 'Huésped', 'Ficticio'])
      assert.equal(value.includes(secret), false);
  assert.equal(
    (await fetchApi('/api/login', 'POST', { email: 'admin@example.test', password: 'incorrecta' }))
      .status,
    401,
  );
  const login = await fetchApi('/api/login', 'POST', {
    email: 'admin@example.test',
    password: 'Contraseña ficticia 2026!',
  });
  assert.equal(login.status, 200);
  const cookie = login.response.headers.get('set-cookie').split(';')[0],
    csrf = login.body.csrf;
  assert.match(login.response.headers.get('set-cookie'), /HttpOnly/);
  const b = await getBooking(created.body.reference),
    path = '/api/admin/bookings/' + b.id + '/status';
  assert.equal(
    (await fetchApi(path, 'PATCH', { status: 'ACEPTADA' }, { Cookie: cookie })).status,
    403,
  );
  assert.equal(
    (
      await fetchApi(
        path,
        'PATCH',
        { status: 'ACEPTADA' },
        { Cookie: cookie, 'X-CSRF-Token': csrf, Origin: 'https://evil.example' },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await fetchApi(
        path,
        'PATCH',
        { status: 'ACEPTADA' },
        { Cookie: cookie, 'X-CSRF-Token': csrf },
      )
    ).status,
    200,
  );
  const dashboard = await fetchApi('/api/admin/data', 'GET', null, { Cookie: cookie });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.bookings.length, 1);
  assert.equal(
    (await fetchApi('/api/logout', 'POST', {}, { Cookie: cookie, 'X-CSRF-Token': csrf })).status,
    200,
  );
  assert.equal((await fetchApi('/api/admin/data', 'GET', null, { Cookie: cookie })).status, 401);
});
dbtest('persistencia al reiniciar el servidor HTTP; archivos públicos y cabeceras', async () => {
  const r = await booking.createBooking(payload(), randomUUID());
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  assert.equal(
    (await fetchApi('/api/availability?arrival=2090-06-10&departure=2090-06-13')).body.rooms[0]
      .free,
    7,
  );
  assert.ok(await getBooking(r.reference));
  for (const path of ['/', '/admin', '/style.css', '/app.js', '/landscape.svg', '/legal.html']) {
    const r = await fetch(base + path);
    assert.equal(r.status, 200, path);
    assert.ok(r.headers.get('content-security-policy'));
  }
});
dbtest('check-in y check-out reales, orden y fechas validados', async () => {
  const { today } = await import('../src/validation.mjs');
  const d = today(),
    end = new Date(d + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + 2);
  const r = await booking.createBooking(
      payload([beds[0].id], d, end.toISOString().slice(0, 10)),
      randomUUID(),
    ),
    b = await getBooking(r.reference);
  await assert.rejects(booking.checkStay(b.id, 'in', actor), (e) => e.status === 409);
  await booking.resolveBooking(b.id, 'ACEPTADA', actor);
  await assert.rejects(booking.checkStay(b.id, 'out', actor), (e) => e.status === 409);
  await booking.checkStay(b.id, 'in', actor);
  await booking.checkStay(b.id, 'out', actor);
  const s = (await pool.query('SELECT * FROM stays WHERE booking_id=$1', [b.id])).rows[0];
  assert.ok(s.checked_in_at);
  assert.ok(s.checked_out_at);
});
