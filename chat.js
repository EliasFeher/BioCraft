import { $ } from "./utils.js";

// Endereço do servidor (app.py). Ao hospedar o servidor, troque aqui.
const API_URL = "http://localhost:5000/chat";

const GREETING = "Olá! Eu sou o assistente da BioCraft. Posso explicar como funciona a árvore-líquida, o projeto e o jogo.";
const OFFLINE = "O assistente está fora do ar agora. Tente de novo em alguns minutos ou escreva para contato@biocraft.com.";

const el = {
    toggle: $("chatToggle"),
    panel: $("chatPanel"),
    close: $("chatClose"),
    messages: $("chatMessages"),
    form: $("chatForm"),
    input: $("chatInput"),
    send: $("chatForm").querySelector("button"),
};

// um código por visitante, para o servidor manter cada conversa separada
function sessionId() {
    try {
        let id = sessionStorage.getItem("biocraft-chat");
        if (!id) {
            id = crypto.randomUUID();
            sessionStorage.setItem("biocraft-chat", id);
        }
        return id;
    } catch {
        return "anonimo";
    }
}

const session = sessionId();
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

    if (open) {
        if (!el.messages.children.length) addMessage(GREETING, "bot");
        el.input.focus({ preventScroll: true });
    } else {
        el.toggle.focus({ preventScroll: true });
    }
}

async function ask(question) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: question, sessao: session }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).resposta;
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
        typing.textContent = await ask(question);
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
el.close.addEventListener("click", () => setOpen(false));

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.panel.hidden) setOpen(false);
});
