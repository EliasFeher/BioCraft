import { THREE, seededRandom } from "./scene-utils.js";
import { pixelTexture } from "./blocks.js";
import { BLOCK_TYPES } from "./world-layout.js";

// Texturas 16x16 de todos os blocos do planeta, desenhadas no canvas como as da ilha da página inicial.

const random = seededRandom(41);
const pick = (list) => list[Math.floor(random() * list.length)];

function noise(ctx, colors) {
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
            ctx.fillStyle = pick(colors);
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

const dot = (ctx, x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
};

const DIRT = ["#866043", "#7a5534", "#8b6a4a", "#6f4c30", "#94704f"];
const GRASS = ["#5fb046", "#6cc24e", "#76cf57", "#58a63f"];
const DRY = ["#a9a443", "#b8b04a", "#9a9540", "#c2b552"];
const COARSE = ["#7a6a55", "#6e5f4b", "#85745d", "#65563f"];
const ASH = ["#3d3a38", "#4a4643", "#2e2c2a", "#565250"];

// lateral de um bloco de terra com uma franja irregular em cima
function fringeSide(colors) {
    return pixelTexture((ctx) => {
        noise(ctx, DIRT);
        for (let x = 0; x < 16; x++) {
            const depth = 3 + (random() < 0.5 ? 1 : 0) + (random() < 0.2 ? 1 : 0);
            for (let y = 0; y < depth; y++) dot(ctx, x, y, pick(colors));
        }
    });
}

// tijolos em fileiras, com as juntas deslocadas
function bricks(ctx, colors, mortar, rowHeight = 4, brickWidth = 8) {
    noise(ctx, colors);
    ctx.fillStyle = mortar;

    for (let row = 0; row * rowHeight < 16; row++) {
        const y = row * rowHeight;
        ctx.fillRect(0, y + rowHeight - 1, 16, 1);

        const shift = row % 2 ? brickWidth / 2 : 0;
        for (let x = shift; x < 16 + brickWidth; x += brickWidth) ctx.fillRect(x % 16, y, 1, rowHeight - 1);
    }
}

function cobble(ctx, colors, mortar) {
    noise(ctx, colors);
    ctx.fillStyle = mortar;

    for (const [y, joints] of [[4, [0, 6, 12]], [9, [3, 9, 15]], [14, [0, 7, 13]]]) {
        ctx.fillRect(0, y, 16, 1);
        for (const x of joints) ctx.fillRect(x, y - 4 >= 0 ? y - 4 : 0, 1, 4);
    }
}

function leaves(colors, holes) {
    return pixelTexture((ctx) => {
        noise(ctx, colors);
        for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (random() < holes) ctx.clearRect(x, y, 1, 1);
    });
}

function barkSide(colors) {
    return pixelTexture((ctx) => {
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) dot(ctx, x, y, random() < 0.25 ? pick(colors) : colors[x % colors.length]);
        }
    });
}

function ringsTop(bark, light, dark) {
    return pixelTexture((ctx) => {
        for (let x = 0; x < 16; x++) {
            for (let y = 0; y < 16; y++) {
                const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
                dot(ctx, x, y, d >= 6.5 ? pick(bark) : Math.floor(d) % 2 ? light : dark);
            }
        }
    });
}

export function createWorldMaterials() {
    const lambert = (map, options) => new THREE.MeshLambertMaterial({ map, ...options });
    const solid = (draw, options) => lambert(pixelTexture(draw), options);

    const grassTop = pixelTexture((ctx) => noise(ctx, GRASS));
    const dryTop = pixelTexture((ctx) => noise(ctx, DRY));
    const ashTop = pixelTexture((ctx) => {
        noise(ctx, ASH);
        for (let n = 0; n < 4; n++) dot(ctx, Math.floor(random() * 16), Math.floor(random() * 16), "#a8431a"); // brasas
    });
    const dirt = lambert(pixelTexture((ctx) => noise(ctx, DIRT)));
    const faces = (side, top, bottom) => [side, side, top, bottom, side, side];

    const logSide = lambert(barkSide(["#6b5231", "#5a4325", "#7a5f3b"]));
    const logTop = lambert(ringsTop(["#6b5231", "#5a4325", "#7a5f3b"], "#b8945f", "#a98450"));
    const deadSide = lambert(barkSide(["#3a322b", "#2e2722", "#453b33"]));
    const deadTop = lambert(ringsTop(["#3a322b", "#2e2722"], "#6b5f55", "#5a4f46"));

    const blocks = {
        grass: faces(lambert(fringeSide(GRASS)), lambert(grassTop), dirt),
        grassDry: faces(lambert(fringeSide(DRY)), lambert(dryTop), dirt),
        ash: faces(lambert(fringeSide(ASH)), lambert(ashTop), dirt),
        coarse: solid((ctx) => {
            noise(ctx, COARSE);
            for (let n = 0; n < 7; n++) dot(ctx, Math.floor(random() * 16), Math.floor(random() * 16), "#4a3f30"); // rachaduras
        }),
        dirt,
        stone: solid((ctx) => noise(ctx, ["#7d7d7d", "#8a8a8a", "#6f6f6f", "#939393"])),
        darkstone: solid((ctx) => {
            noise(ctx, ["#3b3b40", "#45454b", "#2f2f34", "#505056"]);
            for (let n = 0; n < 6; n++) dot(ctx, Math.floor(random() * 16), Math.floor(random() * 16), "#121214");
        }),
        sand: solid((ctx) => noise(ctx, ["#e3d59a", "#d9c987", "#ecdfa8", "#d2c17c"])),
        path: solid((ctx) => {
            noise(ctx, ["#b79a62", "#a98c55", "#c4a870", "#9d814b"]);
            for (let n = 0; n < 5; n++) dot(ctx, Math.floor(random() * 16), Math.floor(random() * 16), "#d8c9a0");
        }),
        cobble: solid((ctx) => cobble(ctx, ["#7a7a7a", "#6a6a6a", "#8a8a8a"], "#4f4f4f")),

        log: faces(logSide, logTop, logTop),
        deadLog: faces(deadSide, deadTop, deadTop),
        leaves: lambert(leaves(["#2f8f2a", "#3fa535", "#287d24", "#4ab83d"], 0.16), { alphaTest: 0.5 }),
        leavesAutumn: lambert(leaves(["#c8741f", "#d98a2b", "#b8641a", "#e0a03a", "#a85a14"], 0.24), { alphaTest: 0.5 }),
        moss: solid((ctx) => noise(ctx, ["#4e9a3a", "#5aa845", "#448a32", "#63b44e"])),

        planks: solid((ctx) => {
            noise(ctx, ["#b8945f", "#a98450", "#c4a06a"]);
            for (let y = 3; y < 16; y += 4) for (let x = 0; x < 16; x++) dot(ctx, x, y, "#7a5c34");
        }),
        plankDark: solid((ctx) => {
            noise(ctx, ["#6e5a3c", "#5f4d33", "#7a6544"]);
            for (let y = 3; y < 16; y += 4) for (let x = 0; x < 16; x++) dot(ctx, x, y, "#3d311f");
        }),
        stoneBrick: solid((ctx) => bricks(ctx, ["#8a8a8a", "#7d7d7d", "#969696"], "#5e5e5e", 5, 8)),
        wallWhite: solid((ctx) => noise(ctx, ["#f2efe8", "#e8e5dc", "#fbf9f3", "#ece8df"])),
        brick: solid((ctx) => bricks(ctx, ["#a8402f", "#b84a37", "#98382a"], "#8a8a8a")),
        roofDark: solid((ctx) => bricks(ctx, ["#3c3a40", "#46444b", "#323036"], "#232126", 4, 16)),
        metal: solid((ctx) => {
            noise(ctx, ["#6b7076", "#5e6368", "#787d83"]);
            for (const [x, y] of [[1, 1], [14, 1], [1, 14], [14, 14]]) dot(ctx, x, y, "#2e3135"); // rebites
        }),
        glass: lambert(
            pixelTexture((ctx) => {
                ctx.fillStyle = "rgba(200, 235, 245, 0.32)";
                ctx.fillRect(0, 0, 16, 16);
                ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
                ctx.fillRect(0, 0, 16, 1);
                ctx.fillRect(0, 15, 16, 1);
                ctx.fillRect(0, 0, 1, 16);
                ctx.fillRect(15, 0, 1, 16);
                for (let i = 3; i < 9; i++) dot(ctx, i, 12 - i, "rgba(255, 255, 255, 0.7)");
            }),
            { transparent: true, depthWrite: false }
        ),
        redWool: solid((ctx) => noise(ctx, ["#c93a2e", "#bd3328", "#d4453a"])),
        whiteWool: solid((ctx) => noise(ctx, ["#f3f3f3", "#e9e9e9", "#fafafa"])),
        lime: solid((ctx) => noise(ctx, ["#7ed321", "#74c61c", "#88dc2a"])),
        solar: solid((ctx) => {
            noise(ctx, ["#1f3b73", "#23427f", "#1a3366"]);
            ctx.fillStyle = "#6c93df";
            for (let i = 0; i < 16; i += 4) {
                ctx.fillRect(i, 0, 1, 16);
                ctx.fillRect(0, i, 16, 1);
            }
        }),
        lamp: new THREE.MeshBasicMaterial({
            map: pixelTexture((ctx) => {
                noise(ctx, ["#ffe58a", "#ffd966", "#fff0b0"]);
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(5, 5, 6, 6);
            }),
        }),
        plastic: solid((ctx) => noise(ctx, ["#f4f4f4", "#e6e6e6", "#ffffff", "#dcdcdc"])),
    };

    const missing = BLOCK_TYPES.filter((type) => !blocks[type]);
    if (missing.length) throw new Error(`faltam materiais para: ${missing.join(", ")}`);

    return blocks;
}

// A água tem uma textura de ondinhas que corre devagar. Cada qualidade de água tem a sua cor.
const WATER = {
    clean: { color: 0x3f86ff, opacity: 0.72, emissive: 0x000000 },
    dirty: { color: 0x7a8f3a, opacity: 0.86, emissive: 0x000000 },
    toxic: { color: 0x9cd321, opacity: 0.9, emissive: 0x3f5a08 },
};

export function createWaterMaterial(quality) {
    const map = pixelTexture((ctx) => {
        noise(ctx, ["#ffffff", "#e8f1ff", "#f4f8ff", "#dbe8ff"]);
        for (let n = 0; n < 14; n++) {
            const x = Math.floor(random() * 12);
            const y = Math.floor(random() * 16);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x, y, 3 + Math.floor(random() * 3), 1);
        }
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;

    const { color, opacity, emissive } = WATER[quality];
    const material = new THREE.MeshLambertMaterial({ map, color, emissive, transparent: true, opacity, depthWrite: false });
    return material;
}
