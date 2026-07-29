import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sincronizarRespuestaConSheet } from "./sheets.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const ADMIN_CHAT_IDS = Deno.env.get("ADMIN_CHAT_IDS") ?? "";
const GOOGLE_DRIVE_CV_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_CV_FOLDER_ID") ?? "";
const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") ?? "";
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") ?? "";
const GOOGLE_OAUTH_REFRESH_TOKEN = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN") ?? "";
const OAUTH_REDIRECT_URI = "http://localhost";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

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

const ETIQUETAS_RESPUESTA: Record<string, string> = {
  disponible: "✅ Disponible",
  no_disponible: "❌ No disponible",
  posiblemente: "🤔 Posiblemente",
};

const PASOS_CONVOCAR = [
  "convocar_planta",
  "convocar_titulo",
  "convocar_fecha_servicio",
  "convocar_hora_servicio",
  "convocar_descripcion",
  "convocar_fecha_limite",
  "convocar_confirmar",
];

const PREGUNTAS_CONVOCAR: Record<string, string> = {
  convocar_planta: "🏭 ¿Cuál es la planta o ubicación del servicio?",
  convocar_titulo:
    '📌 ¿Cuál es el título/motivo de la convocatoria? (ej. "Parada de planta - mantenimiento anual")',
  convocar_fecha_servicio: "🗓️ ¿Cuál es la fecha del servicio? Formato AAAA-MM-DD (ej. 2026-08-15).",
  convocar_hora_servicio: '🕐 ¿A qué hora? (o envía "-" si no aplica)',
  convocar_descripcion: '📝 Agrega una descripción/detalle para los usuarios (o envía "-" para dejarla vacía).',
  convocar_fecha_limite:
    '⏰ ¿Hasta cuándo pueden responder? Formato AAAA-MM-DD o AAAA-MM-DD HH:MM (o envía "-" si no aplica).',
};

// El DNI va primero (antes que el nombre) a propósito: es la llave para
// reconocer a alguien que ya está en convocatoria_personal (cargado a mano
// por RRHH, o de una respuesta anterior) y saltar directo a
// confirmar/editar en vez de volver a preguntar todo desde cero.
const ORDEN_RESPUESTA = [
  "resp_dni",
  "resp_nombres_completos",
  "resp_telefono",
  "resp_lugar_residencia",
  "resp_especialidad",
  "resp_experiencia",
  "resp_cv",
];

const PREGUNTAS_RESPUESTA: Record<string, string> = {
  resp_nombres_completos: "🪪 Indica tus nombres completos.",
  resp_dni: "🆔 Indica tu número de DNI.",
  resp_telefono: "📞 Indica tu número de teléfono.",
  resp_lugar_residencia: "📍 Indica tu lugar de residencia.",
  resp_experiencia: "🛠️ Cuéntanos brevemente tu experiencia. Puedes escribirla en texto o enviar una nota de voz.",
  resp_cv: "📎 Por último, adjunta tu CV (PDF o Word) como documento, directo en este chat.",
};

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number | string };
    from?: { id: number | string; first_name?: string; username?: string };
    text?: string;
    voice?: { file_id: string };
    document?: { file_id: string; file_name?: string; mime_type?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number | string; first_name?: string; username?: string };
    message?: { message_id: number; chat: { id: number | string } };
    data?: string;
  };
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function isAdmin(chatId: string): boolean {
  const admins = ADMIN_CHAT_IDS.split(",").map((id) => id.trim()).filter(Boolean);
  return admins.includes(chatId);
}

async function telegram(method: string, payload: Record<string, unknown>) {
  const response = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Telegram error ${response.status}: ${await response.text()}`);
  }
  return await response.json();
}

async function sendMessage(chatId: string, text: string, replyMarkup?: Record<string, unknown>) {
  return await telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
}

async function editMessage(chatId: string, messageId: number, text: string, replyMarkup?: Record<string, unknown>) {
  return await telegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup ?? { inline_keyboard: [] },
  });
}

async function answerCallback(callbackId: string, text?: string) {
  return await telegram("answerCallbackQuery", { callback_query_id: callbackId, text, show_alert: false });
}

let usernameBotCache: string | null = null;
async function obtenerUsernameBot(): Promise<string | null> {
  if (usernameBotCache) return usernameBotCache;
  try {
    const info = await telegram("getMe", {});
    usernameBotCache = info.result?.username ?? null;
    return usernameBotCache;
  } catch {
    return null;
  }
}

function linkConvocatoria(username: string | null, convocatoriaId: string): string | null {
  return username ? `https://t.me/${username}?start=conv_${convocatoriaId}` : null;
}

/** Normaliza un telefono a formato wa.me: numeros de 9 digitos se asumen
 * celulares peruanos (se les antepone 51); si ya traen mas digitos se
 * asume que el codigo de pais ya viene incluido. Misma regla que
 * scripts/exportar_respuestas_sheets.py. */
function linkWhatsApp(telefono: string | null | undefined, etiqueta: string): string | null {
  const soloDigitos = String(telefono ?? "").replace(/\D/g, "");
  if (!soloDigitos) return null;
  const conCodigoPais = soloDigitos.length === 9 ? `51${soloDigitos}` : soloDigitos;
  return `<a href="https://wa.me/${conCodigoPais}">${escapeHtml(etiqueta)}</a>`;
}

// --- Google Drive (OAuth de usuario, no cuenta de servicio) ----------------
//
// Las cuentas de servicio no tienen cuota propia de almacenamiento en Drive
// (solo funcionan con Shared Drives, que requieren Google Workspace). Para
// una cuenta Gmail normal hay que subir los archivos "como" un usuario real,
// via OAuth con refresh_token -- ver /vincular_drive mas abajo para obtenerlo.

async function obtenerTokenGoogle(): Promise<string> {
  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  const datos = await respuesta.json();
  if (!datos.access_token) throw new Error("No se pudo refrescar el token de Google: " + JSON.stringify(datos));
  return datos.access_token;
}

/** Intercambia el codigo de autorizacion (de /vincular_drive) por un
 * refresh_token duradero, que el admin debe guardar como secreto. */
async function intercambiarCodigoOAuth(codigo: string): Promise<{ ok: boolean; mensaje: string }> {
  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      code: codigo,
      grant_type: "authorization_code",
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });

  const datos = await respuesta.json();
  if (!datos.refresh_token) {
    return { ok: false, mensaje: "No se recibió refresh_token. Respuesta de Google:\n" + JSON.stringify(datos) };
  }
  return { ok: true, mensaje: datos.refresh_token };
}

function base64FromBytes(bytes: Uint8Array): string {
  let binario = "";
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo));
  }
  return btoa(binario);
}

async function subirArchivoADrive(
  nombreArchivo: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<{ id: string; webViewLink: string }> {
  const accessToken = await obtenerTokenGoogle();

  const metadata: Record<string, unknown> = { name: nombreArchivo };
  if (GOOGLE_DRIVE_CV_FOLDER_ID) metadata.parents = [GOOGLE_DRIVE_CV_FOLDER_ID];

  const boundary = "convocatorias_eka_boundary";
  const cuerpo =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64FromBytes(bytes)}\r\n` +
    `--${boundary}--`;

  const respuesta = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: cuerpo,
    },
  );

  const datos = await respuesta.json();
  if (!datos.id) throw new Error("No se pudo subir el archivo a Drive: " + JSON.stringify(datos));
  return datos;
}

async function descargarBytesTelegram(
  fileId: string,
): Promise<{ bytes: Uint8Array; mimeType: string; filePath: string }> {
  const infoResp = await fetch(`${TELEGRAM_API}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const info = await infoResp.json();
  if (!info.ok) throw new Error("No se pudo resolver el archivo de Telegram: " + JSON.stringify(info));

  const filePath: string = info.result.file_path;
  const fileResp = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`);
  const bytes = new Uint8Array(await fileResp.arrayBuffer());
  const mimeType = fileResp.headers.get("content-type") || "application/octet-stream";

  return { bytes, mimeType, filePath };
}

async function guardarCvEnDrive(fileId: string, nombreSugerido: string, nombreOriginal?: string): Promise<string> {
  const { bytes, mimeType, filePath } = await descargarBytesTelegram(fileId);
  const extension = (nombreOriginal || filePath).split(".").pop() || "pdf";
  const nombreArchivo = `${nombreSugerido}.${extension}`;

  const archivo = await subirArchivoADrive(nombreArchivo, mimeType, bytes);
  return archivo.webViewLink;
}

/** Transcribe una nota de voz con Gemini. Devuelve null (sin lanzar) si no
 * hay GEMINI_API_KEY configurada o si Gemini no devuelve texto -- la
 * experiencia por audio no debe bloquearse porque falle la transcripcion. */
async function transcribirAudio(bytes: Uint8Array): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Transcribe este audio a texto en español. Devuelve unicamente la transcripcion, sin comentarios ni encabezados.",
                },
                { inlineData: { mimeType: "audio/ogg", data: base64FromBytes(bytes) } },
              ],
            },
          ],
        }),
      },
    );

    const datos = await response.json();
    const texto: string | undefined = datos?.candidates?.[0]?.content?.parts?.[0]?.text;
    return texto?.trim() || null;
  } catch (error) {
    console.error("TRANSCRIPCION_ERROR:", error);
    return null;
  }
}

function construirNombreArchivoCv(nombresCompletos: string | null, dni: string | null, chatId: string): string {
  const partes = [nombresCompletos, dni].filter(Boolean);
  const base = partes.length ? partes.join(" - ") : `CV_${chatId}`;
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
}

// --- Especialidades, sesiones, usuarios (Supabase) -------------------------

async function getEspecialidades(): Promise<string[]> {
  const { data } = await supabase.from("convocatoria_especialidades").select("nombre").order("nombre");
  if (data && data.length) return data.map((f) => f.nombre as string);

  await supabase.from("convocatoria_especialidades").insert(
    ESPECIALIDADES_INICIALES.map((nombre) => ({ nombre })),
  );
  return ESPECIALIDADES_INICIALES;
}

async function addEspecialidad(nombre: string): Promise<boolean> {
  const existentes = await getEspecialidades();
  if (existentes.some((e) => e.toLowerCase() === nombre.toLowerCase())) return false;
  await supabase.from("convocatoria_especialidades").insert({ nombre });
  return true;
}

type Sesion = { paso: string; datos: Record<string, any> };

async function getSession(chatId: string): Promise<Sesion | null> {
  const { data } = await supabase
    .from("convocatoria_sesiones")
    .select("paso, datos")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data ? { paso: data.paso, datos: data.datos ?? {} } : null;
}

async function saveSession(chatId: string, paso: string, datos: Record<string, any>) {
  await supabase.from("convocatoria_sesiones").upsert({
    telegram_chat_id: chatId,
    paso,
    datos,
    actualizado_at: new Date().toISOString(),
  });
}

async function deleteSession(chatId: string) {
  await supabase.from("convocatoria_sesiones").delete().eq("telegram_chat_id", chatId);
}

async function upsertUsuario(chatId: string, from: { id: number | string; first_name?: string; username?: string }) {
  const ahora = new Date().toISOString();
  const { data: existente } = await supabase
    .from("convocatoria_usuarios")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("convocatoria_usuarios")
      .update({ telegram_user_id: String(from.id), username: from.username ?? null, estado: "activo", ultima_actividad: ahora })
      .eq("telegram_chat_id", chatId);
    return;
  }

  await supabase.from("convocatoria_usuarios").insert({
    telegram_chat_id: chatId,
    telegram_user_id: String(from.id),
    nombre: from.first_name ?? null,
    username: from.username ?? null,
    estado: "activo",
    primer_registro: ahora,
    ultima_actividad: ahora,
  });
}

async function getUsuariosActivos() {
  const { data } = await supabase.from("convocatoria_usuarios").select("telegram_chat_id").eq("estado", "activo");
  return data ?? [];
}

// --- Textos y teclados -------------------------------------------------

function textoConvocatoria(c: any): string {
  const lines = [
    "📢 <b>Convocatoria - Parada de planta</b>",
    "",
    `🏭 <b>${escapeHtml(c.planta || "Planta")}</b>`,
    `📌 ${escapeHtml(c.titulo || "")}`,
  ];
  if (c.descripcion) lines.push("", escapeHtml(c.descripcion));

  const fechaLinea = `🗓️ Fecha del servicio: ${escapeHtml(c.fecha_servicio)}`;
  lines.push("", c.hora_servicio ? `${fechaLinea} — ${escapeHtml(c.hora_servicio)}` : fechaLinea);

  if (c.fecha_limite_respuesta) lines.push(`⏰ Responde antes de: ${escapeHtml(c.fecha_limite_respuesta)}`);
  lines.push("", "¿Estás disponible para participar? Confirma con un botón:");
  return lines.join("\n");
}

function botonesConvocatoria(convocatoriaId: string) {
  return {
    inline_keyboard: Object.entries(ETIQUETAS_RESPUESTA).map(([respuesta, texto]) => [
      { text: texto, callback_data: `conv:${convocatoriaId}:${respuesta}` },
    ]),
  };
}

function botonesEspecialidades(especialidades: string[]) {
  const filas = [];
  for (let i = 0; i < especialidades.length; i += 2) {
    filas.push(especialidades.slice(i, i + 2).map((nombre) => ({ text: nombre, callback_data: `esp:${nombre}` })));
  }
  return { inline_keyboard: filas };
}

function bienvenidaTexto(): string {
  return [
    "🤖 <b>Convocatorias EKA</b>",
    "",
    "Quedaste registrado. Cuando se abra una convocatoria a una parada de",
    "planta, te va a llegar aquí un mensaje con la fecha del servicio y",
    "botones para confirmar tu disponibilidad.",
  ].join("\n");
}

function helpTexto(admin: boolean): string {
  const base = [
    "ℹ️ <b>Comandos disponibles</b>",
    "",
    "<b>/start</b> — Te registra para recibir convocatorias.",
    "<b>/ayuda</b> — Muestra esta ayuda.",
  ];
  if (!admin) return base.join("\n");
  return base.concat([
    "",
    "🔐 <b>Comandos de administrador</b>",
    "<b>/convocar</b> — Crea y envía una convocatoria paso a paso.",
    "<b>/cancelar</b> — Cancela lo que estés armando.",
    "<b>/especialidad_agregar Nombre</b> — Agrega una especialidad a la lista de botones.",
    "<b>/especialidades</b> — Lista las especialidades configuradas.",
    "<b>/resumen convocatoria_id</b> — Cuenta de disponibles / no disponibles / posiblemente, con WhatsApp clickeable de cada contacto.",
    "<b>/vincular_drive codigo</b> — Cambia el token de Google Drive (ver README).",
    "<b>/actualizar_menu</b> — Refresca el menú \"/\" de Telegram con estos comandos.",
  ]).join("\n");
}

// --- Menu nativo de comandos de Telegram (boton "/") ------------------

const COMANDOS_PUBLICOS = [
  { command: "start", description: "Registrarte para recibir convocatorias" },
  { command: "ayuda", description: "Ver los comandos disponibles" },
];

const COMANDOS_ADMIN = [
  ...COMANDOS_PUBLICOS,
  { command: "convocar", description: "Crear y enviar una convocatoria" },
  { command: "especialidad_agregar", description: "Agregar una especialidad a la lista" },
  { command: "especialidades", description: "Listar las especialidades configuradas" },
  { command: "resumen", description: "Ver respuestas de una convocatoria (con WhatsApp)" },
  { command: "vincular_drive", description: "Vincular/renovar el acceso a Google Drive" },
  { command: "cancelar", description: "Cancelar lo que estés armando" },
  { command: "actualizar_menu", description: "Refrescar este menú de comandos" },
];

/** Registra el menu "/" de Telegram: la lista basica para cualquier chat, y
 * la lista completa (con los comandos de administrador) solo para los
 * chats de ADMIN_CHAT_IDS, via BotCommandScopeChat. Hay que llamarla a mano
 * (con /actualizar_menu) despues de desplegar o de cambiar la lista de
 * comandos -- Telegram no la refresca sola. */
async function actualizarMenuComandos(): Promise<void> {
  await telegram("setMyCommands", { commands: COMANDOS_PUBLICOS, scope: { type: "default" } });

  const admins = ADMIN_CHAT_IDS.split(",").map((id) => id.trim()).filter(Boolean);
  for (const adminId of admins) {
    try {
      await telegram("setMyCommands", {
        commands: COMANDOS_ADMIN,
        scope: { type: "chat", chat_id: adminId },
      });
    } catch (error) {
      console.error("SET_MY_COMMANDS_ERROR:", adminId, error);
    }
  }
}

function validarFecha(v: string) { return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()); }
function validarFechaHoraOpcional(v: string) { return /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/.test(v.trim()); }

function resumenBorrador(datos: any): string {
  const lines = [
    "📋 <b>Revisa los datos antes de enviar</b>",
    "",
    `🏭 Planta: ${escapeHtml(datos.planta)}`,
    `📌 Título: ${escapeHtml(datos.titulo)}`,
    `🗓️ Fecha del servicio: ${escapeHtml(datos.fecha_servicio)}`,
  ];
  if (datos.hora_servicio) lines.push(`🕐 Hora: ${escapeHtml(datos.hora_servicio)}`);
  if (datos.descripcion) lines.push(`📝 Descripción: ${escapeHtml(datos.descripcion)}`);
  if (datos.fecha_limite_respuesta) lines.push(`⏰ Responder antes de: ${escapeHtml(datos.fecha_limite_respuesta)}`);
  lines.push("", "¿Qué hacemos con esta convocatoria?");
  return lines.join("\n");
}

function confirmarKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🚀 Enviar ahora a todos", callback_data: "confirmar_convocatoria:enviar" }],
      [{ text: "💾 Guardar como borrador", callback_data: "confirmar_convocatoria:borrador" }],
      [{ text: "🗑️ Cancelar", callback_data: "confirmar_convocatoria:cancelar" }],
    ],
  };
}

// --- Flujo /convocar (admin) ---------------------------------------------

async function iniciarConvocar(chatId: string) {
  await saveSession(chatId, "convocar_planta", {});
  await sendMessage(
    chatId,
    "📢 <b>Nueva convocatoria</b>\n\nTe voy a pedir los datos uno por uno. Escribe /cancelar en cualquier momento para abortar.\n\n" +
      PREGUNTAS_CONVOCAR.convocar_planta,
  );
}

async function manejarPasoConvocar(chatId: string, sesion: Sesion, texto: string) {
  const paso = sesion.paso;
  const datos = { ...sesion.datos };

  if (paso === "convocar_fecha_servicio" && !validarFecha(texto)) {
    return await sendMessage(chatId, "Formato inválido. Usa AAAA-MM-DD, por ejemplo 2026-08-15.");
  }
  if (paso === "convocar_fecha_limite" && texto.trim() !== "-" && !validarFechaHoraOpcional(texto)) {
    return await sendMessage(chatId, 'Formato inválido. Usa AAAA-MM-DD o AAAA-MM-DD HH:MM, o envía "-" si no aplica.');
  }

  const campo = paso.replace("convocar_", "");
  const campoDestino = campo === "fecha_limite" ? "fecha_limite_respuesta" : campo;
  const opcionalesVacios = ["hora_servicio", "descripcion", "fecha_limite"];
  const valor = texto.trim();
  datos[campoDestino] = opcionalesVacios.includes(campo) && valor === "-" ? "" : valor;

  const indiceActual = PASOS_CONVOCAR.indexOf(paso);
  const siguientePaso = PASOS_CONVOCAR[indiceActual + 1];

  if (siguientePaso === "convocar_confirmar") {
    await saveSession(chatId, "convocar_confirmar", datos);
    return await sendMessage(chatId, resumenBorrador(datos), confirmarKeyboard());
  }

  await saveSession(chatId, siguientePaso, datos);
  return await sendMessage(chatId, PREGUNTAS_CONVOCAR[siguientePaso]);
}

async function enviarConvocatoriaATodos(convocatoria: any): Promise<number> {
  const usuarios = await getUsuariosActivos();
  let enviados = 0;
  for (const usuario of usuarios) {
    try {
      await sendMessage(usuario.telegram_chat_id, textoConvocatoria(convocatoria), botonesConvocatoria(convocatoria.id));
      enviados += 1;
    } catch {
      // se ignora el fallo individual, se sigue con el resto
    }
  }
  await supabase.from("convocatorias").update({ estado: "enviada", enviada_at: new Date().toISOString() }).eq(
    "id",
    convocatoria.id,
  );
  return enviados;
}

async function manejarConfirmacionConvocar(chatId: string, callbackId: string, accion: string) {
  const sesion = await getSession(chatId);
  if (!sesion || sesion.paso !== "convocar_confirmar") {
    return await answerCallback(callbackId, "Esta convocatoria ya no está en edición.");
  }

  if (accion === "cancelar") {
    await deleteSession(chatId);
    await answerCallback(callbackId, "Convocatoria cancelada.");
    return await sendMessage(chatId, "🗑️ Convocatoria cancelada. Usa /convocar para empezar de nuevo.");
  }

  const datos = sesion.datos;
  const { data: convocatoria, error } = await supabase
    .from("convocatorias")
    .insert({
      titulo: datos.titulo,
      planta: datos.planta,
      fecha_servicio: datos.fecha_servicio,
      hora_servicio: datos.hora_servicio || null,
      descripcion: datos.descripcion || null,
      fecha_limite_respuesta: datos.fecha_limite_respuesta || null,
      creado_por: chatId,
      estado: "borrador",
    })
    .select()
    .single();

  await deleteSession(chatId);

  if (error || !convocatoria) {
    await answerCallback(callbackId, "Error al guardar la convocatoria.");
    return await sendMessage(chatId, `⚠️ No pude guardar la convocatoria: ${escapeHtml(error?.message ?? "")}`);
  }

  const username = await obtenerUsernameBot();
  const link = linkConvocatoria(username, convocatoria.id);
  const lineaLink = link
    ? `\n\n🔗 Link para compartir (WhatsApp, redes, donde quieras): quien lo abra por primera vez queda registrado y ve esta convocatoria directo:\n${link}`
    : "";

  if (accion === "borrador") {
    await answerCallback(callbackId, "Guardada como borrador.");
    return await sendMessage(chatId, `💾 Convocatoria guardada como borrador.\n\nID: <code>${convocatoria.id}</code>${lineaLink}`);
  }

  await answerCallback(callbackId, "Enviando a todos los usuarios...");
  const enviados = await enviarConvocatoriaATodos(convocatoria);
  return await sendMessage(
    chatId,
    `🚀 Convocatoria enviada a ${enviados} usuario(s).\n\nID: <code>${convocatoria.id}</code>\n\nUsa /resumen ${convocatoria.id} para ver las respuestas.${lineaLink}`,
  );
}

async function manejarResumen(chatId: string, convocatoriaId: string) {
  const { data: convocatoria } = await supabase.from("convocatorias").select("*").eq("id", convocatoriaId).maybeSingle();
  if (!convocatoria) {
    return await sendMessage(chatId, `No encontré ninguna convocatoria con id "${escapeHtml(convocatoriaId)}".`);
  }

  const { data: respuestas } = await supabase
    .from("convocatoria_respuestas")
    .select("nombres_completos, nombre_telegram, telefono, especialidad, respuesta")
    .eq("convocatoria_id", convocatoriaId);

  const filas = respuestas ?? [];
  const conteo: Record<string, number> = { disponible: 0, no_disponible: 0, posiblemente: 0 };
  for (const fila of filas) if (fila.respuesta && conteo[fila.respuesta] !== undefined) conteo[fila.respuesta] += 1;

  const lines = [
    `📋 <b>${escapeHtml(convocatoria.titulo)}</b>`,
    `🏭 ${escapeHtml(convocatoria.planta ?? "")} — 🗓️ ${escapeHtml(convocatoria.fecha_servicio)}`,
    "",
    `Total respuestas: ${filas.length}`,
    `✅ Disponible: ${conteo.disponible}`,
    `❌ No disponible: ${conteo.no_disponible}`,
    `🤔 Posiblemente: ${conteo.posiblemente}`,
  ];

  // Detalle con WhatsApp clickeable, solo de quienes hay que contactar
  // (disponible / posiblemente). El listado completo (con DNI, CV, etc.)
  // vive en la exportación a Sheets (scripts/exportar_respuestas_sheets.py).
  const contactos = filas.filter((f) => f.respuesta === "disponible" || f.respuesta === "posiblemente");
  const LIMITE_DETALLE = 40;
  if (contactos.length) {
    lines.push("", "<b>Contactos (disponible / posiblemente):</b>");
    for (const fila of contactos.slice(0, LIMITE_DETALLE)) {
      const nombre = escapeHtml(fila.nombres_completos || fila.nombre_telegram || "Sin nombre");
      const especialidad = fila.especialidad ? ` — ${escapeHtml(fila.especialidad)}` : "";
      const icono = fila.respuesta === "disponible" ? "✅" : "🤔";
      const wa = linkWhatsApp(fila.telefono, "📱 WhatsApp");
      lines.push(`${icono} ${nombre}${especialidad}${wa ? " — " + wa : ""}`);
    }
    if (contactos.length > LIMITE_DETALLE) {
      lines.push(`… y ${contactos.length - LIMITE_DETALLE} más (ver exportación a Sheets para el listado completo).`);
    }
  }

  return await sendMessage(chatId, lines.join("\n"));
}

// --- Flujo de respuesta del usuario convocado -----------------------------

const CAMPO_POR_PASO: Record<string, string> = {
  resp_nombres_completos: "nombres_completos",
  resp_dni: "dni",
  resp_telefono: "telefono",
  resp_lugar_residencia: "lugar_residencia",
  resp_especialidad: "especialidad",
  resp_experiencia: "experiencia_texto",
  resp_cv: "cv_drive_url",
};

const ETIQUETAS_CAMPO: Record<string, string> = {
  nombres_completos: "tus nombres completos",
  dni: "tu DNI",
  telefono: "tu teléfono",
  lugar_residencia: "tu lugar de residencia",
  especialidad: "tu especialidad",
};

function pasoConfirmacion(paso: string): string {
  return `confirmar_${paso}`;
}

const CAMPOS_PERFIL =
  "nombres_completos, dni, telefono, lugar_residencia, especialidad, experiencia_texto, experiencia_audio_file_id, cv_drive_url";

/** Busca el perfil mas reciente que este mismo chat ya completo en OTRA
 * convocatoria, para no volver a pedirle los mismos datos desde cero. Se
 * evalua campo por campo (no todo o nada): si solo tiene telefono pero no
 * CV todavia, solo se ofrece confirmar/editar telefono. */
async function obtenerUltimoPerfil(chatId: string, convocatoriaIdActual: string) {
  const { data } = await supabase
    .from("convocatoria_respuestas")
    .select(CAMPOS_PERFIL)
    .eq("telegram_chat_id", chatId)
    .neq("convocatoria_id", convocatoriaIdActual)
    .order("respondido_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Busca por DNI (no por chat de Telegram): cubre el caso de alguien que
 * responde desde otro numero/cuenta de Telegram, para no pedirle todo de
 * nuevo solo porque cambio de celular. */
async function buscarPerfilPorDni(dni: string, convocatoriaIdActual: string) {
  const { data } = await supabase
    .from("convocatoria_respuestas")
    .select(CAMPOS_PERFIL)
    .eq("dni", dni)
    .neq("convocatoria_id", convocatoriaIdActual)
    .order("respondido_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Busca en la base maestra de personal (convocatoria_personal): cubre a
 * alguien que RRHH ya cargó a mano (en NocoDB) pero que nunca respondió por
 * Telegram, para que igual se le reconozca como ya registrado. */
async function buscarEnPersonal(dni: string) {
  const { data } = await supabase
    .from("convocatoria_personal")
    .select("nombres_completos, telefono, lugar_residencia, especialidad")
    .eq("dni", dni)
    .maybeSingle();
  return data;
}

/** Combina dos perfiles priorizando los valores no vacios de "prioritario"
 * (el que ya veniamos usando) y rellenando los huecos con "respaldo" (el
 * encontrado por DNI). */
function fusionarPerfiles(
  prioritario: Record<string, unknown> | null,
  respaldo: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!prioritario) return respaldo;
  if (!respaldo) return prioritario;
  const combinado: Record<string, unknown> = { ...respaldo };
  for (const key of Object.keys(prioritario)) {
    const valor = prioritario[key];
    if (valor !== null && valor !== undefined && valor !== "") combinado[key] = valor;
  }
  return combinado;
}

function dniValido(texto: string): boolean {
  return /^\d{8}$/.test(texto.trim());
}

function telefonoValido(texto: string): boolean {
  const digitos = texto.replace(/\D/g, "");
  return digitos.length === 9 || (digitos.length === 11 && digitos.startsWith("51"));
}

function valorPrevioDeCampo(previo: Record<string, unknown> | null, campo: string): unknown {
  if (!previo) return null;
  if (campo === "experiencia_texto") return previo.experiencia_texto || previo.experiencia_audio_file_id;
  return previo[campo];
}

function botonesConfirmarDato(campo: string) {
  const textoConfirmar = campo === "cv_drive_url" ? "✅ Usar el mismo CV" : "✅ Confirmar";
  const textoEditar = campo === "cv_drive_url" ? "📤 Subir uno nuevo" : "✏️ Editar";
  return {
    inline_keyboard: [[
      { text: textoConfirmar, callback_data: `confdato:${campo}:confirmar` },
      { text: textoEditar, callback_data: `confdato:${campo}:editar` },
    ]],
  };
}

function textoConfirmarDato(campo: string, previo: Record<string, unknown>): string {
  if (campo === "cv_drive_url") {
    return "📎 Ya tenemos un CV tuyo guardado de una convocatoria anterior.\n\n¿Lo usamos de nuevo o subes uno actualizado?";
  }
  if (campo === "experiencia_texto") {
    const valor = (previo.experiencia_texto as string) || "(nota de voz guardada)";
    return `🛠️ Tu experiencia registrada:\n"${escapeHtml(valor)}"\n\n¿La confirmas o la actualizas?`;
  }
  const etiqueta = ETIQUETAS_CAMPO[campo] ?? campo;
  return `Tenemos registrado ${etiqueta}: <b>${escapeHtml(previo[campo])}</b>\n\n¿Lo confirmas o lo editas?`;
}

/** Muestra la pregunta de un paso desde cero (sin dato previo que confirmar):
 * botones de especialidad, o la pregunta de texto/audio/documento que toque. */
async function mostrarPreguntaPaso(chatId: string, paso: string) {
  if (paso === "resp_especialidad") {
    const especialidades = await getEspecialidades();
    return await sendMessage(chatId, "🛠️ Indica tu especialidad:", botonesEspecialidades(especialidades));
  }
  return await sendMessage(chatId, PREGUNTAS_RESPUESTA[paso]);
}

/** Punto de entrada de cada paso del flujo: si el usuario ya tiene ese dato
 * de una convocatoria anterior, ofrece confirmar/editar; si no, pregunta
 * normalmente como siempre. */
async function iniciarPaso(chatId: string, sesion: Sesion, paso: string) {
  const previo = (sesion.datos.previo ?? null) as Record<string, unknown> | null;
  const campo = CAMPO_POR_PASO[paso];
  const valorPrevio = valorPrevioDeCampo(previo, campo);

  if (valorPrevio) {
    await saveSession(chatId, pasoConfirmacion(paso), sesion.datos);
    return await sendMessage(chatId, textoConfirmarDato(campo, previo!), botonesConfirmarDato(campo));
  }

  await saveSession(chatId, paso, sesion.datos);
  return await mostrarPreguntaPaso(chatId, paso);
}

/** Avanza al siguiente paso de ORDEN_RESPUESTA (o cierra el registro si ya
 * no queda ninguno), decidiendo en cada uno si toca confirmar/editar o
 * preguntar desde cero. Reemplaza la logica que antes estaba repetida al
 * final de cada manejador de paso. */
async function avanzarAlSiguientePaso(chatId: string, sesion: Sesion, pasoActual: string) {
  const siguientePaso = ORDEN_RESPUESTA[ORDEN_RESPUESTA.indexOf(pasoActual) + 1];
  if (!siguientePaso) {
    return await mostrarResumenFinal(chatId, sesion);
  }
  return await iniciarPaso(chatId, sesion, siguientePaso);
}

/** Igual que avanzarAlSiguientePaso, pero si el paso que se acaba de guardar
 * vino de "editar un dato puntual" desde el resumen final (sesion.datos.modo
 * === "resumen"), en vez de seguir la marcha normal vuelve a mostrar el
 * resumen -- asi editar un campo no reinicia todo el flujo. */
async function avanzarOResumen(chatId: string, sesion: Sesion, pasoActual: string) {
  if (sesion.datos.modo === "resumen") {
    sesion.datos.modo = null;
    return await mostrarResumenFinal(chatId, sesion);
  }
  return await avanzarAlSiguientePaso(chatId, sesion, pasoActual);
}

const ETIQUETAS_RESUMEN: [string, string][] = [
  ["nombres_completos", "🪪 Nombres"],
  ["dni", "🆔 DNI"],
  ["telefono", "📞 Teléfono"],
  ["lugar_residencia", "📍 Lugar"],
  ["especialidad", "🛠️ Especialidad"],
  ["experiencia_texto", "🛠️ Experiencia"],
  ["cv_drive_url", "📎 CV"],
];

function botonesResumenFinal() {
  const filas = [];
  for (let i = 0; i < ETIQUETAS_RESUMEN.length; i += 2) {
    filas.push(
      ETIQUETAS_RESUMEN.slice(i, i + 2).map(([campo, texto]) => ({
        text: `✏️ ${texto}`,
        callback_data: `resumeneditar:${campo}`,
      })),
    );
  }
  filas.push([{ text: "🚀 Confirmar y enviar", callback_data: "resumenenviar" }]);
  return { inline_keyboard: filas };
}

/** Muestra todos los datos ya guardados con un boton de editar por cada
 * uno, y un boton final para confirmar. Se llama al terminar la marcha
 * normal (fin de resp_cv) y tambien cada vez que se vuelve de editar un
 * campo puntual desde aqui mismo. */
async function mostrarResumenFinal(chatId: string, sesion: Sesion) {
  const convocatoriaId = sesion.datos.convocatoria_id;
  const { data: respuesta } = await supabase
    .from("convocatoria_respuestas")
    .select(CAMPOS_PERFIL)
    .eq("convocatoria_id", convocatoriaId)
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  const r = (respuesta ?? {}) as Record<string, unknown>;
  const experiencia = (r.experiencia_texto as string) || (r.experiencia_audio_file_id ? "(nota de voz guardada)" : "-");

  const lines = [
    "📋 <b>Revisa tus datos antes de enviar</b>",
    "",
    `🪪 Nombres: ${escapeHtml(r.nombres_completos ?? "-")}`,
    `🆔 DNI: ${escapeHtml(r.dni ?? "-")}`,
    `📞 Teléfono: ${escapeHtml(r.telefono ?? "-")}`,
    `📍 Lugar de residencia: ${escapeHtml(r.lugar_residencia ?? "-")}`,
    `🛠️ Especialidad: ${escapeHtml(r.especialidad ?? "-")}`,
    `🛠️ Experiencia: ${escapeHtml(experiencia)}`,
    `📎 CV: ${r.cv_drive_url ? "✅ adjuntado" : "-"}`,
    "",
    "Toca un dato para corregirlo, o confirma para enviar tu registro.",
  ];

  await saveSession(chatId, "resumen_final", sesion.datos);
  return await sendMessage(chatId, lines.join("\n"), botonesResumenFinal());
}

async function manejarResumenEditarCallback(chatId: string, callbackId: string, campo: string) {
  const sesion = await getSession(chatId);
  if (!sesion || sesion.paso !== "resumen_final") return await answerCallback(callbackId, "Esto ya no está activo.");

  const paso = Object.entries(CAMPO_POR_PASO).find(([, c]) => c === campo)?.[0];
  if (!paso) return await answerCallback(callbackId, "Campo no reconocido.");

  await answerCallback(callbackId, "Ok, indícalo de nuevo.");
  sesion.datos.modo = "resumen";
  await saveSession(chatId, paso, sesion.datos);
  return await mostrarPreguntaPaso(chatId, paso);
}

async function manejarResumenEnviarCallback(chatId: string, callbackId: string) {
  const sesion = await getSession(chatId);
  if (!sesion || sesion.paso !== "resumen_final") return await answerCallback(callbackId, "Esto ya no está activo.");

  await deleteSession(chatId);
  await answerCallback(callbackId, "¡Enviado!");
  return await sendMessage(chatId, "✅ ¡Gracias! Tu registro quedó completo.");
}

async function manejarConfirmarDatoCallback(chatId: string, callbackId: string, campo: string, accion: string) {
  const paso = Object.entries(CAMPO_POR_PASO).find(([, c]) => c === campo)?.[0];
  const sesion = await getSession(chatId);
  if (!paso || !sesion || sesion.paso !== pasoConfirmacion(paso)) {
    return await answerCallback(callbackId, "Esto ya no está activo.");
  }

  const convocatoriaId = sesion.datos.convocatoria_id;
  const previo = (sesion.datos.previo ?? {}) as Record<string, unknown>;

  if (accion === "editar") {
    await answerCallback(callbackId, "Ok, indícalo de nuevo.");
    await saveSession(chatId, paso, sesion.datos);
    return await mostrarPreguntaPaso(chatId, paso);
  }

  if (campo === "experiencia_texto") {
    await supabase.from("convocatoria_respuestas").update({
      experiencia_texto: previo.experiencia_texto ?? null,
      experiencia_audio_file_id: previo.experiencia_audio_file_id ?? null,
    }).eq("convocatoria_id", convocatoriaId).eq("telegram_chat_id", chatId);
  } else {
    await supabase.from("convocatoria_respuestas").update({ [campo]: previo[campo] ?? null }).eq(
      "convocatoria_id",
      convocatoriaId,
    ).eq("telegram_chat_id", chatId);
  }
  await sincronizarRespuesta(convocatoriaId, chatId);

  await answerCallback(callbackId, "Confirmado.");
  return await avanzarOResumen(chatId, sesion, paso);
}

async function manejarRespuestaCallback(
  chatId: string,
  messageId: number,
  callbackId: string,
  from: { first_name?: string; username?: string },
  convocatoriaId: string,
  respuesta: string,
) {
  if (!ETIQUETAS_RESPUESTA[respuesta]) return await answerCallback(callbackId, "Opción no reconocida.");

  const { data: convocatoria } = await supabase.from("convocatorias").select("*").eq("id", convocatoriaId).maybeSingle();
  if (!convocatoria) return await answerCallback(callbackId, "Esta convocatoria ya no existe.");

  await supabase.from("convocatoria_respuestas").upsert(
    {
      convocatoria_id: convocatoriaId,
      telegram_chat_id: chatId,
      nombre_telegram: from.first_name ?? null,
      username: from.username ?? null,
      respuesta,
      respondido_at: new Date().toISOString(),
    },
    { onConflict: "convocatoria_id,telegram_chat_id" },
  );
  await sincronizarRespuesta(convocatoriaId, chatId);

  const lines = [
    "📢 <b>Convocatoria - Parada de planta</b>",
    "",
    `🏭 <b>${escapeHtml(convocatoria.planta || "Planta")}</b>`,
    `📌 ${escapeHtml(convocatoria.titulo)}`,
    "",
    `🗓️ Fecha del servicio: ${escapeHtml(convocatoria.fecha_servicio)}${
      convocatoria.hora_servicio ? " — " + escapeHtml(convocatoria.hora_servicio) : ""
    }`,
    "",
    `Tu respuesta: <b>${ETIQUETAS_RESPUESTA[respuesta]}</b>`,
  ];
  await editMessage(chatId, messageId, lines.join("\n"));
  await answerCallback(callbackId, `Respuesta registrada: ${ETIQUETAS_RESPUESTA[respuesta]}`);

  const previo = await obtenerUltimoPerfil(chatId, convocatoriaId);
  const sesion: Sesion = { paso: ORDEN_RESPUESTA[0], datos: { convocatoria_id: convocatoriaId, previo } };
  return await iniciarPaso(chatId, sesion, ORDEN_RESPUESTA[0]);
}

async function manejarEspecialidadCallback(chatId: string, callbackId: string, nombreEspecialidad: string) {
  const sesion = await getSession(chatId);
  if (!sesion || sesion.paso !== "resp_especialidad") return await answerCallback(callbackId, "Esto ya no está activo.");

  await supabase
    .from("convocatoria_respuestas")
    .update({ especialidad: nombreEspecialidad })
    .eq("convocatoria_id", sesion.datos.convocatoria_id)
    .eq("telegram_chat_id", chatId);
  await sincronizarRespuesta(sesion.datos.convocatoria_id, chatId);

  await answerCallback(callbackId, `Especialidad: ${nombreEspecialidad}`);
  return await avanzarOResumen(chatId, sesion, "resp_especialidad");
}

async function manejarPasoRespuesta(chatId: string, sesion: Sesion, message: NonNullable<TelegramUpdate["message"]>) {
  const paso = sesion.paso;
  const texto = (message.text ?? "").trim();
  const convocatoriaId = sesion.datos.convocatoria_id;

  if (paso === "resp_especialidad") {
    // Se espera un boton, no texto libre; se ignora silenciosamente.
    return await sendMessage(chatId, "Usa uno de los botones de arriba para elegir tu especialidad.");
  }

  if (paso === "resp_experiencia") {
    const actualizacion: Record<string, unknown> = {};
    if (message.voice) {
      actualizacion.experiencia_audio_file_id = message.voice.file_id;
      try {
        const { bytes } = await descargarBytesTelegram(message.voice.file_id);
        const transcripcion = await transcribirAudio(bytes);
        if (transcripcion) actualizacion.experiencia_texto = transcripcion;
      } catch (error) {
        console.error("TRANSCRIPCION_DESCARGA_ERROR:", error);
      }
    } else if (texto) {
      actualizacion.experiencia_texto = texto;
    } else {
      return await sendMessage(chatId, "Envía tu experiencia en un mensaje de texto o una nota de voz.");
    }

    await supabase.from("convocatoria_respuestas").update(actualizacion).eq("convocatoria_id", convocatoriaId).eq(
      "telegram_chat_id",
      chatId,
    );
    await sincronizarRespuesta(convocatoriaId, chatId);

    return await avanzarOResumen(chatId, sesion, "resp_experiencia");
  }

  if (paso === "resp_cv") {
    if (!message.document) {
      return await sendMessage(chatId, "Envía tu CV como documento (PDF o Word), adjuntándolo directo en este chat.");
    }

    const { data: filaActual } = await supabase
      .from("convocatoria_respuestas")
      .select("nombres_completos, dni")
      .eq("convocatoria_id", convocatoriaId)
      .eq("telegram_chat_id", chatId)
      .maybeSingle();

    const nombreSugerido = construirNombreArchivoCv(filaActual?.nombres_completos ?? null, filaActual?.dni ?? null, chatId);

    let urlDrive: string;
    try {
      urlDrive = await guardarCvEnDrive(message.document.file_id, nombreSugerido, message.document.file_name);
    } catch (error) {
      console.error("CV_DRIVE_UPLOAD_ERROR:", error);
      return await sendMessage(chatId, "⚠️ No pude guardar tu CV. Intenta enviarlo de nuevo en unos minutos.");
    }

    await supabase.from("convocatoria_respuestas").update({ cv_drive_url: urlDrive }).eq(
      "convocatoria_id",
      convocatoriaId,
    ).eq("telegram_chat_id", chatId);
    await sincronizarRespuesta(convocatoriaId, chatId);
    return await avanzarOResumen(chatId, sesion, "resp_cv");
  }

  if (!texto) return await sendMessage(chatId, "Por favor responde con un mensaje de texto.");

  if (paso === "resp_dni" && !dniValido(texto)) {
    return await sendMessage(chatId, "El DNI debe tener 8 dígitos numéricos. Escríbelo de nuevo.");
  }
  if (paso === "resp_telefono" && !telefonoValido(texto)) {
    return await sendMessage(chatId, "El teléfono debe tener 9 dígitos (número peruano). Escríbelo de nuevo.");
  }

  const campo = paso.replace("resp_", "");
  await supabase.from("convocatoria_respuestas").update({ [campo]: texto }).eq("convocatoria_id", convocatoriaId).eq(
    "telegram_chat_id",
    chatId,
  );
  await sincronizarRespuesta(convocatoriaId, chatId);

  if (paso === "resp_dni") {
    const [porDni, enPersonal] = await Promise.all([
      buscarPerfilPorDni(texto, convocatoriaId),
      buscarEnPersonal(texto),
    ]);
    let previo = (sesion.datos.previo ?? null) as Record<string, unknown> | null;
    previo = fusionarPerfiles(previo, porDni);
    previo = fusionarPerfiles(previo, enPersonal);
    sesion.datos.previo = previo;

    if (enPersonal) {
      await sendMessage(
        chatId,
        `✅ Ya te tenemos registrado en nuestra base de personal como <b>${
          escapeHtml(enPersonal.nombres_completos ?? "")
        }</b>. Solo confirma o actualiza tus datos:`,
      );
    }
  }

  return await avanzarOResumen(chatId, sesion, paso);
}

async function manejarStart(chatId: string, payload: string) {
  const match = payload.match(/^conv_(.+)$/);
  if (!match) return await sendMessage(chatId, bienvenidaTexto());

  const { data: convocatoria } = await supabase.from("convocatorias").select("*").eq("id", match[1]).maybeSingle();
  if (!convocatoria) return await sendMessage(chatId, bienvenidaTexto());

  await sendMessage(chatId, "🤖 <b>Convocatorias EKA</b>\n\nQuedaste registrado. Esta es la convocatoria vigente:");
  return await sendMessage(chatId, textoConvocatoria(convocatoria), botonesConvocatoria(convocatoria.id));
}

/** Relee el estado actual de una respuesta (y su convocatoria) desde Supabase
 * y lo empuja a Google Sheets. Se llama después de cada mutación en
 * convocatoria_respuestas para que la pestaña de esa convocatoria quede al
 * día en tiempo real, sin depender de qué campo cambió. */
async function sincronizarRespuesta(convocatoriaId: string, chatId: string) {
  const [{ data: convocatoria }, { data: respuesta }] = await Promise.all([
    supabase.from("convocatorias").select("titulo, fecha_servicio, fecha_limite_respuesta").eq(
      "id",
      convocatoriaId,
    ).maybeSingle(),
    supabase.from("convocatoria_respuestas").select("*").eq("convocatoria_id", convocatoriaId).eq(
      "telegram_chat_id",
      chatId,
    ).maybeSingle(),
  ]);
  if (!convocatoria || !respuesta) return;
  await sincronizarRespuestaConSheet(convocatoria, respuesta);
}

// --- Dispatcher --------------------------------------------------------

async function manejarUpdate(update: TelegramUpdate) {
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = String(cq.message?.chat.id ?? cq.from.id);
    await upsertUsuario(chatId, cq.from);

    const data = cq.data ?? "";
    const matchRespuesta = data.match(/^conv:([^:]+):(.+)$/);
    const matchConfirmar = data.match(/^confirmar_convocatoria:(.+)$/);
    const matchEspecialidad = data.match(/^esp:(.+)$/);
    const matchConfirmarDato = data.match(/^confdato:([^:]+):(.+)$/);
    const matchResumenEditar = data.match(/^resumeneditar:(.+)$/);

    if (matchConfirmar) {
      if (!isAdmin(chatId)) await answerCallback(cq.id, "Solo administradores.");
      else await manejarConfirmacionConvocar(chatId, cq.id, matchConfirmar[1]);
    } else if (matchEspecialidad) {
      await manejarEspecialidadCallback(chatId, cq.id, matchEspecialidad[1]);
    } else if (matchConfirmarDato) {
      await manejarConfirmarDatoCallback(chatId, cq.id, matchConfirmarDato[1], matchConfirmarDato[2]);
    } else if (matchResumenEditar) {
      await manejarResumenEditarCallback(chatId, cq.id, matchResumenEditar[1]);
    } else if (data === "resumenenviar") {
      await manejarResumenEnviarCallback(chatId, cq.id);
    } else if (matchRespuesta && cq.message) {
      await manejarRespuestaCallback(chatId, cq.message.message_id, cq.id, cq.from, matchRespuesta[1], matchRespuesta[2]);
    } else {
      await answerCallback(cq.id);
    }
    return;
  }

  if (update.message) {
    const chatId = String(update.message.chat.id);
    const texto = (update.message.text ?? "").trim();
    const from = update.message.from;
    if (from) await upsertUsuario(chatId, from);

    const sesion = await getSession(chatId);

    if (texto === "/start" || texto.startsWith("/start ")) {
      await manejarStart(chatId, texto.startsWith("/start ") ? texto.slice(7).trim() : "");
    } else if (texto === "/ayuda" || texto === "/help") {
      await sendMessage(chatId, helpTexto(isAdmin(chatId)));
    } else if (texto === "/cancelar") {
      if (sesion) {
        await deleteSession(chatId);
        await sendMessage(chatId, "🗑️ Cancelado.");
      } else {
        await sendMessage(chatId, "No tienes nada en curso para cancelar.");
      }
    } else if (texto === "/convocar") {
      if (!isAdmin(chatId)) await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
      else await iniciarConvocar(chatId);
    } else if (texto.startsWith("/especialidad_agregar")) {
      if (!isAdmin(chatId)) {
        await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
      } else {
        const nombre = texto.replace("/especialidad_agregar", "").trim();
        if (!nombre) await sendMessage(chatId, "Uso: /especialidad_agregar Nombre de la especialidad");
        else {
          const agregada = await addEspecialidad(nombre);
          await sendMessage(
            chatId,
            agregada ? `✅ Especialidad agregada: ${escapeHtml(nombre)}` : `Esa especialidad ya existía: ${escapeHtml(nombre)}`,
          );
        }
      }
    } else if (texto === "/especialidades") {
      const especialidades = await getEspecialidades();
      await sendMessage(
        chatId,
        ["📋 <b>Especialidades configuradas</b>", "", ...especialidades.map((e) => `- ${escapeHtml(e)}`)].join("\n"),
      );
    } else if (texto.startsWith("/resumen")) {
      if (!isAdmin(chatId)) {
        await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
      } else {
        const convocatoriaId = texto.replace("/resumen", "").trim();
        if (!convocatoriaId) await sendMessage(chatId, "Uso: /resumen <convocatoria_id>");
        else await manejarResumen(chatId, convocatoriaId);
      }
    } else if (texto === "/actualizar_menu") {
      if (!isAdmin(chatId)) {
        await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
      } else {
        await actualizarMenuComandos();
        await sendMessage(chatId, "✅ Menú \"/\" actualizado (para todos los administradores).");
      }
    } else if (texto.startsWith("/vincular_drive")) {
      if (!isAdmin(chatId)) {
        await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
      } else {
        const codigo = texto.replace("/vincular_drive", "").trim();
        if (!codigo) {
          await sendMessage(chatId, "Uso: /vincular_drive <codigo> (ver README para conseguirlo)");
        } else {
          const resultado = await intercambiarCodigoOAuth(codigo);
          await sendMessage(
            chatId,
            resultado.ok
              ? "✅ Copia y guarda esto como el secreto <b>GOOGLE_OAUTH_REFRESH_TOKEN</b>:\n\n<code>" +
                  escapeHtml(resultado.mensaje) +
                  "</code>"
              : "⚠️ " + escapeHtml(resultado.mensaje),
          );
        }
      }
    } else if (sesion && PASOS_CONVOCAR.includes(sesion.paso) && sesion.paso !== "convocar_confirmar" && texto && !texto.startsWith("/")) {
      await manejarPasoConvocar(chatId, sesion, texto);
    } else if (sesion && ORDEN_RESPUESTA.includes(sesion.paso)) {
      await manejarPasoRespuesta(chatId, sesion, update.message);
    } else {
      await sendMessage(chatId, "No entendí ese mensaje. Usa /ayuda para ver los comandos disponibles.");
    }
  }
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    await manejarUpdate(update);
  } catch (error) {
    console.error("CONVOCATORIAS_BOT_ERROR:", error);
  }
  return new Response("OK", { status: 200 });
});
