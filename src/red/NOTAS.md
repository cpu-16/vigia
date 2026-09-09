# Red — construido el 9 de septiembre de 2026

Implementado: parser BIND9, replay temporal y mezcla etiquetada; productor y consumidor en
procesos separados unidos por una tubería; consumidor AsyncIterable; ventanas por cliente/SLD;
lista blanca aprendida; cuatro reglas; QVAC local para casos; alertas a Wazuh por su API local
(`POST /events`) con JSONL de respaldo, reglas XML, QoE interpretable, escritor ClickHouse y
tablero Grafana.
Demo en un proceso: `node src/red/demo.js`. Como flujo continuo, dos procesos:
`node src/red/productor.js --velocidad 1 | node src/red/demo.js --stdin`.
Pruebas: `node --test src/red/`.

## Procedencia de los datos

`fixtures/red/benigno.bind.log` es el **registro DNS entregado por Ovnicom para el reto** (el reto
lo declara sintético; formato de query log de BIND9), primeras 14 000 líneas sin modificar.
Del archivo entregado: IP, dominio, tipo, resolutor y marcas de tiempo (UTC−5 supuesto).
Nuestro: ataques etiquetados, marcas, nombres y perfiles de zona, `latency_ms` y `rcode`.
Cada fila QoE marca ambos campos; capacidad QPS declarada, no saturación del servidor medida.
El supuesto «benigno» proviene del perfilado entregado, no de una auditoría independiente.

## Métricas de detección

Medición por CONSULTA, incluidos los primeros eventos antes de completar la ventana:
4000 líneas para lista blanca; otras 10000 para evaluación; 120 inyectadas por familia.
Semillas 20260909–20260912; ventana 300 s; lista blanca hasta 100 SLD, mínimo 5 clientes.

| Detector | TP / FP / FN | Precisión | Recall | FP / 10000 benignas |
|---|---|---|---|---|
| DGA | 101 / 18 / 19 | 84,87% | 84,17% | 18 |
| Typosquat | 120 / 0 / 0 | 100% | 100% | 0 |
| Túnel | 113 / 0 / 7 | 100% | 94,17% | 0 |
| Beacon | 113 / 84 / 7 | 57,36% | 94,17% | 84 |

No se ocultaron FP: la periodicidad benigna limita mucho beaconing; NO prueba C2. Un FP real y
visible en la captura del panel: `go-updater.brave.com` clasificado como DGA.
Las métricas evalúan cada regla por separado, sin el silenciamiento de alertas de la demo.

## Corrida canónica del 9-sep (16:11), la del video

`productor --velocidad 1 | demo --stdin`, con `WAZUH_API_*`, `CLICKHOUSE_LOCAL=1` y
`VENTANA_QOE_MS=5000`. El productor inyecta 120 dga + 120 typosquat + 120 tunnel + 30 beacon
(beacon cada 2 s, para que quepa en los 65 s del registro; el banco de métricas de arriba usa
120 con periodo de 10 s).

- 10 390 consultas, **150 alertas** (dga 125, typosquat 12, túnel 1, beacon 12), 54 filas QoE.
- Wazuh: `grep -c vigia_red alerts.json` pasó de 593 a 743. Las 150 con `location: API-Webhook`
  y el mismo desglose por regla: 100101×125, 100102×12, 100103×1, 100104×12.
- API: 27 peticiones, 150 aceptadas, 0 fallidas, 0 reencoladas. El manager las sirvió en
  6–30 ms (mediana 13 ms).
- Evento recibido → línea en el JSONL: mediana **1,08 ms** (n=150). Sin espera de ventana,
  inferencia ni SIEM.
- Evento recibido → HTTP 200 de la API: mediana **1 175 ms** (n=150). Lo domina la agrupación
  de 2,5 s, no el transporte.

Límites del endpoint, medidos y no supuestos: 100 eventos por petición (101 → HTTP 400) y
30 peticiones por minuto a `/events` (un POST por alerta → HTTP 429; el valor está fijo en
`MAX_REQUESTS_EVENTS_DEFAULT` del middleware del manager, no se configura desde `api.yaml`).
Por eso el agente agrupa. Un 429 no pierde la alerta: reencola el lote y espera más.

## Modelo local

Pruebas puras y aisladas: ver `infra/red/pruebas-puras.txt`, `prueba-aislada.txt` y
`aislado-9sep.txt`.
QVAC 0.18.2, Qwen3-1.7B: en la prueba aislada del 9-sep el SDK reportó `backend_actual: gpu` y
`execution_mode: local`, con inferencias de caso alrededor de 0,55 s (una corrida anterior en
CPU dio 1,4–1,6 s). Los códigos elegidos y el uso de respaldo quedan en `resultado-modelo.json`
y en los casos de `infra/red/salida/aislado/casos.jsonl`: el modelo no siempre ancla su
elección, y cuando no lo hace se publica el resumen determinista. No se ocultan los desaciertos.

Corrida dentro del namespace sin rutas: 3 000 consultas, 44 alertas, 44 casos redactados,
y `curl` a internet fallando con código 7 desde el mismo namespace. Alcance: prueba que ESE
proceso no tenía por dónde salir; no que toda la laptop tuvo cero egreso.

## Pendiente y límites conocidos

Broker concreto (hoy la tubería local hace de transporte de demostración; el consumidor ya
recibe cualquier `AsyncIterable`, así que el adaptador Kafka es el único trabajo restante).
dnstap para QoE real; corpus benigno auditado más amplio y bajar FP de periodicidad/DGA.
SLD usa sufijos frecuentes, no PSL completa; la lista blanca puede ocultar abuso de CDN permitidos.
Memoria acotada: máximo 100000 eventos por ventana; al exceder falla explícitamente.
La explicación opcional aplica backpressure; dimensionar cola y retención antes de producción.
El certificado de la API del SIEM es autofirmado y el cliente no lo valida; lo que sí se
garantiza es el destino, fijado a loopback en `enviarApi()` y probado en `stream.test.js`.
Rangos de zona no equivalen a geolocalización.
