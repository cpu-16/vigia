// Servidor de Vigía: sirve la app y expone el flujo del reto.
// La inferencia ocurre aquí (nodo local) o se delega a un par QVAC por llave pública.
// Ninguna ruta llama a un servicio externo: sin red, el nodo sigue respondiendo.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { QWEN3_1_7B_INST_Q4, QWEN3_600M_INST_Q4, WHISPER_LARGE_V3_TURBO } from '@qvac/sdk';
import { cargar, descargar } from './core/runtime.js';
import { crearSintesis } from './core/sintesis.js';
import { cargarVoz, dictar } from './core/voz.js';
import { llaveNodo, sellar, verificar } from './core/sello.js';
import { RUTA as RUTA_RENDIMIENTO, RUN_ID, sinContenido } from './core/rendimiento.js';
import { extraer } from './equipos/extraer.js';
import { consultar, sinVerificar } from './equipos/consulta.js';
import { cargarVista, mirar } from './equipos/placa.js';
import { aplicarRespuestas } from './equipos/revision.js';
import { preguntas, derivar, interpretarEdad } from './equipos/reglas.js';
import { candidatos, aplanar, sugerencias } from './equipos/duplicados.js';
import { Base } from './equipos/almacen.js';
import { manejarSucursal, contextoSucursal } from './sucursal/http.js';
import { crearEjecutor } from './puente/respaldo.js';

const sintesis = crearSintesis();
const PUERTO = Number(process.env.PUERTO ?? 7320);
const APP = resolve('app');
const PLACAS = resolve('fixtures/placas');
const base = new Base(process.env.OBSERVACIONES ?? 'datos/observaciones.jsonl');
const llave = llaveNodo();
const idSolicitud = () => `V-${randomBytes(2).toString('hex').toUpperCase()}`;

// Modelos: el LLM puede correr local o delegado a un par (P2P_PROVEEDOR = llave pública hex).
const PROVEEDOR = process.env.P2P_PROVEEDOR || undefined;
// Whisper va donde quepa: con el lenguaje delegado a un par la RTX está casi vacía y la
// transcripción baja de 24.8 s a 0.94 s (control de 9.4 s, medido el 9-sep). Con el LLM local
// se queda en CPU para no pelear VRAM con él y con el VLM. `VOZ=gpu|cpu` manda sobre esto.
const VOZ_DEVICE = process.env.CPU ? 'cpu' : (process.env.VOZ ?? (PROVEEDOR ? 'gpu' : 'cpu'));
const GGUF = process.env.GGUF_QWEN3_1_7B;
const MODELO_SRC = process.env.MODELO_CHICO ? QWEN3_600M_INST_Q4 : QWEN3_1_7B_INST_Q4;
const MODELO_ETIQUETA = process.env.MODELO_CHICO ? 'Qwen3-0.6B Q4_0' : 'Qwen3-1.7B Q4_0';
let llm = null, voz = null, vozLista = false, vista = null, parCaido = false, respaldo = null;
// El catálogo de productos permite que un código de placa identifique modelo y marca sin IA.
const CATALOGO = existsSync('fixtures/placas/verdad.json')
  ? JSON.parse(await readFile('fixtures/placas/verdad.json', 'utf8')).map(v => ({ gtin: v.gtin, model: v.model, manufacturer: v.manufacturer, modality: v.modality }))
  : [];
// Módulo de sucursal (track 05): reutiliza este mismo LLM ya cargado; no abre un segundo modelo.
const ejecutarLlm = crearEjecutor({ obtenerModelo: () => llm, alCaer: () => { parCaido = true; },
  cargarLocal: async () => { await descargar(llm); respaldo = await cargarLlmLocal(); llm = respaldo; return llm; } });
const sucursal = contextoSucursal({ llm: () => llm, llave, ejecutar: ejecutarLlm });

// Carga el LLM en ESTE nodo. Con un par configurado se usa además como respaldo: cuando el par
// se cae con el modelo ya cargado, la completion delegada vuelve vacía y hay que recalcular aquí.
// Es perezosa a propósito: cargar el 1.7B en la RTX cuesta VRAM que, mientras el par responda,
// no hace falta gastar.
const cargarLlmLocal = () => cargar({ modelSrc: MODELO_SRC, etiqueta: MODELO_ETIQUETA,
  hardware: process.env.HARDWARE ?? (process.env.CPU ? 'laptop-cpu' : 'laptop-rtx4060'), device: process.env.CPU ? 'cpu' : 'gpu',
  ...(GGUF && existsSync(GGUF) ? { fallbackSrc: GGUF } : {}) });

async function arrancar() {
  llm = await cargar({ modelSrc: MODELO_SRC, etiqueta: MODELO_ETIQUETA,
    hardware: process.env.HARDWARE ?? (process.env.CPU ? 'laptop-cpu' : 'laptop-rtx4060'), device: process.env.CPU ? 'cpu' : 'gpu',
    ...(GGUF && existsSync(GGUF) ? { fallbackSrc: GGUF } : {}), proveedor: PROVEEDOR });
  console.log(`▸ LLM ${llm.etiqueta} · ${llm.delegado ? `DELEGADO a ${PROVEEDOR.slice(0, 12)}…` : 'local'} · ${llm.device}`);
  // La voz va en CPU por defecto para no pelear VRAM con el LLM y el VLM. Con el lenguaje
  // delegado a un par, la tarjeta queda casi vacía: `VOZ=gpu` la mueve ahí.
  try { voz = await cargarVoz({ modelSrc: WHISPER_LARGE_V3_TURBO, etiqueta: 'Whisper large-v3 turbo',
          device: VOZ_DEVICE, hardware: VOZ_DEVICE === 'gpu' ? (process.env.HARDWARE ?? 'laptop-rtx4060') : 'laptop-cpu' });
        vozLista = true; console.log(`▸ Voz lista · ${VOZ_DEVICE}`); }
  catch (e) { console.log(`▸ Voz no disponible: ${e.message}`); }
  // La vista se carga solo si se pide: son 460M más en la misma tarjeta.
  if (process.env.VISION) { try { vista = await cargarVista({ device: process.env.CPU ? 'cpu' : 'gpu', hardware: process.env.HARDWARE ?? (process.env.CPU ? 'laptop-cpu' : 'laptop-rtx4060') }); console.log('▸ VisionPsy listo'); } catch (e) { console.log(`▸ VisionPsy no disponible: ${e.message}`); } }
}

const json = (res, obj, code = 200) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
const cuerpo = async (req, max = 12e6) => { const p = []; let n = 0; for await (const c of req) { n += c.length; if (n > max) throw new Error('cuerpo muy grande'); p.push(c); } return Buffer.concat(p); };
const cuerpoJson = async (req, max) => JSON.parse((await cuerpo(req, max)).toString('utf8') || '{}');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

// ── clave de equipo (opcional) ─────────────────────────────────────────────────────────────
// Con `CLAVE` definida el nodo queda cerrado: TODA ruta —páginas y `/api/*`— exige la cookie
// `vigia`. Es lo que permite publicar la app por el Funnel de Tailscale sin dejarla abierta.
// Sin `CLAVE`, el nodo se comporta exactamente como antes: la laptop y el teléfono no cambian.
// Sin excepción para `localhost` a propósito: una excepción por origen es justo lo que se cuela
// por el túnel, porque al nodo la petición del Funnel le llega igual de local.
const CLAVE = process.env.CLAVE || null;
const INICIO_APP = ['/','/inicio','/equipos'].includes(process.env.INICIO_APP) ? process.env.INICIO_APP : '/';
const GALLETA = CLAVE ? `vigia=${encodeURIComponent(CLAVE)}` : null;
const conClave = req => (req.headers.cookie ?? '').split(';').some(c => c.trim() === GALLETA);

// La página de entrada usa los mismos tokens de la app (papel cálido, tinta azul profunda,
// turquesa solo para la acción); es una sola pantalla, así que va escrita aquí y no en `app/`.
const paginaEntrar = (res, { aviso = null, code = 200 } = {}) => {
  res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(`<!doctype html><html lang="es"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Vigía · entrar</title>
<style>
 :root{--papel:#F3EFE6;--papel-alto:#FBF9F4;--tinta:#16262E;--tinta-suave:#5C6B72;--raya:#DED7C7;
       --accion:#0F7B85;--alerta:#9C4221;--serif:"Iowan Old Style",Georgia,"Times New Roman",serif}
 *{box-sizing:border-box}
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--papel);color:var(--tinta);
      font:16px/1.55 system-ui,-apple-system,sans-serif;padding:24px}
 form{background:var(--papel-alto);border:1px solid var(--raya);border-radius:16px;padding:30px 28px;
      width:min(370px,100%);box-shadow:0 1px 0 var(--raya)}
 h1{font:400 30px/1 var(--serif);margin:0 0 4px}
 p{margin:0 0 22px;color:var(--tinta-suave);font-size:13.5px}
 label{display:block;font:600 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:var(--tinta-suave);margin-bottom:7px}
 input{width:100%;padding:12px 14px;font:16px system-ui;color:var(--tinta);background:var(--papel);
       border:1px solid var(--raya);border-radius:10px}
 input:focus{outline:2px solid var(--accion);outline-offset:1px;border-color:var(--accion)}
 button{width:100%;margin-top:16px;padding:13px;font:600 15px system-ui;color:var(--papel-alto);
        background:var(--accion);border:0;border-radius:10px;cursor:pointer}
 button:hover{filter:brightness(1.08)}
 .aviso{margin:14px 0 0;color:var(--alerta);font-size:13.5px}
</style>
<form method="post" action="/entrar">
  <h1>Vigía</h1>
  <p>${process.env.MODO_EVALUACION === '1' ? 'Acceso para evaluadores · ciberpty. Prueba con datos ficticios; la inferencia se ejecuta en la GPU de Fedora.' : 'Clave del equipo para entrar a este nodo.'}</p>
  <label for="clave">Clave</label>
  <input id="clave" name="clave" type="password" autocomplete="current-password" autofocus required>
  <button type="submit">Entrar</button>
  ${aviso ? `<p class="aviso">${aviso}</p>` : ''}
</form>`);
};

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ruta = url.pathname;
  try {
    // ── puerta ──
    if (CLAVE && !conClave(req)) {
      if (req.method === 'GET' && ruta === '/entrar') return paginaEntrar(res);
      if (req.method === 'POST' && ruta === '/entrar') {
        const enviada = new URLSearchParams((await cuerpo(req, 4096)).toString('utf8')).get('clave');
        if (enviada !== CLAVE) return paginaEntrar(res, { aviso: 'Esa no es la clave del equipo.', code: 401 });
        res.writeHead(303, { location: INICIO_APP, 'set-cookie': `${GALLETA}; Path=/; Max-Age=${30 * 24 * 3600}; HttpOnly; SameSite=Lax${process.env.COOKIE_SEGURA === '1' ? '; Secure' : ''}` });
        return res.end();
      }
      // La app pide en JSON y las páginas se navegan: cada una recibe lo que sabe leer.
      if (ruta.startsWith('/api/')) return json(res, { error: 'hace falta la clave del equipo' }, 401);
      res.writeHead(303, { location: '/entrar' }); return res.end();
    }
    if (CLAVE && ruta === '/entrar') { res.writeHead(303, { location: INICIO_APP }); return res.end(); }

    // ── app ──
    // `/` es la portada del producto (los tres espacios); la app de campo vive en `/equipos`.
    // `/app` se conserva porque es lo que quedó instalado en el teléfono.
    if (req.method === 'GET' && ['/revision.js', '/reglas.js', '/esquema.js'].includes(ruta)) return archivoDe(res, resolve('src/equipos'), ruta.slice(1));
    if (req.method === 'GET' && ['/', '/inicio'].includes(ruta)) return archivo(res, 'inicio.html');
    if (req.method === 'GET' && (ruta === '/equipos' || ruta === '/app')) return archivo(res, 'index.html');
    if (req.method === 'GET' && ruta === '/tablero') return archivo(res, 'tablero.html');
    if (req.method === 'GET' && ruta === '/verificar') return archivo(res, 'verificar.html');
    if (req.method === 'GET' && ruta === '/sucursal') return archivo(res, 'sucursal.html');
    if (req.method === 'GET' && /^\/[\w.-]+$/.test(ruta) && existsSync(join(APP, ruta.slice(1)))) return archivo(res, ruta.slice(1));
    if (req.method === 'GET' && /^\/placas\/[\w-]+\.png$/.test(ruta)) return archivoDe(res, PLACAS, ruta.slice(8));

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
      const { texto, respuestas, origenes } = await cuerpoJson(req);
      const id = idSolicitud();
      console.log(`▸ [${id}] QVAC completion → ${llm.etiqueta} en ${llm.delegado ? 'par delegado' : llm.hardware} (json_schema «observacion»)`);
      // Si el par murió con el modelo ya cargado, la completion vuelve VACÍA y sin error: eso se
      // trata como caída y esta laptop recalcula con su propia RTX, diciéndolo. Ver puente/respaldo.js.
      const r = await ejecutarLlm(m => extraer(m, texto ?? '', { requestId: id }));
      const borrador = aplicarRespuestas(r.borrador, respuestas, origenes);
      console.log(`▸ [${id}] QVAC completion ✓ ${r.modo} · ${Math.round(r.ms)} ms · ${borrador.equipment.map(g => `${g.quantity ?? '?'}×${g.modality}`).join(', ') || 'sin equipos'}`);
      return json(res, { id, borrador, descartes: r.descartes, ms: r.ms,
        modo: r.modo, modelo: r.modelo, degradado: r.degradado, aviso: r.aviso,
        preguntas: preguntas(borrador, { yaContestadas: new Set(Object.keys(respuestas ?? {})) }),
        duplicados: dupsDe(borrador), sugerencias: sugerencias(borrador, base.inventario()), fila: r.fila });
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
      const temporal = await mkdtemp(join(tmpdir(), 'vigia-placa-'));
      const tmp = join(temporal, 'imagen.png');
      try {
      await writeFile(tmp, bytes);
      console.log(`▸ [${id}] QVAC visión → VisionPsy Nano 460M (${bytes.length} bytes)`);
      const r = await mirar(vista, tmp, { requestId: id, catalogo: CATALOGO });
      console.log(`▸ [${id}] visión ✓ ${r.modo} · ${Math.round(r.ms)} ms · ${Object.entries(r.campos).map(([k, v]) => `${k}=${v}`).join(' · ') || r.descripcion || 'sin campos'}`);
      return json(res, { id, ...r });
      } finally { await rm(temporal, { recursive: true, force: true }); }
    }

    // ── consulta en lenguaje natural sobre el dataset ──
    if (req.method === 'POST' && ruta === '/api/consulta') {
      const { pregunta } = await cuerpoJson(req);
      if (!pregunta?.trim()) return json(res, { error: 'sin pregunta' }, 400);
      const id = idSolicitud();
      console.log(`▸ [${id}] QVAC completion → filtros de consulta («${pregunta.slice(0, 60)}»)`);
      const r = await ejecutarLlm(m => consultar(m, pregunta.trim(), base.inventario(), { requestId: id }));
      console.log(`▸ [${id}] consulta ✓ ${Math.round(r.ms)} ms · ${r.total_unidades} unidades en ${r.grupos.length} grupo(s)`);
      return json(res, r);
    }
    if (req.method === 'GET' && ruta === '/api/sin-verificar') return json(res, sinVerificar(base.inventario()));

    if (req.method === 'GET' && ruta === '/api/hablar') return json(res, sintesis.estado());
    if (req.method === 'POST' && ruta === '/api/hablar') {
      try {
        const { texto } = await cuerpoJson(req, 4096);
        const audio = await sintesis.hablar(texto);
        if (res.destroyed) return;
        res.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'no-store', 'content-length': audio.wav.length,
          'x-vigia-modelo': 'Supertonic2-Q8-GPU', 'x-vigia-ms': String(audio.ms), 'x-vigia-cache': String(audio.cache) });
        return res.end(audio.wav);
      } catch (e) { return json(res, { error: e.message }, e.status ?? 503); }
    }

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
      const actuales = filas.filter(f => f.run_id === RUN_ID);
      const inf = actuales.filter(f => f.stage === 'completion' && f.status === 'ok');
      return json(res, { run_id: RUN_ID, modelos: modelosPorTarea(), sdk: '@qvac/sdk 0.18.2 (fijada: 0.19.0 quitó la delegación P2P)',
        node: process.version, modelo: llm?.etiqueta, hardware: llm?.hardware,
        modo: parCaido ? 'local (par caído)' : (llm?.delegado ? `delegado a ${PROVEEDOR?.slice(0, 16)}…` : 'local'), voz: vozLista,
        llave_nodo: llave.publica.slice(0, 16) + '…', cadena: base.ev.verificarCadena(),
        inferencias: inf.length,
        ttft_ms_mediana: mediana(inf.map(f => f.ttft_ms)), tps_mediana: mediana(inf.map(f => f.throughput_tps)),
        ultimas: actuales.slice(-8).reverse().map(sinContenido) });
    }

    if (await manejarSucursal(req, res, url, sucursal)) return;

    res.writeHead(404); res.end('no está');
  } catch (e) { console.error('✗', e); json(res, { error: String(e?.message ?? e) }, 500); }
});

const archivo = (res, nombre) => archivoDe(res, APP, nombre);

async function archivoDe(res, dir, nombre) {
  const p = join(dir, nombre);
  if (!p.startsWith(dir) || !existsSync(p)) { res.writeHead(404); return res.end('no está'); }
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
    { tarea: 'lectura', modelo: sintesis.estado().modelo, hardware: sintesis.estado().hardware, modo: sintesis.estado().cargado ? 'local' : 'local · carga al escuchar' },
    { tarea: 'visión', modelo: vista?.etiqueta ?? 'VisionPsy Nano 460M Q8_0',
      hardware: vista?.hardware ?? 'laptop-rtx4060', modo: vista ? 'local' : 'no cargado (arranca con VISION=1)' },
  ];
}

const mediana = xs => { const v = xs.filter(x => typeof x === 'number').sort((a, b) => a - b); return v.length ? Math.round(v[Math.floor(v.length / 2)] * 10) / 10 : null; };

// Las respuestas del colaborador pesan más que el modelo: entran tal cual, sin volver a inferir.
// Duplicados contra lo que ya está guardado, con su explicación campo por campo.
function dupsDe(b) {
  const inv = aplanar(base.inventario());
  return (b.equipment ?? []).flatMap((g, i) => candidatos({ site: { name: b.customer?.name, country: b.customer?.country },
    modality: g.modality, manufacturer: g.manufacturer, model: g.model, quantity: g.quantity,
    age: { min: g.age_years_min, max: g.age_years_max } }, inv)
    .slice(0, 1).map(c => ({ grupo: i, p: c.p, veredicto: c.veredicto, contra: c.existente._resumen, detalle: c.detalle })));
}

await arrancar();
servidor.listen(PUERTO, process.env.ESCUCHAR ?? '127.0.0.1', () => console.log(`▸ Vigía en http://localhost:${PUERTO}  ·  tablero en /tablero`));
process.on('SIGINT', async () => { await sintesis.cerrar(); if (llm) await descargar(llm); process.exit(0); });
