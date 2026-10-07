"""
Consulta de clima real via Open-Meteo (gratuito, sem chave).

Se a chamada falhar (sem rede, timeout, API fora do ar), devolve um
resultado simulado e marcado como tal em vez de derrubar o protótipo
durante a apresentação.
"""

import os

import requests

TIMEOUT = 6


def consultar_clima(lat, lng):
    if os.getenv("MOTOR_OFFLINE", "").strip() == "1":
        return _simulado()
    try:
        resp = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lng,
                "current": "precipitation,weather_code,wind_speed_10m",
                "timezone": "America/Sao_Paulo",
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        atual = resp.json().get("current", {})
        chuva = float(atual.get("precipitation") or 0)
        vento = float(atual.get("wind_speed_10m") or 0)

        if chuva >= 4 or vento >= 40:
            severidade = "alta"
        elif chuva > 0 or vento >= 25:
            severidade = "media"
        else:
            severidade = "baixa"

        return {
            "fonte": "open-meteo",
            "simulado": False,
            "chuva_mm": chuva,
            "vento_kmh": vento,
            "severidade": severidade,
        }
    except Exception:
        return _simulado()


def _simulado():
    return {
            "fonte": "open-meteo",
            "simulado": True,
            "chuva_mm": 0.0,
            "vento_kmh": 10.0,
            "severidade": "baixa",
        }
