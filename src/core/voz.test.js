import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizar, picoDb, datosPCM } from './voz.js';

test('el silencio sigue siendo silencio aunque ffmpeg escriba metadatos WAV', async () => {
  const wav = Buffer.alloc(44 + 32000);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(32000, 40);
  const normal = await normalizar(wav);
  assert.equal(picoDb(normal), -Infinity);
  assert.equal(datosPCM(normal).length, 32000);
  assert.throws(() => datosPCM(Buffer.from('inválido')), /inválido/);
});
