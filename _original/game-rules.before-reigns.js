// Regras do jogo, sem nada de tela: só números e decisões.
// Assim dá para testar o equilíbrio do jogo sem abrir o navegador.

export const YEARS = 12;
export const ACTIONS_PER_YEAR = 2;
export const MAX_FILTERS = 4;
export const MAX_RESEARCH = 3;
export const GAME_OVER_HEALTH = 10;

const RANGE = {
    production: [0, 100],
    environment: [0, 100],
    co2: [250, 800],
    money: [0, Infinity],
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export function newGame() {
    return {
        year: 1,
        actions: ACTIONS_PER_YEAR,
        money: 60,
        production: 40,
        environment: 75,
        co2: 390,
        score: 0,
        trees: 0,
        greens: 0,
        filters: 0,
        research: 0,
        lastEvent: null,
        over: false,
        finished: false,
    };
}

// Aplica mudanças respeitando os limites e devolve o que realmente mudou.
export function change(state, effect) {
    const done = {};

    for (const [key, amount] of Object.entries(effect)) {
        const [min, max] = RANGE[key];
        const next = clamp(state[key] + amount, min, max);

        if (next !== state[key]) done[key] = next - state[key];
        state[key] = next;
    }

    return done;
}


/* ---------- saúde do planeta ---------- */

// 0 a 100. Pesa a sustentabilidade e a qualidade do ar (300 ppm = ótimo, 700 ppm = péssimo).
export function planetHealth(state) {
    const air = clamp(100 - (state.co2 - 300) / 4, 0, 100);
    return Math.round(0.55 * state.environment + 0.45 * air);
}

// Quanto do totem fica "queimado" e quanto cai, de acordo com a saúde.
export function totemDamage(health) {
    return {
        ash: clamp((80 - health) / 80, 0, 1) * 0.9,
        fall: clamp((55 - health) / 55, 0, 1) * 0.6,
    };
}

export function healthMessage(health, over) {
    if (over) return "O totem se desfez. O planeta não resistiu.";
    if (health >= 80) return "O totem brilha. O planeta está saudável.";
    if (health >= 60) return "Há sinais de poluição no totem.";
    if (health >= 40) return "O totem está rachando. Hora de agir.";
    if (health >= 20) return "O totem está em perigo! Peças estão caindo.";
    return "O totem está quase se desfazendo!";
}


/* ---------- ações do ano ---------- */

const LABELS = {
    production: ["produção", "prod."],
    environment: ["sustentabilidade", "sust."],
    co2: ["CO₂", "CO₂"],
    money: ["esmeraldas", "esmeraldas"],
};

// Transforma { production: 10, co2: -5 } em chips prontos para mostrar na tela.
// Para o CO₂, subir é ruim; para o resto, subir é bom.
export function effectChips(effect, { short = false } = {}) {
    return Object.entries(effect)
        .filter(([, amount]) => amount !== 0)
        .map(([key, amount]) => ({
            text: `${amount > 0 ? "+" : "−"}${Math.abs(amount)} ${LABELS[key][short ? 1 : 0]}`,
            good: key === "co2" ? amount < 0 : amount > 0,
        }));
}

// "effect" pode ser fixo ou depender do estado; "build" é o contador que a ação aumenta.
// "short" é a frase curta que aparece no botão; os números aparecem ao passar o mouse.
export const ACTIONS = [
    {
        id: "grow",
        icon: "furnace",
        name: "Aumentar produção",
        short: "Mais produção, mais emissão.",
        cost: () => 0,
        effect: { production: 10, co2: 10, environment: -3 },
    },
    {
        id: "tree",
        icon: "tree",
        name: "Árvore-Líquida",
        short: "Absorve CO₂ todo ano.",
        cost: (s) => 25 + 7 * s.trees,
        effect: { co2: -10, environment: 4 },
        build: "trees",
    },
    {
        id: "green",
        icon: "sapling",
        name: "Criar área verde",
        short: "Mais natureza, menos produção.",
        cost: (s) => 15 + 3 * s.greens,
        effect: { environment: 6, production: -3 },
        build: "greens",
    },
    {
        id: "filter",
        icon: "hopper",
        name: "Biofiltro nas chaminés",
        short: "Menos emissão todo ano.",
        cost: (s) => 18 + 4 * s.filters,
        effect: { co2: -8, environment: 2 },
        build: "filters",
        max: MAX_FILTERS,
    },
    {
        id: "research",
        icon: "potion",
        name: "Pesquisa",
        short: "Árvores-Líquidas absorvem mais.",
        cost: (s) => 30 + 15 * s.research,
        effect: {},
        build: "research",
        max: MAX_RESEARCH,
    },
    {
        id: "educate",
        icon: "book",
        name: "Educação ambiental",
        short: "Melhora a sustentabilidade.",
        cost: () => 12,
        effect: { environment: 7 },
    },
    {
        id: "cash",
        icon: "chest",
        name: "Fazer caixa",
        short: "Vende créditos de carbono.",
        cost: () => 0,
        effect: (s) => ({ money: 10 + 6 * s.trees }),
    },
];

export const effectOf = (action, state) =>
    typeof action.effect === "function" ? action.effect(state) : action.effect;

// Quantas vezes o jogador já fez uma ação que se acumula (ou null, se ela não se acumula).
export const ownedOf = (action, state) => (action.build ? state[action.build] : null);

// Motivo pelo qual a ação não pode ser usada agora (ou null, se pode).
export function blockedReason(action, state) {
    if (state.over || state.finished) return "Fim de jogo";
    if (state.actions <= 0) return "Sem ações neste ano";
    if (action.max && state[action.build] >= action.max) return "Já está no máximo";

    const cost = action.cost(state);
    if (state.money < cost) return `Faltam ${cost - state.money} esmeraldas`;

    return null;
}

// Usa uma ação e devolve o que mudou, ou null se não deu.
export function useAction(state, id) {
    const action = ACTIONS.find((a) => a.id === id);
    if (!action || blockedReason(action, state)) return null;

    const cost = action.cost(state);
    const effect = effectOf(action, state);

    state.money -= cost;
    state.actions -= 1;
    if (action.build) state[action.build] += 1;

    return { action, cost, done: change(state, effect) };
}


/* ---------- virada do ano ---------- */

// Constantes da economia e do clima. Estão juntas para ser fácil ajustar o equilíbrio.
export const TUNING = {
    incomePerProduction: 0.55,
    treeUpkeep: 2,
    filterUpkeep: 1,

    emissionPerProduction: 0.75,
    filterCut: 2.3,
    naturalSink: 11,
    sinkLossPerYear: 0.55, // com o tempo, a natureza absorve menos
    treeSink: 6,
    researchBoost: 0.2,
    greenSink: 4,

    envPerTree: 1.2,
    envPerGreen: 0.8,
    envPerProduction: 0.07,
    envYearPressure: 0.22,
    envCo2Limit: 420,
    envCo2Divisor: 25,
};

// Calcula o que vai acontecer no fim do ano, sem alterar o estado.
// A tela usa isso na "Previsão do ano".
export function yearForecast(state) {
    const t = TUNING;

    const maintenance = state.trees * t.treeUpkeep + state.filters * t.filterUpkeep;
    const revenue = Math.round(state.production * t.incomePerProduction);
    const income = revenue - maintenance;

    const emission = Math.max(0, state.production * t.emissionPerProduction - state.filters * t.filterCut);
    const natural = Math.max(2, t.naturalSink - (state.year - 1) * t.sinkLossPerYear);
    const absorption =
        natural +
        state.trees * t.treeSink * (1 + t.researchBoost * state.research) +
        state.greens * t.greenSink;
    const co2Delta = Math.round(emission - absorption);

    const co2After = clamp(state.co2 + co2Delta, ...RANGE.co2);
    const recovery = co2After < 380 ? (380 - co2After) / 40 : 0;
    const envDelta = Math.round(
        t.envPerTree * state.trees +
        t.envPerGreen * state.greens -
        state.production * t.envPerProduction -
        (state.year - 1) * t.envYearPressure -
        Math.max(0, co2After - t.envCo2Limit) / t.envCo2Divisor +
        recovery
    );

    return {
        revenue,
        income,
        maintenance,
        emission: Math.round(emission),
        absorption: Math.round(absorption),
        co2Delta,
        envDelta,
    };
}

export function endYear(state) {
    const report = yearForecast(state);

    change(state, { money: report.income, co2: report.co2Delta, environment: report.envDelta });

    report.health = planetHealth(state);
    report.scoreGain = Math.round(state.production * 0.3 + report.health * 0.5 + state.trees * 4);
    state.score += report.scoreGain;

    return report;
}

// Depois do evento do ano: confere se acabou, ou passa para o próximo ano.
export function advance(state) {
    if (state.environment <= 0 || planetHealth(state) <= GAME_OVER_HEALTH) {
        state.over = true;
    } else if (state.year >= YEARS) {
        state.finished = true;
        state.score += finalResult(state).bonus;
    } else {
        state.year += 1;
        state.actions = ACTIONS_PER_YEAR;
    }

    return state;
}


/* ---------- eventos ---------- */

// Cada evento muda o estado por "effect" (valores fixos) ou por "resolve" (depende do jogo).
// Os eventos com "choices" pedem uma decisão do jogador (a tela monta o texto dos efeitos sozinha).
export const EVENTS = [
    {
        id: "heatwave",
        title: "Onda de calor",
        text: "As máquinas e os ar-condicionados trabalham mais, e as emissões sobem.",
        effect: { co2: 18, environment: -3 },
    },
    {
        id: "subsidy",
        title: "Incentivo do governo",
        text: "O governo apoia empresas que investem em projetos verdes.",
        when: (s) => s.trees + s.greens + s.filters > 0,
        effect: { money: 25 },
    },
    {
        id: "inspection",
        title: "Fiscalização ambiental",
        text: "Fiscais visitam a fábrica para avaliar o impacto no ambiente.",
        resolve: (s) =>
            s.environment < 45
                ? { note: "Encontraram problemas e aplicaram uma multa.", effect: { money: -20 } }
                : { note: "Eles elogiaram as suas práticas.", effect: { money: 15, environment: 3 } },
    },
    {
        id: "rain",
        title: "Chuva forte",
        text: "A chuva limpa o ar e renova a vegetação.",
        effect: { co2: -18, environment: 3 },
    },
    {
        id: "investor",
        title: "Investidor interessado",
        text: "Um investidor oferece 40 esmeraldas para a fábrica crescer mais rápido.",
        choices: [
            {
                label: "Aceitar a oferta",
                effect: { money: 40, production: 10, co2: 10, environment: -6 },
            },
            {
                label: "Recusar e manter o foco",
                effect: { environment: 2 },
            },
        ],
    },
    {
        id: "spill",
        title: "Vazamento na fábrica",
        text: "Um tanque vazou e o líquido está indo para o solo.",
        choices: [
            {
                label: "Limpar agora",
                cost: 15,
                effect: { environment: -2 },
            },
            {
                label: "Deixar para depois",
                effect: { environment: -12, co2: 8 },
            },
        ],
    },
    {
        id: "neighbors",
        title: "Moradores querem mais verde",
        text: "Os vizinhos pedem uma praça com árvores perto da fábrica.",
        when: (s) => s.greens < 3,
        choices: [
            {
                label: "Atender o pedido",
                cost: 10,
                effect: { environment: 6 },
            },
            {
                label: "Ignorar",
                effect: { environment: -4 },
            },
        ],
    },
    {
        id: "students",
        title: "Visita de estudantes",
        text: "Alunos conhecem a Árvore-Líquida e divulgam o projeto.",
        when: (s) => s.trees > 0,
        effect: { environment: 5, money: 8 },
    },
    {
        id: "demand",
        title: "Alta demanda",
        text: "Os clientes querem mais produtos neste ano.",
        effect: { production: 8, money: 12 },
    },
    {
        id: "drought",
        title: "Seca",
        text: "Faltou chuva, e a vegetação ao redor sofreu.",
        effect: { environment: -6, production: -4 },
    },
    {
        id: "grant",
        title: "Prêmio de inovação",
        text: "Sua pesquisa chamou a atenção e ganhou um prêmio.",
        when: (s) => s.research > 0,
        effect: { money: 30 },
    },
    {
        id: "algae",
        title: "Algas saudáveis",
        text: "As microalgas cresceram bem e absorveram ainda mais CO₂.",
        when: (s) => s.trees > 0,
        resolve: (s) => ({ effect: { co2: -5 * s.trees } }),
    },
    {
        id: "quiet",
        title: "Ano tranquilo",
        text: "Nada fora do comum aconteceu. Aproveite para planejar.",
        effect: { money: 5 },
    },
];

// Sorteia um evento que faça sentido para o momento do jogo.
export function pickEvent(state, random = Math.random) {
    const pool = EVENTS.filter((e) => e.id !== state.lastEvent && (!e.when || e.when(state)));
    return pool[Math.floor(random() * pool.length)];
}

// Aplica o efeito de um evento (ou de uma escolha dele) e devolve o que mudou.
export function runEffect(state, option) {
    const resolved = option.resolve ? option.resolve(state) : option;
    const cost = option.cost ?? 0;

    state.money -= cost;
    const done = change(state, resolved.effect ?? {});

    return { done, cost, note: resolved.note ?? "" };
}


/* ---------- resultado final ---------- */

export function finalResult(state) {
    const health = planetHealth(state);
    const points =
        0.55 * health + 0.25 * state.production + 0.2 * Math.min(100, state.money / 2.5);

    // a nota depende dos pontos, mas a saúde do planeta limita o teto
    const byPoints = points >= 82 ? 4 : points >= 70 ? 3 : points >= 58 ? 2 : points >= 46 ? 1 : 0;
    const byHealth = health >= 80 ? 4 : health >= 65 ? 3 : health >= 50 ? 2 : health >= 40 ? 1 : 0;
    const level = Math.min(byPoints, byHealth);

    const grade = ["D", "C", "B", "A", "S"][level];
    const text = [
        ["O planeta sofreu", "Você chegou ao fim, mas o planeta ficou muito degradado."],
        ["Passou por pouco", "O planeta resistiu, mas está bem machucado."],
        ["Bom resultado", "A empresa foi bem, mas ainda dá para cuidar mais do planeta."],
        ["Excelente trabalho!", "Ótimo equilíbrio entre lucro e meio ambiente."],
        ["Futuro sustentável!", "A empresa cresceu e o planeta continuou saudável."],
    ][level];

    return { grade, level, title: text[0], text: text[1], health, bonus: level * 60 };
}
