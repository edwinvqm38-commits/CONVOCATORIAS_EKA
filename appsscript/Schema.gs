// Nombres de hojas (tabs) y encabezados. Deben coincidir con
// agents/schema.py, usado por los scripts opcionales en Python.

var CONFIG_SHEET = "Config";
var CONFIG_HEADERS = ["clave", "valor"];

var ESPECIALIDADES_SHEET = "Especialidades";
var ESPECIALIDADES_HEADERS = ["nombre"];

var SESIONES_SHEET = "Sesiones";
var SESIONES_HEADERS = ["telegram_chat_id", "paso", "datos_json", "actualizado_en"];

var USUARIOS_SHEET = "Usuarios";
var USUARIOS_HEADERS = [
  "telegram_chat_id",
  "telegram_user_id",
  "nombre",
  "username",
  "estado",
  "primer_registro",
  "ultima_actividad",
];

var CONVOCATORIAS_SHEET = "Convocatorias";
var CONVOCATORIAS_HEADERS = [
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

// Orden pensado para leerse de frente en la hoja, igual que se le pregunta
// al usuario: datos personales primero, disponibilidad y fecha al final, y
// los campos tecnicos (llaves internas) al final de todo.
var RESPUESTAS_SHEET = "Respuestas";
var RESPUESTAS_HEADERS = [
  "nombres_completos",
  "dni",
  "telefono",
  "lugar_residencia",
  "especialidad",
  "experiencia_texto",
  "experiencia_audio_file_id",
  "cv_drive_url",
  "respuesta",
  "respondido_en",
  "convocatoria_id",
  "telegram_chat_id",
  "nombre",
  "username",
];

var ESPECIALIDADES_INICIALES = [
  "Tec. Electricista",
  "Tec. Instrumentista",
  "Tec. Mecanico",
  "Tec. Soldador",
  "Almacenero",
  "Chofer",
  "Sup. Electricista",
  "Sup. Seguridad",
];
