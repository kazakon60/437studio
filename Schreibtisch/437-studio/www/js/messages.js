// =========================================================================
// 437 STUDIO | DIRECT MESSAGES, CHANNELS & SETTINGS ENGINE 
// VERSION: 5.7.0-ULTRA (FULL ADMIN & CHANNEL SUITE)
// =========================================================================

"use strict";

let activeChatPartner = localStorage.getItem("437_active_chat_partner") || null;
let activeChannel = null;
let currentViewMode = "private";
let sendAsStudio = false; 

let attachedMessageImage = null;
let attachedMessageVideo = null;
let recordedAudioBase64 = null;
let channelBannerBase64 = null; 
let settingsChannelBannerBase64 = null;
let searchTimeout = null;
let messagesSubscription = null;
let membershipSubscription = null;

let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let isRecordingCancelled = false;

let renderedMessageIds = new Set();
let hiddenChats = JSON.parse(localStorage.getItem("437_hidden_chats") || "[]");
let userAvatarCache = new Map();

// =========================================================================
// 1. INITIALISIERUNG BEIM LADEN DES DOMS (WARTET AUF CURRENTUSER)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    let checkAttempts = 0;
    
    const initInterval = setInterval(() => {
        checkAttempts++;
        
        if (typeof currentUser !== 'undefined' && currentUser) {
            clearInterval(initInterval);
            
            const urlParams = new URLSearchParams(window.location.search);
            let targetUser = urlParams.get("to");

            if (!targetUser || targetUser.trim() === "") {
                targetUser = sessionStorage.getItem("437_chat_partner");
            }

            if (!targetUser || targetUser.trim() === "") {
                targetUser = localStorage.getItem("437_active_chat_partner");
            }

            if (targetUser && targetUser.trim() !== "") {
                sessionStorage.removeItem("437_chat_partner");
                switchMessageTab('private');
                selectChatPartner(targetUser.trim());
            } else {
                selectChatPartner("437 Studio");
            }

            loadRecentChatPartners();
            verifyAndInitDefaultChannels();
            initMessageEventListeners();
            setupChannelMembershipListener();
            applyCurrentChatBackground();
        } else if (checkAttempts > 25) { 
            clearInterval(initInterval);
            if (typeof currentUser === 'undefined' || !currentUser) {
                alert("Bitte logge dich ein, um Nachrichten zu nutzen.");
                window.location.href = "index.html";
            }
        }
    }, 100);
});

// =========================================================================
// 2. EVENT LISTENER & UI HOOKS INITIALISIERUNG
// =========================================================================
function initMessageEventListeners() {
    const textInput = document.getElementById("msg-text-input");
    if (textInput) {
        textInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendPrivateMessage(e);
            }
        });
    }

    const searchInput = document.getElementById("recipient-search-input");
    if (searchInput) {
        searchInput.addEventListener("input", handleUserSearchInput);
    }
}

// =========================================================================
// 3. INDIVIDUELLES DESIGN- & HINTERGRUND-SYSTEM (PRO CHAT / CHANNEL)
// =========================================================================
function getActiveChatStorageKey() {
    if (activeChannel) return `437_chat_bg_channel_${activeChannel.toLowerCase()}`;
    if (activeChatPartner) return `437_chat_bg_private_${activeChatPartner.toLowerCase()}`;
    return `437_chat_bg_default`;
}

function applyCurrentChatBackground() {
    const container = document.getElementById("chat-bubbles-container");
    if (!container) return;

    const storageKey = getActiveChatStorageKey();
    const savedBg = localStorage.getItem(storageKey);

    if (savedBg) {
        if (savedBg.startsWith("linear-gradient") || savedBg.startsWith("#") || savedBg.startsWith("rgb") || savedBg.startsWith("radial-gradient")) {
            container.style.background = savedBg;
        } else {
            container.style.background = `url('${savedBg}') center/cover no-repeat`;
        }
    } else {
        if (activeChannel && activeChannel.toLowerCase() === "437-info") {
            container.style.background = "radial-gradient(circle, #1a0812 0%, #04040a 100%)";
        } else {
            container.style.background = "#04040a";
        }
    }
}

function setChatBackgroundPreset(presetType) {
    const container = document.getElementById("chat-bubbles-container");
    if (!container) return;

    let bgValue = "";
    if (presetType === 'deepspace') {
        bgValue = "#04040a";
    } else if (presetType === 'cyberneon') {
        bgValue = "linear-gradient(135deg, #050514 0%, #0a0a24 100%)";
    } else if (presetType === 'matrixdark') {
        bgValue = "radial-gradient(circle, #081210 0%, #020605 100%)";
    } else if (presetType === 'greenparadise') {
        bgValue = "linear-gradient(135deg, #021a08 0%, #063d18 50%, #010d04 100%)";
    } else if (presetType === 'bloodprotocol') {
        bgValue = "radial-gradient(circle, #1a0812 0%, #050204 100%)";
    }

    container.style.background = bgValue;
    localStorage.setItem(getActiveChatStorageKey(), bgValue);
    closeChatDesignModal();
}

function setCustomChatBackground(event) {
    const file = event?.target?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 4 * 1024 * 1024) { alert("Bild zu groß (Max 4MB)."); return; }

    const reader = new FileReader();
    reader.onload = e => {
        const base64Img = e.target.result;
        const container = document.getElementById("chat-bubbles-container");
        if (container) {
            container.style.background = `url('${base64Img}') center/cover no-repeat`;
        }
        localStorage.setItem(getActiveChatStorageKey(), base64Img);
        closeChatDesignModal();
    };
    reader.readAsDataURL(file);
}

function openChatDesignModal() {
    let modal = document.getElementById("chat-design-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "chat-design-modal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content cyber-design-modal-content" style="background: #090916; border: 1px solid var(--neon-blue); border-radius: 10px; width: 380px; max-width: 90%; padding: 22px; position: relative; font-family: monospace; box-shadow: 0 0 25px rgba(0,240,255,0.2);">
                <span onclick="closeChatDesignModal()" style="position: absolute; top: 12px; right: 16px; font-size: 20px; cursor: pointer; color: var(--neon-blue);">&times;</span>
                <h3 style="color: var(--neon-blue); margin-bottom: 6px; font-size: 15px; text-transform: uppercase;"><i class="fas fa-palette"></i> Chat-Design Studio</h3>
                <p style="color: #777; font-size: 10px; margin-bottom: 16px;">Passe das Design für diesen spezifischen Chat/Channel an.</p>
                
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="font-size: 11px; color: #aaa; font-weight: bold; margin-bottom: 2px;">Presets wählen:</div>
                    <button onclick="setChatBackgroundPreset('deepspace')" class="btn" style="text-align: left; background: #04040a; border: 1px solid #333; color: #fff; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 11px;"><i class="fas fa-moon"></i> Deep Space (Standard)</button>
                    <button onclick="setChatBackgroundPreset('cyberneon')" class="btn" style="text-align: left; background: #050514; border: 1px solid var(--neon-blue); color: var(--neon-blue); padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 11px;"><i class="fas fa-bolt"></i> Cyber Neon Blue</button>
                    <button onclick="setChatBackgroundPreset('matrixdark')" class="btn" style="text-align: left; background: #020605; border: 1px solid var(--neon-green); color: var(--neon-green); padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 11px;"><i class="fas fa-code"></i> Matrix Green</button>
                    <button onclick="setChatBackgroundPreset('greenparadise')" class="btn" style="text-align: left; background: linear-gradient(135deg, #021a08, #063d18); border: 1px solid #00ff66; color: #00ff66; padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: bold;"><i class="fas fa-leaf"></i> 🌿 Green Paradise</button>
                    <button onclick="setChatBackgroundPreset('bloodprotocol')" class="btn" style="text-align: left; background: #050204; border: 1px solid var(--neon-pink); color: var(--neon-pink); padding: 8px 12px; border-radius: 5px; cursor: pointer; font-size: 11px;"><i class="fas fa-skull"></i> Blood Protocol</button>
                    
                    <div style="border-top: 1px solid #1a1a2e; margin-top: 6px; padding-top: 10px;">
                        <div style="font-size: 11px; color: #aaa; font-weight: bold; margin-bottom: 6px;">Oder eigenes Bild hochladen:</div>
                        <label class="btn" style="display: block; text-align: center; background: rgba(0,240,255,0.1); border: 1px dashed var(--neon-blue); color: var(--neon-blue); padding: 10px; border-radius: 5px; cursor: pointer; font-size: 11px;">
                            <i class="fas fa-image"></i> Hintergrundbild hochladen
                            <input type="file" accept="image/*" onchange="setCustomChatBackground(event)" style="display: none;">
                        </label>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = "flex";
}

function closeChatDesignModal() {
    const modal = document.getElementById("chat-design-modal");
    if (modal) modal.style.display = "none";
}

// =========================================================================
// 4. HILFSFUNKTION: ADMIN-PRÜFUNG & DATUM/UHRZEIT FORMATIERUNG
// =========================================================================
function checkIsUserAdmin() {
    if (!currentUser) return false;
    const adminNames = ["nalix437", "amnesia437"];
    return (
        adminNames.includes(String(currentUser.username || "").trim().toLowerCase()) ||
        currentUser.is_admin === true ||
        (typeof isAdmin === "function" && isAdmin())
    );
}

function formatMessageTimestamp(timestampString) {
    if (!timestampString) return "";
    const date = new Date(timestampString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (isToday) {
        return timeStr;
    } else {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}. ${timeStr}`;
    }
}

async function getAvatarForUser(username) {
    if (!username) return DEFAULT_AVATAR;
    const uLower = username.toLowerCase();
    if (uLower === "437 studio") return "/img/logo.png";
    if (userAvatarCache.has(uLower)) return userAvatarCache.get(uLower);

    try {
        const { data } = await supabaseClient.from("users").select("avatar").ilike("username", username).maybeSingle();
        const avatar = (data && data.avatar) ? data.avatar : DEFAULT_AVATAR;
        userAvatarCache.set(uLower, avatar);
        return avatar;
    } catch (e) {
        return DEFAULT_AVATAR;
    }
}

// =========================================================================
// 5. DEFAULT CHANNELS VERIFIZIERUNG & ERSTELLUNG
// =========================================================================
async function verifyAndInitDefaultChannels() {
    if (!supabaseClient || !currentUser) return;

    try {
        const { data: existing, error: checkError } = await supabaseClient
            .from("group_channels")
            .select("name, banner_image")
            .eq("name", "437-info")
            .maybeSingle();

        if (checkError) {
            console.warn("437 STUDIO: Hinweis bei Kanalprüfung:", checkError.message);
        }

        if (!existing) {
            await supabaseClient.from("group_channels").upsert([{
                name: "437-info",
                topic: "Der offizielle System- und Info-Kanal von 437 Studio",
                banner_image: "/img/logo.png",
                created_by: "System"
            }], { onConflict: 'name' });
        } else if (!existing.banner_image || existing.banner_image === "") {
            await supabaseClient.from("group_channels").update({ banner_image: "/img/logo.png" }).eq("name", "437-info");
        }

        await supabaseClient.from("channel_members").upsert([{
            channel_name: "437-info",
            username: currentUser.username,
            added_by: "System",
            is_creator: true
        }], { onConflict: 'channel_name,username' });

        loadGroupChannels();
    } catch (err) {
        console.error("Unerwarteter Fehler in verifyAndInitDefaultChannels:", err);
    }
}

// =========================================================================
// 6. TAB UMSCHALTUNG (PRIVATE VS CHANNELS)
// =========================================================================
function switchMessageTab(mode) {
    currentViewMode = mode;
    const privateList = document.getElementById("recent-chats-list");
    const channelsList = document.getElementById("channels-list-container");
    const privBtn = document.getElementById("tab-private-btn");
    const chanBtn = document.getElementById("tab-channels-btn");

    if (mode === "private") {
        if (privateList) { privateList.style.display = "flex"; privateList.classList.remove("hidden"); }
        if (channelsList) { channelsList.style.display = "none"; channelsList.classList.add("hidden"); }
        if (privBtn) { privBtn.className = "sidebar-tab-btn active"; }
        if (chanBtn) { chanBtn.className = "sidebar-tab-btn"; }
    } else {
        if (privateList) { privateList.style.display = "none"; privateList.classList.add("hidden"); }
        if (channelsList) { channelsList.style.display = "flex"; channelsList.classList.remove("hidden"); }
        if (chanBtn) { chanBtn.className = "sidebar-tab-btn active"; }
        if (privBtn) { privBtn.className = "sidebar-tab-btn"; }
        loadGroupChannels();
    }
}

// =========================================================================
// 7. GRUPPEN-CHANNELS LADEN UND RENDERN (INKL. ADMIN-FREMD-LISTE)
// =========================================================================
async function loadGroupChannels() {
    if (!supabaseClient || !currentUser) return;
    const container = document.getElementById("channels-list-container");
    if (!container) return;

    try {
        const isAdminUser = checkIsUserAdmin();

        const { data: memberships, error: memberError } = await supabaseClient
            .from("channel_members")
            .select("channel_name")
            .eq("username", currentUser.username);

        const myChannelNames = memberships ? memberships.map(m => m.channel_name) : [];

        const { data: allChannels, error: channelsError } = await supabaseClient
            .from("group_channels")
            .select("*")
            .order("id", { ascending: true });

        if (channelsError || !allChannels) {
            container.innerHTML = `<div style="color: #666; font-size: 11px; padding: 10px; text-align: center;">Keine Channels verfügbar.</div>`;
            return;
        }

        const myChannels = allChannels.filter(c => myChannelNames.includes(c.name));
        const otherChannels = allChannels.filter(c => !myChannelNames.includes(c.name));

        myChannels.sort((a, b) => {
            if (a.name === "437-info") return -1;
            if (b.name === "437-info") return 1;
            return 0;
        });

        let html = "";

        html += `<div style="font-size: 10px; color: #888; text-transform: uppercase; margin-bottom: 6px; font-weight: bold; letter-spacing: 1px;">Deine Channels</div>`;
        
        if (myChannels.length === 0) {
            html += `<div style="color: #666; font-size: 11px; padding: 6px; text-align: center; margin-bottom: 10px;">Du bist in keinem Channel.</div>`;
        } else {
            html += myChannels.map(c => {
                const isInfoChannel = c.name.toLowerCase() === "437-info";
                const isSelected = activeChannel === c.name;
                
                let boxStyle = "";
                if (isInfoChannel) {
                    boxStyle = isSelected
                        ? `background: rgba(255, 0, 127, 0.2); border: 1px solid #ff007f; box-shadow: 0 0 12px rgba(255, 0, 127, 0.3);`
                        : `background: rgba(255, 0, 127, 0.08); border: 1px solid rgba(255, 0, 127, 0.4);`;
                } else {
                    boxStyle = isSelected 
                        ? `background: rgba(0, 240, 255, 0.12); border: 1px solid var(--neon-blue); box-shadow: 0 0 12px rgba(0,240,255,0.2);` 
                        : `background: #0c0c16; border: 1px solid #1a1a2e;`;
                }

                let channelImg = c.banner_image || '/img/logo.png';
                const isCreator = currentUser && c.created_by && c.created_by.toLowerCase() === currentUser.username.toLowerCase();
                const canManage = isInfoChannel ? isAdminUser : (isAdminUser || isCreator);
                const canDelete = !isInfoChannel && (isAdminUser || isCreator);

                return `
                    <div style="padding: 10px 12px; border-radius: 6px; ${boxStyle} transition: all 0.2s ease; margin-bottom: 6px; display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="selectChannel('${escapeHTML(c.name)}')">
                        <img src="${escapeHTML(channelImg)}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid ${isInfoChannel ? '#ff007f' : 'var(--neon-blue)'}; flex-shrink: 0;" onerror="this.src='/img/logo.png';">
                        <div style="flex-grow: 1; min-width: 0;">
                            <div style="color: ${isInfoChannel ? '#ff007f' : '#fff'}; font-weight: bold; font-size: 12px; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                                <span>#${escapeHTML(c.name)}</span>
                                ${isInfoChannel ? '<span style="font-size: 8px; background: #ff007f; color: #fff; padding: 1px 4px; border-radius: 3px;">SYSTEM</span>' : ''}
                            </div>
                            <div style="color: #888; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHTML(c.topic || "Channel")}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            ${canManage ? `
                                <button onclick="event.stopPropagation(); openChannelSettingsModal('${escapeHTML(c.name)}')" title="Einstellungen" style="background: transparent; border: 1px solid #333; color: #aaa; cursor: pointer; font-size: 11px; padding: 6px 8px; border-radius: 4px;"><i class="fas fa-cog"></i></button>
                            ` : ''}
                            ${canDelete ? `
                                <button onclick="event.stopPropagation(); deleteChannel('${escapeHTML(c.name)}')" title="Löschen" style="background: transparent; border: 1px solid #333; color: #ff0055; cursor: pointer; font-size: 11px; padding: 6px 8px; border-radius: 4px;"><i class="fas fa-trash"></i></button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join("");
        }

        if (isAdminUser && otherChannels.length > 0) {
            html += `
                <div style="font-size: 10px; color: var(--neon-pink); text-transform: uppercase; margin: 16px 0 6px 0; font-weight: bold; letter-spacing: 1px; border-top: 1px dashed rgba(255,0,127,0.3); padding-top: 12px;">
                    <i class="fas fa-user-secret"></i> Admin-Übersicht: Fremde Channels (${otherChannels.length})
                </div>
            `;

            html += otherChannels.map(c => {
                let channelImg = c.banner_image || '/img/logo.png';
                return `
                    <div style="padding: 10px 12px; border-radius: 6px; background: rgba(255,0,127,0.04); border: 1px dashed rgba(255,0,127,0.3); transition: all 0.2s ease; margin-bottom: 6px; display: flex; align-items: center; gap: 10px;">
                        <img src="${escapeHTML(channelImg)}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1px solid var(--neon-pink); flex-shrink: 0;" onerror="this.src='/img/logo.png';">
                        <div style="flex-grow: 1; min-width: 0;">
                            <div style="color: #fff; font-weight: bold; font-size: 12px; margin-bottom: 2px;">
                                #${escapeHTML(c.name)}
                            </div>
                            <div style="color: #888; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${escapeHTML(c.topic || "Kein Thema")} (Ersteller: ${escapeHTML(c.created_by || 'Unbekannt')})
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <button onclick="adminJoinChannel('${escapeHTML(c.name)}')" title="Als Admin beitreten" style="background: rgba(255,0,127,0.15); border: 1px solid var(--neon-pink); color: var(--neon-pink); cursor: pointer; font-size: 10px; padding: 6px 10px; border-radius: 4px; font-weight: bold;"><i class="fas fa-sign-in-alt"></i> Beitreten</button>
                        </div>
                    </div>
                `;
            }).join("");
        }

        container.innerHTML = html;
    } catch (err) {
        console.error("Fehler beim Laden der Gruppen-Channels:", err);
    }
}

async function adminJoinChannel(channelName) {
    if (!supabaseClient || !currentUser || !checkIsUserAdmin()) return;

    const { error } = await supabaseClient.from("channel_members").upsert([{
        channel_name: channelName,
        username: currentUser.username,
        added_by: currentUser.username + " (Admin-Override)",
        is_creator: false
    }], { onConflict: 'channel_name,username' });

    if (error) {
        alert("Fehler beim Beitreten: " + error.message);
        return;
    }

    loadGroupChannels();
    selectChannel(channelName);
}

// =========================================================================
// 8. CHANNEL AUSWÄHLEN UND AKTIVIEREN
// =========================================================================
async function selectChannel(channelName) {
    activeChannel = channelName;
    activeChatPartner = null;
    localStorage.removeItem("437_active_chat_partner");
    sendAsStudio = false;

    const isAdminUser = checkIsUserAdmin();
    const isInfoChannel = channelName.toLowerCase() === "437-info";
    const isChannelLocked = !isAdminUser;
    
    updateChannelLockState(isChannelLocked, false);

    let hasManageRights = false;
    if (currentUser) {
        const { data: channelData } = await supabaseClient
            .from("group_channels")
            .select("created_by")
            .eq("name", channelName)
            .maybeSingle();

        const isOriginalCreator = channelData && channelData.created_by && channelData.created_by.toLowerCase() === currentUser.username.toLowerCase();
        hasManageRights = isInfoChannel ? isAdminUser : (isAdminUser || isOriginalCreator);
    }

    const header = document.getElementById("active-chat-header");
    if (header) {
        if (isInfoChannel) {
            header.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <span style="color: #ff007f; font-weight: bold; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-shield-alt"></i> Offizieller System-Channel: #${escapeHTML(channelName)}
                        <span style="font-size: 8px; background: #ff007f; color: #fff; padding: 1px 5px; border-radius: 3px;">SYSTEM</span>
                    </span>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button onclick="openChatDesignModal()" class="btn" style="font-size: 10px; padding: 4px 8px; background: rgba(255,0,127,0.1); border: 1px solid #ff007f; color: #ff007f; cursor: pointer;">
                            <i class="fas fa-palette"></i> Design
                        </button>
                        ${hasManageRights ? `
                            <button onclick="openChannelSettingsModal('${escapeHTML(channelName)}')" class="btn" style="font-size: 10px; padding: 4px 8px; background: transparent; border: 1px solid #ff007f; color: #ff007f; cursor: pointer;">
                                <i class="fas fa-cog"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        } else {
            header.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <span style="color:#00f0ff; font-weight:bold;"><i class="fas fa-hashtag"></i> ${escapeHTML(channelName)}</span>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button onclick="openChatDesignModal()" class="btn" style="font-size: 10px; padding: 4px 8px; background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; color: #00f0ff; cursor: pointer;">
                            <i class="fas fa-palette"></i> Design
                        </button>
                        ${hasManageRights ? `
                            <button onclick="openChannelSettingsModal('${escapeHTML(channelName)}')" class="btn" style="font-size: 10px; padding: 4px 8px; background: transparent; border: 1px solid #00f0ff; color: #00f0ff; cursor: pointer;">
                                <i class="fas fa-cog"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    }

    loadChannelHistory(channelName);
    setupRealtimeChannelSubscription(channelName);
    loadGroupChannels();
    applyCurrentChatBackground();
}

// =========================================================================
// 9. CHAT-VERLAUF LADEN
// =========================================================================
async function loadChatHistory(partnerUsername) {
    if (!supabaseClient || !currentUser) return;
    const target = partnerUsername || activeChatPartner;
    if (!target) return;

    const container = document.getElementById("chat-bubbles-container");
    if (!container) return;

    container.innerHTML = `<div style="color: #888; text-align: center; margin: auto;">Lade Chat-Verlauf...</div>`;
    renderedMessageIds.clear();

    try {
        let filterString = "";
        
        if (target.toLowerCase() === "437 studio") {
            filterString = `and(sender.eq.437 Studio,recipient.eq.${currentUser.username}),and(sender.eq.${currentUser.username},recipient.eq.437 Studio)`;
        } else {
            filterString = `and(sender.eq.${currentUser.username},recipient.eq.${target}),and(sender.eq.${target},recipient.eq.${currentUser.username})`;
        }

        const { data: messages, error } = await supabaseClient
            .from("private_messages")
            .select("*")
            .or(filterString)
            .order("id", { ascending: true });

        if (error) throw error;

        if (!messages || messages.length === 0) {
            container.innerHTML = `<div style="color: #666; text-align: center; margin: auto;">Noch keine Nachrichten vorhanden. Starte die Konversation!</div>`;
            return;
        }

        container.innerHTML = "";
        for (const m of messages) {
            await appendSingleMessageToDOM(m, false);
        }
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error("Fehler beim Laden des Chat-Verlaufs:", err);
        container.innerHTML = `<div style="color: #ff0055; text-align: center; margin: auto;">Fehler beim Laden der Nachrichten.</div>`;
    }
}

// =========================================================================
// 10. CHANNEL-EINSTELLUNGEN MODAL
// =========================================================================
function previewSettingsChannelBanner(event) {
    const file = event?.target?.files?.[0];
    if (!file || !file.type.startsWith("image/")) { alert("Ungültiges Bild."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("Zu groß (Max 2MB)."); return; }

    const reader = new FileReader();
    reader.onload = e => {
        settingsChannelBannerBase64 = e.target.result;
        const img = document.getElementById("settings-banner-preview");
        if (img) img.src = settingsChannelBannerBase64;
    };
    reader.readAsDataURL(file);
}

async function openChannelSettingsModal(channelName) {
    if (!currentUser || !supabaseClient) return;

    const isAdminUser = checkIsUserAdmin();
    const isInfoChannel = channelName.toLowerCase() === "437-info";

    const { data: channelData } = await supabaseClient
        .from("group_channels")
        .select("*")
        .eq("name", channelName)
        .maybeSingle();

    const isOriginalCreator = channelData && channelData.created_by && channelData.created_by.toLowerCase() === currentUser.username.toLowerCase();

    if (isInfoChannel && !isAdminUser) { alert("❌ Zugriff verweigert."); return; }
    if (!isInfoChannel && !isAdminUser && !isOriginalCreator) { alert("❌ Zugriff verweigert."); return; }

    settingsChannelBannerBase64 = null;

    let modal = document.getElementById("channel-settings-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "channel-settings-modal";
        modal.className = "modal";
        document.body.appendChild(modal);
    }

    try {
        const { data: members } = await supabaseClient.from("channel_members").select("username").eq("channel_name", channelName);
        const memberMap = new Map();
        if (members) members.forEach(m => memberMap.set(m.username.toLowerCase(), true));

        const { data: allUsers } = await supabaseClient.from("users").select("username, avatar");
        let membersListHTML = "";
        let inviteListHTML = "";

        if (allUsers) {
            allUsers.forEach(u => {
                const isMember = memberMap.has(u.username.toLowerCase());
                const userAvatar = u.avatar || DEFAULT_AVATAR;

                if (isMember) {
                    membersListHTML += `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: #121222; border: 1px solid #333; border-radius: 4px; margin-bottom: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${escapeHTML(userAvatar)}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover;">
                                <span style="font-size: 11px; color: #fff;">${escapeHTML(u.username)}</span>
                            </div>
                            <button type="button" onclick="removeMemberFromChannel('${escapeHTML(channelName)}', '${escapeHTML(u.username)}')" style="background: transparent; border: none; color: #ff0055; cursor: pointer;"><i class="fas fa-times"></i></button>
                        </div>
                    `;
                } else {
                    inviteListHTML += `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: #121222; border: 1px solid #333; border-radius: 4px; margin-bottom: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <img src="${escapeHTML(userAvatar)}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover;">
                                <span style="font-size: 11px; color: #aaa;">${escapeHTML(u.username)}</span>
                            </div>
                            <button type="button" onclick="inviteSpecificUser('${escapeHTML(channelName)}', '${escapeHTML(u.username)}')" style="background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; color: #00f0ff; font-size: 10px; padding: 2px 6px; border-radius: 3px; cursor: pointer;"><i class="fas fa-plus"></i></button>
                        </div>
                    `;
                }
            });
        }

        let currentBanner = channelData?.banner_image || '/img/logo.png';

        modal.innerHTML = `
            <div class="modal-content" style="background: #0c0c16; border: 1px solid ${isInfoChannel ? '#ff007f' : '#00f0ff'}; border-radius: 8px; width: 420px; max-width: 95%; max-height: 85vh; display: flex; flex-direction: column; padding: 20px; position: relative; font-family: monospace;">
                <span onclick="document.getElementById('channel-settings-modal').remove()" style="position: absolute; top: 10px; right: 15px; font-size: 18px; cursor: pointer; color: #888;">&times;</span>
                <h3 style="color: ${isInfoChannel ? '#ff007f' : '#00f0ff'}; margin-bottom: 12px; font-size: 14px;"><i class="fas fa-cog"></i> Channel bearbeiten: #${escapeHTML(channelName)}</h3>
                
                <div style="overflow-y: auto; max-height: 70vh; display: flex; flex-direction: column; gap: 12px;">
                    <form onsubmit="handleUpdateChannelSettings(event, '${escapeHTML(channelName)}')">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                            <img id="settings-banner-preview" src="${escapeHTML(currentBanner)}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; border: 1px solid ${isInfoChannel ? '#ff007f' : '#00f0ff'};" onerror="this.src='/img/logo.png';">
                            <label style="font-size: 11px; color: ${isInfoChannel ? '#ff007f' : '#00f0ff'}; cursor: pointer; background: ${isInfoChannel ? 'rgba(255,0,127,0.1)' : 'rgba(0,240,255,0.1)'}; border: 1px solid ${isInfoChannel ? '#ff007f' : '#00f0ff'}; padding: 6px 10px; border-radius: 4px;">
                                <i class="fas fa-camera"></i> Bild ändern
                                <input type="file" id="settings-channel-banner-input" accept="image/*" onchange="previewSettingsChannelBanner(event)" style="display: none;">
                            </label>
                        </div>
                        <label style="font-size: 11px; color: #aaa; display: block; margin-bottom: 4px;">Thema / Beschreibung:</label>
                        <input type="text" id="settings-channel-topic" value="${escapeHTML(channelData?.topic || '')}" style="width: 100%; background: #121222; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 4px; font-size: 12px; margin-bottom: 10px; box-sizing: border-box;">
                        <button type="submit" class="btn" style="font-size: 11px; padding: 7px; width: 100%; cursor: pointer; background: ${isInfoChannel ? 'rgba(255,0,127,0.2)' : 'rgba(0,240,255,0.2)'}; border: 1px solid ${isInfoChannel ? '#ff007f' : '#00f0ff'}; color: #fff;">Änderungen speichern</button>
                    </form>

                    <div style="border-top: 1px solid #222; padding-top: 10px;">
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 6px; font-weight: bold;">Mitglieder:</div>
                        <div style="max-height: 120px; overflow-y: auto;">${membersListHTML || '<div style="color: #666; font-size: 10px;">Keine Mitglieder.</div>'}</div>
                    </div>

                    <div style="border-top: 1px solid #222; padding-top: 10px;">
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 6px; font-weight: bold;">Operatoren einladen:</div>
                        <div style="max-height: 120px; overflow-y: auto;">${inviteListHTML || '<div style="color: #666; font-size: 10px;">Keine User verfügbar.</div>'}</div>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = "flex";
    } catch (err) {
        console.error("Fehler beim Öffnen des Modals:", err);
    }
}

async function handleUpdateChannelSettings(event, channelName) {
    if (event) event.preventDefault();
    if (!supabaseClient || !currentUser) return;

    const topicInput = document.getElementById("settings-channel-topic");
    const updateData = { topic: topicInput ? topicInput.value.trim() : "" };
    
    if (settingsChannelBannerBase64) {
        updateData.banner_image = settingsChannelBannerBase64;
    }

    const { error } = await supabaseClient.from('group_channels').update(updateData).eq('name', channelName);
    if (error) { alert("Fehler: " + error.message); return; }

    alert("Erfolgreich gespeichert!");
    document.getElementById("channel-settings-modal")?.remove();
    settingsChannelBannerBase64 = null;
    loadGroupChannels();
    if (activeChannel === channelName) selectChannel(channelName);
}

async function inviteSpecificUser(channelName, targetUser) {
    if (!supabaseClient || !currentUser) return;
    await supabaseClient.from("channel_members").insert([{ channel_name: channelName, username: targetUser, added_by: currentUser.username, is_creator: false }]);
    openChannelSettingsModal(channelName);
}

async function removeMemberFromChannel(channelName, targetUser) {
    if (!supabaseClient) return;
    await supabaseClient.from("channel_members").delete().eq("channel_name", channelName).eq("username", targetUser);
    openChannelSettingsModal(channelName);
}

async function deleteChannel(channelName) {
    if (!supabaseClient || !currentUser) return;
    if (channelName.toLowerCase() === "437-info") { alert("❌ System-Kanal kann nicht gelöscht werden."); return; }
    if (!checkIsUserAdmin()) { alert("❌ Nur Admins."); return; }
    if (!confirm(`Channel "#${channelName}" wirklich löschen?`)) return;

    await supabaseClient.from("channel_members").delete().eq("channel_name", channelName);
    await supabaseClient.from("group_messages").delete().eq("channel_name", channelName);
    await supabaseClient.from("group_channels").delete().eq("name", channelName);
    
    if (activeChannel === channelName) {
        activeChannel = null;
        document.getElementById("chat-bubbles-container").innerHTML = `<div style="text-align: center; color: #555; margin: auto;">Channel gelöscht.</div>`;
    }
    loadGroupChannels();
}

// =========================================================================
// 11. CHANNEL VERLAUF & REALTIME
// =========================================================================
async function loadChannelHistory(channelName) {
    if (!supabaseClient) return;
    const container = document.getElementById("chat-bubbles-container");
    if (!container) return;

    try {
        const { data: messages } = await supabaseClient
            .from("group_messages")
            .select("*")
            .eq("channel_name", channelName)
            .order("id", { ascending: true });

        if (!messages || messages.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #666; margin: auto; font-size: 12px;">Keine Nachrichten in #${escapeHTML(channelName)}.</div>`;
            return;
        }

        container.innerHTML = "";
        for (const m of messages) {
            await appendSingleMessageToDOM(m, false);
        }
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        console.error("Fehler beim Laden des Channel-Verlaufs:", err);
    }
}

function setupRealtimeChannelSubscription(channelName) {
    if (!supabaseClient) return;
    if (messagesSubscription) supabaseClient.removeChannel(messagesSubscription);

    messagesSubscription = supabaseClient
        .channel(`channel_${channelName}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `channel_name=eq.${channelName}` }, async payload => {
            await appendSingleMessageToDOM(payload.new);
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages", filter: `channel_name=eq.${channelName}` }, payload => {
            removeMessageFromDOM(payload.old.id);
        })
        .subscribe();
}

function setupChannelMembershipListener() {
    if (!supabaseClient || !currentUser) return;
    if (membershipSubscription) supabaseClient.removeChannel(membershipSubscription);

    membershipSubscription = supabaseClient
        .channel(`membership_${currentUser.username}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "channel_members", filter: `username=eq.${currentUser.username}` }, () => {
            loadGroupChannels();
        })
        .subscribe();
}

// =========================================================================
// 12. CHANNEL ERSTELLUNGS-MODAL
// =========================================================================
function openCreateChannelModal() {
    let modal = document.getElementById("create-channel-modal");
    channelBannerBase64 = null; 
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "create-channel-modal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content" style="background: #0c0c16; border: 1px solid #00f0ff; border-radius: 8px; width: 360px; max-width: 90%; padding: 20px; position: relative; font-family: monospace;">
                <span onclick="document.getElementById('create-channel-modal').remove()" style="position: absolute; top: 10px; right: 15px; font-size: 18px; cursor: pointer; color: #888;">&times;</span>
                <h3 style="color: #00f0ff; margin-bottom: 12px; font-size: 14px;"><i class="fas fa-plus"></i> Channel erstellen</h3>
                <form onsubmit="handleCreateChannelSubmit(event)">
                    <input type="text" id="new-channel-name" required placeholder="Kanalname..." style="width: 100%; background: #121222; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-size: 12px; box-sizing: border-box;">
                    <input type="text" id="new-channel-topic" placeholder="Thema..." style="width: 100%; background: #121222; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 4px; margin-bottom: 15px; font-size: 12px; box-sizing: border-box;">
                    <button type="submit" class="btn btn-neon-blue" style="width: 100%; padding: 8px; font-size: 12px; cursor: pointer;">Erstellen</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        modal.style.display = "flex";
    }
}

async function handleCreateChannelSubmit(event) {
    event.preventDefault();
    if (!supabaseClient || !currentUser) return;

    const channelName = document.getElementById("new-channel-name").value.trim().toLowerCase().replace(/\s+/g, '-');
    const channelTopic = document.getElementById("new-channel-topic").value.trim();
    if (!channelName) return;

    if (channelName === "437-info") { alert("Reservierter Name."); return; }

    const { error } = await supabaseClient.from("group_channels").insert([{ 
        name: channelName, 
        topic: channelTopic, 
        banner_image: "/img/logo.png",
        created_by: currentUser.username 
    }]);
    
    if (error) { alert("Fehler: " + error.message); return; }

    await supabaseClient.from("channel_members").upsert([{ channel_name: channelName, username: currentUser.username, added_by: currentUser.username, is_creator: true }], { onConflict: 'channel_name,username' });

    document.getElementById("create-channel-modal")?.remove();
    await loadGroupChannels();
    switchMessageTab('channels'); 
    selectChannel(channelName);
}

// =========================================================================
// 13. BENUTZER-SUCHE & DIREKTCHAT FUNKTIONEN
// =========================================================================
async function handleUserSearchInput(event) {
    const query = event.target.value.trim();
    const box = document.getElementById("user-suggestions-box");
    if (!box) return;

    if (searchTimeout) clearTimeout(searchTimeout);
    if (query.length < 1) { box.classList.add("hidden"); box.innerHTML = ""; return; }

    searchTimeout = setTimeout(async () => {
        if (!supabaseClient) return;
        const { data: users } = await supabaseClient.from("users").select("username, avatar").ilike("username", `%${query}%`).neq("username", currentUser.username).limit(5);
        if (!users || users.length === 0) { box.innerHTML = `<div style="padding: 8px; color: #666; font-size: 11px;">Niemand gefunden</div>`; box.classList.remove("hidden"); return; }

        box.innerHTML = users.map(u => `
            <div class="suggestion-item" onclick="selectUserFromSuggestion('${escapeHTML(u.username)}')">
                <img src="${u.avatar || DEFAULT_AVATAR}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover;">
                <span style="font-size: 12px;">${escapeHTML(u.username)}</span>
            </div>
        `).join("");
        box.classList.remove("hidden");
    }, 250);
}

function selectUserFromSuggestion(username) {
    const input = document.getElementById("recipient-search-input");
    const box = document.getElementById("user-suggestions-box");
    if (input) input.value = "";
    if (box) box.classList.add("hidden");

    const uKey = username.toLowerCase();
    hiddenChats = hiddenChats.filter(h => h !== uKey);
    localStorage.setItem("437_hidden_chats", JSON.stringify(hiddenChats));

    switchMessageTab('private');
    selectChatPartner(username);
}

async function loadRecentChatPartners() {
    if (!supabaseClient || !currentUser) return;
    const list = document.getElementById("recent-chats-list");
    if (!list) return;

    try {
        const isAdminUser = checkIsUserAdmin();

        const { data: allUsersData } = await supabaseClient.from("users").select("username, avatar");
        const userAvatarMap = new Map();
        if (allUsersData) {
            allUsersData.forEach(u => userAvatarMap.set(u.username.toLowerCase(), u.avatar || DEFAULT_AVATAR));
        }

        const { data: sentMessages } = await supabaseClient.from("private_messages").select("sender, recipient, message, read, id, created_at").eq("sender", currentUser.username);
        const { data: recvMessages } = await supabaseClient.from("private_messages").select("sender, recipient, message, read, id, created_at").eq("recipient", currentUser.username);

        let studioSent = [], studioRecv = [];
        if (isAdminUser) {
            const { data: sSent } = await supabaseClient.from("private_messages").select("sender, recipient, message, read, id, created_at").eq("sender", "437 Studio");
            const { data: sRecv } = await supabaseClient.from("private_messages").select("sender, recipient, message, read, id, created_at").eq("recipient", "437 Studio");
            studioSent = sSent || [];
            studioRecv = sRecv || [];
        }

        const allMsgs = [...(sentMessages || []), ...(recvMessages || []), ...studioSent, ...studioRecv];
        allMsgs.sort((a, b) => b.id - a.id);

        let chatMap = new Map();
        
        if (!hiddenChats.includes("437 studio")) {
            chatMap.set("437 studio", { partnerName: "437 Studio", lastMessage: "Offizieller Studio-Direktchat", timeFormatted: "", avatar: "/img/logo.png", hasUnread: false, isOfficial: true, rawId: 0 });
        }

        const storedActivePartner = localStorage.getItem("437_active_chat_partner");
        if (storedActivePartner && storedActivePartner.toLowerCase() !== "437 studio") {
            const pKey = storedActivePartner.toLowerCase();
            if (!hiddenChats.includes(pKey)) {
                chatMap.set(pKey, {
                    partnerName: storedActivePartner,
                    lastMessage: "Bereit für Nachrichten",
                    timeFormatted: "",
                    avatar: userAvatarMap.get(pKey) || DEFAULT_AVATAR,
                    hasUnread: false,
                    isOfficial: false,
                    rawId: 999999
                });
            }
        }

        allMsgs.forEach(m => {
            let partner = "";
            const isUserSender = m.sender.toLowerCase() === currentUser.username.toLowerCase();
            const isStudioSender = m.sender.toLowerCase() === "437 studio";
            const isStudioRecipient = m.recipient && m.recipient.toLowerCase() === "437 studio";

            if (isStudioSender || isStudioRecipient) return;

            if (isUserSender) {
                partner = m.recipient;
            } else {
                partner = m.sender;
            }

            if (!partner || partner.toLowerCase() === "437 studio") return;
            const partnerKey = partner.toLowerCase();
            if (hiddenChats.includes(partnerKey)) return;

            const isUnread = (m.recipient || "").toLowerCase() === currentUser.username.toLowerCase() && m.read === false;
            const formattedTime = formatMessageTimestamp(m.created_at || m.timestamp);

            if (!chatMap.has(partnerKey)) {
                chatMap.set(partnerKey, { 
                    partnerName: partner, 
                    lastMessage: m.message || "Medien / Nachricht", 
                    timeFormatted: formattedTime,
                    avatar: userAvatarMap.get(partnerKey) || DEFAULT_AVATAR, 
                    hasUnread: isUnread, 
                    isOfficial: false,
                    rawId: m.id 
                });
            } else {
                const existing = chatMap.get(partnerKey);
                if (existing.rawId <= m.id) {
                    existing.lastMessage = m.message || "Medien / Nachricht";
                    existing.timeFormatted = formattedTime;
                    if (isUnread) existing.hasUnread = true;
                }
            }
        });

        let html = "";
        chatMap.forEach((chat) => {
            if (isAdminUser && sendAsStudio && !chat.isOfficial) return;

            const isSelected = !activeChannel && activeChatPartner && activeChatPartner.toLowerCase() === chat.partnerName.toLowerCase();
            
            let boxStyle = "";
            if (chat.isOfficial) {
                boxStyle = isSelected
                    ? `background: rgba(255, 0, 127, 0.2); border: 1px solid #ff007f; box-shadow: 0 0 12px rgba(255, 0, 127, 0.3);`
                    : `background: rgba(255, 0, 127, 0.08); border: 1px solid rgba(255, 0, 127, 0.4);`;
            } else {
                boxStyle = chat.hasUnread 
                    ? `background: rgba(0, 240, 255, 0.1); border: 1px solid #00f0ff;` 
                    : `background: #090914; border: 1px solid #16162c; opacity: ${isSelected ? '1' : '0.85'};`;
            }

            let deleteBtnHTML = !chat.isOfficial ? `
                <button onclick="event.stopPropagation(); hideChatFromList('${escapeHTML(chat.partnerName)}')" title="Aus Liste löschen" style="background: transparent; border: none; color: #888; cursor: pointer; font-size: 11px; padding: 4px; transition: color 0.2s;" onmouseover="this.style.color='#ff0055'" onmouseout="this.style.color='#888'"><i class="fas fa-trash"></i></button>
            ` : '';

            html += `
                <div style="padding: 10px; border-radius: 8px; ${boxStyle} display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.2s;" onclick="selectChatPartner('${escapeHTML(chat.partnerName)}')">
                    <img src="${escapeHTML(chat.avatar)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid ${chat.isOfficial ? '#ff007f' : '#00f0ff'};" onerror="this.src=DEFAULT_AVATAR;">
                    <div style="flex-grow: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <span style="color: ${chat.isOfficial ? '#ff007f' : (chat.hasUnread ? '#00f0ff' : '#ccc')}; font-weight: bold; font-size: 12px; display: flex; align-items: center; gap: 5px;">
                                ${escapeHTML(chat.partnerName)}
                                ${chat.isOfficial ? '<span style="font-size: 8px; background: #ff007f; color: #fff; padding: 1px 4px; border-radius: 3px;">SYSTEM</span>' : ''}
                            </span>
                            <span style="color: #666; font-size: 9px;">${escapeHTML(chat.timeFormatted)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="color: #777; font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${escapeHTML(chat.lastMessage)}</div>
                            ${chat.hasUnread ? '<span style="font-size: 8px; background: #ff0055; color: #fff; padding: 1px 4px; border-radius: 3px;">NEU</span>' : ''}
                        </div>
                    </div>
                    ${deleteBtnHTML}
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (err) {
        console.error("Fehler beim Laden der Chats:", err);
    }
}

function hideChatFromList(partnerName) {
    const key = partnerName.toLowerCase();
    if (!hiddenChats.includes(key)) {
        hiddenChats.push(key);
        localStorage.setItem("437_hidden_chats", JSON.stringify(hiddenChats));
    }
    if (activeChatPartner && activeChatPartner.toLowerCase() === key) {
        selectChatPartner("437 Studio");
    }
    loadRecentChatPartners();
}

async function selectChatPartner(username) {
    activeChatPartner = username;
    localStorage.setItem("437_active_chat_partner", username);
    activeChannel = null;
    sendAsStudio = false;
    if (typeof clearMessageBadge === "function") clearMessageBadge();

    const isStudioChat = username.toLowerCase() === "437 studio";
    const isAdminUser = checkIsUserAdmin();

    updateChannelLockState(false, isStudioChat && isAdminUser);
    updateGiantSenderBanner();

    if (supabaseClient && currentUser) {
        await supabaseClient.from("private_messages").update({ read: true }).eq("recipient", currentUser.username).eq("sender", username);
    }

    const header = document.getElementById("active-chat-header");
    if (header) {
        if (isStudioChat) {
            header.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <span style="color: #ff007f; font-weight: bold; display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-shield-alt"></i> Offizieller Direktchat: ${escapeHTML(username)}
                        <span style="font-size: 8px; background: #ff007f; color: #fff; padding: 1px 5px; border-radius: 3px;">SYSTEM</span>
                    </span>
                    <button onclick="openChatDesignModal()" class="btn" style="font-size: 10px; padding: 4px 8px; background: rgba(255,0,127,0.1); border: 1px solid #ff007f; color: #ff007f; cursor: pointer;">
                        <i class="fas fa-palette"></i> Design
                    </button>
                </div>
            `;
        } else {
            let partnerAvatar = DEFAULT_AVATAR;
            try {
                const { data: uData } = await supabaseClient.from("users").select("avatar").eq("username", username).maybeSingle();
                if (uData && uData.avatar) partnerAvatar = uData.avatar;
            } catch (e) {}

            header.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="window.location.href='profil.html?user=${encodeURIComponent(username)}'" title="Profil aufrufen">
                        <img src="${escapeHTML(partnerAvatar)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--neon-blue);" onerror="this.src=DEFAULT_AVATAR;">
                        <span style="color: var(--neon-blue); font-weight: bold; font-size: 13px; text-decoration: underline;">${escapeHTML(username)}</span>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button onclick="openChatDesignModal()" class="btn" style="font-size: 10px; padding: 4px 8px; background: rgba(0,240,255,0.1); border: 1px solid #00f0ff; color: #00f0ff; cursor: pointer;">
                            <i class="fas fa-palette"></i> Design
                        </button>
                        <button onclick="clearCurrentChat('${escapeHTML(username)}')" class="btn" style="font-size: 10px; padding: 4px 8px; background: transparent; border: 1px solid #ff0055; color: #ff0055; cursor: pointer;">
                            <i class="fas fa-trash-alt"></i> Chat leeren
                        </button>
                    </div>
                </div>
            `;
        }
    }

    loadChatHistory(username);
    setupRealtimeChatSubscription(username);
    loadRecentChatPartners();
    applyCurrentChatBackground();
}

async function clearCurrentChat(partnerUsername) {
    if (!supabaseClient || !currentUser) return;
    if (!confirm(`Möchtest du den gesamten Chat-Verlauf mit ${partnerUsername} löschen?`)) return;

    const filterString = `and(sender.eq.${currentUser.username},recipient.eq.${partnerUsername}),and(sender.eq.${partnerUsername},recipient.eq.${currentUser.username})`;
    
    const { error } = await supabaseClient.from("private_messages").delete().or(filterString);
    if (error) {
        alert("Fehler beim Leeren des Chats: " + error.message);
        return;
    }

    document.getElementById("chat-bubbles-container").innerHTML = `<div style="text-align: center; color: #555; margin: auto;">Chat wurde geleert.</div>`;
    loadRecentChatPartners();
}

function updateChannelLockState(isLocked, showAdminStudioBar) {
    const inputForm = document.getElementById("chat-input-form");
    const lockedBanner = document.getElementById("channel-locked-banner");
    const giantBanner = document.getElementById("giant-sender-banner");
    const imgPreview = document.getElementById("msg-img-preview-box");
    const vidPreview = document.getElementById("msg-video-preview-box");
    const voiceStatus = document.getElementById("voice-status-bar");

    if (isLocked) {
        if (inputForm) inputForm.style.display = "none";
        if (lockedBanner) lockedBanner.style.display = "flex";
        if (giantBanner) giantBanner.style.display = "none";
        if (imgPreview) imgPreview.style.display = "none";
        if (vidPreview) vidPreview.style.display = "none";
        if (voiceStatus) voiceStatus.style.display = "none";
    } else {
        if (inputForm) inputForm.style.display = "flex";
        if (lockedBanner) lockedBanner.style.display = "none";
        if (giantBanner) giantBanner.style.display = showAdminStudioBar ? "flex" : "none";
    }
}

function toggleAdminStudioSender() {
    sendAsStudio = !sendAsStudio;
    updateGiantSenderBanner();
    loadRecentChatPartners();
}

function updateGiantSenderBanner() {
    const banner = document.getElementById("giant-sender-banner");
    const nameEl = document.getElementById("giant-sender-name");
    const isStudioChat = activeChatPartner && activeChatPartner.toLowerCase() === "437 studio";
    const isAdminUser = checkIsUserAdmin();

    if (!isStudioChat || !isAdminUser || !banner || !nameEl) {
        if (banner) banner.style.display = "none";
        return;
    }

    banner.style.display = "flex";

    if (sendAsStudio) {
        banner.style.background = "rgba(255, 0, 127, 0.15)";
        banner.style.border = "2px solid #ff007f";
        banner.style.color = "#ff007f";
        banner.style.boxShadow = "0 0 15px rgba(255, 0, 127, 0.3)";
        nameEl.textContent = "⚡ 437 STUDIO (OFFIZIELLER SYSTEM-ABSENDER)";
    } else {
        banner.style.background = "rgba(0, 240, 255, 0.1)";
        banner.style.border = "2px solid #00f0ff";
        banner.style.color = "#00f0ff";
        banner.style.boxShadow = "0 0 15px rgba(0, 240, 255, 0.2)";
        nameEl.textContent = `👤 ${currentUser.username.toUpperCase()} (PRIVATES KONTO)`;
    }
}

function setupRealtimeChatSubscription(partnerUsername) {
    if (!supabaseClient || !currentUser) return;
    if (messagesSubscription) supabaseClient.removeChannel(messagesSubscription);

    messagesSubscription = supabaseClient
        .channel(`chat_${currentUser.username}_${partnerUsername}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages" }, async payload => {
            const m = payload.new;
            if (renderedMessageIds.has(m.id)) return;

            const isTargetStudio = partnerUsername.toLowerCase() === "437 studio";
            const isMsgStudio = m.sender.toLowerCase() === "437 studio" || m.recipient.toLowerCase() === "437 studio";

            if (isTargetStudio && isMsgStudio) {
                await appendSingleMessageToDOM(m);
                loadRecentChatPartners();
            } else if ((m.sender === partnerUsername && m.recipient === currentUser.username) || (m.sender === currentUser.username && m.recipient === partnerUsername)) {
                await appendSingleMessageToDOM(m);
                loadRecentChatPartners();
            }
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "private_messages" }, payload => {
            removeMessageFromDOM(payload.old.id);
        })
        .subscribe();
}

// =========================================================================
// 14. NACHRICHTEN RENDERN (INKL. ADMIN-LÖSCHRECHT FÜR CHANNELS)
// =========================================================================
async function appendSingleMessageToDOM(m, scrollToBottom = true) {
    const container = document.getElementById("chat-bubbles-container");
    if (!container) return;

    if (m.id && renderedMessageIds.has(m.id)) return;
    if (m.id) renderedMessageIds.add(m.id);

    const isSent = (m.sender === currentUser.username && !sendAsStudio) || (m.sender === "437 Studio" && sendAsStudio);
    
    const isAdminUser = checkIsUserAdmin();
    const canDelete = activeChannel ? (isAdminUser || isSent) : (isSent || (isAdminUser && m.sender === "437 Studio"));

    const timeFormatted = formatMessageTimestamp(m.created_at || m.timestamp);
    const senderAvatar = await getAvatarForUser(m.sender);
    
    let voiceHtml = m.voice_note ? `
        <div style="margin-top: 6px; background: rgba(0,0,0,0.4); border: 1px solid #444; padding: 6px 10px; border-radius: 6px; display: flex; align-items: center; gap: 10px;">
            <button type="button" onclick="playCustomVoiceNote(this)" data-src="${m.voice_note}" style="background: #00f0ff; color: #000; border: none; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 11px;"><i class="fas fa-play"></i></button>
            <div style="font-size: 11px; color: #fff;">Sprachnachricht</div>
            <audio src="${m.voice_note}" style="display: none;" onended="onVoiceEnded(this)"></audio>
        </div>
    ` : '';

    let imgHtml = m.image ? `<div style="margin-top: 6px;"><img src="${m.image}" style="max-width: 100%; max-height: 180px; border-radius: 6px; object-fit: contain;"></div>` : '';
    let videoHtml = m.video ? `<div style="margin-top: 6px;"><video src="${m.video}" controls style="max-width: 100%; max-height: 200px; border-radius: 6px;"></video></div>` : '';
    
    const isOfficialSender = m.sender.toLowerCase() === "437 studio";

    const bubbleRow = document.createElement("div");
    bubbleRow.id = `msg-bubble-${m.id}`;
    bubbleRow.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 12px;
        flex-direction: ${isSent ? 'row-reverse' : 'row'};
    `;

    bubbleRow.innerHTML = `
        <img src="${escapeHTML(senderAvatar)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid ${isOfficialSender ? '#ff007f' : '#00f0ff'}; flex-shrink: 0;" onerror="this.src=DEFAULT_AVATAR;">
        <div style="max-width: 75%; display: flex; flex-direction: column; align-items: ${isSent ? 'flex-end' : 'flex-start'};">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; margin-bottom: 3px; color: #bbb; font-weight: bold;">
                <span style="color: ${isOfficialSender ? '#ff007f' : '#00f0ff'};">${escapeHTML(m.sender)} ${isOfficialSender ? '<span style="font-size: 8px; background: #ff007f; color: #fff; padding: 1px 4px; border-radius: 3px;">SYSTEM</span>' : ''}</span>
                <span style="font-size: 10px; color: #888; background: rgba(0,0,0,0.5); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">${escapeHTML(timeFormatted)}</span>
            </div>
            <div class="bubble ${isSent ? 'sent' : 'received'}" style="position: relative; width: 100%;">
                ${canDelete && m.id ? `<button type="button" onclick="deleteMessage(${m.id}, '${activeChannel ? 'group' : 'private'}')" class="bubble-delete-btn" title="Nachricht löschen"><i class="fas fa-trash"></i></button>` : ''}
                ${m.message ? `<div style="font-size: 12.5px; color: #fff; line-height: 1.5;">${escapeHTML(m.message)}</div>` : ''}
                ${voiceHtml} ${imgHtml} ${videoHtml}
            </div>
        </div>
    `;

    container.appendChild(bubbleRow);
    if (scrollToBottom) container.scrollTop = container.scrollHeight;
}

async function deleteMessage(msgId, type) {
    if (!supabaseClient || !confirm("Nachricht wirklich löschen?")) return;

    const tableName = type === 'group' ? 'group_messages' : 'private_messages';
    const { error } = await supabaseClient.from(tableName).delete().eq('id', msgId);

    if (error) {
        alert("Fehler beim Löschen: " + error.message);
        return;
    }

    removeMessageFromDOM(msgId);
}

function removeMessageFromDOM(msgId) {
    const el = document.getElementById(`msg-bubble-${msgId}`);
    if (el) el.remove();
    renderedMessageIds.delete(msgId);
}

// =========================================================================
// 15. MEDIEN & SPRACHAUFNAHME
// =========================================================================
function previewMessageImage(event) {
    const file = event?.target?.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) { alert("Max 2 MB."); return; }

    const reader = new FileReader();
    reader.onload = e => {
        attachedMessageImage = e.target.result;
        const box = document.getElementById("msg-img-preview-box");
        const img = document.getElementById("msg-img-preview");
        if (box && img) { img.src = attachedMessageImage; box.style.display = "flex"; }
    };
    reader.readAsDataURL(file);
}

function clearAttachedMessageImage() {
    attachedMessageImage = null;
    const input = document.getElementById("msg-image-input");
    const box = document.getElementById("msg-img-preview-box");
    if (input) input.value = "";
    if (box) box.style.display = "none";
}

function previewMessageVideo(event) {
    const file = event?.target?.files?.[0];
    if (!file || !file.type.startsWith("video/")) return;
    if (file.size > 15 * 1024 * 1024) { alert("Max 15 MB."); return; }

    const reader = new FileReader();
    reader.onload = e => {
        attachedMessageVideo = e.target.result;
        const box = document.getElementById("msg-video-preview-box");
        const vid = document.getElementById("msg-video-preview");
        if (box && vid) { vid.src = attachedMessageVideo; box.style.display = "flex"; }
    };
    reader.readAsDataURL(file);
}

function clearAttachedMessageVideo() {
    attachedMessageVideo = null;
    const input = document.getElementById("msg-video-input");
    const box = document.getElementById("msg-video-preview-box");
    if (input) input.value = "";
    if (box) box.style.display = "none";
}

async function toggleVoiceRecording() {
    const recordBtn = document.getElementById("voice-record-btn");
    const statusBar = document.getElementById("voice-status-bar");

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        try {
            isRecordingCancelled = false;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                if (isRecordingCancelled) return;
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = e => {
                    recordedAudioBase64 = e.target.result;
                    stream.getTracks().forEach(track => track.stop());
                    if (recordBtn) {
                        recordBtn.style.color = "var(--neon-green)";
                        recordBtn.innerHTML = `<i class="fas fa-check"></i>`;
                    }
                };
                reader.readAsDataURL(audioBlob);
            };

            mediaRecorder.start();
            recordingSeconds = 0;
            if (statusBar) statusBar.style.display = "flex";
            if (recordBtn) {
                recordBtn.style.color = "var(--neon-pink)";
                recordBtn.innerHTML = `<i class="fas fa-stop"></i>`;
            }

            recordingTimer = setInterval(() => {
                recordingSeconds++;
                const timerEl = document.getElementById("voice-timer");
                if (timerEl) timerEl.textContent = `Aufnahme (${recordingSeconds}s)...`;
            }, 1000);
        } catch (err) {
            alert("Mikrofon-Fehler: " + err.message);
        }
    } else {
        mediaRecorder.stop();
        clearInterval(recordingTimer);
        if (statusBar) statusBar.style.display = "none";
    }
}

function cancelVoiceRecording() {
    isRecordingCancelled = true;
    if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
    clearInterval(recordingTimer);
    mediaRecorder = null;
    audioChunks = [];
    recordedAudioBase64 = null; 
    
    document.getElementById("voice-status-bar")?.style.setProperty("display", "none");
    resetVoiceButtonUI();
}

async function handleSendPrivateMessage(event) {
    if (event) event.preventDefault();
    if (!supabaseClient || !currentUser) return;

    if (typeof checkUserCanSend === "function") {
        const canSend = await checkUserCanSend();
        if (!canSend) return;
    }

    const textInput = document.getElementById("msg-text-input");
    const messageText = textInput ? textInput.value.trim() : "";

    if (!messageText && !attachedMessageImage && !attachedMessageVideo && !recordedAudioBase64) return;

    const isStudioChat = activeChatPartner && activeChatPartner.toLowerCase() === "437 studio";
    const actualSender = (isStudioChat && sendAsStudio && checkIsUserAdmin()) ? "437 Studio" : currentUser.username;

    if (activeChannel) {
        if (!checkIsUserAdmin()) {
            alert("❌ Channel-Schreibschutz aktiv: Nur Administratoren dürfen hier schreiben.");
            return;
        }

        const newChannelMsg = {
            channel_name: activeChannel,
            sender: actualSender,
            message: messageText,
            image: attachedMessageImage || null,
            video: attachedMessageVideo || null,
            voice_note: recordedAudioBase64 || null
        };

        if (textInput) textInput.value = "";
        clearAttachedMessageImage();
        clearAttachedMessageVideo();
        recordedAudioBase64 = null;
        resetVoiceButtonUI();

        const { data, error } = await supabaseClient.from("group_messages").insert([newChannelMsg]).select();
        if (!error && data && data.length > 0) {
            await appendSingleMessageToDOM(data[0]);
        }
        return;
    }

    if (!activeChatPartner) return;

    const newPrivateMsg = {
        sender: actualSender,
        recipient: isStudioChat ? currentUser.username : activeChatPartner,
        message: messageText,
        image: attachedMessageImage || null,
        video: attachedMessageVideo || null,
        voice_note: recordedAudioBase64 || null,
        read: false
    };

    const textInputVal = textInput ? textInput.value : "";
    if (textInput) textInput.value = "";
    clearAttachedMessageImage();
    clearAttachedMessageVideo();
    recordedAudioBase64 = null;
    resetVoiceButtonUI();

    const { data, error } = await supabaseClient.from("private_messages").insert([newPrivateMsg]).select();
    if (!error && data && data.length > 0) {
        await appendSingleMessageToDOM(data[0]);
        loadRecentChatPartners();
    } else if (error) {
        alert("Fehler beim Senden: " + error.message);
        if (textInput) textInput.value = textInputVal;
    }
}

function resetVoiceButtonUI() {
    const btn = document.getElementById("voice-record-btn");
    if (btn) { btn.style.color = "var(--neon-green)"; btn.innerHTML = `<i class="fas fa-microphone"></i>`; }
}

function playCustomVoiceNote(btn) {
    const audioElement = btn.closest('div').querySelector('audio');
    const icon = btn.querySelector('i');

    if (audioElement.paused) {
        audioElement.play();
        icon.className = "fas fa-pause";
    } else {
        audioElement.pause();
        icon.className = "fas fa-play";
    }
}

function onVoiceEnded(audio) {
    const btnIcon = audio.closest('div').querySelector('button i');
    if (btnIcon) btnIcon.className = "fas fa-play";
    audio.currentTime = 0;
}