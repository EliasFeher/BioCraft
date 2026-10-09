// Regras do jogo, sem nada de tela: só números e decisões.
// Assim dá para testar o equilíbrio sem abrir o navegador.

export const START = { economy: 50, sustainability: 60 };

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));


/* ---------- as sete situações ---------- */

// options[0] fica na esquerda e options[1] na direita.
// economy e sustainability dizem quanto cada medidor muda; focus diz o que a escolha protege.
export const CARDS = [
    {
        id: "defeito",
        title: "Defeito na praça",
        who: { name: "Marina", role: "Técnica de campo", look: "tecnica" },
        text: "Uma Árvore-Líquida da praça central parou de circular a água e as algas estão ficando amarelas. O reparo custa R$ 8 mil. Se esperar, ela talvez se recupere sozinha… ou não.",
        options: [
            {
                label: "Consertar agora",
                focus: "planeta",
                economy: -12,
                sustainability: 10,
                result: "Em dois dias o tanque voltou a ficar verde e a absorver CO₂. O reparo pesou no caixa, mas a praça continua respirando.",
            },
            {
                label: "Deixar assim",
                focus: "economia",
                economy: 6,
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
                label: "Pular o teste",
                focus: "economia",
                economy: 14,
                sustainability: -10,
                result: "Tudo ficou pronto no prazo e o contrato rendeu bem. Mas dois tanques entraram com a água fora do padrão e as algas sofreram.",
            },
            {
                label: "Pedir mais prazo",
                focus: "planeta",
                economy: -6,
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
                label: "Recusar a condição",
                focus: "planeta",
                economy: -4,
                sustainability: 8,
                result: "Você seguiu com material reciclado. Cresceu mais devagar, mas sem deixar lixo pelo caminho.",
            },
            {
                label: "Aceitar o dinheiro",
                focus: "economia",
                economy: 18,
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
                label: "Adiar a visita",
                focus: "economia",
                economy: 4,
                sustainability: -5,
                result: "A manutenção seguiu em dia, mas a escola ficou chateada e o bairro perdeu a chance de conhecer o projeto.",
            },
            {
                label: "Receber a turma",
                focus: "planeta",
                economy: -6,
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
                label: "Tratar a água",
                focus: "planeta",
                economy: -9,
                sustainability: 10,
                result: "A água saiu limpa e ainda virou adubo para os canteiros da praça. Custou caro, mas o córrego continuou limpo.",
            },
            {
                label: "Despejar no córrego",
                focus: "economia",
                economy: 8,
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
                label: "Manter como está",
                focus: "economia",
                economy: 6,
                sustainability: 0,
                result: "Nada mudou: o caixa respirou, mas a BioCraft perdeu a chance de capturar mais carbono.",
            },
            {
                label: "Investir na nova alga",
                focus: "planeta",
                economy: -14,
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
                label: "Exigir que ela reduza",
                focus: "planeta",
                economy: -8,
                sustainability: 14,
                result: "A fábrica resistiu, mas aceitou um plano para emitir menos. Compensar só funciona quando a poluição cai de verdade.",
            },
            {
                label: "Assinar o contrato",
                focus: "economia",
                economy: 20,
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
        picks: [], // 0 = esquerda, 1 = direita
        over: null, // null enquanto joga; depois "falencia", "colapso" ou "fim"
    };
}

export const currentCard = (game) => CARDS[game.step] ?? null;

// Aplica a escolha da esquerda (0) ou da direita (1) e devolve o que mudou de verdade.
export function choose(game, side) {
    const card = CARDS[game.step];
    const option = card.options[side];
    const before = { economy: game.economy, sustainability: game.sustainability };

    game.economy = clamp(game.economy + option.economy, 0, 100);
    game.sustainability = clamp(game.sustainability + option.sustainability, 0, 100);
    game.picks.push(side);
    game.step += 1;

    if (game.economy <= 0) game.over = "falencia";
    else if (game.sustainability <= 0) game.over = "colapso";
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

// Tamanho da bolinha que avisa que um medidor vai mudar: 0 (nada), 1, 2 ou 3.
export function dotSize(amount) {
    const size = Math.abs(amount);
    return size === 0 ? 0 : size <= 6 ? 1 : size <= 12 ? 2 : 3;
}

// Quantas vezes o jogador protegeu o planeta e quantas protegeu a economia.
export function tally(game) {
    const count = { planeta: 0, economia: 0 };
    game.picks.forEach((side, i) => (count[CARDS[i].options[side].focus] += 1));
    return count;
}


/* ---------- finais ---------- */

const GOOD = 55; // a partir daqui o medidor conta como "bem"

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
    crise: {
        title: "Crise dos dois lados",
        mood: "lost",
        text: "O dinheiro está curto e o ar está pesado. Faltou equilíbrio para proteger a empresa e o planeta ao mesmo tempo.",
    },
    falencia: {
        title: "A BioCraft faliu",
        mood: "lost",
        text: "Sem dinheiro para a equipe e a manutenção, as Árvores-Líquidas foram desligadas. Sustentabilidade sem caixa não se sustenta.",
    },
    colapso: {
        title: "O totem se desfez",
        mood: "lost",
        text: "O ar ficou pesado demais e o planeta não resistiu. De nada adianta lucrar numa cidade onde não dá mais para respirar.",
    },
};

export function endingOf(game) {
    if (game.economy <= 0) return "falencia";
    if (game.sustainability <= 0) return "colapso";

    const rich = game.economy >= GOOD;
    const green = game.sustainability >= GOOD;

    if (rich && green) return "equilibrio";
    if (green) return "planeta";
    if (rich) return "lucro";
    return "crise";
}


/* ---------- totem ---------- */

// Quanto do totem fica "queimado" e quanto cai, de acordo com a sustentabilidade.
export function totemDamage(health) {
    return {
        ash: clamp((80 - health) / 80, 0, 1) * 0.9,
        fall: clamp((55 - health) / 55, 0, 1) * 0.6,
    };
}

export function planetMessage(health, over) {
    if (over === "colapso") return "O totem se desfez. O planeta não resistiu.";
    if (health >= 80) return "O totem brilha. O planeta está saudável.";
    if (health >= 60) return "Há sinais de poluição no totem.";
    if (health >= 40) return "O totem está rachando. Hora de agir.";
    if (health >= 20) return "O totem está em perigo! Peças estão caindo.";
    return "O totem está quase se desfazendo!";
}
