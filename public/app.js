import {$,escapeHtml as esc,today,plusDays,pretty,api,toast,busy,formValues,listenClose} from './shared.js';
let month=today().slice(0,7),choosingDeparture=false,currentSearch=null,selection=null,idempotency=null,submittedFingerprint=null,calendarGeneration=0;
const requestDialog=$('#request-dialog');listenClose(requestDialog);
$('#menu-toggle').addEventListener('click',()=>{const open=$('#navigation').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));});
$('#navigation').addEventListener('click',e=>{if(e.target.closest('a')){$('#navigation').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}});
$('#arrival').min=today();$('#departure').min=plusDays(today(),1);$('#arrival').value=today();$('#departure').value=plusDays(today(),1);
$('#restaurant-search [name=date]').min=today();$('#restaurant-search [name=date]').value=today();
function monthMove(delta){const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);month=d.toISOString().slice(0,7);loadCalendar();}
$('#prev-month').onclick=()=>monthMove(-1);$('#next-month').onclick=()=>monthMove(1);
async function loadCalendar(){
 const generation=++calendarGeneration;
 $('#month-title').textContent=new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T12:00:00Z'));
 $('#calendar').setAttribute('aria-busy','true');
 try{
  const {days}=await api('/api/calendar?month='+month);if(generation!==calendarGeneration)return;
  const offset=(new Date(month+'-01T12:00:00Z').getUTCDay()+6)%7;
  $('#calendar').innerHTML='<span></span>'.repeat(offset)+days.map(day=>{
   const past=day.date<today(),type=day.free===0?'full':day.free===day.total?'free':'limited';
   const chosen=day.date===$('#arrival').value||day.date===$('#departure').value;
   const between=day.date>$('#arrival').value&&day.date<$('#departure').value;
   return `<button type="button" class="day ${past?'past':''} ${chosen?'selected':''} ${between?'between':''}" data-date="${day.date}" ${past?'disabled':''} aria-pressed="${chosen}" aria-label="${esc(pretty(day.date))}, ${day.free} camas libres de ${day.total}"><span>${Number(day.date.slice(-2))}</span><i class="dot ${type}" aria-hidden="true"></i></button>`;
  }).join('');
 }catch(e){if(generation===calendarGeneration)$('#calendar').innerHTML=`<p class="error">${esc(e.message)}</p>`;}
 finally{if(generation===calendarGeneration)$('#calendar').removeAttribute('aria-busy');}
}
$('#calendar').addEventListener('click',e=>{
 const value=e.target.closest('[data-date]')?.dataset.date;if(!value)return;
 if(!choosingDeparture||value<=$('#arrival').value){$('#arrival').value=value;$('#departure').value=plusDays(value,1);choosingDeparture=true;$('#calendar-instruction').textContent='Ahora selecciona el día de salida (no ocupa noche).';}
 else{$('#departure').value=value;choosingDeparture=false;$('#calendar-instruction').textContent='Fechas seleccionadas. Consulta la disponibilidad para continuar.';}
 $('#departure').min=plusDays($('#arrival').value,1);invalidateSearch();loadCalendar();
});
function invalidateSearch(){currentSearch=null;$('#availability-results').innerHTML='<p class="fine">Has cambiado tu búsqueda. Consulta de nuevo la disponibilidad.</p>';}
$('#search-form').addEventListener('change',()=>{if($('#departure').value<=$('#arrival').value)$('#departure').value=plusDays($('#arrival').value,1);$('#departure').min=plusDays($('#arrival').value,1);invalidateSearch();loadCalendar();});
async function loadRoomCards(){try{
 const {rooms}=await api(`/api/availability?arrival=${today()}&departure=${plusDays(today(),1)}`);
 $('#room-cards').innerHTML=rooms.length?rooms.map((r,i)=>`<article class="room-card"><header><h3>${esc(r.name)}</h3><span class="pill">${r.capacity} CAMAS · PROVISIONAL</span></header><div class="room-drawing" aria-hidden="true"><svg viewBox="0 0 120 110"><path d="M24 86V38a36 36 0 0 1 72 0v48M35 86V40a25 25 0 0 1 50 0v46M17 87h86M60 15v27M35 43h50M25 67h70M40 57h14v10H40zM66 57h14v10H66z"/><path d="M${18+i*4} 93h80"/></svg></div><p>${esc(r.description)}</p><a href="#disponibilidad" class="text-link">Consulta fechas <span aria-hidden="true">↗</span></a></article>`).join(''):'<p>El equipo todavía no ha configurado habitaciones.</p>';
}catch(e){$('#room-cards').innerHTML=`<p class="error">No se puede cargar el inventario. ${esc(e.message)}</p>`;}}
$('#search-form').addEventListener('submit',async e=>{e.preventDefault();await busy(e.submitter,async()=>{
 const values=formValues(e.target);values.people=Number(values.people);$('#availability-results').innerHTML='<p class="fine">Consultando plazas…</p>';
 try{const {rooms}=await api(`/api/availability?arrival=${values.arrival}&departure=${values.departure}`);currentSearch={...values,rooms};renderAvailability();}catch(err){$('#availability-results').innerHTML=`<p class="error">${esc(err.message)}</p>`;}
});});
function renderAvailability(){const s=currentSearch;
 $('#availability-results').innerHTML=`<p class="fine">${esc(pretty(s.arrival))} → ${esc(pretty(s.departure))} · ${s.people} persona(s)</p>`+s.rooms.map(r=>`<div class="result-room"><h4><span>${esc(r.name)}</span><small>${r.free} de ${r.capacity} camas libres</small></h4>${s.mode==='ROOM'?`<button class="button outline small" data-room="${r.id}" ${!r.wholeAvailable||s.people>r.capacity?'disabled':''}>${r.wholeAvailable&&s.people<=r.capacity?'Solicitar habitación completa':'No disponible para tu búsqueda'}</button>`:`<div class="beds">${r.beds.map(b=>`<label class="bed-option"><input type="checkbox" value="${b.id}" ${!b.available?'disabled':''} aria-label="${esc(r.name+' · '+b.label+(b.available?'':' · ocupada'))}"><span>${esc(b.label)}</span></label>`).join('')}</div>`}</div>`).join('')+(s.rooms.length?'':'<p>No hay habitaciones activas.</p>')+(s.mode==='BEDS'&&s.rooms.length?`<p class="selection-count" id="selection-count">0 de ${s.people} camas seleccionadas</p><button id="continue-beds" class="button full-width" disabled>Continuar con mis camas →</button>`:'');
}
$('#availability-results').addEventListener('change',()=>{if(!currentSearch)return;const count=$('#availability-results').querySelectorAll('input:checked').length;$('#selection-count').textContent=`${count} de ${currentSearch.people} camas seleccionadas`;$('#continue-beds').disabled=count!==currentSearch.people;});
$('#availability-results').addEventListener('click',e=>{
 const room=e.target.closest('[data-room]'),beds=e.target.closest('#continue-beds');if(!currentSearch||(!room&&!beds))return;
 const s=currentSearch;selection={domain:'lodging',arrival:s.arrival,departure:s.departure,people:s.people,mode:s.mode};
 if(room){selection.roomId=Number(room.dataset.room);selection.label=s.rooms.find(r=>r.id===selection.roomId).name+' · Habitación completa';}
 else{selection.bedIds=Array.from($('#availability-results').querySelectorAll('input:checked'),i=>Number(i.value));selection.label=s.rooms.flatMap(r=>r.beds.filter(b=>selection.bedIds.includes(b.id)).map(b=>r.name+' · '+b.label)).join(', ');}
 openRequest();
});
let restaurantSearch=null;
$('#restaurant-search').addEventListener('change',()=>{restaurantSearch=null;$('#restaurant-results').innerHTML='<p class="fine">Consulta de nuevo los turnos para estas condiciones.</p>';});
$('#restaurant-search').addEventListener('submit',async e=>{e.preventDefault();await busy(e.submitter,async()=>{const s=formValues(e.target);s.people=Number(s.people);try{const {slots}=await api('/api/restaurant/availability?date='+s.date);restaurantSearch={...s,slots};$('#restaurant-results').innerHTML=slots.length?slots.map(slot=>`<div class="slot-result"><span><strong>${esc(slot.time)}</strong><br>${slot.closed?'Turno cerrado':slot.free+' plazas libres'}</span><button class="button outline small" data-slot="${slot.id}" ${slot.closed||slot.free<s.people?'disabled':''}>Solicitar</button></div>`).join(''):'<p class="fine">No hay turnos publicados para esta fecha. El equipo debe configurar los horarios antes de recibir solicitudes.</p>';}catch(err){$('#restaurant-results').innerHTML=`<p class="error">${esc(err.message)}</p>`;}});});
$('#restaurant-results').addEventListener('click',e=>{const id=e.target.closest('[data-slot]')?.dataset.slot;if(!id||!restaurantSearch)return;const s=restaurantSearch;selection={domain:'restaurant',slotId:Number(id),people:s.people,date:s.date,label:'Restaurante · '+s.slots.find(x=>x.id===Number(id)).time};openRequest();});
function openRequest(){idempotency=crypto.randomUUID();submittedFingerprint=null;$('#request-form').hidden=false;$('#request-success').hidden=true;$('#request-error').textContent='';$('#request-form').reset();$('#request-title').textContent=selection.domain==='lodging'?'Tu estancia, paso a paso.':'Un sitio en la mesa.';$('#request-summary').innerHTML=`<strong>${esc(selection.label)}</strong><br>${esc(pretty(selection.arrival??selection.date))}${selection.departure?' → '+esc(pretty(selection.departure)):''}<br>${selection.people} ${selection.domain==='lodging'?'persona(s)':'comensales'} · Pendiente de aprobación`;requestDialog.showModal();}
$('#request-form').addEventListener('submit',async e=>{e.preventDefault();await busy(e.submitter,async()=>{
 $('#request-error').textContent='';const {domain,label,date,...selected}=selection;const data={...selected,...formValues(e.target)};const fingerprint=JSON.stringify(data);
 // Conserva la clave en reintentos de red; una edición crea una petición distinta.
 if(submittedFingerprint&&submittedFingerprint!==fingerprint)idempotency=crypto.randomUUID();submittedFingerprint=fingerprint;
 try{const result=await api(domain==='lodging'?'/api/bookings':'/api/restaurant/requests',{method:'POST',data,key:idempotency});$('#request-form').hidden=true;$('#request-success').hidden=false;$('#request-success').innerHTML=`<div class="success"><p class="eyebrow">SOLICITUD RECIBIDA</p><h3>Gracias. Ya tenemos tu solicitud.</h3><strong>${esc(result.reference)}</strong><p>${esc(result.message)}</p><p class="fine">Guarda esta referencia. En este entorno no se envían correos.</p></div>`;invalidateSearch();loadCalendar();$('#restaurant-results').innerHTML='';restaurantSearch=null;}
 catch(err){$('#request-error').textContent=err.message;if(err.status===409)loadCalendar();}
});});
loadCalendar();loadRoomCards();
