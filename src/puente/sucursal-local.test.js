import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,mkdir,writeFile,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cargarGuia} from '../sucursal/guia.js';
import {preparar,validarSalida,crearServidorLocal,comprobarRequisitos} from './sucursal-local.js';
const guia=cargarGuia();
test('recupera sección íntegra con condiciones y no inventa códigos',()=>{const r=preparar(guia,'En RET-ISL-01, ¿cuál es el tope diario por cliente?');assert.match(r.fragmento,/B\/\. 100\.00/);assert.match(r.fragmento,/Si no se puede comprobar el acumulado diario entre sucursales, no autorizar/);assert.equal(preparar(guia,'En XYZ-ABC-99, ¿cuál es el tope?').abstencion,true)});
test('exclusiones de alcance se abstienen antes de llamar QVAC',()=>{for(const q of ['¿Cuál es la tasa de interés de ahorro?','¿Cómo recupero mi PIN?','¿Ofrecen préstamos hipotecarios?'])assert.equal(preparar(guia,q).abstencion,true)});
test('rechaza evidencia inválida y marca cifras no respaldadas',()=>{assert.throws(()=>validarSalida({respuesta:'hola',inferencia_ms:2,stats:{backendDevice:'gpu'}},'hola'));const r=validarSalida({respuesta:'B/. 500',inferencia_ms:10,stats:{backendDevice:'cpu'}},'Tope B/. 100.00');assert.equal(r.abstencion,true)});
test('cifras completas: diez no es cien; decimales equivalentes sí coinciden',()=>{
  const check=respuesta=>validarSalida({respuesta,inferencia_ms:2,stats:{backendDevice:'cpu',stopReason:'eos',contextSlides:0}},'El tope es B/. 100.00 por cliente.');
  assert.equal(check('El tope es B/. 10.').abstencion,true);
  assert.equal(check('El tope es 10balboas.').abstencion,true);
  assert.equal(check('El tope es B/. 1000.').abstencion,true);
  assert.equal(check('El tope es B/. -100.').abstencion,true);
  assert.equal(check('El tope es B/. 100.').abstencion,false);
  assert.equal(check('El tope es B/. 100,00.').abstencion,false);
});
test('no presenta truncamiento o contexto desplazado como respuesta respaldada',()=>{
  for(const stats of [{stopReason:'predictionLimit',contextSlides:0},{stopReason:'eos',contextSlides:1}]){
    const r=validarSalida({respuesta:'La cédula ficticia',inferencia_ms:2,stats:{backendDevice:'cpu',...stats}},'La cédula ficticia vigente.');
    assert.equal(r.abstencion,true);assert.match(r.motivo,/límite|contexto/);
  }
  const ok=validarSalida({respuesta:'La cédula ficticia vigente.',inferencia_ms:2,stats:{backendDevice:'cpu',stopReason:'eos',contextSlides:0}},'La cédula ficticia vigente.');assert.equal(ok.abstencion,false);
});
test('requisitos reales: archivos vacíos y Bare no ejecutable no son instalación lista',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vigia-prereq-')),worker=join(root,'worker.cjs');
  const absent=await comprobarRequisitos({root,worker,path:root});assert.equal(absent.disponible,false);assert.equal(absent.faltantes.length,4);
  await mkdir(join(root,'node_modules/@qvac/llm-llamacpp'),{recursive:true});
  for(const [path,body] of [[worker,'// worker'],[join(root,'qwen3-0.6b-q4.gguf'),'GGUF test fixture'],[join(root,'node_modules/@qvac/llm-llamacpp/package.json'),'{}'],[join(root,'bare'),'#!/bin/sh\nexit 0']])await writeFile(path,body,{mode:0o600});
  assert.deepEqual((await comprobarRequisitos({root,worker,path:root})).faltantes,['runtime Bare ejecutable']);
  await chmod(join(root,'bare'),0o700);assert.equal((await comprobarRequisitos({root,worker,path:root})).disponible,true);
  await writeFile(join(root,'qwen3-0.6b-q4.gguf'),'');assert.equal((await comprobarRequisitos({root,worker,path:root})).disponible,false);
});
test('endpoint estado no anuncia modelo instalado si faltan requisitos',async t=>{
  const root=await mkdtemp(join(tmpdir(),'vigia-estado-'));const server=crearServidorLocal({root});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());
  const r=await(await fetch('http://127.0.0.1:'+server.address().port+'/api/sucursal/estado')).json();assert.equal(r.disponible,false);assert.equal(r.capacidades.consulta_texto,false);assert.ok(r.faltantes.includes('modelo Qwen3 local'));
});
test('HTTP serializa el modelo y persiste abstención sin invocarlo',async t=>{const data=await mkdtemp(join(tmpdir(),'vigia-local-test-'));let calls=0,release;const gate=new Promise(r=>release=r);const server=crearServidorLocal({data,ejecutar:async()=>{calls++;await gate;return {respuesta:'El tope es B/. 100.00 por cliente y día.',inferencia_ms:20,carga_ms:3,stats:{backendDevice:'cpu'}}}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;const post=q=>fetch(base+'/api/sucursal/consulta',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({consulta:q})});const abst=await(await post('¿Cuál es la tasa de interés?')).json();assert.equal(abst.inferencia,false);assert.equal(calls,0);const pending=post('RET-ISL-01 ¿cuál es el tope diario?');while(!calls)await new Promise(r=>setTimeout(r,5));assert.equal((await post('RET-ISL-01 ¿cuál es el tope diario?')).status,409);release();assert.equal((await(await pending).json()).inferencia,true);assert.equal((await readFile(join(data,'consultas.jsonl'),'utf8')).trim().split('\n').length,2);const forbidden=await fetch(base+'/api/sucursal/estado',{headers:{Origin:'http://evil.example'}});assert.equal(forbidden.status,403)});
