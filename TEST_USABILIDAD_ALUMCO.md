# Test de usabilidad — Plataforma ALUMCO

Guion de sesiones y registro de observación. Complementa el análisis heurístico (`Analisis_heuristico_ALUMCO.xlsx`) contrastando los hallazgos de experta con el comportamiento de usuarias reales.

| | |
|---|---|
| **Producto** | ALUMCO — plataforma de capacitación interna (ONG ALUMCO) |
| **Método** | Test de usabilidad moderado, presencial, con tareas asignadas |
| **Participantes** | 3 |
| **Sesiones** | 4 bloques (colaborador, profesor, admin de sede, recorrido completo) |
| **Duración por sesión** | 25–50 min |
| **Instrumento previo** | Análisis heurístico de 10 pautas de Nielsen, promedio general 1,37 |

---

## 1. Objetivo

Verificar si los problemas detectados en el análisis heurístico se manifiestan cuando personas reales usan la plataforma, y detectar fricciones que la revisión de código no alcanza a ver.

Preguntas que guían el test:

1. ¿Una cuidadora sin experiencia previa completa un curso y obtiene su certificado sin ayuda?
2. ¿Una profesora crea y publica un curso siguiendo el asistente, sin abandonar ningún paso?
3. ¿Las esperas largas (generación con IA) se toleran o hacen que la usuaria crea que el sistema se colgó?
4. ¿Se usa la ayuda disponible, o pasa desapercibida?

---

## 2. Participantes

| Participante | Rango etario | Relación con ALUMCO | Rol probado | Perfil digital |
|---|---|---|---|---|
| **Cecilia Riquelme** | 35–45 | Administradora de ALUMCO | Recorrido completo: colaborador, profesor, admin de sede y jefatura | Usuaria experta del dominio; conoce el proceso de capacitación de punta a punta |
| **Ignacia Campos** | 18–34 | Colaboradora | Colaborador (se capacita) | Alta soltura digital; usa aplicaciones móviles a diario |
| **Andrea** | 45 o más | Equipo docente / gestión de sede | Profesor y admin de sede | Soltura digital media; uso habitual de planillas y correo |

**Nota sobre el perfil de Cecilia.** Al ser la administradora de ALUMCO, sus sesiones no sirven para medir descubribilidad: ya sabe dónde está todo. Su aporte es de validación de contenido y de recorrido completo, y aporta el punto de vista de quien recibe las consultas cuando algo falla.

---

## 3. Método y consideraciones

**Observación de conducta, sin pensamiento en voz alta forzado.** Se invitó a comentar, pero no se insistió. Ni Ignacia ni Andrea verbalizaron mucho durante las tareas, cosa habitual en tests con participantes que resuelven sin bloquearse. Por eso el registro de este informe se apoya en **conducta observable** —pausas, relecturas, clics repetidos, miradas al moderador, tiempo por tarea— y no en declaraciones.

**Convención del registro.** Cada anotación se marca como:

- **Observado** — hecho verificable en la sesión.
- **Lectura del equipo** — interpretación del equipo a partir de ese hecho. No es lo que dijo la participante.

Esta separación es deliberada: permite que un tercero revise el informe y distinga el dato de la inferencia.

**Métricas registradas por tarea:** completada sí/no · tiempo · número de pausas mayores a 5 s · ayuda solicitada al moderador · errores de camino (clics en un destino equivocado).

**Ambiente:** navegador de escritorio, datos de prueba, moderadora presente sin intervenir salvo bloqueo total de más de 2 minutos.

---

## 4. Guion de tareas

Las instrucciones se leen tal cual a la participante. Están redactadas por objetivo, nunca nombrando el botón que hay que pulsar, para no resolver la tarea al enunciarla.

### Bloque C — Colaborador *(Ignacia Campos · Cecilia Riquelme)*

| # | Instrucción a la participante | Éxito cuando… | Qué observar | Pauta |
|---|---|---|---|---|
| C1 | "Entra a la plataforma con las credenciales que te entregó tu organización." | Llega al panel de colaborador | Cómo escribe el RUT: con puntos y guion, o sin ellos | 5 |
| C2 | "Averigua qué capacitaciones tienes pendientes y para cuándo." | Nombra al menos un curso y su fecha de vencimiento | Si recurre al panel de inicio o al menú lateral | 1, 6 |
| C3 | "Revisa el contenido del curso de prevención de caídas." | Recorre los módulos y los marca como vistos | Si entiende que hay que marcar cada módulo | 1, 6 |
| C4 | "Rinde la evaluación del curso." | Envía la evaluación y ve su resultado | Si nota el aviso de intentos restantes | 1, 9 |
| C5 | "Consigue tu certificado en PDF." | El archivo queda descargado | **Si sabe que la descarga ocurrió** | 1 |
| C6 | "Cambia tu contraseña." | Contraseña actualizada | Si encuentra la opción sin ayuda | 4 |
| C7 | "Si el texto te resultara chico, ¿qué harías?" | Encuentra los controles de accesibilidad | Si descubre los botones A+ y contraste del topbar | 7, 10 |

### Bloque P — Profesor *(Andrea · Cecilia Riquelme)*

| # | Instrucción a la participante | Éxito cuando… | Qué observar | Pauta |
|---|---|---|---|---|
| P1 | "Crea un curso nuevo sobre traslado seguro de residentes." | Curso creado, avanza al paso 2 | Si el indicador de pasos le deja claro cuánto falta | 6 |
| P2 | "Sube el material de estudio del curso." | Al menos un módulo cargado | Reacción al tiempo de subida | 1 |
| P3 | "Carga las preguntas de la evaluación." | Preguntas guardadas | Si entiende cómo marcar la alternativa correcta | 2 |
| P4 | "Define a quiénes va dirigido y publícalo." | Curso publicado | Si advierte que al marcar estamentos el curso pasa a ser obligatorio | 3 |
| P5 | "Revisa los certificados pendientes y resuelve el de Marta Soto." | Aprueba o rechaza | **Cuánto se demora en confirmar un rechazo** | 3, 9 |
| P6 | "Asigna el curso recién creado a tu equipo." | Asignación hecha | Si busca una forma de asignar a varios de una vez | 7 |

### Bloque A — Admin de sede *(Andrea · Cecilia Riquelme)*

| # | Instrucción a la participante | Éxito cuando… | Qué observar | Pauta |
|---|---|---|---|---|
| A1 | "Revisa si hay algo que requiera tu atención en la sede hoy." | Identifica las alertas | Si consulta el significado de "doble fallo" | 2, 10 |
| A2 | "Averigua quiénes están al día con sus capacitaciones obligatorias." | Nombra la cifra o el listado | Si entiende el término "capacitados al día" | 2 |
| A3 | "Genera un curso a partir de este protocolo en PDF." | Borrador generado | **Qué hace durante la espera** | 1 |
| A4 | "Programa un práctico presencial para la próxima semana." | Práctico creado | Si detecta qué campos son obligatorios antes de enviar | 5 |
| A5 | "Revisa los certificados emitidos en tu sede este mes." | Llega al listado filtrado | Si conserva el filtro al volver de un detalle | 6 |

### Bloque J — Recorrido completo *(solo Cecilia Riquelme)*

Sesión larga, sin cronómetro por tarea: recorrer los cuatro roles de forma encadenada para detectar problemas que solo aparecen con uso sostenido —expiración de sesión, pérdida de contexto al navegar, coherencia entre paneles— y validar que el contenido de los cursos y los certificados se ajusta a lo que la ONG necesita.

---

## 5. Registro de las sesiones

### 5.1 Ignacia Campos — Colaborador

**Duración:** 26 min · **Tareas completadas:** 7 de 7 · **Ayuda solicitada:** ninguna

Sesión sin bloqueos. Resolvió todas las tareas por el camino esperado y a buen ritmo. Comentó poco por iniciativa propia; al cerrar la sesión dijo que le había parecido fácil de usar.

| Tarea | Tiempo | Resultado | Registro |
|---|---|---|---|
| C1 | 0:18 | ✅ | **Observado:** escribió el RUT sin puntos ni guion y el sistema lo aceptó sin objetar el formato. |
| C2 | 0:25 | ✅ | **Observado:** fue directo al panel de inicio y nombró el curso y su fecha sin dudar. |
| C3 | 4:12 | ✅ | **Observado:** recorrió los módulos en orden y usó "Marcar como visto" en cada uno sin necesitar indicación. |
| C4 | 3:40 | ✅ | **Observado:** aprobó al primer intento. Se detuvo unos segundos en el aviso "Intentos restantes: 2/2" antes de comenzar. |
| C5 | 1:05 | ✅ | **Observado:** pulsó el botón de descarga, esperó unos segundos mirando la pantalla y **volvió a pulsarlo**. El PDF se había descargado con el primer clic; la interfaz no mostró nada. |
| C6 | 0:40 | ✅ | **Observado:** encontró la opción en el menú del avatar al primer intento. |
| C7 | 0:22 | ✅ | **Observado:** ubicó los botones A+ y contraste tras recorrer el topbar con la vista. No los había usado en ninguna tarea anterior. |

**Lectura del equipo.** El doble clic de C5 es el síntoma de campo del ítem 11 de la pauta 1: descargar un certificado no confirma nada en la interfaz. Ignacia no se equivocó de botón; el sistema no le dijo que había funcionado. En el registro de un colaborador esto genera certificados descargados dos veces y, en el peor caso, la sensación de que el trámite no quedó hecho.

En C1, que el RUT sin formato sea aceptado no causó problema porque era correcto. El riesgo aparece con un RUT mal digitado: hoy no hay validación de formato en el cliente y el error solo llega desde el servidor como credenciales incorrectas.

Que no abriera nunca el panel de ayuda no significa que sobre: significa que no lo necesitó en el flujo del colaborador, que es el más corto de los cuatro.

---

### 5.2 Andrea — Profesor y admin de sede

**Duración:** 2 sesiones, 31 y 24 min · **Tareas completadas:** 11 de 11 · **Ayuda solicitada:** ninguna

Trabajó con método, releyendo las pantallas antes de actuar. Ritmo más pausado que Ignacia, sin bloqueos ni abandonos. Comentarios espontáneos escasos.

#### Bloque P — Profesor

| Tarea | Tiempo | Resultado | Registro |
|---|---|---|---|
| P1 | 2:05 | ✅ | **Observado:** envió el formulario con el nombre del curso vacío y recibió "El nombre es obligatorio". Lo completó y siguió. Antes de enviar, nada en el formulario distinguía ese campo de los demás. |
| P2 | 3:20 | ✅ | **Observado:** subió el archivo sin dudar. Durante la carga permaneció atenta a la pantalla. |
| P3 | 4:40 | ✅ | **Observado:** cargó tres preguntas. Usó "Atrás" una vez para corregir el paso anterior y volvió sin perder lo escrito. |
| P4 | 1:25 | ✅ | **Observado:** marcó dos estamentos y publicó. No se detuvo en el texto que indica que el curso quedará como obligatorio para ellos. |
| P5 | 2:10 | ✅ | **Observado:** ante un rechazo, se detuvo **cerca de 8 segundos** en el diálogo de confirmación, releyó el mensaje y recién entonces confirmó. |
| P6 | 1:45 | ✅ | **Observado:** asignó a los colaboradores de a uno. En dos ocasiones recorrió la pantalla con la vista como buscando otra cosa antes de continuar. |

#### Bloque A — Admin de sede

| Tarea | Tiempo | Resultado | Registro |
|---|---|---|---|
| A1 | 0:35 | ✅ | **Observado:** identificó las alertas de inmediato y abrió el ícono de ayuda junto a "doble fallo" para confirmar el significado. |
| A2 | 0:30 | ✅ | **Observado:** leyó la cifra y consultó también el ícono de ayuda de "capacitados al día". |
| A3 | 3:10 | ✅ | **Observado:** la pantalla anunciaba 30–60 segundos. Alrededor del **minuto y diez** miró a la moderadora, en silencio, como consultando si seguía funcionando. No recargó ni canceló. La generación terminó a los 3:10. |
| A4 | 2:20 | ✅ | **Observado:** completó el formulario de práctico. Ningún campo indicaba ser obligatorio; los llenó todos por precaución. |
| A5 | 1:50 | ✅ | **Observado:** filtró el listado, entró a un certificado y al volver el filtro se había perdido. Lo volvió a aplicar sin comentar. |

**Lectura del equipo.** Las tres observaciones más valiosas de la sesión son conductuales, no verbales:

- **A3 es la fricción más clara de todo el test.** El sistema prometió un minuto y tardó más de tres. Andrea no abandonó, pero la mirada al moderador marca el punto donde dejó de confiar en que el proceso seguía vivo. En uso real no hay moderadora que confirme, y ahí es donde el usuario recarga la página. Es exactamente el ítem 10 de la pauta 1, el peor puntuado de esa sección.
- **La pausa de 8 segundos en P5** indica que el diálogo de confirmación está haciendo bien su trabajo, pero también que carga toda la decisión en ese instante: como no existe forma de revertir un rechazo, la única defensa de la usuaria es leer con cuidado. Un deshacer de 5 segundos le quitaría ese peso.
- **P1 y A4 son la misma carencia** vista desde dos formularios: los campos obligatorios no se distinguen antes de enviar. Andrea lo resolvió llenándolo todo, que es una estrategia defensiva razonable y también una señal de que la interfaz no la está guiando.

Que consultara los íconos de ayuda en A1 y A2 confirma que el componente funciona y se usa cuando está presente. El problema, como se verá, es dónde no está.

---

### 5.3 Cecilia Riquelme — Recorrido completo

**Duración:** 50 min · **Rol:** administradora de ALUMCO · **Cobertura:** los cuatro roles

Usuaria experta: recorrió los flujos sin necesitar descubrirlos. Su sesión aporta lo que las otras dos no pueden —problemas de uso sostenido— y la mirada de quien va a recibir las consultas cuando la plataforma esté en producción.

**Hallazgos de la sesión:**

- **Expiración de sesión.** Cerca del minuto 40, revisando el panel de jefatura con un filtro aplicado, la sesión expiró. La plataforma la devolvió al login sin ningún mensaje y, al reingresar, aterrizó en el panel de inicio con el filtro perdido. **Lectura del equipo:** es el ítem peor puntuado de la pauta 9. En una sesión de trabajo real esto significa perder el hilo de una revisión larga sin entender por qué.
- **Filtros que no sobreviven.** El mismo comportamiento que Andrea encontró en A5 se repitió en gestión de usuarios y en certificados globales. Con una sede chica es una molestia; con el padrón completo de la ONG obliga a rehacer la búsqueda cada vez.
- **Exportación a Excel.** Funcionó sin problemas y Cecilia la señaló como la vía por la que hoy resuelve las comparaciones entre sedes.
- **Ausencia de canal de soporte.** Al recorrer el flujo del colaborador, Cecilia notó que la ayuda remite a "contacta al encargado de tu ELEAM" sin entregar ningún medio de contacto. **Lectura del equipo:** es la consulta que va a llegarle a ella por vías informales —teléfono personal, mensajería— precisamente porque la plataforma no ofrece un camino formal.
- **Contenido y certificados.** Validó que los módulos generados, las evaluaciones y el PDF del certificado se ajustan a lo que la ONG necesita presentar. Sin observaciones de fondo.

---

## 6. Hallazgos consolidados

| # | Hallazgo | Evidencia en el test | Participantes | Pauta | Tarea del plan |
|---|---|---|---|---|---|
| 1 | La espera de la generación con IA se anuncia mal y no muestra progreso | A3: anunciado 30–60 s, real 3:10; mirada de consulta al minuto 1:10 | Andrea | 1 | A3, B1 |
| 2 | La descarga de certificado no confirma nada | C5: doble clic sobre un botón que ya había funcionado | Ignacia | 1 | A2 |
| 3 | Los campos obligatorios no se distinguen antes de enviar | P1: envío con campo vacío. A4: llenó todo por precaución | Andrea | 5 | B4 |
| 4 | No hay forma de revertir una acción de alto costo | P5: 8 s de relectura antes de confirmar un rechazo | Andrea | 3 | B2 |
| 5 | La sesión expira sin explicación y se pierde el contexto | Minuto 40 de la sesión de recorrido completo | Cecilia | 9 | B3 |
| 6 | Los filtros no sobreviven a la navegación | A5 y dos listados más en el recorrido completo | Andrea, Cecilia | 6 | C2 |
| 7 | No existe canal de soporte dentro de la plataforma | Detectado al recorrer el flujo del colaborador | Cecilia | 10 | B7 |
| 8 | El RUT se acepta sin validar formato | C1: ingresado sin puntos ni guion | Ignacia | 5 | B4 |

**Los ocho hallazgos ya estaban en el análisis heurístico.** El test no agregó problemas nuevos; confirmó cuáles de los detectados en la revisión de código llegan efectivamente a molestar a una usuaria. Eso permite reordenar el plan de acción por evidencia y no solo por criterio de experta.

### Lo que el test confirmó como bien resuelto

- **Indicador de pasos del asistente de curso.** Andrea usó "Atrás" para corregir y volvió sin perder datos. Ninguna de las cuatro etapas se abandonó.
- **Diálogos de confirmación.** Cumplen su función: la pausa antes de rechazar demuestra que el usuario se detiene a leer.
- **Tooltips de términos internos.** Andrea los consultó espontáneamente en las dos tareas donde estaban disponibles. Es el argumento más fuerte para extenderlos al resto de las pantallas.
- **Aviso de intentos restantes.** Ignacia se detuvo a leerlo antes de rendir la evaluación.

### Tasa de éxito

| Bloque | Tareas | Completadas | Abandonos | Ayuda pedida |
|---|---|---|---|---|
| Colaborador | 7 | 7 | 0 | 0 |
| Profesor | 6 | 6 | 0 | 0 |
| Admin de sede | 5 | 5 | 0 | 0 |
| **Total** | **18** | **18 (100 %)** | **0** | **0** |

Una tasa de éxito del 100 % con cero solicitudes de ayuda indica que la plataforma es utilizable en sus flujos principales. Las fricciones detectadas no impiden completar las tareas: **degradan la confianza en que la tarea se completó**, que es un problema distinto y más difícil de ver sin observación directa.

---

## 7. Reordenamiento del plan de acción

A la luz del test, tres tareas del plan suben de prioridad porque tienen evidencia de campo:

1. **A2 — eliminar el `alert()` y confirmar la descarga.** Es una hora de trabajo y resuelve el hallazgo 2, el único que produjo una acción errónea de la usuaria.
2. **A3 + B1 — la espera de la IA.** Corregir el texto es inmediato; el progreso por etapas es la mejora de mayor impacto observado.
3. **B4 — campos obligatorios y validación de RUT.** Aparece en dos participantes y tres formularios distintos.

Se mantiene en su lugar el resto del plan. Nada de lo observado justifica adelantar el Bloque C.

---

## 8. Limitaciones

- **Tres participantes**, una por rol, salvo el recorrido completo. Suficiente para detectar problemas de usabilidad gruesos, insuficiente para cuantificar.
- **Cecilia Riquelme no es usuaria neutral**: conoce la plataforma y el dominio. Sus sesiones no miden descubribilidad.
- **Ni Ignacia ni Andrea verbalizaron mucho.** El registro descansa en conducta observable, y las lecturas del equipo son inferencias explícitamente marcadas como tales, no declaraciones de las participantes.
- **Solo escritorio.** No se probó en teléfono, pese a que la plataforma tiene comportamiento responsive definido y buena parte de las cuidadoras podría usarla desde el móvil. **Es la brecha más importante de esta ronda.**
- **Sin usuarias mayores de 60**, tramo relevante en el personal de un ELEAM.

---

## Anexo A — Plantilla de registro por tarea

```
Participante: ______________  Bloque: ____  Tarea: ____
Inicio: __:__   Fin: __:__   Duración: __:__

[ ] Completada sin ayuda   [ ] Completada con ayuda   [ ] Abandonada

Pausas > 5 s (cantidad y dónde): ______________________________
Clics en destino equivocado: __________________________________
Ayuda solicitada (textual): ___________________________________

OBSERVADO (solo hechos):
_______________________________________________________________

LECTURA DEL EQUIPO (inferencia, no es lo que dijo la participante):
_______________________________________________________________
```

## Anexo B — Consentimiento informado

Antes de cada sesión se explicó a la participante que:

- Se evalúa la plataforma, no a ella; no hay respuestas correctas ni incorrectas.
- Puede detenerse en cualquier momento y sin dar explicaciones.
- El registro se usa solo para mejorar la plataforma dentro del proyecto ALUMCO.
- Puede comentar lo que quiera mientras trabaja, sin obligación de hacerlo.
