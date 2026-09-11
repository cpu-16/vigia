# Evaluación de Vigía en línea

Equipo **ciberpty**. Sitio: **https://vigia.ciberpty.com**. App protegida: **https://vigia.ciberpty.com/inicio**.

## Para el evaluador

El equipo facilita la clave por separado. La presentación, el catálogo y el verificador son públicos. Entrar en la app permite capturar una visita, revisar el inventario y consultar Sucursal. Solo usar datos ficticios.

1. Explorar el [catálogo](https://vigia.ciberpty.com/catalogo/): 14 equipos ficticios, filtros y modo pared.
2. [Entrar](https://vigia.ciberpty.com/inicio), dictar o escribir una visita, leer una placa y revisar los campos antes de guardar.
3. Abrir el tablero: revisar los pendientes y exportar el inventario.
4. En Sucursal, consultar un procedimiento de la guía BPL y revisar su fuente antes de documentar la atención.
5. [Verificar un acta](https://vigia.ciberpty.com/verificar/): cargar el acta o usar el ejemplo y probar una alteración. La comprobación ocurre en el navegador.
6. [Revisar Ovnicom](https://vigia.ciberpty.com/#ovnicom): flujo DNS, capturas de Wazuh y Grafana, código, comprobaciones y acceso directo al capítulo del video. Estas capturas no son paneles en vivo ni una red de producción.

## Dónde ocurre la inferencia

La instancia de evaluación ejecuta Qwen3-1.7B, Whisper large-v3 turbo y VisionPsy Nano mediante QVAC en un **MacBook Pro M5 Max de 128 GB, macOS 26.4, con Metal**. Supertonic 2 carga al pedir lectura en voz. El frontend público está alojado en prox3; nginx comunica las rutas de la app con el nodo por la red privada Tailscale y el proxy no ejecuta modelos. El nodo escucha solo en su dirección del tailnet, no en la red local donde está la máquina. Las mediciones de [MEDICIONES.md](MEDICIONES.md) se tomaron en la RTX 4060 y no se han repetido en este hardware.

Los datos del jurado, su llave de firma y sus métricas se guardan por separado en el nodo, fuera del repositorio. El catálogo es sintético. Esta configuración no convierte el navegador de otro teléfono en un nodo QVAC local: sin conectividad al servidor no puede inferir. La prueba del HONOR en modo avión es una modalidad distinta, con Termux y modelos instalados.

## Operación del equipo

La Mac debe estar encendida, con Internet y alimentación, y con la sesión del usuario iniciada. El agente `com.ciberpty.vigia` la arranca al iniciar sesión y la reinicia si falla. La máquina tiene la suspensión inhibida, lo que no evita un corte de energía o de red. Es un equipo prestado para la jornada de evaluación; el agente y sus archivos se retiran al terminar.

```bash
ssh tutoria 'tail -20 ~/vigia/evaluacion.log'
ssh tutoria 'launchctl kickstart -k gui/$(id -u)/com.ciberpty.vigia'   # reiniciar
# Al terminar la evaluación:
systemctl --user disable --now vigia-no-suspender.service
```

Las credenciales están en un archivo privado del equipo; nunca incluirlas en el repo. Los archivos originales de inventario y Sucursal no se reemplazaron. La configuración anterior del nodo y de Nginx se conserva para restaurar el servicio previo.
