// Registro de rendimiento: una línea JSON por carga de modelo y por inferencia.
// Es lo que pide el track 02 («carga del modelo, prompts, tokens, TTFT, throughput»)
// y lo que el jurado del general puede leer para ver dónde corrió cada llamada.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hostname } from 'node:os';
import { randomBytes } from 'node:crypto';

export const SCHEMA_VERSION = 1;
export const RUN_ID = `${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`;
export const RUTA = process.env.RENDIMIENTO ?? 'evidencia/rendimiento.jsonl';

// El track 02 exige que el registro incluya los prompts, así que van completos. Eso significa
// que este archivo contiene lo que la persona dictó: vive junto a los datos, NUNCA sale del
// nodo, y en un despliegue real se apaga con REGISTRO_PROMPTS=0, que deja solo la huella.
// En este proyecto todo el contenido es sintético: hospitales, marcas, guía bancaria y placas
// son ficticios.
export const GUARDAR_PROMPTS = process.env.REGISTRO_PROMPTS !== '0';
const CAMPOS_CON_CONTENIDO = ['prompt_messages', 'output_text'];

// ponytail: appendFileSync; si el volumen sube, un stream con cola.
export function registrar(fila) {
  const f = { ...fila };
  if (!GUARDAR_PROMPTS) for (const k of CAMPOS_CON_CONTENIDO) if (k in f) f[k] = null;
  const linea = { schema_version: SCHEMA_VERSION, run_id: RUN_ID, timestamp_utc: new Date().toISOString(),
    host: hostname(), contenido_registrado: GUARDAR_PROMPTS, ...f };
  mkdirSync(dirname(RUTA), { recursive: true });
  appendFileSync(RUTA, JSON.stringify(linea) + '\n');
  return linea;
}

export const ms = t0 => Math.round((performance.now() - t0) * 10) / 10;
