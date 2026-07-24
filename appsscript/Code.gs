var ETIQUETAS_RESPUESTA = {
  disponible: "✅ Disponible",
  no_disponible: "❌ No disponible",
  posiblemente: "🤔 Posiblemente",
};

var PASOS_CONVOCAR = [
  "convocar_planta",
  "convocar_titulo",
  "convocar_fecha_servicio",
  "convocar_hora_servicio",
  "convocar_descripcion",
  "convocar_fecha_limite",
  "convocar_confirmar",
];

var PREGUNTAS_CONVOCAR = {
  convocar_planta: "🏭 ¿Cuál es la planta o ubicación del servicio?",
  convocar_titulo:
    '📌 ¿Cuál es el título/motivo de la convocatoria? (ej. "Parada de planta - mantenimiento anual")',
  convocar_fecha_servicio: "🗓️ ¿Cuál es la fecha del servicio? Formato AAAA-MM-DD (ej. 2026-08-15).",
  convocar_hora_servicio: '🕐 ¿A qué hora? (o envía "-" si no aplica)',
  convocar_descripcion: '📝 Agrega una descripción/detalle para los usuarios (o envía "-" para dejarla vacía).',
  convocar_fecha_limite:
    '⏰ ¿Hasta cuándo pueden responder? Formato AAAA-MM-DD o AAAA-MM-DD HH:MM (o envía "-" si no aplica).',
};

// Orden completo de la conversacion tras presionar Disponible / No
// disponible / Posiblemente. "resp_especialidad" es el unico paso que se
// responde con botones (no con texto libre); el resto es texto o, en
// resp_experiencia y resp_cv, audio/documento.
var ORDEN_RESPUESTA = [
  "resp_nombres_completos",
  "resp_dni",
  "resp_telefono",
  "resp_lugar_residencia",
  "resp_especialidad",
  "resp_experiencia",
  "resp_cv",
];

var PREGUNTAS_RESPUESTA = {
  resp_nombres_completos: "🪪 Indica tus nombres completos.",
  resp_dni: "🆔 Indica tu número de DNI.",
  resp_telefono: "📞 Indica tu número de teléfono.",
  resp_lugar_residencia: "📍 Indica tu lugar de residencia.",
  resp_experiencia: "🛠️ Cuéntanos brevemente tu experiencia. Puedes escribirla en texto o enviar una nota de voz.",
  resp_cv: "📎 Por último, adjunta tu CV (PDF o Word) como documento, directo en este chat.",
};

/** Guarda en que paso quedo la conversacion y hace la siguiente pregunta:
 * con botones si es resp_especialidad, con texto en cualquier otro caso. */
function avanzarFlujoRespuesta(chatId, paso, datosSesion) {
  saveSession(chatId, paso, datosSesion);

  if (paso === "resp_especialidad") {
    enviarMensaje(chatId, "🛠️ Indica tu especialidad:", botonesEspecialidades(getEspecialidades()));
    return;
  }

  enviarMensaje(chatId, PREGUNTAS_RESPUESTA[paso]);
}

function generarId() {
  return Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
}

/** Nombre de archivo del CV a partir del nombre y DNI ya capturados (mucho
 * mas ubicable en Drive que el nombre original que puso cada quien, que a
 * veces viene raro o vacio). Si falta alguno de los dos, cae al chat_id. */
function construirNombreArchivoCv(nombresCompletos, dni, chatId) {
  var partes = [nombresCompletos, dni].filter(Boolean);
  var base = partes.length ? partes.join(" - ") : "CV_" + String(chatId);

  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
}

function validarFecha(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor.trim());
}

function validarFechaHoraOpcional(valor) {
  return /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/.test(valor.trim());
}

function textoConvocatoria(convocatoria) {
  var lines = [
    "📢 <b>Convocatoria - Parada de planta</b>",
    "",
    "🏭 <b>" + escaparHtml(convocatoria.planta || "Planta") + "</b>",
    "📌 " + escaparHtml(convocatoria.titulo || ""),
  ];

  if (convocatoria.descripcion) {
    lines.push("", escaparHtml(convocatoria.descripcion));
  }

  var fechaLinea = "🗓️ Fecha del servicio: " + escaparHtml(convocatoria.fecha_servicio);
  lines.push(
    "",
    convocatoria.hora_servicio ? fechaLinea + " — " + escaparHtml(convocatoria.hora_servicio) : fechaLinea,
  );

  if (convocatoria.fecha_limite_respuesta) {
    lines.push("⏰ Responde antes de: " + escaparHtml(convocatoria.fecha_limite_respuesta));
  }

  lines.push("", "¿Estás disponible para participar? Confirma con un botón:");
  return lines.join("\n");
}

function botonesConvocatoria(convocatoriaId) {
  var filas = [];
  Object.keys(ETIQUETAS_RESPUESTA).forEach(function (respuesta) {
    filas.push([{ text: ETIQUETAS_RESPUESTA[respuesta], callback_data: "conv:" + convocatoriaId + ":" + respuesta }]);
  });
  return { inline_keyboard: filas };
}

function botonesEspecialidades(especialidades) {
  var filas = [];
  for (var i = 0; i < especialidades.length; i += 2) {
    filas.push(
      especialidades.slice(i, i + 2).map(function (nombre) {
        return { text: nombre, callback_data: "esp:" + nombre };
      }),
    );
  }
  return { inline_keyboard: filas };
}

function bienvenidaTexto() {
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

function helpTexto(esAdminFlag) {
  var base = [
    "ℹ️ <b>Comandos disponibles</b>",
    "",
    "<b>/start</b> — Te registra para recibir convocatorias.",
    "<b>/ayuda</b> — Muestra esta ayuda.",
  ];

  if (!esAdminFlag) return base.join("\n");

  return base
    .concat([
      "",
      "🔐 <b>Comandos de administrador</b>",
      "<b>/convocar</b> — Crea y envía una convocatoria paso a paso.",
      "<b>/cancelar</b> — Cancela lo que estés armando.",
      "<b>/hoja &lt;link o ID&gt;</b> — Cambia el Google Sheet donde se guardan convocatorias y respuestas.",
      "<b>/especialidad_agregar Nombre</b> — Agrega una especialidad a la lista de botones.",
      "<b>/especialidades</b> — Lista las especialidades configuradas.",
      "<b>/resumen convocatoria_id</b> — Cuenta de disponibles / no disponibles / sin responder.",
      "<b>/script</b> — Te envía el código actual del bot (archivos .gs) para pegarlo en un proyecto nuevo.",
    ])
    .join("\n");
}

function manejarHoja(chatId, texto) {
  var valor = texto.replace("/hoja", "").trim();
  if (!valor) {
    enviarMensaje(chatId, "Uso: /hoja <link o ID de Google Sheets>");
    return;
  }

  var spreadsheetId = extraerSpreadsheetId(valor);
  var titulo;
  try {
    titulo = getSpreadsheetTitleById(spreadsheetId);
  } catch (error) {
    enviarMensaje(
      chatId,
      "⚠️ No pude abrir esa hoja. Verifica el link y que esté compartida (como editor) con tu cuenta de Google.\n\n" +
        escaparHtml(String(error.message || error)),
    );
    return;
  }

  ensureTargetSheets(spreadsheetId);
  setActiveSheet(spreadsheetId, titulo);
  aplicarFormatoProfesional(spreadsheetId);
  enviarMensaje(chatId, "✅ A partir de ahora las convocatorias y respuestas se guardan en:\n<b>" + escaparHtml(titulo) + "</b>");
}

function manejarEspecialidadAgregar(chatId, texto) {
  var nombre = texto.replace("/especialidad_agregar", "").trim();
  if (!nombre) {
    enviarMensaje(chatId, "Uso: /especialidad_agregar Nombre de la especialidad");
    return;
  }

  var agregada = addEspecialidad(nombre);
  if (agregada) {
    try {
      aplicarFormatoProfesional(getActiveSheetId());
    } catch (error) {
      // El formato es cosmetico; si falla no debe bloquear el alta.
    }
  }
  enviarMensaje(
    chatId,
    agregada ? "✅ Especialidad agregada: " + escaparHtml(nombre) : "Esa especialidad ya existía: " + escaparHtml(nombre),
  );
}

/** Lee el codigo fuente ACTUAL de este mismo proyecto (via la API de Apps
 * Script) y lo manda por Telegram, archivo por archivo, para que el admin
 * siempre pueda recuperarlo sin depender de otra conversacion. Requiere el
 * scope "script.projects.readonly" declarado en appsscript.json. */
function manejarComandoScript(chatId) {
  var scriptId = ScriptApp.getScriptId();
  var token = ScriptApp.getOAuthToken();

  var response = UrlFetchApp.fetch("https://script.googleapis.com/v1/projects/" + scriptId + "/content", {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() >= 300) {
    enviarMensaje(chatId, "⚠️ No pude leer el código del proyecto:\n" + escaparHtml(response.getContentText()));
    return;
  }

  var datos = JSON.parse(response.getContentText());
  var archivos = datos.files || [];

  if (!archivos.length) {
    enviarMensaje(chatId, "⚠️ No encontré archivos en este proyecto.");
    return;
  }

  enviarMensaje(
    chatId,
    "📦 Aquí tienes el código actual del bot (" +
      archivos.length +
      " archivo(s)). Pégalos tal cual, con el mismo nombre, en un proyecto nuevo de Apps Script.",
  );

  archivos.forEach(function (archivo) {
    var extension = archivo.type === "JSON" ? "json" : archivo.type === "HTML" ? "html" : "gs";
    var nombreArchivo = archivo.name + "." + extension;
    var blob = Utilities.newBlob(archivo.source, "text/plain", nombreArchivo);
    try {
      enviarDocumento(chatId, blob);
    } catch (error) {
      enviarMensaje(chatId, "⚠️ No pude enviar " + nombreArchivo + ": " + escaparHtml(String(error)));
    }
  });
}

function manejarEspecialidadesListar(chatId) {
  var especialidades = getEspecialidades();
  var lines = ["📋 <b>Especialidades configuradas</b>", ""].concat(
    especialidades.map(function (e) {
      return "- " + escaparHtml(e);
    }),
  );
  enviarMensaje(chatId, lines.join("\n"));
}

function resumenBorrador(datos) {
  var lines = [
    "📋 <b>Revisa los datos antes de enviar</b>",
    "",
    "🏭 Planta: " + escaparHtml(datos.planta),
    "📌 Título: " + escaparHtml(datos.titulo),
    "🗓️ Fecha del servicio: " + escaparHtml(datos.fecha_servicio),
  ];

  if (datos.hora_servicio) lines.push("🕐 Hora: " + escaparHtml(datos.hora_servicio));
  if (datos.descripcion) lines.push("📝 Descripción: " + escaparHtml(datos.descripcion));
  if (datos.fecha_limite_respuesta) {
    lines.push("⏰ Responder antes de: " + escaparHtml(datos.fecha_limite_respuesta));
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

function iniciarConvocar(chatId) {
  saveSession(chatId, "convocar_planta", {});
  enviarMensaje(
    chatId,
    "📢 <b>Nueva convocatoria</b>\n\nTe voy a pedir los datos uno por uno. Escribe /cancelar en cualquier momento para abortar.\n\n" +
      PREGUNTAS_CONVOCAR.convocar_planta,
  );
}

function manejarPasoConvocar(chatId, sesion, texto) {
  var paso = sesion.paso;
  var datos = Object.assign({}, sesion.datos);

  if (paso === "convocar_fecha_servicio" && !validarFecha(texto)) {
    enviarMensaje(chatId, "Formato inválido. Usa AAAA-MM-DD, por ejemplo 2026-08-15.");
    return;
  }

  if (paso === "convocar_fecha_limite" && texto.trim() !== "-" && !validarFechaHoraOpcional(texto)) {
    enviarMensaje(chatId, 'Formato inválido. Usa AAAA-MM-DD o AAAA-MM-DD HH:MM, o envía "-" si no aplica.');
    return;
  }

  var campo = paso.replace("convocar_", "");
  var campoDestino = campo === "fecha_limite" ? "fecha_limite_respuesta" : campo;
  var opcionalesVacios = ["hora_servicio", "descripcion", "fecha_limite"];
  var valor = texto.trim();
  datos[campoDestino] = opcionalesVacios.indexOf(campo) !== -1 && valor === "-" ? "" : valor;

  var indiceActual = PASOS_CONVOCAR.indexOf(paso);
  var siguientePaso = PASOS_CONVOCAR[indiceActual + 1];

  if (siguientePaso === "convocar_confirmar") {
    saveSession(chatId, "convocar_confirmar", datos);
    enviarMensaje(chatId, resumenBorrador(datos), confirmarKeyboard());
    return;
  }

  saveSession(chatId, siguientePaso, datos);
  enviarMensaje(chatId, PREGUNTAS_CONVOCAR[siguientePaso]);
}

function enviarConvocatoriaATodos(spreadsheetId, convocatoria) {
  var usuarios = getUsuariosActivos();
  var enviados = 0;

  usuarios.forEach(function (usuario) {
    try {
      enviarMensaje(usuario.telegram_chat_id, textoConvocatoria(convocatoria), botonesConvocatoria(convocatoria.id));
      enviados += 1;
    } catch (error) {
      // Se ignora el fallo individual, se sigue con el resto de usuarios.
    }
  });

  upsertRow(
    spreadsheetId,
    CONVOCATORIAS_SHEET,
    CONVOCATORIAS_HEADERS,
    function (row) {
      return row.id === convocatoria.id;
    },
    Object.assign({}, convocatoria, { estado: "enviada", enviada_en: new Date().toISOString() }),
  );

  return enviados;
}

function manejarConfirmacionConvocar(chatId, callbackId, accion) {
  var sesion = getSession(chatId);

  if (!sesion || sesion.paso !== "convocar_confirmar") {
    responderCallback(callbackId, "Esta convocatoria ya no está en edición.");
    return;
  }

  if (accion === "cancelar") {
    deleteSession(chatId);
    responderCallback(callbackId, "Convocatoria cancelada.");
    enviarMensaje(chatId, "🗑️ Convocatoria cancelada. Usa /convocar para empezar de nuevo.");
    return;
  }

  var spreadsheetId = getActiveSheetId();
  var datos = sesion.datos;
  var convocatoria = {
    id: generarId(),
    titulo: datos.titulo || "",
    planta: datos.planta || "",
    fecha_servicio: datos.fecha_servicio || "",
    hora_servicio: datos.hora_servicio || "",
    descripcion: datos.descripcion || "",
    fecha_limite_respuesta: datos.fecha_limite_respuesta || "",
    estado: "borrador",
    creado_por: String(chatId),
    creado_en: new Date().toISOString(),
    enviada_en: "",
  };

  appendRowToSheet(spreadsheetId, CONVOCATORIAS_SHEET, CONVOCATORIAS_HEADERS, convocatoria);
  deleteSession(chatId);

  if (accion === "borrador") {
    responderCallback(callbackId, "Guardada como borrador.");
    enviarMensaje(chatId, "💾 Convocatoria guardada como borrador.\n\nID: <code>" + convocatoria.id + "</code>");
    return;
  }

  responderCallback(callbackId, "Enviando a todos los usuarios...");
  var enviados = enviarConvocatoriaATodos(spreadsheetId, convocatoria);
  enviarMensaje(
    chatId,
    "🚀 Convocatoria enviada a " +
      enviados +
      " usuario(s).\n\nID: <code>" +
      convocatoria.id +
      "</code>\n\nUsa /resumen " +
      convocatoria.id +
      " para ver las respuestas.",
  );
}

function manejarResumen(chatId, convocatoriaId) {
  var spreadsheetId = getActiveSheetId();
  var convocatoria = findRow(spreadsheetId, CONVOCATORIAS_SHEET, CONVOCATORIAS_HEADERS, function (row) {
    return row.id === convocatoriaId;
  });

  if (!convocatoria) {
    enviarMensaje(chatId, 'No encontré ninguna convocatoria con id "' + escaparHtml(convocatoriaId) + '" en la hoja activa.');
    return;
  }

  var respuestas = getAllRows(spreadsheetId, RESPUESTAS_SHEET, RESPUESTAS_HEADERS).filter(function (r) {
    return r.convocatoria_id === convocatoriaId;
  });

  var conteo = { disponible: 0, no_disponible: 0, posiblemente: 0 };
  respuestas.forEach(function (fila) {
    if (conteo[fila.respuesta] !== undefined) conteo[fila.respuesta] += 1;
  });

  var lines = [
    "📋 <b>" + escaparHtml(convocatoria.titulo) + "</b>",
    "🏭 " + escaparHtml(convocatoria.planta) + " — 🗓️ " + escaparHtml(convocatoria.fecha_servicio),
    "",
    "Total respuestas: " + respuestas.length,
    "✅ Disponible: " + conteo.disponible,
    "❌ No disponible: " + conteo.no_disponible,
    "🤔 Posiblemente: " + conteo.posiblemente,
  ];

  enviarMensaje(chatId, lines.join("\n"));
}

function manejarRespuestaCallback(chatId, messageId, callbackId, from, convocatoriaId, respuesta) {
  if (!ETIQUETAS_RESPUESTA[respuesta]) {
    responderCallback(callbackId, "Opción no reconocida.");
    return;
  }

  var spreadsheetId = getActiveSheetId();
  var convocatoria = findRow(spreadsheetId, CONVOCATORIAS_SHEET, CONVOCATORIAS_HEADERS, function (row) {
    return row.id === convocatoriaId;
  });

  if (!convocatoria) {
    responderCallback(callbackId, "Esta convocatoria ya no existe en la hoja activa.");
    return;
  }

  upsertRow(
    spreadsheetId,
    RESPUESTAS_SHEET,
    RESPUESTAS_HEADERS,
    function (row) {
      return row.convocatoria_id === convocatoriaId && row.telegram_chat_id === String(chatId);
    },
    {
      convocatoria_id: convocatoriaId,
      telegram_chat_id: String(chatId),
      nombre: from.first_name || "",
      username: from.username || "",
      respuesta: respuesta,
      respondido_en: new Date().toISOString(),
    },
  );

  var lines = [
    "📢 <b>Convocatoria - Parada de planta</b>",
    "",
    "🏭 <b>" + escaparHtml(convocatoria.planta || "Planta") + "</b>",
    "📌 " + escaparHtml(convocatoria.titulo),
    "",
    "🗓️ Fecha del servicio: " +
      escaparHtml(convocatoria.fecha_servicio) +
      (convocatoria.hora_servicio ? " — " + escaparHtml(convocatoria.hora_servicio) : ""),
    "",
    "Tu respuesta: <b>" + ETIQUETAS_RESPUESTA[respuesta] + "</b>",
  ];

  editarMensaje(chatId, messageId, lines.join("\n"));
  responderCallback(callbackId, "Respuesta registrada: " + ETIQUETAS_RESPUESTA[respuesta]);

  avanzarFlujoRespuesta(chatId, ORDEN_RESPUESTA[0], { convocatoria_id: convocatoriaId });
}

function manejarEspecialidadCallback(chatId, callbackId, nombreEspecialidad) {
  var sesion = getSession(chatId);

  if (!sesion || sesion.paso !== "resp_especialidad") {
    responderCallback(callbackId, "Esto ya no está activo.");
    return;
  }

  var spreadsheetId = getActiveSheetId();
  upsertRow(
    spreadsheetId,
    RESPUESTAS_SHEET,
    RESPUESTAS_HEADERS,
    function (row) {
      return row.convocatoria_id === sesion.datos.convocatoria_id && row.telegram_chat_id === String(chatId);
    },
    { especialidad: nombreEspecialidad },
  );

  responderCallback(callbackId, "Especialidad: " + nombreEspecialidad);
  var siguientePaso = ORDEN_RESPUESTA[ORDEN_RESPUESTA.indexOf("resp_especialidad") + 1];
  avanzarFlujoRespuesta(chatId, siguientePaso, Object.assign({}, sesion.datos, { especialidad: nombreEspecialidad }));
}

function manejarPasoRespuesta(chatId, sesion, message) {
  var paso = sesion.paso;
  var texto = (message.text || "").trim();
  var spreadsheetId = getActiveSheetId();
  var matchFn = function (row) {
    return row.convocatoria_id === sesion.datos.convocatoria_id && row.telegram_chat_id === String(chatId);
  };

  if (paso === "resp_experiencia") {
    var actualizacionExp = {};
    if (message.voice) {
      actualizacionExp.experiencia_audio_file_id = message.voice.file_id;
    } else if (texto) {
      actualizacionExp.experiencia_texto = texto;
    } else {
      enviarMensaje(chatId, "Envía tu experiencia en un mensaje de texto o una nota de voz.");
      return;
    }

    upsertRow(spreadsheetId, RESPUESTAS_SHEET, RESPUESTAS_HEADERS, matchFn, actualizacionExp);
    avanzarFlujoRespuesta(chatId, ORDEN_RESPUESTA[ORDEN_RESPUESTA.indexOf("resp_experiencia") + 1], sesion.datos);
    return;
  }

  if (paso === "resp_cv") {
    if (!message.document) {
      enviarMensaje(chatId, "Envía tu CV como documento (PDF o Word), adjuntándolo directo en este chat.");
      return;
    }

    var filaActual = findRow(spreadsheetId, RESPUESTAS_SHEET, RESPUESTAS_HEADERS, matchFn);
    var nombreSugerido = construirNombreArchivoCv(
      filaActual && filaActual.nombres_completos,
      filaActual && filaActual.dni,
      chatId,
    );

    var urlDrive;
    try {
      urlDrive = guardarCvEnDrive(message.document.file_id, nombreSugerido, message.document.file_name);
    } catch (error) {
      enviarMensaje(chatId, "⚠️ No pude guardar tu CV, intenta enviarlo de nuevo en unos minutos.");
      return;
    }

    upsertRow(spreadsheetId, RESPUESTAS_SHEET, RESPUESTAS_HEADERS, matchFn, {
      cv_drive_url: '=HYPERLINK("' + urlDrive + '","📎 Ver CV")',
    });
    deleteSession(chatId);
    enviarMensaje(chatId, "✅ ¡Gracias! Tu registro (incluido tu CV) quedó completo.");
    return;
  }

  if (!texto) {
    enviarMensaje(chatId, "Por favor responde con un mensaje de texto.");
    return;
  }

  var campo = paso.replace("resp_", "");
  var actualizacion = {};
  actualizacion[campo] = campo === "telefono" ? construirLinkWhatsApp(texto) : texto;
  upsertRow(spreadsheetId, RESPUESTAS_SHEET, RESPUESTAS_HEADERS, matchFn, actualizacion);

  var indiceActual = ORDEN_RESPUESTA.indexOf(paso);
  avanzarFlujoRespuesta(chatId, ORDEN_RESPUESTA[indiceActual + 1], sesion.datos);
}

function manejarUpdate(update) {
  ensureControlSheets();

  if (update.callback_query) {
    var cq = update.callback_query;
    var chatId = String((cq.message && cq.message.chat.id) || cq.from.id);
    upsertUsuario(chatId, {
      telegramUserId: String(cq.from.id),
      nombre: cq.from.first_name,
      username: cq.from.username,
    });

    var data = cq.data || "";
    var matchRespuesta = data.match(/^conv:([^:]+):(.+)$/);
    var matchConfirmar = data.match(/^confirmar_convocatoria:(.+)$/);
    var matchEspecialidad = data.match(/^esp:(.+)$/);

    if (matchConfirmar) {
      if (!esAdmin(chatId)) {
        responderCallback(cq.id, "Solo administradores.");
      } else {
        manejarConfirmacionConvocar(chatId, cq.id, matchConfirmar[1]);
      }
    } else if (matchEspecialidad) {
      manejarEspecialidadCallback(chatId, cq.id, matchEspecialidad[1]);
    } else if (matchRespuesta && cq.message) {
      manejarRespuestaCallback(chatId, cq.message.message_id, cq.id, cq.from, matchRespuesta[1], matchRespuesta[2]);
    } else {
      responderCallback(cq.id);
    }
    return;
  }

  if (update.message) {
    var msgChatId = String(update.message.chat.id);
    var texto = (update.message.text || "").trim();
    var from = update.message.from;

    if (from) {
      upsertUsuario(msgChatId, {
        telegramUserId: String(from.id),
        nombre: from.first_name,
        username: from.username,
      });
    }

    var sesion = getSession(msgChatId);

    if (texto === "/start") {
      enviarMensaje(msgChatId, bienvenidaTexto());
    } else if (texto === "/ayuda" || texto === "/help") {
      enviarMensaje(msgChatId, helpTexto(esAdmin(msgChatId)));
    } else if (texto === "/cancelar") {
      if (sesion) {
        deleteSession(msgChatId);
        enviarMensaje(msgChatId, "🗑️ Cancelado.");
      } else {
        enviarMensaje(msgChatId, "No tienes nada en curso para cancelar.");
      }
    } else if (texto === "/convocar") {
      if (!esAdmin(msgChatId)) {
        enviarMensaje(msgChatId, "🔒 Este comando es solo para administradores.");
      } else {
        iniciarConvocar(msgChatId);
      }
    } else if (texto.indexOf("/hoja") === 0) {
      if (!esAdmin(msgChatId)) {
        enviarMensaje(msgChatId, "🔒 Este comando es solo para administradores.");
      } else {
        manejarHoja(msgChatId, texto);
      }
    } else if (texto.indexOf("/especialidad_agregar") === 0) {
      if (!esAdmin(msgChatId)) {
        enviarMensaje(msgChatId, "🔒 Este comando es solo para administradores.");
      } else {
        manejarEspecialidadAgregar(msgChatId, texto);
      }
    } else if (texto === "/especialidades") {
      manejarEspecialidadesListar(msgChatId);
    } else if (texto.indexOf("/resumen") === 0) {
      if (!esAdmin(msgChatId)) {
        enviarMensaje(msgChatId, "🔒 Este comando es solo para administradores.");
      } else {
        var convocatoriaId = texto.replace("/resumen", "").trim();
        if (!convocatoriaId) {
          enviarMensaje(msgChatId, "Uso: /resumen <convocatoria_id>");
        } else {
          manejarResumen(msgChatId, convocatoriaId);
        }
      }
    } else if (texto === "/script") {
      if (!esAdmin(msgChatId)) {
        enviarMensaje(msgChatId, "🔒 Este comando es solo para administradores.");
      } else {
        manejarComandoScript(msgChatId);
      }
    } else if (
      sesion &&
      PASOS_CONVOCAR.indexOf(sesion.paso) !== -1 &&
      sesion.paso !== "convocar_confirmar" &&
      texto &&
      texto.indexOf("/") !== 0
    ) {
      manejarPasoConvocar(msgChatId, sesion, texto);
    } else if (sesion && ORDEN_RESPUESTA.indexOf(sesion.paso) !== -1 && sesion.paso !== "resp_especialidad") {
      manejarPasoRespuesta(msgChatId, sesion, update.message);
    } else {
      enviarMensaje(msgChatId, "No entendí ese mensaje. Usa /ayuda para ver los comandos disponibles.");
    }
  }
}

/** Punto de entrada del Web App: configúralo como webhook de Telegram
 * (ver README) apuntando a la URL /exec de este deployment. */
function doPost(e) {
  try {
    var update = JSON.parse(e.postData.contents);
    manejarUpdate(update);
  } catch (error) {
    console.error("TELEGRAM_WEBHOOK_ERROR: " + error + "\n" + (error && error.stack));
  }
  return ContentService.createTextOutput("OK");
}
