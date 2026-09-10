# Ejecutar Vigía

Desde la raíz del repositorio.

Requisitos: **Node 22 o superior** y `ffmpeg` (solo para el dictado). Los modelos se descargan
solos la primera vez desde el registro de QVAC; no hay que registrarse en ningún servicio.

```bash
npm ci                      # instala @qvac/sdk 0.18.2 (fijada)
node --test                 # pruebas deterministas, sin modelos, las integraciones con modelos son optativas

# nodo completo (extracción, dictado y lectura de placa)
GGML_VK_VISIBLE_DEVICES=1 VISION=1 node src/servidor.js
#   portada en http://localhost:7320  ·  app de campo en /equipos  ·  catálogo en /catalogo.html
#   tablero en /tablero  ·  sucursal en /sucursal  ·  verificador en /verificar

# reto 04 (Ovnicom): el stream DNS en dos procesos, una tubería local
node src/red/productor.js --velocidad 1 | node src/red/demo.js --stdin
#   con el SIEM y ClickHouse levantados (bash infra/red/levantar.sh):
#   export WAZUH_API_URL=https://127.0.0.1:55000 WAZUH_API_USER=wazuh-wui WAZUH_API_PASS=<API_PASSWORD>
#   export CLICKHOUSE_LOCAL=1 VENTANA_QOE_MS=5000
#   bash infra/red/aislado.sh        # el agente completo en un namespace sin rutas
```

Variables útiles:

| Variable | Para qué |
|---|---|
| `GGML_VK_VISIBLE_DEVICES` | Elige la GPU (Vulkan). Sin ella el SDK toma la primera que encuentre |
| `ESCUCHAR` | Interfaz de escucha; por defecto `127.0.0.1`. Para acceso LAN declara la IP y configura `CLAVE` |
| `VOZ=gpu` | Ejecuta Whisper en GPU; `CPU=1` fuerza todos los modelos a CPU |
| `CPU=1` | Fuerza CPU, para reproducir en un equipo sin GPU |
| `VISION=1` | Carga además VisionPsy (460 M) para leer placas |
| `MODELO_CHICO=1` | Usa Qwen3-0.6B en vez de 1.7B, para hardware limitado |
| `P2P_PROVEEDOR=<llave>` | Delega la inferencia a otro nodo por su llave pública |
| `PUERTO`, `OBSERVACIONES`, `RENDIMIENTO` | Puerto y rutas de datos y de evidencia |
| `REGISTRO_PROMPTS=0` | Deja de guardar el texto de los prompts y de las respuestas en el registro; conserva la huella, los tokens y los tiempos |

> **Sobre el registro de rendimiento y la privacidad.** El track 02 pide que el registro incluya
> los prompts; conservamos ese formato para reproducir las mediciones, aunque no competimos en Psy. Eso quiere decir que
> `evidencia/rendimiento.jsonl` contiene lo que la persona dictó: se queda en el mismo nodo, no
> se envía a ninguna parte y no se sube al repositorio. En este proyecto todo ese contenido es
> **sintético**. En un despliegue real con datos de un cliente se apaga con `REGISTRO_PROMPTS=0`,
> que conserva la huella y las métricas y descarta el texto.

### Reproducir las mediciones

Cada corrida deja su evidencia en `evidencia/rendimiento.jsonl`, con los prompts completos, su
huella, los tokens, el tiempo hasta el primer token y el rendimiento.

```bash
# los 10 prompts oficiales del reto de Philips, más español y portugués
GGML_VK_VISIBLE_DEVICES=1 PRUEBA_MODELO=1 node --test src/equipos/equipos.test.js
# VisionPsy sobre las 20 placas sintéticas
GGML_VK_VISIBLE_DEVICES=1 PRUEBA_MODELO=1 node --test src/equipos/placa.test.js
# las 20 consultas de la guía de sucursal
GGML_VK_VISIBLE_DEVICES=1 PRUEBA_MODELO=1 node --test src/sucursal/sucursal.test.js
# la consulta en lenguaje natural sobre la base instalada
GGML_VK_VISIBLE_DEVICES=1 PRUEBA_MODELO=1 node --test src/equipos/consulta.test.js
```

**Dos procesos de QVAC a la vez** (por ejemplo el nodo y el proveedor) necesitan carpetas de
caché distintas, o se pelean el bloqueo del almacén:

```bash
echo '{"cacheDirectory":"/ruta/aparte"}' > otro.json
QVAC_CONFIG_PATH=$PWD/otro.json node src/puente/proveedor.js
```

### Delegación entre pares

```bash
# en el equipo que presta su cómputo
GGML_VK_VISIBLE_DEVICES=1 node src/puente/proveedor.js      # imprime su llave pública

# en el teléfono (Termux) o en cualquier otro nodo
QVAC_WORKER_PATH=$HOME/qvac-app/node_modules/@qvac/sdk/dist/server/worker-min.js \
LD_LIBRARY_PATH=$PREFIX/lib P2P_PROVEEDOR=<llave> node src/puente/nodo.js
```

### Hardware con el que se midió

| Nodo | Equipo | Qué corrió ahí |
|---|---|---|
| Laptop | Fedora Linux, Intel + NVIDIA RTX 4060 8 GB (Vulkan), 31 GB RAM, Node 24.14.1 | Qwen3-1.7B, VisionPsy Nano, Whisper, y como proveedor P2P |
| Teléfono | HONOR X6s, Android 14, 8× Cortex-A53, 3.7 GB RAM, Termux + Bare, Node 24.18.0 | `src/puente/nodo.js` entero: sirve la PWA en localhost y delega por llave pública a la laptop y a la Mac; el prototipo separado de Sucursal local ya infiere en CPU: [guía](SUCURSAL-LOCAL-TERMUX.md) |
| Nodo remoto | MacBook Pro, Apple M5 Max (18 núcleos, GPU de 40), 128 GB, macOS 26.4, Metal, Node 24.14.1, en otra casa | Proveedor P2P del producto (Qwen3-1.7B), llave `49fa9472…` |

Los números publicados salieron de este hardware. En otro equipo pueden cambiar los tiempos y las respuestas del modelo; las pruebas deterministas no usan modelos y deben dar igual en cualquier parte.
