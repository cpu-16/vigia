export function entropia(texto) {
  const f=new Map(); for(const c of texto) f.set(c,(f.get(c)??0)+1);
  return [...f.values()].reduce((s,n)=>s-n/texto.length*Math.log2(n/texto.length),0);
}
export function rasgos(eventos, ms) {
  const tipos={}, dominios=new Set(), slds=new Set(), intervalos=[];
  let longitud=0, h=0;
  eventos.forEach((e,i)=> { tipos[e.tipo]=(tipos[e.tipo]??0)+1; dominios.add(e.dominio); slds.add(e.sld);
    const etiqueta=e.dominio.split('.')[0]; longitud+=etiqueta.length; h+=entropia(etiqueta);
    if(i) intervalos.push(e.ts-eventos[i-1].ts);
  });
  const n=eventos.length, media=intervalos.reduce((s,x)=>s+x,0)/(intervalos.length||1);
  const sigma=Math.sqrt(intervalos.reduce((s,x)=>s+(x-media)**2,0)/(intervalos.length||1));
  return { consultas:n,tipos,unicos:dominios.size,slds_unicos:slds.size,tasa_qps:n/(ms/1000),longitud_media:longitud/(n||1),entropia_media:h/(n||1),intervalos,intervalo_medio_ms:media,cv:media>0?sigma/media:Infinity };
}
export class Ventanas {
  constructor({ ms=300000, maxEventos=100000 }={}) { if(ms<=0||maxEventos<1) throw new Error('Ventana inválida'); this.ms=ms;this.maxEventos=maxEventos;this.cola=[];this.porCliente=new Map();this.porPadre=new Map();this.ultimo=-Infinity; }
  agregar(e) {
    if(!Number.isFinite(e.ts)||e.ts<this.ultimo) throw new Error('Fecha inválida o fuera de orden'); this.ultimo=e.ts;
    while(this.cola.length && this.cola[0].ts<=e.ts-this.ms) {
      const viejo=this.cola.shift();
      for(const [mapa,k] of [[this.porCliente,viejo.cliente],[this.porPadre,JSON.stringify([viejo.cliente,viejo.sld])]]) { const a=mapa.get(k);a.shift();if(!a.length)mapa.delete(k); }
    }
    // Fallar explícitamente evita métricas silenciosamente truncadas bajo saturación.
    if(this.cola.length>=this.maxEventos) throw new Error('Capacidad de ventana agotada');
    this.cola.push(e);
    for(const [mapa,k] of [[this.porCliente,e.cliente],[this.porPadre,JSON.stringify([e.cliente,e.sld])]]) { if(!mapa.has(k))mapa.set(k,[]);mapa.get(k).push(e); }
    return { cliente:rasgos(this.porCliente.get(e.cliente),this.ms), padre:rasgos(this.porPadre.get(JSON.stringify([e.cliente,e.sld])),this.ms), ventana:{desde:e.ts-this.ms,hasta:e.ts,ms:this.ms} };
  }
}
