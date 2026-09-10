import test from 'node:test';
import assert from 'node:assert/strict';
import { crearEjecutor } from './respaldo.js';

test('la caída del par en dos consultas recarga una vez y ambas responden local', async () => {
  let modelo = { delegado: true, etiqueta: 'par' }, cargas = 0;
  const ejecutar = crearEjecutor({ obtenerModelo: () => modelo, cargarLocal: async () => {
    cargas++; await new Promise(r => setTimeout(r, 10)); modelo = { delegado: false, etiqueta: 'local' }; return modelo;
  } });
  const operacion = async m => { if (m.delegado) throw Object.assign(new Error('sin respuesta'), { code: 'QVAC_SIN_RESPUESTA' }); return { cubierto: true }; };
  const rs = await Promise.all([ejecutar(operacion), ejecutar(operacion)]);
  assert.equal(cargas, 1);
  for (const r of rs) { assert.equal(r.modo, 'local'); assert.equal(r.degradado, true); assert.equal(r.cubierto, true); }
  assert.equal((await ejecutar(operacion)).modo, 'local');
});
test('una entrada demasiado larga no desconecta el par', async () => {
  let cargas = 0;
  const ejecutar = crearEjecutor({ obtenerModelo: () => ({ delegado: true }), cargarLocal: async () => { cargas++; } });
  await assert.rejects(ejecutar(async () => { throw new Error('ContextOverflowError'); }), /ContextOverflow/);
  assert.equal(cargas, 0);
});
