# Guía para evaluar Vigía

**Equipo ciberpty · Producto Vigía.** [Demostración pública](https://vigia.ciberpty.com/#demo). [Instalación](EJECUCION.md).

| Track | Recorrido | Código | Evidencia |
|---|---|---|---|
| Philips | Dictado → revisión → lectura de placa → inventario | [Equipos](../src/equipos/) | [Mediciones](MEDICIONES.md) |
| Caja de Ahorros | Procedimiento con fuente → expediente → acta verificable | [Sucursal](../src/sucursal/) | [Diferenciación](DIFERENCIACION-CAJA.md), [alcance](PRODUCTO-Y-LIMITES.md) |
| Ovnicom | Replay DNS → explicación QVAC → Wazuh y Grafana | [Red](../infra/red/) | [Reproducción](../infra/red/README.md) |
| General | Inferencia local, delegación por llave y consulta en HONOR sin red | [Runtime](../src/core/), [nodos](../src/puente/) | [HONOR en modo avión](../evidencia/sucursal-webapp-avion-10sep.md) |

VisionPsy es un componente de Equipos. No se presenta el track QVAC Psy.

El sitio público contiene la presentación y el video; la app completa requiere acceso al nodo de demostración. El código incluye los componentes y pruebas de los cuatro tracks presentados; no incluye modelos, secretos ni toda la infraestructura externa preinstalada. La instalación y reproducción de cada componente tienen sus requisitos documentados.

La PWA Vigía local se abre desde su icono en Android. Ejecuta una consulta breve de texto con el nodo Termux activo y modelos descargados. No es una APK autónoma y no incorpora las funciones completas de Equipos, expedientes o Red.
