# Sucursal isla — notas de entrega

Código y contenido sintético creados el 9 de septiembre de 2026.
Guía BPL ficticia de 173 líneas, con procedimientos, tablas, excepciones y 20 consultas.
Búsqueda determinista sin acentos; los códigos pesan más y se recuperan hasta 3 secciones.
La inferencia usa exclusivamente completar() del núcleo y @qvac/sdk 0.18.2.
La gramática ofrece secciones completas como citas: evita errores de copia del modelo pequeño.
Se conservan los fragmentos literales; los pasos publicados salen de esos fragmentos.
Se limpian cadenas "null" y se validan códigos contra los encabezados, normalizando mayúsculas.
Un monto necesita respaldo literal en la misma sección; se rechazan coincidencias numéricas parciales.
Sin cita válida de pasos, la respuesta se abstiene con «sin respaldo en la guía».

Expediente usa Eventos y reconstruye abierto → en_proceso → cerrado desde JSONL.
Agregar un paso o dato inicia el proceso; un expediente cerrado rechaza toda modificación.
El acta sellada queda dentro del evento de cierre y se recupera con obtener(id).acta.
verificar(acta), del núcleo, comprueba el sello localmente sin servidor.
La prueba reconstruye y verifica el acta desde otro proceso de Node.
Por defecto, los eventos van a src/sucursal/datos/sucursal.jsonl.
Para aislar demostraciones: new Expediente('src/sucursal/datos/demo.jsonl').
Guardar llaves de demostración con llaveNodo('src/sucursal/datos/nodo.pem').
Estas funciones documentan; no ejecutan operaciones bancarias.

Pruebas puras: node --test src/sucursal/ — 3 aprobadas, modelo omitido.
Última corrida real: 2026-09-09T18:10:25.607Z; 18/20 aciertos y 5/5 abstenciones.
Las 4 pruebas, incluida la evaluación real, terminaron aprobadas; umbral exigido: 16/20.
S01 y S02 fallaron solo por formato de limite: "25.00" y "100.00" sin el prefijo "B/.".
En ambos, los códigos y las citas son correctos; la prueba exige igualdad monetaria completa.
Latencia media: 10465.8 ms; mínimo: 4548 ms; máximo: 17128.9 ms.
El SDK reportó backend CPU y ejecución local, aunque se solicitó GPU.
Se usaron QVAC_CONFIG_PATH y GGML_VK_VISIBLE_DEVICES indicados por el usuario.
RENDIMIENTO apuntó a src/sucursal/rendimiento-modelo.jsonl para respetar las carpetas autorizadas.
resultado-modelo.json conserva la última evaluación y sus respuestas verificadas.
Se guardaron corridas anteriores: inicial 10/20, líneas 6/20, secciones 19/20.
Las anteriores buscaban el valor también en pasos; la última exige limite exacto en S01/S02.

Pendiente: uniformar el prefijo monetario sin relajar las guardas.
Pendiente: probar corte físico de red, más paráfrasis y consultas adversariales.
El JSONL requiere un solo proceso escritor; no hay bloqueo entre procesos ni reparación de líneas truncadas.
Las citas completas aumentan la latencia; queda pendiente medir aceleración efectiva por GPU.
El sello detecta alteraciones del contenido; no cifra el expediente ni acredita por sí solo la identidad del firmante.
