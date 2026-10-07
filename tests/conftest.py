import os
import sys

# Testes nunca dependem de internet nem de credenciais.
os.environ["MOTOR_OFFLINE"] = "1"
for var in ("GOOGLE_MAPS_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "WHATSAPP_DESTINO_TESTE"):
    os.environ.pop(var, None)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
