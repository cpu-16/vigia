// Chequeo de lectura: no modifica inventarios, expedientes ni modelos.
const base = process.env.VIGIA_URL ?? 'http://localhost:7320';
const headers = process.env.CLAVE ? { cookie: `vigia=${encodeURIComponent(process.env.CLAVE)}` } : {};
let fallos = 0;
for (const ruta of ['/', '/equipos', '/sucursal', '/tablero', '/verificar', '/api/sucursal/estado', '/api/evidencia']) {
  try {
    const r = await fetch(base + ruta, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}${r.status === 401 || r.status === 303 ? ': configura CLAVE' : ''}`);
    const data = ruta.startsWith('/api/') ? await r.json() : null;
    if (ruta === '/api/sucursal/estado' && !data.disponible) throw new Error('sin modelo bancario disponible');
    if (ruta === '/api/evidencia') {
      if (data.cadena?.valida === false) throw new Error('cadena de observaciones alterada');
      if ((data.ultimas ?? []).some(f => f.prompt_messages || f.output_text || f.input_asset)) throw new Error('el endpoint expone contenido del registro');
      console.log(`Modelos: ${(data.modelos ?? []).map(m => `${m.tarea}: ${m.modo}`).join(' · ')}`);
    }
    console.log(`OK ${ruta}`);
  } catch (e) { fallos++; console.error(`FALTA ${ruta}: ${e.message}`); }
}
console.log(fallos ? `${fallos} chequeo(s) fallaron. Corrige antes de grabar.` : 'Nodo disponible. Falta ensayar cámara, dictado y guardar/verificar con el dispositivo de la grabación.');
process.exitCode = fallos ? 1 : 0;
