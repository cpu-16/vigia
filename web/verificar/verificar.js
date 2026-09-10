// Verificación de actas en el navegador. Reproduce con WebCrypto lo que src/core/sello.js hace
// con el crypto de Node: JSON canónico → SHA-256 del cuerpo sin el sello → firma Ed25519 sobre
// los BYTES de ese hash. Solo globalThis.crypto.subtle y TextEncoder: ni un import de node:,
// así que el mismo archivo corre en el teléfono y dentro de `node --test`.

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('este navegador no expone WebCrypto (hace falta https:// o localhost)');
  return s;
};

export const SIN_ED25519 = 'este navegador no verifica Ed25519 con WebCrypto (Chrome 113+, Safari 17+, Firefox 130+)';

// JSON canónico: llaves ordenadas en todos los niveles, sin espacios. Misma regla que el sellador,
// o el hash no daría igual.
export function canonico(v) {
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonico(v[k])).join(',') + '}';
  return JSON.stringify(v);
}

const HEX = '0123456789abcdef';
export const aHex = bytes => Array.from(bytes, b => HEX[b >> 4] + HEX[b & 15]).join('');

export function deHex(hex) {
  if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 || /[^0-9a-fA-F]/.test(hex)) throw new Error('hexadecimal inválido');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function deBase64(b64) {
  const limpio = String(b64).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const bin = atob(limpio); // atob es estándar en el navegador y en Node; no hace falta Buffer
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function huella(obj) {
  const bytes = new TextEncoder().encode(canonico(obj));
  return aHex(new Uint8Array(await subtle().digest('SHA-256', bytes)));
}

// Punto base de Ed25519: una llave pública válida cualquiera, solo para preguntarle al navegador
// si sabe importarla. No firma ni verifica nada.
const PUNTO_BASE = '5866666666666666666666666666666666666666666666666666666666666666';
let soporte = null;
export async function soportaEd25519() {
  if (soporte !== null) return soporte;
  try { await subtle().importKey('raw', deHex(PUNTO_BASE), { name: 'Ed25519' }, true, ['verify']); soporte = true; }
  catch { soporte = false; }
  return soporte;
}

// ── resumen legible: los campos de primer nivel, sin conocer el esquema del acta ──
function describir(v) {
  if (v === null || v === undefined) return { tipo: 'vacio', valor: '—' };
  if (Array.isArray(v)) return { tipo: 'lista', valor: `${v.length} elemento${v.length === 1 ? '' : 's'}` };
  if (typeof v === 'object') {
    const k = Object.keys(v);
    return { tipo: 'objeto', valor: k.length ? `${k.length} campo${k.length === 1 ? '' : 's'}: ${k.join(', ')}` : 'sin campos' };
  }
  if (typeof v === 'string') return { tipo: 'texto', valor: v.length > 180 ? v.slice(0, 180) + '…' : v };
  return { tipo: 'dato', valor: String(v) };
}

export function resumen(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  return Object.entries(obj).filter(([k]) => k !== 'sello').map(([clave, v]) => ({ clave, ...describir(v) }));
}

const leerSello = s => ({
  alg: s.alg ?? null, hash: s.hash, firma: s.firma, publica: s.publica,
  publicaCorta: String(s.publica).slice(0, 16) + '…',
  firmante: s.firmante || 'nodo', ts: s.ts ?? null,
});

// ── una sola acta ──
export async function verificarActa(sellado) {
  const { sello, ...cuerpo } = sellado ?? {};
  const campos = resumen(sellado);
  if (!sello?.hash || !sello?.firma || !sello?.publica) return { tipo: 'acta', valido: false, motivo: 'sin sello', sello: null, resumen: campos };
  const base = { tipo: 'acta', valido: false, sello: leerSello(sello), resumen: campos };
  if (sello.alg && sello.alg !== 'ed25519') return { ...base, motivo: `el sello dice «${sello.alg}» y esta página solo verifica ed25519` };

  let publica, firma, bytesHash;
  try { publica = deHex(sello.publica); firma = deBase64(sello.firma); bytesHash = deHex(sello.hash); }
  catch { return { ...base, motivo: 'el sello está mal formado: hash, firma o llave ilegibles' }; }
  if (publica.length !== 32) return { ...base, motivo: `la llave pública tiene ${publica.length} bytes y Ed25519 usa 32` };
  if (firma.length !== 64) return { ...base, motivo: `la firma tiene ${firma.length} bytes y Ed25519 usa 64` };

  // Primero el contenido: si cambió, ni hace falta mirar la firma. La huella recalculada se
  // devuelve para poder enseñar las dos, una debajo de la otra.
  const calculado = await huella(cuerpo);
  if (calculado !== sello.hash) return { ...base, motivo: 'el contenido cambió después de sellar', hashCalculado: calculado };

  let llave;
  try { llave = await subtle().importKey('raw', publica, { name: 'Ed25519' }, true, ['verify']); }
  catch { return { ...base, motivo: (await soportaEd25519()) ? 'la llave pública no es un punto válido de Ed25519' : SIN_ED25519 }; }
  let ok;
  try { ok = await subtle().verify({ name: 'Ed25519' }, llave, firma, bytesHash); }
  catch { return { ...base, motivo: SIN_ED25519 }; }
  return ok ? { ...base, valido: true, motivo: null } : { ...base, motivo: 'la firma no corresponde a la llave' };
}

// ── una lista: cada acta por su lado y, si vienen encadenadas al estilo de src/core/eventos.js
// (cada una con su huella y la del anterior en `prev`), también el encadenamiento ──
export async function verificarCadena(lista) {
  const actas = [];
  for (const a of lista) actas.push(await verificarActa(a));

  const encadenables = lista.length > 0 && lista.every(e => e && typeof e === 'object' && !Array.isArray(e) && typeof e.huella === 'string');
  let cadena = null;
  if (encadenables) {
    cadena = { valida: true, actas: lista.length };
    let prev = null;
    for (let i = 0; i < lista.length; i++) {
      const { huella: h, ...cuerpo } = lista[i];
      const n = Number.isInteger(cuerpo.n) ? cuerpo.n : i + 1;
      if ((cuerpo.prev ?? null) !== prev) { cadena = { valida: false, en: n, motivo: 'la huella del acta anterior no coincide' }; break; }
      if (await huella(cuerpo) !== h) { cadena = { valida: false, en: n, motivo: 'el contenido del acta cambió' }; break; }
      prev = h;
    }
  }

  const firmadas = actas.filter(a => a.sello).length;
  const validas = actas.filter(a => a.valido).length;
  const rota = cadena && !cadena.valida;
  const valido = !rota && validas === firmadas && (firmadas > 0 || cadena?.valida === true);
  const cual = actas.findIndex(a => a.sello && !a.valido);
  const motivo = rota ? `la cadena se rompe en el acta ${cadena.en}: ${cadena.motivo}`
    : cual >= 0 ? `el acta ${cual + 1} no verifica: ${actas[cual].motivo}`
    : firmadas === 0 && !cadena ? 'ninguna de estas actas lleva sello ni huella encadenada'
    : null;
  return { tipo: 'cadena', valido, motivo, total: lista.length, firmadas, validas, cadena, actas };
}

// ── entrada del usuario: un acta, una lista, o un JSONL pegado tal cual ──
export async function verificarEntrada(entrada) {
  let datos = entrada;
  if (typeof entrada === 'string') {
    const texto = entrada.trim();
    if (!texto) return { tipo: 'error', valido: false, motivo: 'no hay nada que verificar' };
    try { datos = JSON.parse(texto); }
    catch (e) {
      const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean);
      try { datos = lineas.length > 1 ? lineas.map(l => JSON.parse(l)) : null; }
      catch { datos = null; }
      if (!datos) return { tipo: 'error', valido: false, motivo: `esto no es JSON válido: ${e.message}` };
    }
  }
  if (Array.isArray(datos)) return { ...await verificarCadena(datos), datos };
  if (!datos || typeof datos !== 'object') return { tipo: 'error', valido: false, motivo: 'el JSON no es un acta ni una lista de actas' };
  return { ...await verificarActa(datos), datos };
}

// ── control positivo: cambiar UN carácter y volver a verificar ──
// Si la firma no detectara esto, no serviría de nada.
const INTOCABLES = new Set(['sello', 'huella', 'prev']);

function otroTexto(s) {
  const car = [...s];
  for (let i = car.length - 1; i >= 0; i--) {
    const c = car[i];
    if (c >= '0' && c <= '9') { car[i] = String((Number(c) + 1) % 10); return car.join(''); }
    if (c >= 'a' && c <= 'z') { car[i] = c === 'z' ? 'a' : String.fromCharCode(c.charCodeAt(0) + 1); return car.join(''); }
    if (c >= 'A' && c <= 'Z') { car[i] = c === 'Z' ? 'A' : String.fromCharCode(c.charCodeAt(0) + 1); return car.join(''); }
  }
  return s + '.';
}

const pintarRuta = partes => partes.join('.').replace(/\.\[/g, '[');

function tocarValor(contenedor, clave, ruta) {
  const v = contenedor[clave];
  if (typeof v === 'string' && v.trim()) {
    const nuevo = otroTexto(v);
    if (nuevo === v) return null;
    contenedor[clave] = nuevo;
    return { ruta: pintarRuta(ruta), antes: v, despues: nuevo };
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    contenedor[clave] = v + 1;
    return { ruta: pintarRuta(ruta), antes: String(v), despues: String(v + 1) };
  }
  if (v && typeof v === 'object') return tocar(v, ruta);
  return null;
}

function tocar(v, ruta) {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) { const r = tocarValor(v, i, [...ruta, `[${i}]`]); if (r) return r; }
    return null;
  }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) { if (INTOCABLES.has(k)) continue; const r = tocarValor(v, k, [...ruta, k]); if (r) return r; }
    return null;
  }
  return null;
}

// alterar(): devuelve una copia con un solo carácter distinto y dice cuál cambió.
// En una cadena toca la del medio, que es donde mejor se ve que el encadenamiento se parte.
export function alterar(datos) {
  const copia = JSON.parse(JSON.stringify(datos));
  const cual = Array.isArray(copia) ? Math.floor((copia.length - 1) / 2) : null;
  const objetivo = cual === null ? copia : copia[cual];
  const cambio = tocar(objetivo, []);
  return cambio ? { datos: copia, cambio: { ...cambio, acta: cual === null ? null : cual + 1 } } : null;
}
