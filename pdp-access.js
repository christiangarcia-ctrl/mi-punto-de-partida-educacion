/* Fuente canónica en mi-tracker-seguros/public. Copiar con scripts/distribute-pdp.mjs. */
(function(){
 'use strict';
 const cfg=window.GARBA_ACCESS_CONFIG;
 const fragment=new URLSearchParams(location.hash.slice(1));
 const incoming=fragment.get('access');
 const legacy=[...new URLSearchParams(location.search).keys()].some(k=>['n','a','e','g','t','do'].includes(k));
 const previous=history.state?.garbaAccess;
 let token=incoming||(!legacy&&previous?.product===cfg.product&&previous?.role===cfg.role?previous.token:null);
 window.garbaIdentified=!!token;
 window.garbaExternalInput=!!token||[...new URLSearchParams(location.search).keys()].some(k=>['n','a','e','g','t','do'].includes(k));
 if(incoming){
  // Fragmento: no viaja al servidor estático ni como Referer. Retirar antes de cargar recursos.
  history.replaceState({...history.state,garbaAccess:{token,product:cfg.product,role:cfg.role}},'',location.pathname);
 }
 let revision=0,known={},inFlight=null,box;
 function status(message,retry){
  if(!box){box=document.createElement('div');box.setAttribute('role','status');box.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#f7f9fc;display:grid;place-content:center;padding:32px;text-align:center;color:#172b46;font:16px system-ui;';document.body.append(box)}
  box.replaceChildren();const text=document.createElement('p');text.textContent=message;box.append(text);
  if(retry){const button=document.createElement('button');button.type='button';button.textContent='Reintentar';button.onclick=retry;box.append(button)}
 }
 function clear(){box?.remove();box=null}
 async function request(action,data,extra){
  const r=await fetch(cfg.api,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,product:cfg.product,revision,...(data?{data}:{}),...(extra||{})}),cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
  const body=await r.json();if(!r.ok){const e=new Error(body.error||'No pudimos abrir el acceso. Solicita un enlace nuevo.');e.userMessage=true;throw e}return body;
 }
 function set(id,value){const e=document.getElementById(id);if(e&&value!==undefined&&value!==null&&value!==''){e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));return e}return null}
 function review(element,label,value){
  if(!element||element.type==='hidden'||value===undefined||value===null||value==='')return;
  const holder=element.closest('.grid2 > div')||element.parentElement;
  const summary=document.createElement('div');summary.style.cssText='padding:8px 0;font:14px system-ui;';
  const text=document.createElement('span');text.textContent=`${label}: ${value} `;
  const edit=document.createElement('button');edit.type='button';edit.textContent='Corregir';edit.style.cssText='border:0;background:transparent;color:#0830e8;text-decoration:underline;cursor:pointer';
  const previous=[...holder.children];previous.forEach(e=>e.hidden=true);summary.append(text,edit);holder.append(summary);
  edit.onclick=()=>{previous.forEach(e=>e.hidden=false);summary.remove();element.focus()};
 }
 function chips(id,values){
  if(!Array.isArray(values)||!values.length)return;
  const group=document.getElementById(id);if(!group)return;
  group.querySelectorAll('button').forEach(b=>b.classList.remove('sel'));
  for(const value of values){
   let button=[...group.querySelectorAll('button')].find(b=>b.dataset.value===value);
   if(!button){button=document.createElement('button');button.type='button';button.className='choice-btn';button.dataset.value=value;button.textContent=value;button.onclick=()=>window.toggleMulti(id,button,1);group.append(button)}
   button.classList.add('sel');
  }
 }
 function pointHydrate(d){
  const map={nom:'nombre',wa:'wanum',des:'deseo',ahorro:'ahorro',dolorPorque:'dolorPorque',...(cfg.product==='retiro'?{edad:'edad',edadR:'edadRet',plazo:'plazo',ingreso:'ingresoR'}:{nombreHijo:'nombreHijo',edadHijo:'edadHijo',edadMeta:'edadMeta'})};
  for(const [k,id] of Object.entries(map)){
   if(k==='edad'&&!(d.edad>=18&&d.edad<=64))continue;
   set(id,d[k]);
  }
  if(d.reg){const radio=document.querySelector(`input[name="reg"][value="${d.reg}"]`);if(radio)window.selReg(radio.closest('label'),d.reg)}
  for(const [k,id] of Object.entries({dolor:'chipsDolor',meta:'chipsMeta',porque:'chipsPorque',condicion:'chipsCondicion',freno:'chipsFreno'}))chips(id,d[k]);
  // Mantener visibles/seleccionados los controles originales al recuperar una respuesta.
  document.querySelectorAll('button[onclick]').forEach(b=>{
   const code=b.getAttribute('onclick');
   for(const [fn,key] of [['selAhorro','ahorro'],['selPlazo','plazo'],['selEdadRet','edadR'],['selEdadMeta','edadMeta']]){
    const m=code.match(new RegExp('^'+fn+'\\((\\d+),'));if(m&&Number(m[1])===d[key])b.classList.add('sel');
   }
  });
  if(d.ahorro&&![2000,3000,5000,7500,10000].includes(d.ahorro)){set('ahorroOtro',d.ahorro);document.getElementById('otroAhorroWrap')?.classList.add('vis')}
  if(cfg.product==='educacion')window.actualizarPlazoHint?.();
  for(const [k,label] of [['nom','Nombre'],['wa','WhatsApp'],['edad','Edad']]){
   if(k==='edad'&&cfg.product!=='retiro')continue;
   if(k==='edad'&&!(d.edad>=18&&d.edad<=64))continue;
   review(document.getElementById(map[k]),label,d[k]);
  }
  // Correo se conserva aunque no sea una pregunta del formulario original. Corrección opcional.
  const contact=document.getElementById('nombre')?.closest('.grid2');
  if(contact?.previousElementSibling?.classList.contains('mini-note'))contact.previousElementSibling.textContent='Ya conservamos tus datos disponibles. Completa solo lo que falta o corrige lo que haya cambiado.';
  if(contact&&d.correo){const wrap=document.createElement('div');const input=document.createElement('input');input.type='email';input.id='pdpCorreo';input.className='fi';input.value=d.correo;wrap.append(input);contact.append(wrap);review(input,'Correo',d.correo)}
 }
 // El enlace de Advisor nunca llega al navegador del prospecto: el servidor se lo manda al asesor.
 function readyWa(s){
  s.sesionUrl='';
  const wa=document.getElementById('btnWa');
  if(wa){wa.href='https://wa.me/526624176032?text='+encodeURIComponent('Hola Christian, ya completé mi Punto de Partida.');wa.style.pointerEvents='';wa.removeAttribute('aria-disabled')}
 }
 function projection(s){const p={};for(const k of ['ingresoProy','brecha','capitalActual','aportMeta','metaFutura'])if(typeof s[k]==='number')p[k]=s[k];if(typeof s.fd?.dev==='number')p.devolucion=s.fd.dev;return p}
 async function load(){
  status('Estamos recuperando tu información…');
  try{
   const r=await request(cfg.role==='advisor'?'advisor':'resolve');revision=r.revision;known=r.data;
   if(cfg.role==='advisor'){window.garbaHydrateAdvisor(r.data);window.__gaAdvisoryBoot={advisory:r.advisory||null,revision:r.advisoryRevision||0};window.GaV2?.boot?.()}else pointHydrate(r.data);
   clear();
  }catch(e){status(e.userMessage?e.message:'No pudimos recuperar tu información. Intenta nuevamente.',load)}
 }
 window.GarbaAccess={
  active:!!token,
  // Advisor V2: acciones acotadas del servidor (advisory_save / advisory_slots / advisory_schedule).
  call(action,extra){return fetch(cfg.api,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,product:cfg.product,...(extra||{})}),cache:'no-store',referrerPolicy:'no-referrer'}).then(async r=>{const body=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(body.error||'No pudimos completar la operación.');e.status=r.status;e.body=body;throw e}return body})},
  merge(s){return {...s,correo:document.getElementById('pdpCorreo')?.value??known.correo??'',...(known.fechaNacimiento?{fechaNacimiento:known.fechaNacimiento}:{})}},
  pending(s){if(!token)return;s.sesionUrl='';const wa=document.getElementById('btnWa');if(wa){wa.removeAttribute('href');wa.style.pointerEvents='none';wa.setAttribute('aria-disabled','true')}},
  finish(s,sendEmail){
   if(!token)return sendEmail();
   if(inFlight)return inFlight;
   const attempt=async()=>{
    status('Guardando tu información para la asesoría…');
    try{const r=await request('save',this.merge(s),{projection:projection(s)});revision=r.revision;readyWa(s);clear();if(r.fallbackEmail)sendEmail()}
    catch(e){status(e.userMessage?e.message:'No pudimos guardar tu información. Intenta nuevamente.',()=>this.finish(s,sendEmail))}
    finally{inFlight=null}
   };
   inFlight=attempt();return inFlight;
  },set,chips
 };
 if(token)document.addEventListener('DOMContentLoaded',load);
})();
