// Monta o planeta em blocos a partir do resultado do jogo.
// Aqui só tem números e listas (nada de tela), então dá para conferir o desenho pelo Node.
//
// Eixos: x vai para a direita, y para cima e z para perto da câmera. O bloco (x, y, z) ocupa de x - 0.5 até x + 0.5.
// O chão da ilha fica em y = 0, então a face de cima dele está em y = 0.5.

export const BLOCK_TYPES = [
    // terreno
    "grass", "grassDry", "coarse", "ash", "dirt", "stone", "darkstone", "sand", "path", "cobble",
    // plantas
    "log", "deadLog", "leaves", "leavesAutumn", "moss",
    // construções
    "planks", "plankDark", "stoneBrick", "wallWhite", "brick", "roofDark", "metal", "glass",
    "redWool", "whiteWool", "lime", "solar", "lamp",
    // lixo
    "plastic",
];

const TYPES = new Set(BLOCK_TYPES);

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const lerp = (a, b, t) => a + (b - a) * t;
const rad = (deg) => (deg * Math.PI) / 180;
const polar = (deg, r) => [Math.cos(rad(deg)) * r, Math.sin(rad(deg)) * r];

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Ruído suave: valores que mudam devagar de um lugar para o vizinho (de 0 a 1).
function valueNoise(seed) {
    const hash = (x, z) => {
        let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed | 0, 144665)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const fade = (t) => t * t * (3 - 2 * t);

    return (x, z) => {
        const x0 = Math.floor(x);
        const z0 = Math.floor(z);
        const fx = fade(x - x0);
        const fz = fade(z - z0);
        const a = hash(x0, z0);
        const b = hash(x0 + 1, z0);
        const c = hash(x0, z0 + 1);
        const d = hash(x0 + 1, z0 + 1);
        return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
    };
}

const PLASTIC = [0x3b8cff, 0xff5fa2, 0xf2f2f2, 0xffd23f, 0x4ee0c1];
const FLOWERS = [0xff4d4d, 0xffd93d, 0x4da3ff, 0xffffff, 0xff8fd0, 0xb06cff];
const SHIRTS = [0xd94a3d, 0x3d7fd9, 0xf2c230, 0x9b5de5, 0x2fb457];

export function buildWorld(spec) {
    const g = clamp(spec.green, 0, 1); // saúde da natureza
    const w = clamp(spec.wealth, 0, 1); // tamanho da economia
    const c = spec.choices;
    const closed = spec.closed;
    const abandoned = closed || w < 0.18; // sem dinheiro, as construções ficam largadas
    const ruined = abandoned || g < 0.15; // sem ar para respirar, ninguém mora
    const waterQuality = c.agua === 1 ? "toxic" : g < 0.4 ? "dirty" : "clean";

    const rng = mulberry32(spec.seed);
    const noise = valueNoise(spec.seed);
    const chance = (p) => rng() < p;
    const pick = (list) => list[Math.floor(rng() * list.length)];

    /* ---------- blocos ---------- */

    const blocks = new Map();
    const bk = (x, y, z) => `${x},${y},${z}`;
    const ck = (x, z) => `${x},${z}`;

    function put(x, y, z, type, color) {
        if (!TYPES.has(type)) throw new Error(`tipo de bloco desconhecido: ${type}`);
        blocks.set(bk(x, y, z), color === undefined ? { x, y, z, t: type } : { x, y, z, t: type, c: color });
    }

    const take = (x, y, z) => blocks.delete(bk(x, y, z));

    const tanks = [];
    const flowers = [];
    const bushes = [];
    const fires = [];
    const mobs = [];
    const villagers = [];
    const emitters = [];


    /* ---------- a ilha ---------- */

    const cols = new Map(); // "x,z" -> { x, z, d, top, depth }

    for (let x = -13; x <= 13; x++) {
        for (let z = -13; z <= 13; z++) {
            const d = Math.hypot(x, z);
            const edge = 11.3 + (noise(x * 0.42 + 20, z * 0.42 + 20) - 0.5) * 2.6;
            if (d > edge) continue;

            const depth = clamp(Math.round((edge - d) * 0.75 + 0.8 + (noise(x * 0.7, z * 0.7) - 0.5) * 1.6), 1, 7);
            cols.set(ck(x, z), { x, z, d, top: 0, depth });
        }
    }

    // tira as pontas soltas da borda
    for (let pass = 0; pass < 2; pass++) {
        for (const col of [...cols.values()]) {
            const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => cols.has(ck(col.x + dx, col.z + dz)));
            if (around.length < 2) cols.delete(ck(col.x, col.z));
        }
    }


    /* ---------- lugares reservados ---------- */

    const taken = new Set(); // onde já tem construção, lagoa ou córrego
    const built = new Set(); // só as construções
    const kind = new Map(); // "x,z" -> tipo do chão, quando não é o natural

    function reserve(x0, z0, w0, d0) {
        for (let x = x0; x < x0 + w0; x++) {
            for (let z = z0; z < z0 + d0; z++) {
                taken.add(ck(x, z));
                built.add(ck(x, z));
            }
        }
    }

    function rectFree(x0, z0, w0, d0) {
        for (let x = x0; x < x0 + w0; x++) {
            for (let z = z0; z < z0 + d0; z++) {
                if (!cols.has(ck(x, z)) || taken.has(ck(x, z))) return false;
            }
        }
        return true;
    }

    // Procura um lugar livre perto de (cx, cz), andando para o centro da ilha e para os lados.
    // Deixa uma folga de "pad" blocos em volta e reserva só a construção.
    function findSite(w0, d0, cx, cz, pad = 1) {
        const len = Math.hypot(cx, cz) || 1;
        const ux = cx / len;
        const uz = cz / len;

        for (let step = 0; step <= 6; step++) {
            for (const side of [0, 1, -1, 2, -2, 3, -3]) {
                const px = Math.round(cx - ux * step - uz * side);
                const pz = Math.round(cz - uz * step + ux * side);
                const x0 = px - Math.floor(w0 / 2);
                const z0 = pz - Math.floor(d0 / 2);

                if (rectFree(x0 - pad, z0 - pad, w0 + pad * 2, d0 + pad * 2)) {
                    reserve(x0, z0, w0, d0);
                    return { x0, z0, w: w0, d: d0 };
                }
            }
        }
        return null;
    }

    const PLAZA = { x0: -1, z0: -1, w: 4, d: 4 }; // o centro da ilha, com a Árvore-Líquida da praça
    reserve(PLAZA.x0, PLAZA.z0, PLAZA.w, PLAZA.d);

    const factorySite = findSite(5, 4, ...polar(-45, 6.6));
    const labSite = c.alga === 1 ? findSite(3, 3, ...polar(-135, 6.5)) : null;
    const schoolSite = c.escola === 1 ? findSite(5, 4, ...polar(180, 6.6)) : null;

    // lagoa e córrego, que sai da lagoa e cai para fora da ilha
    const [pondX, pondZ] = polar(130, 6.6);
    const pond = [];
    const stream = [];
    let fall = null;

    for (const col of cols.values()) {
        if (Math.hypot(col.x - pondX, col.z - pondZ) <= 1.9 && !taken.has(ck(col.x, col.z))) {
            pond.push(col);
            taken.add(ck(col.x, col.z));
        }
    }

    {
        const [ux, uz] = polar(130, 1);
        let prev = null;

        for (let t = 1.5; t < 10; t += 0.5) {
            const x = Math.round(pondX + ux * t);
            const z = Math.round(pondZ + uz * t);
            if (prev && prev.x === x && prev.z === z) continue;

            if (!cols.has(ck(x, z))) {
                if (prev) fall = { x, z, dx: Math.sign(x - prev.x), dz: Math.sign(z - prev.z) };
                break;
            }

            // o córrego anda só nas quatro direções, sem saltar na diagonal
            if (prev && prev.x !== x && prev.z !== z) {
                const bridge = cols.get(ck(prev.x, z));
                if (bridge && !taken.has(ck(prev.x, z))) {
                    stream.push(bridge);
                    taken.add(ck(prev.x, z));
                }
            }

            const col = cols.get(ck(x, z));
            if (!taken.has(ck(x, z))) {
                stream.push(col);
                taken.add(ck(x, z));
            }
            prev = { x, z };
        }
    }

    // faixa de areia em volta da lagoa
    for (const col of cols.values()) {
        const near = Math.hypot(col.x - pondX, col.z - pondZ);
        if (near > 1.9 && near <= 2.9 && !taken.has(ck(col.x, col.z))) kind.set(ck(col.x, col.z), "sand");
    }

    const houseSites = [];
    const houseCount = closed ? 2 : clamp(Math.round(w * 3.4), w > 0.12 ? 1 : 0, 4);
    for (const deg of [12, 40, -14, 160]) {
        if (houseSites.length >= houseCount) break;
        const site = findSite(4, 4, ...polar(deg, 6.6));
        if (site) houseSites.push(site);
    }

    // a avenida da prefeitura, com as Árvores-Líquidas em fila
    const avenue = [];
    if (c.prazo !== null) {
        for (const deg of [68, 90, 112]) {
            const site = findSite(1, 1, ...polar(deg, 6.6));
            if (site) avenue.push(site);
        }
    }

    // chão de pedra na praça e na fábrica
    for (let x = PLAZA.x0; x < PLAZA.x0 + PLAZA.w; x++) for (let z = PLAZA.z0; z < PLAZA.z0 + PLAZA.d; z++) kind.set(ck(x, z), "cobble");
    if (factorySite) {
        for (let x = factorySite.x0; x < factorySite.x0 + factorySite.w; x++) {
            for (let z = factorySite.z0; z < factorySite.z0 + factorySite.d; z++) kind.set(ck(x, z), "cobble");
        }
    }

    // caminhos de terra da praça até cada construção
    const centers = [factorySite, labSite, schoolSite, ...houseSites, ...avenue].filter(Boolean).map((s) => [
        s.x0 + Math.floor(s.w / 2),
        s.z0 + Math.floor(s.d / 2),
    ]);

    for (const [tx, tz] of centers) {
        let x = 0;
        let z = 0;
        for (let i = 0; i < 40 && (x !== tx || z !== tz); i++) {
            if (Math.abs(tx - x) >= Math.abs(tz - z)) x += Math.sign(tx - x);
            else z += Math.sign(tz - z);
            if (cols.has(ck(x, z)) && !taken.has(ck(x, z)) && !kind.has(ck(x, z))) kind.set(ck(x, z), "path");
        }
    }


    /* ---------- relevo e terreno ---------- */

    // colinas só nas bordas, onde não tem nada construído
    for (const col of cols.values()) {
        if (col.d < 6.2 || taken.has(ck(col.x, col.z)) || kind.has(ck(col.x, col.z))) continue;
        col.top = clamp(Math.floor((noise(col.x * 0.33 + 50, col.z * 0.33 + 50) - 0.42) * 4.5), 0, 2);
    }

    const surface = new Map(); // "x,z" -> tipo da superfície

    function surfaceOf(x, z) {
        const fixed = kind.get(ck(x, z));
        if (fixed) return fixed;

        const t = g + (noise(x * 0.8 + 3.1, z * 0.8 - 7.7) - 0.5) * 0.42;
        return t > 0.58 ? "grass" : t > 0.42 ? "grassDry" : t > 0.24 ? "coarse" : "ash";
    }

    for (const col of cols.values()) {
        const { x, z, top, depth } = col;
        const type = surfaceOf(x, z);
        surface.set(ck(x, z), type);

        for (let y = -depth + 1; y <= top; y++) {
            if (y === top) put(x, y, z, type);
            else if (y >= top - 2) put(x, y, z, "dirt");
            else put(x, y, z, noise(x * 0.9 + 7, y * 0.9 + z * 0.4) > 0.72 ? "darkstone" : "stone");
        }
    }

    // lagoa e córrego ficam um pouco abaixo do chão
    const waterCells = [...pond, ...stream];
    for (const col of waterCells) {
        take(col.x, 0, col.z);
        put(col.x, -1, col.z, "sand");
        surface.set(ck(col.x, col.z), "water");
    }

    const groundTop = (x, z) => cols.get(ck(x, z)).top;


    /* ---------- peças prontas ---------- */

    // Uma Árvore-Líquida: a base de pedra vira bloco e o tanque é desenhado à parte.
    function tank(x0, z0, size, height, state) {
        for (let x = x0; x < x0 + size; x++) for (let z = z0; z < z0 + size; z++) put(x, 1, z, "stoneBrick");
        tanks.push({ x: x0 + (size - 1) / 2, z: z0 + (size - 1) / 2, y: 1.5, size, h: height, state });
    }

    const tankState = (base) => (closed ? "off" : g < 0.16 ? "dead" : base === "ok" && g < 0.36 ? "murky" : base);

    function house(site, style) {
        const { x0, z0, w: hw, d: hd } = site;
        const walls = style === "wood" ? (ruined ? "plankDark" : "planks") : "wallWhite";
        const corner = style === "wood" ? "log" : "stoneBrick";
        const roof = style === "eco" ? (g > 0.5 ? "moss" : "roofDark") : ruined ? "roofDark" : "brick";
        const doorI = Math.floor(hw / 2);

        for (let i = 0; i < hw; i++) {
            for (let j = 0; j < hd; j++) {
                const x = x0 + i;
                const z = z0 + j;
                put(x, 0, z, "planks"); // piso

                const edge = i === 0 || j === 0 || i === hw - 1 || j === hd - 1;
                if (!edge) continue;

                const isCorner = (i === 0 || i === hw - 1) && (j === 0 || j === hd - 1);

                for (let y = 1; y <= 3; y++) {
                    if (isCorner) put(x, y, z, corner);
                    else if (j === hd - 1 && i === doorI && y <= 2) continue; // porta
                    else if (ruined && y >= 2 && chance(0.22)) continue; // buraco na parede
                    else if (y === 2 && ((j === 0 || j === hd - 1) ? i % 2 === 1 : j % 2 === 1)) {
                        if (!ruined) put(x, y, z, "glass");
                    } else put(x, y, z, walls);
                }
            }
        }

        // telhado em degraus, mais largo que as paredes
        for (let k = 0; ; k++) {
            const rw = hw + 2 - 2 * k;
            const rd = hd + 2 - 2 * k;
            if (rw <= 0 || rd <= 0) break;

            for (let i = 0; i < rw; i++) {
                for (let j = 0; j < rd; j++) {
                    if (ruined && chance(0.28)) continue;
                    put(x0 - 1 + k + i, 4 + k, z0 - 1 + k + j, roof);
                }
            }
        }

        if (style === "eco" && !ruined) {
            put(x0 + 1, 6, z0 + 1, "solar");
            put(x0 + 2, 6, z0 + 1, "solar");
        }

        if (style === "wood" && !ruined) {
            put(x0 + hw - 2, 6, z0 + 1, "cobble");
            put(x0 + hw - 2, 7, z0 + 1, "cobble");
            if (g > 0.3) emitters.push({ kind: "smoke", x: x0 + hw - 2, y: 8.1, z: z0 + 1, dark: 0, rate: 0.9 });
        }

        if (ruined) {
            for (let n = 0; n < 4; n++) {
                const x = x0 - 1 + Math.floor(rng() * (hw + 2));
                const z = z0 + hd + Math.floor(rng() * 2);
                if (cols.has(ck(x, z)) && !taken.has(ck(x, z))) bushes.push({ x, y: groundTop(x, z) + 0.5, z });
            }
        }
    }

    function factory(site) {
        const { x0, z0, w: fw, d: fd } = site;
        const gate = Math.floor(fw / 2);
        const front = fd - 1;
        const signed = c.contrato === 1;
        const reduced = c.contrato === 0;
        const clean = reduced && !closed;
        const chimneys = signed ? 3 : reduced ? 1 : 2;
        const height = signed ? 5 : reduced ? 3 : 4;

        for (let i = 0; i < fw; i++) {
            for (let j = 0; j < fd; j++) {
                const x = x0 + i;
                const z = z0 + j;
                put(x, 4, z, clean ? "moss" : "metal");

                if (!(i === 0 || j === 0 || i === fw - 1 || j === fd - 1)) continue;

                for (let y = 1; y <= 3; y++) {
                    const isGate = j === front && (i === gate || i === gate - 1) && y <= 2;
                    const isWindow = y === 2 && (j === front || j === 0) && i % 2 === 1 && !isGate;

                    if (isGate) {
                        if (closed) put(x, y, z, "plankDark"); // portão fechado com tábuas
                    } else if (isWindow) put(x, y, z, closed ? "plankDark" : "glass");
                    else put(x, y, z, "stoneBrick");
                }
            }
        }

        if (closed) {
            // faixa vermelha de "fechado" em cima do portão
            for (let i = gate - 1; i <= gate + 1; i++) put(x0 + i, 3, z0 + front, "redWool");
        } else if (signed) {
            // a faixa de "carbono neutro" na entrada
            for (let i = 1; i <= fw - 2; i++) put(x0 + i, 3, z0 + front, i === Math.ceil(fw / 2) - 1 || i === Math.ceil(fw / 2) ? "whiteWool" : "lime");
        }

        const spots = [1, 3, 2].slice(0, chimneys);
        spots.forEach((i, n) => {
            const x = x0 + Math.min(i, fw - 2);
            const z = z0 + 1;
            for (let y = 5; y < 5 + height; y++) put(x, y, z, (y + n) % 2 ? "redWool" : "whiteWool");

            if (!closed) {
                const dark = signed ? 1 : reduced ? 0.12 : clamp(1 - g * 1.1, 0.15, 0.9);
                emitters.push({ kind: "smoke", x, y: 5 + height + 0.1, z, dark, rate: signed ? 3 : reduced ? 0.7 : 1.8 });
            }
        });

        if (clean) {
            put(x0 + 3, 5, z0 + 2, "solar");
            put(x0 + 4, 5, z0 + 2, "solar");
        }
    }

    function school(site) {
        const { x0, z0 } = site;
        house(site, "school");

        // mastro com a bandeira, um pouco afastado para não atravessar o beiral do telhado
        const fx = x0 - 2;
        const fz = z0 + site.d - 1;
        if (cols.has(ck(fx, fz)) && !taken.has(ck(fx, fz))) {
            taken.add(ck(fx, fz));
            for (let y = 1; y <= 5; y++) put(fx, y, fz, "log");
            put(fx - 1, 5, fz, "redWool");
            put(fx - 1, 4, fz, "redWool");
        }

        // mudas plantadas pelas crianças, com elas por perto
        const spots = [[x0 + 1, z0 + site.d + 1], [x0 + 3, z0 + site.d + 2], [x0 + 5, z0 + site.d + 1]];
        spots.forEach(([x, z], n) => {
            if (!cols.has(ck(x, z)) || taken.has(ck(x, z))) return;
            taken.add(ck(x, z));
            put(x, 1, z, "log");
            put(x, 2, z, "leaves");
            put(x + 1, 2, z, "leaves");
            put(x - 1, 2, z, "leaves");
            put(x, 3, z, "leaves");
            if (cols.has(ck(x + 1, z - 1))) villagers.push({ x: x + 1.5, y: 0.5, z: z - 1, shirt: SHIRTS[n % SHIRTS.length], kid: true });
        });
    }


    /* ---------- construções ---------- */

    // a Árvore-Líquida da praça e os postes de luz
    tank(0, 0, 2, 5, tankState(c.defeito === 1 ? "dead" : "ok"));

    for (const [x, z] of [[-1, -1], [2, -1], [-1, 2], [2, 2]]) {
        put(x, 1, z, "log");
        put(x, 2, z, "log");
        put(x, 3, z, abandoned ? "plankDark" : "lamp");
    }

    if (factorySite) factory(factorySite);
    if (schoolSite) school(schoolSite);

    houseSites.forEach((site, n) => house(site, !ruined && g >= 0.6 && w >= 0.45 ? "eco" : "wood"));

    if (labSite) {
        // a alga nova: um tanque alto e brilhante, com painéis de energia solar
        for (let x = labSite.x0; x < labSite.x0 + 3; x++) for (let z = labSite.z0; z < labSite.z0 + 3; z++) put(x, 1, z, "stoneBrick");
        tanks.push({ x: labSite.x0 + 0.5, z: labSite.z0 + 0.5, y: 1.5, size: 2, h: 8, state: tankState("ok") });
        for (let i = 0; i < 3; i++) put(labSite.x0 + i, 2, labSite.z0 + 2, "solar");
        put(labSite.x0 + 2, 2, labSite.z0, "lamp");
    }

    // as árvores da avenida; quando o teste foi pulado, dois tanques ficam com a água fora do padrão
    avenue.forEach((site, n) => {
        const base = c.prazo === 0 && n > 0 ? "murky" : "ok";
        tank(site.x0, site.z0, 1, 4, tankState(base));
    });

    // lixo de plástico espalhado perto da fábrica
    if (c.investidora === 1) {
        const [fx, fz] = factorySite ? [factorySite.x0 + 2, factorySite.z0 + 2] : [4, -4];
        const spots = [...cols.values()].filter((col) => !taken.has(ck(col.x, col.z)) && Math.hypot(col.x - fx, col.z - fz) < 7);
        for (let n = 0; n < 22 && spots.length; n++) {
            const col = spots.splice(Math.floor(rng() * spots.length), 1)[0];
            taken.add(ck(col.x, col.z)); // árvores e flores ficam longe do lixo
            const stack = 1 + Math.floor(rng() * 3);
            for (let s = 1; s <= stack; s++) put(col.x, col.top + s, col.z, "plastic", pick(PLASTIC));
        }
    }


    /* ---------- natureza ---------- */

    const treeCells = new Set();

    function near(set, x, z, r) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (set.has(ck(x + dx, z + dz))) return true;
        return false;
    }

    function nearTree(x, z, r) {
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (treeCells.has(ck(x + dx, z + dz))) return true;
        return false;
    }

    const treeSurface = new Set(["grass", "grassDry", "coarse", "ash"]);
    const spots = [...cols.values()].filter((col) => treeSurface.has(surface.get(ck(col.x, col.z))));

    function plant(x, z, type) {
        const base = groundTop(x, z);
        treeCells.add(ck(x, z));

        if (type === "dead") {
            const trunk = g < 0.15 ? 1 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 3);
            for (let i = 1; i <= trunk; i++) put(x, base + i, z, "deadLog");
            if (trunk >= 3) {
                if (chance(0.6)) { put(x + 1, base + trunk - 1, z, "deadLog"); put(x + 1, base + trunk, z, "deadLog"); }
                if (chance(0.6)) { put(x - 1, base + trunk - 2, z, "deadLog"); }
                if (chance(0.5)) put(x, base + trunk + 1, z, "deadLog");
            }
            return;
        }

        const trunk = 4 + (chance(0.3) ? 1 : 0);
        for (let i = 1; i <= trunk; i++) put(x, base + i, z, "log");

        const leaf = type === "autumn" ? "leavesAutumn" : "leaves";
        const hole = type === "autumn" ? 0.22 : 0;

        for (let y = trunk - 1; y <= trunk + 2; y++) {
            const reach = y <= trunk ? 2 : 1;
            for (let dx = -reach; dx <= reach; dx++) {
                for (let dz = -reach; dz <= reach; dz++) {
                    const corner = Math.abs(dx) === reach && Math.abs(dz) === reach;
                    const onTrunk = dx === 0 && dz === 0 && y <= trunk;
                    if (onTrunk || (corner && (y === trunk + 2 || chance(0.4))) || chance(hole)) continue;
                    put(x + dx, base + y, z + dz, leaf);
                }
            }
        }
    }

    // quantas árvores cabem: muitas num planeta saudável, quase nenhuma num morto
    const living = Math.round(lerp(0, 26, Math.pow(clamp((g - 0.08) / 0.92, 0, 1), 0.9)));
    const dying = Math.round((1 - g) * (g < 0.5 ? 8 : 2));
    const want = [...Array(living).fill("alive"), ...Array(dying).fill("dead")];

    for (const how of want) {
        for (let attempt = 0; attempt < 60; attempt++) {
            const col = spots[Math.floor(rng() * spots.length)];
            if (!col || col.d < 3.5 || near(built, col.x, col.z, 3) || near(taken, col.x, col.z, 1) || nearTree(col.x, col.z, 2)) continue;

            const health = g + (noise(col.x * 0.6, col.z * 0.6) - 0.5) * 0.35;
            plant(col.x, col.z, how === "dead" ? "dead" : health > 0.5 ? "oak" : health > 0.34 ? "autumn" : "dead");
            break;
        }
    }

    // flores num planeta verde, arbustos secos num planeta doente, fogueiras num planeta queimado
    function ground(count, surfaces, add) {
        let placed = 0;
        for (let attempt = 0; attempt < count * 8 && placed < count; attempt++) {
            const col = spots[Math.floor(rng() * spots.length)];
            const k = ck(col.x, col.z);
            if (!col || taken.has(k) || treeCells.has(k) || !surfaces.includes(surface.get(k))) continue;
            if (blocks.has(bk(col.x, col.top + 1, col.z))) continue;

            treeCells.add(k);
            add(col);
            placed++;
        }
    }

    if (g > 0.55) {
        ground(Math.round((g - 0.5) * 70), ["grass"], (col) =>
            flowers.push({ x: col.x + (rng() - 0.5) * 0.5, y: col.top + 0.5, z: col.z + (rng() - 0.5) * 0.5, c: pick(FLOWERS) })
        );
    }

    if (g < 0.5) {
        ground(Math.round((0.5 - g) * 30), ["grassDry", "coarse", "ash"], (col) => bushes.push({ x: col.x, y: col.top + 0.5, z: col.z }));
    }

    if (g < 0.3) {
        ground(Math.round((0.3 - g) * 38), ["coarse", "ash"], (col) => fires.push({ x: col.x, y: col.top + 0.5, z: col.z }));
    }

    // os bichos do protótipo: galinhas num lugar feliz, Creepers num lugar destruído
    if (g > 0.62) {
        ground(Math.round((g - 0.55) * 9), ["grass"], (col) => mobs.push({ kind: "chicken", x: col.x, y: col.top + 0.5, z: col.z, rot: rng() * 6.28 }));
    }

    if (g < 0.28) {
        ground(1 + Math.round((0.28 - g) * 10), ["coarse", "ash", "grassDry"], (col) =>
            mobs.push({ kind: "creeper", x: col.x, y: col.top + 0.5, z: col.z, rot: rng() * 6.28 })
        );
    }

    // gente passeando na praça de uma cidade que funciona
    if (!abandoned && g > 0.45) {
        const walkers = Math.round(w * 3);
        for (let n = 0; n < walkers; n++) {
            villagers.push({ x: -1 + rng() * 4, y: 0.5, z: -1 + rng() * 4, shirt: pick(SHIRTS), kid: false });
        }
    }


    /* ---------- céu ---------- */

    // nuvens brancas num céu limpo; nuvens escuras e baixas quando o ar está pesado
    const clouds = [];
    const white = g > 0.4 ? Math.round(lerp(2, 9, (g - 0.4) / 0.6)) : 0;
    for (let n = 0; n < white; n++) {
        clouds.push({
            x: -26 + rng() * 52,
            y: 12 + rng() * 6,
            z: -24 + rng() * 20,
            w: 4 + rng() * 5,
            h: 1.2 + rng() * 0.8,
            d: 2.5 + rng() * 3,
            dark: 0,
        });
    }

    const smog = g < 0.55 ? Math.round((0.55 - g) * 16) : 0;
    for (let n = 0; n < smog; n++) {
        clouds.push({
            x: -20 + rng() * 40,
            y: 10 + rng() * 3,
            z: -24 + rng() * 22,
            w: 6 + rng() * 6,
            h: 1.4 + rng() * 1,
            d: 3.5 + rng() * 4,
            dark: 1,
        });
    }


    /* ---------- resultado ---------- */

    const counts = {};
    for (const b of blocks.values()) counts[b.t] = (counts[b.t] || 0) + 1;

    return {
        blocks: [...blocks.values()],
        tanks,
        flowers,
        bushes,
        fires,
        mobs,
        villagers,
        emitters,
        clouds,
        water: { cells: waterCells.map((col) => ({ x: col.x, z: col.z })), quality: waterQuality, fall },
        stats: {
            blocks: blocks.size,
            columns: cols.size,
            types: counts,
            houses: houseSites.length,
            hasFactory: Boolean(factorySite),
            hasSchool: Boolean(schoolSite),
            hasLab: Boolean(labSite),
            avenue: avenue.length,
            water: waterCells.length,
            waterfall: Boolean(fall),
            trees: treeCells.size,
            abandoned,
            ruined,
        },
    };
}
