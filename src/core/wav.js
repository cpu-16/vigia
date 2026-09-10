// PCM mono de QVAC → WAV reproducible en navegadores (Supertonic: 44.1 kHz).
export function crearWav(muestras, hz = 44100) {
  if (!muestras?.length || muestras.length > hz * 90) throw new Error('Audio vacío o demasiado largo');
  const datos = Buffer.alloc(muestras.length * 2);
  for (let i = 0; i < muestras.length; i++) {
    if (!Number.isFinite(muestras[i])) throw new Error('Muestra de audio inválida');
    datos.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(muestras[i]))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + datos.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(hz, 24); h.writeUInt32LE(hz * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(datos.length, 40);
  return Buffer.concat([h, datos]);
}
