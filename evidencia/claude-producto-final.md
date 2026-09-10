# Respuesta de Claude

Leí los cuatro archivos, `expediente.js`, el README y `../retos/general/RETO.md`. Esto es lo que veo.

## Antes de las tres: el riesgo que sí descalifica

`evidencia/TRACK-3-Y-DEMO-9SEP.md` dice que no hay push y que `cpu-16/vigia` es privado. El reto exige repo accesible al jurado durante toda la evaluación y el video sin credenciales. Eso vale más que cualquier feature: sube y prueba el acceso con una cuenta ajena antes de tocar código.

## Tres mejoras concretas

**1. Cerrar el lazo del verificador — prioridad alta, ~20 líneas.**
`app/sucursal.html:544` hace `location.href = '/verificar#acta=…'` y ahí muere el flujo: `verificar.html` solo ofrece "Verificar" y "Probar una alteración", y el único regreso es el logo a `/`. En el video eso te obliga a un corte raro justo en tu mejor momento (la firma que se cae al cambiar un carácter). Añade en `verificar.html` un enlace de vuelta al expediente cuando venga por hash, y en la barra de `sucursal.html` deja el acta descargable ya visible. Toca Design (10%) y Completion (10%), que son los puntos más baratos que tienes.

**2. Decidir el híbrido de una vez — prioridad alta, decisión no código.**
`buscarHibrido()` en `guia.js:33` ya existe y `responder()` la acepta, pero `contextoSucursal()` (`http.js:31`) llama `responderConModelo(m, guia, consulta)` sin `emb` ni `indice`: en producción corre solo por términos. O lo cableas y repites el control de 20 preguntas para poder decir "1/4 → 3/4 en paráfrasis" con número medido, o lo dejas apagado y en el guion nunca dices "RAG híbrido". Lo que no puedes es grabar la ambigüedad: un jurado que abra `semantica.js` verá código que la demo no ejecuta.

**3. Abstención que produce acta — prioridad media, ~15 líneas.**
Hoy, cuando el modelo se abstiene, el flujo se estanca: `/pasos` exige `cubierto` (`http.js:105`). Pero `abrir` sí acepta esa consulta. Un botón "documentar y escalar" que abra expediente y registre `observacion` convierte tu abstención en un acta firmada de *"el asistente no respondió y la persona escaló"*. Eso es lo que te separa de A.N.D.R.E.A.: no es un chatbot que sabe menos, es un sistema que deja constancia de lo que no sabe. Innovation (25%) e Impact (20%).

## Qué NO añadiría antes de grabar

- **TTS.** Ya tienes dictado por Whisper; la voz de salida es otro modelo cargándose en vivo, cero puntos en la rúbrica y un fallo posible en escena.
- **Un agente.** `src/red/agente.js` ya cubre esa narrativa. Un agente que "actúe" en banca choca con tu propia línea: *el sistema no autoriza retiros*.
- **RAG nuevo.** No hace falta: enciende el que tienes o cállalo.

**Riesgo de demo, no de producto:** `recordadas` vive en memoria (`http.js:20`). Si reinicias el servidor entre la consulta y el expediente, sale `consulta_desconocida` en cámara. Graba sin reiniciar.
