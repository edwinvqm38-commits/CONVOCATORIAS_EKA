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
  tal_vez: "🤔 Tal vez / depende",
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
    "<b>/resumen convocatoria_id</b> — Cuenta de disponibles / no disponibles / sin responder.",
  ].join("\n");
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
  const conteo: Record<string, number> = { disponible: 0, no_disponible: 0, tal_vez: 0, sin_responder: 0 };
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
    `🤔 Tal vez: ${conteo.tal_vez}`,
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
      const match = data.match(/^conv:([^:]+):(.+)$/);

      if (match && cq.message) {
        const [, convocatoriaId, respuesta] = match;
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

      if (text === "/start") {
        await sendMessage(chatId, bienvenidaTexto());
      } else if (text === "/ayuda" || text === "/help") {
        await sendMessage(chatId, helpTexto(isAdmin(chatId)));
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
