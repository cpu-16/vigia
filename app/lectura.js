import { prepararLectura } from "/texto-voz.js";
// Lectura voluntaria. Cambiar de contexto invalida las respuestas de audio tardías.
export function crearLectura(contenedor) {
  const escuchar = document.createElement('button'), detener = document.createElement('button');
  const mensaje = document.createElement('p'), reproductor = document.createElement('audio');
  escuchar.type = detener.type = 'button'; escuchar.className = detener.className = 'menor';
  escuchar.textContent = 'Escuchar'; detener.textContent = 'Detener'; detener.hidden = true;
  mensaje.setAttribute('role', 'status'); mensaje.setAttribute('aria-live', 'polite');
  mensaje.style.cssText = 'font-size:13px;line-height:1.5;margin:8px 0;color:var(--tinta-suave)';
  reproductor.style.cssText = 'max-width:100%;margin:8px 0';
  detener.style.marginLeft = '8px';
  reproductor.controls = true; reproductor.hidden = true; reproductor.preload = 'none';
  contenedor.append(escuchar, detener, mensaje, reproductor);
  let texto = '', titulo = 'Escuchar', permitido = true, disponible = false, version = 0, controlador = null, url = null, activo = false;
  const pintar = () => { contenedor.hidden = !texto || !permitido || !disponible; escuchar.disabled = activo; detener.hidden = !activo; escuchar.textContent = titulo; };
  function parar(limpiar = true) {
    version++; controlador?.abort(); controlador = null; reproductor.pause(); reproductor.removeAttribute('src'); reproductor.load();
    if (url) URL.revokeObjectURL(url); url = null; activo = false; reproductor.hidden = true;
    if (limpiar) mensaje.textContent = ''; pintar();
  }
  escuchar.onclick = async () => {
    if (activo || !texto || !permitido) return;
    parar(); const turno = version; activo = true; pintar(); controlador = new AbortController();
    const signal = controlador.signal;
    mensaje.textContent = 'Preparando lectura con QVAC…';
    // Pausas por bloques de palabras; nunca inventa un resumen ni omite el resto del contenido.
    const partes = []; let bloque = '';
    for (const palabra of prepararLectura(texto).split(/\s+/)) { if ((bloque + ' ' + palabra).length > 450 && bloque) { partes.push(bloque); bloque = ''; } bloque += (bloque ? ' ' : '') + palabra; }
    if (bloque) partes.push(bloque);
    try {
      for (let i = 0; i < partes.length; i++) {
        let r;
        for (let intento = 0; ; intento++) {
          r = await fetch('/api/hablar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto: partes[i] }), signal });
          if (r.status !== 429 || intento >= 8) break;
          mensaje.textContent = `El nodo está ocupado. Esperando para continuar la lectura ${i + 1} de ${partes.length}…`;
          await new Promise((resolve, reject) => {
            const abortar = () => { clearTimeout(timer); reject(new DOMException('Detenido', 'AbortError')); };
            const timer = setTimeout(() => { signal.removeEventListener('abort', abortar); resolve(); }, 1000);
            if (signal.aborted) abortar(); else signal.addEventListener('abort', abortar, { once: true });
          });
          if (turno !== version) return;
        }
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? 'No se pudo generar la lectura.'); }
        const audio = await r.blob(); if (turno !== version) return;
        if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(audio); reproductor.src = url;
        reproductor.hidden = false; mensaje.textContent = `Lectura ${i + 1} de ${partes.length} · voz QVAC en el nodo. Puedes detenerla.`;
        await new Promise((resolve, reject) => {
          reproductor.onended = resolve;
          reproductor.onerror = () => reject(new Error('Este navegador no pudo reproducir el audio.'));
          signal.addEventListener('abort', () => reject(new DOMException('Detenido', 'AbortError')), { once: true });
          reproductor.play().catch(() => { if (turno === version) mensaje.textContent = 'Pulsa reproducir en el control de audio para escuchar.'; });
        });
        if (turno !== version) return;
      }
      parar(); mensaje.textContent = 'Lectura terminada.';
    } catch (e) {
      if (turno !== version) return;
      parar(); mensaje.textContent = 'Lectura no disponible: ' + e.message + ' Puedes seguir usando el texto.';
    }
  };
  detener.onclick = () => { parar(); mensaje.textContent = 'Lectura detenida.'; };
  fetch('/api/hablar', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(e => { disponible = !!e?.disponible; pintar(); }).catch(() => {});
  addEventListener('pagehide', () => parar());
  pintar();
  return { actualizar(nuevoTexto, nuevoTitulo = 'Escuchar', habilitada = true) {
    if (nuevoTexto !== texto || habilitada !== permitido) parar();
    texto = nuevoTexto ?? ''; titulo = nuevoTitulo; permitido = habilitada; pintar();
  }, detener: parar };
}
