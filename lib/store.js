const sheetsLib = require("./sheets");
const schema = require("./schema");

function getControlSheetId() {
  const id = process.env.GOOGLE_SHEETS_CONTROL_ID;
  if (!id) throw new Error("Falta la variable GOOGLE_SHEETS_CONTROL_ID");
  return id;
}

function isAdmin(chatId) {
  const admins = (process.env.ADMIN_CHAT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return admins.includes(String(chatId));
}

async function ensureControlSheets() {
  const controlId = getControlSheetId();
  await sheetsLib.ensureSheetWithHeaders(controlId, schema.CONFIG_SHEET, schema.CONFIG_HEADERS);
  await sheetsLib.ensureSheetWithHeaders(
    controlId,
    schema.ESPECIALIDADES_SHEET,
    schema.ESPECIALIDADES_HEADERS,
  );
  await sheetsLib.ensureSheetWithHeaders(controlId, schema.SESIONES_SHEET, schema.SESIONES_HEADERS);
  await sheetsLib.ensureSheetWithHeaders(controlId, schema.USUARIOS_SHEET, schema.USUARIOS_HEADERS);
}

async function ensureTargetSheets(spreadsheetId) {
  await sheetsLib.ensureSheetWithHeaders(
    spreadsheetId,
    schema.CONVOCATORIAS_SHEET,
    schema.CONVOCATORIAS_HEADERS,
  );
  await sheetsLib.ensureSheetWithHeaders(
    spreadsheetId,
    schema.RESPUESTAS_SHEET,
    schema.RESPUESTAS_HEADERS,
  );
}

async function getActiveSheetId() {
  const controlId = getControlSheetId();
  const fila = await sheetsLib.findRow(
    controlId,
    schema.CONFIG_SHEET,
    schema.CONFIG_HEADERS,
    (row) => row.clave === "hoja_actual_id",
  );
  const activeId = fila && fila.valor ? fila.valor : controlId;
  await ensureTargetSheets(activeId);
  return activeId;
}

async function setActiveSheet(spreadsheetId, nombre) {
  const controlId = getControlSheetId();
  await sheetsLib.upsertRow(
    controlId,
    schema.CONFIG_SHEET,
    schema.CONFIG_HEADERS,
    (row) => row.clave === "hoja_actual_id",
    { clave: "hoja_actual_id", valor: spreadsheetId },
  );
  await sheetsLib.upsertRow(
    controlId,
    schema.CONFIG_SHEET,
    schema.CONFIG_HEADERS,
    (row) => row.clave === "hoja_actual_nombre",
    { clave: "hoja_actual_nombre", valor: nombre },
  );
}

async function getEspecialidades() {
  const controlId = getControlSheetId();
  const filas = await sheetsLib.getAllRows(
    controlId,
    schema.ESPECIALIDADES_SHEET,
    schema.ESPECIALIDADES_HEADERS,
  );

  if (filas.length === 0) {
    for (const nombre of schema.ESPECIALIDADES_INICIALES) {
      await sheetsLib.appendRow(controlId, schema.ESPECIALIDADES_SHEET, schema.ESPECIALIDADES_HEADERS, {
        nombre,
      });
    }
    return schema.ESPECIALIDADES_INICIALES;
  }

  return filas.map((f) => f.nombre).filter(Boolean);
}

async function addEspecialidad(nombre) {
  const controlId = getControlSheetId();
  const existentes = await getEspecialidades();
  if (existentes.some((e) => e.toLowerCase() === nombre.toLowerCase())) {
    return false;
  }
  await sheetsLib.appendRow(controlId, schema.ESPECIALIDADES_SHEET, schema.ESPECIALIDADES_HEADERS, {
    nombre,
  });
  return true;
}

async function getSession(chatId) {
  const controlId = getControlSheetId();
  const fila = await sheetsLib.findRow(
    controlId,
    schema.SESIONES_SHEET,
    schema.SESIONES_HEADERS,
    (row) => row.telegram_chat_id === String(chatId),
  );
  if (!fila) return null;

  let datos = {};
  try {
    datos = JSON.parse(fila.datos_json || "{}");
  } catch (_error) {
    datos = {};
  }

  return { paso: fila.paso, datos, _rowNumber: fila._rowNumber };
}

async function saveSession(chatId, paso, datos) {
  const controlId = getControlSheetId();
  await sheetsLib.upsertRow(
    controlId,
    schema.SESIONES_SHEET,
    schema.SESIONES_HEADERS,
    (row) => row.telegram_chat_id === String(chatId),
    {
      telegram_chat_id: String(chatId),
      paso,
      datos_json: JSON.stringify(datos || {}),
      actualizado_en: new Date().toISOString(),
    },
  );
}

async function deleteSession(chatId) {
  const controlId = getControlSheetId();
  const fila = await sheetsLib.findRow(
    controlId,
    schema.SESIONES_SHEET,
    schema.SESIONES_HEADERS,
    (row) => row.telegram_chat_id === String(chatId),
  );
  if (fila) {
    await sheetsLib.deleteRow(controlId, schema.SESIONES_SHEET, fila._rowNumber);
  }
}

async function upsertUsuario(chatId, { telegramUserId, nombre, username }) {
  const controlId = getControlSheetId();
  const existente = await sheetsLib.findRow(
    controlId,
    schema.USUARIOS_SHEET,
    schema.USUARIOS_HEADERS,
    (row) => row.telegram_chat_id === String(chatId),
  );

  const ahora = new Date().toISOString();

  if (existente) {
    await sheetsLib.updateRow(controlId, schema.USUARIOS_SHEET, schema.USUARIOS_HEADERS, existente._rowNumber, {
      ...existente,
      telegram_user_id: telegramUserId ?? existente.telegram_user_id,
      username: username ?? existente.username,
      estado: "activo",
      ultima_actividad: ahora,
    });
    return;
  }

  await sheetsLib.appendRow(controlId, schema.USUARIOS_SHEET, schema.USUARIOS_HEADERS, {
    telegram_chat_id: String(chatId),
    telegram_user_id: telegramUserId ?? "",
    nombre: nombre ?? "",
    username: username ?? "",
    estado: "activo",
    primer_registro: ahora,
    ultima_actividad: ahora,
  });
}

async function getUsuariosActivos() {
  const controlId = getControlSheetId();
  const filas = await sheetsLib.getAllRows(controlId, schema.USUARIOS_SHEET, schema.USUARIOS_HEADERS);
  return filas.filter((f) => f.estado === "activo");
}

module.exports = {
  getControlSheetId,
  isAdmin,
  ensureControlSheets,
  ensureTargetSheets,
  getActiveSheetId,
  setActiveSheet,
  getEspecialidades,
  addEspecialidad,
  getSession,
  saveSession,
  deleteSession,
  upsertUsuario,
  getUsuariosActivos,
};
