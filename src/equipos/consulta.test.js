import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicar, sinVerificar, DIAS_SIN_VERIFICAR } from './consulta.js';

const HOY = new Date('2026-09-09T12:00:00Z');
const eq = (modality, quantity, edad, extra = {}) => ({ modality, quantity, manufacturer: null, model: null,
  age_years_max: edad, age_years_min: edad, status: 'Reported', corroborado: false, edad: null,
  ultima_fecha: '2026-09-01', ...extra });
const INV = [
  { customer: { name: 'Hospital DemoCare Horizon', city: 'Sao Paulo', country: 'Brazil' },
    equipos: [eq('MR', 3, 9, { manufacturer: 'BluePeak Medical' }), eq('MR', 1, 3), eq('CT', 2, 11)] },
  { customer: { name: 'Clinica DemoCare Light', city: 'Campinas', country: 'Brazil' },
    equipos: [eq('CT', 2, 11, { manufacturer: 'Orion Imaging' }), eq('Ultrasound', 5, 4, { corroborado: true })] },
  { customer: { name: 'Hospital DemoCare Pacific', city: 'Panama City', country: 'Panama' },
    equipos: [eq('MR', 2, 8, { manufacturer: 'NovaMed', ultima_fecha: '2026-01-05' }), eq('CT', 1, null)] },
];

test('la pregunta del reto: clientes en Brasil con resonadores de más de siete años', () => {
  const r = aplicar({ country: 'Brazil', modality: 'MR', age_min_gt: 7, agrupar_por: 'cliente' }, INV, { hoy: HOY });
  assert.equal(r.total_equipos, 1, 'el MR de 3 años no entra, el de Panamá tampoco');
  assert.equal(r.total_unidades, 3);
  assert.deepEqual(r.grupos.map(g => g.clave), ['Hospital DemoCare Horizon']);
  assert.equal(r.filas[0].manufacturer, 'BluePeak Medical');
  // «Brasil» y «Brazil» son el mismo país
  assert.equal(aplicar({ country: 'Brasil', modality: 'MR', age_min_gt: 7 }, INV, { hoy: HOY }).total_unidades, 3);
});

test('agrupar por país, ciudad y modalidad', () => {
  assert.deepEqual(aplicar({ agrupar_por: 'pais' }, INV, { hoy: HOY }).grupos.map(g => [g.clave, g.unidades]),
    [['Brazil', 13], ['Panama', 3]]);
  const ciudades = aplicar({ modality: 'CT', agrupar_por: 'ciudad' }, INV, { hoy: HOY }).grupos;
  assert.deepEqual(ciudades.map(g => g.unidades), [2, 2, 1], 'ordenado por unidades, de mayor a menor');
  assert.deepEqual(ciudades.map(g => g.clave).sort(), ['Campinas', 'Panama City', 'Sao Paulo']);
  assert.equal(aplicar({ agrupar_por: 'modalidad' }, INV, { hoy: HOY }).grupos[0].clave, 'MR');
});

test('los filtros de calidad de dato', () => {
  const inc = aplicar({ solo_incompletos: true }, INV, { hoy: HOY });
  assert.ok(inc.filas.every(f => !f.manufacturer || !f.model || f.edad == null));
  assert.ok(inc.filas.some(f => f.modality === 'CT' && f.edad === null), 'el CT sin edad es incompleto');
  const corr = aplicar({ solo_corroborados: true }, INV, { hoy: HOY });
  assert.equal(corr.total_equipos, 1);
  assert.equal(corr.filas[0].modality, 'Ultrasound');
  assert.equal(aplicar({ manufacturer: 'NovaMed' }, INV, { hoy: HOY }).total_unidades, 2);
  assert.equal(aplicar({ age_max_lt: 5 }, INV, { hoy: HOY }).total_equipos, 2, 'los de 3 y 4 años');
});

test('alerta de información no verificada recientemente', () => {
  const viejos = sinVerificar(INV, { hoy: HOY });
  assert.equal(viejos.length, 1);
  assert.equal(viejos[0].customer, 'Hospital DemoCare Pacific');
  assert.ok(viejos[0].dias_sin_verificar > DIAS_SIN_VERIFICAR);
  assert.equal(sinVerificar(INV, { hoy: HOY, dias: 3650 }).length, 0);
});

test('una consulta sin resultados devuelve cero, no un invento', () => {
  const r = aplicar({ country: 'Japan' }, INV, { hoy: HOY });
  assert.equal(r.total_equipos, 0);
  assert.deepEqual(r.grupos, []);
});

// Con PRUEBA_MODELO=1: el modelo traduce preguntas reales a filtros.
const PREGUNTAS = [
  ['clientes en Brasil con resonadores de más de siete años', { country: 'Brazil', modality: 'MR', age_min_gt: 7 }],
  ['¿cuántos tomógrafos hay por país?', { modality: 'CT', agrupar_por: 'pais' }],
  ['equipos de NovaMed', { manufacturer: 'NovaMed' }],
  ['¿qué equipos están incompletos?', { solo_incompletos: true }],
  ['ecógrafos con menos de cinco años', { modality: 'Ultrasound', age_max_lt: 5 }],
  ['clientes en Panamá', { country: 'Panama' }],
];
test('el modelo traduce la pregunta a filtros y el código ejecuta la consulta', { skip: !process.env.PRUEBA_MODELO, timeout: 600_000 }, async () => {
  const { cargar, descargar } = await import('../core/runtime.js');
  const { QWEN3_1_7B_INST_Q4 } = await import('@qvac/sdk');
  const { consultar } = await import('./consulta.js');
  const modelo = await cargar({ modelSrc: QWEN3_1_7B_INST_Q4, etiqueta: 'Qwen3-1.7B Q4_0', hardware: 'laptop-rtx4060' });
  let ok = 0;
  try {
    for (const [pregunta, espera] of PREGUNTAS) {
      const r = await consultar(modelo, pregunta, INV, { hoy: HOY });
      const fallos = Object.entries(espera).filter(([k, v]) => String(r.filtro?.[k] ?? '').toLowerCase() !== String(v).toLowerCase());
      ok += Number(fallos.length === 0);
      console.log(`${fallos.length ? '✗' : '✓'} ${Math.round(r.ms)} ms · ${pregunta} → ${r.total_unidades} unidades en ${r.grupos.length} grupo(s)` +
        (fallos.length ? ` | ${fallos.map(([k, v]) => `${k}=${r.filtro?.[k]}≠${v}`).join(' ')}` : ''));
    }
  } finally { await descargar(modelo); }
  console.log(`Filtros correctos: ${ok}/${PREGUNTAS.length}`);
  assert.ok(ok >= PREGUNTAS.length - 1, `${ok}/${PREGUNTAS.length}`);
});

test('un filtro inválido no devuelve todo el inventario', async () => {
  const { interpretarFiltro } = await import('./consulta.js');
  for (const texto of ['', 'no JSON', 'null', '[]', '{}']) assert.throws(() => interpretarFiltro(texto), /consulta|filtro/);
  assert.deepEqual(interpretarFiltro('{"country":"Brazil"}'), { country: 'Brazil' });
});
