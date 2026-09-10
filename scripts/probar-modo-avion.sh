#!/usr/bin/env bash
# Prueba de inferencia a bordo con el teléfono en modo avión.
# El teléfono queda sin radios: lo único que puede responder es el modelo que tiene adentro.
# adb sigue vivo porque va por el cable USB, no por la red.
set -uo pipefail
T="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p 8022 127.0.0.1"
OUT="${1:-/tmp/modo-avion.txt}"
: > "$OUT"
di() { echo "$@" | tee -a "$OUT"; }

di "== $(date -Is) =="
adb forward tcp:8022 tcp:8022 >/dev/null

di "-- modo avión ON --"
adb shell cmd connectivity airplane-mode enable
sleep 6
di "airplane_mode_on = $(adb shell settings get global airplane_mode_on | tr -d '\r')"
di "wifi = $(adb shell settings get global wifi_on | tr -d '\r')"

# Control: el teléfono no alcanza internet. Si esto responde, la prueba no vale.
di "-- ¿hay red? (debe fallar) --"
$T 'ping -c 2 -W 3 1.1.1.1 2>&1 | tail -3; echo "curl_http=$(curl -s -m 8 -o /dev/null -w "%{http_code}" https://example.com 2>&1)"' 2>&1 | tee -a "$OUT"

di "-- inferencia a bordo (bare + @qvac/llm-llamacpp, backends solo CPU) --"
$T 'cd ~/qvac-app && rm -f qvac-direct-result.txt && LD_LIBRARY_PATH=$PREFIX/lib timeout 300 bare FUNCIONA.cjs; echo "exit=$?"; grep -E "^(LOAD_OK_MS|ANSWER|RUN_MS|STATS|ERROR|SUCCESS)" qvac-direct-result.txt' 2>&1 | tee -a "$OUT"

di "-- estado de la máquina durante la prueba --"
$T 'free -m 2>/dev/null | head -2; getprop ro.product.model; uptime 2>/dev/null' 2>&1 | tee -a "$OUT"

di "== fin $(date -Is) =="
echo "evidencia en $OUT"
