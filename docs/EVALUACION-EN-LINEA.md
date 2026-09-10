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

La instancia de evaluación ejecuta Qwen3, Whisper y VisionPsy mediante QVAC en **Fedora con RTX 4060**. Supertonic 2 carga al pedir lectura en voz. La Mac no se requiere para esta instancia; la delegación P2P permanece documentada en las otras pruebas. El frontend público está alojado en prox3. Nginx comunica las rutas de la app con el nodo HTTPS de Fedora; el proxy no ejecuta modelos.

Los datos del jurado, su llave de firma y sus métricas se guardan por separado en el nodo, fuera del repositorio. El catálogo es sintético. Esta configuración no convierte el navegador de otro teléfono en un nodo QVAC local: sin conectividad al servidor no puede inferir. La prueba del HONOR en modo avión es una modalidad distinta, con Termux y modelos instalados.

## Operación del equipo

Fedora debe estar encendida, con Internet y alimentación. `vigia-evaluacion.service` es un servicio de usuario habilitado, con reinicio al fallar. `vigia-no-suspender.service` evita la suspensión mientras está activo, hasta un máximo de 30 horas desde su inicio; no evita un corte de energía o de red. Tras reiniciar Fedora se requiere iniciar la sesión del usuario para arrancar sus servicios.

```bash
systemctl --user status vigia-evaluacion.service
journalctl --user -u vigia-evaluacion.service -n 30
systemctl --user restart vigia-evaluacion.service
# Al terminar la evaluación:
systemctl --user disable --now vigia-no-suspender.service
```

Las credenciales están en un archivo privado del equipo; nunca incluirlas en el repo. Los archivos originales de inventario y Sucursal no se reemplazaron. La configuración anterior del nodo y de Nginx se conserva para restaurar el servicio previo.
