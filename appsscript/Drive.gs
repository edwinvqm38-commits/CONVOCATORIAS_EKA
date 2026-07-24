// Descarga un archivo de Telegram (por file_id) y lo guarda en Drive. No
// necesita credenciales aparte de las que ya usa el proyecto de Apps Script.

function descargarArchivoTelegram(fileId) {
  var token = getScriptProp("TELEGRAM_BOT_TOKEN");

  var infoResp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + token + "/getFile?file_id=" + encodeURIComponent(fileId),
    { muteHttpExceptions: true },
  );
  var info = JSON.parse(infoResp.getContentText());

  if (!info.ok) {
    throw new Error("No se pudo obtener el archivo de Telegram: " + infoResp.getContentText());
  }

  var filePath = info.result.file_path;
  var fileResp = UrlFetchApp.fetch(
    "https://api.telegram.org/file/bot" + token + "/" + filePath,
    { muteHttpExceptions: true },
  );

  return { blob: fileResp.getBlob(), filePath: filePath };
}

function obtenerCarpetaCvs() {
  var folderId = getScriptProp("GOOGLE_DRIVE_CV_FOLDER_ID");
  if (folderId) {
    return DriveApp.getFolderById(folderId);
  }

  var nombre = "Convocatorias EKA - CVs";
  var carpetas = DriveApp.getFoldersByName(nombre);
  if (carpetas.hasNext()) return carpetas.next();
  return DriveApp.createFolder(nombre);
}

/** Descarga el CV enviado por Telegram (message.document) y lo guarda en
 * Drive con un nombre legible. Devuelve la URL del archivo en Drive. */
function guardarCvEnDrive(fileId, nombreSugerido, nombreOriginal) {
  var descarga = descargarArchivoTelegram(fileId);
  var extension = (nombreOriginal || descarga.filePath).split(".").pop();
  var nombreArchivo = (nombreSugerido || "CV") + "." + extension;

  var blob = descarga.blob.setName(nombreArchivo);
  var carpeta = obtenerCarpetaCvs();
  var archivo = carpeta.createFile(blob);

  return archivo.getUrl();
}
