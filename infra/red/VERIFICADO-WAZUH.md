# Las alertas llegan a Wazuh de verdad (9-sep-2026, 15:10)

El jurado de Ovnicom dice que va a mirar «que las alertas lleguen a Wazuh en un formato que el
SIEM pueda procesar». Esto no es una afirmación de diseño: se levantó un Wazuh real y se
comprobó de las dos maneras.

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

## Prueba 2: el flujo completo, con el tráfico real del patrocinador

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

Ejemplo de una alerta ya procesada por el SIEM, con nuestros campos disponibles para el operador:

```
regla 100104 · nivel 10
Vigía: periodicidad sospechosa en pulso-control.example, cliente 192.0.2.43
familia: beacon · dominio: pulso-control.example · score: 0.85
```

## Lo que esto NO prueba

- No se midió el rendimiento de ingesta del SIEM bajo carga sostenida; se probó el camino y el
  formato.
- El panel responde en `https://localhost:8444` pero las capturas del tablero quedan pendientes.
- ClickHouse y Grafana para el score de experiencia todavía no se levantaron: hoy el score se
  escribe a un archivo SQL local.
