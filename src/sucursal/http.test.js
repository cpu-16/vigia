// El flujo de sucursal por HTTP real, sin modelo: el `responder` de mentira devuelve una
// respuesta con respaldo o una abstención según lo que se pregunte, y el expediente vive en un
// directorio temporal. Lo que se comprueba es el contrato del servidor —qué acepta, qué código
// devuelve y qué acaba dentro del acta—, no la calidad de la inferencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { manejarSucursal } from './http.js';
import { Expediente } from './expediente.js';
import { llaveNodo, verificar } from '../core/sello.js';

const SECCION = 'RET-ISL-01 — Modo isla: retiro sin enlace al CORE';
const PASOS = [
  '## RET-ISL-01 — Modo isla: retiro sin enlace al CORE',
  '1. Confirmar con el supervisor la caída del enlace al CORE y abrir el expediente local.',
  '4. Completar el formulario RET-ISL-01 con folio, hora, monto y motivo.',
  'El tope es B/. 100.00 por cliente y por día, sumando todos los retiros documentados.',
];
const cubierta = () => ({ cubierto: true, pasos: PASOS, citas: [{ seccion: SECCION, texto: PASOS.join('\n') }],
  limite: 'B/. 100.00', limite_origen: 'cita del modelo, verificada', codigo: 'RET-ISL-01', abstencion: null, ms: 12, id: 'V-TEST' });
const abstenida = () => ({ cubierto: false, pasos: [], citas: [], limite: null, codigo: null,
  abstencion: { motivo: 'sin respaldo en la guía' }, ms: 9, id: 'V-TEST' });

// Un servidor efímero con el manejador real montado tal como lo monta src/servidor.js.
function levantar(ctx) {
  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (await manejarSucursal(req, res, url, ctx)) return;
    res.writeHead(404); res.end('no está');
  });
  return new Promise(ok => servidor.listen(0, '127.0.0.1', () => ok({ servidor, puerto: servidor.address().port })));
}
const pedir = (puerto, metodo, ruta, cuerpo) => new Promise((ok, falla) => {
  const req = request({ host: '127.0.0.1', port: puerto, method: metodo, path: ruta,
    headers: cuerpo === undefined ? {} : { 'content-type': 'application/json' } }, res => {
    let t = ''; res.setEncoding('utf8');
    res.on('data', c => t += c);
    res.on('end', () => { let datos = null; try { datos = JSON.parse(t); } catch {} ok({ code: res.statusCode, datos, cabeceras: res.headers, texto: t }); });
  });
  req.on('error', falla);
  req.end(cuerpo === undefined ? undefined : JSON.stringify(cuerpo));
});

test('sucursal por HTTP: consulta, expediente, acta verificable y los errores', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vigia-sucursal-'));
  const ctx = {
    expedientes: new Expediente(join(dir, 'sucursal.jsonl')),
    llave: llaveNodo(join(dir, 'llave.pem')),
    responder: async consulta => /retiro|core/i.test(consulta) ? cubierta() : abstenida(),
    estado: () => ({ disponible: true, guia: { nombre: 'Guía BPL — demostración sintética', version: '2026-09-09' }, ejecucion: 'local', hardware: 'prueba' }),
  };
  const { servidor, puerto } = await levantar(ctx);
  try {
    const estado = await pedir(puerto, 'GET', '/api/sucursal/estado');
    assert.equal(estado.code, 200);
    assert.equal(estado.datos.disponible, true);

    // Una abstención es una respuesta correcta: 200, sin pasos y con su motivo.
    const fuera = await pedir(puerto, 'POST', '/api/sucursal/consulta', { consulta: '¿Qué tasa le ofrezco para un préstamo hipotecario?' });
    assert.equal(fuera.code, 200);
    assert.equal(fuera.datos.cubierto, false);
    assert.equal(fuera.datos.pasos.length, 0);
    assert.ok(fuera.datos.abstencion.motivo);
    assert.ok(fuera.datos.consultaId);
    assert.equal((await pedir(puerto, 'POST', '/api/sucursal/consulta', { consulta: '   ' })).code, 400);

    const consulta = await pedir(puerto, 'POST', '/api/sucursal/consulta', { consulta: 'Sin enlace al CORE, ¿cómo documento un retiro y cuál es el tope?' });
    assert.equal(consulta.code, 200);
    assert.equal(consulta.datos.codigo, 'RET-ISL-01');
    assert.equal(consulta.datos.limite, 'B/. 100.00');
    const consultaId = consulta.datos.consultaId;

    // Abrir sin una consulta validada por este proceso: 400.
    assert.equal((await pedir(puerto, 'POST', '/api/sucursal/expedientes', { sucursal: 'S', empleado: 'E', consultaId: 'inventado' })).code, 400);
    assert.equal((await pedir(puerto, 'POST', '/api/sucursal/expedientes', { sucursal: '', empleado: 'E', consultaId })).code, 400);

    const abierto = await pedir(puerto, 'POST', '/api/sucursal/expedientes',
      { sucursal: 'Sucursal Ficticia Isla', empleado: 'Empleado Ficticio A', consultaId });
    assert.equal(abierto.code, 201);
    const id = abierto.datos.expediente.id;
    assert.equal(abierto.datos.expediente.estado, 'abierto');
    // El motivo lo pone el servidor desde la consulta guardada.
    assert.match(abierto.datos.expediente.motivo, /Sin enlace al CORE/);

    assert.equal((await pedir(puerto, 'GET', '/api/sucursal/expedientes/no-existe-1234')).code, 404);
    assert.equal((await pedir(puerto, 'GET', `/api/sucursal/expedientes/${id}/acta`)).code, 409);

    // El paso se identifica por su índice en la respuesta conservada; el texto lo pone el servidor.
    assert.equal((await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/pasos`, { consultaId, indicePaso: 99 })).code, 400);
    const paso = await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/pasos`, { consultaId, indicePaso: 2 });
    assert.equal(paso.code, 200);
    assert.equal(paso.datos.expediente.estado, 'en_proceso');
    assert.equal(paso.datos.expediente.pasos[0].paso, 'Completar el formulario RET-ISL-01 con folio, hora, monto y motivo.');
    assert.equal(paso.datos.expediente.pasos[0].cita.seccion, SECCION);
    assert.ok(PASOS.includes(paso.datos.expediente.pasos[0].cita.texto), 'la cita es una línea literal de la guía');

    assert.equal((await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/datos`, { campo: 'tasa', valor: '9%' })).code, 400);
    assert.equal((await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/datos`, { campo: 'folio', valor: '' })).code, 400);
    const dato = await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/datos`, { campo: 'folio', valor: 'ISLA-20260909-FICTICIA-001' });
    assert.equal(dato.code, 200);
    assert.equal(dato.datos.expediente.datos.folio, 'ISLA-20260909-FICTICIA-001');
    assert.equal((await pedir(puerto, 'POST', '/api/sucursal/expedientes/no-existe-1234/datos', { campo: 'folio', valor: 'X' })).code, 404);

    const cierre = await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/cerrar`);
    assert.equal(cierre.code, 200);
    assert.equal(cierre.datos.expediente.estado, 'cerrado');
    assert.equal(verificar(cierre.datos.acta).valido, true);
    assert.equal(verificar({ ...cierre.datos.acta, motivo: 'Alterado' }).valido, false);

    // Cerrar dos veces devuelve el acta que ya existe, no una nueva.
    const otra = await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/cerrar`);
    assert.equal(otra.code, 200);
    assert.deepEqual(otra.datos.acta, cierre.datos.acta);

    // Un expediente cerrado no admite más actuaciones ni datos.
    const tarde = await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/pasos`, { consultaId, indicePaso: 1 });
    assert.equal(tarde.code, 409);
    assert.equal(tarde.datos.error.codigo, 'transicion_incompatible');
    assert.equal((await pedir(puerto, 'POST', `/api/sucursal/expedientes/${id}/datos`, { campo: 'monto', valor: 'B/. 80.00' })).code, 409);

    const acta = await pedir(puerto, 'GET', `/api/sucursal/expedientes/${id}/acta`);
    assert.equal(acta.code, 200);
    assert.match(acta.cabeceras['content-disposition'] ?? '', /attachment/);
    assert.equal(verificar(acta.datos).valido, true);
    assert.equal(acta.datos.datos.folio, 'ISLA-20260909-FICTICIA-001');

    const inventada = await pedir(puerto, 'GET', '/api/sucursal/loquesea');
    assert.equal(inventada.code, 404);
    assert.equal(inventada.datos.error.codigo, 'ruta_inexistente');
  } finally {
    servidor.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sin modelo cargado, la consulta responde 503 y no rompe el resto', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vigia-sucursal-'));
  const ctx = { expedientes: new Expediente(join(dir, 'sucursal.jsonl')), llave: llaveNodo(join(dir, 'llave.pem')), responder: () => null };
  const { servidor, puerto } = await levantar(ctx);
  try {
    const r = await pedir(puerto, 'POST', '/api/sucursal/consulta', { consulta: '¿Cuál es el tope de retiro en modo isla?' });
    assert.equal(r.code, 503);
    assert.equal(r.datos.error.codigo, 'modelo_no_disponible');
    const estado = await pedir(puerto, 'GET', '/api/sucursal/estado');
    assert.equal(estado.code, 200);
    assert.equal(estado.datos.disponible, true);   // hay responder inyectado; la salud del CORE no se declara aquí
  } finally {
    servidor.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
