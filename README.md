# Convocatorias EKA - Bot de Telegram

Sistema para convocar usuarios por Telegram a **paradas de planta** (u otros
eventos de servicio), pedirles que confirmen su disponibilidad con botones, y
llevar el registro de respuestas en Supabase.

## Flujo

1. Un administrador crea una **convocatoria** (fecha del servicio, planta,
   descripción, fecha límite de respuesta) en la tabla `convocatorias`.
2. Un script (`scripts/enviar_convocatoria.py`) envía el anuncio por Telegram
   a todos los usuarios registrados (o a un grupo específico), con botones:
   - ✅ Disponible
   - ❌ No disponible
   - 🤔 Tal vez / Depende
3. Cuando el usuario toca un botón, un webhook (Supabase Edge Function
   `telegram-bot`) recibe el `callback_query`, guarda la respuesta en
   `convocatoria_respuestas` y edita el mensaje mostrando la confirmación.
4. El administrador puede pedir un resumen (`/resumen <id>` en el bot, o
   `scripts/reporte_convocatoria.py`) con quién confirmó, quién no y quién no
   ha respondido.
5. Opcionalmente, `scripts/enviar_recordatorios.py` reenvía el aviso solo a
   quienes no han respondido, antes de la fecha límite.

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
