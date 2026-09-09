# La Mac como segundo par QVAC (9-sep-2026)

La laptop de campo delega su inferencia a una Mac que está **en otra casa, en otra red**, por el
DHT de Hyperswarm y por llave pública. No hay servidor intermedio, no hay nube, no hay puerto
abierto en ningún router. Y cuando esa Mac se apaga, la laptop sigue trabajando con su propia RTX
**y lo dice**.

## El hardware del par

| | |
|---|---|
| Equipo | MacBook Pro de Jonathan (`MacBook-Pro-de-Jonathan.local`) |
| Chip | Apple M5 Max · 18 núcleos de CPU (12 de rendimiento + 6 de eficiencia) · GPU de 40 núcleos |
| Memoria | 128 GB unificada |
| Sistema | macOS 26.4 (25E246), arm64 · Metal 4 |
| Node | v24.14.1 |
| SDK | `@qvac/sdk` 0.18.2 (la misma versión fijada del producto, con `startQVACProvider`) |
| Backend de ejecución | Metal (la Mac no usa Vulkan; en la laptop la RTX es `GGML_VK_VISIBLE_DEVICES=1`) |

La laptop es la de siempre: Fedora, Intel + NVIDIA RTX 4060 8 GB por Vulkan, 31 GB de RAM,
Node 24.14.1.

## Cómo se desplegó el producto en la Mac

No se instaló nada en la Mac: se copió el repositorio y se apuntó a los `node_modules` que ya
estaban ahí. Cero `sudo`, cero paquetes nuevos.

```bash
rsync -a --exclude node_modules --exclude .git --exclude datos \
      --exclude 'evidencia/rendimiento.jsonl' --exclude infra/red/salida --exclude '*.log' \
      ./ tutoria:~/vigia/
ssh tutoria 'ln -sfn ~/.cache/qvac-p2p/node_modules ~/vigia/node_modules'
```

**El producto es portable.** Las pruebas deterministas corren igual en la Mac que en la laptop:

| Dónde | Pruebas | Pasan | Se saltan | Fallan |
|---|---|---|---|---|
| Laptop (Fedora, x86_64) | 67 | 59 | 8 (las que piden modelo) | 0 |
| Mac (macOS, arm64) | 62 | 54 | 8 | 0 |

Las 5 de diferencia son de archivos que otro agente creó después de la copia (`src/sucursal/http.test.js`),
no un fallo de portabilidad. Dos gotchas de macOS, para quien lo repita:

- `node --test src/core/` con un **directorio** como argumento falla en este Node de macOS; hay que
  pasarle el glob entre comillas: `node --test "src/**/*.test.js"`.
- El `--exclude '*.log'` del rsync se come `fixtures/red/benigno.bind.log`, que es un fixture, no un
  log. Sin él `src/red/red.test.js` no arranca. Se copia aparte.

## La llave del par

```
49fa947201f36de0e6caf4020ac68b250d1f58d44e0292e217ada9aa0c135dbf
```

La identidad **no cambia entre reinicios**: `proveedor.js` deriva la llave de una semilla guardada
en `~/vigia/datos/p2p-semilla`. Verificado matando y relanzando el proceso: la llave impresa fue
idéntica. Por eso se puede dejar configurada en los teléfonos del equipo o imprimirla en un QR.

## Medición: la laptop delega a la Mac

Consumidor: una **segunda** instancia del servidor en el puerto 7321, con su propia caché de QVAC
(dos procesos de QVAC en la misma máquina se pelean el bloqueo del almacén si comparten carpeta).
Texto de la prueba, el mismo en las tres corridas:

> «Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores y un tomógrafo. Uno de los
> resonadores parece de unos ocho años.»

| Momento | Reloj de punta a punta | TTFT | Velocidad | Dónde corrió | `execution_mode` |
|---|---|---|---|---|---|
| Carga del modelo en el par | 6.1-8.7 s | — | — | Mac (Metal) | `delegated`, `provider: 49fa947201f3` |
| Primera extracción (fría) | 2.13 s | 969 ms | 255 tok/s | Mac | `delegated` |
| Segunda (caliente) | 0.93 s | 267 ms | 264 tok/s | Mac | `delegated` |
| Tercera (caliente) | 1.17 s | 846 ms | 264 tok/s | Mac | `delegated` |

Una corrida anterior con el mismo montaje dio 4.31 s en frío y **0.65 / 0.70 s** en caliente a
272-280 tok/s. El rango honesto de lo caliente es **0.65-1.17 s a 255-280 tok/s**; varía con el
enrutado del DHT y con lo que la Mac esté haciendo, que es de otra persona y sigue en uso.

La extracción es correcta y completa en las tres: hospital, 2×MR con 8 años, 1×CT.

**Gotcha, el mismo del teléfono:** el `modelConfig` lo manda el CONSUMIDOR y viaja con la solicitud.
El servidor pide `device: 'gpu'` y por eso el registro trae `backend_actual: "gpu"`, que en la Mac
es Metal. Si el consumidor pidiera CPU, la Mac ejecutaría en CPU teniendo la GPU libre.

### La Mac es casi el doble de rápida que la RTX

Mismo modelo, mismo prompt, mismo día: **255-264 tok/s en el M5 Max** contra **123-129 tok/s en la
RTX 4060**. Es el argumento del producto: el equipo de campo lleva la laptop modesta y el cómputo
bueno se presta desde donde esté.

## La escena «se apaga el par»

### Lo que pasaba ANTES del arreglo

Se mató el proveedor de la Mac con el modelo ya cargado y se repitió la solicitud:

```
HTTP 200 · 3.2 s
▸ [V-ABAA] QVAC completion ✓ 3232 ms · 2×MR, 1×CT
```

Todo verde. Y era mentira. La fila del registro:

```json
{"stage":"completion","status":"ok","execution_mode":"delegated",
 "ttft_ms":null,"output_tokens":null,"throughput_tps":null,"output_text":""}
```

El modelo no emitió **un solo token** y el SDK lo reportó como éxito. Lo que llegó a la pantalla:

| Campo | Con el par | Con el par muerto |
|---|---|---|
| Hospital | Hospital DemoCare Pacific | **perdido** (`null`) |
| Equipos | 2×MR, 1×CT | 2×MR, 1×CT |
| Edad del resonador | 8 años | **perdida** (`null`) |
| Aviso a la persona | — | **ninguno** |
| `/api/evidencia.modo` | delegado a 49fa… | **«delegado a 49fa…»**, seguía mintiendo |

Los equipos sobrevivieron por casualidad: los saca `equipos/menciones.js`, una expresión regular
determinista que lee «dos resonadores» del texto y no necesita modelo. Justo eso es lo que hacía
peligrosa la falla: **la pantalla se veía llena**, y lo que faltaba era el nombre del hospital y la
edad del equipo, que es lo que se va a inventariar.

### Lo que pasa AHORA

```
▸ [V-3CF5] QVAC completion → Qwen3-1.7B Q4_0 en par delegado (json_schema «observacion»)
▸ [V-3CF5] el par no respondió: se recargó local en 7202 ms
▸ [V-3CF5] QVAC completion ✓ local · 1162 ms · 2×MR, 1×CT
▸ [V-3FE8] QVAC completion → Qwen3-1.7B Q4_0 en laptop-rtx4060 (json_schema «observacion»)
▸ [V-3FE8] QVAC completion ✓ local · 2344 ms · 2×MR, 1×CT
```

| Solicitud | Reloj | Qué pasó | Extracción | Velocidad |
|---|---|---|---|---|
| La que encuentra al par muerto | 12.80 s | recarga local 7.2 s + inferencia 1.16 s | **completa** | 126 tok/s (RTX) |
| La siguiente | 2.35 s | ya está local, sin recargar | completa | 129 tok/s (RTX) |

Y ahora sí lo dice:

- `modo: "local"`, `degradado: true`
- `aviso: "El par no está a la vista: esta respuesta la calculó la laptop con su propia GPU."`
- `/api/evidencia.modo` → **`local (par caído)`**
- fila `{"stage":"fallback","status":"vacio","motivo":"la completion delegada volvió vacía: se asume par caído"}`
- fila `{"stage":"load","execution_mode":"local","provider":null,"load_ms":1737.9}`
- la app pinta un recuadro de alerta **«Revisa esta captura»** con el aviso

De los 7.2 s de recarga, **1.74 s** son la carga del modelo en la RTX; el resto es soltar el modelo
delegado muerto. La primera vez que se hizo en una caché nueva tardó **153 s**, porque el SDK bajó
el GGUF de 1 GB al no encontrarlo en esa carpeta. En un nodo que ya tiene su modelo (el caso real)
son los 1.7 s.

### Dos huecos del SDK que hubo que tapar

**1. `fallbackToLocal` solo cubre la carga.** Si el par no está cuando se carga el modelo, el SDK lo
carga local, bien. Pero si el par muere **después**, con el modelo ya cargado, la completion vuelve
vacía y sin error. Esa es la política de `src/puente/respaldo.js`.

**2. El SDK deduplica por `modelSrc`.** Detectada la caída, pedir el mismo modelo sin `delegate` NO
da un modelo local: devuelve el que ya estaba, o sea el delegado y muerto. Medido —
`getLoadedModelInfo` seguía respondiendo `isDelegated: true` y la fila de carga salía
`execution_mode: "delegated"` con `provider: null`, un modo que no existe. Hay que llamar a
`unloadModel` primero. Sin eso, la «recarga local» era mentira y la extracción seguía vacía.

**Cómo se detecta el vacío.** No se puede mirar el borrador: la capa determinista lo rellena y
disimula la caída (fue el primer intento y falló, con el par muerto el borrador traía sus 2×MR).
La señal honesta es `ttft_ms == null`: runtime.js lo mide aquí, de la invocación al primer trozo de
texto, así que no depende de las estadísticas del SDK ni de que el registro guarde el contenido.

### Límite conocido: no vuelve sola

Se relanzó el proveedor en la Mac, con la misma llave, y se repitió la solicitud:

```
D1 · 1.24 s · modo: local · degradado: true · exec: local · 123 tok/s
/api/evidencia.modo → local (par caído)
```

**La laptop no vuelve a delegar sola: hay que reiniciar el nodo.** Es deliberado en parte —una vez
que el par se dio por caído no se reintenta en cada visita, para no pagar el tiempo de espera en
cada captura— pero también es un límite real: no hay reconexión. Se probó además contra el servidor
**sin** el arreglo, y ahí era peor: el handle viejo seguía devolviendo vacío incluso con el par de
vuelta (0.1 s de nada). Reconectar solo es trabajo pendiente, no algo que este entregable haga.

## Qué viaja al par, dicho sin adornos

> Lo que viaja al par es el prompt, cifrado, a un par que tú autorizaste por su llave pública.
> **El par sí ve el prompt; el relé no.**

El canal es Hyperswarm sobre el DHT de Holepunch (la pila de Pears): encuentra al proveedor por su
llave pública sin servidor de por medio y abre un canal cifrado directo. Lo que pasa por ahí es el
prompt y los tokens de vuelta; el modelo se carga y se ejecuta en el proveedor. Delegar es elegir
**en qué máquina de tu confianza** corre la inferencia, no dejar de mandar el texto. Por eso el
proveedor trae cortafuegos por llave (`--consumidor <llave>`) y por eso el respaldo local importa:
donde el dato no puede salir del equipo, se apaga la delegación y el nodo sigue solo.

## Reproducir la escena en cámara

```bash
# 1 · el par, en la Mac (queda corriendo; imprime su llave, estable entre reinicios)
ssh tutoria 'cd ~/vigia && PATH=$HOME/.cache/qvac-p2p/node/bin:$PATH \
  nohup node src/puente/proveedor.js > proveedor.log 2>&1 &'
ssh tutoria 'grep -oE "[0-9a-f]{64}" ~/vigia/proveedor.log | tail -1'

# 2 · la laptop, delegando a esa llave (caché aparte de la instancia principal)
flock /tmp/vigia-gpu.lock env \
  QVAC_CONFIG_PATH=$PWD/evidencia/qvac.consumidor.config.json \
  GGML_VK_VISIBLE_DEVICES=1 \
  P2P_PROVEEDOR=49fa947201f36de0e6caf4020ac68b250d1f58d44e0292e217ada9aa0c135dbf \
  PUERTO=7321 RENDIMIENTO=evidencia/rendimiento-mac.jsonl \
  node src/servidor.js
# esperar «▸ Vigía en http://localhost:7321» (Whisper tarda ~27 s)
curl -s localhost:7321/api/evidencia | grep -o '"modo":"[^"]*"'     # → delegado a 49fa…

# 3 · una captura delegada
curl -s -H 'content-type: application/json' -d '{"texto":"Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores y un tomógrafo. Uno de los resonadores parece de unos ocho años."}' \
  localhost:7321/api/extraer | grep -o '"modo":"[^"]*"'             # → delegado

# 4 · SE APAGA EL PAR, en cámara
ssh tutoria "pkill -f 'src/puente/proveedor.js'"

# 5 · la misma captura: la laptop lo nota, recarga y lo dice
#     en el log:  ▸ [V-xxxx] el par no respondió: se recargó local en 7202 ms
curl -s -H 'content-type: application/json' -d '{"texto":"Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores y un tomógrafo. Uno de los resonadores parece de unos ocho años."}' \
  localhost:7321/api/extraer | grep -o '"aviso":"[^"]*"'
curl -s localhost:7321/api/evidencia | grep -o '"modo":"[^"]*"'     # → local (par caído)

# 6 · el registro, que es la evidencia que queda
grep '"stage":"fallback"' evidencia/rendimiento-mac.jsonl
```

## Lo que este documento NO prueba

- **No prueba que el teléfono degrade.** El HONOR X6s de hoy no carga ningún modelo a bordo
  (SIGSEGV, ver `medicion-telefono-9sep.md`), así que la escena de la degradación solo es grabable
  en la laptop. `nodo.js` tolera ese caso —sigue solo delegado, responde 503 con
  «la captura queda pendiente» y lo publica en `/api/evidencia` como `respaldo: false`— pero eso
  está probado con dobles en `puente.test.js`, no medido contra el teléfono.
- **No prueba reconexión automática.** Ver el límite de arriba.
- **El proveedor no imprime cada solicitud.** `proveedor.js` se suscribe a los logs del servidor
  esperando ver las solicitudes delegadas; en 0.18.2 no salió ninguna línea. La evidencia de que la
  Mac hace el trabajo es otra, y es más fuerte: `execution_mode: "delegated"` con
  `provider: 49fa947201f3` en el registro, 264 tok/s contra los 126 de la RTX, y sobre todo que al
  matar el proceso la respuesta se cae en el acto.
- **`hardware_id` nombra al consumidor, no al par.** En las filas de `completion` delegadas dice
  `laptop-rtx4060`, que es quien pidió, no quien ejecutó. `execution_mode: "delegated"` está
  correcto y la fila de `load` sí trae el `provider`; que la fila de completion nombre también al
  par es un arreglo pendiente en `core/runtime.js`.
