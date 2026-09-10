importScripts('/pwa-cache.js');
self.instalarCacheVigia({
  cache:'vigia-sucursal-local-v1',prefix:'vigia-sucursal-local-v',
  archivos:['/','/sucursal','/manifest.webmanifest','/icono.svg','/icono-192.png','/icono-512.png','/pwa.js','/pwa-cache.js'],
  navegaciones:['/','/sucursal']
});
