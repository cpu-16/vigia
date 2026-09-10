# Respuesta de Claude

Revisión de solo lectura del parche de fotos y revisión. Transcripción literal; las afirmaciones se verifican aparte.

Revisión de solo lectura completada. Leí `src/equipos/revision.js`, `revision.test.js`, el diff de `almacen.js`, `reglas.js`, `servidor.js` y `app/index.html`. **Sí hay fallos graves**, dos de ellos pierden unidades en silencio.

## 1 · «Corregir» destruye la placa y colapsa el grupo — CRÍTICO

`app/index.html:421-426` + `:445-449` + `servidor.js:176`

`revisar()` solo usa la ruta en navegador si `estado.textoInterpretado === estado.texto`. Al tocar «Corregir», editar el texto y volver a revisar, se va a `/api/extraer`, que reconstruye el borrador desde cero y le aplica `estado.respuestas` **completas**.

Escenario: 3 MR → foto de placa → `incorporarPlaca` separa en `[1 (serie X), 2]` y deja `estado.respuestas['quantity:0'] = 1` (`index.html:634`). El usuario corrige el nombre del hospital y revisa otra vez. El servidor devuelve un solo grupo de 3 MR y `aplicarRespuestas` le mete `quantity = 1`. **Quedan 1 de 3 unidades**, sin serie, sin grupo separado, y `preguntas()` ya no vuelve a preguntar la cantidad porque `quantity:0` está en `yaContestadas`. Además `estado.foto` (con `confirmado_por_colaborador`) sí viaja a `/api/guardar`.

**Corrección mínima:** al tomar la ruta de re-extracción, resetear `estado.respuestas = {}`, `estado.foto = null`, `estado.borrador = null` — los índices de grupo del borrador viejo ya no corresponden a los nuevos.

## 2 · La misma foto confirmada a dos grupos funde unidades — ALTA

`index.html:631-641` + `almacen.js:58-62`

`#usarFoto` no se desactiva ni se retira tras confirmar, y el `<select>` sigue vivo. Si la persona se equivoca de grupo y reconfirma sobre otro, `incorporarPlaca` no valida que la serie ya exista: escribe la misma `serial` en dos grupos. De 3 MR quedan `[1(X), 1(X), 1(—)]`. En `inventario()`, la regla nueva `o.serial === e.serial && manufacturer && model` los funde, y el merge **nunca suma `quantity`**: el tablero reporta 2 unidades. Un `agregado('modality')` pierde una unidad real.

**Corrección mínima:** en `incorporarPlaca`, antes de escribir, `if (c.serial && b.equipment.some((x, i) => i !== indice && x.serial === c.serial)) throw`.

## 3 · «Más de 10 años» se puede pisar hacia abajo — MEDIA

`reglas.js:54` devuelve `[11, null]`. `almacen.js:67` condiciona el merge solo a `existente.age_years_max == null`, así que una observación posterior de «3 a 7» sobrescribe `age_years_min: 11 → 3`: el equipo pasa de `reemplazar` a `planificar` y desaparece de `renovaciones()`. Igual, `incompletos()` (`:133`) sigue pidiendo edad de un equipo cuya edad ya se contestó.

**Corrección mínima:** condicionar a `existente.age_years_min == null && existente.age_years_max == null`, y usar `age_years_max ?? age_years_min` en `incompletos()` y `cliente360()` como ya se hizo en `renovaciones()`.

## 4 · Captura nueva sin nodo se pierde diciendo que se guardó — MEDIA

`index.html:277-281`: `encolar` devuelve `activoCola` **sin escribir** si ya hay una visita activa. Con una visita en revisión y el nodo caído, `verFoto`/`dictarBlob` llaman `encolar` y pintan «Foto guardada en el teléfono» / «Guardado aquí», pero nada entró a IndexedDB. **Mínimo:** que el corto-circuito aplique solo al reencolado del mismo ítem (`pendiente()`), no a capturas nuevas.

## 5 · Menor

`revision.js:17`: `Number('tres') → null` y la pregunta no vuelve (`yaContestadas`). Se arrastra del servidor, pero ahora también corre en navegador.
