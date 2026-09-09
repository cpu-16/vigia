// Tráfico exclusivamente sintético; marcas inventadas para el ejercicio.
import { segundoNivel } from '../../src/red/consumidor.js';
export const marcas = ['bancocanalito','bancoistmelia','cajabrisal'];
export function aleatorio(semilla=1) {
  let s=2166136261;
  for (const c of String(semilla)) s=Math.imul(s^c.charCodeAt(0),16777619)>>>0;
  return () => { s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
}
export function* generar({ familia, n=100, semilla=1, inicio=Date.parse('2026-09-09T12:49:00Z'), periodo=10000, jitter=0.05, cliente='192.0.2.40' } = {}) {
  if (!['dga','typosquat','tunnel','beacon'].includes(familia) || !Number.isInteger(n) || n<0 || jitter<0 || jitter>=1 || periodo<=0) throw new Error('Parámetros de inyección inválidos');
  const azar=aleatorio(semilla), cadena=(abc,k)=>Array.from({length:k},()=>abc[Math.floor(azar()*abc.length)]).join('');
  let ts=inicio;
  for(let i=0;i<n;i++) {
    let dominio,tipo='A';
    if(familia==='dga') dominio=cadena('abcdefghijklmnopqrstuvwxyz',8+Math.floor(azar()*13))+['.com','.net','.org'][i%3];
    if(familia==='tunnel') { dominio=cadena('abcdefghijklmnopqrstuvwxyz234567',54)+'.canal-prueba.example'; tipo=i%2?'TXT':'NULL'; }
    if(familia==='beacon') dominio='pulso-control.example';
    if(familia==='typosquat') {
      const b=marcas[i%marcas.length], j=2;
      dominio=[b.slice(0,j)+'x'+b.slice(j+1),b.slice(0,j)+b.slice(j+1),b.slice(0,j)+b[j+1]+b[j]+b.slice(j+2),b.replaceAll('a','а')][i%4]+'.com';
    }
    yield { ts,cliente,dominio,sld:segundoNivel(dominio),tipo,flags:'+',resolutor:'192.0.2.53',etiqueta:familia };
    ts += familia==='beacon' ? Math.round(periodo*(1+jitter*(2*azar()-1))) : 120+Math.floor(azar()*800);
  }
}
