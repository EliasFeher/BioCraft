import { $, clamp, reduceMotion } from "./utils.js";
import { pixelIcon } from "./pixel-art.js";
import { createTotem } from "./totem.js";
import {
    CARDS,
    BREAK_AT,
    newGame,
    currentCard,
    choose,
    imbalance,
    totemHealth,
    totemMessage,
    ENDINGS,
    endingOf,
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
let pendingResult = null; // { option, change, health } depois de escolher, até clicar em "Continuar"
let shown = {}; // últimos valores mostrados, para destacar o que mudou
let lastFocus = null;


/* ---------- pequenas ferramentas ---------- */

const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);

const tone = (n) => (n > 0 ? "good" : n < 0 ? "bad" : "neutral");

const chipsHtml = (chips) => chips.map((c) => `<span class="chip ${c.tone}">${c.text}</span>`).join("");

// Faz o número "piscar" em verde (subiu) ou vermelho (desceu).
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

// Depois da escolha: quanto cada medidor mudou (sem julgar) e se o equilíbrio melhorou ou piorou.
function resultChips({ change, health: [before, after] }) {
    const chips = [];
    if (change.economy) chips.push({ text: `${signed(change.economy)} economia`, tone: "neutral" });
    if (change.sustainability) chips.push({ text: `${signed(change.sustainability)} sustentabilidade`, tone: "neutral" });
    chips.push({ text: `Equilíbrio ${before} → ${after}`, tone: tone(after - before) });
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

    // só o medidor que ficou para trás muda de cor, conforme o equilíbrio piora
    const lagging = barTone(totemHealth(game), 70, 40);
    const d = imbalance(game);

    el.economyBar.style.width = `${game.economy}%`;
    el.economyBar.dataset.tone = d > 0 ? lagging : "good";
    el.sustainabilityBar.style.width = `${game.sustainability}%`;
    el.sustainabilityBar.dataset.tone = d < 0 ? lagging : "good";
}

function renderPlanet() {
    const health = totemHealth(game);

    el.step.textContent = Math.min(game.step + 1, CARDS.length);
    [...el.pips.children].forEach((pip, i) => {
        pip.className = i < game.step ? "done" : i === game.step && !game.over ? "now" : "";
    });

    el.message.textContent = totemMessage(game);
    // a fumaça no fundo aparece quando o planeta fica para trás da economia
    el.world.style.setProperty("--smog", clamp(-imbalance(game) / BREAK_AT, 0, 1).toFixed(2));

    if (game.over === "falencia" || game.over === "colapso") totem.shatter();
    else totem.setHealth(health);
}

function renderChoices(card) {
    el.choices.replaceChildren();

    card.options.forEach((option, side) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "card-choice";
        button.textContent = option.label;
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
        el.resultChips.innerHTML = chipsHtml(resultChips(pendingResult));
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
                <li><span>2</span><p>Cada carta tem duas escolhas. Uma puxa para a <b>economia</b> e a outra para a <b>sustentabilidade</b>.</p></li>
                <li><span>3</span><p>Mantenha os dois em <b>equilíbrio</b>. Se um ficar muito para trás, o <b>totem</b> se desfaz.</p></li>
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
    const before = totemHealth(game);
    const { option, change } = choose(game, side);
    const after = totemHealth(game);

    pendingResult = { option, change, health: [before, after] };

    // faíscas quando a escolha aproxima os medidores, fumaça quando afasta
    if (after > before) totem.burst("good");
    else if (after < before) totem.burst("bad");

    render();
}

function continueAfterResult() {
    pendingResult = null;
    render();

    if (game.over) showEnd();
}

// mood do final: ícone e cor do selo, reaproveitando os corações do HUD
const END_BADGE = {
    won: ["heart", "g-S"],
    mixed: ["heartHalf", "g-B"],
    lost: ["heartEmpty", "lost"],
};

function showEnd() {
    const ending = ENDINGS[endingOf(game)];
    const [icon, badgeClass] = END_BADGE[ending.mood];

    openModal({
        tag: game.over === "fim" ? `FIM DAS ${CARDS.length} DECISÕES` : "O TOTEM SE DESFEZ",
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
                <div><dt>Equilíbrio</dt><dd>${totemHealth(game)}</dd></div>
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
