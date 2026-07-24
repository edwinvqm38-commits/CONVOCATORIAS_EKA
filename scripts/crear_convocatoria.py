import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

from agents.agent_convocatoria import ConvocatoriaAgent
from agents.supabase_client import get_supabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Crea una convocatoria (parada de planta) en Supabase.")
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

    supabase = get_supabase()
    agent = ConvocatoriaAgent(supabase)

    fecha_servicio = datetime.strptime(args.fecha, "%Y-%m-%d").date()
    fecha_limite = (
        datetime.fromisoformat(args.fecha_limite) if args.fecha_limite else None
    )

    convocatoria = agent.crear(
        titulo=args.titulo,
        fecha_servicio=fecha_servicio,
        planta=args.planta,
        descripcion=args.descripcion,
        hora_servicio=args.hora,
        fecha_limite_respuesta=fecha_limite,
        creado_por=args.creado_por,
    )

    logger.info("Convocatoria creada con id=%s", convocatoria["id"])
    print(convocatoria["id"])


if __name__ == "__main__":
    main()
