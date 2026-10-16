import { $ } from "./utils.js";

// Função do chat no Supabase (o código fica em supabase/functions/chat/index.ts).
const API_URL = "https://yrbgmhmvotipylxljhip.supabase.co/functions/v1/chat";
const MAX_HISTORY = 20; // mensagens anteriores enviadas junto, para o assistente lembrar da conversa

const GREETING = "Olá! Eu sou o assistente da BioCraft. Posso explicar como funciona a árvore-líquida, o projeto e o jogo.";
const OFFLINE = "O assistente está fora do ar agora. Tente de novo em alguns minutos ou escreva para contato@biocraft.com.";
const TOO_FAST = "Você mandou muitas mensagens seguidas. Espere um minutinho e tente de novo.";

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

function addMessage(text, who) {
    const bubble = document.createElement("p");
    bubble.className = `chat-msg ${who}`;
    bubble.textContent = text;
    el.messages.append(bubble);
    el.messages.scrollTop = el.messages.scrollHeight;
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

// Lê a resposta em pedaços (data: {"t":"texto"}) e chama onText com o texto até agora.
async function readStream(response, onText) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;

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
    } catch (error) {
        // a conexão caiu no meio: se já chegou texto, mostra o que veio
        if (!text) throw error;
    }

    if (!text) throw new Error("resposta vazia");
    return text;
}

async function ask(question, onText) {
    // text/plain não precisa de pré-checagem (preflight) do navegador; a função lê o JSON do mesmo jeito
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ mensagem: question, historico: history.slice(-MAX_HISTORY) }),
    });

    if (response.status === 429) return { text: TOO_FAST, ok: false };
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // a versão antiga da função respondia tudo de uma vez em JSON
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
        return { text: (await response.json()).resposta, ok: true };
    }

    return { text: await readStream(response, onText), ok: true };
}

el.form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = el.input.value.trim();
    if (!question || waiting) return;

    el.input.value = "";
    addMessage(question, "user");

    waiting = true;
    el.send.disabled = true;
    const typing = addMessage("Digitando...", "bot typing");

    try {
        const answer = await ask(question, (partial) => {
            typing.classList.remove("typing");
            typing.textContent = partial;
            el.messages.scrollTop = el.messages.scrollHeight;
        });
        typing.textContent = answer.text;
        // só entra no histórico o que o assistente respondeu de verdade
        if (answer.ok) history.push({ role: "user", text: question }, { role: "model", text: answer.text });
    } catch {
        typing.textContent = OFFLINE;
    }

    typing.classList.remove("typing");
    waiting = false;
    el.send.disabled = false;
    el.messages.scrollTop = el.messages.scrollHeight;
    el.input.focus({ preventScroll: true });
});

el.toggle.addEventListener("click", () => setOpen(el.panel.hidden));

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.panel.hidden) setOpen(false);
});
