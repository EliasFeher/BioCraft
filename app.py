# Servidor do assistente da BioCraft.
#
# Instalar:  pip install -r requirements.txt   (precisa de Python 3.9 ou mais novo)
# Chave:     copie .env.example para .env e coloque a sua GEMINI_API_KEY
# Rodar:     python app.py   (fica em http://localhost:5000)
# Hospedado: gunicorn app:app --workers 1 --threads 4 (as conversas ficam na memória,
#            por isso um único processo) e as chaves vão nas variáveis da hospedagem.

import os
import threading
import time
from collections import OrderedDict, deque

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai
from google.genai import errors, types
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY não encontrada no arquivo .env")

RATE_LIMIT = 20  # mensagens por minuto de cada pessoa
MODEL = "gemini-3.8-flash"
RETRIES = 3  # tentativas quando o Google responde "alta demanda" (503)
MAX_MESSAGE_CHARS = 500  # tamanho máximo de cada pergunta
MAX_TURNS = 10  # quantas trocas de mensagens cada conversa lembra
MAX_CONVERSATIONS = 200  # conversas guardadas na memória ao mesmo tempo

SYSTEM_PROMPT = """
Você é o assistente virtual da BioCraft, um projeto de 8 estudantes da FIAP School
que cria árvores-líquidas.

Anotações sobre o projeto (são só a sua base de conhecimento):
    - Árvore-líquida: tanque de vidro com água e microalgas que fazem fotossíntese,
      absorvem CO2 e liberam oxigênio, gastando pouco espaço.
    - Unidade BC-01: fica em São Paulo e tem sensores de CO2, temperatura e umidade.
    - Protótipo físico: cilindro de vidro sobre um bloco de grama inspirado em Minecraft.
    - Jogo do site: 7 decisões no comando da BioCraft Industries, equilibrando economia
      e sustentabilidade.
    - Contato: contato@biocraft.com.

Regras:
    - Responda sempre com as suas próprias palavras. Nunca copie nem repita frases ou
      textos do site, e não use os mesmos títulos ou slogans dele
    - Responda sempre em português, de forma simpática e profissional
    - Use respostas curtas e simples, com no máximo 4 frases
    - Fale só sobre a BioCraft, árvores-líquidas, microalgas, CO2 e sustentabilidade
    - Nunca invente números, preços, prazos ou resultados. Se não souber, diga:
      "Não sei te responder isso, mas você pode falar com a equipe em contato@biocraft.com"
    - Não afirme que os dados do painel de monitoramento são em tempo real
    - Se pedirem outro assunto, explique com educação que você só fala da BioCraft
"""

app = Flask(__name__)
# atrás do servidor da hospedagem, pega o IP verdadeiro de quem está conversando
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)

# ALLOWED_ORIGINS: sites que podem usar o chat, separados por vírgula
# (ex: https://biocraft.com.br,https://www.biocraft.com.br). Sem isso, qualquer site pode.
origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
CORS(app, origins=origins or "*")

client = genai.Client(api_key=API_KEY)

# Uma conversa por visitante (o site manda um "sessao" diferente para cada um).
conversations = OrderedDict()
recent_requests = {}  # IP -> horários das últimas mensagens
lock = threading.Lock()


def too_many_requests(ip):
    now = time.time()
    with lock:
        times = recent_requests.setdefault(ip, deque())
        while times and now - times[0] > 60:
            times.popleft()
        if len(times) >= RATE_LIMIT:
            return True
        times.append(now)
        if len(recent_requests) > 5000:  # limpa quem não falou há mais de um minuto
            for key in [k for k, v in recent_requests.items() if not v or now - v[-1] > 60]:
                del recent_requests[key]
        return False


def get_history(session_id):
    with lock:
        history = conversations.pop(session_id, [])
        conversations[session_id] = history  # volta para o fim: a mais recente
        while len(conversations) > MAX_CONVERSATIONS:
            conversations.popitem(last=False)
        return history


@app.get("/")
def home():
    return jsonify({"status": "ok", "assistente": "BioCraft"})


@app.post("/chat")
def chat():
    data = request.get_json(silent=True) or {}
    message = str(data.get("mensagem", "")).strip()
    session_id = str(data.get("sessao", ""))[:64] or "anonimo"

    if too_many_requests(request.remote_addr):
        return jsonify({"erro": "Muitas mensagens seguidas. Espere um minuto."}), 429
    if not message:
        return jsonify({"erro": "Mensagem vazia"}), 400
    if len(message) > MAX_MESSAGE_CHARS:
        return jsonify({"erro": "Mensagem muito longa"}), 400

    history = get_history(session_id)

    try:
        history.append({"role": "user", "parts": [{"text": message}]})

        for attempt in range(RETRIES):
            try:
                response = client.models.generate_content(
                    model=MODEL,
                    contents=history,
                    config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
                )
                break
            except errors.ServerError:
                if attempt == RETRIES - 1:
                    raise
                time.sleep(2)

        answer = (response.text or "").strip() or "Não sei te responder isso."

        history.append({"role": "model", "parts": [{"text": answer}]})
        del history[: -MAX_TURNS * 2]  # guarda só as trocas mais recentes
        return jsonify({"resposta": answer})

    except Exception as error:
        history.pop()  # tira a pergunta que não foi respondida
        print("ERRO:", error)
        return jsonify({"erro": "Não consegui falar com o Gemini agora"}), 500


if __name__ == "__main__":
    app.run(debug=True)
