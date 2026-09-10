import { readFileSync } from 'node:fs';

export const normalizar = texto => String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const comunes = new Set('a al de del el la los las un una y o en por para que se si con como cual cuanto tengo hay me le es no lo esta'.split(' '));
const terminos = texto => normalizar(texto).match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
export function cargarGuia(ruta = new URL('../../fixtures/sucursal/guia-bpl.md', import.meta.url)) {
  const texto = readFileSync(ruta, 'utf8');
  const secciones = [];
  for (const linea of texto.split(/\r?\n/)) {
    const encabezado = linea.match(/^#{1,6}\s+(.+)$/);
    if (encabezado) secciones.push({ titulo: encabezado[1], texto: linea });
    else if (secciones.length) secciones.at(-1).texto += '\n' + linea;
  }
  return { texto, secciones };
}
// buscar(): recuperación por términos y códigos. Determinista y sin modelo: es la que acierta
// los códigos exactos. Se combina con la semántica (src/core/semantica.js) en buscarHibrido().
export function buscar(guia, consulta, n = 3) {
  const palabras = [...new Set(terminos(consulta).filter(t => !comunes.has(t)))];
  // Un código solicitado identifica su sección; las referencias cruzadas no la sustituyen.
  const referidas = guia.secciones.filter(s => palabras.some(t => t.includes('-') && normalizar(s.titulo).startsWith(t + ' — ')));
  const candidatas = referidas.length ? referidas : guia.secciones;
  return candidatas.map((s, indice) => {
    const tokens = new Set(terminos(s.texto));
    const titulo = new Set(terminos(s.titulo));
    const puntaje = palabras.reduce((p, t) => p + (tokens.has(t) ? (t.includes('-') ? 30 : 1) + (titulo.has(t) ? 4 : 0) : 0), 0);
    return { ...s, puntaje, indice };
  }).filter(s => s.puntaje > 0).sort((a, b) => b.puntaje - a.puntaje || a.indice - b.indice).slice(0, Math.max(0, n));
}

// buscarHibrido(): la exacta más la semántica del SDK, fusionadas por rango recíproco.
// Sin índice semántico (`emb` nulo) se comporta exactamente como buscar(): el módulo sigue
// funcionando en un equipo donde no quepa el modelo de embeddings.
export async function buscarHibrido(guia, consulta, { emb = null, indice = null, n = 3 } = {}) {
  const exacta = buscar(guia, consulta, n + 2);
  if (!emb || !indice) {
    const mejor = exacta[0]?.puntaje ?? 0;
    // No rellenar el contexto con referencias débiles cuando hay un título claramente pertinente.
    return exacta.filter(s => mejor < 5 || s.puntaje >= mejor * 0.7).slice(0, n);
  }
  const { buscarSemantico, combinar } = await import('../core/semantica.js');
  const semantica = await buscarSemantico(emb, indice, consulta, n + 2);
  return combinar([exacta, semantica], { n, clave: f => f.titulo });
}
