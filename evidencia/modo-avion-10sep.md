# El teléfono solo, en modo avión (10-sep-2026, mañana)

HONOR X6s (`VNE-LX3`), Android 14, 8× Cortex-A53, 3.7 GB de RAM. Termux + runtime Bare,
`@qvac/llm-llamacpp`, Qwen3-0.6B Q4 (382 MB) **dentro del teléfono**. Sin par, sin laptop,
sin nube: lo único que puede responder es el modelo que tiene adentro.

Reproducir: `bash scripts/probar-modo-avion.sh salida.txt` (el teléfono por `adb`).

## El control: está de verdad sin red

No basta con decir «modo avión». Antes de cada corrida, desde el propio teléfono:

```
airplane_mode_on = 1
ping 1.1.1.1  →  connect: Network is unreachable
curl https://example.com  →  código 000
```

`adb` sigue vivo porque va por el **cable USB**, no por la red. Si esas tres líneas no salen
así, la medición no vale.

## Lo que respondió

| Qué se le pidió | Respuesta | Carga | Total | Generación |
|---|---|---|---|---|
| «¿Cuánto es 2+2?» (×4) | `2 + 2 = 4.` | 6.2-6.7 s | 2.4-5.2 s | **9.5 · 9.7 · 3.3 · 2.3 tok/s** |
| Pregunta de campo **sin** el manual | «Revisa el monitor para determinar si está en Leads Off…» — **circular, inútil** | 6.5 s | 5.1 s | 10.7 tok/s |
| La misma **con** el fragmento del manual (IFU MX40 pág. 73, 319 tokens de entrada) | «…se activa después de 10 segundos de "Leads Off"» — **correcto, está literal en el manual** | 5.4 s | **19.7 s** | 6.8 tok/s · 21 tok/s leyendo |

## Qué prueba y qué no

- **Prueba** que el ciclo entero cabe en un teléfono de gama baja sin conexión: cargar el modelo,
  leer un fragmento de manual y responder con lo que dice. No es captura encolada para procesar
  después — es inferencia a bordo, con las radios apagadas.
- **No prueba** que sea usable a esta velocidad: 19.7 s por respuesta, de los cuales **15.2 s son
  solo leer** los 319 tokens del fragmento. El mismo trabajo en el par tarda 1.6 s.
- **La respuesta sin el manual es mala a propósito y hay que enseñarla.** Un modelo de 600 M sin
  contexto contesta con una circularidad. Lo que hace útil al sistema es el fragmento recuperado,
  no el tamaño del modelo.

## Por qué es lento: es el silicio, no la arquitectura

La causa está medida desde el 3-sep: este A53 es **ARMv8.0 y no trae `asimddp`**. llama.cpp
acelera Q4 con la instrucción `sdot` de ARMv8.2; sin ella, no hay afinado de hilos ni
cuantización que lo arregle. La GPU tampoco entra: se probó OpenCL y `backendDevice` siguió
diciendo `cpu` (detalle en `CELULAR-QVAC.md`).

La variación de 2.3 a 9.7 tok/s entre corridas idénticas es del propio aparato, no de la medición:
se midió con la batería al 100 %, enchufado, a 29.9 °C y sin procesos de Termux compitiendo.
Por eso se publica el rango de las cuatro corridas y no un promedio.

## Gotchas que costaron tiempo hoy

| Trampa | Detalle |
|---|---|
| **En Bare no existe `process`** | `process.env.X` mata el módulo antes del primer `log()` y el proceso **sale con código 0 sin escribir nada**. Parece que corrió bien |
| **Ni existe `Bare.env`** | solo `Bare.argv`. La pregunta entra por archivo (`prompt.txt`), que además evita escapar comillas sobre SSH |
| `sshd` de Termux no arranca solo | `adb shell am start -n com.termux/.HomeActivity`, luego `input text sshd` + `keyevent 66` |
| `load average` de Android engaña | marcaba 26 con los 8 núcleos ociosos. El reposo se confirma con `ps`, no con el load |
