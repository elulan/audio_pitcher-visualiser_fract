/************************************
 * GLOBALS
 ************************************/
let audioContext;
let audioBuffer;
let node;                 // node WebAudio SoundTouch
let st, filter;
let isPlaying = false;

// Gain
let masterGainNode;

// Visualizer
let analyser;
let dataArray;
let canvas, ctx;
let width, height;
let animId;

// UI
const fileInput = document.getElementById('fileInput');
const playBtn  = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn  = document.getElementById('stopBtn');
const pitchSlider = document.getElementById('pitchSlider');
const status = document.getElementById('status');


/************************************
 * UTILS
 ************************************/
const Constants = { TWO_PI: Math.PI * 2 };

function setStatus(text) {
    status.textContent = text;
}


/************************************
 * INIT CANVAS
 ************************************/
canvas = document.getElementById("aCanvas");
ctx = canvas.getContext("2d");
width = canvas.width;
height = canvas.height;


/************************************
 * LOAD AUDIO FILE
 ************************************/
fileInput.addEventListener('change', async () => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const file = fileInput.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Gain
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = 1;

    // SoundTouch
    st = new SoundTouch(audioContext.sampleRate);
    st.pitchSemitones = parseFloat(pitchSlider.value);

    const source = new WebAudioBufferSource(audioBuffer);
    filter = new SimpleFilter(source, st);

    node = getWebAudioNode(audioContext, filter);

    // Analyser (VISUALIZER)
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // 🔌 Connexions
    node.connect(masterGainNode);
    masterGainNode.connect(analyser);
    analyser.connect(audioContext.destination);

    setStatus("Fichier chargé ✔");
});


/************************************
 * PLAY / PAUSE / STOP
 ************************************/
playBtn.addEventListener('click', async () => {
    if (!audioBuffer || isPlaying) return;

    await audioContext.resume();
    node.start(0);
    isPlaying = true;

    setStatus("Lecture en cours ▶");
    drawVisualizer();
});

pauseBtn.addEventListener('click', async () => {
    if (!audioContext) return;

    if (audioContext.state === "running") {
        await audioContext.suspend();
        setStatus("Lecture en pause ⏸");
    } else {
        await audioContext.resume();
        setStatus("Lecture reprise ▶");
        drawVisualizer();
    }
});

stopBtn.addEventListener('click', () => {
    if (!node) return;

    node.stop();
    cancelAnimationFrame(animId);
    isPlaying = false;

    ctx.clearRect(0, 0, width, height);
    setStatus("Lecture arrêtée ⏹ (retour début)");
});


/************************************
 * PITCH CONTROL
 ************************************/
pitchSlider.addEventListener('input', () => {
    if (!st) return;
    st.pitchSemitones = parseFloat(pitchSlider.value);
});


/************************************
 * VISUALIZER (BAR GRAPH)
 ************************************/
function drawVisualizer() {
    if (!isPlaying) return;

    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    const barWidth = width / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = dataArray[i];
        ctx.fillStyle = `hsl(${i * 2}, 100%, 50%)`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        x += barWidth;
    }

    animId = requestAnimationFrame(drawVisualizer);
}
