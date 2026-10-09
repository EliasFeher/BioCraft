import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

export { THREE };

// Cria cena, câmera e renderer dentro de um container.
// O loop só roda enquanto o container está visível na tela.
export function createStage(container, { fov, z }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
    camera.position.set(0, 0.2, z);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    new ResizeObserver(() => {
        const { clientWidth: w, clientHeight: h } = container;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    }).observe(container);

    let visible = true;
    new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(container);

    const stage = { scene, camera, renderer, onFrame: null };
    let last = 0;

    renderer.setAnimationLoop((time) => {
        const dt = Math.min((time - last) / 1000, 0.05);
        last = time;
        if (!visible) return;
        stage.onFrame?.(time, dt);
        renderer.render(scene, camera);
    });

    return stage;
}

export function addLights(scene, { blue = true } = {}) {
    scene.add(new THREE.AmbientLight(0xffffff, 2));

    const sun = new THREE.DirectionalLight(0xffffff, 4);
    sun.position.set(4, 6, 5);
    scene.add(sun);

    const green = new THREE.PointLight(0x7cff9a, 5, 12);
    green.position.set(-3, 2, 4);
    scene.add(green);

    if (blue) {
        const cyan = new THREE.PointLight(0x36b8ff, 3, 10);
        cyan.position.set(4, -2, 3);
        scene.add(cyan);
    }
}

// Acompanha a posição do ponteiro (0 a 1) dentro de um elemento.
export function trackPointer(el) {
    const pointer = { x: 0.5, y: 0.5, over: false };

    el.addEventListener("pointerenter", () => (pointer.over = true));
    el.addEventListener("pointerleave", () => (pointer.over = false));
    el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        pointer.x = (e.clientX - rect.left) / rect.width;
        pointer.y = (e.clientY - rect.top) / rect.height;
    });

    return pointer;
}

// Gerador pseudo-aleatório com semente, para o totem ficar igual a cada carregamento.
export function seededRandom(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
