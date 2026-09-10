#!/usr/bin/env bash
# Paquete de fuente reproducible; NO incluye pesos, claves, consultas ni node_modules.
set -euo pipefail
BASE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
DESTINO=${1:-/tmp/vigia-sucursal-local.tar.gz}
STAGE=$(mktemp -d /tmp/vigia-sucursal-paquete.XXXXXX)
mkdir -p "$STAGE/vigia-local/src/puente" "$STAGE/vigia-local/src/sucursal" "$STAGE/vigia-local/fixtures/sucursal" "$STAGE/vigia-local/docs" "$STAGE/vigia-local/app"
cp "$BASE/src/puente/sucursal-local.js" "$BASE/src/puente/sucursal-local.html" "$BASE/src/puente/sucursal-local-worker.cjs" "$BASE/src/puente/sucursal-local.test.js" "$BASE/src/puente/pwa.test.js" "$STAGE/vigia-local/src/puente/"
cp "$BASE/src/puente/sucursal-local.webmanifest" "$BASE/src/puente/sucursal-local-sw.js" "$STAGE/vigia-local/src/puente/"
cp "$BASE/app/pwa.js" "$BASE/app/pwa-cache.js" "$BASE/app/icono.svg" "$BASE/app/icono-192.png" "$BASE/app/icono-512.png" "$STAGE/vigia-local/app/"
cp "$BASE/src/sucursal/guia.js" "$STAGE/vigia-local/src/sucursal/"
cp "$BASE/fixtures/sucursal/guia-bpl.md" "$STAGE/vigia-local/fixtures/sucursal/"
cp "$BASE/docs/SUCURSAL-LOCAL-TERMUX.md" "$STAGE/vigia-local/docs/"
printf '%s\n' '{"name":"vigia-sucursal-local","private":true,"type":"module","engines":{"node":">=22"},"scripts":{"start":"node src/puente/sucursal-local.js","test":"node --test src/puente/*.test.js"}}' > "$STAGE/vigia-local/package.json"
tar --sort=name --mtime='UTC 2026-09-10' --owner=0 --group=0 --numeric-owner -czf "$DESTINO" -C "$STAGE" vigia-local
sha256sum "$DESTINO"
