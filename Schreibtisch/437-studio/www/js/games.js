/* =========================================================================
   437 STUDIO | ARCADE LAUNCHER & CLOUD LEADERBOARD ENGINE (PROFIL-LINKS)
   ========================================================================= */

"use strict";

const GAMES_DATA = [
    {
        id: "game_1",
        title: "CASINO 437",
        category: "action",
        tag: "release",
        devs: "Nalix437",
        desc: "Das offizielle 437-Casino. Spiele Slots, sammle Casino Coins und dominiere die Bestenliste!",
        specs: { os: "Browser (PC/Mobil)", gpu: "Jede Grafikeinheit" },
        banner: "./img/casino.png",
        downloadUrl: "casino.html",
        isWebGame: true
    },
    {
        id: "game_6",
        title: "437: Green Harvest",
        category: "retro",
        tag: "Minigame",
        devs: "Nalix437 & Amnesia437",
        desc: "Das offizielle 437-Studio Pausen-Minigame. Baue Pflanzen an, sammle Erträge und dominiere die Bestenliste!",
        specs: { os: "Browser (PC/Mobil)", gpu: "Alle Grafikeinheiten" },
        banner: "./img/harvest.png",
        downloadUrl: "harvest.html",
        isWebGame: true
    },
    {
        id: "game_7",
        title: "Amnesia's Beat Clicker",
        category: "retro",
        tag: "Studio Idle",
        devs: "Amnesia437 & Nalix437",
        desc: "Produziere fette Beats, baue dein eigenes High-Tech-Studio auf und schürfe Amnesia-Coins auf dem Schwarzmarkt.",
        specs: { os: "Browser (PC/Mobil)", gpu: "Jede Grafikeinheit" },
        banner: "./img/clicker.png",
        downloadUrl: "clicker.html",
        isWebGame: true
    },
    {
        id: "game_2",
        title: "Amnesia's Nightmare",
        category: "horror",
        tag: "Alpha Test",
        devs: "Amnesia437 & Nalix437",
        desc: "Psychologischer Survival-Horror in den verlassenen Serverräumen des Studios.",
        specs: { os: "Windows 10", gpu: "GTX 1660 Super" },
        banner: "./img/comming.jpg",
        downloadUrl: "#",
        isWebGame: false
    },
    {
        id: "game_3",
        title: "Project Reno: Grid City",
        category: "openworld",
        tag: "Pre-Alpha",
        devs: "Nalix437",
        desc: "Erkunde eine gigantische Neon-Metropole komplett ohne Ladezeiten.",
        specs: { os: "Windows 11", gpu: "RTX 3060" },
        banner: "./img/comming.jpg",
        downloadUrl: "#",
        isWebGame: false
    },
    {
        id: "game_4",
        title: "437: Cyber Strike",
        category: "fps",
        tag: "Stable v1.0",
        devs: "Nalix437 & Amnesia437",
        desc: "Taktischer Ego-Shooter in einer dystopischen Arena.",
        specs: { os: "Windows 10/11", gpu: "GTX 1050 Ti" },
        banner: "./img/comming.jpg",
        downloadUrl: "#",
        isWebGame: false
    },
    {
        id: "game_5",
        title: "Retro Wave Rider",
        category: "retro",
        tag: "Full Release",
        devs: "Amnesia437",
        desc: "Ein Synthwave-Endless-Runner im glorreichen 80er-Jahre-Arcade-Look.",
        specs: { os: "Windows 7/10/11", gpu: "Integrierte Grafikkarte" },
        banner: "./img/comming.jpg",
        downloadUrl: "#",
        isWebGame: false
    }
];

let activeLeaderboardGame = "harvest";
let cachedLeaderboardData = [];

function initGamesModule() {
    renderGamesEngine("all");
    loadCloudLeaderboardMatrix();
}

function renderGamesEngine(filter) {
    const grid = document.getElementById("games-grid");
    if (!grid) return;
    grid.innerHTML = "";

    let cardIndex = 0;

    GAMES_DATA.forEach(game => {
        if (filter !== "all") {
            if (filter === "alpha" && !game.tag.toLowerCase().includes("alpha") && !game.tag.toLowerCase().includes("beta")) return;
            if (filter !== "alpha" && game.category !== filter) return;
        }

        const card = document.createElement("div");
        card.className = "game-card";
        // Gestaffelte Animationsverzögerung für flüssigen Effekt (Cascade)
        card.style.animationDelay = `${cardIndex * 0.08}s`;
        cardIndex++;

        let actionHTML = "";
        let tagStyleHTML = "";

        if (game.isWebGame) {
            tagStyleHTML = `style="border-color: #00f0ff; color: #00f0ff; text-shadow: 0 0 5px #00f0ff;"`;
            actionHTML = `<a href="${game.downloadUrl}" class="btn btn-neon-pink full-width text-center" style="display:block; text-decoration:none; text-align:center;"><i class="fas fa-play"></i> Matrix Starten [WEB]</a>`;
        } else {
            tagStyleHTML = `style="border-color: #ff007f; color: #ff007f;"`;
            actionHTML = typeof currentUser !== "undefined" && currentUser
                ? `<a href="${game.downloadUrl}" class="btn btn-neon-green full-width text-center" style="display:block; text-decoration:none; text-align:center;"><i class="fas fa-download"></i> Spiel Downloaden</a>`
                : `<div class="game-locked-msg" style="color:#777; font-size:12px; font-family:monospace; text-align:center;"><i class="fas fa-lock"></i> Account benötigt zum Downloaden</div>`;
        }

        card.innerHTML = `
            <div class="game-banner">
                <img src="${game.banner}" alt="${escapeHTML(game.title)}" style="width:100%; height:140px; object-fit:cover; border-radius:4px; display:block;">
                <div class="game-tag" ${tagStyleHTML}>${escapeHTML(game.tag)}</div>
            </div>
            <div class="game-info" style="margin-top:15px; display:flex; flex-direction:column; flex-grow:1; justify-content:space-between;">
                <div>
                    <h2 style="color:#fff; font-size:18px; margin-bottom:5px; word-break:break-word;">${escapeHTML(game.title)}</h2>
                    <div class="game-devs" style="color:#555; font-size:11px; font-family:monospace; margin-bottom:8px; word-break:break-word;">Entwickler: ${escapeHTML(game.devs)}</div>
                    <p class="game-desc" style="color:#aaa; font-size:13px; line-height:1.4; margin-bottom:12px; word-break:break-word;">${escapeHTML(game.desc)}</p>
                    <div class="sys-req" style="font-size:11px; color:#666; font-family:monospace; display:flex; flex-direction:column; gap:2px; margin-bottom:15px; word-break:break-word;">
                        <strong>Anforderungen:</strong>
                        <span>OS: ${escapeHTML(game.specs.os)}</span>
                        <span>Grafik: ${escapeHTML(game.specs.gpu)}</span>
                    </div>
                </div>
                <div class="game-action-zone" style="width:100%; box-sizing:border-box;">${actionHTML}</div>
            </div>`;
        grid.appendChild(card);
    });
}

function filterGames(category, event) {
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
    if (event && event.target) event.target.classList.add("active");
    renderGamesEngine(category);
}

async function loadCloudLeaderboardMatrix() {
    cachedLeaderboardData = [];

    if (typeof supabaseClient === "undefined" || !supabaseClient) {
        renderLeaderboardTableUI();
        return;
    }

    try {
        const { data: harvestData, error: harvestError } = await supabaseClient
            .from("harvest_saves")
            .select("username, highscore, coins");

        if (!harvestError && harvestData) {
            harvestData.forEach(entry => {
                cachedLeaderboardData.push({
                    username: entry.username || "Unbekannt",
                    game: "harvest",
                    score: entry.highscore || entry.coins || 0
                });
            });
        }

        const { data: clickerData, error: clickerError } = await supabaseClient
            .from("clicker_saves")
            .select("username, total_beats");

        if (!clickerError && clickerData) {
            clickerData.forEach(entry => {
                cachedLeaderboardData.push({
                    username: entry.username || "Unbekannt",
                    game: "clicker",
                    score: entry.total_beats || 0
                });
            });
        }

        renderLeaderboardTableUI();
    } catch (e) {
        console.warn("Leaderboard Cloud Fehler:", e);
        renderLeaderboardTableUI();
    }
}

function renderLeaderboardTableUI() {
    const tbody = document.getElementById("leaderboard-target-rows");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filteredRows = cachedLeaderboardData
        .filter(entry => entry.game === activeLeaderboardGame)
        .sort((a, b) => b.score - a.score);

    if (filteredRows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#555; font-family:monospace; padding:20px;">[KEINE_DATENSÄTZE_GEFUNDEN]</td></tr>`;
        return;
    }

    filteredRows.forEach((entry, index) => {
        const tr = document.createElement("tr");
        const rank = index + 1;

        let rankClass = "";
        if (rank === 1) rankClass = "rank-1";
        if (rank === 2) rankClass = "rank-2";
        if (rank === 3) rankClass = "rank-3";

        const ADMIN_NAMES = ["nalix437", "amnesia437"];
        const crownEmoji = ADMIN_NAMES.includes((entry.username || "").toLowerCase()) ? " 👑" : "";
        const profileUrl = `profile.html?user=${encodeURIComponent(entry.username)}`;

        tr.innerHTML = `
            <td><span class="rank-badge ${rankClass}">#${rank}</span></td>
            <td style="color:#fff; font-weight:bold; overflow:hidden; text-overflow:ellipsis; max-width:130px;">
                <a href="${profileUrl}" style="color:#fff; text-decoration:none; transition:0.2s;" onmouseover="this.style.color='#00f0ff'" onmouseout="this.style.color='#fff'">${typeof escapeHTML === "function" ? escapeHTML(entry.username) : entry.username}</a>${crownEmoji}
            </td>
            <td style="text-align:right; font-family:monospace; font-weight:bold; color:#00ff66; text-shadow:0 0 4px rgba(0,255,102,0.2);">${Math.floor(entry.score || 0).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

function switchLeaderboardTab(gameType) {
    activeLeaderboardGame = gameType;
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

    if (gameType === "harvest") document.getElementById("tab-harvest")?.classList.add("active");
    if (gameType === "clicker") document.getElementById("tab-clicker")?.classList.add("active");

    renderLeaderboardTableUI();
}