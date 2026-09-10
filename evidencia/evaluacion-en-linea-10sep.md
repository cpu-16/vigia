# Evaluación pública con clave · 10-sep-2026

Sitio `https://vigia.ciberpty.com`, app `/inicio`. Instancia separada en Fedora, RTX 4060, sin dependencia de la Mac. El nodo no publica su clave en el código.

Prueba real vía HTTPS y navegador: sin clave, API 401; acceso correcto con cookie HttpOnly/SameSite/Secure; extracción QVAC, guardado de acta, VisionPsy con modelo NM-MR 700 y serie NMMR2519575, consulta DOC-NAT-01 con fuente, síntesis Supertonic 2 y transcripción Whisper de esa lectura. Whisper devolvió «Esta es una demostración de vigía para los evaluadores.», 874 ms sobre 3,99 s de audio. Es control con audio reproducido, no grabación nueva del micrófono.

Se comprobaron Inicio, Equipos, Tablero y Sucursal a 390 y 1440 px, sin desborde ni errores JS. El video público devuelve 262,1 s y su botón de Ovnicom salta al segundo124. El catálogo conserva 14 equipos y cinco tomógrafos al filtrar; funciona el modo pared. El verificador acepta el ejemplo y rechaza su alteración.

La revisión semántica detectó que el modelo proponía cantidad2 a partir de «un resonador ... de dos años». La guarda anterior aceptaba un número presente en cualquier parte del reporte. Se corrigió para exigir una mención de cantidad asociada a la modalidad, y se añadieron controles de edad, otra modalidad y cantidad ausente. La consulta real repetida devuelve cantidad1, edad2. El ejemplo inicial quedó separado; la instancia usa una muestra revisada y una cadena nueva, sin reescribir eventos anteriores.

104 pruebas pasan; ocho pruebas con modelos se omiten por diseño. Los controles reales anteriores son complementarios. Se provocó la terminación del proceso supervisado: systemd reinició automáticamente una vez, recargó Qwen3/Whisper/VisionPsy y la app volvió a responder conservando los datos. Esta comprobación no garantiza disponibilidad ante pérdida de corriente o de Internet.

La configuración Nginx versionada sirve la presentación y exportaciones estáticas, y envía rutas protegidas de app/API al HTTPS del nodo Fedora. Ovnicom se presenta mediante capturas, video y comprobaciones; no se abrieron consolas administrativas Wazuh/Grafana al público.
