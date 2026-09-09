# Red de Vigía — 9 de septiembre de 2026

El consumidor recibe un `AsyncIterable` de eventos normalizados: suscribirlo con un grupo propio al bus del patrocinador. No publica ni modifica el pipeline. `reproducir` procesa BIND línea por línea y aplica el reloj del registro dividido por velocidad. No es un análisis en lote. Las dos salidas salen de `consumir`: alertas para Wazuh (por su API local, y JSONL como respaldo) y filas QoE para ClickHouse. El adaptador concreto del broker queda pendiente de conocer protocolo y credenciales locales.

## Los datos de entrada

`fixtures/red/benigno.bind.log` son las primeras 14 000 líneas del **registro DNS que Ovnicom entregó para el reto**, sin modificar, en formato de query log de BIND9. **El reto declara que los datos suministrados son sintéticos**; aquí no se afirma que sean tráfico real de clientes. Lo que sí es del archivo entregado: consultas, clientes, tipos, resolutor y marcas de tiempo (se supone UTC−5). Lo que agregamos nosotros: los ataques etiquetados de `fixtures/red/inyector.js`, las marcas ficticias, los nombres y perfiles de zona, y los campos `latency_ms` y `rcode` de QoE. Procedencia y huella en `fixtures/red/procedencia.json`.

## Correr la demo

Desde la raíz de hackpty:

```bash
node --test src/red/            # pruebas
node src/red/demo.js            # replay en un solo proceso (rápido, para medir)
```

**Como flujo continuo, dos procesos unidos por una tubería local** — es lo que se ve en el video:

```bash
node src/red/productor.js --velocidad 1 | node src/red/demo.js --stdin
```

`productor.js` reproduce el registro con ritmo temporal y escribe una línea JSON por evento a stdout; `demo.js --stdin` las consume. El consumidor empieza a alertar mientras el productor sigue produciendo: eso es lo que separa un flujo de un archivo estático, y hay una prueba que lo verifica (`src/red/stream.test.js`). El transporte de la demo es una tubería local; **en producción va un consumidor Kafka** suscrito con su propio grupo.

El productor marca la fase de cada evento: las primeras `--perfil` consultas (4 000 por omisión) salen sin espera y sirven para que el consumidor **congele su lista blanca**; a partir de ahí empieza la evaluación, con ritmo. Opciones: `--velocidad N` (divisor del reloj del registro; 1 = tiempo real), `--perfil N`, `--max N`, `--ataques N`, `--periodo-beacon MS`, `--sin-ataques`, y una ruta a otro query log. Los pulsos de beacon van a 30 repeticiones cada 2 s para que quepan en los 65 segundos del registro; las métricas de precisión y recall de `src/red/NOTAS.md` usan otro banco (120 por familia, beacon cada 10 s).

Variables de entorno de `demo.js`: `WAZUH_API_URL` / `WAZUH_API_USER` / `WAZUH_API_PASS` (las tres o ninguna) activan el envío por la API local; `CLICKHOUSE_LOCAL=1` escribe QoE en ClickHouse en vez de a un archivo SQL; `VENTANA_QOE_MS` cambia la ventana de agregación (60 000 por omisión, 5 000 en la demo); `MODELO=1` carga QVAC para que redacte los casos, con `CPU=1` para forzar CPU; `SALIDA` cambia el directorio de salida.

`consumir(flujo, { listaBlanca, archivoAlertas, guardarQoe, api, alProgresar })` permite conectarlo al bus. `Detector.candidatos` expone la zona gris de periodicidad (CV entre 0,12 y 0,25); `desempatar` devuelve una opinión cerrada para revisión humana, sin convertirla en alerta automáticamente. La lista blanca debe construirse con una muestra previa confiable y permanecer congelada. Las alertas se escriben inmediatamente; una misma familia/cliente/SLD se silencia por cinco minutos. Para explicaciones opcionales, pasar `modelo` ya cargado y `archivoCasos`: se guardan aparte, con backpressure y respaldo determinista si falla la inferencia. Esta modalidad necesita retención en el bus; no está dimensionada para invocar QVAC por cada consulta.

## Wazuh single-node con Docker

Procedimiento basado en la [guía oficial de despliegue](https://documentation.wazuh.com/current/deployment-options/docker/wazuh-container.html) y la [sintaxis oficial de reglas](https://documentation.wazuh.com/current/user-manual/ruleset/ruleset-xml-syntax/rules.html). Levantado y verificado el 9-sep: ver `VERIFICADO-WAZUH.md`. Script: `bash infra/red/levantar.sh`.

```bash
sudo sysctl -w vm.max_map_count=262144
git clone --depth 1 -b v4.14.0 https://github.com/wazuh/wazuh-docker.git
cd wazuh-docker/single-node
docker compose -f generate-indexer-certs.yml run --rm generator
docker compose up -d
```

Ajustar usuarios y contraseñas de demostración antes de `compose up`. El panel viene en el 443; si ese puerto está ocupado, cambiarlo (aquí, 8444). Copiar `infra/red/local_rules.xml` a `/var/ossec/etc/rules/local_rules.xml` en el gestor y reiniciarlo. Revisar los IDs 100101–100104 para evitar colisión con reglas existentes.

**Transporte 1 — API local (el que pide el reto).** El manager expone `POST /events` desde la 4.8 y en 4.14.0 viene habilitado. Se autentica con `POST /security/user/authenticate` (básica, HTTPS autofirmado, token de 900 s) y las alertas entran a `alerts.json` con `location: API-Webhook`, disparando las mismas reglas. `enviarApi()` en `src/red/wazuh.js` habla ese endpoint con `node:https`, sin dependencias, y **rechaza cualquier destino que no sea loopback**. Dos límites del endpoint, medidos: 100 eventos por petición y 30 peticiones por minuto (fijo en el middleware del manager). Por eso `consumir` agrupa hasta 100 alertas o 2,5 s.

**Transporte 2 — lector de archivo del agente (respaldo).** Insertar el fragmento `ossec-localfile.xml` DENTRO del `<ossec_config>` del manager o del agente, montar el directorio absoluto `hackpty/infra/red/salida` como `/var/log/vigia:ro` (el archivo debe existir antes de iniciar y ser legible), y las mismas líneas JSONL entran por `localfile`. Este camino sigue escribiéndose siempre: es el respaldo si la API no responde y lo que se le pasa a `wazuh-logtest` para probar una regla.

En el panel, en eventos de seguridad, buscar `rule.groups:vigia_red` o `data.integration:vigia-red`. El momento de ingesta del SIEM es el actual, no la hora del registro DNS; si se filtra por el tiempo original hay que usar rango absoluto.

## QoE y Grafana

`qoe.js` exporta el DDL, `insertar(filas)` y el escritor HTTP exclusivo a `127.0.0.1:8123`. Con `CLICKHOUSE_LOCAL=1` la demo crea la tabla e inserta. Configurar una fuente ClickHouse local en Grafana e importar **`grafana-tablero.json`** (panel + las variables `zona` y `sitio`, con multiselección y todos los valores), sustituyendo `${DS_CLICKHOUSE}` por el UID real. `grafana-panel.json` es solo el panel, por si se quiere pegar en un tablero existente; sin las dos variables su SQL no interpola y el panel sale vacío.

El score es `100 − 45·clamp((p95−20)/180) − 35·(NXDOMAIN%/100) − 20·clamp(qps/capacidad)`, con clamp en [0,1]. Latencia se penaliza entre 20 y 200 ms; NXDOMAIN representa la fracción de fallos; saturación es utilización contra capacidad DECLARADA, no medida del servidor. Cada penalización se muestra en puntos junto al score. Ventanas QoE de un minuto por zona/sitio en operación (5 s en la demo, ver `VERIFICADO-QOE.md`); la última ventana parcial usa la duración completa y puede subestimar QPS. No se emiten ceros cuando no hay observaciones.

Latencia uniforme (base, dispersión en ms), NXDOMAIN Bernoulli y capacidad QPS: canal 190.14.* (18,22; 2%; 400); istmo 200.12.* (35,50; 5%; 300); pacífico 138.118.* (65,100; 10%; 200); otras (30,40; 4%; 300). Son nombres y perfiles ficticios, no geolocalización. Sitio es el resolutor observado. Toda fila simulada incluye `synthetic_fields: ["latency_ms","rcode"]`; los tres componentes permanecen visibles. Sustituir por dnstap para medir experiencia real.

## Aislamiento verificable

No hay API de IA en la nube. `caso.js` utiliza exclusivamente `core/runtime.js` y QVAC 0.18.2 sin proveedor delegado; envía solo familia y rasgos, sin IP ni dominio. El GGUF ya existente se enlaza en `infra/red/cache`; la configuración separada evita escribir en la caché compartida. `src/red/rendimiento-modelo.jsonl` registra el modo de ejecución y el backend efectivo.

```bash
bash infra/red/aislado.sh 2>&1 | tee infra/red/aislado-9sep.txt
```

Corre **productor y consumidor con explicación por QVAC** dentro de un namespace de red sin más interfaz que un loopback caído y sin rutas (`unshare --user --map-root-user --net`, sin root), y desde ese mismo namespace intenta salir a internet para mostrar que no puede. Salida del 9-sep en `aislado-9sep.txt`: 3 000 consultas, 44 alertas, 44 casos redactados por el modelo, `execution_mode: local`, `backend_actual: gpu`, y los dos `curl` fallando con código 7. Todo lo que carga un modelo va envuelto en `flock /tmp/vigia-gpu.lock` porque la GPU se comparte con otros procesos de la máquina. `probar-aislado.sh` es la versión anterior y más corta: corre la suite de pruebas dentro del mismo namespace.

**Alcance honesto:** esto prueba que ESE proceso no tenía ruta de salida. NO prueba que toda la laptop tuvo cero egreso durante la demostración. Requiere namespaces de usuario habilitados y el modelo ya descargado; para reproducir en otra máquina, el script vuelve a escribir `qvac.local.config.json` con la ruta absoluta correcta y reenlaza el GGUF.

Para operación, aplicar el mismo aislamiento al proceso de inferencia y usar archivos montados para entrada/salida. Dentro del namespace de la prueba el loopback es otro, así que ni el ClickHouse ni la API de Wazuh del host son alcanzables desde ahí: en producción van en el mismo namespace, o un proceso local separado importa el SQL. El aislamiento de Wazuh/Grafana y su red Docker debe configurarse también: precargar imágenes, red `internal: true`, eliminar salidas externas y exponer el panel solo a la LAN autorizada.
