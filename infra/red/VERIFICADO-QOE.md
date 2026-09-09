# El score de experiencia llega a ClickHouse y a Grafana (9-sep-2026, 15:20)

La segunda salida que pide Ovnicom es «un score de calidad de experiencia por zona o punto de
presencia… escrito en ClickHouse y visualizado en un dashboard Grafana». Se levantaron los dos y
se comprobó la cadena completa.

## Lo que se levantó

- **ClickHouse 24.8.14.39** en Docker, escuchando en `127.0.0.1:8123`.
- **Grafana 11.3.0** con el conector `grafana-clickhouse-datasource`, en `127.0.0.1:3001`.

Todo con `infra/red/levantar.sh`.

## La cadena, de punta a punta

```bash
CLICKHOUSE_LOCAL=1 node src/red/demo.js
#   consultas: 10480 · alertas: 153 · destino QoE: ClickHouse local
```

Lo que quedó en la tabla `red_qoe`, consultado con `SELECT … GROUP BY zona`:

| Zona | Score medio | Latencia p95 | NXDOMAIN |
|---|---|---|---|
| pacifico | 60.4 | 159.5 ms | 9.4 % |
| istmo | 80.3 | 82.4 ms | 4.9 % |
| otras | 87.1 | 66.1 ms | 3.6 % |
| canal | 90.2 | 39.0 ms | 2.2 % |

El score distingue las zonas y **se puede leer**: la peor tiene cuatro veces la latencia y cuatro
veces los NXDOMAIN de la mejor. Cada fila lleva además sus tres penalizaciones por separado
(latencia, NXDOMAIN y saturación), que es lo que permite a un operador saber **por qué** bajó,
no solo que bajó.

Grafana consulta esa tabla a través del conector. Comprobado por su propio API:

```bash
curl -s -X POST http://127.0.0.1:3001/api/ds/query -H 'content-type: application/json' \
  -d '{"queries":[{"refId":"A","datasource":{"type":"grafana-clickhouse-datasource","uid":"vigia-clickhouse"},
       "rawSql":"SELECT zona, round(avg(score),1) AS score FROM red_qoe GROUP BY zona ORDER BY score",
       "format":1,"queryType":"sql"}],"from":"now-1h","to":"now"}'
# → {"zona":["pacifico","istmo","otras","canal"],"score":[60.4,80.3,87.1,90.2]}
```

El tablero está importado en `http://127.0.0.1:3001/d/vigia-red`.

## Lo que hay que decir en voz alta

El registro DNS que entregó Ovnicom **solo trae consultas**: no tiene latencia ni códigos de
respuesta, que en el mundo real vendrían de dnstap. Así que esos dos campos se **generan** con
distribuciones declaradas por zona, y **cada fila los marca** en `synthetic_fields`. El título del
panel de Grafana también lo dice. Las consultas, los clientes y los tiempos sí son reales.
