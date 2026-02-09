import { SoundTouch, SimpleFilter, WebAudioBufferSource, getWebAudioNode } 
from './soundTouch.js';

/************************************
 * GLOBALS
 ************************************/
let audioContext;
let audioBuffer;
let node;
let st, filter;
let source;
let currentVis = 1;
let hue = 0;
let lastFile = null; // 🔹 stocke le dernier fichier sélectionné



let isPlaying = false;

// Gain
let masterGainNode;
let dbGainNode;

// Visualizer
let analyser;
let dataArray;
let canvas = document.getElementById("aCanvas");
let ctx = canvas.getContext("2d");
let width = canvas.width;
let height = canvas.height;
let animId;

/************************************
 * UI
 ************************************/
const fileInput = document.getElementById('fileInput');
const playBtn  = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn  = document.getElementById('stopBtn');

const pitchSlider = document.getElementById('pitchSlider');
const pitchValue = document.getElementById('pitchValue');

const masterSlider = document.getElementById('masterVolume');
const masterValue = document.getElementById('masterValue');

const dbSlider = document.getElementById('dbGain');
const dbValue = document.getElementById('dbValue');

const status = document.getElementById('status');

/************************************
 * STATUS
 ************************************/
function setStatus(text) {
    status.textContent = text;
}

/************************************
 * LOAD FILE
 ************************************/
fileInput.addEventListener('change', async () => {

    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const file = fileInput.files[0];
    if (!file) return;

    lastFile = file; // 🔹 stocke le fichier pour reload

    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 🎚 Gain nodes
    masterGainNode = audioContext.createGain();
    dbGainNode = audioContext.createGain();

    masterGainNode.gain.value = 1;
    dbGainNode.gain.value = 1;

    // 🎵 SoundTouch
    st = new SoundTouch(audioContext.sampleRate);
    st.pitchSemitones = parseFloat(pitchSlider.value);

    source = new WebAudioBufferSource(audioBuffer);
    filter = new SimpleFilter(source, st);
    node = getWebAudioNode(audioContext, filter);

    // 📊 Visualizer
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // 🔌 CHAÎNE AUDIO PROPRE
    node.connect(masterGainNode);
    masterGainNode.connect(dbGainNode);
    dbGainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    setStatus("Fichier chargé ✔");
});


playBtn.addEventListener('click', async () => {

    if (!audioBuffer || isPlaying) return;

    await audioContext.resume();

    isPlaying = true;
    setStatus("Lecture en cours ▶");

    drawVisualizer();
});

pauseBtn.addEventListener('click', () => {

    if (!isPlaying) return;

    audioContext.suspend();
    cancelAnimationFrame(animId);

    isPlaying = false;
    setStatus("Lecture en pause ⏸");
});


stopBtn.addEventListener('click', () => {

    if (!audioBuffer) return;

    // 1️⃣ Arrête l'animation du visualizer
    cancelAnimationFrame(animId);

    // 2️⃣ Stop et déconnecte le node SoundTouch existant
    if (node) {
        try { node.stop(); } catch(e) {}   // stop node si en lecture
        try { node.disconnect(); } catch(e) {}  // déconnecte du gain
        node = null;
    }

    // 3️⃣ Reset SoundTouch
    if (st) st.clear();

    // 4️⃣ Réinitialise flags
    isPlaying = false;

    // 5️⃣ Efface le canvas
    ctx.clearRect(0, 0, width, height);

    // 6️⃣ Status
    setStatus("Lecture arrêtée ⏹ (retour au début)");
});



pitchSlider.addEventListener('input', () => {
    const semitones = parseFloat(pitchSlider.value);
    pitchValue.textContent = semitones.toFixed(1);

    if (st) st.pitchSemitones = semitones;
});

masterSlider.addEventListener('input', () => {
    const value = parseFloat(masterSlider.value);
    masterGainNode.gain.value = value;
    masterValue.textContent = Math.round(value * 100) + "%";
});

dbSlider.addEventListener('input', () => {
    const db = parseFloat(dbSlider.value);
    const linear = Math.pow(10, db / 20);
    dbGainNode.gain.value = linear;
    dbValue.textContent = db.toFixed(1) + " dB";
});


document.querySelectorAll('input[name="vis"]').forEach(radio => {
    radio.addEventListener('change', () => {
        currentVis = parseInt(radio.value.replace("vis", ""));
    });
});

function drawLine() {

    ctx.beginPath();

    let sliceWidth = width / dataArray.length;
    let x = 0;

    for(let i = 0; i < dataArray.length; i++) {
        let v = dataArray[i] / 128.0;
        let y = v * height / 2;

        if(i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
    }

    ctx.strokeStyle = "green";
    ctx.stroke();
}


function drawCircle() {

    let centerX = width /2;
    let centerY = height /2 ;
    let radius = 30;

    let angleStep = (Math.PI * 2) / dataArray.length;

    for(let i = 0; i < dataArray.length; i++) {

        let value = dataArray[i];
        let angle = i * angleStep;

        let x = centerX + Math.cos(angle) * (radius + value / 2);
        let y = centerY + Math.sin(angle) * (radius + value / 2);

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 100);
        ctx.fillStyle = `hsl(${hue},100%,50%)`;
        ctx.fill();
    }

    hue = (hue + 1) % 360;
}

function drawSpikes() {

    let centerX = width / 2;
    let centerY = height / 2;
    let radius = 3;

    let angleStep = (Math.PI * 2) / dataArray.length;

    for(let i = 0; i < dataArray.length; i++) {

        let value = dataArray[i];
        let angle = i * angleStep;

        let x1 = centerX + Math.cos(angle) * radius;
        let y1 = centerY + Math.sin(angle) * radius;

        let x2 = centerX + Math.cos(angle) * (radius + value);
        let y2 = centerY + Math.sin(angle) * (radius + value);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = "green";
        ctx.stroke();
    }
}

function drawBars() {

    let barWidth = width / dataArray.length;
    let x = 0;

    for(let i = 0; i < dataArray.length; i++) {

        let value = dataArray[i];

        ctx.fillStyle = `hsl(${i * 2},100%,50%)`;
        ctx.fillRect(x, height - value, barWidth, value);

        x += barWidth;
    }
}
function drawFractalRot() {
    let centerX = width / 2;
    let centerY = height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Rotation globale pour effet dynamique
    let globalAngle = (Date.now() / 1000) % (Math.PI * 2);
    ctx.rotate(globalAngle);

    let branches = 8; // nombre de branches autour du centre
    let maxRadius = Math.min(width, height) / 3;

    // ⚡ Utiliser fréquence pour un meilleur rendu
    analyser.getByteFrequencyData(dataArray);

    for (let i = 0; i < dataArray.length; i++) {
        let value = dataArray[i]; // 0 -> 255
        let angle = (i / dataArray.length) * (Math.PI * 2);

        // Pour chaque branche
        for (let b = 0; b < branches; b++) {
            let branchAngle = (b / branches) * (Math.PI * 2) + angle;

            // ⚡ Rendre visible: multiplier pour rayon
            let radius = (value / 255) * maxRadius;

            let x = Math.cos(branchAngle) * radius;
            let y = Math.sin(branchAngle) * radius;

            // Petit triangle fractal
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(x, y);
            ctx.lineTo(x * 0.8 - y * 0.2, y * 0.8 + x * 0.2);
            ctx.closePath();

            ctx.fillStyle = `hsl(${(i * 4 + b * 20 + hue) % 360}, 100%, 50%)`;
            ctx.fill();
        }
    }

    ctx.restore();

    hue = (hue + 1) % 360;
}


/**
 * drawFractal
 * Dessine une fractale récursive autour d'un point central
 * Paramètres modulables pour ajuster forme, profondeur, branches, couleur et rotation
 * 
 * @param {number} x - centre X
 * @param {number} y - centre Y
 * @param {number} length - longueur de la branche principale
 * @param {number} angle - angle de la branche principale
 * @param {number} depth - profondeur actuelle de récursion
 * @param {number} maxDepth - profondeur maximale
 * @param {number} branches - nombre de branches par récursion
 * @param {boolean} rotate - appliquer une rotation globale dynamique
 */

function drawLightningBolt(centerX, centerY, angle, length, segments = 20, chaos = 20) {

    let x = centerX;
    let y = centerY;

    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let i = 0; i < segments; i++) {

        let progress = i / segments;

        // direction principale
        let dirX = Math.cos(angle);
        let dirY = Math.sin(angle);

        // déviation aléatoire
        let offsetX = (Math.random() - 0.5) * chaos;
        let offsetY = (Math.random() - 0.5) * chaos;

        x = centerX + dirX * length * progress + offsetX;
        y = centerY + dirY * length * progress + offsetY;

        ctx.lineTo(x, y);
    }

    ctx.strokeStyle = `hsl(${hue % 360}, 100%, 60%)`;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = `hsl(${hue % 360}, 100%, 50%)`;

    ctx.stroke();

    ctx.shadowBlur = 0;
}


function drawFractal(x, y, length, angle, depth, maxDepth, branches = 30, rotate = true) {

    if (depth > maxDepth || length < 2) return; // condition d'arrêt

    ctx.save();
    ctx.translate(x, y);

    if (rotate) {
        let globalAngle = (Date.now() / 1000) * 0.5; // rotation dynamique
        ctx.rotate(globalAngle);
    }

    // Dessiner une ligne principale
    let endX = Math.cos(angle) * length;
    let endY = Math.sin(angle) * length;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = `hsl(${(hue + depth * 30) % 360}, 100%, 50%)`;
    ctx.lineWidth = Math.max(1, (maxDepth - depth + 1));
    ctx.stroke();

    // Récursion : créer sous-branches
    for (let b = 0; b < branches; b++) {
        //let branchAngle = angle + ((b - (branches - 1) / 2) * Math.PI / 6); // écart angulaire
        let branchAngle = angle + (Math.random() - 0.5) * 2;

        let branchLength = length * (0.6 + Math.random() * 0.2); // variation taille
        drawFractal(endX, endY, branchLength, branchAngle, depth + 1, maxDepth, branches, rotate);
    }

    ctx.restore();
}
function drawFractalVisualizer() {

    let centerX = width / 2;
    let centerY = height / 2;

    analyser.getByteFrequencyData(dataArray);

    // Intensité moyenne
    let avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

    // ⚡ Nombre d'éclairs dépend du volume
    let boltCount = Math.floor((avg*4) / 40); 

    // ⚡ Longueur dépend du volume
    let maxLength = ((avg*2) / 255) * (Math.min(width, height) / 2);

    // Rotation globale lente
    let rotation = Date.now() * 0.0001;

    for (let i = 0; i < boltCount; i++) {

        let angle = rotation + (i * (Math.PI * 2 / boltCount));

        drawLightningBolt(
            centerX,
            centerY,
            angle,
            maxLength,
            25,          // segments
            30           // chaos (plus grand = plus violent)
        );
    }

    hue += 2;
}





function drawVisualizer() {

    if (!isPlaying) return;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    switch(currentVis) {

        case 1:
            analyser.getByteTimeDomainData(dataArray);
            drawLine();
            break;

        case 2:
            analyser.getByteTimeDomainData(dataArray);
            drawCircle();
            break;

        case 3: // ⚡ Mode éclairs rotatifs
            drawFractalVisualizer();
            break;

        case 4:
            analyser.getByteFrequencyData(dataArray);
            drawBars();
            break;
    }

    animId = requestAnimationFrame(drawVisualizer);
}





