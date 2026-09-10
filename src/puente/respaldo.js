// La política de respaldo que el SDK no da.
//
// `delegate.fallbackToLocal: true` cubre la CARGA: si el par no aparece en el DHT, el modelo se
// carga aquí. No cubre lo otro, que es lo que pasa de verdad en campo: el par muere con el modelo
// YA CARGADO, y entonces la completion delegada vuelve VACÍA y SIN error. Medido el 9-sep-2026
// contra el proveedor de la Mac y contra el de la laptop.
//
// Así que aquí el vacío se trata como caída del par, no como resultado: se recalcula en este nodo
// y se le dice a la persona que la respuesta la calculó otro hardware. Un dato en blanco que se
// presenta como respuesta es peor que un aviso.
//
// Es genérico a propósito: el teléfono trae su modelo chico ya cargado y la laptop carga el suyo
// perezosamente cuando hace falta. Los dos usan esta misma política.
import { registrar } from '../core/rendimiento.js';

// ¿La completion delegada volvió sin nada?
//
// NO se puede mirar el borrador: la capa determinista (menciones de `equipos/menciones.js`) saca
// «dos resonadores» del texto por expresión regular y sigue funcionando con el par muerto, así que
// el borrador viene con equipos aunque el modelo no haya dicho una palabra. Medido: con el par
// caído el borrador traía 2×MR y 1×CT, y el hospital y la edad se habían perdido en silencio.
//
// La señal honesta es que el modelo no emitió UN SOLO token. `ttft_ms` lo mide runtime.js aquí
// mismo (invocación → primer trozo de texto), así que no depende de las stats del SDK ni de que
// el registro esté guardando el texto.
export const respuestaVacia = r => {
  if (r?.sinModelo) return false;                       // texto vacío: nunca se llamó al modelo
  if (r?.fila) return r.fila.ttft_ms == null;           // ni un token: el par no está
  return !r?.crudo || (!r.borrador?.customer?.name && !r.borrador?.equipment?.length);
};

// El par cayó y este nodo tampoco tiene modelo a bordo: no hay nada que responder, y hay que
// decirlo en vez de morir. El teléfono de hoy está justo en ese caso.
export class SinRespaldo extends Error {
  constructor(aviso) { super(aviso); this.name = 'SinRespaldo'; this.sinRespaldo = true; this.aviso = aviso; }
}

// conRespaldo(): intenta el par, y si no respondió, recalcula en este nodo diciéndolo.
//   extraerFn        (modelo, texto, {requestId}) → resultado de extracción
//   par              el modelo delegado vivo, o null si ya se dio por caído
//   alCaerElPar      () => void · el llamador olvida el par (no se reintenta en cada visita)
//   cargarLocal      async () => modelo · PEREZOSA: la laptop carga aquí, el teléfono ya lo tiene
//   hayPar           si este nodo estaba configurado con un par; sin par, correr local es lo normal
//   aviso            qué se le dice a la persona cuando la respuesta la calculó este nodo
//   avisoSinRespaldo qué se le dice cuando no hay par NI modelo a bordo
export async function conRespaldo(texto, {
  requestId, extraerFn, par, alCaerElPar = () => {}, cargarLocal,
  hayPar = false, aviso = null, avisoSinRespaldo = 'Sin par a la vista y sin modelo a bordo: la captura queda pendiente',
} = {}) {
  if (par) {
    try {
      const r = await extraerFn(par, texto, { requestId });
      if (!respuestaVacia(r)) return { ...r, modo: 'delegado', modelo: par.etiqueta, degradado: false, aviso: null, recarga_ms: 0 };
      registrar({ stage: 'fallback', request_id: requestId, status: 'vacio', model: par.etiqueta,
        motivo: 'la completion delegada volvió vacía: se asume par caído' });
    } catch (e) {
      registrar({ stage: 'fallback', request_id: requestId, status: 'error', model: par.etiqueta,
        error: String(e?.message ?? e), motivo: 'la completion delegada falló: se asume par caído' });
    }
    alCaerElPar();
  }

  const t0 = performance.now();
  let local = null;
  try { local = await cargarLocal?.(); } catch (e) {
    registrar({ stage: 'fallback', request_id: requestId, status: 'sin_respaldo', error: String(e?.message ?? e),
      motivo: 'el par no respondió y el modelo a bordo no carga' });
    throw new SinRespaldo(avisoSinRespaldo);
  }
  const recarga_ms = Math.round((performance.now() - t0) * 10) / 10;
  if (!local) {
    registrar({ stage: 'fallback', request_id: requestId, status: 'sin_respaldo',
      motivo: 'el par no respondió y este nodo no tiene modelo a bordo' });
    throw new SinRespaldo(avisoSinRespaldo);
  }

  const r = await extraerFn(local, texto, { requestId });
  return { ...r, modo: 'local', modelo: local.etiqueta, degradado: hayPar, aviso: hayPar ? aviso : null, recarga_ms };
}

// Política común para extracción, consultas y banca. Una entrada inválida no mata al par.
export const falloDePar = e => e?.code === 'QVAC_SIN_RESPUESTA' || /timeout|timed out|connection|socket|peer|provider|network|ECONN|EPIPE|stream.*closed/i.test(String(e?.message ?? e));
export function crearEjecutor({ obtenerModelo, cargarLocal, alCaer = () => {} }) {
  let recarga = null;
  return async operacion => {
    let modelo = obtenerModelo();
    try {
      const r = await operacion(modelo);
      return { ...r, modo: modelo.delegado ? 'delegado' : 'local', modelo: modelo.etiqueta,
        degradado: !!recarga, aviso: recarga ? 'El par no respondió: esta respuesta se calculó en este nodo.' : null };
    } catch (e) {
      if (!modelo?.delegado || !falloDePar(e)) throw e;
      alCaer();
      // Varios usuarios pueden detectar la misma caída: solo uno descarga y recarga.
      recarga ??= Promise.resolve().then(cargarLocal).catch(error => { recarga = null; throw error; });
      modelo = await recarga;
      const r = await operacion(modelo);
      return { ...r, modo: 'local', modelo: modelo.etiqueta, degradado: true,
        aviso: 'El par no respondió: esta respuesta se calculó en este nodo.' };
    }
  };
}
