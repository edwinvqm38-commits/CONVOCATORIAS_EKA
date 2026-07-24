// Da formato "profesional" a la hoja Respuestas: encabezado resaltado,
// especialidad como lista desplegable con colores, y disponibilidad
// coloreada segun la respuesta. Se vuelve a aplicar cada vez que cambia la
// hoja activa (/hoja) o se agrega una especialidad nueva, para que el
// desplegable y los colores queden al dia.

var COLORES_ESPECIALIDAD = [
  "#D9EAD3",
  "#FCE5CD",
  "#CFE2F3",
  "#F4CCCC",
  "#EAD1DC",
  "#FFF2CC",
  "#D0E0E3",
  "#EAD8FF",
  "#D9D2E9",
  "#FFE599",
];

var COLOR_RESPUESTA = {
  disponible: "#B6D7A8",
  no_disponible: "#EA9999",
  posiblemente: "#FFE599",
};

var FILAS_FORMATO = 500;

function aplicarFormatoProfesional(spreadsheetId) {
  var sheet = ensureSheetWithHeaders(spreadsheetId, RESPUESTAS_SHEET, RESPUESTAS_HEADERS);

  sheet
    .getRange(1, 1, 1, RESPUESTAS_HEADERS.length)
    .setFontWeight("bold")
    .setBackground("#434343")
    .setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  try {
    sheet.autoResizeColumns(1, RESPUESTAS_HEADERS.length);
  } catch (error) {
    // autoResizeColumns falla si la hoja no tiene columnas suficientes; se
    // ignora, no es critico para el funcionamiento del bot.
  }

  var colEspecialidad = RESPUESTAS_HEADERS.indexOf("especialidad") + 1;
  var colRespuesta = RESPUESTAS_HEADERS.indexOf("respuesta") + 1;
  var especialidades = getEspecialidades();

  var rangoEspecialidad = sheet.getRange(2, colEspecialidad, FILAS_FORMATO, 1);
  var reglaValidacion = SpreadsheetApp.newDataValidation()
    .requireValueInList(especialidades, true)
    .setAllowInvalid(true)
    .build();
  rangoEspecialidad.setDataValidation(reglaValidacion);

  var rangoRespuesta = sheet.getRange(2, colRespuesta, FILAS_FORMATO, 1);
  var reglas = [];

  especialidades.forEach(function (nombre, indice) {
    reglas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(nombre)
        .setBackground(COLORES_ESPECIALIDAD[indice % COLORES_ESPECIALIDAD.length])
        .setRanges([rangoEspecialidad])
        .build(),
    );
  });

  Object.keys(COLOR_RESPUESTA).forEach(function (valor) {
    reglas.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(valor)
        .setBackground(COLOR_RESPUESTA[valor])
        .setRanges([rangoRespuesta])
        .build(),
    );
  });

  sheet.setConditionalFormatRules(reglas);
}

/** Convierte un numero de telefono en una formula HYPERLINK que abre un
 * chat de WhatsApp (wa.me) al hacer click/tap. Si el numero tiene 9 digitos
 * (celular peruano sin codigo de pais) se le antepone 51; si ya trae mas
 * digitos se asume que el codigo de pais ya viene incluido. Los enlaces
 * "tel:" no son clickeables de forma confiable en Google Sheets, por eso se
 * usa WhatsApp como via principal para llamar o escribir. */
function construirLinkWhatsApp(numeroTexto) {
  var soloDigitos = String(numeroTexto || "").replace(/\D/g, "");
  if (!soloDigitos) return numeroTexto;

  var conCodigoPais = soloDigitos.length === 9 ? "51" + soloDigitos : soloDigitos;
  var etiqueta = String(numeroTexto).replace(/"/g, "").trim();

  return '=HYPERLINK("https://wa.me/' + conCodigoPais + '","📱 ' + etiqueta + '")';
}
