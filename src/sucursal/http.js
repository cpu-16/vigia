// Rutas HTTP del módulo de sucursal (track 05). Viven aparte del servidor a propósito: todo lo
// que depende del modelo entra por `ctx`, así que la prueba recorre el flujo completo —consulta,
// expediente, acta sellada— sin cargar un solo modelo.
//
// Regla de la que cuelga el resto: el navegador nunca manda citas ni pasos. Manda el id de una
// consulta que este proceso validó, y el servidor resuelve desde ahí el texto literal y su
// sección. Un cliente alterado no puede escribir en el expediente una instrucción que la guía
// no dice.
import { randomUUID } from 'node:crypto';
import { cargarGuia } from './guia.js';
import { responder as responderConModelo } from './procedimiento.js';
import { Expediente } from './expediente.js';

const CAMPOS = ['folio', 'monto', 'constancia', 'supervisor_declarado', 'observacion'];
const MAX_CONSULTAS = 200;      // memoria acotada; se descarta la más vieja
const MAX_CUERPO = 1e6;

// Las consultas validadas, por contexto. WeakMap para no atar el módulo a una sola instancia:
// el servidor tiene la suya y cada prueba la suya.
const porContexto = new WeakMap();
const memoria = ctx => { let m = porContexto.get(ctx); if (!m) porContexto.set(ctx, m = new Map()); return m; };

// contextoSucursal(): lo que el servidor inyecta. `llm` es un getter porque el modelo se carga
// después de construir esto; mientras no haya modelo, responder() devuelve null y la ruta da 503.
export function contextoSucursal({ llm, llave, ejecutar, ruta = process.env.EXPEDIENTES ?? 'datos/sucursal.jsonl' } = {}) {
  const guia = cargarGuia();
  const version = guia.texto.match(/Versión de demostración:\s*([0-9-]+)/)?.[1] ?? null;
  return {
    expedientes: new Expediente(ruta),
    llave,
    responder: consulta => { const m = llm?.(); return m ? (ejecutar ? ejecutar(actual => responderConModelo(actual, guia, consulta)) : responderConModelo(m, guia, consulta)) : null; },
    // Lo que este proceso sabe de verdad. Del CORE no se dice nada: su caída la declara la
    // persona en la pantalla, no la diagnostica el nodo.
    estado: () => { const m = llm?.(); return { disponible: !!m, guia: { nombre: 'Guía BPL — demostración sintética', version },
      ejecucion: m ? (m.delegado ? 'delegado a un par' : 'local') : null, hardware: m?.hardware ?? null }; },
  };
}

const json = (res, obj, code = 200, cabeceras = {}) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cabeceras });
  res.end(JSON.stringify(obj));
  return true;
};
const falla = (res, code, codigo, mensaje) => json(res, { error: { codigo, mensaje } }, code);
const cuerpoJson = async req => {
  const trozos = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > MAX_CUERPO) throw new Error('cuerpo muy grande'); trozos.push(c); }
  return JSON.parse(Buffer.concat(trozos).toString('utf8') || '{}');
};
const texto = (v, max = 500) => typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null;

// El expediente lanza Error con mensaje en español; aquí se traduce a código HTTP.
const TRADUCCION = [
  [/modelo no produjo|no.*modelo|par no|connection|timeout/i, 503, 'modelo_no_disponible'],
  [/inexistente/i, 404, 'no_existe'],
  [/cerrado|antes de cerrar|transición/i, 409, 'transicion_incompatible'],
  [/obligatorio|serializable|reservado|muy grande|JSON/i, 400, 'entrada_invalida'],
];

export async function manejarSucursal(req, res, url, ctx) {
  const ruta = url.pathname;
  if (!ruta.startsWith('/api/sucursal')) return false;
  const recordadas = memoria(ctx);
  try {
    if (req.method === 'GET' && ruta === '/api/sucursal/estado') {
      return json(res, ctx.estado ? ctx.estado() : { disponible: !!ctx.responder, guia: null, ejecucion: null, hardware: null });
    }

    // Consultar la guía. Una abstención también es 200: no responder es una respuesta correcta.
    if (req.method === 'POST' && ruta === '/api/sucursal/consulta') {
      const { consulta } = await cuerpoJson(req);
      const limpia = texto(consulta, 2000);
      if (!limpia) return falla(res, 400, 'entrada_invalida', 'Escribe la contingencia que quieres consultar');
      if (!ctx.responder) return falla(res, 503, 'modelo_no_disponible', 'Este nodo no tiene el modelo cargado');
      const respuesta = await ctx.responder(limpia);
      if (!respuesta) return falla(res, 503, 'modelo_no_disponible', 'Este nodo no tiene el modelo cargado');
      const consultaId = randomUUID();
      if (recordadas.size >= MAX_CONSULTAS) recordadas.delete(recordadas.keys().next().value);
      recordadas.set(consultaId, { consulta: limpia, respuesta });
      return json(res, { ...respuesta, consulta: limpia, consultaId });
    }

    if (req.method === 'POST' && ruta === '/api/sucursal/expedientes') {
      const { sucursal, empleado, consultaId } = await cuerpoJson(req);
      const guardada = recordadas.get(consultaId);
      if (!guardada) return falla(res, 400, 'consulta_desconocida', 'Consulta la guía antes de abrir el expediente');
      // El motivo sale de la consulta conservada, no de lo que mande el navegador.
      const id = ctx.expedientes.abrir({ sucursal, empleado, motivo: guardada.consulta });
      if (!guardada.respuesta.cubierto) ctx.expedientes.registrarDato(id, 'resultado_asistente', { estado: 'sin_respaldo', motivo: guardada.respuesta.abstencion?.motivo ?? 'sin respaldo documental', instrucciones_emitidas: false });
      return json(res, { expediente: ctx.expedientes.obtener(id) }, 201);
    }

    const m = ruta.match(/^\/api\/sucursal\/expedientes\/([A-Za-z0-9-]{1,64})(\/pasos|\/datos|\/cerrar|\/acta)?$/);
    if (m) {
      const [, id, cola] = m;
      if (req.method === 'GET' && !cola) return json(res, { expediente: ctx.expedientes.obtener(id) });

      if (req.method === 'GET' && cola === '/acta') {
        const acta = ctx.expedientes.obtener(id).acta ?? null;
        if (!acta) return falla(res, 409, 'sin_acta', 'El expediente todavía no está cerrado');
        return json(res, acta, 200, { 'content-disposition': `attachment; filename="acta-${id}.json"` });
      }

      if (req.method === 'POST' && cola === '/pasos') {
        const { consultaId, indicePaso } = await cuerpoJson(req);
        const guardada = recordadas.get(consultaId);
        if (!guardada?.respuesta?.cubierto) return falla(res, 400, 'consulta_desconocida', 'No hay una consulta con respaldo para ese identificador');
        const linea = guardada.respuesta.pasos?.[indicePaso];
        const cita = guardada.respuesta.citas?.[0];
        if (typeof linea !== 'string' || !cita) return falla(res, 400, 'paso_inexistente', 'Ese paso no está en la respuesta consultada');
        // `paso` es la actuación; `cita` es la línea tal como está escrita en la guía, con su
        // sección. Las dos salen del texto literal, ninguna del navegador.
        return json(res, { expediente: ctx.expedientes.agregarPaso(id, { paso: linea.replace(/^\s*\d+[.)]\s*/, ''), cita: { seccion: cita.seccion, texto: linea } }) });
      }

      if (req.method === 'POST' && cola === '/datos') {
        const { campo, valor } = await cuerpoJson(req);
        if (!CAMPOS.includes(campo)) return falla(res, 400, 'campo_no_permitido', `Campos permitidos: ${CAMPOS.join(', ')}`);
        const v = texto(valor);
        if (!v) return falla(res, 400, 'entrada_invalida', 'El valor va en texto, de 1 a 500 caracteres');
        return json(res, { expediente: ctx.expedientes.registrarDato(id, campo, v) });
      }

      if (req.method === 'POST' && cola === '/cerrar') {
        const antes = ctx.expedientes.obtener(id);
        // Cerrar dos veces no es un error: devuelve el acta que ya existe.
        if (antes.estado === 'cerrado') return json(res, { acta: antes.acta, expediente: antes });
        const acta = ctx.expedientes.cerrar(id, ctx.llave);
        return json(res, { acta, expediente: ctx.expedientes.obtener(id) });
      }
    }

    return falla(res, 404, 'ruta_inexistente', 'Esa ruta no existe en el módulo de sucursal');
  } catch (e) {
    const mensaje = String(e?.message ?? e);
    const t = TRADUCCION.find(([re]) => re.test(mensaje));
    return t ? falla(res, t[1], t[2], mensaje) : falla(res, 500, 'fallo_interno', mensaje);
  }
}
