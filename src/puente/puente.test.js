// Prueba del puente: que la delegación por llave pública funcione de verdad, que una llave
// falsa no dé inferencia, y que al caer el par el nodo siga respondiendo con el modelo a bordo.
// El proveedor se levanta en OTRO proceso: dos procesos QVAC en la misma máquina necesitan
// carpetas de caché distintas, si comparten el corestore se pelean el bloqueo del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extraerConRespaldo, modelos } from './nodo.js';

const raiz = fileURLToPath(new URL('../../', import.meta.url));
const conf = (nombre, cache) => { const p = `/tmp/qvac-${nombre}-${process.pid}.json`;
  writeFileSync(p, JSON.stringify({ loggerLevel: 'error', loggerConsoleOutput: false, cacheDirectory: cache })); return p; };

test('el respaldo trata la respuesta vacía del par como caída, no como resultado', async () => {
  // Hueco medido del SDK: si el proveedor muere con el modelo ya cargado, la completion
  // delegada vuelve vacía y SIN error, así que `fallbackToLocal` no la cubre. Esta es la guarda.
  const previo = { delegado: modelos.delegado, local: modelos.local };
  modelos.delegado = { modelId: 'x', etiqueta: 'par simulado', hardware: 'par', delegado: true };
  modelos.local = { modelId: 'y', etiqueta: 'Qwen3-0.6B Q4_0 (a bordo)', hardware: 'telefono', delegado: false };
  const vistos = [];
  const extraerFn = async (modelo, texto) => {
    vistos.push(modelo.etiqueta);
    return modelo.delegado
      ? { borrador: { customer: { name: null }, equipment: [] }, descartes: [], crudo: {}, ms: 3, fila: { execution_mode: 'delegated' } }
      : { borrador: { customer: { name: 'Hospital DemoCare Pacific' }, equipment: [{ modality: 'MR', quantity: 2 }] }, descartes: [], crudo: {}, ms: 40, fila: { execution_mode: 'local' } };
  };
  const r = await extraerConRespaldo('Estoy en Hospital DemoCare Pacific. Tienen dos resonadores.', { extraerFn });
  assert.deepEqual(vistos, ['par simulado', 'Qwen3-0.6B Q4_0 (a bordo)'], 'primero el par, luego a bordo');
  assert.equal(r.modo, 'local');
  assert.equal(r.borrador.equipment.length, 1, 'el colaborador igual recibe su extracción');
  assert.equal(modelos.delegado, null, 'el par caído no se reintenta en cada visita');
  Object.assign(modelos, previo);
});

test('un resultado útil del par no activa el respaldo', async () => {
  const previo = { delegado: modelos.delegado, local: modelos.local };
  modelos.delegado = { modelId: 'x', etiqueta: 'par', hardware: 'par', delegado: true };
  modelos.local = { modelId: 'y', etiqueta: 'a bordo', hardware: 'telefono', delegado: false };
  let llamadas = 0;
  const extraerFn = async () => { llamadas++; return { borrador: { customer: { name: 'H' }, equipment: [{ modality: 'CT', quantity: 1 }] }, descartes: [], crudo: {}, ms: 2, fila: {} }; };
  const r = await extraerConRespaldo('texto', { extraerFn });
  assert.equal(llamadas, 1);
  assert.equal(r.modo, 'delegado');
  assert.equal(r.degradado, false);
  Object.assign(modelos, previo);
});

function arrancarProveedor(semilla) {
  return new Promise((ok, err) => {
    const p = spawn(process.execPath, ['src/puente/proveedor.js'], { cwd: raiz, env: { ...process.env,
      SEMILLA_P2P: semilla, QVAC_CONFIG_PATH: conf('prov', '/home/gar16/.qvac'), RENDIMIENTO: '/tmp/rend-prueba-prov.jsonl' } });
    let salida = '';
    const t = setTimeout(() => { p.kill(); err(new Error('el proveedor no arrancó en 180 s')); }, 180_000);
    p.stdout.on('data', d => { salida += d; const m = salida.match(/\b([0-9a-f]{64})\b/);
      if (m) { clearTimeout(t); ok({ llave: m[1], detener: () => p.kill() }); } });
    p.on('error', e => { clearTimeout(t); err(e); });
  });
}

test('delegación P2P real: el par autorizado ejecuta y una llave falsa no',
  { skip: !process.env.PRUEBA_MODELO, timeout: 900_000 }, async t => {
  const prov = await arrancarProveedor('b'.repeat(64));
  process.env.QVAC_CONFIG_PATH = conf('cons', '/home/gar16/.qvac-consumidor');
  process.env.RENDIMIENTO = '/tmp/rend-prueba-cons.jsonl';
  const { cargar, completar } = await import('../core/runtime.js');
  const { QWEN3_1_7B_INST_Q4 } = await import('@qvac/sdk');
  try {
    await t.test('el par autorizado responde y la traza lo dice', async () => {
      const m = await cargar({ modelSrc: QWEN3_1_7B_INST_Q4, etiqueta: 'Qwen3-1.7B Q4_0 (par)', hardware: 'nodo-prueba', proveedor: prov.llave });
      assert.equal(m.delegado, true, 'getLoadedModelInfo debe reportar ejecución en el par');
      const r = await completar(m, { history: [{ role: 'user', content: 'Responde solo: listo /no_think' }], maxTokens: 16 });
      assert.match(r.texto.toLowerCase(), /listo/);
      assert.equal(r.fila.execution_mode, 'delegated');
      assert.ok(r.fila.throughput_tps > 0);
      console.log(`  par: ${Math.round(r.fila.end_to_end_ms)} ms · ${Math.round(r.fila.throughput_tps)} tok/s · backend ${r.fila.backend_actual}`);
    });
    await t.test('una llave inventada no consigue ejecución en el par', async () => {
      const m = await cargar({ modelSrc: QWEN3_1_7B_INST_Q4, etiqueta: 'Qwen3-1.7B (llave falsa)', hardware: 'nodo-prueba', proveedor: 'f'.repeat(64) }).catch(() => null);
      assert.notEqual(m?.delegado, true, 'sin la llave correcta no hay ejecución en el par');
    });
  } finally {
    prov.detener();
    rmSync(`/tmp/qvac-prov-${process.pid}.json`, { force: true });
    rmSync(`/tmp/qvac-cons-${process.pid}.json`, { force: true });
  }
});
