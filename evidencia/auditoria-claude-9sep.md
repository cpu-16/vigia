# Respuesta de Claude

Transcripción literal de la revisión independiente, anterior a los arreglos de esta auditoría. No todos los hallazgos se aceptan: ver el informe de contraste. El alcance confirmado por Gilberto excluye el track Psy.

Leí el código sin ejecutar nada. Aquí va.

## 10 hallazgos priorizados

**1. `/api/evidencia` publica los prompts y las salidas literales — `src/servidor.js:248-256`, `src/core/rendimiento.js:18`**
`registrar()` guarda `prompt_messages` y `output_text` completos (default `REGISTRO_PROMPTS≠'0'`), y la ruta devuelve `filas.slice(-8)` **crudas**. Repro: `GET /api/evidencia` tras un dictado → ves el reporte tal cual lo dictó el colaborador, y tras una consulta de sucursal, la consulta del cajero. Arreglo: filtrar `prompt_messages`/`output_text` antes de serializar en esa ruta (solo `prompt_sha256` y conteos). Es de una línea y es el hallazgo que más te puede doler frente a Philips y Caja de Ahorros, cuyos briefs venden exactamente lo contrario.

**2. El nodo escucha en 0.0.0.0 y `CLAVE` es opcional; el puente del teléfono no tiene puerta — `src/servidor.js:82,328`, `src/puente/nodo.js:158`**
Sin `CLAVE`, cualquiera en el wifi del hospital lee `/api/inventario`, `/api/evidencia` y **escribe** en `/api/guardar`. `nodo.js` ni siquiera tiene el gate: no existe `CLAVE` en ese archivo. Repro: `curl http://<ip-laptop>:7320/api/inventario` desde otra máquina de la LAN. Arreglo mínimo: `listen(PUERTO, '127.0.0.1')` por defecto y exigir `CLAVE` para escuchar en otra interfaz; reusar `conClave` en `nodo.js`.

**3. Consulta en lenguaje natural: JSON malo → devuelve TODO el inventario como si fuera la respuesta — `src/equipos/consulta.js:94` + `aplicar()`**
`catch { filtro = {} }` y `aplicar({})` no filtra nada: cada `if (f.x && …)` es falso. Repro: con el par caído la completion vuelve vacía → `JSON.parse` falla → «clientes en Brasil con resonadores de más de 7 años» responde el dataset entero con un total confiado. Arreglo: si `filtro` no parsea, devolver `{ error:'no entendí la pregunta' }` en vez de `aplicar`.

**4. El respaldo del par solo cubre `/api/extraer` — `src/servidor.js:169` vs `228`, `217`, `259`**
`conRespaldo` envuelve únicamente la extracción. `/api/consulta`, `/api/placa` y sucursal usan `llm` directo. Además `parCaido` solo se marca en esa ruta, así que `/api/evidencia` sigue diciendo `modo: delegado` con el par muerto. Repro: mata al proveedor y pregunta primero en `/tablero` (consulta) antes de dictar. Arreglo: mover la detección de par caído a `completar()` en `runtime.js`, o al menos marcar `parCaido` desde cualquier ruta.

**5. Un error cualquiera de completion mata la delegación de toda la sesión — `src/puente/respaldo.js:56-60`**
El `catch` trata *cualquier* excepción como «par caído» y llama `alCaerElPar()`, que es definitivo (`nodo.js:93`, y en la laptop `parCaido=true`). Un `ContextOverflowError` por un dictado largo apaga el P2P — que es tu titular de demo — sin que el par se haya movido. Arreglo: solo degradar ante errores de transporte/timeout; reintentar el par una vez antes de darlo por muerto.

**6. Las fotos de placa quedan en `/tmp` para siempre — `src/servidor.js:214-215`**
`writeFile(tmp, bytes)` y no hay `unlink` en ninguna parte (grep confirmado). Repro: `VISION=1`, sube tres placas, `ls /tmp/vigia-placa-*.png`. Contradice «nada sale del dispositivo… ni se queda tirado». Además `idSolicitud()` son 2 bytes → colisiones. Arreglo: `finally { await rm(tmp, {force:true}) }` y usar `randomUUID()`.

**7. Dos excepciones tumban el consumidor DNS entero — `src/red/ventanas.js:25`, `src/red/wazuh.js:8`, `src/red/agente.js:49`**
`Capacidad de ventana agotada` (100k eventos en 5 min = ~333 qps sostenidos, poco para un datacenter de Ovnicom) y `Rasgo inválido` propagan fuera de `consumir()` y matan el `for await`. Repro: `maxEventos:1000` en el `Detector` y reproduce el log a velocidad alta. Arreglo: capturar por evento, contar `eventos_descartados` y seguir; un agente de seguridad que se cae bajo carga es peor que uno que degrada.

**8. `simular()` pisa la latencia y el rcode reales — `src/red/qoe.js:12` + `src/red/agente.js:42`**
`{...e, latency_ms: …, rcode: …}` se aplica **siempre**, sin mirar si el evento ya los traía. Si conectas el stream real de dnstap/Vector de Ovnicom, el score QoE sigue siendo sintético. Arreglo: `latency_ms: e.latency_ms ?? perfil…` y no meter el campo en `synthetic_fields` cuando venga del bus.

**9. La «zona gris» del modelo es código muerto — `src/red/deteccion.js:50`, `src/red/caso.js:37`**
`Detector.candidatos` se llena y se resetea cada evento; `desempatar()` no lo llama nadie fuera de las pruebas (grep sobre `src/`). El comentario dice «consultable por el operador» y no hay ruta ni salida que lo exponga. Arreglo: sacarlo del `alProgresar`/`casos.jsonl`, o borrarlo y no prometerlo.

**10. `verificar()` no tiene ancla de confianza — `src/core/sello.js:41-43`**
La firma se valida contra la llave pública que viaja **dentro** del propio sello. Cualquiera genera un par Ed25519, sella un acta inventada y la app dice «válida». Repro: `sellar(objetoFalso, llaveNodo('/tmp/otra.pem'))` → `verificar()` → `{valido:true}`. Arreglo: mostrar y comparar contra una lista de llaves conocidas del equipo (ya tienes `llave_nodo` en `/api/evidencia`); si no, cambiar el copy a «no fue alterada desde que se firmó», que es lo único que prueba.

*(Extra, sin gastar cupo: `Expediente` default apunta a `src/sucursal/datos/sucursal.jsonl` — `expediente.js:13` — mientras `contextoSucursal` usa `datos/sucursal.jsonl` — `http.js:25`. Dos libros según el punto de entrada.)*

## Uso real del SDK

Verificado contra `node_modules/@qvac/sdk@0.18.2`: `loadModel`, `completion`, `getLoadedModelInfo`, `unloadModel`, `transcribe`, `startQVACProvider`/`firewall`, `delegate.{providerPublicKey,timeout,fallbackToLocal}` y `QVAC_HYPERSWARM_SEED` existen y se usan con la forma correcta. Las constantes `QWEN3_1_7B_INST_Q4`, `QWEN3_600M_INST_Q4`, `WHISPER_LARGE_V3_TURBO`, `VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` están en el registro. **No encontré ninguna llamada a inferencia remota fuera de QVAC**: los únicos `fetch`/`request` salientes son Wazuh y ClickHouse, ambos forzados a loopback (`wazuh.js:25`, `qoe.js:30`). El requisito técnico se cumple.

## Encaje por track, honesto

- **Philips** — el más fuerte. Cubre casi todo el prototipo mínimo y varias metas (voz, duplicados con Fellegi-Sunter explicable, consulta NL, placa). Lo que lo baja: hallazgos 1, 3 y 6 tocan justo «privacidad» y «calidad de datos», dos de sus criterios de diseño.
- **General (03)** — buen encaje: la delegación por DHT es real y está medida. El riesgo es de demo, no de concepto: hallazgos 4 y 5 hacen que el par caído se vea inconsistente en cámara.
- **Psy (02)** — encaje **débil**. Solo VisionPsy participa, y como transcriptor OCR detrás de reglas, no en el flujo principal (`VISION=1` ni siquiera es el default). El track exige que un modelo Psy tenga «función central». Qwen3 no es Psy. Además pide log estructurado con TTFT/throughput: lo tienes, pero es el mismo archivo del hallazgo 1.
- **Ovnicom** — buen encaje de arquitectura (loopback verificable, consumidor adicional, Wazuh por API local con reintento 429). Lo baja el hallazgo 8: la parte «experiencia de cliente» es simulada por construcción, y el 7 le pega a «funcione sobre el stream».
- **Caja de Ahorros** — encaje medio. El módulo de sucursal está bien diseñado (abstención anclada a citas, expediente encadenado). Pero cuando el par muere, `procedimiento.js` abstiene diciendo «sin respaldo en la guía», que es mentira sobre la causa — mala señal ante un jurado bancario. Y hereda 1 y 2.

Sin evidencia para opinar: no verifiqué las mediciones de `evidencia/*.md` ni corrí las pruebas.