import argparse
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

from agents.agent_convocatoria import ConvocatoriaAgent
from agents.agent_notify import NotifyAgent
from agents.supabase_client import get_supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Reenvia la convocatoria solo a quienes no han respondido."
    )
    parser.add_argument("--id", required=True)
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()

    supabase = get_supabase()
    agent = ConvocatoriaAgent(supabase)
    notifier = NotifyAgent()

    convocatoria = agent.obtener(args.id)
    if not convocatoria:
        raise SystemExit(f"No existe una convocatoria con id={args.id}")

    pendientes = agent.envios_pendientes(args.id)
    logger.info("Destinatarios pendientes de respuesta: %s", len(pendientes))

    for fila in pendientes:
        chat_id = fila["telegram_chat_id"]
        message_id = notifier.enviar_recordatorio(convocatoria, chat_id)
        if message_id:
            agent.registrar_envio(convocatoria["id"], chat_id, message_id)
        time.sleep(0.05)

    logger.info("Recordatorios enviados: %s", len(pendientes))


if __name__ == "__main__":
    main()
