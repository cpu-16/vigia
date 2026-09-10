# Instalación para clientes y límites de la demostración

## Qué ejecuta QVAC hoy

- **Enlace web de Vigía:** el teléfono es cliente de captura. La inferencia ocurre en el nodo que sirve la aplicación o en su par autorizado. Abrir el enlace o instalar la PWA no instala el SDK ni los modelos en el celular. Tailscale transporta la conexión; por sí mismo no es delegación QVAC entre pares.
- **HONOR con nodo en Termux:** instalación independiente del SDK que delega texto a un par autorizado. Este modo se probó; no tiene modelo cargado a bordo ni ofrece las capacidades de foto, voz y sucursal del nodo completo.
- **Nodo completo de la demostración:** portátil con voz y visión, con lenguaje delegado al Mac autorizado. Existe también una prueba separada de lenguaje local sin salida a Internet. Esa prueba no demuestra inferencia sin conexión en cualquier teléfono.

## ¿Otro teléfono incumple las reglas?

La regla general exige usar QVAC y prohíbe enrutar inferencia a API en la nube. Permite alojar interfaces fuera del dispositivo y valora Pears sin exigirlo. Véase la [auditoría por tracks](../evidencia/TRACK-3-Y-DEMO-9SEP.md).

Nuestra lectura: cambiar el navegador cliente no incumple por sí solo esa regla si la inferencia sigue en los nodos propios con QVAC. No demuestra que el teléfono ejecute IA ni que sea un nodo P2P. Hay que mostrar el recorrido real y el entorno autorizado. La decisión de elegibilidad corresponde al organizador. En Caja, usar el portátil personal del desarrollador para datos reales del banco no equivale a mantenerlos dentro de su infraestructura.

## Propuesta comercial recomendada

Entregar Vigía como software instalado en un equipo del cliente, acompañado del runtime QVAC y la descarga inicial de los modelos seleccionados. Los colaboradores acceden desde sus teléfonos a ese nodo de la empresa. El cliente compra instalación, integración, mantenimiento y soporte; no necesita instalar QVAC manualmente en cada navegador.

El instalador debería verificar hardware, descargar y comprobar modelos, crear identidad del nodo, autorizar pares y ofrecer actualización y diagnóstico. Ese instalador comercial todavía no está construido. Antes de operar con clientes reales faltan control de acceso por usuario, aislamiento por organización, gestión de dispositivos, respaldo y restauración, y validación de las licencias de distribución del SDK y de cada modelo.

Una aplicación móvil nativa podría integrar el SDK y ejecutar modelos compatibles o delegar a un nodo de la empresa. QVAC documenta Node.js/Bare y Android/iOS mediante Expo. Los pesos se obtienen por separado: instalar el SDK no instala todos los modelos. Esto es una ruta de desarrollo, no una capacidad ya entregada de nuestra PWA. [Documentación oficial de QVAC](https://docs.qvac.tether.io/introduction/).

Sin Internet, un nodo y modelos ya instalados pueden trabajar por red local; la app debe poder alcanzar ese nodo. Fuera de esa red, el navegador conserva capturas para retomarlas cuando vuelva la conexión. El enlace público al portátil no permite inferencia desconectada.

## Reiniciar la captura

En Equipos:

1. **Nueva visita** conserva los pendientes y abre la pantalla vacía. Una nota todavía sin interpretar también se conserva.
2. **Interpretar la más vieja** retoma voluntariamente un pendiente. Abrir o recargar ya no inicia su interpretación automáticamente.
3. **Borrar pendientes** pide confirmación, elimina las capturas y revisiones de ese navegador y abre una visita vacía. Conserva el nombre del colaborador y los registros del servidor. Otros dispositivos/orígenes conservan sus propios datos.

El borrado se bloquea durante una operación o grabación y las demás pestañas se recargan al detectar la limpieza para impedir que vuelvan a escribir borradores antiguos. Esto elimina los borradores, no la caché de archivos necesaria para abrir sin red. El tablero muestra registros del servidor: su limpieza no forma parte de este botón.

## Decisión sobre una APK para trabajo de campo

Sí aporta valor como siguiente versión de Philips si integra realmente el runtime QVAC: captura con cámara y micrófono, borradores duraderos, descarga explícita de modelos y ejecución local cuando el dispositivo lo soporte. La alternativa es delegar a un equipo autorizado de la organización, mostrando ese modo de forma visible. Un contenedor de la web no incorpora automáticamente esas capacidades.

La ruta documentada es Expo/React Native con integración nativa de QVAC. La guía exige probar en dispositivo físico; no basta el emulador. Nuestro proyecto fija SDK 0.18.2 y la documentación pública evoluciona: antes de migrar hay que validar versiones y mantener funcionando la delegación existente. [Tutorial oficial](https://docs.qvac.tether.io/tutorials/expo/).

Criterio para decidir el desarrollo: demostrar en el HONOR que un modelo pequeño carga, produce una salida útil sin conexión y se recupera al suspender y reabrir la app; medir descarga, almacenamiento, memoria, latencia y temperatura. Después integrar cámara/voz y una prueba con un segundo Android. Esta validación nativa aún no está realizada. Para la grabación actual, usar el flujo web comprobado y explicar dónde corre la IA.

La revisión de Philips ahora mantiene la fotografía en una barra fija y abre «Editar relato» dentro de la misma visita. Cancelar mantiene la revisión. Un cambio aplicado vuelve a comprobar las asociaciones; un fallo del nodo conserva la revisión anterior y la edición para reintentar.
