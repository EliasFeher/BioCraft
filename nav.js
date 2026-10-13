import { $, clamp, reduceMotion } from "./utils.js";

const NAV_HEIGHT = 74; // altura do menu fixo: o destino da rolagem fica logo abaixo dele
const root = document.documentElement;
const nav = $("navLinks");
const links = [...nav.querySelectorAll("a")];
const sections = links.map((link) => document.querySelector(link.getAttribute("href")));


/* ---------- link da seção atual ---------- */

let active = -1;

// O link da seção em que a página está fica sublinhado na hora, sem animação.
function setActive(index) {
    if (index === active) return;

    links.forEach((link, i) => {
        link.classList.toggle("active", i === index);
        if (i === index) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
    });

    active = index;
}

// A seção "da vez" é a última que já passou de uma linha de leitura um pouco abaixo do menu.
function currentIndex() {
    if (innerHeight + scrollY >= root.scrollHeight - 4) return links.length - 1;

    const reading = scrollY + NAV_HEIGHT + innerHeight * 0.3;
    let found = -1;
    let bestTop = -Infinity;

    sections.forEach((section, i) => {
        if (!section) return;
        const top = section.getBoundingClientRect().top + scrollY;
        if (top <= reading && top > bestTop) {
            bestTop = top;
            found = i;
        }
    });

    return found;
}

let ticking = false;

function onScroll() {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
        ticking = false;
        setActive(currentIndex());
    });
}

addEventListener("scroll", onScroll, { passive: true });
onScroll();


/* ---------- rolagem com aceleração suave ---------- */

// começa devagar, acelera no meio e desacelera ao chegar
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// O destino é calculado a cada quadro, então a página chega certinho mesmo se algo mudar de tamanho no caminho.
function targetY(element) {
    const max = root.scrollHeight - innerHeight;
    return clamp(element.getBoundingClientRect().top + scrollY - NAV_HEIGHT, 0, max);
}

const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
let frame = 0;

function scrollToElement(element, done) {
    cancelAnimationFrame(frame);

    const start = scrollY;
    const distance = Math.abs(targetY(element) - start);

    if (reduceMotion || distance < 4) {
        window.scrollTo({ top: targetY(element), behavior: "instant" });
        done();
        return;
    }

    const duration = clamp(380 + distance * 0.32, 520, 1300);
    const begin = performance.now();
    let cancelled = false;

    // se a pessoa mexer na página no meio do caminho, a animação para na hora
    const cancel = (event) => {
        if (event.type === "keydown" && !SCROLL_KEYS.includes(event.key)) return;
        cancelled = true;
    };
    const events = ["wheel", "touchstart", "mousedown", "keydown"];
    events.forEach((name) => addEventListener(name, cancel, { passive: true }));

    root.style.scrollBehavior = "auto"; // o CSS suave não pode brigar com esta animação

    function finish(completed) {
        events.forEach((name) => removeEventListener(name, cancel));
        root.style.scrollBehavior = "";
        if (completed) done();
    }

    function step(now) {
        if (cancelled) return finish(false);

        const t = clamp((now - begin) / duration, 0, 1);
        const y = start + (targetY(element) - start) * ease(t);
        window.scrollTo({ top: y, behavior: "instant" });

        if (t < 1) frame = requestAnimationFrame(step);
        else finish(true);
    }

    frame = requestAnimationFrame(step);
}


/* ---------- chegada na seção ---------- */

// Leva o foco para a seção, para quem navega pelo teclado ou leitor de tela continuar dali.
function arrive(section) {
    section.setAttribute("tabindex", "-1");
    section.focus({ preventScroll: true });
}

document.addEventListener("click", (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const id = decodeURIComponent(link.getAttribute("href").slice(1));
    const section = id && document.getElementById(id);
    if (!section) return;

    event.preventDefault();

    const hash = `#${id}`;
    if (location.hash === hash) history.replaceState(null, "", hash);
    else history.pushState(null, "", hash);

    scrollToElement(section, () => arrive(section));
});


/* ---------- abrir a página já em uma seção (ex: ...#jogo) ---------- */

// O navegador pula para o endereço antes de tudo carregar, e o 3D e as fontes mexem nos tamanhos depois.
// Quando termina de carregar, acerta a posição, a não ser que a pessoa já tenha rolado a página.
let touched = false;
["wheel", "touchstart", "mousedown", "keydown"].forEach((name) =>
    addEventListener(name, () => (touched = true), { passive: true, once: true })
);

addEventListener("load", () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const section = id && document.getElementById(id);
    if (section && !touched) window.scrollTo({ top: targetY(section), behavior: "instant" });
});
