import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coseno, combinar } from './semantica.js';

test('coseno: idénticos 1, opuestos −1, ortogonales 0', () => {
  assert.equal(coseno([1, 0, 0], [1, 0, 0]), 1);
  assert.equal(coseno([1, 0], [-1, 0]), -1);
  assert.equal(coseno([1, 0], [0, 1]), 0);
  assert.equal(coseno([0, 0], [1, 1]), 0, 'un vector nulo no rompe');
  assert.ok(coseno([2, 0], [1, 0]) === 1, 'la magnitud no cuenta, solo la dirección');
});

test('la fusión por rango premia lo que sale alto en las dos listas', () => {
  const exacta = [{ titulo: 'A' }, { titulo: 'B' }, { titulo: 'C' }];
  const semantica = [{ titulo: 'C' }, { titulo: 'A' }, { titulo: 'D' }];
  const r = combinar([exacta, semantica], { n: 3 });
  assert.equal(r[0].titulo, 'A', 'primero en una y segundo en la otra gana');
  assert.deepEqual(r.map(x => x.titulo).sort(), ['A', 'B', 'C']);
  assert.ok(r[0].rrf > r[2].rrf);
});

test('la fusión no mezcla escalas: un coseno y un puntaje de términos no se suman', () => {
  // Si se sumaran los puntajes crudos, un coseno de 0.9 aplastaría a un puntaje de términos de 30.
  const exacta = [{ titulo: 'RET-ISL-01', puntaje: 30 }];
  const semantica = [{ titulo: 'DOC-NAT-01', similitud: 0.91 }, { titulo: 'RET-ISL-01', similitud: 0.88 }];
  const r = combinar([exacta, semantica], { n: 2 });
  assert.equal(r[0].titulo, 'RET-ISL-01', 'el código exacto no lo desplaza un coseno alto');
});

test('sin índice semántico, la búsqueda híbrida se comporta como la exacta', async () => {
  const { cargarGuia, buscar, buscarHibrido } = await import('../sucursal/guia.js');
  const guia = cargarGuia();
  const soloExacta = buscar(guia, 'tope de retiro en modo isla', 3);
  const hibrida = await buscarHibrido(guia, 'tope de retiro en modo isla', { n: 3 });
  assert.deepEqual(hibrida.map(s => s.titulo), soloExacta.map(s => s.titulo));
});

// Con PRUEBA_MODELO=1: los embeddings de verdad, y se mide qué aporta la capa semántica.
const PARAFRASEADAS = [
  ['no tengo señal con el sistema central, ¿cuánto le puedo entregar a una persona?', 'RET-ISL-01'],
  ['a la caja le falta plata al cierre, ¿qué hago?', 'CAJ-ARQ-01'],
  ['viene un señor de otro país a abrir cuenta, ¿qué papeles le pido?', 'DOC-EXT-01'],
  ['¿la huella del cliente se puede guardar donde sea?', 'DAT-PRI-01'],
];
test('la capa semántica del SDK recupera preguntas parafraseadas', { skip: !process.env.PRUEBA_MODELO, timeout: 900_000 }, async () => {
  const { cargarEmbeddings, indexar } = await import('./semantica.js');
  const { cargarGuia, buscar, buscarHibrido } = await import('../sucursal/guia.js');
  const { unloadModel } = await import('@qvac/sdk');
  const guia = cargarGuia();
  const emb = await cargarEmbeddings({ device: process.env.CPU ? 'cpu' : 'gpu' });
  try {
    const indice = await indexar(emb, guia.secciones);
    let soloExacta = 0, hibrida = 0;
    for (const [pregunta, codigo] of PARAFRASEADAS) {
      const e = buscar(guia, pregunta, 3).some(s => s.titulo.startsWith(codigo));
      const h = (await buscarHibrido(guia, pregunta, { emb, indice, n: 3 })).some(s => s.titulo.startsWith(codigo));
      soloExacta += Number(e); hibrida += Number(h);
      console.log(`  exacta ${e ? '✓' : '✗'} · híbrida ${h ? '✓' : '✗'}  ${pregunta.slice(0, 55)}`);
    }
    console.log(`Preguntas parafraseadas recuperadas: solo términos ${soloExacta}/${PARAFRASEADAS.length} · híbrida ${hibrida}/${PARAFRASEADAS.length}`);
    assert.ok(hibrida >= soloExacta, 'la capa semántica no debe empeorar la recuperación');
  } finally { await unloadModel({ modelId: emb.modelId, clearStorage: false }).catch(() => {}); }
});
