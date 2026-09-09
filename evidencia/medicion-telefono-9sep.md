# El teléfono, medido hoy (9-sep-2026, tarde)

HONOR X6s (VNE-LX3), Android 14, 8× Cortex-A53, 3.7 GB de RAM, Termux + Bare, `@qvac/sdk` 0.18.2,
Node 24.18.0. Conectado por cable; se entra a Termux por SSH sobre `adb forward tcp:8022`.

## Lo que SÍ funciona: el teléfono como par que delega

El SDK de QVAC corre dentro del teléfono y pide la inferencia a la laptop por su llave pública,
por el DHT de Hyperswarm. Sin servidor intermedio y sin nube.

| Momento | Tiempo |
|---|---|
| Conexión con el par y carga del modelo en el proveedor | 20.3 s |
| Primera respuesta (en frío) | 0.7 s · 154 tok/s |
| Respuestas siguientes (en caliente) | 0.3 y 0.5 s · 158 y 159 tok/s |

El script del teléfono corre con `fallbackToLocal: false` a propósito: si el par no está, falla
en vez de disimular. Con una llave que no existe, el error lo dice con todas sus letras
(«provider … was not found on the DHT»).

## Lo que HOY no funciona: cargar un modelo dentro del teléfono

Cargar un modelo **local** en el teléfono termina con el worker de Bare muerto:

```
WORKER_CRASHED: Bare worker exited mid-request (code=null, signal=SIGSEGV)
```

Se probó y falló igual en los cuatro casos:

| Intento | Resultado |
|---|---|
| VisionPsy Nano 460M Q4_K_M + proyector, contexto 2048 | worker muerto (SIGSEGV) |
| VisionPsy Nano 460M Q4_K_M sin proyector, contexto 1024 | worker muerto |
| Qwen3-0.6B Q4_0 desde el registro, contexto 1024 | worker muerto |
| Qwen3-0.6B Q4_0 desde el GGUF ya descargado en el teléfono | worker muerto |

Lo descartado durante el diagnóstico:

- **No es falta de espacio ni de descarga.** Los modelos bajaron completos: VisionPsy 289 MB, su
  proyector 104 MB, Qwen3-0.6B 364 MB.
- **No es memoria, hasta donde se puede ver.** Se cerraron las aplicaciones en segundo plano y se
  reintentó con 2 017 MB disponibles. Android tampoco registró que matara el proceso.
- **No es un bloqueo huérfano.** Se borró `~/.qvac/.worker.lock` y el fallo se repite.
- **No es la configuración.** Falla igual con la configuración propia del teléfono
  (`qvac-min.json`, la misma que usa el script de delegación que sí funciona).
- **El SDK está entero.** El comando `qvac` del teléfono lista los 22 paquetes, los 12 addons de
  llama.cpp para android-arm64 y el runtime de Bare.

El 3 de septiembre ese mismo teléfono corría Qwen3-0.6B localmente a 6-11 tokens por segundo.
Hoy no. Queda como falla abierta.

## Qué significa para la entrega

- La escena del video que muestra al teléfono como par QVAC **está medida y se puede grabar**.
- La escena de «se apaga el par y el teléfono sigue con su modelo a bordo» **no se puede grabar
  hoy en el teléfono**. La política de respaldo está implementada y probada
  (`src/puente/puente.test.js`), pero la ejecución local en este aparato no arranca.
- VisionPsy se declara donde corre de verdad: en la laptop. No se va a afirmar que corre en el
  teléfono mientras no vuelva a cargar.
