// =========================================================================
// 437 STUDIO | OPERATIVE CONTROL MATRIX DASHBOARD LOGIC (ULTRA HIGH-PERFORMANCE)
// =========================================================================

"use strict";

let adminSearchTimeout = null;
let adminAttachedImage = null;
let adminAttachedVideo = null;
let adminRecordedAudioBase64 = null;

let adminMediaRecorder = null;
let adminAudioChunks = [];
let adminRecordingTimer = null;
let adminRecordingSeconds = 0;

document.addEventListener("DOMContentLoaded", () => {
    enforceStrictSecurityGate();
});

function enforceStrictSecurityGate() {
    const session = localStorage.getItem("437_session");
    if (!session) { 
        alert("🔒 ZUGRIFF VERWEIGERT: Du musst eingeloggt sein!"); 
        window.location.href = "index.html"; 
        return; 
    }

    const userData = JSON.parse(session);
    const hasRootAccess = typeof isAdmin === "function" ? isAdmin(userData) : (userData.username && ["nalix437", "amnesia437"].includes(userData.username.toLowerCase()));

    if (!hasRootAccess) {
        alert("🚨 SICHERHEITSALARM: Dein Account besitzt keine ROOT-Rechte!");
        window.location.href = "index.html";
        return;
    }
    
    loadDashboardAnalyticsMatrix();
}

// --- TURBO PARALLELES LADEN DER ANALYTICS MATRIX ---
async function loadDashboardAnalyticsMatrix() {
    let users = [];
    let posts = [];
    
    try {
        if (typeof supabaseClient !== "undefined" && supabaseClient) {
            const [uRes, pRes] = await Promise.all([
                supabaseClient.from("users").select("*"),
                supabaseClient.from("forum_threads").select("*")
            ]);
            
            if (uRes.data) users = uRes.data;
            if (pRes.data) posts = pRes.data;
        }
    } catch(e) {
        console.warn("Cloud-Abfrage fehlgeschlagen:", e);
    }

    if (document.getElementById("stat-users")) document.getElementById("stat-users").innerText = users.length;
    if (document.getElementById("stat-posts")) document.getElementById("stat-posts").innerText = posts.length;
    
    renderAdvancedUsersTable(users);
    renderAdvancedPostsTable(posts);
    loadAdminChannelsList();
    injectLeaderboardPurgePanel();
    loadMaintenanceStateEngine();
}

async function loadMaintenanceStateEngine() {
    let state = false;
    try {
        if (typeof supabaseClient !== "undefined" && supabaseClient) {
            const { data } = await supabaseClient.from("maintenance").select("active").eq("id", 1).maybeSingle();
            if (data) state = data.active;
        }
    } catch (e) { 
        state = false; 
    }
    updateMaintenanceControlUI(state);
}

function updateMaintenanceControlUI(active) {
    const label = document.getElementById("maintenance-status-label");
    const btn = document.getElementById("maintenance-toggle-btn");
    if (!label || !btn) return;

    if (active) {
        label.innerHTML = `<span style="color: #ff0055; font-weight: bold;">⚠️ Wartungsmodus AKTIV</span>`;
        btn.innerHTML = '<i class="fas fa-power-off"></i> Deaktivieren'; 
        btn.style.borderColor = "#00ff66";
        btn.style.color = "#00ff66";
    } else {
        label.innerHTML = `<span style="color: #00ff66; font-weight: bold;">🟢 System normal online</span>`;
        btn.innerHTML = '<i class="fas fa-power-off"></i> Aktivieren'; 
        btn.style.borderColor = "#ff0055";
        btn.style.color = "#ff0055";
    }
}

async function toggleGlobalMaintenance() {
    if (!supabaseClient) return;
    try {
        const { data } = await supabaseClient.from("maintenance").select("active").eq("id", 1).maybeSingle();
        const newState = data ? !data.active : true;

        await supabaseClient.from("maintenance").update({ active: newState }).eq("id", 1);
        alert(`Wartungsmodus wurde ${newState ? 'aktiviert' : 'deaktiviert'}.`);
        loadMaintenanceStateEngine();
    } catch (err) {
        alert("Fehler: " + err.message);
    }
}

// --- GEBÜNDELTE CHANNEL-VERWALTUNG IM ADMIN-PANEL ---

async function loadAdminChannelsList() {
    const container = document.getElementById("admin-channels-list");
    if (!container || typeof supabaseClient === "undefined" || !supabaseClient) return;

    try {
        const [channelsRes, membersRes] = await Promise.all([
            supabaseClient.from("group_channels").select("*").order("id", { ascending: true }),
            supabaseClient.from("channel_members").select("channel_name, username, is_creator")
        ]);

        const channels = channelsRes.data;
        const allMembers = membersRes.data || [];

        if (channelsRes.error || !channels || channels.length === 0) {
            container.innerHTML = `<span style="color: #666;">Keine aktiven Channels gefunden.</span>`;
            return;
        }

        const memberCountMap = {};
        allMembers.forEach(m => {
            memberCountMap[m.channel_name] = (memberCountMap[m.channel_name] || 0) + 1;
        });

        let html = `<div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">`;

        for (const c of channels) {
            const memberCount = memberCountMap[c.name] || 0;
            const isEcoParadise = c.name === "gruenes-paradies";

            html += `
                <div style="background: #080812; border: 1px solid #1a1a3a; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 5px;">
                        <span style="color: ${isEcoParadise ? '#00ff66' : '#00f0ff'}; font-weight: bold; font-size: 13px;">
                            <i class="fas ${isEcoParadise ? 'fa-leaf' : 'fa-hashtag'}"></i> ${escapeHTML(c.name)}
                        </span>
                        <span style="color: #888; font-size: 11px;">Mitglieder: ${memberCount} // Ersteller: ${escapeHTML(c.created_by || 'System')}</span>
                    </div>
                    <div style="color: #aaa; font-size: 11px;">
                        Thema: ${escapeHTML(c.topic || 'Kein Thema angegeben')}
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 4px;">
                        <button onclick="adminDeleteChannelGlobal('${escapeHTML(c.name)}')" style="background: transparent; border: 1px solid #ff0055; color: #ff0055; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">
                            <i class="fas fa-trash"></i> Channel auflösen
                        </button>
                    </div>
                </div>
            `;
        }

        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error("Fehler beim Laden der Admin-Channels:", err);
        container.innerHTML = `<span style="color: #ff0055;">Fehler beim Laden der Channel-Daten.</span>`;
    }
}

async function adminDeleteChannelGlobal(channelName) {
    if (!confirm(`⚠️ Admin-Sicherheitsabfrage: Möchtest du den Channel "#${channelName}" samt aller Nachrichten und Mitgliedschaften global löschen?`)) {
        return;
    }

    try {
        await Promise.all([
            supabaseClient.from("channel_members").delete().eq("channel_name", channelName),
            supabaseClient.from("group_messages").delete().eq("channel_name", channelName)
        ]);

        const { error } = await supabaseClient.from("group_channels").delete().eq("name", channelName);
        if (error) throw error;

        alert(`✅ Channel "#${channelName}" wurde erfolgreich aus der Cloud entfernt.`);
        loadDashboardAnalyticsMatrix();
    } catch (err) {
        alert("❌ Fehler beim Löschen: " + err.message);
    }
}

// --- BENUTZER-TABELLE & MODERATION (PERFORMANCE OPTIMIERT) ---

function renderAdvancedUsersTable(usersList) {
    const tbody = document.getElementById("admin-users-table");
    if (!tbody) return;
    
    const fragment = document.createDocumentFragment();

    usersList.forEach(user => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #1a1a3a";
        
        const isSelf = ["nalix437", "amnesia437"].includes((user.username || "").toLowerCase());
        const isBanned = user.banned === true;
        const isAdminUser = user.is_admin === true;
        
        const now = new Date();
        const hasActiveTimeout = user.timeout_until && new Date(user.timeout_until) > now;
        const strikesCount = (user.strikes && Array.isArray(user.strikes)) ? user.strikes.length : 0;
        
        let actionHTML = "";
        if (isSelf) {
            actionHTML = `<span style="color: #ffd700; font-size: 11px; font-style: italic;">👑 Gründer (Immun)</span>`;
        } else {
            actionHTML = `
                <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
                    <button onclick="adminToggleBanUser('${escapeHTML(user.username)}', ${!isBanned})" class="admin-action-btn" style="border: 1px solid ${isBanned ? '#00ff66' : '#ff0055'}; color: ${isBanned ? '#00ff66' : '#ff0055'};" title="Permaban umschalten">
                        <i class="fas fa-ban"></i> ${isBanned ? 'Entbannen' : 'Bannen'}
                    </button>
                    ${hasActiveTimeout ? `
                        <button onclick="adminClearTimeout('${escapeHTML(user.username)}')" class="admin-action-btn" style="border: 1px solid #00ff66; color: #00ff66;" title="Aktiven Timeout aufheben">
                            <i class="fas fa-clock"></i> Timeout aufheben
                        </button>
                    ` : `
                        <button onclick="adminTimeoutUser('${escapeHTML(user.username)}')" class="admin-action-btn" style="border: 1px solid #ffa500; color: #ffa500;" title="Temporärer Timeout">
                            <i class="fas fa-clock"></i> Timeout
                        </button>
                    `}
                    <button onclick="adminToggleRole('${escapeHTML(user.username)}', ${isAdminUser})" class="admin-action-btn" style="border: 1px solid #00f0ff; color: #00f0ff;" title="Admin-Rolle umschalten">
                        <i class="fas fa-shield-alt"></i> ${isAdminUser ? 'Admin entziehen' : 'Admin'}
                    </button>
                    <button onclick="adminIssueStrike('${escapeHTML(user.username)}')" class="admin-action-btn" style="border: 1px solid #ff007f; color: #ff007f;" title="Verwarnung ausstellen">
                        <i class="fas fa-exclamation-triangle"></i> Strike (${strikesCount})
                    </button>
                    ${strikesCount > 0 ? `
                        <button onclick="adminClearStrikes('${escapeHTML(user.username)}')" class="admin-action-btn" style="border: 1px solid #00ff66; color: #00ff66;" title="Alle Strikes löschen">
                            <i class="fas fa-check-circle"></i> Strikes löschen
                        </button>
                    ` : ''}
                    <button onclick="adminResetUserPerks('${escapeHTML(user.username)}')" class="admin-action-btn" style="border: 1px solid #a855f7; color: #a855f7;" title="Cyber-Perks zurücksetzen">
                        <i class="fas fa-undo"></i> Perks
                    </button>
                    <button onclick="adminInjectCurrency('${escapeHTML(user.username)}', 'clk_coins')" class="admin-action-btn" style="border: 1px solid #00f0ff; color: #00f0ff;" title="Clicker Coins hinzufügen">
                        +🪙 Clicker
                    </button>
                    <button onclick="adminInjectCurrency('${escapeHTML(user.username)}', 'harvest_coins')" class="admin-action-btn" style="border: 1px solid #00ff66; color: #00ff66;" title="Harvest Coins hinzufügen">
                        +🪙 Harvest
                    </button>
                </div>
            `;
        }

        tr.innerHTML = `
            <td style="padding: 12px;"><img src="${escapeHTML(user.avatar || 'https://dicebear.com')}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;"></td>
            <td style="padding: 12px;">
                <div style="color: ${isBanned ? '#ff0055' : '#fff'}; font-weight: bold;">${escapeHTML(user.username)} ${isBanned ? '[GESPERRT]' : ''}</div>
                <div style="color: #888; font-size: 10px; margin-top: 2px;">
                    Rolle: ${isAdminUser ? '<span style="color:#ff007f">ADMIN</span>' : 'User'} 
                    // Strikes: <span style="color:${strikesCount > 0 ? '#ff0055' : '#00ff66'}">${strikesCount}</span>
                    ${hasActiveTimeout ? ' // <span style="color:#ffa500">TIMED OUT</span>' : ''}
                </div>
            </td>
            <td style="padding: 12px; color: #00f0ff; font-family: monospace; font-size: 11px;">🪙 Harvest: ${user.harvest_coins || 0}<br>🪙 Clicker: ${user.clk_coins || 0}</td>
            <td style="padding: 12px; text-align: right;">${actionHTML}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.replaceChildren(fragment);
}

async function adminToggleBanUser(username, banState) {
    if (!confirm(`Möchtest du den Bann-Status für "${username}" wirklich auf [${banState ? 'Gesperrt' : 'Entsperrt'}] ändern?`)) return;
    
    const { error } = await supabaseClient.from("users").update({ banned: banState }).eq("username", username);
    if (!error) {
        alert(`🎉 Operator "${username}" wurde erfolgreich ${banState ? 'gesperrt' : 'entbanned'}!`);
        loadDashboardAnalyticsMatrix();
    } else {
        alert("❌ Fehler beim Ändern des Bann-Status: " + error.message);
    }
}

async function adminInjectCurrency(username, currencyType) {
    const amountStr = prompt(`Wie viele Coins in "${currencyType}" für "${username}" injizieren?`);
    const amount = parseInt(amountStr);
    if (isNaN(amount)) return;

    const { data } = await supabaseClient.from("users").select(currencyType).eq("username", username).single();
    if (data) {
        const currentVal = data[currencyType] || 0;
        const newVal = currentVal + amount;
        await supabaseClient.from("users").update({ [currencyType]: newVal }).eq("username", username);
        alert("🎉 Injektion erfolgreich verbucht!");
        loadDashboardAnalyticsMatrix();
    }
}

// --- FOREN-MODERATION ---

function renderAdvancedPostsTable(postsList) {
    const tbody = document.getElementById("admin-posts-table");
    if (!tbody) return;
    
    const fragment = document.createDocumentFragment();

    postsList.forEach(post => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #1a1a3a";
        tr.innerHTML = `
            <td style="padding: 12px; color: #ff007f; font-weight: bold;">${escapeHTML(post.author)}</td>
            <td style="padding: 12px;">
                <div style="color: #fff; font-weight: bold; font-size: 14px;">${escapeHTML(post.title)}</div>
                <div style="color: #aaa; font-size: 12px; margin-top: 4px;">${escapeHTML(post.content)}</div>
            </td>
            <td style="padding: 12px; text-align: right;">
                <button onclick="adminDeletePostStrict(${post.id})" style="background: none; border: 1px solid #ff0033; color: #ff0033; padding: 4px 10px; cursor: pointer; border-radius: 4px; font-size: 12px;"><i class="fas fa-trash-alt"></i> Löschen</button>
            </td>
        `;
        fragment.appendChild(tr);
    });

    tbody.replaceChildren(fragment);
}

async function adminDeletePostStrict(postId) {
    if (!confirm("Forenbeitrag global inklusive aller Antworten entfernen?")) return;
    
    if (!supabaseClient) {
        alert("Supabase nicht verbunden.");
        return;
    }

    try {
        await Promise.all([
            supabaseClient.from("forum_comments").delete().eq("thread_id", postId),
            supabaseClient.from("forum_threads").delete().eq("id", postId)
        ]);

        alert("🎉 Beitrag und zugehörige Antworten unwiderruflich aus der Cloud getilgt!");
        loadDashboardAnalyticsMatrix();
    } catch (err) {
        alert("Fehler beim Löschen: " + err.message);
    }
}

// --- BROADCAST & MEDIEN (BILD, VIDEO, AUDIO) ---

async function handleAdminUserSearch(event) {
    const query = event.target.value.trim();
    const box = document.getElementById("admin-user-suggestions");
    if (!box) return;

    if (adminSearchTimeout) clearTimeout(adminSearchTimeout);

    if (query.length < 1 || query.toUpperCase() === "ALL") {
        box.classList.add("hidden");
        box.innerHTML = "";
        return;
    }

    adminSearchTimeout = setTimeout(async () => {
        if (!supabaseClient) return;

        const { data: users, error } = await supabaseClient
            .from("users")
            .select("username, avatar")
            .ilike("username", `%${query}%`)
            .limit(5);

        if (error || !users || users.length === 0) {
            box.innerHTML = `<div style="padding: 8px; color: #666; font-size: 11px;">Keine Operator gefunden</div>`;
            box.classList.remove("hidden");
            return;
        }

        box.innerHTML = users.map(u => `
            <div class="suggestion-item" onclick="selectAdminUserSuggestion('${escapeHTML(u.username)}')">
                <img src="${escapeHTML(u.avatar || '/img/logo.png')}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid #ff007f;">
                <span style="font-size: 12px;">${escapeHTML(u.username)}</span>
            </div>
        `).join("");

        box.classList.remove("hidden");
    }, 200);
}

function selectAdminUserSuggestion(username) {
    const input = document.getElementById("broadcast-recipient");
    const box = document.getElementById("admin-user-suggestions");
    if (input) input.value = username;
    if (box) box.classList.add("hidden");
}

function previewAdminImage(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Bitte wähle eine gültige Bilddatei aus.");
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert("Das Bild ist zu groß (Maximal 2 MB erlaubt).");
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        adminAttachedImage = e.target.result;
        const previewBox = document.getElementById("admin-img-preview-box");
        const previewImg = document.getElementById("admin-img-preview");

        if (previewBox && previewImg) {
            previewImg.src = adminAttachedImage;
            previewBox.style.display = "flex";
        }
    };
    reader.readAsDataURL(file);
}

function clearAdminAttachedImage() {
    adminAttachedImage = null;
    const input = document.getElementById("admin-image-input");
    const previewBox = document.getElementById("admin-img-preview-box");
    if (input) input.value = "";
    if (previewBox) previewBox.style.display = "none";
}

function previewAdminVideo(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
        alert("Bitte wähle eine gültige Videodatei aus.");
        return;
    }

    if (file.size > 15 * 1024 * 1024) {
        alert("Das Video ist zu groß (Maximal 15 MB erlaubt).");
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        adminAttachedVideo = e.target.result;
        const previewBox = document.getElementById("admin-video-preview-box");
        const previewVideo = document.getElementById("admin-video-preview");

        if (previewBox && previewVideo) {
            previewVideo.src = adminAttachedVideo;
            previewBox.style.display = "flex";
        }
    };
    reader.readAsDataURL(file);
}

function clearAdminAttachedVideo() {
    adminAttachedVideo = null;
    const input = document.getElementById("admin-video-input");
    const previewBox = document.getElementById("admin-video-preview-box");
    if (input) input.value = "";
    if (previewBox) previewBox.style.display = "none";
}

async function toggleAdminVoiceRecording() {
    const recordBtn = document.getElementById("admin-voice-record-btn");
    const statusBar = document.getElementById("admin-voice-status-bar");

    if (!adminMediaRecorder || adminMediaRecorder.state === "inactive") {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            adminMediaRecorder = new MediaRecorder(stream);
            adminAudioChunks = [];

            adminMediaRecorder.ondataavailable = event => {
                adminAudioChunks.push(event.data);
            };

            adminMediaRecorder.onstop = async () => {
                const audioBlob = new Blob(adminAudioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = e => {
                    adminRecordedAudioBase64 = e.target.result;
                    alert("🎙️ Admin Broadcast Audio-Transmission bereit!");
                };
                reader.readAsDataURL(audioBlob);

                stream.getTracks().forEach(track => track.stop());
            };

            adminMediaRecorder.start();
            adminRecordingSeconds = 0;
            if (statusBar) statusBar.style.display = "flex";
            if (recordBtn) recordBtn.style.background = "#ff0055";

            adminRecordingTimer = setInterval(() => {
                adminRecordingSeconds++;
                const timerEl = document.getElementById("admin-voice-timer");
                if (timerEl) timerEl.textContent = `Broadcast Audio-Transmission läuft (${adminRecordingSeconds}s)...`;
            }, 1000);

        } catch (err) {
            alert("Mikrofon-Zugriff verweigert oder nicht verfügbar: " + err.message);
        }
    } else {
        adminMediaRecorder.stop();
        clearInterval(adminRecordingTimer);
        if (statusBar) statusBar.style.display = "none";
        if (recordBtn) recordBtn.style.background = "";
    }
}

function cancelAdminVoiceRecording() {
    if (adminMediaRecorder && adminMediaRecorder.state === "recording") {
        adminMediaRecorder.stop();
    }
    clearInterval(adminRecordingTimer);
    adminRecordedAudioBase64 = null;
    const statusBar = document.getElementById("admin-voice-status-bar");
    const recordBtn = document.getElementById("admin-voice-record-btn");
    if (statusBar) statusBar.style.display = "none";
    if (recordBtn) recordBtn.style.background = "";
}

async function sendSystemBroadcast(event) {
    event.preventDefault();
    if (!supabaseClient) return;

    const recipientInput = document.getElementById("broadcast-recipient");
    const textInput = document.getElementById("broadcast-text");
    if (!recipientInput) return;

    const target = recipientInput.value.trim();
    const text = textInput ? textInput.value.trim() : "";

    if (!text && !adminAttachedImage && !adminAttachedVideo && !adminRecordedAudioBase64) {
        alert("Bitte gib einen Text ein, hänge Medien an oder nimm eine Sprachnachricht auf.");
        return;
    }

    if (target.toUpperCase() === "ALL") {
        const { data: users, error: userError } = await supabaseClient.from("users").select("username");
        if (userError || !users) {
            alert("Fehler beim Abrufen der Operator-Liste: " + (userError?.message || 'Unbekannt'));
            return;
        }

        const batch = users.map(u => ({
            sender: "437 Studio",
            recipient: u.username,
            message: text,
            image: adminAttachedImage || null,
            video: adminAttachedVideo || null,
            voice_note: adminRecordedAudioBase64 || null
        }));

        const { error } = await supabaseClient.from("private_messages").insert(batch);
        if (error) {
            alert("Fehler beim Broadcast: " + error.message);
        } else {
            alert(`✅ System-Broadcast (mit Medien/Video) erfolgreich an ${users.length} Operator gesendet!`);
            if (textInput) textInput.value = "";
            recipientInput.value = "";
            clearAdminAttachedImage();
            clearAdminAttachedVideo();
            adminRecordedAudioBase64 = null;
        }
    } else {
        const newMessage = {
            sender: "437 Studio",
            recipient: target,
            message: text,
            image: adminAttachedImage || null,
            video: adminAttachedVideo || null,
            voice_note: adminRecordedAudioBase64 || null
        };

        const { error } = await supabaseClient.from("private_messages").insert([newMessage]);
        if (error) {
            alert("Fehler beim Senden: " + error.message);
        } else {
            alert(`✅ Systemnachricht mit Video an ${target} übermittelt.`);
            recipientInput.value = "";
            if (textInput) textInput.value = "";
            clearAdminAttachedImage();
            clearAdminAttachedVideo();
            adminRecordedAudioBase64 = null;
        }
    }
}

// --- LEADERBOARD PURGE PANEL ---

function injectLeaderboardPurgePanel() {
    const target = document.getElementById("admin-leaderboard-purge-zone");
    if (!target) return;
    target.innerHTML = `
        <div style="background: #0e0e1a; border: 1px solid #ff0055; padding: 15px; border-radius: 6px; margin-top: 20px;">
            <h3 style="color: #ff0055; margin-top: 0;"><i class="fas fa-skull-crossbones"></i> Cloud-Leaderboard Cheater Purge</h3>
            <div style="display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap;">
                <input type="text" id="purge-cheater-name" placeholder="Hacker-Name..." style="flex:1; background:#141428; border:1px solid #333; color:#fff; padding:8px; border-radius:4px; font-size: 12px; min-width: 150px;">
                <select id="purge-game-type" style="background:#141428; border:1px solid #333; color:#fff; padding:8px; border-radius:4px; font-size: 12px;">
                    <option value="harvest">Green Harvest</option>
                    <option value="clicker">Amnesia Clicker</option>
                </select>
                <button onclick="adminPurgeCheaterScore()" style="background:#ff0055; color:#fff; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold; font-size: 11px;">Säubern</button>
            </div>
            <hr style="border-color: #222; margin: 15px 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <span style="color: #888; font-size: 13px;">Setzt alle Highscores in der Cloud-Datenbank zurück.</span>
                <button onclick="adminResetFullLeaderboard()" style="background: transparent; border: 1px solid #ff0033; color: #ff0033; padding: 8px 15px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px;"><i class="fas fa-trash-alt"></i> Komplette Bestenliste löschen</button>
            </div>
        </div>
    `;
}

async function adminPurgeCheaterScore() {
    const cheaterName = document.getElementById("purge-cheater-name").value.trim();
    const gameType = document.getElementById("purge-game-type").value;
    if (!cheaterName) return;

    if (!confirm(`Highscores von "${cheaterName}" löschen?`)) return;

    const { error } = await supabaseClient.from("leaderboard").delete().eq("username", cheaterName).eq("game", gameType);
    if (!error) {
        alert("🎉 Highscores eliminiert!");
        loadDashboardAnalyticsMatrix();
    }
}

async function adminResetFullLeaderboard() {
    if (prompt("Tippe 'RESET_MATRIX' zum Bestätigen:") !== "RESET_MATRIX") return;

    const { error } = await supabaseClient.from("leaderboard").delete().neq("id", 0);
    if (!error) {
        alert("💥 Leaderboard komplett zurückgesetzt!");
        loadDashboardAnalyticsMatrix();
    }
}

// --- TIMEOUT & STRIKE FUNKTIONEN ---

async function adminTimeoutUser(username) {
    const minutesStr = prompt(`Gib die Timeout-Dauer in Minuten für Operator "${username}" ein:`, "30");
    if (!minutesStr) return;
    const minutes = parseInt(minutesStr);
    if (isNaN(minutes) || minutes <= 0) {
        alert("❌ Bitte gib eine gültige Minutenzahl ein.");
        return;
    }

    const timeoutUntil = new Date(Date.now() + minutes * 60000).toISOString();
    
    try {
        const { error } = await supabaseClient
            .from("users")
            .update({ timeout_until: timeoutUntil })
            .eq("username", username);
        
        if (error) throw error;

        alert(`⏱️ Operator "${username}" wurde erfolgreich für ${minutes} Minuten stummgeschaltet.`);
        loadDashboardAnalyticsMatrix();
    } catch (err) {
        alert("❌ Fehler beim Timeout: " + err.message);
    }
}

async function adminClearTimeout(username) {
    if (!confirm(`Möchtest du den aktiven Timeout für "${username}" vorzeitig aufheben?`)) return;

    try {
        const { error } = await supabaseClient
            .from("users")
            .update({ timeout_until: null })
            .eq("username", username);
            
        if (error) throw error;

        alert(`🟢 Timeout für "${username}" wurde erfolgreich aufgehoben.`);
        loadDashboardAnalyticsMatrix();
    } catch (err) {
        alert("❌ Fehler beim Aufheben des Timeouts: " + err.message);
    }
}

async function adminIssueStrike(username) {
    const reason = prompt(`Grund für den Strike gegen "${username}" eingeben:`, "Verstoß gegen die Server-Richtlinien");
    if (!reason) return;

    try {
        const { data, error: fetchErr } = await supabaseClient
            .from("users")
            .select("strikes")
            .eq("username", username)
            .single();
            
        if (fetchErr) throw fetchErr;

        let strikes = (data && Array.isArray(data.strikes)) ? data.strikes : [];
        strikes.push({ reason: reason, date: new Date().toISOString() });

        const { error: updateErr } = await supabaseClient
            .from("users")
            .update({ strikes: strikes })
            .eq("username", username);
            
        if (updateErr) throw updateErr;

        alert(`⚠️ Strike gegen "${username}" ausgestellt (Gesamt: ${strikes.length}).`);
        loadDashboardAnalyticsMatrix();
    } catch (err) {
        alert("❌ Fehler beim Ausstellen des Strikes: " + err.message);
    }
}

async function adminClearStrikes(username) {
    if (!confirm(`Möchtest du alle Strikes für "${username}" vollständig löschen?`)) return;

    try {
        const { error } = await supabaseClient
            .from("users")
            .update({ strikes: [] })
            .eq("username", username);
            
        if (error) throw error;

        alert(`✅ Alle Strikes für "${username}" wurden gelöscht.`);
        loadDashboardAnalyticsMatrix();
    } catch (err) {
        alert("❌ Fehler beim Löschen der Strikes: " + err.message);
    }
}

async function adminToggleRole(username, currentAdminState) {
    const newState = !currentAdminState;
    if (!confirm(`Möchtest du die Admin-Rolle für "${username}" ${newState ? 'aktivieren' : 'entziehen'}?`)) return;

    const { error } = await supabaseClient.from("users").update({ is_admin: newState }).eq("username", username);
    if (!error) {
        alert(`🛡️ Admin-Rolle für "${username}" erfolgreich ${newState ? 'vergeben' : 'entzogen'}.`);
        loadDashboardAnalyticsMatrix();
    } else {
        alert("❌ Fehler beim Ändern der Rolle: " + error.message);
    }
}

async function adminResetUserPerks(username) {
    if (!confirm(`⚠️ Möchtest du die Währungen von "${username}" wirklich auf 0 zurücksetzen?`)) return;

    try {
        const { error } = await supabaseClient.from("users").update({
            harvest_coins: 0,
            clk_coins: 0
        }).eq("username", username);

        if (error) throw error;

        alert(`🔄 Währungen von "${username}" wurden zurückgesetzt.`);
        loadDashboardAnalyticsMatrix();
    } catch (err) {
        alert("❌ Fehler beim Zurücksetzen: " + err.message);
    }
}