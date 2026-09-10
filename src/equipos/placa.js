// Lectura de la placa de identificación de un equipo, con VisionPsy Nano (el modelo Psy
// multimodal de QVAC) como transcriptor y reglas deterministas como intérprete.
//
// Por qué así: VisionPsy está entrenado para leer texto en escena y etiquetas, pero es de 460M
// y su ficha oficial advierte que «puede alucinar o contar mal». Medido el 8-sep: si se le pide
// JSON devuelve cajas de detección, y si se le pregunta «el número de serie» confunde el S/N con
// el P/N. En cambio transcribe la placa completa y correcta cuando se le pide leerla línea por
// línea. Así que el modelo TRANSCRIBE y el código INTERPRETA. La identidad del activo nunca se
// da por confirmada sola: siempre vuelve al colaborador para que la acepte.
import { loadModel, completion, VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0 } from '@qvac/sdk';
import { registrar, ms } from '../core/rendimiento.js';
import { MARCAS, sinAcentos, normalizarModalidad } from './esquema.js';

const SDK_VERSION = '0.18.2';
export const PROMPT = 'Read all the text printed on this label, line by line.';
// Una foto de campo casi nunca es una placa: es el equipo entero, en su sala. Para eso el mismo
// modelo describe la escena en una frase. Va en inglés porque VisionPsy Nano está entrenado en
// inglés, y no hace falta traducirla: el extractor ya recibe inglés (los 10 prompts del reto lo son).
export const PROMPT_ESCENA = 'Describe this photo in one short sentence: what medical device is shown, and any brand or text visible on it.';

export async function cargarVista({ etiqueta = 'VisionPsy Nano 460M Q8_0', hardware = 'laptop-rtx4060', device = 'gpu', ctx = 2048 } = {}) {
  const t0 = performance.now();
  const base = { stage: 'load', sdk_version: SDK_VERSION, model: etiqueta, hardware_id: hardware, execution_mode: 'local', tarea: 'vision' };
  try {
    const modelId = await loadModel({ modelSrc: VISIONPSY_NANO_460M_MULTIMODAL_Q8_0,
      modelConfig: { ctx_size: ctx, device, gpu_layers: device === 'cpu' ? 0 : 99,
        projectionModelSrc: MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0 } });
    registrar({ ...base, status: 'ok', load_ms: ms(t0) });
    return { modelId, etiqueta, hardware, device };
  } catch (e) { registrar({ ...base, status: 'error', error: String(e?.message ?? e), load_ms: ms(t0) }); throw e; }
}

// transcribir(): la placa entera, tal como está impresa. Nada de pedirle campos.
export async function transcribir(vista, imagen, { requestId, prompt = PROMPT, maxTokens = 400 } = {}) {
  const t0 = performance.now();
  let tPrimero = null, texto = '', stats = null;
  const base = { stage: 'vision', request_id: requestId ?? null, sdk_version: SDK_VERSION, model: vista.etiqueta,
    hardware_id: vista.hardware, execution_mode: 'local', input_asset: imagen,
    prompt_messages: [{ role: 'user', content: prompt, attachments: [imagen] }], prompt };
  try {
    const run = completion({ modelId: vista.modelId, stream: true, maxTokens,
      history: [{ role: 'user', content: prompt, attachments: [{ path: imagen }] }] });
    for await (const ev of run.events) {
      if (ev.type === 'contentDelta' && ev.text) { if (tPrimero === null) tPrimero = performance.now(); texto += ev.text; }
      else if (ev.type === 'completionStats') stats = ev.stats;
    }
    const total = ms(t0);
    const fila = registrar({ ...base, status: 'ok', end_to_end_ms: total,
      ttft_ms: tPrimero === null ? null : Math.round((tPrimero - t0) * 10) / 10,
      input_tokens: stats?.promptTokens ?? null, output_tokens: stats?.generatedTokens ?? null,
      throughput_tps: stats?.tokensPerSecond ?? null, backend_actual: stats?.backendDevice ?? null });
    return { texto: texto.trim(), lineas: texto.split('\n').map(l => l.trim()).filter(Boolean), ms: total, fila };
  } catch (e) { registrar({ ...base, status: 'error', error: String(e?.message ?? e), end_to_end_ms: ms(t0) }); throw e; }
}

// ── Interpretación determinista ─────────────────────────────────────────────
// Una cadena de elementos GS1 identifica el producto sin ninguna IA: (01) es el código del
// producto —el mismo para todas las unidades de ese modelo, o sea la llave natural para no
// duplicar—, (21) el número de serie de la unidad y (11) la fecha de fabricación.
const IA_FIJOS = { '01': 14, '11': 6, '17': 6, '15': 6, '13': 6 };
export function parsearGS1(cadena) {
  if (!cadena) return null;
  const limpia = String(cadena).replace(/\s+/g, '');
  const out = {};
  if (/^\((\d{2})\)/.test(limpia)) {                        // forma con paréntesis: (01)…(21)…
    for (const m of limpia.matchAll(/\((\d{2})\)([^(]*)/g)) out[m[1]] = m[2];
  } else {                                                   // forma corrida: 01…21…
    let i = 0;
    while (i + 2 <= limpia.length) {
      const ia = limpia.slice(i, i + 2); i += 2;
      const largo = IA_FIJOS[ia];
      if (largo) { out[ia] = limpia.slice(i, i + largo); i += largo; }
      else { const resto = limpia.slice(i); const corte = resto.search(/(?:01|11|17|21|10)\d/); out[ia] = corte > 0 ? resto.slice(0, corte) : resto; i += out[ia].length; }
    }
  }
  const fecha = v => v && /^\d{6}$/.test(v) ? `20${v.slice(0, 2)}-${v.slice(2, 4)}` : null;
  const producto = out['01']?.replace(/\D/g, '');
  if (!producto && !out['21']) return null;
  return { producto: producto && producto.length === 14 ? producto : null, serie: out['21'] || null,
    lote: out['10'] || null, fabricacion: fecha(out['11']), vence: fecha(out['17']) };
}

const VALOR = (lineas, ...claves) => {
  for (const l of lineas) for (const k of claves) {
    const re = new RegExp(`(?:^|\\b)${k}\\s*[:.]?\\s*(.+)$`, 'i');
    const m = l.match(re);
    if (m && m[1].trim()) return m[1].trim().replace(/[|]+$/, '').trim();
  }
  return null;
};

// parsearPlaca(lineas, catalogo): campos con el ORIGEN de cada uno. El origen es lo que decide
// la confianza: el código impreso vale más que una línea suelta, y esa a su vez más que nada.
export function parsearPlaca(lineas, { catalogo = [] } = {}) {
  const L = lineas.map(l => l.trim()).filter(Boolean);
  const texto = L.join('\n');
  const campos = {}, origen = {};
  const poner = (k, v, o) => { if (v != null && v !== '' && campos[k] == null) { campos[k] = v; origen[k] = o; } };

  const gs1 = parsearGS1(texto.match(/\(01\)[\dA-Za-z()]+/)?.[0] ?? texto.match(/\b01\d{14}(?:11\d{6})?(?:21\S+)?/)?.[0]);
  if (gs1) {
    poner('serial', gs1.serie, 'código GS1 impreso');
    poner('mfg', gs1.fabricacion, 'código GS1 impreso');
    poner('gtin', gs1.producto, 'código GS1 impreso');
    const enCatalogo = catalogo.find(c => c.gtin && gs1.producto && c.gtin === gs1.producto);
    if (enCatalogo) { poner('model', enCatalogo.model, 'código GS1 + catálogo'); poner('manufacturer', enCatalogo.manufacturer, 'código GS1 + catálogo'); poner('modality', enCatalogo.modality, 'código GS1 + catálogo'); }
  }
  poner('model', VALOR(L, 'MODEL', 'MODELO', 'MOD'), 'etiqueta MODEL');
  poner('serial', VALOR(L, 'S/N', 'SN', 'SERIAL', 'SERIE', 'SERIAL NO'), 'etiqueta S/N');
  poner('mfg', (VALOR(L, 'MFG DATE', 'MFG', 'FECHA') ?? '').match(/\d{4}-\d{2}/)?.[0], 'etiqueta MFG');
  poner('modality', normalizarModalidad(VALOR(L, 'TYPE', 'TIPO')), 'etiqueta TYPE');

  // La marca: solo una de las seis del reto, y solo si aparece impresa.
  const marca = MARCAS.find(m => sinAcentos(texto).includes(sinAcentos(m)));
  poner('manufacturer', marca, 'marca impresa');
  if (campos.model && !campos.modality) poner('modality', normalizarModalidad(campos.model), 'deducida del modelo');

  // Coherencia: si el código y la etiqueta discrepan, se marca el desacuerdo y no se elige solo.
  const desacuerdos = [];
  const serieEtiqueta = VALOR(L, 'S/N', 'SN', 'SERIAL');
  if (gs1?.serie && serieEtiqueta && gs1.serie !== serieEtiqueta) desacuerdos.push({ campo: 'serial', codigo: gs1.serie, etiqueta: serieEtiqueta });

  const confianza = {};
  for (const k of ['manufacturer', 'model', 'serial', 'modality', 'mfg']) confianza[k] =
    campos[k] == null ? 'Low' : /GS1/.test(origen[k] ?? '') ? 'High' : 'Medium';
  for (const d of desacuerdos) confianza[d.campo] = 'Low';

  return { campos, origen, confianza, desacuerdos, lineas: L,
    // Nunca se confirma la identidad sin una persona: es la política del propio modelo Psy,
    // cuya ficha dice que no debe usarse para decisiones automatizadas.
    requiereConfirmacion: true };
}

// leerPlaca(): el flujo completo. Devuelve lo transcrito y lo interpretado, para que la app
// muestre cada campo junto a la línea de la que salió.
export async function leerPlaca(vista, imagen, { requestId, catalogo } = {}) {
  const t = await transcribir(vista, imagen, { requestId });
  const p = parsearPlaca(t.lineas, { catalogo });
  return { ...p, transcripcion: t.texto, ms: t.ms, fila: t.fila };
}

// mirar(): la foto que llega no viene rotulada. Se intenta LEER primero, porque leer da datos
// duros —marca, modelo, serie— y una descripción no. Si de la lectura no sale ni marca ni modelo
// ni serie, entonces no era una placa: se le pide al mismo modelo que DESCRIBA lo que ve, y eso
// entra a la visita como una observación más, nunca como identidad del activo.
export async function mirar(vista, imagen, { requestId, catalogo } = {}) {
  const r = await leerPlaca(vista, imagen, { requestId, catalogo });
  if (r.campos.manufacturer || r.campos.model || r.campos.serial) return { ...r, modo: 'placa' };
  const d = await transcribir(vista, imagen, { requestId, prompt: PROMPT_ESCENA, maxTokens: 90 });
  return { ...r, modo: 'escena', descripcion: d.texto, pistas: pistasDeEscena(d.texto),
    ms: r.ms + d.ms, filaEscena: d.fila };
}

// De una descripción libre solo se acepta lo que el catálogo puede sostener: la modalidad, y la
// marca únicamente si es una de las seis del reto. Medido el 9-sep: sobre una foto de feria el
// modelo inventó la marca «Soyo». Una descripción es una pista para la persona, no una identidad,
// y lo que entra al reporte sale de aquí, no de la frase cruda.
export function pistasDeEscena(texto) {
  const t = sinAcentos(texto ?? '');
  let modality = normalizarModalidad(texto ?? '');
  // Una pantalla de oficina no es un equipo de monitorización de pacientes.
  if (modality === 'Patient Monitoring' && !/patient|paciente|vital|ecg|electrocardio|bedside|signos|cardiac/.test(t)) modality = null;
  return { modality,
           manufacturer: MARCAS.find(m => t.includes(sinAcentos(m))) ?? null };
}
