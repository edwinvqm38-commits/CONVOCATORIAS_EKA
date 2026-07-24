import base64
import json
import os

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]


def _load_credentials_info() -> dict:
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise ValueError("Falta la variable GOOGLE_SERVICE_ACCOUNT_JSON")

    raw = raw.strip()
    if raw.startswith("{"):
        return json.loads(raw)
    return json.loads(base64.b64decode(raw).decode("utf-8"))


def get_sheets_service():
    info = _load_credentials_info()
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def column_letter(index: int) -> str:
    letter = ""
    while index >= 0:
        letter = chr(index % 26 + 65) + letter
        index = index // 26 - 1
    return letter


class SheetTable:
    """Envoltura simple sobre la API de Sheets para tratar una hoja (tab)
    como una tabla: encabezado en la fila 1, una fila por registro."""

    def __init__(self, service, spreadsheet_id: str, sheet_name: str, headers: list[str]):
        self.service = service
        self.spreadsheet_id = spreadsheet_id
        self.sheet_name = sheet_name
        self.headers = headers

    def _last_col(self) -> str:
        return column_letter(len(self.headers) - 1)

    def ensure(self) -> None:
        meta = self.service.spreadsheets().get(spreadsheetId=self.spreadsheet_id).execute()
        existe = any(s["properties"]["title"] == self.sheet_name for s in meta.get("sheets", []))

        if not existe:
            self.service.spreadsheets().batchUpdate(
                spreadsheetId=self.spreadsheet_id,
                body={"requests": [{"addSheet": {"properties": {"title": self.sheet_name}}}]},
            ).execute()

        rango = f"{self.sheet_name}!A1:{self._last_col()}1"
        actual = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=self.spreadsheet_id, range=rango)
            .execute()
        )

        if not actual.get("values"):
            self.service.spreadsheets().values().update(
                spreadsheetId=self.spreadsheet_id,
                range=rango,
                valueInputOption="RAW",
                body={"values": [self.headers]},
            ).execute()

    def get_all_rows(self) -> list[dict]:
        rango = f"{self.sheet_name}!A2:{self._last_col()}"
        respuesta = (
            self.service.spreadsheets()
            .values()
            .get(spreadsheetId=self.spreadsheet_id, range=rango)
            .execute()
        )
        valores = respuesta.get("values", [])
        filas = []
        for indice, fila in enumerate(valores):
            objeto = {"_row_number": indice + 2}
            for i, header in enumerate(self.headers):
                objeto[header] = fila[i] if i < len(fila) else ""
            filas.append(objeto)
        return filas

    def append_row(self, row: dict) -> None:
        valores = [[row.get(h, "") for h in self.headers]]
        self.service.spreadsheets().values().append(
            spreadsheetId=self.spreadsheet_id,
            range=f"{self.sheet_name}!A:A",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": valores},
        ).execute()

    def update_row(self, row_number: int, row: dict) -> None:
        valores = [[row.get(h, "") for h in self.headers]]
        rango = f"{self.sheet_name}!A{row_number}:{self._last_col()}{row_number}"
        self.service.spreadsheets().values().update(
            spreadsheetId=self.spreadsheet_id,
            range=rango,
            valueInputOption="RAW",
            body={"values": valores},
        ).execute()

    def find_row(self, predicate) -> dict | None:
        for fila in self.get_all_rows():
            if predicate(fila):
                return fila
        return None

    def upsert_row(self, predicate, row: dict) -> None:
        existente = self.find_row(predicate)
        if existente:
            self.update_row(existente["_row_number"], {**existente, **row})
        else:
            self.append_row(row)


def get_spreadsheet_title(service, spreadsheet_id: str) -> str:
    meta = (
        service.spreadsheets()
        .get(spreadsheetId=spreadsheet_id, fields="properties.title")
        .execute()
    )
    return meta["properties"]["title"]
