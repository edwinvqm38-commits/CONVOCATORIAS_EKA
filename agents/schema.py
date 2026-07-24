"""Nombres de hojas y encabezados compartidos con lib/schema.js (Node). Deben
mantenerse iguales entre ambos lenguajes: el webhook (Node) atiende botones
en tiempo real, estos scripts en Python son para uso administrativo/cron.
"""

CONFIG_SHEET = "Config"
CONFIG_HEADERS = ["clave", "valor"]

ESPECIALIDADES_SHEET = "Especialidades"
ESPECIALIDADES_HEADERS = ["nombre"]

USUARIOS_SHEET = "Usuarios"
USUARIOS_HEADERS = [
    "telegram_chat_id",
    "telegram_user_id",
    "nombre",
    "username",
    "estado",
    "primer_registro",
    "ultima_actividad",
]

CONVOCATORIAS_SHEET = "Convocatorias"
CONVOCATORIAS_HEADERS = [
    "id",
    "titulo",
    "planta",
    "fecha_servicio",
    "hora_servicio",
    "descripcion",
    "fecha_limite_respuesta",
    "estado",
    "creado_por",
    "creado_en",
    "enviada_en",
]

RESPUESTAS_SHEET = "Respuestas"
RESPUESTAS_HEADERS = [
    "convocatoria_id",
    "telegram_chat_id",
    "nombre",
    "username",
    "respuesta",
    "especialidad",
    "telefono",
    "nombres_completos",
    "dni",
    "lugar_residencia",
    "experiencia_texto",
    "experiencia_audio_file_id",
    "respondido_en",
]
