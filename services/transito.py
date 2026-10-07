"""
Estimativa de trânsito entre o terminal e o destino da partida.

Usa o Google Distance Matrix se GOOGLE_MAPS_API_KEY estiver configurada no
.env. Sem a chave (ou se a chamada falhar), simula um indice de transito
plausivel e marca o resultado como simulado -- o protótipo nunca quebra
por falta de credencial.
"""

import os
import random

import requests

TIMEOUT = 6
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()


def estimar_transito(origem, destino, semente=None):
    if GOOGLE_MAPS_API_KEY:
        try:
            resp = requests.get(
                "https://maps.googleapis.com/maps/api/distancematrix/json",
                params={
                    "origins": f"{origem[0]},{origem[1]}",
                    "destinations": f"{destino[0]},{destino[1]}",
                    "departure_time": "now",
                    "key": GOOGLE_MAPS_API_KEY,
                },
                timeout=TIMEOUT,
            )
            resp.raise_for_status()
            elemento = resp.json()["rows"][0]["elements"][0]
            duracao = elemento["duration"]["value"]
            duracao_transito = elemento.get("duration_in_traffic", elemento["duration"])["value"]
            indice = round(duracao_transito / duracao, 2) if duracao else 1.0
            return {"fonte": "google-distance-matrix", "simulado": False, "indice_transito": indice}
        except Exception:
            pass  # cai no fallback simulado abaixo

    # Fallback simulado: estavel por partida (mesma semente = mesmo valor),
    # pra nao "piscar" numero diferente a cada requisicao durante a demo.
    rng = random.Random(semente)
    indice = round(rng.uniform(1.0, 1.6), 2)
    return {"fonte": "simulado", "simulado": True, "indice_transito": indice}
