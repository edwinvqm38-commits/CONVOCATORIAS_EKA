function escaparHtml(valor) {
  return String(valor === undefined || valor === null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function llamarTelegram(metodo, payload) {
  var token = getScriptProp("TELEGRAM_BOT_TOKEN");
  var url = "https://api.telegram.org/bot" + token + "/" + metodo;

  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var status = response.getResponseCode();
  var texto = response.getContentText();
  // Nunca loguear "url" (trae el token). Solo metodo + respuesta de Telegram.
  Logger.log("TELEGRAM " + metodo + " -> " + status + ": " + texto.slice(0, 300));

  if (status >= 300) {
    throw new Error("Telegram error " + status + ": " + texto);
  }

  return JSON.parse(texto);
}

function enviarMensaje(chatId, texto, replyMarkup) {
  return llamarTelegram("sendMessage", {
    chat_id: chatId,
    text: texto,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
}

function editarMensaje(chatId, messageId, texto, replyMarkup) {
  return llamarTelegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: texto,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup || { inline_keyboard: [] },
  });
}

function responderCallback(callbackId, texto) {
  return llamarTelegram("answerCallbackQuery", {
    callback_query_id: callbackId,
    text: texto,
    show_alert: false,
  });
}

/** Envia un archivo (Blob) por Telegram. UrlFetchApp arma el
 * multipart/form-data automaticamente cuando el payload trae un Blob. */
function enviarDocumento(chatId, blob, caption) {
  var token = getScriptProp("TELEGRAM_BOT_TOKEN");
  var url = "https://api.telegram.org/bot" + token + "/sendDocument";

  var payload = { chat_id: String(chatId), document: blob };
  if (caption) payload.caption = caption;

  var response = UrlFetchApp.fetch(url, {
    method: "post",
    payload: payload,
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() >= 300) {
    throw new Error("Telegram sendDocument error: " + response.getContentText());
  }
}
