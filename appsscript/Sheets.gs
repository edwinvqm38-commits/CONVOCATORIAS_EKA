// Envoltura simple sobre SpreadsheetApp para tratar cada hoja (tab) como una
// tabla: encabezado en la fila 1, una fila por registro. No necesita
// credenciales aparte: Apps Script usa la cuenta de Google que desplegó el
// proyecto, la misma que debe tener acceso de editor a los Sheets usados.

function ensureSheetWithHeaders(spreadsheetId, sheetName, headers) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var primeraFila = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var vacia = primeraFila.every(function (valor) {
    return valor === "" || valor === null;
  });

  if (vacia) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function getAllRows(spreadsheetId, sheetName, headers) {
  var sheet = ensureSheetWithHeaders(spreadsheetId, sheetName, headers);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var valores = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return valores.map(function (fila, indice) {
    var objeto = { _rowNumber: indice + 2 };
    headers.forEach(function (header, i) {
      objeto[header] = fila[i];
    });
    return objeto;
  });
}

function appendRowToSheet(spreadsheetId, sheetName, headers, rowObject) {
  var sheet = ensureSheetWithHeaders(spreadsheetId, sheetName, headers);
  var valores = headers.map(function (h) {
    return rowObject[h] !== undefined ? rowObject[h] : "";
  });
  sheet.appendRow(valores);
}

function updateRowInSheet(spreadsheetId, sheetName, headers, rowNumber, rowObject) {
  var sheet = ensureSheetWithHeaders(spreadsheetId, sheetName, headers);
  var valores = headers.map(function (h) {
    return rowObject[h] !== undefined ? rowObject[h] : "";
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([valores]);
}

/** Actualiza solo las columnas presentes en partialObject, sin tocar el
 * resto de la fila. A diferencia de updateRowInSheet (que reescribe toda la
 * fila), esto no rompe formulas (ej. el link de WhatsApp en "telefono") que
 * ya estén en otras columnas de esa misma fila. */
function updateRowFields(spreadsheetId, sheetName, headers, rowNumber, partialObject) {
  var sheet = ensureSheetWithHeaders(spreadsheetId, sheetName, headers);
  Object.keys(partialObject).forEach(function (clave) {
    var colIndex = headers.indexOf(clave);
    if (colIndex === -1) return;
    sheet.getRange(rowNumber, colIndex + 1).setValue(partialObject[clave]);
  });
}

function deleteRowInSheet(spreadsheetId, sheetName, rowNumber) {
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
  if (sheet && rowNumber <= sheet.getLastRow()) {
    sheet.deleteRow(rowNumber);
  }
}

function findRow(spreadsheetId, sheetName, headers, predicateFn) {
  var filas = getAllRows(spreadsheetId, sheetName, headers);
  for (var i = 0; i < filas.length; i++) {
    if (predicateFn(filas[i])) return filas[i];
  }
  return null;
}

function upsertRow(spreadsheetId, sheetName, headers, predicateFn, rowObject) {
  var existente = findRow(spreadsheetId, sheetName, headers, predicateFn);
  if (existente) {
    updateRowFields(spreadsheetId, sheetName, headers, existente._rowNumber, rowObject);
  } else {
    appendRowToSheet(spreadsheetId, sheetName, headers, rowObject);
  }
}

function getSpreadsheetTitleById(spreadsheetId) {
  return SpreadsheetApp.openById(spreadsheetId).getName();
}

/** Acepta una URL completa de Google Sheets o un ID pelado, y devuelve el ID. */
function extraerSpreadsheetId(valor) {
  var texto = (valor || "").trim();
  var match = texto.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : texto;
}
