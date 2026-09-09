# Sucursal en GPU — medición del 9 de septiembre de 2026

Los 20 casos de `fixtures/sucursal/casos.json` contra el modelo real, con la guarda de alcance
que se agregó hoy a `src/sucursal/procedimiento.js`. Todo el contenido es sintético.

## Cómo se reproduce

```bash
flock /tmp/vigia-gpu.lock env QVAC_CONFIG_PATH=$PWD/evidencia/qvac.prueba.config.json \
  GGML_VK_VISIBLE_DEVICES=1 PRUEBA_MODELO=1 node --test src/sucursal/sucursal.test.js
```

`flock` no es adorno: la GPU la comparten otros procesos del proyecto y solo puede haber una
prueba con modelo a la vez.

## Hardware y modelo

| Qué | Valor |
|---|---|
| Tarjeta | NVIDIA RTX 4060 8 GB, backend **Vulkan** (`GGML_VK_VISIBLE_DEVICES=1`) |
| Equipo | Fedora Linux, Intel + 31 GB RAM, Node 24.14.1 |
| Modelo | Qwen3-1.7B Instruct Q4_0 por `@qvac/sdk` 0.18.2, `ctx_size` 4096, `temperature` 0 |
| Ejecución | `execution_mode: local`, `backend_actual: gpu` en las 20 filas de `evidencia/rendimiento.jsonl` |
| Carga del modelo | **2.7 s** (4.1 s la primera vez del día, con la caché fría) |
| Recuperación | solo términos (`buscar`), sin índice semántico: la prueba no carga embeddings |

## Corrida final — 2026-09-09T21:00:44Z · 19/20 aciertos · 5/5 abstenciones

| Caso | Consulta | ms | Esperado | Obtenido | |
|---|---|---|---|---|---|
| S01 | ¿Cuál es el depósito inicial mínimo para abrir una cuenta de ahorro? | 758 | AHO-AP-01 | AHO-AP-01 | ✓ |
| S02 | Se cayó el enlace al CORE, ¿cuál es el tope de retiro por cliente y por día en modo isla? | 843 | RET-ISL-01 | RET-ISL-01 | ✓ |
| S03 | Estoy sin enlace al CORE, ¿qué formulario uso para el retiro en contingencia? | 822 | RET-ISL-01 | RET-ISL-01 | ✓ |
| S04 | Para un retiro en modo isla, ¿quiénes ponen la doble firma? | 803 | RET-ISL-01 | RET-ISL-01 | ✓ |
| S05 | ¿Cómo asigno el folio del retiro en modo isla? | 923 | RET-ISL-01 | RET-ISL-01 | ✓ |
| S06 | Estoy haciendo el arqueo de caja, ¿contra qué comparo el efectivo contado? | 671 | CAJ-ARQ-01 | CAJ-ARQ-01 | ✓ |
| S07 | Me salió un faltante, ¿cómo abro el incidente INC-CAJA? | 778 | INC-CAJA | CAJ-ARQ-01 | ✗ |
| S08 | Llegó una persona natural adulta panameña, ¿qué documentos le pido? | 673 | DOC-NAT-01 | DOC-NAT-01 | ✓ |
| S09 | ¿Qué documentos requiere una persona natural extranjera adulta? | 610 | DOC-EXT-01 | DOC-EXT-01 | ✓ |
| S10 | ¿Qué documentos pido para una persona jurídica? | 652 | DOC-JUR-01 | DOC-JUR-01 | ✓ |
| S11 | ¿Cómo trato los datos biométricos en la demostración según DAT-PRI-01? | 750 | DAT-PRI-01 | DAT-PRI-01 | ✓ |
| S12 | Falta un documento obligatorio, ¿qué hago con EX-DOC-01? | 650 | EX-DOC-01 | EX-DOC-01 | ✓ |
| S13 | No hay constancia local vigente del saldo, ¿qué hago según EX-SAL-01? | 744 | EX-SAL-01 | EX-SAL-01 | ✓ |
| S14 | Ya regresó el enlace, ¿cómo hago la conciliación ISL-REC-01? | 805 | ISL-REC-01 | ISL-REC-01 | ✓ |
| S15 | Quedó una diferencia al conciliar, ¿qué indica EX-CON-01? | 718 | EX-CON-01 | EX-CON-01 | ✓ |
| S16 | ¿Qué tasa le ofrezco al cliente para un préstamo hipotecario? | 537 | abstención | abstención | ✓ |
| S17 | El cliente olvidó su PIN, ¿cómo lo recupero? | 534 | abstención | abstención | ✓ |
| S18 | ¿Cuánto rinde invertir en criptomonedas con el banco? | 375 | abstención | abstención | ✓ |
| S19 | ¿Qué cobertura tiene el seguro de vida? | 396 | abstención | abstención | ✓ |
| S20 | ¿A qué hora cierra la sucursal los sábados? | 570 | abstención | abstención | ✓ |

**Latencia por consulta:** mínimo 375 ms · mediana 718 ms · media 681 ms · máximo 923 ms.
**Por inferencia** (mediana de las 20 filas del registro): 255 ms hasta el primer token,
124 tokens/s, 919 tokens de entrada y 55 de salida.

## Contra la corrida en CPU

| | CPU (2026-09-09T18:10:25Z) | GPU (esta) |
|---|---|---|
| Backend que reportó el SDK | `cpu` | `gpu` (Vulkan) |
| Por consulta | 4 548 – 17 129 ms, media 10 466 ms | 375 – 923 ms, media 681 ms |
| Aciertos | 18/20 | 19/20 |
| Abstenciones | 5/5 | 5/5 |

La misma prueba, el mismo modelo: **15 veces más rápido en promedio** (10 466 ms contra 681 ms). Los números de CPU salen de
`src/sucursal/NOTAS.md`, escritos por la corrida que los produjo; su `resultado-modelo.json` ya fue
sobrescrito por las corridas posteriores. En CPU el módulo sigue siendo usable para documentar un
caso, pero deja de sentirse como una consulta y empieza a sentirse como una espera: la ejecución
local en la tarjeta de la sucursal es lo que hace que el cajero pregunte otra vez.

## La guarda de alcance, y por qué hacía falta

En la corrida en GPU de las 20:46Z, **S20 —«¿A qué hora cierra la sucursal los sábados?»— no se
abstuvo**: el modelo eligió `CAJ-ARQ-01`, un procedimiento que existe, para una pregunta que la
guía no cubre. `validarRespuesta()` lo aceptaba porque el código era válido y la sección estaba
entre las recuperadas. Un código válido no es respaldo.

La guarda que se agregó cabe en dos líneas: **la sección elegida tiene que estar entre las DOS
mejores que recuperó la búsqueda para esa consulta**. Medido sobre los 20 casos, en los 15 que la
guía sí responde la sección correcta salió primera (14 veces) o segunda (1 vez); para S20 las tres
recuperadas empataron en el puntaje mínimo (1 punto, solo por la palabra «hora») y `CAJ-ARQ-01`
era la tercera. La abstención queda además explicada en la respuesta:

    CAJ-ARQ-01 no está entre los dos procedimientos con mejor respaldo para esta consulta

Exigir el top-**1** habría «arreglado» también S07, pero eso deja de ser una guarda: convierte al
modelo en un sí/no sobre el primer resultado de la búsqueda por términos. No se hizo.

## El caso que sigue fallando: S07

«Me salió un faltante, ¿cómo abro el incidente INC-CAJA?» espera `INC-CAJA` y el modelo contesta
`CAJ-ARQ-01` en las tres corridas. No es un problema de recuperación —`INC-CAJA` sale primera con
40 puntos contra 30— sino de que la guía tiene dos secciones sobre la misma diferencia de caja:
`CAJ-ARQ-01` («Toda diferencia se documenta con INC-CAJA», y el arqueo es lo que la persona está
haciendo) e `INC-CAJA` (el incidente en sí). El modelo se queda con la sección que describe la
operación en curso. La respuesta que publica es texto literal correcto sobre el arqueo, con su
cita; lo que está mal es el procedimiento elegido. Queda anotado, no maquillado.

## Las tres corridas de hoy, con la variación a la vista

Con `temperature: 0` el resultado **no** es idéntico entre corridas: el motor varía y el 1.7B
cambia de opinión en los casos limítrofes. Las tres corridas de esta sesión, en orden:

| Corrida | Código | Aciertos | Abstenciones | Qué cambió |
|---|---|---|---|---|
| 2026-09-09T20:55:15Z | guarda de alcance | 18/20 | 5/5 | S02 y S07 |
| ≈2026-09-09T20:58Z | idem | 17/20 | 5/5 | S02, S07 y S11 |
| 2026-09-09T21:00:44Z | guarda + respaldo del monto | **19/20** | **5/5** | S07 |

S02 falló en las dos primeras porque el modelo parafraseó la cita del monto («Tope: B/. 100.00 por
cliente y por día» en vez de la línea literal) y el módulo descartaba el importe aunque estuviera
escrito en la sección. Se corrigió donde correspondía: **el respaldo de un monto lo da la guía, no
la prolijidad de la copia**. Ahora vale la cita localizada y, si el modelo la parafrasea, vale la
sección elegida siempre que mencione un solo importe —la misma condición que ya se exigía cuando el
modelo no da monto—. Nunca elige el código entre dos cifras.

S11 se abstuvo en la segunda corrida porque el propio modelo devolvió `cubierto: false`; ninguna
guarda intervino. Es variación del modelo, y por eso queda anotada.

## Lo que esta medición no prueba

- No prueba nada sobre una guía real de un banco real: la guía son 173 líneas ficticias escritas hoy.
- No mide recuperación semántica: la prueba corre solo con búsqueda por términos.
- No mide concurrencia: una consulta a la vez, un proceso.
- 20 casos son 20 casos. El denominador está a la vista y es chico.
