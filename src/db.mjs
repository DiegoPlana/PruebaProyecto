import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Consulta README.md.');
export const pool = new pg.Pool({connectionString: process.env.DATABASE_URL, max: 15});
// Fechas de negocio como YYYY-MM-DD: sin conversiones implícitas a UTC.
pg.types.setTypeParser(1082, value => value);
export async function tx(fn) {
 const client = await pool.connect();
 try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
 catch(error) { await client.query('ROLLBACK'); throw error; }
 finally { client.release(); }
}
export async function audit(db, actor, action, id, details = {}) {
 await db.query('INSERT INTO audit(actor,action,entity_id,details) VALUES($1,$2,$3,$4)', [actor, action, String(id), details]);
}
