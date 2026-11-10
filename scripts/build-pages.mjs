import {readFile, writeFile} from 'node:fs/promises';

// Shared HTML at build time: navigation and content also work without JavaScript.
// Generated public/*.html files are committed; npm start needs no build step.
const pages = [
  {slug:'inicio', path:'/', label:'Inicio', title:'Un lugar para bajar el ritmo', description:'Conoce el proyecto del Albergue Santa Quiteria en Almassora y prepara tu visita.'},
  {slug:'albergue', path:'/albergue', label:'El albergue', description:'Conoce el proyecto del Albergue Santa Quiteria en Almassora y las formas de organizar tu estancia.'},
  {slug:'habitaciones', path:'/habitaciones', label:'Habitaciones', description:'Consulta el inventario de habitaciones y las modalidades de alojamiento de Santa Quiteria.', app:true},
  {slug:'restaurante', path:'/restaurante', label:'Restaurante', description:'Consulta los turnos del restaurante y envía una solicitud independiente del alojamiento.', app:true, dialog:true},
  {slug:'servicios', path:'/servicios', label:'Servicios', description:'Opciones para preparar tu visita e información sobre las instalaciones pendiente de confirmación.'},
  {slug:'galeria', path:'/galeria', label:'Galería', description:'Identidad visual de Santa Quiteria. Ilustración conceptual y fotografías reales pendientes de validación.'},
  {slug:'contacto', path:'/contacto', label:'Contacto', description:'Albergue Santa Quiteria, Almassora. Estado de la información oficial de contacto y ubicación.'},
  {slug:'reservas', path:'/reservas', label:'Reservas', description:'Consulta el calendario de disponibilidad y solicita camas o una habitación completa sin registro.', app:true, dialog:true},
  {slug:'legal', path:'/legal.html', label:'Privacidad y pruebas', description:'Privacidad, datos de prueba y estado del proyecto Santa Quiteria.', legal:true}
];
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const layout = await read('frontend/layout.html');
const dialog = await read('frontend/request-dialog.html');
const check = process.argv.includes('--check');
const escape = value => value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
for (const page of pages) {
  const links = pages.filter(item => !item.legal).map(item => `<a href="${item.path}"${item.path===page.path?' aria-current="page"':''}${item.slug==='reservas'?' class="button small"':''}>${item.label}</a>`).join('\n      ');
  const values = {
    ...page, title:escape(page.title || page.label), description:escape(page.description),
    navigation:links, footerNavigation:links.replace(' class="button small"',''),
    mainClass:page.legal?' class="section legal"':'',
    breadcrumb:page.path==='/'?'':`<nav class="breadcrumb" aria-label="Ruta de navegación"><a href="/">Inicio</a><span aria-hidden="true">/</span><span>${page.label}</span></nav>`,
    scripts:page.app?'<script src="/app.js" type="module"></script>':'',
    content:(await read(`frontend/pages/${page.slug}.html`)).trim(),
    dialog:page.dialog?dialog.trim():''
  };
  const html = layout.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]).replace(/^[ \t]+$/gm, '');
  const path = `public/${page.slug==='inicio'?'index':page.slug}.html`;
  if (check) {
    if (await read(path)!==html) throw new Error(`${path} no está actualizado. Ejecuta npm run build:pages.`);
  } else await writeFile(new URL(path,root),html);
}
console.log(`${pages.length} páginas ${check?'verificadas':'generadas'} con cabecera y pie compartidos.`);
