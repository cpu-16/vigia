import { appendFile } from 'node:fs/promises';
import { respaldo } from './caso.js';
export function formatear(d,caso=respaldo(d)) {
  if(!['dga','typosquat','tunnel','beacon'].includes(d.familia)||!Number.isFinite(d.score))throw new Error('Detección inválida');
  const severity=respaldo(d).severidad;
  const fila={integration:'vigia-red',timestamp:new Date(d.ventana.hasta).toISOString(),threat:true,family:d.familia,client_ip:d.cliente,domain:d.dominio,score:d.score,severity,rule_hint:`vigia_${d.familia}_${severity}`};
  for(const [k,v]of Object.entries(d.evidencia)) {if(!/^[a-z_]+$/.test(k)||!Number.isFinite(v))throw new Error('Rasgo inválido');fila[`evidence_${k}`]=v;}
  return fila;
}
export async function emitir(ruta,d,caso) {const fila=formatear(d,caso);await appendFile(ruta,JSON.stringify(fila)+'\n',{encoding:'utf8',mode:0o640});return fila;}
