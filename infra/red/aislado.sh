#!/usr/bin/env bash
# Prueba aislada del agente Red: productor y consumidor, con explicación por QVAC,
# dentro de un namespace de red sin más interfaz que loopback. Desde ese mismo
# namespace se intenta salir a internet para mostrar que no hay por dónde.
#
# ALCANCE: prueba que ESTE proceso no tenía ruta de salida. NO prueba que toda la
# laptop tuvo cero egreso durante la demostración.
#
#   bash infra/red/aislado.sh 2>&1 | tee infra/red/aislado-9sep.txt
#
# La GPU se comparte con otros procesos de la máquina: todo lo que carga un modelo va
# envuelto en flock, una prueba con modelo a la vez. Si el lock está tomado, espera.
set -euo pipefail

if [ "${1:-}" = "--dentro" ]; then
  echo "== namespace de red =="
  readlink /proc/self/ns/net
  ip -o link show
  echo "-- rutas IPv4 --"; ip route show; echo "-- rutas IPv6 --"; ip -6 route show
  echo "(sin líneas arriba = sin rutas: nada que enrutar fuera de este namespace)"
  echo "-- /proc/net/route --"; cat /proc/net/route
  echo
  echo "== agente Red dentro del namespace: productor | consumidor, con QVAC local =="
  node src/red/productor.js --perfil 800 --max 3000 --ataques 20 --velocidad 5 \
    | MODELO=1 node src/red/demo.js --stdin
  echo
  echo "== control: intento de salida a internet DESDE EL MISMO namespace =="
  set +e
  curl -m 5 -sS https://example.com >/dev/null; echo "curl https://example.com → código de salida $?"
  curl -m 5 -sS https://1.1.1.1 >/dev/null; echo "curl https://1.1.1.1 (sin DNS) → código de salida $?"
  echo
  echo "== registro de rendimiento: carga del modelo y últimas dos inferencias =="
  echo "   (execution_mode 'local' = el modelo corrió aquí; 'delegated' sería en otro par)"
  python3 - "${RENDIMIENTO:-/dev/null}" <<'PY' || true
import sys, json
filas=[json.loads(l) for l in open(sys.argv[1])] if len(sys.argv)>1 else []
cargas=[f for f in filas if f.get('stage')=='load']
inferencias=[f for f in filas if f.get('stage')=='completion']
campos=["stage","model","execution_mode","backend_actual","status","load_ms","end_to_end_ms","output_tokens","fallback_a_local","provider"]
for f in cargas[-1:]+inferencias[-2:]:
    print({k:f.get(k) for k in campos if k in f})
PY
  exit 0
fi

cd "$(dirname "$0")/../.."
RAIZ="$PWD"
MODELO_GGUF="${GGUF_QWEN3_1_7B:-$HOME/.qvac/models/f7cce66406dee646_Qwen3-1.7B-Q4_0.gguf}"
[ -f "$MODELO_GGUF" ] || { echo "Falta el GGUF ya descargado: $MODELO_GGUF" >&2; exit 1; }
# Caché propia con el modelo enlazado: dentro del namespace no hay red para descargarlo.
mkdir -p infra/red/cache infra/red/salida/aislado
ln -sfn "$MODELO_GGUF" "infra/red/cache/$(basename "$MODELO_GGUF")"
printf '{"loggerLevel":"error","loggerConsoleOutput":false,"cacheDirectory":"%s/infra/red/cache"}\n' "$RAIZ" > infra/red/qvac.local.config.json
export QVAC_CONFIG_PATH="$RAIZ/infra/red/qvac.local.config.json"
export GGUF_QWEN3_1_7B="$MODELO_GGUF"
export RENDIMIENTO="$RAIZ/src/red/rendimiento-modelo.jsonl"
export SALIDA="$RAIZ/infra/red/salida/aislado"
# Sin API ni ClickHouse: dentro del namespace el loopback es otro, y el punto es que el
# agente completa su trabajo (detectar + explicar) sin ningún destino de red.
unset WAZUH_API_URL WAZUH_API_USER WAZUH_API_PASS CLICKHOUSE_LOCAL
rm -f "$SALIDA"/alertas.jsonl "$SALIDA"/casos.jsonl "$SALIDA"/qoe.jsonl "$SALIDA"/qoe.sql
echo "fecha: $(date -Is) · host: $(hostname) · node $(node -v)"
echo "modelo: $MODELO_GGUF"
echo "esperando el lock de GPU /tmp/vigia-gpu.lock (una prueba con modelo a la vez)…"
exec flock /tmp/vigia-gpu.lock unshare --user --map-root-user --net bash "$0" --dentro
