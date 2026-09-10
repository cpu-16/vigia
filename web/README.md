# Presentación de Vigía

Sitio estático para mostrar el producto y su demostración. La inferencia sigue en el nodo de Vigía, al que lleva el botón «Abrir Vigía». Este sitio no carga modelos ni expone las API del nodo.

Vista local desde la raíz del repositorio:

```bash
python3 -m http.server 7340 --bind 127.0.0.1 --directory web
```

Abrir `http://127.0.0.1:7340`. El sitio adapta su composición a móvil, no usa fuentes externas, analítica ni scripts de terceros.

## Medios de despliegue

Copiar la demostración final a `web/media/vigia-demo.mp4` y sus subtítulos WebVTT a `web/media/vigia-demo.vtt`. Ese directorio no se versiona. Los assets finales de identidad y producto sí se incluyen; guiones, proyectos de edición y fuentes audiovisuales quedan fuera del repositorio.

El servidor debe enviar `video/mp4` y `text/vtt`, admitir solicitudes Range para avanzar en el video y servir `index.html` sin caché permanente. `infra/web/nginx.conf` contiene una configuración estática sin datos privados. Un túnel HTTPS puede publicar este servidor; no modifica dónde ocurre la inferencia.

El enlace al nodo de demostración requiere la clave del equipo. El repositorio enlazado puede necesitar acceso autorizado si permanece privado.

## Herramientas públicas

`node scripts/preparar-web.mjs` exporta el catálogo y el verificador desde la aplicación a `web/catalogo/` y `web/verificar/`. Ambos funcionan sin API ni clave. El catálogo conserva créditos, licencias, placas sintéticas, filtros y modo pared. El verificador usa el mismo módulo WebCrypto del producto y no envía actas al servidor. Capturar visitas, abrir el inventario o consultar Sucursal lleva al nodo protegido.

La sección Ovnicom muestra capturas de Wazuh y Grafana, enlaces al código y un acceso al capítulo de la demo. No publica los paneles administrativos ni presenta las capturas como monitoreo en vivo. Los medios versionados (`media/vigia-demo-v5-262s.mp4` y `.vtt`) evitan que la caché entregue el máster anterior.
