# Revisión de placa corregida — 10 de septiembre de 2026

La grabación original reveló una transcripción aplanada: `MODEL NM-MR 700 TYPE SN REF MFG DATE 2015-03 INPUT100-240V-60Hz6.0A`. El parser anterior tomaba todas las etiquetas restantes como modelo y serie. La confirmación de unidad no ofrecía edición individual y podía marcar esos valores como confirmados.

El parser ahora delimita etiquetas sucesivas: recupera `NM-MR 700` y deja la serie desconocida. Una validación compartida rechaza residuos técnicos tanto al interpretar como al incorporar una foto. Se mantienen identificadores legítimos como `REF-123`, `SN123`, `ABC/2026.001` y series numéricas.

La revisión de foto permite editar o vaciar Modelo y Serie antes de confirmar la unidad. Se conservan la transcripción, los campos originales y cada cambio humano (`anterior`, `nuevo`, origen `corregido por colaborador`). Una serie vacía no recibe sello de confirmación. No se migraron, borraron ni reescribieron registros históricos firmados.

Validación: `npm test`: 89 pruebas pasan, 8 omitidas. Las cuatro nuevas pruebas cubren OCR aplanado, etiquetas largas/series legítimas, rechazo antes de incorporar y trazabilidad de correcciones humanas. Prueba adicional aislada en Chromium móvil con fixture `nmmr700-nitida.png`, respuesta OCR controlada reproduciendo el fallo original, rechazo de serie basura, edición, confirmación y guardado: sin errores JavaScript, dos unidades conservadas y corrección auditable.

La grabación `video/edicion-10sep/ovnicom/placa-ux-controlada.webm` es una **prueba de regresión con respuesta controlada**, no una nueva inferencia VisionPsy. No debe sustituir la toma original haciéndola pasar por su resultado. Para demostrar inferencia nueva se debe grabar otra toma después de reiniciar el servidor con el parser corregido.
