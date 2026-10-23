import { $ } from "./utils.js";

// Função do chat na Vercel, no mesmo domínio do site (o código fica em api/chat.mjs).
const API_URL = "/api/chat";
const MAX_HISTORY = 20; // mensagens anteriores enviadas junto, para o assistente lembrar da conversa
const FIRST_RESPONSE_TIMEOUT_MS = 25000; // tempo máximo esperando a resposta começar (o servidor desiste antes, com 18 s)
const IDLE_TIMEOUT_MS = 15000; // tempo máximo sem chegar nenhum pedaço no meio da resposta
const RETRY_DELAY_MS = 900; // espera antes da segunda tentativa automática

const GREETING = "Olá! Eu sou o assistente da BioCraft. Posso explicar como funciona a árvore-líquida, o projeto e o jogo.";
const UNAVAILABLE = "Estou com instabilidade para responder agora. Tente de novo em instantes ou fale com a equipe em contato@biocraft.com.";
const TOO_FAST = "Você mandou muitas mensagens seguidas. Espere um minutinho e tente de novo.";

// Respostas prontas, usadas só se o assistente não responder. Assim as dúvidas mais comuns
// continuam com resposta mesmo durante uma instabilidade. As palavras são comparadas sem acento.
const BACKUP_ANSWERS = [
    {
        words: ["totem"],
        text: "O totem na tampa do protótipo representa uma segunda chance para o nosso meio ambiente.",
    },
    {
        words: ["contato", "email", "falar com", "orcamento", "preco", "comprar", "valor", "custa"],
        text: "Para orçamentos e outras conversas, fale com a equipe em contato@biocraft.com.",
    },
    {
        words: ["jogo", "jogar", "totem se desfaz"],
        text: "No jogo do site você toma 7 decisões no comando da BioCraft Industries, equilibrando economia e sustentabilidade.",
    },
    {
        words: ["bc-01", "bc01", "sensor", "monitor", "painel", "unidade"],
        text: "A unidade BC-01 fica em São Paulo e tem sensores de CO₂, temperatura e umidade.",
    },
    {
        words: ["arvore", "liquida", "alga", "funciona", "co2", "oxigenio", "fotossintese"],
        text: "A árvore-líquida é um tanque de vidro com água e microalgas. Com luz, as algas fazem fotossíntese, absorvem CO₂ do ar e liberam oxigênio, ocupando pouco espaço.",
    },
];

const el = {
    toggle: $("chatToggle"),
    panel: $("chatPanel"),
    messages: $("chatMessages"),
    form: $("chatForm"),
    input: $("chatInput"),
    send: $("chatForm").querySelector("button"),
};

const history = []; // { role: "user" | "model", text }
let waiting = false;

function scrollDown() {
    el.messages.scrollTop = el.messages.scrollHeight;
}

function addMessage(text, who) {
    const bubble = document.createElement("p");
    bubble.className = `chat-msg ${who}`;
    bubble.textContent = text;
    el.messages.append(bubble);
    scrollDown();
    return bubble;
}

function setOpen(open) {
    el.panel.hidden = !open;
    el.toggle.setAttribute("aria-expanded", open);
    el.toggle.classList.toggle("open", open);
    el.toggle.setAttribute("aria-label", open ? "Fechar o chat" : "Abrir o chat");

    if (open) {
        if (!el.messages.children.length) addMessage(GREETING, "bot");
        el.input.focus({ preventScroll: true });
    } else {
        el.toggle.focus({ preventScroll: true });
    }
}

function backupAnswer(question) {
    const plain = question.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return BACKUP_ANSWERS.find(({ words }) => words.some((word) => plain.includes(word)))?.text ?? null;
}


/* ---------- conversa com o servidor ---------- */

// retryable: vale tentar de novo (rede, demora ou servidor fora do ar)
class ChatError extends Error {
    constructor(message, { retryable = false, tooFast = false } = {}) {
        super(message);
        this.retryable = retryable;
        this.tooFast = tooFast;
    }
}

// Lê a resposta em pedaços (data: {"t":"texto"}) e chama onText com o texto até agora.
// Se ficar tempo demais sem chegar nada, encerra com o que já veio.
async function readStream(response, controller, onText) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let idle = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

            clearTimeout(idle);
            idle = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);

            buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll("\r\n", "\n");

            let end;
            while ((end = buffer.indexOf("\n\n")) !== -1) {
                const line = buffer.slice(0, end);
                buffer = buffer.slice(end + 2);
                if (!line.startsWith("data:")) continue;

                try {
                    text += JSON.parse(line.slice(5)).t ?? "";
                    onText(text);
                } catch {
                    // pedaço quebrado: ignora
                }
            }
        }
    } catch {
        // a conexão caiu ou travou no meio: se já chegou texto, fica com o que veio
        if (!text) throw new ChatError("resposta interrompida", { retryable: true });
    } finally {
        clearTimeout(idle);
    }

    if (!text) throw new ChatError("resposta vazia", { retryable: true });
    return text;
}

async function request(question, onText) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FIRST_RESPONSE_TIMEOUT_MS);
    let response;

    try {
        response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mensagem: question, historico: history.slice(-MAX_HISTORY) }),
            signal: controller.signal,
        });
    } catch {
        throw new ChatError("sem conexão", { retryable: true });
    } finally {
        clearTimeout(timer);
    }

    if (response.status === 429) throw new ChatError("muitas mensagens", { tooFast: true });
    if (!response.ok) throw new ChatError(`HTTP ${response.status}`, { retryable: response.status >= 500 });

    return readStream(response, controller, onText);
}

// Uma tentativa automática extra antes de desistir, desde que nada tenha aparecido na tela ainda.
async function ask(question, onText) {
    try {
        return await request(question, onText);
    } catch (error) {
        if (!error.retryable) throw error;
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return request(question, onText);
    }
}


/* ---------- tela ---------- */

function addRetry(bubble, question) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "chat-retry";
    retry.textContent = "Tentar de novo";
    retry.addEventListener("click", () => {
        if (waiting) return;
        bubble.remove();
        send(question);
    });
    bubble.append(document.createElement("br"), retry);
}

async function send(question) {
    waiting = true;
    el.send.disabled = true;
    const bubble = addMessage("Digitando...", "bot typing");

    try {
        const answer = await ask(question, (partial) => {
            bubble.classList.remove("typing");
            bubble.textContent = partial;
            scrollDown();
        });
        bubble.textContent = answer;
        // só entra no histórico o que o assistente respondeu de verdade
        history.push({ role: "user", text: question }, { role: "model", text: answer });
    } catch (error) {
        if (error.tooFast) {
            bubble.textContent = TOO_FAST;
        } else {
            const backup = backupAnswer(question);
            bubble.textContent = backup ?? UNAVAILABLE;
            if (!backup) addRetry(bubble, question);
        }
    }

    bubble.classList.remove("typing");
    waiting = false;
    el.send.disabled = false;
    scrollDown();
    el.input.focus({ preventScroll: true });
}

el.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const question = el.input.value.trim();
    if (!question || waiting) return;

    el.input.value = "";
    addMessage(question, "user");
    send(question);
});

el.toggle.addEventListener("click", () => setOpen(el.panel.hidden));

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.panel.hidden) setOpen(false);
});
