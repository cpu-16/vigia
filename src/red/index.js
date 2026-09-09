export { consumir } from './agente.js';
export { reproducir, parsear, leer } from './consumidor.js';
export { Detector, construirListaBlanca } from './deteccion.js';
// Node 24 resuelve el directorio por index.js cuando se ejecuta node --test src/red/.
if (process.env.NODE_TEST_CONTEXT) await import('./red.test.js');
