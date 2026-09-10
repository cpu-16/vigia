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
import { cargar } from '../core/runtime.js';
import { conRespaldo, SinRespaldo } from './respaldo.js';
import { extraer } from '../equipos/extraer.js';
import { aplicarRespuestas } from '../equipos/revision.js';
import { preguntas } from '../equipos/reglas.js';
import { Base } from '../equipos/almacen.js';
import { llaveNodo, sellar } from '../core/sello.js';

const PUERTO = Number(process.env.PUERTO ?? 7312);
const APP = resolve('app');
const PROVEEDOR = process.env.P2P_PROVEEDOR || null;
const HARDWARE = process.env.HARDWARE ?? 'honor-x6s';
const idSolicitud = () => `V-${randomBytes(2).toString('hex').toUpperCase()}`;

// El teléfono guarda en SU propio almacén y firma con SU propia llave: la visita queda completa
// aunque nunca toque la laptop. Son los mismos módulos que usa el servidor (`equipos/almacen.js`
// y `core/sello.js`), así que un acta sellada aquí la verifica cualquiera allá.
// Perezosos a propósito: importar este módulo (las pruebas lo hacen) no debe crear la llave
// ni el archivo de observaciones hasta que alguien guarde de verdad.
let _base = null, _llave = null;
export const almacen = () => (_base ??= new Base(process.env.OBSERVACIONES ?? 'datos/observaciones.jsonl'));
export const llave = () => (_llave ??= llaveNodo());

// guardar(cuerpo) → { eventos, acta } · el mismo contrato que `POST /api/guardar` del servidor,
// para que «Verificar esta acta» de la app funcione igual servida desde el teléfono.
export function guardar({ borrador, observador, directo, fuente, requestId, foto } = {}) {
  if (!borrador?.customer?.name) return { error: 'hace falta el hospital', codigo: 400 };
  if (!borrador?.equipment?.length) return { error: 'no hay equipos que guardar', codigo: 400 };
  const eventos = almacen().guardar(borrador, { observador, directo, fuente, requestId, foto });
  const acta = sellar({ visita: requestId ?? null, observador: observador ?? null,
    customer: borrador.customer, equipos: eventos.map(e => e.datos), eventos: eventos.map(e => e.id) },
    llave(), { firmante: observador ?? 'nodo' });
  return { eventos: eventos.length, acta };
}

// Dos modelos cargados: el par remoto (rápido) y el chico de a bordo (lento pero siempre está).
// El chico se carga aunque haya par: cargarlo cuando ya se cayó el enlace tarda demasiado.
export const modelos = { delegado: null, local: null };

export async function cargarModelos({ soloLocal = false } = {}) {
  // El modelo a bordo va PRIMERO, y el orden no es cosmético.
  //
  // Puede NO cargar: en el HONOR X6s de hoy el worker de Bare muere al cargarlo
  // (ver evidencia/medicion-telefono-9sep.md). El SDK levanta un worker nuevo, pero el nuevo NACE
  // VACÍO: se lleva puestos los modelos que ya estaban cargados. Medido en el teléfono el 9-sep con
  // el orden contrario (par primero): la carga delegada decía `status: ok`, y a la primera captura
  // la completion moría con «Model with ID "27fe88790efcfd44" not found» y el nodo respondía 503
  // teniendo el par vivo al otro lado. Cargando el chico primero, la explosión pasa antes de que
  // exista el handle del par.
  //
  // Y se carga aunque haya par: cargarlo cuando el enlace YA se cayó tarda demasiado en un teléfono.
  try {
    modelos.local = await cargar({ modelSrc: QWEN3_600M_INST_Q4, etiqueta: 'Qwen3-0.6B Q4_0 (a bordo)',
      hardware: HARDWARE, device: process.env.GPU_TELEFONO ? 'gpu' : 'cpu', ctx: 2048 });
  } catch (e) {
    modelos.local = null;
    console.log(`▸ sin modelo a bordo (${e.message}): este nodo solo funciona con el par a la vista`);
  }
  if (PROVEEDOR && !soloLocal) {
    try {
      modelos.delegado = await cargar({ modelSrc: QWEN3_1_7B_INST_Q4, etiqueta: 'Qwen3-1.7B Q4_0 (par)',
        hardware: `par ${PROVEEDOR.slice(0, 8)}…`, proveedor: PROVEEDOR });
      if (!modelos.delegado.delegado) { console.log('▸ el par no respondió: el modelo quedó local'); modelos.delegado = null; }
    } catch (e) { console.log(`▸ sin par (${e.message})`); }
  }
  return modelos;
}

// La política de respaldo vive en respaldo.js y la comparten el teléfono y la laptop.
// Aquí solo se dice de dónde sale cada cosa en ESTE nodo: el modelo a bordo ya está cargado
// (cargarlo cuando el enlace ya se cayó tarda demasiado en un teléfono), así que la función
// perezosa se limita a devolverlo. `extraerFn` se inyecta para probar sin cargar modelos.
export function extraerConRespaldo(texto, { requestId = idSolicitud(), extraerFn = extraer } = {}) {
  return conRespaldo(texto, { requestId, extraerFn,
    par: modelos.delegado,
    alCaerElPar: () => { modelos.delegado = null; },   // no se reintenta el par en cada visita
    cargarLocal: () => modelos.local,
    hayPar: !!PROVEEDOR,
    aviso: 'El par no está a la vista: se usó el modelo pequeño del teléfono, que es más lento y menos preciso. Revisa con cuidado.',
    avisoSinRespaldo: 'Sin par a la vista y sin modelo a bordo: la captura queda pendiente' });
}

const json = (res, o, c = 200) => { res.writeHead(c, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(o)); };
const cuerpoJson = async req => { const p = []; for await (const c of req) p.push(c); return JSON.parse(Buffer.concat(p).toString('utf8') || '{}'); };
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

export function crearServidor() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      // Las mismas rutas que el servidor de la laptop: `/` es la portada del producto y la app
      // de campo vive en `/equipos`. Si no, la misma PWA se comporta distinto según quién la sirva.
      if (req.method === 'GET' && ['/revision.js', '/reglas.js', '/esquema.js'].includes(url.pathname)) {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
        return res.end(await readFile(join(resolve('src/equipos'), url.pathname.slice(1))));
      }
      if (req.method === 'GET' && url.pathname === '/') return archivo(res, 'inicio.html');
      if (req.method === 'GET' && (url.pathname === '/equipos' || url.pathname === '/app')) return archivo(res, 'index.html');
      if (req.method === 'GET' && /^\/[\w.-]+$/.test(url.pathname) && existsSync(join(APP, url.pathname.slice(1)))) return archivo(res, url.pathname.slice(1));
      if (req.method === 'GET' && url.pathname === '/api/evidencia')
        return json(res, { nodo: HARDWARE, modo: modelos.delegado ? 'delegado' : (PROVEEDOR ? 'local (par caído)' : 'local'),
          modelo: (modelos.delegado ?? modelos.local)?.etiqueta, par: PROVEEDOR ? PROVEEDOR.slice(0, 16) + '…' : null,
          respaldo: !!modelos.local,   // si es false, este nodo depende del par: no tiene modelo a bordo
          capacidades: { foto: false, voz: false, sucursal: false },
          sdk: '@qvac/sdk 0.18.2', node: process.version });
      if (req.method === 'POST' && url.pathname === '/api/guardar') {
        const { eventos, acta, error, codigo } = guardar(await cuerpoJson(req));
        if (error) return json(res, { error }, codigo);
        console.log(`▸ guardadas ${eventos} observaciones en el teléfono · acta ${acta.sello.hash.slice(0, 12)}…`);
        return json(res, { eventos, acta });
      }
      if (req.method === 'POST' && url.pathname === '/api/extraer') {
        const { texto, respuestas, origenes } = await cuerpoJson(req);
        const id = idSolicitud();
        console.log(`▸ [${id}] extracción por ${modelos.delegado ? 'PAR delegado' : 'modelo a bordo'}`);
        const r = await extraerConRespaldo(texto ?? '', { requestId: id }).catch(e => {
          if (!e?.sinRespaldo) throw e;
          console.log(`▸ [${id}] sin par y sin modelo a bordo: la captura queda pendiente`);
          json(res, { id, error: e.aviso, aviso: e.aviso, modo: 'sin_respaldo', degradado: true }, 503);
          return null;
        });
        if (!r) return;
        r.borrador = aplicarRespuestas(r.borrador, respuestas, origenes);
        console.log(`▸ [${id}] ${r.modo} · ${Math.round(r.ms)} ms · ${r.borrador.equipment.map(g => `${g.quantity ?? '?'}×${g.modality}`).join(', ') || 'sin equipos'}`);
        return json(res, { id, borrador: r.borrador, descartes: r.descartes, ms: r.ms, modo: r.modo,
          modelo: r.modelo, degradado: r.degradado, aviso: r.aviso, fila: r.fila,
          preguntas: preguntas(r.borrador, { yaContestadas: new Set(Object.keys(respuestas ?? {})) }),
          duplicados: [], sugerencias: [] });   // el teléfono no carga la base instalada: no tiene con qué sugerir
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
  const donde = modelos.delegado ? `delegando al par ${PROVEEDOR.slice(0, 12)}…` : 'solo modelo a bordo';
  console.log(`▸ Nodo ${HARDWARE} · ${donde} · respaldo a bordo: ${modelos.local ? 'sí' : 'NO'}`);
  if (!modelos.delegado && !modelos.local) console.log('▸ ni par ni modelo a bordo: las capturas van a quedar pendientes');
  crearServidor().listen(PUERTO, process.env.ESCUCHAR ?? '127.0.0.1', () => console.log(`▸ Puente en http://localhost:${PUERTO}`));
}
