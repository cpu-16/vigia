import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Eventos } from '../core/eventos.js';
import { sellar } from '../core/sello.js';

const texto = (v, nombre) => {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${nombre} es obligatorio`);
  return v.trim();
};
// Recarga antes de cada operación: admite instancias sucesivas en un mismo proceso.
// Un solo proceso escritor por archivo; no es un motor de transacciones bancarias.
export class Expediente {
  constructor(ruta = fileURLToPath(new URL('./datos/sucursal.jsonl', import.meta.url))) { this.ruta = ruta; this.reconstruir(); }
  reconstruir() {
    this.eventos = new Eventos(this.ruta);
    if (!this.eventos.verificarCadena().valida) throw new Error('Cadena del expediente alterada');
    this.casos = new Map();
    for (const e of this.eventos.leer()) {
      const d = e.datos;
      if (e.tipo === 'abierto') {
        if (this.casos.has(d.id)) throw new Error('Expediente duplicado');
        this.casos.set(d.id, { ...d, estado: 'abierto', pasos: [], datos: {}, apertura: e.ts });
      } else {
        const caso = this.casos.get(d.id);
        if (!caso || caso.estado === 'cerrado') throw new Error('Transición inválida');
        if (e.tipo === 'paso') { caso.pasos.push(d.detalle); caso.estado = 'en_proceso'; }
        else if (e.tipo === 'dato') { Object.defineProperty(caso.datos, d.campo, { value: d.valor, enumerable: true, configurable: true, writable: true }); caso.estado = 'en_proceso'; }
        else if (e.tipo === 'cerrado' && caso.estado === 'en_proceso') { caso.estado = 'cerrado'; caso.acta = d.acta; }
        else throw new Error('Evento o transición inválida');
      }
    }
  }
  listar() { this.reconstruir(); return [...this.casos.values()].map(c => ({ id: c.id, sucursal: c.sucursal, empleado: c.empleado, motivo: c.motivo, estado: c.estado, apertura: c.apertura, cierre: c.acta?.cierre ?? c.acta?.sello?.ts ?? null })).sort((a,b) => b.apertura.localeCompare(a.apertura)); }
  obtener(id) { this.reconstruir(); const c = this.casos.get(id); if (!c) throw new Error('Expediente inexistente'); return structuredClone(c); }
  editable(id) { const c = this.obtener(id); if (c.estado === 'cerrado') throw new Error('El expediente está cerrado'); return c; }
  abrir({ sucursal, empleado, motivo }) {
    this.reconstruir();
    const id = randomUUID();
    this.eventos.agregar('abierto', { id, sucursal: texto(sucursal, 'Sucursal'), empleado: texto(empleado, 'Empleado'), motivo: texto(motivo, 'Motivo') });
    return id;
  }
  agregarPaso(id, { paso, cita }) {
    this.editable(id);
    const detalle = { paso: texto(paso, 'Paso'), cita: { seccion: texto(cita?.seccion, 'Sección de la cita'), texto: texto(cita?.texto, 'Texto de la cita') } };
    this.eventos.agregar('paso', { id, detalle });
    return this.obtener(id);
  }
  registrarDato(id, campo, valor) {
    this.editable(id); texto(campo, 'Campo');
    if (['__proto__', 'constructor', 'prototype'].includes(campo)) throw new Error('Campo reservado');
    // Validar antes de agregar: solo valores JSON sin pérdidas silenciosas.
    const json = JSON.stringify(valor, (_, v) => { if (v === undefined || typeof v === 'function' || typeof v === 'symbol' || (typeof v === 'number' && !Number.isFinite(v))) throw new Error('Dato no serializable'); return v; });
    if (json === undefined) throw new Error('Dato no serializable');
    this.eventos.agregar('dato', { id, campo, valor: JSON.parse(json) });
    return this.obtener(id);
  }
  cerrar(id, llave) {
    const caso = this.editable(id);
    if (caso.estado !== 'en_proceso') throw new Error('Registre un paso o dato antes de cerrar');
    const acta = sellar({ ...caso, estado: 'cerrado', cierre: new Date().toISOString(), alcance: 'Documentación sintética; no ejecuta transacciones bancarias', ultimaHuella: this.eventos.ultimo.huella }, llave, { firmante: caso.empleado });
    this.eventos.agregar('cerrado', { id, acta });
    return structuredClone(acta);
  }
}
let almacen;
const local = () => almacen ??= new Expediente();
export const abrir = datos => local().abrir(datos);
export const agregarPaso = (id, detalle) => local().agregarPaso(id, detalle);
export const registrarDato = (id, campo, valor) => local().registrarDato(id, campo, valor);
export const cerrar = (id, llave) => local().cerrar(id, llave);
