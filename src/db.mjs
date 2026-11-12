import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Consulta README.md.');
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 15 });
// Fechas de negocio como YYYY-MM-DD: sin conversiones implícitas a UTC.
pg.types.setTypeParser(1082, (value) => value);
// Una transacción guarda todos los cambios juntos. Si algo falla, ROLLBACK los deshace.
// La conexión se devuelve al pool incluso si se produce un error.
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
// Registro de acciones administrativas. $1, $2... reciben los valores por separado del SQL.
export async function audit(db, actor, action, id, details = {}) {
  await db.query('INSERT INTO audit(actor,action,entity_id,details) VALUES($1,$2,$3,$4)', [
    actor,
    action,
    String(id),
    details,
  ]);
}
