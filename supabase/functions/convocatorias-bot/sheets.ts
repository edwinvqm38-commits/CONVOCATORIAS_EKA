// Sincroniza cada respuesta de Telegram a una pestaña por convocatoria en un
// Google Sheet, para que los reclutadores trabajen ahí sin pisarse con el
// bot. Reglas que evitan el problema de "se corrió una fila":
//
// - Cada fila tiene en la columna A (oculta) el id de convocatoria_respuestas.
//   El upsert busca por ese id, nunca por posición: si ya existe, reescribe
//   solo las columnas del sistema (A..N); si no existe, agrega una fila al
//   final. Nunca se ordena ni se inserta en medio del rango.
// - Las columnas del sistema quedan protegidas (editables solo por esta
//   cuenta de servicio) para que los reclutadores no las toquen sin querer.
//   Ellos trabajan libremente en las columnas a la derecha de la última.
//
// Usa una cuenta de servicio de Google (no la sesión de ningún usuario), vía
// el flujo JWT-bearer de OAuth2: no depende de refresh tokens ni de que
// nadie vuelva a autorizar nada.

const GOOGLE_SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ?? "";
const GOOGLE_SHEETS_RECLUTAMIENTO_ID = Deno.env.get("GOOGLE_SHEETS_RECLUTAMIENTO_ID") ?? "";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// Columnas que llena y mantiene el bot. La primera es la llave estable de la
// fila (no se muestra a los reclutadores, se puede ocultar la columna A a
// mano en el Sheet). Todo lo que agreguen los reclutadores debe ir en
// columnas después de la última de esta lista.
export const SISTEMA_HEADERS = [
  "respuesta_id",
  "nombres_completos",
  "dni",
  "telefono",
  "lugar_residencia",
  "especialidad",
  "experiencia_texto",
  "cv_drive_url",
  "respuesta",
  "estado_plazo",
  "respondido_en",
  "telegram_chat_id",
  "nombre_telegram",
  "username",
];

type Convocatoria = {
  titulo: string;
  fecha_servicio: string;
  fecha_limite_respuesta: string | null;
};

type Respuesta = Record<string, unknown> & {
  id: string;
  respondido_at: string | null;
};

let tokenEnCache: { token: string; expiraEn: number } | null = null;

function base64url(datos: ArrayBuffer | string): string {
  const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : new Uint8Array(datos);
  let binario = "";
  bytes.forEach((b) => (binario += String.fromCharCode(b)));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function parseServiceAccount(): { client_email: string; private_key: string } {
  const raw = GOOGLE_SERVICE_ACCOUNT_JSON.trim();
  const json = raw.startsWith("{") ? raw : atob(raw);
  return JSON.parse(json);
}

async function importarLlavePrivada(pem: string): Promise<CryptoKey> {
  const limpio = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(
    /\s+/g,
    "",
  );
  const derBinario = Uint8Array.from(atob(limpio), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", derBinario, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

async function obtenerAccessToken(): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (tokenEnCache && tokenEnCache.expiraEn - 60 > ahora) return tokenEnCache.token;

  const cuenta = parseServiceAccount();
  const encabezado = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: cuenta.client_email,
      scope: SHEETS_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    }),
  );
  const sinFirmar = `${encabezado}.${claims}`;

  const llave = await importarLlavePrivada(cuenta.private_key);
  const firma = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    llave,
    new TextEncoder().encode(sinFirmar),
  );
  const jwt = `${sinFirmar}.${base64url(firma)}`;

  const respuesta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const datos = await respuesta.json();
  if (!datos.access_token) {
    throw new Error("No se pudo obtener token de Google Sheets: " + JSON.stringify(datos));
  }

  tokenEnCache = { token: datos.access_token, expiraEn: ahora + (datos.expires_in ?? 3600) };
  return datos.access_token;
}

async function sheetsFetch(path: string, init: RequestInit = {}) {
  const token = await obtenerAccessToken();
  const respuesta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_RECLUTAMIENTO_ID}${path}`,
    { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
  );
  if (!respuesta.ok) {
    throw new Error(`Sheets API error (${respuesta.status}): ${await respuesta.text()}`);
  }
  return respuesta.status === 204 ? null : await respuesta.json();
}

function columnLetter(indice: number): string {
  let letra = "";
  let i = indice;
  while (i >= 0) {
    letra = String.fromCharCode((i % 26) + 65) + letra;
    i = Math.floor(i / 26) - 1;
  }
  return letra;
}

const ULTIMA_COLUMNA = columnLetter(SISTEMA_HEADERS.length - 1);

function nombrePestana(convocatoria: Convocatoria): string {
  // Nombres de pestaña en Sheets no admiten : / ? * [ ] y tienen tope de 100 caracteres.
  return `${convocatoria.titulo} - ${convocatoria.fecha_servicio}`.replace(/[:\/?*\[\]]/g, "-").slice(0, 95);
}

async function obtenerSheetIdPorNombre(nombre: string): Promise<number | null> {
  const meta = await sheetsFetch("?fields=sheets.properties");
  const hoja = (meta.sheets ?? []).find((s: { properties: { title: string; sheetId: number } }) =>
    s.properties.title === nombre
  );
  return hoja ? hoja.properties.sheetId : null;
}

async function crearPestana(nombre: string): Promise<number> {
  const resultado = await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: nombre } } }] }),
  });
  return resultado.replies[0].addSheet.properties.sheetId;
}

async function escribirEncabezadoYProteger(nombre: string, sheetId: number, clienteEmail: string) {
  await sheetsFetch(`/values/${encodeURIComponent(nombre)}!A1:${ULTIMA_COLUMNA}1?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [SISTEMA_HEADERS] }),
  });

  await sheetsFetch(":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          addProtectedRange: {
            protectedRange: {
              range: { sheetId, startColumnIndex: 0, endColumnIndex: SISTEMA_HEADERS.length },
              description: "Columnas del bot (Convocatorias EKA) - no editar a mano",
              warningOnly: false,
              editors: { users: [clienteEmail] },
            },
          },
        },
      ],
    }),
  });
}

async function buscarNumeroDeFilaPorId(nombre: string, respuestaId: string): Promise<number | null> {
  const datos = await sheetsFetch(`/values/${encodeURIComponent(nombre)}!A2:A`);
  const valores: string[][] = datos.values ?? [];
  const indice = valores.findIndex((fila) => fila[0] === respuestaId);
  return indice === -1 ? null : indice + 2;
}

function calcularEstadoPlazo(convocatoria: Convocatoria, respondidoAt: string | null): string {
  if (!convocatoria.fecha_limite_respuesta || !respondidoAt) return "";
  const limite = new Date(convocatoria.fecha_limite_respuesta);
  const respondio = new Date(respondidoAt);
  if (respondio <= limite) return "A tiempo";
  const fecha = respondio.toLocaleDateString("es-PE", { timeZone: "America/Lima" });
  return `⚠️ Fuera de fecha (respondió ${fecha})`;
}

/** Crea (si hace falta) la pestaña de la convocatoria y agrega/actualiza la
 * fila de esta respuesta, siempre por id, sin tocar columnas de reclutadores.
 * No lanza al llamador: un problema con Sheets no debe romper el flujo del
 * bot con el usuario en Telegram. */
export async function sincronizarRespuestaConSheet(convocatoria: Convocatoria, respuesta: Respuesta): Promise<void> {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON || !GOOGLE_SHEETS_RECLUTAMIENTO_ID) return;

  try {
    const nombre = nombrePestana(convocatoria);
    let sheetId = await obtenerSheetIdPorNombre(nombre);
    if (sheetId === null) {
      sheetId = await crearPestana(nombre);
      const cuenta = parseServiceAccount();
      await escribirEncabezadoYProteger(nombre, sheetId, cuenta.client_email);
    }

    const fila = SISTEMA_HEADERS.map((header) => {
      if (header === "respuesta_id") return respuesta.id;
      if (header === "estado_plazo") return calcularEstadoPlazo(convocatoria, respuesta.respondido_at);
      const valor = respuesta[header];
      return valor === null || valor === undefined ? "" : String(valor);
    });

    const numeroFila = await buscarNumeroDeFilaPorId(nombre, respuesta.id);
    if (numeroFila) {
      await sheetsFetch(
        `/values/${encodeURIComponent(nombre)}!A${numeroFila}:${ULTIMA_COLUMNA}${numeroFila}?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: [fila] }) },
      );
    } else {
      await sheetsFetch(
        `/values/${encodeURIComponent(`${nombre}!A:A`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: "POST", body: JSON.stringify({ values: [fila] }) },
      );
    }
  } catch (error) {
    console.error("SHEETS_SYNC_ERROR:", error);
  }
}
