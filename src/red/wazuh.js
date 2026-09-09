import { appendFile } from 'node:fs/promises';
import { request } from 'node:https';
import { respaldo } from './caso.js';
export function formatear(d,caso=respaldo(d)) {
  if(!['dga','typosquat','tunnel','beacon'].includes(d.familia)||!Number.isFinite(d.score))throw new Error('Detección inválida');
  const severity=respaldo(d).severidad;
  const fila={integration:'vigia-red',timestamp:new Date(d.ventana.hasta).toISOString(),threat:true,family:d.familia,client_ip:d.cliente,domain:d.dominio,score:d.score,severity,rule_hint:`vigia_${d.familia}_${severity}`};
  for(const [k,v]of Object.entries(d.evidencia)) {if(!/^[a-z_]+$/.test(k)||!Number.isFinite(v))throw new Error('Rasgo inválido');fila[`evidence_${k}`]=v;}
  return fila;
}
export async function emitir(ruta,d,caso) {const fila=formatear(d,caso);await appendFile(ruta,JSON.stringify(fila)+'\n',{encoding:'utf8',mode:0o640});return fila;}

// ── Transporte por la API local del manager (POST /events, Wazuh 4.8+) ─────────────
// El reto pide «envío de la alerta a Wazuh por webhook o API local». El manager las
// deja en alerts.json con location "API-Webhook"; las mismas reglas 1001xx disparan.
// Verificado contra Wazuh 4.14.0 el 9-sep-2026: ver infra/red/VERIFICADO-WAZUH.md.
export const LOTE_MAXIMO=100; // 101 devuelve 400 «Events bulk size exceeded» en 4.14.0.
const LOOPBACK=new Set(['127.0.0.1','::1','localhost']);
// Destino fijo a loopback, igual que el escritor de ClickHouse: ni con una variable de
// entorno mal puesta el agente puede mandar telemetría a un SIEM fuera de esta máquina.
// El certificado del manager es autofirmado y no se valida; lo que se garantiza aquí es
// el destino, no la identidad del par (en loopback no hay intermediario que suplantar).
export function pedirLocal(url,{metodo='GET',cabeceras={},cuerpo,timeoutMs=15000}={}) {
  const u=new URL(url);
  if(u.protocol!=='https:'||!LOOPBACK.has(u.hostname))throw new Error(`Destino no local: ${u.protocol}//${u.host}`);
  return new Promise((cumplir,fallar)=>{
    const req=request(u,{method:metodo,headers:cabeceras,rejectUnauthorized:false,timeout:timeoutMs},res=>{
      let texto='';res.setEncoding('utf8');res.on('data',t=>{texto+=t;});res.on('end',()=>cumplir({estado:res.statusCode,texto}));
    });
    req.on('timeout',()=>req.destroy(new Error('Tiempo agotado contra la API local')));
    req.on('error',fallar);
    if(cuerpo!==undefined)req.write(cuerpo);
    req.end();
  });
}
export async function autenticar({url,usuario,clave,http=pedirLocal}) {
  const r=await http(new URL('/security/user/authenticate?raw=true',url),{metodo:'POST',cabeceras:{Authorization:'Basic '+Buffer.from(`${usuario}:${clave}`).toString('base64')}});
  if(r.estado!==200||!r.texto.trim())throw new Error(`Autenticación de la API local: HTTP ${r.estado}`);
  return r.texto.trim(); // JWT con 900 s de vida; se renueva al primer 401.
}
// Devuelve el token para que quien llame lo reutilice: sin estado escondido en el módulo.
export async function enviarApi(alertas,{url,usuario,clave,token,http=pedirLocal,lote=LOTE_MAXIMO}={}) {
  if(!url||!usuario||!clave)throw new Error('Faltan url, usuario o clave de la API local');
  if(!(lote>=1&&lote<=LOTE_MAXIMO))throw new Error(`Lote fuera de rango (1..${LOTE_MAXIMO})`);
  const filas=alertas.map(a=>a.integration==='vigia-red'?a:formatear(a));
  let enviados=0,fallidos=0;
  for(let i=0;i<filas.length;i+=lote) {
    const cuerpo=JSON.stringify({events:filas.slice(i,i+lote).map(f=>JSON.stringify(f))});
    let r=await enviar(cuerpo);
    if(r.estado===401) {token=await autenticar({url,usuario,clave,http});r=await enviar(cuerpo);} // token vencido
    if(r.estado!==200)throw new Error(`API local respondió ${r.estado}: ${r.texto.slice(0,200)}`);
    const d=JSON.parse(r.texto).data??{};
    enviados+=d.total_affected_items??0;fallidos+=d.total_failed_items??0;
  }
  return {enviados,fallidos,token,filas};
  async function enviar(cuerpo) {
    token??=await autenticar({url,usuario,clave,http});
    return http(new URL('/events',url),{metodo:'POST',cabeceras:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(cuerpo)},cuerpo});
  }
}
// Las tres variables juntas o nada: media configuración apunta al SIEM equivocado.
export const apiDesdeEntorno=(env=process.env)=>env.WAZUH_API_URL&&env.WAZUH_API_USER&&env.WAZUH_API_PASS?{url:env.WAZUH_API_URL,usuario:env.WAZUH_API_USER,clave:env.WAZUH_API_PASS}:null;
