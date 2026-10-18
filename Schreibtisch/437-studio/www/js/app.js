// =========================================================================
// 437 STUDIO | GLOBAL CORE ENGINE (VOLLSTÄNDIG & FEHLERFREI)
// Supabase • Authentication • Live Security (Ban/Timeout/Mute) • Profile • Dropdown • Achievements • Messages & Push
// =========================================================================

"use strict";

// ========================================================================
// 1. SUPABASE KONFIGURATION & SICHERE GLOBALE KONSTANTEN
// ========================================================================

const SUPABASE_URL = "https://qesqytielkgthjveplmx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlc3F5dGllbGtndGhqdmVwbG14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDkzMDMsImV4cCI6MjEwNzQ4NTMwM30.7Ev2CwV9vHFd8NoWv0h3YV5WxycR63f1qEFGA6xF4KM";
const VAPID_PUBLIC_KEY = "BMjkI8pXxSXNvFp1OzEZIuDWpz-PMhSIKx5cKzRPop8pPjTjSMls7DalaZo-FPA0THR3ZOWHES5hGkoegsnvj1A";

let supabaseClient = null;
let currentUser = null;
let messageSubscription = null;

// Schutz vor doppelter Deklaration ("Identifier has already been declared")
if (typeof window.DEFAULT_AVATAR === 'undefined') {
    window.DEFAULT_AVATAR = "https://api.dicebear.com/7.x/bottts/svg?seed=437Studio";
}
const DEFAULT_AVATAR = window.DEFAULT_AVATAR;

const ADMIN_NAMES = ["nalix437", "amnesia437"];

const CYBER_PERKS_POOL = [
    {
        id: "437_operator",
        name: "437 Operator",
        buff: "Cyber-Reputation level 437",
        color: "#ff007f",
        icon: "fa-shield-alt",
        adminOnly: false
    },
    {
        id: "klapsenkind",
        name: "Klapsenkind 437",
        buff: "Chaos-Multiplier x2.5 // Unvorhersehbare Psychose",
        color: "#ff5500",
        icon: "fa-bolt",
        adminOnly: false
    },
    {
        id: "amnesia_overclock",
        name: "Amnesia-Ultrafan",
        buff: "Cyber-Stimme",
        color: "#00f0ff",
        icon: "fa-microchip",
        adminOnly: false
    },
    {
        id: "synth_syndicate",
        name: "Synth-Syndikat",
        buff: "Audio-Qualität Ultra-HD // Master-Bass +20%",
        color: "#a855f7",
        icon: "fa-sliders-h",
        adminOnly: false
    },
    {
        id: "darknet_ghost",
        name: "Darknet-Phantom",
        buff: "Unsichtbarer Online-Status // Stealth-Protokoll",
        color: "#10b981",
        icon: "fa-user-ninja",
        adminOnly: false
    },
    {
        id: "root_privilege",
        name: "ROOT-Privileg",
        buff: "Die Psychose",
        color: "#ff0055",
        icon: "fa-terminal",
        adminOnly: true
    },
    {
        id: "root_matrix_overclock",
        name: "Casino Boss",
        buff: "Casino-Glücks-Overdrive // Stufe 10 Belohnung",
        color: "#ffd700",
        icon: "fa-crown",
        adminOnly: false
    }
];

const ACHIEVEMENTS_LIST = {
    hacker_init: {
        title: "Matrix-Novize",
        desc: "Nutze das Terminal-Easter-Egg '437'.",
        icon: "fa-terminal",
        color: "#00f0ff"
    },
    beat_producer: {
        title: "Sound-Magnat",
        desc: "Erreiche 1.000 Beats im Clicker.",
        icon: "fa-music",
        color: "#ff007f"
    },
    beat_tycoon: {
        title: "Krypto-Baron",
        desc: "Sammle deine ersten Amnesia-Coins.",
        icon: "fa-coins",
        color: "#ffd700"
    },
    forum_pioneer: {
        title: "Netzwerk-Pionier",
        desc: "Erstelle deinen ersten Forenbeitrag.",
        icon: "fa-comments",
        color: "#00ff66"
    },
    quote_hunter: {
        title: "Insider-Kenner",
        desc: "Klicke auf ein Insider-Zitat in der Matrix.",
        icon: "fa-cannabis",
        color: "#00ff66"
    },
    sound_addict: {
        title: "Amnesia-Jünger",
        desc: "Höre dir einen Song von Amnesia437 an.",
        icon: "fa-headphones-alt",
        color: "#a855f7"
    },
    channel_chatter: {
        title: "Netzwerk-Funker",
        desc: "Schreibe deine erste Nachricht in einem Channel.",
        icon: "fa-broadcast-tower",
        color: "#00f0ff"
    },
    highroller_bronze: {
        title: "Highroller-Protokoll",
        desc: "Knacke die halbe Million Chips (500k).",
        icon: "fa-dice",
        color: "#cd7f32"
    },
    cyber_tycoon: {
        title: "Cyber-Tycoon",
        desc: "Erreiche 1.000.000 Chips in der Matrix.",
        icon: "fa-chart-line",
        color: "#c0c0c0"
    },
    casino_imperator: {
        title: "Casino-Imperator",
        desc: "Spreng die Bank mit 10.000.000 Chips.",
        icon: "fa-crown",
        color: "#ffd700"
    }
};

try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseClient;
    } else {
        console.error("437 STUDIO: Supabase SDK fehlt. Lade supabase-js vor app.js.");
    }
} catch (error) {
    console.error("437 STUDIO: Supabase-Initialisierung fehlgeschlagen.", error);
}

document.addEventListener("DOMContentLoaded", () => {
    const badge = document.getElementById("dropdown-msg-badge");
    if (badge) {
        if (localStorage.getItem("437_has_unread") === "true") {
            badge.classList.remove("hidden");
        } else {
            badge.classList.add("hidden");
        }
    }
    initialize437Studio();
    injectPushSettingsModalDOM(); // Garantiert, dass das Modal immer vorhanden ist
});

// ========================================================================
// 2. INITIALISIERUNG & HELPER-FUNKTIONEN
// ========================================================================

function initialize437Studio() {
    checkActiveSession();
    updateNavbarAuthUI();
    checkGlobalMaintenanceState();
    injectGlobalTickerBar();
    initMobileMenuToggle();
    initGlobalMessageListener();
    initProfileDropdownEvents();
    registerServiceWorkerForPush();
    checkUnreadMessagesOnLoad();
    checkUserTimeoutState();

    // Globale Aktivitäts-Überwachung (Heartbeat alle 30 Sek. für Online-Status auf allen Seiten)
    updateMyOnlineActivity();
    setInterval(() => {
        updateMyOnlineActivity();
    }, 30000);
}

async function updateMyOnlineActivity() {
    if (!supabaseClient || !currentUser || !currentUser.username) return;
    try {
        await supabaseClient
            .from("users")
            .update({ last_active_at: new Date().toISOString() })
            .ilike("username", currentUser.username);
    } catch (e) {
        // Stille im Hintergrund halten
    }
}

function showMessageBadge() {
    localStorage.setItem("437_has_unread", "true");
    const badge = document.getElementById("dropdown-msg-badge");
    if (badge) badge.classList.remove("hidden");
}

function clearMessageBadge() {
    localStorage.removeItem("437_has_unread");
    localStorage.setItem("437_badge_cleared", Date.now().toString());

    const badge = document.getElementById("dropdown-msg-badge");
    if (badge) badge.classList.add("hidden");
}

window.addEventListener("storage", (event) => {
    if (event.key === "437_badge_cleared" || (event.key === "437_has_unread" && event.newValue === null)) {
        const badge = document.getElementById("dropdown-msg-badge");
        if (badge) badge.classList.add("hidden");
    }
});

async function checkUnreadMessagesOnLoad() {
    if (!supabaseClient || !currentUser || !currentUser.username) return;

    if (localStorage.getItem("437_has_unread") === null) {
        const badge = document.getElementById("dropdown-msg-badge");
        if (badge) badge.classList.add("hidden");
        return;
    }

    try {
        const { count, error } = await supabaseClient
            .from("private_messages")
            .select("*", { count: "exact", head: true })
            .eq("recipient", currentUser.username);

        if (!error && count > 0 && localStorage.getItem("437_has_unread") === "true") {
            showMessageBadge();
        } else {
            clearMessageBadge();
        }
    } catch (e) {
        console.error("Fehler beim Prüfen der ungelesenen Nachrichten:", e);
    }
}

function getElement(id) {
    return document.getElementById(id);
}

function setHidden(element, hidden) {
    if (element) {
        element.classList.toggle("hidden", Boolean(hidden));
    }
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function normalizeUsername(username) {
    return String(username || "").trim().toLowerCase();
}

function isAdmin(userObj = currentUser) {
    if (!userObj || !userObj.username) return false;
    return (
        ADMIN_NAMES.includes(normalizeUsername(userObj.username)) ||
        userObj.is_admin === true
    );
}

function getSafeAvatar(avatar) {
    if (
        typeof avatar === "string" &&
        /^(https:\/\/|data:image\/(?:png|jpeg|jpg|webp|gif);base64,)/i.test(avatar)
    ) {
        return avatar;
    }
    return DEFAULT_AVATAR;
}

// ========================================================================
// 3. ECHTZEIT-PRÜFUNG: BAN, TIMEOUT & SPERR-BLOCKER
// ========================================================================

async function checkUserCanSend() {
    const sessionStr = localStorage.getItem("437_session");
    if (!sessionStr) {
        alert("🔒 Du musst eingeloggt sein!");
        return false;
    }

    const localUser = JSON.parse(sessionStr);

    try {
        if (typeof supabaseClient !== "undefined" && supabaseClient) {
            const { data: user, error } = await supabaseClient
                .from("users")
                .select("*")
                .ilike("username", localUser.username)
                .maybeSingle();

            if (!error && user) {
                if (user.banned === true) {
                    alert("🚨 Dein Account wurde permanent gesperrt.");
                    return false;
                }

                if (user.timeout_until) {
                    const timeoutDate = new Date(user.timeout_until);
                    const now = new Date();
                    if (timeoutDate > now) {
                        const remainingMin = Math.ceil((timeoutDate - now) / 60000);
                        alert(`⏱️ Du stehst unter einem aktiven Timeout! Du kannst erst in ${remainingMin} Minute(n) wieder schreiben.`);
                        return false;
                    }
                }

                if (user.chat_muted === true) {
                    alert("🔇 Du wurdest für den Chat stummgeschaltet.");
                    return false;
                }
            }
        }
    } catch (err) {
        console.warn("Fehler bei der Berechtigungsprüfung:", err);
    }

    return true;
}

let cachedTimeoutReason = null;

async function checkUserTimeoutState() {
    if (!supabaseClient || !currentUser) return;

    try {
        const { data: user, error } = await supabaseClient
            .from("users")
            .select("*")
            .ilike("username", currentUser.username)
            .maybeSingle();

        if (error || !user) return;

        let isTimedOut = false;
        let remainingMin = 0;

        if (user.timeout_until) {
            const timeoutDate = new Date(user.timeout_until);
            const now = new Date();
            if (timeoutDate > now) {
                isTimedOut = true;
                remainingMin = Math.ceil((timeoutDate - now) / 60000);
            }
        }

        if (user.banned === true || user.chat_muted === true || isTimedOut) {
            cachedTimeoutReason = user.banned 
                ? "Dein Account wurde permanent gesperrt." 
                : (user.chat_muted ? "Du wurdest im Chat stummgeschaltet." : `Aktiver Timeout! Noch ca. ${remainingMin} Minute(n).`);
            
            applyTimeoutBlockers(cachedTimeoutReason);
            initTimeoutObserver();
        }
    } catch (err) {
        console.warn("Fehler bei der Timeout-Prüfung:", err);
    }
}

function applyTimeoutBlockers(reasonMessage) {
    if (!reasonMessage) return;

    const msgInputArea = document.querySelector(".msg-container") || document.querySelector("form[onsubmit*='SendPrivateMessage']");
    if (msgInputArea && !document.getElementById("timeout-msg-blocker")) {
        if (getComputedStyle(msgInputArea).position === "static") {
            msgInputArea.style.position = "relative";
        }
        const overlay = document.createElement("div");
        overlay.id = "timeout-msg-blocker";
        overlay.className = "cyber-timeout-overlay";
        overlay.innerHTML = `
            <i class="fas fa-clock lock-icon" style="font-size: 38px; color: #ff5500; margin-bottom: 12px;"></i>
            <div style="color: #ff5500; font-weight: 900; font-size: 15px; letter-spacing: 2px; margin-bottom: 8px; text-transform: uppercase;">ÜBERTRAGUNG GESPERRT</div>
            <div style="color: #d0b8b8; font-size: 11px; max-width: 280px; line-height: 1.5;">${escapeHTML(reasonMessage)}</div>
        `;
        msgInputArea.appendChild(overlay);
    }

    const forumHeaderBox = document.querySelector("main > div:first-child");
    if (forumHeaderBox && !document.getElementById("timeout-forum-banner")) {
        if (getComputedStyle(forumHeaderBox).position === "static") {
            forumHeaderBox.style.position = "relative";
        }
        const bannerOverlay = document.createElement("div");
        bannerOverlay.id = "timeout-forum-banner";
        bannerOverlay.className = "cyber-timeout-overlay";
        bannerOverlay.style.padding = "20px";
        bannerOverlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px; justify-content: center; width: 100%;">
                <i class="fas fa-clock" style="font-size: 28px; color: #ff5500; flex-shrink: 0;"></i>
                <div style="text-align: left;">
                    <div style="color: #ff5500; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Foren-Beiträge gesperrt</div>
                    <div style="color: #ccc; font-size: 11px; margin-top: 2px;">${escapeHTML(reasonMessage)}</div>
                </div>
            </div>
        `;
        forumHeaderBox.appendChild(bannerOverlay);
    }

    document.querySelectorAll("form[onsubmit*='handleReplySubmit']").forEach(form => {
        if (!form.querySelector(".cyber-timeout-overlay")) {
            if (getComputedStyle(form).position === "static") {
                form.style.position = "relative";
            }
            const overlay = document.createElement("div");
            overlay.className = "cyber-timeout-overlay";
            overlay.style.padding = "15px";
            overlay.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; justify-content: center; width: 100%;">
                    <i class="fas fa-clock" style="font-size: 20px; color: #ff5500; flex-shrink: 0;"></i>
                    <div style="text-align: left;">
                        <div style="color: #ff5500; font-weight: bold; font-size: 11px; text-transform: uppercase;">Antworten gesperrt</div>
                        <div style="color: #aaa; font-size: 10px;">${escapeHTML(reasonMessage)}</div>
                    </div>
                </div>
            `;
            form.innerHTML = "";
            form.appendChild(overlay);
        }
    });
}

function initTimeoutObserver() {
    if (window._timeoutObserverInitialized) return;
    window._timeoutObserverInitialized = true;

    const observer = new MutationObserver(() => {
        if (cachedTimeoutReason) {
            applyTimeoutBlockers(cachedTimeoutReason);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// ========================================================================
// 4. MOBILE NAVIGATION & SESSION
// ========================================================================

function initMobileMenuToggle() {
    const toggleButton = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");

    if (!toggleButton || !navLinks) return;

    toggleButton.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("active");
        toggleButton.setAttribute("aria-expanded", String(isOpen));
    });
}

function checkActiveSession() {
    try {
        const sessionData = localStorage.getItem("437_session");

        if (!sessionData) {
            currentUser = null;
            return;
        }

        const parsedUser = JSON.parse(sessionData);

        if (!parsedUser || typeof parsedUser !== "object" || !parsedUser.username) {
            localStorage.removeItem("437_session");
            currentUser = null;
            return;
        }

        currentUser = parsedUser;
    } catch (error) {
        console.warn("437 STUDIO: Ungültige lokale Sitzung.", error);
        localStorage.removeItem("437_session");
        currentUser = null;
    }
}

function saveLocalSession() {
    if (!currentUser) {
        localStorage.removeItem("437_session");
        return;
    }
    localStorage.setItem("437_session", JSON.stringify(currentUser));
}

function updateNavbarAuthUI() {
    const loggedOutZone = getElement("logged-out-zone");
    const loggedInZone = getElement("logged-in-zone");
    const navAvatar = getElement("nav-avatar");
    const navUsername = getElement("nav-username");
    const adminBadge = getElement("admin-badge");
    const dropdown = getElement("profile-dropdown");

    if (currentUser) {
        setHidden(loggedOutZone, true);
        setHidden(loggedInZone, false);

        if (navAvatar) {
            navAvatar.src = getSafeAvatar(currentUser.avatar);
            navAvatar.alt = "Profilbild von " + currentUser.username;
            navAvatar.onerror = () => {
                navAvatar.onerror = null;
                navAvatar.src = DEFAULT_AVATAR;
            };
        }

        if (navUsername) {
            navUsername.textContent = currentUser.username;
        }

        if (adminBadge) {
            setHidden(adminBadge, !isAdmin());
        }

        if (dropdown) {
            buildProfileDropdown();
        }
    } else {
        setHidden(loggedOutZone, false);
        setHidden(loggedInZone, true);
        setHidden(dropdown, true);

        if (adminBadge) {
            setHidden(adminBadge, true);
        }
    }
}

// ========================================================================
// 5. PROFIL-DROPDOWN
// ========================================================================

function buildProfileDropdown() {
    const dropdown = getElement("profile-dropdown");
    if (!dropdown || !currentUser) return;

    dropdown.innerHTML = `
        <a href="profile.html?user=${encodeURIComponent(currentUser.username)}" onclick="sessionStorage.removeItem('437_view_profile')">
            <i class="fas fa-user-cog"></i>
            <span>Profil Matrix</span>
        </a>

        <a href="messages.html" class="profile-dropdown-messages" style="display: flex; align-items: center; justify-content: space-between;">
            <span style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-envelope"></i>
                <span>Nachrichten</span>
            </span>
            <span id="dropdown-msg-badge" class="hidden" style="width: 8px; height: 8px; background: #ff0055; border-radius: 50%; box-shadow: 0 0 6px #ff0055;"></span>
        </a>

        <!-- Button zum Öffnen des Push-Modals im Dropdown -->
        <a href="#" onclick="openPushSettingsModal(); return false;" style="display: flex; align-items: center; gap: 8px; color: var(--neon-blue);">
            <i class="fas fa-bell"></i>
            <span>Push-Einstellungen</span>
        </a>

        ${isAdmin() ? `
            <a href="admin.html" class="profile-dropdown-admin">
                <i class="fas fa-shield-alt"></i>
                <span>Control Panel</span>
            </a>
        ` : ""}

        <hr>

        <a href="#" id="profile-logout-link" class="profile-dropdown-logout" onclick="handleLogout(); return false;">
            <i class="fas fa-sign-out-alt"></i>
            <span>Logout</span>
        </a>
    `;
}

function getProfileDropdownAnchor() {
    return (
        getElement("nav-avatar") ||
        getElement("nav-username") ||
        document.querySelector(".profile-toggle") ||
        getElement("logged-in-zone")
    );
}

function positionProfileDropdown() {
    const dropdown = getElement("profile-dropdown");
    const anchor = getProfileDropdownAnchor();

    if (!dropdown || !anchor || !currentUser) return;

    dropdown.classList.remove("hidden");

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const margin = 12;
    const gap = 8;

    const menuWidth = Math.max(1, Math.min(260, viewportWidth - margin * 2));

    dropdown.style.width = `${menuWidth}px`;
    dropdown.style.left = "0px";
    dropdown.style.top = "0px";
    dropdown.style.right = "auto";
    dropdown.style.bottom = "auto";

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = dropdown.getBoundingClientRect();
    const menuHeight = menuRect.height;

    let left = anchorRect.right - menuWidth;
    left = Math.max(margin, Math.min(left, viewportWidth - menuWidth - margin));

    let top = anchorRect.bottom + gap;
    if (top + menuHeight > viewportHeight - margin) {
        const topCandidate = anchorRect.top - menuHeight - gap;
        if (topCandidate >= margin) {
            top = topCandidate;
        } else {
            top = Math.max(margin, viewportHeight - menuHeight - margin);
        }
    }

    top = Math.max(margin, Math.min(top, Math.max(margin, viewportHeight - menuHeight - margin)));

    dropdown.style.left = `${left}px`;
    dropdown.style.top = `${top}px`;
    dropdown.style.right = "auto";
    dropdown.style.bottom = "auto";
}

function toggleProfileDropdown(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const dropdown = getElement("profile-dropdown");
    if (!dropdown || !currentUser) return;

    if (!dropdown.innerHTML.trim()) {
        buildProfileDropdown();
    }

    const isCurrentlyOpen = !dropdown.classList.contains("hidden");

    if (isCurrentlyOpen) {
        dropdown.classList.add("hidden");
        return;
    }

    positionProfileDropdown();
}

function closeProfileDropdown() {
    const dropdown = getElement("profile-dropdown");
    if (dropdown) {
        dropdown.classList.add("hidden");
    }
}

function initProfileDropdownEvents() {
    document.addEventListener("click", event => {
        const dropdown = getElement("profile-dropdown");
        const loggedInZone = getElement("logged-in-zone");

        if (!dropdown || dropdown.classList.contains("hidden")) return;

        if (
            dropdown.contains(event.target) ||
            (loggedInZone && loggedInZone.contains(event.target))
        ) {
            return;
        }

        closeProfileDropdown();
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeProfileDropdown();
        }
    });

    window.addEventListener("resize", () => {
        const dropdown = getElement("profile-dropdown");
        if (dropdown && !dropdown.classList.contains("hidden")) {
            positionProfileDropdown();
        }
    });

    window.addEventListener("scroll", () => {
        const dropdown = getElement("profile-dropdown");
        if (dropdown && !dropdown.classList.contains("hidden")) {
            positionProfileDropdown();
        }
    }, true);
}

// ========================================================================
// 6. LOGOUT
// ========================================================================

function handleLogout() {
    closeProfileDropdown();

    if (messageSubscription && supabaseClient) {
        supabaseClient.removeChannel(messageSubscription);
        messageSubscription = null;
    }

    currentUser = null;
    localStorage.removeItem("437_session");
    localStorage.removeItem("437_has_unread");

    window.location.href = "index.html";
}

function redirectToLogin() {
    openAuthModal("login");
}

// ========================================================================
// 7. LOGIN & REGISTRIERUNG
// ========================================================================

function openAuthModal(type) {
    let modal = getElement("auth-modal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "auth-modal";
        modal.className = "modal";
        document.body.appendChild(modal);
    }

    const isLogin = type === "login";

    modal.innerHTML = `
        <div class="modal-content">
            <button type="button" class="close-btn" id="auth-modal-close" aria-label="Schließen">&times;</button>
            <h2>${isLogin ? "🔑 Studio Login" : "⚡ Registrierung"}</h2>
            <form id="auth-form">
                <div class="input-group">
                    <label for="auth-username">Benutzername</label>
                    <input type="text" id="auth-username" required minlength="3" maxlength="32" autocomplete="username">
                </div>
                <div class="input-group">
                    <label for="auth-password">Passwort</label>
                    <input type="password" id="auth-password" required minlength="8" autocomplete="${isLogin ? "current-password" : "new-password"}">
                </div>
                <p id="auth-error" role="alert" style="color:#ff5577;font-size:13px;"></p>
                <button type="submit" class="btn btn-neon-green full-width" id="auth-submit" style="margin-top:10px;">
                    ${isLogin ? "Einloggen" : "Account erstellen"}
                </button>
            </form>
            <div style="text-align:center;margin-top:15px;font-size:12px;color:#888;">
                ${isLogin
                    ? `Noch keinen Account? <a href="#" id="auth-switch" style="color:#00f0ff;">Registrieren</a>`
                    : `Bereits registriert? <a href="#" id="auth-switch" style="color:#00f0ff;">Login</a>`
                }
            </div>
        </div>
    `;

    modal.classList.remove("hidden");

    getElement("auth-modal-close").addEventListener("click", () => modal.remove());

    getElement("auth-switch").addEventListener("click", event => {
        event.preventDefault();
        openAuthModal(isLogin ? "register" : "login");
    });

    getElement("auth-form").addEventListener("submit", event => {
        if (isLogin) {
            submitLogin(event);
        } else {
            submitRegister(event);
        }
    });
}

function setAuthError(message) {
    const errorElement = getElement("auth-error");
    if (errorElement) {
        errorElement.textContent = message;
    } else {
        alert(message);
    }
}

function setAuthLoading(loading) {
    const button = getElement("auth-submit");
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "Bitte warten..." : button.dataset.originalText;
}

async function submitLogin(event) {
    event.preventDefault();

    if (!supabaseClient) {
        setAuthError("Supabase ist nicht verfügbar.");
        return;
    }

    const username = getElement("auth-username").value.trim();
    const password = getElement("auth-password").value;
    const button = getElement("auth-submit");

    if (button) {
        button.dataset.originalText = button.textContent;
    }

    setAuthLoading(true);

    try {
        const { data, error } = await supabaseClient
            .from("users")
            .select("*")
            .ilike("username", username)
            .maybeSingle();

        if (error) {
            console.error("Login-Datenbankfehler:", error);
            setAuthError("Login fehlgeschlagen. Bitte versuche es erneut.");
            return;
        }

        if (!data) {
            setAuthError("Benutzer nicht gefunden.");
            return;
        }

        if (data.banned === true) {
            setAuthError("Dieser Account wurde gesperrt.");
            return;
        }

        if (data.password !== password) {
            setAuthError("Falsches Passwort.");
            return;
        }

        currentUser = data;
        saveLocalSession();

        if (typeof initGlobalMessageListener === "function") {
            initGlobalMessageListener();
        }

        const modal = getElement("auth-modal");
        if (modal) modal.remove();

        updateNavbarAuthUI();
        window.location.reload();
    } catch (error) {
        console.error("Unerwarteter Login-Fehler:", error);
        setAuthError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
        setAuthLoading(false);
    }
}

async function submitRegister(event) {
    event.preventDefault();

    if (!supabaseClient) {
        setAuthError("Supabase ist nicht verfügbar.");
        return;
    }

    const username = getElement("auth-username").value.trim();
    const password = getElement("auth-password").value;
    const button = getElement("auth-submit");

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
        setAuthError("Der Benutzername muss 3–32 Zeichen lang sein und darf nur Buchstaben, Zahlen und _ enthalten.");
        return;
    }

    if (password.length < 8) {
        setAuthError("Das Passwort muss mindestens 8 Zeichen lang sein.");
        return;
    }

    if (button) {
        button.dataset.originalText = button.textContent;
    }

    setAuthLoading(true);

    try {
        const { data: existing, error: lookupError } = await supabaseClient
            .from("users")
            .select("username")
            .ilike("username", username)
            .limit(1);

        if (lookupError) {
            console.error("Registrierungsprüfung fehlgeschlagen:", lookupError);
            setAuthError("Benutzername konnte nicht überprüft werden.");
            return;
        }

        if (existing && existing.length > 0) {
            setAuthError("Dieser Benutzername ist bereits vergeben.");
            return;
        }

        const newUser = {
            username,
            password,
            avatar: DEFAULT_AVATAR,
            harvest_coins: 0,
            clk_coins: 0,
            coins: 0,
            banned: false,
            achievements: [],
            cyber_char: {
                enabled: false,
                slots: ["", "", ""]
            }
        };

        const { data, error } = await supabaseClient
            .from("users")
            .insert([newUser])
            .select("*")
            .single();

        if (error) {
            console.error("Registrierung fehlgeschlagen:", error);
            setAuthError("Registrierung fehlgeschlagen. Prüfe die Supabase-Berechtigungen.");
            return;
        }

        currentUser = data || newUser;
        saveLocalSession();

        const modal = getElement("auth-modal");
        if (modal) modal.remove();

        updateNavbarAuthUI();
        initGlobalMessageListener();

        window.location.reload();
    } catch (error) {
        console.error("Unerwarteter Registrierungsfehler:", error);
        setAuthError("Verbindungsfehler. Bitte versuche es erneut.");
    } finally {
        setAuthLoading(false);
    }
}

// ========================================================================
// 8. WARTUNGSMODUS & ROBUSTE CYBER-BLOCKER
// ========================================================================

let isGlobalMaintenanceActive = false;

async function checkGlobalMaintenanceState() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from("maintenance")
            .select("active")
            .eq("id", 1)
            .maybeSingle();

        if (error) {
            console.warn("Wartungsstatus konnte nicht geladen werden:", error);
            return;
        }

        if (data && data.active === true) {
            isGlobalMaintenanceActive = true;
            document.body.classList.add("maintenance-active");
            prependMaintenanceBanner();
            applyMaintenanceBlockers();
        } else {
            isGlobalMaintenanceActive = false;
            document.body.classList.remove("maintenance-active");
            getElement("maintenance-alert-banner")?.remove();
            removeMaintenanceBlockers();
        }
    } catch (error) {
        console.warn("Wartungsprüfung fehlgeschlagen:", error);
    }
}

function prependMaintenanceBanner() {
    if (getElement("maintenance-alert-banner")) return;

    const banner = document.createElement("div");
    banner.id = "maintenance-alert-banner";
    banner.className = "maintenance-alert-banner";

    banner.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>ACHTUNG: WARTUNGSMODUS AKTIV – SYSTEME WERDEN GEUPGRADET</span>
        <i class="fas fa-exclamation-triangle"></i>
    `;

    document.body.prepend(banner);
}

function applyMaintenanceBlockers() {
    if (!document.getElementById("cyber-maintenance-blocker-styles")) {
        const style = document.createElement("style");
        style.id = "cyber-maintenance-blocker-styles";
        style.textContent = `
            @keyframes maintenanceGlowPulse {
                0%, 100% { border-color: #ff007f; box-shadow: 0 0 30px rgba(255, 0, 127, 0.4), inset 0 0 20px rgba(255, 0, 127, 0.2); }
                50% { border-color: #00f0ff; box-shadow: 0 0 40px rgba(0, 240, 255, 0.6), inset 0 0 30px rgba(0, 240, 255, 0.3); }
            }
            @keyframes iconFloat {
                0%, 100% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 10px #ff0055); }
                50% { transform: translateY(-5px) scale(1.1); filter: drop-shadow(0 0 20px #00f0ff); }
            }
            .cyber-maintenance-overlay {
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(8, 8, 18, 0.98) 0%, rgba(15, 10, 32, 0.96) 100%);
                backdrop-filter: blur(12px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 100;
                border-radius: 8px;
                border: 2px solid #ff007f;
                animation: maintenanceGlowPulse 4s infinite ease-in-out;
                text-align: center;
                padding: 30px;
                font-family: monospace;
                box-sizing: border-box;
            }
            .cyber-maintenance-overlay i.lock-icon {
                font-size: 46px;
                color: #ff0055;
                margin-bottom: 16px;
                animation: iconFloat 2.5s infinite ease-in-out;
            }
            .cyber-maintenance-title {
                background: linear-gradient(90deg, #ff007f, #00f0ff, #ff007f);
                background-size: 200% auto;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-weight: 900;
                font-size: 17px;
                letter-spacing: 2px;
                margin-bottom: 10px;
                text-transform: uppercase;
            }
            .cyber-maintenance-desc {
                color: #b8b8d0;
                font-size: 11.5px;
                max-width: 310px;
                line-height: 1.6;
                border-top: 1px dashed rgba(255, 0, 127, 0.35);
                border-bottom: 1px dashed rgba(0, 240, 255, 0.35);
                padding: 12px 0;
                margin-bottom: 15px;
            }
            .cyber-maintenance-badge {
                font-size: 9.5px;
                background: rgba(0, 240, 255, 0.1);
                color: #00f0ff;
                padding: 5px 12px;
                border-radius: 4px;
                border: 1px solid rgba(0, 240, 255, 0.3);
                letter-spacing: 1.5px;
                text-transform: uppercase;
            }
        `;
        document.head.appendChild(style);
    }

    const msgContainer = document.querySelector(".msg-container");
    if (msgContainer) {
        const msgCardRight = msgContainer.querySelector(".msg-grid .msg-card:nth-child(2)");
        if (msgCardRight && !document.getElementById("maintenance-msg-blocker")) {
            const overlay = document.createElement("div");
            overlay.id = "maintenance-msg-blocker";
            overlay.className = "cyber-maintenance-overlay";
            overlay.innerHTML = `
                <i class="fas fa-lock lock-icon"></i>
                <div class="cyber-maintenance-title">ÜBERTRAGUNG GESPERRT</div>
                <div class="cyber-maintenance-desc">Wegen aktiver System-Wartungsarbeiten ist das Senden von Nachrichten und Channel-Postings vorübergehend verschlüsselt und deaktiviert.</div>
                <div class="cyber-maintenance-badge"><i class="fas fa-shield-alt"></i> Sicherheitsstufe ROOT</div>
            `;
            if (getComputedStyle(msgCardRight).position === "static") {
                msgCardRight.style.position = "relative";
            }
            msgCardRight.appendChild(overlay);
        }
    }

    const forumContainer = document.getElementById("forum-threads-container");
    if (forumContainer) {
        const forumHeaderBtn = document.querySelector("main button[onclick*='openCreateDiscussionModal']");
        if (forumHeaderBtn) {
            forumHeaderBtn.disabled = true;
            forumHeaderBtn.style.opacity = "0.35";
            forumHeaderBtn.style.cursor = "not-allowed";
            forumHeaderBtn.title = "Wegen Wartungsarbeiten gesperrt";
            forumHeaderBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (typeof showCyberAlert === "function") {
                    showCyberAlert("System gesperrt", "🔒 Wartungsmodus aktiv: Das Erstellen neuer Diskussionen ist gesperrt.", "danger");
                } else {
                    alert("🔒 Wartungsmodus aktiv: Das Erstellen neuer Diskussionen ist gesperrt.");
                }
            };
        }

        const forumHeaderContainer = document.querySelector("main > div:first-child");
        if (forumHeaderContainer && !document.getElementById("maintenance-forum-notice")) {
            const notice = document.createElement("div");
            notice.id = "maintenance-forum-notice";
            notice.style.cssText = `
                margin-top: 15px;
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
                background: linear-gradient(135deg, rgba(8, 8, 18, 0.95) 0%, rgba(15, 10, 32, 0.95) 100%);
                border: 2px solid #ff007f;
                box-shadow: 0 0 25px rgba(255, 0, 127, 0.3);
                padding: 12px 16px;
                border-radius: 8px;
                color: #fff;
                font-family: monospace;
                display: flex;
                align-items: center;
                gap: 12px;
                overflow: hidden;
            `;
            notice.innerHTML = `
                <i class="fas fa-lock" style="font-size: 24px; color: #ff0055; animation: iconFloat 2s infinite ease-in-out;"></i>
                <div>
                    <div style="color: #ff007f; font-weight: bold; font-size: 13px; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 1px;">Foren-Postings vorübergehend gesperrt</div>
                    <div style="color: #aaa; font-size: 11px;">Wegen aktiver System-Wartungsarbeiten können derzeit keine neuen Diskussionen gestartet werden. Bestehende Beiträge bleiben lesbar.</div>
                </div>
            `;
            forumHeaderContainer.appendChild(notice);
        }

        document.getElementById("create-discussion-modal")?.remove();
    }
}

function removeMaintenanceBlockers() {
    document.getElementById("maintenance-msg-blocker")?.remove();
    document.getElementById("maintenance-forum-notice")?.remove();

    const forumHeaderBtn = document.querySelector("main button[onclick*='openCreateDiscussionModal']");
    if (forumHeaderBtn) {
        forumHeaderBtn.disabled = false;
        forumHeaderBtn.style.opacity = "1";
        forumHeaderBtn.style.cursor = "pointer";
        forumHeaderBtn.title = "";
        forumHeaderBtn.onclick = () => openCreateDiscussionModal();
    }
}

// ========================================================================
// 9. GLOBALER TICKER
// ========================================================================

function injectGlobalTickerBar() {
    const point = getElement("ticker-insertion-point");

    if (!point) return;

    point.innerHTML = `
        <div class="studio-global-ticker">
            <div class="studio-global-ticker-track">
                ⚡ 437 STUDIO NETZWERK ONLINE
                &nbsp;//&nbsp; 437 TEAM
                &nbsp;//&nbsp; NUTZE DAS TERMINAL FÜR GEHEIME BEFEHLE
                &nbsp;//&nbsp;
            </div>
        </div>
    `;

    if (!getElement("studio-ticker-style")) {
        const style = document.createElement("style");
        style.id = "studio-ticker-style";

        style.textContent = `
            .studio-global-ticker {
                background: #030308;
                border-bottom: 1px solid #111;
                padding: 6px 0;
                overflow: hidden;
                white-space: nowrap;
                font-family: monospace;
                font-size: 12px;
                color: #00f0ff;
            }

            .studio-global-ticker-track {
                display: inline-block;
                animation: studioTickerScroll 25s linear infinite;
            }

            @keyframes studioTickerScroll {
                from { transform: translateX(100vw); }
                to { transform: translateX(-100%); }
            }

            @media (prefers-reduced-motion: reduce) {
                .studio-global-ticker-track {
                    animation: none;
                }
            }
        `;

        document.head.appendChild(style);
    }
}

// ========================================================================
// 10. ACHIEVEMENTS
// ========================================================================

async function unlockAchievement(key) {
    if (!currentUser || !ACHIEVEMENTS_LIST[key]) return;

    if (!Array.isArray(currentUser.achievements)) {
        currentUser.achievements = [];
    }

    if (currentUser.achievements.includes(key)) return;

    const updatedAchievements = [...currentUser.achievements, key];

    if (supabaseClient) {
        const { error } = await supabaseClient
            .from("users")
            .update({ achievements: updatedAchievements })
            .eq("username", currentUser.username);

        if (error) {
            console.error("Achievement konnte nicht gespeichert werden:", error);
            return;
        }
    }

    currentUser.achievements = updatedAchievements;
    saveLocalSession();

    showAchievementToast(ACHIEVEMENTS_LIST[key]);
}

function showAchievementToast(achievement) {
    const toast = document.createElement("div");

    toast.style.cssText = `
        position:fixed;
        bottom:20px;
        right:20px;
        max-width:calc(100vw - 40px);
        background:#0c0c18;
        border:2px solid ${achievement.color};
        box-shadow:0 0 20px ${achievement.color};
        padding:15px 20px;
        border-radius:8px;
        z-index:2147483647;
        display:flex;
        align-items:center;
        gap:15px;
        box-sizing:border-box;
        font-family:monospace;
    `;

    const icon = document.createElement("i");
    icon.className = `fas ${achievement.icon}`;
    icon.style.cssText = `font-size:28px;color:${achievement.color};flex-shrink:0;`;

    const content = document.createElement("div");

    const label = document.createElement("div");
    label.textContent = "Erfolgreich freigeschaltet!";
    label.style.cssText = "font-size:10px;color:#888;text-transform:uppercase;";

    const title = document.createElement("div");
    title.textContent = achievement.title;
    title.style.cssText = "color:#fff;font-weight:bold;font-size:14px;";

    const description = document.createElement("div");
    description.textContent = achievement.desc;
    description.style.cssText = "color:#aaa;font-size:11px;";

    content.append(label, title, description);
    toast.append(icon, content);
    document.body.appendChild(toast);

    window.setTimeout(() => toast.remove(), 4500);
}

// ========================================================================
// 11. PROFILBEARBEITUNG & AVATAR
// ========================================================================

let tempNewAvatarData = DEFAULT_AVATAR;

function previewGalleryImage(event) {
    const file = event?.target?.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Bitte wähle eine Bilddatei aus.");
        event.target.value = "";
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert("Die Bilddatei ist zu groß. Maximal 2 MB erlaubt.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = loadEvent => {
        tempNewAvatarData = loadEvent.target.result;
        const preview = getElement("page-avatar-preview");
        if (preview) {
            preview.src = tempNewAvatarData;
            preview.style.display = "inline-block";
        }
        const heroAvatar = getElement("main-profile-hero-avatar");
        if (heroAvatar) {
            heroAvatar.src = tempNewAvatarData;
        }
    };

    reader.onerror = () => {
        alert("Das Bild konnte nicht geladen werden.");
    };

    reader.readAsDataURL(file);
}

function populatePerkSelectDropdowns() {
    [1, 2, 3].forEach(number => {
        const select = getElement(`perk-slot-${number}`);
        if (!select) return;

        const previousValue = select.value;
        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "-- Wähle 437-Perk --";
        placeholder.style.color = "#888";
        select.appendChild(placeholder);

        CYBER_PERKS_POOL.forEach(perk => {
            if (perk.adminOnly && !isAdmin()) return;

            const option = document.createElement("option");
            option.value = perk.id;
            option.textContent = `${perk.name} [${perk.buff}]`;
            option.style.color = perk.color;
            option.style.background = "#080812";
            select.appendChild(option);
        });

        if ([...select.options].some(opt => opt.value === previousValue)) {
            select.value = previousValue;
        }
    });
}

function updateCharCardPreview() {
    const display = getElement("char-card-display");
    if (!display) return;

    const selectedPerks = [1, 2, 3].map(number => {
        const select = getElement(`perk-slot-${number}`);
        const value = select ? select.value : "";
        return CYBER_PERKS_POOL.find(p => p.id === value) || null;
    });

    const card = document.createElement("div");
    card.style.cssText = `
        background: #04040a;
        border: 1px solid #00f0ff;
        box-shadow: 0 0 15px rgba(0, 240, 255, 0.15);
        padding: 16px;
        border-radius: 8px;
        margin-top: 15px;
        font-family: monospace;
    `;

    const heading = document.createElement("div");
    heading.style.cssText = "color: #00f0ff; font-size: 13px; font-weight: bold; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;";
    heading.innerHTML = `<i class="fas fa-id-card"></i> 437 STUDIO // CYBER-KARTE VORSCHAU`;

    card.appendChild(heading);

    selectedPerks.forEach((perk, index) => {
        const line = document.createElement("div");
        if (perk) {
            line.style.cssText = `
                background: rgba(255, 255, 255, 0.03);
                border-left: 3px solid ${perk.color};
                padding: 8px 12px;
                margin-top: 6px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: 0 0 8px ${perk.color}33;
            `;
            line.innerHTML = `
                <div>
                    <span style="color: ${perk.color}; font-weight: bold; font-size: 12px;">
                        <i class="fas ${perk.icon}"></i> ${escapeHTML(perk.name)}
                    </span>
                    <div style="color: #aaa; font-size: 10px; margin-top: 2px;">${escapeHTML(perk.buff)}</div>
                </div>
                <span style="color: #555; font-size: 9px;">SLOT ${index + 1}</span>
            `;
        } else {
            line.style.cssText = "background: #080812; border-left: 3px solid #333; padding: 8px 12px; margin-top: 6px; border-radius: 4px; color: #555; font-size: 11px;";
            line.textContent = `SLOT ${index + 1}: [ Leer / Kein Perk ]`;
        }
        card.appendChild(line);
    });

    display.replaceChildren(card);
}

async function saveProfileChanges(event) {
    event.preventDefault();

    if (!currentUser || !supabaseClient) {
        alert("Du musst angemeldet sein, um dein Profil zu speichern.");
        return;
    }

    const usernameInput = getElement("edit-username");
    if (!usernameInput) {
        alert("Das Benutzername-Feld wurde nicht gefunden.");
        return;
    }

    const oldUsername = currentUser.username;
    const newUsername = usernameInput.value.trim();

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(newUsername)) {
        alert("Der Benutzername muss 3–32 Zeichen lang sein und darf nur Buchstaben, Zahlen und _ enthalten.");
        return;
    }

    if (normalizeUsername(newUsername) !== normalizeUsername(oldUsername)) {
        const { data: existing, error: lookupError } = await supabaseClient
            .from("users")
            .select("username")
            .ilike("username", newUsername)
            .limit(1);

        if (lookupError) {
            alert("Der neue Benutzername konnte nicht überprüft werden.");
            return;
        }

        if (existing && existing.length > 0) {
            alert("Dieser Benutzername ist bereits vergeben.");
            return;
        }
    }

    const enableChar = getElement("enable-char-card")?.checked || false;
    const slots = [1, 2, 3].map(number => {
        const value = getElement(`perk-slot-${number}`)?.value || "";
        const perk = CYBER_PERKS_POOL.find(item => item.id === value);

        if (!perk || (perk.adminOnly && !isAdmin())) {
            return "";
        }

        return perk.id;
    });

    const newAvatar = tempNewAvatarData !== DEFAULT_AVATAR ? tempNewAvatarData : (currentUser.avatar || DEFAULT_AVATAR);

    const changes = {
        username: newUsername,
        avatar: newAvatar,
        cyber_char: {
            enabled: enableChar,
            slots
        }
    };

    const { data, error } = await supabaseClient
        .from("users")
        .update(changes)
        .eq("username", oldUsername)
        .select("*")
        .maybeSingle();

    if (error) {
        console.error("Profil konnte nicht gespeichert werden:", error);
        alert("Fehler beim Speichern: " + error.message);
        return;
    }

    if (!data) {
        alert("Kein Datenbankeintrag aktualisiert. Prüfe die Supabase-RLS-Regeln.");
        return;
    }

    currentUser = {
        ...currentUser,
        ...data
    };

    tempNewAvatarData = currentUser.avatar || DEFAULT_AVATAR;

    saveLocalSession();
    updateNavbarAuthUI();

    alert("Profil erfolgreich in der Cloud aktualisiert!");
    window.location.reload();
}

// ========================================================================
// 12. PRIVATE NACHRICHTEN – LIVE-BENACHRICHTIGUNGEN (PC & MOBILE WEB)
// ========================================================================

function initGlobalMessageListener() {
    if (!supabaseClient || !currentUser) return;

    if (messageSubscription) {
        supabaseClient.removeChannel(messageSubscription);
        messageSubscription = null;
    }

    const subscribedUsername = normalizeUsername(currentUser.username);

    messageSubscription = supabaseClient
    .channel("global_private_messages_notification")
    .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "private_messages"
        },
        payload => {
            if (
                !currentUser ||
                normalizeUsername(currentUser.username) !== subscribedUsername
            ) {
                return;
            }

            const message = payload.new;

            if (
                message &&
                normalizeUsername(message.recipient) === subscribedUsername
            ) {
                showDirectMessageToast(message);
                showMessageBadge();
                
                triggerNativeNotification(
                    "Neue Nachricht von " + (message.sender || "Unbekannt"),
                    message.message || "Du hast eine neue Nachricht erhalten.",
                    "messages.html?to=" + encodeURIComponent(message.sender || "")
                );
            }
        }
    )
    .subscribe();
}

function showDirectMessageToast(message) {
    const toast = document.createElement("div");

    toast.style.cssText = `
        position:fixed;
        bottom:20px;
        left:50%;
        transform:translateX(-50%);
        width:calc(100% - 24px);
        max-width:400px;
        background:#0c0c18;
        border:2px solid #00f0ff;
        box-shadow:0 0 25px rgba(0,240,255,.4);
        padding:14px 18px;
        border-radius:8px;
        z-index:2147483647;
        display:flex;
        align-items:center;
        gap:15px;
        font-family:monospace;
        box-sizing:border-box;
        cursor:pointer;
        animation: slideUpToast 0.3s ease;
    `;

    const icon = document.createElement("i");
    icon.className = "fas fa-envelope-open-text";
    icon.style.cssText = "font-size:26px;color:#00f0ff;flex-shrink:0;";

    const content = document.createElement("div");
    content.style.cssText = "overflow:hidden;flex-grow:1;min-width:0;";

    const heading = document.createElement("div");
    heading.textContent = "Neue Nachricht erhalten!";
    heading.style.cssText = "font-size:10px;color:#888;text-transform:uppercase;";

    const sender = document.createElement("div");
    sender.textContent = `Von: ${message.sender || "Unbekannt"}`;
    sender.style.cssText = "color:#fff;font-weight:bold;font-size:13px;overflow-wrap:anywhere;";

    const preview = document.createElement("div");
    preview.textContent = message.message || "Nachricht öffnen";
    preview.style.cssText = `
        color:#aaa;
        font-size:11px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
    `;

    content.append(heading, sender, preview);
    toast.append(icon, content);

    toast.addEventListener("click", () => {
        window.location.href = `messages.html?to=${encodeURIComponent(message.sender || "")}`;
    });

    document.body.appendChild(toast);

    window.setTimeout(() => toast.remove(), 6000);
}

function triggerNativeNotification(title, body, url) {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: '/img/logo.png',
                    badge: '/img/logo.png',
                    vibrate: [200, 100, 200],
                    data: { url: url || '/messages.html' }
                });
            });
        } else {
            new Notification(title, {
                body: body,
                icon: '/img/logo.png'
            });
        }
    }
}

// ========================================================================
// 13. PUSH BENACHRICHTIGUNGEN & SERVICE WORKER (CYBER MODAL INJIZIERUNG)
// ========================================================================

// ========================================================================
// PUSH-BENACHRICHTIGUNGEN & CYBER MODAL (VOLL KONTROLLIERBAR)
// ========================================================================

function injectPushSettingsModalDOM() {
    if (document.getElementById("pushSettingsModal")) return;

    const modalHTML = `
        <div id="pushSettingsModal" class="cyber-push-modal hidden" style="position: fixed; inset: 0; background: rgba(3, 3, 10, 0.85); display: flex; align-items: center; justify-content: center; z-index: 999999; backdrop-filter: blur(8px);">
            <div id="pushModalBoxInner" class="cyber-push-box" style="background: linear-gradient(135deg, #0c0c18 0%, #160a2a 100%); border: 2px solid #00f0ff; border-radius: 12px; padding: 30px; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 0 40px rgba(0, 240, 255, 0.35); font-family: monospace; color: #fff;">
                <div id="pushModalIcon" style="font-size: 42px; color: #00f0ff; margin-bottom: 12px; text-shadow: 0 0 15px rgba(0,240,255,0.6);">
                    <i class="fas fa-satellite-dish"></i>
                </div>
                <h2 id="pushModalTitle" style="color: #00f0ff; font-size: 16px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Push-Benachrichtigungen</h2>
                <p id="pushModalText" style="color: #ccc; font-size: 12px; line-height: 1.5; margin-bottom: 20px;">
                    Verwalte den Status deines Netzwerks für Echtzeit-Nachrichten und Foren-Updates auf PC & Handy.
                </p>
                <div style="display: flex; gap: 10px;">
                    <button onclick="togglePushSystemState()" id="pushActionBtn" class="btn btn-neon-blue" style="flex: 1; padding: 10px; font-size: 12px; cursor: pointer; font-weight: bold; border-radius: 6px;">
                        <i class="fas fa-power-off"></i> Umschalten
                    </button>
                    <button onclick="closePushSettingsModal()" class="btn" style="flex: 1; padding: 10px; font-size: 11px; background: rgba(255,255,255,0.05); border: 1px solid #555; color: #aaa; cursor: pointer; border-radius: 6px;">
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

function openPushSettingsModal() {
    closeProfileDropdown();
    const modal = document.getElementById("pushSettingsModal");
    if (!modal) return;
    updatePushModalUI();
    modal.classList.remove("hidden");
}

function closePushSettingsModal() {
    const modal = document.getElementById("pushSettingsModal");
    if (modal) modal.classList.add("hidden");
}

function updatePushModalUI() {
    const boxInner = document.getElementById("pushModalBoxInner");
    const iconEl = document.getElementById("pushModalIcon");
    const titleEl = document.getElementById("pushModalTitle");
    const textEl = document.getElementById("pushModalText");
    const btnEl = document.getElementById("pushActionBtn");

    if (!boxInner || !('Notification' in window)) return;

    // Prüfen, ob der Nutzer es lokal deaktiviert hat
    const isLocallyDisabled = localStorage.getItem("437_push_disabled") === "true";

    if (Notification.permission === 'granted' && !isLocallyDisabled) {
        boxInner.style.borderColor = "#00ff66";
        boxInner.style.boxShadow = "0 0 40px rgba(0, 255, 102, 0.35)";
        if (iconEl) { iconEl.className = "fas fa-bell"; iconEl.style.color = "#00ff66"; }
        if (titleEl) { titleEl.textContent = "Status: Aktiviert"; titleEl.style.color = "#00ff66"; }
        if (textEl) textEl.textContent = "Dein Gerät empfängt Live-Nachrichten und Foren-Updates über das 437 Studio Netzwerk.";
        
        if (btnEl) {
            btnEl.innerHTML = '<i class="fas fa-ban"></i> Deaktivieren';
            btnEl.style.background = "rgba(255, 0, 127, 0.2)";
            btnEl.style.border = "1px solid #ff007f";
            btnEl.style.color = "#ff007f";
            btnEl.disabled = false;
            btnEl.style.opacity = "1";
        }
    } else {
        boxInner.style.borderColor = "#ff007f";
        boxInner.style.boxShadow = "0 0 40px rgba(255, 0, 127, 0.35)";
        if (iconEl) { iconEl.className = "fas fa-bell-slash"; iconEl.style.color = "#ff007f"; }
        if (titleEl) { titleEl.textContent = "Status: Deaktiviert"; titleEl.style.color = "#ff007f"; }
        if (textEl) textEl.textContent = "Aktiviere die Benachrichtigungen, um keine Nachrichten oder Foren-Updates zu verpassen.";
        
        if (btnEl) {
            btnEl.innerHTML = '<i class="fas fa-check"></i> Jetzt aktivieren';
            btnEl.style.background = "";
            btnEl.style.border = "";
            btnEl.style.color = "";
            btnEl.disabled = false;
            btnEl.style.opacity = "1";
        }
    }
}

async function togglePushSystemState() {
    if (!('Notification' in window)) return;

    const isLocallyDisabled = localStorage.getItem("437_push_disabled") === "true";

    if (Notification.permission === 'granted' && !isLocallyDisabled) {
        // --- DEAKTIVIEREN ---
        try {
            // Merken, dass der Nutzer Push deaktiviert hat
            localStorage.setItem("437_push_disabled", "true");

            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                }
            }
            if (supabaseClient && currentUser && currentUser.username) {
                await supabaseClient.from("push_subscriptions").delete().eq("username", currentUser.username);
            }
        } catch (e) {
            console.error("Fehler beim Deaktivieren des Push-Dienstes:", e);
        }

        alert("Push-Dienst für deinen Account erfolgreich getrennt.");
        closePushSettingsModal();
        updatePushModalUI();
    } else {
        // --- AKTIVIEREN ---
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // Sperre wieder aufheben
            localStorage.removeItem("437_push_disabled");

            const registration = await navigator.serviceWorker.ready;
            await subscribeUserToPush(registration);
            updatePushModalUI();
        } else {
            alert("❌ Berechtigung für Benachrichtigungen wurde abgelehnt.");
            updatePushModalUI();
        }
    }
}

async function registerServiceWorkerForPush() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            if (Notification.permission === 'granted' && VAPID_PUBLIC_KEY) {
                await subscribeUserToPush(registration);
            }
        } catch (error) {
            console.warn('Push-Registrierung fehlgeschlagen:', error);
        }
    }
}

async function subscribeUserToPush(registration) {
    try {
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }
        if (supabaseClient && currentUser && currentUser.username) {
            await supabaseClient.from("push_subscriptions").upsert({
                username: currentUser.username,
                subscription: subscription
            }, { onConflict: "username" });
        }
    } catch (error) {
        console.error("Fehler beim Abonnieren des Push-Dienstes:", error);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// ========================================================================
// 14. UI FEEDBACK & LOADING WRAPPER
// ========================================================================

async function executeWithLoading(buttonElement, loadingText, asyncAction) {
    if (!buttonElement) {
        return await asyncAction();
    }
    
    const originalText = buttonElement.innerHTML;
    const originalDisabled = buttonElement.disabled;
    
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
    
    try {
        return await asyncAction();
    } catch (error) {
        console.error("Aktion fehlgeschlagen:", error);
        throw error;
    } finally {
        buttonElement.disabled = originalDisabled;
        buttonElement.innerHTML = originalText;
    }
}

async function adminDeleteComment(commentId, buttonElement) {
    if (!isAdmin()) {
        alert("❌ Keine Administrator-Berechtigung!");
        return;
    }

    if (!confirm("Möchtest du diese Antwort wirklich dauerhaft löschen?")) return;

    if (!supabaseClient) {
        alert("Supabase ist nicht verfügbar.");
        return;
    }

    const originalText = buttonElement ? buttonElement.innerHTML : "";
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        const { error } = await supabaseClient
            .from("forum_comments") 
            .delete()
            .eq("id", commentId);

        if (error) throw error;

        alert("Antwort erfolgreich gelöscht.");
        window.location.reload();

    } catch (err) {
        console.error("Fehler beim Löschen des Kommentars:", err);
        alert("❌ Fehler beim Löschen: " + err.message);
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.innerHTML = originalText;
        }
    }
}

// ========================================================================
// 15. GLOBALE EXPORTE & EVENT-LISTENERS
// ========================================================================

window.toggleProfileDropdown = toggleProfileDropdown;
window.closeProfileDropdown = closeProfileDropdown;
window.openAuthModal = openAuthModal;
window.submitLogin = submitLogin;
window.submitRegister = submitRegister;
window.redirectToLogin = redirectToLogin;
window.handleLogout = handleLogout;
window.isAdmin = isAdmin;
window.checkUserCanSend = checkUserCanSend;
window.checkUserTimeoutState = checkUserTimeoutState;
window.applyTimeoutBlockers = applyTimeoutBlockers;
window.unlockAchievement = unlockAchievement;
window.showAchievementToast = showAchievementToast;
window.previewGalleryImage = previewGalleryImage;
window.populatePerkSelectDropdowns = populatePerkSelectDropdowns;
window.updateCharCardPreview = updateCharCardPreview;
window.saveProfileChanges = saveProfileChanges;
window.openPushSettingsModal = openPushSettingsModal;
window.closePushSettingsModal = closePushSettingsModal;
window.togglePushSystemState = togglePushSystemState;
window.adminDeleteComment = adminDeleteComment;
window.clearMessageBadge = clearMessageBadge;

setInterval(() => {
    if (typeof loadAllThreads === "function" && document.visibilityState === "visible") {
        loadAllThreads(true);
    }
    if (typeof loadMessages === "function" && currentUser && document.visibilityState === "visible") {
        loadMessages(true);
    }
}, 3000);

console.info("437 STUDIO: Core Engine vollständig geladen.");

if (!document.getElementById("cyber-global-scrollbar-hide-style")) {
    const scrollbarStyle = document.createElement("style");
    scrollbarStyle.id = "cyber-global-scrollbar-hide-style";
    scrollbarStyle.textContent = `
        .profile-container, 
        #achievements-container, 
        .profile-card {
            scrollbar-width: none !important;
        }
        .profile-container::-webkit-scrollbar, 
        #achievements-container::-webkit-scrollbar, 
        .profile-card::-webkit-scrollbar {
            display: none !important;
        }
    `;
    document.head.appendChild(scrollbarStyle);
}

document.addEventListener("click", (e) => {
    const ripple = document.createElement("div");
    ripple.style.cssText = `
        position: fixed;
        top: ${e.clientY}px;
        left: ${e.clientX}px;
        width: 10px;
        height: 10px;
        border: 2px solid #00f0ff;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 2147483647;
        animation: cyberClickRipple 0.6s cubic-bezier(0, .9, .3, 1) forwards;
    `;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
});

if (!document.getElementById("cyber-global-anim-style")) {
    const animStyle = document.createElement("style");
    animStyle.id = "cyber-global-anim-style";
    animStyle.textContent = `
        @keyframes cyberClickRipple {
            0% { width: 10px; height: 10px; opacity: 1; border-color: #00f0ff; box-shadow: 0 0 10px #00f0ff; }
            100% { width: 120px; height: 120px; opacity: 0; border-color: #ff007f; box-shadow: 0 0 25px #ff007f; }
        }
        @keyframes slideUpToast {
            from { transform: translate(-50%, 20px); opacity: 0; }
            to { transform: translate(-50%, 0); opacity: 1; }
        }
    `;
    document.head.appendChild(animStyle);
}