# Convocatorias EKA - Bot de Telegram

Sistema para convocar usuarios por Telegram a **paradas de planta** (u otros
eventos de servicio), pedirles que confirmen su disponibilidad y datos con
botones/preguntas, y llevar todo el registro en **Supabase (Postgres)** —
con los CVs adjuntados guardados en **Google Drive**.

## Arquitectura

- **Bot (Telegram ↔ Supabase/Drive)**: una **Edge Function de Supabase**
  (Deno), en `supabase/functions/convocatorias-bot/index.ts`. Recibe los
  mensajes de Telegram por **webhook** (Telegram le hace POST directo a la
  URL de la función en cuanto hay un mensaje o botón nuevo — no hay
  polling ni cron de por medio).
- **Almacenamiento**: Postgres del proyecto Supabase (`OFICINA_IA`), en
  tablas con prefijo `convocatoria_` (ver
  `supabase/sql/2026_07_24_create_convocatoria_schema.sql`):
  `convocatoria_usuarios`, `convocatoria_especialidades`, `convocatorias`,
  `convocatoria_respuestas`, `convocatoria_sesiones` (estado del flujo
  conversacional de cada chat). Row Level Security está activado en las 5
  (ver sección Seguridad).
- **CVs**: se suben a una carpeta de **Google Drive**, autenticando como un
  usuario real vía OAuth con `refresh_token` (no una cuenta de servicio —
  estas no tienen cuota propia de almacenamiento en Drive salvo con Shared
  Drives de Google Workspace). El link de cada archivo queda en
  `cv_drive_url`.
- **Transcripción de audio** (opcional): si la experiencia se manda como
  nota de voz, se transcribe con Gemini (`GEMINI_API_KEY`); si no está
  configurada, simplemente se guarda el audio sin transcribir.
- **Exportar a Sheets** (opcional): `scripts/exportar_respuestas_sheets.py`
  trae la vista `convocatoria_respuestas_export_v` a una pestaña de Google
  Sheets, con WhatsApp y CV como links clickeables — ver más abajo.

## Comandos del bot

Para todos:
- **`/start`** — registra al chat para recibir convocatorias. Si se abre
  con un link `?start=conv_<id>`, además muestra esa convocatoria puntual.
- **`/ayuda`** — lista de comandos.

Solo administradores (`ADMIN_CHAT_IDS`):
- **`/convocar`** — arma una convocatoria paso a paso (planta, título,
  fecha, hora, descripción, fecha límite) y al final ofrece enviarla a
  todos los usuarios registrados, guardarla como borrador o cancelarla.
- **`/especialidad_agregar <nombre>`** — agrega una especialidad a la lista
  de botones que ven los usuarios al responder. Ya vienen precargadas:
  Tec. Electricista, Tec. Instrumentista, Tec. Mecánico, Tec. Soldador,
  Almacenero, Chofer, Sup. Electricista, Sup. Seguridad.
- **`/especialidades`** — lista las especialidades configuradas.
- **`/resumen <convocatoria_id>`** — cuenta de disponibles / no
  disponibles / posiblemente, más el detalle de contactos (disponible y
  posiblemente) con su especialidad y un link clickeable de WhatsApp.
- **`/cancelar`** — cancela el flujo en curso (`/convocar` o una respuesta
  a medio llenar).
- **`/vincular_drive <codigo>`** — intercambia un código de autorización de
  Google por un `refresh_token` para subir CVs a Drive (ver más abajo).
- **`/actualizar_menu`** — registra/refresca el menú nativo "/" de Telegram
  (el botón junto al campo de texto) con la lista de comandos de arriba:
  básica para cualquier chat, completa solo para los chats en
  `ADMIN_CHAT_IDS`. Telegram no lo actualiza solo; hay que correr este
  comando una vez después de desplegar y cada vez que cambie la lista de
  comandos.

## Flujo del usuario convocado

1. Recibe el mensaje de la convocatoria con 3 botones: **✅ Disponible**,
   **❌ No disponible**, **🤔 Posiblemente**.
2. Al presionar cualquiera, el bot pide, en orden: **nombres completos**,
   **DNI**, **teléfono**, **lugar de residencia**, **especialidad** (con
   botones), una **experiencia breve** (texto o nota de voz), y por último
   el **CV** (PDF o Word, adjunto directo en el chat).
3. El CV se sube a Drive **renombrado a "Nombres completos - DNI"** y la
   respuesta queda completa automáticamente, sin botón de "enviado".

**Nota sobre Telegram**: un bot solo puede escribirle a alguien que ya le
escribió primero (o le dio `/start`) — regla de la plataforma para evitar
spam. Por eso cada persona debe abrir el link del bot y presionar Start (o
el link `?start=conv_<id>` de una convocatoria puntual) una sola vez.

## Desplegar / configurar

1. **Crear el esquema en Supabase**: correr
   `supabase/sql/2026_07_24_create_convocatoria_schema.sql` sobre el
   proyecto (SQL editor de Supabase, o `supabase db push`).
2. **Desplegar la función**: desde `supabase/functions/convocatorias-bot/`,
   `supabase functions deploy convocatorias-bot --project-ref <ref> --no-verify-jwt`
   (necesita `--no-verify-jwt` porque Telegram llama al webhook sin un JWT
   de Supabase).
3. **Configurar los secretos de la función** (Project Settings → Edge
   Functions → Secrets, o `supabase secrets set`):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (del propio proyecto).
   - `TELEGRAM_BOT_TOKEN` (de [@BotFather](https://t.me/BotFather)).
   - `ADMIN_CHAT_IDS` (chat IDs separados por coma; para saber el tuyo,
     escríbele al bot y revisa los logs, o usa algún bot tipo
     `@userinfobot`).
   - `GOOGLE_DRIVE_CV_FOLDER_ID` (opcional; si se omite, sube los CVs a la
     raíz de "Mi unidad" de la cuenta vinculada).
   - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (ver abajo).
   - `GOOGLE_OAUTH_REFRESH_TOKEN` (se obtiene con `/vincular_drive`, ver
     abajo — al principio puede dejarse vacío y completarse después).
   - `GEMINI_API_KEY` (opcional, para transcribir notas de voz).
4. **Registrar el webhook de Telegram**, apuntando a la URL pública de la
   función (`https://<project-ref>.supabase.co/functions/v1/convocatorias-bot`):
   ```
   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<project-ref>.supabase.co/functions/v1/convocatorias-bot
   ```

### Vincular Google Drive (OAuth)

Los CVs se suben con la cuenta personal de Google del administrador (no una
cuenta de servicio), así que hace falta un `refresh_token` una sola vez:

1. En [Google Cloud Console](https://console.cloud.google.com/) crea unas
   credenciales OAuth de tipo **Aplicación de escritorio** — de ahí salen
   `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`.
2. Arma esta URL reemplazando `TU_CLIENT_ID`, ábrela en el navegador,
   inicia sesión con la cuenta que va a "dueña" de los CVs, y acepta:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=TU_CLIENT_ID&redirect_uri=http://localhost&response_type=code&access_type=offline&prompt=consent&scope=https://www.googleapis.com/auth/drive.file
   ```
3. Al aceptar, el navegador intentará abrir `http://localhost/?code=...` (va
   a fallar porque no hay nada corriendo ahí — está bien). Copia el valor de
   `code` de la URL.
4. En Telegram, como administrador, envía `/vincular_drive <ese codigo>`. El
   bot responde con el `refresh_token`: guárdalo como el secreto
   `GOOGLE_OAUTH_REFRESH_TOKEN` en Supabase.

## Exportar respuestas a Google Sheets

La vista `convocatoria_respuestas_export_v` (en
`supabase/sql/2026_07_24_create_convocatoria_schema.sql`) arma los datos de
`convocatoria_respuestas` listos para reportes;
`scripts/exportar_respuestas_sheets.py` la trae a una pestaña de Google
Sheets, con el **teléfono** como link de WhatsApp (`wa.me`) y el **CV**
como link a Drive, ambos clickeables.

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
