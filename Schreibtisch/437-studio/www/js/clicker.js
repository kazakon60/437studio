/* =========================================================================
   437 STUDIO | AMNESIA SOUND FORGE (CLICKER ENGINE - OPTIMIZED)
   ========================================================================= */

"use strict";

let totalBeats = 0;
let clkCoins = 0;
let clickPower = 1;
let equipmentCounts = new Array(20).fill(0);
let clickerCloudSyncTimeout = null;

let activeBuffs = {
    double: false,
    overdrive: false,
    fever: false
};

const CLICKER_UPGRADES = [
    { name: "Neural Script", baseCost: 15, cps: 0.5, icon: "fa-terminal" },
    { name: "Bass Synthesizer", baseCost: 100, cps: 4, icon: "fa-wave-square" },
    { name: "Sub-Woofer Rig", baseCost: 1100, cps: 32, icon: "fa-volume-high" },
    { name: "Amnesia Studio Node", baseCost: 12000, cps: 260, icon: "fa-network-wired" },
    { name: "Quantum Mastering Deck", baseCost: 130000, cps: 1400, icon: "fa-sliders" },
    { name: "Cyber-Deck Matrix", baseCost: 1500000, cps: 7800, icon: "fa-microchip" },
    { name: "Nalix Sound Grid", baseCost: 20000000, cps: 44000, icon: "fa-server" },
    { name: "Aether Frequency Core", baseCost: 330000000, cps: 260000, icon: "fa-atom" }
];

document.addEventListener("DOMContentLoaded", () => {
    loadClickerCloudData();
    loadLeaderboardData();
    setInterval(autoClickerTick, 1000);

    const micTrigger = document.getElementById("studio-mic-trigger");
    if (micTrigger) {
        micTrigger.addEventListener("click", (e) => {
            triggerBeatClick();
            createClickParticle(e);
        });
    }

    window.addEventListener("beforeunload", () => {
        executeClickerCloudSyncImmediate();
    });
});

function loadClickerCloudData() {
    if (typeof currentUser !== "undefined" && currentUser && typeof supabaseClient !== "undefined" && supabaseClient) {
        supabaseClient.from("clicker_saves").select("*").eq("username", currentUser.username).maybeSingle().then(({ data, error }) => {
            if (!error && data) {
                totalBeats = parseFloat(data.total_beats) || 0;
                clkCoins = parseInt(data.coins) || 0;
                if (Array.isArray(data.counts)) {
                    equipmentCounts = data.counts;
                }
            } else {
                loadClickerLocalStorageFallback();
            }
            renderClickerUI();
            loadLeaderboardData();
        });
    } else {
        loadClickerLocalStorageFallback();
        renderClickerUI();
        loadLeaderboardData();
    }
}

function loadClickerLocalStorageFallback() {
    let localSave = localStorage.getItem("437_clicker_save");
    if (localSave) {
        try {
            let parsed = JSON.parse(localSave);
            totalBeats = parsed.totalBeats || 0;
            clkCoins = parsed.clkCoins || 0;
            if (Array.isArray(parsed.equipmentCounts)) {
                equipmentCounts = parsed.equipmentCounts;
            }
        } catch (e) {
            console.warn("Lokaler Speicherstand beschädigt.");
        }
    }
}

function saveClickerCloudData() {
    let saveData = {
        totalBeats: totalBeats,
        clkCoins: clkCoins,
        equipmentCounts: equipmentCounts
    };
    localStorage.setItem("437_clicker_save", JSON.stringify(saveData));

    if (clickerCloudSyncTimeout) clearTimeout(clickerCloudSyncTimeout);
    clickerCloudSyncTimeout = setTimeout(() => {
        executeClickerCloudSyncImmediate();
    }, 15000);
}

function executeClickerCloudSyncImmediate() {
    if (typeof currentUser !== "undefined" && currentUser && typeof supabaseClient !== "undefined" && supabaseClient) {
        supabaseClient.from("clicker_saves").upsert([{
            username: currentUser.username,
            total_beats: totalBeats,
            coins: clkCoins,
            counts: equipmentCounts
        }]).then(({ error }) => {
            if (error) {
                console.warn("Clicker Cloud-Sync Fehler:", error.message);
            } else {
                loadLeaderboardData();
            }
        });
    }
}

function triggerBeatClick() {
    let currentPower = clickPower;

    if (activeBuffs.double) {
        currentPower *= 2;
    }

    totalBeats += currentPower;

    if (activeBuffs.fever || Math.random() < 0.05) {
        clkCoins++;
    }

    if (totalBeats >= 1000 && typeof unlockAchievement === "function") {
        unlockAchievement("beat_producer");
    }
    if (clkCoins >= 1 && typeof unlockAchievement === "function") {
        unlockAchievement("beat_tycoon");
    }

    renderClickerUI();
    saveClickerCloudData();
}

function buyClickerUpgrade(index) {
    if (!CLICKER_UPGRADES[index]) return;

    let upgrade = CLICKER_UPGRADES[index];
    let count = parseInt(equipmentCounts[index]) || 0;
    let cost = Math.floor(upgrade.baseCost * Math.pow(1.15, count));

    if (isNaN(cost)) return;

    if (Math.floor(totalBeats) >= cost) {
        totalBeats -= cost;
        equipmentCounts[index] = count + 1;

        if (Math.random() < 0.1) {
            clkCoins++;
        }

        renderClickerUI();
        saveClickerCloudData();
    } else {
        console.warn(`Nicht genug Beats! Benötigt: ${cost}, Vorhanden:${Math.floor(totalBeats)}`);
    }
}

function autoClickerTick() {
    let totalCPS = 0;
    equipmentCounts.forEach((count, i) => {
        if (CLICKER_UPGRADES[i]) {
            totalCPS += (count || 0) * CLICKER_UPGRADES[i].cps;
        }
    });

    if (activeBuffs.overdrive) {
        totalCPS *= 5;
    }

    if (totalCPS > 0) {
        totalBeats += totalCPS;
        renderClickerUI();
        saveClickerCloudData();
    }
}

function triggerBuffEngine(type) {
    let cost = 0;
    let duration = 0;

    if (type === "double") {
        cost = 5;
        duration = 30000;
    } else if (type === "overdrive") {
        cost = 10;
        duration = 20000;
    } else if (type === "fever") {
        cost = 15;
        duration = 15000;
    } else {
        return;
    }

    if (clkCoins < cost) {
        alert("❌ Nicht genug Amnesia-Coins für diesen Darknet-Buff!");
        return;
    }

    if (activeBuffs[type]) return;

    clkCoins -= cost;
    activeBuffs[type] = true;
    renderClickerUI();
    saveClickerCloudData();

    const card = document.getElementById(`buff-card-${type}`);
    const btn = document.getElementById(`btn-buff-${type}`);
    const progressBar = document.getElementById(`progress-${type}`);
    const fillBar = document.getElementById(`fill-${type}`);

    if (card) card.classList.add("active-buff");
    if (btn) btn.disabled = true;
    if (progressBar) progressBar.style.display = "block";

    let startTime = Date.now();
    let timerInterval = setInterval(() => {
        let elapsed = Date.now() - startTime;
        let timeLeft = duration - elapsed;
        let percent = (elapsed / duration) * 100;

        if (fillBar) fillBar.style.width = `${Math.min(percent, 100)}%`;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            activeBuffs[type] = false;

            if (card) card.classList.remove("active-buff");
            if (btn) btn.disabled = false;
            if (progressBar) progressBar.style.display = "none";
            if (fillBar) fillBar.style.width = "0%";
        }
    }, 100);
}

function loadLeaderboardData() {
    const leaderboardContainer = document.getElementById("leaderboard-list");
    if (!leaderboardContainer) return;

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
        supabaseClient
            .from("clicker_saves")
            .select("username, total_beats, coins")
            .order("total_beats", { ascending: false })
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

                    const profileUrl = `profile.html?user=${encodeURIComponent(entry.username)}`;

                    row.innerHTML = `
                        <div>
                            <span style="color: ${rankColor}; font-weight: bold; margin-right: 10px;">#${index + 1}</span>
                            <a href="${profileUrl}" style="color: #00f0ff; text-decoration: none;">${typeof escapeHTML === "function" ? escapeHTML(entry.username) : entry.username}</a>
                        </div>
                        <div style="text-align: right;">
                            <span style="color: #00ff66; font-weight: bold;">${Math.floor(entry.total_beats || 0).toLocaleString()} Beats</span>
                        </div>
                    `;
                    leaderboardContainer.appendChild(row);
                });
            });
    } else {
        leaderboardContainer.innerHTML = `<div style="color: #888; text-align: center;">Offline Modus.</div>`;
    }
}

function renderClickerUI() {
    const beatsDisplay = document.getElementById("stat-total-beats") || document.getElementById("total-beats-display");
    const coinsDisplay = document.getElementById("wallet-amnesia-coins") || document.getElementById("clk-coins-display");
    const bpkDisplay = document.getElementById("stat-bpk");
    const bpsDisplay = document.getElementById("stat-bps");

    if (beatsDisplay) beatsDisplay.innerText = Math.floor(totalBeats).toLocaleString();
    if (coinsDisplay) coinsDisplay.innerText = clkCoins;
    if (bpkDisplay) bpkDisplay.innerText = activeBuffs.double ? clickPower * 2 : clickPower;

    let totalCPS = 0;
    equipmentCounts.forEach((count, i) => {
        if (CLICKER_UPGRADES[i]) totalCPS += (count || 0) * CLICKER_UPGRADES[i].cps;
    });

    if (activeBuffs.overdrive) {
        totalCPS *= 5;
    }

    if (bpsDisplay) bpsDisplay.innerText = totalCPS.toFixed(1);

    renderClickerShop();
}

function renderClickerShop() {
    let shopContainer = document.getElementById("upgrades-matrix-target") || document.getElementById("clicker-shop-container");
    if (!shopContainer) return;

    shopContainer.innerHTML = "";

    CLICKER_UPGRADES.forEach((upgrade, index) => {
        let count = parseInt(equipmentCounts[index]) || 0;
        let cost = Math.floor(upgrade.baseCost * Math.pow(1.15, count));
        let canBuy = Math.floor(totalBeats) >= cost;

        let row = document.createElement("div");
        row.className = "upgrade-row";

        row.innerHTML = `
            <div style="font-size: 20px; color: #00f0ff; width: 35px; text-align: center;">
                <i class="fas ${upgrade.icon}"></i>
            </div>
            <div class="up-meta-block">
                <div class="up-title-line">
                    <span>${typeof escapeHTML === "function" ? escapeHTML(upgrade.name) : upgrade.name}</span>
                    <span class="up-count-badge">${count}</span>
                </div>
                <div class="up-description-line">
                    CPS: +${upgrade.cps} | <strong>Kosten:${cost.toLocaleString()} Beats</strong>
                </div>
            </div>
            <button onclick="buyClickerUpgrade(${index})" class="btn-upgrade-action" ${!canBuy ? 'disabled' : ''}>
                Kaufen
            </button>
        `;
        shopContainer.appendChild(row);
    });
}

function createClickParticle(e) {
    const target = document.getElementById("studio-mic-trigger");
    if (!target) return;

    const particle = document.createElement("div");
    particle.className = "click-floating-text";
    particle.innerText = activeBuffs.double ? `+${clickPower * 2}` : `+${clickPower}`;
    particle.style.color = activeBuffs.double ? "#ffd700" : "#ff007f";

    const rect = target.getBoundingClientRect();
    particle.style.left = `${e.clientX - rect.left}px`;
    particle.style.top = `${e.clientY - rect.top}px`;

    target.appendChild(particle);
    setTimeout(() => particle.remove(), 750);
}
