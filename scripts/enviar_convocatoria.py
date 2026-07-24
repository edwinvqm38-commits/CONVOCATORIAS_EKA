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
    parser = argparse.ArgumentParser(description="Envia una convocatoria a los usuarios registrados.")
    parser.add_argument("--id", required=True, help="ID de la convocatoria")
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

    usuarios = agent.usuarios_activos()
    logger.info("Usuarios activos a convocar: %s", len(usuarios))

    enviados = 0
    fallidos = 0

    for usuario in usuarios:
        chat_id = usuario["telegram_chat_id"]
        message_id = notifier.enviar_a_usuario(convocatoria, chat_id)
        agent.registrar_envio(convocatoria["id"], chat_id, message_id)

        if message_id:
            enviados += 1
        else:
            fallidos += 1

        # Evita chocar con el limite de envios por segundo de Telegram.
        time.sleep(0.05)

    agent.marcar_enviada(convocatoria["id"])
    logger.info("Convocatoria enviada. OK=%s fallidos=%s", enviados, fallidos)


if __name__ == "__main__":
    main()
