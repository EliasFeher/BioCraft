// Assistente da BioCraft, publicado como Edge Function no Supabase.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   GEMINI_API_KEY   obrigatório, a chave do Google AI Studio
//   ALLOWED_ORIGINS  opcional, sites que podem usar o chat separados por vírgula
//                    (ex: https://biocraft.vercel.app,https://www.seudominio.com.br)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o próprio Supabase já fornece.
//
// O site manda a pergunta e as últimas mensagens da conversa; a função não guarda nada,
// só registra o horário de cada mensagem para o limite por pessoa (tabela chat_requests).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const MODEL = "gemini-3.8-flash";
const RATE_LIMIT = 20; // mensagens por minuto de cada pessoa
const RETRIES = 3; // tentativas quando o Google responde "alta demanda" (503)
const MAX_MESSAGE_CHARS = 500; // tamanho máximo de cada pergunta
const MAX_HISTORY = 20; // mensagens anteriores que a conversa lembra
const MAX_HISTORY_CHARS = 1500; // tamanho máximo de cada mensagem anterior

const SYSTEM_PROMPT = `
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
`;

const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
    // sem ALLOWED_ORIGINS, qualquer site pode; com ele, só os sites da lista
    const allow = ALLOWED.length === 0 ? "*" : origin && ALLOWED.includes(origin) ? origin : ALLOWED[0];
    return {
        "Access-Control-Allow-Origin": allow,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
        Vary: "Origin",
    };
}

type Turn = { role: "user" | "model"; text: string };

function cleanHistory(raw: unknown): Turn[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((t) => t && (t.role === "user" || t.role === "model") && typeof t.text === "string")
        .slice(-MAX_HISTORY)
        .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_HISTORY_CHARS) }));
}

// Registra a mensagem e diz se a pessoa ainda está dentro do limite.
async function allowed(ip: string): Promise<boolean> {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return true;

    const response = await fetch(`${url}/rest/v1/rpc/chat_allow`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_ip: ip, p_limit: RATE_LIMIT }),
    });

    // se o limite falhar por algum motivo, não derruba o chat
    if (!response.ok) return true;
    return (await response.json()) === true;
}

async function askGemini(history: Turn[], question: string): Promise<string> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const body = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [...history, { role: "user", text: question }].map((t) => ({
            role: t.role,
            parts: [{ text: t.text }],
        })),
    });

    for (let attempt = 1; ; attempt++) {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
            { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body },
        );

        if (response.status === 503 && attempt < RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            continue;
        }
        if (!response.ok) throw new Error(`Gemini ${response.status}: ${(await response.text()).slice(0, 300)}`);

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const text = parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
        return text || "Não sei te responder isso.";
    }
}

Deno.serve(async (req) => {
    const cors = corsHeaders(req.headers.get("origin"));
    const reply = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return reply({ erro: "Use POST" }, 405);

    let payload: { mensagem?: unknown; historico?: unknown };
    try {
        payload = await req.json();
    } catch {
        return reply({ erro: "JSON inválido" }, 400);
    }

    const question = String(payload.mensagem ?? "").trim();
    if (!question) return reply({ erro: "Mensagem vazia" }, 400);
    if (question.length > MAX_MESSAGE_CHARS) return reply({ erro: "Mensagem muito longa" }, 400);

    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
    if (!(await allowed(ip))) return reply({ erro: "Muitas mensagens seguidas. Espere um minuto." }, 429);

    try {
        return reply({ resposta: await askGemini(cleanHistory(payload.historico), question) });
    } catch (error) {
        console.error("ERRO:", error);
        return reply({ erro: "Não consegui falar com o Gemini agora" }, 500);
    }
});
