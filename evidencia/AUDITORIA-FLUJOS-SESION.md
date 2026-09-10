# Correcciones de edición, historial y fechas

## Fallo reproducido antes de corregir

En Philips, enviar un evento `input` al editor y pulsar inmediatamente la acción de aplicar dejaba el clic sin efecto: el contador global incluía la escritura del borrador en IndexedDB. La prueba previa agotó su espera de 2 segundos sin iniciar la petición. Ahora la aplicación espera esa escritura; la barra principal aplica la edición mientras el editor está abierto.

## Verificación completada

- `scripts/probar-foto-revision.py` con `PROBAR_CORRECCION=1`: clic inmediato, fallo del nodo, cancelación, foto, edición y guardado del contenido corregido. API controlada para reproducir errores.
- `scripts/probar-edicion-real.py`: navegador aislado sobre Tailscale, dos inferencias QVAC reales, corrección de dos a tres equipos, guardado real y acta válida. Observador identificado como «Auditoría sintética · edición».
- `scripts/probar-producto.py`: navegador configurado en UTC; compara las horas de registro del tablero con su conversión a Panamá. En Sucursal guarda un campo sin perder otro editado, impide cerrar con cambios sin guardar, cierra un expediente sintético, verifica sin red, limpia los datos del navegador y recupera la misma acta desde el historial. Comprueba que la limpieza no modifica el listado del servidor.
- Prueba del almacén con reloj fijado a 2026-09-10 02:30 UTC: la fecha automática es 2026-09-09 en Panamá; conserva la marca UTC del evento y las fechas históricas declaradas.
- Prueba HTTP de historial: listado persistente tras reconstruir el almacén, fecha de cierre, lectura del acta y ausencia de endpoint de borrado.
- Suite: 82 pruebas aprobadas, 8 omitidas, 0 fallos.

Las pruebas reales crean registros sintéticos en el nodo. Los registros y sus actas no se eliminan al limpiar la interfaz. No se borraron capturas del navegador habitual del usuario.

## Uso

- Philips: «Editar relato» → editar → «Aplicar cambios» (también en la barra fija) → revisar los datos derivados → guardar.
- Sucursal: «Nueva atención» conserva nombre y sucursal. «Limpiar pantalla y datos locales» permite olvidar también esas preferencias. Los campos sin guardar se descartan con confirmación; el historial del servidor permanece.
- «Historial de atenciones» recupera expedientes abiertos o cerrados del nodo compartido. En uno cerrado, «Verificar acta» comprueba su firma. No es una bandeja privada por empleado: el control de acceso por usuario sigue siendo trabajo para la versión comercial.
- Tablero: «Consulta del tablero» indica la actualización de pantalla; «Último registro» es la hora del evento guardado, mostrada en Panamá (UTC−5). La fecha declarada de observación es otro dato. Los eventos firmados anteriores no se reescriben.
