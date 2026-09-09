# Red — construido el 9 de septiembre de 2026

Implementado: parser BIND9, replay temporal y mezcla etiquetada; consumidor AsyncIterable;
ventanas por cliente/SLD; lista blanca aprendida; cuatro reglas; QVAC local para casos;
JSONL Wazuh, reglas XML, QoE interpretable, escritor ClickHouse y panel Grafana.
Demo: `node src/red/demo.js`; pruebas: `node --test src/red/`.

Medición por CONSULTA, incluidos los primeros eventos antes de completar la ventana:
4000 líneas para lista blanca; otras 10000 para evaluación; 120 inyectadas por familia.
Semillas 20260909–20260912; ventana 300 s; lista blanca hasta 100 SLD, mínimo 5 clientes.
El supuesto «benigno» proviene del perfilado entregado, no de una auditoría independiente.

| Detector | TP / FP / FN | Precisión | Recall | FP / 10000 benignas |
|---|---|---|---|---|
| DGA | 101 / 18 / 19 | 84,87% | 84,17% | 18 |
| Typosquat | 120 / 0 / 0 | 100% | 100% | 0 |
| Túnel | 113 / 0 / 7 | 100% | 94,17% | 0 |
| Beacon | 113 / 84 / 7 | 57,36% | 94,17% | 84 |

No se ocultaron FP: la periodicidad benigna limita mucho beaconing; NO prueba C2.
Las métricas evalúan cada regla por separado, sin el silenciamiento de alertas de la demo.
Demo combinada: 10480 eventos, 153 alertas locales, 25 filas QoE; velocidad 6000.
Evento recibido → append JSONL: mediana 0,470 ms; p95 0,752 ms; máximo 1,702 ms.
Son 153 mediciones locales, sin espera de ventana, inferencia ni transporte/ingesta SIEM.

Pruebas puras y reales: ver infra/red/pruebas-puras.txt y prueba-aislada.txt.
QVAC 0.18.2, Qwen3-1.7B: seis casos y un desempate ejecutados; cifras verificadas 6/6.
El SDK reportó backend CPU pese a solicitar GPU; inferencias de caso alrededor de 1,4–1,6 s.
Los códigos elegidos y uso de respaldo quedan en resultado-modelo.json: no ocultar desaciertos.
Prueba real repetida en namespace sin rutas externas; evidencia en infra/red/aislamiento-rutas.txt.

Real: fragmento BIND9 del patrocinador, IP, dominio, tipo, resolutor y timestamps (UTC−5 supuesto).
Sintético: ataques etiquetados, marcas, nombres/perfiles de zonas, latency_ms y rcode.
Cada fila QoE marca ambos campos; capacidad QPS declarada, no saturación del servidor medida.

Pendiente: broker concreto; verificar Wazuh/logtest/dashboard y ClickHouse/Grafana levantados;
dnstap para QoE real; corpus benigno auditado más amplio y bajar FP de periodicidad/DGA.
SLD usa sufijos frecuentes, no PSL completa; whitelist puede ocultar abuso de CDN permitidos.
Memoria acotada: máximo 100000 eventos por ventana; al exceder falla explícitamente.
La explicación opcional aplica backpressure; dimensionar cola y retención antes de producción.
Rangos de zona no equivalen a geolocalización. No se hicieron commits desde esta tarea.
