// Consumidor adicional: recibe AsyncIterable; nunca escribe al bus de producción.
import { Detector } from './deteccion.js';
import { redactar } from './caso.js';
import { emitir } from './wazuh.js';
import { simular, calcular } from './qoe.js';
export async function consumir(flujo,{listaBlanca,modelo,archivoAlertas,guardarQoe,ventanaQoeMs=60000,maxEventosQoe=100000}={}) {
  if(!archivoAlertas||typeof guardarQoe!=='function'||ventanaQoeMs<=0)throw new Error('Faltan destinos locales o ventana válida');
  const detector=new Detector({listaBlanca}),grupos=new Map(),silencio=new Map();
  let bloque,ultimo=-Infinity,total=0,alertas=0,conteoQoe=0;const latencias=[];
  const vaciar=async()=>{if(grupos.size)await guardarQoe([...grupos.values()].map(g=>calcular(g,{duracionMs:ventanaQoeMs})));grupos.clear();conteoQoe=0;};
  for await(const e of flujo) {
    const inicio=performance.now();
    if(e.ts<ultimo)throw new Error('Flujo fuera de orden');ultimo=e.ts;total++;
    const b=Math.floor(e.ts/ventanaQoeMs);
    if(bloque!==undefined&&b!==bloque)await vaciar();bloque=b;
    const q=simular(e),k=JSON.stringify([q.zona,q.sitio]);
    if(conteoQoe>=maxEventosQoe)throw new Error('Capacidad QoE agotada');
    if(!grupos.has(k))grupos.set(k,[]);grupos.get(k).push(q);conteoQoe++;
    for(const [clave,ts]of silencio)if(ts<=e.ts-300000)silencio.delete(clave);
    for(const d of detector.procesar(e)) {
      const clave=JSON.stringify([d.familia,d.cliente,e.sld]);if(silencio.has(clave))continue;
      // La alerta inmediata no espera los segundos de generación del modelo.
      await emitir(archivoAlertas,d);alertas++;silencio.set(clave,e.ts);
      latencias.push(performance.now()-inicio);if(latencias.length>10000)latencias.shift();
      // Explicación opcional con backpressure explícito; la suscripción debe tener retención.
      if(modelo)await redactar(modelo,d);
    }
  }
  await vaciar();
  return {consultas:total,alertas,latencias_evento_alerta_ms:latencias};
}
