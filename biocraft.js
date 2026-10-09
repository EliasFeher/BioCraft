import { $, clamp, reduceMotion } from "./utils.js";
import { THREE, createStage, trackPointer, seededRandom } from "./scene-utils.js";
import { createBlockMaterials } from "./blocks.js";
import "./game.js";


/* ---------- menu mobile ---------- */

const navbar = $("navbar");
const menuBtn = $("menuBtn");

menuBtn.addEventListener("click", () => {
    const open = navbar.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
});

$("navLinks").addEventListener("click", () => {
    navbar.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", false);
});


/* ---------- ilha de blocos da home ---------- */

const modelContainer = $("model-container");

if (modelContainer) {
    const stage = createStage(modelContainer, { fov: 40, z: 9.5 });

    stage.scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(3, 7, 5);
    stage.scene.add(sun);

    const SIZE = 0.42;
    const geometry = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    const materials = createBlockMaterials();
    const random = seededRandom(5);
    const island = new THREE.Group();

    // coordenadas em blocos; o -0.5 em y centraliza a ilha na tela
    function place(type, x, y, z) {
        const block = new THREE.Mesh(geometry, materials[type]);
        block.position.set(x * SIZE, (y - 0.5) * SIZE, z * SIZE);
        island.add(block);
    }

    // terreno: cada camada é um disco menor que a de cima, com a borda irregular
    const LAYERS = [
        { y: 0, radius: 4.3, type: "grass" },
        { y: -1, radius: 3.8, type: "dirt" },
        { y: -2, radius: 3.0, type: "dirt" },
        { y: -3, radius: 2.2, type: "stone" },
        { y: -4, radius: 1.4, type: "stone" },
        { y: -5, radius: 0.6, type: "stone" },
    ];

    LAYERS.forEach(({ y, radius, type }) => {
        for (let x = -4; x <= 4; x++) {
            for (let z = -4; z <= 4; z++) {
                if (Math.hypot(x, z) <= radius + (random() - 0.5) * 0.9) place(type, x, y, z);
            }
        }
    });

    // árvore
    const TREE = { x: -1, z: 1 };
    for (let y = 1; y <= 4; y++) place("log", TREE.x, y, TREE.z);

    for (let y = 3; y <= 6; y++) {
        const reach = y <= 4 ? 2 : 1;

        for (let dx = -reach; dx <= reach; dx++) {
            for (let dz = -reach; dz <= reach; dz++) {
                const corner = Math.abs(dx) === reach && Math.abs(dz) === reach;
                const onTrunk = dx === 0 && dz === 0 && y <= 4;
                const topPlus = y === 6 && corner;

                if (onTrunk || topPlus || (corner && random() < 0.4)) continue;
                place("leaves", TREE.x + dx, y, TREE.z + dz);
            }
        }
    }

    const HOME = { x: 0.28, y: 0.7 };
    const target = { ...HOME };
    const pointer = trackPointer(modelContainer);

    island.rotation.set(HOME.x, HOME.y, 0);
    stage.scene.add(island);

    stage.onFrame = (time, dt) => {
        if (pointer.over) {
            target.y = HOME.y + (pointer.x - 0.5) * 1.6;
            target.x = HOME.x + (pointer.y - 0.5) * 0.6;
        } else if (!reduceMotion) {
            target.y += 0.24 * dt;
        }

        island.rotation.y += (target.y - island.rotation.y) * 0.05;
        island.rotation.x += (target.x - island.rotation.x) * 0.05;
        island.position.y = reduceMotion ? 0 : Math.sin(time * 0.0015) * 0.1;
    };
}


/* ---------- monitoramento ---------- */

// Os valores abaixo são simulados. Para ligar no sensor de verdade,
// troque updateSensor() por uma leitura da API do projeto físico.

const chart = {
    line: $("chartLine"),
    area: $("chartArea"),
    points: $("chartPoints"),
    width: 1000,
    height: 300,
    min: 200,
    max: 600,
};

const sensor = {
    co2: $("physicalCo2"),
    temp: $("physicalTemp"),
    humidity: $("physicalHumidity"),
    quality: $("physicalQuality"),
};

const readings = [390, 410, 450, 430, 470, 510, 480, 440, 460, 420, 400, 420];

const QUALITY = {
    good: "BOA",
    moderate: "MODERADA",
    warning: "ATENÇÃO",
};

function qualityFor(co2) {
    if (co2 < 450) return "good";
    if (co2 < 500) return "moderate";
    return "warning";
}

function drawChart() {
    const coords = readings.map((value, i) => [
        (i * chart.width) / (readings.length - 1),
        chart.height - ((value - chart.min) / (chart.max - chart.min)) * chart.height,
    ]);

    const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
    const [firstX] = coords[0];
    const [lastX] = coords[coords.length - 1];

    chart.line.setAttribute("points", line);
    chart.area.setAttribute("d", `M ${line.replaceAll(" ", " L ")} L ${lastX},${chart.height} L ${firstX},${chart.height} Z`);
    // um segmento de comprimento zero com ponta redonda vira uma bolinha
    chart.points.setAttribute("d", coords.map(([x, y]) => `M ${x} ${y} h0`).join(" "));
}

function updateSensor() {
    const last = readings[readings.length - 1];
    const next = clamp(last + Math.floor(Math.random() * 41) - 20, 300, 550);

    readings.push(next);
    readings.shift();

    sensor.co2.textContent = next;
    sensor.temp.textContent = `${(23 + Math.random() * 5).toFixed(1)}°C`;
    sensor.humidity.textContent = `${Math.floor(60 + Math.random() * 16)}%`;

    const quality = qualityFor(next);
    sensor.quality.textContent = QUALITY[quality];
    sensor.quality.dataset.quality = quality;

    drawChart();
}

drawChart();


/* ---------- botão da árvore-líquida (ativar / desativar) ---------- */

// O painel fica fechado até o botão ser acionado. Depois de uma pequena
// sequência de "ligação", o painel abre, o gráfico é desenhado e as leituras começam.
// Com a árvore-líquida ligada, o mesmo botão vira "Desativar" e faz o caminho inverso.

const pulse = {
    section: document.querySelector(".monitor"),
    reveal: $("monitorReveal"),
    btn: $("biopulseBtn"),
    label: $("biopulseLabel"),
    bar: $("biopulseBar"),
    progress: document.querySelector(".biopulse-progress"),
    status: $("biopulseStatus"),
    badge: $("liveBadge"),
    badgeText: $("liveText"),
};

const PULSE_STEPS = [
    "Iniciando sensores...",
    "Calibrando leitura de CO₂...",
    "Conectando à unidade BC-01...",
];
const STEP_TIME = reduceMotion ? 150 : 800;

let pulseState = "off"; // off | loading | on
let sensorTimer = null;
let statusTimer = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// o valor de CO₂ "sobe" de 0 até a leitura atual
function countUp(el, to, duration) {
    const start = performance.now();

    function tick(now) {
        const progress = clamp((now - start) / duration, 0, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
}

async function activateLiquidTree() {
    pulseState = "loading";
    clearTimeout(statusTimer);

    pulse.btn.disabled = true;
    pulse.btn.classList.add("is-loading");
    pulse.label.textContent = "Ativando...";

    // barra de progresso enche durante a sequência
    pulse.bar.style.transition = "none";
    pulse.bar.style.width = "0";
    pulse.progress.classList.add("on");
    pulse.bar.getBoundingClientRect(); // força o navegador a registrar a largura inicial
    pulse.bar.style.transition = `width ${STEP_TIME * PULSE_STEPS.length}ms linear`;
    pulse.bar.style.width = "100%";

    for (const step of PULSE_STEPS) {
        pulse.status.textContent = step;
        await wait(STEP_TIME);
    }

    pulseState = "on";
    pulse.btn.disabled = false;
    pulse.btn.classList.replace("is-loading", "is-active");
    pulse.label.textContent = "Desativar Árvore-Líquida";
    pulse.status.textContent = "Unidade BC-01 conectada. Nova leitura a cada 3 segundos.";
    pulse.progress.classList.remove("on");
    pulse.badge.classList.add("on");
    pulse.badgeText.textContent = "AO VIVO";

    // abre o painel e começa a atualizar os dados
    pulse.section.classList.add("is-active");
    pulse.reveal.removeAttribute("inert");

    if (!reduceMotion) countUp(sensor.co2, readings[readings.length - 1], 1400);
    sensorTimer = setInterval(updateSensor, 3000);

    // garante que o painel aberto aparece na tela
    setTimeout(() => pulse.reveal.scrollIntoView({ behavior: "smooth", block: "nearest" }), reduceMotion ? 100 : 1000);
}

function deactivateLiquidTree() {
    pulseState = "off";
    clearInterval(sensorTimer);

    pulse.btn.classList.remove("is-active");
    pulse.label.textContent = "Ativar Árvore-Líquida";
    pulse.badge.classList.remove("on");
    pulse.badgeText.textContent = "STANDBY";

    // fecha o painel
    pulse.section.classList.remove("is-active");
    pulse.reveal.setAttribute("inert", "");

    pulse.status.textContent = "Árvore-Líquida desativada.";
    statusTimer = setTimeout(() => (pulse.status.textContent = ""), 3000);
}

pulse.btn.addEventListener("click", () => {
    if (pulseState === "off") activateLiquidTree();
    else if (pulseState === "on") deactivateLiquidTree();
});


/* ---------- formulário de contato ---------- */

// Ainda não envia nada: só confirma na tela e limpa os campos.
const form = $("contactForm");
const formStatus = $("formStatus");

form.addEventListener("submit", (event) => {
    event.preventDefault();
    formStatus.textContent = "Mensagem enviada! Obrigado pelo contato.";
    form.reset();
    setTimeout(() => (formStatus.textContent = ""), 5000);
});
