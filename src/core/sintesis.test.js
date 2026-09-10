import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearSintesis } from './sintesis.js';
import { crearWav } from './wav.js';

test('WAV conserva PCM y frecuencia; rechaza valores inválidos', () => {
 const w=crearWav([0,1000,-1000,32767,-32768]);
 assert.equal(w.toString('ascii',0,4),'RIFF');assert.equal(w.readUInt32LE(24),44100);
 assert.equal(w.readUInt32LE(40),10);assert.equal(w.readInt16LE(48),-1000);
 assert.throws(()=>crearWav([]));assert.throws(()=>crearWav([NaN]));
});
test('lectura: una generación por vez, cache limitada y carga recuperable', async () => {
 let cargas=0,generaciones=0,terminar; const eventos=[];
 const s=crearSintesis({cargar:async()=>{if(++cargas===1)throw new Error('fallo de carga');return 'modelo';},descargar:async()=>{},medir:x=>eventos.push(x),generar:()=>{generaciones++;return {buffer:new Promise(r=>terminar=r)};}});
 await assert.rejects(s.hablar('Hola'),/fallo de carga/);assert.equal(s.estado().ocupado,false);
 const primero=s.hablar('Hola');await new Promise(r=>setImmediate(r));
 await assert.rejects(s.hablar('Otra lectura'),e=>e.status===429);terminar([0,100,-100]);
 const a=await primero;assert.equal(a.cache,false);assert.equal((await s.hablar('Hola')).cache,true);assert.equal(generaciones,1);
 assert.equal(eventos[0].execution_mode,'local');assert.equal(eventos[0].tarea,'tts');
 await assert.rejects(s.hablar('x'.repeat(501)),e=>e.status===400);
 await s.cerrar();assert.equal(s.estado().cargado,false);
});

test('lectura de balboas conserva montos y centavos, sin confundir separadores', async () => {
 const {prepararLectura}=await import('../../app/texto-voz.js');
 assert.equal(prepararLectura('No autoriza B/. 80.00.'),'No autoriza 80 balboas.');
 assert.equal(prepararLectura('B/. 1,000.50'),'1000 balboas con 50 centésimos');
 assert.equal(prepararLectura('B/. 1.01'),'1 balboa con 1 centésimo');
 assert.equal(prepararLectura('B/. 80.001'),'B/. 80.001');
});
