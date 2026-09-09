// Consumidor adicional: recibe AsyncIterable; nunca escribe al bus de producción.
import { Detector } from './deteccion.js';
import { redactar, respaldo } from './caso.js';
import { appendFile } from 'node:fs/promises';
import { setTimeout as esperar } from 'node:timers/promises';
import { emitir, enviarApi, apiDesdeEntorno, LOTE_MAXIMO } from './wazuh.js';
import { simular, calcular } from './qoe.js';
export async function consumir(flujo,{listaBlanca,modelo,archivoAlertas,archivoCasos,guardarQoe,ventanaQoeMs=60000,maxEventosQoe=100000,api=apiDesdeEntorno(),loteApi=LOTE_MAXIMO,intervaloApiMs=2500,alProgresar}={}) {
  if((modelo&&!archivoCasos)||!archivoAlertas||typeof guardarQoe!=='function'||ventanaQoeMs<=0)throw new Error('Faltan destinos locales o ventana válida');
  const detector=new Detector({listaBlanca}),grupos=new Map(),silencio=new Map();
  const porFamilia={dga:0,typosquat:0,tunnel:0,beacon:0},latencias=[],latenciasApi=[],pendientesApi=[];
  let bloque,ultimo=-Infinity,total=0,alertas=0,conteoQoe=0;
  let token=api?.token,enviadasApi=0,fallidasApi=0,errorApi=null,peticionesApi=0,reencolados=0,ultimoEnvio=-Infinity,retroceso=0,ultimoCaso=null;
  const vaciar=async()=>{if(grupos.size)await guardarQoe([...grupos.values()].map(g=>calcular(g,{duracionMs:ventanaQoeMs})));grupos.clear();conteoQoe=0;};
  // El endpoint /events del manager admite 30 peticiones por minuto y 100 eventos por
  // petición (MAX_REQUESTS_EVENTS_DEFAULT en su middleware; un POST por alerta devuelve
  // 429, comprobado el 9-sep). Por eso se agrupa hasta `loteApi` alertas o `intervaloApiMs`,
  // lo que ocurra primero: 24 peticiones/minuto, techo de 2400 alertas/minuto. El JSONL ya
  // está escrito cuando esto corre, así que agrupar no retrasa la evidencia en disco.
  const vaciarApi=async forzar=>{
    if(!api||!pendientesApi.length)return;
    const falta=intervaloApiMs+retroceso-(performance.now()-ultimoEnvio);
    if(falta>0) {if(!forzar&&pendientesApi.length<loteApi)return;await esperar(falta);}
    const lote=pendientesApi.splice(0,loteApi);ultimoEnvio=performance.now();peticionesApi++;
    try {
      const r=await enviarApi(lote.map(x=>x.d),{...api,token,lote:loteApi});
      token=r.token;enviadasApi+=r.enviados;fallidasApi+=r.fallidos;retroceso=0;
      for(const x of lote)latenciasApi.push(performance.now()-x.t0);
      if(latenciasApi.length>10000)latenciasApi.splice(0,latenciasApi.length-10000);
    } catch(err) {
      errorApi=String(err?.message??err);
      // Un 429 no pierde la alerta: el lote vuelve a la cola y el próximo intento espera más.
      if(/ 429/.test(errorApi)) {pendientesApi.unshift(...lote);reencolados++;retroceso=Math.min(retroceso?retroceso*2:5000,60000);}
      else fallidasApi+=lote.length;
    }
  };
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
      await emitir(archivoAlertas,d);alertas++;porFamilia[d.familia]++;silencio.set(clave,e.ts);
      latencias.push(performance.now()-inicio);if(latencias.length>10000)latencias.shift();
      // El JSONL queda siempre: es el respaldo cuando la API local no responde, y lo que
      // lee el `localfile` del agente de Wazuh si se prefiere el transporte estándar.
      if(api)pendientesApi.push({d,t0:inicio});
      // Explicación opcional con backpressure explícito; la suscripción debe tener retención.
      if(modelo) {
        let caso;try {caso=await redactar(modelo,d);} catch {caso={...respaldo(d),modelo_verificado:false,error:'Inferencia local no disponible'};}
        await appendFile(archivoCasos,JSON.stringify({familia:d.familia,ventana:d.ventana,caso})+'\n',{mode:0o640});
        ultimoCaso={familia:d.familia,dominio:d.dominio,titulo:caso.titulo,verificado:caso.modelo_verificado===true,ms:caso.ms??null};
      }
    }
    await vaciarApi(false);
    if(alProgresar)alProgresar({ts:e.ts,consultas:total,alertas,por_familia:{...porFamilia},enviadas_api:enviadasApi,fallidas_api:fallidasApi,ultimo_caso:ultimoCaso});
  }
  for(let i=0;pendientesApi.length&&i<20;i++)await vaciarApi(true);
  if(pendientesApi.length){fallidasApi+=pendientesApi.length;pendientesApi.length=0;} // quedan en el JSONL
  await vaciar();
  return {consultas:total,alertas,por_familia:porFamilia,latencias_evento_alerta_ms:latencias,
    api:api?{destino:api.url,enviadas:enviadasApi,fallidas:fallidasApi,peticiones:peticionesApi,reencolados_429:reencolados,error:errorApi,latencias_evento_api_ms:latenciasApi}:null};
}
