import logging
from datetime import date, datetime

logger = logging.getLogger(__name__)


class ConvocatoriaAgent:
    """Crea y consulta convocatorias (paradas de planta) en Supabase."""

    def __init__(self, supabase):
        self.supabase = supabase

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
        payload = {
            "titulo": titulo,
            "fecha_servicio": fecha_servicio.isoformat(),
            "planta": planta,
            "descripcion": descripcion,
            "hora_servicio": hora_servicio,
            "fecha_limite_respuesta": (
                fecha_limite_respuesta.isoformat() if fecha_limite_respuesta else None
            ),
            "creado_por": creado_por,
            "estado": "borrador",
        }
        response = self.supabase.table("convocatorias").insert(payload).execute()
        return response.data[0]

    def obtener(self, convocatoria_id: str) -> dict | None:
        response = (
            self.supabase.table("convocatorias")
            .select("*")
            .eq("id", convocatoria_id)
            .limit(1)
            .execute()
        )
        filas = response.data or []
        return filas[0] if filas else None

    def marcar_enviada(self, convocatoria_id: str) -> None:
        self.supabase.table("convocatorias").update(
            {"estado": "enviada", "enviada_at": datetime.utcnow().isoformat()}
        ).eq("id", convocatoria_id).execute()

    def usuarios_activos(self) -> list[dict]:
        response = (
            self.supabase.table("convocatoria_usuarios")
            .select("telegram_chat_id, nombre, empresa, area")
            .eq("estado", "activo")
            .execute()
        )
        return response.data or []

    def registrar_envio(self, convocatoria_id: str, chat_id: str, message_id: int | None) -> None:
        self.supabase.table("convocatoria_envios").upsert(
            {
                "convocatoria_id": convocatoria_id,
                "telegram_chat_id": chat_id,
                "telegram_message_id": message_id,
                "estado_envio": "enviado" if message_id else "fallido",
            },
            on_conflict="convocatoria_id,telegram_chat_id",
        ).execute()

    def resumen(self, convocatoria_id: str) -> list[dict]:
        response = (
            self.supabase.table("convocatoria_resumen_v")
            .select("*")
            .eq("convocatoria_id", convocatoria_id)
            .execute()
        )
        return response.data or []

    def envios_pendientes(self, convocatoria_id: str) -> list[dict]:
        """Destinatarios que recibieron el envio pero aun no respondieron."""
        resumen = self.resumen(convocatoria_id)
        return [fila for fila in resumen if not fila.get("respuesta")]
