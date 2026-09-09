# Red de Vigía — 9 de septiembre de 2026

El consumidor recibe un `AsyncIterable` de eventos normalizados: suscribirlo con un grupo propio al bus del patrocinador. No publica ni modifica el pipeline. `reproducir` procesa BIND línea por línea y aplica el reloj del log dividido por velocidad. No es un análisis en lote. Las dos salidas salen de `consumir`: JSONL para Wazuh y filas QoE para ClickHouse. El adaptador concreto del broker queda pendiente de conocer protocolo y credenciales locales.

Desde la raíz de hackpty:

```bash
node --test src/red/
node src/red/demo.js
# Con ClickHouse atendiendo en loopback:
CLICKHOUSE_LOCAL=1 node src/red/demo.js
```

La demo usa el fragmento autorizado del patrocinador: perfila 4000 consultas y reproduce las siguientes, mezcladas con 480 consultas maliciosas sintéticas. Guarda `infra/red/salida/alertas.jsonl`, `qoe.jsonl` y, sin ClickHouse, `qoe.sql`. Para otro archivo: `VELOCIDAD=60 node src/red/demo.js /ruta/al/query-log`. La salida es solo-agregar; cada ejecución suma filas.

`consumir(flujo, { listaBlanca, archivoAlertas, guardarQoe })` permite conectarlo al bus. `Detector.candidatos` expone la zona gris de periodicidad (CV entre 0,12 y 0,25); `desempatar` devuelve una opinión cerrada para revisión humana, sin convertirla en alerta automáticamente. La lista blanca debe construirse con una muestra previa confiable y permanecer congelada. Las alertas se escriben inmediatamente; una misma familia/cliente/SLD se silencia por cinco minutos. Para explicaciones opcionales, pasar `modelo` ya cargado y `archivoCasos`: se guardan aparte, con backpressure y respaldo determinista si falla la inferencia. Esta modalidad necesita retención en el bus; no está dimensionada para invocar QVAC por cada consulta.

## Wazuh single-node con Docker

Procedimiento basado en la [guía oficial de despliegue](https://documentation.wazuh.com/current/deployment-options/docker/wazuh-container.html) y la [sintaxis oficial de reglas](https://documentation.wazuh.com/current/user-manual/ruleset/ruleset-xml-syntax/rules.html). No se levantó el SIEM durante esta entrega.

Preparación en el host de demostración (requiere Docker Compose y permisos administrativos):

```bash
sudo sysctl -w vm.max_map_count=262144
cd infra/red
# Fijar un tag de Wazuh aprobado para el entorno antes de desplegar.
git clone https://github.com/wazuh/wazuh-docker.git
cd wazuh-docker/single-node
docker compose -f generate-indexer-certs.yml run --rm generator
```

Antes de `compose up`, ajustar usuarios y contraseñas de demostración en la configuración del stack. Montar el directorio absoluto `hackpty/infra/red/salida` en el servicio `wazuh.manager` como `/var/log/vigia:ro`; el archivo debe existir antes de iniciar y ser legible por el manager. Montar también `infra/red/local_rules.xml` como `/var/ossec/etc/rules/vigia_red.xml:ro`. En `config/wazuh_cluster/wazuh_manager.conf`, insertar el fragmento `ossec-localfile.xml` DENTRO de `<ossec_config>`, conservando el resto de la configuración.

```bash
docker compose up -d
docker compose exec wazuh.manager /var/ossec/bin/wazuh-logtest
```

Pegar una línea de `alertas.jsonl` en `wazuh-logtest`: debe decodificarse como JSON y disparar 100101 (DGA, nivel 10), 100102 (typosquat, nivel 7), 100103 (túnel, nivel 12) o 100104 (beacon, nivel 10). Revisar IDs para evitar colisión con reglas existentes. Luego ejecutar nuevamente la demo para que haya líneas NUEVAS después del arranque. Comprobar `/var/ossec/logs/alerts/alerts.json` y abrir el dashboard HTTPS del host; en eventos de seguridad buscar `rule.groups:vigia_red` o `data.integration:vigia-red`. Usar rango absoluto del 9-sep-2026 si se filtra por tiempo original del DNS. El momento de ingesta del SIEM puede ser el actual.

## QoE y Grafana

`qoe.js` exporta el DDL, `insertar(filas)` y el escritor HTTP exclusivo a `127.0.0.1:8123`. La demo con `CLICKHOUSE_LOCAL=1` crea la tabla e inserta. Configurar una fuente ClickHouse local en Grafana e importar `grafana-panel.json` como panel. Sustituir `${DS_CLICKHOUSE}` por el UID real. Agregar variables de consulta `zona` (`SELECT DISTINCT zona FROM red_qoe`) y `sitio` (`SELECT DISTINCT sitio FROM red_qoe`), con multiselección y todos los valores.

El score es `100 − 45·clamp((p95−20)/180) − 35·(NXDOMAIN%/100) − 20·clamp(qps/capacidad)`, con clamp en [0,1]. Latencia se penaliza entre 20 y 200 ms; NXDOMAIN representa la fracción de fallos; saturación es utilización contra capacidad DECLARADA, no medida del servidor. Cada penalización se muestra en puntos junto al score. Ventanas QoE de un minuto por zona/sitio; la última ventana parcial usa el minuto completo y puede subestimar QPS. No se emiten ceros cuando no hay observaciones.

Latencia uniforme (base, dispersión en ms), NXDOMAIN Bernoulli y capacidad QPS: canal 190.14.* (18,22; 2%; 400); istmo 200.12.* (35,50; 5%; 300); pacífico 138.118.* (65,100; 10%; 200); otras (30,40; 4%; 300). Son nombres y perfiles ficticios, no geolocalización. Sitio es el resolutor observado. Toda fila simulada incluye `synthetic_fields: ["latency_ms","rcode"]`; los tres componentes permanecen visibles. Sustituir por dnstap para medir experiencia real.

## Aislamiento verificable

No hay API de IA en la nube. `caso.js` utiliza exclusivamente `core/runtime.js` y QVAC 0.18.2 sin proveedor delegado; envía solo familia y rasgos, sin IP ni dominio. El GGUF ya existente se enlaza en `infra/red/cache`; la configuración separada evita escribir en la caché compartida. `src/red/rendimiento-modelo.jsonl` registra el backend efectivo (esta máquina reportó CPU).

```bash
bash infra/red/probar-aislado.sh
```

El script ejecuta la prueba real dentro de un namespace Linux sin interfaces externas ni rutas; guardar su salida en `infra/red/prueba-aislada.txt`. `aislamiento-rutas.txt` permite comprobar la ausencia de rutas. Esto restringe también cualquier intento P2P del SDK. Requiere namespaces de usuario habilitados y modelo ya descargado. Para reproducir en otra máquina, actualizar la ruta absoluta de `qvac.local.config.json` y enlazar el GGUF local con el nombre cacheado; no descargar durante la evaluación.

Para operación, aplicar igual aislamiento al proceso de inferencia y usar archivos montados para entrada/salida. Wazuh lee el JSONL desde su propia red interna. ClickHouse debe correr en el mismo namespace con loopback habilitado, o un proceso local separado importa el SQL. No se puede acceder al ClickHouse del host desde el namespace aislado de la prueba. El aislamiento de Wazuh/Grafana y su red Docker debe configurarse también: precargar imágenes, red `internal: true`, eliminar salidas externas y exponer el dashboard solo a la LAN autorizada. El despliegue Docker, la ingesta SIEM y la visualización real permanecen por verificar; el archivo local no equivale a una alerta ya recibida por el dashboard.
