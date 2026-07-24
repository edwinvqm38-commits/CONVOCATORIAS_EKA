import os

from agents import schema
from agents.sheets_client import SheetTable, get_spreadsheet_title


def get_control_sheet_id() -> str:
    sheet_id = os.getenv("GOOGLE_SHEETS_CONTROL_ID")
    if not sheet_id:
        raise ValueError("Falta la variable GOOGLE_SHEETS_CONTROL_ID")
    return sheet_id


def get_active_sheet_id(service) -> str:
    control_id = get_control_sheet_id()
    config = SheetTable(service, control_id, schema.CONFIG_SHEET, schema.CONFIG_HEADERS)
    config.ensure()

    fila = config.find_row(lambda row: row["clave"] == "hoja_actual_id")
    active_id = fila["valor"] if fila and fila.get("valor") else control_id

    for sheet_name, headers in (
        (schema.CONVOCATORIAS_SHEET, schema.CONVOCATORIAS_HEADERS),
        (schema.RESPUESTAS_SHEET, schema.RESPUESTAS_HEADERS),
    ):
        SheetTable(service, active_id, sheet_name, headers).ensure()

    return active_id


def set_active_sheet(service, spreadsheet_id: str) -> str:
    control_id = get_control_sheet_id()
    config = SheetTable(service, control_id, schema.CONFIG_SHEET, schema.CONFIG_HEADERS)
    config.ensure()

    titulo = get_spreadsheet_title(service, spreadsheet_id)
    config.upsert_row(lambda row: row["clave"] == "hoja_actual_id", {"clave": "hoja_actual_id", "valor": spreadsheet_id})
    config.upsert_row(
        lambda row: row["clave"] == "hoja_actual_nombre", {"clave": "hoja_actual_nombre", "valor": titulo}
    )
    return titulo


def get_usuarios_activos(service) -> list[dict]:
    control_id = get_control_sheet_id()
    tabla = SheetTable(service, control_id, schema.USUARIOS_SHEET, schema.USUARIOS_HEADERS)
    tabla.ensure()
    return [fila for fila in tabla.get_all_rows() if fila.get("estado") == "activo"]
