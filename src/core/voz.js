// Dictado: audio del navegador → texto, con Whisper por QVAC. Todo local.
// El audio del teléfono llega bajo (medido a −22 dB en un HONOR X6s), así que se normaliza
// con ffmpeg antes de transcribir; sin eso Whisper oía «Hola, hola» y perdía el reporte.
import { loadModel, transcribe } from '@qvac/sdk';
import { spawn } from 'node:child_process';
import { registrar, ms } from './rendimiento.js';

const SDK_VERSION = '0.18.2';
let cargado = null;

// cargarVoz(): Whisper. En la RTX compite por VRAM con el LLM y el VLM, así que el defecto es CPU.
// Medido el 9-sep con un control de 9.4 s (large-v3 turbo, 8 hilos): **24.1–25.0 s en CPU**, y casi
// lo mismo con 0.8 s de audio (24.1 s) — whisper.cpp paga la ventana de 30 s entera, así que el
// costo es fijo por llamada, no por segundo hablado. Con el lenguaje delegado a un par la tarjeta
// queda libre: `device:'gpu'`.
export async function cargarVoz({ modelSrc, etiqueta = 'Whisper', hardware = 'laptop-cpu', idioma = 'auto', hilos = 8, device = 'cpu' } = {}) {
  if (cargado) return cargado;
  const t0 = performance.now();
  const base = { stage: 'load', sdk_version: SDK_VERSION, model: etiqueta, hardware_id: hardware, execution_mode: 'local', tarea: 'asr' };
  try {
    const modelId = await loadModel({ modelSrc, modelType: 'whispercpp-transcription',
      modelConfig: { language: idioma, translate: false, no_timestamps: true, n_threads: hilos,
        contextParams: { use_gpu: device === 'gpu', flash_attn: false } } });
    registrar({ ...base, status: 'ok', load_ms: ms(t0) });
    cargado = { modelId, etiqueta, hardware, idioma };
    return cargado;
  } catch (e) { registrar({ ...base, status: 'error', error: String(e?.message ?? e), load_ms: ms(t0) }); throw e; }
}

// normalizar(bytes): webm/opus o mp4 del navegador → WAV 16 kHz mono, con realce de volumen.
// highpass corta el retumbe del bolsillo; dynaudnorm sube el nivel sin recortar los picos.
export function normalizar(bytes) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      '-af', 'highpass=f=80,dynaudnorm=f=200:g=15', '-ac', '1', '-ar', '16000', '-f', 'wav', 'pipe:1']);
    const partes = [], err = [];
    ff.stdout.on('data', c => partes.push(c));
    ff.stderr.on('data', c => err.push(c));
    ff.on('error', reject);
    ff.on('close', c => c === 0 ? resolve(Buffer.concat(partes)) : reject(new Error(`ffmpeg ${c}: ${Buffer.concat(err).toString().slice(0, 200)}`)));
    ff.stdin.on('error', () => {});
    ff.stdin.end(bytes);
  });
}

// picoDb(wav): pico en dBFS de un WAV PCM 16 bits. Sirve para no llamar al modelo con silencio.
export function datosPCM(wav) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Audio WAV inválido');
  // ffmpeg inserta LIST/INFO antes de data; esos bytes no son muestras de audio.
  for (let i = 12; i + 8 <= wav.length;) {
    const n = wav.readUInt32LE(i + 4), inicio = i + 8;
    if (wav.toString('ascii', i, i + 4) === 'data') return wav.subarray(inicio, Math.min(wav.length, inicio + n));
    i = inicio + n + (n % 2);
  }
  throw new Error('El WAV no contiene muestras');
}
export function picoDb(wav) {
  const pcm = datosPCM(wav); let pico = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) pico = Math.max(pico, Math.abs(pcm.readInt16LE(i)));
  return pico === 0 ? -Infinity : 20 * Math.log10(pico / 32768);
}

// dictar(bytes, { requestId }): devuelve { texto, ms, segundos, pico, silencio }.
export async function dictar(bytes, { requestId, umbralDb = -30 } = {}) {
  const voz = cargado;
  if (!voz) throw new Error('el modelo de voz no está cargado');
  const t0 = performance.now();
  const wav = await normalizar(bytes);
  const pico = picoDb(wav), segundos = Math.max(0, datosPCM(wav).length / 2 / 16000);
  const base = { stage: 'transcription', request_id: requestId ?? null, sdk_version: SDK_VERSION, model: voz.etiqueta,
    hardware_id: voz.hardware, execution_mode: 'local', prompt_messages: [{ role: 'audio', content: `${voz.idioma} · ${bytes.length} bytes` }],
    audio_bytes: bytes.length, audio_seconds: Math.round(segundos * 10) / 10, peak_dbfs: Math.round(pico * 10) / 10 };
  // Silencio: no se llama al modelo (evita que Whisper alucine «gracias por ver el video»).
  if (pico < umbralDb) { registrar({ ...base, status: 'silencio', end_to_end_ms: ms(t0) }); return { texto: '', ms: ms(t0), segundos, pico, silencio: true }; }
  try {
    const texto = String(await transcribe({ modelId: voz.modelId, audioChunk: wav })).trim();
    const total = ms(t0);
    registrar({ ...base, status: 'ok', end_to_end_ms: total, chars: texto.length,
      real_time_factor: segundos > 0 ? Math.round((total / 1000 / segundos) * 100) / 100 : null });
    return { texto, ms: total, segundos, pico, silencio: false };
  } catch (e) { registrar({ ...base, status: 'error', error: String(e?.message ?? e), end_to_end_ms: ms(t0) }); throw e; }
}
