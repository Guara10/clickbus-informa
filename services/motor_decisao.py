"""
Motor de decisao do "Motor Preditivo de Eventos da Jornada".

Deliberadamente uma REGRA EXPLICAVEL, nao um modelo de Machine Learning:
para um prototipo com prazo curto, uma regra transparente que da pra
explicar em uma frase e mais defensavel do que reivindicar "IA" sobre
uma logica se-entao.

Os pesos sao arbitrarios e ficam documentados aqui de proposito. Foram
calibrados para que cada fator sozinho NAO baste para um alerta critico,
mas dois fatores fortes juntos sim. Exemplos (ver tests/test_motor.py):

    transito pesado (>=1.5x) + viacao com historico ruim (30%)  -> 60  critico
    transito pesado (>=1.5x) + viacao pontual (10%)             -> 50  atencao
    temporal no destino + transito moderado (>=1.3x)            -> 65+ critico
    tempo bom, transito livre, qualquer viacao                  -> <=15 normal
"""

PESO_CLIMA = {"alta": 40, "media": 20, "baixa": 0}
FAIXAS_TRANSITO = [(1.5, 45), (1.3, 25), (1.15, 10)]   # (indice minimo, pontos)
PESO_HISTORICO = 0.5                                   # pontos por ponto percentual de atraso historico

LIMIAR_CRITICO = 60
LIMIAR_ATENCAO = 35


def _pontos_transito(indice):
    for minimo, pontos in FAIXAS_TRANSITO:
        if indice >= minimo:
            return pontos
    return 0


def avaliar_risco_atraso(clima, transito, historico_atraso_pct):
    pontos = (
        PESO_CLIMA.get(clima["severidade"], 0)
        + _pontos_transito(transito["indice_transito"])
        + historico_atraso_pct * PESO_HISTORICO
    )
    probabilidade = max(0, min(95, round(pontos)))

    if probabilidade >= LIMIAR_CRITICO:
        nivel = "critico"
    elif probabilidade >= LIMIAR_ATENCAO:
        nivel = "atencao"
    else:
        nivel = "normal"

    return {
        "probabilidade_atraso": probabilidade,
        "nivel": nivel,
        "motivo": _motivo(clima, transito, historico_atraso_pct),
    }


def _motivo(clima, transito, historico_atraso_pct):
    partes = []
    if clima["severidade"] != "baixa":
        partes.append(f"clima {clima['severidade']} no destino")
    if transito["indice_transito"] >= 1.15:
        partes.append(f"transito {transito['indice_transito']}x o tempo livre")
    if historico_atraso_pct >= 20:
        partes.append(f"historico de atraso da linha ({historico_atraso_pct}%)")
    return ", ".join(partes) if partes else "sem fatores de risco relevantes"
