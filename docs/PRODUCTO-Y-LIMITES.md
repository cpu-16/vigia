# Vigía: producto, investigación y límites de esta entrega

## Qué aporta

Vigía ayuda a convertir observaciones de campo incompletas en un inventario revisable, prioriza qué comprobar en la próxima visita y permite exportarlo. Sucursal consulta procedimientos con respaldo documental y cierra expedientes verificables. Red entrega señales de seguridad y QoE a las herramientas del operador. El valor propuesto es reducir pérdida de información y hacer trazable su revisión; no se ha medido ahorro económico con clientes reales.

Philips ya ofrece inventario, evaluación y análisis del ciclo de vida en [OneSpace Insights](https://www.usa.philips.com/healthcare/service/onespace-insights). También describe la necesidad de información precisa en [gestión estratégica de tecnología](https://www.usa.philips.com/healthcare/article/strategic-technology-management-plan). La adaptación concreta es orientar el tablero a verificaciones pendientes, unidad identificada, última observación y exportación. Vigía es un prototipo de captura que podría alimentar esos procesos; no es una integración con Philips ni reemplaza su plataforma.

Caja ya dispone de [A.N.D.R.E.A.](https://www.cajadeahorros.com.pa/andrea/) para atención. Nuestra hipótesis es ayudar al personal con procedimientos internos citados y evidencia de lo actuado o de la falta de respaldo. Encaja con la dirección de operación interna del reto; falta validarlo con trabajadores del banco y políticas autorizadas. No se procesan documentos reales de clientes.

## Cambios terminados

- Tablero con búsqueda de cliente/ubicación, próximas verificaciones ordenadas por cantidad desconocida, antigüedad y campos faltantes, última observación y CSV filtrado. Son prioridades deterministas explicables, no puntuaciones clínicas.
- Indicadores distinguen unidades de grupos. Países equivalentes no se separan por acento/idioma/código. Edades abiertas se presentan como límites inferiores, con serie cuando existe.
- La búsqueda filtra clientes, verificaciones y exportación; los indicadores generales resumen toda la base y la interfaz lo explica.
- Evidencia técnica plegada para que no domine el trabajo operativo. Controles táctiles, foco visible, transiciones breves y respeto de movimiento reducido.
- Sucursal ofrece otra atención tras cerrar y desde el verificador. Se mantiene la descarga del acta.
- Una abstención se puede documentar: el servidor deja constancia de falta de respaldo e instrucciones no emitidas. La persona puede añadir una observación. No hay envío automático al supervisor.
- Philips conserva las mejoras de foto durante revisión, guardado con pendientes, reintento y protección de cantidades al corregir.

## RAG, agentes y voz

**Sucursal ya usa RAG con recuperación por términos:** busca fragmentos de su guía, el modelo selecciona el procedimiento y las guardas publican texto respaldado. No necesita una base vectorial por definición. Los embeddings de QVAC existentes permanecen fuera del servidor activo: la mejora de recuperación para paráfrasis debe compararse de extremo a extremo con los controles de abstención antes de activarla. [QVAC soporta embeddings](https://docs.qvac.tether.io/ai-capabilities/text-embeddings/).

**Philips:** para extraer una visita o consultar filas estructuradas, otro RAG no aporta por sí mismo. Sí tendría sentido al incorporar manuales autorizados o documentación de modelos, con versión, procedencia y permisos; eso no forma parte de esta entrega.

**Ovnicom:** el agente consumidor ya existe. Un RAG de procedimientos operativos puede orientar investigaciones futuras, pero no es necesario para detectar, explicar y enviar las señales actuales.

**Voz de salida:** lectura opcional integrada con Supertonic 2 Q8 mediante QVAC en la RTX 4060. Philips permite escuchar preguntas y resúmenes; Sucursal lee la respuesta visible con su alcance y advertencias. No reproduce automáticamente y se puede detener. Se verificaron inteligibilidad mediante Whisper, reproducción en navegador y consumo; no se realizó una evaluación auditiva humana comparativa. [Mediciones y límites](../evidencia/voz-opcional/RESULTADOS.md). Sin acceso al nodo, la web conserva el texto y avisa de que la lectura no está disponible.

No se añadió un agente autónomo que autorice pagos o cambios de inventario. Las acciones con consecuencias siguen siendo confirmaciones humanas. Los modelos y guardas tienen trabajos delimitados.

## Sin internet: cuatro situaciones distintas

| Situación | Comportamiento real |
|---|---|
| Laptop con modelos descargados, sin salida a internet | Puede interpretar localmente y consultar su guía. Probado en namespace sin rutas: `evidencia/prueba-sin-internet-final.json` |
| Navegador sin acceso a su nodo | Conserva capturas en IndexedDB y permite recuperarlas al volver. No convierte esa cola en inferencia sin modelo |
| HONOR como nodo independiente | Delega texto a un par. Su modelo a bordo falla al cargar; sin par queda pendiente. Voz y foto requieren el nodo completo |
| Acta y app previamente cargadas | Verificación criptográfica en navegador sin red. Probada por recarga offline |

El enlace Tailscale necesita conectividad para llegar a la laptop. Para ejecución aislada se usa el nodo local; no se promete que una URL remota sea accesible sin red. QVAC necesita descargar modelos antes del aislamiento. El namespace de prueba aisló el proceso, no toda la laptop.

## Evidencia y entrega

`npm test`, pruebas de navegador de captura/foto/corrección, `scripts/probar-producto.py` y `scripts/auditar-tailscale.py`. El recorrido de producto crea un expediente sintético, verifica su firma, recarga sin red y vuelve a una atención limpia. Las consultas con modelos reales no son garantías de exactitud general.

[Guion de 4:50](GUION-GRABACION.md). El repositorio permanece privado: subir cambios no concede acceso al jurado. Debe verificarse ese acceso y añadir el enlace final del video en Dojo. No se ha publicado una entrega de Dojo ni grabado el video por el usuario.

## Referencia compartida: Leash

El enlace del usuario corresponde a «Leash Demo Video», publicado por Daniel Asaboro, de 4:59. No se pudo reproducir completo ni obtener subtítulos en esta sesión: YouTube devolvió 403/429. Por eso este análisis se apoya en la [ficha oficial de QVAC](https://qvac.tether.io/showcase/leash) y el [repositorio de Leash](https://github.com/danielAsaboro/Leash), no en una supuesta observación del video. El importe del premio mencionado por el usuario no se verificó independientemente.

La ficha destaca un flujo coherente entre contexto, razonamiento, memoria y pares, con privacidad antes de elegir el destino. La adaptación para Vigía es mostrar el recorrido completo y el destino de cada inferencia, junto con evidencia reproducible. El repositorio también [documenta límites y pruebas pendientes](https://github.com/danielAsaboro/Leash/blob/main/docs/hackathon/known-issues.mdx). Esta disciplina respalda mantener explícito qué funciona aislado, qué necesita par y qué no está activado. No se copió código ni se atribuyeron a Vigía sus capacidades de LoRA, memoria o agentes.
