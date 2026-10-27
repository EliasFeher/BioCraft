import { pixelIcon } from "./pixel-art.js";

// Fluxograma "como funciona": desenha os ícones em pixel art e faz os passos
// aparecerem um de cada vez quando a seção entra na tela.
const flow = document.getElementById("flow");

if (flow) {
    flow.querySelectorAll(".flow-step").forEach((step, i) => {
        step.style.setProperty("--i", i);
        const icon = step.querySelector(".flow-icon");
        icon.insertAdjacentHTML("afterbegin", pixelIcon(icon.dataset.icon, 5));
    });

    // só esconde os passos depois que o JS carregou, para nunca ficarem invisíveis sem ele
    flow.classList.add("js-ready");

    new IntersectionObserver(
        ([entry], observer) => {
            if (!entry.isIntersecting) return;
            flow.classList.add("is-visible");
            observer.disconnect();
        },
        { threshold: 0.3 },
    ).observe(flow);
}
