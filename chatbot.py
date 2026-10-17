#pip install flask flask-cors google-genai python-dotenv

import os
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
from dotenv import load_dotenv

# carregando as variáveis de ambiente (.env)

load_dotenv()
app=Flask(__name__)
CORS(app)

# validando e carregando a api key
API_KEY=os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise Exception("GEMINI_API_KEY não encontrada no arquivo .env")

# cliente do gemini
client=genai.Client(api_key=API_KEY)

# instruindo o sistema (personalidade do bot)

SYSTEM_PROMPT = """
Você é um assistente escolar chamado FiapSchool Bot.

Regras:
    - Responda sempre em português
    - Seja amigável
    - Explique de forma simples
    - Use respostas curtas e resumidas. Lembre-se: você é um assistente e não o professor
    - indique continuidade de estudos
    - Oriente sempre de forma que o aluno deve pensar
    - Use exemplos práticos
    - Nunca invente informações. Se não tem uma resposta diga simplesmente: "Não sei te responder isso"
    - Incentive o aluno a estudar
"""

#histórico de conversas ( mentido na memória do servidor)
history=[]

@app.route("/")
def home():
    """Renderiza a página HTML do chat."""
    return render_template("index.html")


@app.route("/chat", methods={"POST"})
def chat():
    """Recebe a mensagem do cliente, atualiza o histórico e chama o gemini."""
    try:
        data=request.getjson()
        pergunta = data.get("mensagem")


        if not pergunta:
            return jsonify(("Erro:" "Mensagem vazia")), 400
        
        #1. adciona a pergunta ao histórico
        history.append({
            "role": "user",
            "parts": [{"Text: pergunta"}]
        })

        # 2. chama a api do gemini enviando  o histórico completo + system prompt
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=history,
            config=types.GenerateContextConfig(
                system_instruction=SYSTEM_PROMPT
            )
        )

        # 3. Adciona a resposta da IA ao histórico

        history.append({
            "role": "user",
            "parts": [{"Text: resposta"}]
        })

        return jsonify({
            "resposta": pergunta
        })
    
    except Exception as erro:
        print("ERRO:", erro)
        return jsonify({
            "erro": str(erro),
            "resposta": "Desculpe, ocorreu um erro ao conversar com o Gemini."
        }), 500
    
if __name__ == "__main__":
    app.run(debug=True)