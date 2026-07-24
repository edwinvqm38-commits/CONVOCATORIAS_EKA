# Convocatorias EKA - Bot de Telegram

Sistema para convocar usuarios por Telegram a **paradas de planta** (u otros
eventos de servicio), pedirles que confirmen su disponibilidad y datos con
botones/preguntas, y llevar todo el registro en **Google Sheets** (sin base de
datos aparte) para que cada quien arme sus propios dashboards encima.

## Arquitectura

- **Webhook del bot (tiempo real)**: función serverless en **Vercel**
  (`api/telegram-webhook.js`, Node.js). Es la única pieza que necesita estar
  "siempre encendida" para reaccionar al instante cuando alguien toca un
  botón o escribe. Lee y escribe directamente en Google Sheets.
- **Almacenamiento**: dos Google Sheets (pueden ser el mismo, o distintos):
  - **Hoja de Control** (fija, `GOOGLE_SHEETS_CONTROL_ID`): usuarios
    registrados, especialidades configurables, y el estado de la
    conversación de cada chat (necesario porque un webhook serverless no
    "recuerda" nada entre un mensaje y el siguiente).
  - **Hoja activa / de destino** (cambiable en cualquier momento con
    `/hoja <link>`): pestañas `Convocatorias` y `Respuestas`, donde cae toda
    la data de seguimiento. El admin puede crear sus propias hojas/pestañas
    de análisis encima de `Respuestas` sin que el bot las toque.
- **Scripts en Python** (`scripts/`, `main.py`): opcionales, para crear o
  reenviar convocatorias desde la terminal o por cron (GitHub Actions), sin
  pasar por el chat de Telegram. Usan la misma hoja activa.

## Flujo para el administrador

1. **/hoja `<link o ID>`** — (una vez, o cuando quiera cambiar de hoja)
   define en qué Google Sheet caen las convocatorias y respuestas de ahí en
   adelante. Antes de usarlo, comparte esa hoja como editor con el correo de
   la cuenta de servicio (ver más abajo).
2. **/convocar** — el bot pregunta, uno por uno: planta, título, fecha del
   servicio, hora, descripción y fecha límite de respuesta (los campos
   opcionales se saltan con `-`). Al final muestra un resumen con 3 botones:
   enviar ahora, guardar como borrador, o cancelar.
3. **/especialidad_agregar `<nombre>`** — agrega una especialidad nueva a la
   lista de botones que ven los usuarios (ver más abajo). Ya vienen
   precargadas: Tec. Electricista, Tec. Instrumentista, Tec. Mecánico,
   Tec. Soldador, Almacenero, Chofer, Sup. Electricista, Sup. Seguridad.
4. **/resumen `<convocatoria_id>`** — cuenta rápida de disponibles / no
   disponibles / posiblemente para esa convocatoria.

## Flujo para el usuario convocado

1. Recibe el mensaje de la convocatoria con 3 botones: **✅ Disponible**,
   **❌ No disponible**, **🤔 Posiblemente**.
2. Al presionar cualquiera, el bot confirma su respuesta y pregunta su
   **especialidad** con botones (la lista configurada por el admin).
3. Luego, en mensajes de texto libre, le pide en orden: **teléfono**,
   **nombres completos**, **DNI**, **lugar de residencia**, y una
   **experiencia breve** (puede escribirla o enviarla como nota de voz).
4. Todo queda guardado como una fila en la pestaña `Respuestas` de la hoja
   activa (una fila por convocatoria + usuario).

**Importante sobre Telegram**: un bot solo puede escribirle a alguien que ya
le escribió primero (o le dio `/start`) — es una regla de la plataforma, no
de este sistema, para evitar spam. Por eso cada persona abre el link del bot
y presiona Start (o escribe `/start`) **una sola vez**; después de eso, las
convocatorias les llegan solas.

**Límite de este diseño**: las respuestas de una convocatoria se guardan en
la hoja que esté activa *en el momento en que el usuario responde* (no la que
estaba activa cuando se creó). Evita cambiar de hoja con `/hoja` mientras una
convocatoria siga esperando respuestas; cámbiala después de cerrarla.

## Cuenta de servicio de Google (para leer/escribir Sheets)

1. En Google Cloud Console, crea un proyecto (o usa uno existente), habilita
   la **Google Sheets API**, y crea una **cuenta de servicio**.
2. Genera una llave JSON para esa cuenta de servicio.
3. Comparte cada Google Sheet que vaya a usar el bot (la de Control, y cada
   hoja de destino) como **Editor** con el `client_email` de esa cuenta.
4. Guarda el JSON completo (o en base64, en una sola línea) en la variable
   `GOOGLE_SERVICE_ACCOUNT_JSON`.

## Variables de entorno

Ver `.env.example`. En resumen:

```
TELEGRAM_BOT_TOKEN=
ADMIN_CHAT_IDS=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SHEETS_CONTROL_ID=
```

## Despliegue del webhook (Vercel)

```
npm install
vercel deploy --prod
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<tu-proyecto>.vercel.app/api/telegram-webhook"
```

Configura las mismas variables de entorno (`TELEGRAM_BOT_TOKEN`,
`ADMIN_CHAT_IDS`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_CONTROL_ID`)
en el proyecto de Vercel (Settings → Environment Variables).

## Ejecución local de los scripts en Python (opcional)

```
python -m pip install -r requirements.txt

# Crear una convocatoria sin pasar por el chat
python scripts/crear_convocatoria.py --planta "Planta Callao" --fecha 2026-08-15 \
  --descripcion "Parada de planta programada - mantenimiento anual"

# Enviarla a todos los usuarios registrados
python scripts/enviar_convocatoria.py --id <convocatoria_id>

# Ver el resumen de respuestas
python scripts/reporte_convocatoria.py --id <convocatoria_id>

# Recordar a quienes no han respondido
python scripts/enviar_recordatorios.py --id <convocatoria_id>
```

En GitHub Actions, estas mismas variables deben configurarse como Repository
Secrets (`GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_CONTROL_ID`,
`TELEGRAM_BOT_TOKEN`) para los workflows de envío/recordatorios.

## Seguridad

No subir el archivo `.env` ni la llave de la cuenta de servicio al
repositorio.
