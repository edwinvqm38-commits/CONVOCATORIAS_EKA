import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const ADMIN_CHAT_IDS = Deno.env.get("ADMIN_CHAT_IDS") ?? "";
const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ?? "";
const GOOGLE_DRIVE_CV_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_CV_FOLDER_ID") ?? "";

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

const ORDEN_RESPUESTA = [
  "resp_nombres_completos",
  "resp_dni",
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

// --- Google Drive (cuenta de servicio, JWT firmado a mano con Web Crypto) --

async function obtenerTokenGoogle(scopes: string[]): Promise<string> {
  const credenciales = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

  const ahora = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: credenciales.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: ahora + 3600,
    iat: ahora,
  };

  const sinFirmar = `${encode(header)}.${encode(claims)}`;
  const clavePem = credenciales.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll(/\s/g, "");
  const claveBinaria = Uint8Array.from(atob(clavePem), (c) => c.charCodeAt(0));

  const claveCripto = await crypto.subtle.importKey(
    "pkcs8",
    claveBinaria.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    claveCripto,
    new TextEncoder().encode(sinFirmar),
  );
  const firmaTexto = btoa(String.fromCharCode(...new Uint8Array(firma)))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

  const jwt = `${sinFirmar}.${firmaTexto}`;

  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const datos = await respuesta.json();
  if (!datos.access_token) throw new Error("No se pudo obtener token de Google: " + JSON.stringify(datos));
  return datos.access_token;
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
  const accessToken = await obtenerTokenGoogle(["https://www.googleapis.com/auth/drive"]);

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
    .replace(/[\u0300-\u036f]/g, "")
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
    "<b>/resumen convocatoria_id</b> — Cuenta de disponibles / no disponibles / posiblemente.",
  ]).join("\n");
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
    .select("respuesta")
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
  return await sendMessage(chatId, lines.join("\n"));
}

// --- Flujo de respuesta del usuario convocado -----------------------------

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

  await saveSession(chatId, ORDEN_RESPUESTA[0], { convocatoria_id: convocatoriaId });
  return await sendMessage(chatId, PREGUNTAS_RESPUESTA[ORDEN_RESPUESTA[0]]);
}

async function manejarEspecialidadCallback(chatId: string, callbackId: string, nombreEspecialidad: string) {
  const sesion = await getSession(chatId);
  if (!sesion || sesion.paso !== "resp_especialidad") return await answerCallback(callbackId, "Esto ya no está activo.");

  await supabase
    .from("convocatoria_respuestas")
    .update({ especialidad: nombreEspecialidad })
    .eq("convocatoria_id", sesion.datos.convocatoria_id)
    .eq("telegram_chat_id", chatId);

  await answerCallback(callbackId, `Especialidad: ${nombreEspecialidad}`);
  const siguientePaso = ORDEN_RESPUESTA[ORDEN_RESPUESTA.indexOf("resp_especialidad") + 1];
  await saveSession(chatId, siguientePaso, sesion.datos);
  return await sendMessage(chatId, PREGUNTAS_RESPUESTA[siguientePaso]);
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

    const siguientePaso = ORDEN_RESPUESTA[ORDEN_RESPUESTA.indexOf("resp_experiencia") + 1];
    await saveSession(chatId, siguientePaso, sesion.datos);
    return await sendMessage(chatId, PREGUNTAS_RESPUESTA[siguientePaso]);
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
      return await sendMessage(
        chatId,
        "⚠️ No pude guardar tu CV. Detalle (temporal, para depurar):\n" +
          escapeHtml(String((error as Error)?.message ?? error)),
      );
    }

    await supabase.from("convocatoria_respuestas").update({ cv_drive_url: urlDrive }).eq(
      "convocatoria_id",
      convocatoriaId,
    ).eq("telegram_chat_id", chatId);
    await deleteSession(chatId);
    return await sendMessage(chatId, "✅ ¡Gracias! Tu registro (incluido tu CV) quedó completo.");
  }

  if (!texto) return await sendMessage(chatId, "Por favor responde con un mensaje de texto.");

  const campo = paso.replace("resp_", "");
  await supabase.from("convocatoria_respuestas").update({ [campo]: texto }).eq("convocatoria_id", convocatoriaId).eq(
    "telegram_chat_id",
    chatId,
  );

  const siguientePaso = ORDEN_RESPUESTA[ORDEN_RESPUESTA.indexOf(paso) + 1];

  if (siguientePaso === "resp_especialidad") {
    const especialidades = await getEspecialidades();
    await saveSession(chatId, siguientePaso, sesion.datos);
    return await sendMessage(chatId, "🛠️ Indica tu especialidad:", botonesEspecialidades(especialidades));
  }

  await saveSession(chatId, siguientePaso, sesion.datos);
  return await sendMessage(chatId, PREGUNTAS_RESPUESTA[siguientePaso]);
}

async function manejarStart(chatId: string, payload: string) {
  const match = payload.match(/^conv_(.+)$/);
  if (!match) return await sendMessage(chatId, bienvenidaTexto());

  const { data: convocatoria } = await supabase.from("convocatorias").select("*").eq("id", match[1]).maybeSingle();
  if (!convocatoria) return await sendMessage(chatId, bienvenidaTexto());

  await sendMessage(chatId, "🤖 <b>Convocatorias EKA</b>\n\nQuedaste registrado. Esta es la convocatoria vigente:");
  return await sendMessage(chatId, textoConvocatoria(convocatoria), botonesConvocatoria(convocatoria.id));
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

    if (matchConfirmar) {
      if (!isAdmin(chatId)) await answerCallback(cq.id, "Solo administradores.");
      else await manejarConfirmacionConvocar(chatId, cq.id, matchConfirmar[1]);
    } else if (matchEspecialidad) {
      await manejarEspecialidadCallback(chatId, cq.id, matchEspecialidad[1]);
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
