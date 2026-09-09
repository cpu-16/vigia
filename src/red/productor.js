// Productor: reproduce el registro DNS con ritmo temporal y escribe una línea JSON por
// evento a stdout. Proceso aparte del consumidor; se unen por una tubería local.
//   node src/red/productor.js --velocidad 1 | node src/red/demo.js --stdin
// Transporte de demostración (tubería local). En producción va un consumidor Kafka
// suscrito con su propio grupo: el agente lee del bus, no modifica el pipeline.
import { fileURLToPath } from 'node:url';
import { leer, reproducir } from './consumidor.js';
import { generar } from '../../fixtures/red/inyector.js';
export const opcion=(argv,nombre,valor)=>{const i=argv.indexOf(`--${nombre}`);return i<0?valor:Number(argv[i+1]);};
const argv=process.argv.slice(2);
const ruta=argv.find(a=>!a.startsWith('--')&&!/^\d+(\.\d+)?$/.test(a))??fileURLToPath(new URL('../../fixtures/red/benigno.bind.log',import.meta.url));
const velocidad=opcion(argv,'velocidad',1),perfil=opcion(argv,'perfil',4000),max=opcion(argv,'max',Infinity);
const ataques=opcion(argv,'ataques',120),periodoBeacon=opcion(argv,'periodo-beacon',2000),sinAtaques=argv.includes('--sin-ataques');
if(![velocidad,perfil,ataques,periodoBeacon].every(x=>Number.isFinite(x)&&x>=0)||!(max>0))throw new Error('Parámetro numérico inválido');

// stdout de una tubería aplica contrapresión: si el consumidor se atrasa, el productor espera.
const escribir=linea=>process.stdout.write(linea)?Promise.resolve():new Promise(r=>process.stdout.once('drain',r));
process.stdout.on('error',e=>{if(e.code==='EPIPE')process.exit(0);throw e;});

// Fase de perfil: se entrega sin espera para que el consumidor congele su lista blanca
// antes de que empiece la evaluación. Solo la fase de evaluación lleva ritmo temporal.
let n=0,primero;
for await(const e of leer(ruta)) {
  if(n>=perfil){primero=e;break;}
  n++;await escribir(JSON.stringify({...e,fase:'perfil'})+'\n');
}
if(!primero)throw new Error(`El registro no tiene más de ${perfil} consultas válidas`);
async function* evaluacion() {
  let i=0;yield primero;
  for await(const e of leer(ruta))if(i++>=perfil+1)yield e;
}
// Beacon con menos repeticiones y periodo corto para que sus 30 pulsos quepan en el
// tramo reproducido; las métricas de NOTAS.md usan otro banco (120 por familia, 10 s).
const plan=[['dga',ataques,{}],['typosquat',ataques,{}],['tunnel',ataques,{}],['beacon',Math.min(ataques,30),{periodo:periodoBeacon}]];
const inyectados=sinAtaques?[]:plan.flatMap(([familia,cantidad,extra],i)=>[...generar({familia,n:cantidad,semilla:20260909+i,inicio:primero.ts,cliente:`192.0.2.${40+i}`,...extra})]).sort((a,b)=>a.ts-b.ts);
process.stderr.write(`productor · ${ruta}\n  perfil ${perfil} consultas sin espera · evaluación a ritmo temporal ÷ ${velocidad}`+
  `\n  inyectados ${inyectados.length} eventos etiquetados (${plan.map(([f,c],i)=>`${f} ${i===3?Math.min(c,30):c}`).join(', ')})\n`);
let emitidos=0;
for await(const e of reproducir(evaluacion(),{velocidad,inyectados})) {
  await escribir(JSON.stringify({...e,fase:'evaluacion'})+'\n');
  if(++emitidos>=max)break;
}
process.stderr.write(`productor · fin: ${n} de perfil + ${emitidos} de evaluación\n`);
