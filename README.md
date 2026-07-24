# Convocatorias EKA - Bot de Telegram

Sistema para convocar usuarios por Telegram a **paradas de planta** (u otros
eventos de servicio), pedirles que confirmen su disponibilidad y datos con
botones/preguntas, y llevar todo el registro en **Google Sheets** — con los
CVs adjuntados guardados en **Google Drive**. No usa ningún servicio externo
(ni Vercel, ni Supabase, ni servidores propios): todo corre dentro de tu
cuenta de Google, con **Google Apps Script**.

## Arquitectura

- **Webhook del bot (tiempo real)**: un proyecto de **Google Apps Script**
  (carpeta `appsscript/`) publicado como "Web App". Es la única pieza que
  necesita estar "siempre encendida" para reaccionar al instante cuando
  alguien toca un botón o escribe — y Google la aloja gratis, sin que tengas
  que desplegar nada en otro lado. Lee y escribe directamente en Sheets y
  Drive usando tu propia cuenta de Google (sin credenciales aparte).
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

## Flujo para el usuario convocado

1. Recibe el mensaje de la convocatoria con 3 botones: **✅ Disponible**,
   **❌ No disponible**, **🤔 Posiblemente**.
2. Al presionar cualquiera, el bot confirma su respuesta y pregunta su
   **especialidad** con botones (la lista configurada por el admin).
3. Luego, en mensajes de texto libre, le pide en orden: **teléfono**,
   **nombres completos**, **DNI**, **lugar de residencia**, y una
   **experiencia breve** (puede escribirla o enviarla como nota de voz).
4. Por último le pide **adjuntar su CV** (PDF o Word) directo en el chat.
   En cuanto lo sube, el bot lo guarda en Drive y confirma automáticamente
   — no hace falta ningún botón de "enviado".
5. Todo queda guardado como una fila en la pestaña `Respuestas` de la hoja
   activa (una fila por convocatoria + usuario), con el link al CV incluido.

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
   `Code.gs`, `Recordatorios.gs`) como un archivo `.gs` con el mismo nombre
   en tu proyecto. (Si prefieres usar [clasp](https://github.com/google/clasp),
   puedes subir la carpeta completa con `clasp push`.)
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
5. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo (tu cuenta)**
   - Quién tiene acceso: **Cualquier usuario**
   - Copia la URL que termina en `/exec`.
6. Registra esa URL como webhook de Telegram:
   ```
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL_DEL_WEB_APP>"
   ```
7. (Opcional) Para los recordatorios automáticos: en el editor de Apps
   Script, abre **Disparadores (Triggers) → Añadir disparador**, elige la
   función `enviarRecordatoriosDiarios`, tipo "Basado en tiempo", y la
   frecuencia que prefieras (ej. una vez al día).

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

## Seguridad

No subir el archivo `.env` ni ninguna llave de cuenta de servicio al
repositorio.
