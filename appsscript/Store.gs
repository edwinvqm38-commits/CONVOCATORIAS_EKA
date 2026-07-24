// Configuracion y estado del bot: propiedades del proyecto de Apps Script
// (Project Settings > Script properties) mas la hoja de Control.

function getScriptProp(clave) {
  return PropertiesService.getScriptProperties().getProperty(clave);
}

function esAdmin(chatId) {
  var admins = (getScriptProp("ADMIN_CHAT_IDS") || "")
    .split(",")
    .map(function (id) {
      return id.trim();
    })
    .filter(Boolean);
  return admins.indexOf(String(chatId)) !== -1;
}

function getControlSheetId() {
  var id = getScriptProp("CONTROL_SHEET_ID");
  if (!id) throw new Error("Falta la propiedad de script CONTROL_SHEET_ID");
  return id;
}

function ensureControlSheets() {
  var controlId = getControlSheetId();
  ensureSheetWithHeaders(controlId, CONFIG_SHEET, CONFIG_HEADERS);
  ensureSheetWithHeaders(controlId, ESPECIALIDADES_SHEET, ESPECIALIDADES_HEADERS);
  ensureSheetWithHeaders(controlId, SESIONES_SHEET, SESIONES_HEADERS);
  ensureSheetWithHeaders(controlId, USUARIOS_SHEET, USUARIOS_HEADERS);
}

function ensureTargetSheets(spreadsheetId) {
  ensureSheetWithHeaders(spreadsheetId, CONVOCATORIAS_SHEET, CONVOCATORIAS_HEADERS);
  ensureSheetWithHeaders(spreadsheetId, RESPUESTAS_SHEET, RESPUESTAS_HEADERS);
}

function getActiveSheetId() {
  var controlId = getControlSheetId();
  var fila = findRow(controlId, CONFIG_SHEET, CONFIG_HEADERS, function (row) {
    return row.clave === "hoja_actual_id";
  });
  var activeId = fila && fila.valor ? fila.valor : controlId;
  ensureTargetSheets(activeId);
  return activeId;
}

function setActiveSheet(spreadsheetId, nombre) {
  var controlId = getControlSheetId();
  upsertRow(
    controlId,
    CONFIG_SHEET,
    CONFIG_HEADERS,
    function (row) {
      return row.clave === "hoja_actual_id";
    },
    { clave: "hoja_actual_id", valor: spreadsheetId },
  );
  upsertRow(
    controlId,
    CONFIG_SHEET,
    CONFIG_HEADERS,
    function (row) {
      return row.clave === "hoja_actual_nombre";
    },
    { clave: "hoja_actual_nombre", valor: nombre },
  );
}

function getEspecialidades() {
  var controlId = getControlSheetId();
  var filas = getAllRows(controlId, ESPECIALIDADES_SHEET, ESPECIALIDADES_HEADERS);

  if (filas.length === 0) {
    ESPECIALIDADES_INICIALES.forEach(function (nombre) {
      appendRowToSheet(controlId, ESPECIALIDADES_SHEET, ESPECIALIDADES_HEADERS, { nombre: nombre });
    });
    return ESPECIALIDADES_INICIALES.slice();
  }

  return filas.map(function (f) {
    return f.nombre;
  }).filter(Boolean);
}

function addEspecialidad(nombre) {
  var controlId = getControlSheetId();
  var existentes = getEspecialidades();
  var yaExiste = existentes.some(function (e) {
    return e.toLowerCase() === nombre.toLowerCase();
  });
  if (yaExiste) return false;

  appendRowToSheet(controlId, ESPECIALIDADES_SHEET, ESPECIALIDADES_HEADERS, { nombre: nombre });
  return true;
}

function getSession(chatId) {
  var controlId = getControlSheetId();
  var fila = findRow(controlId, SESIONES_SHEET, SESIONES_HEADERS, function (row) {
    return row.telegram_chat_id === String(chatId);
  });
  if (!fila) return null;

  var datos = {};
  try {
    datos = JSON.parse(fila.datos_json || "{}");
  } catch (error) {
    datos = {};
  }

  return { paso: fila.paso, datos: datos, _rowNumber: fila._rowNumber };
}

function saveSession(chatId, paso, datos) {
  var controlId = getControlSheetId();
  upsertRow(
    controlId,
    SESIONES_SHEET,
    SESIONES_HEADERS,
    function (row) {
      return row.telegram_chat_id === String(chatId);
    },
    {
      telegram_chat_id: String(chatId),
      paso: paso,
      datos_json: JSON.stringify(datos || {}),
      actualizado_en: new Date().toISOString(),
    },
  );
}

function deleteSession(chatId) {
  var controlId = getControlSheetId();
  var fila = findRow(controlId, SESIONES_SHEET, SESIONES_HEADERS, function (row) {
    return row.telegram_chat_id === String(chatId);
  });
  if (fila) {
    deleteRowInSheet(controlId, SESIONES_SHEET, fila._rowNumber);
  }
}

function upsertUsuario(chatId, datos) {
  var controlId = getControlSheetId();
  var existente = findRow(controlId, USUARIOS_SHEET, USUARIOS_HEADERS, function (row) {
    return row.telegram_chat_id === String(chatId);
  });
  var ahora = new Date().toISOString();

  if (existente) {
    updateRowInSheet(
      controlId,
      USUARIOS_SHEET,
      USUARIOS_HEADERS,
      existente._rowNumber,
      Object.assign({}, existente, {
        telegram_user_id: datos.telegramUserId || existente.telegram_user_id,
        username: datos.username || existente.username,
        estado: "activo",
        ultima_actividad: ahora,
      }),
    );
    return;
  }

  appendRowToSheet(controlId, USUARIOS_SHEET, USUARIOS_HEADERS, {
    telegram_chat_id: String(chatId),
    telegram_user_id: datos.telegramUserId || "",
    nombre: datos.nombre || "",
    username: datos.username || "",
    estado: "activo",
    primer_registro: ahora,
    ultima_actividad: ahora,
  });
}

function getUsuariosActivos() {
  var controlId = getControlSheetId();
  var filas = getAllRows(controlId, USUARIOS_SHEET, USUARIOS_HEADERS);
  return filas.filter(function (f) {
    return f.estado === "activo";
  });
}
