# Mediciones de Vigía

Resultados de prototipo con datos sintéticos; no son garantías de exactitud en producción. Mediciones del 9 de septiembre salvo indicación.

| Qué | Resultado | Dónde se reproduce |
|---|---|---|
| Extracción de un reporte dictado | 1.9 s | `../src/equipos/equipos.test.js` |
| Dictado: 9.4 s de audio transcritos (Whisper large-v3 turbo) | 0.94 s en la RTX 4060 · 24.8 s en CPU, mismo texto | control fijo, 3 corridas por lado; `../src/core/voz.js` |
| Los 10 prompts oficiales de Philips, más español y portugués | 12 / 12 | idem |
| Consulta en lenguaje natural traducida a filtros | 6 / 6, menos de 1 s | `../src/equipos/consulta.test.js` |
| Placa: número de serie sobre 20 placas sintéticas | 20 / 20 | `../src/equipos/placa.test.js`; corrida entregable en `../evidencia/registro-psy-placas-9sep.jsonl` |
| Placa: modelo · marca · modalidad | 18 / 20 · 16 / 20 · 18 / 20 | idem (corrida del 9-sep en la RTX 4060; las placas nítidas dan 38 / 40 campos) |
| Placa: tiempo hasta el primer token · velocidad | mediana 1.0 s · 218 tok/s | idem |
| Foto sin placa: el modelo describe y el filtro corta la marca inventada | 1.8 s leer + 2.3 s describir, 0 marcas falsas en 2 corridas | `../src/equipos/placa.js` (`mirar`, `pistasDeEscena`), prueba en `placa.test.js` |
| Sucursal: consultas correctas | 18 / 20 en la última auditoría | `../src/sucursal/sucursal.test.js`; `../evidencia/auditoria-banca-final-9sep.json` (corridas anteriores: 17–19 de 20) |
| Sucursal: abstenciones cuando la guía no cubre | 5 / 5 | idem |
| Sucursal: latencia por consulta | 375–923 ms en la RTX 4060 (4.5–17 s en CPU) | `../evidencia/sucursal-gpu-9sep.md` |
| Sucursal: flujo completo por HTTP hasta el acta verificable | 1 prueba determinista, sin modelo | `../src/sucursal/http.test.js` |
| Acta verificada en el navegador, sin servidor: válida, alterada, cadena rota | prueba determinista con WebCrypto | `../src/core/verificar-web.test.js` |
| Recuperación de preguntas parafraseadas: términos vs. híbrida | 1 / 4 → 3 / 4 | `../src/core/semantica.test.js` |
| Red: typosquatting · túnel · DGA · beaconing (precisión) | 100 % · 100 % · 85 % · 57 % | `../src/red/red.test.js` |
| Red: alertas del agente procesadas por Wazuh | 153 / 153 por el lector de archivo · 150 / 150 por la API local (`POST /events`, `location: API-Webhook`) | `../infra/red/VERIFICADO-WAZUH.md` |
| Red: evento → alerta en el JSONL · evento → HTTP 200 del SIEM | mediana 1,08 ms · 1 175 ms (n = 150; la agrupación de 2,5 s domina, el POST son 13 ms) | `../infra/red/VERIFICADO-WAZUH.md`, `../infra/red/stream-9sep.txt` |
| Red: el consumidor alerta antes de que el productor termine | prueba determinista, dos procesos y una tubería local | `../src/red/stream.test.js` |
| El producto corriendo en el teléfono, delegando a la laptop | 2.6–2.8 s a 122–128 tok/s en la RTX 4060 (Qwen3-1.7B bajo gramática) | `../evidencia/telefono-puente-9sep.md` |
| El mismo teléfono delegando a la Mac de otra casa | 0.98–1.6 s a 250–271 tok/s en el M5 Max | idem |
| El puente del producto probado dentro de android-arm64 | 3 / 3 pruebas (1 se salta) | idem |
| Delegación de la laptop a una Mac en otra casa, por llave pública | 0.65–1.17 s a 255–280 tok/s en el M5 Max | `../evidencia/mac-par-9sep.md` |
| El par se apaga: la laptop lo nota, recalcula local y lo dice | 12.8 s la solicitud que lo encuentra, 2.3 s la siguiente | idem |

El beaconing va con su 57 % a la vista: el tráfico legítimo también es periódico y la
periodicidad no prueba mando y control.

## Sucursal local · 10 de septiembre

Una consulta DOC-NAT-01 desde Chrome del HONOR en modo avión: 6.7 s de carga, 19.3 s de inferencia, 19 tokens, 3.97 tok/s, CPU. Una pregunta distinta sobre RET-ISL-01 se abstuvo incorrectamente. [Controles y resultado](../evidencia/sucursal-webapp-avion-10sep.md).
