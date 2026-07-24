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
