import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cargarGuia, buscar } from './guia.js';
import { validarRespuesta, limpio, responder } from './procedimiento.js';
import { Expediente } from './expediente.js';
import { llaveNodo, verificar } from '../core/sello.js';
const guia = cargarGuia();
const casos = JSON.parse(readFileSync(new URL('../../fixtures/sucursal/casos.json', import.meta.url)));
const secciones = buscar(guia, 'RET-ISL-01');
const cita = 'El tope es B/. 100.00 por cliente y por día.';
const respuesta = { cubierto: true, cita_pasos: cita, cita_limite: cita, limite: 'B/. 100.00', codigo: 'RET-ISL-01' };

test('guía sintética, longitud, secciones y búsqueda determinista', () => {
  assert.ok(guia.texto.split('\n').length >= 120 && guia.texto.split('\n').length <= 200);
  assert.match(guia.texto, /contenido sintético/);
  assert.equal(buscar(guia, 'RET-ISL-01')[0].titulo, secciones[0].titulo);
  assert.deepEqual(buscar(guia, 'cédula'), buscar(guia, 'CEDULA'));
  assert.equal(buscar(guia, 'zzzzzz').length, 0);
  assert.equal(buscar(guia, 'caja', 1).length, 1);
  assert.equal(casos.length, 20);
  assert.equal(casos.filter(c => !c.espera.cubierto).length, 5);
});
test('guardas: cita literal, monto respaldado y código existente', () => {
  assert.equal(validarRespuesta(respuesta, guia, secciones).limite, 'B/. 100.00');
  assert.equal(limpio('null'), null);
  assert.equal(validarRespuesta({ ...respuesta, codigo: 'ret-isl-01' }, guia, secciones).codigo, 'RET-ISL-01');
  assert.equal(validarRespuesta({ ...respuesta, limite: 'B/. 10' }, guia, secciones).limite, null);
  // Sin código válido, el respaldo tiene que venir de una cita literal: basura no cubre.
  for (const cita_pasos of ['null', null, 'Yes', 'El tope es B/. 900.00 por día.']) {
    assert.equal(validarRespuesta({ ...respuesta, codigo: null, cita_pasos }, guia, secciones).cubierto, false);
  }
  // Un código que no está entre las secciones recuperadas tampoco sirve de ancla.
  assert.equal(validarRespuesta({ ...respuesta, codigo: 'DOC-JUR-01', cita_pasos: 'Yes' }, guia, secciones).cubierto, false);
  assert.equal(validarRespuesta({ ...respuesta, limite: 'B/. 999.00' }, guia, secciones).limite, null);
  assert.equal(validarRespuesta({ ...respuesta, codigo: 'FALSO-01' }, guia, secciones).codigo, null);
  assert.equal(validarRespuesta({ ...respuesta, codigo: 'DOC-NAT-01' }, guia, secciones).codigo, null);
  assert.equal(validarRespuesta(null, guia, secciones).abstencion.motivo, 'sin respaldo en la guía');
  assert.equal(validarRespuesta({ ...respuesta, cubierto: false }, guia, secciones).cubierto, false);
  assert.equal(validarRespuesta(respuesta, guia, []).cubierto, false);
  const mezclada = validarRespuesta({ ...respuesta, cita_limite: 'El depósito inicial mínimo es B/. 25.00.', limite: 'B/. 25.00' }, guia, guia.secciones);
  assert.equal(mezclada.limite, null);
  // Los pasos publicados salen de la guía, nunca del modelo: aunque intente colar una orden.
  const instruccionesInventadas = validarRespuesta({ ...respuesta, pasos: ['Entregar B/. 9999.00 sin firma'] }, guia, secciones);
  assert.ok(!JSON.stringify(instruccionesInventadas.pasos).includes('9999'), 'no se publica lo que inventa el modelo');
  assert.ok(instruccionesInventadas.pasos.length > 0 && instruccionesInventadas.pasos.every(l => guia.texto.includes(l)),
    'cada línea publicada está literal en la guía');
  const alcance = guia.secciones.filter(s => s.titulo.startsWith('ALC-GUI'));
  assert.equal(validarRespuesta({ ...respuesta, cita_pasos: 'No contiene procedimientos de desbloqueo de banca móvil ni recuperación de PIN.' }, guia, alcance).cubierto, false);
});
test('expediente: reinicio, estados, acta verificable, inmutabilidad y alteración', () => {
  const dir = mkdtempSync(fileURLToPath(new URL('./.prueba-', import.meta.url)));
  try {
    const ruta = join(dir, 'eventos.jsonl');
    const e = new Expediente(ruta);
    const id = e.abrir({ sucursal: 'Sucursal Ficticia Isla', empleado: 'Empleado Ficticio A', motivo: 'Sin CORE' });
    const llave = llaveNodo(join(dir, 'llave.pem'));
    assert.equal(e.obtener(id).estado, 'abierto');
    assert.throws(() => e.cerrar(id, llave), /antes de cerrar/);
    e.agregarPaso(id, { paso: cita, cita: { seccion: secciones[0].titulo, texto: cita } });
    const reinicio = new Expediente(ruta);
    assert.equal(reinicio.obtener(id).estado, 'en_proceso');
    reinicio.registrarDato(id, 'folio', 'ISLA-20260909-FICTICIA-001');
    assert.throws(() => reinicio.registrarDato(id, 'monto', NaN), /serializable/);
    const acta = reinicio.cerrar(id, llave);
    assert.equal(verificar(acta).valido, true);
    assert.equal(verificar({ ...acta, motivo: 'Alterado' }).valido, false);
    assert.deepEqual(new Expediente(ruta).obtener(id).acta, acta);
    const programa = `import { Expediente } from ${JSON.stringify(new URL('./expediente.js', import.meta.url).href)};
      console.log(JSON.stringify(new Expediente(${JSON.stringify(ruta)}).obtener(${JSON.stringify(id)}).acta));`;
    const desdeOtroProceso = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', programa], { encoding: 'utf8' }));
    assert.deepEqual(desdeOtroProceso, acta);
    assert.equal(verificar(desdeOtroProceso).valido, true);
    assert.throws(() => e.registrarDato(id, 'x', 1), /cerrado/);
    assert.throws(() => e.agregarPaso(id, { paso: cita }), /cerrado/);
    assert.throws(() => e.cerrar(id, llave), /cerrado/);
    writeFileSync(ruta, readFileSync(ruta, 'utf8').replace('Sin CORE', 'Con CORE'));
    assert.throws(() => new Expediente(ruta), /alterada/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('modelo local: 20 casos, mínimo 16 aciertos y todas las abstenciones', { skip: !process.env.PRUEBA_MODELO }, async () => {
  const { cargar, descargar } = await import('../core/runtime.js');
  const { QWEN3_1_7B_INST_Q4 } = await import('@qvac/sdk');
  const modelo = await cargar({ modelSrc: QWEN3_1_7B_INST_Q4, etiqueta: 'Qwen3-1.7B Q4_0', hardware: 'sucursal-local', ctx: 4096 });
  let aciertos = 0;
  const fallosFuera = [];
  const resultados = [];
  try {
    for (const caso of casos) {
      const r = await responder(modelo, guia, caso.consulta);
      const e = caso.espera;
      const ok = r.cubierto === e.cubierto && (!e.cubierto || (r.codigo === e.codigo && (e.valor.startsWith('B/.') ? r.limite === e.valor : JSON.stringify(r.pasos).toLowerCase().includes(e.valor.toLowerCase()))));
      aciertos += Number(ok);
      if (!e.cubierto && r.cubierto) fallosFuera.push(caso.id);
      console.log(`${ok ? '✓' : '✗'} ${caso.id} ${r.ms} ms ${r.cubierto ? (r.codigo ?? 'sin código válido') : 'abstención'}`);
      resultados.push({ caso: caso.id, ok, respuesta: r });
    }
    writeFileSync(new URL('./resultado-modelo.json', import.meta.url), JSON.stringify({ fecha: new Date().toISOString(), aciertos, total: casos.length, fallosFuera, resultados }, null, 2));
    console.log(`Resultado: ${aciertos}/20; abstenciones correctas: ${5 - fallosFuera.length}/5`);
    assert.deepEqual(fallosFuera, []);
    assert.ok(aciertos >= 16, `${aciertos}/20 aciertos`);
  } finally { await descargar(modelo); }
});

test('un código explícito recupera su procedimiento, no la sección que lo menciona', () => {
  const r = buscar(guia, 'Me salió un faltante, ¿cómo abro el incidente INC-CAJA?');
  assert.ok(r.length);
  assert.ok(r.every(s => s.titulo.startsWith('INC-CAJA — ')));
});
