import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {pool} from './db.mjs';
import {login,authenticate,tokenFrom,hash,rateLimit} from './auth.mjs';
import {fail,today} from './validation.mjs';
import {availability,calendar,createBooking,resolveBooking,modifyBooking,checkStay,inventory,blockBeds,unblock} from './booking.mjs';
import {restaurantAvailability,createRestaurant,resolveRestaurant,saveSlot} from './restaurant.mjs';
const publicDir=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const production=process.env.NODE_ENV==='production';
const origin=process.env.APP_ORIGIN || 'http://localhost:3000';
if(production&&!origin.startsWith('https://'))throw new Error('APP_ORIGIN debe usar HTTPS en producción.');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const cookie=(token,maxAge=28800)=>`sq_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${production?'; Secure':''}`;
async function body(req){let content='';for await(const chunk of req){content+=chunk;if(Buffer.byteLength(content)>16384)fail(413,'Formulario demasiado grande.');}try{const value=JSON.parse(content||'{}');if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Formulario no válido.');return value;}catch{fail(400,'Formato JSON no válido.');}}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function adminData(){
 const bookings=(await pool.query(`SELECT b.*,s.checked_in_at,s.checked_out_at,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',bed.id,'label',bed.label,'room',r.name)) FROM allocations a JOIN beds bed ON bed.id=a.bed_id JOIN rooms r ON r.id=bed.room_id WHERE a.booking_id=b.id AND a.active),'[]') AS beds
 FROM bookings b LEFT JOIN stays s ON s.booking_id=b.id ORDER BY b.created_at DESC LIMIT 500`)).rows;
 const rooms=(await pool.query(`SELECT r.*,COALESCE(jsonb_agg(jsonb_build_object('id',b.id,'label',b.label,'active',b.active) ORDER BY b.id) FILTER(WHERE b.id IS NOT NULL),'[]') AS beds FROM rooms r LEFT JOIN beds b ON b.room_id=r.id GROUP BY r.id ORDER BY r.id`)).rows;
 const restaurant=(await pool.query(`SELECT r.*,s.date,to_char(s.time,'HH24:MI') AS time FROM restaurant_requests r JOIN restaurant_slots s ON s.id=r.slot_id ORDER BY r.created_at DESC LIMIT 500`)).rows;
 const slots=(await pool.query(`SELECT s.*,to_char(s.time,'HH24:MI') AS time,COALESCE(sum(r.people) FILTER(WHERE r.status<>'RECHAZADA'),0)::int AS used FROM restaurant_slots s LEFT JOIN restaurant_requests r ON r.slot_id=s.id GROUP BY s.id ORDER BY s.date DESC,s.time LIMIT 500`)).rows;
 const blocks=(await pool.query(`SELECT a.id,a.bed_id,b.label,r.name AS room,lower(a.period) AS arrival,upper(a.period) AS departure,a.reason FROM allocations a JOIN beds b ON b.id=a.bed_id JOIN rooms r ON r.id=b.room_id WHERE a.booking_id IS NULL AND a.active ORDER BY lower(a.period)`)).rows;
 const events=(await pool.query('SELECT action,entity_id,details,created_at FROM audit ORDER BY id DESC LIMIT 40')).rows;
 const {rows:[metrics]}=await pool.query(`SELECT
 (SELECT count(*) FROM rooms WHERE active)::int AS rooms,
 (SELECT count(*) FROM beds b JOIN rooms r ON r.id=b.room_id WHERE b.active AND r.active)::int AS beds,
 (SELECT count(*) FROM allocations a JOIN bookings b ON b.id=a.booking_id WHERE a.active AND a.period @> $1::date AND b.status='ACEPTADA')::int AS occupied,
 (SELECT count(*) FROM bookings WHERE status='PENDIENTE')::int AS pending,
 (SELECT count(*) FROM bookings WHERE status='ACEPTADA' AND arrival=$1::date)::int AS arrivals,
 (SELECT count(*) FROM bookings WHERE status='ACEPTADA' AND departure=$1::date)::int AS departures,
 (SELECT count(*) FROM restaurant_requests WHERE status='PENDIENTE')::int AS restaurant_pending,
 (SELECT COALESCE(sum(r.people),0)::int FROM restaurant_requests r JOIN restaurant_slots s ON s.id=r.slot_id WHERE s.date=$1::date AND r.status='ACEPTADA') AS diners`,[today()]);
 return {bookings,rooms,restaurant,slots,blocks,events,metrics,date:today(),limit:500};
}
export const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
 try {
  const url=new URL(req.url,'http://local'),path=url.pathname,method=req.method;
  const mutate=!['GET','HEAD','OPTIONS'].includes(method);
  // Preview may use a reverse proxy; only trust its origin in explicit local development.
  const requestOrigin=req.headers.origin;
  const preview=process.env.NODE_ENV!=='production'&&process.env.ALLOW_LOCAL_PREVIEW==='true'&&requestOrigin===`https://${req.headers.host}`;
  if(mutate&&requestOrigin!==origin&&!preview)fail(403,'Origen no permitido.');
  if(mutate&&!req.headers['content-type']?.startsWith('application/json'))fail(415,'Se requiere application/json.');
  if(path==='/api/health'&&method==='GET'){await pool.query('SELECT 1');return json(res,{ok:true});}
  if(path==='/api/availability'&&method==='GET')return json(res,{rooms:await availability(url.searchParams.get('arrival'),url.searchParams.get('departure'))});
  if(path==='/api/calendar'&&method==='GET')return json(res,{days:await calendar(url.searchParams.get('month')),today:today()});
  if(path==='/api/restaurant/availability'&&method==='GET')return json(res,{slots:await restaurantAvailability(url.searchParams.get('date'))});
  if((path==='/api/bookings'||path==='/api/restaurant/requests')&&method==='POST'){
   await rateLimit('forms:'+req.socket.remoteAddress,30,15);
   const data=await body(req),key=req.headers['idempotency-key'];
   return json(res,path==='/api/bookings'?await createBooking(data,key):await createRestaurant(data,key),201);
  }
  if(path==='/api/login'&&method==='POST'){
   await rateLimit('login:'+req.socket.remoteAddress,10,15);
   const data=await body(req),session=await login(data.email,data.password);
   res.setHeader('Set-Cookie',cookie(session.token));return json(res,{csrf:session.csrf,email:session.email});
  }
  if(path.startsWith('/api/admin/')||path==='/api/session'||path==='/api/logout') {
   const session=await authenticate(req,mutate);
   if(path==='/api/session'&&method==='GET')return json(res,{csrf:session.csrf,email:session.email});
   if(path==='/api/logout'&&method==='POST'){await pool.query('DELETE FROM sessions WHERE token_hash=$1',[hash(tokenFrom(req))]);res.setHeader('Set-Cookie',cookie('',0));return json(res,{ok:true});}
   if(path==='/api/admin/data'&&method==='GET')return json(res,await adminData());
   const match=path.match(/^\/api\/admin\/(bookings|restaurant)\/([\da-f-]+)(?:\/(status|check))?$/);
   if(match&&method==='PATCH'){
    const data=await body(req),[,,id,action]=match;
    if(action==='status')return json(res,match[1]==='bookings'?await resolveBooking(id,data.status,session.admin_id):await resolveRestaurant(id,data.status,session.admin_id));
    if(action==='check'&&match[1]==='bookings')return json(res,await checkStay(id,data.action,session.admin_id));
    if(!action&&match[1]==='bookings')return json(res,await modifyBooking(id,data,session.admin_id));
   }
   if(path==='/api/admin/rooms'&&method==='POST')return json(res,await inventory(await body(req),session.admin_id));
   if(path==='/api/admin/blocks'&&method==='POST')return json(res,await blockBeds(await body(req),session.admin_id));
   if(/^\/api\/admin\/blocks\/\d+$/.test(path)&&method==='DELETE')return json(res,await unblock(Number(path.split('/').at(-1)),session.admin_id));
   if(path==='/api/admin/slots'&&method==='POST')return json(res,await saveSlot(await body(req),session.admin_id));
   fail(404,'Acción no encontrada.');
  }
  if(path.startsWith('/api/'))fail(404,'Ruta no encontrada.');
  if(!['GET','HEAD'].includes(method))fail(405,'Método no permitido.');
  const file=resolve(publicDir,'.'+decodeURIComponent(path==='/'?'/index.html':path==='/admin'?'/admin.html':path));
  if(!file.startsWith(publicDir+sep)||!types[extname(file)])fail(404,'Página no encontrada.');
  try { const content=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-cache'});res.end(method==='HEAD'?undefined:content); }
  catch(error){if(error.code==='ENOENT')fail(404,'Página no encontrada.');throw error;}
 }catch(error){
  const conflicts=['23P01','23505','40001','40P01'];
  const status=error.status??(conflicts.includes(error.code)?409:500);
  if(status===500)console.error('Error interno:',error.code??error.name); // Sin datos personales ni SQL.
  json(res,{error:status===500?'No se ha podido completar la operación. Inténtalo de nuevo.':status===409&&!error.status?'La disponibilidad ha cambiado o el registro ya existe. Revisa tu selección.':error.message},status);
 }
});
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||3000);
 server.listen(port,'0.0.0.0',()=>console.log(`Santa Quiteria disponible en el puerto ${port}`));
 const close=()=>server.close(()=>pool.end().then(()=>process.exit(0)));
 process.on('SIGTERM',close);process.on('SIGINT',close);
}
