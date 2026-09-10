# Vigía — inteligencia local con evidencia

**Equipo HackPTY · Decentralized AI Hackathon 2026 (ISD Summit, Panamá) · 9–11 de septiembre de 2026**

Vigía convierte lo que una persona observa en campo —un hospital, una sucursal bancaria, una
red— en datos revisables y verificables, **sin que el contenido salga de la infraestructura de
quien lo produce**. Toda la inferencia corre en el dispositivo o se delega entre pares con el SDK
de QVAC. Ninguna llamada a una API de inferencia en la nube.

Tracks a los que se presenta este proyecto: **01 Philips** (base instalada) · **02 Tether QVAC Psy**
· **03 Desafío General** · **04 Ovnicom** (red) · **05 Caja de Ahorros** (banca). Un solo producto con
tres espacios, **Equipos, Sucursal y Red**, que comparten runtime, registro, sellado y verificador.

## Requisito técnico (artículo 10)

- SDK: `@qvac/sdk` **0.18.2**, fijado a propósito. La versión 0.19.0 (7-sep-2026) eliminó la
  inferencia delegada por DHT (`startQVACProvider`, `delegate.providerPublicKey`). Este proyecto
  demuestra esa delegación entre pares, así que se queda en la última versión que la incluye.
- Modelos, cuantizaciones y hardware de ejecución: `THIRD_PARTY.md`.
- Cada inferencia deja una fila en `evidencia/rendimiento.jsonl` (modelo, hardware, origen local o
  delegado, carga, prompts, tokens, TTFT, throughput). Ese archivo operativo no se sube; la corrida
  **entregable** del track 02 está versionada en `evidencia/registro-psy-placas-9sep.jsonl`
  (VisionPsy Nano sobre las 20 placas sintéticas, con carga, prompt, tokens, TTFT y throughput por
  placa), y las tablas de las demás mediciones en `evidencia/sucursal-gpu-9sep.md`,
  `evidencia/mac-par-9sep.md` y `evidencia/medicion-telefono-9sep.md`.

## Base preexistente declarada (artículo 11.c)

Antes del inicio de la competencia, el equipo desarrolló una librería propia de experimentación
con el SDK de QVAC (pruebas de recuperación con citas, extracción bajo gramática, sellado Ed25519 y
delegación P2P). **Se utilizó únicamente como referencia; su código no se incorpora al producto
entregado.** Declaramos este antecedente conforme al artículo 11.c. `evidencia/procedencia.md`
identifica cada componente de este repositorio, su fecha de creación dentro de la ventana y su
relación con dicha referencia.

## Datos

Todos los datos de las demostraciones son **sintéticos**: marcas, modelos, clientes, documentos y
registros son ficticios. Se generan con los scripts de `fixtures/`.

## Estructura

```text
src/core/        runtime QVAC, política de ejecución, registro de rendimiento, eventos, sellado
src/equipos/     módulo Philips: captura, extracción, identidad de activos, inventario
src/sucursal/    módulo banca: procedimiento citado, acta verificable
src/red/         módulo red: consumidor del stream DNS, clasificación, salidas
src/puente/      proveedor P2P (presta la GPU por llave pública), nodo del teléfono, respaldo cuando el par cae
app/             interfaz web instalable (PWA): portada, app de campo, catálogo, tablero, sucursal y verificador
fixtures/        datos sintéticos
evidencia/       procedencia, rendimiento, pruebas de no salida de datos
```

## Dónde está cada track

Un solo proyecto, un solo repositorio (rama `main`), un solo video. Cada jurado encuentra aquí su parte.

| Track | Módulo | Carpeta | Minuto del video |
|---|---|---|---|
| 01 Philips · Base instalada | Equipos: captura por voz/texto/foto, extracción, identidad y duplicados, inventario, Customer 360, cola sin conexión | `src/equipos/`, `app/index.html`, `app/tablero.html`, `app/catalogo.html` | 0:12–1:28 |
| 02 Tether · QVAC Psy | VisionPsy Nano lee la placa en la laptop; reglas deterministas sacan marca, modelo y serie; registro de rendimiento entregable | `src/equipos/placa.js`, `evidencia/registro-psy-placas-9sep.jsonl` | 0:42–1:09 |
| 03 General · Sovereign Intelligence at the Edge | Todo lo anterior + delegación entre pares por llave pública (teléfono → laptop, teléfono → Mac y laptop → Mac en otra casa), el par que se apaga y la laptop que lo nota, actas verificables en el navegador, prueba de aislamiento | `src/core/`, `src/puente/`, `app/verificar.html`, `evidencia/` | 3:02–4:19, y la evidencia común 4:19–4:55 |
| 05 Caja de Ahorros · Banca | Sucursal: procedimiento citado sin conexión, expediente, acta sellada y verificable; pantalla en `/sucursal` | `src/sucursal/`, `app/sucursal.html` | 1:28–2:22 |
| 04 Ovnicom · Sentinel-DNS | Red: el registro DNS entregado por Ovnicom reproducido como flujo, detección por capas, alertas a Wazuh por su API local y score por zona en ClickHouse y Grafana | `src/red/`, `infra/red/` | 2:22–3:02, aislamiento 3:58–4:19 |

## Lo medido, con su denominador

| Qué | Resultado | Dónde se reproduce |
|---|---|---|
| Extracción de un reporte dictado | 1.9 s | `src/equipos/equipos.test.js` |
| Dictado: 9.4 s de audio transcritos (Whisper large-v3 turbo) | 0.94 s en la RTX 4060 · 24.8 s en CPU, mismo texto | control fijo, 3 corridas por lado; `src/core/voz.js` |
| Los 10 prompts oficiales de Philips, más español y portugués | 12 / 12 | idem |
| Consulta en lenguaje natural traducida a filtros | 6 / 6, menos de 1 s | `src/equipos/consulta.test.js` |
| Placa: número de serie sobre 20 placas sintéticas | 20 / 20 | `src/equipos/placa.test.js`; corrida entregable en `evidencia/registro-psy-placas-9sep.jsonl` |
| Placa: modelo · marca · modalidad | 18 / 20 · 16 / 20 · 18 / 20 | idem (corrida del 9-sep en la RTX 4060; las placas nítidas dan 38 / 40 campos) |
| Placa: tiempo hasta el primer token · velocidad | mediana 1.0 s · 218 tok/s | idem |
| Foto sin placa: el modelo describe y el filtro corta la marca inventada | 1.8 s leer + 2.3 s describir, 0 marcas falsas en 2 corridas | `src/equipos/placa.js` (`mirar`, `pistasDeEscena`), prueba en `placa.test.js` |
| Sucursal: consultas correctas | 19 / 20 | `src/sucursal/sucursal.test.js`; `evidencia/sucursal-gpu-9sep.md` (tres corridas: 17, 18 y 19 de 20) |
| Sucursal: abstenciones cuando la guía no cubre | 5 / 5 | idem |
| Sucursal: latencia por consulta | 375–923 ms en la RTX 4060 (4.5–17 s en CPU) | `evidencia/sucursal-gpu-9sep.md` |
| Sucursal: flujo completo por HTTP hasta el acta verificable | 1 prueba determinista, sin modelo | `src/sucursal/http.test.js` |
| Acta verificada en el navegador, sin servidor: válida, alterada, cadena rota | prueba determinista con WebCrypto | `src/core/verificar-web.test.js` |
| Recuperación de preguntas parafraseadas: términos vs. híbrida | 1 / 4 → 3 / 4 | `src/core/semantica.test.js` |
| Red: typosquatting · túnel · DGA · beaconing (precisión) | 100 % · 100 % · 85 % · 57 % | `src/red/red.test.js` |
| Red: alertas del agente procesadas por Wazuh | 153 / 153 por el lector de archivo · 150 / 150 por la API local (`POST /events`, `location: API-Webhook`) | `infra/red/VERIFICADO-WAZUH.md` |
| Red: evento → alerta en el JSONL · evento → HTTP 200 del SIEM | mediana 1,08 ms · 1 175 ms (n = 150; la agrupación de 2,5 s domina, el POST son 13 ms) | `infra/red/VERIFICADO-WAZUH.md`, `infra/red/stream-9sep.txt` |
| Red: el consumidor alerta antes de que el productor termine | prueba determinista, dos procesos y una tubería local | `src/red/stream.test.js` |
| El producto corriendo en el teléfono, delegando a la laptop | 2.6–2.8 s a 122–128 tok/s en la RTX 4060 (Qwen3-1.7B bajo gramática) | `evidencia/telefono-puente-9sep.md` |
| El mismo teléfono delegando a la Mac de otra casa | 0.98–1.6 s a 250–271 tok/s en el M5 Max | idem |
| El puente del producto probado dentro de android-arm64 | 3 / 3 pruebas (1 se salta) | idem |
| Delegación de la laptop a una Mac en otra casa, por llave pública | 0.65–1.17 s a 255–280 tok/s en el M5 Max | `evidencia/mac-par-9sep.md` |
| El par se apaga: la laptop lo nota, recalcula local y lo dice | 12.8 s la solicitud que lo encuentra, 2.3 s la siguiente | idem |

El beaconing va con su 57 % a la vista: el tráfico legítimo también es periódico y la
periodicidad no prueba mando y control.

## Límites conocidos, dichos aquí y en el video

- El teléfono captura y delega; hoy no infiere a bordo (el worker de Bare cae al cargar el modelo). Sin par a la vista, el nodo responde 503 diciendo que la captura queda pendiente; la app la deja en cola desde el navegador (`evidencia/telefono-puente-9sep.md`).
- Cuando el par delegado se apaga, la laptop lo nota y recalcula local; cuando el par vuelve, no vuelve a delegar sola: hay que reiniciar el nodo.
- La cola sin conexión guarda nota, dictado y foto, y las reenvía cuando vuelve el nodo, de una en una porque cada visita se confirma antes de guardarse. Lo que no hace es interpretar a bordo: sin nodo no hay respuesta, solo resguardo.
- De una foto sin placa legible el modelo describe la escena, y de esa descripción solo se acepta la modalidad y una marca del catálogo. Medido el 9-sep: sobre la misma foto inventó «Soyo» y «SARK» en dos corridas; ninguna llegó al inventario (`src/equipos/placa.test.js`).
- La latencia y los códigos de respuesta DNS son sintéticos, porque el registro entregado solo trae consultas; cada fila lo marca.
- El beaconing tiene 57 % de precisión: la periodicidad no prueba mando y control. Las reglas detectan; el modelo explica y no decide bloqueos.
- El endpoint `/events` de Wazuh admite 100 eventos por petición y 30 peticiones por minuto, fijo en el manager: el agente agrupa hasta 100 alertas o 2,5 s. El JSONL local se escribe siempre, antes de cualquier envío, y es el respaldo si la API no responde.
- La prueba de aislamiento cubre el proceso del agente, no toda la laptop: corre en un namespace sin rutas y desde ahí `curl` a internet falla.
- Una firma prueba que el contenido no cambió y que lo firmó esa llave; no acredita la identidad de quien la tiene.

## Cómo ejecutarlo

Requisitos: **Node 22 o superior** y `ffmpeg` (solo para el dictado). Los modelos se descargan
solos la primera vez desde el registro de QVAC; no hay que registrarse en ningún servicio.

```bash
npm install                 # instala @qvac/sdk 0.18.2 (fijada)
node --test                 # 59 pruebas deterministas, sin modelos, ~3 s (8 más corren solo con PRUEBA_MODELO=1)

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
| `CPU=1` | Fuerza CPU, para reproducir en un equipo sin GPU |
| `VISION=1` | Carga además VisionPsy (460 M) para leer placas |
| `MODELO_CHICO=1` | Usa Qwen3-0.6B en vez de 1.7B, para hardware limitado |
| `P2P_PROVEEDOR=<llave>` | Delega la inferencia a otro nodo por su llave pública |
| `PUERTO`, `OBSERVACIONES`, `RENDIMIENTO` | Puerto y rutas de datos y de evidencia |
| `REGISTRO_PROMPTS=0` | Deja de guardar el texto de los prompts y de las respuestas en el registro; conserva la huella, los tokens y los tiempos |

> **Sobre el registro de rendimiento y la privacidad.** El track 02 pide que el registro incluya
> los prompts, así que por omisión se guardan completos. Eso quiere decir que
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
| Teléfono | HONOR X6s, Android 14, 8× Cortex-A53, 3.7 GB RAM, Termux + Bare, Node 24.18.0 | `src/puente/nodo.js` entero: sirve la PWA en localhost y delega por llave pública a la laptop y a la Mac (el modelo a bordo hoy no carga: `evidencia/telefono-puente-9sep.md`) |
| Nodo remoto | MacBook Pro, Apple M5 Max (18 núcleos, GPU de 40), 128 GB, macOS 26.4, Metal, Node 24.14.1, en otra casa | Proveedor P2P del producto (Qwen3-1.7B), llave `49fa9472…` |

Los números publicados salieron de este hardware. En otro equipo cambian los tiempos, no los
resultados: las pruebas deterministas (59) no usan modelos y deben dar igual en cualquier parte.
