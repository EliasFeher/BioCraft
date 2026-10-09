// Regras do jogo, sem nada de tela: só números e decisões.
// Assim dá para testar o equilíbrio sem abrir o navegador.

export const START = { economy: 50, sustainability: 50 };

// Diferença entre os medidores que faz o totem se desfazer.
export const BREAK_AT = 50;

// Com a saúde a partir daqui o totem brilha, e terminar assim é o final bom.
const SHINE = 80;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));


/* ---------- as sete situações ---------- */

// options[0] fica na esquerda e options[1] na direita.
// economy e sustainability dizem quanto cada medidor muda.
export const CARDS = [
    {
        id: "defeito",
        title: "Defeito na praça",
        who: { name: "Marina", role: "Técnica de campo", look: "tecnica" },
        text: "Uma Árvore-Líquida da praça central parou de circular a água e as algas estão ficando amarelas. O reparo custa R$ 8 mil. Se esperar, ela talvez se recupere sozinha… ou não.",
        options: [
            {
                label: "Consertar agora",                economy: -12,
                sustainability: 10,
                result: "Em dois dias o tanque voltou a ficar verde e a absorver CO₂. O reparo pesou no caixa, mas a praça continua respirando.",
            },
            {
                label: "Deixar assim",                economy: 6,
                sustainability: -14,
                result: "Você poupou o reparo, mas sem circulação as algas morreram em uma semana. O tanque virou só uma caixa d’água parada.",
            },
        ],
    },
    {
        id: "prazo",
        title: "Prazo da inauguração",
        who: { name: "Rogério", role: "Prefeito", look: "prefeito" },
        text: "A prefeitura quer 10 Árvores-Líquidas na avenida nova, prontas em 30 dias. Só dá para cumprir o prazo se o teste de qualidade da água for pulado.",
        options: [
            {
                label: "Pular o teste",                economy: 14,
                sustainability: -10,
                result: "Tudo ficou pronto no prazo e o contrato rendeu bem. Mas dois tanques entraram com a água fora do padrão e as algas sofreram.",
            },
            {
                label: "Pedir mais prazo",                economy: -6,
                sustainability: 9,
                result: "O prefeito reclamou do atraso, mas as dez árvores entraram em funcionamento testadas e seguras.",
            },
        ],
    },
    {
        id: "investidora",
        title: "Dinheiro com condição",
        who: { name: "Helena", role: "Investidora", look: "investidora" },
        text: "Uma investidora quer financiar uma fábrica de tanques e dobrar a produção. A condição é usar plástico barato, sem reciclagem, para baixar o custo.",
        options: [
            {
                label: "Recusar a condição",                economy: -4,
                sustainability: 8,
                result: "Você seguiu com material reciclado. Cresceu mais devagar, mas sem deixar lixo pelo caminho.",
            },
            {
                label: "Aceitar o dinheiro",                economy: 18,
                sustainability: -14,
                result: "A fábrica abriu e os lucros subiram. Em troca, toneladas de plástico novo passaram a ser descartadas todo ano.",
            },
        ],
    },
    {
        id: "escola",
        title: "Visita da escola",
        who: { name: "Ana", role: "Professora", look: "professora" },
        text: "A escola do bairro quer levar 120 alunos para conhecer a Árvore-Líquida. Receber a turma pede um dia sem manutenção e uma equipe de apoio.",
        options: [
            {
                label: "Adiar a visita",                economy: 4,
                sustainability: -5,
                result: "A manutenção seguiu em dia, mas a escola ficou chateada e o bairro perdeu a chance de conhecer o projeto.",
            },
            {
                label: "Receber a turma",                economy: -6,
                sustainability: 12,
                result: "As crianças voltaram para casa querendo cuidar das algas. Os pais passaram a apoiar o projeto no bairro.",
            },
        ],
    },
    {
        id: "agua",
        title: "A água do tanque",
        who: { name: "Seu Carlos", role: "Operador", look: "operador" },
        text: "É dia de trocar a água dos tanques, cheia de nutrientes. Tratar antes de descartar custa R$ 5 mil. Despejar no córrego é de graça e ninguém fiscaliza.",
        options: [
            {
                label: "Tratar a água",                economy: -9,
                sustainability: 10,
                result: "A água saiu limpa e ainda virou adubo para os canteiros da praça. Custou caro, mas o córrego continuou limpo.",
            },
            {
                label: "Despejar no córrego",                economy: 8,
                sustainability: -18,
                result: "Deu certo por uma semana. Depois o córrego ficou verde e fedido, e os moradores descobriram de onde vinha.",
            },
        ],
    },
    {
        id: "alga",
        title: "Uma alga melhor",
        who: { name: "Dr. Pedro", role: "Pesquisador", look: "cientista" },
        text: "Um pesquisador da universidade achou uma alga que captura 30% mais CO₂. Para usá-la, é preciso trocar a água e adaptar todos os tanques.",
        options: [
            {
                label: "Manter como está",                economy: 6,
                sustainability: 0,
                result: "Nada mudou: o caixa respirou, mas a BioCraft perdeu a chance de capturar mais carbono.",
            },
            {
                label: "Investir na nova alga",                economy: -14,
                sustainability: 16,
                result: "Os tanques passaram a capturar bem mais CO₂. O investimento foi alto, mas a BioCraft virou referência na região.",
            },
        ],
    },
    {
        id: "contrato",
        title: "O contrato gigante",
        who: { name: "Augusto", role: "Diretor da metalúrgica", look: "diretor" },
        text: "A maior fábrica da cidade quer pagar a BioCraft para “compensar” as emissões dela no papel, sem reduzir nada. O contrato é enorme.",
        options: [
            {
                label: "Exigir que ela reduza",                economy: -8,
                sustainability: 14,
                result: "A fábrica resistiu, mas aceitou um plano para emitir menos. Compensar só funciona quando a poluição cai de verdade.",
            },
            {
                label: "Assinar o contrato",                economy: 20,
                sustainability: -16,
                result: "O dinheiro entrou e a fábrica continuou poluindo, agora com uma faixa de “carbono neutro” na entrada.",
            },
        ],
    },
];


/* ---------- partida ---------- */

export function newGame() {
    return {
        economy: START.economy,
        sustainability: START.sustainability,
        step: 0, // quantas cartas já foram respondidas
        over: null, // null enquanto joga; depois "falencia", "colapso" ou "fim"
    };
}

export const currentCard = (game) => CARDS[game.step] ?? null;

// Positivo: o planeta está na frente da economia. Negativo: a economia está na frente.
export const imbalance = (game) => game.sustainability - game.economy;

// Saúde do totem, de 0 a 100: cheia com os medidores iguais e zero quando a diferença chega a BREAK_AT.
export const totemHealth = (game) =>
    clamp(Math.round(100 - (Math.abs(imbalance(game)) * 100) / BREAK_AT), 0, 100);

// Aplica a escolha da esquerda (0) ou da direita (1) e devolve o que mudou de verdade.
export function choose(game, side) {
    const card = CARDS[game.step];
    const option = card.options[side];
    const before = { economy: game.economy, sustainability: game.sustainability };

    game.economy = clamp(game.economy + option.economy, 0, 100);
    game.sustainability = clamp(game.sustainability + option.sustainability, 0, 100);
    game.step += 1;

    // o totem quebra quando um lado deixa o outro muito para trás
    if (totemHealth(game) === 0) game.over = imbalance(game) > 0 ? "falencia" : "colapso";
    else if (game.step >= CARDS.length) game.over = "fim";

    return {
        card,
        option,
        change: {
            economy: game.economy - before.economy,
            sustainability: game.sustainability - before.sustainability,
        },
    };
}


/* ---------- finais ---------- */

export const ENDINGS = {
    equilibrio: {
        title: "Equilíbrio verde",
        mood: "won",
        text: "A BioCraft fecha no azul e a cidade respira melhor. Lucro e planeta andaram juntos.",
    },
    planeta: {
        title: "Verde, mas no limite",
        mood: "mixed",
        text: "O ar está mais limpo, mas o caixa está apertado. Dá para seguir, só que será preciso achar mais receita.",
    },
    lucro: {
        title: "Lucro com fumaça",
        mood: "mixed",
        text: "A empresa vai bem, mas a cidade paga a conta. O ar está pesado e o totem está rachado.",
    },
    falencia: {
        title: "A BioCraft faliu",
        mood: "lost",
        text: "Você protegeu o planeta, mas deixou o caixa para trás. Sem dinheiro para a equipe e a manutenção, as Árvores-Líquidas foram desligadas. Sustentabilidade sem caixa não se sustenta.",
    },
    colapso: {
        title: "O planeta não resistiu",
        mood: "lost",
        text: "Você cuidou do lucro, mas deixou o planeta para trás. O ar ficou pesado demais, e de nada adianta lucrar numa cidade onde não dá mais para respirar.",
    },
};

export function endingOf(game) {
    if (game.over !== "fim") return game.over; // o totem quebrou no meio do caminho
    if (totemHealth(game) >= SHINE) return "equilibrio";
    return imbalance(game) > 0 ? "planeta" : "lucro";
}


/* ---------- totem ---------- */

// Quanto do totem fica "queimado" e quanto cai, de acordo com a saúde dele.
export function totemDamage(health) {
    return {
        ash: clamp((80 - health) / 80, 0, 1) * 0.9,
        fall: clamp((55 - health) / 55, 0, 1) * 0.6,
    };
}

const BEHIND = {
    economia: { name: "A economia", of: "da economia" },
    planeta: { name: "O planeta", of: "do planeta" },
};

export function totemMessage(game) {
    if (game.over === "falencia" || game.over === "colapso") return "O totem se desfez. Faltou equilíbrio.";

    const health = totemHealth(game);
    if (health >= SHINE) return "O totem brilha. Economia e planeta estão em equilíbrio.";

    const behind = BEHIND[imbalance(game) > 0 ? "economia" : "planeta"];
    if (health >= 50) return `O totem está rachando. ${behind.name} está ficando para trás.`;
    if (health >= 25) return `Peças estão caindo! Cuide ${behind.of}.`;
    return `O totem está quase se desfazendo! Cuide ${behind.of} agora.`;
}
