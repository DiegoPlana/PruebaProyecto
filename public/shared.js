export const $=selector=>document.querySelector(selector);
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const plusDays=(value,n)=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const pretty=value=>value?new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z')):'—';
export async function api(path,{method='GET',data,csrf,key}={}){
 const headers={};if(data!==undefined)headers['Content-Type']='application/json';if(csrf)headers['X-CSRF-Token']=csrf;if(key)headers['Idempotency-Key']=key;
 const response=await fetch(path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
 let result;try{result=await response.json();}catch{throw new Error('El servidor no ha respondido correctamente. Inténtalo de nuevo.');}
 if(!response.ok){const error=new Error(result.error||'No se ha podido completar la operación.');error.status=response.status;throw error;}
 return result;
}
let toastTimer;
export function toast(message){const target=$('#toast');target.textContent=message;target.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>target.hidden=true,6500);}
export async function busy(button,fn){const text=button.textContent;button.disabled=true;button.textContent='Un momento…';try{return await fn();}finally{button.disabled=false;button.textContent=text;}}
export function formValues(form){return Object.fromEntries(new FormData(form));}
export function listenClose(dialog){dialog.querySelector('[data-close]')?.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});}
