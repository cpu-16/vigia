// Lo que estas pruebas defienden: (1) el consumidor emite alertas ANTES de que el
// productor termine —eso es lo que separa un flujo de un archivo estático—, y (2) el
// transporte por la API local del SIEM habla bien y no puede apuntar fuera de la máquina.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { enviarApi, autenticar, LOTE_MAXIMO } from './wazuh.js';

const aqui=f=>fileURLToPath(new URL(f,import.meta.url));
const deteccion=(familia,i=0)=>({familia,cliente:`192.0.2.${40+i}`,dominio:`prueba${i}.example`,score:0.85,evidencia:{longitud:12},ventana:{desde:0,hasta:1757000000000}});

test('tubería local: el consumidor alerta mientras el productor sigue produciendo',async()=>{
  const dir=mkdtempSync(aqui('./.stream-')),alertas=join(dir,'alertas.jsonl');
  const entorno={...process.env,SALIDA:dir};
  // Sin API: esta prueba mide el flujo, no el transporte, y nunca debe tocar la red.
  for(const v of ['WAZUH_API_URL','WAZUH_API_USER','WAZUH_API_PASS','MODELO','CLICKHOUSE_LOCAL'])delete entorno[v];
  const productor=spawn(process.execPath,[aqui('./productor.js'),'--perfil','400','--ataques','10','--velocidad','15'],{stdio:['ignore','pipe','ignore']});
  const consumidor=spawn(process.execPath,[aqui('./demo.js'),'--stdin'],{stdio:[productor.stdout,'ignore','pipe'],env:entorno});
  let errores='';consumidor.stderr.on('data',d=>{errores+=d;});
  try {
    let vivoAlAlertar=null,lineas=0;
    for(let i=0;i<400&&vivoAlAlertar===null;i++) {           // hasta 20 s
      if(existsSync(alertas)) {
        lineas=readFileSync(alertas,'utf8').trim().split('\n').filter(Boolean).length;
        if(lineas>0)vivoAlAlertar=productor.exitCode===null&&productor.signalCode===null;
      }
      if(vivoAlAlertar===null)await esperar(50);
    }
    assert.equal(vivoAlAlertar,true,`El productor ya había terminado en la primera alerta. stderr: ${errores}`);
    const salida=await new Promise(r=>consumidor.on('exit',r));
    assert.equal(salida,0,errores);
    const filas=readFileSync(alertas,'utf8').trim().split('\n').map(l=>JSON.parse(l));
    assert.ok(filas.length>lineas,`Deberían llegar más alertas después de la primera: ${lineas} → ${filas.length}`);
    assert.ok(filas.every(f=>f.integration==='vigia-red'&&typeof f.domain==='string'&&Number.isFinite(f.score)));
  } finally {productor.kill();consumidor.kill();rmSync(dir,{recursive:true,force:true});}
});

test('API local: autentica, agrupa en lotes, renueva el token vencido y no sale de loopback',async()=>{
  const llamadas=[];let vencido=true;
  const http=async(url,opciones={})=>{
    const u=new URL(url);
    if(!['127.0.0.1','::1','localhost'].includes(u.hostname))throw new Error(`Destino no local: ${u.protocol}//${u.host}`);
    llamadas.push({ruta:u.pathname,cuerpo:opciones.cuerpo});
    if(u.pathname==='/security/user/authenticate'){vencido=false;return {estado:200,texto:'jwt-nuevo'};}
    if(vencido)return {estado:401,texto:'{"title":"Unauthorized"}'};
    const n=JSON.parse(opciones.cuerpo).events.length;
    return {estado:200,texto:JSON.stringify({data:{total_affected_items:n,total_failed_items:0}})};
  };
  const opciones={url:'https://127.0.0.1:55000',usuario:'wazuh-wui',clave:'x',http};
  const r=await enviarApi([deteccion('dga',0),deteccion('tunnel',1)],opciones);
  assert.deepEqual({enviados:r.enviados,fallidos:r.fallidos,token:r.token},{enviados:2,fallidos:0,token:'jwt-nuevo'});
  assert.deepEqual(llamadas.map(c=>c.ruta),['/security/user/authenticate','/events']);
  assert.deepEqual(JSON.parse(JSON.parse(llamadas[1].cuerpo).events[0]).family,'dga');

  vencido=true;                                              // el JWT dura 900 s: al vencer se renueva y se reintenta
  const r2=await enviarApi([deteccion('beacon',2)],{...opciones,token:'jwt-viejo'});
  assert.equal(r2.enviados,1);
  assert.deepEqual(llamadas.slice(2).map(c=>c.ruta),['/events','/security/user/authenticate','/events']);

  const muchas=Array.from({length:LOTE_MAXIMO+5},(_,i)=>deteccion('dga',i%200));
  const r3=await enviarApi(muchas,{...opciones,token:'jwt-nuevo'});
  assert.equal(r3.enviados,LOTE_MAXIMO+5);
  assert.deepEqual(llamadas.slice(-2).map(c=>JSON.parse(c.cuerpo).events.length),[LOTE_MAXIMO,5]);

  await assert.rejects(()=>enviarApi([deteccion('dga')],{url:'https://siem.ovnicom.example:55000',usuario:'a',clave:'b'}),/Destino no local/);
  await assert.rejects(()=>enviarApi([deteccion('dga')],{url:'http://127.0.0.1:55000',usuario:'a',clave:'b'}),/Destino no local/);
  await assert.rejects(()=>enviarApi([deteccion('dga')],{url:'https://127.0.0.1:55000',usuario:'a'}),/Faltan url, usuario o clave/);
  await assert.rejects(()=>autenticar({url:'https://127.0.0.1:55000',usuario:'a',clave:'b',http:async()=>({estado:403,texto:''})}),/HTTP 403/);
});
