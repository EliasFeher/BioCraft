import { THREE, createStage, addLights, trackPointer, seededRandom } from "./scene-utils.js";
import { createBlockMaterials } from "./blocks.js";
import { clamp, reduceMotion } from "./utils.js";
import { totemDamage } from "./game-rules.js";

// Sprite 16x16 do Totem of Undying, cada letra é um voxel.
const SPRITE = [
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

const COLORS = {
    K: 0x2b1d0e, // contorno
    G: 0xe9b93a, // ouro
    L: 0xffe27a, // brilho
    g: 0xb98a22, // ouro escuro
    E: 0x2fb457, // esmeralda
};

const ASH_COLORS = ["#2f2c2a", "#3d3a37", "#4b4743", "#26231f"];

const PARTICLE_COLORS = {
    good: ["#4cff8a", "#a8ffc4", "#ffe27a", "#e9b93a"],
    win: ["#4cff8a", "#ffe27a", "#ffffff", "#e9b93a", "#2fb457"],
    bad: ["#3a3632", "#4b4743", "#26231f", "#6b6560"],
};

const VOXEL = 0.2;
const DEPTH = [-1, 0, 1];
const FLOOR_Y = -1.5; // altura do centro de um voxel apoiado na plataforma
const GROUND = 1.6; // até onde as peças caídas podem ir sem sair da plataforma
const MAX_PARTICLES = 140;

// Cor da luz atrás do totem: verde quando está saudável, vermelha quando está mal.
const AURA = {
    good: new THREE.Color(0x9dff7a),
    warn: new THREE.Color(0xffc84a),
    bad: new THREE.Color(0xff4a3a),
};

function auraColor(health, target) {
    if (health >= 60) return target.copy(AURA.good);
    if (health >= 30) return target.copy(AURA.warn).lerp(AURA.good, (health - 30) / 30);
    return target.copy(AURA.bad).lerp(AURA.warn, health / 30);
}

// Dá a cada voxel uma posição na fila (0 a 1), de acordo com a pontuação.
function assignRanks(list, scoreKey, rankKey, descending = false) {
    [...list]
        .sort((a, b) => (descending ? b[scoreKey] - a[scoreKey] : a[scoreKey] - b[scoreKey]))
        .forEach((voxel, i) => (voxel[rankKey] = i / list.length));
}

export function createTotem(container) {
    const stage = createStage(container, { fov: 35, z: 9.6 });
    addLights(stage.scene, { blue: false });

    // luz de aura, bem na frente do totem
    const aura = new THREE.PointLight(0x9dff7a, 4, 9);
    aura.position.set(0, 0.3, 2.6);
    stage.scene.add(aura);

    const random = seededRandom(7);
    const world = new THREE.Group(); // gira junto: plataforma, totem e peças
    const totem = new THREE.Group();
    world.add(totem);
    stage.scene.add(world);


    /* ----- plataforma de blocos ----- */

    const blocks = createBlockMaterials();
    const BLOCK = 0.5;
    const blockGeometry = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);

    // cada camada é menor que a de cima
    [
        { y: -1.85, half: 3, type: "grass" },
        { y: -2.35, half: 2, type: "dirt" },
        { y: -2.85, half: 1, type: "stone" },
    ].forEach(({ y, half, type }) => {
        for (let x = -half; x <= half; x++) {
            for (let z = -half; z <= half; z++) {
                const block = new THREE.Mesh(blockGeometry, blocks[type]);
                block.position.set(x * BLOCK, y, z * BLOCK);
                world.add(block);
            }
        }
    });


    /* ----- voxels do totem ----- */

    const voxels = [];

    SPRITE.forEach((row, r) => {
        [...row].forEach((letter, c) => {
            if (letter === ".") return;

            DEPTH.forEach((d) => {
                voxels.push({
                    col: c,
                    row: r,
                    base: new THREE.Color(COLORS[letter]).multiplyScalar(0.92 + random() * 0.14),
                    home: new THREE.Vector3((c - 7.5) * VOXEL, (7.5 - r) * VOXEL, d * VOXEL),
                    pos: new THREE.Vector3(),
                    vel: new THREE.Vector3(),
                    rot: new THREE.Vector3(),
                    spin: new THREE.Vector3(),
                    broken: false, // queimado (cinza)
                    fallen: false, // solto, caído na plataforma
                    rest: false,
                });
            });
        });
    });

    // O dano se espalha a partir de alguns focos, como uma mancha de poluição.
    const seeds = [[3, 2], [11, 3], [2, 8], [13, 9], [7, 13], [8, 5]];

    voxels.forEach((v) => {
        v.pos.copy(v.home);
        v.ashScore = Math.min(...seeds.map(([c, r]) => Math.hypot(v.col - c, v.row - r))) + random() * 1.8;
        // quem está mais longe do centro (braços, cabeça, pés) cai primeiro
        v.fallScore = Math.hypot(v.col - 7.5, (v.row - 6.5) * 0.9) + random() * 2.2;
    });

    assignRanks(voxels, "ashScore", "ashRank");
    assignRanks(voxels, "fallScore", "fallRank", true);

    const mesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(VOXEL * 0.97, VOXEL * 0.97, VOXEL * 0.97),
        new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.2 }),
        voxels.length
    );
    mesh.frustumCulled = false;
    totem.add(mesh);

    const ashColor = new THREE.Color();
    const tmp = new THREE.Object3D();

    function paint() {
        voxels.forEach((v, i) => {
            if (v.broken) {
                ashColor.set(ASH_COLORS[i % ASH_COLORS.length]).multiplyScalar(0.8 + v.ashRank * 0.5);
                mesh.setColorAt(i, ashColor);
            } else {
                mesh.setColorAt(i, v.base);
            }
        });
        mesh.instanceColor.needsUpdate = true;
    }

    // Solta um voxel. Quando só algumas peças caem, elas vão para a frente do totem;
    // quando o totem se desfaz, as peças se espalham para todos os lados.
    function release(v, power = 1) {
        v.fallen = true;
        v.rest = false;

        if (power > 1.5) {
            const angle = random() * Math.PI * 2;
            const speed = 0.2 + random() * 0.9;
            v.vel.set(Math.cos(angle) * speed, 1.5 + random() * 2.5, Math.sin(angle) * speed);
        } else {
            v.vel.set(
                (random() - 0.5) * 1.6 + Math.sign(v.home.x || 1) * 0.4,
                0.8 + random() * 1.4,
                0.5 + random()
            );
        }

        v.spin.set((random() - 0.5) * 9, (random() - 0.5) * 9, (random() - 0.5) * 9);
    }

    // Se a peça cair fora da plataforma, traz de volta para perto da borda.
    const onPlatform = (value) =>
        Math.abs(value) > GROUND ? Math.sign(value) * (GROUND - random() * 0.5) : value;


    /* ----- partículas ----- */

    const particles = Array.from({ length: MAX_PARTICLES }, () => ({
        life: 0,
        max: 1,
        size: 0.08,
        gravity: 0,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
    }));

    const particleMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial(),
        MAX_PARTICLES
    );
    particleMesh.frustumCulled = false;
    totem.add(particleMesh);

    const particleColor = new THREE.Color();
    particles.forEach((_, i) => {
        tmp.position.set(0, 0, 0);
        tmp.scale.setScalar(0);
        tmp.updateMatrix();
        particleMesh.setMatrixAt(i, tmp.matrix);
        particleMesh.setColorAt(i, particleColor.set("#ffffff"));
    });

    let nextParticle = 0;

    // "good" e "win" soltam faíscas verdes e douradas; "bad" solta fumaça cinza.
    function burst(kind) {
        const smoke = kind === "bad";
        const count = kind === "win" ? 90 : smoke ? 36 : 44;
        const colors = PARTICLE_COLORS[kind];

        for (let i = 0; i < count; i++) {
            const index = nextParticle++ % MAX_PARTICLES;
            const p = particles[index];

            p.max = p.life = smoke ? 1.3 + random() * 1 : 0.9 + random() * 0.9;
            p.size = smoke ? 0.12 + random() * 0.12 : 0.05 + random() * 0.07;
            p.gravity = smoke ? 0 : -1.4;
            p.pos.set((random() - 0.5) * 2.2, -1.2 + random() * 2.6, (random() - 0.5) * 1.1);
            p.vel.set(
                (random() - 0.5) * (smoke ? 0.5 : 1.3),
                smoke ? 0.5 + random() * 0.8 : 1.2 + random() * 2.2,
                (random() - 0.5) * (smoke ? 0.4 : 1.2)
            );

            particleMesh.setColorAt(index, particleColor.set(colors[Math.floor(random() * colors.length)]));
        }

        particleMesh.instanceColor.needsUpdate = true;
    }


    /* ----- estado e animação ----- */

    let health = 100;
    let shattered = false;
    let spinX = 0;
    let spinY = 0;
    const pointer = trackPointer(container);
    const targetAura = new THREE.Color();

    paint();

    stage.onFrame = (time, dt) => {
        // rotação: acompanha o mouse; sem mouse, balança devagar
        const sway = reduceMotion ? 0 : Math.sin(time * 0.0006) * 0.45;
        spinY += ((pointer.over ? (pointer.x - 0.5) * 2.4 : sway) - spinY) * 0.06;
        spinX += ((pointer.over ? (pointer.y - 0.5) * 0.5 : 0) - spinX) * 0.06;

        world.rotation.set(0.12 + spinX, spinY, 0);
        world.position.y = 0.75 + (reduceMotion ? 0 : Math.sin(time * 0.0012) * 0.05);

        // com a saúde baixa o totem treme
        const shake = shattered ? 0 : clamp((35 - health) / 35, 0, 1) * 0.04;
        totem.position.x = shake ? (Math.random() - 0.5) * shake * 2 : 0;
        totem.position.y = shake ? (Math.random() - 0.5) * shake : 0;

        // luz de aura: muda de cor e fica mais fraca conforme a saúde cai
        auraColor(shattered ? 0 : health, targetAura);
        aura.color.lerp(targetAura, 0.06);

        const flicker = health < 35 && !shattered ? 0.75 + Math.random() * 0.25 : 1;
        const wanted = shattered ? 0.8 : (1.2 + 3.2 * (health / 100)) * flicker;
        aura.intensity += (wanted - aura.intensity) * 0.1;

        // voxels: os soltos caem; os outros voltam para o lugar
        const ease = 1 - Math.pow(0.001, dt);

        voxels.forEach((v, i) => {
            if (v.fallen) {
                if (!v.rest) {
                    v.vel.y -= 9 * dt;
                    v.pos.addScaledVector(v.vel, dt);
                    v.rot.addScaledVector(v.spin, dt);

                    if (v.pos.y <= FLOOR_Y) {
                        v.pos.y = FLOOR_Y;
                        v.pos.x = onPlatform(v.pos.x);
                        v.pos.z = onPlatform(v.pos.z);
                        v.vel.y *= -0.3;
                        v.vel.x *= 0.7;
                        v.vel.z *= 0.7;
                        v.spin.multiplyScalar(0.6);

                        if (Math.abs(v.vel.y) < 0.5) {
                            // para de se mexer e se alinha como um bloco apoiado
                            v.rest = true;
                            v.vel.set(0, 0, 0);
                            v.spin.set(0, 0, 0);
                            v.rot.set(
                                Math.round(v.rot.x / (Math.PI / 2)) * (Math.PI / 2),
                                Math.round(v.rot.y / (Math.PI / 2)) * (Math.PI / 2),
                                Math.round(v.rot.z / (Math.PI / 2)) * (Math.PI / 2)
                            );
                        }
                    }
                }
            } else {
                v.pos.lerp(v.home, ease);
                v.rot.multiplyScalar(1 - ease);
            }

            tmp.position.copy(v.pos);
            tmp.rotation.set(v.rot.x, v.rot.y, v.rot.z);
            tmp.scale.setScalar(1);
            tmp.updateMatrix();
            mesh.setMatrixAt(i, tmp.matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;

        // partículas
        particles.forEach((p, i) => {
            if (p.life > 0) {
                p.life -= dt;
                p.vel.y += p.gravity * dt;
                p.pos.addScaledVector(p.vel, dt);
                tmp.position.copy(p.pos);
                tmp.rotation.set(0, 0, 0);
                tmp.scale.setScalar(Math.max(0, p.size * (p.life / p.max)));
            } else {
                tmp.position.set(0, 0, 0);
                tmp.scale.setScalar(0);
            }

            tmp.updateMatrix();
            particleMesh.setMatrixAt(i, tmp.matrix);
        });

        particleMesh.instanceMatrix.needsUpdate = true;
    };


    /* ----- o que o jogo pode pedir ao totem ----- */

    return {
        // saúde do planeta, de 0 a 100: quanto menor, mais queimado e mais peças caídas
        setHealth(value) {
            health = clamp(value, 0, 100);
            if (shattered) return;

            const { ash, fall } = totemDamage(health);

            voxels.forEach((v) => {
                v.broken = v.ashRank < ash;
                const shouldFall = v.fallRank < fall;

                if (shouldFall && !v.fallen) release(v);
                if (!shouldFall && v.fallen) {
                    v.fallen = false;
                    v.rest = false;
                }
            });

            paint();
        },

        // faíscas ("good", "win") ou fumaça ("bad")
        burst,

        shatter() {
            if (shattered) return;
            shattered = true;
            voxels.forEach((v) => release(v, 2.2));
            burst("bad");
        },

        reset() {
            shattered = false;
            health = 100;

            voxels.forEach((v) => {
                v.broken = false;
                v.fallen = false;
                v.rest = false;
            });

            paint();
        },
    };
}
