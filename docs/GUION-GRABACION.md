# Guion de grabación — Vigía, 4:50

Repo: cpu-16/vigia. Philips + General + Caja de Ahorros + Ovnicom. Narración en español. VisionPsy se usa para Philips; no presentamos el track Psy.

## Preparación (fuera del video)

1. Abre https://fedora.taild88ec5.ts.net:8443/equipos en el teléfono. El puerto 8443 es obligatorio. Entra con la clave del equipo. La URL pública depende de internet; la aplicación local de la laptop también está en http://localhost:7320.
2. Ejecuta `VIGIA_URL=https://fedora.taild88ec5.ts.net:8443 CLAVE=<clave> node scripts/preflight.mjs`. Los modelos ya deben estar descargados. No reinicies el nodo entre consultar una guía y abrir su expediente.
3. Prepara la placa sintética `fixtures/placas/nmmr700-nitida.png`, en otra pantalla o impresa. Ensaya la cámara física y el micrófono; las pruebas automatizadas también usaron archivos de control.
4. Abre el tablero, Sucursal, Wazuh y Grafana en pestañas. Grafana usa fechas del replay, no la hora de ingesta: selecciona el rango absoluto documentado en `infra/red/VERIFICADO-QOE.md`. No ejecutes `levantar.sh`: recrea contenedores.
5. Para Red, sigue `infra/red/VERIFICADO-WAZUH.md` con las credenciales locales ya configuradas y **MODELO=1** en el consumidor: `node src/red/productor.js --velocidad 1 | MODELO=1 node src/red/demo.js --stdin`. Para Wazuh y ClickHouse deben estar exportadas sus variables locales; no muestres contraseñas en pantalla.
6. Abre `evidencia/prueba-sin-internet-final.json`: es evidencia de inferencia local en un proceso aislado sin rutas. Apagar la red de una pestaña solo demuestra la cola del navegador, no la ausencia de internet en toda la máquina.

## 0:00–0:20 · Problema y propuesta

**Pantalla:** teléfono con Equipos.

> «Una visita deja información incompleta: lo que alguien vio, lo que recuerda y una foto. Vigía convierte esa observación en datos que podemos revisar, continuar y verificar. Usamos datos ficticios y QVAC en nuestros equipos.»

## 0:20–1:30 · Una visita que se completa con evidencia

**Acción:** dicta:

> «Estoy en Hospital DemoCare Pacific, Ciudad de Panamá, Panamá. Vi dos resonadores NovaMed de siete años; no conozco el modelo.»

Responde un dato si lo solicita. Durante la revisión pulsa **Añadir foto del equipo**, fotografía la placa y confirma la unidad correspondiente. Muestra que siguen siendo dos unidades: una con serie y la otra con el modelo pendiente. Pulsa **Guardar con datos pendientes**, confirma si los viste directamente y guarda.

> «Whisper transcribe mediante QVAC. El modelo extrae lo dicho; las respuestas que confirmo no necesitan otra inferencia. Ahora incorporo una placa sin volver al inicio. VisionPsy la lee, yo confirmo y se aplica a una unidad. Lo desconocido permanece desconocido.»

Si aparece una posible visita repetida, muéstrala y explica que requiere revisión. No cambies de hospital silenciosamente para ocultarla.

## 1:30–2:00 · Tablero que orienta la próxima visita

**Acción:** busca Pacific, muestra próximas verificaciones, última observación y la unidad con serie. Exporta el CSV filtrado.

> «El tablero ayuda a decidir qué comprobar en la próxima visita. Conserva cantidades, identifica unidades cuando hay serie y muestra qué falta. La antigüedad prioriza una evaluación; no determina por sí sola un reemplazo. Podemos exportar los datos para continuar el trabajo.»

## 2:00–2:50 · Caja: procedimiento diario y cierre completo

**Acción:** Sucursal, nombre y sucursal ficticios. Pregunta:

> «¿Qué documentos necesita una persona natural adulta panameña para abrir una cuenta?»

Debe mostrar DOC-NAT-01. Abre expediente, documenta en Observación una actuación **realmente simulada**, guarda ese campo, cierra y verifica. Pulsa **Iniciar otra atención**.

> «El personal recibe un procedimiento con respaldo literal de una guía local. Documenta lo realizado y cierra con un acta verificable. La guía es sintética: no representa políticas oficiales de Caja. Vigía no autoriza ni ejecuta transacciones.»

**Toma breve alternativa:** «¿A qué hora cierra la sucursal los sábados?» → abstención → **Documentar consulta sin respuesta**. Explica: «Deja constancia de que no había respaldo y permite seguimiento humano. No afirma haber contactado al supervisor.» Si usas esta variante, recorta el ejemplo anterior; no alargues el video.

## 2:50–3:25 · Ovnicom en su entorno

**Acción:** productor y consumidor mientras aparecen alertas en Wazuh; mostrar QoE por zona en Grafana.

> «Un consumidor adicional del flujo DNS genera alertas y calidad de experiencia. QVAC explica las señales con guardas; Wazuh y ClickHouse reciben las salidas dentro de la infraestructura local. El transporte de esta demo es una tubería. Los campos de latencia y respuesta que el archivo no trae están marcados como sintéticos.»

No requiere teléfono. La nueva corrida documentó 62 alertas recibidas y 52 filas de QoE; si la toma reproduce otro volumen, muestra su delta y no mezcles cifras.

## 3:25–4:15 · Qué ocurre sin internet

**Acción:** muestra una captura pendiente y su recuperación; después la evidencia del proceso aislado y dónde ejecuta cada modelo.

> «Hay dos situaciones. Sin acceso al nodo, el teléfono conserva la captura y la procesa cuando vuelve. Con los modelos descargados, la laptop también interpreta sin internet: lo probamos en un entorno sin rutas. El HONOR de esta demo no logra cargar el modelo a bordo; delega a un par. La URL de Tailscale es acceso web, no el lugar donde corre la IA.»

La prueba aislada incluye extracción y consulta bancaria locales. No digas que la laptop completa estuvo desconectada ni que el teléfono infiere sin par.

## 4:15–4:40 · Integridad comprobable

**Acción:** abre el acta, muestra «Acta válida», pulsa **Probar una alteración**, observa el rechazo y restaura el original.

> «La firma permite detectar que alguien cambió el contenido después de cerrarlo. Se comprueba en el navegador, incluso sin red. Eso prueba integridad desde la firma; no prueba que la observación sea verdadera ni identifica por sí solo al dueño de la llave.»

## 4:40–4:50 · Cierre

> «Vigía hace que la información de campo sea revisable y útil: se puede continuar, comprobar y llevar a la siguiente decisión, con ejecución bajo control de la organización.»

## Antes de entregar

Video ≤5 minutos, enlace visible sin credenciales. Repo cpu-16/vigia accesible al jurado durante toda la evaluación; que sea privado no lo descalifica, pero requiere acceso efectivo. Declaración de base preexistente en README. Confirma los cuatro tracks y el enlace del video en el proyecto correcto de Dojo. No uses «RAG híbrido activo» ni «voz generada» en la narración: no están activados en esta versión.
