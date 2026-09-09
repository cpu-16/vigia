# Guion del video — Vigía (≤ 5:00, en español)

> El video es **lo primero que revisa el jurado** (TyC art. 12.b). Cinco jurados distintos lo van
> a ver buscando cosas distintas: el general mira si QVAC se usa de verdad, Philips mira si la
> captura sirve en campo, Tether mira si el modelo Psy es central, Caja mira si el banco podría
> usarlo, Ovnicom mira si corre sobre el flujo y si nada sale de su infraestructura.
> Por eso el orden no es cronológico: es **una escena por jurado, y una escena común que los
> convence a todos**.

## Regla de oro de este video

Nada de diapositivas con texto. Cada afirmación se ve pasando en pantalla, en vivo, con el
teléfono en una mano y la laptop al fondo **en la misma toma**. Si algo no se puede mostrar, no
se dice.

---

## 0:00 – 0:20 · El problema, con una escena, no con una frase

**Se ve:** una persona saliendo de un hospital, guardando el celular. Corte a una libreta con
notas a mano. Corte a la app abriéndose.

**Se dice:**
> «Cada día, alguien entra a un hospital y ve lo que hay: cuántos resonadores, de qué marca, qué
> tan viejos. Ese conocimiento se queda en su cabeza. Y no puede salir a la nube, porque son
> datos del cliente. Vigía convierte esa visita en datos confiables sin que nada salga de aquí.»

**Grabar:** con el celular en la mano de otra persona, luz de día. 3 tomas, la mejor.

---

## 0:20 – 1:35 · Equipos · para Philips y para Tether

### 0:20 – 0:50 · Hablar y que entienda

**Se ve:** el anillo late, se dicta el reporte, y al soltar aparece **lo dicho con la evidencia
subrayada** y las filas del inventario. Abajo, el pie técnico con el id de la solicitud.

**Se dice, mientras pasa:**
> «Le hablo como le hablaría a un compañero.»
> *(dictar)* «Estoy en Hospital DemoCare Pacific, en Panamá. Tienen dos resonadores y un
> tomógrafo. Uno de los resonadores parece de unos ocho años.»
> «Dos segundos. Y fíjense en lo subrayado: cada dato que guardó está anclado a las palabras que
> yo dije. Lo que no dije, no está.»

**El detalle que hay que enseñar:** en el pie técnico se ve `descartado por falta de evidencia:
manufacturer=NovaMed`. Decirlo:
> «El modelo quiso poner una marca que yo nunca mencioné. El sistema la botó. El modelo propone;
> las reglas deciden.»

### 0:50 – 1:10 · La placa, con el modelo Psy · **esta escena es del track 02**

**Se ve:** foto de una placa sintética. Aparecen las líneas transcritas y, al lado, cada campo
con **de dónde salió**: «serie: del código impreso», «marca: impresa en la placa».

**Se dice:**
> «Esta placa la lee VisionPsy, el modelo de visión de QVAC, de 460 millones de parámetros: cabe
> en un teléfono. No le pido que adivine campos, le pido que transcriba. Los campos los saca el
> código del identificador impreso, que trae el producto y el número de serie. Sobre veinte
> placas: la serie, veinte de veinte. Y aun así no se confirma solo: yo tengo que aceptarlo.»

### 1:10 – 1:35 · Dos personas, un solo equipo · **el momento fuerte**

**Se ve:** el celular de un segundo compañero reporta el mismo hospital. En la laptop, el tablero
muestra que **no se duplicó**: el mismo equipo, ahora con dos fuentes, y la explicación campo por
campo (`+sitio +modalidad +marca −edad`, 98 %).

**Se dice:**
> «Dos personas visitaron el mismo hospital. El inventario no dice cuatro resonadores: dice dos,
> confirmados por dos fuentes independientes. Y muestra por qué lo decidió así, campo por campo.
> Eso es lo que hoy no tiene nadie: no es que capture más, es que **no infla**.»

---

## 1:35 – 2:15 · Sucursal · para Caja de Ahorros

**Se ve:** se apaga el Wi-Fi en cámara. El empleado describe una contingencia. Salen los pasos
**con la cita textual de la guía**, se llena el expediente, se emite el acta y se verifica.
Después, una pregunta que la guía no cubre → se abstiene.

**Se dice:**
> «Se cayó el enlace con el central. Sin internet, el sistema responde con el procedimiento
> exacto y su cita. Y cuando le pregunto algo que la guía no cubre, no inventa: se abstiene.
> Diecisiete de veinte consultas correctas, y las cinco que no estaban en la guía, cinco
> abstenciones de cinco. El acta queda firmada y se verifica sin servidor.»

**Ojo:** decir «banco ficticio, guía sintética» una vez, en pantalla y en voz.

---

## 2:15 – 3:05 · Red · para Ovnicom

**Se ve:** el flujo de consultas corriendo. Entra una ráfaga inyectada. El detector la marca,
QVAC redacta el caso con la evidencia, **la alerta aparece en Wazuh**, y en Grafana una zona cae
de calidad con sus tres componentes visibles.

**Se dice:**
> «Este es el flujo real de consultas que nos entregaron, corriendo como flujo, no como archivo.
> Inyecto tráfico malicioso etiquetado para poder medirme. Las reglas detectan; el modelo local
> redacta el caso para el operador y no decide nada. La alerta entra a Wazuh en su formato. Y el
> puntaje de experiencia por zona muestra sus tres componentes, para que un operador de red lo
> pueda leer.»

**La frase honesta que hay que decir:**
> «Las consultas son reales; la latencia y los códigos de respuesta los generamos nosotros,
> porque el registro entregado no los trae. Cada fila lo dice.»

---

## 3:05 – 4:20 · La escena común · **esta convence a los cinco jurados**

Es la más importante. Una sola toma continua, sin cortes, el celular en una mano y la pantalla de
la laptop al fondo.

**3:05 – 3:30 · El teléfono es un par, no un cliente**

**Se ve:** la terminal del teléfono muestra el SDK de QVAC corriendo dentro de Termux y la llave
pública del proveedor. Se dicta desde el teléfono. En la laptop, **la misma solicitud aparece en
la terminal del proveedor en ese instante**.

> «El teléfono no está mandando el audio a un servidor. El SDK de QVAC corre dentro del teléfono
> y le pide el cómputo a esta laptop por su llave pública, punto a punto. Mismo identificador de
> solicitud en las dos pantallas.»

**3:30 – 3:50 · Se apaga el par**

**Se ve:** se mata el proveedor en cámara. Se dicta otra vez. El teléfono responde **más lento**,
con el modelo de 600 millones a bordo, y **avisa** que degradó.

> «Apago la laptop. El teléfono sigue trabajando con su modelo pequeño: más lento, menos preciso,
> y lo dice. Es la diferencia entre un sistema que se cae y uno que degrada con honestidad.»

**3:50 – 4:20 · Nada sale de aquí**

**Se ve:** el contador de la regla del cortafuegos en cero. Se hacen varias inferencias. Sigue en
cero. Después, un `curl` a internet **sí** mueve el contador.

> «Este contador cuenta cada byte que sale de esta máquina hacia afuera. Hago inferencias: sigue
> en cero. Y para que no crean que el contador está roto —» *(corre el curl)* «— ahí sí se mueve.»

**Esto es un control positivo y es lo que separa una demostración de una promesa.**

---

## 4:20 – 5:00 · Lo medido y lo que falta

**Se ve:** una sola pantalla con la tabla de números y, abajo, la lista de límites.

**Se dice:**
> «Todo lo que mostramos está medido y en el repositorio: cada inferencia deja su línea con
> modelo, hardware, si corrió aquí o en el par, tokens y tiempo hasta el primer token.
> Y lo que todavía no hace: [decir dos límites reales].
> Esto lo construimos en las cuarenta y ocho horas sobre una librería propia previa que está
> declarada en el README, como manda el reglamento.»

---

## Números que van en pantalla (solo estos, y solo si están medidos)

| Qué | Cuánto |
|---|---|
| Extracción de un reporte dictado | 1.9 s |
| Los 10 prompts oficiales de Philips + español + portugués | 12 / 12 |
| Placa: número de serie sobre 20 placas | 20 / 20 |
| Placa: modelo, marca, modalidad | 19 / 20 · 18 / 20 · 19 / 20 |
| Sucursal: consultas correctas | 17 / 20 |
| Sucursal: abstenciones cuando la guía no cubre | 5 / 5 |
| Delegación al par: extracción | 1.88 s a 94 tok/s |
| Bytes que salen de la máquina durante la demo | 0 |

## Cómo grabarlo

1. **Una toma continua por escena.** Nada de montaje que pueda parecer trucado.
2. **Micrófono del teléfono, no auriculares Bluetooth** (fallaron el 8-sep).
3. **Apagar todo lo que use la GPU antes de grabar.** Solo el proceso que se va a mostrar.
4. **Grabar la escena común de último**, cuando ya todo esté firme; es la que más se repite.
5. **Ensayo completo el 10 a las 18:00. Grabar 19:00 a 20:30. Entregar 22:00**, con la madrugada
   como margen y no como jornada.
6. Subir a YouTube **como no listado**, y comprobar el enlace desde una ventana privada: el
   reglamento exige que se abra sin credenciales.

## Lo que NO va en el video

- El motor de recuperación heredado, el carrusel de modelos y el catálogo completo: dispersan.
- Cualquier número que no se pueda mostrar en pantalla mientras se dice.
- La palabra «cero errores». Se dice «medido sobre veinte casos» y se enseña la tabla.
