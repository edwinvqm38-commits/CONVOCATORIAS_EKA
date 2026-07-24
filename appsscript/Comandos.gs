// Configura el menu "/" del bot en Telegram. No se ejecuta solo: correla a
// mano desde el editor (elegir "configurarComandosBot" en el desplegable de
// funciones de arriba y click en "Ejecutar") una vez, o cada vez que cambies
// ADMIN_CHAT_IDS o la lista de comandos.
function configurarComandosBot() {
  var comandosPublicos = [
    { command: "start", description: "Registrarte para recibir convocatorias" },
    { command: "ayuda", description: "Ver los comandos disponibles" },
    { command: "especialidades", description: "Ver las especialidades configuradas" },
  ];

  var comandosAdmin = comandosPublicos.concat([
    { command: "convocar", description: "Crear y enviar una convocatoria" },
    { command: "cancelar", description: "Cancelar lo que estés armando" },
    { command: "hoja", description: "Cambiar el Google Sheet activo" },
    { command: "especialidad_agregar", description: "Agregar una especialidad nueva" },
    { command: "resumen", description: "Ver el resumen de una convocatoria" },
    { command: "script", description: "Recibir el código actual del bot" },
  ]);

  llamarTelegram("setMyCommands", { commands: comandosPublicos });

  var admins = (getScriptProp("ADMIN_CHAT_IDS") || "")
    .split(",")
    .map(function (id) {
      return id.trim();
    })
    .filter(Boolean);

  admins.forEach(function (chatId) {
    llamarTelegram("setMyCommands", {
      commands: comandosAdmin,
      scope: { type: "chat", chat_id: chatId },
    });
  });

  Logger.log("Comandos configurados. Admins con menu completo: " + admins.join(", "));
}

/** Prueba manual: mandate un mensaje a ti mismo (el primer chat_id en
 * ADMIN_CHAT_IDS) para confirmar que el token y la conexion con Telegram
 * funcionan, sin depender del webhook ni de la vista de Ejecuciones. Correla
 * eligiendo "probarEnvioManual" en el desplegable de funciones y Ejecutar:
 * el resultado se ve al toque en el panel de abajo del editor. */
function probarEnvioManual() {
  var admins = (getScriptProp("ADMIN_CHAT_IDS") || "")
    .split(",")
    .map(function (id) {
      return id.trim();
    })
    .filter(Boolean);

  if (!admins.length) {
    Logger.log("ADMIN_CHAT_IDS esta vacio o no se guardo bien la propiedad.");
    return;
  }

  var resultado = enviarMensaje(admins[0], "✅ Prueba manual desde el editor de Apps Script.");
  Logger.log("Resultado de Telegram: " + JSON.stringify(resultado));
}
