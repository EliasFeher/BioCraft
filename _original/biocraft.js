const physicalFooterQuality =
    document.getElementById("physicalFooterQuality");

/* =========================================
   BIOCRAFT
   MODELO 3D VOXEL
========================================= */

import * as THREE from
    "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";



/* =========================================
   PEGAR CONTAINER
========================================= */

const container =
    document.getElementById("model-container");


/*
 * Se o elemento não existir,
 * o restante do código não executa.
 */

if (container) {



    /* =====================================
       CENA
    ===================================== */

    const scene =
        new THREE.Scene();



    /* =====================================
       CÂMERA
    ===================================== */

    const camera =
        new THREE.PerspectiveCamera(
            40,
            container.clientWidth /
            container.clientHeight,
            0.1,
            100
        );


    camera.position.set(
        0,
        0.2,
        6
    );



    /* =====================================
       RENDERIZADOR
    ===================================== */

    const renderer =
        new THREE.WebGLRenderer({

            antialias: true,

            alpha: true

        });


    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            2
        )
    );


    renderer.setSize(
        container.clientWidth,
        container.clientHeight
    );


    renderer.outputColorSpace =
        THREE.SRGBColorSpace;


    container.appendChild(
        renderer.domElement
    );



    /* =====================================
       ILUMINAÇÃO
    ===================================== */

    /*
     * Luz ambiente
     */

    const ambientLight =
        new THREE.AmbientLight(
            0xffffff,
            2
        );


    scene.add(
        ambientLight
    );



    /*
     * Luz principal
     */

    const mainLight =
        new THREE.DirectionalLight(
            0xffffff,
            4
        );


    mainLight.position.set(
        4,
        6,
        5
    );


    scene.add(
        mainLight
    );



    /*
     * Luz verde
     */

    const greenLight =
        new THREE.PointLight(
            0x7cff9a,
            5,
            12
        );


    greenLight.position.set(
        -3,
        2,
        4
    );


    scene.add(
        greenLight
    );



    /*
     * Luz azul
     */

    const blueLight =
        new THREE.PointLight(
            0x36b8ff,
            3,
            10
        );


    blueLight.position.set(
        4,
        -2,
        3
    );


    scene.add(
        blueLight
    );



    /* =====================================
       GRUPO PRINCIPAL
    ===================================== */

    const voxelCube =
        new THREE.Group();


    scene.add(
        voxelCube
    );



    /* =====================================
       CORES
    ===================================== */

    const blueColors = [

        0x39b9df,

        0x45c5e8,

        0x269bc9,

        0x5acfe7

    ];


    const greenColors = [

        0x6fdb91,

        0x7ee99a,

        0x54c87d,

        0x94edaa

    ];



    /* =====================================
       TAMANHO DO CUBO
    ===================================== */

    const quantidade =
        7;


    const tamanho =
        0.40;


    const espacamento =
        0.43;



    /* =====================================
       FUNÇÃO PARA SABER SE É VERDE
    ===================================== */

    function blocoVerde(x, y, z) {

        /*
         * Criamos algumas "áreas continentais"
         * usando combinações matemáticas.
         */

        const padrao1 =
            (x + y * 2 + z) % 7 === 0;


        const padrao2 =
            (x * 3 + y + z * 2) % 11 === 0;


        const padrao3 =
            (x + z * 3 + y) % 13 === 0;


        return (
            padrao1 ||
            padrao2 ||
            padrao3
        );

    }



    /* =====================================
       CRIAR VOXELS
    ===================================== */

    for (
        let x = 0;
        x < quantidade;
        x++
    ) {

        for (
            let y = 0;
            y < quantidade;
            y++
        ) {

            for (
                let z = 0;
                z < quantidade;
                z++
            ) {


                /*
                 * Só criamos os blocos
                 * que ficam na superfície.
                 */

                const externo =

                    x === 0 ||

                    x === quantidade - 1 ||

                    y === 0 ||

                    y === quantidade - 1 ||

                    z === 0 ||

                    z === quantidade - 1;


                if (!externo) {

                    continue;

                }



                /* =========================
                   GEOMETRIA
                ========================= */

                const geometry =
                    new THREE.BoxGeometry(
                        tamanho,
                        tamanho,
                        tamanho
                    );



                /* =========================
                   ESCOLHER COR
                ========================= */

                const isGreen =
                    blocoVerde(
                        x,
                        y,
                        z
                    );


                let color;


                if (isGreen) {

                    color =
                        greenColors[
                        (
                            x +
                            y +
                            z
                        ) %
                        greenColors.length
                        ];

                } else {

                    color =
                        blueColors[
                        (
                            x * 2 +
                            y +
                            z
                        ) %
                        blueColors.length
                        ];

                }



                /* =========================
                   MATERIAL
                ========================= */

                const material =
                    new THREE.MeshStandardMaterial({

                        color: color,

                        roughness: 0.62,

                        metalness: 0.08

                    });



                /* =========================
                   VOXEL
                ========================= */

                const voxel =
                    new THREE.Mesh(
                        geometry,
                        material
                    );


                voxel.position.set(

                    (x - 3) *
                    espacamento,

                    (y - 3) *
                    espacamento,

                    (z - 3) *
                    espacamento

                );


                voxelCube.add(
                    voxel
                );

            }

        }

    }



    /* =====================================
       ROTAÇÃO INICIAL
    ===================================== */

    voxelCube.rotation.x =
        -0.20;


    voxelCube.rotation.y =
        0.40;



    /* =====================================
       MOUSE
    ===================================== */

    let mouseX = 0;

    let mouseY = 0;

    let targetRotationX =
        -0.20;

    let targetRotationY =
        0.40;

    let mouseOver =
        false;



    /* =====================================
       ENTRAR NO MODELO
    ===================================== */

    container.addEventListener(
        "mouseenter",
        () => {

            mouseOver =
                true;

        }
    );



    /* =====================================
       SAIR DO MODELO
    ===================================== */

    container.addEventListener(
        "mouseleave",
        () => {

            mouseOver =
                false;

        }
    );



    /* =====================================
       MOVIMENTO DO MOUSE
    ===================================== */

    container.addEventListener(
        "mousemove",
        (event) => {

            const rect =
                container.getBoundingClientRect();


            mouseX =
                (
                    event.clientX -
                    rect.left
                ) /
                rect.width;


            mouseY =
                (
                    event.clientY -
                    rect.top
                ) /
                rect.height;



            /*
             * Mouse esquerda/direita
             */

            targetRotationY =
                0.40 +
                (
                    mouseX -
                    0.5
                ) *
                1.6;



            /*
             * Mouse cima/baixo
             */

            targetRotationX =
                -0.20 +
                (
                    mouseY -
                    0.5
                ) *
                0.8;

        }
    );



    /* =====================================
       TOUCH / CELULAR
    ===================================== */

    let touchStartX = 0;


    container.addEventListener(
        "touchstart",
        (event) => {

            touchStartX =
                event.touches[0].clientX;

        },
        {
            passive: true
        }
    );


    container.addEventListener(
        "touchmove",
        (event) => {

            const currentX =
                event.touches[0].clientX;


            const difference =
                currentX -
                touchStartX;


            targetRotationY +=
                difference *
                0.008;


            touchStartX =
                currentX;

        },
        {
            passive: true
        }
    );



    /* =====================================
       ANIMAÇÃO
    ===================================== */

    function animate(time) {

        requestAnimationFrame(
            animate
        );


        /*
         * Quando o mouse NÃO está sobre
         * o modelo, ele gira sozinho.
         */

        if (!mouseOver) {

            targetRotationY +=
                0.004;

        }



        /*
         * Suavização
         */

        voxelCube.rotation.y +=

            (
                targetRotationY -
                voxelCube.rotation.y
            ) *
            0.05;



        voxelCube.rotation.x +=

            (
                targetRotationX -
                voxelCube.rotation.x
            ) *
            0.05;



        /*
         * Flutuação vertical
         */

        voxelCube.position.y =

            Math.sin(
                time *
                0.0015
            ) *
            0.10;



        /*
         * Renderização
         */

        renderer.render(
            scene,
            camera
        );

    }



    animate(0);



    /* =====================================
       RESPONSIVIDADE
    ===================================== */

    window.addEventListener(
        "resize",
        () => {

            const width =
                container.clientWidth;


            const height =
                container.clientHeight;


            camera.aspect =
                width /
                height;


            camera.updateProjectionMatrix();


            renderer.setSize(
                width,
                height
            );

        }
    );



    /* =====================================
       FORMULÁRIO
    ===================================== */

    const form =
        document.querySelector(
            ".contact-form"
        );


    if (form) {

        form.addEventListener(
            "submit",
            (event) => {

                event.preventDefault();

                alert(
                    "Mensagem enviada! 🌱"
                );

                form.reset();

            }
        );

    }

}


/* =========================================
   BIOCRAFT — JOGO
========================================= */

const choiceButtons =
    document.querySelectorAll(".choice-btn");

const productionValue =
    document.getElementById("productionValue");

const environmentValue =
    document.getElementById("environmentValue");

const gameCo2 =
    document.getElementById("gameCo2");

const gameScore =
    document.getElementById("gameScore");

const productionBar =
    document.getElementById("productionBar");

const environmentBar =
    document.getElementById("environmentBar");

const co2GameBar =
    document.getElementById("co2GameBar");

const earthBlock =
    document.getElementById("earthBlock");

const gameMessage =
    document.getElementById("gameMessage");

const gameResult =
    document.getElementById("gameResult");

const restartGame =
    document.getElementById("restartGame");



/* =========================================
   ESTADO INICIAL
========================================= */

let game = {

    production: 50,

    environment: 50,

    co2: 400,

    score: 100,

    gameOver: false

};



/* =========================================
   ATUALIZAR JOGO
========================================= */

function updateGame() {

    productionValue.textContent =
        game.production;


    environmentValue.textContent =
        game.environment;


    gameCo2.textContent =
        game.co2 + " ppm";


    gameScore.textContent =
        Math.max(
            0,
            Math.round(game.score)
        );



    /* BARRAS */

    productionBar.style.width =
        Math.min(
            100,
            Math.max(
                0,
                game.production
            )
        ) + "%";


    environmentBar.style.width =
        Math.min(
            100,
            Math.max(
                0,
                game.environment
            )
        ) + "%";


    /*
     * CO2:
     *
     * 200 = 0%
     * 700 = 100%
     */

    let co2Percent =
        (
            game.co2 - 200
        ) / 500 * 100;


    co2GameBar.style.width =
        Math.min(
            100,
            Math.max(
                0,
                co2Percent
            )
        ) + "%";



    /* =====================================
       RACHADURAS
    ===================================== */

    earthBlock.classList.remove(
        "crack-level-1",
        "crack-level-2",
        "crack-level-3"
    );


    /*
     * Quanto menor o CO2,
     * mais o bloco racha.
     */

    if (game.co2 <= 330) {

        earthBlock.classList.add(
            "crack-level-1"
        );

        gameMessage.textContent =
            "⚠ O equilíbrio ambiental está começando a ser afetado.";

    }


    if (game.co2 <= 270) {

        earthBlock.classList.add(
            "crack-level-2"
        );

        gameMessage.textContent =
            "⚠ O ambiente está entrando em uma zona crítica.";

    }


    if (game.co2 <= 220) {

        earthBlock.classList.add(
            "crack-level-3"
        );

        gameMessage.textContent =
            "⚠ O bloco está prestes a quebrar!";

    }


    /* =====================================
       GAME OVER
    ===================================== */

    if (game.co2 <= 180) {

        game.gameOver =
            true;


        gameMessage.textContent =
            "💥 O equilíbrio foi perdido.";

        gameResult.innerHTML =
            "<strong>GAME OVER</strong><br>" +
            "Você reduziu o CO₂ além do limite " +
            "necessário para manter o equilíbrio do ambiente.";


        choiceButtons.forEach(
            button => {

                button.disabled =
                    true;

                button.style.opacity =
                    "0.4";

                button.style.cursor =
                    "not-allowed";

            }
        );

    }



    /* =====================================
       VITÓRIA
    ===================================== */

    if (
        game.production >= 85 &&
        game.environment >= 70 &&
        game.co2 >= 250 &&
        game.co2 <= 400 &&
        !game.gameOver
    ) {

        gameResult.innerHTML =
            "🌱 <strong>Excelente empreendimento!</strong><br>" +
            "Você encontrou um bom equilíbrio entre " +
            "crescimento e sustentabilidade.";

    }

}



/* =========================================
   ESCOLHAS
========================================= */

choiceButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                if (game.gameOver) {
                    return;
                }


                const production =
                    Number(
                        button.dataset.production
                    );


                const environment =
                    Number(
                        button.dataset.environment
                    );


                const co2 =
                    Number(
                        button.dataset.co2
                    );


                const cost =
                    Number(
                        button.dataset.cost
                    );



                /*
                 * Aplicar mudanças
                 */

                game.production +=
                    production;


                game.environment +=
                    environment;


                game.co2 +=
                    co2;


                /*
                 * Limites
                 */

                game.production =
                    Math.min(
                        100,
                        Math.max(
                            0,
                            game.production
                        )
                    );


                game.environment =
                    Math.min(
                        100,
                        Math.max(
                            0,
                            game.environment
                        )
                    );



                /*
                 * Pontuação
                 *
                 * Quanto maior a produção
                 * e sustentabilidade,
                 * melhor.
                 *
                 * CO2 muito alto reduz pontos.
                 */

                game.score +=
                    production * 0.8;

                game.score +=
                    environment * 1.2;

                game.score -=
                    Math.max(
                        0,
                        co2
                    ) * 0.2;

                game.score -=
                    cost * 0.5;



                updateGame();

            }
        );

    }
);



/* =========================================
   REINICIAR
========================================= */

restartGame.addEventListener(
    "click",
    () => {

        game = {

            production: 50,

            environment: 50,

            co2: 400,

            score: 100,

            gameOver: false

        };


        gameResult.innerHTML = "";

        gameMessage.textContent =
            "O planeta está equilibrado.";


        choiceButtons.forEach(
            button => {

                button.disabled =
                    false;

                button.style.opacity =
                    "1";

                button.style.cursor =
                    "pointer";

            }
        );


        updateGame();

    }
);


updateGame();

/* =========================================
   GRÁFICO DO PROJETO FÍSICO
========================================= */

const physicalChartLine =
    document.getElementById("physicalChartLine");

const physicalChartArea =
    document.getElementById("physicalChartArea");

const physicalChartPoints =
    document.getElementById("physicalChartPoints");

const physicalCo2 =
    document.getElementById("physicalCo2");

const physicalTemp =
    document.getElementById("physicalTemp");

const physicalHumidity =
    document.getElementById("physicalHumidity");

const physicalUpdate =
    document.getElementById("physicalUpdate");

const physicalQuality =
    document.getElementById("physicalQuality");



/* =========================================
   DADOS INICIAIS
========================================= */

let physicalData = [
    390,
    410,
    450,
    430,
    470,
    510,
    480,
    440,
    460,
    420,
    400,
    420
];



/* =========================================
   CRIAR GRÁFICO
========================================= */

function createPhysicalChart() {

    const width = 1000;

    const height = 300;

    const minValue = 200;

    const maxValue = 600;


    const points =
        physicalData.map(
            (value, index) => {

                const x =
                    index *
                    (width /
                        (physicalData.length - 1));


                const y =
                    height -
                    (
                        (value - minValue) /
                        (maxValue - minValue)
                    ) * height;


                return `${x},${y}`;

            }
        );


    physicalChartLine.setAttribute(
        "points",
        points.join(" ")
    );



    /* =====================================
       ÁREA PREENCHIDA
    ===================================== */

    const firstPoint =
        points[0].split(",");


    const lastPoint =
        points[points.length - 1]
            .split(",");


    const areaPath =

        `M ${firstPoint[0]} ${firstPoint[1]} ` +

        points
            .slice(1)
            .map(
                point => {

                    const [x, y] =
                        point.split(",");

                    return `L ${x} ${y}`;

                }
            )
            .join(" ") +

        ` L ${lastPoint[0]} ${height}` +

        ` L ${firstPoint[0]} ${height} Z`;


    physicalChartArea.setAttribute(
        "d",
        areaPath
    );



    /* =====================================
       PONTOS
    ===================================== */

    physicalChartPoints.innerHTML = "";


    physicalData.forEach(
        (value, index) => {

            const x =
                index *
                (width /
                    (physicalData.length - 1));


            const y =
                height -
                (
                    (value - minValue) /
                    (maxValue - minValue)
                ) * height;


            const circle =
                document.createElementNS(
                    "http://www.w3.org/2000/svg",
                    "circle"
                );


            circle.setAttribute(
                "cx",
                x
            );


            circle.setAttribute(
                "cy",
                y
            );


            circle.setAttribute(
                "r",
                "5"
            );


            circle.setAttribute(
                "fill",
                "#72e69a"
            );


            physicalChartPoints.appendChild(
                circle
            );

        }
    );

}



/* =========================================
   ATUALIZAR DADOS
========================================= */

function updatePhysicalData() {

    /*
     * Simulação de um novo valor
     * vindo do sensor.
     */

    const lastValue =
        physicalData[
        physicalData.length - 1
        ];


    const variation =
        Math.floor(
            Math.random() * 41
        ) - 20;


    let newValue =
        lastValue + variation;


    /*
     * Mantém o gráfico
     * dentro dos limites.
     */

    newValue =
        Math.max(
            300,
            Math.min(
                550,
                newValue
            )
        );


    physicalData.push(
        newValue
    );


    physicalData.shift();


    physicalCo2.textContent =
        newValue;



    /* TEMPERATURA */

    const temperature =
        (
            23 +
            Math.random() * 5
        ).toFixed(1);


    physicalTemp.textContent =
        temperature + "°C";



    /* UMIDADE */

    const humidity =
        Math.floor(
            60 +
            Math.random() * 16
        );


    physicalHumidity.textContent =
        humidity + "%";



    /* QUALIDADE */

    if (newValue < 450) {

        physicalQuality.textContent = "BOA";
        physicalFooterQuality.textContent = "BOA";

        physicalQuality.style.color = "#72e69a";
        physicalFooterQuality.style.color = "#72e69a";

    }

    else if (newValue < 500) {

        physicalQuality.textContent = "MODERADA";
        physicalFooterQuality.textContent = "MODERADA";

        physicalQuality.style.color = "#e8d66a";
        physicalFooterQuality.style.color = "#e8d66a";

    }

    else {

        physicalQuality.textContent = "ATENÇÃO";
        physicalFooterQuality.textContent = "ATENÇÃO";

        physicalQuality.style.color = "#ff8c42";
        physicalFooterQuality.style.color = "#ff8c42";

    }



    /* HORÁRIO */

    const now =
        new Date();


    physicalUpdate.textContent =
        now.toLocaleTimeString(
            "pt-BR"
        );



    /* REDESENHA */

    createPhysicalChart();

}



createPhysicalChart();


/*
 * Atualiza a cada 3 segundos.
 */

setInterval(
    updatePhysicalData,
    3000
);