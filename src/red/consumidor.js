// Creado el 9 de septiembre de 2026. BIND usa hora local de Panamá (UTC−5).
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { isIP } from 'node:net';
import { setTimeout as esperar } from 'node:timers/promises';
const meses = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dobles = new Set(['com.pa','net.pa','org.pa','gob.pa','edu.pa','co.uk','com.br','com.mx','com.co','com.au']);
// Sufijos frecuentes, no una PSL completa; ver NOTAS.md.
export function segundoNivel(dominio) {
  if (dominio === '.') return '.';
  const p = dominio.toLowerCase().replace(/\.$/, '').split('.');
  return p.slice(dobles.has(p.slice(-2).join('.')) ? -3 : -2).join('.');
}
export function parsear(linea) {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4}) (\d{2}:\d{2}:\d{2}\.\d{3}) queries: info: client (?:@\S+ )?([^\s#]+)#(\d+) \([^)]*\): query: (\S+) IN ([A-Z0-9]+) (\S+) \(([^)]+)\)\s*$/.exec(linea);
  if (!m || !meses.includes(m[2]) || !isIP(m[5]) || !isIP(m[10]) || +m[6] > 65535) return null;
  const fecha = `${m[3]}-${String(meses.indexOf(m[2])+1).padStart(2,'0')}-${m[1]}T${m[4]}`;
  const ts = Date.parse(fecha + '-05:00');
  if (!Number.isFinite(ts) || new Date(ts-5*3600000).toISOString().slice(0,23) !== fecha) return null;
  const dominio = m[7] === '.' ? '.' : m[7].toLowerCase().replace(/\.$/, '');
  if (dominio !== '.' && (dominio.length > 253 || !dominio.split('.').every(x => x.length && x.length <= 63 && /^[\p{L}\p{N}_*-]+$/u.test(x)))) return null;
  return { ts, cliente:m[5], dominio, sld:segundoNivel(dominio), tipo:m[8], flags:m[9], resolutor:m[10] };
}
export async function* leer(ruta) {
  const archivo = createReadStream(ruta, { encoding:'utf8' });
  const lineas = createInterface({ input:archivo, crlfDelay:Infinity });
  try { for await (const l of lineas) { const e = parsear(l); if (e) yield e; } }
  finally { lineas.close(); archivo.destroy(); }
}
// También acepta un AsyncIterable del bus: suscripción adicional, sin publicar ni confirmar eventos.
export async function* mezclar(fuente, inyectados = []) {
  const it = inyectados[Symbol.asyncIterator]?.() ?? inyectados[Symbol.iterator]();
  let siguiente = await it.next(), ultimo = -Infinity;
  try {
    for await (const e of fuente) {
      if (e.ts < ultimo) throw new Error('El flujo debe llegar ordenado por fecha');
      ultimo = e.ts;
      while (!siguiente.done && siguiente.value.ts <= e.ts) { yield siguiente.value; siguiente = await it.next(); }
      yield e;
    }
    while (!siguiente.done) { yield siguiente.value; siguiente = await it.next(); }
  } finally { await it.return?.(); }
}
export async function* reproducir(ruta, { velocidad=60, desde=-Infinity, hasta=Infinity, inyectados=[], signal } = {}) {
  if (!(velocidad > 0) || !Number.isFinite(velocidad)) throw new Error('Velocidad inválida');
  desde = typeof desde === 'string' ? Date.parse(desde) : desde;
  hasta = typeof hasta === 'string' ? Date.parse(hasta) : hasta;
  if (Number.isNaN(desde) || Number.isNaN(hasta) || desde > hasta) throw new Error('Rango inválido');
  let base, inicio, ultimo = -Infinity;
  for await (const e of mezclar(typeof ruta === 'string' || ruta instanceof URL ? leer(ruta) : ruta, inyectados)) {
    signal?.throwIfAborted();
    if (e.ts < ultimo) throw new Error('Inyección fuera de orden');
    ultimo = e.ts;
    if (e.ts < desde) continue;
    if (e.ts > hasta) break;
    if (base === undefined) { base=e.ts; inicio=performance.now(); }
    let falta;
    while ((falta = inicio+(e.ts-base)/velocidad-performance.now()) > 0) await esperar(Math.min(falta, 60000), undefined, { signal });
    yield e;
  }
}
