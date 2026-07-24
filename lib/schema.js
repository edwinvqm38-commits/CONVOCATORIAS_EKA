// Nombres de hojas (tabs) y encabezados usados en los dos Google Sheets del
// sistema:
//
// 1. "Control" (GOOGLE_SHEETS_CONTROL_ID, fijo): configuracion del bot que
//    debe sobrevivir aunque el admin cambie de hoja de destino con /hoja.
// 2. "Destino" (la hoja activa, elegida con /hoja; por defecto la misma
//    Control si nunca se configuro otra): datos de convocatorias y
//    respuestas, para que el admin arme sus propios dashboards encima.

const CONFIG_SHEET = "Config";
const CONFIG_HEADERS = ["clave", "valor"];

const ESPECIALIDADES_SHEET = "Especialidades";
const ESPECIALIDADES_HEADERS = ["nombre"];

const SESIONES_SHEET = "Sesiones";
const SESIONES_HEADERS = ["telegram_chat_id", "paso", "datos_json", "actualizado_en"];

const USUARIOS_SHEET = "Usuarios";
const USUARIOS_HEADERS = [
  "telegram_chat_id",
  "telegram_user_id",
  "nombre",
  "username",
  "estado",
  "primer_registro",
  "ultima_actividad",
];

const CONVOCATORIAS_SHEET = "Convocatorias";
const CONVOCATORIAS_HEADERS = [
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
];

const RESPUESTAS_SHEET = "Respuestas";
const RESPUESTAS_HEADERS = [
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
];

const ESPECIALIDADES_INICIALES = [
  "Tec. Electricista",
  "Tec. Instrumentista",
  "Tec. Mecanico",
  "Tec. Soldador",
  "Almacenero",
  "Chofer",
  "Sup. Electricista",
  "Sup. Seguridad",
];

module.exports = {
  CONFIG_SHEET,
  CONFIG_HEADERS,
  ESPECIALIDADES_SHEET,
  ESPECIALIDADES_HEADERS,
  SESIONES_SHEET,
  SESIONES_HEADERS,
  USUARIOS_SHEET,
  USUARIOS_HEADERS,
  CONVOCATORIAS_SHEET,
  CONVOCATORIAS_HEADERS,
  RESPUESTAS_SHEET,
  RESPUESTAS_HEADERS,
  ESPECIALIDADES_INICIALES,
};
