import { $, clamp, reduceMotion } from "./utils.js";
import { pixelIcon, heartsRow } from "./pixel-art.js";
import { createTotem } from "./totem.js";
import {
    ACTIONS,
    YEARS,
    ACTIONS_PER_YEAR,
    newGame,
    change,
    planetHealth,
    healthMessage,
    effectChips,
    effectOf,
    ownedOf,
    blockedReason,
    useAction,
    yearForecast,
    endYear,
    advance,
    pickEvent,
    runEffect,
    finalResult,
} from "./game-rules.js";


/* ---------- elementos da tela ---------- */

const el = {
    board: $("gameBoard"),
    world: $("gameWorld"),

    // empresa
    money: $("gameMoney"),
    moneyIcon: $("moneyIcon"),
    production: $("productionValue"),
    productionBar: $("productionBar"),
    environment: $("environmentValue"),
    environmentBar: $("environmentBar"),
    co2: $("gameCo2"),
    co2Bar: $("co2GameBar"),
    score: $("gameScore"),
    best: $("bestScore"),

    // planeta
    hearts: $("hearts"),
    healthNumber: $("healthNumber"),
    year: $("gameYear"),
    pips: $("yearPips"),
    message: $("gameMessage"),

    // ações
    actionList: $("actionList"),
    actionsLeft: $("actionsLeft"),
    forecast: $("forecast"),
    endYear: $("endYear"),
    endHint: $("endHint"),
    howTo: $("howTo"),

    // janela de avisos
    modal: $("gameModal"),
    modalCard: $("modalCard"),
    modalTag: $("modalTag"),
    modalTitle: $("modalTitle"),
    modalBody: $("modalBody"),
    modalActions: $("modalActions"),
};

const BEST_KEY = "biocraft-melhor-pontuacao";

const totem = createTotem($("totemStage"));

let game = newGame();
let shown = {}; // últimos valores mostrados, para destacar o que mudou
let best = loadBest();
let lastFocus = null;


/* ---------- pequenas ferramentas ---------- */

function loadBest() {
    try {
        return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
        return 0;
    }
}

function saveBest(value) {
    try {
        localStorage.setItem(BEST_KEY, String(value));
    } catch {
        // sem localStorage (janela anônima, por exemplo): o jogo funciona do mesmo jeito
    }
}

const signed = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const tone = (n, goodWhenUp = true) => (n === 0 ? "" : n > 0 === goodWhenUp ? "good" : "bad");

const chipsHtml = (chips) =>
    chips.map((c) => `<span class="chip ${c.good ? "good" : "bad"}">${c.text}</span>`).join("");

// Faz o número "piscar" em verde (melhorou) ou vermelho (piorou).
function flash(node, good) {
    node.classList.remove("flash-good", "flash-bad");
    void node.offsetWidth; // reinicia a animação
    node.classList.add(good ? "flash-good" : "flash-bad");
}

function setNumber(node, key, value, text, higherIsBetter) {
    const previous = shown[key];

    node.textContent = text;
    if (previous !== undefined && previous !== value) flash(node, value > previous === higherIsBetter);
    shown[key] = value;
}

const barTone = (value, goodFrom, warnFrom) => (value >= goodFrom ? "good" : value >= warnFrom ? "warn" : "bad");


/* ---------- montagem inicial da tela ---------- */

function buildActions() {
    el.actionList.innerHTML = "";

    ACTIONS.forEach((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action";
        button.dataset.id = action.id;
        button.innerHTML = `
            <span class="action-icon">${pixelIcon(action.icon, 3)}</span>
            <span class="action-text">
                <strong>${action.name}<em></em></strong>
                <small></small>
            </span>
            <span class="action-cost"></span>`;

        button.addEventListener("click", () => takeAction(action.id));
        el.actionList.append(button);
    });
}

function buildPips() {
    el.pips.innerHTML = "<i></i>".repeat(YEARS);
}


/* ---------- desenho da tela a cada mudança ---------- */

function renderCompany() {
    setNumber(el.money, "money", game.money, game.money, true);
    setNumber(el.production, "production", game.production, game.production, true);
    setNumber(el.environment, "environment", game.environment, game.environment, true);
    setNumber(el.co2, "co2", game.co2, `${game.co2} ppm`, false);
    setNumber(el.score, "score", game.score, game.score, true);

    el.productionBar.style.width = `${game.production}%`;
    el.environmentBar.style.width = `${game.environment}%`;
    el.environmentBar.dataset.tone = barTone(game.environment, 50, 25);
    // barra do CO₂: 250 ppm = 0%, 800 ppm = 100%
    el.co2Bar.style.width = `${clamp(((game.co2 - 250) / 550) * 100, 0, 100)}%`;
    el.co2Bar.dataset.tone = game.co2 <= 400 ? "good" : game.co2 <= 500 ? "warn" : "bad";

    el.best.textContent = best ? `Melhor: ${best}` : "";
}

function renderPlanet(health) {
    el.hearts.innerHTML = heartsRow(health, { scale: 3 });
    el.hearts.setAttribute("aria-label", `Saúde do planeta: ${health} de 100`);
    el.healthNumber.textContent = health;

    if (shown.health !== undefined && health < shown.health) {
        el.hearts.classList.remove("hurt");
        void el.hearts.offsetWidth;
        el.hearts.classList.add("hurt");
    }
    shown.health = health;

    el.year.textContent = Math.min(game.year, YEARS);
    [...el.pips.children].forEach((pip, i) => {
        pip.className = game.finished || i < game.year - 1 ? "done" : i === game.year - 1 ? "now" : "";
    });

    el.message.textContent = healthMessage(health, game.over);
    // a fumaça no fundo aparece quando a saúde cai abaixo de 75
    el.world.style.setProperty("--smog", clamp((75 - health) / 75, 0, 1).toFixed(2));

    if (game.over) totem.shatter();
    else totem.setHealth(health);
}

function renderActions() {
    // só mostra o motivo no botão quando é algo específico dele
    const generic = ["Sem ações neste ano", "Fim de jogo"];

    ACTIONS.forEach((action) => {
        const button = el.actionList.querySelector(`[data-id="${action.id}"]`);
        const reason = blockedReason(action, game);
        const cost = action.cost(game);
        const owned = ownedOf(action, game);
        const specific = reason && !generic.includes(reason);
        const numbers = chipsHtml(effectChips(effectOf(action, game), { short: true }));

        button.disabled = Boolean(reason);
        button.classList.toggle("short", Boolean(specific));

        button.querySelector("small").innerHTML = specific
            ? `<span class="reason">${reason}</span>`
            : `<span class="phrase">${action.short}</span><span class="numbers">${numbers || action.short}</span>`;

        button.querySelector("em").textContent = owned ? ` ×${owned}${action.max ? `/${action.max}` : ""}` : "";
        button.querySelector(".action-cost").innerHTML = cost ? `${pixelIcon("emerald", 2)}<b>${cost}</b>` : "<b>Grátis</b>";
    });

    el.actionsLeft.innerHTML =
        `<span>${plural(game.actions, "ação", "ações")}</span>` +
        "<i class='on'></i>".repeat(Math.max(game.actions, 0)) +
        "<i></i>".repeat(ACTIONS_PER_YEAR - Math.max(game.actions, 0));
}

// "Previsão do ano": o que acontece se o jogador encerrar o ano agora.
function renderForecast(health) {
    const done = game.over || game.finished;

    el.forecast.parentElement.hidden = done;
    el.endYear.classList.toggle("restart", done);
    el.endYear.classList.toggle("ready", !done && game.actions === 0);

    if (done) {
        el.forecast.innerHTML = "";
        el.endYear.textContent = "Jogar de novo";
        el.endHint.textContent = "";
        return;
    }

    const f = yearForecast(game);
    const next = { ...game };
    change(next, { co2: f.co2Delta, environment: f.envDelta });
    const nextHealth = planetHealth(next);

    const chip = (text, value, goodWhenUp = true) => `<span class="chip ${tone(value, goodWhenUp) || "neutral"}">${text}</span>`;

    el.forecast.innerHTML =
        chip(`${signed(f.income)} esmeraldas`, f.income) +
        chip(`CO₂ ${signed(f.co2Delta)} ppm`, f.co2Delta, false) +
        chip(`Saúde ${health} → ${nextHealth}`, nextHealth - health);

    el.endYear.textContent = game.year >= YEARS ? "Encerrar o último ano" : "Encerrar o ano";
    el.endHint.textContent = game.actions > 0 ? `Você ainda tem ${plural(game.actions, "ação", "ações")}.` : "Sem ações: hora de encerrar o ano.";
}

function render() {
    const health = planetHealth(game);

    renderCompany();
    renderPlanet(health);
    renderActions();
    renderForecast(health);
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
                <li><span>1</span><p>Você tem <b>${YEARS} anos</b> para fazer a fábrica crescer.</p></li>
                <li><span>2</span><p>Todo ano, escolha <b>${ACTIONS_PER_YEAR} ações</b> e depois <b>encerre o ano</b>.</p></li>
                <li><span>3</span><p>O <b>totem</b> mostra a saúde do planeta. Se ele se desfizer, o jogo acaba.</p></li>
            </ol>`,
        buttons: [{ html: "Começar", onClick: closeModal }],
    });
}


/* ---------- jogar ---------- */

function startGame() {
    game = newGame();
    shown = {};

    totem.reset();
    render();
}

function takeAction(id) {
    const result = useAction(game, id);
    if (!result) return;

    // faíscas quando a ação ajuda o planeta, fumaça quando pesa
    const { done } = result;
    if ((done.co2 ?? 0) > 0) totem.burst("bad");
    else if ((done.environment ?? 0) > 0 || (done.co2 ?? 0) < 0) totem.burst("good");

    render();
}

// Encerrar o ano: mostra o relatório e a notícia do ano.
function finishYear() {
    const healthBefore = planetHealth(game);
    const report = endYear(game);
    const event = pickEvent(game);

    game.lastEvent = event.id;

    if (report.health - healthBefore >= 5) totem.burst("good");
    else if (healthBefore - report.health >= 6) totem.burst("bad");

    render();
    showYearModal(report, event, healthBefore);
}

function showYearModal(report, event, healthBefore) {
    const rows = [
        ["Esmeraldas", signed(report.income), tone(report.income)],
        ["CO₂", `${signed(report.co2Delta)} ppm`, tone(report.co2Delta, false)],
        ["Sustentabilidade", signed(report.envDelta), tone(report.envDelta)],
        ["Saúde do planeta", `${healthBefore} → ${report.health}`, tone(report.health - healthBefore)],
    ];

    // o efeito da notícia é mostrado antes de aplicar, para o jogador entender o que vai acontecer
    const preview = event.resolve ? event.resolve(game) : event;
    const chips = event.choices ? "" : `<div class="chips">${chipsHtml(effectChips(preview.effect ?? {}))}</div>`;

    const buttons = event.choices
        ? event.choices.map((choice) => {
              const cost = choice.cost ?? 0;
              const choiceChips = effectChips(choice.effect);
              if (cost) choiceChips.unshift({ text: `−${cost} esmeraldas`, good: false });

              return {
                  kind: "choice",
                  html: `<strong>${choice.label}</strong><span class="chips">${chipsHtml(choiceChips)}</span>`,
                  disabled: game.money < cost,
                  onClick: () => resolveEvent(event, choice),
              };
          })
        : [{ html: "Continuar", onClick: () => resolveEvent(event, event) }];

    openModal({
        tag: `FIM DO ANO ${game.year}`,
        title: "Como foi o ano",
        body: `
            <ul class="report">
                ${rows.map(([label, value, rowTone]) => `<li><span>${label}</span><strong class="${rowTone}">${value}</strong></li>`).join("")}
            </ul>

            <div class="event-card">
                <span class="game-label">NOTÍCIA</span>
                <h4>${event.title}</h4>
                <p>${event.text}</p>
                ${preview.note ? `<p class="note">${preview.note}</p>` : ""}
                ${chips}
            </div>`,
        buttons,
    });
}

function resolveEvent(event, option) {
    const healthBefore = planetHealth(game);
    runEffect(game, option);

    const healthAfter = planetHealth(game);
    if (healthAfter - healthBefore >= 4) totem.burst("good");
    else if (healthBefore - healthAfter >= 4) totem.burst("bad");

    advance(game);
    render();

    if (game.over || game.finished) showEnd();
    else closeModal();
}

function showEnd() {
    const health = planetHealth(game);
    const result = finalResult(game);
    const lost = game.over;

    if (game.score > best) {
        best = game.score;
        saveBest(best);
    }
    el.best.textContent = `Melhor: ${best}`;

    if (!lost) {
        totem.burst("win");
        if (result.level >= 3) setTimeout(() => totem.burst("win"), 700);
    }

    openModal({
        tag: lost ? `FIM DE JOGO · ANO ${game.year}` : `FIM DOS ${YEARS} ANOS`,
        title: lost ? "O totem se desfez" : result.title,
        tone: lost ? "lost" : "won",
        body: `
            <div class="end-top">
                <div class="grade ${lost ? "lost" : "g-" + result.grade}">${lost ? "FIM" : result.grade}</div>
                <p>${lost ? "O planeta não resistiu. Da próxima vez, reduza as emissões e invista em Árvores-Líquidas." : result.text}</p>
            </div>

            <dl class="end-stats">
                <div><dt>Saúde</dt><dd>${health}</dd></div>
                <div><dt>CO₂</dt><dd>${game.co2}</dd></div>
                <div><dt>Esmeraldas</dt><dd>${game.money}</dd></div>
            </dl>

            <p class="end-score">Pontos: <strong>${game.score}</strong> · Melhor: <strong>${best}</strong></p>`,
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

el.endYear.addEventListener("click", () => {
    if (game.over || game.finished) startGame();
    else finishYear();
});

el.howTo.addEventListener("click", () => showHowTo());

el.moneyIcon.innerHTML = pixelIcon("emerald", 3);

buildActions();
buildPips();
startGame();
showHowTo({ quiet: true });
