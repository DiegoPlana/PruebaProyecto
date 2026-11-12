import {randomBytes, createHash, scrypt as rawScrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {pool} from './db.mjs';
import {fail} from './validation.mjs';
const scrypt=promisify(rawScrypt);
export const hash=value=>createHash('sha256').update(value).digest('hex');
export async function passwordHash(password) {
 if (typeof password !== 'string' || password.length < 12 || password.length > 128) fail(400,'La contraseña debe tener entre 12 y 128 caracteres.');
 const salt=randomBytes(16).toString('hex');
 return salt+':'+(await scrypt(password,salt,64)).toString('hex');
}
export async function login(email,password) {
 if (typeof email !== 'string' || typeof password !== 'string' || password.length > 128) fail(401,'Email o contraseña incorrectos.');
 const {rows:[admin]}=await pool.query('SELECT * FROM admins WHERE email=$1',[email.trim().toLowerCase()]);
 const [salt,expected]=(admin?.password_hash ?? '00000000000000000000000000000000:'+ '00'.repeat(64)).split(':');
 const actual=await scrypt(password,salt,64);
 if (!timingSafeEqual(actual,Buffer.from(expected,'hex')) || !admin) fail(401,'Email o contraseña incorrectos.');
 const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
 await pool.query("DELETE FROM sessions WHERE expires_at < now()");
 await pool.query("INSERT INTO sessions(token_hash,admin_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[hash(token),admin.id,csrf]);
 return {token,csrf,email:admin.email};
}
export function tokenFrom(req) {return (req.headers.cookie ?? '').split(';').map(x=>x.trim()).find(x=>x.startsWith('sq_session='))?.slice(11) ?? '';}
export async function authenticate(req,mutating=false) {
 const {rows:[session]}=await pool.query('SELECT s.*,a.email FROM sessions s JOIN admins a ON a.id=s.admin_id WHERE token_hash=$1 AND expires_at>now()',[hash(tokenFrom(req))]);
 if (!session) fail(401,'Inicia sesión para acceder.');
 if (mutating && req.headers['x-csrf-token'] !== session.csrf) fail(403,'La sesión debe actualizarse. Vuelve a iniciar sesión.');
 return session;
}
export async function rateLimit(key,limit,minutes) {
 const {rows:[result]}=await pool.query(`INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 minute')
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<=now() THEN 1 ELSE rate_limits.count+1 END,
 expires_at=CASE WHEN rate_limits.expires_at<=now() THEN excluded.expires_at ELSE rate_limits.expires_at END RETURNING count`,[key,minutes]);
 if(result.count>limit) fail(429,'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
}
