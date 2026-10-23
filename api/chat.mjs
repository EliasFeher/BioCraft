// Assistente da BioCraft, como função da Vercel (pasta api/), no mesmo domínio do site.
//
// Variáveis de ambiente (Vercel > Settings > Environment Variables):
//   GEMINI_API_KEY   obrigatória, a chave do Google AI Studio
//   ALLOWED_ORIGINS  opcional, outros domínios que podem usar o chat, separados por vírgula
//
// GET  /api/chat   verificação de saúde (não chama o Gemini), para monitoramento de disponibilidade
// POST /api/chat   { mensagem, historico } e a resposta volta em pedaços: data: {"t":"texto"}

// Tenta na ordem: se um modelo estiver sobrecarregado, fora do ar ou lento, passa para o próximo.
// Todos foram medidos com a chave do projeto e respondem em 1 a 2 s. Pensar antes de responder
// é o que mais demora, então os que aceitam recebem thinkingBudget 0 (os "lite" não aceitam o campo).
// Ficaram de fora: gemini-3.7-flash (57 a 120 s), gemini-3.8-flash (lento e muito sobrecarregado)
// e os gemini-2.5 (desativados pelo Google).
const MODELS = [
    { name: "gemini-3.6-flash", noThinking: true },
    { name: "gemini-3.5-flash", noThinking: true },
    { name: "gemini-3.5-flash-lite", noThinking: false },
    { name: "gemini-3.1-flash-lite", noThinking: true },
    { name: "gemini-flash-lite-latest", noThinking: false },
];

const RATE_LIMIT = 20; // mensagens por minuto de cada pessoa
const MAX_MESSAGE_CHARS = 500;
const MAX_HISTORY = 20;
const MAX_HISTORY_CHARS = 1500;
const MAX_BODY_BYTES = 40_000;
const MAX_OUTPUT_TOKENS = 600;
const FIRST_BYTE_TIMEOUT_MS = 6000; // se o modelo não começar a responder nesse tempo, passa para o próximo
const TOTAL_DEADLINE_MS = 18000; // depois disso não tenta mais modelos (o site desiste com 25 s)
const COOLDOWN_MS = 60_000; // modelo que falhou vai para o fim da fila por 1 minuto
const EMPTY_REPLY = "Não sei te responder isso, mas você pode falar com a equipe em contato@biocraft.com";

const SYSTEM_PROMPT = `
Você é o assistente virtual da BioCraft, um projeto de estudantes da FIAP School
que cria árvores-líquidas.

Anotações sobre o projeto (são só a sua base de conhecimento):
    - Árvore-líquida: tanque de vidro com água e microalgas que fazem fotossíntese,
      absorvem CO2 e liberam oxigênio, gastando pouco espaço.
    - Unidade BC-01: fica em São Paulo e tem sensores de CO2, temperatura e umidade.
    - Protótipo físico: cilindro de vidro sobre um bloco de grama inspirado em Minecraft.
      O totem na tampa representa uma segunda chance para o meio ambiente.
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

const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
    });


/* ---------- quem pode usar ---------- */

// O chat só responde ao próprio site (mesmo domínio) e aos domínios de ALLOWED_ORIGINS,
// para outro site não usar a cota da chave.
function originAllowed(request) {
    const origin = request.headers.get("origin");
    if (!origin) return false;
    if (EXTRA_ORIGINS.includes(origin)) return true;

    try {
        return new URL(origin).host === new URL(request.url).host;
    } catch {
        return false;
    }
}

// Limite por pessoa, guardado na memória da função. A Vercel reaproveita a mesma instância
// entre pedidos, então ele segura quem manda mensagens em sequência.
const hits = new Map();

function underLimit(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);

    if (recent.length >= RATE_LIMIT) {
        hits.set(ip, recent);
        return false;
    }

    recent.push(now);
    hits.set(ip, recent);

    // não deixa o mapa crescer sem fim
    if (hits.size > 5000) {
        for (const [key, times] of hits) {
            if (!times.some((t) => now - t < 60_000)) hits.delete(key);
        }
    }
    return true;
}

function clientIp(request) {
    return (
        request.headers.get("x-real-ip") ||
        (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
        "desconhecido"
    );
}


/* ---------- Gemini ---------- */

function cleanHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((t) => t && (t.role === "user" || t.role === "model") && typeof t.text === "string")
        .slice(-MAX_HISTORY)
        .map((t) => ({ role: t.role, text: t.text.slice(0, MAX_HISTORY_CHARS) }));
}

function buildBody(history, question, noThinking) {
    return JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [...history, { role: "user", text: question }].map((t) => ({
            role: t.role,
            parts: [{ text: t.text }],
        })),
        generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
    });
}

// A resposta (os cabeçalhos) chega quando o modelo começa a escrever; o tempo limite vale só até lá.
async function callModel(model, body, apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FIRST_BYTE_TIMEOUT_MS);
    try {
        return await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body,
                signal: controller.signal,
            },
        );
    } finally {
        clearTimeout(timer);
    }
}

// Disjuntor: lembra quais modelos falharam há pouco, para as próximas mensagens não perderem
// tempo com eles. Eles continuam na lista, só que por último.
const cooling = new Map(); // modelo -> até quando fica no fim da fila

function modelOrder() {
    const now = Date.now();
    const ready = MODELS.filter((m) => !(cooling.get(m.name) > now));
    const cooled = MODELS.filter((m) => cooling.get(m.name) > now);
    return [...ready, ...cooled];
}

// Abre a resposta em pedaços do primeiro modelo que estiver funcionando.
async function openGemini(history, question, apiKey) {
    const failures = [];
    const started = Date.now();

    for (const { name: model, noThinking } of modelOrder()) {
        if (Date.now() - started > TOTAL_DEADLINE_MS) {
            failures.push("prazo total esgotado");
            break;
        }

        try {
            let response = await callModel(model, buildBody(history, question, noThinking), apiKey);

            // se o Google deixar de aceitar o thinkingConfig nesse modelo, tenta sem ele
            if (response.status === 400 && noThinking) {
                console.warn("[chat] modelo recusou o thinkingConfig, seguindo sem ele:", model);
                response = await callModel(model, buildBody(history, question, false), apiKey);
            }

            if (response.ok && response.body) {
                cooling.delete(model);
                if (failures.length) console.warn("[chat] modelo de reserva usado:", model, "| falharam:", failures.join(", "));
                return response;
            }

            failures.push(`${model} ${response.status}`);
            cooling.set(model, Date.now() + COOLDOWN_MS);
            await response.body?.cancel().catch(() => {});
        } catch (error) {
            failures.push(`${model} ${error?.name === "AbortError" ? "demorou demais" : "sem conexão"}`);
            cooling.set(model, Date.now() + COOLDOWN_MS);
        }
    }

    throw new Error(`todos os modelos falharam (${failures.join(", ")})`);
}

// Converte os eventos do Gemini nos pedaços simples que o site lê: data: {"t":"texto"}
function textEvents() {
    let buffer = "";
    let sent = false;

    const handle = (event, controller) => {
        for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            try {
                const data = JSON.parse(line.slice(5));
                const parts = data?.candidates?.[0]?.content?.parts ?? [];
                const text = parts.map((p) => p.text ?? "").join("");
                if (text) {
                    sent = true;
                    controller.enqueue(`data: ${JSON.stringify({ t: text })}\n\n`);
                }
            } catch {
                // pedaço que não é JSON (ex: comentário do servidor): ignora
            }
        }
    };

    return new TransformStream({
        transform(chunk, controller) {
            buffer = (buffer + chunk).replaceAll("\r\n", "\n");
            let end;
            while ((end = buffer.indexOf("\n\n")) !== -1) {
                handle(buffer.slice(0, end), controller);
                buffer = buffer.slice(end + 2);
            }
        },
        flush(controller) {
            if (buffer.trim()) handle(buffer, controller);
            if (!sent) controller.enqueue(`data: ${JSON.stringify({ t: EMPTY_REPLY })}\n\n`);
        },
    });
}


/* ---------- rotas ---------- */

export function GET() {
    return json({ ok: true, configurado: Boolean(process.env.GEMINI_API_KEY) });
}

export async function POST(request) {
    if (!originAllowed(request)) return json({ erro: "Origem não permitida" }, 403);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("[chat] GEMINI_API_KEY não configurada");
        return json({ erro: "Assistente indisponível" }, 503);
    }

    if (!underLimit(clientIp(request))) {
        return json({ erro: "Muitas mensagens seguidas. Espere um minuto." }, 429, { "Retry-After": "60" });
    }

    let payload;
    try {
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) return json({ erro: "Mensagem muito longa" }, 413);
        payload = JSON.parse(raw);
    } catch {
        return json({ erro: "JSON inválido" }, 400);
    }

    const question = String(payload?.mensagem ?? "").trim();
    if (!question) return json({ erro: "Mensagem vazia" }, 400);
    if (question.length > MAX_MESSAGE_CHARS) return json({ erro: "Mensagem muito longa" }, 400);

    try {
        const upstream = await openGemini(cleanHistory(payload.historico), question, apiKey);
        const stream = upstream.body
            .pipeThrough(new TextDecoderStream())
            .pipeThrough(textEvents())
            .pipeThrough(new TextEncoderStream());

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (error) {
        console.error("[chat]", error.message);
        return json({ erro: "Assistente indisponível" }, 503);
    }
}
