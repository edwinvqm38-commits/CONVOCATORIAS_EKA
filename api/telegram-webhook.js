const store = require("../lib/store");
const sheetsLib = require("../lib/sheets");
const schema = require("../lib/schema");
const { sendMessage, editMessage, answerCallback, escapeHtml } = require("../lib/telegram");

const ETIQUETAS_RESPUESTA = {
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

const PREGUNTAS_CONVOCAR = {
  convocar_planta: "🏭 ¿Cuál es la planta o ubicación del servicio?",
  convocar_titulo:
    '📌 ¿Cuál es el título/motivo de la convocatoria? (ej. "Parada de planta - mantenimiento anual")',
  convocar_fecha_servicio: "🗓️ ¿Cuál es la fecha del servicio? Formato AAAA-MM-DD (ej. 2026-08-15).",
  convocar_hora_servicio: '🕐 ¿A qué hora? (o envía "-" si no aplica)',
  convocar_descripcion: '📝 Agrega una descripción/detalle para los usuarios (o envía "-" para dejarla vacía).',
  convocar_fecha_limite:
    '⏰ ¿Hasta cuándo pueden responder? Formato AAAA-MM-DD o AAAA-MM-DD HH:MM (o envía "-" si no aplica).',
};

const PASOS_RESPUESTA = [
  "resp_telefono",
  "resp_nombres_completos",
  "resp_dni",
  "resp_lugar_residencia",
  "resp_experiencia",
];

const PREGUNTAS_RESPUESTA = {
  resp_telefono: "📞 Indica tu número de teléfono.",
  resp_nombres_completos: "🪪 Indica tus nombres completos.",
  resp_dni: "🆔 Indica tu número de DNI.",
  resp_lugar_residencia: "📍 Indica tu lugar de residencia.",
  resp_experiencia:
    "🛠️ Cuéntanos brevemente tu experiencia. Puedes escribirla en texto o enviar una nota de voz.",
};

function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function validarFecha(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor.trim());
}

function validarFechaHoraOpcional(valor) {
  return /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2})?$/.test(valor.trim());
}

function textoConvocatoria(convocatoria) {
  const lines = [
    "📢 <b>Convocatoria - Parada de planta</b>",
    "",
    `🏭 <b>${escapeHtml(convocatoria.planta || "Planta")}</b>`,
    `📌 ${escapeHtml(convocatoria.titulo || "")}`,
  ];

  if (convocatoria.descripcion) {
    lines.push("", escapeHtml(convocatoria.descripcion));
  }

  const fechaLinea = `🗓️ Fecha del servicio: ${escapeHtml(convocatoria.fecha_servicio)}`;
  lines.push(
    "",
    convocatoria.hora_servicio ? `${fechaLinea} — ${escapeHtml(convocatoria.hora_servicio)}` : fechaLinea,
  );

  if (convocatoria.fecha_limite_respuesta) {
    lines.push(`⏰ Responde antes de: ${escapeHtml(convocatoria.fecha_limite_respuesta)}`);
  }

  lines.push("", "¿Estás disponible para participar? Confirma con un botón:");
  return lines.join("\n");
}

function botonesConvocatoria(convocatoriaId) {
  return {
    inline_keyboard: Object.entries(ETIQUETAS_RESPUESTA).map(([respuesta, texto]) => [
      { text: texto, callback_data: `conv:${convocatoriaId}:${respuesta}` },
    ]),
  };
}

function botonesEspecialidades(especialidades) {
  const filas = [];
  for (let i = 0; i < especialidades.length; i += 2) {
    filas.push(
      especialidades
        .slice(i, i + 2)
        .map((nombre) => ({ text: nombre, callback_data: `esp:${nombre}` })),
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

function helpTexto(esAdmin) {
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
    "<b>/convocar</b> — Crea y envía una convocatoria paso a paso.",
    "<b>/cancelar</b> — Cancela lo que estés armando.",
    "<b>/hoja &lt;link o ID&gt;</b> — Cambia el Google Sheet donde se guardan convocatorias y respuestas.",
    "<b>/especialidad_agregar Nombre</b> — Agrega una especialidad a la lista de botones.",
    "<b>/especialidades</b> — Lista las especialidades configuradas.",
    "<b>/resumen convocatoria_id</b> — Cuenta de disponibles / no disponibles / sin responder.",
  ].join("\n");
}

async function manejarHoja(chatId, texto) {
  const valor = texto.replace("/hoja", "").trim();
  if (!valor) {
    return await sendMessage(chatId, "Uso: /hoja <link o ID de Google Sheets>");
  }

  const spreadsheetId = sheetsLib.extraerSpreadsheetId(valor);

  let titulo;
  try {
    titulo = await sheetsLib.getSpreadsheetTitle(spreadsheetId);
  } catch (error) {
    return await sendMessage(
      chatId,
      `⚠️ No pude abrir esa hoja. Verifica el link y que esté compartida con el correo de la cuenta de servicio del bot.\n\n${escapeHtml(
        String(error.message || error),
      )}`,
    );
  }

  await store.ensureTargetSheets(spreadsheetId);
  await store.setActiveSheet(spreadsheetId, titulo);

  return await sendMessage(
    chatId,
    `✅ A partir de ahora las convocatorias y respuestas se guardan en:\n<b>${escapeHtml(titulo)}</b>`,
  );
}

async function manejarEspecialidadAgregar(chatId, texto) {
  const nombre = texto.replace("/especialidad_agregar", "").trim();
  if (!nombre) {
    return await sendMessage(chatId, "Uso: /especialidad_agregar Nombre de la especialidad");
  }

  const agregada = await store.addEspecialidad(nombre);
  return await sendMessage(
    chatId,
    agregada
      ? `✅ Especialidad agregada: ${escapeHtml(nombre)}`
      : `Esa especialidad ya existía: ${escapeHtml(nombre)}`,
  );
}

async function manejarEspecialidadesListar(chatId) {
  const especialidades = await store.getEspecialidades();
  return await sendMessage(
    chatId,
    ["📋 <b>Especialidades configuradas</b>", "", ...especialidades.map((e) => `- ${escapeHtml(e)}`)].join(
      "\n",
    ),
  );
}

function resumenBorrador(datos) {
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

async function iniciarConvocar(chatId) {
  await store.saveSession(chatId, "convocar_planta", {});
  await sendMessage(
    chatId,
    "📢 <b>Nueva convocatoria</b>\n\nTe voy a pedir los datos uno por uno. Escribe /cancelar en cualquier momento para abortar.\n\n" +
      PREGUNTAS_CONVOCAR.convocar_planta,
  );
}

async function manejarPasoConvocar(chatId, sesion, texto) {
  const paso = sesion.paso;
  const datos = { ...sesion.datos };

  if (paso === "convocar_fecha_servicio" && !validarFecha(texto)) {
    return await sendMessage(chatId, "Formato inválido. Usa AAAA-MM-DD, por ejemplo 2026-08-15.");
  }

  if (paso === "convocar_fecha_limite" && texto.trim() !== "-" && !validarFechaHoraOpcional(texto)) {
    return await sendMessage(
      chatId,
      'Formato inválido. Usa AAAA-MM-DD o AAAA-MM-DD HH:MM, o envía "-" si no aplica.',
    );
  }

  const campo = paso.replace("convocar_", "");
  const opcionalesVacios = ["hora_servicio", "descripcion", "fecha_limite"];
  const valor = texto.trim();
  datos[campo === "fecha_limite" ? "fecha_limite_respuesta" : campo] =
    opcionalesVacios.includes(campo) && valor === "-" ? "" : valor;

  const indiceActual = PASOS_CONVOCAR.indexOf(paso);
  const siguientePaso = PASOS_CONVOCAR[indiceActual + 1];

  if (siguientePaso === "convocar_confirmar") {
    await store.saveSession(chatId, "convocar_confirmar", datos);
    return await sendMessage(chatId, resumenBorrador(datos), confirmarKeyboard());
  }

  await store.saveSession(chatId, siguientePaso, datos);
  return await sendMessage(chatId, PREGUNTAS_CONVOCAR[siguientePaso]);
}

async function enviarConvocatoriaATodos(spreadsheetId, convocatoria) {
  const { sendMessage: enviarTelegram } = require("../lib/telegram");
  const usuarios = await store.getUsuariosActivos();

  let enviados = 0;
  for (const usuario of usuarios) {
    try {
      await enviarTelegram(
        usuario.telegram_chat_id,
        textoConvocatoria(convocatoria),
        botonesConvocatoria(convocatoria.id),
      );
      enviados += 1;
    } catch (_error) {
      // Se ignora el fallo individual, se sigue con el resto de usuarios.
    }
  }

  await sheetsLib.upsertRow(
    spreadsheetId,
    schema.CONVOCATORIAS_SHEET,
    schema.CONVOCATORIAS_HEADERS,
    (row) => row.id === convocatoria.id,
    { ...convocatoria, estado: "enviada", enviada_en: new Date().toISOString() },
  );

  return enviados;
}

async function manejarConfirmacionConvocar(chatId, callbackId, accion) {
  const sesion = await store.getSession(chatId);

  if (!sesion || sesion.paso !== "convocar_confirmar") {
    return await answerCallback(callbackId, "Esta convocatoria ya no está en edición.");
  }

  if (accion === "cancelar") {
    await store.deleteSession(chatId);
    await answerCallback(callbackId, "Convocatoria cancelada.");
    return await sendMessage(chatId, "🗑️ Convocatoria cancelada. Usa /convocar para empezar de nuevo.");
  }

  const spreadsheetId = await store.getActiveSheetId();
  const datos = sesion.datos;
  const convocatoria = {
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

  await sheetsLib.appendRow(spreadsheetId, schema.CONVOCATORIAS_SHEET, schema.CONVOCATORIAS_HEADERS, convocatoria);
  await store.deleteSession(chatId);

  if (accion === "borrador") {
    await answerCallback(callbackId, "Guardada como borrador.");
    return await sendMessage(
      chatId,
      `💾 Convocatoria guardada como borrador.\n\nID: <code>${convocatoria.id}</code>`,
    );
  }

  await answerCallback(callbackId, "Enviando a todos los usuarios...");
  const enviados = await enviarConvocatoriaATodos(spreadsheetId, convocatoria);
  return await sendMessage(
    chatId,
    `🚀 Convocatoria enviada a ${enviados} usuario(s).\n\nID: <code>${convocatoria.id}</code>\n\nUsa /resumen ${convocatoria.id} para ver las respuestas.`,
  );
}

async function manejarResumen(chatId, convocatoriaId) {
  const spreadsheetId = await store.getActiveSheetId();

  const convocatoria = await sheetsLib.findRow(
    spreadsheetId,
    schema.CONVOCATORIAS_SHEET,
    schema.CONVOCATORIAS_HEADERS,
    (row) => row.id === convocatoriaId,
  );

  if (!convocatoria) {
    return await sendMessage(chatId, `No encontré ninguna convocatoria con id "${escapeHtml(convocatoriaId)}" en la hoja activa.`);
  }

  const respuestas = await sheetsLib.getAllRows(spreadsheetId, schema.RESPUESTAS_SHEET, schema.RESPUESTAS_HEADERS);
  const filasConvocatoria = respuestas.filter((r) => r.convocatoria_id === convocatoriaId);

  const conteo = { disponible: 0, no_disponible: 0, posiblemente: 0 };
  for (const fila of filasConvocatoria) {
    if (conteo[fila.respuesta] !== undefined) conteo[fila.respuesta] += 1;
  }

  const lines = [
    `📋 <b>${escapeHtml(convocatoria.titulo)}</b>`,
    `🏭 ${escapeHtml(convocatoria.planta)} — 🗓️ ${escapeHtml(convocatoria.fecha_servicio)}`,
    "",
    `Total respuestas: ${filasConvocatoria.length}`,
    `✅ Disponible: ${conteo.disponible}`,
    `❌ No disponible: ${conteo.no_disponible}`,
    `🤔 Posiblemente: ${conteo.posiblemente}`,
  ];

  return await sendMessage(chatId, lines.join("\n"));
}

async function manejarRespuestaCallback(chatId, messageId, callbackId, from, convocatoriaId, respuesta) {
  if (!ETIQUETAS_RESPUESTA[respuesta]) {
    return await answerCallback(callbackId, "Opción no reconocida.");
  }

  const spreadsheetId = await store.getActiveSheetId();
  const convocatoria = await sheetsLib.findRow(
    spreadsheetId,
    schema.CONVOCATORIAS_SHEET,
    schema.CONVOCATORIAS_HEADERS,
    (row) => row.id === convocatoriaId,
  );

  if (!convocatoria) {
    return await answerCallback(callbackId, "Esta convocatoria ya no existe en la hoja activa.");
  }

  await sheetsLib.upsertRow(
    spreadsheetId,
    schema.RESPUESTAS_SHEET,
    schema.RESPUESTAS_HEADERS,
    (row) => row.convocatoria_id === convocatoriaId && row.telegram_chat_id === String(chatId),
    {
      convocatoria_id: convocatoriaId,
      telegram_chat_id: String(chatId),
      nombre: from.first_name || "",
      username: from.username || "",
      respuesta,
      respondido_en: new Date().toISOString(),
    },
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

  const especialidades = await store.getEspecialidades();
  await store.saveSession(chatId, "resp_especialidad", { convocatoria_id: convocatoriaId });
  await sendMessage(chatId, "🛠️ Indica tu especialidad:", botonesEspecialidades(especialidades));
}

async function manejarEspecialidadCallback(chatId, callbackId, nombreEspecialidad) {
  const sesion = await store.getSession(chatId);

  if (!sesion || sesion.paso !== "resp_especialidad") {
    return await answerCallback(callbackId, "Esto ya no está activo.");
  }

  const spreadsheetId = await store.getActiveSheetId();
  await sheetsLib.upsertRow(
    spreadsheetId,
    schema.RESPUESTAS_SHEET,
    schema.RESPUESTAS_HEADERS,
    (row) => row.convocatoria_id === sesion.datos.convocatoria_id && row.telegram_chat_id === String(chatId),
    { especialidad: nombreEspecialidad },
  );

  await store.saveSession(chatId, "resp_telefono", { ...sesion.datos, especialidad: nombreEspecialidad });
  await answerCallback(callbackId, `Especialidad: ${nombreEspecialidad}`);
  return await sendMessage(chatId, PREGUNTAS_RESPUESTA.resp_telefono);
}

async function manejarPasoRespuesta(chatId, sesion, message) {
  const paso = sesion.paso;
  const texto = (message.text || "").trim();
  const spreadsheetId = await store.getActiveSheetId();
  const matchFn = (row) =>
    row.convocatoria_id === sesion.datos.convocatoria_id && row.telegram_chat_id === String(chatId);

  if (paso !== "resp_experiencia" && !texto) {
    return await sendMessage(chatId, "Por favor responde con un mensaje de texto.");
  }

  if (paso === "resp_experiencia") {
    const actualizacion = {};
    if (message.voice) {
      actualizacion.experiencia_audio_file_id = message.voice.file_id;
    } else if (texto) {
      actualizacion.experiencia_texto = texto;
    } else {
      return await sendMessage(chatId, "Envía tu experiencia en un mensaje de texto o una nota de voz.");
    }

    await sheetsLib.upsertRow(
      spreadsheetId,
      schema.RESPUESTAS_SHEET,
      schema.RESPUESTAS_HEADERS,
      matchFn,
      actualizacion,
    );
    await store.deleteSession(chatId);
    return await sendMessage(
      chatId,
      "✅ ¡Gracias! Tu registro quedó completo. Te avisaremos por aquí cualquier novedad.",
    );
  }

  const campo = paso.replace("resp_", "");
  await sheetsLib.upsertRow(spreadsheetId, schema.RESPUESTAS_SHEET, schema.RESPUESTAS_HEADERS, matchFn, {
    [campo]: texto,
  });

  const indiceActual = PASOS_RESPUESTA.indexOf(paso);
  const siguientePaso = PASOS_RESPUESTA[indiceActual + 1];
  await store.saveSession(chatId, siguientePaso, sesion.datos);
  return await sendMessage(chatId, PREGUNTAS_RESPUESTA[siguientePaso]);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(200).send("OK");
    return;
  }

  const update = req.body;

  try {
    await store.ensureControlSheets();

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.message?.chat.id ?? cq.from.id);
      await store.upsertUsuario(chatId, {
        telegramUserId: String(cq.from.id),
        nombre: cq.from.first_name,
        username: cq.from.username,
      });

      const data = cq.data || "";
      const matchRespuesta = data.match(/^conv:([^:]+):(.+)$/);
      const matchConfirmar = data.match(/^confirmar_convocatoria:(.+)$/);
      const matchEspecialidad = data.match(/^esp:(.+)$/);

      if (matchConfirmar) {
        if (!store.isAdmin(chatId)) {
          await answerCallback(cq.id, "Solo administradores.");
        } else {
          await manejarConfirmacionConvocar(chatId, cq.id, matchConfirmar[1]);
        }
      } else if (matchEspecialidad) {
        await manejarEspecialidadCallback(chatId, cq.id, matchEspecialidad[1]);
      } else if (matchRespuesta && cq.message) {
        const [, convocatoriaId, respuesta] = matchRespuesta;
        await manejarRespuestaCallback(chatId, cq.message.message_id, cq.id, cq.from, convocatoriaId, respuesta);
      } else {
        await answerCallback(cq.id);
      }

      res.status(200).send("OK");
      return;
    }

    if (update.message) {
      const chatId = String(update.message.chat.id);
      const text = (update.message.text || "").trim();
      const from = update.message.from;

      if (from) {
        await store.upsertUsuario(chatId, {
          telegramUserId: String(from.id),
          nombre: from.first_name,
          username: from.username,
        });
      }

      const sesion = await store.getSession(chatId);

      if (text === "/start") {
        await sendMessage(chatId, bienvenidaTexto());
      } else if (text === "/ayuda" || text === "/help") {
        await sendMessage(chatId, helpTexto(store.isAdmin(chatId)));
      } else if (text === "/cancelar") {
        if (sesion) {
          await store.deleteSession(chatId);
          await sendMessage(chatId, "🗑️ Cancelado.");
        } else {
          await sendMessage(chatId, "No tienes nada en curso para cancelar.");
        }
      } else if (text === "/convocar") {
        if (!store.isAdmin(chatId)) {
          await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
        } else {
          await iniciarConvocar(chatId);
        }
      } else if (text.startsWith("/hoja")) {
        if (!store.isAdmin(chatId)) {
          await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
        } else {
          await manejarHoja(chatId, text);
        }
      } else if (text.startsWith("/especialidad_agregar")) {
        if (!store.isAdmin(chatId)) {
          await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
        } else {
          await manejarEspecialidadAgregar(chatId, text);
        }
      } else if (text === "/especialidades") {
        await manejarEspecialidadesListar(chatId);
      } else if (text.startsWith("/resumen")) {
        if (!store.isAdmin(chatId)) {
          await sendMessage(chatId, "🔒 Este comando es solo para administradores.");
        } else {
          const convocatoriaId = text.replace("/resumen", "").trim();
          if (!convocatoriaId) {
            await sendMessage(chatId, "Uso: /resumen <convocatoria_id>");
          } else {
            await manejarResumen(chatId, convocatoriaId);
          }
        }
      } else if (sesion && PASOS_CONVOCAR.includes(sesion.paso) && sesion.paso !== "convocar_confirmar" && text && !text.startsWith("/")) {
        await manejarPasoConvocar(chatId, sesion, text);
      } else if (sesion && PASOS_RESPUESTA.includes(sesion.paso)) {
        await manejarPasoRespuesta(chatId, sesion, update.message);
      } else {
        await sendMessage(chatId, "No entendí ese mensaje. Usa /ayuda para ver los comandos disponibles.");
      }

      res.status(200).send("OK");
      return;
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("TELEGRAM_WEBHOOK_ERROR:", error);
    res.status(200).send("OK");
  }
};
