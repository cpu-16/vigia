// Duplicados explicables con el modelo de Fellegi-Sunter (el de splink), a mano y determinista:
// cada campo aporta log2(m/u) bits si coincide y log2((1-m)/(1-u)) si difiere; un dato ausente
// aporta 0. La suma más el prior da la probabilidad de que dos observaciones hablen del mismo
// equipo. Nunca fusiona sola: devuelve la explicación campo por campo para que una persona decida.
import { sinAcentos } from './esquema.js';

// m = P(coincide | mismo equipo) · u = P(coincide | equipos distintos). Fijados a mano, declarados.
export const PESOS = {
  site:         { m: 0.95, u: 0.05 },   // mismo hospital (nombre + país)
  modality:     { m: 0.98, u: 0.25 },
  manufacturer: { m: 0.90, u: 0.17 },   // 6 marcas → u ≈ 1/6
  model:        { m: 0.85, u: 0.05 },
  serial:       { m: 0.99, u: 0.001 },
  quantity:     { m: 0.80, u: 0.30 },
  age:          { m: 0.85, u: 0.30 },   // rangos de edad que se solapan (±1 año)
};
export const PRIOR_BITS = Math.log2(1 / 10);   // a priori, 1 de cada 10 candidatos es el mismo equipo
const bits = (campo, acuerdo) => { const { m, u } = PESOS[campo]; return acuerdo ? Math.log2(m / u) : Math.log2((1 - m) / (1 - u)); };
const igual = (a, b) => sinAcentos(String(a)).trim() === sinAcentos(String(b)).trim();
const solapan = (a, b) => a.min != null && b.min != null && a.min - 1 <= b.max && b.min - 1 <= a.max;

// comparar(nuevo, existente): ambos con { site:{name,country}, modality, manufacturer, model, serial, quantity, age:{min,max} }
export function comparar(n, e) {
  const detalle = [], ver = (campo, acuerdo) => { if (acuerdo === null) detalle.push({ campo, acuerdo: null, bits: 0 }); else detalle.push({ campo, acuerdo, bits: Math.round(bits(campo, acuerdo) * 100) / 100 }); };
  // El país ausente no vuelve distinto a un mismo hospital: manda el nombre y el dato que falta
  // aporta 0, como el resto. Antes, un reporte sin país restaba 4.25 bits contra su propia visita
  // anterior y ni el aviso de duplicado ni las sugerencias lo reconocían.
  // OJO: esto NO desdobla los sitios que el almacén ya separó — inventario() agrupa por
  // claveCliente(name|país), así que un reporte sin país cae en otro bucket antes de llegar aquí.
  ver('site', n.site?.name && e.site?.name
    ? igual(n.site.name, e.site.name) && (n.site.country == null || e.site.country == null || igual(n.site.country, e.site.country))
    : null);
  ver('modality', n.modality && e.modality ? igual(n.modality, e.modality) : null);
  ver('manufacturer', n.manufacturer && e.manufacturer ? igual(n.manufacturer, e.manufacturer) : null);
  ver('model', n.model && e.model ? igual(n.model, e.model) : null);
  ver('serial', n.serial && e.serial ? igual(n.serial, e.serial) : null);
  ver('quantity', n.quantity != null && e.quantity != null ? n.quantity === e.quantity : null);
  ver('age', n.age?.min != null && e.age?.min != null ? solapan(n.age, e.age) : null);
  const total = PRIOR_BITS + detalle.reduce((s, d) => s + d.bits, 0);
  const p = 1 / (1 + 2 ** -total);
  return { p: Math.round(p * 1000) / 1000, bits: Math.round(total * 100) / 100, detalle,
    veredicto: p >= 0.9 ? 'mismo' : p >= 0.5 ? 'revisar' : 'nuevo' };
}

// candidatos(nuevo, inventario): los que merecen revisión, del más probable al menos.
export const candidatos = (nuevo, inventario) =>
  inventario.map(e => ({ existente: e, ...comparar(nuevo, e) })).filter(c => c.veredicto !== 'nuevo').sort((a, b) => b.p - a.p);

// ── lo que la base instalada ya sabe ───────────────────────────────────────────────────────────
// El almacén ya rellena huecos hacia adelante («una observación posterior completa lo que faltaba,
// nunca pisa lo que ya había», almacen.js). Esto es la misma política hacia atrás: antes de
// guardar, el registro le ofrece al borrador los campos que el observador no dictó. Nunca decide
// solo — devuelve la propuesta con su procedencia para que la persona la acepte o la rechace.
const CAMPOS = ['manufacturer', 'model'];   // identifican la unidad y no cambian con el tiempo.
                                            // quantity y age NO: es justo lo que se está observando hoy.

// aplanar(inventario): la vista por sitio del almacén → la lista de equipos que comparar() espera.
export const aplanar = inventario => inventario.flatMap(s => s.equipos.map(e => ({
  site: { name: s.customer?.name, country: s.customer?.country }, customer: s.customer,
  modality: e.modality, manufacturer: e.manufacturer, model: e.model, quantity: e.quantity,
  age: { min: e.age_years_min, max: e.age_years_max },
  _resumen: `${e.quantity ?? '?'}×${e.modality} en ${s.customer?.name}`,
  _desde: (n => `visita del ${e.ultima_fecha ?? '?'} · ${n} observador${n === 1 ? '' : 'es'}`)((e.observadores ?? []).length || 1),
})));

// sugerencias(borrador, inventario): [{ clave, campo, valor, desde }], en el mismo formato de clave
// que usa aplicarRespuestas(). Un campo que el observador sí dictó no aparece nunca.
export function sugerencias(borrador, inventario) {
  const inv = aplanar(inventario);
  const fuera = [];
  // El sitio: si el hospital ya fue visitado, su ciudad y su país están registrados. Va como una
  // sola respuesta «Ciudad, País» porque es la clave que aplicarRespuestas() sabe leer.
  const sitio = inv.find(e => e.customer?.name && igual(e.customer.name, borrador.customer?.name ?? ''));
  // Se ofrece solo si el reporte no dijo NINGUNA de las dos y la ficha tiene LAS DOS:
  // aplicarRespuestas parte «Ciudad, País» por la coma, así que media respuesta escribe el país en
  // el campo de la ciudad y deja la pregunta por contestada. Y si el observador sí dictó el país,
  // no hay nada que completar: sobreescribirlo con el de otra visita lo refilaría a otro país.
  if (sitio && borrador.customer?.city == null && borrador.customer?.country == null
      && sitio.customer?.city && sitio.customer?.country)
    fuera.push({ clave: 'customer.location:null', campo: 'customer.location',
      valor: `${sitio.customer.city}, ${sitio.customer.country}`, desde: 'ficha del hospital' });
  // Sin hospital reconocido no se ofrece nada de equipos: con el nombre ausente el sitio aporta 0
  // bits y «2 resonadores NovaMed de 7 años» llega a «mismo» contra el equipo de OTRO hospital.
  if (!sitio) return fuera;
  // Los equipos: solo desde un registro que el modelo de duplicados ya dio por «mismo».
  for (const [i, g] of (borrador.equipment ?? []).entries()) {
    const c = candidatos({ site: { name: borrador.customer?.name, country: borrador.customer?.country },
      modality: g.modality, manufacturer: g.manufacturer, model: g.model, quantity: g.quantity,
      age: { min: g.age_years_min, max: g.age_years_max } }, inv)[0];
    if (c?.veredicto !== 'mismo') continue;
    for (const campo of CAMPOS) if (g[campo] == null && c.existente[campo] != null)
      fuera.push({ clave: `${campo}:${i}`, campo, valor: c.existente[campo], grupo: i, desde: c.existente._desde });
  }
  return fuera;
}
