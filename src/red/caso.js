// Único punto de inferencia del módulo: el modelo explica, nunca bloquea tráfico.
export const severidades=['media','alta','critica'];
export const acciones=['revisar_equipo','validar_marca','inspeccionar_canal','revisar_periodicidad'];
const catalogo={dga:['alta','Posible dominio generado','revisar_equipo'],typosquat:['media','Posible suplantación de marca','validar_marca'],tunnel:['critica','Posible túnel DNS','inspeccionar_canal'],beacon:['alta','Consultas periódicas sospechosas','revisar_periodicidad']};
export function respaldo(d) {
  const [severidad,titulo,accion_sugerida]=catalogo[d.familia]??['media','Revisar señales DNS','revisar_equipo'];
  return {severidad,titulo,resumen:Object.entries(d.evidencia).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)).map(([k,v])=>`${k}: ${v}`).join('; ')+'.',accion_sugerida};
}
export function cifrasRespaldadas(resumen,evidencia) {
  if(typeof resumen!=='string'||!resumen.trim()||resumen.trim()==='null')return false;
  const cifras=resumen.match(/-?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?/gi)??[];
  const valores=Object.values(evidencia).filter(v=>typeof v==='number'&&Number.isFinite(v));
  return cifras.length>0&&cifras.every(n=>valores.includes(Number(n.replace(',','.'))));
}
export function validarCaso(datos,d) {
  const base=respaldo(d);
  // Además de cifras verificamos el anclaje de cada rasgo y su valor: un número correcto
  // atribuido a otro rasgo tampoco es respaldo. Solo se publican textos del catálogo.
  const resumen=cifrasRespaldadas(datos?.resumen,d.evidencia)&&datos.resumen===base.resumen?datos.resumen:base.resumen;
  return {...base,resumen};
}
const formato=properties=>({type:'json_schema',json_schema:{name:'caso_red',strict:true,schema:{type:'object',additionalProperties:false,properties,required:Object.keys(properties)}}});
const opcion=valores=>({type:'string',enum:valores});
export async function redactar(modelo,d) {
  const {completar,sinThink}=await import('../core/runtime.js');
  const base=respaldo(d);
  // Códigos con significado mantienen corta la salida. El texto numérico se ensambla
  // desde evidencia, sin pedirle al modelo que copie decimales extensos.
  const r=await completar(modelo,{temperature:0,maxTokens:110,responseFormat:formato({severidad:opcion(severidades),titulo:opcion(Object.keys(catalogo)),resumen:opcion(['rasgos_observados','evidencia_insuficiente']),accion_sugerida:opcion(acciones)}),history:[
    {role:'system',content:'Explica señales DNS ya detectadas por reglas. Elige la familia como título, rasgos_observados como resumen si hay evidencia numérica, y la acción correspondiente: dga revisar_equipo alta; typosquat validar_marca media; tunnel inspeccionar_canal critica; beacon revisar_periodicidad alta. No decidas bloqueos. /no_think'},
    {role:'user',content:JSON.stringify({familia:d.familia,evidencia:d.evidencia})}
  ]});
  let datos;try{datos=JSON.parse(sinThink(r.texto));}catch{datos=null;}
  const anclado=datos?.titulo===d.familia&&datos?.resumen==='rasgos_observados'&&datos?.severidad===base.severidad&&datos?.accion_sugerida===base.accion_sugerida;
  return {...validarCaso(anclado?{...base}:null,d),modelo_verificado:anclado,ms:r.ms};
}
export async function desempatar(modelo,candidato) {
  const {completar,sinThink}=await import('../core/runtime.js');
  const r=await completar(modelo,{temperature:0,maxTokens:25,responseFormat:formato({resultado:opcion(['amenaza','benigno','insuficiente'])}),history:[
    {role:'system',content:'Valora únicamente estos rasgos agregados DNS de una zona gris. Sin contexto suficiente elige insuficiente. Tu opinión no cambia las reglas ni autoriza bloqueos. /no_think'},
    {role:'user',content:JSON.stringify({familia:candidato.familia,evidencia:candidato.evidencia})}
  ]});
  try{const v=JSON.parse(sinThink(r.texto)).resultado;return ['amenaza','benigno','insuficiente'].includes(v)?v:'insuficiente';}catch{return 'insuficiente';}
}
