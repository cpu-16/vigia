import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parsear, reproducir, leer, segundoNivel } from './consumidor.js';
import { generar } from '../../fixtures/red/inyector.js';
import { Ventanas, entropia } from './ventanas.js';
import { Detector, construirListaBlanca, damerau, normalizarHomoglifos } from './deteccion.js';
import { simular, calcular, insertar, escribirClickHouse } from './qoe.js';
import { formatear, emitir } from './wazuh.js';
import { respaldo, validarCaso, cifrasRespaldadas } from './caso.js';
import { consumir } from './agente.js';
const fixture=new URL('../../fixtures/red/benigno.bind.log',import.meta.url);
const muestra=readFileSync(fixture,'utf8').trim().split('\n').map(parsear);
const entrenamiento=muestra.slice(0,4000).filter(Boolean),benignos=muestra.slice(4000).filter(Boolean);
const blanca=await construirListaBlanca(entrenamiento,{n:100,minClientes:5});
const familias=['dga','typosquat','tunnel','beacon'];
const resultados={},deteccionesModelo=[];
const temporal=()=>mkdtempSync(fileURLToPath(new URL('./.prueba-',import.meta.url)));

test('BIND9: línea del patrocinador, tipos, fechas, IPv6 y entradas malformadas',()=>{
  assert.equal(muestra.filter(Boolean).length,14000);
  const e=muestra[0];assert.equal(e.dominio,'windows.msn.com');assert.equal(e.cliente,'190.14.210.226');assert.equal(e.ts,Date.parse('2026-09-09T12:48:52.607Z'));assert.equal(e.sld,'msn.com');
  const l=readFileSync(fixture,'utf8').split('\n')[0];
  for(const s of ['',l.replace('09-Sep','31-Feb'),l.replace('190.14.210.226','999.14.210.226'),l.replace('47767','99999'),l.replace('queries: info','respuestas: info'),l.replace('07:48','27:48')])assert.equal(parsear(s),null);
  assert.equal(parsear(l.replace('190.14.210.226','2001:db8::1').replace(' IN A ',' IN TYPE65 ')).tipo,'TYPE65');
  assert.equal(segundoNivel('www.banco.com.pa'),'banco.com.pa');
});
test('reproducción con intervalos, mezcla, límites y cancelación',async()=>{
  const base=muestra[0],eventos=[{...base,ts:base.ts},{...base,ts:base.ts+10000},{...base,ts:base.ts+20000}],iny=[{...base,ts:base.ts+5000,etiqueta:'beacon'}];
  const salida=[],tiempos=[],inicio=performance.now();
  for await(const e of reproducir(eventos,{velocidad:200,inyectados:iny})) {salida.push(e);tiempos.push(performance.now()-inicio);}
  assert.deepEqual(salida.map(e=>e.ts-base.ts),[0,5000,10000,20000]);assert.ok(tiempos.at(-1)>=90&&tiempos.at(-1)<1200,JSON.stringify(tiempos));
  const pocos=[];for await(const e of reproducir(fixture,{velocidad:1e9,hasta:base.ts+20}))pocos.push(e);assert.ok(pocos.length>1&&pocos.length<100);
  await assert.rejects(async()=>{for await(const e of reproducir(eventos,{velocidad:0}))void e;},/Velocidad/);
  await assert.rejects(async()=>{for await(const e of reproducir(eventos,{signal:AbortSignal.abort()}))void e;});
});
test('ventanas: expiran claves, rasgos e intervalos; capacidad y orden',()=>{
  const v=new Ventanas({ms:1000,maxEventos:3}),e={...muestra[0],ts:0};
  v.agregar(e);const r=v.agregar({...e,ts:500,tipo:'TXT'});assert.equal(r.padre.consultas,2);assert.equal(r.padre.tipos.TXT,1);assert.equal(r.padre.cv,0);assert.equal(r.padre.tasa_qps,2);
  v.agregar({...e,ts:2000,cliente:'192.0.2.99'});assert.equal(v.porCliente.size,1);assert.equal(v.porPadre.size,1);assert.throws(()=>v.agregar(e),/orden/);
  assert.equal(entropia('aaaa'),0);assert.equal(entropia('abcd'),2);
  const pequena=new Ventanas({maxEventos:1});pequena.agregar(e);assert.throws(()=>pequena.agregar(e),/Capacidad/);
});
test('Damerau-Levenshtein completo y homoglifos',()=>{
  for(const [a,b,d]of [['','abc',3],['abc','abc',0],['ab','ba',1],['ca','abc',2],['banco','bnaco',1],['banco','banc',1]]){assert.equal(damerau(a,b),d);assert.equal(damerau(b,a),d);}
  assert.equal(normalizarHomoglifos('bаnco'),'banco');
});
test('lista blanca aprende infraestructura multicliente sin usar inyecciones',async()=>{
  assert.ok(blanca.size>0);const e=muestra[0];
  const b=await construirListaBlanca([...Array.from({length:8},(_,i)=>({...e,cliente:`192.0.2.${i}`})),...generar({familia:'tunnel',n:20})]);
  assert.ok(b.has(e.sld));assert.ok(!b.has('canal-prueba.example'));
  const d=new Detector({listaBlanca:new Set(['canal-prueba.example'])});assert.equal([...generar({familia:'tunnel'})].flatMap(e=>d.procesar(e)).length,0);
});
for(const [indice,familia]of familias.entries())test(`${familia}: precisión, recall y FP sobre 10000 consultas del patrocinador`,async()=>{
  const maliciosos=[...generar({familia,n:120,semilla:20260909+indice,inicio:benignos[0].ts,cliente:`192.0.2.${40+indice}`})];
  assert.deepEqual(maliciosos,[...generar({familia,n:120,semilla:20260909+indice,inicio:benignos[0].ts,cliente:`192.0.2.${40+indice}`})]);
  const detector=new Detector({listaBlanca:blanca});let tp=0,fp=0,fn=0;
  const flujo=[...benignos,...maliciosos].sort((a,b)=>a.ts-b.ts);
  for await(const e of reproducir(flujo,{velocidad:1e12})) {
    const ds=detector.procesar(e).filter(d=>d.familia===familia),positivo=ds.length>0;
    if(e.etiqueta===familia){if(positivo)tp++;else fn++;}else if(positivo)fp++;
    if(ds.length&&e.etiqueta===familia&&deteccionesModelo.filter(d=>d.familia===familia).length<2)deteccionesModelo.push(ds[0]);
  }
  resultados[familia]={tp,fp,fn,benignas:benignos.length,inyectadas:maliciosos.length,precision:tp/(tp+fp||1),recall:tp/(tp+fn),falsos_positivos_por_10000:fp/benignos.length*10000};
  console.log('Métricas',familia,JSON.stringify(resultados[familia]));
  assert.ok(resultados[familia].precision>=(familia==='beacon'?0.5:0.7));assert.ok(resultados[familia].recall>=0.7);
});
test('túnel, DGA y beacon no confunden controles benignos sintéticos',()=>{
  const d=new Detector();
  const eventos=Array.from({length:30},(_,i)=>({...muestra[0],ts:Math.floor(i/2)*41000+(i%2)*1000,cliente:'192.0.2.5',dominio:'portal.normal.example',sld:'normal.example'}));
  assert.equal(eventos.flatMap(e=>d.procesar(e)).length,0);
  const jitter=new Detector();assert.ok([...generar({familia:'beacon',jitter:0.1,n:20})].flatMap(e=>jitter.procesar(e)).some(d=>d.familia==='beacon'));
});
test('zona gris de periodicidad se expone sin producir amenaza',()=>{
  const d=new Detector(),e={...muestra[0],cliente:'192.0.2.89',dominio:'gris.example',sld:'gris.example'};
  let ts=0;
  for(let i=0;i<12;i++){const ds=d.procesar({...e,ts});assert.equal(ds.length,0);ts+=i%2?12000:8000;}
  assert.equal(d.candidatos.length,1);assert.equal(d.candidatos[0].familia,'beacon');
});
test('QoE honesto: penalizaciones independientes y formato ClickHouse',async()=>{
  const eventos=Array.from({length:100},(_,i)=>({...simular({...muestra[0],ts:muestra[0].ts+i}),latency_ms:20,rcode:'NOERROR'}));
  const base=calcular(eventos,{capacidadQps:100}),lento=calcular(eventos.map(e=>({...e,latency_ms:200})),{capacidadQps:100}),nx=calcular(eventos.map(e=>({...e,rcode:'NXDOMAIN'})),{capacidadQps:100}),saturado=calcular(eventos,{capacidadQps:1});
  assert.ok(Math.abs(base.score-lento.score-45)<1e-9);assert.ok(Math.abs(base.score-nx.score-35)<1e-9);assert.ok(saturado.score<base.score);
  assert.deepEqual(base.synthetic_fields,['latency_ms','rcode']);assert.equal(base.score+base.penalizacion_latencia+base.penalizacion_nxdomain+base.penalizacion_saturacion,100);
  assert.match(insertar([base]),/^INSERT INTO red_qoe FORMAT JSONEachRow\n/);
  assert.deepEqual(simular(muestra[0]),simular(muestra[0]));
  await escribirClickHouse([base],{fetchLocal:async(url,opts)=>{assert.equal(url,'http://127.0.0.1:8123/');assert.match(opts.body,/synthetic_fields/);return {ok:true};}});
});
test('Wazuh: JSON por línea, plano, severidad fija y rasgos numéricos',async()=>{
  const dir=temporal();try{const ruta=join(dir,'alertas.jsonl');for(const familia of familias){const d=deteccionesModelo.find(d=>d.familia===familia);const f=await emitir(ruta,d);assert.equal(f.integration,'vigia-red');assert.ok(Object.values(f).every(v=>v===null||typeof v!=='object'));assert.ok(Object.keys(f).some(k=>k.startsWith('evidence_')));assert.equal(formatear(d,{severidad:'baja'}).severity,respaldo(d).severidad);}assert.equal(readFileSync(ruta,'utf8').trim().split('\n').map(JSON.parse).length,4);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('resumen: rechaza cifras inventadas, null y atribuciones cambiadas',()=>{
  const d=deteccionesModelo[0];assert.ok(cifrasRespaldadas(respaldo(d).resumen,d.evidencia));
  for(const resumen of ['999999 consultas','null',null,'Sin evidencia',`entropia: ${d.evidencia.longitud}`])assert.equal(validarCaso({resumen},d).resumen,respaldo(d).resumen);
});
test('flujo → alerta local y filas QoE: latencia medida',async()=>{
  const dir=temporal();try{const filas=[];const r=await consumir(reproducir([...generar({familia:'tunnel',n:30})],{velocidad:1e9}),{archivoAlertas:join(dir,'alertas.jsonl'),guardarQoe:async f=>filas.push(...f)});assert.equal(r.consultas,30);assert.equal(r.alertas,1);assert.ok(filas.length);resultados.latencia_evento_alerta_ms=r.latencias_evento_alerta_ms;writeFileSync(new URL('./metricas.json',import.meta.url),JSON.stringify({fecha:new Date().toISOString(),lista_blanca:[...blanca],resultados},null,2));console.log('Evento → alerta local (ms)',r.latencias_evento_alerta_ms);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('QVAC local real: seis casos con cifras ancladas', {skip:!process.env.PRUEBA_MODELO,timeout:600000},async()=>{
  process.env.RENDIMIENTO??=fileURLToPath(new URL('./rendimiento-modelo.jsonl',import.meta.url));
  const {cargar,descargar}=await import('../core/runtime.js');const {QWEN3_1_7B_INST_Q4}=await import('@qvac/sdk');const {redactar,desempatar}=await import('./caso.js');
  const modelo=await cargar({modelSrc:QWEN3_1_7B_INST_Q4,etiqueta:'Qwen3-1.7B Q4_0',hardware:'red-local',ctx:4096,fallbackSrc:process.env.GGUF_QWEN3_1_7B});
  const salidas=[];
  try{
    assert.equal(modelo.delegado,false);
    const casos=[...familias.map(f=>deteccionesModelo.find(d=>d.familia===f)),deteccionesModelo[1],deteccionesModelo[3]];
    for(const d of casos){const r=await redactar(modelo,d);assert.ok(cifrasRespaldadas(r.resumen,d.evidencia));assert.deepEqual(validarCaso(r,d),respaldo(d));salidas.push({familia:d.familia,evidencia:d.evidencia,...r});console.log('QVAC',d.familia,r.ms,'ms; elección anclada:',r.modelo_verificado);}
    const desempate=await desempatar(modelo,{familia:'beacon',evidencia:{repeticiones:3,cv:0.2}});assert.ok(['amenaza','benigno','insuficiente'].includes(desempate));
    writeFileSync(new URL('./resultado-modelo.json',import.meta.url),JSON.stringify({fecha:new Date().toISOString(),salidas,desempate},null,2));
  }finally{await descargar(modelo);}
});
