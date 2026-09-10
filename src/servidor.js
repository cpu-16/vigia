// Servidor de Vigía: sirve la app y expone el flujo del reto.
// La inferencia ocurre aquí (nodo local) o se delega a un par QVAC por llave pública.
// Ninguna ruta llama a un servicio externo: sin red, el nodo sigue respondiendo.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { QWEN3_1_7B_INST_Q4, QWEN3_600M_INST_Q4, WHISPER_LARGE_V3_TURBO } from '@qvac/sdk';
import { cargar, descargar } from './core/runtime.js';
import { cargarVoz, dictar } from './core/voz.js';
import { llaveNodo, sellar, verificar } from './core/sello.js';
import { RUTA as RUTA_RENDIMIENTO, RUN_ID } from './core/rendimiento.js';
import { extraer } from './equipos/extraer.js';
import { consultar, sinVerificar } from './equipos/consulta.js';
import { cargarVista, leerPlaca } from './equipos/placa.js';
import { preguntas, derivar } from './equipos/reglas.js';
import { candidatos } from './equipos/duplicados.js';
import { Base } from './equipos/almacen.js';
import { manejarSucursal, contextoSucursal } from './sucursal/http.js';
import { conRespaldo } from './puente/respaldo.js';

const PUERTO = Number(process.env.PUERTO ?? 7320);
const APP = resolve('app');
const base = new Base(process.env.OBSERVACIONES ?? 'datos/observaciones.jsonl');
const llave = llaveNodo();
const idSolicitud = () => `V-${randomBytes(2).toString('hex').toUpperCase()}`;

// Modelos: el LLM puede correr local o delegado a un par (P2P_PROVEEDOR = llave pública hex).
const PROVEEDOR = process.env.P2P_PROVEEDOR || undefined;
const GGUF = process.env.GGUF_QWEN3_1_7B;
const MODELO_SRC = process.env.MODELO_CHICO ? QWEN3_600M_INST_Q4 : QWEN3_1_7B_INST_Q4;
const MODELO_ETIQUETA = process.env.MODELO_CHICO ? 'Qwen3-0.6B Q4_0' : 'Qwen3-1.7B Q4_0';
let llm = null, voz = null, vozLista = false, vista = null, parCaido = false, respaldo = null;
// El catálogo de productos permite que un código de placa identifique modelo y marca sin IA.
const CATALOGO = existsSync('fixtures/placas/verdad.json')
  ? JSON.parse(await readFile('fixtures/placas/verdad.json', 'utf8')).map(v => ({ gtin: v.gtin, model: v.model, manufacturer: v.manufacturer, modality: v.modality }))
  : [];
// Módulo de sucursal (track 05): reutiliza este mismo LLM ya cargado; no abre un segundo modelo.
const sucursal = contextoSucursal({ llm: () => llm, llave });

// Carga el LLM en ESTE nodo. Con un par configurado se usa además como respaldo: cuando el par
// se cae con el modelo ya cargado, la completion delegada vuelve vacía y hay que recalcular aquí.
// Es perezosa a propósito: cargar el 1.7B en la RTX cuesta VRAM que, mientras el par responda,
// no hace falta gastar.
const cargarLlmLocal = () => cargar({ modelSrc: MODELO_SRC, etiqueta: MODELO_ETIQUETA,
  hardware: process.env.HARDWARE ?? 'laptop-rtx4060', device: process.env.CPU ? 'cpu' : 'gpu',
  ...(GGUF && existsSync(GGUF) ? { fallbackSrc: GGUF } : {}) });

async function arrancar() {
  llm = await cargar({ modelSrc: MODELO_SRC, etiqueta: MODELO_ETIQUETA,
    hardware: process.env.HARDWARE ?? 'laptop-rtx4060', device: process.env.CPU ? 'cpu' : 'gpu',
    ...(GGUF && existsSync(GGUF) ? { fallbackSrc: GGUF } : {}), proveedor: PROVEEDOR });
  console.log(`▸ LLM ${llm.etiqueta} · ${llm.delegado ? `DELEGADO a ${PROVEEDOR.slice(0, 12)}…` : 'local'} · ${llm.device}`);
  try { voz = await cargarVoz({ modelSrc: WHISPER_LARGE_V3_TURBO, etiqueta: 'Whisper large-v3 turbo', hardware: 'laptop-cpu' }); vozLista = true; console.log('▸ Voz lista'); }
  catch (e) { console.log(`▸ Voz no disponible: ${e.message}`); }
  // La vista se carga solo si se pide: son 460M más en la misma tarjeta.
  if (process.env.VISION) { try { vista = await cargarVista(); console.log('▸ VisionPsy listo'); } catch (e) { console.log(`▸ VisionPsy no disponible: ${e.message}`); } }
}

const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const cuerpo = async (req, max = 12e6) => { const p = []; let n = 0; for await (const c of req) { n += c.length; if (n > max) throw new Error('cuerpo muy grande'); p.push(c); } return Buffer.concat(p); };
const cuerpoJson = async req => JSON.parse((await cuerpo(req)).toString('utf8') || '{}');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ruta = url.pathname;
  try {
    // ── app ──
    if (req.method === 'GET' && (ruta === '/' || ruta === '/app')) return archivo(res, 'index.html');
    if (req.method === 'GET' && ruta === '/tablero') return archivo(res, 'tablero.html');
    if (req.method === 'GET' && ruta === '/verificar') return archivo(res, 'verificar.html');
    if (req.method === 'GET' && ruta === '/sucursal') return archivo(res, 'sucursal.html');
    if (req.method === 'GET' && /^\/[\w.-]+$/.test(ruta) && existsSync(join(APP, ruta.slice(1)))) return archivo(res, ruta.slice(1));

    // ── captura ──
    if (req.method === 'POST' && ruta === '/api/dictar') {
      if (!vozLista) return json(res, { error: 'el nodo no tiene el modelo de voz cargado' }, 503);
      const id = url.searchParams.get('id') ?? idSolicitud();
      const bytes = await cuerpo(req);
      if (!bytes.length) return json(res, { error: 'sin audio' }, 400);
      console.log(`▸ [${id}] QVAC transcribe → Whisper (${bytes.length} bytes)`);
      const t = await dictar(bytes, { requestId: id });
      console.log(`▸ [${id}] QVAC transcribe ✓ ${Math.round(t.ms)} ms · «${t.texto.slice(0, 70)}»`);
      return json(res, { ...t, id });
    }

    if (req.method === 'POST' && ruta === '/api/extraer') {
      const { texto, respuestas } = await cuerpoJson(req);
      const id = idSolicitud();
      console.log(`▸ [${id}] QVAC completion → ${llm.etiqueta} en ${llm.delegado ? 'par delegado' : llm.hardware} (json_schema «observacion»)`);
      // Si el par murió con el modelo ya cargado, la completion vuelve VACÍA y sin error: eso se
      // trata como caída y esta laptop recalcula con su propia RTX, diciéndolo. Ver puente/respaldo.js.
      const r = await conRespaldo(texto ?? '', { requestId: id, extraerFn: extraer,
        par: llm?.delegado ? llm : null,
        alCaerElPar: () => { parCaido = true; },
        cargarLocal: async () => {
          if (!parCaido) return llm;                       // sin par configurado: este mismo modelo
          if (respaldo) return respaldo;                   // ya se recargó: una sola vez por sesión
          const t0 = performance.now();
          // Hay que SOLTAR el handle del par muerto antes de pedir el modelo local. El SDK
          // deduplica por `modelSrc`: con el delegado todavía cargado devuelve ESE mismo modelo
          // —medido: `getLoadedModelInfo` seguía diciendo `isDelegated: true` y la completion
          // seguía viniendo vacía—, así que la recarga «local» era mentira.
          await descargar(llm);
          respaldo = await cargarLlmLocal();
          llm = respaldo;
          console.log(`▸ [${id}] el par no respondió: se recargó local en ${Math.round(performance.now() - t0)} ms`);
          return respaldo;
        },
        hayPar: !!PROVEEDOR,
        aviso: 'El par no está a la vista: esta respuesta la calculó la laptop con su propia GPU.' });
      const borrador = aplicarRespuestas(r.borrador, respuestas);
      console.log(`▸ [${id}] QVAC completion ✓ ${r.modo} · ${Math.round(r.ms)} ms · ${borrador.equipment.map(g => `${g.quantity ?? '?'}×${g.modality}`).join(', ') || 'sin equipos'}`);
      return json(res, { id, borrador, descartes: r.descartes, ms: r.ms,
        modo: r.modo, modelo: r.modelo, degradado: r.degradado, aviso: r.aviso,
        preguntas: preguntas(borrador, { yaContestadas: new Set(Object.keys(respuestas ?? {})) }),
        duplicados: dupsDe(borrador), fila: r.fila });
    }

    // ── guardar ──
    if (req.method === 'POST' && ruta === '/api/guardar') {
      const { borrador, observador, directo, fuente, requestId, foto } = await cuerpoJson(req);
      if (!borrador?.customer?.name) return json(res, { error: 'hace falta el hospital' }, 400);
      if (!borrador?.equipment?.length) return json(res, { error: 'no hay equipos que guardar' }, 400);
      const eventos = base.guardar(borrador, { observador, directo, fuente, requestId, foto });
      const acta = sellar({ visita: requestId ?? null, observador: observador ?? null,
        customer: borrador.customer, equipos: eventos.map(e => e.datos), eventos: eventos.map(e => e.id) }, llave, { firmante: observador ?? 'nodo' });
      console.log(`▸ guardadas ${eventos.length} observaciones de «${borrador.customer.name}» · acta ${acta.sello.hash.slice(0, 12)}…`);
      return json(res, { eventos: eventos.length, acta });
    }

    // ── placa: el modelo Psy transcribe, las reglas interpretan ──
    if (req.method === 'POST' && ruta === '/api/placa') {
      if (!vista) return json(res, { error: 'este nodo no tiene el modelo de visión cargado (arranca con VISION=1)' }, 503);
      const bytes = await cuerpo(req);
      if (!bytes.length) return json(res, { error: 'sin imagen' }, 400);
      const id = idSolicitud();
      const tmp = `/tmp/vigia-placa-${id}.png`;
      await writeFile(tmp, bytes);
      console.log(`▸ [${id}] QVAC visión → VisionPsy Nano 460M (${bytes.length} bytes)`);
      const r = await leerPlaca(vista, tmp, { requestId: id, catalogo: CATALOGO });
      console.log(`▸ [${id}] visión ✓ ${Math.round(r.ms)} ms · ${Object.entries(r.campos).map(([k, v]) => `${k}=${v}`).join(' · ') || 'sin campos'}`);
      return json(res, { id, ...r });
    }

    // ── consulta en lenguaje natural sobre el dataset ──
    if (req.method === 'POST' && ruta === '/api/consulta') {
      const { pregunta } = await cuerpoJson(req);
      if (!pregunta?.trim()) return json(res, { error: 'sin pregunta' }, 400);
      const id = idSolicitud();
      console.log(`▸ [${id}] QVAC completion → filtros de consulta («${pregunta.slice(0, 60)}»)`);
      const r = await consultar(llm, pregunta.trim(), base.inventario(), { requestId: id });
      console.log(`▸ [${id}] consulta ✓ ${Math.round(r.ms)} ms · ${r.total_unidades} unidades en ${r.grupos.length} grupo(s)`);
      return json(res, r);
    }
    if (req.method === 'GET' && ruta === '/api/sin-verificar') return json(res, sinVerificar(base.inventario()));

    // ── consulta ──
    if (req.method === 'GET' && ruta === '/api/inventario') return json(res, base.inventario());
    if (req.method === 'GET' && ruta === '/api/cliente360') return json(res, base.cliente360(url.searchParams.get('nombre') ?? ''));
    if (req.method === 'GET' && ruta === '/api/agregado') return json(res, base.agregado(url.searchParams.get('por') ?? 'country'));
    if (req.method === 'GET' && ruta === '/api/renovaciones') return json(res, base.renovaciones());
    if (req.method === 'GET' && ruta === '/api/incompletos') return json(res, base.incompletos());
    if (req.method === 'GET' && ruta === '/api/recientes') return json(res, base.observaciones().slice(-12).reverse());
    if (req.method === 'POST' && ruta === '/api/verificar') return json(res, verificar(await cuerpoJson(req)));

    // ── evidencia técnica: lo que el jurado revisa ──
    // Un modelo por tarea, y cada uno con el hardware donde corrió DE VERDAD: la voz y la visión
    // no salen de esta laptop, y el lenguaje puede estar corriendo en el par de otra casa. Es el
    // punto entero del producto, así que se publica por tarea y no como un solo «modelo».
    if (req.method === 'GET' && ruta === '/api/evidencia') {
      const filas = existsSync(RUTA_RENDIMIENTO) ? (await readFile(RUTA_RENDIMIENTO, 'utf8')).trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
      const inf = filas.filter(f => f.stage === 'completion' && f.status === 'ok');
      return json(res, { run_id: RUN_ID, modelos: modelosPorTarea(), sdk: '@qvac/sdk 0.18.2 (fijada: 0.19.0 quitó la delegación P2P)',
        node: process.version, modelo: llm?.etiqueta, hardware: llm?.hardware,
        modo: parCaido ? 'local (par caído)' : (llm?.delegado ? `delegado a ${PROVEEDOR?.slice(0, 16)}…` : 'local'), voz: vozLista,
        llave_nodo: llave.publica.slice(0, 16) + '…', cadena: base.ev.verificarCadena(),
        inferencias: inf.length,
        ttft_ms_mediana: mediana(inf.map(f => f.ttft_ms)), tps_mediana: mediana(inf.map(f => f.throughput_tps)),
        ultimas: filas.slice(-8).reverse() });
    }

    if (await manejarSucursal(req, res, url, sucursal)) return;

    res.writeHead(404); res.end('no está');
  } catch (e) { console.error('✗', e); json(res, { error: String(e?.message ?? e) }, 500); }
});

async function archivo(res, nombre) {
  const p = join(APP, nombre);
  if (!p.startsWith(APP) || !existsSync(p)) { res.writeHead(404); return res.end('no está'); }
  res.writeHead(200, { 'content-type': TIPOS[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(await readFile(p));
}

// modelosPorTarea(): dónde corre cada modelo en este momento. El lenguaje es el único que
// puede estar en otro equipo; la voz y la visión son de este nodo y su hardware sale de la
// carga real (Whisper va en CPU a propósito: en la RTX pelea VRAM con el LLM y el VLM).
function modelosPorTarea() {
  const modo = parCaido ? 'local (par caído)' : llm?.delegado ? 'delegado' : 'local';
  return [
    { tarea: 'voz', modelo: voz?.etiqueta ?? 'Whisper large-v3 turbo',
      hardware: voz?.hardware ?? 'laptop-cpu', modo: vozLista ? 'local' : 'no cargado' },
    { tarea: 'lenguaje', modelo: llm?.etiqueta ?? MODELO_ETIQUETA,
      hardware: llm?.delegado ? `par ${PROVEEDOR.slice(0, 8)}… (otro equipo)` : (llm?.hardware ?? 'laptop-rtx4060'), modo },
    { tarea: 'visión', modelo: vista?.etiqueta ?? 'VisionPsy Nano 460M Q8_0',
      hardware: vista?.hardware ?? 'laptop-rtx4060', modo: vista ? 'local' : 'no cargado (arranca con VISION=1)' },
  ];
}

const mediana = xs => { const v = xs.filter(x => typeof x === 'number').sort((a, b) => a - b); return v.length ? Math.round(v[Math.floor(v.length / 2)] * 10) / 10 : null; };

// Las respuestas del colaborador pesan más que el modelo: entran tal cual, sin volver a inferir.
function aplicarRespuestas(b, respuestas = {}) {
  const out = structuredClone(b);
  for (const [clave, valor] of Object.entries(respuestas ?? {})) {
    if (valor == null || valor === 'No sé' || valor === '') continue;
    const [campo, g] = clave.split(':');
    const grupo = g === 'null' ? null : out.equipment[Number(g)];
    if (campo === 'customer.name') out.customer.name = valor;
    else if (campo === 'customer.location') { const [ciudad, pais] = String(valor).split(',').map(s => s.trim()); out.customer.city = ciudad ?? null; out.customer.country = pais ?? out.customer.country; }
    else if (!grupo) continue;
    else if (campo === 'modality') grupo.modality = valor;
    else if (campo === 'quantity') grupo.quantity = Number(valor) || null;
    else if (campo === 'manufacturer') grupo.manufacturer = valor;
    else if (campo === 'model') grupo.model = valor;
    else if (campo === 'age') {
      const m = String(valor).match(/(\d+)\s*(?:a|-|to)\s*(\d+)/) ?? String(valor).match(/(\d+)/);
      if (m) { grupo.age_years_min = Number(m[1]); grupo.age_years_max = Number(m[2] ?? m[1]); }
      else if (/nuevo|new/i.test(valor)) { grupo.age_years_min = 0; grupo.age_years_max = 3; }
      else if (/m[aá]s de 10|> ?10/i.test(valor)) { grupo.age_years_min = 10; grupo.age_years_max = 15; }
    }
    if (grupo) grupo.verificado = { ...(grupo.verificado ?? {}), [campo]: 'colaborador' };
  }
  return out;
}

// Duplicados contra lo que ya está guardado, con su explicación campo por campo.
function dupsDe(b) {
  const inv = base.inventario().flatMap(s => s.equipos.map(e => ({ site: { name: s.customer?.name, country: s.customer?.country },
    modality: e.modality, manufacturer: e.manufacturer, model: e.model, quantity: e.quantity,
    age: { min: e.age_years_min, max: e.age_years_max }, _resumen: `${e.quantity ?? '?'}×${e.modality} en ${s.customer?.name}` })));
  return (b.equipment ?? []).flatMap((g, i) => candidatos({ site: { name: b.customer?.name, country: b.customer?.country },
    modality: g.modality, manufacturer: g.manufacturer, model: g.model, quantity: g.quantity,
    age: { min: g.age_years_min, max: g.age_years_max } }, inv)
    .slice(0, 1).map(c => ({ grupo: i, p: c.p, veredicto: c.veredicto, contra: c.existente._resumen, detalle: c.detalle })));
}

await arrancar();
servidor.listen(PUERTO, () => console.log(`▸ Vigía en http://localhost:${PUERTO}  ·  tablero en /tablero`));
process.on('SIGINT', async () => { if (llm) await descargar(llm); process.exit(0); });
