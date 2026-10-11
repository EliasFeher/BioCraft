# Servidor do assistente da BioCraft.
#
# Instalar:  pip install -r requirements.txt   (precisa de Python 3.9 ou mais novo)
# Chave:     copie .env.example para .env e coloque a sua GEMINI_API_KEY
# Rodar:     dentro da pasta chatbot, python app.py   (fica em http://localhost:5000)

import os
import threading
from collections import OrderedDict

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai
from google.genai import types

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY não encontrada no arquivo .env")

MODEL = "gemini-2.5-flash"
MAX_MESSAGE_CHARS = 500  # tamanho máximo de cada pergunta
MAX_TURNS = 10  # quantas trocas de mensagens cada conversa lembra
MAX_CONVERSATIONS = 200  # conversas guardadas na memória ao mesmo tempo

SYSTEM_PROMPT = """
Você é o assistente virtual da BioCraft, um projeto de 8 estudantes da FIAP School
que cria árvores-líquidas.

Sobre o projeto:
    - A árvore-líquida é um tanque de vidro cheio de água e microalgas. Com a luz,
      as algas absorvem o gás carbônico (CO2) do ar e liberam oxigênio, como as
      folhas de uma árvore, ocupando pouco espaço.
    - A unidade do projeto se chama BC-01 e fica em São Paulo. Ela tem sensores de
      CO2, temperatura e umidade, e o site tem uma seção de monitoramento.
    - O protótipo físico é um cilindro de vidro sobre um bloco de grama inspirado
      em Minecraft.
    - O site tem um jogo de 7 decisões em que a pessoa comanda a BioCraft Industries
      e precisa manter economia e sustentabilidade em equilíbrio.
    - Contato: contato@biocraft.com.

Regras:
    - Responda sempre em português, de forma simpática e profissional
    - Use respostas curtas e simples, com no máximo 4 frases
    - Fale só sobre a BioCraft, árvores-líquidas, microalgas, CO2 e sustentabilidade
    - Nunca invente números, preços, prazos ou resultados. Se não souber, diga:
      "Não sei te responder isso, mas você pode falar com a equipe em contato@biocraft.com"
    - Não afirme que os dados do painel de monitoramento são em tempo real
    - Se pedirem outro assunto, explique com educação que você só fala da BioCraft
"""

app = Flask(__name__)
CORS(app)
client = genai.Client(api_key=API_KEY)

# Uma conversa por visitante (o site manda um "sessao" diferente para cada um).
conversations = OrderedDict()
lock = threading.Lock()


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

    if not message:
        return jsonify({"erro": "Mensagem vazia"}), 400
    if len(message) > MAX_MESSAGE_CHARS:
        return jsonify({"erro": "Mensagem muito longa"}), 400

    history = get_history(session_id)

    try:
        history.append({"role": "user", "parts": [{"text": message}]})

        response = client.models.generate_content(
            model=MODEL,
            contents=history,
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
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
