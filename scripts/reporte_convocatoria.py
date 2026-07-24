import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

from agents.agent_convocatoria import ConvocatoriaAgent
from agents.supabase_client import get_supabase

ETIQUETAS = {
    "disponible": "✅ Disponible",
    "no_disponible": "❌ No disponible",
    "posiblemente": "🤔 Posiblemente",
    None: "⏳ Sin responder",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Muestra el resumen de respuestas de una convocatoria.")
    parser.add_argument("--id", required=True)
    return parser.parse_args()


def main():
    load_dotenv()
    args = parse_args()

    supabase = get_supabase()
    agent = ConvocatoriaAgent(supabase)

    convocatoria = agent.obtener(args.id)
    if not convocatoria:
        raise SystemExit(f"No existe una convocatoria con id={args.id}")

    resumen = agent.resumen(args.id)

    print(f"Convocatoria: {convocatoria['titulo']} ({convocatoria['fecha_servicio']})")
    print(f"Total destinatarios: {len(resumen)}")
    print()

    conteo = {"disponible": 0, "no_disponible": 0, "posiblemente": 0, None: 0}
    for fila in resumen:
        conteo[fila.get("respuesta")] = conteo.get(fila.get("respuesta"), 0) + 1

    for respuesta, etiqueta in ETIQUETAS.items():
        print(f"{etiqueta}: {conteo.get(respuesta, 0)}")

    print()
    print("Detalle:")
    for fila in sorted(resumen, key=lambda f: (f.get("respuesta") is not None, f.get("nombre") or "")):
        nombre = fila.get("nombre") or fila["telegram_chat_id"]
        etiqueta = ETIQUETAS.get(fila.get("respuesta"), fila.get("respuesta"))
        print(f"  - {nombre}: {etiqueta}")


if __name__ == "__main__":
    main()
