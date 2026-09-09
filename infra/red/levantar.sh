#!/usr/bin/env bash
# Levanta el destino de las dos salidas del reto de Ovnicom: Wazuh para las alertas,
# ClickHouse + Grafana para el score de experiencia. Todo en esta máquina.
# Verificado el 9-sep-2026: ver VERIFICADO-WAZUH.md y VERIFICADO-QOE.md.
set -euo pipefail
DIR="${1:-/tmp/vigia-infra}"
mkdir -p "$DIR"

echo "▸ ClickHouse"
docker rm -f vigia-clickhouse >/dev/null 2>&1 || true
docker run -d --name vigia-clickhouse -p 8123:8123 --ulimit nofile=262144:262144 \
  -e CLICKHOUSE_SKIP_USER_SETUP=1 clickhouse/clickhouse-server:24.8 >/dev/null
until curl -sf "http://127.0.0.1:8123/?query=SELECT%201" >/dev/null; do sleep 2; done
echo "  listo en http://127.0.0.1:8123"

echo "▸ Grafana con el conector de ClickHouse"
mkdir -p "$DIR/grafana/datasources"
cat > "$DIR/grafana/datasources/clickhouse.yml" <<'YML'
apiVersion: 1
datasources:
  - name: ClickHouse
    uid: vigia-clickhouse
    type: grafana-clickhouse-datasource
    access: proxy
    jsonData: { host: 172.17.0.1, port: 8123, protocol: http, secure: false, username: default }
YML
docker rm -f vigia-grafana >/dev/null 2>&1 || true
docker run -d --name vigia-grafana -p 3001:3000 \
  -e GF_INSTALL_PLUGINS=grafana-clickhouse-datasource \
  -e GF_AUTH_ANONYMOUS_ENABLED=true -e GF_AUTH_ANONYMOUS_ORG_ROLE=Admin \
  -v "$DIR/grafana/datasources:/etc/grafana/provisioning/datasources" \
  grafana/grafana:11.3.0 >/dev/null
until curl -sf http://127.0.0.1:3001/api/health >/dev/null; do sleep 3; done
echo "  listo en http://127.0.0.1:3001"

echo "▸ Wazuh (un solo nodo)"
echo "  vm.max_map_count actual: $(sysctl -n vm.max_map_count) (hace falta 262144 o más)"
if [ ! -d "$DIR/wazuh-docker" ]; then
  git clone --depth 1 -b v4.14.0 https://github.com/wazuh/wazuh-docker.git "$DIR/wazuh-docker"
  # El panel viene en el 443; aquí lo ocupa Tailscale.
  sed -i 's/- 443:5601/- 8444:5601/' "$DIR/wazuh-docker/single-node/docker-compose.yml"
fi
cd "$DIR/wazuh-docker/single-node"
[ -f config/wazuh_indexer_ssl_certs/root-ca.pem ] || docker compose -f generate-indexer-certs.yml run --rm generator
docker compose up -d
echo "  panel en https://127.0.0.1:8444 (admin / SecretPassword)"

echo
echo "▸ Ahora, desde la raíz del repositorio:"
echo "   docker cp infra/red/local_rules.xml single-node-wazuh.manager-1:/var/ossec/etc/rules/local_rules.xml"
echo "   docker exec single-node-wazuh.manager-1 /var/ossec/bin/wazuh-control restart"
echo "   CLICKHOUSE_LOCAL=1 node src/red/demo.js"
echo "   docker cp infra/red/salida/alertas.jsonl single-node-wazuh.manager-1:/var/log/vigia/alertas.jsonl"
