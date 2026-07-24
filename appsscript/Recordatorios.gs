/** Reenvía la convocatoria (con los mismos botones) solo a quienes no han
 * respondido. Pensada para colgarla de un trigger de tiempo propio del
 * proyecto de Apps Script (Triggers > Add Trigger > enviarRecordatoriosDiarios
 * > Time-driven > Day timer), sin depender de nada externo. */
function enviarRecordatoriosDiarios() {
  ensureControlSheets();
  var spreadsheetId = getActiveSheetId();

  var convocatorias = getAllRows(spreadsheetId, CONVOCATORIAS_SHEET, CONVOCATORIAS_HEADERS).filter(function (c) {
    return c.estado === "enviada";
  });

  convocatorias.forEach(function (convocatoria) {
    var respuestas = getAllRows(spreadsheetId, RESPUESTAS_SHEET, RESPUESTAS_HEADERS).filter(function (r) {
      return r.convocatoria_id === convocatoria.id;
    });

    var pendientes = respuestas.filter(function (r) {
      return !r.respuesta;
    });

    pendientes.forEach(function (fila) {
      try {
        var texto =
          "⏰ <b>Recordatorio</b>: aún no confirmas tu disponibilidad.\n\n" + textoConvocatoria(convocatoria);
        enviarMensaje(fila.telegram_chat_id, texto, botonesConvocatoria(convocatoria.id));
      } catch (error) {
        // Se ignora el fallo individual y se sigue con el resto.
      }
    });
  });
}
