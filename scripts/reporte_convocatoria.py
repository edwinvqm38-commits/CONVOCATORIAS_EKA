import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

from agents import store
from agents.agent_convocatoria import ConvocatoriaAgent
from agents.sheets_client import get_sheets_service

ETIQUETAS = {
    "disponible": "✅ Disponible",
    "no_disponible": "❌ No disponible",
    "posiblemente": "🤔 Posiblemente",
    "": "⏳ Sin responder",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Muestra el resumen de respuestas de una convocatoria.")
    parser.add_argument("--id", required=True)
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()

    service = get_sheets_service()
    spreadsheet_id = store.get_active_sheet_id(service)
    agent = ConvocatoriaAgent(service, spreadsheet_id)

    convocatoria = agent.obtener(args.id)
    if not convocatoria:
        raise SystemExit(f"No existe una convocatoria con id={args.id} en la hoja activa")

    resumen = agent.resumen(args.id)

    print(f"Convocatoria: {convocatoria['titulo']} ({convocatoria['fecha_servicio']})")
    print(f"Total destinatarios: {len(resumen)}")
    print()

    conteo = {"disponible": 0, "no_disponible": 0, "posiblemente": 0, "": 0}
    for fila in resumen:
        conteo[fila.get("respuesta", "")] = conteo.get(fila.get("respuesta", ""), 0) + 1

    for respuesta, etiqueta in ETIQUETAS.items():
        print(f"{etiqueta}: {conteo.get(respuesta, 0)}")

    print()
    print("Detalle:")
    for fila in sorted(resumen, key=lambda f: (bool(f.get("respuesta")), f.get("nombre") or "")):
        nombre = fila.get("nombre") or fila["telegram_chat_id"]
        etiqueta = ETIQUETAS.get(fila.get("respuesta", ""), fila.get("respuesta"))
        especialidad = fila.get("especialidad")
        sufijo = f" — {especialidad}" if especialidad else ""
        print(f"  - {nombre}: {etiqueta}{sufijo}")


if __name__ == "__main__":
    main()
