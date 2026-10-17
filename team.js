import { $ } from "./utils.js";
import { pixelPortrait } from "./pixel-art.js";

// O rostinho de cada pessoa se ajusta em "look":
//   style    "short" (curto), "bangs" (liso com franja reta), "wavy" (ondulado) ou "curly" (cacheado)
//   skin, hair e shirt   as cores, em #rrggbb
//   narrow   true deixa os olhos mais estreitos
//   freckles true coloca sardas
const MEMBERS = [
    { name: "Elias Feher", role: "CEO (Tech)", look: { style: "wavy", skin: "#d9a97e", hair: "#2b1d14", shirt: "#1f7a4a" } },
    { name: "Rafael Pires", role: "COO (Design)", look: { style: "bangs", skin: "#f0d2a8", hair: "#14100c", shirt: "#42b8dc" } },
    { name: "Leonardo Tasca", role: "Desenvolvedor Back End", look: { style: "curly", skin: "#f1c9a0", hair: "#4a2f1c", shirt: "#7a4fa3" } },
    { name: "Bernardo Silva", role: "Designer", look: { style: "short", skin: "#f3d2b3", hair: "#c8641f", shirt: "#d9a441", freckles: true } },
    { name: "Enzo Jordão", role: "Desenvolvedor Front End", look: { style: "short", skin: "#e8b486", hair: "#3a2a1e", shirt: "#c4503f" } },
];

const grid = $("teamGrid");

MEMBERS.forEach(({ name, role, look }) => {
    const item = document.createElement("li");
    item.className = "member";
    item.innerHTML = `<span class="member-portrait">${pixelPortrait(look)}</span><strong></strong><small></small>`;
    item.querySelector("strong").textContent = name;
    item.querySelector("small").textContent = role;
    grid.append(item);
});
