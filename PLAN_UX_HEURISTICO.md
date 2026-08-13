# Plan de acción — Análisis heurístico ALUMCO

Deriva de dos fuentes: `Analisis_heuristico_ALUMCO.xlsx` (10 pautas de Nielsen, 52 ítems, promedio general **1.37**) y las sesiones de test de usuario registradas en `Script (guion) - ALUMCO.docx`.
Mismas convenciones que `IMPLEMENTATION_PLAN.md`: cada tarea es autocontenida, con archivos, pasos y criterio de aceptación.

> **Reglas heredadas del repo**
> - No agregar dependencias salvo que la tarea lo indique.
> - Toda llamada al backend pasa por `client/src/services/api.js`.
> - Los cambios de esquema van en `server/src/config/migrate.js` (idempotentes).

**Orden sugerido:** Bloque A (una tarde, riesgo cero) → Bloque B (deuda que duele al usuario) → Bloque C (estructural).

El **Bloque D** es aparte: son requerimientos de funcionalidad nueva levantados en las sesiones con la clienta, no defectos de usabilidad. Su prioridad la define ALUMCO, no este plan.

---

## Bloque A — Arreglos rápidos

Cinco tareas de menos de una hora cada una. Todas tocan un archivo y ninguna cambia estructura.

### A1 — Corregir el voseo rioplatense

**Por qué:** la plataforma tutea en todas partes menos en dos frases. Para un cuidador de un ELEAM chileno suenan ajenas.

**Archivos:**

- `client/src/pages/GeneradorIA.jsx:746` — `Si no elegís, lo asignaremos automáticamente` → `Si no eliges, lo asignaremos automáticamente`
- `client/src/pages/GestionSedes.jsx:128` — `Creá la primera con el botón de arriba` → `Crea la primera con el botón de arriba`

**Aceptación:** `grep -rn "elegís\|Creá\|podés\|tenés\|hacé" client/src/` no devuelve nada.

---

### A2 — Eliminar el último `alert()` nativo

**Por qué:** la descarga de certificados es la acción final del colaborador y falla con un cuadro gris del navegador que vuelca el texto crudo del servidor.

**Archivos:** `client/src/services/api.js:38-63`

**Implementación:**

- `descargarCertificado` no puede usar `useToast` porque no es un componente. Cambiar su firma a `descargarCertificado(certId, nombreArchivo, toast)` y pasar el toast desde las tres páginas que la llaman.
- Reemplazar `alert(...)` de la línea 60 por `toast.error('No pudimos generar tu certificado. Inténtalo de nuevo; si el problema sigue, avisa a tu administrador de sede.')`.
- Dejar el detalle técnico solo en `console.error`.
- Añadir `toast.success('Certificado descargado')` tras el `a.click()`.

**Llamadores a actualizar:** `MisCertificados.jsx:126`, `CertificadosGlobales.jsx`, `Profesor.jsx`.

**Aceptación:** `grep -rn "alert(" client/src/ | grep -v "role=\|triangle-alert\|alert-circle"` no devuelve nada. Descargar un certificado válido muestra toast verde; forzar un 500 muestra toast rojo.

---

### A3 — Sincerar el tiempo de espera del generador de IA

**Por qué:** la pantalla promete 30–60 segundos y el propio comentario del código estima ~3 minutos típicos y ~1.300 s en el peor caso. El usuario cree que se colgó y recarga.

**Archivos:** `client/src/pages/GeneradorIA.jsx:784-785`

**Implementación:** cambiar el texto a `Esto suele tomar entre 2 y 5 minutos. Puedes dejar esta pestaña abierta.` Es un parche de honestidad; el progreso real va en B1.

**Aceptación:** el texto refleja el rango que sostiene el timeout de `api.js:7`.

---

### A4 — Botón de cancelar en la generación de IA

**Por qué:** el `AbortController` ya está implementado y funcionando, pero no hay ningún control visible que lo dispare. Es una salida gratis.

**Archivos:** `client/src/pages/GeneradorIA.jsx:489-491, 764-770`

**Implementación:** mientras `cargando` sea true, renderizar junto al bloque de espera un botón `Cancelar generación` que llame `abortRef.current.abort()` y ponga `cargando` en false. El `catch` ya ignora `ERR_CANCELED`, así que no hace falta tocar el manejo de error.

**Aceptación:** lanzar una generación y cancelarla devuelve el formulario a su estado inicial sin toast de error.

---

### A5 — Borrar el código duplicado muerto

**Por qué:** `client/src/services/App.jsx` y `client/src/services/pages/` son copias antiguas que ya divergieron de las vivas. Tarde o temprano alguien edita la equivocada.

**Archivos a eliminar:** `client/src/services/App.jsx`, `client/src/services/pages/GestionUsuarios.jsx`, `client/src/services/pages/NuevoCurso.jsx`

**Aceptación:** `npm run build` en `client/` compila sin errores tras el borrado.

---

## Bloque B — Lo que más le cuesta al usuario

### B1 — Progreso real en la generación con IA

**Por qué:** es la espera más larga de la plataforma y hoy es opaca. La mascota animada no dice si va por el módulo 2 o el 6.

**Archivos:**

- `server/src/routes/ia.js` — emitir eventos de etapa
- `client/src/pages/GeneradorIA.jsx:781-787` — consumirlos

**Implementación:**

- En el servidor, convertir `POST /ia/generar-curso` en respuesta SSE (`text/event-stream`) o exponer `GET /ia/progreso/:jobId` para polling cada 3 s. SSE es preferible: no requiere tabla nueva.
- Emitir cuatro etapas: `extrayendo` → `generando_modulo` (con `actual` y `total`) → `generando_evaluacion` → `listo`.
- En el cliente, reemplazar el bloque de espera por una barra de progreso más la etiqueta de etapa: `Generando módulo 3 de 7`.
- Mantener la mascota como acompañamiento, no como único indicador.

**Aceptación:** durante una generación real la pantalla avanza de etapa al menos cuatro veces y la barra nunca retrocede.

---

### B2 — Deshacer en las acciones de alto coste

**Por qué:** `toast.undo` está construido, probado y se usa **una sola vez** en toda la aplicación. Si un profesor rechaza por error un certificado, el colaborador tiene que rendir la evaluación de nuevo.

**Archivos:**

- `client/src/context/ToastContext.jsx:41-43` — ya listo, no tocar
- `client/src/pages/Profesor.jsx:366-372` — rechazar certificado
- `client/src/pages/AsignarCurso.jsx` — desasignar curso
- `client/src/pages/Protocolos.jsx:54` — eliminar protocolo

**Implementación:**

- Para cada acción, exponer en el backend el endpoint inverso (o un `PATCH` de estado que revierta) y llamarlo desde el callback de `toast.undo` dentro de la ventana de 5 s.
- Ejemplo de referencia ya existente: `GestionUsuarios.jsx:176`.
- Registrar tanto la acción como su reversión en `audit_log`; para la ONG importa la trazabilidad de quién revirtió qué.
- Donde la reversión sea imposible a nivel de datos (descartar borrador de IA), **no** usar undo: mantener el `confirm()` y decirlo en el mensaje, como ya hace `GeneradorIA.jsx:566`.

**Aceptación:** rechazar un certificado y pulsar Deshacer devuelve el certificado a estado pendiente y el colaborador no pierde su intento.

---

### B3 — Sesión expirada con explicación

**Por qué:** el interceptor detecta un 401, borra el token y hace `window.location.href = '/login'`. El usuario pierde lo que estaba escribiendo y aterriza en el login sin saber por qué.

**Archivos:** `client/src/services/api.js:19-27`, `client/src/pages/Login.jsx`

**Implementación:**

- Antes de redirigir, guardar en `sessionStorage` el motivo (`sesion_expirada`) y la ruta de origen (`window.location.pathname`).
- Usar `window.location.replace('/login?expirada=1')` en vez de `href`, para que el botón Atrás no vuelva a una vista muerta.
- En `Login.jsx`, si el parámetro está presente, mostrar un aviso ámbar: `Tu sesión expiró por inactividad. Vuelve a ingresar y te llevamos donde estabas.`
- Tras un login exitoso, si hay ruta guardada y el rol tiene permiso sobre ella, navegar ahí en vez de a la home del rol.

**Aceptación:** con el token vencido a mano, recargar una vista profunda lleva al login con el aviso, y tras reingresar se vuelve a esa misma vista.

---

### B4 — Campos obligatorios y validación de formato

**Por qué:** es el ítem peor evaluado de prevención de errores. El RUT es la credencial de acceso y no se valida su formato; el asterisco aparece en dos formularios de siete y sin leyenda que lo explique. En el test de usuario apareció además un caso que la revisión de código no había detectado, descrito en B4.1.

**Archivos:** `client/src/pages/Login.jsx` (referencia correcta), `NuevoCurso.jsx:196`, `Practicos.jsx`, `GestionSedes.jsx`, `Protocolos.jsx`, `GestionUsuarios.jsx`, `MisDatos.jsx`

**Implementación:**

- Crear `client/src/utils/validacion.js` con `validarRut(rut)` (módulo 11 con dígito verificador) y `validarEmail(email)`. Sin dependencias.
- Crear un componente `<CampoObligatorio>` o, más simple, estandarizar el patrón ya correcto de `Login.jsx:98`: etiqueta + `<span aria-hidden="true">*</span>` en rojo + atributo `required` en el input.
- Añadir al inicio de cada formulario la leyenda `* campo obligatorio`.
- Validar en `onBlur`, no solo al enviar, para que el error aparezca donde el usuario todavía está mirando.
- Aplicar `validarRut` en el alta de usuario de `GestionUsuarios.jsx` y en el login.

**Aceptación:** los siete formularios marcan sus obligatorios igual; un RUT con dígito verificador incorrecto se rechaza en el cliente con mensaje específico.

---

### B4.1 — El estamento se guarda vacío y deja al colaborador sin capacitaciones

> **Prioridad alta.** No es solo un problema de formulario: tiene consecuencias sobre los datos y sobre el cumplimiento de la capacitación obligatoria.

**Por qué:** detectado en el test de usuario, sesión de Andrea, Tarea 2. Al crear un colaborador dejó el estamento sin seleccionar porque nada indicaba que fuera obligatorio, y el sistema guardó el usuario sin objetar. La cadena completa lo permite:

- `client/src/pages/GestionUsuarios.jsx:145-147` valida solo `nombre`, `rut` y `rol`.
- `client/src/pages/GestionUsuarios.jsx:361-362` el select arranca en `''` con la opción "Seleccionar estamento".
- `server/src/routes/usuarios.js:229` pasa el valor por `resolveEstamentoId`, que devuelve `null` si viene vacío.
- `server/src/config/migrate.js:59` la columna es `estamento_id INT DEFAULT NULL`, así que la base lo acepta.

El efecto no se ve al crear el usuario, sino después: las capacitaciones obligatorias se reparten por estamento a través de `curso_estamentos`, y `NuevoCurso.jsx:98` marca un curso como obligatorio para los estamentos seleccionados. Un colaborador sin estamento **no entra en ningún reparto**. Nadie lo nota hasta que alguien pregunta por qué esa persona no tiene cursos pendientes, y para entonces lleva semanas sin capacitarse mientras los reportes de cobertura la cuentan como si estuviera al día.

**Archivos:**

- `client/src/pages/GestionUsuarios.jsx:145-147, 361-362`
- `server/src/routes/usuarios.js:214-236` (alta individual) y `:186-200` (carga masiva)
- `server/src/config/migrate.js`

**Implementación:**

- **Cliente:** marcar el estamento como obligatorio con el mismo patrón de B4 y agregarlo a la validación de `handleCrear`.
- **Servidor:** rechazar el alta con 400 y mensaje explícito si `estamento` viene vacío. La validación de cliente sola no basta: la API queda igual de expuesta y la carga masiva no pasa por el formulario.
- **Carga masiva:** en la importación por planilla, rechazar la fila con estamento vacío indicando número de fila, en vez de insertarla con `null`.
- **Datos existentes:** antes de desplegar, correr un `SELECT` de usuarios con `estamento_id IS NULL` y resolverlos con ALUMCO. No poner la columna en `NOT NULL` hasta haberlos corregido, o la migración va a fallar en producción.
- **Detección:** agregar a la vista de jefatura un contador de colaboradores sin estamento, para que el problema sea visible si vuelve a ocurrir por otra vía.

**Aceptación:** crear un usuario sin estamento falla tanto desde el formulario como llamando directo a `POST /api/usuarios`; la consulta de usuarios con `estamento_id IS NULL` devuelve cero filas.

---

### B5 — Notificaciones que llevan al objeto correcto

**Por qué:** `rutaPorTipo` solo distingue los prácticos. Cualquier otra notificación deposita al usuario en la home de su rol, que no es la página de la que hablaba el aviso.

**Archivos:** `client/src/components/Topbar.jsx:22-25`, `server/src/routes/notificaciones.js`, `server/src/config/migrate.js`

**Implementación:**

- Verificar que la tabla de notificaciones guarde `entidad` y `entidad_id`; si no, agregarlos en la migración.
- Extender `rutaPorTipo` con los casos reales: `curso` → `/capacitaciones/:id`, `certificado` → `/mis-certificados`, `evaluacion` → `/capacitaciones/:id`. El caso `practico` ya demuestra el patrón.
- Mantener el fallback a la home del rol solo para tipos desconocidos.

**Aceptación:** pulsar una notificación de curso asignado abre el detalle de ese curso, no el panel.

---

### B6 — Mensajes de error accionables

**Por qué:** los mensajes escritos a mano son buenos (`Login.jsx:35`), pero los respaldos genéricos (`Error al crear el curso`, `Error al subir el archivo`) no le dicen nada a un cuidador.

**Archivos:** `NuevoCurso.jsx:46,65,86,105`, `GeneradorIA.jsx:531,562`, y el resto de los `catch` genéricos

**Implementación:** reescribir cada respaldo en dos partes, qué pasó y qué hacer. Patrón: `No pudimos guardar los cambios. Revisa tu conexión e inténtalo otra vez; si el problema sigue, avisa a tu administrador de sede.` Tomar como modelo la pantalla de curso bloqueado (`CursoDetalle.jsx:496-520`), que explica qué pasó, hasta cuándo, quién fue notificado y qué conviene hacer.

**Aceptación:** ningún mensaje visible al usuario empieza con la palabra "Error".

---

### B7 — Canal de soporte dentro de la plataforma

**Por qué:** el login remite a "contacta al encargado de tu ELEAM" y la ayuda menciona al administrador de sede, pero en ninguna parte hay un correo, un teléfono ni un formulario. Un cuidador con un problema a las 22:00 no tiene salida.

**Archivos:** `client/src/components/Topbar.jsx:162-168` (pie del panel de ayuda), `server/src/routes/sedes.js`

**Implementación:**

- Exponer en el endpoint de sede el nombre y correo del administrador (ya están en la base).
- En el pie del panel de ayuda, mostrar `¿Necesitas ayuda? Escribe a {nombre_admin}: {correo_admin}` con un `mailto:` prellenado con rol, sede y ruta actual en el asunto.

**Aceptación:** cualquier usuario autenticado ve, en dos clics, a quién escribir.

---

## Bloque C — Estructural

### C1 — Ayuda contextual por pantalla, no por rol

**Por qué:** hoy `AYUDA_POR_ROL` acompaña al usuario con el mismo texto en las diez vistas a las que accede. Un colaborador rindiendo una evaluación ve la misma ayuda que en su panel de inicio.

**Archivos:** `client/src/components/Topbar.jsx:31-56`, `client/src/components/Ayuda.jsx`

**Implementación:**

- Cambiar la clave del mapa de rol a ruta (`AYUDA_POR_RUTA`), con `useLocation()` para resolverla y el contenido por rol como respaldo.
- Aplicar el componente `<Ayuda>`, que ya está bien construido (accesible por teclado, cierra con Escape), a cada aparición de "doble fallo", "cobertura" y "prácticos", no solo en `AdminSede` y `Jefatura`.
- Añadir dos o tres procedimientos numerados por rol ("Cómo completar un curso", "Cómo crear y publicar un curso"): la ayuda actual enuncia hechos, no pasos.
- Etiquetar el botón de ayuda del topbar con la palabra "Ayuda"; hoy es un icono de 16 px entre otros cinco controles circulares.

**Aceptación:** el panel de ayuda cambia de contenido al navegar entre secciones, y `<Ayuda>` aparece en al menos seis páginas.

---

### C2 — Filtros y paginación en la URL

**Por qué:** búsqueda, filtros y página viven solo en el estado de React. Al recargar o al volver desde un detalle, la lista de usuarios pierde todo. En una lista de cientos de colaboradores obliga a rehacer el trabajo cada vez.

**Archivos:** `GestionUsuarios.jsx`, `Capacitaciones.jsx`, `CertificadosGlobales.jsx`, `MisCertificados.jsx`, `Profesor.jsx`, `components/Paginacion.jsx`

**Implementación:** reemplazar el `useState` de búsqueda, filtros y página por `useSearchParams` de react-router (ya es dependencia). Crear un hook `useFiltrosUrl(defaults)` para no repetir la lógica en cinco páginas.

**Aceptación:** filtrar, recargar la página y comprobar que el filtro sobrevive; el enlace filtrado se puede compartir.

---

### C3 — Rutas coherentes con los roles

**Por qué:** un administrador de sede que entra al generador de IA navega a `/jefatura/ia`. La URL le dice que está en una sección que no le corresponde.

**Archivos:** `client/src/App.jsx:71-72`, `client/src/components/Sidebar.jsx:14-15, 45-46, 56-57`

**Implementación:**

- Renombrar `/jefatura/ia` → `/ia` y `/jefatura/protocolos` → `/protocolos`, que es lo que realmente son: funciones compartidas por dos roles.
- Mantener redirects desde las rutas antiguas durante un ciclo, por si hay enlaces guardados.
- Cambiar el `<a href="/jefatura/protocolos">` de `GeneradorIA.jsx:697` por `<Link to>`: hoy fuerza una recarga completa de la SPA.

**Aceptación:** ningún rol navega a una URL que nombre a otro rol; no queda ningún `<a href>` interno en `client/src/`.

---

### C4 — Resolver la ruta huérfana y añadir un 404

**Por qué:** `/certificados-globales` está autorizada para el rol profesor pero no figura en su menú: es una función accesible que ningún profesor va a descubrir. Y toda URL inexistente redirige en silencio al inicio.

**Archivos:** `client/src/App.jsx:43, 78, 86`, `client/src/components/Sidebar.jsx:34-40`

**Implementación:**

- Decidir con la ONG si el profesor debe ver certificados globales. Si sí, agregar el ítem al sidebar del profesor; si no, quitar `'profesor'` de la constante `ADMIN`.
- Reemplazar el catch-all `<Navigate to="/" replace />` por una pantalla 404 con explicación y enlace al inicio del rol.

**Aceptación:** todo destino alcanzable tiene entrada en el menú del rol que puede alcanzarlo; escribir una URL inventada muestra el 404.

---

### C5 — Repartir las tres pantallas sobrecargadas

**Por qué:** `GeneradorIA` (1.296 líneas), `Profesor` (1.127) y `CursoDetalle` (1.072) concentran casi 3.500 líneas con estilo inline que no consume los tokens de `index.css`. Es el foco desde donde la interfaz se va a desalinear.

**Archivos:** los tres, más `client/src/index.css`

**Implementación (por etapas, no de una vez):**

1. Separar el generador de IA en dos momentos: configurar y revisar, en pantallas distintas. Hoy conviven formulario, vista previa, modal de presentación y modo de edición de diapositivas en un solo lienzo.
2. Dividir el panel del profesor en pestañas de nivel superior (Cursos / Validaciones).
3. Migrar los estilos inline a clases de `index.css`, empezando por botones y tarjetas, que son los que más se repiten. Eliminar de paso los tamaños sueltos de 10 y 11 px, que quedan bajo el piso de legibilidad que el propio CSS declara.

**Aceptación:** ninguna página supera las 600 líneas; `grep -c "fontSize: 1[01]" ` en esas tres devuelve 0.

---

### C6 — Breadcrumbs y salidas explícitas

**Archivos:** `NuevoCurso.jsx`, `AsignarCurso.jsx`, `GestionUsuarios.jsx`, `GestionSedes.jsx`, `GeneradorIA.jsx`, `Protocolos.jsx`

**Implementación:**

- Extraer el breadcrumb de `CursoDetalle.jsx:463-478` a `components/Breadcrumb.jsx` y usarlo en las seis vistas anidadas.
- Reemplazar `navigate(-1)` por la ruta explícita del listado (`CursoDetalle.jsx:482, 507`). El propio comentario del código reconoce que el historial se rompe al llegar por enlace directo.

**Aceptación:** toda vista anidada muestra su ruta y vuelve al listado correcto aunque se haya llegado por enlace directo.

---

### C7 — Atajos de teclado y punto de quiebre de tablet

**Archivos:** todas las páginas con listas; `client/src/index.css:490-520`

**Implementación:**

- Enter dispara la búsqueda en todas las listas; Ctrl+Enter envía los formularios largos.
- Un buscador global para jefatura y admin de sede, que son quienes recorren muchas pantallas al día.
- Añadir un breakpoint entre 768 y 1024 px: hoy conviven un sidebar de 210 px y cuadrículas de cuatro columnas en un ancho que no las admite.

**Aceptación:** buscar sin tocar el mouse funciona en las cinco listas; a 900 px de ancho ninguna tarjeta se desborda.

---

## Bloque D — Requerimientos nuevos levantados en las sesiones

No son defectos de usabilidad: es funcionalidad que ALUMCO pidió durante el test y que hoy no existe. Se listan aquí para que no se pierdan, pero su prioridad la define la ONG.

Las tres salieron de la sesión con Cecilia Riquelme, registrada en `Script (guion) - ALUMCO.docx`.

### D1 — Escala de notas 1.0 a 7.0

**Por qué:** las capacitaciones deben evaluarse con la escala chilena, no con el esquema de aprobado/reprobado usado hasta ahora. Es el requerimiento del que dependen D2 y buena parte de los reportes.

**Situación actual:** `server/src/routes/evaluaciones.js:90-91` calcula la nota como porcentaje entero de respuestas correctas y aprueba con `nota >= 60`. La columna es `intentos.nota INT` (`migrate.js:184`). El cliente muestra el resultado como porcentaje (`evaluaciones.js:231`).

**Archivos:** `server/src/routes/evaluaciones.js`, `server/src/config/migrate.js`, `client/src/pages/CursoDetalle.jsx`, `client/src/pages/Profesor.jsx`, `client/src/pages/Jefatura.jsx`

**Implementación:**

- Cambiar `intentos.nota` de `INT` a `DECIMAL(2,1)` para admitir un decimal. Migración idempotente y conversión de los datos existentes con la fórmula que se acuerde.
- Centralizar la conversión de porcentaje a escala 1-7 en una sola función del servidor. No replicarla en el cliente.
- Actualizar todos los puntos donde hoy se muestra un porcentaje: resultado de la evaluación, panel de validación del profesor y reportes de jefatura.

**Bloqueado por:** la nota mínima de aprobación en la nueva escala. Ver "Pendientes de definición".

**Aceptación:** una evaluación rendida muestra la nota en formato 1.0–7.0 en las cuatro vistas donde aparece, y el criterio de aprobación es el mismo en todas.

---

### D2 — Nota visible en el certificado

**Por qué:** requerimiento de SENAMA (Servicio Nacional del Adulto Mayor). El certificado debe mostrar la nota obtenida.

**Situación actual:** `server/src/utils/pdfCertificado.js:50` recibe `{ nombre, curso, fecha, estado, qrUrl }`. La nota no llega a la función, y la tabla `certificados` no la guarda: se deriva del `intento_id`.

**Archivos:** `server/src/utils/pdfCertificado.js`, `server/src/routes/certificados.js:76, 199`

**Implementación:**

- Agregar `nota` a la firma de `buildCertificadoPDF` y `generarCertificadoPDF`, y pasarla desde las dos llamadas de `certificados.js`.
- Tomarla del intento asociado, no duplicarla en la tabla `certificados`: la relación por `intento_id` ya existe y evita que las dos fuentes se desincronicen.
- Ubicarla en el PDF según el formato que exija SENAMA.

**Depende de:** D1, para no emitir certificados con la escala vieja y tener que reemitirlos.

**Pendiente de confirmar con ALUMCO:** el formato exacto que exige SENAMA y si el mínimo de aprobación debe aparecer impreso junto a la nota.

**Aceptación:** un certificado descargado muestra la nota en escala 1-7, y coincide con la del intento que lo originó.

---

### D3 — Logo de ALUMCO en el certificado

**Por qué:** el certificado es el documento que sale de la organización y hoy no la identifica.

**Situación actual:** `pdfCertificado.js` solo incrusta una imagen de firma (`getFirmaBytes`, línea 9). No hay logo. El certificado tampoco estaba incluido en el set de pantallas evaluado en el test, así que no tiene diseño revisado.

**Archivos:** `server/src/utils/pdfCertificado.js`, `client/src/assets/logo.js` (fuente del isotipo)

**Implementación:**

- Incrustar el logo siguiendo el mismo patrón que ya usa la firma.
- Usar una versión del isotipo en resolución suficiente para impresión. El SVG del cliente sirve como origen, pero conviene exportar un PNG a 300 ppp para el PDF.

**Advertencia:** conviene resolver D3 junto con el diseño completo del certificado, no antes. Agregar el logo a una plantilla que igual va a rediseñarse es trabajo que se hace dos veces.

**Aceptación:** el PDF incluye el logo, legible al imprimirlo en tamaño carta.

---

### Pendientes de definición

Ninguno de estos se puede resolver desde el repo. Requieren decisión de ALUMCO antes de implementar el Bloque D.

| # | Pendiente | Bloquea |
|---|---|---|
| 1 | Nota mínima de aprobación en la escala 1-7. Ya figuraba como dato faltante en `alumco_requisitos_v2.docx`. | D1, D2 |
| 2 | Si la nota 1-7 reemplaza el esquema de máximo 2 intentos o convive con él. | D1 |
| 3 | Diseño del certificado completo. No existe plantilla ni pantalla en el prototipo actual. | D2, D3 |
| 4 | Formato exacto que exige SENAMA para la nota impresa. | D2 |

---

## Lo que no hay que tocar

Tres cosas salieron bien evaluadas y conviene protegerlas antes que mejorarlas:

- **Contraste y accesibilidad** (`index.css:1-160`). Es el mejor trabajo del proyecto: ratios medidos y documentados, tokens de texto separados de los de objeto gráfico, modo alto contraste para dislexia. Añadir una verificación automática de contraste en el build para que un color nuevo no rompa lo conseguido.
- **Diálogos de confirmación** (`ConfirmContext.jsx`). Trece puntos del sistema piden confirmación con la consecuencia descrita en lenguaje llano. Al agregar acciones nuevas, usar siempre `useConfirm`, nunca `window.confirm`.
- **Indicadores de paso** (`NuevoCurso.jsx:141-190`, `CursoDetalle.jsx:449-459`). La ubicación dentro de un proceso está resuelta. Único añadido: permitir volver a un paso completado pulsando su número.

---

## Resumen de esfuerzo

| Bloque | Tareas | Estimación | Impacto en la nota |
|---|---|---|---|
| A. Rápidos | A1 a A5 | 1 día | Pautas 2, 4, 9 |
| B. Usuario | B1 a B7, más B4.1 | 1 a 2 semanas | Pautas 1, 3, 5, 9, 10 |
| C. Estructural | C1 a C7 | 3 a 4 semanas | Pautas 4, 6, 7, 8, 10 |
| D. Requerimientos nuevos | D1 a D3 | Por definir | Ninguno: es funcionalidad, no usabilidad |

Completado el Bloque B, las tres pautas por debajo de 2,0 (prevención de errores, recuperación de errores, visibilidad del estado) deberían bajar de 1,0.

**B4.1 conviene adelantarla al Bloque A** aunque esté escrita dentro de B: la corrección en sí es corta, y mientras no esté, cada colaborador que se cree sin estamento queda fuera de las capacitaciones obligatorias sin que nadie lo note.

El Bloque D no mueve la evaluación heurística porque no corrige defectos, pero D1 y D2 son compromisos con SENAMA y su plazo lo fija ALUMCO, no este plan.
