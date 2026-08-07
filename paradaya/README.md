# ParadaYa — plan del proyecto

Marketplace móvil (iOS + Android) que conecta **empresas** que contratan
personal técnico para **paradas de planta programadas** (mantenimiento
industrial, minería) con **técnicos e ingenieros** que buscan esos contratos
temporales. Es un proyecto nuevo e independiente — todavía no tiene una sola
línea de código de app real, solo esta carpeta con el plan y una maqueta
visual para revisar contigo antes de programar.

> **Estado actual:** Fase 1 (app Expo navegable, con datos de ejemplo) y
> Fase 2 (esquema de base de datos + login real) ya tienen código escrito
> — ver sección 10 para lo que falta de tu parte para dejar el login
> funcionando de verdad.

## 1. Por qué esto vive dentro de `CONVOCATORIAS_EKA`

Este repositorio ya tiene un sistema **distinto y en funcionamiento**: un bot
de Telegram (`appsscript/`, `agents/`, `scripts/`) que hace algo parecido en
concepto (convocar gente para paradas de planta) pero con otra tecnología
(Google Apps Script + Google Sheets, sin app móvil). **No se tocó nada de
eso** — ParadaYa vive aislada en la carpeta `paradaya/`, como un proyecto
aparte que por ahora comparte repositorio. Si más adelante prefieres moverla
a su propio repositorio (más limpio para publicar la app en las tiendas), es
un cambio sencillo — avísame cuando quieras hacerlo.

## 2. Nombre

**ParadaYa** — confirmado como nombre definitivo.

## 3. Stack técnico y por qué

Confirmo lo que propusiste porque es la combinación correcta para tu
situación (no programas tú mismo, quieres probar rápido en tu celular, y no
quieres pagar servidores):

| Pieza | Elección | Por qué |
|---|---|---|
| App | **React Native + Expo** (managed workflow) | Un solo código sirve para iOS y Android. Con la app **Expo Go** (gratis, App Store/Play Store) escaneas un QR y ves los cambios en tu celular al instante — no hace falta compilar ni tener cuenta de desarrollador todavía. |
| Navegación | **Expo Router** | Cada pantalla es un archivo dentro de una carpeta `app/`; la ruta de navegación se deduce del nombre de la carpeta/archivo, en vez de tener que "cablear" cada pantalla a mano. Más fácil de razonar cuando no programas tú mismo: "la pantalla del feed vive en `app/(tecnico)/feed.tsx`". |
| Backend + base de datos | **Supabase** | Autenticación, base de datos (Postgres) y almacenamiento de archivos (CVs, logos, documentos) en un solo servicio, con capa gratuita generosa. Evita levantar y mantener un servidor propio. |
| Lenguaje | **TypeScript** | Detecta errores de datos (ej. "le falta el campo fecha_fin") antes de que la app falle en tu celular, en vez de descubrirlo probando. |

No cambiaría nada de esta base. Es el stack que recomendaría de cero para
este tipo de proyecto.

## 4. Estructura de carpetas propuesta

Esto es lo que se creará dentro de `paradaya/app/` en la **Fase 1** (todavía
no existe, es la propuesta a revisar):

```
paradaya/
├── app/                        # pantallas (Expo Router = 1 archivo = 1 pantalla/ruta)
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── registro-tecnico.tsx
│   │   └── registro-empresa.tsx
│   ├── (tecnico)/               # solo visible para usuarios con rol técnico
│   │   ├── feed/
│   │   │   ├── index.tsx        # lista de paradas + filtros
│   │   │   └── [id].tsx         # detalle de una parada + botón postular
│   │   ├── postulaciones/
│   │   │   └── index.tsx        # estado de mis postulaciones
│   │   └── perfil/
│   │       ├── index.tsx
│   │       ├── experiencia.tsx
│   │       └── certificaciones.tsx
│   ├── (empresa)/                # solo visible para usuarios con rol empresa
│   │   ├── paradas/
│   │   │   ├── index.tsx        # mis paradas publicadas
│   │   │   ├── nueva.tsx        # formulario para publicar una parada
│   │   │   └── [id]/
│   │   │       └── postulantes.tsx
│   │   └── perfil.tsx
│   └── _layout.tsx               # navegación raíz + protección de rutas por rol
├── components/                   # piezas reutilizables (tarjeta de parada, chip de filtro, etc.)
├── constants/                    # listas fijas: especialidades.ts, cargos.ts, regiones.ts
├── services/                     # funciones que hablan con Supabase (una por entidad)
├── hooks/                        # lógica reutilizable (ej. usePerfilActual, useEsEmpresa)
├── types/                        # tipos TypeScript compartidos (Parada, Postulacion, etc.)
├── supabase/
│   └── migrations/               # SQL versionado de las tablas de ParadaYa
├── assets/                       # logo, íconos, imágenes
└── preview/
    └── index.html                # esta maqueta visual
```

Esta carpeta es autocontenida: no importa nada de `appsscript/`, `agents/`
ni del `supabase/` que ya existe en la raíz del repo — cuando creemos las
tablas reales de ParadaYa en Supabase, van con su propio prefijo (por
ejemplo `paradaya_` o, más simple, un proyecto de Supabase completamente
distinto) para no chocar con las tablas `convocatoria_*` que ya existen.

## 5. Modelo de datos (resumen en lenguaje simple)

| Tabla | Qué guarda |
|---|---|
| `empresas` | Perfil de cada empresa: nombre, RUC, sector, logo, descripción. |
| `tecnicos` | Perfil de cada técnico: datos personales, años de experiencia total. |
| `especialidades` | Catálogo de categorías técnicas (mecánico, eléctrico, etc.) — la misma lista la usan empresas (al publicar) y técnicos (al armar su perfil). Es extensible: una empresa puede agregar una especialidad nueva al catalogo compartido al publicar una parada. |
| `tecnico_especialidades` | Qué especialidad(es) tiene cada técnico, con años de experiencia por especialidad. |
| `experiencia_laboral` | Historial de trabajos anteriores de un técnico (empresa, tipo de planta, cargo, fechas, especialidad). |
| `certificaciones` | Certificaciones de un técnico (nombre, entidad, fecha de vencimiento), tomadas de un catálogo predefinido con opción "otra". |
| `documentos` | Archivos subidos (CV, DNI, licencias) con su tipo y link de Supabase Storage. |
| `paradas_planta` | Cada parada publicada por una empresa: título, unidad/planta, ubicación, fechas, especialidad requerida, cargo, vacantes, requisitos, descripción, estado. |
| `postulaciones` | Un técnico postulando a una parada, con estado: enviada / vista / aceptada / rechazada. |

## 6. Plan de fases

Cada fase es chica y se puede probar en tu celular con Expo Go antes de
seguir a la siguiente. Después de cada una te explico, en simple, qué se
construyó y cómo probarlo.

1. **Fase 0 — Preparación.** Resolver las preguntas abiertas (sección 9),
   crear la cuenta de Supabase. Sin código todavía.
2. **Fase 1 — Esqueleto y navegación.** Se crea el proyecto Expo, la
   estructura de carpetas de arriba, y pantallas vacías navegables (podrás
   moverte entre "Feed", "Postulaciones", "Perfil", etc., sin datos reales
   todavía). Se prueba: abres Expo Go, escaneas un QR, navegas por la app.
3. **Fase 2 — Autenticación.** Registro y login reales por rol (empresa /
   técnico) contra Supabase Auth. Se prueba: crear una cuenta de cada tipo
   desde tu celular.
4. **Fase 3 — Perfiles.** Formularios de perfil de empresa y de técnico,
   incluida la carga de CV y documentos (PDF/imagen) a Supabase Storage.
5. **Fase 4 — Publicación de paradas.** La empresa puede crear, editar y
   cerrar paradas de planta.
6. **Fase 5 — Feed de técnicos.** Lista de paradas vigentes, filtros
   manuales, y el botón "Recomendadas para mí".
7. **Fase 6 — Postulación.** El técnico postula con un tap; ve el estado de
   sus postulaciones.
8. **Fase 7 — Panel de empresa.** Ver postulantes por parada, ver perfil y
   CV completo, aceptar/rechazar.
9. **Fase 8 — Pulido.** Ajustes visuales, casos raros (ej. parada sin
   postulantes, técnico sin CV subido todavía), preparar íconos y textos
   para eventualmente publicar en las tiendas.

## 7. Fuera de alcance por ahora (pero pensado en la arquitectura)

Como pediste, esto no se construye todavía, pero el diseño de las tablas y
la carpeta `services/` lo deja preparado para no bloquear el futuro:

- **Pagos dentro de la app** — no hay tabla ni flujo de pagos en el MVP; el
  día que se agregue, va como una tabla nueva (`pagos`) sin tocar el resto.
- **Chat en tiempo real** — el contacto post-aceptación queda fuera del MVP
  (Supabase soporta esto con "Realtime" más adelante sin rehacer el resto).
- **Verificación legal automatizada de empresas** — el registro de empresa
  queda abierto (sin validar RUC contra una fuente oficial) en el MVP.
- **Notificaciones push** — el MVP usa solo notificación **in-app** (ej. un
  badge o lista de "novedades" dentro de la propia app). Push real (que
  llegue aunque la app esté cerrada) se agrega después con Expo
  Notifications, sin rediseñar nada de lo anterior.

## 8. Decisiones confirmadas (7 ago 2026)

1. **Nombre:** ✅ **ParadaYa**, definitivo.
2. **País / mercado:** ✅ **Solo Perú** para el MVP. La app usa RUC (11
   dígitos), regiones/departamentos del Perú como lista predefinida de
   ubicación, y fechas en formato peruano (dd/mm/aaaa).
3. **Especialidades técnicas:** ✅ se usa la lista propuesta como catálogo
   inicial, **pero es extensible**: si una empresa publica una parada y no
   encuentra la especialidad que necesita, puede agregar una nueva
   categoría al catálogo compartido (que desde ese momento también ven —
   y pueden elegir en su perfil — los técnicos). Mismo patrón que ya usa el
   bot de Telegram de este repo con `/especialidad_agregar`, aplicado
   ahora dentro de la app. Catálogo inicial:
   > Mecánico · Eléctrico · Instrumentación · Soldadura · Andamiaje ·
   > Aislamiento térmico · Calderería · Izaje y aparejo · Civil/Construcción
   > · Prevención de riesgos (SSOMA) · Almacén/Logística · Chofer/Operador
   > de equipo pesado
4. **Certificaciones:** ✅ catálogo predefinido (IPERC, trabajos en altura,
   espacios confinados, etc.) con opción **"otra"** para escribir una que
   no esté en la lista.

## 9. Preguntas que aún quedan abiertas

1. **Cargos/puestos predefinidos** — propuesta: Técnico · Oficial ·
   Supervisor · Ingeniero · Jefe de grupo/Capataz · Prevencionista · Otro.
   ¿Correcto, o le falta/sobra algo?
2. **Ubicación de la parada** — dentro de Perú, ¿alcanza con
   región/departamento (Arequipa, La Libertad, etc.), o necesitas más
   detalle (provincia, nombre de la unidad minera como campo aparte de la
   ubicación)?
3. **Catálogo inicial de certificaciones** — ¿qué certificaciones concretas
   quieres precargadas desde el día uno? (ej. IPERC, trabajos en altura,
   espacios confinados, manejo defensivo, primeros auxilios, ¿cuáles más
   son comunes en tus paradas?)

## 10. Base de datos y login (Fase 2 — en progreso)

### Dónde vive la base de datos

✅ **Decidido:** el mismo proyecto de Supabase que ya usa EKA Convocatorias
(el de `OFICINA_IA`). Las tablas de ParadaYa llevan el prefijo
**`paradaya_`** (`paradaya_empresas`, `paradaya_tecnicos`,
`paradaya_paradas_planta`, `paradaya_postulaciones`, etc. — 9 tablas en
total) para no chocar nunca con las tablas `convocatoria_*` del bot de
Telegram: son tablas completamente aparte, con sus propias reglas de
seguridad (RLS) — nada de lo que haga la app de ParadaYa puede leer,
escribir ni afectar los datos de Convocatorias, y viceversa. El SQL
completo ya está escrito en
[`supabase/migrations/2026_08_07_create_paradaya_schema.sql`](supabase/migrations/2026_08_07_create_paradaya_schema.sql).

Ya tengo el **Project URL** y la **anon public key** que me pasaste (las
guardé en un archivo `.env` local, que está en `.gitignore` — nunca se
sube al repositorio).

**✅ Migración ya corrida.** Se conectó una herramienta de Supabase a mi
sesión de trabajo y pude aplicarla yo mismo directo contra tu proyecto —
confirmé que las 9 tablas, sus políticas de seguridad y los dos buckets de
Storage (`paradaya-documentos` privado, `paradaya-logos` público) ya
existen, sin tocar ninguna tabla `convocatoria_*`. También agregué después
la columna `correo_contacto` que faltaba (ver más abajo). Ya no tienes que
hacer nada de este paso.

**Nota de seguridad, sin relación con ParadaYa:** al revisar el proyecto,
Supabase marcó que dos tablas ya existentes — `convocatoria_personal` y
`convocatoria_habilitaciones` — no tienen seguridad a nivel de fila (RLS)
activada, es decir que quedan totalmente expuestas si algo llega a usarlas
con la anon key. No las toqué porque no es parte de este trabajo y
activarles RLS sin las políticas correctas podría cortarle el acceso al
bot de Telegram. Avísame si quieres que lo revisemos aparte.

### Login: Google o correo/contraseña

La pantalla de ingreso (`app/index.tsx`) tiene:

- **"Continuar con Google"** — un tap, sin costo por usuario. **Requiere un
  paso tuyo** (no lo puedo hacer yo, necesita tu cuenta de Google):
  1. En [Google Cloud Console](https://console.cloud.google.com/) → crear
     un proyecto (o usar uno existente) → **APIs y servicios →
     Credenciales** → crear un **ID de cliente de OAuth** de tipo
     "Aplicación web".
  2. En **URIs de redireccionamiento autorizados**, agregar la URL de
     callback que te muestra Supabase (aparece en el siguiente paso).
  3. En el panel de Supabase → **Authentication → Providers → Google**,
     activarlo y pegar el **Client ID** y **Client Secret** que te dio
     Google.
  4. Avísame cuando esté listo y probamos el botón.

  Mientras tanto, el botón muestra un error claro en vez de fallar en
  silencio. Si es la primera vez que alguien entra con esa cuenta de
  Google, la app le pide rol y datos mínimos antes de dejarlo pasar
  (prellenando nombre y correo con lo que ya dio Google).
- **Correo y contraseña** — ya funciona, sin configuración adicional.
  Incluye "Iniciar sesión" y "Crear cuenta" con los datos mínimos por rol.

*(Se evaluó teléfono con código SMS, pero Twilio u otro proveedor de SMS
cobra por cada código enviado — se decidió no usarlo por ahora y quedarse
con las dos opciones gratuitas.)*

### El correo de contacto del técnico

Para que las empresas puedan responderle a un técnico por correo (aunque
haya entrado con Google y ese correo de Google no sea el que revisa
seguido), la tabla `paradaya_tecnicos` tiene una columna `correo_contacto`
separada de su forma de ingresar a la app:

- Se puede completar de una vez al registrarse (campo opcional en el paso
  de "primera vez por aquí").
- O agregarse/editarse después desde la pestaña **Perfil** — ahí mismo
  también puede actualizar su nombre y teléfono. Ese guardado ya escribe
  directo a Supabase (no es un dato de ejemplo).

### Qué sigue conectado a datos de ejemplo todavía

Las cuentas y el login ya son reales (una vez corrida la migración) y el
perfil del técnico ya lee/guarda sus datos de contacto reales. El feed de
paradas, mis postulaciones, y el panel de la empresa **siguen mostrando
los datos de ejemplo** — conectarlos a las tablas reales
(`paradaya_paradas_planta`, `paradaya_postulaciones`, etc.) es el
siguiente paso natural, ya con el esquema listo para eso.

### Nota sobre las pruebas que sí pude hacer y las que no

El entorno donde corre la *app* (cuando pruebo con `expo start --web` aquí
mismo) tiene bloqueado por política de la organización el acceso de red a
`supabase.co` — eso no cambia, y por eso no puedo probar un login real de
principio a fin desde acá. Lo que sí cambió: la herramienta de Supabase
que se conectó usa otro camino (no pasa por esa red bloqueada), así que
con ella **sí puedo gestionar la base de datos directamente** — crear
tablas, revisar columnas, chequear seguridad — como hice recién con la
migración y la columna `correo_contacto`.

- **Sí pude hacer:** correr y confirmar la migración completa contra tu
  base real, agregar la columna que faltaba, y confirmar que las políticas
  de seguridad quedaron bien puestas.
- **Sigue sin poder probarse desde aquí:** el botón "Continuar con
  Google" de principio a fin (necesita que actives el proveedor en
  Supabase, y que la app corra en un dispositivo con salida a internet
  normal — tu celular). Eso lo probamos juntos cuando lo tengas
  configurado.
