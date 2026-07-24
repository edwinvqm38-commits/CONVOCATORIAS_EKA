// Los Web Apps de Apps Script no sirven como webhook de Telegram: la URL
// /exec siempre responde con una redireccion 302 (asi funciona el servicio
// de Apps Script para TODAS las ejecuciones, sea GET o POST), y Telegram no
// sigue redirecciones al entregar un webhook -- por eso el error
// "Wrong response from the webhook: 302 Found" en getWebhookInfo.
//
// La alternativa que si funciona sin agregar ningun servicio externo:
// consultar Telegram cada cierto tiempo (polling) en vez de esperar a que
// Telegram nos llame. Antes de usar esto hay que haber borrado el webhook
// (Telegram rechaza getUpdates si hay uno activo):
//   https://api.telegram.org/bot<TOKEN>/deleteWebhook
//
// Despues, cuelga revisarTelegram() de un disparador de tiempo (Triggers >
// Add Trigger > revisarTelegram > Time-driven > Minutes timer > Every
// minute) para que se sienta casi instantaneo.

var PROP_ULTIMO_UPDATE_ID = "ULTIMO_UPDATE_ID";

function revisarTelegram() {
  var props = PropertiesService.getScriptProperties();
  var ultimoId = parseInt(props.getProperty(PROP_ULTIMO_UPDATE_ID) || "0", 10);

  var resultado = llamarTelegram("getUpdates", {
    offset: ultimoId + 1,
    timeout: 0,
    allowed_updates: ["message", "callback_query"],
  });

  var updates = resultado.result || [];
  if (!updates.length) return;

  updates.forEach(function (update) {
    try {
      manejarUpdate(update);
    } catch (error) {
      console.error("TELEGRAM_POLL_ERROR: " + error + "\n" + (error && error.stack));
    }
    ultimoId = Math.max(ultimoId, update.update_id);
  });

  props.setProperty(PROP_ULTIMO_UPDATE_ID, String(ultimoId));
}
