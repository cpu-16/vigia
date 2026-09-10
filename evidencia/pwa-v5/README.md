# Vigía local desde su icono: prueba nueva del 10-sep

Equipo **ciberpty**. Consulta iniciada el 10-sep-2026 a las 14:35:16 de Panamá (19:35:16 UTC). La grabación original completa queda en el proyecto audiovisual, fuera del repo.

Se abre Vigía local desde el icono del HONOR; `display-mode: standalone` es verdadero. Consulta real de identidad DOC-NAT-01, con `airplane_mode_on=1`, Wi-Fi y datos móviles en `0` y lista `adb reverse` vacía. USB conserva control de pantalla/CDP; no aporta inferencia. El servidor de Termux atiende por loopback y ejecuta QVAC Bare en CPU.

Resultado: «Respuesta breve: El documento de identidad es la cédula ficticia vigente.». Carga **6479 ms**, inferencia **18495 ms**, 19 tokens generados, fin `eos`, sin desplazamiento de contexto. Solicitud `248837c8-bbcc-4644-9783-f2f2c7668bcc`. [JSON íntegro](resultado.json), [controles](controles.json), [restauración de radios y reverse](restauracion.json).

La interfaz muestra respuesta, sección completa y métricas. Las capturas reflejan esta ejecución; no se inyectaron respuestas en la API. El video abrevia la espera con un rótulo ×4,9. Un primer intento de automatización salió de la app sin enviar consulta; se descartó del montaje.

La instalación sigue requiriendo Termux y modelos preparados. Esta prueba no demuestra una APK autónoma, expedientes completos sin red ni fiabilidad general del modelo.
