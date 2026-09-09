# Las alertas llegan a Wazuh de verdad (9-sep-2026, 15:10 y 16:13)

El jurado de Ovnicom dice que va a mirar «que las alertas lleguen a Wazuh en un formato que el
SIEM pueda procesar», y el reto pide «envío de la alerta a Wazuh **por webhook o API local**».
Esto no es una afirmación de diseño: se levantó un Wazuh real y se comprobó de tres maneras.

Sobre los datos: donde antes decía «tráfico real del patrocinador» ahora dice lo correcto —
**registro DNS entregado por Ovnicom para el reto** (el reto declara que los datos suministrados
son sintéticos; el archivo viene en formato de query log de BIND9). Los ataques los inyecta
`fixtures/red/inyector.js`, etiquetados y deterministas por semilla.

## Lo que se levantó

Wazuh **4.14.0** en Docker, un solo nodo (gestor, indexador y panel), en la misma laptop.

```bash
git clone --depth 1 -b v4.14.0 https://github.com/wazuh/wazuh-docker.git
cd wazuh-docker/single-node
docker compose -f generate-indexer-certs.yml run --rm generator
docker compose up -d
```

Dos cosas que hay que saber antes:

- `vm.max_map_count` debe ser 262144 o más. En esta laptop ya estaba en 1 048 576.
- El panel viene mapeado al **puerto 443**, que aquí lo ocupa Tailscale. Se cambió a **8444**
  (`- 8444:5601` en `docker-compose.yml`).

## Prueba 1: la regla dispara en el motor real

Se copió `infra/red/local_rules.xml` a `/var/ossec/etc/rules/local_rules.xml` en el gestor y se
reinició. Después se le pasó una alerta nuestra al comprobador de reglas de Wazuh:

```bash
echo '<una alerta de las nuestras>' | docker exec -i single-node-wazuh.manager-1 \
  /var/ossec/bin/wazuh-logtest -v
```

Resultado:

```
	Trying rule: 100103 - Vigía: posible túnel DNS en $(domain), cliente $(client_ip)
		*Rule 100103 matched
**Phase 3: Completed filtering (rules).
	id: '100103'
	level: '12'
	description: 'Vigía: posible túnel DNS en mfzwi23dnbqq.tunel-demo.net, cliente 190.14.210.226'
	groups: '['vigia_red']'
**Alert to be generated.
```

El SIEM decodifica el JSON, encuentra los campos e interpola el dominio y el cliente en la
descripción que ve el operador.

## Prueba 2: el flujo completo por el lector de archivo del agente

Se añadió al `ossec.conf` del gestor el bloque de `infra/red/ossec-localfile.xml`, se corrió el
agente sobre el registro DNS entregado por Ovnicom y se le dieron sus alertas al gestor.

| Regla | Nivel | Alertas | Qué es |
|---|---|---|---|
| 100101 | 10 | 125 | Posible DGA |
| 100102 | 7 | 12 | Posible suplantación (typosquatting) |
| 100103 | 12 | 1 | Posible túnel DNS |
| 100104 | 10 | 15 | Periodicidad sospechosa (beaconing) |
| | | **153** | **de 153 que emitió el agente** |

Las 153 alertas que produjo el agente fueron procesadas por Wazuh, ninguna se cayó. Se
comprueban en `/var/ossec/logs/alerts/alerts.json` dentro del gestor:

```bash
docker exec single-node-wazuh.manager-1 grep -c vigia_red /var/ossec/logs/alerts/alerts.json
```

Esto demuestra **formato e ingesta**, pero el transporte es el `localfile` del agente de Wazuh,
no el webhook o API que pide el reto. Por eso la prueba 3.

## Prueba 3: por la API local del manager (el transporte que pide el reto)

Wazuh **sí** expone `POST /events` desde la 4.8 y en 4.14.0 viene habilitado sin tocar nada.
Credenciales del despliegue (`docker inspect single-node-wazuh.manager-1`): usuario `wazuh-wui`,
`API_PASSWORD`. La API está en `https://127.0.0.1:55000` con certificado autofirmado.

```bash
TOKEN=$(curl -sk -u 'wazuh-wui:<API_PASSWORD>' \
  -X POST "https://127.0.0.1:55000/security/user/authenticate?raw=true")

curl -sk -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -X POST "https://127.0.0.1:55000/events" \
  -d '{"events":["{\"integration\":\"vigia-red\",\"family\":\"tunnel\", … }"]}'
```

```
{"data": {"affected_items": [...], "total_affected_items": 1, "total_failed_items": 0,
 "failed_items": []}, "message": "All events were forwarded to analisysd", "error": 0}
HTTP 200
```

La alerta aparece en `alerts.json` con **`"location": "API-Webhook"`** y disparando la misma
regla 100103 de la prueba 1. Es decir: el mismo formato entra por los dos transportes.

### Los dos límites que hay que conocer (medidos, no supuestos)

| Límite | Valor | Cómo se comprobó |
|---|---|---|
| Eventos por petición | **100** | 100 → HTTP 200; 101 → HTTP 400 `Events bulk size exceeded` |
| Peticiones por minuto a `/events` | **30** | Un POST por alerta devuelve HTTP 429 `Maximum number of requests per minute reached` (error 6005). El valor está fijo en el middleware del manager: `MAX_REQUESTS_EVENTS_DEFAULT = 30` en `api/middlewares.py`; no se configura desde `api.yaml` |
| Vida del token JWT | **900 s** | Campos `nbf`/`exp` del token |

Por eso `consumir()` **agrupa**: hasta 100 alertas o 2,5 segundos, lo que ocurra primero (24
peticiones por minuto, techo de 2 400 alertas por minuto). Un 429 no pierde la alerta: el lote
vuelve a la cola y el siguiente intento espera más. El JSONL local se escribe siempre, antes de
cualquier envío, y es el respaldo si la API no responde.

### La corrida completa por API, con el stream de dos procesos

```bash
export WAZUH_API_URL=https://127.0.0.1:55000 WAZUH_API_USER=wazuh-wui WAZUH_API_PASS=…
export CLICKHOUSE_LOCAL=1 VENTANA_QOE_MS=5000
node src/red/productor.js --velocidad 1 | node src/red/demo.js --stdin
```

Antes y después, en el gestor:

```bash
docker exec single-node-wazuh.manager-1 grep -c vigia_red /var/ossec/logs/alerts/alerts.json
# antes 593 · después 743
```

| | Agente | Wazuh |
|---|---|---|
| Alertas | 150 | +150 en `alerts.json` |
| 100101 DGA | 125 | 125 |
| 100102 typosquat | 12 | 12 |
| 100103 túnel | 1 | 1 |
| 100104 beacon | 12 | 12 |
| `location` | — | `API-Webhook` en las 150 |

`"enviadas": 150, "fallidas": 0, "peticiones": 27, "reencolados_429": 0`. En el log de la API
del gestor, las 27 peticiones devolvieron 200 y le tomaron entre **6 y 30 ms** (mediana 13 ms).

Latencias medidas en el agente, con su denominador:

| Medida | n | Mediana | Qué incluye |
|---|---|---|---|
| Evento recibido → línea en el JSONL | 150 | **1,08 ms** | Reglas y escritura local. No espera ventana, ni inferencia, ni SIEM |
| Evento recibido → HTTP 200 de la API | 150 | **1 175 ms** | Lo anterior + la espera de agrupación (2,5 s) + el POST. La agrupación domina; el POST son 13 ms |

Ejemplo de una alerta ya procesada por el SIEM (captura en
`evidencia/capturas/red-wazuh-detalle.png`), con nuestros campos disponibles para el operador:

```
regla 100103 · nivel 12 · location API-Webhook · decoder json
Vigía: posible túnel DNS en jsnzjrnu3cr7…canal-prueba.example, cliente 192.0.2.42
data.family tunnel · data.score 0.95 · data.severity critica
data.evidence_longitud 54 · data.evidence_entropia 4.414029
data.evidence_proporcion_txt_null 1 · data.evidence_subdominios_unicos 8 · data.evidence_consultas 8
```

## Lo que esto NO prueba

- No se midió el rendimiento de ingesta del SIEM bajo carga sostenida; se probó el camino, el
  formato y los límites del endpoint con este volumen (150 alertas en 75 s).
- El conteo de 743 en el panel incluye **todas** las corridas de prueba del día, no solo la
  corrida documentada aquí. Lo que se afirma es el delta: 593 → 743.
- El certificado de la API es autofirmado y el cliente no lo valida; lo que sí se garantiza es
  el destino: `enviarApi()` rechaza cualquier host que no sea loopback (prueba en
  `src/red/stream.test.js`).
- Las alertas llevan IP de cliente y dominio. Eso es correcto para un SIEM local; si el SIEM
  estuviera fuera del datacenter, esto ya sería una fuga. Por eso el destino está fijado a
  loopback en el código y no solo en la configuración.
