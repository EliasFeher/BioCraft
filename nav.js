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
// Seção menor que a tela fica centralizada na área abaixo do menu; se for maior que isso,
// o topo dela fica logo abaixo do menu.
function targetY(element) {
    const max = root.scrollHeight - innerHeight;
    const { top, height } = element.getBoundingClientRect();
    const gap = Math.max(0, (innerHeight - NAV_HEIGHT - height) / 2);
    return clamp(top + scrollY - NAV_HEIGHT - gap, 0, max);
}

const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
let frame = 0;
let animating = false;
let stopCurrent = null; // encerra a animação em andamento, se houver

// Rola até getTarget() com aceleração suave. onEnd(true) quando chega e onEnd(false) se a pessoa interrompe.
// "gentle" deixa a animação mais lenta, usada no ajuste automático ao parar de rolar.
function animateScroll(getTarget, onEnd, gentle = false) {
    cancelAnimationFrame(frame);
    stopCurrent?.();

    const start = scrollY;
    const distance = Math.abs(getTarget() - start);

    if (reduceMotion || distance < 4) {
        window.scrollTo({ top: getTarget(), behavior: "instant" });
        onEnd(true);
        return;
    }

    animating = true;

    const duration = gentle
        ? clamp(800 + distance * 1.2, 900, 1600)
        : clamp(380 + distance * 0.32, 520, 1300);
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
        animating = false;
        stopCurrent = null;
        onEnd(completed);
    }

    stopCurrent = () => finish(false);

    function step(now) {
        if (cancelled) return finish(false);

        const t = clamp((now - begin) / duration, 0, 1);
        const y = start + (getTarget() - start) * ease(t);
        window.scrollTo({ top: y, behavior: "instant" });

        if (t < 1) frame = requestAnimationFrame(step);
        else finish(true);
    }

    frame = requestAnimationFrame(step);
}

function scrollToElement(element, done) {
    animateScroll(
        () => targetY(element),
        (completed) => completed && done(),
    );
}


/* ---------- centralizar a seção ao parar de rolar ---------- */

// Quando a pessoa para de rolar perto de uma seção, a página desliza devagar até centralizá-la.
// Seções mais altas que a tela ficam livres no meio: só ajusta se passar das pontas.
const mainSections = [...document.querySelectorAll("main > section")];
const SNAP_DELAY = 180; // tempo parado antes de ajustar
const SNAP_REACH = 0.4; // só ajusta se a seção estiver a menos de 40% da altura da tela

// a posição de rolagem mais próxima da atual em que a seção fica bem enquadrada
function framedY(section) {
    const max = root.scrollHeight - innerHeight;
    const { top, height } = section.getBoundingClientRect();
    const sectionTop = top + scrollY;
    const free = innerHeight - NAV_HEIGHT;

    if (height <= free) return clamp(sectionTop - NAV_HEIGHT - (free - height) / 2, 0, max);
    return clamp(scrollY, sectionTop - NAV_HEIGHT, sectionTop + height - innerHeight);
}

let snapTimer = 0;
let touching = false;

function snapToNearest() {
    if (reduceMotion || animating || touching) return;
    if (innerHeight + scrollY >= root.scrollHeight - 4) return; // no rodapé, deixa onde está

    let best = scrollY;
    let bestDistance = Infinity;

    mainSections.forEach((section) => {
        const y = framedY(section);
        const distance = Math.abs(y - scrollY);
        if (distance < bestDistance) {
            best = y;
            bestDistance = distance;
        }
    });

    if (bestDistance < 2 || bestDistance > innerHeight * SNAP_REACH) return;
    animateScroll(() => best, () => {}, true);
}

function scheduleSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(snapToNearest, SNAP_DELAY);
}

addEventListener("scroll", scheduleSnap, { passive: true });
addEventListener("wheel", scheduleSnap, { passive: true });
addEventListener("touchstart", () => (touching = true), { passive: true });
["touchend", "touchcancel"].forEach((name) =>
    addEventListener(
        name,
        () => {
            touching = false;
            scheduleSnap();
        },
        { passive: true },
    ),
);


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
