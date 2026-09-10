// Prototipo de consulta de guía: navegador -> loopback Termux -> QVAC Bare CPU.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,appendFile,access,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn,execFile} from 'node:child_process';
import {join,delimiter} from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {cargarGuia,buscar,normalizar} from '../sucursal/guia.js';
const here=fileURLToPath(new URL('.',import.meta.url));
const pwaAssets=new Map([
  ['/manifest.webmanifest',[join(here,'sucursal-local.webmanifest'),'application/manifest+json']],
  ['/sw.js',[join(here,'sucursal-local-sw.js'),'text/javascript']],
  ...['pwa.js','pwa-cache.js','icono.svg','icono-192.png','icono-512.png'].map(name=>['/'+name,[join(here,'../../app',name),name.endsWith('.js')?'text/javascript':name.endsWith('.svg')?'image/svg+xml':'image/png']])
]);
export function preparar(guia, consulta) {
  if(typeof consulta!=='string'||consulta.trim().length<6||consulta.length>500) throw Object.assign(new Error('Escribe una pregunta de 6 a 500 caracteres.'),{status:400});
  const query=consulta.trim();
  const codes=query.toUpperCase().match(/\b[A-Z]{2,4}-[A-Z]{2,4}(?:-\d{2})?\b/g)||[];
  if(codes.some(c=>!guia.secciones.some(s=>s.titulo.startsWith(c+' — ')))) return {consulta:query,abstencion:true};
  // No convertir las exclusiones del alcance en procedimientos.
  if(/hipotec|criptomon|seguro de vida|tasa de inter|tipo de cambio|horario|desbloque|recuper.*pin/.test(normalizar(query))) return {consulta:query,abstencion:true};
  const candidates=buscar(guia,query,1).filter(s=>!s.titulo.startsWith('ALC-GUI-01')&&!s.titulo.startsWith('Guía operativa'));
  const section=candidates[0];
  if(!section||section.puntaje<5) return {consulta:query,abstencion:true};
  // Fragmento íntegro de la sección: no se elimina ninguna prohibición o condición.
  return {consulta:query,fuente:section.titulo,fragmento:section.texto.trim(),prompt:`GUÍA FICTICIA BPL (demostración):\n${section.texto.trim()}\n\nPregunta: ${query}\nRespuesta breve:`};
}
// Canonical decimal strings: no substring matching or floating-point rounding.
export function numeros(texto) {
  return (texto.match(/[-+]?\d+(?:[.,]\d+)*/g)||[]).map(n=>{
    const sign=n.startsWith('-')?'-':'';n=n.replace(/^[-+]/,'');
    // The fixture uses decimal cents. A single separator is decimal; mixed
    // separators use the last as decimal and earlier ones as group separators.
    const split=Math.max(n.lastIndexOf('.'),n.lastIndexOf(','));
    const whole=(split<0?n:n.slice(0,split)).replace(/[.,]/g,'').replace(/^0+(?=\d)/,'');
    const frac=split<0?'':n.slice(split+1).replace(/0+$/,'');
    return (whole==='0'&&!frac?'':sign)+whole+(frac?'.'+frac:'');
  });
}
export function validarSalida(r,fragmento) {
  if(!r||r.error||!r.respuesta?.trim()||!Number.isFinite(r.inferencia_ms)||r.stats?.backendDevice!=='cpu') throw new Error('QVAC no produjo una respuesta CPU verificable. Puedes reintentar.');
  const respuesta=r.respuesta.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
  const sourceNumbers=new Set(numeros(fragmento));
  const unsupported=numeros(respuesta).some(n=>!sourceNumbers.has(n));
  const incomplete=r.stats.stopReason==='predictionLimit'||Number(r.stats.contextSlides)>0;
  return {...r,respuesta,revision_requerida:true,abstencion:incomplete||unsupported||/sin respaldo en la gu[ií]a/i.test(respuesta),motivo:incomplete?'La generación alcanzó el límite o desplazó contexto. La respuesta no se considera respaldada; consulta la fuente completa.':unsupported?'La salida contiene cifras que no están en la sección. Revisa la fuente; no usar como instrucción.':undefined};
}
export async function comprobarRequisitos({root,worker,path=process.env.PATH||''}) {
  const faltantes=[];
  const files=[['modelo Qwen3 local',join(root,'qwen3-0.6b-q4.gguf')],['worker local',worker],['paquete QVAC',join(root,'node_modules/@qvac/llm-llamacpp/package.json')]];
  for(const [label,file] of files)try{await access(file,constants.R_OK);const s=await stat(file);if(!s.isFile()||s.size===0)faltantes.push(label);}catch{faltantes.push(label);}
  let bare=null;for(const dir of path.split(delimiter).filter(Boolean)){const candidate=join(dir,'bare');try{await access(candidate,constants.X_OK);if((await stat(candidate)).isFile()){bare=candidate;break;}}catch{}}
  if(!bare)faltantes.push('runtime Bare ejecutable');
  return {disponible:!faltantes.length,faltantes,bare};
}
export function crearServidorLocal({guia=cargarGuia(),root=process.env.QVAC_RAIZ||join(process.env.HOME,'qvac-app'),data=process.env.VIGIA_LOCAL_DATOS||join(process.env.HOME,'.local/share/vigia-sucursal'),worker=join(root,'vigia-sucursal-worker.cjs'),timeoutMs=180000,ejecutar}={}) {
  let active=null;
  const json=(res,obj,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj));};
  async function registrar(r){await mkdir(data,{recursive:true});await appendFile(join(data,'consultas.jsonl'),JSON.stringify(r)+'\n');return r;}
  async function inferir(job){
    if(ejecutar)return ejecutar(job);
    const requirements=await comprobarRequisitos({root,worker});
    if(!requirements.disponible)throw Object.assign(new Error('Faltan requisitos locales: '+requirements.faltantes.join(', ')),{status:503});
    await mkdir(data,{recursive:true});const jobPath=join(data,job.id+'.json');await writeFile(jobPath,JSON.stringify(job),{mode:0o600});active.jobPath=jobPath;
    await new Promise((ok,fail)=>{const child=spawn(requirements.bare,[worker,jobPath],{cwd:root,env:{...process.env,LD_LIBRARY_PATH:process.env.PREFIX?join(process.env.PREFIX,'lib'):process.env.LD_LIBRARY_PATH},stdio:'ignore'});const timeout=setTimeout(()=>{child.kill('SIGKILL');fail(new Error('La consulta superó tres minutos. Reintenta una pregunta más breve.'));},timeoutMs);child.on('error',e=>{clearTimeout(timeout);fail(e)});child.on('exit',code=>{clearTimeout(timeout);code===0?ok():fail(new Error(`El motor QVAC terminó con código ${code}. Reintenta.`))});});
    return JSON.parse(await readFile(jobPath+'.result.json','utf8'));
  }
  return createServer(async(req,res)=>{
    try {
      const host=req.headers.host||'';
      if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))return json(res,{error:'Solo acceso local'},403);
      if(req.headers.origin&&req.headers.origin!==`http://${host}`)return json(res,{error:'Origen no permitido'},403);
      const route=new URL(req.url,`http://${host}`).pathname;
      if(req.method==='GET'&&pwaAssets.has(route)){const [file,type]=pwaAssets.get(route);res.writeHead(200,{'content-type':type,'cache-control':'no-cache'});return res.end(await readFile(file));}
      if(req.method==='GET'&&(route==='/'||route==='/sucursal')){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'self'; style-src 'unsafe-inline'; script-src 'self' 'unsafe-inline'; worker-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});return res.end(await readFile(join(here,'sucursal-local.html')));}
      if(req.method==='GET'&&route==='/api/sucursal/estado'){
        const {disponible,faltantes}=await comprobarRequisitos({root,worker});
        let dispositivo='este nodo';try{const r=await promisify(execFile)('/system/bin/getprop',['ro.product.brand'],{timeout:1000});dispositivo=r.stdout.trim()||dispositivo;}catch{}
        return json(res,{nodo:dispositivo+' · local',dispositivo,disponible,faltantes,motor:'@qvac/llm-llamacpp',modelo:'Qwen3-0.6B Q4',modo:'local',comprobacion:'Archivos legibles y Bare ejecutable; la carga se verifica al consultar.',recuperacion:'por términos, sin embeddings',capacidades:{consulta_texto:disponible,voz:false,foto:false,transacciones:false}});
      }
      if(req.method==='GET'&&route==='/api/sucursal/progreso'){let phase={fase:active?'cargando modelo':'listo'};if(active?.jobPath)try{phase=JSON.parse(await readFile(active.jobPath+'.phase.json','utf8'))}catch{}return json(res,{...phase,id:active?.id,transcurrido_ms:active?Date.now()-active.start:0});}
      if(req.method!=='POST'||route!=='/api/sucursal/consulta')return json(res,{error:'Ruta no disponible'},404);
      if(active)return json(res,{error:'Hay una consulta en curso. Espera su respuesta.'},409);
      if(!String(req.headers['content-type']).startsWith('application/json'))return json(res,{error:'Se requiere JSON'},415);
      let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>2048)return json(res,{error:'Consulta demasiado larga'},413);}
      let parsed;try{parsed=JSON.parse(body)}catch{return json(res,{error:'JSON inválido'},400)}
      const prepared=preparar(guia,parsed.consulta);const id=randomUUID();const inicio=new Date().toISOString();
      if(prepared.abstencion)return json(res,await registrar({id,inicio,consulta:prepared.consulta,abstencion:true,respuesta:'Sin respaldo en la guía local. Remite la consulta al supervisor.',inferencia:false,recuperacion:'por términos; fuera del alcance'}));
      // Recheck after reading the request: another request may have acquired the single slot.
      if(active)return json(res,{error:'Hay una consulta en curso. Espera su respuesta.'},409);
      active={id,start:Date.now()};
      try{const raw=await inferir({...prepared,id});const result=validarSalida(raw,prepared.fragmento);const r={...result,id,inicio,consulta:prepared.consulta,fuente:prepared.fuente,fragmento:prepared.fragmento,fuente_sha256:createHash('sha256').update(prepared.fragmento).digest('hex'),inferencia:true,modo:'local',modelo:'Qwen3-0.6B Q4',motor:'@qvac/llm-llamacpp',recuperacion:'por términos, sin embeddings',total_ms:Date.now()-active.start};return json(res,await registrar(r));}
      finally{active=null;}
    }catch(e){return json(res,{error:e.message},e.status||500)}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) crearServidorLocal().listen(Number(process.env.PUERTO||17321),'127.0.0.1',()=>console.log('Vigía Sucursal local: http://localhost:'+(process.env.PUERTO||17321)+'/sucursal'));
