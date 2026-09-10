# Voz opcional — 10 de septiembre de 2026

Se integra **Supertonic 2 Q8**, idioma español, voz F1, velocidad 1.05 y cinco pasos de inferencia, mediante `@qvac/sdk` 0.18.2. Ejecuta en la RTX 4060 de la laptop. La Mac no interviene en la síntesis.

## Comparación y elección

Dos frases sintéticas iguales para cada variante: una pregunta de Philips y una abstención de Sucursal. Se generó WAV PCM mono de 44.1 kHz y se transcribió mediante Whisper/QVAC en el nodo para comprobar inteligibilidad. Se probaron cuatro variantes en CPU y GPU.

| Variante | CPU, síntesis de las dos frases | GPU, síntesis de las dos frases | Aumento de VRAM al cargar |
|---|---:|---:|---:|
| Supertonic 2 Q4 | 716 / 889 ms | 232 / 208 ms | 157 MiB |
| **Supertonic 2 Q8** | **692 / 838 ms** | **231 / 192 ms** | **157 MiB** |
| Supertonic 3 Q4 | 1460 / 2075 ms | 311 / 318 ms | 230 MiB |
| Supertonic 3 Q8 | 1540 / 2009 ms | 5367 / 2043 ms en primera corrida | 230 MiB |

Para no penalizar la primera ejecución, se repitieron las variantes 3 en GPU: Q8 dio 371 / 314 ms; Q4, 334 / 359 ms. La primera carga y las descargas están separadas de la síntesis en los JSON. Las frases producen aproximadamente 6.7–8.9 segundos de audio.

Se elige 2 Q8 por su menor latencia y menor VRAM de carga, con recuperación correcta de las palabras en estos casos; Q4 no mostró ventaja relevante de ejecución en esta muestra. Q8 conserva más precisión de pesos. **No es una evaluación auditiva humana ni demuestra superioridad subjetiva universal.** Los audios están disponibles para escucharlos. El archivo del modelo seleccionado ocupa 251,845,952 bytes (252 MB). No se incluye el modelo en Git.

La VRAM indicada es la diferencia antes/después de cargar, no un máximo de ejecución. En la aplicación completa se observaron 4,739 MiB usados y 3,096 MiB libres después de sintetizar, frente a 4,443 MiB usados antes de integrar TTS. El RSS del benchmark incluye el proceso y sus descendientes; no debe interpretarse como el tamaño aislado del modelo.

## Comprobación de español

Las frases básicas se recuperaron con diferencias de puntuación. Se añadieron cantidades, rangos, fechas y negaciones. La escritura «B/. 80.00» produjo una lectura poco clara en la comprobación ASR. Se corrigió expandiendo esa notación a «80 balboas», sin alterar el valor ni el texto visible. Se verificaron también separadores de miles y centavos. Tras normalizar, Whisper recuperó «El monto de 80 balboas es documental. Esta aplicación no autoriza retiros».

Muestras seleccionadas:

- [Pregunta de Philips](supertonic2-q8-gpu-0.wav).
- [Abstención de Sucursal](supertonic2-q8-gpu-1.wav).
- [Monto y negación después de normalizar](supertonic2-q8-gpu-normalizado-1.wav).

Mediciones originales: [comparación](comparacion.json), [repetición GPU](repeticion-gpu.json), [casos del dominio](dominio.json), [normalización](normalizado.json).

## Comportamiento integrado

- Philips: «Escuchar pregunta», «Escuchar resumen» o confirmación de guardado, según la etapa. Al editar o cambiar de pregunta se detiene la lectura anterior.
- Sucursal: lectura voluntaria de la tarjeta visible, incluidos monto, alcance y advertencias. No lee automáticamente datos del expediente. Una abstención sigue siendo una abstención hablada.
- «Detener» corta la reproducción y las peticiones del navegador. Una síntesis ya iniciada puede terminar en el nodo, pero su respuesta tardía no se reproduce.
- Las lecturas largas se dividen en bloques completos de palabras de hasta 450 caracteres; no se recorta silenciosamente el final.
- Una generación activa por nodo, sin cola ilimitada; responde 429 si está ocupado. El navegador reintenta el mismo bloque hasta ocho veces, esperando un segundo entre intentos; «Detener» cancela esa espera. Cache volátil de hasta 12 entradas y 8 MiB. No se guardan WAV de usuarios en disco ni texto hablado en la telemetría de TTS.
- El modelo se carga al primer uso. Un fallo de carga permite reintentar. El texto y el formulario siguen utilizables cuando la voz no está disponible.
- `TTS_DESACTIVADO=1` desactiva el servicio. El modelo ya descargado se toma de la caché de QVAC. Para reproducir la comparación se puede configurar `QVAC_CONFIG_PATH` con una caché independiente.

## Revisión adicional

[Respuesta de Claude, íntegra](respuesta-claude.txt). Señaló que un 429 entre bloques obligaba a reiniciar la lectura. Se corrigió con espera y reintento del mismo bloque, conservando cancelación y un límite de ocho reintentos. Se añadieron pruebas de colisión entre bloques y de cancelar durante la espera.

## Pruebas completadas

- 85 pruebas aprobadas, 8 omitidas, 0 fallos en `npm test`.
- Control del navegador: sin reproducción automática, reproducción y detención, respuesta tardía descartada, cambio de pregunta, error recuperable, lectura larga completa y monto/alcance/advertencia de Sucursal incluidos. [Resultado](prueba-control.json).
- Tailscale: inferencia real, audio WAV validado desde el blob del navegador y reproducción comprobada por avance de `currentTime`, detener, repetición con caché y comportamiento sin red, en Philips y Sucursal. Sin errores JavaScript ni desborde móvil. [Resultado](prueba-tailscale.json).
- Regresión de edición, foto y guardado de Philips; auditoría de rutas del navegador.
- Síntesis aislada sin rutas de red ni acceso externo, con modelos previamente descargados: 183 ms para 5.54 s de audio. [Resultado](sin-red.json), [audio](sin-red.wav).

La prueba sin red es de **inferencia en la laptop**, no en el celular. El navegador remoto necesita alcanzar el nodo; su desconexión no se presenta como inferencia móvil sin Internet.

Referencias técnicas: [QVAC TTS](https://docs.qvac.tether.io/ai-capabilities/text-to-speech/), [Supertonic 2](https://huggingface.co/Supertone/supertonic-2). API y constantes se contrastaron con el SDK instalado.

## Delegación entre laptop y Mac

El lenguaje ya usa un proveedor QVAC en la Mac. La voz de esta entrega ejecuta localmente en la laptop. En el SDK instalado 0.18.2, `server/rpc/handler-registry.js` registra un manejador delegado para `completionStream`, pero no para `textToSpeech`; `handlers/plugin-dispatch.js` rechaza modelos delegados. Por tanto, copiar Supertonic a ambos equipos no habilita por sí solo delegación de voz. Un servicio adicional entre nodos podría ejecutar QVAC localmente en el receptor, pero ese transporte y su recuperación ante fallos no están implementados ni probados en esta entrega.

Para un respaldo recíproco, cada equipo debe poder ejecutar la tarea que recibe y disponer de su modelo, runtime compatible y conexión autorizada. No requiere GPU ni configuración de aceleración idénticas. La inferencia remota necesita conectividad entre los equipos; disponer de modelos locales permite ejecutar sin conexión externa, pero no mantiene accesible un nodo remoto desconectado.
