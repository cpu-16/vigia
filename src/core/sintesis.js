import { loadModel, unloadModel, textToSpeech, TTS_MULTILINGUAL_SUPERTONIC2_Q8_0 } from '@qvac/sdk';
import { crearWav } from './wav.js';
import { registrar } from './rendimiento.js';

export const MODELO_LECTURA = 'Supertonic 2 Q8 · español';
export function crearSintesis({ cargar = loadModel, generar = textToSpeech, descargar = unloadModel, medir = registrar, modelSrc = TTS_MULTILINGUAL_SUPERTONIC2_Q8_0 } = {}) {
  let modelo = null, carga = null, ocupado = false;
  const cache = new Map(); let bytes = 0;
  const estado = () => ({ disponible: process.env.TTS_DESACTIVADO !== '1', modelo: MODELO_LECTURA, modo: 'local', hardware: 'laptop-rtx4060', cargado: modelo != null, ocupado, idioma: 'es' });
  async function hablar(texto) {
    if (typeof texto !== 'string' || !texto.trim() || texto.length > 500) throw Object.assign(new Error('La lectura debe tener entre 1 y 500 caracteres.'), { status: 400 });
    if (!estado().disponible) throw Object.assign(new Error('La lectura en voz está desactivada en este nodo.'), { status: 503 });
    texto = texto.trim();
    if (cache.has(texto)) { const r = cache.get(texto); cache.delete(texto); cache.set(texto, r); return { ...r, cache: true }; }
    if (ocupado) throw Object.assign(new Error('El nodo está generando otra lectura. Reintenta en unos segundos.'), { status: 429 });
    ocupado = true; const inicio = performance.now();
    try {
      if (!modelo) {
        carga ??= cargar({ modelSrc, modelType: 'tts', modelConfig: { ttsEngine: 'supertonic', language: 'es', voice: 'F1', ttsSpeed: 1.05, ttsNumInferenceSteps: 5, useGPU: true } });
        try { modelo = await carga; } catch (e) { carga = null; throw e; }
      }
      const t = performance.now();
      const muestras = await generar({ modelId: modelo, text: texto, inputType: 'text', stream: false }).buffer;
      const wav = crearWav(muestras), segundos = muestras.length / 44100;
      const r = { wav, segundos, ms: Math.round(performance.now() - inicio), cache: false };
      medir({ stage: 'speech_synthesis', tarea: 'tts', sdk_version: '0.18.2', model: MODELO_LECTURA, execution_mode: 'local', hardware_id: 'laptop-rtx4060', status: 'ok', chars: texto.length, end_to_end_ms: r.ms, synthesis_ms: Math.round(performance.now() - t), audio_seconds: segundos });
      if (wav.length <= 8 * 1024 * 1024) {
        while (cache.size && (cache.size >= 12 || bytes + wav.length > 8 * 1024 * 1024)) { const k = cache.keys().next().value; bytes -= cache.get(k).wav.length; cache.delete(k); }
        cache.set(texto, r); bytes += wav.length;
      }
      return r;
    } finally { ocupado = false; }
  }
  return { estado, hablar, async cerrar() { if (modelo) await descargar({ modelId: modelo }); modelo = null; carga = null; cache.clear(); bytes = 0; } };
}
