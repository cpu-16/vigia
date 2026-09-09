// Prueba del puente: que la delegación por llave pública funcione de verdad, que una llave
// falsa no dé inferencia, y que al caer el par el nodo siga respondiendo con el modelo a bordo.
// El proveedor se levanta en OTRO proceso: dos procesos QVAC en la misma máquina necesitan
// carpetas de caché distintas, si comparten el corestore se pelean el bloqueo del archivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extraerConRespaldo, modelos, crearServidor } from './nodo.js';
import { verificar } from '../core/sello.js';
import { SinRespaldo } from './respaldo.js';

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
  // `fila` con ttft: una extracción que de verdad salió del par siempre midió su primer token.
  const extraerFn = async () => { llamadas++; return { borrador: { customer: { name: 'H' }, equipment: [{ modality: 'CT', quantity: 1 }] },
    descartes: [], crudo: {}, ms: 2, fila: { execution_mode: 'delegated', ttft_ms: 120, output_tokens: 90 } }; };
  const r = await extraerConRespaldo('texto', { extraerFn });
  assert.equal(llamadas, 1);
  assert.equal(r.modo, 'delegado');
  assert.equal(r.degradado, false);
  Object.assign(modelos, previo);
});

test('sin modelo a bordo, el nodo sigue solo delegado y lo dice en vez de morir', async () => {
  // El HONOR X6s de hoy no carga ningún modelo local (worker de Bare, SIGSEGV). Ese teléfono
  // todavía sirve como consumidor del par, así que el nodo arranca igual con modelos.local = null.
  const previo = { delegado: modelos.delegado, local: modelos.local };
  modelos.delegado = { modelId: 'x', etiqueta: 'par', hardware: 'par', delegado: true };
  modelos.local = null;
  const extraerFn = async modelo => modelo.delegado
    ? { borrador: { customer: { name: null }, equipment: [] }, descartes: [], crudo: {}, ms: 3, fila: {} }
    : assert.fail('no hay modelo a bordo que llamar');
  const e = await extraerConRespaldo('texto', { extraerFn }).then(() => null, err => err);
  assert.ok(e instanceof SinRespaldo, 'debe avisar, no reventar con un TypeError');
  assert.equal(e.aviso, 'Sin par a la vista y sin modelo a bordo: la captura queda pendiente');
  assert.equal(modelos.delegado, null, 'el par igual se da por caído');
  Object.assign(modelos, previo);
});

// El teléfono también GUARDA: sin esta ruta la PWA servida desde el propio teléfono se queda
// trabada en «Guardando…» con un 404. El acta la firma la llave del teléfono y tiene que
// verificarse en cualquier otro lado, que es lo que hace «Verificar esta acta».
// tmpdir(): en Android no existe /tmp.
test('el nodo del teléfono guarda la observación y devuelve un acta que verifica en otro equipo', async () => {
  const sufijo = `${process.pid}-${Date.now()}`;
  process.env.OBSERVACIONES = join(tmpdir(), `vigia-obs-${sufijo}.jsonl`);
  process.env.LLAVE_NODO = join(tmpdir(), `vigia-llave-${sufijo}.pem`);
  const srv = crearServidor();
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const pedir = (ruta, cuerpo) => fetch(base + ruta, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });
  try {
    const borrador = { customer: { name: 'Hospital DemoCare Pacific', country: 'Panama', city: 'Panamá' },
      equipment: [{ modality: 'MR', quantity: 2, age_years_min: 7, age_years_max: 8 }, { modality: 'CT', quantity: 1 }] };
    const res = await pedir('/api/guardar', { borrador, observador: 'Gilberto', fuente: 'voz', requestId: 'V-TEL1' });
    assert.equal(res.status, 200, 'la ruta existe en el teléfono, no 404');
    const r = await res.json();
    assert.equal(r.eventos, 2, 'una observación por grupo de equipo');
    assert.equal(r.acta.sello.firmante, 'Gilberto');
    assert.deepEqual(verificar(r.acta), { valido: true, publica: r.acta.sello.publica, firmante: 'Gilberto' });

    // El acta cubre lo guardado: si alguien le cambia una cifra, deja de verificar.
    const alterada = structuredClone(r.acta);
    alterada.equipos[0].quantity = 9;
    assert.equal(verificar(alterada).valido, false);

    // Y las guardas son las mismas del servidor.
    assert.equal((await pedir('/api/guardar', { borrador: { customer: {}, equipment: [] } })).status, 400);
  } finally {
    srv.close();
    rmSync(process.env.OBSERVACIONES, { force: true });
    rmSync(process.env.LLAVE_NODO, { force: true });
    delete process.env.OBSERVACIONES; delete process.env.LLAVE_NODO;
  }
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
