// La página de verificación no puede confiar en que "se ve bien": aquí se sella con el crypto de
// Node (src/core/sello.js) y se verifica con el módulo que corre en el navegador
// (app/verificar.js, WebCrypto). Si las dos implementaciones se separan, esta prueba falla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, readFileSync } from 'node:fs';
import { llaveNodo, sellar, huella as huellaNode } from './sello.js';
import { Eventos } from './eventos.js';
import { canonico, huella, verificarEntrada, verificarActa, alterar } from '../../app/verificar.js';

const tmp = `/tmp/vigia-verificar-web-${process.pid}`;
const ACTA = {
  visita: 'V-9A3F', observador: 'gilberto',
  customer: { name: 'Hospital DemoCare Pacific', city: 'Panamá', country: 'PA' },
  equipos: [{ modality: 'MR', quantity: 2, manufacturer: 'Orion Imaging' }, { modality: 'CT', quantity: 1 }],
  eventos: ['m1-aa', 'm2-bb'],
};

test('el canónico y la huella del navegador dan lo mismo que los de Node', async () => {
  assert.equal(canonico({ b: 1, a: [{ d: 2, c: 3 }] }), canonico({ a: [{ c: 3, d: 2 }], b: 1 }));
  assert.equal(await huella(ACTA), huellaNode(ACTA));
});

test('acta sellada en Node: WebCrypto la da por válida y lee su sello', async () => {
  const llave = llaveNodo(`${tmp}-llave.pem`);
  const acta = sellar(ACTA, llave, { firmante: 'gilberto' });
  const r = await verificarEntrada(JSON.stringify(acta));
  assert.equal(r.valido, true, r.motivo ?? '');
  assert.equal(r.tipo, 'acta');
  assert.equal(r.motivo, null);
  assert.equal(r.sello.firmante, 'gilberto');
  assert.equal(r.sello.publica, llave.publica);
  assert.equal(r.sello.hash, acta.sello.hash);
  // el resumen sale de los campos de primer nivel, sin conocer el esquema
  const campos = Object.fromEntries(r.resumen.map(c => [c.clave, c.valor]));
  assert.equal(campos.visita, 'V-9A3F');
  assert.equal(campos.equipos, '2 elementos');
  assert.match(campos.customer, /^3 campos:/);
  assert.equal(r.resumen.find(c => c.clave === 'sello'), undefined);
  rmSync(`${tmp}-llave.pem`, { force: true });
});

test('un campo alterado, un sello ausente y una llave ajena: los tres se rechazan con su motivo', async () => {
  const llave = llaveNodo(`${tmp}-llave.pem`);
  const otra = llaveNodo(`${tmp}-otra.pem`);
  const acta = sellar(ACTA, llave, { firmante: 'gilberto' });

  const tocada = await verificarActa({ ...acta, customer: { ...acta.customer, name: 'Hospital DemoCare Pacifico' } });
  assert.equal(tocada.valido, false);
  assert.equal(tocada.motivo, 'el contenido cambió después de sellar');

  const { sello: _, ...sinSello } = acta;
  const desnuda = await verificarActa(sinSello);
  assert.equal(desnuda.valido, false);
  assert.equal(desnuda.motivo, 'sin sello');
  assert.equal(desnuda.sello, null);

  // misma acta y mismo hash, pero la llave publicada es otra: la firma no corresponde
  const suplantada = await verificarActa({ ...acta, sello: { ...acta.sello, publica: otra.publica } });
  assert.equal(suplantada.valido, false);
  assert.equal(suplantada.motivo, 'la firma no corresponde a la llave');

  rmSync(`${tmp}-llave.pem`, { force: true }); rmSync(`${tmp}-otra.pem`, { force: true });
});

test('el botón «probar una alteración» cambia un carácter y el acta deja de verificar', async () => {
  const llave = llaveNodo(`${tmp}-llave.pem`);
  const acta = sellar(ACTA, llave, { firmante: 'gilberto' });
  const { datos, cambio } = alterar(acta);
  assert.equal(cambio.antes.length, cambio.despues.length);
  assert.equal([...cambio.antes].filter((c, i) => c !== cambio.despues[i]).length, 1, 'debe cambiar un solo carácter');
  assert.deepEqual(datos.sello, acta.sello, 'el sello no se toca: lo que cambia es el contenido');
  const r = await verificarActa(datos);
  assert.equal(r.valido, false);
  assert.equal(r.motivo, 'el contenido cambió después de sellar');
  rmSync(`${tmp}-llave.pem`, { force: true });
});

test('cadena de 3 actas encadenadas: íntegra, y rota al alterar la del medio', async () => {
  const ruta = `${tmp}-cadena.jsonl`;
  rmSync(ruta, { force: true });
  const e = new Eventos(ruta);
  e.agregar('observacion', { hospital: 'DemoCare Pacific', mr: 2 });
  e.agregar('observacion', { hospital: 'DemoCare Pacific', ct: 1 });
  e.agregar('cierre', { hospital: 'DemoCare Pacific', visita: 'V-9A3F' });
  const jsonl = readFileSync(ruta, 'utf8');

  const intacta = await verificarEntrada(jsonl); // se pega el JSONL tal cual
  assert.equal(intacta.tipo, 'cadena');
  assert.equal(intacta.total, 3);
  assert.deepEqual(intacta.cadena, { valida: true, actas: 3 });
  assert.equal(intacta.valido, true);

  const lista = jsonl.trim().split('\n').map(l => JSON.parse(l));
  const { datos, cambio } = alterar(lista);
  assert.equal(cambio.acta, 2, 'en una cadena se altera la del medio');
  const rota = await verificarEntrada(datos);
  assert.equal(rota.valido, false);
  assert.equal(rota.cadena.valida, false);
  assert.equal(rota.cadena.en, 2);
  assert.match(rota.motivo, /la cadena se rompe en el acta 2/);

  // borrar un eslabón también se nota: el tercero ya no apunta al anterior
  const cortada = await verificarEntrada([lista[0], lista[2]]);
  assert.equal(cortada.cadena.valida, false);
  assert.equal(cortada.cadena.en, 3);
  rmSync(ruta, { force: true });
});
