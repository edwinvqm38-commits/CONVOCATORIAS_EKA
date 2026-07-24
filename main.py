"""Punto de entrada opcional: reenvia recordatorios de convocatorias abiertas
que aun tengan destinatarios sin responder. Pensado para correr por cron
(GitHub Actions) ademas del uso manual de los scripts en scripts/.
"""

import logging
import sys

from dotenv import load_dotenv

from agents.agent_convocatoria import ConvocatoriaAgent
from agents.agent_notify import NotifyAgent
from agents.supabase_client import get_supabase

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


def run_recordatorios() -> None:
    load_dotenv()

    supabase = get_supabase()
    agent = ConvocatoriaAgent(supabase)
    notifier = NotifyAgent()

    convocatorias = (
        supabase.table("convocatorias").select("*").eq("estado", "enviada").execute().data
        or []
    )
    logger.info("Convocatorias enviadas y abiertas: %s", len(convocatorias))

    for convocatoria in convocatorias:
        pendientes = agent.envios_pendientes(convocatoria["id"])
        if not pendientes:
            continue

        logger.info(
            "Convocatoria %s: %s pendiente(s) de responder", convocatoria["id"], len(pendientes)
        )
        for fila in pendientes:
            notifier.enviar_recordatorio(convocatoria, fila["telegram_chat_id"])


if __name__ == "__main__":
    try:
        run_recordatorios()
    except Exception as error:
        logger.exception("Error critico: %s", error)
        sys.exit(1)
