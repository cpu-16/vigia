#!/usr/bin/env bash
# Sin interfaces externas ni ruta de salida. Reutiliza el GGUF local, no lo descarga.
set -euo pipefail
cd "$(dirname "$0")/../.."
export QVAC_CONFIG_PATH="$PWD/infra/red/qvac.local.config.json"
export GGML_VK_VISIBLE_DEVICES=1 PRUEBA_MODELO=1
export RENDIMIENTO="$PWD/src/red/rendimiento-modelo.jsonl"
unshare --user --map-root-user --net bash -c '
  readlink /proc/self/ns/net > infra/red/aislamiento-rutas.txt
  cat /proc/net/dev /proc/net/route >> infra/red/aislamiento-rutas.txt
  node --test src/red/red.test.js
'
