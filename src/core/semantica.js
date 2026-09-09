// Recuperación semántica con los embeddings del SDK de QVAC (EmbeddingGemma 300M).
//
// Por qué existe: la búsqueda por términos encuentra lo que se llama igual, pero el cajero no
// pregunta con las palabras de la guía. Los embeddings encuentran lo que significa lo mismo.
// Ninguna de las dos sobra: los códigos (RET-ISL-01) los acierta la exacta y no la semántica,
// y las paráfrasis al revés. Por eso se combinan.
//
// Y por qué por el SDK y no por una librería: el track 02 exige «utilizar @qvac/sdk para todas
// las operaciones principales de inferencia de IA y RAG». Los vectores los produce QVAC, en
// este equipo, y no salen de aquí.
import { loadModel, embed, EMBEDDINGGEMMA_300M_Q8_0 } from '@qvac/sdk';
import { registrar, ms } from './rendimiento.js';

const SDK_VERSION = '0.18.2';

export async function cargarEmbeddings({ etiqueta = 'EmbeddingGemma 300M Q8_0', hardware = 'laptop-rtx4060', device = 'gpu' } = {}) {
  const t0 = performance.now();
  const base = { stage: 'load', sdk_version: SDK_VERSION, model: etiqueta, hardware_id: hardware, execution_mode: 'local', tarea: 'embeddings' };
  try {
    // Ojo con el SDK: el LLM quiere `gpu_layers` y el embedder quiere `gpuLayers`.
    // La convención equivocada tumba la carga sin decir por qué.
    const modelId = await loadModel({ modelSrc: EMBEDDINGGEMMA_300M_Q8_0,
      modelConfig: { device, gpuLayers: device === 'cpu' ? 0 : 99 } });
    registrar({ ...base, status: 'ok', load_ms: ms(t0) });
    return { modelId, etiqueta, hardware, device };
  } catch (e) { registrar({ ...base, status: 'error', error: String(e?.message ?? e), load_ms: ms(t0) }); throw e; }
}

export const coseno = (a, b) => {
  let p = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { p += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? p / Math.sqrt(na * nb) : 0;
};

// indexar(): un vector por fragmento. Se calcula una vez y se guarda en memoria.
export async function indexar(emb, fragmentos, { requestId } = {}) {
  const t0 = performance.now();
  const vectores = [];
  for (const f of fragmentos) vectores.push((await embed({ modelId: emb.modelId, text: f.texto.slice(0, 4000) })).embedding);
  registrar({ stage: 'embeddings', request_id: requestId ?? null, sdk_version: SDK_VERSION, model: emb.etiqueta,
    hardware_id: emb.hardware, execution_mode: 'local', status: 'ok', fragmentos: fragmentos.length,
    dims: vectores[0]?.length ?? null, end_to_end_ms: ms(t0) });
  return fragmentos.map((f, i) => ({ ...f, vector: vectores[i] }));
}

// buscarSemantico(): los n fragmentos más parecidos a la consulta, por coseno.
export async function buscarSemantico(emb, indice, consulta, n = 3) {
  const { embedding } = await embed({ modelId: emb.modelId, text: consulta });
  return indice.map(f => ({ ...f, similitud: coseno(embedding, f.vector) }))
    .sort((a, b) => b.similitud - a.similitud).slice(0, n);
}

// combinar(): fusión por rango recíproco. No suma puntajes de escalas distintas (un puntaje de
// términos y un coseno no son comparables): suma el inverso de la POSICIÓN en cada lista, que
// es lo único que ambas comparten. Un fragmento que sale alto en las dos gana.
export function combinar(listas, { n = 3, k = 60, clave = f => f.titulo } = {}) {
  const puntos = new Map(), porClave = new Map();
  for (const lista of listas) lista.forEach((f, i) => {
    const c = clave(f);
    puntos.set(c, (puntos.get(c) ?? 0) + 1 / (k + i + 1));
    if (!porClave.has(c)) porClave.set(c, f);
  });
  return [...puntos.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([c, p]) => ({ ...porClave.get(c), rrf: Math.round(p * 10000) / 10000 }));
}
