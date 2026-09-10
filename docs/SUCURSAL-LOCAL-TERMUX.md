# Sucursal local en HONOR: prototipo reproducible

Extensión experimental de Vigía para consultar por texto la guía ficticia BPL en un teléfono sin conexión. No es una APK ni una entrega comercial. El navegador accede a `http://localhost:17321/sucursal`; un servidor Node en Termux recupera una sección completa por términos y un proceso Bare genera la respuesta con `@qvac/llm-llamacpp` dentro del teléfono. No usa la laptop, el par QVAC ni servicios de inferencia en la nube.

La interfaz conserva el sistema visual de Sucursal. No incorpora dictado, fotografía, expedientes del nodo principal, embeddings, ni ejecución de transacciones. Respuestas y abstenciones se guardan localmente. Mostrar un resultado del modelo no lo convierte en una autorización bancaria.

## Requisitos ya verificados en este HONOR

- Termux y Node >=22; runtime Bare Android arm64 1.31.0.
- `~/qvac-app/node_modules/@qvac/llm-llamacpp` 0.45.0, junto a sus dependencias instaladas.
- `~/qvac-app/qwen3-0.6b-q4.gguf` descargado previamente (Qwen3-0.6B Q4).
- Backends CPU Android incluidos en el paquete QVAC. El worker prepara un directorio solo CPU: evita el fallo al explorar Vulkan en este HONOR.

El paquete fuente no redistribuye dependencias ni pesos, y no descarga nada al iniciar. Para otro teléfono hay que proporcionar estas dependencias compatibles y validar su instalación/licencias por separado. No basta copiar el archivo comprimido a un Android vacío.

## Empaquetar en Fedora

Desde `hackpty`:

```bash
bash scripts/empaquetar-sucursal-local.sh /tmp/vigia-sucursal-local.tar.gz
```

El archivo excluye claves, tokens, consultas guardadas, modelos y `node_modules`. El SHA-256 se imprime al finalizar. Descomprimir en el home de Termux crea `~/vigia-local`.

## Instalar sobre el entorno Termux existente

```bash
tar -xzf vigia-sucursal-local.tar.gz -C "$HOME"
cp "$HOME/vigia-local/src/puente/sucursal-local-worker.cjs" "$HOME/qvac-app/vigia-sucursal-worker.cjs"
cd "$HOME/vigia-local"
npm test
npm start
```

Abrir `http://localhost:17321/sucursal` en Chrome o Brave del propio teléfono. El servidor escucha exclusivamente en loopback. `PUERTO`, `QVAC_RAIZ` y `VIGIA_LOCAL_DATOS` permiten cambiar puerto, raíz de los modelos y almacenamiento. El worker por defecto se encuentra dentro de `QVAC_RAIZ` para resolver las dependencias Android existentes.

## Probar con evidencia

1. Preguntar «Según DOC-NAT-01, ¿qué documento de identidad se requiere?». La primera prueba API produjo «El documento de identidad es la cédula ficticia vigente», con 6.6 s de carga y 18.2 s de inferencia CPU. Una pregunta sobre el tope RET-ISL-01 produjo una abstención incorrecta pese a estar el dato en la fuente: no todas las consultas son fiables con este modelo pequeño.
2. Observar la carga y la inferencia: son fases distintas y reales. El primer inicio puede tardar más de un minuto en el HONOR.
3. Revisar la respuesta y la sección completa, incluidas restricciones. El modelo es pequeño y puede equivocarse.
4. Abrir detalles técnicos: muestra backend CPU reportado por QVAC, tiempos, tokens, motor y un identificador nuevo por consulta.
5. Descargar la evidencia desde la interfaz. También queda en `~/.local/share/vigia-sucursal/consultas.jsonl`.
6. Preguntar por una hipoteca, una tasa de interés o un código inexistente: la recuperación se abstiene, registra la abstención y declara «Inferencia: no ejecutada».

La recuperación es determinista, por términos/códigos; la redacción en las consultas cubiertas sí procede del modelo. Las exclusiones y códigos desconocidos se rechazan antes del modelo. Las cifras sin respaldo en la sección marcan abstención. Estas comprobaciones no sustituyen una validación semántica exhaustiva: revisión humana obligatoria. Un error o timeout del worker produce error visible, nunca una respuesta precargada.

## Verificar funcionamiento sin conexión

Comprobar avión activado, Wi-Fi y datos móviles apagados y ausencia de `adb reverse` hacia el servidor de la laptop. Un reverse USB puede seguir funcionando con modo avión. El navegador debe consultar `localhost:17321` del propio teléfono. Verificar que una conexión externa falla, enviar una consulta nueva y conservar su identificador, respuesta, fuente y métricas. Al terminar, restaurar las radios y conexiones previas.

## Icono y ventana independiente

Con el nodo encendido, usar el menú de Chrome **Añadir a pantalla de inicio → Instalar**. La interfaz incluye manifiesto, iconos PNG y caché solo de archivos de la aplicación; las API y consultas no se cachean mediante service worker. Se verificó en el HONOR la apertura desde el icono «Vigía local» en modo `standalone`.

Si Android termina Termux, la interfaz puede abrir desde su caché, pero no puede inferir. La aplicación lo informa y necesita reiniciar el nodo. La falta de memoria al grabar la pantalla provocó ese cierre en una prueba; no se garantiza persistencia del proceso. Esto no es una APK autónoma con runtime y modelos integrados.

## Persistencia y límites

El servidor permite una inferencia a la vez y rechaza la siguiente con HTTP 409; cada trabajo tiene un UUID y archivos propios. Las consultas y fragmentos se guardan en claro dentro del almacenamiento privado de Termux. Solo usar datos ficticios en este prototipo. No hay sincronización, autenticación multiusuario, cifrado de expedientes, instalación de modelos ni recuperación automática de proceso. El servidor debe permanecer abierto para usar la web. Un reinicio de Termux exige arrancarlo de nuevo.

## Memoria y consultas breves

El primer intento con Chrome y grabación nativa provocó que el gestor HONOR iAware terminara Termux por falta de memoria (`SIGKILL`, `iAwareR[LowMem](fg-service)`). Se conserva ese fallo en la evidencia. El worker se ajustó a contexto 512, máximo 32 tokens de salida y mmap habilitado; el control de pantalla utilizó 2 Mbit/s. Esto es un prototipo para consultas breves, no para secciones o respuestas extensas. No desactiva la gestión de memoria del sistema ni cierra aplicaciones del usuario.

Con estos ajustes, la grabación desde Chrome en modo avión se completó: consulta DOC-NAT-01, 6.7 s de carga, 19.3 s de inferencia, 269 tokens de entrada y 19 de salida, CPU, `contextSlides=0`, final por `eos`. La pregunta de hipoteca produjo una abstención local guardada sin ejecutar el modelo. Las radios y el reverse se restauraron al estado previo. Evidencia de integración: `evidencia/sucursal-webapp-avion-10sep.md` del repositorio.

## Revisión adversarial posterior a la toma

El paquete actual compara cifras completas normalizadas: `10` no coincide con `100.00`; `100` y `100,00` son equivalentes. Marca abstención si QVAC alcanza `predictionLimit` o informa desplazamiento de contexto. Conserva la salida original para revisión, pero no la presenta como respaldada. La toma válida termina por `eos` y `contextSlides=0`, así que conserva su resultado.

El estado verifica que modelo, worker y metadatos del paquete QVAC sean archivos legibles no vacíos y que Bare sea ejecutable. La interfaz espera esa verificación; si faltan requisitos, indica cuáles y deshabilita la consulta. Estos controles verifican presencia, no integridad de pesos ni carga efectiva; la carga se confirma al inferir. El dispositivo se consulta al sistema, no se afirma HONOR en cualquier máquina.

Son ocho pruebas funcionales, incluyendo números parciales, signo, truncamiento, contexto desplazado, requisitos faltantes y estado HTTP. No garantizan respaldo semántico: una consulta maliciosa o ambigua puede influir en el modelo, y las palabras o cifras presentes pueden asociarse incorrectamente. Solo usar guía ficticia y revisar humanamente la sección completa. El prototipo no autoriza operaciones.
