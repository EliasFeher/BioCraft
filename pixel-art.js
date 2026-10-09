// Ícones desenhados em pixels. Cada letra do desenho é um quadradinho e
// cada letra tem uma cor na paleta; o ponto é espaço vazio.

const SPRITES = {
    furnace: {
        palette: { K: "#262626", L: "#a6a6a6", G: "#8d8d8d", g: "#727272", B: "#171717", O: "#ff9a1f", Y: "#ffd84a" },
        rows: [
            "KKKKKKKKKKKK",
            "KLLLLLLLLLLK",
            "KGgGGGgGGGgK",
            "KGKKKKKKKKGK",
            "KgKBBBBBBKgK",
            "KGKKKKKKKKGK",
            "KGGgGGGGgGGK",
            "KGKKKKKKKKGK",
            "KgKBYOOYBKgK",
            "KGKBOYYOBKGK",
            "KGKKKKKKKKGK",
            "KKKKKKKKKKKK",
        ],
    },

    tnt: {
        palette: { K: "#3b1010", R: "#d8402e", r: "#a82a1e", W: "#f0f0f0", w: "#c4c4c4", B: "#2a2a2a" },
        rows: [
            "KKKKKKKKKKKK",
            "KRRRRRRRRRRK",
            "KRrRRRRRRrRK",
            "KRRRRRRRRRRK",
            "KWWWWWWWWWWK",
            "KWBBWBBWBBWK",
            "KWwBWwBWwBWK",
            "KWBBWBBWBBWK",
            "KWWWWWWWWWWK",
            "KRRRRRRRRRRK",
            "KRrRRRRRRrRK",
            "KKKKKKKKKKKK",
        ],
    },

    tree: {
        palette: {
            K: "#1d3b2c", B: "#262626", G: "#cfe8ef", g: "#ffffff",
            L: "#4fd37a", l: "#8df0ac", d: "#2fa85a", b: "#e8fff0",
        },
        rows: [
            "..KKKKKKKK..",
            "..KBBBBBBK..",
            ".KGGGGGGGGK.",
            ".KGgGGGGGGK.",
            ".KGgLLLLLLK.",
            ".KGllLbLLLK.",
            ".KGlLLLLbLK.",
            ".KGLLbLLLLK.",
            ".KGLLLLbLLK.",
            ".KGdLLLLLdK.",
            ".KKKKKKKKKK.",
            "..BBBBBBBB..",
        ],
    },

    sapling: {
        palette: { G: "#4fae3c", g: "#2f7a2a", T: "#7a5230", t: "#5a3a20" },
        rows: [
            "...gG..gG...",
            "..gGGggGGg..",
            ".gGGgGGgGGg.",
            "..GgGGGGgG..",
            ".gGGGGGGGGg.",
            "..GgGGgGGG..",
            "...GGTTGG...",
            "....GTTG....",
            ".....TT.....",
            ".....TT.....",
            ".....tT.....",
            "....tttT....",
        ],
    },

    hopper: {
        palette: { K: "#1c1c1c", D: "#4a4a4a", d: "#5f5f5f", L: "#7a7a7a", G: "#4fd37a" },
        rows: [
            "KKKKKKKKKKKK",
            "KLLLLLLLLLLK",
            "KDGGGGGGGGDK",
            "KDGdGdGdGdDK",
            ".KDDDDDDDDK.",
            ".KDddddddDK.",
            "..KDDDDDDK..",
            "..KDddddDK..",
            "...KDDDDK...",
            "....KDDK....",
            "....KDDK....",
            "....KKKK....",
        ],
    },

    potion: {
        palette: { C: "#9a6b3a", c: "#7a5230", g: "#8aa4b8", W: "#ffffff", L: "#5ee07a", l: "#a6ffbc" },
        rows: [
            "....CCCC....",
            "....CccC....",
            ".....gg.....",
            ".....gg.....",
            "....gWWg....",
            "...gWLLLg...",
            "..gWLllLLg..",
            "..gLLLLLLg..",
            "..gLLLLLLg..",
            "..gLLLLLLg..",
            "...gLLLLg...",
            "....gggg....",
        ],
    },

    book: {
        palette: { K: "#2a1a0e", C: "#7a4a28", c: "#5d3519", P: "#f0e6c8", p: "#d8ccaa", Y: "#d4a73a", G: "#2fd16a" },
        rows: [
            ".KKKKKKKKKK.",
            "KCCCCCCCCCPK",
            "KcCYYYYYCCpK",
            "KcCYGGGYCCPK",
            "KcCYGGGYCCpK",
            "KcCYGGGYCCPK",
            "KcCYYYYYCCpK",
            "KcCCCCCCCCPK",
            "KcCCCCCCCCpK",
            "KCCCCCCCCCPK",
            ".KKKKKKKKKK.",
            "............",
        ],
    },

    scroll: {
        palette: { K: "#4a3a1e", P: "#efe3bd", p: "#d6c690", k: "#8a7a55", G: "#2fd16a", D: "#0e7a33" },
        rows: [
            ".KKKKKKKKKK.",
            "KPPPPPPPPPPK",
            "KPkkkkkkkpPK",
            "KPPPPPPPPPPK",
            "KPkkkkkkPPPK",
            "KPPPPPPPPPPK",
            "KPkkkkPGGGPK",
            "KPPPPPGGGGDK",
            "KpPPPPPGGDpK",
            "KpppppppppPK",
            ".KKKKKKKKKK.",
            "............",
        ],
    },

    chest: {
        palette: { K: "#2a1a0e", C: "#9a6a38", c: "#7a4f28", Y: "#e8c04a" },
        rows: [
            "KKKKKKKKKKKK",
            "KCCCCCCCCCCK",
            "KCcCCCCCCcCK",
            "KCCCCCCCCCCK",
            "KKKKKKKKKKKK",
            "KCCCCYYCCCCK",
            "KCcCCYKCCcCK",
            "KCCCCCCCCCCK",
            "KCcCCCCCCcCK",
            "KCCCCCCCCCCK",
            "KKKKKKKKKKKK",
            "............",
        ],
    },

    emerald: {
        palette: { K: "#0b3d1c", E: "#2fd16a", e: "#17a44a", L: "#9bffbf" },
        rows: [
            "...KKKK...",
            "..KLLEEK..",
            ".KLEEEEEK.",
            "KLEEEEEEEK",
            "KEEEEEEEeK",
            "KEEEEEEeeK",
            ".KEEEEeeK.",
            "..KEEeeK..",
            "...KeeK...",
            "....KK....",
        ],
    },

    heart: {
        palette: { K: "#2a0a0a", R: "#e63a3a", W: "#ff9d9d" },
        rows: [
            ".KKK.KKK.",
            "KRRRKRRRK",
            "KRWRRRRRK",
            "KRRRRRRRK",
            ".KRRRRRK.",
            "..KRRRK..",
            "...KRK...",
            "....K....",
        ],
    },

    // Retratos das sete pessoas das cartas do jogo (14x16, desenhados espelhados).
    tecnica: {
        palette: { K: "#201a14", S: "#e8b486", s: "#cf9868", H: "#f0a830", h: "#c4841f", C: "#d9e23a", c: "#aab520", A: "#e8e8e8" },
        rows: [
            "...HHHHHHHH...",
            "..HHHHHHHHHH..",
            ".hHHHHHHHHHHh.",
            "hHHHHHHHHHHHHh",
            "KSSSSSSSSSSSSK",
            "KSSKSSSSSSKSSK",
            "KSSSSSssSSSSSK",
            "KKSSSSSSSSSSKK",
            "...SSSSSSSS...",
            "..cCCCCCCCCc..",
            ".CCCCCCCCCCCC.",
            "CCCCCCCCCCCCCC",
            "AAAAAAAAAAAAAA",
            "CCCCCCccCCCCCC",
            "CCCCCCccCCCCCC",
            "cCCCCCccCCCCCc",
        ],
    },

    prefeito: {
        palette: { K: "#201a14", S: "#e8b486", s: "#cf9868", H: "#4a4a4a", h: "#333333", C: "#1f3b63", c: "#162a47", A: "#b03a32", W: "#f0f0f0" },
        rows: [
            "..............",
            "HH..........HH",
            "HHH........HHH",
            "HHh........hHH",
            "KSSSSSSSSSSSSK",
            "KSSKSSSSSSKSSK",
            "KSSSSSssSSSSSK",
            "KKSSSSSSSSSSKK",
            "...SSSSSSSS...",
            "..CCCCCCCCCC..",
            ".CCCCCWWCCCCC.",
            "CCCCCCAACCCCCC",
            "CCCCCCAACCCCCC",
            "cCCCCCAACCCCCc",
            "cCCCCCAACCCCCc",
            "cCCCCCccCCCCCc",
        ],
    },

    investidora: {
        palette: { K: "#201a14", S: "#e8b486", s: "#cf9868", H: "#3a2a1e", h: "#2a1d14", C: "#6b3fa0", c: "#4f2d78", W: "#ffffff", A: "#f0e6d2" },
        rows: [
            "......HH......",
            "..HHHHHHHHHH..",
            ".HHHHHHHHHHHH.",
            "hHHHHHHHHHHHHh",
            "KSSSSSSSSSSSSK",
            "KSSKSSSSSSKSSK",
            "KSSSSSssSSSSSK",
            "KKSSSSSSSSSSKK",
            "...SSSSSSSS...",
            "..CCCCCCCCCC..",
            ".CCCCCWWCCCCC.",
            "CCCCCWAAWCCCCC",
            "CCCCCWAAWCCCCC",
            "cCCCCWAAWCCCCc",
            "cCCCCCccCCCCCc",
            "cCCCCCccCCCCCc",
        ],
    },

    professora: {
        palette: { K: "#201a14", S: "#e8b486", s: "#cf9868", H: "#6b4226", h: "#4a2d19", C: "#a8323a", c: "#7a2228", W: "#ffffff", A: "#262626" },
        rows: [
            "...HHHHHHHH...",
            "..HHHHHHHHHH..",
            ".HHHHHHHHHHHH.",
            "hHHHHHHHHHHHHh",
            "KSSSSSSSSSSSSK",
            "KSAKASSSSAKASK",
            "KSSSSSssSSSSSK",
            "KKSSSSSSSSSSKK",
            "...SSSSSSSS...",
            "..CCCCCCCCCC..",
            ".CCCCCWWCCCCC.",
            "CCCCCCAACCCCCC",
            "CCCCCCWWCCCCCC",
            "CCCCCCAACCCCCC",
            "CCCCCCWWCCCCCC",
            "cCCCCCAACCCCCc",
        ],
    },

    operador: {
        palette: { K: "#201a14", S: "#e8b486", s: "#cf9868", H: "#3a5a7a", h: "#2a4259", C: "#5a6b73", c: "#3f4d54", A: "#e8c04a" },
        rows: [
            "...HHHHHHHH...",
            "..HHHHHHHHHH..",
            ".HHHHHHHHHHHH.",
            "hHHHHHHHHHHHHh",
            "KSSSSSSSSSSSSK",
            "KSSKSSSSSSKSSK",
            "KSSSSSssSSSSSK",
            "KKSSSSSSSSSSKK",
            "...SSSSSSSS...",
            "..CCCCCCCCCC..",
            ".CCCCCCCCCCCC.",
            "CCCCCCccCCCCCC",
            "CCACCCccCCCACC",
            "CCACCCccCCCACC",
            "CCCCCCccCCCCCC",
            "cCCCCCccCCCCCc",
        ],
    },

    cientista: {
        palette: { K: "#201a14", S: "#e8b486", s: "#cf9868", H: "#2b2318", h: "#1d170f", C: "#f0f0ee", c: "#d4d4d0", W: "#4fb8d8", A: "#5ee07a", g: "#2b2b2b", p: "#3a8fae" },
        rows: [
            "...HHHHHHHH...",
            "..HHHHHHHHHH..",
            ".HHHHHHHHHHHH.",
            "gAAAAAggAAAAAg",
            "KSSSSSSSSSSSSK",
            "KSSKSSSSSSKSSK",
            "KSSSSSssSSSSSK",
            "KKSSSSSSSSSSKK",
            "...SSSSSSSS...",
            "..CCCCCCCCCC..",
            ".CCCCCWWCCCCC.",
            "CCCCCCWWCCCCCC",
            "CCpCCCWWCCCpCC",
            "CCpCCCWWCCCpCC",
            "CCCCCCWWCCCCCC",
            "cCCCCCccCCCCCc",
        ],
    },

    diretor: {
        palette: { K: "#201a14", S: "#e8b486", s: "#cf9868", H: "#1a1a1a", h: "#0d0d0d", C: "#2b2b2e", c: "#19191b", A: "#9a9a9a", W: "#f0f0f0" },
        rows: [
            "...HHHHHHHH...",
            "..hHHHHHHHHh..",
            ".HHHHHHHHHHHH.",
            "hHHHHHHHHHHHHh",
            "KSSSSSSSSSSSSK",
            "KSSKSSSSSSKSSK",
            "KSSSSSssSSSSSK",
            "KKSSSSSSSSSSKK",
            "...SSSSSSSS...",
            "..CCCCCCCCCC..",
            ".CCCCCWWCCCCC.",
            "CCCCCCAACCCCCC",
            "CWCCCCAACCCCWC",
            "cCCCCCAACCCCCc",
            "cCCCCCAACCCCCc",
            "cCCCCCccCCCCCc",
        ],
    },
};

// Coração vazio: mesmo desenho, cores apagadas.
SPRITES.heartEmpty = {
    palette: { K: "#2a0a0a", R: "#4a2a2e", W: "#4a2a2e" },
    rows: SPRITES.heart.rows,
};

// Meio coração: a metade da direita usa as letras minúsculas, que são as cores apagadas.
SPRITES.heartHalf = {
    palette: { ...SPRITES.heart.palette, r: "#4a2a2e", w: "#4a2a2e" },
    rows: SPRITES.heart.rows.map((row) =>
        [...row].map((ch, i) => (i >= 5 && (ch === "R" || ch === "W") ? ch.toLowerCase() : ch)).join("")
    ),
};

// Monta um SVG com um retângulo por sequência de pixels da mesma cor.
export function pixelIcon(name, scale = 3) {
    const { rows, palette } = SPRITES[name];
    const width = rows[0].length;
    const height = rows.length;
    let rects = "";

    rows.forEach((row, y) => {
        let x = 0;

        while (x < width) {
            const color = row[x];
            if (color === ".") {
                x += 1;
                continue;
            }

            let run = 1;
            while (x + run < width && row[x + run] === color) run += 1;

            rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${palette[color]}"/>`;
            x += run;
        }
    });

    return (
        `<svg class="pixel-icon" viewBox="0 0 ${width} ${height}" ` +
        `width="${width * scale}" height="${height * scale}" ` +
        `shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`
    );
}

// Fileira de corações no estilo da barra de vida do jogo (2 pontos de vida por coração).
export function heartsRow(health, { total = 10, scale = 2 } = {}) {
    const halves = Math.round(health / (100 / (total * 2)));
    let html = "";

    for (let i = 0; i < total; i++) {
        const name = halves >= i * 2 + 2 ? "heart" : halves === i * 2 + 1 ? "heartHalf" : "heartEmpty";
        html += pixelIcon(name, scale);
    }

    return html;
}
