// =========================================================================
// 437 STUDIO | CENTRAL SERVERLESS API ENGINE (SECURITY REVISION - TEIL 1A)
// =========================================================================
const DEFAULT_USERS = [
    { username: "Nalix437", password: "nali437", avatar: "https://dicebear.com", banned: false },
    { username: "Amnesia437", password: "leon437", avatar: "https://dicebear.com", banned: false }
];

const DEFAULT_POSTS = [
    { 
        id: "post_1", 
        title: "Willkommen im 437 Studio Forum!", 
        content: "Hier entstehen die nächsten Meilensteine von Nalix437 und Amnesia437.", 
        username: "Nalix437", 
        avatar: "https://dicebear.com",
        date: "12.10.2026", 
        comments: []
    }
];

const DEFAULT_LEADERBOARD = [
    { username: "Nalix437", game: "harvest", score: 500, date: "13.10.2026" },
    { username: "Amnesia437", game: "clicker", score: 1500, date: "13.10.2026" }
];

let localUsersMemory = [...DEFAULT_USERS];
let localPostsMemory = [...DEFAULT_POSTS];
let localLeaderboardMemory = [...DEFAULT_LEADERBOARD];
let localMaintenanceMemory = { active: false };

// Hilfsfunktion zur Verifizierung von Administrator-Rechten im Backend
function verifyAdminAuthority(headers) {
    const adminUser = headers["x-437-admin-user"];
    const adminAuth = headers["x-437-admin-auth"];
    if (!adminUser || !adminAuth) return false;
    const adminIndex = DEFAULT_USERS.findIndex(
        u => u.username.toLowerCase() === adminUser.toLowerCase() && u.password === adminAuth
    );
    return adminIndex !== -1;
}

exports.handler = async (event, context) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-437-Admin-User, X-437-Admin-Auth",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

    const { action } = event.queryStringParameters || {};
    const method = event.httpMethod;
    const isLive = process.env.NETLIFY === "true" || process.env.SITE_ID;
    let usersBlob, postsBlob, configBlob, leaderboardBlob;

    if (isLive) {
        try {
            const { getStore } = require("@netlify/blobs");
            usersBlob = getStore("437_users_v2");
            postsBlob = getStore("437_posts_v2");
            configBlob = getStore("437_config_v2");
            leaderboardBlob = getStore("437_leaderboard_v2");
        } catch (e) { console.error("Netlify Blobs Fehler:", e); }
    }

    try {
        // --- ROUTE 1: BENUTZER (Bann-geschützt) ---
        if (action === "getUsers" && method === "GET") {
            if (isLive && usersBlob) {
                const cloudData = await usersBlob.get("database", { type: "json" });
                if (cloudData && Array.isArray(cloudData)) localUsersMemory = cloudData;
            }
            return { statusCode: 200, headers, body: JSON.stringify(localUsersMemory) };
        }

        if (action === "saveUsers" && method === "POST") {
            if (!verifyAdminAuthority(event.headers)) return { statusCode: 403, headers, body: JSON.stringify({ error: "🔒 ROOT-Rechte erforderlich!" }) };
            const bodyData = JSON.parse(event.body);
            if (Array.isArray(bodyData)) {
                localUsersMemory = bodyData;
                if (isLive && usersBlob) await usersBlob.set("database", JSON.stringify(localUsersMemory));
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: localUsersMemory.length }) };
            }
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Ungültiges Format." }) };
        }

        // --- ROUTE 1B: ACCOUNT TERMINIERUNG (BAN SYSTEM) ---
        if (action === "banUser" && method === "POST") {
            if (!verifyAdminAuthority(event.headers)) return { statusCode: 403, headers, body: JSON.stringify({ error: "🔒 BAN_ENGINE_DENIED: ROOT-Rechte erforderlich!" }) };
            const { targetUser, banState } = JSON.parse(event.body);
            if (isLive && usersBlob) {
                const cloudData = await usersBlob.get("database", { type: "json" });
                if (cloudData && Array.isArray(cloudData)) localUsersMemory = cloudData;
            }
            const uIdx = localUsersMemory.findIndex(u => u.username.toLowerCase() === targetUser.toLowerCase());
            if (uIdx !== -1) {
                if (["nalix437", "amnesia437"].includes(targetUser.toLowerCase())) return { statusCode: 400, headers, body: JSON.stringify({ error: "Die Gründer-Identitäten sind immun!" }) };
                localUsersMemory[uIdx].banned = banState || false;
                if (isLive && usersBlob) await usersBlob.set("database", JSON.stringify(localUsersMemory));
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: targetUser, banned: banState }) };
            }
            return { statusCode: 404, headers, body: JSON.stringify({ error: "User nicht gefunden." }) };
        }

        // --- ROUTE 1C: CENTRAL BANK MATRIX (WÄHRUNGS-INJEKTION) ---
        if (action === "modifyCurrency" && method === "POST") {
            if (!verifyAdminAuthority(event.headers)) return { statusCode: 403, headers, body: JSON.stringify({ error: "🔒 COIN_INJECTION_DENIED: Unbefugter Zugriff!" }) };
            const { targetUser, currencyType, amount } = JSON.parse(event.body);
            if (isLive && usersBlob) {
                const cloudData = await usersBlob.get("database", { type: "json" });
                if (cloudData && Array.isArray(cloudData)) localUsersMemory = cloudData;
            }
            const uIdx = localUsersMemory.findIndex(u => u.username.toLowerCase() === targetUser.toLowerCase());
            if (uIdx !== -1) {
                localUsersMemory[uIdx][currencyType] = (localUsersMemory[uIdx][currencyType] || 0) + amount;
                if (isLive && usersBlob) await usersBlob.set("database", JSON.stringify(localUsersMemory));
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: targetUser, balance: localUsersMemory[uIdx][currencyType] }) };
            }
            return { statusCode: 404, headers, body: JSON.stringify({ error: "User nicht gefunden." }) };
        }
        // --- ROUTE 2: FORENBEITRÄGE ---
        if (action === "getPosts" && method === "GET") {
            if (isLive && postsBlob) {
                const cloudData = await postsBlob.get("database", { type: "json" });
                if (cloudData && Array.isArray(cloudData)) localPostsMemory = cloudData;
            }
            return { statusCode: 200, headers, body: JSON.stringify(localPostsMemory) };
        }

        if (action === "savePosts" && method === "POST") {
            const bodyData = JSON.parse(event.body);
            if (bodyData.length < localPostsMemory.length && !verifyAdminAuthority(event.headers)) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: "🔒 ROOT-Rechte erforderlich!" }) };
            }
            if (Array.isArray(bodyData)) {
                localPostsMemory = bodyData;
                if (isLive && postsBlob) await postsBlob.set("database", JSON.stringify(localPostsMemory));
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Ungültiges Format." }) };
        }

        // --- ROUTE 3: CLOUD LEADERBOARD ---
        if (action === "getLeaderboard" && method === "GET") {
            if (isLive && leaderboardBlob) {
                const cloudData = await leaderboardBlob.get("database", { type: "json" });
                if (cloudData && Array.isArray(cloudData)) localLeaderboardMemory = cloudData;
            }
            return { statusCode: 200, headers, body: JSON.stringify(localLeaderboardMemory) };
        }

        // --- ROUTE 3B: LEADERBOARD CHEATER PURGE ---
        if (action === "purgeLeaderboard" && method === "POST") {
            if (!verifyAdminAuthority(event.headers)) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: "🔒 PURGE_DENIED: ROOT-Rechte erforderlich!" }) };
            }
            const { cheaterName, gameType } = JSON.parse(event.body);
            if (isLive && leaderboardBlob) {
                const cloudData = await leaderboardBlob.get("database", { type: "json" });
                if (cloudData && Array.isArray(cloudData)) localLeaderboardMemory = cloudData;
            }
            localLeaderboardMemory = localLeaderboardMemory.filter(entry => !(entry.username.toLowerCase() === cheaterName.toLowerCase() && entry.game === gameType));
            if (isLive && leaderboardBlob) await leaderboardBlob.set("database", JSON.stringify(localLeaderboardMemory));
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        // --- NEUE INTERVENTIONS-ROUTE: GLOBALER LEADERBOARD RESET ---
        if (action === "clearAllLeaderboards" && method === "POST") {
            if (!verifyAdminAuthority(event.headers)) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: "🔒 PURGE_DENIED: ROOT-Rechte erforderlich!" }) };
            }
            
            // Setzt den lokalen RAM-Speicher zurück auf die leere Default-Struktur
            localLeaderboardMemory = [
                { username: "Nalix437", game: "harvest", score: 0, date: new Date().toLocaleDateString("de-DE") },
                { username: "Amnesia437", game: "clicker", score: 0, date: new Date().toLocaleDateString("de-DE") }
            ];

            if (isLive && leaderboardBlob) {
                try {
                    // Überschreibt die Cloud-Blob-Datenbank permanent mit dem leeren Array
                    await leaderboardBlob.set("database", JSON.stringify(localLeaderboardMemory));
                } catch (e) {
                    return { statusCode: 500, headers, body: JSON.stringify({ error: "Cloud-Schreibfehler beim Reset-Vorgang." }) };
                }
            }
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: "Matrix-Leaderboard erfolgreich gewiped." }) };
        }

        if (action === "saveScore" && method === "POST") {
            const newEntry = JSON.parse(event.body);
            if (isLive && usersBlob) {
                const cloudData = await usersBlob.get("database", { type: "json" });
                if (cloudData && Array.isArray(cloudData)) localUsersMemory = cloudData;
            }
            const userCheck = localUsersMemory.find(u => u.username.toLowerCase() === newEntry.username.toLowerCase());
            if (userCheck && userCheck.banned) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: "Gesperrt: Senden blockiert." }) };
            }

            if (newEntry && newEntry.username && newEntry.game && typeof newEntry.score === "number") {
                if (isLive && leaderboardBlob) {
                    const cloudData = await leaderboardBlob.get("database", { type: "json" });
                    if (cloudData && Array.isArray(cloudData)) localLeaderboardMemory = cloudData;
                }
                const idx = localLeaderboardMemory.findIndex(e => e.username.toLowerCase() === newEntry.username.toLowerCase() && e.game === newEntry.game);
                if (idx !== -1) {
                    if (newEntry.score > localLeaderboardMemory[idx].score) {
                        localLeaderboardMemory[idx].score = newEntry.score;
                        localLeaderboardMemory[idx].date = new Date().toLocaleDateString("de-DE");
                    }
                } else {
                    localLeaderboardMemory.push({ username: newEntry.username, game: newEntry.game, score: newEntry.score, date: new Date().toLocaleDateString("de-DE") });
                }
                if (isLive && leaderboardBlob) await leaderboardBlob.set("database", JSON.stringify(localLeaderboardMemory));
                return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
            }
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Ungültiges Format." }) };
        }

         // --- ROUTE 4: WARTUNGSMODUS ---
        if (action === "getMaintenance" && method === "GET") {
            if (isLive && configBlob) {
                try {
                    const cloudData = await configBlob.get("maintenance", { type: "json" });
                    if (cloudData && typeof cloudData === "object") localMaintenanceMemory = cloudData;
                } catch (e) {}
            }
            return { statusCode: 200, headers, body: JSON.stringify(localMaintenanceMemory) };
        }

        if (action === "saveMaintenance" && method === "POST") {
            if (!verifyAdminAuthority(event.headers)) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: "🚨 ZUGRIFF VERWEIGERT: Hebel erfordert ROOT-Passwort!" }) };
            }

            const bodyData = JSON.parse(event.body);
            if (bodyData && typeof bodyData === "object") {
                localMaintenanceMemory = bodyData;
                if (isLive && configBlob) {
                    try { await configBlob.set("maintenance", JSON.stringify(localMaintenanceMemory)); } catch(e){}
                }
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, active: localMaintenanceMemory.active }) };
            }
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Ungültiges Format." }) };
        }

        // --- 🎉 NEUE ROUTE 5: ANKÜNDIGUNGS-TICKER (WEBSITE-BEARBEITUNG) ---
        if (action === "getTicker" && method === "GET") {
            let tickerData = { text: "" };
            if (isLive && configBlob) {
                try {
                    const cloudData = await configBlob.get("global_ticker", { type: "json" });
                    if (cloudData && typeof cloudData === "object") tickerData = cloudData;
                } catch (e) {}
            } else {
                tickerData = JSON.parse(localStorage.getItem("437_ticker_fallback")) || { text: "" };
            }
            return { statusCode: 200, headers, body: JSON.stringify(tickerData) };
        }

        if (action === "saveTicker" && method === "POST") {
            if (!verifyAdminAuthority(event.headers)) {
                return { statusCode: 403, headers, body: JSON.stringify({ error: "🔒 ZUGRIFF VERWEIGERT: Ticker-Einspeisung erfordert ROOT-Rechte!" }) };
            }

            const bodyData = JSON.parse(event.body);
            if (bodyData && typeof bodyData === "object" && typeof bodyData.text === "string") {
                if (isLive && configBlob) {
                    try { await configBlob.set("global_ticker", JSON.stringify({ text: bodyData.text })); } catch(e){}
                }
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, text: bodyData.text }) };
            }
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Ungültiges Ticker-Format." }) };
        }

        return { statusCode: 404, headers, body: JSON.stringify({ error: "Route nicht gefunden." }) };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Systemfehler.", details: err.message }) };
    }
};
