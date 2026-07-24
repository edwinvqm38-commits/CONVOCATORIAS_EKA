import html
import logging
import os

import requests

logger = logging.getLogger(__name__)

RESPUESTA_BOTONES = {
    "disponible": "✅ Disponible",
    "no_disponible": "❌ No disponible",
    "tal_vez": "🤔 Tal vez / depende",
}


class NotifyAgent:
    """Envía convocatorias por Telegram con botones de confirmación."""

    def __init__(self):
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        if not self.token:
            raise ValueError("Falta la variable TELEGRAM_BOT_TOKEN")
        self.api = f"https://api.telegram.org/bot{self.token}"

    def build_message(self, convocatoria: dict) -> str:
        lines = [
            "📢 <b>Convocatoria - Parada de planta</b>",
            "",
            f"🏭 <b>{html.escape(str(convocatoria.get('planta') or 'Planta'))}</b>",
            f"📌 {html.escape(str(convocatoria.get('titulo') or ''))}",
        ]

        if convocatoria.get("descripcion"):
            lines += ["", html.escape(str(convocatoria["descripcion"]))]

        fecha = convocatoria.get("fecha_servicio")
        hora = convocatoria.get("hora_servicio")
        fecha_linea = f"🗓️ Fecha del servicio: {html.escape(str(fecha))}"
        if hora:
            fecha_linea += f" — {html.escape(str(hora))}"
        lines += ["", fecha_linea]

        if convocatoria.get("fecha_limite_respuesta"):
            lines.append(
                f"⏰ Responde antes de: {html.escape(str(convocatoria['fecha_limite_respuesta']))}"
            )

        lines += ["", "¿Estás disponible para participar? Confirma con un botón:"]

        return "\n".join(lines)

    def build_keyboard(self, convocatoria_id: str) -> dict:
        return {
            "inline_keyboard": [
                [
                    {
                        "text": texto,
                        "callback_data": f"conv:{convocatoria_id}:{respuesta}",
                    }
                ]
                for respuesta, texto in RESPUESTA_BOTONES.items()
            ]
        }

    def enviar_a_usuario(self, convocatoria: dict, chat_id: str) -> int | None:
        payload = {
            "chat_id": chat_id,
            "text": self.build_message(convocatoria),
            "parse_mode": "HTML",
            "reply_markup": self.build_keyboard(convocatoria["id"]),
            "disable_web_page_preview": True,
        }

        try:
            response = requests.post(f"{self.api}/sendMessage", json=payload, timeout=20)
            response.raise_for_status()
        except Exception:
            logger.exception("No se pudo enviar la convocatoria a %s", chat_id)
            return None

        data = response.json()
        return (data.get("result") or {}).get("message_id")

    def enviar_recordatorio(self, convocatoria: dict, chat_id: str) -> int | None:
        texto = "⏰ <b>Recordatorio</b>: aún no confirmas tu disponibilidad.\n\n" + self.build_message(
            convocatoria
        )
        payload = {
            "chat_id": chat_id,
            "text": texto,
            "parse_mode": "HTML",
            "reply_markup": self.build_keyboard(convocatoria["id"]),
            "disable_web_page_preview": True,
        }

        try:
            response = requests.post(f"{self.api}/sendMessage", json=payload, timeout=20)
            response.raise_for_status()
        except Exception:
            logger.exception("No se pudo enviar el recordatorio a %s", chat_id)
            return None

        data = response.json()
        return (data.get("result") or {}).get("message_id")
