import { aleatorio } from '../../fixtures/red/inyector.js';
export const distribuciones={
  canal:{latencia_base_ms:18,dispersion_ms:22,prob_nxdomain:0.02,capacidad_qps:400},
  istmo:{latencia_base_ms:35,dispersion_ms:50,prob_nxdomain:0.05,capacidad_qps:300},
  pacifico:{latencia_base_ms:65,dispersion_ms:100,prob_nxdomain:0.1,capacidad_qps:200},
  otras:{latencia_base_ms:30,dispersion_ms:40,prob_nxdomain:0.04,capacidad_qps:300}
};
export const zonaDe=ip=>ip.startsWith('190.14.')?'canal':ip.startsWith('200.12.')?'istmo':ip.startsWith('138.118.')?'pacifico':'otras';
export function simular(e,{semilla=1,perfil=distribuciones[zonaDe(e.cliente)]}={}) {
  const r=aleatorio(`${semilla}|${e.ts}|${e.cliente}|${e.dominio}|${e.tipo}`);
  // Latencia uniforme [base, base+dispersión]; NXDOMAIN Bernoulli por zona.
  return {...e,zona:zonaDe(e.cliente),sitio:e.resolutor,latency_ms:perfil.latencia_base_ms+r()*perfil.dispersion_ms,rcode:r()<perfil.prob_nxdomain?'NXDOMAIN':'NOERROR',synthetic_fields:['latency_ms','rcode']};
}
const limitar=x=>Math.max(0,Math.min(1,x));
export function calcular(eventos,{duracionMs=60000,capacidadQps,pesos=[45,35,20]}={}) {
  if(!eventos.length||duracionMs<=0||pesos.length!==3||pesos.some(x=>!Number.isFinite(x)||x<0)||Math.abs(pesos.reduce((a,b)=>a+b,0)-100)>1e-8)throw new Error('Parámetros QoE inválidos');
  const {zona,sitio}=eventos[0];
  if(eventos.some(e=>e.zona!==zona||e.sitio!==sitio||!Number.isFinite(e.latency_ms)||e.latency_ms<0||typeof e.rcode!=='string'))throw new Error('Mezcla de zonas, sitios o campos incompletos');
  capacidadQps??=distribuciones[zona]?.capacidad_qps;
  if(!(capacidadQps>0))throw new Error('Falta capacidad declarada');
  const latencias=eventos.map(e=>e.latency_ms).sort((a,b)=>a-b),p95=latencias[Math.ceil(latencias.length*0.95)-1];
  const nx=100*eventos.filter(e=>e.rcode==='NXDOMAIN').length/eventos.length,qps=eventos.length/(duracionMs/1000),saturacion=limitar(qps/capacidadQps);
  const penalizacion_latencia=pesos[0]*limitar((p95-20)/180),penalizacion_nxdomain=pesos[1]*nx/100,penalizacion_saturacion=pesos[2]*saturacion;
  return {timestamp:new Date(Math.max(...eventos.map(e=>e.ts))).toISOString(),zona,sitio,consultas:eventos.length,p95_latency_ms:p95,nxdomain_pct:nx,qps,capacidad_qps:capacidadQps,saturacion,penalizacion_latencia,penalizacion_nxdomain,penalizacion_saturacion,score:100-penalizacion_latencia-penalizacion_nxdomain-penalizacion_saturacion,synthetic_fields:[...new Set(eventos.flatMap(e=>e.synthetic_fields??[]))]};
}
export const crearTabla=`CREATE TABLE IF NOT EXISTS red_qoe (timestamp DateTime64(3, 'UTC'), zona LowCardinality(String), sitio String, consultas UInt32, p95_latency_ms Float64, nxdomain_pct Float64, qps Float64, capacidad_qps Float64, saturacion Float64, penalizacion_latencia Float64, penalizacion_nxdomain Float64, penalizacion_saturacion Float64, score Float64, synthetic_fields Array(String)) ENGINE = MergeTree ORDER BY (zona, sitio, timestamp)`;
export const insertar=filas=>'INSERT INTO red_qoe FORMAT JSONEachRow\n'+filas.map(f=>JSON.stringify({...f,timestamp:f.timestamp.replace('T',' ').replace('Z','')})).join('\n')+'\n';
// Destino deliberadamente fijo a loopback. El operador usa un túnel LOCAL si ClickHouse está en otra máquina.
export async function escribirClickHouse(filas,{fetchLocal=fetch}={}) {
  const r=await fetchLocal('http://127.0.0.1:8123/',{method:'POST',body:insertar(filas),signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error(`ClickHouse local respondió ${r.status}`);
}
