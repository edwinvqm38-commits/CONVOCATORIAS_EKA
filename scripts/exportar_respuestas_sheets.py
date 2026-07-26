"""Exporta la vista `convocatoria_respuestas_export_v` (Supabase) a una
pestaña de Google Sheets, con el telefono como link de WhatsApp y el CV como
link a Drive, ambos clickeables.

Independiente del bot: solo lee de Supabase (via REST/PostgREST, con la
service_role key) y escribe con una cuenta de servicio de Google en Sheets.
Cada corrida reemplaza el contenido completo de la pestaña con una foto
actual de las respuestas (evita filas duplicadas/desactualizadas).

Uso:
    python scripts/exportar_respuestas_sheets.py
    python scripts/exportar_respuestas_sheets.py --convocatoria-id <uuid>
    python scripts/exportar_respuestas_sheets.py --spreadsheet-id <id> --sheet-name Respuestas
"""

import argparse
import base64
import json
import os

import requests
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

HEADERS = [
    "Convocatoria",
    "Planta",
    "Fecha servicio",
    "Nombres completos",
    "DNI",
    "Telefono",
    "Lugar de residencia",
    "Especialidad",
    "Experiencia",
    "CV",
    "Respuesta",
    "Respondido",
]

ETIQUETAS_RESPUESTA = {
    "disponible": "✅ Disponible",
    "no_disponible": "❌ No disponible",
    "posiblemente": "🤔 Posiblemente",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Exporta convocatoria_respuestas_export_v (Supabase) a Google Sheets."
    )
    parser.add_argument(
        "--spreadsheet-id",
        default=os.getenv("GOOGLE_SHEETS_EXPORT_ID"),
        help="ID del Google Sheet destino (o variable GOOGLE_SHEETS_EXPORT_ID).",
    )
    parser.add_argument("--sheet-name", default="Respuestas", help="Nombre de la pestana destino.")
    parser.add_argument(
        "--convocatoria-id",
        default=None,
        help="Si se indica, exporta solo las respuestas de esa convocatoria.",
    )
    return parser.parse_args()


def _load_service_account_info() -> dict:
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise SystemExit("Falta la variable GOOGLE_SERVICE_ACCOUNT_JSON")

    raw = raw.strip()
    if raw.startswith("{"):
        return json.loads(raw)
    return json.loads(base64.b64decode(raw).decode("utf-8"))


def get_sheets_service():
    creds = Credentials.from_service_account_info(_load_service_account_info(), scopes=SHEETS_SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def obtener_respuestas(convocatoria_id: str | None) -> list[dict]:
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise SystemExit("Faltan las variables SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY")

    params = {"select": "*"}
    if convocatoria_id:
        params["convocatoria_id"] = f"eq.{convocatoria_id}"

    respuesta = requests.get(
        f"{supabase_url.rstrip('/')}/rest/v1/convocatoria_respuestas_export_v",
        params=params,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        },
        timeout=30,
    )
    respuesta.raise_for_status()
    return respuesta.json()


def link_whatsapp(numero: str | None) -> str:
    """Numeros de 9 digitos se asumen celulares peruanos (se les antepone
    51); si ya traen mas digitos se asume que el codigo de pais ya viene
    incluido. Misma regla que usa linkWhatsApp() en la Edge Function."""
    if not numero:
        return ""
    solo_digitos = "".join(c for c in numero if c.isdigit())
    if not solo_digitos:
        return numero
    con_codigo_pais = "51" + solo_digitos if len(solo_digitos) == 9 else solo_digitos
    etiqueta = numero.replace('"', "").strip()
    return f'=HYPERLINK("https://wa.me/{con_codigo_pais}","📱 {etiqueta}")'


def link_cv(url: str | None) -> str:
    if not url:
        return ""
    return f'=HYPERLINK("{url}","📎 Ver CV")'


def fila_a_row(fila: dict) -> list[str]:
    return [
        fila.get("convocatoria_titulo") or "",
        fila.get("planta") or "",
        fila.get("fecha_servicio") or "",
        fila.get("nombres_completos") or "",
        fila.get("dni") or "",
        link_whatsapp(fila.get("telefono")),
        fila.get("lugar_residencia") or "",
        fila.get("especialidad") or "",
        fila.get("experiencia_texto") or "",
        link_cv(fila.get("cv_drive_url")),
        ETIQUETAS_RESPUESTA.get(fila.get("respuesta"), fila.get("respuesta") or ""),
        fila.get("respondido_at") or "",
    ]


def ensure_sheet(service, spreadsheet_id: str, sheet_name: str) -> None:
    meta = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    existe = any(s["properties"]["title"] == sheet_name for s in meta.get("sheets", []))
    if not existe:
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": [{"addSheet": {"properties": {"title": sheet_name}}}]},
        ).execute()


def main():
    load_dotenv()
    args = parse_args()
    if not args.spreadsheet_id:
        raise SystemExit("Falta --spreadsheet-id (o la variable GOOGLE_SHEETS_EXPORT_ID)")

    filas = obtener_respuestas(args.convocatoria_id)
    valores = [HEADERS] + [fila_a_row(fila) for fila in filas]

    service = get_sheets_service()
    ensure_sheet(service, args.spreadsheet_id, args.sheet_name)

    service.spreadsheets().values().clear(
        spreadsheetId=args.spreadsheet_id,
        range=args.sheet_name,
    ).execute()

    service.spreadsheets().values().update(
        spreadsheetId=args.spreadsheet_id,
        range=f"{args.sheet_name}!A1",
        valueInputOption="USER_ENTERED",
        body={"values": valores},
    ).execute()

    print(f"Exportadas {len(filas)} respuesta(s) a la pestaña '{args.sheet_name}'.")


if __name__ == "__main__":
    main()
