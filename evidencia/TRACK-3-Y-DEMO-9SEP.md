# Vigía: cumplimiento y propuesta para el track 3

Revisión del 9 de septiembre de 2026. Repo: cpu-16/vigia. Tracks elegidos: Philips, General, Ovnicom y Caja de Ahorros. No se presenta al track Psy. Este dictamen describe la implementación auditada; la elegibilidad definitiva la determina ISD.

## Qué exige el track 3 y qué hacemos

Fuente: [Dojo, Desafío General](https://www.trydojo.io/hackathons/decentralized-ai-hackathon), texto completo contrastado con su API y conservado en `auditoria-dojo-9sep.json`. El requisito dice SDK de QVAC, «preferentemente con los modelos que QVAC pone a disposición». No obliga a que todos los modelos hayan sido entrenados por Tether, ni obliga a usar Psy.

| Requisito | Evidencia de Vigía | Estado |
|---|---|---|
| Usar SDK QVAC | `package.json` fija `@qvac/sdk` 0.18.2; `src/core/runtime.js`, `voz.js`, `src/equipos/placa.js` llaman al SDK | Implementado y ejecutado |
| Inferencia local o P2P, sin API de inferencia en nube | Qwen3-1.7B en un par autorizado por llave pública; Whisper y VisionPsy en laptop; Ovnicom con Qwen local | Verificado en los flujos probados |
| Modelos disponibles mediante QVAC, preferentemente | Qwen3-1.7B Q4_0, Whisper large-v3 turbo y VisionPsy Nano 460M del registro del SDK | Sí |
| Pears valorado, no obligatorio | Proveedor y cliente QVAC delegan mediante Hyperswarm | Evidencia P2P en laptop y teléfono; no llamar P2P al fetch HTTP del navegador |
| Producto que resuelve un problema | Captura → revisión → datos estructurados → acta; guías citadas y expedientes; alertas DNS + QoE | Recorridos implementados; impacto comercial aún es hipótesis |
| Repo accesible durante evaluación | `cpu-16/vigia` existe y es privado | No se ha probado el acceso de cuentas del jurado |
| Declarar base preexistente | Sección del README existente conservada | Requiere que la declaración coincida con la historia real del equipo |
| Video ≤5 minutos, accesible sin credenciales | Guion actualizado | Falta grabación y enlace final |

Tailscale transporta el acceso a la interfaz y API propia; no ejecuta nuestros modelos. Claude se consultó para revisar desarrollo, no forma parte de la inferencia del producto. No se añaden llamadas a proveedores de IA en nube al flujo evaluado.

[Whisper es de OpenAI](https://github.com/openai/whisper). [La documentación de QVAC](https://docs.qvac.tether.io/ai-capabilities/voice-assistant/) incluye los modelos Whisper, incluido large-v3 turbo. «Modelo usado mediante QVAC» y «modelo creado por Tether» son afirmaciones distintas. La versión del SDK se fija por compatibilidad con la delegación implementada; no se afirma usar la última versión.

## Diferencia que podemos demostrar

**Vigía convierte observaciones incompletas en registros que se pueden continuar, revisar y verificar.** La evidencia más convincente es una sola visita interrumpida:

1. Dictar una visita en español con dos equipos y datos faltantes.
2. Responder un dato; tomar la placa de una unidad sin volver al inicio.
3. Confirmar lo leído: esa unidad recibe su identidad, la otra conserva sus pendientes y el total no cambia.
4. Recargar: se recuperan la revisión y la foto confirmada. Las respuestas no requieren otra inferencia.
5. Guardar con pendientes, ver la base instalada y verificar el acta.

Esto hace observable la combinación de IA pequeña, control humano, continuidad y trazabilidad. No afirmamos que ningún competidor la tenga: las descripciones públicas de Dojo no permiten auditar sus implementaciones ni compararlas con nuestros benchmarks.

El video debe dedicar la mayor parte del tiempo a Philips/General. Caja y Ovnicom muestran aplicaciones concretas de los mismos principios, sin convertir la demo en un recorrido de botones. No se promete ganar: los pesos oficiales son técnica 35 %, innovación 25 %, impacto 20 %, diseño 10 % y terminación 10 %.

## Caja: valor y límites

El track admite expresamente consultas de procedimientos para operación interna. Eso respalda el encaje, no demuestra demanda del banco. Caja ya tiene [A.N.D.R.E.A.](https://www.cajadeahorros.com.pa/andrea/) para atención y servicios a clientes. Nuestra hipótesis es ayudar al personal con procedimientos citados, abstención cuando no hay respaldo y expediente verificable. Mostrar un trámite diario y luego la contingencia resulta más defendible que vender solamente una caída de CORE.

La guía es ficticia. El operador declara la contingencia; el sistema no detecta el CORE ni autoriza retiros. La recuperación por embeddings existente no está conectada al servidor por defecto: no presentar la búsqueda en vivo como RAG híbrido. El control previo fue 18/20 y 5/5 abstenciones fuera de guía; no equivale a fiabilidad general ni evaluación con políticas reales del banco.

## Ovnicom: resultado nuevo

Corrida con `MODELO=1`, productor y consumidor separados, y los contenedores existentes. 10 120 eventos de evaluación; 62 alertas recibidas en Wazuh por API-Webhook, 0 fallidas, 52 filas nuevas en ClickHouse. Grafana consultó la fuente real y obtuvo cuatro zonas. QVAC generó 62 selecciones/explicaciones: 45 pasaron sus guardas y 17 usaron respaldo determinista. La detección no depende de aceptar una explicación libre.

No requiere móvil. El transporte probado es una tubería local, no un adaptador Kafka desplegado. Latencia y NXDOMAIN del replay se simulan porque el archivo de consultas no los trae; se declaran como campos sintéticos. Se conservaron los contenedores y sus datos.

## Despliegue probado

- URL completa: **https://fedora.taild88ec5.ts.net:8443/equipos**. El puerto es parte del enlace. El host sin 8443 apunta a otro servicio de la máquina y no se modificó.
- HTML de Tailscale coincide byte a byte con `app/index.html`; recursos JS compartidos responden 200.
- Navegador de escritorio a 390 px: extracción y VisionPsy reales, foto durante revisión, sin errores JS ni desborde en las rutas de producto comprobadas.
- HONOR X6s físico a 360 px: mismo enlace HTTPS, extracción y foto reales, revisión recuperada tras recargar, sin errores JS ni desborde. Caché `vigia-v4`.
- El nodo independiente de Termux en 7312 se actualiza por separado. Es un cliente QVAC de texto/P2P y no tiene voz, visión ni sucursal integradas. Se indica la falta de estas capacidades; para el recorrido completo del teléfono se usa el enlace HTTPS.
- Este informe documentó la auditoría previa al push. El cierre de producto y el guion posteriores están en `../docs/PRODUCTO-Y-LIMITES.md` y `../docs/GUION-GRABACION.md`. No se publica una entrega en Dojo desde esta auditoría.

## Fallos encontrados en la segunda revisión adversarial

Claude señaló cinco riesgos; se verificaron y corrigieron por separado. Su respuesta literal está en `auditoria-claude-parche-9sep.md`.

- Cambiar el relato después de separar una unidad ya no aplica respuestas por índice del borrador anterior. Conserva esa revisión y la foto; exige revisar de nuevo la asignación de la placa. La regresión de navegador conserva las dos unidades después de corregir y volver a confirmar la foto (`auditoria-corregir-foto-9sep.json`).
- La misma serie no puede asignarse a otro grupo de la misma visita. El botón de confirmar se bloquea durante la operación.
- Una edad abierta ya confirmada no se sustituye por otra observación y no se solicita como dato ausente. No se calcula una media usando un límite inferior como si fuera una edad exacta.
- `encolar` ya no descarta silenciosamente una nueva captura porque exista otra activa. El reintento del ítem activo se maneja explícitamente. Durante «Corregir» se edita el relato; añadir fotos sigue disponible en la revisión.
- La cantidad debe ser un entero positivo; una entrada como «tres» muestra un error corregible y no se convierte en un dato confirmado nulo.

## Verificación final

79 pruebas deterministas pasan, 8 de modelo quedan omitidas en `npm test` por diseño; los controles con modelos reales se documentan aparte. En Android pasan 13 pruebas del puente/revisión y se omite una de integración. Los dos controles diarios de banca y la abstención pasaron por Tailscale. Whisper transcribió un audio de control español de 9,30 s mediante la URL pública en 1,22 s de HTTP; no representa una medición de micrófono en vivo.

El detector de diseño dejó avisos sobre estilos existentes y animación de altura; no se convirtió esa preferencia estética en un rediseño. Los desbordes reales detectados con datos sí se corrigieron. La extracción y las fotos se comprobaron en navegador y teléfono; las pruebas de reintento/guardado se ejecutaron con API de control para no añadir visitas al inventario de demostración.

Reproducir: `npm test`, `python scripts/auditar-navegador.py`, `python scripts/probar-foto-revision.py`, `PROBAR_CORRECCION=1 python scripts/probar-foto-revision.py`, `CLAVE=<clave> python scripts/auditar-tailscale.py`. La última usa los modelos reales y tarda más.

## Evidencias

`auditoria-tailscale-final-9sep.json`, `auditoria-honor-tailscale-9sep.json`, `auditoria-foto-revision-9sep.json`, `auditoria-red-real-9sep.json`, `auditoria-tests-segunda-9sep.txt`, `auditoria-telefono-nodo-actualizado-9sep.json`. [Respuesta de Claude completa y literal](auditoria-claude-tracks-9sep.md), con recomendaciones que se contrastaron por separado.
