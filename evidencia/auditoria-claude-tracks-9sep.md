# Respuesta de Claude

Transcripción literal de la consulta de solo lectura. Sus recomendaciones se evalúan por separado; no constituyen resultados de pruebas.

## Veredicto corto

El producto existe y compite. Lo que hoy pierde puntos no es código: es dónde apuntas la cámara. Nada de esto pide reescribir módulos.

---

## Banca: ¿de verdad le sirve al banco?

**Requisito (no opinión):** el RETO.md de Caja de Ahorros es abierto y lista *"Operación interna. Agentes locales que asisten al personal del banco en tareas repetitivas, consultas sobre procedimientos"* como dirección válida. Tu guía citada **encaja de lleno**; no hay riesgo de descalificación por tema. Lo obligatorio es QVAC on-device, datos sintéticos, repo y video ≤5 min.

**Opinión mía, fundamentada:** el reencuadre está mal, no el producto.

1. La contingencia CORE es un evento **raro**. El jurado pondera "aplicabilidad real en la operación del banco" y el modo isla pasa unas horas al año por sucursal. Además la caída **la declara la persona**, el nodo no la detecta (`src/sucursal/http.js:32-35`). Estás vendiendo tu escena más dramática como si fuera el producto.
2. Lo que realmente construiste es un **asistente de procedimientos con cita literal y abstención** (18/20, 5/5 fuera de corpus — `README.md:96-97`) más un **expediente sellado y verificable sin servidor** (`src/sucursal/expediente.js:56-62`). Eso sirve todos los días: documentos de persona natural, arqueo de caja, excepciones. La guía ya los tiene (`fixtures/sucursal/guia-bpl.md`, secciones DOC-NAT-01, CAJ-ARQ-01).
3. **Riesgo real:** la recuperación híbrida no está conectada por defecto (`evidencia/AUDITORIA-9SEP.md:52`). Con preguntas parafraseadas mides 1/4 vs 3/4 (`README.md:101`). Si un jurado pregunta con sus propias palabras, el número que enseñas no aplica.

**Sobre DevCors** (`evidencia/auditoria-dojo-9sep.json`, `is_draft: False`): admisión de expedientes en sucursal, dicta o fotografía el documento, guardas deterministas, verifica dígito de cédula. Es un flujo **diario y de alto volumen** — sí, ataca una necesidad más frecuente que la tuya. Pero su tesis (nada que no esté en la fuente entra) es exactamente la que tú ya tienes en `src/equipos/extraer.js:23-82`, y por su descripción **no tiene acta verificable**. Tu diferenciador defendible es la trazabilidad firmada, no la contingencia.

**No cambies el producto a 20 horas de grabar.** Cambia la frase.

---

## Philips: menos carga

- **Cada respuesta re-infiere.** El handler de `#preg` llama `revisar()`, que vuelve a `POST /api/extraer` (`src/servidor.js:166-179`) sobre el **mismo texto**. Tres preguntas = cuatro inferencias por visita. `aplicarRespuestas` es determinista: la segunda llamada no aporta nada. Choca de frente con *"Capturing information should take seconds, not minutes"* (`retos/philips/reto-docx.md:319`).
- **Demasiadas preguntas.** `preguntas()` (`src/equipos/reglas.js:35-46`) genera marca + edad + modelo **por grupo**. Con tres grupos son nueve. El reto pide *"the most valuable missing information"*, no todas.
- **Foto durante las preguntas: hoy no se puede sin retroceder.** `#btnFoto` vive en `#p1` (`app/index.html:179`) y `revisar()` oculta `#p1` al pasar a `#p2`. Toca "Corregir" (`#volver`), foto, y volver. `verFoto()` ya hace lo correcto —escribe la observación en `#texto` vía `sumarAlTexto` y `estado.respuestas` sobrevive—, solo falta el botón donde estás parado.

---

## Ovnicom

- **¿Móvil? No.** El RETO.md no menciona dispositivo móvil en ningún punto: pide un agente consumidor del stream que escriba a Wazuh y ClickHouse, *"en el dispositivo o en el servidor local"*. Sacar el teléfono en esa escena resta minutos y confunde.
- **¿Contenedores? Sí, y hay que repetirlo en vivo.** El jurado dice literal que mira *"que las alertas lleguen a Wazuh en un formato que el SIEM pueda procesar"*. Está verificado (`infra/red/VERIFICADO-WAZUH.md`, `VERIFICADO-QOE.md`, Wazuh 4.14.0 + ClickHouse + Grafana vía `infra/red/levantar.sh`), pero `evidencia/AUDITORIA-9SEP.md:40` dice que **no se declaró una prueba nueva extremo a extremo**. Nada de capturas viejas: levanta y graba.
- **Hueco menor:** el reto habla de Vector/Kafka; tu entrada es una tubería de `productor.js`. `src/red/consumidor.js:29` ya acepta cualquier AsyncIterable y `src/red/agente.js:1` declara que nunca escribe al bus. Es defendible con **una frase** en el video.

---

## Las 5 mejoras (en orden de impacto/costo)

1. **Botón de foto dentro de `#p2`** (`app/index.html:193-203`), llamando a `verFoto()` y luego `revisar()`. ~10 líneas, sin tocar servidor. Es tu pedido y además es la escena más vendible de Philips.
2. **Responder sin re-inferir:** si `estado.texto` no cambió, aplicar la respuesta y recalcular `preguntas()`/`derivar()` sin llamar al modelo (`src/servidor.js:166`). Convierte 4 inferencias en 1.
3. **Tope de 2 preguntas por visita** en `src/equipos/reglas.js:40-46`; el resto queda como "por completar" en el tablero. Una línea.
4. **Ovnicom en vivo, sin teléfono:** contenedores levantados, alerta entrando al panel y la zona cayendo en Grafana, en la misma toma.
5. **Banca, cero código:** segundo caso diario (DOC-NAT-01) después del modo isla; decir el hardware con la latencia (375–923 ms en GPU, no los 10.4 s de CPU de `src/sucursal/NOTAS.md:28`); y **corregir el guion: dice "diecisiete de veinte"** (`GUION-VIDEO.md:85`) cuando la última corrida es 18/20.

---

## Recomendación por track

| Track | Qué hacer |
|---|---|
| **Philips** | Tu mejor apuesta. Mejoras 1-3 y véndelo por segundos por visita, no por cantidad de campos. Rivales fuertes (ATLAS, Mosaic, ProofAI) hacen lo mismo; tú tienes acta firmada y foto durante la conversación. |
| **General** | Sin cambios. La delegación por llave pública y el par que se cae es lo único que nadie más muestra medido. Es donde está el premio grande. |
| **Ovnicom** | Sin móvil, con contenedores en vivo, y una frase sobre el bus. Es tu track menos disputado: nadie más aparece en él. |
| **Caja de Ahorros** | Mantén el módulo, cambia el pitch: "procedimientos citados con abstención + expediente verificable", contingencia como el caso más caro. Declara que la híbrida no está conectada antes de que lo pregunten. |

**No competimos en Psy** — VisionPsy se menciona solo como lector de placas de Philips; revisa que el guion (`GUION-VIDEO.md:51`) no siga diciendo *"esta escena es del track 02"*.