// Demostración ejecutable: reproducción temporal → reglas → archivo Wazuh + QoE.
import { mkdir, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { leer, reproducir } from './consumidor.js';
import { construirListaBlanca } from './deteccion.js';
import { generar } from '../../fixtures/red/inyector.js';
import { consumir } from './agente.js';
import { crearTabla, insertar, escribirClickHouse } from './qoe.js';
const ruta=process.argv[2]??fileURLToPath(new URL('../../fixtures/red/benigno.bind.log',import.meta.url));
const directorio=new URL('../../infra/red/salida/',import.meta.url);
await mkdir(directorio,{recursive:true});
const listaBlanca=await construirListaBlanca(leer(ruta),{maxEventos:4000});
// El replay reserva las primeras 4000 consultas para perfilar, igual que las pruebas.
async function* evaluacion(){let n=0;for await(const e of leer(ruta))if(n++>=4000)yield e;}
const it=evaluacion()[Symbol.asyncIterator](),primero=await it.next();
if(primero.done)throw new Error('Se requieren más de 4000 consultas válidas');
async function* fuente(){yield primero.value;try{while(true){const r=await it.next();if(r.done)break;yield r.value;}}finally{await it.return?.();}}
const inyectados=['dga','typosquat','tunnel','beacon'].flatMap((familia,i)=>[...generar({familia,n:120,semilla:20260909+i,inicio:primero.value.ts,cliente:`192.0.2.${40+i}`})]).sort((a,b)=>a.ts-b.ts);
const clickhouse=process.env.CLICKHOUSE_LOCAL==='1';
if(clickhouse){const r=await fetch('http://127.0.0.1:8123/',{method:'POST',body:crearTabla,signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`No se pudo crear tabla local: ${r.status}`);}
else await appendFile(new URL('qoe.sql',directorio),crearTabla+';\n');
const resultado=await consumir(reproducir(fuente(),{velocidad:Number(process.env.VELOCIDAD??6000),inyectados}),{
  listaBlanca,archivoAlertas:new URL('alertas.jsonl',directorio),
  guardarQoe:async filas=>{
    await appendFile(new URL('qoe.jsonl',directorio),filas.map(f=>JSON.stringify(f)).join('\n')+'\n');
    if(clickhouse)await escribirClickHouse(filas);else await appendFile(new URL('qoe.sql',directorio),insertar(filas)+'\n');
  }
});
console.log(JSON.stringify({...resultado,destino_qoe:clickhouse?'ClickHouse local':'Archivo SQL local; pendiente de insertar'},null,2));
