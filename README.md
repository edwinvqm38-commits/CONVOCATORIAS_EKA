# Convocatorias EKA - Bot de Telegram

Sistema para convocar usuarios por Telegram a **paradas de planta** (u otros
eventos de servicio), pedirles que confirmen su disponibilidad con botones, y
llevar el registro de respuestas en Supabase.

## Flujo

1. Un administrador escribe **/convocar** al bot. El bot le pregunta, uno por
   uno: planta, título, fecha del servicio, hora, descripción y fecha límite
   de respuesta (los campos opcionales se saltan con `-`). Al final muestra
   un resumen con 3 botones: enviar ahora, guardar como borrador, o cancelar.
   (También se puede crear por script/Supabase directo con
   `scripts/crear_convocatoria.py`, sin pasar por el chat.)
2. Al confirmar "enviar ahora", el bot manda el anuncio por Telegram a todos
   los usuarios registrados, con botones:
   - ✅ Disponible
   - ❌ No disponible
   - 🤔 Posiblemente
3. Cuando el usuario toca un botón, el mismo webhook (Supabase Edge Function
   `telegram-bot`) recibe el `callback_query`, guarda la respuesta en
   `convocatoria_respuestas` y edita el mensaje mostrando la confirmación.
4. El administrador puede pedir un resumen (`/resumen <id>` en el bot, o
   `scripts/reporte_convocatoria.py`) con quién confirmó, quién no y quién no
   ha respondido.
5. Opcionalmente, `scripts/enviar_recordatorios.py` (o el workflow diario de
   GitHub Actions) reenvía el aviso solo a quienes no han respondido, antes de
   la fecha límite.

**Importante sobre Telegram**: un bot solo puede escribirle a alguien que ya
le escribió primero (o le dio `/start`) — es una regla de la plataforma, no
de este sistema, para evitar spam. Por eso el primer paso siempre es que cada
persona abra el chat del bot y presione Start (o escriba `/start`) una sola
vez; después de eso, las convocatorias les llegan solas sin que tengan que
volver a escribir nada.

## Componentes

- **Registro de usuarios**: cualquier persona que escriba `/start` al bot
  queda registrada en `convocatoria_usuarios` con su `telegram_chat_id`. Así
  se arma la lista de destinatarios sin pedir números de teléfono.
- **Envío (Python + GitHub Actions)**: procesos batch que leen Supabase y
  llaman a la API de Telegram (`sendMessage` con `inline_keyboard`).
- **Recepción (Supabase Edge Function)**: único componente que necesita estar
  "siempre encendido" para reaccionar al instante cuando alguien toca un
  botón. Se configura como webhook del bot de Telegram.

## Variables requeridas

Crear un archivo `.env` (no se sube al repositorio):

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
ADMIN_CHAT_IDS=
```

En GitHub, estas variables deben configurarse como Repository Secrets si se
usan GitHub Actions para el envío programado.

## Ejecución local

```
python -m pip install -r requirements.txt

# Crear una convocatoria (o hacerlo directo en Supabase)
python scripts/crear_convocatoria.py --planta "Planta Callao" --fecha 2026-08-15 \
  --descripcion "Parada de planta programada - mantenimiento anual"

# Enviarla a todos los usuarios registrados
python scripts/enviar_convocatoria.py --id <convocatoria_id>

# Ver el resumen de respuestas
python scripts/reporte_convocatoria.py --id <convocatoria_id>

# Recordar a quienes no han respondido
python scripts/enviar_recordatorios.py --id <convocatoria_id>
```

## Despliegue del webhook (Supabase Edge Function)

```
supabase functions deploy telegram-bot --no-verify-jwt
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.functions.supabase.co/telegram-bot"
```

## Seguridad

No subir el archivo `.env` al repositorio.
