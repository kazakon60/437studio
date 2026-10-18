// =========================================================================
// 437 STUDIO | AUDIO FORGE REAL-VISUALIZER ENGINE (OPTIMIERT)
// =========================================================================
const AMNESIA_TRACKS = [
    { id: "track_1", title: "Amnesia437 - Unfassbar (prod. nephew)", file: "audio/unfassbar.ogg", duration: "CORE" },
    { id: "track_2", title: "Amnesia437 - 76er Underground (prod. nephew)", file: "audio/underground.mp3", duration: "CORE" },
    { id: "track_3", title: "Amnesia437 - Pfandflaschen (feat. luno5)", file: "audio/pfandflasche.mp3", duration: "CORE" }
];

let currentTrackIndex = 0;
let isPlaying = false;

let audioCore = null;
let playIcon = null;
let playerDisc = null;
let trackTitleDisplay = null;
let progressBar = null;
let currentTimeDisplay = null;
let durationTimeDisplay = null;
let volumeSlider = null;

let audioContext = null;
let audioSource = null;
let audioAnalyser = null;
let frequencyDataArray = null;
let visualizerCanvas = null;
let canvasContext = null;
let animationId = null;

document.addEventListener("DOMContentLoaded", () => {
    audioCore = document.getElementById("audio-core");
    playIcon = document.getElementById("play-icon");
    playerDisc = document.getElementById("player-disc");
    trackTitleDisplay = document.getElementById("current-track-title");
    progressBar = document.getElementById("progress-bar");
    currentTimeDisplay = document.getElementById("time-current");
    durationTimeDisplay = document.getElementById("time-duration");
    volumeSlider = document.getElementById("volume-slider");
    visualizerCanvas = document.getElementById("visualizer-canvas");

    if (visualizerCanvas) {
        canvasContext = visualizerCanvas.getContext("2d");
        setupCanvasResolution();
    }

    if (audioCore) {
        renderTracklistUI();
        loadTrackEngine(currentTrackIndex);
        initAudioEvents();
    }
});

function setupCanvasResolution() {
    if (!visualizerCanvas || !visualizerCanvas.parentElement) return;
    visualizerCanvas.width = visualizerCanvas.parentElement.clientWidth;
    visualizerCanvas.height = visualizerCanvas.parentElement.clientHeight;
}

function renderTracklistUI() {
    const container = document.getElementById("player-tracklist");
    if (!container) return;
    container.innerHTML = "";

    AMNESIA_TRACKS.forEach((track, index) => {
        const item = document.createElement("div");
        item.className = "track-item" + (index === currentTrackIndex ? " active-track" : "");
        item.id = `track-item-${index}`;
        item.style.cssText = "padding:10px; margin-bottom:8px; background:#06060f; border:1px solid #1a1a3a; border-radius:4px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;";
        item.onclick = () => playerSelectTrack(index);

        item.innerHTML = `
            <span class="t-name" style="color:#fff; font-size:13px;"><i class="fas fa-music" style="margin-right: 10px; color:#00f0ff; font-size: 12px;"></i> ${escapeHTML(track.title)}</span>
            <span class="t-duration" style="color: #00ff66; font-family: monospace; font-weight: bold; font-size:12px;">${track.duration}</span>
        `;
        container.appendChild(item);
    });
}

function loadTrackEngine(index) {
    if (!audioCore || !AMNESIA_TRACKS[index]) return;

    currentTrackIndex = index;
    audioCore.src = AMNESIA_TRACKS[index].file;
    if (trackTitleDisplay) trackTitleDisplay.innerText = AMNESIA_TRACKS[index].title;

    document.querySelectorAll(".track-item").forEach(el => el.classList.remove("active-track"));
    const activeItem = document.getElementById(`track-item-${index}`);
    if (activeItem) activeItem.classList.add("active-track");

    if (progressBar) progressBar.value = 0;
    if (currentTimeDisplay) currentTimeDisplay.innerText = "0:00";
    if (durationTimeDisplay) durationTimeDisplay.innerText = "--:--";
}

function initWebAudioAnalyser() {
    if (audioContext) return;

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioAnalyser = audioContext.createAnalyser();

        audioSource = audioContext.createMediaElementSource(audioCore);
        audioSource.connect(audioAnalyser);
        audioAnalyser.connect(audioContext.destination);

        audioAnalyser.fftSize = 64;
        const bufferLength = audioAnalyser.frequencyBinCount;
        frequencyDataArray = new Uint8Array(bufferLength);
    } catch (e) {
        console.error("Web Audio API konnte nicht gestartet werden:", e);
    }
}

function playerTogglePlay() {
    if (!audioCore) return;

    initWebAudioAnalyser();

    if (audioContext && audioContext.state === "suspended") {
        audioContext.resume();
    }

    if (isPlaying) {
        audioCore.pause();
        isPlaying = false;
        if (playIcon) playIcon.className = "fas fa-play";
        if (playerDisc) playerDisc.classList.remove("disc-spinning");
        cancelAnimationFrame(animationId);
        clearCanvasSpielfeld();
    } else {
        audioCore.play().then(() => {
            isPlaying = true;
            if (playIcon) playIcon.className = "fas fa-pause";
            if (playerDisc) playerDisc.classList.add("disc-spinning");

            setupCanvasResolution();
            drawRealtimeVisualizerPulse();

            // --- ERFOLG FREISCHALTEN ---
            if (typeof unlockAchievement === "function") {
                unlockAchievement("sound_addict");
            }
            // ---------------------------

        }).catch(e => {
            console.warn("Wiedergabe blockiert oder Datei fehlt.", e);
            alert("🎵 Audio Forge: Bitte stelle sicher, dass die Musikdateien im Ordner 'audio' liegen!");
        });
    }
}

function drawRealtimeVisualizerPulse() {
    if (!isPlaying) return;
    animationId = requestAnimationFrame(drawRealtimeVisualizerPulse);

    if (!audioAnalyser || !canvasContext || !visualizerCanvas) return;

    audioAnalyser.getByteFrequencyData(frequencyDataArray);
    canvasContext.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const barCount = audioAnalyser.frequencyBinCount;
    const barWidth = (visualizerCanvas.width / barCount) * 1.2;
    let barHeight;
    let xCoordinate = 0;

    for (let i = 0; i < barCount; i++) {
        barHeight = frequencyDataArray[i] * 0.28;

        canvasContext.fillStyle = "#00ff66";
        canvasContext.shadowBlur = 10;
        canvasContext.shadowColor = "#00ff66";

        canvasContext.fillRect(
            xCoordinate,
            visualizerCanvas.height - barHeight,
            barWidth - 4,
            barHeight
        );

        xCoordinate += barWidth;
    }
    canvasContext.shadowBlur = 0;
}

function clearCanvasSpielfeld() {
    if (canvasContext && visualizerCanvas) {
        canvasContext.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }
}

function playerSelectTrack(index) {
    loadTrackEngine(index);
    isPlaying = false;
    playerTogglePlay();
}

function playerNextTrack() {
    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= AMNESIA_TRACKS.length) nextIndex = 0;
    playerSelectTrack(nextIndex);
}

function playerPrevTrack() {
    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) prevIndex = AMNESIA_TRACKS.length - 1;
    playerSelectTrack(prevIndex);
}

function initAudioEvents() {
    if (!audioCore) return;

    audioCore.addEventListener("loadedmetadata", () => {
        const durationMin = Math.floor(audioCore.duration / 60);
        const durationSec = Math.floor(audioCore.duration % 60);
        if (durationTimeDisplay) durationTimeDisplay.innerText = `${durationMin}:${durationSec < 10 ? "0" : ""}${durationSec}`;
    });

    audioCore.addEventListener("timeupdate", () => {
        if (audioCore.duration) {
            const currentMin = Math.floor(audioCore.currentTime / 60);
            const currentSec = Math.floor(audioCore.currentTime % 60);
            if (currentTimeDisplay) currentTimeDisplay.innerText = `${currentMin}:${currentSec < 10 ? "0" : ""}${currentSec}`;

            const progressPercent = (audioCore.currentTime / audioCore.duration) * 100;
            if (progressBar) progressBar.value = progressPercent;
        }
    });

    if (progressBar) {
        progressBar.addEventListener("input", (e) => {
            if (audioCore.duration) {
                const newTime = (e.target.value / 100) * audioCore.duration;
                audioCore.currentTime = newTime;
            }
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener("input", (e) => {
            audioCore.volume = Number(e.target.value);
        });
    }

    audioCore.addEventListener("ended", () => {
        playerNextTrack();
    });

    window.addEventListener("resize", setupCanvasResolution);
}
