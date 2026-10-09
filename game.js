import { $, clamp, reduceMotion } from "./utils.js";
import { pixelIcon, heartsRow } from "./pixel-art.js";
import { createTotem } from "./totem.js";
import {
    CARDS,
    newGame,
    currentCard,
    choose,
    dotSize,
    tally,
    ENDINGS,
    endingOf,
    planetMessage,
} from "./game-rules.js";


/* ---------- elementos da tela ---------- */

const el = {
    board: $("gameBoard"),
    world: $("gameWorld"),

    // empresa
    economy: $("gameEconomy"),
    economyBar: $("economyBar"),
    sustainability: $("gameSustainability"),
    sustainabilityBar: $("sustainabilityBar"),

    // planeta
    hearts: $("hearts"),
    healthNumber: $("healthNumber"),
    step: $("gameStep"),
    pips: $("stepPips"),
    message: $("gameMessage"),

    // carta da situação
    question: $("cardQuestion"),
    portrait: $("cardPortrait"),
    name: $("cardName"),
    role: $("cardRole"),
    title: $("cardTitle"),
    text: $("cardText"),
    choices: $("cardChoices"),
    result: $("cardResult"),
    resultText: $("resultText"),
    resultChips: $("resultChips"),
    continueBtn: $("continueBtn"),
    howTo: $("howTo"),

    // janela de avisos
    modal: $("gameModal"),
    modalCard: $("modalCard"),
    modalTag: $("modalTag"),
    modalTitle: $("modalTitle"),
    modalBody: $("modalBody"),
    modalActions: $("modalActions"),
};

const totem = createTotem($("totemStage"));

let game = newGame();
let pendingResult = null; // { option, change } depois de escolher, até clicar em "Continuar"
let shown = {}; // últimos valores mostrados, para destacar o que mudou
let lastFocus = null;


/* ---------- pequenas ferramentas ---------- */

const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);

const tone = (n, goodWhenUp = true) => (n === 0 ? "" : n > 0 === goodWhenUp ? "good" : "bad");

const chipsHtml = (chips) =>
    chips.map((c) => `<span class="chip ${c.good ? "good" : "bad"}">${c.text}</span>`).join("");

// Faz o número "piscar" em verde (melhorou) ou vermelho (piorou).
function flash(node, good) {
    node.classList.remove("flash-good", "flash-bad");
    void node.offsetWidth; // reinicia a animação
    node.classList.add(good ? "flash-good" : "flash-bad");
}

function setNumber(node, key, value) {
    const previous = shown[key];

    node.textContent = value;
    if (previous !== undefined && previous !== value) flash(node, value > previous);
    shown[key] = value;
}

const barTone = (value, goodFrom, warnFrom) => (value >= goodFrom ? "good" : value >= warnFrom ? "warn" : "bad");

// Linha de bolinhas que mostra o tamanho do impacto de uma escolha num medidor (sem dar o número exato).
function impactHtml(amount, icon) {
    const size = dotSize(amount);
    if (size === 0) return "";

    const dots = Array.from({ length: 3 }, (_, i) => `<i class="${i < size ? "on" : ""}"></i>`).join("");
    return `<span class="impact-stat ${amount > 0 ? "up" : "down"}">${pixelIcon(icon, 2)}${dots}</span>`;
}

function changeChips(change) {
    const chips = [];
    if (change.economy) chips.push({ text: `${signed(change.economy)} economia`, good: change.economy > 0 });
    if (change.sustainability) chips.push({ text: `${signed(change.sustainability)} sustentabilidade`, good: change.sustainability > 0 });
    return chips;
}


/* ---------- montagem inicial da tela ---------- */

function buildPips() {
    el.pips.innerHTML = "<i></i>".repeat(CARDS.length);
}


/* ---------- desenho da tela a cada mudança ---------- */

function renderCompany() {
    setNumber(el.economy, "economy", game.economy);
    setNumber(el.sustainability, "sustainability", game.sustainability);

    el.economyBar.style.width = `${game.economy}%`;
    el.economyBar.dataset.tone = barTone(game.economy, 50, 25);
    el.sustainabilityBar.style.width = `${game.sustainability}%`;
    el.sustainabilityBar.dataset.tone = barTone(game.sustainability, 50, 25);
}

function renderPlanet() {
    const health = game.sustainability;

    el.hearts.innerHTML = heartsRow(health, { scale: 3 });
    el.hearts.setAttribute("aria-label", `Saúde do planeta: ${health} de 100`);
    el.healthNumber.textContent = health;

    if (shown.health !== undefined && health < shown.health) {
        el.hearts.classList.remove("hurt");
        void el.hearts.offsetWidth;
        el.hearts.classList.add("hurt");
    }
    shown.health = health;

    el.step.textContent = Math.min(game.step + 1, CARDS.length);
    [...el.pips.children].forEach((pip, i) => {
        pip.className = i < game.step ? "done" : i === game.step && !game.over ? "now" : "";
    });

    el.message.textContent = planetMessage(health, game.over);
    // a fumaça no fundo aparece quando a saúde cai abaixo de 75
    el.world.style.setProperty("--smog", clamp((75 - health) / 75, 0, 1).toFixed(2));

    if (game.over === "colapso") totem.shatter();
    else totem.setHealth(health);
}

function renderChoices(card) {
    el.choices.innerHTML = "";

    card.options.forEach((option, side) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "card-choice";
        button.innerHTML = `
            <strong>${option.label}</strong>
            <span class="impact">
                ${impactHtml(option.economy, "emerald")}
                ${impactHtml(option.sustainability, "sapling")}
            </span>`;

        button.addEventListener("click", () => pickOption(side));
        el.choices.append(button);
    });
}

function renderCard() {
    const card = currentCard(game);

    el.question.hidden = Boolean(pendingResult);
    el.result.hidden = !pendingResult;

    if (pendingResult) {
        el.resultText.textContent = pendingResult.option.result;
        el.resultChips.innerHTML = chipsHtml(changeChips(pendingResult.change));
    } else if (card) {
        el.portrait.innerHTML = pixelIcon(card.who.look, 6);
        el.name.textContent = card.who.name;
        el.role.textContent = card.who.role;
        el.title.textContent = card.title;
        el.text.textContent = card.text;
        renderChoices(card);
    }
}

function render() {
    renderCompany();
    renderPlanet();
    renderCard();
}


/* ---------- janela de avisos (modal) ---------- */

// Com quiet = true (a introdução, quando a página carrega) a janela abre sem rolar a tela nem mexer no foco.
function openModal({ tag, title, body, buttons, tone: modalTone = "", quiet = false }) {
    el.modalTag.textContent = tag;
    el.modalTitle.textContent = title;

    if (typeof body === "string") el.modalBody.innerHTML = body;
    else el.modalBody.replaceChildren(body);

    el.modalActions.replaceChildren();
    buttons.forEach(({ html, kind = "primary", disabled = false, onClick }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `modal-btn ${kind}`;
        button.innerHTML = html;
        button.disabled = disabled;
        button.addEventListener("click", onClick);
        el.modalActions.append(button);
    });

    if (el.modal.hidden) lastFocus = document.activeElement;

    el.modal.dataset.tone = modalTone;
    el.modal.hidden = false;
    el.board.inert = true;

    if (quiet) return;

    el.modalActions.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    el.modalCard.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
}

function closeModal() {
    el.modal.hidden = true;
    el.board.inert = false;
    lastFocus?.focus?.({ preventScroll: true });
}

function showHowTo({ quiet = false } = {}) {
    openModal({
        quiet,
        tag: "COMO JOGAR",
        title: "Bem-vindo à BioCraft",
        body: `
            <ol class="howto">
                <li><span>1</span><p>Você vai decidir <b>${CARDS.length} situações</b> no comando da BioCraft.</p></li>
                <li><span>2</span><p>Cada carta tem duas escolhas: uma pesa mais para a <b>economia</b>, outra para a <b>sustentabilidade</b>.</p></li>
                <li><span>3</span><p>Se um dos dois medidores chegar a zero, o jogo acaba. O <b>totem</b> mostra a saúde do planeta.</p></li>
            </ol>`,
        buttons: [{ html: "Começar", onClick: closeModal }],
    });
}


/* ---------- jogar ---------- */

function startGame() {
    game = newGame();
    pendingResult = null;
    shown = {};

    totem.reset();
    render();
}

function pickOption(side) {
    const { option, change } = choose(game, side);
    pendingResult = { option, change };

    if (change.sustainability > 0) totem.burst("good");
    else if (change.sustainability < 0) totem.burst("bad");

    render();
}

function continueAfterResult() {
    pendingResult = null;
    render();

    if (game.over) showEnd();
}

// mood da notícia final: ícone e cor do selo, reaproveitando os corações do HUD
const END_BADGE = {
    won: ["heart", "g-S"],
    mixed: ["heartHalf", "g-B"],
    lost: ["heartEmpty", "lost"],
};

const endingFor = () => (game.over === "fim" ? ENDINGS[endingOf(game)] : ENDINGS[game.over]);

const END_TAG = {
    falencia: "FALÊNCIA",
    colapso: "O TOTEM SE DESFEZ",
    fim: `FIM DAS ${CARDS.length} DECISÕES`,
};

function showEnd() {
    const ending = endingFor();
    const counts = tally(game);
    const [icon, badgeClass] = END_BADGE[ending.mood];

    openModal({
        tag: END_TAG[game.over],
        title: ending.title,
        tone: ending.mood === "lost" ? "lost" : "",
        body: `
            <div class="end-top">
                <div class="grade ${badgeClass}">${pixelIcon(icon, 6)}</div>
                <p>${ending.text}</p>
            </div>

            <dl class="end-stats">
                <div><dt>Economia</dt><dd>${game.economy}</dd></div>
                <div><dt>Sustentabilidade</dt><dd>${game.sustainability}</dd></div>
                <div><dt>Pelo planeta</dt><dd>${counts.planeta}/${CARDS.length}</dd></div>
            </dl>`,
        buttons: [
            {
                html: "Jogar de novo",
                onClick: () => {
                    closeModal();
                    startGame();
                },
            },
            { html: "Ver o planeta", kind: "secondary", onClick: closeModal },
        ],
    });
}


/* ---------- ligações ---------- */

el.continueBtn.addEventListener("click", continueAfterResult);
el.howTo.addEventListener("click", () => showHowTo());

buildPips();
startGame();
showHowTo({ quiet: true });
