# El producto corriendo DENTRO del teléfono (9-sep-2026, noche)

`src/puente/nodo.js` —el nodo de Vigía, no un script de laboratorio— corre en un HONOR X6s de
gama baja y delega su inferencia por llave pública a dos pares distintos: la laptop que está al
lado y una Mac que está en otra casa. La PWA se sirve desde el propio teléfono, en `localhost`.
No hay servidor intermedio: el DHT de Hyperswarm (la pila de Pears) encuentra al par por su llave
pública y abre el canal cifrado directo.

Lo que este teléfono **no** hace hoy es inferir a bordo. Está medido más abajo, y sale en el
documento antes que los números buenos porque condiciona todo lo demás.

## El hardware

| | Teléfono | Par 1 | Par 2 |
|---|---|---|---|
| Equipo | HONOR X6s (`VNE-LX3`) | Laptop de campo | MacBook Pro de Jonathan |
| Procesador | 8× Cortex-A53 | Intel + NVIDIA RTX 4060 8 GB (Vulkan) | Apple M5 Max (GPU de 40 núcleos, Metal) |
| Memoria | 3.7 GB (1.3-1.7 GB libres) | 31 GB | 128 GB unificada |
| Sistema | Android 14, Termux, runtime Bare | Fedora Linux | macOS 26.4 |
| Node | v24.18.0 (android-arm64) | v24.14.1 | v24.14.1 |
| SDK | `@qvac/sdk` 0.18.2 | 0.18.2 | 0.18.2 |
| Dónde está | en la mano | al lado, misma red | **otra casa, otra red** |

## Cómo se desplegó el producto en el teléfono

No se instaló nada nuevo: se copió el repositorio y se apuntó a los `node_modules` que ya estaban
en `~/qvac-app`. Cero `pkg install`, cero descargas.

```bash
adb forward tcp:8022 tcp:8022        # Termux por SSH
tar czf - --exclude=node_modules --exclude=.git --exclude=datos --exclude='evidencia/*.jsonl' \
          --exclude=infra --exclude='fixtures/red' --exclude='*.log' . \
  | ssh -p 8022 127.0.0.1 'mkdir -p ~/vigia && tar xzf - -C ~/vigia'
ssh -p 8022 127.0.0.1 'ln -sfn ~/qvac-app/node_modules ~/vigia/node_modules'
```

**Gotcha: en Termux no hay `rsync`.** El comando de la Mac (`rsync -a -e 'ssh -p 8022'`) falla con
`rsync: command not found` del lado del teléfono. Se usa `tar` sobre SSH, que no necesita nada
instalado allá.

### El producto es portable a android-arm64

| Dónde | Suite | Pruebas | Pasan | Se saltan | Fallan |
|---|---|---|---|---|---|
| Laptop (Fedora, x86_64) | `src/puente/*.test.js` | 4 | 3 | 1 | 0 |
| **Teléfono (Android, arm64)** | `src/puente/*.test.js` | 4 | **3** | 1 | **0** |
| Laptop | `src/core/*.test.js` | 15 | 13 | 2 | 0 |
| **Teléfono** | `src/core/*.test.js` | 15 | 6 | 2 | **7** |

Las que se saltan son las que piden modelo (`PRUEBA_MODELO`). Los 7 fallos del teléfono son
**los siete la misma causa, y es del arnés de pruebas, no del producto**:

```
Error: ENOENT: no such file or directory, mkdir '/tmp'
```

Android no tiene `/tmp`; en Termux el temporal es `$PREFIX/tmp` (`os.tmpdir()` →
`/data/data/com.termux/files/usr/tmp`). Los archivos `src/core/*.test.js` escriben la ruta `/tmp`
a mano en vez de pedirla a `os.tmpdir()`. Ninguno de los 7 fallos toca código de `src/`; los
módulos del producto se cargan y corren. Cambiarlo es una línea por prueba y queda pendiente
porque esos archivos son de otro frente.

**Gotcha 2, el mismo que en macOS:** `node --test src/core/` con un **directorio** no funciona en
este Node; hay que pasarle el glob entre comillas: `node --test "src/core/*.test.js"`.

## Lo que NO funciona: el modelo a bordo

Igual que esta tarde (`evidencia/medicion-telefono-9sep.md`), cargar un modelo **dentro** del
teléfono mata al worker de Bare:

```
▸ sin modelo a bordo (Bare worker exited mid-request (code=null, signal=null) —
  in-flight calls were aborted): este nodo solo funciona con el par a la vista
```

Tarda entre **11.6 y 25.6 s** en morirse, y esa espera se paga en cada arranque del puente.
`nodo.js` lo tolera desde el commit `4105da3`: sigue en pie solo delegado, lo publica en
`/api/evidencia` como `respaldo: false`, y responde 503 cuando además se cae el par.

### Hallazgo nuevo: el orden de carga importaba, y estaba al revés

La primera corrida del puente en el teléfono arrancó **verde y mentía**: el registro decía

```json
{"stage":"load","model":"Qwen3-1.7B Q4_0 (par)","status":"ok","load_ms":24545.5,
 "execution_mode":"delegated","provider":"c475277259ab"}
```

y a la primera captura el nodo devolvía 503:

```json
{"stage":"fallback","status":"error","model":"Qwen3-1.7B Q4_0 (par)",
 "error":"Model with ID \"27fe88790efcfd44\" not found",
 "motivo":"la completion delegada falló: se asume par caído"}
```

Con el par **vivo** al otro lado. La causa: `cargarModelos()` cargaba primero el par y después el
modelo a bordo. El SDK levanta un worker nuevo cuando el viejo se cae, pero **el nuevo nace
vacío**: se lleva puestos los modelos ya cargados. O sea, el intento fallido del modelo chico
borraba el handle del par que se había cargado bien treinta segundos antes.

El arreglo es de orden, no de lógica: **primero el modelo a bordo, después el par.** Así la
explosión pasa antes de que exista el handle del par. Está en `src/puente/nodo.js` con el motivo
escrito al lado. Es un tercer hueco del SDK sumado a los dos de `evidencia/mac-par-9sep.md`, y solo
se ve en un nodo donde la carga local falla — o sea, exactamente en este teléfono.

## Medición: el teléfono delega a la laptop

Puente en el teléfono, par `c475277259aba2b2b10d349a7cfb99419b50a6b648e6a1e452d1305cb7151c80`
(la laptop). Cronómetro tomado **en el propio teléfono** (`date +%s%N` alrededor del `curl`), el
mismo texto las tres veces:

> «Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores y un tomógrafo. Uno de los
> resonadores parece de unos ocho años.»

| Momento | Reloj en el teléfono | El nodo dice | TTFT | Velocidad | Dónde corrió |
|---|---|---|---|---|---|
| Intento de modelo a bordo | — | — | — | — | **falla en 22.5 s** |
| Carga del modelo en el par | 20.7 s | `load_ms: 20712.4` | — | — | laptop, `provider: c475277259ab` |
| 1ª extracción (fría) | 3 862 ms | 3 608 ms | 1 166 ms | 122 tok/s | **RTX 4060** (`backend_actual: gpu`) |
| 2ª (caliente) | 2 624 ms | 2 529 ms | 380 ms | 128 tok/s | RTX 4060 |
| 3ª (caliente) | 2 833 ms | 2 717 ms | 739 ms | 128 tok/s | RTX 4060 |
| 4ª, desde la PWA | — | 1 357 ms | — | — | RTX 4060 |

Las tres extracciones son **correctas y completas**: `Hospital DemoCare Pacific`, `Panamá`,
2×MR con `age_years_max: 8`, 1×CT. `modo: "delegado"`, `degradado: false`.

Los 122-128 tok/s son los de la RTX con Qwen3-1.7B (`evidencia/mac-par-9sep.md` midió 123-129 el
mismo día). **No es CPU**: `cargar()` de `nodo.js` no pasa `device` para el par, y el valor por
omisión de `core/runtime.js` es `'gpu'` con `gpu_layers: 99`; el registro lo confirma con
`backend_actual: "gpu"`.

## Medición: el teléfono delega a la Mac, en otra casa

Mismo puente, misma app, solo cambia `P2P_PROVEEDOR` a
`49fa947201f36de0e6caf4020ac68b250d1f58d44e0292e217ada9aa0c135dbf`.

| Momento | Reloj en el teléfono | El nodo dice | TTFT | Velocidad | Tokens de salida |
|---|---|---|---|---|---|
| Intento de modelo a bordo | — | — | — | — | falla en 25.6 s |
| Carga del modelo en el par | 20.6 s | `load_ms: 20558.8` | — | — | `provider: 49fa947201f3` |
| 1ª extracción | 1 221 ms | 1 014 ms | 450 ms | **271 tok/s** | 114 |
| 2ª | 1 563 ms | 1 464 ms | 298 ms | 250 tok/s | 270 |
| 3ª | 983 ms | 882 ms | 308 ms | 267 tok/s | 108 |

Las tres correctas y completas, `modo: "delegado"`.

**El teléfono con la Mac de otra casa es más rápido que el teléfono con la laptop de al lado**:
983-1 563 ms contra 2 624-3 862 ms, 250-271 tok/s contra 122-128. La distancia física no manda; el
hardware del par, sí. Ese es el argumento del producto en una línea.

(La variación del reloj entre las tres corridas de la Mac es de cuántos tokens emitió el modelo
—108, 114 y 270—, no de la red: la velocidad se mantuvo en 250-271 tok/s.)

### Comparación de las dos rutas

| | Par = laptop (RTX 4060, al lado) | Par = Mac (M5 Max, otra casa) |
|---|---|---|
| Carga del modelo en el par | 20.7 s | 20.6 s |
| Extracción caliente | 2.6-2.8 s | 0.98-1.6 s |
| Velocidad | 122-128 tok/s | 250-271 tok/s |
| Extracción correcta | 3/3 | 3/3 |

## La PWA, en el navegador del propio teléfono

`http://localhost:7312/` en el navegador del HONOR. Se abre con:

```bash
adb shell am start -a android.intent.action.VIEW -d http://localhost:7312/
```

**Con el par a la vista** (`evidencia/capturas/honor-puente-inicio.png` y
`honor-puente-revision.png`): punto verde y **«nodo delegado»** arriba a la derecha; se escribe el
reporte con «Escribir», se toca «Revisar la visita» y en 1.4 s aparece la revisión con las citas
subrayadas sobre lo dicho, `Hospital DemoCare Pacific · Panamá, Panama`, `2 MR · ~8 años ·
REPORTED`, `1 CT · edad desconocida · ESTIMATED` y la primera pregunta pendiente.

**Gotcha de automatización:** `Input.dispatchMouseEvent` de CDP con `pointerType: 'touch'` mete el
texto sin problema (`Input.insertText`, que sí acepta tildes y ñ, a diferencia de
`adb shell input text`) pero **no dispara el `onclick`** del botón. El toque que sí funciona es el
real: `adb shell input tap 360 1424`.

## La caída del par, y lo que la app NO hace con ella

Con el puente apuntando a la laptop, se mató el proveedor (`pkill -f 'src/puente/proveedor.js'`) y
se repitió la captura desde el teléfono.

**El nodo se porta bien:**

| | |
|---|---|
| Respuesta | **HTTP 503** en 3 468 ms |
| Cuerpo | `{"modo":"sin_respaldo","degradado":true,"aviso":"Sin par a la vista y sin modelo a bordo: la captura queda pendiente"}` |
| `/api/evidencia.modo` | `local (par caído)` |
| `/api/evidencia.respaldo` | `false` |
| Registro | `{"stage":"fallback","status":"vacio","motivo":"la completion delegada volvió vacía: se asume par caído"}` seguido de `{"stage":"fallback","status":"sin_respaldo","motivo":"el par no respondió y este nodo no tiene modelo a bordo"}` |
| En el log | `▸ [V-1614] sin par y sin modelo a bordo: la captura queda pendiente` |

**La PWA no** (`evidencia/capturas/honor-puente-sin-par.png`). Medido con la consola del navegador
del teléfono abierta por CDP:

```
error: Failed to load resource: the server responded with a status of 503 (Service Unavailable)
EXCEPCIÓN: TypeError: Cannot read properties of undefined (reading 'equipment')
```

Lo que la persona ve:

| | Lo que muestra hoy | Lo que debería mostrar |
|---|---|---|
| Indicador de nodo | punto **verde**, «nodo local (par caído)» | punto apagado, «Sin nodo a la vista» |
| Pantalla | salta a la de revisión y queda **en blanco**, solo el desplegable «Detalles técnicos» | quedarse en la pantalla de captura |
| Botón | trabado en «Interpretando…», deshabilitado para siempre | volver a «Revisar la visita» |
| Aviso | **ninguno** | «Sin par a la vista: la captura queda pendiente» (el `aviso` viene en el cuerpo del 503) |
| Cola | **no encola**: sigue en «0 capturas guardadas en el teléfono» | encolar en IndexedDB, como ya hace cuando `/api/evidencia` no responde |

La causa es de tres líneas en `app/index.html`: `revisar()` hace `.then(r => r.json())` sin mirar
`r.ok`, así que el cuerpo del 503 —que trae `aviso`, `modo: "sin_respaldo"` y `degradado: true`—
entra a `pintar()` como si fuera un borrador y revienta en `r.borrador.equipment`. **No se tocó
`app/index.html`**: lo está trabajando otro frente. Queda descrito aquí para que lo arregle quien
lo tenga en la mano.

Ojo con la ruta del indicador: `/api/evidencia` responde **200** aunque no haya par ni modelo, así
que `hayNodo` sigue en `true` y la app ni siquiera intenta encolar. El campo que dice la verdad ya
está en la respuesta y se llama `respaldo: false`; el `modo` también (`local (par caído)`).

### El puente no vuelve solo

Se relanzó el proveedor de la laptop **con la misma llave** y se repitió la captura sin tocar el
teléfono:

```
HTTP:503 · 131 ms
/api/evidencia.modo → local (par caído)
```

131 ms: ni lo intenta. Es el mismo límite que ya tenía la laptop (`evidencia/mac-par-9sep.md`): una
vez que el par se da por caído, `alCaerElPar()` lo olvida y no hay reconexión. **Hay que reiniciar
el puente del teléfono.** Reiniciado, vuelve a delegar normal.

## Los comandos para mañana

```bash
# 1 · PROVEEDOR EN LA LAPTOP  (llave estable, sale de datos/p2p-semilla)
cd ~/datos/HACKATHON-ISD-2026/hackpty
flock /tmp/vigia-gpu.lock env QVAC_CONFIG_PATH=$PWD/evidencia/qvac.prueba.config.json \
  GGML_VK_VISIBLE_DEVICES=1 nohup node src/puente/proveedor.js > proveedor.log 2>&1 &
grep -oE '[0-9a-f]{64}' proveedor.log | tail -1
#   → c475277259aba2b2b10d349a7cfb99419b50a6b648e6a1e452d1305cb7151c80

# 2 · EL TELÉFONO POR SSH
adb forward tcp:8022 tcp:8022
#   si rechaza: adb shell am start -n com.termux/.HomeActivity ; adb shell input text sshd ; adb shell input keyevent 66

# 3 · EL PUENTE DENTRO DEL TELÉFONO  (tarda ~45 s: 22 s el modelo a bordo que falla + 21 s el par)
ssh -n -p 8022 127.0.0.1 'cd ~/vigia && \
  QVAC_WORKER_PATH=$HOME/qvac-app/node_modules/@qvac/sdk/dist/server/worker-min.js \
  LD_LIBRARY_PATH=$PREFIX/lib QVAC_CONFIG_PATH=$HOME/qvac-app/qvac-min.json \
  P2P_PROVEEDOR=c475277259aba2b2b10d349a7cfb99419b50a6b648e6a1e452d1305cb7151c80 \
  HARDWARE=honor-x6s setsid nohup node src/puente/nodo.js > nodo.log 2>&1 < /dev/null &'
ssh -n -p 8022 127.0.0.1 'cat ~/vigia/nodo.log'   # esperar «▸ Puente en http://localhost:7312»

# 4 · LA PWA EN LA PANTALLA DEL TELÉFONO
adb shell am start -a android.intent.action.VIEW -d http://localhost:7312/
adb exec-out screencap -p > /tmp/pantalla.png

# 5 · UNA CAPTURA POR CURL, DESDE EL TELÉFONO
ssh -n -p 8022 127.0.0.1 'curl -s -X POST localhost:7312/api/extraer -H "content-type: application/json" \
  -d "{\"texto\":\"Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores y un tomógrafo. Uno de los resonadores parece de unos ocho años.\"}"'
ssh -n -p 8022 127.0.0.1 'curl -s localhost:7312/api/evidencia'

# 6 · CONTRA LA MAC EN OTRA CASA: el mismo paso 3 cambiando la llave
#   P2P_PROVEEDOR=49fa947201f36de0e6caf4020ac68b250d1f58d44e0292e217ada9aa0c135dbf
#   (si la Mac no responde:)
ssh tutoria 'cd ~/vigia && PATH=$HOME/.cache/qvac-p2p/node/bin:$PATH nohup node src/puente/proveedor.js > proveedor.log 2>&1 &'

# 7 · LA ESCENA DEL PAR QUE SE APAGA
pkill -f 'src/puente/proveedor[.]js'          # ← los corchetes evitan que pkill se mate a sí mismo
#   … repetir el paso 5: 503 con «la captura queda pendiente»
#   para volver: relanzar el paso 1 Y REINICIAR EL PUENTE (paso 3). No vuelve solo.

# 8 · EL REGISTRO QUE QUEDA EN EL TELÉFONO
ssh -n -p 8022 127.0.0.1 'grep completion ~/vigia/evidencia/rendimiento.jsonl | tail -3'
ssh -n -p 8022 127.0.0.1 'grep fallback  ~/vigia/evidencia/rendimiento.jsonl | tail -3'
```

Para redesplegar el producto después de tocar código, el `tar` de arriba, o un solo archivo con
`scp -P 8022 src/puente/nodo.js 127.0.0.1:~/vigia/src/puente/nodo.js`.

**Ojo con la memoria:** 3.7 GB en total y ~1.3 GB libres. Un solo proceso de Node con QVAC en el
teléfono; y si la app QV.AC de la Play Store está abierta, Android mata a Termux.

**Ojo con el SSH:** arrancar un proceso en segundo plano sin `setsid … < /dev/null` deja la sesión
de SSH colgada aunque el proceso arranque bien.

## Lo que este documento NO prueba

- **No prueba que el teléfono infiera a bordo.** No carga ningún modelo local (worker de Bare). El
  respaldo del producto existe y está probado (`src/puente/puente.test.js`, 3/3 en el propio
  teléfono) pero contra dobles, no contra un modelo corriendo en este aparato.
- **No prueba que la app maneje el 503.** Está medido que hoy no lo maneja, arriba, con la
  excepción de la consola copiada.
- **No prueba reconexión automática.** Medido lo contrario: 131 ms y 503 con el par de vuelta.
- **`provider` no viaja en la fila de `completion`.** Sale en la de `load`
  (`provider: c475277259ab` / `49fa947201f3`). En la de `completion` el par se identifica por
  `hardware_id: "par c4752772…"` y por `execution_mode: "delegated"`. Que `completion` traiga
  también `provider` es un arreglo pendiente en `src/core/runtime.js`, ya anotado en
  `evidencia/mac-par-9sep.md`.
- **El proveedor no imprime cada solicitud delegada.** Igual que con la Mac: `subscribeServerLogs`
  no emitió una sola línea en 0.18.2. La evidencia de que el trabajo se hizo allá es el registro
  del teléfono y que al matar el proceso la respuesta se cae en el acto.
