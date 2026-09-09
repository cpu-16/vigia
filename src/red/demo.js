// Demostración ejecutable: reproducción temporal → reglas → Wazuh + QoE.
//   node src/red/demo.js                                    (reproduce el archivo en el mismo proceso)
//   node src/red/productor.js | node src/red/demo.js --stdin (dos procesos, tubería local)
import { mkdir, appendFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { leer, reproducir } from './consumidor.js';
import { construirListaBlanca } from './deteccion.js';
import { generar } from '../../fixtures/red/inyector.js';
import { consumir } from './agente.js';
import { apiDesdeEntorno } from './wazuh.js';
import { crearTabla, insertar, escribirClickHouse } from './qoe.js';
const desdeTuberia=process.argv.includes('--stdin');
const ruta=process.argv.slice(2).find(a=>!a.startsWith('--'))??fileURLToPath(new URL('../../fixtures/red/benigno.bind.log',import.meta.url));
const directorio=process.env.SALIDA?pathToFileURL(process.env.SALIDA+'/'):new URL('../../infra/red/salida/',import.meta.url);
await mkdir(directorio,{recursive:true});
const api=apiDesdeEntorno(),clickhouse=process.env.CLICKHOUSE_LOCAL==='1';

let listaBlanca,fuente;
if(desdeTuberia) {
  // El productor marca la fase: `perfil` alimenta la lista blanca, que se congela antes
  // de que llegue el primer evento de `evaluacion`. Misma disciplina que el modo archivo.
  const it=(async function*(){for await(const l of createInterface({input:process.stdin,crlfDelay:Infinity}))if(l.trim())yield JSON.parse(l);})()[Symbol.asyncIterator]();
  let pendiente=null;
  listaBlanca=await construirListaBlanca((async function*(){
    while(true){const r=await it.next();if(r.done)return;if(r.value.fase!=='perfil'){pendiente=r.value;return;}yield r.value;}
  })(),{maxEventos:Infinity});
  fuente=(async function*(){if(pendiente){yield pendiente;pendiente=null;}while(true){const r=await it.next();if(r.done)break;yield r.value;}})();
} else {
  listaBlanca=await construirListaBlanca(leer(ruta),{maxEventos:4000});
  // El replay reserva las primeras 4000 consultas para perfilar, igual que las pruebas.
  const it=(async function*(){let n=0;for await(const e of leer(ruta))if(n++>=4000)yield e;})()[Symbol.asyncIterator]();
  const primero=await it.next();
  if(primero.done)throw new Error('Se requieren más de 4000 consultas válidas');
  const inyectados=['dga','typosquat','tunnel','beacon'].flatMap((familia,i)=>[...generar({familia,n:120,semilla:20260909+i,inicio:primero.value.ts,cliente:`192.0.2.${40+i}`})]).sort((a,b)=>a.ts-b.ts);
  fuente=reproducir((async function*(){yield primero.value;try{while(true){const r=await it.next();if(r.done)break;yield r.value;}}finally{await it.return?.();}})(),{velocidad:Number(process.env.VELOCIDAD??6000),inyectados});
}

let modelo;
if(process.env.MODELO==='1') {
  const {cargar}=await import('../core/runtime.js');const {QWEN3_1_7B_INST_Q4}=await import('@qvac/sdk');
  modelo=await cargar({modelSrc:QWEN3_1_7B_INST_Q4,etiqueta:'Qwen3-1.7B Q4_0',hardware:'red-local',device:process.env.CPU==='1'?'cpu':'gpu',ctx:4096,fallbackSrc:process.env.GGUF_QWEN3_1_7B});
}
if(clickhouse){const r=await fetch('http://127.0.0.1:8123/',{method:'POST',body:crearTabla,signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`No se pudo crear tabla local: ${r.status}`);}
else await appendFile(new URL('qoe.sql',directorio),crearTabla+';\n');

const destino=[api?`API local ${new URL(api.url).host}`:null,'JSONL local'].filter(Boolean).join(' + ');
const nota=desdeTuberia?'Replay temporal · transporte de demo (tubería local); en producción, consumidor Kafka.'
  :'Replay temporal en el mismo proceso; para verlo como flujo usar productor.js | demo.js --stdin.';
console.log(`\nVigía · Red (Ovnicom) — consumidor adicional del stream DNS`);
console.log(nota);
console.log(`Lista blanca congelada: ${listaBlanca.size} SLD · Alertas → ${destino} · QoE → ${clickhouse?'ClickHouse local':'archivo SQL local'}`+
  `${modelo?` · Explicación → QVAC ${modelo.delegado?'delegado':'local'}`:''}\n`);
const reloj=()=>new Date().toLocaleTimeString('es-PA',{hour12:false});
const corto={dga:'dga',typosquat:'typo',tunnel:'túnel',beacon:'beacon'};
let ultimoMs=performance.now(),ultimoConteo=0;
const pintar=(s,forzado)=>{
  const ahora=performance.now();
  if(!forzado&&ahora-ultimoMs<1000)return;
  const tasa=Math.round((s.consultas-ultimoConteo)/((ahora-ultimoMs)/1000));
  ultimoMs=ahora;ultimoConteo=s.consultas;
  const familias=Object.entries(s.por_familia).map(([f,n])=>`${corto[f]} ${n}`).join(' ');
  const envio=api?`→ API ${s.enviadas_api}${s.fallidas_api?` (${s.fallidas_api} fallidas)`:''} + JSONL ${s.alertas}`:`→ JSONL ${s.alertas}`;
  const caso=s.ultimo_caso?` · QVAC ${s.ultimo_caso.familia}: ${s.ultimo_caso.verificado?'explicación verificada':'respaldo determinista'}`:'';
  console.log(`${reloj()} · ${String(s.consultas).padStart(6)} eventos · ${String(tasa).padStart(5)} c/s · ${familias} · ${envio}${caso}`);
};
const resultado=await consumir(fuente,{
  listaBlanca,modelo,archivoAlertas:new URL('alertas.jsonl',directorio),archivoCasos:new URL('casos.jsonl',directorio),
  alProgresar:pintar,
  // 60 s es la ventana de operación; la demo usa 5 s porque el registro entregado dura 65 s
  // y con un minuto sale un solo punto por zona. La tasa por segundo no cambia.
  ventanaQoeMs:Number(process.env.VENTANA_QOE_MS??60000),
  guardarQoe:async filas=>{
    await appendFile(new URL('qoe.jsonl',directorio),filas.map(f=>JSON.stringify(f)).join('\n')+'\n');
    if(clickhouse)await escribirClickHouse(filas);else await appendFile(new URL('qoe.sql',directorio),insertar(filas)+'\n');
  }
});
pintar({consultas:resultado.consultas,alertas:resultado.alertas,por_familia:resultado.por_familia,enviadas_api:resultado.api?.enviadas??0,fallidas_api:resultado.api?.fallidas??0,ultimo_caso:null},true);
if(modelo)await (await import('../core/runtime.js')).descargar(modelo);
const mediana=xs=>xs.length?[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)]:null;
console.log('\n'+JSON.stringify({...resultado,
  latencias_evento_alerta_ms:{n:resultado.latencias_evento_alerta_ms.length,mediana:mediana(resultado.latencias_evento_alerta_ms)},
  api:resultado.api&&{...resultado.api,latencias_evento_api_ms:{n:resultado.api.latencias_evento_api_ms.length,mediana:mediana(resultado.api.latencias_evento_api_ms)}},
  destino_qoe:clickhouse?'ClickHouse local':'Archivo SQL local; pendiente de insertar'},null,2));
