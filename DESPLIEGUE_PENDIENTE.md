# Para Renato — desplegar `ux-ui` en la EC2

> **Actualizado el 16-08-2026.** Encima de lo que describía este documento
> entraron dos commits más (`64e81f9a` y `dc45933a`, ambos del 15-08), que **sí**
> se probaron en la EC2. Van resumidos en `PARA_ELISA.md`: logo en el
> certificado, Excel exportado con tabla estructurada real, dos bugs de mobile,
> buscador global con Ctrl+K y la división de las tres pantallas grandes. La
> tabla del final se corrigió: varias tareas que figuraban pendientes ya están
> hechas.

Todo está commiteado y pusheado en la rama **`ux-ui`**. Lo que describe la sección
"Qué verificar después" no se ha probado contra una base de datos real: el entorno
local no llegó a levantarse y la EC2 estaba apagada cuando se escribió. **El
despliegue es la primera prueba de verdad para esa parte.**

---

## Contexto en dos párrafos

Se mergeó `pr1-cimientos` en `ux-ui` (commit `bb4f22c8`), resolviendo 19 archivos en
conflicto. Tu trabajo del plan heurístico venía de una base anterior al trabajo de
UX, así que el criterio fue: **la lógica y las features son tuyas, el estilo y la
estructura son de `ux-ui`** (tokens de contraste, `tabla-scroll`, responsive). Los
detalles de cada decisión están en el mensaje del commit del merge.

Encima de eso hay tres commits con arreglos nuevos, dos de ellos por bugs que no
estaban en el plan y que aparecieron revisando el código.

---

## Lo que hay que hacer

Estos comandos van tal cual. Ojo con el `--exclude 'server/.env'` del segundo:
sin él, el `.env` local (que apunta a un MySQL de desarrollo) le pisa al de la EC2
y el backend se queda sin base.

**1. Traer la rama y compilar el cliente**

```bash
git checkout ux-ui
git pull
cd client && npm install && npm run build && cd ..
```

El `npm install` no es opcional aunque ya tengas `node_modules`: el commit
`64e81f9a` agregó **`exceljs`**. Si lo salteás, el build muere con un
`Rollup failed to resolve import "exceljs"` que no dice que falte instalar nada.

**2. Subir a la EC2** (reemplazá la IP y la ruta del `.pem` si cambiaron)

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'server/uploads' \
  --exclude 'server/data' --exclude '.claude' --exclude 'server/.env' \
  -e "ssh -i alumco-server.pem" ./ ubuntu@44.217.200.211:~/alumco
```

**3. Levantar** (por SSH, dentro de `~/alumco`)

```bash
docker compose up -d --build
docker compose ps
```

**4. Migraciones**

```bash
docker compose exec backend npm run db:migrate
```

No corras el seed: la base de la EC2 ya tiene los datos reales.

---

## Cómo saber si quedó bien

El check más rápido: abrí en el navegador

```
http://44.217.200.211/api/certificados/por-validar
```

- **401** → el código nuevo está arriba. 
- **404** → seguís con el build viejo, el deploy no tomó.

Esa ruta no existía antes, así que sirve de semáforo.

---

## Qué verificar después, y qué esperar

### 1. Botón "Desbloquear" (panel de admin de sede y de profesor)

**El síntoma era:** desbloqueabas a alguien, el toast decía que sí, desaparecía de
la lista, y al recargar volvía a aparecer.

**La causa:** `desbloquear` limpia la tabla `progreso`, pero la lista se armaba
desde `intentos`, que es historial inmutable. Los dos intentos fallidos existen
para siempre, así que la lista se rearmaba idéntica. El desbloqueo **sí
funcionaba**; lo que mentía era la lista.

Había un segundo bug en el mismo flujo, y ese sí bloqueaba de verdad:
`CursoDetalle.jsx` calculaba el bloqueo como `Math.max(servidor, localStorage)`.
El máximo entre "0 intentos" y "2 intentos" siempre da 2, así que una vez
bloqueado, ningún desbloqueo del servidor podía levantarlo en el navegador de esa
persona. Nunca. Ahora manda la base y se limpia el cache local.

**Verificar:** desbloquear a alguien y recargar. Tiene que desaparecer de la lista.
Y entrando como esa persona, el curso tiene que dejarla rendir.

### 2. "Mis certificados" en profesor / admin de sede / jefatura

**El síntoma era:** un profesor entraba a "Mis certificados" (los suyos) y veía los
de sus alumnos.

**La causa:** `GET /certificados` devolvía cosas distintas según el rol, y esa misma
ruta la consumen cuatro pantallas. Ahora significa siempre lo mismo para todos: los
propios. La cola de validación se movió a `GET /certificados/por-validar`.

De paso: la tarjeta **"Certificados emitidos"** del panel del profesor marcaba
siempre 0, porque filtraba por `estado === 'aprobado'` sobre una lista que solo
traía pendientes. Ahora debería mostrar un número real.

**Verificar:** como profesor, "Mis certificados" vacío (salvo que ese profesor haya
tomado cursos), y la tarjeta de emitidos con un número distinto de cero.

### 3. Cobertura — ⚠️ **avisar a ALUMCO antes de que lo vean**

**Este es el cambio delicado.** "Capacitados al día" se calculaba así:

```sql
SELECT COUNT(DISTINCT p.usuario_id) FROM progreso p WHERE p.porcentaje >= 100
```

Es decir: **cualquiera con al menos un curso completo** contaba como al día, sin
mirar cuántos le correspondían. Alguien con cinco obligatorios y uno terminado
figuraba igual que alguien con todo listo. El mismo criterio estaba en el gráfico
de cobertura por sede y en `/reportes/sedes`.

El error iba en la dirección peligrosa: **sobreestimaba el cumplimiento**. Un
número que se queda corto genera una consulta; uno que sobra genera confianza. Y es
el número con el que se decide a quién capacitar, y el que se exporta a Excel para
comparar sedes.

Ahora se cruza contra los cursos obligatorios que le tocan a cada persona (por
estamento vía `curso_estamentos`, o por asignación explícita) y exige el 100% en
todos. La condición está definida una sola vez, en `SIN_OBLIGATORIOS_PENDIENTES` al
principio de `reportes.js`.

**El número va a caer, probablemente bastante.** No es un retroceso: es la primera
medición real. Conviene avisarle a ALUMCO antes de que lo vean en el panel.

Dos decisiones que quedaron tomadas y se pueden discutir:

- **Quien no tiene estamento no cuenta como al día.** Sin estamento no recibe
  ningún obligatorio, así que la condición se cumpliría de forma vacía y volvería a
  contarse como capacitado sin haber hecho nada.
- **El selector de fechas ya no afecta el gráfico de cobertura por sede.** Filtraba
  por `ultimo_acceso`, así que alguien al día desaparecía del numerador solo por no
  haber entrado en esas fechas. La cobertura es un estado presente, no una serie
  temporal. En `certificaciones-mes` el selector sí sigue funcionando.

### 4. Editar usuarios (esto sí está probado)

Se agregó edición de usuarios en Gestión de usuarios, que era lo que faltaba para
arreglar a los que quedaron sin estamento. Elisa lo probó y funciona.

Al hacerlo apareció un agujero de permisos preexistente que hubo que cerrar:
**`PATCH /usuarios/:id` no filtraba por sede**. El `GET` sí lo hacía, pero la API
aceptaba cualquier `id`, así que un `admin_sede` podía editar usuarios de otra sede
llamando al endpoint directamente. Sin arreglar eso, agregar edición de rol habría
permitido que se auto-promoviera a `jefatura`.

Ahora: un `admin_sede` solo edita gente de su sede, y **cambiar rol o mover de sede
es exclusivo de jefatura**. El RUT se puede corregir (valida dígito verificador y
que no choque con otra cuenta), porque un RUT mal digitado deja a la persona sin
poder entrar.

---

## Decisión pendiente — ya resuelta

> Quedó implementada tal como se proponía acá. Se deja escrito el razonamiento
> porque explica por qué los dos números no coinciden, y eso va a llamar la
> atención de alguien tarde o temprano.

En la tarjeta **"Colaboradores bloqueados"** aparecía gente cuyo bloqueo ya había
vencido. En las capturas salía Valentina Rojas con fecha 10-04-2026, o sea vencido
hacía cuatro meses, con un botón "Desbloquear" que no hacía nada útil.

Eran dos listas mezcladas: *"bloqueados ahora"* (`bloqueado_hasta > NOW()`) y *"doble
fallo / requieren atención"* (`intentos_fallidos >= 2`). La tarjeta se llamaba lo
primero pero mostraba lo segundo.

**Ahora:** `GET /evaluaciones/dobles-fallos` filtra por
`p.intentos_fallidos >= 2 AND p.bloqueado_hasta > NOW()`, así que la tarjeta lista
solo a quienes están bloqueados de verdad. `requieren_atencion` en `reportes.js`
sigue contando todos los `>= 2`, vencidos incluidos. **La diferencia entre los dos
números es intencional:** el contador dice "a esta gente hay que mirarla", la
tarjeta dice "a esta gente hay que desbloquearla".

---

## Notas sueltas

- **`server/.env` ya no está trackeado en git.** Estaba versionado con credenciales
  dentro (`JWT_SECRET`, claves de AWS, Google, Resend, IA). Se sacó del índice en
  el merge. El de la EC2 no se toca si respetás el `--exclude` del `rsync`.
- **El `npm run dev` de la raíz estaba roto en Windows.** Usaba `lsof` y `sleep`,
  que no existen ahí, así que la limpieza del puerto 3001 nunca corría y el
  servidor crasheaba con `EADDRINUSE` sin explicar por qué. Ya está arreglado, y
  el servidor ahora da un mensaje claro en vez de un volcado de pila.
- **El proxy de Vite ahora elige backend solo:** sondea la EC2 al arrancar y si no
  responde usa `localhost:3001`. Imprime cuál eligió en cada arranque. Se puede
  forzar con `VITE_BACKEND=...`. Esto salió de que el cliente apuntaba a la EC2
  mientras el servidor local corría sin que nadie le hablara — costó una tarde
  entera de depuración creyendo que el código estaba mal.
- **No mergeen `ux-ui` a `main` hasta que esto esté verificado en la EC2.** Sobre
  todo la cobertura, que es SQL que no se ha ejecutado ni una vez.
- **Para el futuro:** conviene que trabajes sobre `ux-ui` y no sobre
  `pr1-cimientos`. Las dos ramas volvieron a divergir y por eso hubo 19 conflictos.

---

## Lo que queda del plan heurístico

*(Verificado contra el código el 16-08-2026.)*

De `PLAN_UX_HEURISTICO.md` sigue pendiente:

| Tarea | Estado |
|---|---|
| **B2** — deshacer en acciones caras | A medias. Está en Gestión de usuarios y en el rechazo de certificados; falta desasignar curso. Protocolos se dejó con `confirm()` a propósito, como marca el plan |
| **B4.1** — datos existentes | Lo único que falta de la tarea. El alta sin estamento ya se rechaza desde el formulario, desde la API y desde la carga masiva, y jefatura tiene el contador. Pero los `estamento_id IS NULL` que ya existen siguen ahí, y `migrate.js` no pone la columna en `NOT NULL` hasta que se limpien |
| **B6** — mensajes accionables | A medias. Quedan ~15 que empiezan con "Error al…" en Gestión de sedes, Gestión de usuarios, Admin sede y Asignar curso |
| **C5** — segundo criterio | Las tres pantallas bajaron de 600 (GeneradorIA 578, Profesor 379, CursoDetalle 483), pero quedan 13 tamaños de 10-11 px en GeneradorIA y 2 en Profesor |
| **D1–D3** | **Los tres están implementados**, no bloqueados. `server/src/utils/notaChilena.js` convierte el porcentaje a la escala 1.0–7.0, la nota sale en el certificado y el logo también. Lo que falta es *confirmación*, no código: ALUMCO tiene que validar que 60% de exigencia → 4.0 es el umbral correcto, y SENAMA el formato de la nota impresa. Si cualquiera de los dos cambia, se toca una constante y una línea |

Ya no está pendiente: **C1, C2, C3, C4, C6, C7** y el resto de **A** y **B**.
C5 partió las tres pantallas en ~15 componentes, y C7 sumó el buscador global con
Ctrl+K además del breakpoint de tablet.

Apareció una deuda nueva al hacerlo: `GestionUsuarios.jsx` quedó en 854 líneas y
pasó a ser la pantalla más grande del proyecto. No estaba en el alcance de C5,
pero cruza el mismo umbral.

Y la brecha más grande sigue siendo la misma, la que marca
`TEST_USABILIDAD_ALUMCO.md`: **nunca se probó en móvil con usuarias**. Se
corrigieron dos bugs reales de mobile encontrados revisando (el topbar se
desbordaba a 375 px y los botones se cortaban en las listas de dos columnas), pero
eso es revisión de código, no test con gente. Del recorrido quedaron sin cubrir el
flujo post-generación de Generador IA y algunos modales puntuales.
