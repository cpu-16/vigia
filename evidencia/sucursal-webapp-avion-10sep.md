# Webapp Sucursal con inferencia real en HONOR, modo avión

10-sep-2026, 12:37–12:39 Panamá. Extensión experimental nueva de Vigía; no confundir con la prueba CLI anterior ni con todas las capacidades del nodo principal.

## Recorrido y controles

Chrome del propio HONOR carga `http://localhost:17321/sucursal`. Servidor Node en Termux → recuperación de sección local de la guía ficticia BPL → proceso Bare con `@qvac/llm-llamacpp` 0.45.0 → Qwen3-0.6B Q4, CPU del HONOR. La captura proviene de la pantalla física completa, 720×1600, sin recortar.

Antes de enviar la consulta se registró `airplane_mode_on=1`, `wifi_on=0`, `mobile_data=0`, `adb reverse --list` vacío y conexión externa fallida (`curl`, código HTTP 000). El statusbar del teléfono muestra “Airplane mode”. USB mantiene exclusivamente el control adb/CDP y SSH; el navegador consulta el loopback del teléfono. El reverse previo hacia el puerto 7320 de la laptop se retiró durante toda la demostración.

## Resultado real nuevo

Pregunta: «Según DOC-NAT-01, ¿qué documento de identidad se requiere?».

Respuesta literal de QVAC: «Respuesta breve: El documento de identidad es la cédula ficticia vigente.».

- Solicitud: `5a8885b2-9785-47b7-9a03-63fccc9cecbe`.
- Inicio API: `2026-09-10T17:37:32.245Z`.
- Carga: 6700 ms; inferencia: 19274 ms; total API: 29008 ms.
- 269 tokens de entrada; 19 generados; 3.97 tokens/s; backend `cpu`.
- Fin por `eos`; `contextSlides=0`.
- Fuente íntegra DOC-NAT-01, SHA-256 `fb1be81174c28cc51c179638b4596a6a8f541b8c7ca4b06dee1e84ade2622a8d`.

La interfaz muestra respuesta, revisión humana, fuente íntegra, scroll y detalles técnicos. La segunda pregunta, sobre la tasa de interés para una hipoteca, queda fuera del alcance; se abstiene antes del modelo y guarda el registro como `inferencia:false`. No es una respuesta inventada del LLM ni un ejemplo pregrabado servido por la API.

## Artefactos de la prueba

- [Respuesta de la API](sucursal-local/resultado.json), con el identificador y las métricas de esta ejecución.
- [Controles de conectividad](sucursal-local/controles.json).
- [Pantalla de respuesta](sucursal-local/respuesta.png) y [detalles técnicos](sucursal-local/detalles.png).

## Límites observados

La primera prueba de API con RET-ISL-01 se abstuvo erróneamente aunque el tope estaba en el texto. El pequeño modelo no resuelve confiablemente cualquier consulta; no se vende una capacidad general validada.

El primer intento de grabación mató Termux por presión de memoria HONOR (`SIGKILL`, `iAwareR[LowMem](fg-service)`). Se corrigió para esta consulta breve habilitando mmap y reduciendo contexto a 512 y salida máxima a 32 tokens. Grabación nativa a 2 Mbit/s. No se cerraron aplicaciones ajenas ni se desactivó la gestión de memoria del teléfono.

La recuperación es por términos/códigos, no embeddings; la redacción cubierta sí es inferencia real QVAC. Las respuestas siempre requieren revisión contra la sección. Este prototipo no incorpora voz, foto, expedientes completos, transacciones, APK, instalación automática de modelos ni disponibilidad garantizada tras reiniciar Termux.

## Restauración

Al terminar se restauraron avión `0`, Wi-Fi `1`, datos móviles `1` y el reverse previo `tcp:7320 → tcp:7320`. El servidor local de Termux permanece en 17321. Los controles USB utilizados no aportaron inferencia durante la prueba.
