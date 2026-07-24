import argparse
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

from agents import store
from agents.agent_convocatoria import ConvocatoriaAgent
from agents.agent_notify import NotifyAgent
from agents.sheets_client import get_sheets_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Envia una convocatoria a los usuarios registrados.")
    parser.add_argument("--id", required=True, help="ID de la convocatoria")
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()

    service = get_sheets_service()
    spreadsheet_id = store.get_active_sheet_id(service)
    agent = ConvocatoriaAgent(service, spreadsheet_id)
    notifier = NotifyAgent()

    convocatoria = agent.obtener(args.id)
    if not convocatoria:
        raise SystemExit(f"No existe una convocatoria con id={args.id} en la hoja activa")

    usuarios = store.get_usuarios_activos(service)
    logger.info("Usuarios activos a convocar: %s", len(usuarios))

    enviados = 0
    fallidos = 0

    for usuario in usuarios:
        chat_id = usuario["telegram_chat_id"]
        message_id = notifier.enviar_a_usuario(convocatoria, chat_id)

        if message_id:
            agent.registrar_respuesta_envio(convocatoria["id"], chat_id)
            enviados += 1
        else:
            fallidos += 1

        # Evita chocar con el limite de envios por segundo de Telegram.
        time.sleep(0.05)

    agent.marcar_enviada(convocatoria["id"])
    logger.info("Convocatoria enviada. OK=%s fallidos=%s", enviados, fallidos)


if __name__ == "__main__":
    main()
