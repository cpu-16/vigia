// Consulta en lenguaje natural sobre la base instalada. El reto la pide con este ejemplo
// literal: «clientes en Brasil con resonadores de más de siete años».
//
// No es recuperación de documentos: la respuesta es un CONTEO sobre datos estructurados, y ahí
// un modelo que redacta se equivoca. Así que el modelo hace una sola cosa, la que sabe hacer:
// traducir la pregunta a filtros bajo gramática. La consulta la ejecuta el código, siempre.
// Consecuencia: la respuesta no puede inventar un cliente que no está, y es reproducible.
import { completar, sinThink } from '../core/runtime.js';
import { MODALIDADES, MARCAS, ESTADOS, sinAcentos } from './esquema.js';
import { clasificarEdad } from './almacen.js';

const str = { type: ['string', 'null'] }, int = { type: ['integer', 'null'] };
export const ESQUEMA_FILTRO = {
  type: 'object', additionalProperties: false,
  required: ['country', 'city', 'customer_name', 'modality', 'manufacturer', 'age_min_gt', 'age_max_lt',
    'status', 'solo_incompletos', 'solo_sin_verificar', 'solo_corroborados', 'agrupar_por'],
  properties: {
    country: str, city: str, customer_name: str,
    modality: { type: ['string', 'null'], enum: [...MODALIDADES, null] },
    manufacturer: { type: ['string', 'null'], enum: [...MARCAS, null] },
    age_min_gt: int, age_max_lt: int,
    status: { type: ['string', 'null'], enum: [...ESTADOS, null] },
    solo_incompletos: { type: 'boolean' }, solo_sin_verificar: { type: 'boolean' }, solo_corroborados: { type: 'boolean' },
    agrupar_por: { type: 'string', enum: ['cliente', 'pais', 'ciudad', 'modalidad'] },
  },
};

export const SISTEMA = `Traduce una pregunta sobre una base instalada de equipos médicos a filtros JSON. Solo pon los filtros que la pregunta pide; el resto null o false.
"más de siete años", "de más de 7 años" → age_min_gt 7. "menos de 5 años", "nuevos" → age_max_lt 5.
Modalidades: resonadores/resonancias/MRI → MR; tomógrafos/TAC/scanners → CT; ecógrafos/ultrasonido → Ultrasound; rayos X → X-Ray; monitores → Patient Monitoring.
"sin marca", "incompletos", "les falta información" → solo_incompletos true.
"sin verificar", "desactualizados", "no confirmados hace tiempo" → solo_sin_verificar true.
"confirmados por dos", "corroborados" → solo_corroborados true.
manufacturer: solo si la pregunta nombra una de estas marcas: ${MARCAS.join(', ')}. Cualquier otro nombre → null.
agrupar_por: si la pregunta dice "por país" o "por pais" → pais; "por ciudad" → ciudad; "por tipo", "por modalidad" o "por equipo" → modalidad; si no lo dice, cliente.
Ejemplo 1. Pregunta: "clientes en Brasil con resonadores de más de siete años"
{"country":"Brazil","city":null,"customer_name":null,"modality":"MR","manufacturer":null,"age_min_gt":7,"age_max_lt":null,"status":null,"solo_incompletos":false,"solo_sin_verificar":false,"solo_corroborados":false,"agrupar_por":"cliente"}
Ejemplo 2. Pregunta: "¿cuántos ecógrafos de HelixCare hay por país?"
{"country":null,"city":null,"customer_name":null,"modality":"Ultrasound","manufacturer":"HelixCare","age_min_gt":null,"age_max_lt":null,"status":null,"solo_incompletos":false,"solo_sin_verificar":false,"solo_corroborados":false,"agrupar_por":"pais"}
/no_think`;

const PAIS = { brasil: 'brazil', panama: 'panama', mexico: 'mexico', peru: 'peru', chile: 'chile', argentina: 'argentina',
  colombia: 'colombia', ecuador: 'ecuador' };
const igual = (a, b) => { const x = sinAcentos(a ?? ''), y = sinAcentos(b ?? ''); return x === y || (PAIS[x] ?? x) === (PAIS[y] ?? y); };

// aplicar(filtro, inventario): la consulta, en código. Devuelve las filas y el conteo por grupo.
export function aplicar(filtro = {}, inventario = [], { hoy = new Date() } = {}) {
  const f = { ...filtro };
  const dias = fecha => fecha ? Math.floor((hoy - new Date(fecha)) / 86400000) : null;
  const filas = [];
  for (const sitio of inventario) for (const e of sitio.equipos) {
    const c = sitio.customer ?? {};
    if (f.country && !igual(c.country, f.country)) continue;
    if (f.city && !igual(c.city, f.city)) continue;
    if (f.customer_name && !sinAcentos(c.name ?? '').includes(sinAcentos(f.customer_name))) continue;
    if (f.modality && e.modality !== f.modality) continue;
    if (f.manufacturer && e.manufacturer !== f.manufacturer) continue;
    if (f.status && e.status !== f.status) continue;
    if (Number.isInteger(f.age_min_gt) && !(e.age_years_max > f.age_min_gt)) continue;
    if (Number.isInteger(f.age_max_lt) && !(e.age_years_max != null && e.age_years_max < f.age_max_lt)) continue;
    if (f.solo_incompletos && e.manufacturer && e.model && e.age_years_max != null) continue;
    if (f.solo_corroborados && !e.corroborado) continue;
    if (f.solo_sin_verificar && !((dias(e.ultima_fecha) ?? 0) > DIAS_SIN_VERIFICAR)) continue;
    filas.push({ customer: c.name, city: c.city, country: c.country, modality: e.modality, quantity: e.quantity,
      manufacturer: e.manufacturer, model: e.model, edad: e.age_years_max, clase: e.edad, status: e.status,
      corroborado: !!e.corroborado, ultima_fecha: e.ultima_fecha, dias_sin_verificar: dias(e.ultima_fecha) });
  }
  const clave = { cliente: r => r.customer, pais: r => r.country, ciudad: r => r.city, modalidad: r => r.modality }[f.agrupar_por ?? 'cliente'];
  const grupos = new Map();
  for (const r of filas) {
    const k = clave(r) ?? 'sin dato';
    const g = grupos.get(k) ?? { clave: k, unidades: 0, equipos: 0 };
    g.unidades += r.quantity ?? 0; g.equipos += 1; grupos.set(k, g);
  }
  return { filas, grupos: [...grupos.values()].sort((a, b) => b.unidades - a.unidades),
    total_unidades: filas.reduce((n, r) => n + (r.quantity ?? 0), 0), total_equipos: filas.length };
}

// Un equipo lleva «sin verificar» cuando nadie lo ha vuelto a ver en este tiempo. Es la
// «alerta de información no verificada recientemente» que pide el reto.
export const DIAS_SIN_VERIFICAR = 90;
export const sinVerificar = (inventario, { hoy = new Date(), dias = DIAS_SIN_VERIFICAR } = {}) =>
  aplicar({ solo_sin_verificar: true, agrupar_por: 'cliente' }, inventario, { hoy }).filas
    .filter(r => r.dias_sin_verificar > dias)
    .sort((a, b) => b.dias_sin_verificar - a.dias_sin_verificar);

// consultar(): el recorrido completo. `filtro` viaja en la respuesta para que se vea qué entendió.
export async function consultar(modelo, pregunta, inventario, { requestId, hoy } = {}) {
  const r = await completar(modelo, { requestId,
    history: [{ role: 'system', content: SISTEMA }, { role: 'user', content: pregunta }],
    responseFormat: { type: 'json_schema', json_schema: { name: 'filtro', schema: ESQUEMA_FILTRO, strict: true } },
    maxTokens: 300 });
  let filtro;
  filtro = interpretarFiltro(r.texto);
  const res = aplicar(filtro, inventario, { hoy });
  return { pregunta, filtro, ...res, ms: r.ms, id: r.id, fila: r.fila };
}

export { clasificarEdad };

export function interpretarFiltro(texto) {
  let filtro;
  try { filtro = JSON.parse(sinThink(texto)); } catch { throw new Error('No se pudo interpretar la consulta. Reformula la pregunta.'); }
  if (!filtro || Array.isArray(filtro) || typeof filtro !== 'object' || !Object.keys(filtro).length) throw new Error('El modelo devolvió un filtro inválido. Reformula la pregunta.');
  return filtro;
}
