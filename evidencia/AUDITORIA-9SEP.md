# Auditoría de Vigía — 9 de septiembre de 2026

**Actualización posterior:** [Segunda revisión, track 3 y Tailscale](TRACK-3-Y-DEMO-9SEP.md). Incluye foto durante revisión, resultados nuevos de los contenedores y pruebas en el HONOR; prevalece sobre las limitaciones de despliegue descritas en esta primera corrida.

Repositorio auditado y corregido: **cpu-16/vigia**, copia local `hackpty`. Alcance confirmado por Gilberto: **Philips, General, Ovnicom y Caja de Ahorros**. **No Psy**: se conserva VisionPsy como herramienta de captura de Philips. El README y THIRD_PARTY ya reflejan esta distinción. No se modificó la declaración de base preexistente.

## Dictamen

Existe un producto funcional y una base competitiva, especialmente en Philips y General. La ventaja demostrable es el recorrido captura → revisión → observación trazable → acta verificable, con QVAC real y delegación por Hyperswarm. Presentar cuatro pantallas y una lista de modelos no demuestra esa ventaja: el video debe mostrar un caso completo y un fallo recuperado. No hay evidencia para prometer una posición en el ranking.

| Track | Encaje comprobado | Qué debe verse en la grabación |
|---|---|---|
| Philips | Alto: extracción, datos incompletos, captura por foto/voz/texto, preguntas, inventario, alertas y acta | Una visita española termina guardada y visible en el tablero; mostrar un dato desconocido y posible duplicado |
| General | Alto: SDK real, inferencia local/P2P, evidencia por tarea, cola persistente y firmas | Dónde ejecuta cada tarea; una captura sin nodo y su recuperación. El HONOR captura/delega, no infiere a bordo |
| Caja de Ahorros | Medio-alto: procedimientos citados, guía sintética, expediente y acta | Caída del CORE declarada por el cajero → procedimiento de contingencia → actuación documentada. No autoriza ni ejecuta retiros |
| Ovnicom | Buen prototipo: consumidor incremental, detección, formato Wazuh, score por zona | Flujo entrando mientras aparecen alertas; Wazuh y Grafana. Separar los campos simulados de la telemetría recibida |

## Correcciones realizadas

1. **Persistencia de captura.** El elemento de IndexedDB permanece durante inferencia y revisión. Se recupera la revisión al recargar y se elimina solo después de recibir el acta. Se bloquea el procesamiento simultáneo del botón y el sondeo en una pantalla.
2. **Guardado recuperable.** Un fallo HTTP ya no deja «Guardando…» bloqueado. El reintento usa el mismo identificador de captura. El almacén devuelve los mismos eventos tras un reintento o reinicio y rechaza reutilizar ese identificador con otro contenido.
3. **Procedencia.** Las visitas de texto y foto ya no se guardan como voz. Los campos y la transcripción de placa se conservan como evidencia de la visita. Eso no equivale a un inventario individual validado por número de serie.
4. **Respaldo para todas las consultas del nodo completo.** Extracción, consulta de inventario y banca usan la misma política; una respuesta vacía no se interpreta como resultado ni como falta de información documental. Dos solicitudes que detectan la caída comparten una sola recarga. Errores de entrada como exceso de contexto no desconectan el par por esta política.
5. **Consulta segura ante JSON inválido.** Una respuesta no interpretable ya no se convierte en un filtro vacío que devuelve todo el inventario.
6. **Privacidad y evidencia.** `/api/evidencia` entrega métricas sin prompts, salidas, mensajes de error ni rutas de fotos. Sus contadores corresponden a la sesión actual. Los registros delegados identifican al par por llave y separan el hardware solicitante. `REGISTRO_PROMPTS=0` también suprime el prompt y la ruta de la imagen.
7. **Fotos temporales.** Directorio único por petición y limpieza en `finally`, incluso cuando la inferencia falla.
8. **Audio.** El detector de silencio lee el bloque PCM `data` del WAV: los metadatos que inserta ffmpeg ya no se confunden con sonido.
9. **Calidad de datos de Philips.** La edad de «uno de los dos resonadores» no se atribuye a los dos. La cita queda como nota y la edad del grupo se pregunta. Se distinguen rangos abiertos de edad. La pregunta por el modelo permite escribirlo; antes solo ofrecía «No sé». Una pantalla de oficina no se clasifica automáticamente como monitor de pacientes.
10. **Banca.** Recuperación dirigida a la sección de un código explícito, evitando referencias cruzadas, y reducción de fragmentos débilmente relacionados cuando hay coincidencia fuerte. El resultado indica el modo de ejecución y el respaldo local cuando corresponde, tanto en la cabecera como en la tarjeta y el pie de la respuesta. Los ejemplos de captura visibles están en español.
11. **Red.** Se conservan latencia, rcode, sitio y zona que ya vienen del flujo; se simulan y marcan únicamente los campos ausentes. Las pruebas ya no sobrescriben la evidencia histórica `src/red/metricas.json` por defecto (`METRICAS_SALIDA` permite exportar una corrida).
12. **Acceso.** Ambos nodos escuchan en loopback por defecto. Para exponer una interfaz de red se debe elegir `ESCUCHAR`; el nodo completo admite la clave de equipo. El puente del teléfono no tiene autenticación propia: conservarlo en localhost. El service worker no guarda redirecciones al login ni errores HTTP como si fueran páginas válidas.

## Pruebas y alcance real

- **72 pruebas deterministas aprobadas**, 0 fallos, 8 pruebas de modelo omitidas en `npm test`. Resultado íntegro: [auditoria-tests-9sep.txt](auditoria-tests-9sep.txt).
- **Navegador Chromium, interfaz real y API controlada:** dos capturas sin conexión, reconexión, original conservado, revisión recuperada tras recarga, fallo al guardar, reintento con mismo identificador y fuente correcta. Sin errores JavaScript. Seis rutas comprobadas a 390 y 1280 px sin desbordamiento horizontal. Esto no prueba la óptica de la cámara ni el micrófono del HONOR. [Resultado](auditoria-navegador-9sep.json), [script](../scripts/auditar-navegador.py), [captura de control](auditoria-captura-9sep.png).
- **QVAC real, controles de Philips:** 12/12 casos de extracción del banco de pruebas pasaron; incluye los diez ejemplos oficiales en inglés y controles español/portugués. Los idiomas adicionales son controles, no el idioma propuesto para la demo. [Salida completa](auditoria-modelos-locales-9sep.txt). La corrida dentro del sandbox tuvo latencias mayores y no debe presentarse como benchmark de la RTX.
- **Banca con QVAC real y acceso directo a GPU:** última corrida **18/20**, **5/5 abstenciones fuera de corpus**, 352–907 ms de inferencia. S11 y S13 se abstuvieron pese a existir respuesta: permanecen como límite, no se ocultan ni se cambian los casos esperados. S05, S07 y S10 respondieron correctamente tras ajustar recuperación. No hubo un procedimiento incorrecto entre las respuestas afirmativas de esta última muestra. [Última corrida](auditoria-banca-final-9sep.json), [corrida anterior](auditoria-banca-corrida1-9sep.json). Veinte consultas sintéticas no garantizan esa precisión en preguntas nuevas.
- **Nodo HTTP con QVAC real:** extracción en español, procedimiento bancario y filtro de inventario respondieron después del primer reinicio; aproximadamente 1,46 s / 0,60 s / 0,54 s. Lenguaje delegado a la Mac. [Evidencia](auditoria-http-9sep.json).
- **Visión real antes del reinicio:** placa nítida identificada en 1,76 s, seis campos coincidentes con la fixture. El cambio de filtro de escena se cubre además con pruebas deterministas.
- **Respaldo:** pruebas concurrentes controladas verifican una sola recarga y respuesta local. No se apagó la Mac ni se cortó la red del usuario en esta auditoría. La caída física y la reasignación de VRAM en caliente conservan la evidencia previa; no se presentan como repetidas ahora.
- **Infraestructura Ovnicom:** se repitieron las pruebas del consumidor y API controlada. Los comprobantes Wazuh/ClickHouse/Grafana existentes son de corridas previas; no se declara una nueva prueba extremo a extremo contra esos contenedores.

Para repetir el navegador: Python con Playwright y Chromium instalado, `python3 scripts/auditar-navegador.py`. Usa datos y API de control, sin escribir al inventario operativo.

Después del reinicio final, el [preflight](auditoria-preflight-9sep.txt) pasó todas las rutas. Una consulta española desde Chromium contra el nodo real devolvió RET-ISL-01; [captura de Sucursal](auditoria-sucursal-real-9sep.png). No se abrió un expediente de prueba en los datos operativos.

## Stack QVAC

La dependencia está fijada en `@qvac/sdk` 0.18.2. Se inspeccionaron las exportaciones instaladas y las llamadas a `loadModel`, `completion`, `transcribe`, `startQVACProvider`, `delegate.providerPublicKey` y `getLoadedModelInfo`. No se encontraron APIs de inferencia ajenas a QVAC. La delegación utiliza la pila Hyperswarm/Holepunch del SDK. Usar esa pila no equivale a haber construido una aplicación empaquetada en Pear Runtime.

Tailscale Funnel publica la interfaz; el navegador envía sus capturas al nodo HTTP. Por eso no se debe decir «ningún dato viaja» en una demo abierta por Funnel. La afirmación defendible es «no se envía a una API de inferencia en la nube; la tarea corre en el nodo o par indicado». En un despliegue bancario, los pares deben estar bajo control de la entidad. La Mac de otra casa es una demostración con datos sintéticos.

La búsqueda bancaria del servidor usa recuperación léxica por términos/códigos y QVAC para seleccionar el procedimiento. La recuperación híbrida con EmbeddingGemma existe y tiene pruebas, pero no está conectada por defecto en `contextoSucursal`; no atribuirle sus beneficios a esta demo.

Fuentes técnicas: [SDK oficial](https://qvac.tether.io/products/sdk), [referencia de API vigente](https://docs.qvac.tether.io/reference/api/), y las declaraciones instaladas de la versión 0.18.2. No se actualizó el SDK durante la auditoría.

## Dojo y competencia

Se consultaron nuevamente el evento, los cinco tracks y la función pública `get_hackathon_public_projects` de la plataforma. `allow_multi_track=true`; el cierre del evento es **11-sep-2026, 08:00 de Panamá**. Snapshot reproducible: [auditoria-dojo-9sep.json](auditoria-dojo-9sep.json). Fuente: [evento de Dojo](https://www.trydojo.io/hackathons/decentralized-ai-hackathon).

Se veían **12 proyectos públicos**, de los cuales **5 no estaban marcados como borrador**; esto no es un ranking ni una cuenta de entregas válidas. Los rivales relevantes por su descripción son ATLAS y Mosaic en base instalada, DevCors en operación bancaria, y Salus/MangoApp/Zarpe en General. No se auditó su código ni se verificó su rendimiento. Los proyectos siguen cambiando.

Vigía no aparece con ese nombre en ese listado; aparece «TBD-Panama» como borrador. No se verificó con una sesión autenticada si es la inscripción vigente del equipo. Debe comprobarse al completar la entrega, sin asumir que editar el README actualiza Dojo. `cpu-16/vigia` seguía privado: los cuatro tracks elegidos requieren acceso para el jurado, no publicación automática. No se cambió la visibilidad ni se envió la inscripción.

## Revisión independiente y límites pendientes

[Respuesta de Claude completa, literal](auditoria-claude-9sep.md). Se contrastó antes de aceptar sus recomendaciones. Su punto sobre la firma no es un fallo criptográfico: el verificador ya explica que prueba integridad y posesión de llave, no identidad. Su mención de `/api/placa` dentro del fallo de la Mac tampoco aplica: VisionPsy es local. Su evaluación de Psy quedó fuera de alcance por aclaración de Gilberto.

Pendientes reales: persistencia no coordinada entre múltiples pestañas; conciliación probabilística de grupos que no equivale a identidad individual; el agente DNS tiene límites explícitos de capacidad y puede detenerse bajo carga excesiva; la zona gris del detector no tiene una interfaz operacional completa; el teléfono no infiere sin un par. El acceso por LAN al puente sigue sin autenticación, de ahí su loopback por defecto. No se resolvieron estos límites ampliando el alcance a una plataforma de producción.

Evaluación visual acotada: accesibilidad 2/4 (contraste de pasos inactivos y algunos controles pequeños por revisar), rendimiento 3/4 (onda de audio anima altura), responsive 3/4 (sin desbordes en los dos anchos medidos), consistencia temática 3/4 (tokens compartidos con estilos locales), integridad 3/4 (estados de error y procedencia corregidos). **14/20 orientativo**, no certificación WCAG. Se preservó la identidad visual para evitar un rediseño antes de grabar.
