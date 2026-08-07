# ParadaYa — plan del proyecto

Marketplace móvil (iOS + Android) que conecta **empresas** que contratan
personal técnico para **paradas de planta programadas** (mantenimiento
industrial, minería) con **técnicos e ingenieros** que buscan esos contratos
temporales. Es un proyecto nuevo e independiente — todavía no tiene una sola
línea de código de app real, solo esta carpeta con el plan y una maqueta
visual para revisar contigo antes de programar.

> **Estado actual:** solo existen este documento y la maqueta visual en
> `preview/index.html`. La Fase 1 (el primer código real de la app) empieza
> después de resolver las preguntas de la sección 9.

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
