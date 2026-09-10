# Vigía Sucursal: qué aporta frente a lo existente

Revisión del 10 de septiembre de 2026. Equipo **ciberpty**, producto **Vigía**.

**Consultar requisitos o conversar con documentos no es, por sí solo, una innovación de Vigía.** La propuesta demostrable combina consulta interna con fuentes, revisión humana, expediente y acta verificable. El prototipo separado Sucursal local añade una consulta breve en el HONOR sin red, con Termux y modelos instalados.

| Referente | Solapamiento | Diferencia y límite de Vigía |
|---|---|---|
| A.N.D.R.E.A. de Caja | Ya informa requisitos y permite consultar el estado de préstamos o tarjetas. | Vigía se orienta al empleado que consulta procedimientos y documenta la atención; no reemplaza ese canal de clientes. |
| DocuAssist, publicado por IVCISA | Ya ofrece consulta de documentación interna con Amazon Q Business/Apps e integración con Teams y SharePoint. | Vigía ejecuta inferencia en equipos propios o pares autorizados y permite verificar actas exportadas. No tiene integración equivalente con SharePoint, sincronización documental ni controles empresariales completos. |
| Apertura digital de Caja | Ya existe un canal para abrir cuentas. | Vigía no abre cuentas ni autoriza transacciones. Su demo muestra asistencia interna y documentación de una atención. |

DocuAssist se describe como un proyecto en un **banco panameño privado no identificado**. No es evidencia de que Caja de Ahorros use DocuAssist. Las fuentes públicas consultadas tampoco permiten afirmar que Caja carezca de herramientas internas similares a Vigía.

## Lo que sí se puede mostrar

- **Nodo principal:** guía ficticia con fuentes, procedimiento revisado por una persona, expediente y acta SHA-256/Ed25519 verificable sin servidor. La firma prueba integridad y posesión de una llave, no identidad certificada.
- **Sucursal local en HONOR:** consulta breve a Qwen3-0.6B con QVAC Bare en CPU, radios apagadas y sin puente de inferencia al portátil. Es otra modalidad; no incluye el expediente completo, voz o fotografías.
- **Límites:** recuperación por términos, datos sintéticos, errores y abstenciones observados. No hay validación con manuales reales del banco ni medición del ahorro de tiempo de sus empleados.

El encaje con el reto proviene de asistir consultas de procedimientos de operación interna con inferencia local. La novedad defendible es la combinación implementada y su evidencia; no la invención del chat documental ni una superioridad general sobre sistemas en producción.

## Frase de presentación

> Vigía ayuda al personal a consultar un procedimiento con su fuente y dejar una atención documentada con un acta verificable, usando QVAC en equipos propios. Además, demostramos una consulta breve de contingencia en un teléfono sin red.

## Fuentes y pruebas

- [Caja: A.N.D.R.E.A.](https://www.cajadeahorros.com.pa/andrea/).
- [IVCISA: caso DocuAssist](https://ivcisa.com/index.php/amazon-q-transformando-la-gestion-documental-en-la-banca-panamena/).
- [Caja: apertura de cuentas](https://aperturadecuentaca.cajadeahorros.com.pa/).
- [Auditoría de encaje con los tracks](../evidencia/TRACK-3-Y-DEMO-9SEP.md).
- [Prueba real del HONOR sin red](../evidencia/sucursal-webapp-avion-10sep.md).
- [Producto y límites](PRODUCTO-Y-LIMITES.md).
