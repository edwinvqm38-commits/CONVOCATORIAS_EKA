import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

from agents import store
from agents.agent_convocatoria import ConvocatoriaAgent
from agents.sheets_client import get_sheets_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Crea una convocatoria (parada de planta) en el Google Sheet activo.")
    parser.add_argument("--titulo", required=True)
    parser.add_argument("--fecha", required=True, help="Fecha del servicio, formato YYYY-MM-DD")
    parser.add_argument("--planta", default=None)
    parser.add_argument("--descripcion", default=None)
    parser.add_argument("--hora", default=None)
    parser.add_argument("--fecha-limite", default=None, help="Fecha limite de respuesta, formato ISO")
    parser.add_argument("--creado-por", default=None)
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()

    service = get_sheets_service()
    spreadsheet_id = store.get_active_sheet_id(service)
    agent = ConvocatoriaAgent(service, spreadsheet_id)

    fecha_servicio = datetime.strptime(args.fecha, "%Y-%m-%d").date()
    fecha_limite = datetime.fromisoformat(args.fecha_limite) if args.fecha_limite else None

    convocatoria = agent.crear(
        titulo=args.titulo,
        fecha_servicio=fecha_servicio,
        planta=args.planta,
        descripcion=args.descripcion,
        hora_servicio=args.hora,
        fecha_limite_respuesta=fecha_limite,
        creado_por=args.creado_por,
    )

    logger.info("Convocatoria creada con id=%s en hoja %s", convocatoria["id"], spreadsheet_id)
    print(convocatoria["id"])


if __name__ == "__main__":
    main()
