import { THREE, createStage, trackPointer, seededRandom } from "./scene-utils.js";
import { createWorldMaterials, createWaterMaterial } from "./world-blocks.js";
import { pixelTexture } from "./blocks.js";
import { buildWorld } from "./world-layout.js";
import { clamp, reduceMotion } from "./utils.js";

// O planeta em 3D: uma ilha de blocos que mostra o que aconteceu no jogo.
// Quem decide o que existe (e onde) é o world-layout.js; aqui só ficam a luz, o céu, o desenho e as animações.

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const smooth = (t) => t * t * (3 - 2 * t);

// o tanque muda de cara conforme o estado da Árvore-Líquida
const TANK = {
    ok: { water: 0x2fe06f, emissive: 0x18c25a, glow: true, level: 0.92, bubbles: 9 },
    murky: { water: 0x93a23d, emissive: 0x4d5a10, glow: false, level: 0.88, bubbles: 2 },
    dead: { water: 0x7a5a30, emissive: 0x000000, glow: false, level: 0.42, bubbles: 0 },
    off: { water: 0x5f7565, emissive: 0x000000, glow: false, level: 0.7, bubbles: 0 },
};

export function createWorld(container) {
    const stage = createStage(container, { fov: 32, z: 48 });
    const { scene, camera, renderer } = stage;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const materials = createWorldMaterials();
    const waterMaterials = {};
    const pointer = trackPointer(container);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    const ambient = new THREE.AmbientLight(0xffffff, 1.5);
    const sun = new THREE.DirectionalLight(0xffffff, 2.8);
    sun.position.set(14, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    scene.add(ambient, sun, sun.target);

    camera.position.set(0, 20, 48);
    camera.lookAt(0, 3, 0);

    let active = null;
    stage.onFrame = (time, dt) => active?.update(time, dt);


    /* ---------- peças pequenas ---------- */

    // um conjunto de cubos iguais, cada um na sua posição
    function instances(material, count, castShadow = false) {
        const mesh = new THREE.InstancedMesh(box, material, count);
        mesh.frustumCulled = false;
        mesh.castShadow = castShadow;
        return mesh;
    }

    function placeAt(mesh, i, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0) {
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, ry, 0);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }

    // cada cor sólida é criada uma vez só e reaproveitada
    const solids = new Map();
    const solidColor = (hex) => {
        if (!solids.has(hex)) solids.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
        return solids.get(hex);
    };

    function part(group, w, h, d, x, y, z, material) {
        const mesh = new THREE.Mesh(box, material);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        group.add(mesh);
        return mesh;
    }

    const creeperSkin = new THREE.MeshLambertMaterial({ map: pixelTexture((ctx) => {
        const R = seededRandom(5);
        for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { ctx.fillStyle = R() < 0.5 ? "#5bd16a" : "#3fae4c"; ctx.fillRect(x, y, 1, 1); }
    }) });
    const creeperFace = new THREE.MeshLambertMaterial({ map: pixelTexture((ctx) => {
        ctx.fillStyle = "#4fc05f";
        ctx.fillRect(0, 0, 16, 16);
        ctx.fillStyle = "#101810";
        ctx.fillRect(3, 4, 3, 3);
        ctx.fillRect(10, 4, 3, 3);
        ctx.fillRect(6, 8, 4, 3);
        ctx.fillRect(5, 10, 2, 4);
        ctx.fillRect(9, 10, 2, 4);
    }) });

    function makeCreeper() {
        const g = new THREE.Group();
        part(g, 0.5, 0.5, 0.5, 0, 1.4, 0, [creeperSkin, creeperSkin, creeperSkin, creeperSkin, creeperFace, creeperSkin]);
        part(g, 0.5, 0.75, 0.25, 0, 0.775, 0, creeperSkin);
        for (const [x, z] of [[-0.125, -0.15], [0.125, -0.15], [-0.125, 0.15], [0.125, 0.15]]) part(g, 0.24, 0.4, 0.24, x, 0.2, z, creeperSkin);
        return g;
    }

    const white = solidColor(0xf5f5f5);
    const orange = solidColor(0xf2a21a);
    const red = solidColor(0xd23a2a);

    function makeChicken() {
        const g = new THREE.Group();
        part(g, 0.4, 0.34, 0.55, 0, 0.42, 0, white);
        part(g, 0.24, 0.3, 0.24, 0, 0.62, 0.27, white);
        part(g, 0.12, 0.08, 0.14, 0, 0.6, 0.42, orange);
        part(g, 0.06, 0.1, 0.06, 0, 0.5, 0.4, red);
        part(g, 0.06, 0.26, 0.06, -0.1, 0.13, 0, orange);
        part(g, 0.06, 0.26, 0.06, 0.1, 0.13, 0, orange);
        return g;
    }

    const skin = solidColor(0xe3b58a);
    const trousers = solidColor(0x3a4a9a);

    function makeVillager(shirtHex, kid) {
        const g = new THREE.Group();
        part(g, 0.22, 0.4, 0.14, 0, 0.2, 0, trousers);
        part(g, 0.3, 0.42, 0.18, 0, 0.6, 0, solidColor(shirtHex));
        part(g, 0.26, 0.26, 0.26, 0, 0.94, 0, skin);
        if (kid) g.scale.setScalar(0.78);
        return g;
    }


    /* ---------- o céu ---------- */

    function skyTexture(top, horizon) {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, `#${top.getHexString()}`);
        gradient.addColorStop(0.75, `#${horizon.getHexString()}`);
        gradient.addColorStop(1, `#${horizon.getHexString()}`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 2, 256);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }


    /* ---------- montagem do planeta ---------- */

    function assemble(layout, spec) {
        const g = spec.green;
        const u = smooth(clamp(g, 0, 1)); // 0 = planeta morto, 1 = planeta lindo
        const random = seededRandom(spec.seed ^ 0x9e3779b9);
        const group = new THREE.Group();
        const island = new THREE.Group();
        const sky = new THREE.Group();
        group.add(island, sky);

        const disposables = [];
        const track = (thing) => (disposables.push(thing), thing);

        // luz e névoa: quente e fraca num planeta doente, clara e forte num planeta saudável
        const skyTop = mix(0x3a2d2a, 0x2f8fff, u);
        const skyHorizon = mix(0xb0683a, 0xcfeaff, u);
        scene.background?.dispose?.();
        scene.background = skyTexture(skyTop, skyHorizon);
        scene.fog = new THREE.Fog(skyHorizon, lerp(40, 70, u), lerp(95, 150, u));
        ambient.color.copy(mix(0xffc79a, 0xffffff, u));
        ambient.intensity = lerp(1.15, 1.65, u);
        sun.color.copy(mix(0xff8f4d, 0xfff4dc, u));
        sun.intensity = lerp(1.5, 3.0, u);


        /* ----- blocos ----- */

        const byType = new Map();
        for (const b of layout.blocks) {
            if (!byType.has(b.t)) byType.set(b.t, []);
            byType.get(b.t).push(b);
        }

        for (const [type, list] of byType) {
            const mesh = new THREE.InstancedMesh(box, materials[type], list.length);
            list.forEach((b, i) => {
                placeAt(mesh, i, b.x, b.y, b.z);
                if (b.c !== undefined) mesh.setColorAt(i, tint.setHex(b.c));
            });
            mesh.frustumCulled = false;
            mesh.castShadow = type !== "glass" && type !== "lamp";
            mesh.receiveShadow = true;
            island.add(track(mesh));
        }


        /* ----- água ----- */

        const quality = layout.water.quality;
        const waterMaterial = (waterMaterials[quality] ??= createWaterMaterial(quality));

        if (layout.water.cells.length) {
            const plane = track(new THREE.PlaneGeometry(1, 1));
            plane.rotateX(-Math.PI / 2);
            const water = new THREE.InstancedMesh(plane, waterMaterial, layout.water.cells.length);
            layout.water.cells.forEach((c, i) => placeAt(water, i, c.x, -0.12, c.z));
            water.frustumCulled = false;
            water.receiveShadow = true;
            island.add(track(water));
        }

        let fallMap = null;
        const fall = layout.water.fall;
        if (fall) {
            fallMap = track(pixelTexture((ctx) => {
                const R = seededRandom(3);
                for (let x = 0; x < 16; x++) {
                    for (let y = 0; y < 16; y++) {
                        ctx.fillStyle = R() < 0.35 ? "#ffffff" : "#cfe2ff";
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }));
            fallMap.wrapS = fallMap.wrapT = THREE.RepeatWrapping;
            fallMap.repeat.set(1, 4);

            const color = quality === "toxic" ? 0x9cd321 : quality === "dirty" ? 0x7a8f3a : 0x3f86ff;
            const curtain = new THREE.Mesh(box, track(new THREE.MeshBasicMaterial({ map: fallMap, color, transparent: true, opacity: 0.82, depthWrite: false })));
            curtain.scale.set(0.8, 10, 0.8);
            curtain.position.set(fall.x - fall.dx * 0.2, -0.12 - 5, fall.z - fall.dz * 0.2);
            island.add(curtain);
        }


        /* ----- Árvores-Líquidas ----- */

        const glassMaterial = track(new THREE.MeshLambertMaterial({ color: 0xd8f7ff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
        const metal = solidColor(0x3b4046);
        const glowMaterial = track(new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }));
        const bubbleList = [];

        for (const tk of layout.tanks) {
            const look = TANK[tk.state];
            const width = tk.size * 0.88;
            const inner = tk.size * 0.74;
            const tankGroup = new THREE.Group();
            tankGroup.position.set(tk.x, tk.y, tk.z);

            part(tankGroup, tk.size * 0.94, 0.2, tk.size * 0.94, 0, 0.1, 0, metal);
            part(tankGroup, tk.size * 0.94, 0.25, tk.size * 0.94, 0, tk.h + 0.125, 0, metal);

            const waterMat = track(new THREE.MeshLambertMaterial({ color: look.water, emissive: look.emissive, emissiveIntensity: tk.state === "ok" ? 0.9 : 0.5 }));
            const level = tk.h * look.level;
            part(tankGroup, inner, level, inner, 0, 0.2 + level / 2, 0, waterMat);

            const glass = new THREE.Mesh(box, glassMaterial);
            glass.scale.set(width, tk.h, width);
            glass.position.y = tk.h / 2;
            glass.renderOrder = 2;
            tankGroup.add(glass);

            if (look.glow) {
                const glow = new THREE.Mesh(box, glowMaterial);
                glow.scale.set(tk.size * 1.12, tk.h * 1.04, tk.size * 1.12);
                glow.position.y = tk.h / 2;
                glow.renderOrder = 3;
                tankGroup.add(glow);
            }

            if (tk.state === "dead") {
                // algas secas penduradas e um pedaço de vidro quebrado no chão
                const dry = solidColor(0x3b2a18);
                for (const dx of [-0.25, 0.05, 0.3]) part(tankGroup, 0.07, level * 0.7, 0.07, dx * tk.size * 0.5, 0.2 + level * 0.65, dx * 0.4, dry);
                part(tankGroup, 0.22, 0.04, 0.3, tk.size * 0.6, 0.02, tk.size * 0.2, glassMaterial);
            }

            island.add(tankGroup);

            for (let n = 0; n < look.bubbles; n++) {
                bubbleList.push({
                    x: tk.x + (random() - 0.5) * inner * 0.7,
                    z: tk.z + (random() - 0.5) * inner * 0.7,
                    y0: tk.y + 0.3,
                    span: Math.max(0.5, level - 0.2),
                    phase: random(),
                    speed: 0.18 + random() * 0.25,
                    size: 0.09 + random() * 0.07,
                    wobble: inner * 0.12,
                });
            }
        }

        let bubbles = null;
        if (bubbleList.length) {
            bubbles = instances(track(new THREE.MeshBasicMaterial({ color: 0xe8fff0, transparent: true, opacity: 0.85 })), bubbleList.length);
            island.add(track(bubbles));
        }


        /* ----- flores, arbustos secos, fogueiras ----- */

        if (layout.flowers.length) {
            const stems = instances(solidColor(0x3f8f35), layout.flowers.length);
            const heads = instances(solidColor(0xffffff), layout.flowers.length);
            layout.flowers.forEach((f, i) => {
                placeAt(stems, i, f.x, f.y + 0.17, f.z, 0.08, 0.34, 0.08);
                placeAt(heads, i, f.x, f.y + 0.4, f.z, 0.24, 0.2, 0.24);
                heads.setColorAt(i, tint.setHex(f.c));
            });
            island.add(track(stems), track(heads));
        }

        if (layout.bushes.length) {
            const dead = instances(solidColor(0x6b5233), layout.bushes.length, true);
            layout.bushes.forEach((b, i) => placeAt(dead, i, b.x, b.y + 0.2, b.z, 0.55, 0.38, 0.55, random() * 3));
            island.add(track(dead));
        }

        let flames = null;
        if (layout.fires.length) {
            flames = instances(track(new THREE.MeshBasicMaterial({ color: 0xff7a1a })), layout.fires.length);
            island.add(track(flames));
        }


        /* ----- bichos e gente ----- */

        const walkers = [];

        for (const m of layout.mobs) {
            const body = m.kind === "creeper" ? makeCreeper() : makeChicken();
            body.position.set(m.x, m.y, m.z);
            island.add(body);
            walkers.push({ body, x: m.x, z: m.z, phase: random() * 6.28, radius: 0.5 + random() * 0.8, speed: 0.00035 + random() * 0.0003 });
        }

        for (const v of layout.villagers) {
            const body = makeVillager(v.shirt, v.kid);
            body.position.set(v.x, v.y, v.z);
            body.rotation.y = random() * 6.28;
            island.add(body);
            walkers.push({ body, x: v.x, z: v.z, phase: random() * 6.28, radius: v.kid ? 0.25 : 0.7, speed: 0.0003 + random() * 0.0002, still: v.kid });
        }


        /* ----- fumaça, cinzas e borboletas ----- */

        const puffs = [];
        let smoke = null;
        const smokeCap = 150;

        if (layout.emitters.length) {
            smoke = instances(track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })), smokeCap);
            for (let i = 0; i < smokeCap; i++) {
                puffs.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0, size: 0 });
                smoke.setColorAt(i, tint.setHex(0xffffff));
                placeAt(smoke, i, 0, -50, 0, 0);
            }
            island.add(track(smoke));
        }
        const accumulators = layout.emitters.map(() => 0);

        const ashCount = g < 0.5 ? Math.round((0.5 - g) * 2 * 150) : 0;
        let ash = null;
        const flakes = [];
        if (ashCount) {
            ash = instances(track(new THREE.MeshBasicMaterial({ color: 0x4a4644 })), ashCount);
            for (let i = 0; i < ashCount; i++) {
                flakes.push({ x: (random() - 0.5) * 28, y: random() * 20 - 4, z: (random() - 0.5) * 28, fall: 1 + random() * 1.4, drift: (random() - 0.5) * 0.8, size: 0.07 + random() * 0.07 });
            }
            island.add(track(ash));
        }

        const butterflyCount = g > 0.68 ? Math.min(14, Math.round((g - 0.62) * 40)) : 0;
        let butterflies = null;
        const fliers = [];
        if (butterflyCount) {
            butterflies = instances(new THREE.MeshBasicMaterial({ color: 0xffffff }), butterflyCount);
            for (let i = 0; i < butterflyCount; i++) {
                butterflies.setColorAt(i, tint.setHex([0xffd93d, 0xff8fd0, 0xffffff, 0x7fd0ff][i % 4]));
                fliers.push({ cx: (random() - 0.5) * 14, cz: (random() - 0.5) * 14, y: 1.6 + random() * 2, r: 1 + random() * 2, speed: 0.4 + random() * 0.5, phase: random() * 6.28 });
            }
            island.add(track(butterflies));
        }


        /* ----- nuvens e sol, que não giram com a ilha ----- */

        const cloudMeshes = [];
        for (const dark of [0, 1]) {
            const list = layout.clouds.filter((c) => c.dark === dark);
            if (!list.length) continue;

            const mesh = instances(track(new THREE.MeshBasicMaterial({ color: dark ? 0x3b3636 : 0xffffff, transparent: true, opacity: dark ? 0.9 : 0.92 })), list.length);
            list.forEach((c, i) => placeAt(mesh, i, c.x, c.y, c.z, c.w, c.h, c.d));
            sky.add(track(mesh));
            cloudMeshes.push({ mesh, list, speed: dark ? 0.35 : 0.55 });
        }

        const sunColor = mix(0xff4a1f, 0xfff2a0, u);
        const sunCube = new THREE.Mesh(box, track(new THREE.MeshBasicMaterial({ color: sunColor, fog: false })));
        sunCube.scale.setScalar(5.5);
        sunCube.position.set(26, 24, -30);
        const halo = new THREE.Mesh(box, track(new THREE.MeshBasicMaterial({ color: sunColor, transparent: true, opacity: 0.22, depthWrite: false, fog: false })));
        halo.scale.setScalar(9.5);
        halo.position.copy(sunCube.position);
        sky.add(sunCube, halo);

        scene.add(group);


        /* ----- animação ----- */

        let yaw = 0.7;
        let lift = 0;
        let born = -1;

        function spawn(emitter, dt, i) {
            accumulators[i] += emitter.rate * dt;
            while (accumulators[i] >= 1) {
                accumulators[i] -= 1;
                const p = puffs.find((q) => q.life <= 0);
                if (!p) return;
                Object.assign(p, {
                    life: 2.4 + random() * 1.2, max: 3.2, x: emitter.x + (random() - 0.5) * 0.3, y: emitter.y, z: emitter.z + (random() - 0.5) * 0.3,
                    vx: 0.15 + random() * 0.25, vz: (random() - 0.5) * 0.15, size: 0.45 + random() * 0.3,
                });
                p.max = p.life;
                p.dark = emitter.dark;
            }
        }

        function simulate(time, dt) {
            layout.emitters.forEach((e, i) => spawn(e, dt, i));

            if (smoke) {
                puffs.forEach((p, i) => {
                    if (p.life > 0) {
                        p.life -= dt;
                        p.x += p.vx * dt;
                        p.y += (1.1 + p.dark * 0.4) * dt;
                        p.z += p.vz * dt;
                        const age = 1 - p.life / p.max;
                        const size = p.size * (0.6 + age * 2.4) * (age > 0.75 ? (1 - age) * 4 : 1);
                        const tone = 0.95 - p.dark * 0.89 + age * 0.08;
                        smoke.setColorAt(i, tint.setRGB(tone, tone, tone));
                        placeAt(smoke, i, p.x, p.y, p.z, Math.max(size, 0.001));
                    } else {
                        placeAt(smoke, i, 0, -50, 0, 0);
                    }
                });
                smoke.instanceMatrix.needsUpdate = true;
                smoke.instanceColor.needsUpdate = true;
            }

            if (ash) {
                flakes.forEach((f, i) => {
                    f.y -= f.fall * dt;
                    f.x += f.drift * dt;
                    if (f.y < -6) {
                        f.y = 14 + random() * 4;
                        f.x = (random() - 0.5) * 28;
                        f.z = (random() - 0.5) * 28;
                    }
                    placeAt(ash, i, f.x, f.y, f.z, f.size, f.size * 0.6, f.size);
                });
                ash.instanceMatrix.needsUpdate = true;
            }

            if (bubbles) {
                const t = time * 0.001;
                bubbleList.forEach((b, i) => {
                    const k = (t * b.speed + b.phase) % 1;
                    placeAt(bubbles, i, b.x + Math.sin(k * 9 + b.phase * 6) * b.wobble, b.y0 + k * b.span, b.z + Math.cos(k * 7 + b.phase * 5) * b.wobble, b.size * (0.5 + 0.5 * Math.sin(k * Math.PI)));
                });
                bubbles.instanceMatrix.needsUpdate = true;
            }

            if (flames) {
                const t = time * 0.001;
                layout.fires.forEach((f, i) => {
                    const flick = 0.75 + 0.35 * Math.sin(t * 9 + i * 1.7) + 0.15 * Math.sin(t * 23 + i);
                    placeAt(flames, i, f.x, f.y + 0.15 * flick, f.z, 0.42, 0.3 + 0.35 * flick, 0.42);
                });
                flames.instanceMatrix.needsUpdate = true;
            }

            if (butterflies) {
                const t = time * 0.001;
                fliers.forEach((b, i) => {
                    const a = t * b.speed + b.phase;
                    const flap = 0.5 + 0.5 * Math.abs(Math.sin(t * 14 + b.phase * 9));
                    placeAt(butterflies, i, b.cx + Math.cos(a) * b.r, b.y + Math.sin(a * 2) * 0.35, b.cz + Math.sin(a * 0.8) * b.r, 0.2 * flap + 0.06, 0.03, 0.17, -a);
                });
                butterflies.instanceMatrix.needsUpdate = true;
            }

            for (const w of walkers) {
                if (w.still) continue;
                const a = time * w.speed + w.phase;
                const nx = w.x + Math.cos(a) * w.radius;
                const nz = w.z + Math.sin(a) * w.radius;
                w.body.rotation.y = Math.atan2(nx - w.body.position.x, nz - w.body.position.z);
                w.body.position.x = nx;
                w.body.position.z = nz;
            }
        }

        // com "reduzir movimento" ligado, as animações rodam um pouquinho e param
        if (reduceMotion) for (let n = 0; n < 40; n++) simulate(2000, 0.1);

        return {
            group,

            update(time, dt) {
                if (born < 0) born = time;
                const grow = clamp((time - born) / 900, 0, 1);
                group.scale.setScalar(lerp(0.6, 1, 1 - Math.pow(1 - grow, 3)));

                // passar o mouse gira a ilha; sem o mouse ela gira devagar sozinha
                if (!reduceMotion) {
                    yaw += (pointer.over ? (pointer.x - 0.5) * 2.6 : 0.16) * dt;
                    island.position.y = Math.sin(time * 0.0012) * 0.18;
                }
                island.rotation.y = yaw;

                lift += ((pointer.over ? (0.5 - pointer.y) * 9 : 0) - lift) * 0.06;
                camera.position.y = 20 + lift;
                camera.lookAt(0, 3, 0);

                if (!reduceMotion) {
                    if (fallMap) fallMap.offset.y -= dt * 1.6;
                    waterMaterial.map.offset.x = (time * 0.00005) % 1;
                    simulate(time, dt);

                    cloudMeshes.forEach(({ mesh, list, speed }) => {
                        list.forEach((c, i) => {
                            c.x += speed * dt;
                            if (c.x > 32) c.x = -32;
                            placeAt(mesh, i, c.x, c.y, c.z, c.w, c.h, c.d);
                        });
                        mesh.instanceMatrix.needsUpdate = true;
                    });
                }
            },

            dispose() {
                scene.remove(group);
                disposables.forEach((thing) => thing.dispose?.());
            },
        };
    }

    function clear() {
        active?.dispose();
        active = null;
        scene.fog = null;
    }

    function show(spec) {
        clear();
        active = assemble(buildWorld(spec), spec);
    }

    return { show, clear };
}
