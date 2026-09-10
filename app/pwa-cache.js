// Shared cache policy. Only app-shell assets; never API, login or captured data.
self.instalarCacheVigia = ({cache, prefix, archivos, navegaciones}) => {
  const paths=new Set(archivos), pages=new Set(navegaciones);
  const valida=(r,path)=>r.ok&&!r.redirected&&(!pages.has(path)||String(r.headers.get('content-type')).includes('text/html'));
  self.addEventListener('install',event=>event.waitUntil((async()=>{
    // Validate everything before writing: an expired session must not cache login
    // redirects under the URLs of application pages or scripts.
    const responses=await Promise.all(archivos.map(async path=>{
      const r=await fetch(new Request(path,{credentials:'same-origin',cache:'reload'}));
      if(!valida(r,path))throw new Error('No se pudo precargar '+path);
      return [path,r];
    }));
    const storage=await caches.open(cache);
    await Promise.all(responses.map(([path,r])=>storage.put(path,r)));
    await self.skipWaiting();
  })()));
  self.addEventListener('activate',event=>event.waitUntil((async()=>{
    await Promise.all((await caches.keys()).filter(k=>k.startsWith(prefix)&&k!==cache).map(k=>caches.delete(k)));
    await self.clients.claim();
  })()));
  self.addEventListener('fetch',event=>{
    const request=event.request,url=new URL(request.url);
    if(request.method!=='GET'||url.origin!==self.location.origin||!paths.has(url.pathname))return;
    const key=url.pathname;
    event.respondWith((async()=>{
      try{
        const r=await fetch(request);
        // A server authentication response always wins while online; never
        // replace a 401/redirect with old application content.
        if(valida(r,key)){const copy=r.clone();event.waitUntil(caches.open(cache).then(c=>c.put(key,copy)));}
        return r;
      }catch{
        const cached=await (await caches.open(cache)).match(key);
        if(cached)return cached;
        // Missing scripts/images stay errors, never HTML masquerading as JS.
        if(request.mode==='navigate')return new Response('Vigía no tiene esta pantalla guardada. Abre la aplicación cuando el nodo esté disponible.',{status:503,headers:{'content-type':'text/plain; charset=utf-8'}});
        return Response.error();
      }
    })());
  });
};
