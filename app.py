from flask import Flask, render_template, jsonify, request
from datetime import datetime
import random

from dotenv import load_dotenv
load_dotenv()  # le o arquivo .env (copiado de .env.example) antes de qualquer os.getenv

from services.clima import consultar_clima
from services.transito import estimar_transito
from services.motor_decisao import avaliar_risco_atraso
from services.whatsapp import enviar_whatsapp

app = Flask(__name__)

# ---------------------------------------------------------------------------
# PROTOTIPO: dados simulados. Nenhuma conexao real e realizada.
# Nao conecta ao Oracle, nao envia SMS real.
# Clima (Open-Meteo) e transito (Google Distance Matrix, se configurado) sao
# consultas reais -- ver services/. WhatsApp usa Twilio se configurado no
# .env; sem credencial, simula o envio.
# ---------------------------------------------------------------------------

CONTATOS = [
    {"id": 1, "nome": "Ana Souza", "telefone": "+55 11 99999-1201", "cidade": "Sao Paulo", "status": "Ativo"},
    {"id": 2, "nome": "Bruno Lima", "telefone": "+55 19 98888-2302", "cidade": "Campinas", "status": "Ativo"},
    {"id": 3, "nome": "Carla Mendes", "telefone": "+55 12 97777-3403", "cidade": "Sao Jose dos Campos", "status": "Ativo"},
    {"id": 4, "nome": "Diego Rocha", "telefone": "+55 13 96666-4504", "cidade": "Santos", "status": "Inativo"},
    {"id": 5, "nome": "Elisa Martins", "telefone": "+55 16 95555-5605", "cidade": "Ribeirao Preto", "status": "Ativo"},
]

APIS = [
    {"tipo": "Clima", "nome": "Open-Meteo", "url": "https://api.open-meteo.com/v1/forecast", "cobertura": "Estado de SP", "status": "Disponivel"},
    {"tipo": "Saude", "nome": "InfoDengue", "url": "https://info.dengue.mat.br/api/alertcity", "cobertura": "Municipios de SP", "status": "Disponivel"},
    {"tipo": "Transito", "nome": "SPTrans Olho Vivo", "url": "https://api.olhovivo.sptrans.com.br/v2.1", "cobertura": "Sao Paulo capital", "status": "Requer token"},
    {"tipo": "Seguranca", "nome": "SSP-SP Dados Abertos", "url": "https://www.ssp.sp.gov.br/transparencia/dados-abertos", "cobertura": "Estado de SP", "status": "Carga periodica"},
    {"tipo": "Noticias", "nome": "GDELT DOC API", "url": "https://api.gdeltproject.org/api/v2/doc/doc", "cobertura": "Filtro por municipio", "status": "Disponivel"},
]

# Terminal Rodoviario Tiete (SP). Coordenadas reais do terminal; posicoes dos onibus sao simuladas.
TERMINAL = {"nome": "Terminal Tiete", "cidade": "Sao Paulo", "lat": -23.5158, "lng": -46.6255, "plataformas": 14}

# Coordenadas reais das cidades de destino, usadas para consultar clima real (Open-Meteo)
# e estimar transito real (Google Distance Matrix, se GOOGLE_MAPS_API_KEY estiver configurada).
COORD_CIDADE = {
    "Sao Paulo": (-23.5505, -46.6333),
    "Campinas": (-22.9099, -47.0626),
    "Rio de Janeiro": (-22.9068, -43.1729),
    "Santos": (-23.9608, -46.3339),
    "Sorocaba": (-23.5015, -47.4526),
    "Belo Horizonte": (-19.9167, -43.9345),
    "Curitiba": (-25.4284, -49.2733),
    "Ribeirao Preto": (-21.1775, -47.8103),
}

# Cenarios de demonstracao: forcam o clima para mostrar o motor escalonando
# sem depender de chover no dia da apresentacao. A resposta da API marca
# "cenario" para ninguem confundir com dado real.
# Temporal = chuva forte no destino E transito mais lento (+0.3 no indice), que e o que
# acontece de verdade quando chove forte.
CENARIOS_CLIMA = {
    "temporal": {"fonte": "cenario-demo", "simulado": True, "cenario": "temporal", "chuva_mm": 12.0, "vento_kmh": 45.0, "severidade": "alta"},
}
CENARIOS_TRANSITO_EXTRA = {"temporal": 0.3}

# Historico de atraso por viacao (%), fictício -- em produção viria do histórico real de embarques.
# Alimenta o motor de decisão junto com clima e transito.
HISTORICO_ATRASO_VIACAO = {
    "Cometa": 12, "Lira": 18, "Util": 28, "Ultra": 15,
    "Rapido": 10, "Gontijo": 22, "Catarinense": 30, "Expresso": 20,
}

PARTIDAS = [
    {"id": "#1042", "destino": "Rio de Janeiro", "viacao": "Cometa", "horario": "16:40", "plataforma": "12", "status": "embarcando", "a_bordo": 38, "total": 44, "eta": "no patio", "lat": -23.5136, "lng": -46.6206, "operador": "Ana Ribeiro"},
    {"id": "#2210", "destino": "Campinas", "viacao": "Lira", "horario": "16:45", "plataforma": "07", "status": "patio", "a_bordo": 12, "total": 42, "eta": "no patio", "lat": -23.5192, "lng": -46.6318, "operador": "Bruno Dias"},
    {"id": "#3315", "destino": "Rio de Janeiro", "viacao": "Util", "horario": "16:50", "plataforma": "03", "status": "atrasado", "a_bordo": 0, "total": 46, "eta": "22 min", "lat": -23.5015, "lng": -46.6108, "operador": "Ana Ribeiro"},
    {"id": "#4180", "destino": "Santos", "viacao": "Ultra", "horario": "17:00", "plataforma": "09", "status": "caminho", "a_bordo": 21, "total": 40, "eta": "8 min", "lat": -23.5288, "lng": -46.6392, "operador": "Carla Nunes"},
    {"id": "#5077", "destino": "Sorocaba", "viacao": "Rapido", "horario": "17:10", "plataforma": "05", "status": "encerrado", "a_bordo": 44, "total": 44, "eta": "14 min", "lat": -23.5061, "lng": -46.6455, "operador": "Bruno Dias"},
    {"id": "#6390", "destino": "Belo Horizonte", "viacao": "Gontijo", "horario": "17:15", "plataforma": "11", "status": "caminho", "a_bordo": 8, "total": 48, "eta": "5 min", "lat": -23.5241, "lng": -46.6102, "operador": "Diego Alves"},
    {"id": "#7455", "destino": "Curitiba", "viacao": "Catarinense", "horario": "17:25", "plataforma": "02", "status": "atrasado", "a_bordo": 0, "total": 44, "eta": "31 min", "lat": -23.4998, "lng": -46.6349, "operador": "Carla Nunes"},
    {"id": "#8120", "destino": "Ribeirao Preto", "viacao": "Expresso", "horario": "17:30", "plataforma": "08", "status": "embarcando", "a_bordo": 15, "total": 42, "eta": "no patio", "lat": -23.5205, "lng": -46.6208, "operador": "Diego Alves"},
]

OCORRENCIAS = [
    {"id": "OC-118", "titulo": "Onibus com pane na plataforma 03", "local": "Plataforma 03 · Util", "hora": "16:47", "gravidade": "critica", "estado": "andamento", "responsavel": "Ana Ribeiro"},
    {"id": "OC-117", "titulo": "Fila acima de 20 min no guiche 3", "local": "Saguao principal", "hora": "16:32", "gravidade": "alta", "estado": "aberta", "responsavel": "Bruno Dias"},
    {"id": "OC-115", "titulo": "Painel de partidas fora do ar", "local": "Portao B", "hora": "15:58", "gravidade": "media", "estado": "resolvida", "responsavel": "Carla Nunes"},
    {"id": "OC-113", "titulo": "Bagagem esquecida na plataforma 09", "local": "Plataforma 09", "hora": "15:20", "gravidade": "media", "estado": "resolvida", "responsavel": "Diego Alves"},
]

# Historico de avisos em memoria (o prototipo perde ao reiniciar)
AVISOS = [
    {"hora": "16:47", "tipo": "atraso", "titulo": "Rio de Janeiro atrasado em 22 min", "detalhe": "Util · #3315", "alcance": 46},
    {"hora": "16:41", "tipo": "atraso", "titulo": "Curitiba atrasado em 31 min", "detalhe": "Catarinense · #7455", "alcance": 44},
    {"hora": "16:35", "tipo": "embarque", "titulo": "Embarque aberto para Ribeirao Preto", "detalhe": "Expresso · #8120", "alcance": 42},
]


def _partida(pid):
    return next((p for p in PARTIDAS if p["id"] == pid), None)


# ---------------------------------------------------------------------------
# Motor preditivo de eventos da jornada
# Dados operacionais (clima real + transito real/simulado + historico da linha)
# -> motor de decisao (regra explicavel) -> WhatsApp (real se configurado, senao simulado)
# ---------------------------------------------------------------------------

STATUS_ELEGIVEIS_PARA_ATRASO = {"patio", "caminho"}  # onibus ainda a caminho do terminal


def _avaliar_partida(partida, cenario=None):
    """Consulta clima+transito para o destino da partida e calcula o risco de atraso.
    Nao altera o status da partida -- so anexa o campo 'risco'."""
    coord = COORD_CIDADE.get(partida["destino"], (TERMINAL["lat"], TERMINAL["lng"]))
    clima = CENARIOS_CLIMA[cenario] if cenario in CENARIOS_CLIMA else consultar_clima(*coord)
    transito = estimar_transito((TERMINAL["lat"], TERMINAL["lng"]), coord, semente=partida["id"])
    if cenario in CENARIOS_TRANSITO_EXTRA:
        transito = {**transito, "simulado": True, "cenario": cenario,
                    "indice_transito": round(transito["indice_transito"] + CENARIOS_TRANSITO_EXTRA[cenario], 2)}
    historico = HISTORICO_ATRASO_VIACAO.get(partida["viacao"], 20)
    risco = avaliar_risco_atraso(clima, transito, historico)
    partida["risco"] = {**risco, "clima": clima, "transito": transito}
    return partida["risco"]


def recalcular_motor_preditivo(disparar_avisos=True, cenario=None):
    """Reavalia o risco de todas as partidas em rota. Quando um risco vira
    'critico' para uma partida ainda no patio/a caminho, escalona pra
    'atrasado', registra o aviso e dispara WhatsApp (real ou simulado)."""
    escalonadas = []
    for partida in PARTIDAS:
        risco = _avaliar_partida(partida, cenario)

        if disparar_avisos and risco["nivel"] == "critico" and partida["status"] in STATUS_ELEGIVEIS_PARA_ATRASO:
            partida["status"] = "atrasado"
            minutos = max(5, round((risco["transito"]["indice_transito"] - 1) * 40))
            partida["eta"] = f"{minutos} min"

            mensagem = (
                f"ClickBus: sua viagem para {partida['destino']} ({partida['horario']}) "
                f"pode atrasar cerca de {minutos} min. Motivo: {risco['motivo']}. "
                f"Acompanhe pelo app."
            )
            aviso = {
                "hora": datetime.now().strftime('%H:%M'),
                "tipo": "atraso",
                "titulo": f"{partida['destino']} com risco de atraso ({risco['probabilidade_atraso']}%)",
                "detalhe": f"{partida['viacao']} · {partida['id']} · {risco['motivo']}",
                "alcance": partida["total"],
            }
            AVISOS.insert(0, aviso)

            # um envio por partida, para o numero de teste do .env (nunca para a base ficticia)
            envios = [enviar_whatsapp(mensagem)]
            escalonadas.append({"partida": partida["id"], "destino": partida["destino"], "risco": risco, "aviso": aviso, "envios": envios})

    return escalonadas


# Popula o campo 'risco' de todas as partidas assim que o servidor sobe,
# sem escalonar nada automaticamente (preserva os status fictícios já
# preparados pra demo: #3315 e #7455 já nascem "atrasado").
recalcular_motor_preditivo(disparar_avisos=False)


# ---------------------------------------------------------------------------
# Paginas
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    ativos = sum(1 for c in CONTATOS if c['status'] == 'Ativo')
    atrasos = sum(1 for p in PARTIDAS if p['status'] == 'atrasado')
    presentes = sum(p['a_bordo'] for p in PARTIDAS)
    ocupadas = len({p['plataforma'] for p in PARTIDAS})
    return render_template(
        'index.html',
        contatos=CONTATOS, apis=APIS, total=len(CONTATOS), ativos=ativos,
        partidas=PARTIDAS, terminal=TERMINAL, ocorrencias=OCORRENCIAS, avisos=AVISOS,
        atrasos=atrasos, presentes=presentes, ocupadas=ocupadas,
    )


@app.route('/passageiro')
def passageiro():
    partida = _partida('#1042') or PARTIDAS[0]
    return render_template('passageiro.html', partida=partida, terminal=TERMINAL)


# ---------------------------------------------------------------------------
# API: endpoints originais (mantidos sem alteracao de contrato)
# ---------------------------------------------------------------------------

@app.get('/api/status')
def api_status():
    return jsonify({"oracle": "simulado", "apis": len(APIS), "sms": "sandbox", "timestamp": datetime.now().isoformat()})


@app.post('/api/simular-sms')
def simular_sms():
    data = request.get_json(silent=True) or {}
    categoria = data.get('categoria', 'Clima')
    cidade = data.get('cidade', 'Todas')
    mensagem = (data.get('mensagem') or '').strip()
    if not mensagem:
        return jsonify({"ok": False, "erro": "Informe a mensagem."}), 400
    if len(mensagem) > 160:
        return jsonify({"ok": False, "erro": "No prototipo, limite a mensagem a 160 caracteres."}), 400

    elegiveis = [c for c in CONTATOS if c['status'] == 'Ativo' and (cidade == 'Todas' or c['cidade'] == cidade)]
    protocolo = f"DEMO-{datetime.now().strftime('%Y%m%d%H%M%S')}-{random.randint(100,999)}"
    return jsonify({
        "ok": True,
        "modo": "SIMULACAO",
        "protocolo": protocolo,
        "categoria": categoria,
        "cidade": cidade,
        "destinatarios": len(elegiveis),
        "mensagem": mensagem,
        "aviso": "Nenhum SMS real foi enviado."
    })


# ---------------------------------------------------------------------------
# API: terminal (novos)
# ---------------------------------------------------------------------------

@app.get('/api/partidas')
def api_partidas():
    return jsonify({"terminal": TERMINAL, "partidas": PARTIDAS})


@app.post('/api/plataforma')
def api_plataforma():
    """Move uma partida de plataforma e registra o aviso enviado aos passageiros."""
    data = request.get_json(silent=True) or {}
    pid = data.get('partida')
    plat = str(data.get('plataforma', '')).zfill(2)
    partida = _partida(pid)
    if not partida:
        return jsonify({"ok": False, "erro": "Partida nao encontrada."}), 404
    if not plat.isdigit() or not (1 <= int(plat) <= TERMINAL['plataformas']):
        return jsonify({"ok": False, "erro": "Plataforma invalida."}), 400

    ocupante = next((p for p in PARTIDAS if p is not partida and p['plataforma'] == plat), None)
    if ocupante:
        return jsonify({"ok": False, "erro": f"Plataforma {plat} ocupada pela partida {ocupante['id']} ({ocupante['destino']})."}), 409

    anterior = partida['plataforma']
    partida['plataforma'] = plat
    aviso = {
        "hora": datetime.now().strftime('%H:%M'),
        "tipo": "plataforma",
        "titulo": f"{partida['destino']} mudou para a plataforma {plat}",
        "detalhe": f"{partida['viacao']} · {pid}",
        "alcance": partida['total'],
    }
    AVISOS.insert(0, aviso)
    sms = f"ClickBus: sua viagem para {partida['destino']} ({partida['horario']}) mudou para a plataforma {plat}. Antes: {anterior}."
    return jsonify({
        "ok": True, "modo": "SIMULACAO", "partida": pid, "anterior": anterior,
        "plataforma": plat, "avisados": partida['total'], "sms": sms, "aviso": aviso,
    })


@app.get('/api/avisos')
def api_avisos():
    return jsonify({"avisos": AVISOS})


# ---------------------------------------------------------------------------
# API: motor preditivo
# ---------------------------------------------------------------------------

@app.post('/api/motor/recalcular')
def api_motor_recalcular():
    """Reavalia clima+transito+historico de todas as partidas e escalona pra
    'atrasado' (com aviso e WhatsApp) quem cruzar o limiar de risco.
    Acao manual (botao no painel), no mesmo espirito de '/api/plataforma':
    controlada pelo apresentador durante a demo, nao automatica em background."""
    data = request.get_json(silent=True) or {}
    cenario = data.get("cenario")
    if cenario is not None and cenario not in CENARIOS_CLIMA:
        return jsonify({"ok": False, "erro": f"Cenario desconhecido: {cenario}."}), 400
    escalonadas = recalcular_motor_preditivo(disparar_avisos=True, cenario=cenario)
    return jsonify({
        "ok": True,
        "cenario": cenario,
        "escalonadas": escalonadas,
        "partidas": PARTIDAS,
        "avisos": AVISOS,
    })


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
