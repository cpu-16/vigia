import test from 'node:test';
import assert from 'node:assert/strict';
import { sinContenido } from './rendimiento.js';
test('la evidencia pública conserva métricas sin prompts, respuestas ni rutas de fotos', () => {
  const fila = { prompt_messages: ['privado'], output_text: 'privado', prompt: 'privado', input_asset: '/tmp/privado', error: 'privado', ttft_ms: 17, model: 'QVAC' };
  assert.deepEqual(sinContenido(fila), { ttft_ms: 17, model: 'QVAC' });
  assert.equal(fila.output_text, 'privado');
});
