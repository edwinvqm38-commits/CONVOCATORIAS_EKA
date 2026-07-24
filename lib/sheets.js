const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let sheetsClientPromise = null;

function loadServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("Falta la variable GOOGLE_SERVICE_ACCOUNT_JSON");
  }
  // Acepta el JSON tal cual, o en base64 (util para pegarlo como un solo
  // secreto de linea sin problemas de saltos de linea en la private_key).
  const looksLikeJson = raw.trim().startsWith("{");
  const jsonText = looksLikeJson ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(jsonText);
}

async function getSheetsClient() {
  if (!sheetsClientPromise) {
    const credentials = loadServiceAccountCredentials();
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: SCOPES,
    });
    sheetsClientPromise = auth.authorize().then(() => google.sheets({ version: "v4", auth }));
  }
  return sheetsClientPromise;
}

function columnLetter(indexZeroBased) {
  let index = indexZeroBased;
  let letter = "";
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

/** Crea la hoja (tab) si no existe, y escribe el encabezado en la fila 1 si esta vacia. */
async function ensureSheetWithHeaders(spreadsheetId, sheetName, headers) {
  const sheets = await getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existe = (meta.data.sheets || []).some((s) => s.properties.title === sheetName);

  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
  }

  const lastCol = columnLetter(headers.length - 1);
  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:${lastCol}1`,
  });

  if (!current.data.values || current.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${lastCol}1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

/** Lee todas las filas de datos (sin el encabezado) como objetos {columna: valor}. */
async function getAllRows(spreadsheetId, sheetName, headers) {
  const sheets = await getSheetsClient();
  const lastCol = columnLetter(headers.length - 1);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:${lastCol}`,
  });

  const values = response.data.values || [];
  return values.map((row, index) => {
    const obj = { _rowNumber: index + 2 };
    headers.forEach((header, i) => {
      obj[header] = row[i] ?? "";
    });
    return obj;
  });
}

async function appendRow(spreadsheetId, sheetName, headers, rowObject) {
  const sheets = await getSheetsClient();
  const values = [headers.map((header) => rowObject[header] ?? "")];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

async function updateRow(spreadsheetId, sheetName, headers, rowNumber, rowObject) {
  const sheets = await getSheetsClient();
  const lastCol = columnLetter(headers.length - 1);
  const values = [headers.map((header) => rowObject[header] ?? "")];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}:${lastCol}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
}

async function deleteRow(spreadsheetId, sheetName, rowNumber) {
  const sheets = await getSheetsClient();
  const lastCol = columnLetter(20);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A${rowNumber}:${lastCol}${rowNumber}`,
  });
}

/** Busca la primera fila que cumpla predicate(row); null si no existe. */
async function findRow(spreadsheetId, sheetName, headers, predicate) {
  const rows = await getAllRows(spreadsheetId, sheetName, headers);
  return rows.find(predicate) ?? null;
}

/** Actualiza la fila si predicate encuentra una, o la agrega si no existe. */
async function upsertRow(spreadsheetId, sheetName, headers, predicate, rowObject) {
  const existente = await findRow(spreadsheetId, sheetName, headers, predicate);
  if (existente) {
    await updateRow(spreadsheetId, sheetName, headers, existente._rowNumber, {
      ...existente,
      ...rowObject,
    });
  } else {
    await appendRow(spreadsheetId, sheetName, headers, rowObject);
  }
}

async function getSpreadsheetTitle(spreadsheetId) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title" });
  return meta.data.properties.title;
}

/** Acepta una URL completa de Google Sheets o un ID pelado, y devuelve el ID. */
function extraerSpreadsheetId(valor) {
  const texto = (valor || "").trim();
  const match = texto.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : texto;
}

module.exports = {
  getSheetsClient,
  ensureSheetWithHeaders,
  getAllRows,
  appendRow,
  updateRow,
  deleteRow,
  findRow,
  upsertRow,
  getSpreadsheetTitle,
  extraerSpreadsheetId,
  columnLetter,
};
