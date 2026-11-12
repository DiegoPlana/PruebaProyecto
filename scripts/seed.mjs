import { pool, tx } from '../src/db.mjs';
if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true')
  throw new Error('Seed solo permitido en desarrollo con ALLOW_DEMO_SEED=true.');
try {
  await tx(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(741002)');
    for (const name of ['Abeto', 'Ribera', 'Luz']) {
      const {
        rows: [room],
      } = await db.query(
        'INSERT INTO rooms(name,description) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET name=excluded.name RETURNING id',
        [
          name,
          'Habitación provisional de desarrollo. Distribución y servicios pendientes de confirmar.',
        ],
      );
      for (let n = 1; n <= 8; n++)
        await db.query(
          'INSERT INTO beds(room_id,label) VALUES($1,$2) ON CONFLICT(room_id,label) DO NOTHING',
          [room.id, `Cama ${n}`],
        );
    }
  });
  console.log('Datos ficticios: 3 habitaciones, 24 camas. Restaurante sin horarios inventados.');
} finally {
  await pool.end();
}
