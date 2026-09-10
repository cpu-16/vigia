# PWA verificadas · 10 de septiembre de 2026

Validación en Chrome del HONOR VNE-LX3, sin construir un APK nativo:

| Comprobación | Vigía principal | Sucursal local |
|---|---|---|
| Origen de esta prueba | `http://localhost:7320` (reverse USB al nodo) | `http://localhost:17321` (Termux en HONOR) |
| Identidad del manifiesto | `/equipos`, preservada | `/sucursal` |
| Manifest con credenciales | Sí | Sí |
| Service worker activado | `/sw.js`, cache `vigia-v13` | `/sw.js`, cache `vigia-sucursal-local-v1` |
| `Page.getAppManifest` | Sin errores | Sin errores |
| `Page.getInstallabilityErrors` | Lista vacía | Lista vacía |
| Recarga de la interfaz sin red (CDP) | Correcta | Correcta |
| API sin red | Error real, sin respuesta cacheada | Error real, sin respuesta cacheada |
| Instalación desde Chrome y apertura desde icono | No ensayada | Verificada |

En Sucursal local, el icono «Vigía local» abrió `SameTaskWebApkActivity` de Chrome; `matchMedia('(display-mode: standalone)').matches` devolvió `true`. La captura [HONOR instalado](honor-instalada.png) muestra la aplicación completa sin barra de direcciones. El endpoint de estado indicó HONOR, requisitos disponibles y ningún archivo faltante. Eso comprueba instalación y disponibilidad del runtime, no una inferencia nueva; la inferencia real está documentada en la evidencia de modo avión.

La instalación PWA no instala Termux, Bare ni pesos de modelos. El nodo debe estar activo. Al intentar grabar el lanzamiento, Android cerró Termux por presión de memoria y la aplicación mostró «Nodo local no disponible». Se restauró Termux y el puente y se verificó la apertura sin grabador. La apertura se verificó sin el grabador activo; no se garantiza que Android conserve el proceso bajo presión de memoria.

La política SW solo permite archivos explícitos de interfaz. No intercepta API, POST ni login; rechaza redirecciones durante precarga y respeta la respuesta de autenticación online. La actualización elimina únicamente cachés de su prefijo; no toca IndexedDB ni borradores. Guardar la interfaz no equivale a descargar modelos ni permite inferencia remota sin el nodo.

Validación automatizada: 13 pruebas del puente/PWA pasan también al extraer el paquete; incluyen autenticación, aislamiento de API, conservación de cachés ajenas, error correcto para JavaScript ausente, rutas e iconos PNG con dimensiones reales. Dos empaquetados consecutivos producen el mismo SHA-256 (el hash puede cambiar si se actualiza documentación incluida).
