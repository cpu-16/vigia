import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parsearGS1, parsearPlaca } from './placa.js';

const verdad = JSON.parse(readFileSync(new URL('../../fixtures/placas/verdad.json', import.meta.url), 'utf8'));
const catalogo = verdad.map(v => ({ gtin: v.gtin, model: v.model, manufacturer: v.manufacturer, modality: v.modality }));

test('cadena de elementos GS1: con paréntesis y corrida', () => {
  assert.deepEqual(parsearGS1('(01)07612345000017(11)150301(21)NMMR2519575'),
    { producto: '07612345000017', serie: 'NMMR2519575', lote: null, fabricacion: '2015-03', vence: null });
  assert.deepEqual(parsearGS1('0107612345000017'), { producto: '07612345000017', serie: null, lote: null, fabricacion: null, vence: null });
  assert.equal(parsearGS1(''), null);
  assert.equal(parsearGS1('MODEL NM-MR 700'), null);
});

test('interpretar la placa: el código manda sobre la etiqueta y la marca sale de la lista del reto', () => {
  const lineas = ['NOVAMED', 'MODEL NM-MR 700', 'TYPE MR', 'S/N NMMR2519575', 'REF 45000017',
    'MFG DATE 2015-03', 'INPUT 100-240V~ 50/60Hz 6.0A', '(01)07612345000017(11)150301(21)NMMR2519575'];
  const p = parsearPlaca(lineas, { catalogo });
  assert.equal(p.campos.manufacturer, 'NovaMed');
  assert.equal(p.campos.model, 'NM-MR 700');
  assert.equal(p.campos.serial, 'NMMR2519575');
  assert.equal(p.campos.modality, 'MR');
  assert.equal(p.campos.mfg, '2015-03');
  assert.match(p.origen.serial, /GS1/);
  assert.equal(p.confianza.serial, 'High', 'el código impreso da confianza alta');
  assert.match(p.origen.model, /catálogo/, 'el código de producto identifica el modelo sin leer la etiqueta');
  assert.equal(p.confianza.modality, 'High', 'la modalidad viene del código de producto, no de la etiqueta');
  // Sin catálogo, el mismo código sigue dando la serie pero el modelo baja a la etiqueta.
  const sinCat = parsearPlaca(lineas);
  assert.equal(sinCat.confianza.serial, 'High');
  assert.equal(sinCat.confianza.model, 'Medium');
  assert.equal(p.requiereConfirmacion, true, 'la identidad nunca se confirma sola');
  assert.deepEqual(p.desacuerdos, []);
});

test('sin código, la etiqueta sirve pero con menos confianza; una marca ajena no entra', () => {
  const p = parsearPlaca(['GENERIC MEDICAL', 'MODEL XX-CT 100', 'S/N ABC123', 'TYPE CT'], { catalogo });
  assert.equal(p.campos.manufacturer, undefined, 'solo las seis marcas del reto');
  assert.equal(p.campos.serial, 'ABC123');
  assert.equal(p.confianza.serial, 'Medium');
  assert.equal(p.confianza.manufacturer, 'Low');
  assert.equal(p.campos.modality, 'CT');
});

test('si el código y la etiqueta discrepan, se marca el desacuerdo y baja la confianza', () => {
  const p = parsearPlaca(['ORION IMAGING', 'MODEL OI-CT 450', 'S/N OICT9999999',
    '(01)07611122000019(11)200401(21)OICT1111111'], { catalogo });
  assert.equal(p.desacuerdos.length, 1);
  assert.equal(p.desacuerdos[0].campo, 'serial');
  assert.equal(p.confianza.serial, 'Low', 'con dos series distintas no se elige por el usuario');
});

test('el modelo no puede colar una marca que no está impresa', () => {
  const p = parsearPlaca(['MODEL AH-CT 320', 'TYPE CT', 'S/N AHCT4279829'], { catalogo });
  assert.equal(p.campos.manufacturer, undefined);
  assert.equal(p.campos.model, 'AH-CT 320');
});

// Con PRUEBA_MODELO=1: VisionPsy lee las 20 placas sintéticas y se mide campo por campo.
test('VisionPsy transcribe las placas sintéticas y las reglas las interpretan', { skip: !process.env.PRUEBA_MODELO }, async () => {
  const { cargarVista, leerPlaca } = await import('./placa.js');
  const { unloadModel } = await import('@qvac/sdk');
  const dir = fileURLToPath(new URL('../../fixtures/placas/', import.meta.url));
  const vista = await cargarVista({ device: process.env.CPU ? 'cpu' : 'gpu' });
  const conteo = { serial: 0, model: 0, manufacturer: 0, modality: 0 }, tiempos = [], porDificultad = {};
  try {
    for (const v of verdad) {
      const r = await leerPlaca(vista, dir + v.archivo, { catalogo });
      const ok = { serial: r.campos.serial === v.serial, model: r.campos.model === v.model,
        manufacturer: r.campos.manufacturer === v.manufacturer, modality: r.campos.modality === v.modality };
      for (const k of Object.keys(conteo)) conteo[k] += Number(ok[k]);
      tiempos.push(r.ms);
      porDificultad[v.dificultad] ??= { n: 0, aciertos: 0 };
      porDificultad[v.dificultad].n += 4;
      porDificultad[v.dificultad].aciertos += Object.values(ok).filter(Boolean).length;
      console.log(`${Object.values(ok).filter(Boolean).length}/4 ${v.dificultad.padEnd(10)} ${Math.round(r.ms)} ms  ${v.archivo}  ` +
        Object.entries(ok).filter(([, b]) => !b).map(([k]) => `${k}:${r.campos[k] ?? '—'}≠${v[k === 'manufacturer' ? 'manufacturer' : k]}`).join(' '));
    }
  } finally { await unloadModel({ modelId: vista.modelId, clearStorage: false }).catch(() => {}); }
  const n = verdad.length;
  console.log('\nExactitud por campo:', Object.fromEntries(Object.entries(conteo).map(([k, v]) => [k, `${v}/${n}`])));
  console.log('Por dificultad:', Object.fromEntries(Object.entries(porDificultad).map(([k, v]) => [k, `${v.aciertos}/${v.n}`])));
  console.log(`Tiempo por placa: mediana ${Math.round(tiempos.sort((a, b) => a - b)[Math.floor(n / 2)])} ms`);
  // Las placas nítidas son el caso que la app usa de verdad; las difíciles se miden para declararlas.
  const nitidas = verdad.filter(v => v.dificultad === 'nitida').length;
  assert.ok(conteo.serial >= nitidas * 0.8, `serie: ${conteo.serial}/${n}`);
  assert.ok(conteo.model >= nitidas * 0.8, `modelo: ${conteo.model}/${n}`);
});
