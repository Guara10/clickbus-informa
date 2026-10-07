"""Regras do motor de decisao: cada fator sozinho nao gera alerta critico, dois fatores fortes sim."""
from services.motor_decisao import avaliar_risco_atraso


def risco(severidade, indice, historico):
    return avaliar_risco_atraso({"severidade": severidade}, {"indice_transito": indice}, historico)


def test_tempo_bom_transito_livre_e_normal():
    r = risco("baixa", 1.0, 30)
    assert r["nivel"] == "normal"
    assert r["motivo"].startswith("historico")


def test_transito_pesado_com_viacao_atrasadeira_e_critico_mesmo_sem_chuva():
    # antes da recalibracao, sem chuva o maximo possivel era 42% (nunca critico)
    assert risco("baixa", 1.5, 30)["nivel"] == "critico"


def test_transito_pesado_com_viacao_pontual_fica_em_atencao():
    assert risco("baixa", 1.5, 10)["nivel"] == "atencao"


def test_temporal_com_transito_moderado_e_critico():
    assert risco("alta", 1.3, 0)["nivel"] == "critico"


def test_temporal_sozinho_nao_basta():
    assert risco("alta", 1.0, 0)["nivel"] == "atencao"


def test_probabilidade_limitada_a_95():
    assert risco("alta", 2.0, 100)["probabilidade_atraso"] == 95
