import { THREE, seededRandom } from "./scene-utils.js";

// Texturas 16x16 desenhadas no canvas, sem filtro, para ficarem pixeladas como no jogo.
export function pixelTexture(draw) {
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

export function createBlockMaterials() {
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
