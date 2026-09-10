// Revisión humana compartida por navegador y servidor: no vuelve a inferir una respuesta confirmada.
import { preguntas, interpretarEdad } from './reglas.js';
import { MARCAS, MODALIDADES } from './esquema.js';

export function aplicarRespuestas(b, respuestas = {}) {
  const out = structuredClone(b);
  for (const [clave, valor] of Object.entries(respuestas ?? {})) {
    if (valor == null || valor === 'No sé' || valor === '') continue;
    const [campo, g] = clave.split(':');
    const grupo = g === 'null' ? null : out.equipment[Number(g)];
    if (campo === 'customer.name') out.customer.name = valor;
    else if (campo === 'customer.location') {
      const [ciudad, pais] = String(valor).split(',').map(s => s.trim());
      out.customer.city = ciudad || null; out.customer.country = pais || out.customer.country;
    } else if (!grupo) continue;
    else if (campo === 'modality' && MODALIDADES.includes(valor)) grupo.modality = valor;
    else if (campo === 'quantity') {
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 1) throw new Error('Escribe la cantidad como un número entero mayor que cero');
      grupo.quantity = n;
    }
    else if (campo === 'manufacturer' && MARCAS.includes(valor)) grupo.manufacturer = valor;
    else if (campo === 'model') grupo.model = valor;
    else if (campo === 'age') { const edad = interpretarEdad(valor); if (edad) [grupo.age_years_min, grupo.age_years_max] = edad; }
    if (grupo) grupo.verificado = { ...(grupo.verificado ?? {}), [campo]: 'colaborador' };
  }
  return out;
}

export function revision(borrador, respuestas = {}) {
  const b = aplicarRespuestas(borrador, respuestas);
  return { borrador: b, preguntas: preguntas(b, { yaContestadas: new Set(Object.keys(respuestas)) }) };
}

// Compartido con el parser y la UI: etiquetas de otra columna no son una identidad.
// Los prefijos legítimos REF-123, SN123 o modelos con espacios siguen admitidos.
export function identidadPlacaValida(valor) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > 128) return false;
  return !/(?:^|\s)(?:MODEL|MODELO|TYPE|TIPO|S\/N|SN|SERIAL(?:\s+NO)?|SERIE|REF|MFG(?:\s+DATE)?|INPUT|OUTPUT)(?=\s|:|$)/i.test(valor)
    && !/\b(?:INPUT|OUTPUT)\s*\d|\d\s*(?:V[~–-]|Hz\b)|[\r\n]/i.test(valor);
}

export function corregirLecturaPlaca(foto, valores) {
  const out = structuredClone(foto);
  out.campos = { ...out.campos };
  out.origen = { ...out.origen };
  out.lectura_original ??= { campos: structuredClone(foto.campos ?? {}), origen: structuredClone(foto.origen ?? {}) };
  out.correcciones = { ...out.correcciones };
  for (const k of ['model', 'serial']) {
    const valor = String(valores[k] ?? '').trim();
    if (valor && !identidadPlacaValida(valor)) throw new Error(`Revisa ${k === 'model' ? 'el modelo' : 'la serie'}: contiene etiquetas técnicas. Corrígelo o déjalo vacío.`);
    if (valor !== String(foto.campos?.[k] ?? '')) {
      out.correcciones[k] = { anterior: foto.campos?.[k] ?? null, nuevo: valor || null };
      out.origen[k] = 'corregido por colaborador';
    }
    if (valor) out.campos[k] = valor;
    else delete out.campos[k];
  }
  return out;
}

// La persona elige el grupo. Una placa identifica una unidad, no todas las de un grupo.
export function incorporarPlaca(borrador, foto, indice) {
  const b = structuredClone(borrador), g = b.equipment?.[indice], c = foto.campos ?? {};
  if (!g) throw new Error('Elige el equipo al que corresponde la foto');
  for (const k of ['model', 'serial']) if (c[k] && !identidadPlacaValida(c[k])) throw new Error('La lectura contiene etiquetas técnicas. Corrige modelo y serie o déjalos vacíos antes de confirmar.');
  if (foto.desacuerdos?.length) throw new Error('La lectura de la placa tiene datos contradictorios. Toma otra foto antes de confirmar.');
  if (foto.modo !== 'placa') throw new Error('Sin placa legible: conserva la foto como evidencia y confirma los datos');
  if (c.modality && g.modality && c.modality !== g.modality) throw new Error('La modalidad de la foto no coincide con el equipo elegido');
  const conflictos = ['manufacturer', 'model', 'serial'].filter(k => g[k] && c[k] && g[k] !== c[k]);
  if (conflictos.length) throw new Error(`La foto discrepa en ${conflictos.join(', ')}. Conservamos lo confirmado; revisa la placa.`);
  if (c.serial && b.equipment.some((x, i) => i !== indice && x.serial === c.serial)) throw new Error('Esta serie ya está asignada a otra unidad de la visita. Revisa cuál fotografiaste.');
  const separada = Number.isInteger(g.quantity) && g.quantity > 1;
  if (separada) {
    const resto = structuredClone(g); resto.quantity = g.quantity - 1;
    // El grupo restante no tiene la identidad ni la evidencia de esta unidad.
    delete resto.serial; delete resto.gtin; delete resto.placa;
    b.equipment.push(resto); g.quantity = 1;
  }
  for (const k of ['manufacturer', 'model', 'modality', 'serial', 'gtin']) {
    if (!c[k] || (k === 'manufacturer' && !MARCAS.includes(c[k])) || (k === 'modality' && !MODALIDADES.includes(c[k]))) continue;
    if (!g[k]) { g[k] = c[k]; g.verificado = { ...(g.verificado ?? {}), [k]: 'foto confirmada por colaborador' }; }
  }
  g.placa = { campos: c, origen: foto.origen, transcripcion: foto.transcripcion, lectura_original: foto.lectura_original, correcciones: foto.correcciones, confirmado_por_colaborador: true };
  // Fabricación no implica instalación; no se usa para inventar edad de servicio.
  return { borrador: b, separada };
}
