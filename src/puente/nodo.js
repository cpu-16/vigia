// El puente que corre DENTRO del teléfono (Termux + Bare). Sirve la app al navegador del
// propio teléfono y hace la extracción con QVAC: delega a un par autorizado por llave pública
// cuando lo alcanza, y responde con el modelo chico local cuando no.
//
// Por qué existe: un `fetch` del navegador a la laptop no es delegación P2P, es HTTP. Aquí el
// SDK de QVAC corre en el teléfono y habla por el DHT de Hyperswarm con la llave del proveedor.
// Y por qué el respaldo importa: en el sótano de un hospital no hay par a la vista, y el
// colaborador no puede quedarse esperando.
//
// Corre en Termux:
//   QVAC_WORKER_PATH=$HOME/qvac-app/node_modules/@qvac/sdk/dist/server/worker-min.js \
//   LD_LIBRARY_PATH=$PREFIX/lib P2P_PROVEEDOR=<llave> node src/puente/nodo.js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { QWEN3_600M_INST_Q4, QWEN3_1_7B_INST_Q4 } from '@qvac/sdk';
import { cargar, completar } from '../core/runtime.js';
import { registrar } from '../core/rendimiento.js';
import { extraer } from '../equipos/extraer.js';
import { preguntas } from '../equipos/reglas.js';

const PUERTO = Number(process.env.PUERTO ?? 7312);
const APP = resolve('app');
const PROVEEDOR = process.env.P2P_PROVEEDOR || null;
const HARDWARE = process.env.HARDWARE ?? 'honor-x6s';
const idSolicitud = () => `V-${randomBytes(2).toString('hex').toUpperCase()}`;

// Dos modelos cargados: el par remoto (rápido) y el chico de a bordo (lento pero siempre está).
// El chico se carga aunque haya par: cargarlo cuando ya se cayó el enlace tarda demasiado.
export const modelos = { delegado: null, local: null };

export async function cargarModelos({ soloLocal = false } = {}) {
  if (PROVEEDOR && !soloLocal) {
    try {
      modelos.delegado = await cargar({ modelSrc: QWEN3_1_7B_INST_Q4, etiqueta: 'Qwen3-1.7B Q4_0 (par)',
        hardware: `par ${PROVEEDOR.slice(0, 8)}…`, proveedor: PROVEEDOR });
      if (!modelos.delegado.delegado) { console.log('▸ el par no respondió: el modelo quedó local'); modelos.delegado = null; }
    } catch (e) { console.log(`▸ sin par (${e.message})`); }
  }
  modelos.local = await cargar({ modelSrc: QWEN3_600M_INST_Q4, etiqueta: 'Qwen3-0.6B Q4_0 (a bordo)',
    hardware: HARDWARE, device: process.env.GPU_TELEFONO ? 'gpu' : 'cpu', ctx: 2048 });
  return modelos;
}

// El respaldo que el SDK no da: si el proveedor muere con el modelo ya cargado, la completion
// delegada vuelve VACÍA y sin error (medido). `fallbackToLocal` solo cubre la carga, no esto.
// Así que el vacío se trata como caída y se reintenta a bordo, diciéndolo.
// `extraerFn` se puede inyectar para probar la política de respaldo sin cargar modelos.
export async function extraerConRespaldo(texto, { requestId = idSolicitud(), extraerFn = extraer } = {}) {
  if (modelos.delegado) {
    try {
      const r = await extraerFn(modelos.delegado, texto, { requestId });
      const vacio = !r.crudo || (!r.borrador.customer?.name && !r.borrador.equipment?.length && !r.sinModelo);
      if (!vacio) return { ...r, modo: 'delegado', modelo: modelos.delegado.etiqueta, degradado: false };
      registrar({ stage: 'fallback', request_id: requestId, status: 'vacio', model: modelos.delegado.etiqueta,
        motivo: 'la completion delegada volvió vacía: se asume par caído' });
    } catch (e) {
      registrar({ stage: 'fallback', request_id: requestId, status: 'error', error: String(e?.message ?? e), model: modelos.delegado.etiqueta });
    }
    modelos.delegado = null;   // no se reintenta el par en cada visita: se sigue a bordo
  }
  const r = await extraerFn(modelos.local, texto, { requestId });
  return { ...r, modo: 'local', modelo: modelos.local.etiqueta, degradado: !!PROVEEDOR,
    aviso: PROVEEDOR ? 'El par no está a la vista: se usó el modelo pequeño del teléfono, que es más lento y menos preciso. Revisa con cuidado.' : null };
}

const json = (res, o, c = 200) => { res.writeHead(c, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

export function crearServidor() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/app')) return archivo(res, 'index.html');
      if (req.method === 'GET' && /^\/[\w.-]+$/.test(url.pathname) && existsSync(join(APP, url.pathname.slice(1)))) return archivo(res, url.pathname.slice(1));
      if (req.method === 'GET' && url.pathname === '/api/evidencia')
        return json(res, { nodo: HARDWARE, modo: modelos.delegado ? 'delegado' : 'local',
          modelo: (modelos.delegado ?? modelos.local)?.etiqueta, par: PROVEEDOR ? PROVEEDOR.slice(0, 16) + '…' : null,
          sdk: '@qvac/sdk 0.18.2', node: process.version });
      if (req.method === 'POST' && url.pathname === '/api/extraer') {
        const partes = []; for await (const c of req) partes.push(c);
        const { texto, respuestas } = JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
        const id = idSolicitud();
        console.log(`▸ [${id}] extracción por ${modelos.delegado ? 'PAR delegado' : 'modelo a bordo'}`);
        const r = await extraerConRespaldo(texto ?? '', { requestId: id });
        console.log(`▸ [${id}] ${r.modo} · ${Math.round(r.ms)} ms · ${r.borrador.equipment.map(g => `${g.quantity ?? '?'}×${g.modality}`).join(', ') || 'sin equipos'}`);
        return json(res, { id, borrador: r.borrador, descartes: r.descartes, ms: r.ms, modo: r.modo,
          modelo: r.modelo, degradado: r.degradado, aviso: r.aviso, fila: r.fila,
          preguntas: preguntas(r.borrador, { yaContestadas: new Set(Object.keys(respuestas ?? {})) }), duplicados: [] });
      }
      res.writeHead(404); res.end('no está');
    } catch (e) { json(res, { error: String(e?.message ?? e) }, 500); }
  });
}

async function archivo(res, nombre) {
  const p = join(APP, nombre);
  if (!p.startsWith(APP) || !existsSync(p)) { res.writeHead(404); return res.end('no está'); }
  res.writeHead(200, { 'content-type': TIPOS[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(await readFile(p));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await cargarModelos();
  console.log(`▸ Nodo ${HARDWARE} · ${modelos.delegado ? `delegando al par ${PROVEEDOR.slice(0, 12)}…` : 'solo modelo a bordo'}`);
  crearServidor().listen(PUERTO, () => console.log(`▸ Puente en http://localhost:${PUERTO}`));
}
