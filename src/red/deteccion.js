import { Ventanas, entropia } from './ventanas.js';
import { marcas } from '../../fixtures/red/inyector.js';
import { domainToUnicode } from 'node:url';
// Damerau-Levenshtein completo: permite transposiciones sin la restricción OSA.
export function damerau(a,b) {
  a=Array.from(a);b=Array.from(b);const n=a.length,m=b.length,max=n+m,d=Array.from({length:n+2},()=>Array(m+2).fill(0)),ult=new Map();
  d[0][0]=max;
  for(let i=0;i<=n;i++){d[i+1][0]=max;d[i+1][1]=i;}
  for(let j=0;j<=m;j++){d[0][j+1]=max;d[1][j+1]=j;}
  for(let i=1;i<=n;i++){let db=0;for(let j=1;j<=m;j++){
    const i1=ult.get(b[j-1])??0,j1=db;let costo=1;
    if(a[i-1]===b[j-1]){costo=0;db=j;}
    d[i+1][j+1]=Math.min(d[i][j]+costo,d[i+1][j]+1,d[i][j+1]+1,d[i1][j1]+i-i1-1+1+j-j1-1);
  }ult.set(a[i-1],i);}
  return d[n+1][m+1];
}
const similares={'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','і':'i','0':'o','1':'l','ⅼ':'l'};
export const normalizarHomoglifos=s=>Array.from(domainToUnicode(s)||s).map(c=>similares[c]??c).join('');
// Perfil acotado y congelado ANTES de detectar: evita que una inyección se autoincluya.
export async function construirListaBlanca(fuente,{n=100,minClientes=5,maxEventos=20000}={}) {
  const perfil=new Map();let total=0;
  for await(const e of fuente) { if(total++>=maxEventos)break;if(e.etiqueta)continue;
    if(!perfil.has(e.sld))perfil.set(e.sld,{consultas:0,clientes:new Set()});
    const p=perfil.get(e.sld);p.consultas++;p.clientes.add(e.cliente);
  }
  return new Set([...perfil].filter(([,p])=>p.clientes.size>=minClientes).sort((a,b)=>b[1].clientes.size-a[1].clientes.size||b[1].consultas-a[1].consultas||a[0].localeCompare(b[0])).slice(0,n).map(([d])=>d));
}
export class Detector {
  constructor({listaBlanca=new Set(),ventanaMs=300000,maxEventos=100000,cvMax=0.12,minRepeticiones=8}={}) {
    this.blanca=new Set(listaBlanca);this.ventanas=new Ventanas({ms:ventanaMs,maxEventos});this.cvMax=cvMax;this.minRepeticiones=minRepeticiones;this.candidatos=[];
  }
  procesar(e) {
    const {cliente:c,padre:p,ventana}=this.ventanas.agregar(e),salida=[];this.candidatos=[];
    if(this.blanca.has(e.sld))return salida;
    const l=e.dominio.split('.')[0],h=entropia(l);
    const agregar=(familia,score,evidencia)=>salida.push({familia,cliente:e.cliente,dominio:e.dominio,score,evidencia,ventana});
    if(l.length>=8&&l.length<=24&&h>=2.8&&c.consultas>=8&&c.slds_unicos/c.consultas>=0.75&&['A','AAAA'].includes(e.tipo))
      agregar('dga',0.85,{longitud:l.length,entropia:h,consultas:c.consultas,ratio_sld_unicos:c.slds_unicos/c.consultas});
    const base=(domainToUnicode(e.sld)||e.sld).split('.')[0],normal=normalizarHomoglifos(base);
    const distancia=Math.min(...marcas.map(m=>damerau(normal,m))),homoglifo=normal!==base&&marcas.includes(normal);
    if((distancia>0&&distancia<=2)||homoglifo)
      agregar('typosquat',0.9,{distancia,homoglifos:Number(homoglifo),longitud:base.length});
    const proporcion=((p.tipos.TXT??0)+(p.tipos.NULL??0)+(p.tipos.TYPE10??0))/p.consultas;
    if(l.length>=40&&h>=3.5&&p.consultas>=8&&proporcion>=0.8&&p.unicos/p.consultas>=0.8)
      agregar('tunnel',0.95,{longitud:l.length,entropia:h,proporcion_txt_null:proporcion,subdominios_unicos:p.unicos,consultas:p.consultas});
    if(p.consultas>=this.minRepeticiones&&p.unicos===1&&p.intervalo_medio_ms>=1000&&p.cv<=this.cvMax)
      agregar('beacon',0.85,{repeticiones:p.consultas,intervalo_medio_ms:p.intervalo_medio_ms,cv:p.cv});
    // Zona gris consultable por el operador; nunca se convierte en alerta por opinión del modelo.
    if(p.consultas>=this.minRepeticiones&&p.unicos===1&&p.intervalo_medio_ms>=1000&&p.cv>this.cvMax&&p.cv<=0.25)
      this.candidatos.push({familia:'beacon',cliente:e.cliente,dominio:e.dominio,score:0.5,evidencia:{repeticiones:p.consultas,intervalo_medio_ms:p.intervalo_medio_ms,cv:p.cv},ventana});
    return salida;
  }
}
