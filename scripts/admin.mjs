import {pool} from '../src/db.mjs';
import {passwordHash} from '../src/auth.mjs';
const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Configura ADMIN_EMAIL.');
try {
 const result=await pool.query('INSERT INTO admins(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING',[email,await passwordHash(process.env.ADMIN_PASSWORD)]);
 console.log(result.rowCount?'Administrador creado. Elimina ADMIN_PASSWORD de .env.':'Administrador existente; contraseña conservada.');
} finally {await pool.end();}
