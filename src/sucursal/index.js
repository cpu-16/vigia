export { cargarGuia, buscar, buscarHibrido } from './guia.js';
export { responder } from './procedimiento.js';
export { Expediente, abrir, agregarPaso, registrarDato, cerrar } from './expediente.js';
// Node 24 resuelve la carpeta a index.js cuando se pasa explícitamente a --test.
if (process.env.NODE_TEST_CONTEXT) await import('./sucursal.test.js');
