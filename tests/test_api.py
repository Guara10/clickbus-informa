"""Fluxos do prototipo pela API, com o cliente de testes do Flask."""
import importlib

import pytest


@pytest.fixture()
def cliente():
    import app as modulo
    modulo = importlib.reload(modulo)  # estado em memoria limpo a cada teste
    modulo.app.config["TESTING"] = True
    return modulo.app.test_client()


def test_paginas_abrem(cliente):
    assert cliente.get("/").status_code == 200
    assert cliente.get("/passageiro").status_code == 200


def test_toda_partida_tem_risco(cliente):
    partidas = cliente.get("/api/partidas").get_json()["partidas"]
    assert all("risco" in p for p in partidas)


def test_partida_da_demo_e_coerente_com_a_tela_do_passageiro(cliente):
    partidas = {p["id"]: p for p in cliente.get("/api/partidas").get_json()["partidas"]}
    assert partidas["#1042"]["destino"] == "Rio de Janeiro"


def test_troca_de_plataforma_livre(cliente):
    r = cliente.post("/api/plataforma", json={"partida": "#1042", "plataforma": "14"})
    assert r.status_code == 200
    assert r.get_json()["plataforma"] == "14"


def test_troca_para_plataforma_ocupada_e_recusada(cliente):
    # a plataforma 03 e da #3315
    r = cliente.post("/api/plataforma", json={"partida": "#1042", "plataforma": "3"})
    assert r.status_code == 409
    assert "#3315" in r.get_json()["erro"]


def test_plataforma_inexistente(cliente):
    assert cliente.post("/api/plataforma", json={"partida": "#1042", "plataforma": "99"}).status_code == 400


def test_cenario_temporal_escalona_partidas_a_caminho(cliente):
    d = cliente.post("/api/motor/recalcular", json={"cenario": "temporal"}).get_json()
    assert d["ok"] and d["cenario"] == "temporal"
    assert d["escalonadas"], "o cenario de demonstracao precisa escalonar ao menos uma partida"
    for e in d["escalonadas"]:
        assert len(e["envios"]) == 1                      # um envio por partida, nao um por contato
        assert e["envios"][0]["modo"] == "SIMULACAO"      # sem .env, nada real e enviado
    status = {p["id"]: p["status"] for p in d["partidas"]}
    assert status["#1042"] == "embarcando"                # quem ja esta embarcando nao e escalonado


def test_cenario_desconhecido(cliente):
    assert cliente.post("/api/motor/recalcular", json={"cenario": "furacao"}).status_code == 400


def test_whatsapp_nunca_vai_para_a_base_ficticia(monkeypatch):
    from services import whatsapp
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC_teste")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "token_teste")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
    # Twilio configurado, mas sem numero de teste: continua simulado
    assert whatsapp.enviar_whatsapp("oi")["modo"] == "SIMULACAO"


def test_normalizacao_de_telefone():
    from services.whatsapp import normalizar_e164, mascarar
    assert normalizar_e164("+55 11 91234-5678") == "+5511912345678"
    assert normalizar_e164("123") is None
    assert mascarar("+5511912345678") == "+5511*****5678"
