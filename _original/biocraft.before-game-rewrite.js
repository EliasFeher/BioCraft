import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const $ = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;


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


/* ---------- helpers do Three.js ---------- */

// Cria cena, câmera e renderer dentro de um container.
// O loop só roda enquanto o container está visível na tela.
function createStage(container, { fov, z }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
    camera.position.set(0, 0.2, z);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    new ResizeObserver(() => {
        const { clientWidth: w, clientHeight: h } = container;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    }).observe(container);

    let visible = true;
    new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(container);

    const stage = { scene, camera, renderer, onFrame: null };
    let last = 0;

    renderer.setAnimationLoop((time) => {
        const dt = Math.min((time - last) / 1000, 0.05);
        last = time;
        if (!visible) return;
        stage.onFrame?.(time, dt);
        renderer.render(scene, camera);
    });

    return stage;
}

function addLights(scene, { blue = true } = {}) {
    scene.add(new THREE.AmbientLight(0xffffff, 2));

    const sun = new THREE.DirectionalLight(0xffffff, 4);
    sun.position.set(4, 6, 5);
    scene.add(sun);

    const green = new THREE.PointLight(0x7cff9a, 5, 12);
    green.position.set(-3, 2, 4);
    scene.add(green);

    if (blue) {
        const cyan = new THREE.PointLight(0x36b8ff, 3, 10);
        cyan.position.set(4, -2, 3);
        scene.add(cyan);
    }
}

// Acompanha a posição do ponteiro (0 a 1) dentro de um elemento.
function trackPointer(el) {
    const pointer = { x: 0.5, y: 0.5, over: false };

    el.addEventListener("pointerenter", () => (pointer.over = true));
    el.addEventListener("pointerleave", () => (pointer.over = false));
    el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        pointer.x = (e.clientX - rect.left) / rect.width;
        pointer.y = (e.clientY - rect.top) / rect.height;
    });

    return pointer;
}

// Gerador pseudo-aleatório com semente, para o totem ficar igual a cada carregamento.
function seededRandom(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


/* ---------- ilha de blocos da home ---------- */

// Texturas 16x16 desenhadas no canvas, sem filtro, para ficarem pixeladas como no jogo.
function pixelTexture(draw) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    draw(canvas.getContext("2d"));

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

const pick = (random, list) => list[Math.floor(random() * list.length)];

function fillNoise(ctx, random, colors) {
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            ctx.fillStyle = pick(random, colors);
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

const PALETTE = {
    grass: ["#5d9e46", "#6aae4f", "#74b957", "#5a9442"],
    dirt: ["#866043", "#7a5534", "#8b6a4a", "#6f4c30", "#94704f"],
    stone: ["#7d7d7d", "#8a8a8a", "#6f6f6f", "#939393"],
    bark: ["#6b5231", "#5a4325", "#7a5f3b"],
    leaves: ["#2f7a2a", "#3d8f35", "#256b22", "#4aa03f"],
};

function createBlockMaterials() {
    const random = seededRandom(11);

    const textures = {
        grassTop: pixelTexture((ctx) => fillNoise(ctx, random, PALETTE.grass)),
        dirt: pixelTexture((ctx) => fillNoise(ctx, random, PALETTE.dirt)),
        stone: pixelTexture((ctx) => fillNoise(ctx, random, PALETTE.stone)),

        // lateral: terra com uma franja de grama irregular no topo
        grassSide: pixelTexture((ctx) => {
            fillNoise(ctx, random, PALETTE.dirt);
            for (let x = 0; x < 16; x++) {
                const depth = 3 + (random() < 0.5 ? 1 : 0) + (random() < 0.2 ? 1 : 0);
                for (let y = 0; y < depth; y++) {
                    ctx.fillStyle = pick(random, PALETTE.grass);
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }),

        logSide: pixelTexture((ctx) => {
            for (let x = 0; x < 16; x++) {
                for (let y = 0; y < 16; y++) {
                    ctx.fillStyle = random() < 0.25 ? pick(random, PALETTE.bark) : PALETTE.bark[x % 3];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }),

        // topo do tronco: casca por fora e anéis de madeira por dentro
        logTop: pixelTexture((ctx) => {
            for (let x = 0; x < 16; x++) {
                for (let y = 0; y < 16; y++) {
                    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
                    ctx.fillStyle = d >= 6.5 ? pick(random, PALETTE.bark) : Math.floor(d) % 2 ? "#b8945f" : "#a98450";
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }),

        // folhas com furinhos transparentes
        leaves: pixelTexture((ctx) => {
            fillNoise(ctx, random, PALETTE.leaves);
            for (let x = 0; x < 16; x++) {
                for (let y = 0; y < 16; y++) {
                    if (random() < 0.16) ctx.clearRect(x, y, 1, 1);
                }
            }
        }),
    };

    const material = (map, options) => new THREE.MeshLambertMaterial({ map, ...options });
    const m = {
        grassTop: material(textures.grassTop),
        grassSide: material(textures.grassSide),
        dirt: material(textures.dirt),
        stone: material(textures.stone),
        logSide: material(textures.logSide),
        logTop: material(textures.logTop),
        leaves: material(textures.leaves, { alphaTest: 0.5 }),
    };

    // ordem das faces do cubo: +x, -x, +y (topo), -y (base), +z, -z
    return {
        grass: [m.grassSide, m.grassSide, m.grassTop, m.dirt, m.grassSide, m.grassSide],
        dirt: m.dirt,
        stone: m.stone,
        log: [m.logSide, m.logSide, m.logTop, m.logTop, m.logSide, m.logSide],
        leaves: m.leaves,
    };
}

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


/* ---------- totem 3D (jogo) ---------- */

// Sprite 16x16 do Totem of Undying, cada letra é um voxel.
const TOTEM_SPRITE = [
    ".....KKKKKK.....",
    "....KLGGGGLK....",
    "...KGGEEEEGGK...",
    "...KGKKGGKKGK...",
    "...KGGGGGGGGK...",
    "...KGGGKKGGGK...",
    "....KgGGGGgK....",
    ".KKKKKKEEKKKKKK.",
    ".KEGGGGEEGGGGEK.",
    ".KgGGGGEEGGGGgK.",
    ".KKKKKGEEGKKKKK.",
    ".....KGEEGK.....",
    ".....KGGGGK.....",
    ".....KGEEGK.....",
    ".....KgGGgK.....",
    ".....KKKKKK.....",
];

const TOTEM_COLORS = {
    K: 0x2b1d0e, // contorno
    G: 0xe9b93a, // ouro
    L: 0xffe27a, // brilho
    g: 0xb98a22, // ouro escuro
    E: 0x2fb457, // esmeralda
};

// fração do totem que fica "apagada" em cada nível de dano
const DAMAGE_AMOUNT = [0, 0.12, 0.28, 0.5];

function createTotem(container) {
    const stage = createStage(container, { fov: 35, z: 8 });
    addLights(stage.scene, { blue: false });

    const VOXEL = 0.2;
    const DEPTH = [-1, 0, 1];
    const FLOOR_Y = -1.5;
    const random = seededRandom(7);

    // monta a lista de voxels a partir do sprite
    const voxels = [];
    TOTEM_SPRITE.forEach((row, r) => {
        [...row].forEach((letter, c) => {
            if (letter === ".") return;

            DEPTH.forEach((d) => {
                voxels.push({
                    base: new THREE.Color(TOTEM_COLORS[letter]).multiplyScalar(0.92 + random() * 0.14),
                    home: new THREE.Vector3((c - 7.5) * VOXEL, (7.5 - r) * VOXEL, d * VOXEL),
                    rank: random(), // define a ordem em que os voxels "apagam"
                    broken: false,
                });
            });
        });
    });

    voxels.forEach((v) => {
        v.pos = v.home.clone();
        v.vel = new THREE.Vector3();
        v.rot = new THREE.Vector3();
        v.spin = new THREE.Vector3();
    });

    const mesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(VOXEL * 0.97, VOXEL * 0.97, VOXEL * 0.97),
        new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.2 }),
        voxels.length
    );

    const group = new THREE.Group();
    group.add(mesh);
    stage.scene.add(group);

    const ash = new THREE.Color();
    const tmp = new THREE.Object3D();

    function paint() {
        voxels.forEach((v, i) => {
            if (v.broken) ash.setScalar(0.12 + v.rank * 0.12);
            mesh.setColorAt(i, v.broken ? ash : v.base);
        });
        mesh.instanceColor.needsUpdate = true;
    }

    let shattered = false;
    let level = 0;

    paint();

    const pointer = trackPointer(container);
    let spinY = 0;
    let spinX = 0;

    stage.onFrame = (time, dt) => {
        // movimento: acompanha o mouse; sem mouse, balança devagar
        const sway = reduceMotion ? 0 : Math.sin(time * 0.0006) * 0.5;
        const wantY = pointer.over ? (pointer.x - 0.5) * 2.4 : sway;
        const wantX = pointer.over ? (pointer.y - 0.5) * 0.6 : 0;
        spinY += (wantY - spinY) * 0.06;
        spinX += (wantX - spinX) * 0.06;
        group.rotation.set(spinX, spinY, 0);

        group.position.y = shattered || reduceMotion ? 0 : Math.sin(time * 0.0015) * 0.08;
        group.position.x = level === 3 && !shattered ? Math.sin(time * 0.09) * 0.03 : 0;

        // cada voxel: se o totem quebrou, cai; senão, volta para o lugar
        const ease = 1 - Math.pow(0.001, dt);

        voxels.forEach((v, i) => {
            if (shattered) {
                v.vel.y -= 9 * dt;
                v.pos.addScaledVector(v.vel, dt);
                v.rot.addScaledVector(v.spin, dt);

                if (v.pos.y < FLOOR_Y) {
                    v.pos.y = FLOOR_Y;
                    v.vel.y *= -0.3;
                    v.vel.x *= 0.8;
                    v.vel.z *= 0.8;
                    v.spin.multiplyScalar(0.7);
                }
            } else {
                v.pos.lerp(v.home, ease);
                v.rot.multiplyScalar(1 - ease);
            }

            tmp.position.copy(v.pos);
            tmp.rotation.set(v.rot.x, v.rot.y, v.rot.z);
            tmp.updateMatrix();
            mesh.setMatrixAt(i, tmp.matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
    };

    return {
        // 0 = inteiro, 1 a 3 = cada vez mais apagado
        setDamage(newLevel) {
            level = newLevel;
            const limit = DAMAGE_AMOUNT[newLevel];
            voxels.forEach((v) => (v.broken = v.rank < limit));
            paint();
        },

        shatter() {
            if (shattered) return;
            shattered = true;

            voxels.forEach((v) => {
                v.vel.set((random() - 0.5) * 4, 2 + random() * 3, 1 + random() * 3);
                v.spin.set((random() - 0.5) * 12, (random() - 0.5) * 12, (random() - 0.5) * 12);
            });
        },

        reset() {
            shattered = false;
            this.setDamage(0);
        },
    };
}

const totem = createTotem($("totemStage"));


/* ---------- jogo ---------- */

const ui = {
    production: $("productionValue"),
    environment: $("environmentValue"),
    co2: $("gameCo2"),
    score: $("gameScore"),
    productionBar: $("productionBar"),
    environmentBar: $("environmentBar"),
    co2Bar: $("co2GameBar"),
    message: $("gameMessage"),
    result: $("gameResult"),
};

const choiceButtons = document.querySelectorAll(".choice-btn");

const newGame = () => ({ production: 50, environment: 50, co2: 400, score: 100, over: false });
let game = newGame();

// CO₂ abaixo desses valores deixa o totem mais danificado
const CO2_LEVELS = [
    { max: 180, level: 3, text: "O equilíbrio foi perdido." },
    { max: 220, level: 3, text: "O totem está prestes a quebrar!" },
    { max: 270, level: 2, text: "O ambiente está entrando em uma zona crítica." },
    { max: 330, level: 1, text: "O equilíbrio ambiental está começando a ser afetado." },
];

function render() {
    ui.production.textContent = game.production;
    ui.environment.textContent = game.environment;
    ui.co2.textContent = `${game.co2} ppm`;
    ui.score.textContent = Math.max(0, Math.round(game.score));

    ui.productionBar.style.width = `${clamp(game.production, 0, 100)}%`;
    ui.environmentBar.style.width = `${clamp(game.environment, 0, 100)}%`;
    // barra do CO₂: 200 ppm = 0%, 700 ppm = 100%
    ui.co2Bar.style.width = `${clamp(((game.co2 - 200) / 500) * 100, 0, 100)}%`;

    const state = CO2_LEVELS.find((s) => game.co2 <= s.max);
    game.over = game.co2 <= 180;

    totem.setDamage(state ? state.level : 0);
    ui.message.textContent = state ? state.text : "O planeta está equilibrado.";
    ui.result.innerHTML = "";

    if (game.over) {
        totem.shatter();
        ui.result.innerHTML =
            "<strong>GAME OVER</strong><br>" +
            "Você reduziu o CO₂ além do limite necessário para manter o equilíbrio do ambiente.";
    } else if (
        game.production >= 85 &&
        game.environment >= 70 &&
        game.co2 >= 250 &&
        game.co2 <= 400
    ) {
        ui.result.innerHTML =
            "<strong>Excelente empreendimento!</strong><br>" +
            "Você encontrou um bom equilíbrio entre crescimento e sustentabilidade.";
    }

    choiceButtons.forEach((btn) => (btn.disabled = game.over));
}

choiceButtons.forEach((button) => {
    button.addEventListener("click", () => {
        if (game.over) return;

        const production = Number(button.dataset.production);
        const environment = Number(button.dataset.environment);
        const co2 = Number(button.dataset.co2);
        const cost = Number(button.dataset.cost);

        game.production = clamp(game.production + production, 0, 100);
        game.environment = clamp(game.environment + environment, 0, 100);
        game.co2 += co2;

        // mais produção e sustentabilidade somam pontos; emitir CO₂ e gastar custa
        game.score += production * 0.8 + environment * 1.2;
        game.score -= Math.max(0, co2) * 0.2 + cost * 0.5;

        render();
    });
});

$("restartGame").addEventListener("click", () => {
    game = newGame();
    totem.reset();
    render();
});

render();


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
