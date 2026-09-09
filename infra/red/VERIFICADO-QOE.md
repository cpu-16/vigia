# El score de experiencia llega a ClickHouse y a Grafana (9-sep-2026, 15:20 y 16:20)

La segunda salida que pide Ovnicom es «un score de calidad de experiencia por zona o punto de
presencia… escrito en ClickHouse y visualizado en un dashboard Grafana». Se levantaron los dos y
se comprobó la cadena completa.

## Lo que se levantó

- **ClickHouse 24.8.14.39** en Docker, escuchando en `127.0.0.1:8123`.
- **Grafana 11.3.0** con el conector `grafana-clickhouse-datasource`, en `127.0.0.1:3001`.

Todo con `infra/red/levantar.sh`.

## La cadena, de punta a punta

```bash
export CLICKHOUSE_LOCAL=1 VENTANA_QOE_MS=5000
node src/red/productor.js --velocidad 1 | node src/red/demo.js --stdin
#   consultas: 10390 · alertas: 150 · destino QoE: ClickHouse local
```

Lo que quedó en la tabla `red_qoe`: **54 filas** en 64 segundos de registro, 10 por zona,
consultado con `SELECT … GROUP BY zona`:

| Zona | Score medio | Latencia p95 | NXDOMAIN | Pen. latencia | Pen. NXDOMAIN | Pen. saturación |
|---|---|---|---|---|---|---|
| pacifico | 60,1 | 159,3 ms | 9,4 % | 34,8 | 3,3 | 1,8 |
| istmo | 80,0 | 82,1 ms | 4,6 % | 15,5 | 1,6 | 2,9 |
| otras | 85,3 | 67,7 ms | 4,5 % | 11,9 | 1,6 | 1,2 |
| canal | 89,3 | 39,0 ms | 2,1 % | 4,8 | 0,7 | 5,2 |

El score distingue las zonas y **se puede leer**: la peor tiene cuatro veces la latencia y cuatro
veces los NXDOMAIN de la mejor. Cada fila lleva además sus tres penalizaciones por separado,
que es lo que permite a un operador saber **por qué** bajó, no solo que bajó. Ejemplo concreto:
`canal` es la zona con mejor score y sin embargo es la que más penalización de **saturación**
tiene (5,2 contra 1,8 de pacífico) — el operador ve al instante que el problema de una zona es de
capacidad y el de la otra es de latencia, sin abrir una consulta.

### La ventana

`consumir()` agrega por ventanas de **60 s** en operación. La demo usa **5 s**
(`VENTANA_QOE_MS=5000`) porque el registro entregado dura 65 segundos y con un minuto sale un
solo punto por zona, que no se puede leer en una gráfica. La tasa por segundo no cambia con la
ventana; lo que cambia es la resolución del gráfico.

## Grafana

El tablero completo está en `infra/red/grafana-tablero.json` (panel + las dos variables de
consulta `zona` y `sitio`) y se importa de una sola vez desde la UI o por API. **Corrección del
9-sep, 16:20:** el tablero que estaba cargado tenía el panel pero no las variables que su SQL
usa (`${zona}`, `${sitio}`), así que el panel decía «No data». Con las variables cargadas
renderiza; la captura está en `evidencia/capturas/red-grafana-qoe.png`.

Comprobado también por el API de Grafana:

```bash
curl -s -X POST http://127.0.0.1:3001/api/ds/query -H 'content-type: application/json' \
  -d '{"queries":[{"refId":"A","datasource":{"type":"grafana-clickhouse-datasource","uid":"vigia-clickhouse"},
       "rawSql":"SELECT zona, round(avg(score),1) AS score FROM red_qoe GROUP BY zona ORDER BY score",
       "format":1,"queryType":"sql"}],"from":"now-1h","to":"now"}'
```

El tablero está en `http://127.0.0.1:3001/d/vigia-red`. La captura usa el rango absoluto
2026-09-09 07:48:50–07:50:40 (hora de Panamá) porque los datos llevan la hora del registro DNS,
no la hora de ingesta.

## Lo que hay que decir en voz alta

El registro DNS que entregó Ovnicom **solo trae consultas**: no tiene latencia ni códigos de
respuesta, que en el mundo real vendrían de dnstap. Así que esos dos campos se **generan** con
distribuciones declaradas por zona, y **cada fila los marca** en `synthetic_fields`. El título del
panel de Grafana también lo dice, en mayúsculas.

Y sobre el resto de los campos: el reto declara que los datos suministrados son sintéticos. Lo
que se puede afirmar del archivo es que viene de Ovnicom para este reto, en formato de query log
de BIND9, y que **no se modificó**: las consultas, los clientes, los tipos y los tiempos son los
del archivo entregado. No son «tráfico real de clientes» y en ninguna parte se afirma que lo sean.

La saturación se calcula contra una capacidad **declarada** por zona, no medida en el servidor.
Los nombres de zona son ficticios y los rangos de IP no equivalen a geolocalización.
