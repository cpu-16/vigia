// Installation adds the web interface; models and inference remain in its node.
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'})
    .then(registration=>registration.update())
    .catch(error=>console.warn('Vigía: no se pudo actualizar la caché sin conexión.',error));
}
