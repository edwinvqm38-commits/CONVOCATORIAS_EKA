import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const ADMIN_CHAT_IDS = Deno.env.get("ADMIN_CHAT_IDS") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number | string };
    from?: { id: number | string; first_name?: string; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number | string; first_name?: string; username?: string };
    message?: {
      message_id: number;
      chat: { id: number | string };
      text?: string;
    };
    data?: string;
  };
};

const ETIQUETAS: Record<string, string> = {
  disponible: "✅ Disponible",
  no_disponible: "❌ No disponible",
  posiblemente: "🤔 Posiblemente",
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

async function editMessage(
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
) {
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
  return await telegram("answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: false,
  });
}

async function upsertUsuario(update: TelegramUpdate, chatId: string): Promise<void> {
  const from = update.message?.from ?? update.callback_query?.from;
  if (!from) return;

  try {
    const { data: existing } = await supabase
      .from("convocatoria_usuarios")
      .select("id")
      .eq("telegram_chat_id", chatId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("convocatoria_usuarios")
        .update({
          telegram_user_id: String(from.id),
          username: from.username ?? null,
          estado: "activo",
          last_seen_at: new Date().toISOString(),
        })
        .eq("telegram_chat_id", chatId);
      return;
    }

    await supabase.from("convocatoria_usuarios").insert({
      telegram_chat_id: chatId,
      telegram_user_id: String(from.id),
      nombre: from.first_name ?? null,
      username: from.username ?? null,
      estado: "activo",
      last_seen_at: new Date().toISOString(),
    });
  } catch (_error) {
    // No bloquea la respuesta del bot si falla el registro.
  }
}

function bienvenidaTexto(): string {
  return [
    "🤖 <b>Convocatorias EKA</b>",
    "",
    "Quedaste registrado. Cuando se abra una convocatoria a una parada de",
    "planta, te va a llegar aquí un mensaje con la fecha del servicio y",
    "botones para confirmar tu disponibilidad.",
    "",
    "No necesitas hacer nada más por ahora.",
  ].join("\n");
}

function helpTexto(esAdmin: boolean): string {
  const base = [
    "ℹ️ <b>Comandos disponibles</b>",
    "",
    "<b>/start</b> — Te registra para recibir convocatorias.",
    "<b>/ayuda</b> — Muestra esta ayuda.",
  ];

  if (!esAdmin) return base.join("\n");

  return [
    ...base,
    "",
    "🔐 <b>Comandos de administrador</b>",
    "<b>/convocar</b> — Crea y envía una convocatoria paso a paso, conversando con el bot.",
    "<b>/cancelar</b> — Cancela la convocatoria que estás armando.",
    "<b>/resumen convocatoria_id</b> — Cuenta de disponibles / no disponibles / sin responder.",
  ].join("\n");
}

// --- Flujo conversacional /convocar (solo administradores) -----------------
//
// Telegram no mantiene estado entre mensajes, asi que cada paso de la
// conversacion se guarda en convocatoria_sesiones (una fila por chat_id) y se
// retoma leyendo esa fila en el siguiente mensaje de texto que llegue de ese
// mismo admin. "-" se usa como atajo para dejar en blanco un campo opcional.

type PasoConvocar =
  | "planta"
  | "titulo"
  | "fecha_servicio"
  | "hora_servicio"
  | "descripcion"
  | "fecha_limite_respuesta"
  | "confirmar";

const PASOS_ORDEN: PasoConvocar[] = [
  "planta",
  "titulo",
  "fecha_servicio",
  "hora_servicio",
  "descripcion",
  "fecha_limite_respuesta",
  "confirmar",
];

const PREGUNTAS: Record<PasoConvocar, string> = {
  planta: "🏭 ¿Cuál es la planta o ubicación del servicio?",
  titulo: "📌 ¿Cuál es el título/motivo de la convocatoria? (ej. \"Parada de planta - mantenimiento anual\")",
  fecha_servicio: "🗓️ ¿Cuál es la fecha del servicio? Formato AAAA-MM-DD (ej. 2026-08-15).",
  hora_servicio: "🕐 ¿A qué hora? (o envía \"-\" si no aplica)",
  descripcion: "📝 Agrega una descripción/detalle para los usuarios (o envía \"-\" para dejarla vacía).",
  fecha_limite_respuesta:
    "⏰ ¿Hasta cuándo pueden responder? Formato AAAA-MM-DD o AAAA-MM-DD HH:MM (o envía \"-\" si no aplica).",
  confirmar: "",
};

function validarFecha(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor.trim());
}

function validarFechaHoraOpcional(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/.test(valor.trim());
}

async function obtenerSesion(chatId: string) {
  const { data } = await supabase
    .from("convocatoria_sesiones")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data;
}

async function guardarSesion(chatId: string, paso: PasoConvocar, datos: Record<string, unknown>) {
  await supabase.from("convocatoria_sesiones").upsert(
    {
      telegram_chat_id: chatId,
      paso,
      datos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "telegram_chat_id" },
  );
}

async function borrarSesion(chatId: string) {
  await supabase.from("convocatoria_sesiones").delete().eq("telegram_chat_id", chatId);
}

async function iniciarConvocar(chatId: string) {
  await guardarSesion(chatId, "planta", {});
  await sendMessage(
    chatId,
    "📢 <b>Nueva convocatoria</b>\n\nTe voy a pedir los datos uno por uno. Escribe /cancelar en cualquier momento para abortar.\n\n" +
      PREGUNTAS.planta,
  );
}

function resumenBorrador(datos: Record<string, any>): string {
  const lines = [
    "📋 <b>Revisa los datos antes de enviar</b>",
    "",
    `🏭 Planta: ${escapeHtml(datos.planta)}`,
    `📌 Título: ${escapeHtml(datos.titulo)}`,
    `🗓️ Fecha del servicio: ${escapeHtml(datos.fecha_servicio)}`,
  ];

  if (datos.hora_servicio) lines.push(`🕐 Hora: ${escapeHtml(datos.hora_servicio)}`);
  if (datos.descripcion) lines.push(`📝 Descripción: ${escapeHtml(datos.descripcion)}`);
  if (datos.fecha_limite_respuesta) {
    lines.push(`⏰ Responder antes de: ${escapeHtml(datos.fecha_limite_respuesta)}`);
  }

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

async function manejarPasoConvocar(chatId: string, sesion: any, texto: string) {
  const paso: PasoConvocar = sesion.paso;
  const datos = { ...(sesion.datos ?? {}) };

  if (paso === "fecha_servicio" && !validarFecha(texto)) {
    return await sendMessage(chatId, "Formato inválido. Usa AAAA-MM-DD, por ejemplo 2026-08-15.");
  }

  if (paso === "fecha_limite_respuesta" && texto.trim() !== "-" && !validarFechaHoraOpcional(texto)) {
    return await sendMessage(
      chatId,
      "Formato inválido. Usa AAAA-MM-DD o AAAA-MM-DD HH:MM, o envía \"-\" si no aplica.",
    );
  }

  const valor = texto.trim();
  const opcionalesVacios = ["hora_servicio", "descripcion", "fecha_limite_respuesta"];
  datos[paso] = opcionalesVacios.includes(paso) && valor === "-" ? null : valor;

  const indiceActual = PASOS_ORDEN.indexOf(paso);
  const siguientePaso = PASOS_ORDEN[indiceActual + 1];

  if (siguientePaso === "confirmar") {
    await guardarSesion(chatId, "confirmar", datos);
    return await sendMessage(chatId, resumenBorrador(datos), confirmarKeyboard());
  }

  await guardarSesion(chatId, siguientePaso, datos);
  return await sendMessage(chatId, PREGUNTAS[siguientePaso]);
}

async function enviarConvocatoriaATodos(convocatoria: any) {
  const { data: usuarios } = await supabase
    .from("convocatoria_usuarios")
    .select("telegram_chat_id")
    .eq("estado", "activo");

  let enviados = 0;
  for (const usuario of usuarios ?? []) {
    const messageId = await enviarMensajeConvocatoria(convocatoria, usuario.telegram_chat_id);
    await supabase.from("convocatoria_envios").upsert(
      {
        convocatoria_id: convocatoria.id,
        telegram_chat_id: usuario.telegram_chat_id,
        telegram_message_id: messageId,
        estado_envio: messageId ? "enviado" : "fallido",
      },
      { onConflict: "convocatoria_id,telegram_chat_id" },
    );
    if (messageId) enviados += 1;
  }

  await supabase
    .from("convocatorias")
    .update({ estado: "enviada", enviada_at: new Date().toISOString() })
    .eq("id", convocatoria.id);

  return enviados;
}

function textoConvocatoria(convocatoria: any): string {
  const lines = [
    "📢 <b>Convocatoria - Parada de planta</b>",
    "",
    `🏭 <b>${escapeHtml(convocatoria.planta ?? "Planta")}</b>`,
    `📌 ${escapeHtml(convocatoria.titulo ?? "")}`,
  ];

  if (convocatoria.descripcion) {
    lines.push("", escapeHtml(convocatoria.descripcion));
  }

  const fechaLinea = `🗓️ Fecha del servicio: ${escapeHtml(convocatoria.fecha_servicio)}`;
  lines.push("", convocatoria.hora_servicio ? `${fechaLinea} — ${escapeHtml(convocatoria.hora_servicio)}` : fechaLinea);

  if (convocatoria.fecha_limite_respuesta) {
    lines.push(`⏰ Responde antes de: ${escapeHtml(convocatoria.fecha_limite_respuesta)}`);
  }

  lines.push("", "¿Estás disponible para participar? Confirma con un botón:");
  return lines.join("\n");
}

function botonesConvocatoria(convocatoriaId: string) {
  return {
    inline_keyboard: Object.entries(ETIQUETAS).map(([respuesta, texto]) => [
      { text: texto, callback_data: `conv:${convocatoriaId}:${respuesta}` },
    ]),
  };
}

async function enviarMensajeConvocatoria(convocatoria: any, chatId: string): Promise<number | null> {
  try {
    const result: any = await telegram("sendMessage", {
      chat_id: chatId,
      text: textoConvocatoria(convocatoria),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: botonesConvocatoria(convocatoria.id),
    });
    return result?.result?.message_id ?? null;
  } catch (_error) {
    return null;
  }
}

async function manejarConfirmacionConvocar(chatId: string, callbackId: string, accion: string) {
  const sesion = await obtenerSesion(chatId);

  if (!sesion || sesion.paso !== "confirmar") {
    return await answerCallback(callbackId, "Esta convocatoria ya no está en edición.");
  }

  if (accion === "cancelar") {
    await borrarSesion(chatId);
    await answerCallback(callbackId, "Convocatoria cancelada.");
    return await sendMessage(chatId, "🗑️ Convocatoria cancelada. Usa /convocar para empezar de nuevo.");
  }

  const datos = sesion.datos ?? {};
  const { data: convocatoria, error } = await supabase
    .from("convocatorias")
    .insert({
      titulo: datos.titulo,
      planta: datos.planta,
      fecha_servicio: datos.fecha_servicio,
      hora_servicio: datos.hora_servicio ?? null,
      descripcion: datos.descripcion ?? null,
      fecha_limite_respuesta: datos.fecha_limite_respuesta ?? null,
      creado_por: chatId,
      estado: "borrador",
    })
    .select()
    .single();

  await borrarSesion(chatId);

  if (error || !convocatoria) {
    await answerCallback(callbackId, "Error al guardar la convocatoria.");
    return await sendMessage(chatId, `⚠️ No pude guardar la convocatoria: ${escapeHtml(error?.message ?? "")}`);
  }

  if (accion === "borrador") {
    await answerCallback(callbackId, "Guardada como borrador.");
    return await sendMessage(
      chatId,
      `💾 Convocatoria guardada como borrador.\n\nID: <code>${convocatoria.id}</code>\n\nCuando quieras enviarla, corre el script enviar_convocatoria.py o vuelve a crearla con /convocar.`,
    );
  }

  await answerCallback(callbackId, "Enviando a todos los usuarios...");
  const enviados = await enviarConvocatoriaATodos(convocatoria);
  return await sendMessage(
    chatId,
    `🚀 Convocatoria enviada a ${enviados} usuario(s).\n\nID: <code>${convocatoria.id}</code>\n\nUsa /resumen ${convocatoria.id} para ver las respuestas.`,
  );
}

async function manejarResumen(chatId: string, convocatoriaId: string) {
  const { data: convocatoria } = await supabase
    .from("convocatorias")
    .select("id, titulo, fecha_servicio, planta")
    .eq("id", convocatoriaId)
    .maybeSingle();

  if (!convocatoria) {
    return await sendMessage(chatId, `No encontré ninguna convocatoria con id "${escapeHtml(convocatoriaId)}".`);
  }

  const { data: filas } = await supabase
    .from("convocatoria_resumen_v")
    .select("respuesta, nombre, telegram_chat_id")
    .eq("convocatoria_id", convocatoriaId);

  const rows = filas ?? [];
  const conteo: Record<string, number> = { disponible: 0, no_disponible: 0, posiblemente: 0, sin_responder: 0 };
  const pendientes: string[] = [];

  for (const fila of rows) {
    if (fila.respuesta) {
      conteo[fila.respuesta] = (conteo[fila.respuesta] ?? 0) + 1;
    } else {
      conteo.sin_responder += 1;
      pendientes.push(fila.nombre ?? fila.telegram_chat_id);
    }
  }

  const lines = [
    `📋 <b>${escapeHtml(convocatoria.titulo)}</b>`,
    `🏭 ${escapeHtml(convocatoria.planta ?? "")} — 🗓️ ${escapeHtml(convocatoria.fecha_servicio)}`,
    "",
    `Total destinatarios: ${rows.length}`,
    `✅ Disponible: ${conteo.disponible}`,
    `❌ No disponible: ${conteo.no_disponible}`,
    `🤔 Posiblemente: ${conteo.posiblemente}`,
    `⏳ Sin responder: ${conteo.sin_responder}`,
  ];

  if (pendientes.length) {
    lines.push("", "Pendientes:", ...pendientes.slice(0, 30).map((n) => `- ${escapeHtml(n)}`));
    if (pendientes.length > 30) {
      lines.push(`... y ${pendientes.length - 30} más.`);
    }
  }

  return await sendMessage(chatId, lines.join("\n"));
}

async function manejarRespuestaCallback(
  chatId: string,
  messageId: number,
  callbackId: string,
  convocatoriaId: string,
  respuesta: string,
) {
  if (!ETIQUETAS[respuesta]) {
    return await answerCallback(callbackId, "Opción no reconocida.");
  }

  const { data: convocatoria } = await supabase
    .from("convocatorias")
    .select("id, titulo, planta, fecha_servicio, hora_servicio, descripcion")
    .eq("id", convocatoriaId)
    .maybeSingle();

  if (!convocatoria) {
    return await answerCallback(callbackId, "Esta convocatoria ya no existe.");
  }

  await supabase.from("convocatoria_respuestas").upsert(
    {
      convocatoria_id: convocatoriaId,
      telegram_chat_id: chatId,
      respuesta,
      respondido_at: new Date().toISOString(),
    },
    { onConflict: "convocatoria_id,telegram_chat_id" },
  );

  const lines = [
    "📢 <b>Convocatoria - Parada de planta</b>",
    "",
    `🏭 <b>${escapeHtml(convocatoria.planta ?? "Planta")}</b>`,
    `📌 ${escapeHtml(convocatoria.titulo)}`,
    "",
    `🗓️ Fecha del servicio: ${escapeHtml(convocatoria.fecha_servicio)}${
      convocatoria.hora_servicio ? " — " + escapeHtml(convocatoria.hora_servicio) : ""
    }`,
    "",
    `Tu respuesta: <b>${ETIQUETAS[respuesta]}</b>`,
  ];

  await editMessage(chatId, messageId, lines.join("\n"));
  await answerCallback(callbackId, `Respuesta registrada: ${ETIQUETAS[respuesta]}`);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.message?.chat.id ?? cq.from.id);
      await upsertUsuario(update, chatId);

      const data = cq.data ?? "";
      const matchRespuesta = data.match(/^conv:([^:]+):(.+)$/);
      const matchConfirmar = data.match(/^confirmar_convocatoria:(.+)$/);

      if (matchConfirmar) {
        if (!isAdmin(chatId)) {
          await answerCallback(cq.id, "Solo administradores.");
        } else {
          await manejarConfirmacionConvocar(chatId, cq.id, matchConfirmar[1]);
        }
      } else if (matchRespuesta && cq.message) {
        const [, convocatoriaId, respuesta] = matchRespuesta;
        await manejarRespuestaCallback(chatId, cq.message.message_id, cq.id, convocatoriaId, respuesta);
      } else {
        await answerCallback(cq.id);
      }

      return new Response("OK", { status: 200 });
    }

    if (update.message) {
      const chatId = String(update.message.chat.id);
      const text = (update.message.text ?? "").trim();
      await upsertUsuario(update, chatId);

      const sesionActiva = isAdmin(chatId) ? await obtenerSesion(chatId) : null;

      if (text === "/start") {
        await sendMessage(chatId, bienvenidaTexto());
      } else if (text === "/ayuda" || text === "/help") {
        await sendMessage(chatId, helpTexto(isAdmin(chatId)));
      } else if (text === "/cancelar") {
        if (sesionActiva) {
          await borrarSesion(chatId);
          await sendMessage(chatId, "🗑️ Convocatoria cancelada.");
        } else {
          await sendMessage(chatId, "No tienes ninguna convocatoria en edición.");
        }
      } else if (text === "/convocar") {
        if (!isAdmin(chatId)) {
          await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
        } else {
          await iniciarConvocar(chatId);
        }
      } else if (text.startsWith("/resumen")) {
        if (!isAdmin(chatId)) {
          await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
        } else {
          const convocatoriaId = text.replace("/resumen", "").trim();
          if (!convocatoriaId) {
            await sendMessage(chatId, "Uso: /resumen <convocatoria_id>");
          } else {
            await manejarResumen(chatId, convocatoriaId);
          }
        }
      } else if (sesionActiva && sesionActiva.paso !== "confirmar" && text && !text.startsWith("/")) {
        await manejarPasoConvocar(chatId, sesionActiva, text);
      } else {
        await sendMessage(chatId, "No entendí ese mensaje. Usa /ayuda para ver los comandos disponibles.");
      }

      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("TELEGRAM_BOT_ERROR:", error);
    return new Response("OK", { status: 200 });
  }
});
