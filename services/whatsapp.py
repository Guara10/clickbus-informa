"""
Envio de aviso proativo via WhatsApp (Twilio Sandbox).

Por seguranca, o prototipo NUNCA envia para os contatos ficticios da base:
numeros inventados podem pertencer a pessoas reais. O envio real so acontece
para o numero de teste definido em WHATSAPP_DESTINO_TESTE (o seu celular,
cadastrado no Sandbox do Twilio).

Sem TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM /
WHATSAPP_DESTINO_TESTE no .env, simula o envio -- mesmo padrao
"modo: SIMULACAO" ja usado em /api/simular-sms.
"""

import os
import re


def _config():
    # lido a cada chamada para respeitar o .env carregado e facilitar os testes
    return {
        "sid": os.getenv("TWILIO_ACCOUNT_SID", "").strip(),
        "token": os.getenv("TWILIO_AUTH_TOKEN", "").strip(),
        "origem": os.getenv("TWILIO_WHATSAPP_FROM", "").strip(),   # ex: whatsapp:+14155238886 (sandbox)
        "destino": os.getenv("WHATSAPP_DESTINO_TESTE", "").strip(),  # ex: +5511912345678
    }


def normalizar_e164(telefone):
    """'+55 11 91234-5678' -> '+5511912345678'. Devolve None se nao parecer E.164."""
    digitos = re.sub(r"\D", "", telefone or "")
    if not 10 <= len(digitos) <= 15:
        return None
    return "+" + digitos


def mascarar(telefone):
    """'+5511912345678' -> '+5511*****5678' (nao expoe o numero inteiro na resposta da API)."""
    if not telefone or len(telefone) < 9:
        return "****"
    return telefone[:5] + "*" * (len(telefone) - 9) + telefone[-4:]


def enviar_whatsapp(mensagem):
    cfg = _config()
    destino = normalizar_e164(cfg["destino"])
    configurado = bool(cfg["sid"] and cfg["token"] and cfg["origem"] and destino)

    if configurado:
        try:
            from twilio.rest import Client  # import tardio: so exige o pacote se for usar de verdade

            client = Client(cfg["sid"], cfg["token"])
            msg = client.messages.create(from_=cfg["origem"], to=f"whatsapp:{destino}", body=mensagem)
            return {"ok": True, "modo": "REAL", "sid": msg.sid, "destino": mascarar(destino)}
        except Exception as erro:
            return {"ok": False, "modo": "ERRO", "erro": str(erro)}

    return {
        "ok": True,
        "modo": "SIMULACAO",
        "aviso": "Twilio ou WHATSAPP_DESTINO_TESTE nao configurados (.env). Nenhuma mensagem real foi enviada.",
        "mensagem": mensagem,
    }
