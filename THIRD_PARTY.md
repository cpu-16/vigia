# Componentes de terceros

## SDK

| Paquete | Versión | Licencia | Uso |
|---|---|---|---|
| `@qvac/sdk` | **0.18.2** (fijada) | ver paquete | Toda la inferencia: LLM, ASR, visión, embeddings, delegación P2P |

### Pila P2P que arrastra el SDK (Holepunch / Pear)

Se declaran porque son el transporte real de la delegación entre pares, no un detalle interno:
el nodo que presta cómputo se anuncia y se encuentra por llave pública en este DHT.

| Paquete | Versión | Licencia |
|---|---|---|
| `hyperswarm` | 4.17.0 | MIT |
| `hyperdht` | 6.34.0 | MIT |
| `hyperdrive` | 13.3.3 | Apache-2.0 |
| `hypercore` | 11.35.2 | MIT |
| `corestore` | 7.12.2 | MIT |
| `hyperbee` | 2.27.3 | MIT |

## Modelos

Se declaran con el nombre exacto de la constante del SDK, cuantización y hardware donde se
ejecutan en las demostraciones. Se completa a medida que cada módulo los incorpora.

| Constante del SDK | Modelo | Cuantización | Dónde corre |
|---|---|---|---|
| `QWEN3_1_7B_INST_Q4` | Qwen3-1.7B Instruct | Q4_0 | Laptop (RTX 4060, Vulkan) como nodo y como proveedor P2P; Mac (M5 Max, Metal) como proveedor P2P en otra casa |
| `QWEN3_600M_INST_Q4` | Qwen3-0.6B Instruct | Q4_0 | Teléfono (HONOR X6s, CPU Cortex-A53) como respaldo a bordo; hoy no carga en ese aparato, ver `evidencia/medicion-telefono-9sep.md` |
| `WHISPER_LARGE_V3_TURBO` | Whisper large-v3 turbo | — | Laptop (RTX 4060) |
| `EMBEDDINGGEMMA_300M_Q8_0` | EmbeddingGemma 300M | Q8_0 | Laptop; recuperación semántica de la guía de sucursal |
| `VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` + `MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0` | VisionPsy Nano 460M (Apache 2.0, familia Psy de QVAC) | Q8_0 | Laptop (RTX 4060, Vulkan); transcribe la placa en el track 02 |

## Hardware declarado

| Nodo | Equipo | Rol |
|---|---|---|
| Laptop | Fedora Linux, Intel + NVIDIA RTX 4060 8 GB (Vulkan), 31 GB RAM, Node 24.14.1 | Nodo de sitio, proveedor P2P para el teléfono, consumidor P2P de la Mac |
| Teléfono | HONOR X6s, Android 14, 3.7 GB RAM, 8× Cortex-A53 | Captura; SDK local por Termux (Bare) |
| Nodo remoto | MacBook Pro, Apple M5 Max (18 núcleos, GPU de 40), 128 GB, macOS 26.4, Metal, Node 24.14.1, en otra casa | Proveedor P2P del producto (`src/puente/proveedor.js`, Qwen3-1.7B), solo para el módulo Equipos |

## Otros

| Componente | Versión | Licencia | Uso |
|---|---|---|---|
| Wazuh (gestor, indexador y panel, imágenes oficiales en Docker) | 4.14.0 | GPLv2 | SIEM real que recibe las alertas del módulo Red (`infra/red/`) |
| ClickHouse (imagen oficial en Docker) | 24.8 | Apache 2.0 | Tabla `red_qoe` con el score de experiencia por zona |
| Grafana + `grafana-clickhouse-datasource` (Docker) | 11.3 | AGPLv3 / Apache 2.0 | Tablero `vigia-red` del score por zona |
| Registro DNS de BIND9 entregado por Ovnicom para el reto | 8–9 sep 2026 | del patrocinador, declarado sintético por el reto | Entrada del módulo Red; los ataques, la latencia y los códigos de respuesta se generan y se marcan |
| Placas sintéticas | `fixtures/placas/generar.py` | propias | Track 02; marcas y modelos ficticios del brief de Philips |
| Fotos del catálogo de equipos (14 archivos `app/catalogo-*.jpg`) | Wikimedia Commons, descargadas el 8-sep 2026 | CC0, dominio público, CC BY 4.0 y CC BY-SA 2.0/3.0/4.0 según el archivo | Foto ilustrativa de la modalidad en `app/catalogo.html`; los equipos son ficticios y la foto no es del equipo. Título, autor, licencia y URL de cada una en `app/catalogo-FUENTES.json` |
