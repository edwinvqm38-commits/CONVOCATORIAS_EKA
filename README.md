# Convocatorias EKA - Bot de Telegram

Sistema para convocar usuarios por Telegram a **paradas de planta** (u otros
eventos de servicio), pedirles que confirmen su disponibilidad y datos con
botones/preguntas, y llevar todo el registro en **Google Sheets** — con los
CVs adjuntados guardados en **Google Drive**. No usa ningún servicio externo
(ni Vercel, ni Supabase, ni servidores propios): todo corre dentro de tu
cuenta de Google, con **Google Apps Script**.

## Arquitectura

- **Bot (Telegram ↔ Sheets/Drive)**: un proyecto de **Google Apps Script**
  (carpeta `appsscript/`). Revisa mensajes nuevos de Telegram cada minuto
  (`revisarTelegram`, colgada de un disparador de tiempo) — los Web Apps de
  Apps Script no sirven como webhook de Telegram (siempre redirigen con 302,
  y Telegram no sigue redirecciones), así que en vez de esperar a que
  Telegram le avise, es Apps Script el que pregunta. Google lo aloja gratis,
  sin que tengas que desplegar nada en otro lado. Lee y escribe directamente
  en Sheets y Drive usando tu propia cuenta de Google (sin credenciales
  aparte).
- **Almacenamiento**: dos Google Sheets (pueden ser el mismo, o distintos):
  - **Hoja de Control** (fija, configurada una vez): usuarios registrados,
    especialidades configurables, y el estado de la conversación de cada
    chat (necesario porque un Web App no "recuerda" nada entre un mensaje y
    el siguiente).
  - **Hoja activa / de destino** (cambiable en cualquier momento con
    `/hoja`): pestañas `Convocatorias` y `Respuestas`, donde cae toda la data
    de seguimiento. Arma tus propias hojas/pivotes de análisis encima de
    `Respuestas` sin que el bot las toque.
- **CVs**: se guardan como archivos en una carpeta de **Google Drive**
  (`Convocatorias EKA - CVs` por defecto, o la que indiques), y el link a
  cada archivo queda en la columna `cv_drive_url` de `Respuestas`.
- **Scripts en Python** (`scripts/`, `main.py`): **opcionales**, para crear o
  reenviar convocatorias desde la terminal o por cron (GitHub Actions), sin
  pasar por el chat. Usan una cuenta de servicio de Google aparte — no son
  necesarios si administras todo desde el propio bot (con `/convocar`,
  `/hoja`, etc.) y usas el trigger de recordatorios de Apps Script.

## Flujo para el administrador

1. **`/hoja <link o ID>`** — (una vez, o cuando quiera cambiar de hoja)
   define en qué Google Sheet caen las convocatorias y respuestas de ahí en
   adelante. La hoja debe estar compartida como editor con la cuenta de
   Google que publicó el proyecto de Apps Script.
2. **`/convocar`** — el bot pregunta, uno por uno: planta, título, fecha del
   servicio, hora, descripción y fecha límite de respuesta (los campos
   opcionales se saltan con `-`). Al final muestra un resumen con 3 botones:
   enviar ahora, guardar como borrador, o cancelar.
3. **`/especialidad_agregar <nombre>`** — agrega una especialidad nueva a la
   lista de botones que ven los usuarios. Ya vienen precargadas: Tec.
   Electricista, Tec. Instrumentista, Tec. Mecánico, Tec. Soldador,
   Almacenero, Chofer, Sup. Electricista, Sup. Seguridad.
4. **`/resumen <convocatoria_id>`** — cuenta rápida de disponibles / no
   disponibles / posiblemente para esa convocatoria.
5. **`/script`** — te manda por Telegram el código actual del bot (todos los
   archivos `.gs`), leyéndolo directo del proyecto en ese momento. Úsalo
   cuando necesites armar el bot en un Google Sheet/cuenta nueva y no
   recuerdes qué pegar: siempre te manda la versión real que está corriendo,
   no una copia vieja.

## Flujo para el usuario convocado

1. Recibe el mensaje de la convocatoria con 3 botones: **✅ Disponible**,
   **❌ No disponible**, **🤔 Posiblemente**.
2. Al presionar cualquiera, el bot confirma su respuesta y le pide, en este
   orden: **nombres completos**, **DNI**, **teléfono**, **lugar de
   residencia**, su **especialidad** (con botones), una **experiencia
   breve** (texto o nota de voz), y por último **adjuntar su CV** (PDF o
   Word) directo en el chat.
3. En cuanto sube el CV, el bot lo guarda en Drive **con el archivo renombrado
   a "Nombres completos - DNI"** (en vez del nombre original que haya puesto
   la persona, que a veces viene raro o vacío) y confirma automáticamente —
   no hace falta ningún botón de "enviado".
4. Todo queda guardado como una fila en la pestaña `Respuestas` de la hoja
   activa, con las columnas en el mismo orden en que se preguntó (nombre,
   DNI, teléfono, lugar, especialidad, experiencia, CV), y la disponibilidad
   más la fecha de respuesta al final de la fila. El **teléfono** queda como
   un link para escribir por WhatsApp con un tap/click, y el **CV** como un
   link "📎 Ver CV" directo al archivo en Drive.

## Formato de la hoja `Respuestas`

Cada vez que usas `/hoja` (o agregas una especialidad con
`/especialidad_agregar`), el bot le aplica formato a la pestaña activa:

- Encabezado en negrita y fila congelada.
- Columna **Especialidad**: lista desplegable (para si alguien edita a mano)
  y un color de fondo distinto por especialidad.
- Columna **Respuesta** (disponibilidad): verde/rojo/amarillo según
  disponible / no disponible / posiblemente.
- Columna **Teléfono**: link clickeable a WhatsApp (`wa.me`). Los links
  `tel:` no son confiables dentro de Google Sheets, por eso se usa WhatsApp
  como vía principal para llamar o escribir. Asume números peruanos de 9
  dígitos si no traen código de país.
- Columna **CV**: link clickeable directo al archivo en Drive.

**Importante sobre Telegram**: un bot solo puede escribirle a alguien que ya
le escribió primero (o le dio `/start`) — es una regla de la plataforma, no
de este sistema, para evitar spam. Por eso cada persona abre el link del bot
y presiona Start (o escribe `/start`) **una sola vez**; después de eso, las
convocatorias les llegan solas.

**Límite de este diseño**: las respuestas de una convocatoria se guardan en
la hoja que esté activa *en el momento en que el usuario responde* (no la que
estaba activa cuando se creó). Evita cambiar de hoja con `/hoja` mientras una
convocatoria siga esperando respuestas; cámbiala después de cerrarla.

**Privacidad de los CVs**: los archivos quedan en una carpeta de Drive de tu
propia cuenta, con los permisos normales de Drive (nadie externo puede verlos
salvo que tú compartas esa carpeta). El bot no cambia esos permisos por su
cuenta.

## Configurar el bot en Google Apps Script (sin hosting externo)

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Copia el contenido de cada archivo de la carpeta `appsscript/` de este
   repo (`Schema.gs`, `Sheets.gs`, `Store.gs`, `Telegram.gs`, `Drive.gs`,
   `Formato.gs`, `Recordatorios.gs`, `Comandos.gs`, `Polling.gs`, `Code.gs`)
   como un archivo `.gs` con el mismo nombre en tu proyecto — o pega todo
   junto en un solo archivo, da igual, Apps Script no distingue. (Si
   prefieres usar [clasp](https://github.com/google/clasp), puedes subir la
   carpeta completa con `clasp push`.)
3. En **Configuración del proyecto → Propiedades de secuencia de comandos**
   (Project Settings → Script properties), agrega:
   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_CHAT_IDS` (chat IDs separados por coma)
   - `CONTROL_SHEET_ID` (ID de un Google Sheet que crees vacío, para
     Config/Especialidades/Sesiones/Usuarios)
   - `GOOGLE_DRIVE_CV_FOLDER_ID` (opcional; si lo dejas vacío, el bot crea
     una carpeta llamada "Convocatorias EKA - CVs" automáticamente)
4. Comparte el Google Sheet de `CONTROL_SHEET_ID` (y cualquier hoja que
   vayas a usar como destino con `/hoja`) como **Editor** con la cuenta de
   Google que va a publicar el proyecto.
5. **No uses un webhook de Telegram.** Los Web Apps de Apps Script siempre
   responden con una redirección (302) en la URL `/exec` — así funciona el
   servicio para todas las ejecuciones — y Telegram no sigue redirecciones al
   entregar un webhook, así que nunca llega nada (`Wrong response from the
   webhook: 302 Found`). En vez de eso, el bot usa **polling**: Apps Script
   pregunta a Telegram cada minuto si hay mensajes nuevos.
   - Primero borra cualquier webhook que hayas registrado antes:
     ```
     https://api.telegram.org/bot<TOKEN>/deleteWebhook
     ```
   - En el editor, elige `revisarTelegram` en el desplegable de funciones y
     ejecútala una vez para probar.
   - Luego **Disparadores (Triggers) → Añadir disparador**: función
     `revisarTelegram`, tipo "Basado en tiempo" → "Temporizador de minutos" →
     **cada minuto**. Con esto las respuestas del bot llegan casi al
     instante (máximo ~1 minuto de rezago).
6. (Ya no hace falta implementar como Aplicación web para que el bot
   funcione — `doPost`/`doGet` quedan sin uso. Puedes igual dejarlos
   desplegados por si más adelante quieres exponer un endpoint propio.)
7. (Opcional) Para los recordatorios automáticos: agrega otro disparador
   igual al anterior, pero para la función `enviarRecordatoriosDiarios`, con
   la frecuencia que prefieras (ej. una vez al día).

La primera vez que uses `/script`, Google puede pedirte volver a autorizar el
proyecto (aparece al ejecutar cualquier función manualmente en el editor, o
lo notarás porque `/script` fallará con un error de permisos) — es porque ese
comando necesita permiso para leer el propio código del proyecto
(`script.projects.readonly`, ya declarado en `appsscript.json`). Solo hace
falta aceptar una vez.

Con esto el bot queda funcionando 100% dentro de tu cuenta de Google — no
hay que desplegar nada en Vercel, Supabase, ni ningún otro servicio.

## Scripts en Python (opcional, avanzado)

Si prefieres crear/enviar convocatorias desde la terminal o por cron de
GitHub Actions en vez de usar `/convocar` en el chat, están los scripts en
`scripts/` y `main.py`. Usan la misma hoja activa, pero se autentican con una
cuenta de servicio de Google aparte (no la misma sesión de Apps Script):

```
python -m pip install -r requirements.txt

python scripts/crear_convocatoria.py --planta "Planta Callao" --fecha 2026-08-15 \
  --descripcion "Parada de planta programada - mantenimiento anual"
python scripts/enviar_convocatoria.py --id <convocatoria_id>
python scripts/reporte_convocatoria.py --id <convocatoria_id>
python scripts/enviar_recordatorios.py --id <convocatoria_id>
```

Variables necesarias solo para esta vía (ver `.env.example`):
`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_CONTROL_ID`,
`TELEGRAM_BOT_TOKEN`. No son necesarias si solo usas el bot vía Apps Script.

## Exportar respuestas a Google Sheets

El bot vivo (Telegram ↔ Supabase, ver `supabase/functions/convocatorias-bot/`)
guarda todo en Postgres. La vista `convocatoria_respuestas_export_v` (en
`supabase/sql/2026_07_24_create_convocatoria_schema.sql`) ya arma esos datos
listos para reportes; `scripts/exportar_respuestas_sheets.py` la trae a una
pestaña de Google Sheets, con el **teléfono** como link de WhatsApp
(`wa.me`) y el **CV** como link a Drive, ambos clickeables — igual que hacía
el bot viejo de Apps Script directamente en la hoja.

Cada corrida reemplaza el contenido completo de la pestaña con una foto
actual de las respuestas (no acumula duplicados).

```
python -m pip install -r requirements.txt
python scripts/exportar_respuestas_sheets.py
python scripts/exportar_respuestas_sheets.py --convocatoria-id <id>   # solo una convocatoria
```

Variables necesarias (ver `.env.example`): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`,
`GOOGLE_SHEETS_EXPORT_ID`. Comparte el Google Sheet destino como **Editor**
con el `client_email` de la cuenta de servicio.

También se puede disparar manualmente desde GitHub Actions (workflow
**"Convocatorias - Exportar respuestas a Sheets"**), con esos mismos valores
guardados como *repository secrets*.

## Seguridad

No subir el archivo `.env` ni ninguna llave de cuenta de servicio al
repositorio.

### RLS en las tablas `convocatoria_*`

Row Level Security (RLS) está **activado** en las 5 tablas del esquema
(`convocatoria_usuarios`, `convocatoria_especialidades`, `convocatorias`,
`convocatoria_respuestas`, `convocatoria_sesiones`), sin políticas
adicionales. Esto bloquea cualquier acceso desde la `anon key` o usuarios
`authenticated`; el bot sigue funcionando con normalidad porque la Edge
Function usa `SUPABASE_SERVICE_ROLE_KEY`, que siempre ignora RLS.

Si en el futuro alguna parte del sistema necesita leer estas tablas con la
`anon key` (por ejemplo, un panel web público), habrá que agregar políticas
explícitas con `CREATE POLICY` antes de exponerlas de esa forma.
