/* =========================================================================
   437 STUDIO | GREEN HARVEST ARCADE (HARVEST ENGINE - OPTIMIZED)
   ========================================================================= */

"use strict";

let harvestCoins = 0;
let harvestHPS = 0;
let plantCounts = new Array(10).fill(0);
let harvestCloudSyncTimeout = null;

const HARVEST_UPGRADES = [
    { name: "LED Grow Light", baseCost: 20, hps: 0.5, icon: "fa-lightbulb" },
    { name: "Hydroponic System", baseCost: 150, hps: 3, icon: "fa-water" },
    { name: "Auto-Drip Nutrients", baseCost: 1200, hps: 20, icon: "fa-tint" },
    { name: "Climate Control Matrix", baseCost: 10000, hps: 120, icon: "fa-snowflake" },
    { name: "Quantum Grow Room", baseCost: 95000, hps: 750, icon: "fa-seedling" }
];

let canvas, ctx;
let crops = [];

document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("harvest-canvas");
    if (canvas) {
        ctx = canvas.getContext("2d");
        canvas.addEventListener("click", handleCanvasClick);
    }

    loadHarvestCloudData();
    loadHarvestLeaderboard();

    setInterval(harvestTick, 1000);
    requestAnimationFrame(gameLoop);

    window.addEventListener("beforeunload", () => {
        executeHarvestCloudSyncImmediate();
    });
});

function loadHarvestCloudData() {
    if (typeof currentUser !== "undefined" && currentUser && typeof supabaseClient !== "undefined" && supabaseClient) {
        supabaseClient.from("harvest_saves").select("*").eq("username", currentUser.username).maybeSingle().then(({ data, error }) => {
            if (!error && data) {
                harvestCoins = parseFloat(data.coins) || parseFloat(data.highscore) || 0;
                if (data.upgrade_levels) {
                    try {
                        let parsedLevels = typeof data.upgrade_levels === "string" ? JSON.parse(data.upgrade_levels) : data.upgrade_levels;
                        if (Array.isArray(parsedLevels)) plantCounts = parsedLevels;
                    } catch (e) {
                        console.warn("Upgrade-Levels Parsing fehlgeschlagen.");
                    }
                }
            } else {
                loadHarvestLocalStorageFallback();
            }
            calculateHPS();
            renderHarvestUI();
            loadHarvestLeaderboard();
        });
    } else {
        loadHarvestLocalStorageFallback();
        calculateHPS();
        renderHarvestUI();
        loadHarvestLeaderboard();
    }
}

function loadHarvestLocalStorageFallback() {
    let localSave = localStorage.getItem("437_harvest_save");
    if (localSave) {
        try {
            let parsed = JSON.parse(localSave);
            harvestCoins = parsed.harvestCoins || 0;
            if (Array.isArray(parsed.plantCounts)) {
                plantCounts = parsed.plantCounts;
            }
        } catch (e) {
            console.warn("Green Harvest: Lokaler Speicherstand beschädigt.");
        }
    }
}

function saveHarvestCloudData() {
    let saveData = {
        harvestCoins: harvestCoins,
        plantCounts: plantCounts
    };
    localStorage.setItem("437_harvest_save", JSON.stringify(saveData));

    // Debounced Cloud Sync
    if (harvestCloudSyncTimeout) clearTimeout(harvestCloudSyncTimeout);
    harvestCloudSyncTimeout = setTimeout(() => {
        executeHarvestCloudSyncImmediate();
    }, 15000);
}

function executeHarvestCloudSyncImmediate() {
    if (typeof currentUser !== "undefined" && currentUser && typeof supabaseClient !== "undefined" && supabaseClient) {
        supabaseClient.from("harvest_saves").upsert([{
            username: currentUser.username,
            coins: harvestCoins,
            highscore: Math.floor(harvestCoins),
            upgrade_levels: JSON.stringify(plantCounts)
        }]).then(({ error }) => {
            if (error) {
                console.warn("Green Harvest Cloud-Sync Fehler:", error.message);
            } else {
                loadHarvestLeaderboard();
            }
        });
    } else {
        loadHarvestLeaderboard();
    }
}

function calculateHPS() {
    let totalHPS = 0;
    plantCounts.forEach((count, i) => {
        if (HARVEST_UPGRADES[i]) {
            totalHPS += (count || 0) * HARVEST_UPGRADES[i].hps;
        }
    });
    harvestHPS = totalHPS;
}

function harvestTick() {
    calculateHPS();
    if (harvestHPS > 0) {
        harvestCoins += harvestHPS;
        renderHarvestUI();
        saveHarvestCloudData();
    }
}

function buyHarvestUpgrade(index) {
    if (!HARVEST_UPGRADES[index]) return;

    let upgrade = HARVEST_UPGRADES[index];
    let count = parseInt(plantCounts[index]) || 0;
    let cost = Math.floor(upgrade.baseCost * Math.pow(1.15, count));

    if (isNaN(cost)) return;

    if (Math.floor(harvestCoins) >= cost) {
        harvestCoins -= cost;
        plantCounts[index] = count + 1;

        calculateHPS();
        renderHarvestUI();
        saveHarvestCloudData();
    } else {
        console.warn(`Nicht genug Harvest Coins! Benötigt: ${cost}`);
    }
}

function handleCanvasClick(e) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    let harvested = false;
    crops.forEach((crop, index) => {
        let dx = clickX - crop.x;
        let dy = clickY - crop.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < crop.radius + 15) {
            harvestCoins += 1;
            crops.splice(index, 1);
            harvested = true;
        }
    });

    if (!harvested && crops.length < 8) {
        crops.push({
            x: clickX,
            y: clickY,
            radius: 12,
            growth: 0.5,
            color: "#00ff66"
        });
    }

    renderHarvestUI();
    saveHarvestCloudData();
}

function gameLoop() {
    if (!ctx || !canvas) return;

    ctx.fillStyle = "#040805";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(0, 255, 102, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    crops.forEach(crop => {
        if (crop.growth < 1) crop.growth += 0.01;

        ctx.fillStyle = crop.color;
        ctx.beginPath();
        ctx.arc(crop.x, crop.y, crop.radius * crop.growth, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = "#00ff66";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    requestAnimationFrame(gameLoop);
}

function loadHarvestLeaderboard() {
    const leaderboardContainer = document.getElementById("harvest-leaderboard-list");
    if (!leaderboardContainer) return;

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
        supabaseClient
            .from("harvest_saves")
            .select("username, highscore, coins")
            .order("highscore", { ascending: false })
            .limit(10)
            .then(({ data, error }) => {
                if (error) {
                    leaderboardContainer.innerHTML = `<div style="color: #ff007f; text-align: center;">Fehler beim Laden.</div>`;
                    return;
                }

                if (!data || data.length === 0) {
                    leaderboardContainer.innerHTML = `<div style="color: #888; text-align: center;">Noch keine Einträge.</div>`;
                    return;
                }

                leaderboardContainer.innerHTML = "";

                data.forEach((entry, index) => {
                    let rankColor = "#fff";
                    if (index === 0) rankColor = "#ffd700";
                    else if (index === 1) rankColor = "#c0c0c0";
                    else if (index === 2) rankColor = "#cd7f32";

                    let row = document.createElement("div");
                    row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid #1a1a3a;";

                    let safeUsername = typeof escapeHTML === "function" ? escapeHTML(entry.username) : entry.username;
                    let scoreVal = Math.floor(entry.highscore || entry.coins || 0).toLocaleString();
                    let profileUrl = `profile.html?user=${encodeURIComponent(entry.username)}`;

                    row.innerHTML = `
                        <div>
                            <span style="color: ${rankColor}; font-weight: bold; margin-right: 10px;">#${index + 1}</span>
                            <a href="${profileUrl}" style="color: #00f0ff; text-decoration: none;">${safeUsername}</a>
                        </div>
                        <div style="text-align: right;">
                            <span style="color: #00ff66; font-weight: bold;">🪙 ${scoreVal}</span>
                        </div>
                    `;
                    leaderboardContainer.appendChild(row);
                });
            });
    } else {
        leaderboardContainer.innerHTML = `<div style="color: #888; text-align: center;">Offline Modus.</div>`;
    }
}

function renderHarvestUI() {
    const coinsDisplay = document.getElementById("harvest-coins-display");
    const hpsDisplay = document.getElementById("harvest-hps-display");

    if (coinsDisplay) coinsDisplay.innerText = Math.floor(harvestCoins).toLocaleString();
    if (hpsDisplay) hpsDisplay.innerText = harvestHPS.toFixed(1);

    renderHarvestShop();
}

function renderHarvestShop() {
    let shopContainer = document.getElementById("harvest-shop-target");
    if (!shopContainer) return;

    shopContainer.innerHTML = "";

    HARVEST_UPGRADES.forEach((upgrade, index) => {
        let count = parseInt(plantCounts[index]) || 0;
        let cost = Math.floor(upgrade.baseCost * Math.pow(1.15, count));
        let canBuy = Math.floor(harvestCoins) >= cost;

        let row = document.createElement("div");
        row.className = "harvest-shop-item";

        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="font-size: 18px; color: #00ff66; width: 25px; text-align: center;">
                    <i class="fas ${upgrade.icon}"></i>
                </div>
                <div>
                    <div style="font-weight: bold; font-size: 14px; color: #fff;">
                        ${typeof escapeHTML === "function" ? escapeHTML(upgrade.name) : upgrade.name}
                        <span style="font-size:11px; background:#141428; border:1px solid #00ff66; color:#00ff66; padding:1px 5px; border-radius:3px; margin-left:6px;">${count}</span>
                    </div>
                    <div style="font-size: 11px; color: #777; margin-top: 3px;">
                        HPS: +${upgrade.hps} | <strong>Kosten: ${cost.toLocaleString()} Coins</strong>
                    </div>
                </div>
            </div>
            <button onclick="buyHarvestUpgrade(${index})" class="btn" style="background:transparent; border:1px solid #00ff66; color:#00ff66; padding:6px 12px; font-size:11px; font-family:monospace; font-weight:bold; cursor:pointer; border-radius:4px;" ${!canBuy ? 'disabled' : ''}>
                Kaufen
            </button>
        `;
        shopContainer.appendChild(row);
    });
}
