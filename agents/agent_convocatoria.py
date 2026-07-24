import logging
import random
import time
from datetime import date, datetime

from agents import schema
from agents.sheets_client import SheetTable

logger = logging.getLogger(__name__)


def _generar_id() -> str:
    return f"{int(time.time() * 1000):x}{random.randint(0, 0xffff):04x}"


class ConvocatoriaAgent:
    """Crea y consulta convocatorias (paradas de planta) en Google Sheets."""

    def __init__(self, service, spreadsheet_id: str):
        self.service = service
        self.spreadsheet_id = spreadsheet_id
        self.convocatorias = SheetTable(
            service, spreadsheet_id, schema.CONVOCATORIAS_SHEET, schema.CONVOCATORIAS_HEADERS
        )
        self.respuestas = SheetTable(
            service, spreadsheet_id, schema.RESPUESTAS_SHEET, schema.RESPUESTAS_HEADERS
        )
        self.convocatorias.ensure()
        self.respuestas.ensure()

    def crear(
        self,
        titulo: str,
        fecha_servicio: date,
        planta: str | None = None,
        descripcion: str | None = None,
        hora_servicio: str | None = None,
        fecha_limite_respuesta: datetime | None = None,
        creado_por: str | None = None,
    ) -> dict:
        fila = {
            "id": _generar_id(),
            "titulo": titulo,
            "planta": planta or "",
            "fecha_servicio": fecha_servicio.isoformat(),
            "hora_servicio": hora_servicio or "",
            "descripcion": descripcion or "",
            "fecha_limite_respuesta": fecha_limite_respuesta.isoformat() if fecha_limite_respuesta else "",
            "estado": "borrador",
            "creado_por": creado_por or "",
            "creado_en": datetime.utcnow().isoformat(),
            "enviada_en": "",
        }
        self.convocatorias.append_row(fila)
        return fila

    def obtener(self, convocatoria_id: str) -> dict | None:
        return self.convocatorias.find_row(lambda row: row["id"] == convocatoria_id)

    def marcar_enviada(self, convocatoria_id: str) -> None:
        self.convocatorias.upsert_row(
            lambda row: row["id"] == convocatoria_id,
            {"estado": "enviada", "enviada_en": datetime.utcnow().isoformat()},
        )

    def registrar_respuesta_envio(self, convocatoria_id: str, chat_id: str) -> None:
        """Deja un registro vacio (solo enviado) para poder distinguir a quien
        le llego el mensaje pero aun no responde, del resto de usuarios."""
        self.respuestas.upsert_row(
            lambda row: row["convocatoria_id"] == convocatoria_id and row["telegram_chat_id"] == chat_id,
            {"convocatoria_id": convocatoria_id, "telegram_chat_id": chat_id},
        )

    def resumen(self, convocatoria_id: str) -> list[dict]:
        return [
            fila
            for fila in self.respuestas.get_all_rows()
            if fila["convocatoria_id"] == convocatoria_id
        ]

    def envios_pendientes(self, convocatoria_id: str) -> list[dict]:
        """Filas que recibieron el envio pero aun no marcaron disponible/no
        disponible/posiblemente (columna 'respuesta' vacia)."""
        return [fila for fila in self.resumen(convocatoria_id) if not fila.get("respuesta")]
