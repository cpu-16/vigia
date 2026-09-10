import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {crearServidorLocal} from './sucursal-local.js';
const code=await readFile(new URL('../../app/pwa-cache.js',import.meta.url),'utf8');
function worker(fetcher){
 const handlers={},stores=new Map();
 const caches={keys:async()=>[...stores.keys()],delete:async k=>stores.delete(k),open:async k=>{if(!stores.has(k))stores.set(k,new Map());const s=stores.get(k);return {put:async(k,v)=>s.set(k,v),match:async k=>s.get(k)}}};
 const self={location:{origin:'http://localhost'},addEventListener:(k,f)=>handlers[k]=f,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 vm.runInNewContext(code,{self,caches,fetch:fetcher,Request:class extends Request{constructor(u,o){super(new URL(u,'http://localhost'),o)}},Response,URL});
 self.instalarCacheVigia({cache:'vigia-v13',prefix:'vigia-v',archivos:['/equipos','/pwa.js'],navegaciones:['/equipos']});
 return {handlers,stores,caches};
}
test('SW rechaza login redirigido sin escribir ninguna entrada',async()=>{
 const w=worker(async()=>({ok:true,redirected:true}));let p;w.handlers.install({waitUntil:v=>p=v});await assert.rejects(p,/precargar/);assert.equal(w.stores.size,0);
});
test('SW no intercepta APIs, POST ni orígenes ajenos',()=>{
 const w=worker(()=>{throw Error('no debe consultar')});for(const [url,method] of [['http://localhost/api/sucursal/estado','GET'],['http://localhost/equipos','POST'],['https://otro.test/equipos','GET']])w.handlers.fetch({request:new Request(url,{method}),respondWith:()=>assert.fail('interceptado')});
});
test('SW devuelve autenticación online y no reemplaza con shell viejo',async()=>{
 const w=worker(async()=>new Response('acceso',{status:401}));await(await w.caches.open('vigia-v13')).put('/equipos',new Response('viejo'));let p;w.handlers.fetch({request:new Request('http://localhost/equipos'),respondWith:v=>p=v,waitUntil:()=>{}});assert.equal((await p).status,401);
});
test('SW actualiza solo sus caches y JS ausente jamás recibe HTML',async()=>{
 const w=worker(async()=>{throw Error('offline')});for(const k of ['vigia-v12','vigia-v13','otra-app'])await w.caches.open(k);let p;w.handlers.activate({waitUntil:v=>p=v});await p;assert.deepEqual([...w.stores.keys()],['vigia-v13','otra-app']);w.handlers.fetch({request:new Request('http://localhost/pwa.js'),respondWith:v=>p=v});assert.equal((await p).type,'error');
});
test('rutas PWA locales explícitas, iconos PNG y manifest estable',async t=>{
 const server=crearServidorLocal();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
 const manifest=await(await fetch(base+'/manifest.webmanifest')).json();assert.equal(manifest.id,'/sucursal');assert.equal(manifest.start_url,'/sucursal');
 for(const size of [192,512]){const r=await fetch(base+'/icono-'+size+'.png');assert.equal(r.headers.get('content-type'),'image/png');const b=Buffer.from(await r.arrayBuffer());assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);}
 assert.match((await fetch(base+'/sw.js')).headers.get('content-type'),/javascript/);assert.equal((await fetch(base+'/archivo-arbitrario.js')).status,404);
});
