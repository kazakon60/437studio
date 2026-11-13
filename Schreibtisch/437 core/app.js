document.addEventListener('DOMContentLoaded', async () => {
    // ============ AUDIT LOG HELPER ============
    async function logAction(action, targetType, targetId, details) {
        try {
            const u = JSON.parse(localStorage.getItem('437core_user')||'{}');
            if (!u.id) return;
            const resp = await fetch((window.SUPABASE_URL || '') + '/functions/v1/admin-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.SUPABASE_ANON_KEY || ''
                },
                body: JSON.stringify({ action, target_type: targetType, target_id: String(targetId||''), details: details||'', actor_id: u.id })
            });
            if (!resp.ok) console.warn('logAction failed', await resp.text());
        } catch (_) {}
    }

    // ============ ESC HELPER ============
    function esc(x) {
        const d = document.createElement('div');
        d.textContent = x;
        return d.innerHTML;
    }
    // ============ PREMIUM ENTRY ANIMATION ============
    const entryOverlay = document.getElementById('entryOverlay');
    const entryParticles = document.getElementById('entryParticles');

    // Erstelle animierte Partikel
    function createParticles() {
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'entry-particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.animationDelay = Math.random() * 4 + 's';
            p.style.animationDuration = (Math.random() * 3 + 2) + 's';
            p.style.width = (Math.random() * 4 + 2) + 'px';
            p.style.height = p.style.width;
            const colors = ['var(--neon-cyan)', 'var(--neon-green)', 'var(--neon-magenta)'];
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.boxShadow = `0 0 10px ${colors[Math.floor(Math.random() * colors.length)]}`;
            entryParticles.appendChild(p);
        }
    }

    const entrySeen = sessionStorage.getItem('entrySeen') === 'true';

    if (entrySeen) {
        // Bereits gesehen in dieser Sitzung: Overlay sofort ausblenden, ohne Animation
        entryOverlay.classList.add('entry-hidden');
        setTimeout(() => { entryOverlay.remove(); }, 100);
    } else {
        createParticles();

        // Überlay nach 3 Sekunden ausblenden und für diese Sitzung als gesehen markieren
        setTimeout(() => {
            entryOverlay.classList.add('entry-hidden');
            sessionStorage.setItem('entrySeen', 'true');
            setTimeout(() => {
                entryOverlay.remove();
            }, 800);
        }, 3000);
    }

    if (localStorage.getItem('gatePassed') !== 'true') { window.location.href = 'gate.html'; return; }
    const userData = localStorage.getItem('437core_user');
    if (!userData) { window.location.href = 'auth.html'; return; }
    let user = JSON.parse(userData);

    // ---------- Ban-Watch: sofortiger Rauswurf + Login-Sperre ----------
    let banWatchChannel = null;
    let banCheckTimer = null;

    function isBannedProfile(p) {
        if (!p) return false;
        if (p.banned_until) return new Date(p.banned_until).getTime() > Date.now();
        return p.banned === true;
    }

    function handleBan(prof) {
        try { localStorage.removeItem('437core_user'); } catch (_) {}
        try { localStorage.removeItem('437core_remember'); } catch (_) {}
        try {
            sessionStorage.setItem('banNotice', JSON.stringify({
                reason: (prof && prof.ban_reason) ? prof.ban_reason : '',
                until: (prof && prof.banned_until) ? prof.banned_until : null
            }));
        } catch (_) {}
        window.location.replace('auth.html?banned=1');
    }

    async function refreshBanState() {
        try {
            const { data: prof } = await supabaseClient.from('profiles')
                .select('banned,banned_until,ban_reason')
                .eq('id', user.id)
                .maybeSingle();
            if (isBannedProfile(prof)) { handleBan(prof); return true; }
            return false;
        } catch (_) {
            return false;
        }
    }

    function watchBanState() {
        if (banWatchChannel) { try { supabaseClient.removeChannel(banWatchChannel); } catch (_) {} banWatchChannel = null; }
        try {
            banWatchChannel = supabaseClient.channel('ban-watch-' + user.id)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + user.id }, (payload) => {
                    const p = (payload && payload.new) ? payload.new : {};
                    if (isBannedProfile(p)) handleBan(p);
                })
                .subscribe();
        } catch (_) {}

        if (banCheckTimer) clearInterval(banCheckTimer);
        banCheckTimer = setInterval(() => { refreshBanState(); }, 30000);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') refreshBanState();
        });
    }

    const bannedAtStart = await refreshBanState();
    watchBanState();
    if (bannedAtStart) return;

    // Live-Broadcasts des Admin-Panels empfangen
    if (window.init437Broadcasts) window.init437Broadcasts();

    // ---------- Service Worker ----------
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(e => console.error('SW registration failed', e));
    }

    let presenceChannel = null;
    const onlineUsers = new Set();
    let onlineDotsRaf = 0;
    function updateOnlineDots() {
        // Mehrere Presence-Syncs pro Frame zusammenfassen (DOM-Queries sind teuer).
        if (onlineDotsRaf) return;
        onlineDotsRaf = requestAnimationFrame(() => {
            onlineDotsRaf = 0;
            applyOnlineDots();
        });
    }
    function applyOnlineDots() {
        // Message-Avatars im Chat
        document.querySelectorAll('.message-avatar').forEach(av => {
            const img = av.querySelector('img');
            if (!img) return;
            const uid = av.dataset.userId;
            if (!uid) return;
            let dot = av.querySelector('.online-dot');
            if (isUserOnline(uid)) {
                if (!dot) { dot = document.createElement('span'); dot.className = 'online-dot'; av.appendChild(dot); }
                dot.style.display = 'block';
            } else {
                if (dot) dot.style.display = 'none';
            }
        });
        // Channel-Strip Avatare
        document.querySelectorAll('.channel-item[data-uid]').forEach(btn => {
            const uid = btn.dataset.uid;
            const wrap = btn.querySelector('.channel-avatar-wrap');
            if (!wrap) return;
            let dot = wrap.querySelector('.online-dot');
            if (isUserOnline(uid)) {
                if (!dot) { dot = document.createElement('span'); dot.className = 'online-dot'; wrap.appendChild(dot); }
                dot.style.display = 'block';
                wrap.classList.add('is-online');
            } else {
                if (dot) dot.style.display = 'none';
                wrap.classList.remove('is-online');
            }
        });
        const navAv = document.getElementById('navAvatar');
        if (navAv) {
            let dot = navAv.querySelector('.online-dot');
            if (!dot) { dot = document.createElement('span'); dot.className = 'online-dot'; navAv.appendChild(dot); }
            dot.style.display = 'block';
        }
    }
    let presenceHeartbeat = null;
    function isUserOnline(uid) {
        if (onlineUsers.has(uid)) return true;
        const p = (profilesCache || []).find(x => x.id === uid);
        if (p && p.last_seen) {
            const t = new Date(p.last_seen).getTime();
            if (Number.isFinite(t) && Date.now() - t < 90000) return true;
        }
        return false;
    }
    let presenceReconnectTimer = null;
    function trackPresence() {
        if (!presenceChannel || presenceChannel.state !== 'joined') return;
        try { presenceChannel.track({ user_id: user.id, nickname: user.nickname, online: true, ts: Date.now() }); } catch (_) {}
    }
    function schedulePresenceReconnect() {
        if (presenceReconnectTimer) return;
        presenceReconnectTimer = setTimeout(() => {
            presenceReconnectTimer = null;
            setupPresence();
        }, 3000);
    }
    async function setupPresence() {
        // Doppelte Verbindungen (Reconnect + Sichtbarkeitswechsel) verhindern
        if (presenceReconnectTimer || (presenceChannel && presenceChannel.state === 'joining')) return;
        if (presenceChannel) { const old = presenceChannel; presenceChannel = null; try { await supabaseClient.removeChannel(old); } catch (_) {} }
        const ch = supabaseClient.channel('presence');
        presenceChannel = ch;
        ch.on('presence', { event: 'sync' }, () => {
            const state = ch.presenceState();
            onlineUsers.clear();
            Object.values(state).flat().forEach(p => { if (p.user_id) onlineUsers.add(p.user_id); });
            updateOnlineDots();
        });
        ch.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                if (presenceReconnectTimer) { clearTimeout(presenceReconnectTimer); presenceReconnectTimer = null; }
                trackPresence();
                updateOnlineDots();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                if (presenceChannel === ch) { presenceChannel = null; schedulePresenceReconnect(); }
                onlineUsers.clear();
                updateOnlineDots();
            }
        });
        // Heartbeat: Presence verfällt ohne Refresh (z. B. bei inaktivem Tab).
        if (presenceHeartbeat) clearInterval(presenceHeartbeat);
        presenceHeartbeat = setInterval(() => {
            if (document.hidden || !navigator.onLine) return;
            trackPresence();
        }, 25000);
        // Nach einem Netzwerk-Ausfall sofort wieder verbinden
        if (!setupPresence._onlineBound) {
            setupPresence._onlineBound = true;
            window.addEventListener('online', () => { trackPresence(); schedulePresenceReconnect(); });
        }
    }
    setupPresence();

    // ============ VISIBILITY TRACKING (für Push-Benachrichtigungen) ============
    let isUserActive = !document.hidden;
    document.addEventListener('visibilitychange', () => {
        isUserActive = !document.hidden;
    });
    window.addEventListener('focus', () => { isUserActive = true; });
    window.addEventListener('blur', () => { isUserActive = false; });

    // ============ PUSH-BENACHRICHTIGUNGEN BEIM ERSTEN LADEN ============
    async function initPushNotifications() {
        if (!('Notification' in window)) return;
        const stored = localStorage.getItem('437core_notify');
        if (stored === '1' || stored === '0') return; // bereits entschieden
        if (Notification.permission !== 'default') return;
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            localStorage.setItem('437core_notify', '1');
            await subscribeToPush(user.id);
        } else {
            localStorage.setItem('437core_notify', '0');
        }
    }
    initPushNotifications();

    // ============ VOICE-CHANNEL WIEDERHERSTELLUNG ============
    // Warte bis voice-Objekt initialisiert ist, dann Kanal wiederherstellen
    async function restoreVoiceChannel() {
        const savedVoiceChannel = localStorage.getItem('voiceChannelId');
        if (savedVoiceChannel) {
            try {
                const { data: chs } = await supabaseClient.from('voice_channels').select('*').eq('id', savedVoiceChannel).maybeSingle();
                if (chs && typeof joinVC === 'function') {
                    await joinVC(chs.id, chs.name);
                } else {
                    localStorage.removeItem('voiceChannelId');
                }
            } catch (e) {
                console.error('Voice restore failed', e);
                localStorage.removeItem('voiceChannelId');
            }
        }
    }
    // Ausführen nach DOM-Content-Laden
    // Wird nach der voice-Deklaration (Zeile ~1441) aufgerufen, um TDZ-Fehler zu vermeiden
    window.addEventListener('voiceReady', restoreVoiceChannel, { once: true });
    // Mobile: Eingabefenster nach Reload/Tab-Wechsel/BFCache/Tastatur nicht verschwinden lassen
    ['pageshow','focus','visibilitychange','resize'].forEach(evt => {
        window.addEventListener(evt, () => { try { restoreChatUI(); forceShowInput(); } catch(_) {} }, { passive: true });
    });
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => { try { restoreChatUI(); forceShowInput(); } catch(_) {} }, { passive: true });
    }
    function safeRemoveChannel(name) {
        try {
            const ch = supabaseClient.getChannels().find(c => c && c.topic === 'realtime:' + name);
            if (!ch) return;
            const p = supabaseClient.removeChannel(ch);
            if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (_) {}
    }
    window.addEventListener('beforeunload', () => {
        try { if (drops437PollTimer) clearInterval(drops437PollTimer); } catch(_) {}
        try { safeRemoveChannel('drops437_videos_rt'); } catch(_) {}
        if (presenceChannel) presenceChannel.untrack();
        ['t2', 'm1', 'r1', 'vc_sync'].forEach(safeRemoveChannel);
        localStorage.setItem('wasAway', '1');
    });
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const audioRecEl = document.getElementById('audioRec');
    const channelStrip = document.getElementById('channelStrip');
    let currentChannel = localStorage.getItem('437core_channel') || '437';
    const DROPS_437_CHANNEL = 'drops437';
    const DROPS_437_YT_CHANNEL_ID = 'UCLz0qqLCu3p6_1kIukaK1pQ';
    const DROPS_437_RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + DROPS_437_YT_CHANNEL_ID;
    const DROPS_437_POLL_MS = 15 * 60 * 1000;
    let drops437Videos = [];
    let drops437PollTimer = null;
    const BOT_USER_ID_CONST = '43700000-0000-4000-8000-000000437001';
    const BOT_AVATAR_URL = 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=437AI-Core&backgroundColor=020617&eyes=roundFrame01,roundFrame02,bulging&mouth=smile01,smile02,square01';
    let profilesCache = null;
    let drops437SeenVideos = JSON.parse(localStorage.getItem('437core_drops437_seen') || '[]');
    let drops437Reactions = JSON.parse(localStorage.getItem('437core_drops437_reactions') || '{}');
    let drops437UserReactions = JSON.parse(localStorage.getItem('437core_drops437_user_reactions') || '{}');
    let drops437Filter = '';
    let drops437CategoryFilter = localStorage.getItem('437core_drops437_category_filter') || 'all';
    let drops437CarouselTimer = null;
    let dmUsers = []; // profiles (excluding self) for DM list

    // Zentraler Restore: Eingabefenster immer sichtbar, Audio-Recorder ausblenden, Nav-Daten aktuell halten
    function restoreChatUI() {
        const chatInputRow = document.querySelector('.chat-input-row');
        if (chatInput) chatInput.style.display = '';
        if (chatInputRow) chatInputRow.style.display = '';
        if (audioRecEl) audioRecEl.style.display = 'none';
        const inputContainer = document.querySelector('.chat-input-container');
        if (inputContainer) inputContainer.style.display = '';
        if (typeof updateDrops437InputState === 'function') updateDrops437InputState();
        forceShowInput();
        // Profil-Daten im Nav aktuell halten (wichtig bei Rückkehr von Einstellungen/Admin)
        const navNick = document.getElementById('navNickname');
        const navAv = document.getElementById('navAvatar');
        if (navNick && user) navNick.textContent = user.nickname.toUpperCase();
        if (navAv && user) {
            const av = user.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(user.nickname);
            navAv.innerHTML = '<img src="'+av+'" decoding="async" alt="">';
        }
    }

    restoreChatUI();

    function forceShowInput() {
        const inputContainer = document.querySelector('.chat-input-container');
        const chatInputRow = document.querySelector('.chat-input-row');
        if (inputContainer) { inputContainer.style.display = ''; inputContainer.style.visibility = 'visible'; inputContainer.style.opacity = '1'; }
        if (chatInputRow) { chatInputRow.style.display = ''; chatInputRow.style.visibility = 'visible'; }
        if (chatInput) { chatInput.style.display = ''; chatInput.style.visibility = 'visible'; }
        if (chatSend) { chatSend.style.display = ''; chatSend.style.visibility = 'visible'; }
        if (audioRecEl) audioRecEl.style.display = 'none';
    }

    // ============ COLLAPSIBLE CHAT HEADER (pull-up to hide) ============
    // robust show/hide + touch pull-up gesture, persisted in localStorage
    (function setupChatHeader() {
        const STORAGE_KEY = '437core_chatHeaderCollapsed';
        const header = document.getElementById('chatHeader');
        const revealBtn = document.getElementById('chatHeaderReveal');
        if (!header || !revealBtn) return;

        const DRAG_THRESHOLD = 32;        // px upward to collapse
        const VERTICAL_RATIO = 1.5;       // |dy| must exceed |dx| * ratio to count as vertical

        let isCollapsed = localStorage.getItem(STORAGE_KEY) === '1';
        let dragging = false;
        let startX = 0, startY = 0, lastX = 0, lastY = 0;
        let savedMaxHeight = '';
        let openMaxHeight = 0;
        let sizeTimer = null;

        function clearOpenClamp() {
            if (isCollapsed || dragging || header.classList.contains('chat-header--collapsing')) return;
            header.classList.remove('chat-header--collapsing');
            header.style.maxHeight = '';
            header.style.height = '';
            header.style.overflow = '';
            header.style.opacity = '';
            header.style.visibility = '';
            header.style.transform = '';
        }

        function measureOpenHeight() {
            if (isCollapsed || dragging || header.classList.contains('chat-header--collapsing')) { clearOpenClamp(); return; }
            // measure only to know drag/collapse start height; never leave a clamp on the open header
            const prevMax = header.style.maxHeight;
            const prevOverflow = header.style.overflow;
            header.style.maxHeight = 'none';
            header.style.height = 'auto';
            header.style.overflow = 'visible';
            openMaxHeight = Math.max(0, Math.ceil(header.scrollHeight));
            header.style.maxHeight = prevMax;
            header.style.overflow = prevOverflow;
            clearOpenClamp();
        }

        function applyState() {
            header.classList.toggle('chat-header--collapsed', isCollapsed);
            header.classList.toggle('chat-header--collapsing', false);
            revealBtn.style.display = isCollapsed ? 'flex' : 'none';
            if (isCollapsed) {
                header.style.maxHeight = '0px';
                header.style.height = '0px';
                header.style.opacity = '0';
                header.style.overflow = 'hidden';
            } else {
                clearOpenClamp();
                requestAnimationFrame(measureOpenHeight);
                setTimeout(() => { clearOpenClamp(); measureOpenHeight(); }, 120);
                setTimeout(() => { clearOpenClamp(); measureOpenHeight(); }, 500);
                setTimeout(() => { clearOpenClamp(); }, 2200);
            }
        }

        function hideChatHeader() {
            header.classList.remove('chat-header--collapsing');
            if (!isCollapsed) {
                header.classList.add('chat-header--collapsing');
                header.classList.remove('chat-header--collapsed');
                header.style.overflow = 'hidden';
                header.style.maxHeight = Math.max(0, Math.ceil(header.getBoundingClientRect().height || header.scrollHeight || openMaxHeight)) + 'px';
                header.style.opacity = '1';
                void header.offsetHeight;
                requestAnimationFrame(() => {
                    if (!isCollapsed) return;
                    header.style.maxHeight = '0px';
                    header.style.opacity = '0';
                });
                setTimeout(() => {
                    header.classList.remove('chat-header--collapsing');
                    header.classList.add('chat-header--collapsed');
                }, 320);
            }
            isCollapsed = true;
            try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
            revealBtn.style.display = 'flex';
        }

        function showChatHeader() {
            header.classList.remove('chat-header--collapsing');
            isCollapsed = false;
            try { localStorage.setItem(STORAGE_KEY, '0'); } catch (_) {}
            applyState();
        }

        // Reveal button (click + touch) restores the header
        revealBtn.addEventListener('click', () => showChatHeader());

        // Ignore drag when interaction starts on an interactive element inside the header
        function isInteractiveTarget(t) {
            return !!(t && t.closest('input, button, a, select, textarea, .channel-item, .chat-search-results, .user-search-result, .mention-item, .ep-btn, .msg-act, .react-btn'));
        }

        header.addEventListener('touchstart', (e) => {
            if (isCollapsed || isInteractiveTarget(e.target)) return;
            const t = e.touches[0];
            startX = lastX = t.clientX;
            startY = lastY = t.clientY;
            dragging = true;
            header.classList.add('chat-header--dragging');
            measureOpenHeight();
            savedMaxHeight = openMaxHeight ? (openMaxHeight + 'px') : '';
        }, { passive: true });

        header.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            const t = e.touches[0];
            lastX = t.clientX;
            lastY = t.clientY;
            const dy = lastY - startY; // negative = dragging upward
            const base = openMaxHeight || header.getBoundingClientRect().height;
            if (dy < 0) {
                const nh = Math.max(0, base + dy);
                header.style.maxHeight = nh + 'px';
                header.style.opacity = String(Math.max(0.15, 1 + dy / Math.max(1, base)));
            } else {
                clearOpenClamp();
            }
        }, { passive: true });

        function finishDrag() {
            if (!dragging) return;
            dragging = false;
            header.classList.remove('chat-header--dragging');
            const dy = lastY - startY;
            const dx = lastX - startX;
            if (dy < -DRAG_THRESHOLD && Math.abs(dy) > Math.abs(dx) * VERTICAL_RATIO) {
                hideChatHeader();
            } else {
                clearOpenClamp();
                requestAnimationFrame(measureOpenHeight);
                setTimeout(() => { clearOpenClamp(); measureOpenHeight(); }, 120);
                setTimeout(() => { clearOpenClamp(); }, 2200);
            }
        }
        header.addEventListener('touchend', finishDrag, { passive: true });
        header.addEventListener('touchcancel', finishDrag, { passive: true });

        // Expose for debugging / external use
        window.__chatHeader = { hide: hideChatHeader, show: showChatHeader, isCollapsed: () => isCollapsed, fix: () => { clearOpenClamp(); measureOpenHeight(); } };

        function scheduleMeasure() {
            if (isCollapsed) return;
            clearTimeout(sizeTimer);
            sizeTimer = setTimeout(() => { clearOpenClamp(); measureOpenHeight(); }, 80);
        }
        window.addEventListener('resize', scheduleMeasure, { passive: true });
        if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleMeasure, { passive: true });
        if (window.ResizeObserver) {
            try { new ResizeObserver(scheduleMeasure).observe(header); } catch (_) {}
        }
        ['pageshow','focus','visibilitychange'].forEach(evt => window.addEventListener(evt, () => {
            if (!isCollapsed && !dragging) { clearOpenClamp(); scheduleMeasure(); }
        }, { passive: true }));

        applyState();
        if (!isCollapsed) { clearOpenClamp(); requestAnimationFrame(measureOpenHeight); setTimeout(measureOpenHeight, 120); setTimeout(measureOpenHeight, 400); }
    })();

    document.getElementById('settingsBtn').onclick = () => { window.location.href = 'settings.html'; };
    const menuBtn = document.getElementById('menuBtn');
    const menuDrop = document.getElementById('menuDrop');
    if (menuBtn && menuDrop) {
        menuBtn.onclick = (e) => { e.stopPropagation(); menuDrop.style.display = menuDrop.style.display === 'none' ? 'block' : 'none'; };
        menuDrop.ondblclick = () => { menuDrop.style.display = 'none'; };
        document.addEventListener('dblclick', (e) => { if (!e.target.closest('.nav-dropdown')) menuDrop.style.display = 'none'; });
    }
    document.getElementById('logoutBtn').onclick = async () => {
        if (voice && voice.localStream) voice.localStream.getTracks().forEach(t=>t.stop());
        if (voice) { Object.values(voice.peers).forEach(p=>p.close()); voice.peers = {}; }
        localStorage.clear(); sessionStorage.clear();
        window.location.href='gate.html';
    };

    const navNick = document.getElementById('navNickname');
    const navAv = document.getElementById('navAvatar');
    if (navNick) { navNick.dataset.userId = user.id; navNick.style.cursor = 'pointer'; navNick.onclick = () => openProfileModal(user.id); }
    if (navAv) { navAv.dataset.userId = user.id; navAv.style.cursor = 'pointer'; navAv.onclick = () => openProfileModal(user.id); }

    const attachBtn = document.getElementById('attachBtn');
    const attachSheet = document.getElementById('attachSheet');
    const attachPreviewEl = document.getElementById('attachPreview');
    const attachStatusEl = document.getElementById('attachStatus');
    const galleryInput = document.getElementById('galleryInput');
    const docInput = document.getElementById('docInput');
    const cameraInput = document.getElementById('cameraInput');
    const audioBtn = document.getElementById('audioBtn');
    const previewChip = document.getElementById('previewChip');
    const mentionDrop = document.getElementById('mentionDrop');
    let pendingFile = null;
    let pendingFiles = [];
    let pendingAttachment = null;
    let loadedMsgs = [];
    // normalize old long dm_ channel ids to short format
    if (currentChannel && currentChannel.startsWith('dm_')) {
        const ids = currentChannel.slice(3).split('_');
        if (ids.length === 2 && ids[0].length > 8) {
            currentChannel = dmChannelId(ids[0], ids[1]);
            try { localStorage.setItem('437core_channel', currentChannel); } catch(_) {}
        }
    }
    function channelKey(ch) { return '437core_lastseen_' + ch; }
    function unreadKey(ch) { return '437core_unread_' + ch; }
    let replyToId = null;
    const quoteCache = {};
    let searchTimer = null;
    let draftTimer = null;
    const CHAT_DEFAULT_COLOR = '#A8A8A8';
    const DRAFT_KEY = '437core_draft_437';

    let profilesFetchedAt = 0;
    const PROFILES_TTL = 5 * 60 * 1000;
    async function getProfiles(force = false) {
        if (profilesCache && !force && Date.now() - profilesFetchedAt < PROFILES_TTL) return profilesCache;
        const { data } = await supabaseClient.from('profiles').select('id,nickname,avatar_url,bio,role,banned,banned_until,last_seen,notify_push,chat_color').order('nickname', { ascending: true }).limit(500);
        profilesCache = data || [];
        profilesFetchedAt = Date.now();
        return profilesCache;
    }

    function isBotId(id) { return id === BOT_USER_ID_CONST; }
    function isDrops437Channel(ch) { return ch === DROPS_437_CHANNEL; }
    function markDrops437Seen() {
        const seen = drops437SeenVideos;
        const newVideos = (drops437Videos || []).filter(v => !seen.includes(v.id));
        if (newVideos.length) {
            seen.push(...newVideos.map(v => v.id));
            localStorage.setItem('437core_drops437_seen', JSON.stringify(seen));
        }
    }
    function drops437UnreadCount() {
        const seen = drops437SeenVideos;
        return (drops437Videos || []).filter(v => !seen.includes(v.id)).length;
    }

    async function loadDrops437ReactionsFromDB(videoIds) {
        if (!videoIds || !videoIds.length) return {};
        const ids = [...new Set(videoIds.map(id => String(id)).filter(Boolean))];
        try {
            const { data, error } = await supabaseClient
                .from('drops_437_video_reactions')
                .select('video_id, emoji, user_id')
                .in('video_id', ids);
            if (error) { console.warn('loadDrops437Reactions failed', error); return {}; }

            const map = {};
            const userMap = {};
            ids.forEach(id => { map[id] = {}; userMap[id] = {}; });
            (data || []).forEach(r => {
                const vid = String(r.video_id);
                if (!map[vid]) { map[vid] = {}; userMap[vid] = {}; }
                map[vid][r.emoji] = (map[vid][r.emoji] || 0) + 1;
                if (r.user_id === user?.id) userMap[vid][r.emoji] = true;
            });

            ids.forEach(id => {
                drops437Reactions[id] = map[id] || {};
                drops437UserReactions[id] = userMap[id] || {};
            });
            try {
                localStorage.setItem('437core_drops437_reactions', JSON.stringify(drops437Reactions));
                localStorage.setItem('437core_drops437_user_reactions', JSON.stringify(drops437UserReactions));
            } catch (_) {}
            return map;
        } catch (e) { console.warn('loadDrops437Reactions error', e); return {}; }
    }

    async function toggleDrops437ReactionDB(videoId, emoji) {
        if (!user || !user.id) return;
        const vid = String(videoId);
        const btn = document.querySelector(`.drops437-react-btn[data-video-id="${CSS && CSS.escape ? CSS.escape(vid) : vid}"][data-emoji="${emoji}"]`);
        const wasActive = !!btn?.classList.contains('active');
        const countEl0 = btn?.querySelector('.drops437-react-count');
        const prevCount = parseInt(countEl0?.textContent || '0', 10);

        // Optimistic UI update
        if (btn) {
            btn.classList.toggle('active', !wasActive);
            btn.setAttribute('aria-pressed', (!wasActive) ? 'true' : 'false');
            const countEl = btn.querySelector('.drops437-react-count');
            const optimistic = wasActive ? Math.max(0, prevCount - 1) : prevCount + 1;
            if (countEl) {
                if (optimistic > 0) countEl.textContent = String(optimistic); else countEl.remove();
            } else if (!wasActive) {
                const span = document.createElement('span');
                span.className = 'drops437-react-count';
                span.textContent = '1';
                btn.appendChild(span);
            }
        }

        const revert = () => {
            if (!btn) return;
            btn.classList.toggle('active', wasActive);
            btn.setAttribute('aria-pressed', wasActive ? 'true' : 'false');
            let countEl = btn.querySelector('.drops437-react-count');
            if (prevCount > 0) {
                if (!countEl) { countEl = document.createElement('span'); countEl.className = 'drops437-react-count'; btn.appendChild(countEl); }
                countEl.textContent = String(prevCount);
            } else if (countEl) {
                countEl.remove();
            }
        };

        try {
            const resp = await fetch((window.SUPABASE_URL || '') + '/functions/v1/drops-437-reactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.SUPABASE_ANON_KEY || ''
                },
                body: JSON.stringify({ video_id: vid, emoji, user_id: user.id })
            });
            const json = await resp.json().catch(() => null);
            if (!resp.ok || !json?.ok) {
                revert();
                console.warn('toggleDrops437ReactionDB failed', json?.error || resp.statusText);
                return;
            }

            // Authoritative per-video counts and user reaction state
            drops437Reactions[vid] = (json.counts && typeof json.counts === 'object') ? { ...json.counts } : {};
            const ur = { ...(drops437UserReactions[vid] || {}) };
            if (json.action === 'added' && json.user_reaction) ur[json.user_reaction] = true;
            else delete ur[emoji];
            drops437UserReactions[vid] = ur;
            try {
                localStorage.setItem('437core_drops437_reactions', JSON.stringify(drops437Reactions));
                localStorage.setItem('437core_drops437_user_reactions', JSON.stringify(drops437UserReactions));
            } catch (_) {}

            syncDrops437ReactionButtons(vid);
        } catch (e) {
            revert();
            console.warn('toggleDrops437ReactionDB failed', e);
        }
    }

    function getDrops437Reactions(videoId) {
        if (drops437Reactions[videoId]) return drops437Reactions[videoId];
        try {
            const stored = JSON.parse(localStorage.getItem('437core_drops437_reactions') || '{}');
            if (stored[videoId]) {
                drops437Reactions[videoId] = stored[videoId];
                return stored[videoId];
            }
        } catch (_) {}
        return {};
    }

    function getDrops437UserReactions(videoId) {
        if (drops437UserReactions[videoId]) return drops437UserReactions[videoId];
        try {
            const stored = JSON.parse(localStorage.getItem('437core_drops437_user_reactions') || '{}');
            if (stored[videoId]) {
                drops437UserReactions[videoId] = stored[videoId];
                return stored[videoId];
            }
        } catch (_) {}
        return {};
    }

    function formatViews(v) {
        if (v === null || v === undefined) return '';
        const s = String(v).trim();
        if (!s) return '';
        return s;
    }

    function renderDrops437Reactions(videoId) {
        const r = getDrops437Reactions(videoId);
        const ur = getDrops437UserReactions(videoId);
        const emojis = ['👍', '❤️', '🔥', '😂', '😮', '💯', '🎬', '🚀'];
        let html = '';
        emojis.forEach(e => {
            const active = ur[e] ? ' active' : '';
            const count = r[e] || 0;
            html += '<button type="button" class="drops437-react-btn' + active + '" data-video-id="' + esc(videoId) + '" data-emoji="' + e + '" title="' + e + '" aria-pressed="' + (ur[e] ? 'true' : 'false') + '">' +
                '<span class="drops437-react-emoji">' + e + '</span>' +
                (count > 0 ? '<span class="drops437-react-count">' + count + '</span>' : '') +
            '</button>';
        });
        return html;
    }
    function syncDrops437ReactionButtons(videoId) {
        const vid = String(videoId);
        const root = (typeof chatMessages !== 'undefined' && chatMessages) ? chatMessages : document;
        const sel = `.drops437-react-btn[data-video-id="${CSS && CSS.escape ? CSS.escape(vid) : vid}"]`;
        root.querySelectorAll(sel).forEach(b => {
            const em = b.dataset.emoji;
            const ur = drops437UserReactions[vid] || {};
            const r = drops437Reactions[vid] || {};
            const active = !!ur[em];
            const count = r[em] || 0;
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
            let cEl = b.querySelector('.drops437-react-count');
            if (count > 0) {
                if (!cEl) { cEl = document.createElement('span'); cEl.className = 'drops437-react-count'; b.appendChild(cEl); }
                cEl.textContent = String(count);
            } else if (cEl) {
                cEl.remove();
            }
        });
    }
    function filterDrops437Videos(videos, query) {
        const q = (query || '').trim().toLowerCase();
        const cat = (drops437CategoryFilter || 'all');
        return videos.filter(v => {
            if (q) {
                const inTitle = (v.title || '').toLowerCase().includes(q);
                const inDesc = (v.description || '').toLowerCase().includes(q);
                if (!inTitle && !inDesc) return false;
            }
            if (cat && cat !== 'all') {
                const vcat = String(v.category || '').trim();
                if (vcat.toLowerCase() !== cat.toLowerCase()) return false;
            }
            return true;
        });
    }
    function getDrops437Categories(videos) {
        const cats = new Set(['Turniere', 'Crossover']);
        (videos || []).forEach(v => {
            const c = String(v.category || '').trim();
            if (c) cats.add(c);
        });
        return Array.from(cats).sort((a, b) => {
            const order = { 'Turniere': 0, 'Crossover': 1 };
            const ai = order.hasOwnProperty(a) ? order[a] : 10;
            const bi = order.hasOwnProperty(b) ? order[b] : 10;
            return ai !== bi ? ai - bi : a.localeCompare(b, 'de');
        });
    }

    // Animated placeholder for non-admin users in Drops 437
    const DROPS_437_PLACEHOLDERS = [
        '▶ DROPS 437 — READ ONLY CHANNEL',
        '▶ Videos von 437AI · YouTube RSS Feed',
        '▶ Keine Nachrichten · nur Video-Feed',
        '▶ Admin? Siehe Admin-Panel',
        '▶ Neue Videos erscheinen automatisch'
    ];
    function startDrops437PlaceholderAnimation(inputEl) {
        if (!inputEl || inputEl._drops437PlaceholderTimer) return;
        let i = 0;
        const tick = () => {
            // Timer endet, sobald Kanal/Element nicht mehr passt (kein Dauer-Intervall)
            if (!inputEl.isConnected || !isDrops437Channel(currentChannel)) {
                clearInterval(inputEl._drops437PlaceholderTimer);
                inputEl._drops437PlaceholderTimer = null;
                return;
            }
            inputEl.placeholder = DROPS_437_PLACEHOLDERS[i % DROPS_437_PLACEHOLDERS.length];
            i++;
        };
        inputEl._drops437PlaceholderTimer = setInterval(tick, 2200);
    }
    function hasCustomAvatar(url) { return !!url && !String(url).includes('dicebear.com/7.x/pixel-art/svg?seed='); }
    function isAdmin() { const p = (profilesCache||[]).find(x=>x.id===user.id); return p && p.role === 'admin'; }
    function dmChannelId(a, b) { const ids = [a, b].sort(); return 'dm_' + ids[0].slice(0,8) + '_' + ids[1].slice(0,8); }
    function isBanned(p) { if (!p) return false; if (p.banned_until) return new Date(p.banned_until).getTime() > Date.now(); return p.banned === true; }
    function getMyProfile() { return (profilesCache||[]).find(x=>x.id===user.id) || null; }

    let lastFocus = null;
    async function openProfileModal(uid) {
        lastFocus = document.activeElement;
        const modal = document.getElementById('profileModal');
        if (!modal || !uid) return;
        const avEl = document.getElementById('profileAvatar');
        const nameEl = document.getElementById('profileName');
        const statusDot = document.getElementById('profileOnlineDot');
        const statusText = document.getElementById('profileStatusText');
        const bioEl = document.getElementById('profileBio');
        const badgesEl = document.getElementById('profileBadges');
        if (nameEl) { nameEl.textContent = 'LADEN...'; nameEl.className = 'profile-name'; }
        if (bioEl) { bioEl.textContent = ''; bioEl.className = 'profile-bio'; }
        if (badgesEl) badgesEl.innerHTML = '';
        modal.style.display = 'flex';

        let profile = (profilesCache || []).find(p => p.id === uid) || null;
        try {
            const { data } = await supabaseClient.from('profiles').select('id,nickname,avatar_url,bio,role,banned,banned_until,last_seen,notify_push,chat_color').eq('id', uid).maybeSingle();
            if (data) {
                profile = data;
                if (profilesCache) {
                    const i = profilesCache.findIndex(p => p.id === uid);
                    if (i >= 0) profilesCache[i] = { ...profilesCache[i], ...data }; else profilesCache.push(data);
                }
            }
        } catch (_) {}

        const isBot = isBotId(uid) || (profile && String(profile.nickname || '').toUpperCase() === '437AI');
        const nickname = isBot ? '437AI' : (profile?.nickname || 'UNBEKANNT');
        const avatar = isBot ? BOT_AVATAR_URL : (profile?.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(profile?.nickname || uid));
        const bio = isBot ? (profile?.bio || '437 Core Assistant. Frag mich mit @437AI im Chat.') : (profile?.bio || '');
        const online = isBot ? true : isUserOnline(uid);

        if (avEl) avEl.src = avatar;
        if (nameEl) { nameEl.textContent = String(nickname).toUpperCase(); const uc = isBot ? '' : getUserChatColor(uid, profile); nameEl.className = 'profile-name' + (isBot ? ' rainbow-nick' : ''); if (uc) nameEl.style.color = uc; }
        if (statusDot) statusDot.className = 'profile-status-dot ' + (online ? 'online' : 'offline');
        if (statusText) statusText.textContent = online ? 'AKTIV' : 'OFFLINE';
        if (bioEl) {
            const b = String(bio || '').trim();
            bioEl.textContent = b || 'Keine Bio vorhanden.';
            bioEl.className = 'profile-bio' + (b ? '' : ' empty');
        }

        let hasFirstMsg = isBot;
        if (!isBot) {
            try {
                const { count } = await supabaseClient.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('channel', currentChannel);
                hasFirstMsg = (count || 0) > 0;
            } catch (_) {}
        }
        const badges = [
            { icon: '💬', label: 'Erste Nachricht', earned: hasFirstMsg },
            { icon: '🖼️', label: 'Profilbild', earned: isBot || hasCustomAvatar(profile?.avatar_url) },
            { icon: '📝', label: 'Bio', earned: isBot ? !!String(bio || '').trim() : !!String(profile?.bio || '').trim() }
        ];
        if (badgesEl) badgesEl.innerHTML = badges.map(b => '<span class="profile-badge '+(b.earned?'earned':'locked')+'"><span class="ico">'+b.icon+'</span><span>'+b.label+'</span></span>').join('');

        // Block/Mute buttons (only for other users, not bot, not self)
        const profileActions = document.getElementById('profileActions');
        if (profileActions && !isBot && uid !== user.id) {
            const myProf = getMyProfile();
            const blocked = myProf?.blocked_users?.includes(uid) || false;
            const muted = !!(myProf?.muted_until && new Date(myProf.muted_until) > new Date());
            profileActions.innerHTML = ''
                + '<button type="button" id="profileCallAudioBtn" class="profile-action-btn">'
                + '<span class="profile-action-ico" aria-hidden="true">📞</span><span class="profile-action-label">ANRUFEN</span></button>'
                + '<button type="button" id="profileCallVideoBtn" class="profile-action-btn">'
                + '<span class="profile-action-ico" aria-hidden="true">🎥</span><span class="profile-action-label">VIDEOANRUF</span></button>'
                + '<button type="button" id="profileBlockBtn" class="profile-action-btn ' + (blocked ? 'is-active-danger' : '') + '" aria-pressed="' + (blocked ? 'true' : 'false') + '">'
                + '<span class="profile-action-ico" aria-hidden="true">' + (blocked ? '⛔' : '🚫') + '</span><span class="profile-action-label">' + (blocked ? 'ENTBLOCKEN' : 'BLOCKIEREN') + '</span></button>'
                + '<button type="button" id="profileMuteBtn" class="profile-action-btn ' + (muted ? 'is-active-warn' : '') + '" aria-pressed="' + (muted ? 'true' : 'false') + '">'
                + '<span class="profile-action-ico" aria-hidden="true">' + (muted ? '🔔' : '🔕') + '</span><span class="profile-action-label">' + (muted ? 'ENTSTUMMEN' : 'STUMMEN (24h)') + '</span></button>';
            const callAudioBtn = document.getElementById('profileCallAudioBtn');
            if (callAudioBtn) callAudioBtn.onclick = () => {
                closeProfileModal();
                if (window.DMCall && typeof window.DMCall.start === 'function') window.DMCall.start(uid, 'audio');
            };
            const callVideoBtn = document.getElementById('profileCallVideoBtn');
            if (callVideoBtn) callVideoBtn.onclick = () => {
                closeProfileModal();
                if (window.DMCall && typeof window.DMCall.start === 'function') window.DMCall.start(uid, 'video');
            };
            document.getElementById('profileBlockBtn').onclick = async () => {
                const current = getMyProfile();
                const blockedSet = new Set(current?.blocked_users || []);
                if (blockedSet.has(uid)) blockedSet.delete(uid); else blockedSet.add(uid);
                const arr = Array.from(blockedSet);
                await supabaseClient.from('profiles').update({ blocked_users: arr }).eq('id', user.id);
                await logAction('block_user', 'user', uid, (blockedSet.has(uid) ? 'block' : 'unblock'));
                profileActions.innerHTML = '';
                openProfileModal(uid);
            };
            document.getElementById('profileMuteBtn').onclick = async () => {
                const current = getMyProfile();
                const isMuted = !!(current?.muted_until && new Date(current.muted_until) > new Date());
                const until = isMuted ? null : new Date(Date.now() + 24*60*60*1000).toISOString();
                await supabaseClient.from('profiles').update({ muted_until: until }).eq('id', user.id);
                await logAction('mute_user', 'user', uid, isMuted ? 'unmute' : '24h');
                profileActions.innerHTML = '';
                openProfileModal(uid);
            };
        }
    }

    function closeProfileModal() { const m = document.getElementById('profileModal'); if (m) m.style.display = 'none'; if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch(_){} } }
    const profileModal = document.getElementById('profileModal');
    const profileModalClose = document.getElementById('profileModalClose');
    if (profileModalClose) profileModalClose.onclick = closeProfileModal;
    if (profileModal) profileModal.addEventListener('click', (e) => { if (e.target === profileModal) closeProfileModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProfileModal(); });


    function renderMedia(m) {
        if (!m.media_url) return '';
        if (m.media_type && m.media_type.startsWith('image')) return '<img class="msg-media msg-img" src="'+m.media_url+'" alt="" loading="lazy" decoding="async">';
        if (m.media_type && m.media_type.startsWith('audio')) return '<audio class="msg-media" controls src="'+m.media_url+'"></audio>';
        if (m.media_type && m.media_type.startsWith('video')) return '<video class="msg-media msg-vid" controls src="'+m.media_url+'"></video>';
        return '';
    }

    // ---------- Anhang-Renderer ----------
    const attachIndex = new Map();
    const attachUserMap = new Map();
    let lightboxList = [];
    let lightboxIdx = 0;

    function attachTime(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function attachDms(v, isLat) {
        const dir = isLat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'O' : 'W');
        const abs = Math.abs(v);
        const deg = Math.floor(abs);
        const minF = (abs - deg) * 60;
        const min = Math.floor(minF);
        const sec = ((minF - min) * 60).toFixed(1);
        return deg + '\u00b0 ' + min + "' " + sec + '" ' + dir;
    }

    function icsEscape(v) {
        return String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    }

    function icsStamp(iso) {
        const d = iso ? new Date(iso) : new Date();
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    }

    function downloadIcs(msgId, a) {
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//437 Core//DE', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
            'UID:' + msgId + '@437core', 'DTSTAMP:' + icsStamp(new Date().toISOString())];
        if (a.starts_at) lines.push('DTSTART:' + icsStamp(a.starts_at));
        if (a.ends_at) lines.push('DTEND:' + icsStamp(a.ends_at));
        lines.push('SUMMARY:' + icsEscape(a.title || 'Ereignis'));
        if (a.location) lines.push('LOCATION:' + icsEscape(a.location));
        if (a.description) lines.push('DESCRIPTION:' + icsEscape(a.description));
        lines.push('END:VEVENT', 'END:VCALENDAR');
        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const el = document.createElement('a');
        el.href = url;
        el.download = String(a.title || 'ereignis').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40) + '.ics';
        document.body.appendChild(el);
        el.click();
        el.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function renderLightbox() {
        if (!mediaModalContent || !lightboxList.length) return;
        const url = lightboxList[lightboxIdx];
        const isVid = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
        let html = isVid
            ? '<video src="' + url + '" class="modal-media" controls autoplay playsinline></video>'
            : '<img src="' + url + '" class="modal-media" alt="">';
        if (lightboxList.length > 1) {
            html += '<button type="button" class="media-modal-nav prev" data-lb="prev" aria-label="Zurück">‹</button>' +
                '<button type="button" class="media-modal-nav next" data-lb="next" aria-label="Weiter">›</button>' +
                '<div class="media-modal-count">' + (lightboxIdx + 1) + ' / ' + lightboxList.length + '</div>';
        }
        mediaModalContent.innerHTML = html;
        const nav = mediaModalContent.querySelector('[data-lb]');
        if (nav) {
            mediaModalContent.querySelectorAll('[data-lb]').forEach(b => {
                b.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    lightboxIdx = b.dataset.lb === 'next'
                        ? (lightboxIdx + 1) % lightboxList.length
                        : (lightboxIdx - 1 + lightboxList.length) % lightboxList.length;
                    renderLightbox();
                });
            });
        }
    }

    function openLightbox(list, idx) {
        lightboxList = list;
        lightboxIdx = Math.max(0, Math.min(idx || 0, list.length - 1));
        renderLightbox();
        if (mediaModal) mediaModal.style.display = 'flex';
    }

    function attachAvatarHtml(uid, size) {
        const p = attachUserMap.get(uid) || {};
        const seed = p.nickname || String(uid).slice(0, 8);
        const av = p.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(seed);
        const px = size || 20;
        const name = p.nickname || 'Unbekannt';
        return '<span class="att-av" data-profile-uid="' + esc(uid) + '" title="' + esc(name) + '" role="button" tabindex="0" aria-label="' + esc(name) + '">' +
            '<img src="' + esc(av) + '" width="' + px + '" height="' + px + '" loading="lazy" decoding="async" alt="' + esc(name) + '"></span>';
    }

    function attachAvatarStack(ids, max) {
        const uniq = [];
        (ids || []).forEach(id => { if (id && !uniq.includes(id)) uniq.push(id); });
        const limit = max || 6;
        if (!uniq.length) return '';
        let html = '<span class="att-avatars">' + uniq.slice(0, limit).map(id => attachAvatarHtml(id, 20)).join('');
        if (uniq.length > limit) html += '<span class="att-av-more">+' + (uniq.length - limit) + '</span>';
        return html + '</span>';
    }

    function renderAlbum(a) {
        const items = (a.items || []).filter(i => i && i.url);
        if (!items.length) return '';
        const cols = items.length === 1 ? ' cols-1' : (items.length === 2 ? ' cols-2' : '');
        const max = 5;
        let html = '<div class="att-album' + cols + '">';
        items.slice(0, max).forEach((it, i) => {
            const isVid = String(it.type || '').startsWith('video/');
            const more = (i === max - 1 && items.length > max) ? '<span class="att-album-more">+' + (items.length - max + 1) + '</span>' : '';
            html += '<button type="button" class="att-album-item" data-album="' + i + '" aria-label="Bild ' + (i + 1) + '">' +
                (isVid
                    ? '<video src="' + it.url + '" muted playsinline preload="metadata"></video>'
                    : '<img src="' + it.url + '" alt="" loading="lazy" decoding="async">') + more + '</button>';
        });
        return html + '</div>';
    }

    function renderLocation(a) {
        const lat = Number(a.lat), lng = Number(a.lng);
        const osm = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=17/' + lat + '/' + lng;
        const gmaps = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
        return '<div class="att-location">' +
            '<span class="att-pin"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>' +
            '<div><div class="att-label">STANDORT</div>' +
            '<div class="att-coords">' + esc(attachDms(lat, true)) + '<br>' + esc(attachDms(lng, false)) + '</div>' +
            '<div class="att-sub">' + lat.toFixed(6) + ', ' + lng.toFixed(6) + (a.accuracy ? ' · ±' + Math.round(a.accuracy) + ' m' : '') + '</div>' +
            '<div class="att-links"><a href="' + osm + '" target="_blank" rel="noopener">OpenStreetMap</a><a href="' + gmaps + '" target="_blank" rel="noopener">Google Maps</a></div></div></div>';
    }

    function renderDocument(a) {
        const ext = attachExt(a.name);
        return '<a class="att-doc" href="' + a.url + '" target="_blank" rel="noopener" download="' + esc(a.name || 'datei') + '">' +
            '<span class="att-doc-icon">' + esc(ext.slice(0, 4)) + '</span>' +
            '<span><div class="att-doc-name">' + esc(a.name || 'Datei') + '</div><div class="att-doc-meta">' + esc(formatBytes(a.size)) + ' · ' + esc(ext) + '</div></span>' +
            '<span class="att-doc-dl"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span></a>';
    }

    function renderPoll(m, votes) {
        const a = m.attachment || {};
        const options = a.options || [];
        const total = votes.length;
        const mine = votes.find(v => v.user_id === user.id);
        const closed = !!m.deleted_at;
        let html = '<div class="att-poll"><div class="att-label">ABSTIMMUNG</div><div class="att-poll-q">' + esc(a.question || '') + '</div>';
        options.forEach((opt, i) => {
            const optVotes = votes.filter(v => v.option_index === i);
            const count = optVotes.length;
            const pct = total ? Math.round(count / total * 100) : 0;
            html += '<button type="button" class="att-poll-opt' + (mine && mine.option_index === i ? ' mine' : '') + '" data-vote="' + m.id + '" data-opt="' + i + '"' + (closed ? ' disabled' : '') + '>' +
                '<span class="ap-fill" style="width:' + pct + '%"></span>' +
                '<span class="ap-row"><span>' + esc(opt) + '</span><span class="ap-pct">' + pct + '%</span></span></button>';
            if (count) {
                html += '<div class="att-poll-voters">' + attachAvatarStack(optVotes.map(v => v.user_id), 6) +
                    '<span class="ap-count">' + count + ' Stimme' + (count === 1 ? '' : 'n') + '</span></div>';
            }
        });
        html += '<div class="att-poll-meta"><span>' + total + ' Stimme' + (total === 1 ? '' : 'n') + '</span>' +
            (mine && !closed ? '<button type="button" data-unvote="' + m.id + '">Stimme zurücknehmen</button>' : '') + '</div></div>';
        return html;
    }

    function renderEvent(m, rsvps) {
        const a = m.attachment || {};
        const mine = rsvps.find(r => r.user_id === user.id);
        const ended = a.ends_at ? new Date(a.ends_at).getTime() < Date.now() : (a.starts_at ? new Date(a.starts_at).getTime() < Date.now() : false);
        const count = (st) => rsvps.filter(r => r.status === st).length;
        const yes = count('yes'), maybe = count('maybe'), no = count('no');
        let html = '<div class="att-event"><div class="att-label">EREIGNIS</div>' +
            '<div class="att-event-title">' + esc(a.title || '') + '</div>';
        if (a.starts_at) {
            const range = attachTime(a.starts_at) + (a.ends_at ? ' – ' + attachTime(a.ends_at) : '');
            html += '<div class="att-event-when"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + esc(range) + '</div>';
        }
        if (a.location) html += '<div class="att-event-where">' + esc(a.location) + '</div>';
        if (a.description) html += '<div class="att-event-desc">' + esc(a.description) + '</div>';
        html += '<div class="att-rsvp">' +
            '<button type="button" data-rsvp="yes" data-msg="' + m.id + '" class="' + (mine && mine.status === 'yes' ? 'active' : '') + '">Dabei</button>' +
            '<button type="button" data-rsvp="maybe" data-msg="' + m.id + '" class="' + (mine && mine.status === 'maybe' ? 'active' : '') + '">Vielleicht</button>' +
            '<button type="button" data-rsvp="no" data-msg="' + m.id + '" class="' + (mine && mine.status === 'no' ? 'active' : '') + '">Leider nicht</button>' +
            '</div>';
        [['yes', 'Dabei', yes], ['maybe', 'Vielleicht', maybe], ['no', 'Leider nicht', no]].forEach((row) => {
            const ids = rsvps.filter(r => r.status === row[0]).map(r => r.user_id);
            if (!ids.length) return;
            html += '<div class="att-rsvp-row">' + attachAvatarStack(ids, 8) + '<span class="att-rsvp-label">' + row[1] + ' · ' + ids.length + '</span></div>';
        });
        html += '<div class="att-event-foot"><span>' + yes + ' dabei · ' + maybe + ' vielleicht · ' + no + ' nicht</span>' +
            '<span><a href="#" data-ics="' + m.id + '">Kalender</a></span></div>';
        if (ended) html += '<div class="att-event-ended">Dieses Ereignis ist vorbei.</div>';
        return html + '</div>';
    }

    function formatCallDuration(sec) {
        const s = Math.max(0, Math.floor(Number(sec) || 0));
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function renderCall(a) {
        const isVideo = a.media === 'video';
        const dir = a.direction === 'in' ? 'Eingehend' : 'Ausgehend';
        const statusMap = { answered: 'Angenommen', ended: 'Angenommen', missed: 'Verpasst', declined: 'Abgelehnt', canceled: 'Abgebrochen', failed: 'Fehlgeschlagen' };
        const status = statusMap[a.status] || 'Angenommen';
        const dur = a.duration ? ' · ' + formatCallDuration(a.duration) : '';
        const peer = a.peer_id || '';
        const cls = 'att-call att-call-' + (a.status || 'ended');
        const icon = isVideo
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
        return '<div class="' + cls + '">' +
            '<div class="att-call-icon">' + icon + '</div>' +
            '<div class="att-call-body"><div class="att-call-title">' + (isVideo ? 'Videoanruf' : 'Audioanruf') + esc(dur) + '</div>' +
            '<div class="att-call-sub">' + esc(dir) + ' · ' + esc(status) + '</div></div>' +
            (peer ? '<button type="button" class="att-call-cb" data-call-peer="' + esc(peer) + '" data-call-kind="' + (isVideo ? 'video' : 'audio') + '">↩</button>' : '') +
            '</div>';
    }

    function renderAttachment(m, votes, rsvps) {
        const a = m.attachment;
        if (!a || !a.kind) return '';
        if (a.kind === 'album') return renderAlbum(a);
        if (a.kind === 'location') return renderLocation(a);
        if (a.kind === 'document') return renderDocument(a);
        if (a.kind === 'poll') return renderPoll(m, votes || []);
        if (a.kind === 'event') return renderEvent(m, rsvps || []);
        if (a.kind === 'call') return renderCall(a);
        return '';
    }

    async function votePoll(msgId, optionIndex) {
        if (!msgId) return;
        if (isBanned(getMyProfile())) { alert('Du bist gesperrt.'); return; }
        try {
            const { error: delErr } = await supabaseClient.from('message_votes').delete().eq('message_id', msgId).eq('user_id', user.id);
            if (delErr) throw delErr;
            if (optionIndex !== null && optionIndex !== undefined) {
                const { error: insErr } = await supabaseClient.from('message_votes').insert([{ message_id: msgId, user_id: user.id, option_index: optionIndex }]);
                if (insErr) throw insErr;
            }
            await loadMsgs({ preserveScroll: true });
        } catch (err) {
            alert('Abstimmung fehlgeschlagen: ' + (err && err.message ? err.message : 'Fehler'));
        }
    }

    async function rsvpEvent(msgId, status) {
        if (!msgId) return;
        if (isBanned(getMyProfile())) { alert('Du bist gesperrt.'); return; }
        try {
            const { data: rows } = await supabaseClient.from('event_rsvps').select('id,status').eq('message_id', msgId).eq('user_id', user.id).limit(1);
            const existing = rows && rows.length ? rows[0] : null;
            if (!existing) {
                const { error } = await supabaseClient.from('event_rsvps').insert([{ message_id: msgId, user_id: user.id, status: status }]);
                if (error) throw error;
            } else if (existing.status !== status) {
                const { error } = await supabaseClient.from('event_rsvps').update({ status: status }).eq('id', existing.id);
                if (error) throw error;
            }
            await loadMsgs({ preserveScroll: true });
        } catch (err) {
            alert('Zusage fehlgeschlagen: ' + (err && err.message ? err.message : 'Fehler'));
        }
    }

    function renderMentions(text) {
        return esc(text).replace(/@(\w+)/g, (match, name) => {
            const found = (profilesCache||[]).some(p=>p.nickname.toLowerCase()===name.toLowerCase());
            return '<span class="mention'+(found?' valid':'')+'">@'+name+'</span>';
        });
    }

    // ---------- Anhaenge: Galerie, Kamera, Standort, Dokument ----------
    const ATTACH_MAX_FILES = 10;
    const ATTACH_LIMITS = { image: 10 * 1024 * 1024, video: 50 * 1024 * 1024, document: 25 * 1024 * 1024 };
    const ATTACH_LABELS = { gallery: 'Galerie', camera: 'Kamera', location: 'Standort', document: 'Dokumente', poll: 'Abstimmung', event: 'Ereignis' };

    function attachSetStatus(text, kind) {
        if (!attachStatusEl) return;
        attachStatusEl.textContent = text || '';
        attachStatusEl.classList.toggle('is-err', kind === 'err');
        attachStatusEl.classList.toggle('is-ok', kind === 'ok');
    }

    function attachKindOf(file) {
        if (file.type && file.type.startsWith('image/')) return 'image';
        if (file.type && file.type.startsWith('video/')) return 'video';
        return 'document';
    }

    function formatBytes(n) {
        const size = Number(n) || 0;
        if (size < 1024) return size + ' B';
        if (size < 1024 * 1024) return (size / 1024).toFixed(size < 10240 ? 1 : 0) + ' KB';
        return (size / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function attachExt(name) {
        const m = /\.([a-zA-Z0-9]{1,6})$/.exec(name || '');
        return m ? m[1].toUpperCase() : 'DATEI';
    }

    function attachLabel(a) {
        if (!a) return '';
        if (a.kind === 'album') {
            const items = a.items || [];
            const imgs = items.filter(i => !i.type || i.type.startsWith('image/')).length;
            const vids = items.length - imgs;
            const parts = [];
            if (imgs) parts.push(imgs === 1 ? 'Foto' : imgs + ' Fotos');
            if (vids) parts.push(vids === 1 ? 'Video' : vids + ' Videos');
            return parts.join(', ') || 'Anhang';
        }
        if (a.kind === 'location') return 'Standort';
        if (a.kind === 'document') return 'Dokument: ' + (a.name || 'Datei');
        if (a.kind === 'poll') return 'Abstimmung: ' + (a.question || '');
        if (a.kind === 'event') return 'Ereignis: ' + (a.title || '');
        return 'Anhang';
    }

    function attachHasFiles() { return pendingFiles.length > 0 || !!pendingFile; }

    function attachAnyPending() { return attachHasFiles() || !!pendingAttachment; }

    function clearAttachPreviews() {
        pendingFiles.forEach(f => { if (f.previewUrl) { try { URL.revokeObjectURL(f.previewUrl); } catch (_) {} } });
        pendingFiles = [];
        pendingAttachment = null;
        if (attachPreviewEl) { attachPreviewEl.innerHTML = ''; attachPreviewEl.hidden = true; }
        if (galleryInput) galleryInput.value = '';
        if (docInput) docInput.value = '';
        if (cameraInput) cameraInput.value = '';
        attachSetStatus('', '');
    }

    function renderAttachPreview() {
        if (!attachPreviewEl) return;
        if (!attachAnyPending()) { attachPreviewEl.innerHTML = ''; attachPreviewEl.hidden = true; return; }
        attachPreviewEl.hidden = false;
        let html = '';
        pendingFiles.forEach((f, i) => {
            const k = f.kind;
            let inner = '';
            if (k === 'image') inner = '<img src="' + f.previewUrl + '" alt="">';
            else if (k === 'video') inner = '<video src="' + f.previewUrl + '" muted playsinline></video>';
            else inner = '<span class="att-file"><b>' + esc(attachExt(f.file.name)) + '</b>' + esc(formatBytes(f.file.size)) + '</span>';
            html += '<div class="attach-thumb" data-fi="' + i + '">' + inner +
                '<button type="button" class="att-del" data-fdel="' + i + '" title="Entfernen" aria-label="Entfernen">✕</button></div>';
        });
        if (pendingAttachment) {
            if (pendingAttachment.kind === 'location') {
                html += '<div class="attach-thumb"><span class="att-file"><b>PIN</b>' + pendingAttachment.lat.toFixed(4) + '</span></div>';
            } else if (pendingAttachment.kind === 'poll') {
                html += '<div class="attach-thumb"><span class="att-file"><b>POLL</b>' + esc((pendingAttachment.question || '').slice(0, 18)) + '</span></div>';
            } else if (pendingAttachment.kind === 'event') {
                html += '<div class="attach-thumb"><span class="att-file"><b>EVENT</b>' + esc((pendingAttachment.title || '').slice(0, 18)) + '</span></div>';
            }
        }
        const label = pendingAttachment ? attachLabel(pendingAttachment) : (attachHasFiles() ? (pendingFiles.length + ' Datei(en)') : '');
        html += '<span class="attach-caption-note">' + esc(label) + '</span>';
        attachPreviewEl.innerHTML = html;
    }

    function clearPendingFilesOnly() {
        pendingFiles.forEach(f => { if (f.previewUrl) { try { URL.revokeObjectURL(f.previewUrl); } catch (_) {} } });
        pendingFiles = [];
        if (galleryInput) galleryInput.value = '';
        if (docInput) docInput.value = '';
        if (cameraInput) cameraInput.value = '';
    }

    function attachRemoveFile(idx) {
        const f = pendingFiles[idx];
        if (!f) return;
        if (f.previewUrl) { try { URL.revokeObjectURL(f.previewUrl); } catch (_) {} }
        pendingFiles.splice(idx, 1);
        renderAttachPreview();
    }

    async function attachAddFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        if (pendingAttachment) { pendingAttachment = null; attachSetStatus('', ''); }
        let added = 0;
        for (const f of files) {
            if (pendingFiles.length >= ATTACH_MAX_FILES) { attachSetStatus('Maximal ' + ATTACH_MAX_FILES + ' Dateien pro Nachricht.', 'err'); break; }
            const kind = attachKindOf(f);
            const limit = ATTACH_LIMITS[kind] || ATTACH_LIMITS.document;
            if (f.size > limit) { attachSetStatus('Zu groß: ' + f.name + ' (max. ' + formatBytes(limit) + ')', 'err'); continue; }
            if (f.size === 0) { attachSetStatus('Leere Datei: ' + f.name, 'err'); continue; }
            const entry = { file: f, kind: kind, previewUrl: URL.createObjectURL(f), w: null, h: null };
            if (kind === 'image') {
                try {
                    if (window.createImageBitmap) {
                        const bmp = await createImageBitmap(f);
                        entry.w = bmp.width; entry.h = bmp.height;
                        if (bmp.close) bmp.close();
                    } else {
                        const dim = await new Promise((res, rej) => {
                            const im = new Image();
                            im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
                            im.onerror = rej;
                            im.src = entry.previewUrl;
                        });
                        entry.w = dim.w; entry.h = dim.h;
                    }
                } catch (_) {}
            }
            pendingFiles.push(entry);
            added++;
        }
        renderAttachPreview();
        if (added) { attachSetStatus(added + ' Datei(en) bereit.', 'ok'); closeAttachSheet(); }
    }

    async function attachUploadOne(entry) {
        const f = entry.file;
        const kind = entry.kind || attachKindOf(f);
        const limit = ATTACH_LIMITS[kind] || ATTACH_LIMITS.document;
        if (f.size > limit) throw new Error(f.name + ' ist zu groß (max. ' + formatBytes(limit) + ')');
        const safe = (f.name || 'datei').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
        const path = 'media/' + user.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '_' + safe;
        const { error } = await supabaseClient.storage.from('media').upload(path, f, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: pub } = supabaseClient.storage.from('media').getPublicUrl(path);
        return { url: pub.publicUrl, type: f.type || 'application/octet-stream', name: f.name || 'datei', size: f.size, w: entry.w || null, h: entry.h || null };
    }

    function openAttachSheet() {
        if (!attachSheet) return;
        attachSheet.hidden = false;
        if (attachBtn) attachBtn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('attach-open');
        const first = attachSheet.querySelector('.attach-tile');
        if (first) setTimeout(() => { try { first.focus(); } catch (_) {} }, 30);
    }

    function closeAttachSheet() {
        if (!attachSheet) return;
        attachSheet.hidden = true;
        if (attachBtn) attachBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('attach-open');
    }

    if (attachBtn && attachSheet) {
        attachBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (attachSheet.hidden) openAttachSheet(); else closeAttachSheet();
        });
        document.getElementById('attachClose')?.addEventListener('click', closeAttachSheet);
        document.addEventListener('click', (e) => {
            if (attachSheet.hidden) return;
            if (attachSheet.contains(e.target) || attachBtn.contains(e.target)) return;
            closeAttachSheet();
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !attachSheet.hidden) closeAttachSheet(); });
        attachSheet.querySelectorAll('.attach-tile').forEach(btn => {
            btn.addEventListener('click', () => {
                const act = btn.dataset.act;
                attachSetStatus('', '');
                if (act === 'gallery' && galleryInput) { galleryInput.click(); return; }
                if (act === 'document' && docInput) { docInput.click(); return; }
                if (act === 'camera') { openCamera(); return; }
                if (act === 'location') { requestLocation(); return; }
                if (act === 'poll') { openPollModal(); return; }
                if (act === 'event') { openEventModal(); return; }
            });
        });
    }
    if (galleryInput) galleryInput.addEventListener('change', (e) => { attachAddFiles(e.target.files); galleryInput.value = ''; });
    if (docInput) docInput.addEventListener('change', (e) => { attachAddFiles(e.target.files); docInput.value = ''; });
    if (cameraInput) cameraInput.addEventListener('change', (e) => { attachAddFiles(e.target.files); cameraInput.value = ''; });

    if (attachPreviewEl) {
        attachPreviewEl.addEventListener('click', (e) => {
            const del = e.target.closest('[data-fdel]');
            if (del) { attachRemoveFile(parseInt(del.dataset.fdel, 10)); return; }
            if (e.target.closest('.att-del')) return;
            const img = e.target.closest('img');
            if (img) { mediaModalContent.innerHTML = '<img src="' + img.src + '" class="modal-media">'; mediaModal.style.display = 'flex'; }
            const vid = e.target.closest('video');
            if (vid) { mediaModalContent.innerHTML = '<video src="' + vid.src + '" class="modal-media" controls autoplay></video>'; mediaModal.style.display = 'flex'; }
        });
    }

    // ---------- Kamera ----------
    const cameraModal = document.getElementById('cameraModal');
    const camVideo = document.getElementById('camVideo');
    const camCanvas = document.getElementById('camCanvas');
    const camPreviewImg = document.getElementById('camPreviewImg');
    const camError = document.getElementById('camError');
    const camShot = document.getElementById('camShot');
    const camSwitch = document.getElementById('camSwitch');
    const camRetake = document.getElementById('camRetake');
    const camUse = document.getElementById('camUse');
    const camClose = document.getElementById('camClose');
    let camStream = null;
    let camFacing = 'environment';
    let camBlob = null;

    function camStop() {
        if (camStream) { try { camStream.getTracks().forEach(t => t.stop()); } catch (_) {} camStream = null; }
        if (camVideo) { try { camVideo.srcObject = null; } catch (_) {} }
    }

    function camShowError(msg) {
        if (!camError) return;
        camError.textContent = msg;
        camError.hidden = !msg;
    }

    async function camStart() {
        if (!cameraModal) return;
        camShowError('');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            camShowError('Kamera wird von diesem Browser nicht unterstützt. Bitte Datei-Dialog verwenden.');
            if (cameraInput) cameraInput.click();
            closeCamera();
            return;
        }
        camStop();
        try {
            camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: camFacing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            camVideo.srcObject = camStream;
            camVideo.hidden = false;
            camCanvas.hidden = true;
            if (camPreviewImg) camPreviewImg.hidden = true;
            if (camShot) camShot.hidden = false;
            if (camRetake) camRetake.hidden = true;
            if (camUse) camUse.hidden = true;
            if (camSwitch) camSwitch.hidden = false;
        } catch (err) {
            const name = err && err.name ? err.name : '';
            let msg = 'Kamera konnte nicht gestartet werden.';
            if (name === 'NotAllowedError' || name === 'SecurityError') msg = 'Kamerazugriff wurde verweigert. Bitte in den Browser-Einstellungen erlauben.';
            else if (name === 'NotFoundError' || name === 'OverconstrainedError') msg = 'Keine Kamera gefunden.';
            else if (name === 'NotReadableError') msg = 'Kamera wird bereits von einer anderen App verwendet.';
            camShowError(msg + ' (Datei-Dialog als Alternative.)');
        }
    }

    function openCamera() {
        if (!cameraModal) return;
        cameraModal.style.display = 'flex';
        camBlob = null;
        closeAttachSheet();
        camStart();
    }

    function closeCamera() {
        camStop();
        if (camPreviewImg && camPreviewImg.src && camPreviewImg.src.startsWith('blob:')) {
            try { URL.revokeObjectURL(camPreviewImg.src); } catch (_) {}
        }
        if (camPreviewImg) { camPreviewImg.removeAttribute('src'); camPreviewImg.hidden = true; }
        if (cameraModal) cameraModal.style.display = 'none';
        camBlob = null;
    }

    function camShoot() {
        if (!camVideo || !camVideo.videoWidth) { camShowError('Kamera ist noch nicht bereit.'); return; }
        const w = camVideo.videoWidth, h = camVideo.videoHeight;
        camCanvas.width = w;
        camCanvas.height = h;
        const ctx = camCanvas.getContext('2d');
        if (camFacing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
        ctx.drawImage(camVideo, 0, 0, w, h);
        camCanvas.toBlob((blob) => {
            if (!blob) { camShowError('Aufnahme fehlgeschlagen.'); return; }
            camBlob = new File([blob], 'kamera_' + Date.now() + '.jpg', { type: 'image/jpeg' });
            camVideo.hidden = true;
            camCanvas.hidden = true;
            camPreviewImg.src = URL.createObjectURL(camBlob);
            camPreviewImg.hidden = false;
            camShot.hidden = true;
            camRetake.hidden = false;
            camUse.hidden = false;
            camSwitch.hidden = true;
            camShowError('');
        }, 'image/jpeg', 0.9);
    }

    async function camUseShot() {
        if (!camBlob) return;
        const file = camBlob;
        closeCamera();
        const previewUrl = URL.createObjectURL(file);
        let w = null, h = null;
        try {
            const bmp = await createImageBitmap(file);
            w = bmp.width; h = bmp.height;
            if (bmp.close) bmp.close();
        } catch (_) {}
        pendingFiles.push({ file: file, kind: 'image', previewUrl: previewUrl, w: w, h: h });
        renderAttachPreview();
        attachSetStatus('Foto bereit.', 'ok');
        await sendM();
    }

    if (camShot) camShot.addEventListener('click', camShoot);
    if (camUse) camUse.addEventListener('click', camUseShot);
    if (camRetake) camRetake.addEventListener('click', () => {
        if (camPreviewImg && camPreviewImg.src) { try { URL.revokeObjectURL(camPreviewImg.src); } catch (_) {} }
        camPreviewImg.removeAttribute('src');
        camBlob = null;
        camStart();
    });
    if (camClose) camClose.addEventListener('click', closeCamera);
    if (camSwitch) camSwitch.addEventListener('click', () => {
        camFacing = camFacing === 'user' ? 'environment' : 'user';
        camStart();
    });
    if (cameraModal) cameraModal.addEventListener('click', (e) => { if (e.target === cameraModal) closeCamera(); });

    // ---------- Standort ----------
    function requestLocation() {
        if (!navigator.geolocation) { attachSetStatus('Standort wird von diesem Browser nicht unterstützt.', 'err'); return; }
        attachSetStatus('Standort wird ermittelt...', '');
        navigator.geolocation.getCurrentPosition((pos) => {
            clearPendingFilesOnly();
            pendingAttachment = {
                kind: 'location',
                lat: Number(pos.coords.latitude.toFixed(6)),
                lng: Number(pos.coords.longitude.toFixed(6)),
                accuracy: Math.round(pos.coords.accuracy || 0)
            };
            closeAttachSheet();
            renderAttachPreview();
            attachSetStatus('Standort bereit.', 'ok');
        }, (err) => {
            let msg = 'Standort konnte nicht ermittelt werden.';
            if (err && err.code === 1) msg = 'Standortzugriff wurde verweigert. Bitte in den Browser-Einstellungen erlauben.';
            else if (err && err.code === 2) msg = 'Position nicht verfügbar.';
            else if (err && err.code === 3) msg = 'Zeitüberschreitung beim Ermitteln des Standorts.';
            attachSetStatus(msg, 'err');
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    }

    // ---------- Abstimmung ----------
    const pollModal = document.getElementById('pollModal');
    const pollOptionsEl = document.getElementById('pollOptions');
    const pollQuestionEl = document.getElementById('pollQuestion');
    const pollStatusEl = document.getElementById('pollStatus');

    function pollSetStatus(text, kind) {
        if (!pollStatusEl) return;
        pollStatusEl.textContent = text || '';
        pollStatusEl.style.color = kind === 'err' ? 'var(--neon-magenta)' : 'var(--text-secondary)';
    }

    function pollAddOption(value) {
        if (!pollOptionsEl) return;
        if (pollOptionsEl.children.length >= 8) { pollSetStatus('Maximal 8 Optionen.', 'err'); return; }
        const row = document.createElement('div');
        row.className = 'poll-option-row';
        row.innerHTML = '<input type="text" class="settings-input po-input" maxlength="80" placeholder="Option ' + (pollOptionsEl.children.length + 1) + '">' +
            '<button type="button" class="po-del" title="Entfernen" aria-label="Option entfernen">✕</button>';
        row.querySelector('.po-del').addEventListener('click', () => {
            if (pollOptionsEl.children.length <= 2) { pollSetStatus('Mindestens 2 Optionen.', 'err'); return; }
            row.remove();
        });
        pollOptionsEl.appendChild(row);
        const input = row.querySelector('.po-input');
        if (value) input.value = value;
        input.focus();
    }

    function openPollModal() {
        if (!pollModal) return;
        closeAttachSheet();
        pollModal.style.display = 'flex';
        if (pollQuestionEl) pollQuestionEl.value = '';
        if (pollOptionsEl) pollOptionsEl.innerHTML = '';
        pollAddOption('');
        pollAddOption('');
        pollSetStatus('', '');
        setTimeout(() => { try { pollQuestionEl.focus(); } catch (_) {} }, 40);
    }

    function closePollModal() { if (pollModal) pollModal.style.display = 'none'; }

    function submitPoll() {
        const question = (pollQuestionEl?.value || '').trim();
        const options = Array.from(pollOptionsEl ? pollOptionsEl.querySelectorAll('.po-input') : [])
            .map(i => i.value.trim())
            .filter(v => v.length);
        if (question.length < 2) { pollSetStatus('Bitte eine Frage eingeben.', 'err'); return; }
        if (options.length < 2) { pollSetStatus('Bitte mindestens 2 Optionen ausfüllen.', 'err'); return; }
        clearPendingFilesOnly();
        pendingAttachment = { kind: 'poll', question: question.slice(0, 200), options: options.slice(0, 8), multiple: false };
        closePollModal();
        renderAttachPreview();
        attachSetStatus('Abstimmung bereit.', 'ok');
        sendM();
    }

    if (document.getElementById('pollAddOption')) document.getElementById('pollAddOption').addEventListener('click', () => pollAddOption(''));
    if (document.getElementById('pollSendBtn')) document.getElementById('pollSendBtn').addEventListener('click', submitPoll);

    // ---------- Ereignis ----------
    const eventModal = document.getElementById('eventModal');
    const eventStatusEl = document.getElementById('eventStatus');

    function eventSetStatus(text, kind) {
        if (!eventStatusEl) return;
        eventStatusEl.textContent = text || '';
        eventStatusEl.style.color = kind === 'err' ? 'var(--neon-magenta)' : 'var(--text-secondary)';
    }

    function toLocalInputValue(d) {
        const pad = (n) => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function openEventModal() {
        if (!eventModal) return;
        closeAttachSheet();
        const start = document.getElementById('eventStart');
        const end = document.getElementById('eventEnd');
        const now = new Date();
        const soon = new Date(now.getTime() + 60 * 60 * 1000);
        const later = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        ['eventTitle', 'eventLocation', 'eventDesc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        if (start && !start.value) start.value = toLocalInputValue(soon);
        if (end && !end.value) end.value = toLocalInputValue(later);
        eventModal.style.display = 'flex';
        eventSetStatus('', '');
        setTimeout(() => { try { document.getElementById('eventTitle')?.focus(); } catch (_) {} }, 40);
    }

    function closeEventModal() { if (eventModal) eventModal.style.display = 'none'; }

    function submitEvent() {
        const title = (document.getElementById('eventTitle')?.value || '').trim();
        const location = (document.getElementById('eventLocation')?.value || '').trim();
        const desc = (document.getElementById('eventDesc')?.value || '').trim();
        const startsAt = document.getElementById('eventStart')?.value || '';
        const endsAt = document.getElementById('eventEnd')?.value || '';
        if (title.length < 2) { eventSetStatus('Bitte einen Titel eingeben.', 'err'); return; }
        if (!startsAt) { eventSetStatus('Bitte einen Beginn wählen.', 'err'); return; }
        if (endsAt && new Date(endsAt) < new Date(startsAt)) { eventSetStatus('Das Ende liegt vor dem Beginn.', 'err'); return; }
        clearPendingFilesOnly();
        pendingAttachment = {
            kind: 'event',
            title: title.slice(0, 120),
            description: desc.slice(0, 1000),
            location: location.slice(0, 160),
            starts_at: startsAt,
            ends_at: endsAt || null
        };
        closeEventModal();
        renderAttachPreview();
        attachSetStatus('Ereignis bereit.', 'ok');
        sendM();
    }

    if (document.getElementById('eventSendBtn')) document.getElementById('eventSendBtn').addEventListener('click', submitEvent);

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.close;
            if (id === 'pollModal') closePollModal();
            if (id === 'eventModal') closeEventModal();
        });
    });
    if (pollModal) pollModal.addEventListener('click', (e) => { if (e.target === pollModal) closePollModal(); });
    if (eventModal) eventModal.addEventListener('click', (e) => { if (e.target === eventModal) closeEventModal(); });

    if (audioBtn) {
        let mediaRecorder = null, audioChunks = [], recStream = null, recAnalyser = null, recAnim = null, recStart = 0, recTimerInt = null;
        const audioRec = document.getElementById('audioRec');
        const waveCanvas = document.getElementById('waveCanvas');
        const recTimer = document.getElementById('recTimer');
        const recDelete = document.getElementById('recDelete');
        const recSend = document.getElementById('recSend');
        audioBtn.onclick = async () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') return;
            try { recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
            catch (e) { alert('Mikrofon nicht verfügbar'); return; }
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(recStream);
            recAnalyser = audioCtx.createAnalyser(); recAnalyser.fftSize = 64; source.connect(recAnalyser);
            mediaRecorder = new MediaRecorder(recStream); audioChunks = [];
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
            mediaRecorder.start();
            if (audioRec) audioRec.style.display = 'inline-flex';
            if (chatInput) chatInput.style.display = 'none';
            recStart = Date.now();
            recTimerInt = setInterval(() => { const d = Math.floor((Date.now()-recStart)/1000); if (recTimer) recTimer.textContent = String(Math.floor(d/60)).padStart(2,'0')+':'+String(d%60).padStart(2,'0'); }, 500);
            const draw = () => { if (!recAnalyser) return; const buf = new Uint8Array(recAnalyser.frequencyBinCount); recAnalyser.getByteFrequencyData(buf); const ctx = waveCanvas.getContext('2d'); ctx.clearRect(0,0,waveCanvas.width,waveCanvas.height); const barW = waveCanvas.width / buf.length; for (let i=0;i<buf.length;i++){ const h=(buf[i]/255)*waveCanvas.height; ctx.fillStyle='#ff6b9d'; ctx.fillRect(i*barW, waveCanvas.height-h, barW-1, h); } recAnim = requestAnimationFrame(draw); };
            draw();
        };
        if (recDelete) recDelete.onclick = () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
            if (recStream) recStream.getTracks().forEach(t=>t.stop());
            if (recAnim) cancelAnimationFrame(recAnim);
            if (recTimerInt) clearInterval(recTimerInt);
            mediaRecorder = null; recAnalyser = null;
            if (audioRec) audioRec.style.display = 'none';
            if (chatInput) chatInput.style.display = 'block';
        };
        if (recSend) recSend.onclick = async () => {
            if (!mediaRecorder) return;
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const file = new File([blob], 'audio_'+Date.now()+'.webm', { type: 'audio/webm' });
                pendingFile = file;
                if (recStream) recStream.getTracks().forEach(t=>t.stop());
                if (recAnim) cancelAnimationFrame(recAnim);
                if (recTimerInt) clearInterval(recTimerInt);
                mediaRecorder = null; recAnalyser = null;
                if (audioRec) audioRec.style.display = 'none';
                if (chatInput) chatInput.style.display = 'block';
                if (previewChip) { previewChip.style.display='inline-flex'; previewChip.innerHTML = '<span>Audio bereit</span><button id="cancelFile">✕</button>'; document.getElementById('cancelFile').onclick=()=>{pendingFile=null;previewChip.style.display='none';previewChip.innerHTML='';}; }
                await sendM();
            };
            mediaRecorder.stop();
        };
    }
    let typingUsers = new Set();
    let typingTO;
    let aiTypingTO = null;
    function setAiTyping(on) {
        if (!typingIndicator || !typingText) return;
        if (on) {
            typingIndicator.style.display = 'flex';
            typingText.textContent = '437AI DENKT...';
            if (aiTypingTO) clearTimeout(aiTypingTO);
            aiTypingTO = setTimeout(() => setAiTyping(false), 45000);
        } else {
            if (aiTypingTO) clearTimeout(aiTypingTO);
            aiTypingTO = null;
            updT();
        }
    }

    const EMOJIS = ['👍','❤️','😂','😮','😢','🙏','🔥','🎉','👀','💯','😍','🤔','😎','😭','💀','✨'];
    const COLORS = ['#ff6b9d','#ffb347','#c77dff','#00ffff','#00ff88','#ff4d6d','#ffd166','#7dd3fc','#f472b6','#a3e635','#fb923c','#34d399'];
    function getUserChatColor(uid, profile) {
        if (!profile) profile = (profilesCache||[]).find(p => p.id === uid);
        if (profile && profile.chat_color && /^#[0-9A-Fa-f]{6}$/.test(profile.chat_color)) {
            return profile.chat_color;
        }
        return CHAT_DEFAULT_COLOR;
    }
    const REACT_EMOJIS = ['👍','❤️','😂','😮','😢','🙏'];

    async function loadReactions(msgIds) {
        if (!msgIds.length) return {};
        const { data } = await supabaseClient.from('message_reactions').select('*').in('message_id', msgIds);
        const out = {};
        if (data) data.forEach(r => { if (!out[r.message_id]) out[r.message_id] = {}; if (!out[r.message_id][r.emoji]) out[r.message_id][r.emoji] = []; out[r.message_id][r.emoji].push(r.user_id); });
        return out;
    }

    // Debounced loadMsgs für Realtime-Updates (verhindert Doppel-Render)
let loadMsgsTimer = null;
let msgWindow = 120;
let hasOlderMsgs = true;
let loadingMsgs = false;
function debouncedLoadMsgs() {
    if (loadMsgsTimer) clearTimeout(loadMsgsTimer);
    loadMsgsTimer = setTimeout(() => { loadMsgs({ preserveScroll: true }); }, 250);
}

    async function renderPinnedBar() {
        const bar = document.getElementById('pinnedBar');
        if (!bar) return;
        try {
            const { data } = await supabaseClient.from('messages').select('id,user_id,content,edited_content,attachment,deleted_at').eq('channel', currentChannel).eq('pinned',true).is('deleted_at',null).order('pinned_at',{ascending:false}).limit(10);
            if (!data || !data.length) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
            const ids = [...new Set(data.map(m=>m.user_id))];
            const { data: profs } = await supabaseClient.from('profiles').select('id,nickname,chat_color').in('id', ids);
            const pmap = {}; (profs||[]).forEach(p=>pmap[p.id]=p);
            bar.innerHTML = '<div class="pb-title">📌 ANGEHEFTET</div>' + data.map(m => {
                const pr = pmap[m.user_id] || {};
                const n = (pr.nickname || '??').toUpperCase();
                const uc = getUserChatColor(m.user_id, pr);
                const txt = (m.content || m.edited_content) ? esc((m.edited_content||m.content||'').slice(0,60)) : esc(attachLabel(m.attachment));
                return '<div class="pb-item" data-jump="'+m.id+'"><span class="pb-author" style="color:'+uc+'">'+esc(n)+'</span><span class="pb-text">'+txt+'</span></div>';
            }).join('');
            bar.style.display = 'block';
            bar.querySelectorAll('.pb-item').forEach(el => {
                el.onclick = () => {
                    const id = el.dataset.jump;
                    const target = chatMessages.querySelector('.message[data-id="'+id+'"]');
                    if (target) { target.scrollIntoView({behavior:'smooth',block:'center'}); target.classList.add('highlight-msg'); setTimeout(()=>target.classList.remove('highlight-msg'),1200); }
                };
            });
        } catch (e) { console.error('pinned bar failed', e); }
    }

window.loadMsgs = async function loadMsgs(opts = {}) {
        if (loadingMsgs) return;
        loadingMsgs = true;
        try { localStorage.setItem(unreadKey(currentChannel), '0'); } catch(_) {}
        try {
        if (isDrops437Channel(currentChannel)) {
            await loadDrops437Videos();
            renderDrops437Channel();
            updateDrops437InputState();
            loadingMsgs = false;
            return;
        }
        const preserveScroll = !!opts.preserveScroll;
        const beforeHeight = chatMessages.scrollHeight;
        const beforeTop = chatMessages.scrollTop;
        // Audio-Player beim Rendern stoppen und clearen, damit keine tick()-Loops hängen bleiben
        document.querySelectorAll('.audio-player').forEach(player => {
            const a = player._audio;
            if (a && !a.paused) a.pause();
            delete player._audio;
        });
        const { data: msgs, error: msgsErr } = await supabaseClient.from('messages').select('id,user_id,content,edited_content,deleted_at,created_at,edited_at,media_url,media_type,attachment,reply_to,pinned,pinned_at,pinned_by,pinned_until').eq('channel', currentChannel).order('created_at',{ascending:false}).limit(msgWindow);
        if (msgsErr || !msgs) return;
        // Filter: Hide messages from blocked users (client-side, since RLS is open)
        const myProf = getMyProfile();
        const blockedSet = new Set(myProf?.blocked_users || []);
        const filtered = msgs.filter(m => !blockedSet.has(m.user_id));
        const ordered = filtered.slice().reverse();
        loadedMsgs = ordered;
        const ids = [...new Set(ordered.map(m=>m.user_id))];
        const { data: profs } = await supabaseClient.from('profiles').select('id,nickname,avatar_url,bio,role,banned,banned_until,last_seen,notify_push,chat_color').in('id', ids);
        const map = {}; if (profs) profs.forEach(p=>map[p.id]=p);
        // Resolve reply-to quoted messages (for quote preview)
        const replyIds = [...new Set(ordered.map(m=>m.reply_to).filter(Boolean))];
        const missingReplyIds = replyIds.filter(id => !ordered.some(m=>m.id===id) && !quoteCache[id]);
        if (missingReplyIds.length) {
            const { data: qmsgs } = await supabaseClient.from('messages').select('id,user_id,content,edited_content,attachment,deleted_at').in('id', missingReplyIds);
            if (qmsgs) qmsgs.forEach(q => { quoteCache[q.id] = q; });
        }
        if (profilesCache) { profs && profs.forEach(p => { const i = profilesCache.findIndex(x=>x.id===p.id); if (i>=0) profilesCache[i]={...profilesCache[i],...p}; else profilesCache.push(p); }); }

        const recent = ordered;
        hasOlderMsgs = msgs.length >= msgWindow;
        const reactions = await loadReactions(recent.map(m=>m.id));
        const votesByMsg = new Map();
        const rsvpsByMsg = new Map();
        if (recent.length) {
            const mids = recent.map(m => m.id);
            try {
                const { data: vrows } = await supabaseClient.from('message_votes').select('message_id,user_id,option_index').in('message_id', mids);
                (vrows || []).forEach(v => {
                    if (!votesByMsg.has(v.message_id)) votesByMsg.set(v.message_id, []);
                    votesByMsg.get(v.message_id).push(v);
                });
            } catch (_) {}
            try {
                const { data: rrows } = await supabaseClient.from('event_rsvps').select('message_id,user_id,status').in('message_id', mids);
                (rrows || []).forEach(r => {
                    if (!rsvpsByMsg.has(r.message_id)) rsvpsByMsg.set(r.message_id, []);
                    rsvpsByMsg.get(r.message_id).push(r);
                });
            } catch (_) {}
        }

        // Profile fuer Abstimmungen/Zusagen (Avatar-Anzeige)
        attachUserMap.clear();
        Object.keys(map).forEach(id => { if (map[id]) attachUserMap.set(id, map[id]); });
        const attachUids = [];
        votesByMsg.forEach(arr => arr.forEach(v => { if (v.user_id && !attachUserMap.has(v.user_id)) attachUids.push(v.user_id); }));
        rsvpsByMsg.forEach(arr => arr.forEach(r => { if (r.user_id && !attachUserMap.has(r.user_id)) attachUids.push(r.user_id); }));
        const missingAttach = [...new Set(attachUids)];
        if (missingAttach.length) {
            try {
                const { data: arows } = await supabaseClient.from('profiles').select('id,nickname,avatar_url').in('id', missingAttach);
                (arows || []).forEach(p => attachUserMap.set(p.id, p));
            } catch (_) {}
        }

        let lastSeen = parseInt(localStorage.getItem(channelKey(currentChannel)) || '0', 10);
        if (!lastSeen && recent.length) { lastSeen = recent[recent.length-1].id; localStorage.setItem(channelKey(currentChannel), String(lastSeen)); }
        const wasAway = localStorage.getItem('wasAway') === '1';
        localStorage.removeItem('wasAway');
        let firstNewIdx = -1;
        if (wasAway) {
            for (let i=0;i<recent.length;i++){ if (recent[i].id > lastSeen) { firstNewIdx = i; break; } }
        }
        localStorage.removeItem('wasAway');
        const reactSig = Object.keys(reactions).sort().map(k => k+':'+Object.keys(reactions[k]).sort().map(e=>e+':'+(reactions[k][e]||[]).length).join(',')).join(';');
        const voteSig = Array.from(votesByMsg.entries()).sort((a,b)=>a[0]-b[0]).map(([mid, arr]) => mid + ':' + arr.map(v => v.user_id.slice(0,8) + '=' + v.option_index).sort().join(',')).join(';');
        const rsvpSig = Array.from(rsvpsByMsg.entries()).sort((a,b)=>a[0]-b[0]).map(([mid, arr]) => mid + ':' + arr.map(v => v.user_id.slice(0,8) + '=' + v.status).sort().join(',')).join(';');
        const sig = recent.map(m=>m.id+':'+(m.edited_at||'')+':'+(m.deleted_at||'')+':'+(m.pinned?'1':'0')+':'+(m.attachment?'a':'')).join(',') + '|' + reactSig + '|' + voteSig + '|' + rsvpSig + '|' + firstNewIdx + '|w' + msgWindow;
        const loadOlderBtn = document.getElementById('loadOlderBtn');
        if (loadOlderBtn) { loadOlderBtn.style.display = hasOlderMsgs ? 'block' : 'none'; loadOlderBtn.disabled = false; }
        if (chatMessages.dataset.sig === sig) return;
        attachIndex.clear();
        chatMessages.innerHTML = '';
        if (loadOlderBtn) chatMessages.appendChild(loadOlderBtn);
        recent.forEach((m, idx) => {
            if (idx === firstNewIdx && firstNewIdx > 0) {
                const div = document.createElement('div'); div.className = 'new-msg-divider'; div.innerHTML = '<span>NEUE NACHRICHTEN</span>';
                chatMessages.appendChild(div);
            }
            const pr = map[m.user_id]||{};
            const t = new Date(m.created_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
            const a = pr.avatar_url||'https://api.dicebear.com/7.x/pixel-art/svg?seed='+encodeURIComponent(pr.nickname||'x');
            const n = (pr.nickname||'??').toUpperCase();
            const uc = getUserChatColor(m.user_id, pr);
            const isOwn = m.user_id === user.id;
            const deleted = !!m.deleted_at;
            const rawContent = deleted ? '<em style="color:var(--text-secondary);">NACHRICHT GELÖSCHT</em>' : esc(m.edited_content || m.content).replace(/@(\w+)/g, '<span class="mention">@$1</span>');
            const edited = (m.edited_at && !deleted) ? ' <span class="edited-tag" data-edit-hist="'+m.id+'" style="cursor:pointer;">(BEARBEITET)</span>' : '';
            let mediaHtml = '';
            if (!deleted && m.media_url) {
                if (m.media_type && m.media_type.startsWith('image/')) mediaHtml = '<img src="'+m.media_url+'" class="msg-media msg-img" loading="lazy" decoding="async">';
                else if (m.media_type && m.media_type.startsWith('audio/')) mediaHtml = '<div class="audio-player" data-src="'+m.media_url+'"><button class="ap-play">▶</button><div class="ap-bar"><div class="ap-progress"></div></div><span class="ap-time">0:00</span></div>';
                else if (m.media_type && m.media_type.startsWith('video/')) mediaHtml = '<video controls src="'+m.media_url+'" class="msg-media"></video>';
            }
            let attHtml = '';
            if (!deleted && m.attachment) {
                attachIndex.set(m.id, m.attachment);
                attHtml = renderAttachment(m, votesByMsg.get(m.id) || [], rsvpsByMsg.get(m.id) || []);
            }
            const d = document.createElement('div'); d.className='message ' + (isOwn ? 'own' : 'other'); d.dataset.id=m.id;
            if (!deleted && m.attachment) d._attLabel = attachLabel(m.attachment);
            const is437AI = (pr.nickname === '437AI' || m.user_id === '43700000-0000-4000-8000-000000437001');
            const avatarSrc = is437AI ? 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=437AI-Core&backgroundColor=020617&eyes=roundFrame01,roundFrame02,bulging&mouth=smile01,smile02,square01' : a;
            const nickClass = is437AI ? 'message-nickname rainbow-nick' : 'message-nickname';
            const nickStyle = is437AI ? '' : ' style="color:'+uc+'"';
            let html = '<div class="message-avatar'+(is437AI?' ai-avatar':'')+'" data-user-id="'+m.user_id+'"><img src="'+avatarSrc+'" width="26" height="26" loading="lazy" decoding="async"></div><div class="message-side"><div class="message-meta">';
            if (isOwn && !deleted) html += '<span class="msg-actions"><button class="msg-act" data-edit="'+m.id+'" title="Bearbeiten"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="msg-act" data-del="'+m.id+'" title="Löschen"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button></span>';
            // Nickname + Uhrzeit immer anzeigen
            html += '<span class="message-nickname '+nickClass+'"'+nickStyle+'>'+esc(n)+'</span>';
            html += '<span class="message-time">'+t+'</span>';
            // Reply-Button für alle nicht-gelöschten Nachrichten (neben Bearbeiten/Löschen)
            if (!deleted) html += '<button class="msg-act reply-btn" data-reply="'+m.id+'" title="Antworten">↩</button>';
            if (!deleted && !isOwn) html += '<button class="report-btn" data-report="'+m.id+'" title="Melden">🚩</button>';
            if (!deleted && isAdmin()) html += '<button class="admin-del-btn" data-adm-del="'+m.id+'" title="Löschen (Admin)">🗑</button>';
            if (!deleted && isAdmin()) html += '<button class="pin-btn '+(m.pinned?'pinned':'')+'" data-pin="'+m.id+'" title="Anpinnen">📌</button>';
            html += '</div>';
            let quoteHtml = '';
            if (m.reply_to) {
                const q = quoteCache[m.reply_to] || (ordered.find(x=>x.id===m.reply_to));
                if (q && !q.deleted_at) {
                    const qprof = map[q.user_id] || (profilesCache||[]).find(p=>p.id===q.user_id) || {};
                    const qname = (qprof.nickname || '??').toUpperCase();
                    const qcolor = getUserChatColor(q.user_id, qprof);
                    const qtext = (q.content || q.edited_content) ? esc((q.edited_content||q.content||'').slice(0,80)) : esc(attachLabel(q.attachment));
                    quoteHtml = '<div class="reply-quote" data-jump="'+q.id+'"><span class="rq-author" style="color:'+qcolor+'">'+esc(qname)+'</span><span class="rq-text">'+qtext+'</span></div>';
                } else {
                    quoteHtml = '<div class="reply-quote deleted"><span class="rq-text">Nachricht gelöscht</span></div>';
                }
            }
            html += quoteHtml;
            html += '<div class="message-bubble"><div class="message-text" id="mt_'+m.id+'">'+rawContent+edited+'</div>';
            if (mediaHtml) html += '<div class="message-media-wrap">'+mediaHtml+'</div>';
            if (attHtml) html += '<div class="message-attach">'+attHtml+'</div>';
            html += '<div class="reactions" data-msg="'+m.id+'">';
            const r = reactions[m.id]||{};
            REACT_EMOJIS.forEach(e => {
                const users = r[e]||[];
                const active = users.includes(user.id) ? 'active' : '';
                if (users.length) html += '<button class="react-btn '+active+'" data-msg="'+m.id+'" data-emoji="'+e+'">'+e+' <span>'+users.length+'</span></button>';
            });
            html += '</div></div></div>';
            d.innerHTML = html;
            chatMessages.appendChild(d);
        });
        // Async: enrich messages with link previews (non-blocking)
        recent.forEach(m => {
            if (m.deleted_at || !m.content) return;
            const urls = m.content.match(URL_REGEX) || [];
            if (!urls.length) return;
            const textEl = chatMessages.querySelector('#mt_' + m.id);
            if (!textEl) return;
            const origText = textEl.textContent;
            urls.forEach(async (url) => {
                const preview = await fetchLinkPreview(url);
                if (preview && textEl.textContent.includes(url)) {
                    const cardHtml = renderLinkPreviewCard(preview);
                    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    textEl.innerHTML = textEl.innerHTML.replace(new RegExp(escapedUrl), cardHtml);
                }
            });
        });
        // notifications for mentions
        const notifyEnabled = localStorage.getItem('437core_notify') === '1';
        if (notifyEnabled) {
            let lastNotified = parseInt(localStorage.getItem('437core_lastnotified') || '0', 10);
            recent.forEach(m => {
                if (m.id <= lastNotified) return;
                if (m.user_id === user.id) return;
                const txt = (m.content || '');
                const mentionRegex = new RegExp('@'+user.nickname+'\\b', 'i');
                if (mentionRegex.test(txt)) {
                    const sender = map[m.user_id]?.nickname || 'Jemand';
                    const body = sender + ': ' + txt.slice(0,120);

                    // System notification when tab is hidden OR user was away
                    if ('Notification' in window && Notification.permission === 'granted') {
                        if (document.hidden || localStorage.getItem('wasAway') === '1') {
                            new Notification('437 Core', { body, icon: 'img/favicon-48x48.png' });
                        }
                    }
                }
                lastNotified = Math.max(lastNotified, m.id);
            });
            localStorage.setItem('437core_lastnotified', String(lastNotified));
            localStorage.removeItem('wasAway');
        }
        if (preserveScroll) {
            const newHeight = chatMessages.scrollHeight;
            chatMessages.scrollTop = beforeTop + (newHeight - beforeHeight);
        } else if (firstNewIdx >= 0) {
            setTimeout(() => { chatMessages.scrollTop = Math.max(0, (chatMessages.scrollHeight / Math.max(1,recent.length)) * firstNewIdx - 100); }, 50);
        } else {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        if (chatMessages._updateLastSeen) chatMessages.removeEventListener('scroll', chatMessages._updateLastSeen);
        let lastSeenTimer = null;
        const updateLastSeen = () => {
            if (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 80) {
                if (lastSeenTimer) return;
                lastSeenTimer = setTimeout(() => {
                    if (!recent.length) return;
                    const maxId = recent[recent.length - 1].id;
                    localStorage.setItem(channelKey(currentChannel), String(maxId));
                    lastSeenTimer = null;
                }, 30000);
            }
        };
        chatMessages._updateLastSeen = updateLastSeen;
        chatMessages.addEventListener('scroll', updateLastSeen);
        updateLastSeen();
        applyMessageFilter();
        updateOnlineDots();
        chatMessages.dataset.sig = sig;
        } catch (e) {
            console.error('loadMsgs failed', e);
        } finally {
            loadingMsgs = false;
        }
    }


    // Edit history popup
    async function showEditHistory(mid, anchor) {
        const pop = document.createElement('div');
        pop.className = 'edit-history-pop';
        pop.innerHTML = '<div class="eh-title">BEARBEITUNGSHISTORIE</div><div class="eh-empty">Wird geladen...</div>';
        const rect = anchor.getBoundingClientRect();
        pop.style.top = (rect.bottom + 4) + 'px';
        pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 280)) + 'px';
        document.body.appendChild(pop);
        try {
            const { data } = await supabaseClient.from('message_edits').select('*').eq('message_id', mid).order('edited_at', { ascending: false });
            if (!data || !data.length) {
                pop.querySelector('.eh-empty').textContent = 'Keine Bearbeitungen';
                return;
            }
            pop.innerHTML = '<div class="eh-title">BEARBEITUNGSHISTORIE</div>' + data.map(e => {
                const editor = (profilesCache||[]).find(p=>p.id===e.editor_id);
                const name = editor ? editor.nickname : e.editor_id.slice(0,8);
                const time = new Date(e.edited_at).toLocaleString('de-DE');
                return '<div class="eh-item"><span class="eh-editor">'+esc(name)+'</span><span class="eh-time">'+time+'</span></div>';
            }).join('');
        } catch (e) {
            pop.innerHTML = '<div class="eh-title">BEARBEITUNGSHISTORIE</div><div class="eh-empty">Fehler beim Laden</div>';
        }
        setTimeout(() => {
            document.addEventListener('click', function closeEH(ev) {
                if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', closeEH); }
            }, { once: true });
        }, 100);
    }

    // URL detection and preview
    const URL_REGEX = /(https?:\/\/[^\s<]+[^<\s.,;!?')\]]])/g;
    async function fetchLinkPreview(url) {
        try {
            const resp = await fetch(SUPABASE_URL + '/functions/v1/link-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
                body: JSON.stringify({ url })
            });
            if (!resp.ok) return null;
            return await resp.json();
        } catch (e) { return null; }
    }
    function renderLinkPreviewCard(preview) {
        if (!preview || !preview.title) return '';
        const imgHtml = preview.image ? '<img class="lpc-image" src="'+esc(preview.image)+'" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">' : '';
        return '<div class="link-preview-card" onclick="window.open(\''+esc(preview.url)+'\',\'_blank\')">'
            + imgHtml
            + '<div class="lpc-content">'
            + '<div class="lpc-title">'+esc(preview.title)+'</div>'
            + '<div class="lpc-desc">'+esc(preview.description||'')+'</div>'
            + '<div class="lpc-domain">'+esc(preview.domain||'')+'</div>'
            + '</div></div>';
    }
    async function enrichMessageWithPreviews(text) {
        const urls = text.match(URL_REGEX) || [];
        if (!urls.length) return esc(text);
        let html = esc(text);
        for (const url of urls) {
            const preview = await fetchLinkPreview(url);
            if (preview) {
                const cardHtml = renderLinkPreviewCard(preview);
                // Escape the URL for regex replacement
                const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                html = html.replace(new RegExp(escapedUrl), cardHtml);
            }
        }
        return html;
    }
    function updT(){ const names=[...typingUsers].filter(n=>n!==user.nickname); if(names.length===0){typingIndicator.style.display='none';return;} if(names.length===1) typingText.textContent=names[0].toUpperCase()+' SCHREIBT...'; else if(names.length===2) typingText.textContent=names[0].toUpperCase()+' & '+names[1].toUpperCase()+' SCHREIBEN...'; else typingText.textContent='MEHRERE SCHREIBEN...'; typingIndicator.style.display='flex'; }
    chatInput.maxLength = 2000;
    const inputCounter = document.createElement('div');
    inputCounter.id = 'inputCounter';
    inputCounter.style.cssText = 'position:absolute;right:12px;bottom:2px;font-size:0.58rem;color:var(--text-secondary);opacity:.7;pointer-events:none;font-family:Orbitron,monospace;';
    if (chatInput && chatInput.parentElement) { chatInput.parentElement.style.position = 'relative'; chatInput.parentElement.appendChild(inputCounter); }
    const updCounter = () => { if (!chatInput) return; const n = (chatInput.value||'').length; if (inputCounter) inputCounter.textContent = n > 0 ? n + '/2000' : ''; };
    chatInput.oninput = async ()=>{ updCounter();
 
        supabaseClient.channel('t2').send({type:'broadcast',event:'t',payload:{n:user.nickname,o:true}}); clearTimeout(typingTO); typingTO=setTimeout(()=>{ supabaseClient.channel('t2').send({type:'broadcast',event:'t',payload:{n:user.nickname,o:false}}); },900); 
        // mention autocomplete
        const val = chatInput.value;
        const caret = chatInput.selectionStart;
        const before = val.slice(0, caret);
        const m = before.match(/@(\w*)$/);
        if (m) {
            const q = m[1].toLowerCase();
            const profs = await getProfiles();
            const matches = profs.filter(p => p.nickname.toLowerCase().startsWith(q) && p.id !== user.id).slice(0,8);
            if (matches.length) {
                mentionDrop.style.display = 'block';
                mentionDrop.innerHTML = matches.map(p=>{
                    const av = p.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed='+encodeURIComponent(p.nickname);
                    return '<button class="mention-item" data-name="'+p.nickname+'"><img src="'+av+'" class="mention-avatar" width="22" height="22" loading="lazy" decoding="async"><span>@'+p.nickname+'</span></button>';
                }).join('');
                mentionDrop.querySelectorAll('.mention-item').forEach(b=>{
                    b.onclick = () => {
                        const idx = before.lastIndexOf('@');
                        chatInput.value = val.slice(0, idx) + '@'+b.dataset.name+' ' + val.slice(caret);
                        mentionDrop.style.display='none';
                        chatInput.focus();
                    };
                });
            } else { mentionDrop.style.display='none'; }
         } else { mentionDrop.style.display='none'; }
         // Draft save (debounced)
         clearTimeout(draftTimer);
         draftTimer = setTimeout(() => {
             try { if ((chatInput.value||'').trim()) localStorage.setItem(DRAFT_KEY, chatInput.value); else localStorage.removeItem(DRAFT_KEY); } catch(_){}
         }, 300);
     };
    chatSend.onclick = sendM; chatInput.onkeypress = e=>{ if(e.key==='Enter'){ e.preventDefault(); sendM(); }};
    const replyCancelBtn = document.getElementById('replyCancelBtn');
    if (replyCancelBtn) replyCancelBtn.onclick = () => {
        replyToId = null;
        const rp = document.getElementById('replyPreview'); if (rp) rp.style.display='none';
        const vf3 = document.getElementById('voiceFixedBtn'); if (vf3) vf3.style.display = '';
        const pc = document.getElementById('previewChip'); if (pc) { pc.style.display='none'; pc.innerHTML=''; }
    };
    // Restore draft
    try { const d = localStorage.getItem(DRAFT_KEY); if (d && !(chatInput.value||'').trim()) { chatInput.value = d; updCounter(); } } catch(_) {}

    // Channel switcher
    async function loadDmUsers() {
        try {
            const { data } = await supabaseClient.from('profiles').select('id,nickname,avatar_url,banned,banned_until,chat_color').neq('id', user.id).neq('nickname', '437AI').order('nickname', { ascending: true }).limit(300);
            const now = new Date();
            dmUsers = (data || []).filter(p => !(p.banned || (p.banned_until && new Date(p.banned_until) > now)));
        } catch (_) { dmUsers = []; }
    }
    let dmRefreshTimer = null;
    let dmLastRefreshAt = 0;
    function scheduleDmRefresh() {
        // Max. ein Reload alle 20 s, auch bei Profil-Stürmen (Realtime)
        const wait = Math.max(1500, 20000 - (Date.now() - dmLastRefreshAt));
        clearTimeout(dmRefreshTimer);
        dmRefreshTimer = setTimeout(async () => {
            dmLastRefreshAt = Date.now();
            await loadDmUsers();
            if (typeof renderChannelStrip === 'function') renderChannelStrip();
        }, wait);
    }
    function channelLabel(ch) {
        if (ch === '437') return '437';
        if (isDrops437Channel(ch)) return 'DROPS 437';
        if (ch.startsWith('dm_')) {
            const ids = ch.slice(3).split('_');
            const shortMe = user.id.slice(0,8);
            const otherId = ids.find(id => id !== shortMe) || ids[0];
            const prof = dmUsers.find(u => u.id.slice(0,8) === otherId) || (profilesCache||[]).find(p=>p.id.slice(0,8)===otherId);
            return prof ? prof.nickname : 'DM';
        }
        return ch;
    }
    function channelAvatar(ch) {
        if (ch === '437') return 'img/logo.png';
        if (isDrops437Channel(ch)) return BOT_AVATAR_URL;
        if (ch.startsWith('dm_')) {
            const ids = ch.slice(3).split('_');
            const shortMe = user.id.slice(0,8);
            const otherId = ids.find(id => id !== shortMe) || ids[0];
            const prof = dmUsers.find(u => u.id.slice(0,8) === otherId) || (profilesCache||[]).find(p=>p.id.slice(0,8)===otherId);
            return prof ? (prof.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(prof.nickname||'x')) : '';
        }
        return '';
    }
    function isMyChannel(ch) {
        if (ch === '437') return true;
        if (isDrops437Channel(ch)) return true;
        if (typeof ch === 'string' && ch.startsWith('dm_')) return ch.includes(user.id) || ch.includes(user.id.slice(0,8));
        if (typeof ch === 'string' && ch.startsWith('voice:')) return true;
        return false;
    }
    function totalUnreadCount() {
        let total = 0;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.startsWith('437core_unread_')) continue;
                const n = parseInt(localStorage.getItem(k) || '0', 10);
                if (Number.isFinite(n) && n > 0) total += n;
            }
        } catch (_) {}
        return total;
    }

    function updateGlobalUnread() {
        const total = totalUnreadCount();
        const badge = document.getElementById('menuUnreadBadge');
        if (badge) {
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : String(total);
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
        document.title = total > 0 ? '(' + total + ') 437 Core' : '437 Core';
    }

    function updateChannelBadges() {
        if (!channelStrip) return;
        channelStrip.querySelectorAll('.channel-item').forEach(el => {
            const ch = el.dataset.ch;
            const badge = el.querySelector('.channel-badge');
            if (!badge) return;
            const n = parseInt(localStorage.getItem(unreadKey(ch))||'0',10);
            if (n > 0) { badge.textContent = n > 9 ? '9+' : String(n); badge.style.display = 'flex'; }
            else { badge.style.display = 'none'; }
        });
        updateGlobalUnread();
    }
    async function loadDrops437Videos(opts = {}) {
        try {
            const limit = Math.max(1, Math.min(60, opts.limit || 30));
            const { data, error } = await supabaseClient
                .from('drops_437_videos')
                .select('id,youtube_video_id,title,description,thumbnail_url,published_at,duration,view_count,category,created_at,drops_437_pinned_videos(video_id)')
                .order('published_at', { ascending: false })
                .limit(limit);
            if (!error && Array.isArray(data)) {
                drops437Videos = data.map(v => ({
                    ...v,
                    pinned: Array.isArray(v.drops_437_pinned_videos) && v.drops_437_pinned_videos.length > 0
                }));
            }
            return drops437Videos;
        } catch (e) {
            console.error('loadDrops437Videos failed', e);
            return drops437Videos;
        }
    }

    async function pollDrops437RSS() {
        try {
            if (!SUPABASE_URL) return null;
            const headers = { 'Content-Type': 'application/json' };
            if (typeof SUPABASE_ANON_KEY !== 'undefined') {
                headers.apikey = SUPABASE_ANON_KEY;
                headers.Authorization = 'Bearer ' + SUPABASE_ANON_KEY;
            }
            const resp = await fetch(SUPABASE_URL + '/functions/v1/drops-437-poller', {
                method: 'POST',
                headers,
                body: JSON.stringify({ source: 'app', channel_id: DROPS_437_YT_CHANNEL_ID, rss_url: DROPS_437_RSS_URL })
            });
            const json = await resp.json().catch(() => null);
            if (resp.ok && json && json.new_videos > 0) {
                await loadDrops437Videos();
                if (isDrops437Channel(currentChannel)) renderDrops437Channel();
            }
            return json;
        } catch (e) {
            console.warn('pollDrops437RSS failed', e);
            return null;
        }
    }

    function renderDrops437Channel() {
        if (!chatMessages) return;
        const allVideos = (drops437Videos || []).slice().sort((a,b) => new Date(b.published_at||0) - new Date(a.published_at||0));
        const videos = filterDrops437Videos(allVideos, drops437Filter);
        const sig = 'drops437|' + videos.map(v => v.id + ':' + (v.youtube_video_id||'') + ':' + (v.category||'') + ':' + (v.pinned?'1':'0')).join(',') + '|' + (isAdmin() ? 'a' : 'u') + '|' + (drops437CategoryFilter||'all') + '|' + (drops437Filter||'');
        if (chatMessages.dataset.sig === sig) { updateDrops437InputState(); return; }
        chatMessages.innerHTML = '';

        // Load reactions from DB before rendering
        const videoIds = videos.map(v => v.id);
        loadDrops437ReactionsFromDB(videoIds).then(() => { renderDrops437ChannelContent(videos, allVideos, sig); });
    }
    function renderDrops437ChannelContent(videos, allVideos, sig) {
        if (!chatMessages) return;

        // Search wrap
        const searchWrap = document.createElement('div');
        searchWrap.className = 'drops437-search-wrap';
        searchWrap.innerHTML =
            '<input type="text" id="drops437Search" class="drops437-search-input" placeholder="🔍 SEARCH VIDEOS..." autocomplete="off">' +
            '<button type="button" id="drops437SearchClear" class="drops437-search-clear" title="Clear" aria-label="Clear search">✕</button>' +
            '<div id="drops437SearchResults" class="drops437-search-count" aria-live="polite"></div>';
        chatMessages.appendChild(searchWrap);

        // Category filter pills
        const categories = getDrops437Categories(allVideos);
        const catWrap = document.createElement('div');
        catWrap.className = 'drops437-filter-wrap';
        const pills = ['Alle'].concat(categories.map(c => c));
        catWrap.innerHTML = pills.map((c, i) => {
            const val = i === 0 ? 'all' : c;
            const active = (drops437CategoryFilter === val) ? ' active' : '';
            return '<button type="button" class="drops437-filter-pill' + active + '" data-cat="' + esc(val) + '">' + (i === 0 ? 'ALLE' : esc(c.toUpperCase())) + '</button>';
        }).join('');
        chatMessages.appendChild(catWrap);
        catWrap.querySelectorAll('.drops437-filter-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                drops437CategoryFilter = btn.dataset.cat;
                try { localStorage.setItem('437core_drops437_category_filter', drops437CategoryFilter); } catch (_) {}
                renderDrops437Channel();
            });
        });

        if (!videos.length) {
            const empty = document.createElement('div');
            empty.className = 'drops437-empty';
            empty.textContent = 'No Drops 437 videos yet. New YouTube uploads will appear here automatically.';
            chatMessages.appendChild(empty);
        } else {
            // Separate pinned and regular videos
            const pinnedVideos = videos.filter(v => v.pinned);
            const regularVideos = videos.filter(v => !v.pinned);

            // Pinned carousel
            if (drops437CarouselTimer) { clearInterval(drops437CarouselTimer); drops437CarouselTimer = null; }
            if (pinnedVideos.length > 0) {
                const pinnedLabel = document.createElement('div');
                pinnedLabel.className = 'drops437-pinned-label';
                pinnedLabel.innerHTML = '📌 <span>PINNED</span> <span style="font-family:Orbitron,monospace;font-size:0.55rem;color:rgba(255,215,0,0.7);">(' + pinnedVideos.length + ')</span>';
                chatMessages.appendChild(pinnedLabel);

                const pinnedCarousel = document.createElement('div');
                pinnedCarousel.className = 'drops437-pinned-carousel';
                pinnedCarousel.setAttribute('role', 'list');
                pinnedCarousel.setAttribute('aria-label', 'Pinned videos');

                pinnedVideos.forEach(v => {
                    const card = createDrops437VideoCard(v, true);
                    pinnedCarousel.appendChild(card);
                });
                chatMessages.appendChild(pinnedCarousel);

                const startDrops437CarouselAuto = () => {
                    if (drops437CarouselTimer) { clearInterval(drops437CarouselTimer); drops437CarouselTimer = null; }
                    if (!pinnedCarousel.isConnected) return;
                    const cards = Array.from(pinnedCarousel.querySelectorAll('.drops437-video-card'));
                    if (cards.length < 2) return;
                    const step = () => {
                        if (!pinnedCarousel.isConnected) { if (drops437CarouselTimer) clearInterval(drops437CarouselTimer); drops437CarouselTimer = null; return; }
                        const maxScroll = pinnedCarousel.scrollWidth - pinnedCarousel.clientWidth;
                        if (maxScroll <= 4) return;
                        const first = cards[0];
                        const cardW = first ? first.getBoundingClientRect().width : 260;
                        const gap = 10;
                        const advance = Math.max(1, Math.round(cardW + gap));
                        let next = pinnedCarousel.scrollLeft + advance;
                        if (next >= maxScroll - 2) next = 0;
                        pinnedCarousel.scrollTo({ left: next, behavior: 'smooth' });
                    };
                    drops437CarouselTimer = setInterval(step, 5000);
                };
                // pause auto-scroll while user interacts
                let resumeTO = null;
                const pauseAuto = () => {
                    if (drops437CarouselTimer) { clearInterval(drops437CarouselTimer); drops437CarouselTimer = null; }
                    if (resumeTO) clearTimeout(resumeTO);
                    resumeTO = setTimeout(startDrops437CarouselAuto, 8000);
                };
                ['pointerdown','touchstart','wheel','mouseenter','focusin'].forEach(ev => pinnedCarousel.addEventListener(ev, pauseAuto, { passive: true }));
                pinnedCarousel.addEventListener('mouseleave', () => { if (resumeTO) clearTimeout(resumeTO); startDrops437CarouselAuto(); });
                // start after layout so scrollWidth/clientWidth are correct
                setTimeout(startDrops437CarouselAuto, 60);
            }

            // Regular videos grid
            const videoGrid = document.createElement('div');
            videoGrid.className = 'drops437-video-grid';
            videoGrid.setAttribute('role', 'list');
            videoGrid.setAttribute('aria-label', 'Drops 437 videos');

            regularVideos.forEach(v => {
                const card = createDrops437VideoCard(v, false);
                videoGrid.appendChild(card);
            });
            chatMessages.appendChild(videoGrid);
        }

        chatMessages.querySelectorAll('.drops437-react-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const videoId = btn.dataset.videoId;
                const emoji = btn.dataset.emoji;
                if (!videoId || !emoji) return;
                await toggleDrops437ReactionDB(videoId, emoji);
            });
        });

        // Search bindings
        const searchInput = chatMessages.querySelector('#drops437Search');
        const searchClear = chatMessages.querySelector('#drops437SearchClear');
        const searchResults = chatMessages.querySelector('#drops437SearchResults');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                drops437Filter = searchInput.value;
                renderDrops437Channel();
            });
            searchInput.value = drops437Filter;
        }
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                drops437Filter = '';
                renderDrops437Channel();
            });
        }
        if (searchResults) {
            searchResults.textContent = videos.length + ' / ' + allVideos.length;
        }
        chatMessages.dataset.sig = sig;
        updateDrops437InputState();
        renderPinnedBar();
        markDrops437Seen();
        renderChannelStrip();
    }

    function createDrops437VideoCard(v, isPinned) {
        const card = document.createElement('article');
        card.className = 'drops437-video-card' + (isPinned ? ' pinned' : '') + (v.category ? ' has-category' : '');
        card.dataset.videoId = String(v.id || '');
        card.setAttribute('role', 'listitem');

        const t = v.published_at ? new Date(v.published_at).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
        const vid = esc(v.youtube_video_id || '');
        const title = esc(v.title || 'Untitled');
        const descRaw = String(v.description || '').replace(/\s+/g, ' ').trim();
        const desc = esc(descRaw.slice(0, 140) + (descRaw.length > 140 ? '…' : ''));
        const dur = v.duration ? '<span class="drops437-duration">' + esc(String(v.duration)) + '</span>' : '';
        const thumb = v.thumbnail_url ? esc(v.thumbnail_url) : ('https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg');
        const reactionsHtml = renderDrops437Reactions(String(v.id));

        const catRaw = String(v.category || '').trim();
        const catLower = catRaw.toLowerCase();
        const catClass = catLower === 'turniere' ? ' turniere' : (catLower === 'crossover' ? ' crossover' : '');
        const categoryBadge = catRaw
            ? '<span class="drops437-category-badge' + catClass + '">' + esc(catRaw.toUpperCase()) + '</span>'
            : '';

        const viewsStr = formatViews(v.view_count);
        const viewsItem = viewsStr
            ? '<span class="drops437-stat" title="Aufrufe"><span class="drops437-stat-ico" aria-hidden="true">👁</span><span class="drops437-stat-val">' + esc(viewsStr) + '</span></span>'
            : '';

        card.innerHTML =
            '<div class="drops437-video-thumb">' +
                '<img src="' + thumb + '" alt="" loading="lazy" decoding="async">' +
                '<div class="drops437-thumb-gradient" aria-hidden="true"></div>' +
                '<button type="button" class="drops437-play-overlay" aria-label="Video abspielen">' +
                    '<span class="drops437-play-ring"><span class="drops437-play-icon" aria-hidden="true">▶</span></span>' +
                '</button>' +
                '<div class="drops437-thumb-badges">' +
                    (isPinned ? '<span class="drops437-pinned-badge" aria-label="Pinned">📌</span>' : '') +
                    categoryBadge +
                '</div>' +
                dur +
            '</div>' +
            '<div class="drops437-video-meta">' +
                '<h3 class="drops437-video-title">' + title + '</h3>' +
                (desc ? '<p class="drops437-video-desc">' + desc + '</p>' : '') +
                '<div class="drops437-video-footer">' +
                    '<div class="drops437-footer-left">' +
                        '<span class="drops437-publish-date">' + esc(t) + '</span>' +
                        viewsItem +
                    '</div>' +
                    '<div class="drops437-reactions" aria-label="Reaktionen">' + reactionsHtml + '</div>' +
                '</div>' +
            '</div>';

        const playBtn = card.querySelector('.drops437-play-overlay');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => { e.stopPropagation(); openVideoPlayerModal(v); });
        }

        card.addEventListener('click', (e) => {
            if (e.target.closest('.drops437-react-btn')) return;
            openVideoPlayerModal(v);
        });

        return card;
    }

    // ============ DROPS 437 VIDEO PLAYER MODAL ============
    let videoPlayerModal = null;
    let videoPlayerTouchStartY = 0;
    let videoPlayerTouchMoveY = 0;
    let videoPlayerIsDragging = false;

    function createVideoPlayerModal() {
        if (videoPlayerModal) return videoPlayerModal;
        videoPlayerModal = document.createElement('div');
        videoPlayerModal.className = 'video-player-modal';
        videoPlayerModal.setAttribute('role', 'dialog');
        videoPlayerModal.setAttribute('aria-modal', 'true');
        videoPlayerModal.setAttribute('aria-label', 'Video Player');
        videoPlayerModal.innerHTML = `
            <div class="video-player-backdrop"></div>
            <div class="video-player-container">
                <button type="button" class="video-player-close" aria-label="Close video player">&times;</button>
                <div class="video-player-header">
                    <h3 class="video-player-title"></h3>
                </div>
                <div class="video-player-wrapper">
                    <iframe class="video-player-iframe" src="" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                </div>
                <div class="video-player-info">
                    <div class="video-player-info-top">
                        <span class="video-player-category-badge"></span>
                        <div class="video-player-stats"></div>
                    </div>
                    <p class="video-player-description"></p>
                </div>
            </div>
        `;
        document.body.appendChild(videoPlayerModal);

        videoPlayerModal.querySelector('.video-player-close').addEventListener('click', closeVideoPlayerModal);
        videoPlayerModal.querySelector('.video-player-backdrop').addEventListener('click', closeVideoPlayerModal);

        const container = videoPlayerModal.querySelector('.video-player-container');
        container.addEventListener('touchstart', handleVideoPlayerTouchStart, { passive: true });
        container.addEventListener('touchmove', handleVideoPlayerTouchMove, { passive: false });
        container.addEventListener('touchend', handleVideoPlayerTouchEnd, { passive: true });

        document.addEventListener('keydown', handleVideoPlayerKeydown);
        return videoPlayerModal;
    }

    function handleVideoPlayerTouchStart(e) {
        if (e.touches.length === 1) {
            videoPlayerTouchStartY = e.touches[0].clientY;
            videoPlayerIsDragging = true;
        }
    }

    function handleVideoPlayerTouchMove(e) {
        if (!videoPlayerIsDragging || e.touches.length !== 1) return;
        videoPlayerTouchMoveY = e.touches[0].clientY;
        const deltaY = videoPlayerTouchMoveY - videoPlayerTouchStartY;
        if (deltaY > 0) {
            e.preventDefault();
            const container = videoPlayerModal.querySelector('.video-player-container');
            container.style.transform = `translateY(${Math.min(deltaY, 200)}px)`;
            container.style.opacity = Math.max(1 - deltaY / 300, 0.3);
            videoPlayerModal.querySelector('.video-player-backdrop').style.opacity = Math.max(1 - deltaY / 300, 0.3);
        }
    }

    function handleVideoPlayerTouchEnd() {
        if (!videoPlayerIsDragging) return;
        videoPlayerIsDragging = false;
        const deltaY = videoPlayerTouchMoveY - videoPlayerTouchStartY;
        const container = videoPlayerModal.querySelector('.video-player-container');
        if (deltaY > 100) {
            closeVideoPlayerModal();
        } else {
            container.style.transform = '';
            container.style.opacity = '';
            videoPlayerModal.querySelector('.video-player-backdrop').style.opacity = '';
        }
        videoPlayerTouchStartY = 0;
        videoPlayerTouchMoveY = 0;
    }

    function handleVideoPlayerKeydown(e) {
        if (e.key === 'Escape' && videoPlayerModal && videoPlayerModal.classList.contains('open')) {
            closeVideoPlayerModal();
        }
    }

    function openVideoPlayerModal(video) {
        const modal = createVideoPlayerModal();
        const iframe = modal.querySelector('.video-player-iframe');
        const titleEl = modal.querySelector('.video-player-title');
        const descEl = modal.querySelector('.video-player-description');
        const catBadge = modal.querySelector('.video-player-category-badge');
        const statsWrap = modal.querySelector('.video-player-stats');

        iframe.src = `https://www.youtube-nocookie.com/embed/${video.youtube_video_id}?autoplay=1&rel=0`;
        titleEl.textContent = video.title || 'Video';
        descEl.textContent = video.description || '';

        const catRaw = String(video.category || '').trim();
        if (catRaw) {
            catBadge.textContent = catRaw.toUpperCase();
            catBadge.style.display = 'inline-flex';
            catBadge.className = 'video-player-category-badge' + (catRaw.toLowerCase() === 'turniere' ? ' turniere' : '');
        } else {
            catBadge.style.display = 'none';
            catBadge.textContent = '';
        }

        const viewsStr = formatViews(video.view_count);
        statsWrap.innerHTML = viewsStr
            ? '<span class="video-player-stat"><span class="video-player-stat-ico" aria-hidden="true">👁</span><span class="video-player-stat-val">' + esc(viewsStr) + '</span></span>'
            : '';

        const container = modal.querySelector('.video-player-container');
        container.style.transform = '';
        container.style.opacity = '';
        modal.querySelector('.video-player-backdrop').style.opacity = '';

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => { const btn = modal.querySelector('.video-player-close'); if (btn) btn.focus(); }, 100);
    }

    function closeVideoPlayerModal() {
        if (!videoPlayerModal) return;
        const iframe = videoPlayerModal.querySelector('.video-player-iframe');
        if (iframe) iframe.src = '';
        videoPlayerModal.classList.remove('open');
        document.body.style.overflow = '';
    }

    function _drops437EnsureAdminUi(inputContainer, chatInputRow) {
        if (!inputContainer || !chatInputRow) return null;
        let ui = inputContainer.querySelector('.drops437-admin-ui');
        if (ui) return ui;
        ui = document.createElement('div');
        ui.className = 'drops437-admin-ui';
        ui.innerHTML =
            '<div class="drops437-input-toolbar">' +
                '<button type="button" class="drops437-emoji-btn" data-emoji="🔥" title="Fire">🔥</button>' +
                '<button type="button" class="drops437-emoji-btn" data-emoji="🎬" title="Drop">🎬</button>' +
                '<button type="button" class="drops437-emoji-btn" data-emoji="📺" title="Watch">📺</button>' +
                '<button type="button" class="drops437-emoji-btn" data-emoji="🚀" title="Launch">🚀</button>' +
                '<button type="button" class="drops437-emoji-btn" data-emoji="⚡" title="Neon">⚡</button>' +
                '<span class="drops437-admin-badge">ADMIN MODE</span>' +
            '</div>' +
            '<div class="drops437-input-meta"><span class="drops437-input-hint">▶ RSS feed channel — posts come from YouTube sync</span><span class="drops437-char-counter">0 / 280</span></div>';
        inputContainer.insertBefore(ui, chatInputRow);
        ui.querySelectorAll('.drops437-emoji-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const input = document.getElementById('chatInput');
                if (!input || input.disabled) return;
                const emoji = btn.getAttribute('data-emoji') || '';
                const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
                const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : input.value.length;
                input.value = (input.value || '').slice(0, start) + emoji + (input.value || '').slice(end);
                try { input.focus(); input.setSelectionRange(start + emoji.length, start + emoji.length); } catch(_) {}
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });
        return ui;
    }

    function _drops437BindCounter(chatInput) {
        if (!chatInput || chatInput._drops437CounterBound) return;
        chatInput._drops437CounterBound = true;
        chatInput.addEventListener('input', () => {
            if (!isDrops437Channel(currentChannel)) return;
            const container = document.querySelector('.chat-input-container');
            const counter = container && container.querySelector('.drops437-char-counter');
            if (!counter) return;
            const len = (chatInput.value || '').length;
            const max = 280;
            counter.textContent = len + ' / ' + max;
            counter.classList.toggle('warn', len > Math.floor(max * 0.8) && len <= max);
            counter.classList.toggle('limit', len > max);
        });
    }

    function updateDrops437InputState() {
        const inputContainer = document.querySelector('.chat-input-container');
        const chatInputRow = document.querySelector('.chat-input-row');
        const activeDrops = isDrops437Channel(currentChannel);
        const chatMainEl = document.querySelector('.chat-main');
        if (chatMainEl) chatMainEl.dataset.channel = currentChannel;
        
        // Completely hide input container for Drops 437 - no messages allowed for anyone
        if (inputContainer) {
            inputContainer.style.display = activeDrops ? 'none' : '';
        }
        if (chatInputRow) {
            chatInputRow.style.display = activeDrops ? 'none' : '';
        }
        // Also update channel strip for active state
        renderChannelStrip();
    }

    function renderChannelStrip() {
        if (!channelStrip) return;
        const active = currentChannel;
        let html = '';
        // #437 item
        const logoUnread = parseInt(localStorage.getItem(unreadKey('437'))||'0',10);
        const dropsUnread = drops437UnreadCount();
        html += '<button class="channel-item' + (active === '437' ? ' active' : '') + '" data-ch="437" title="437">' +
            '<img src="img/logo.png" class="channel-avatar" alt="437">' +
            '<span class="channel-name">437</span>' +
            '<span class="channel-badge"' + (logoUnread > 0 ? '' : ' style="display:none;"') + '>' + (logoUnread > 9 ? '9+' : logoUnread) + '</span>' +
        '</button>';
        // Drops 437 fixed channel (distinctive)
        html += '<button class="channel-item drops437-channel-item' + (active === DROPS_437_CHANNEL ? ' active' : '') + '" data-ch="' + DROPS_437_CHANNEL + '" title="Drops 437">' +
            '<img src="img/7550.png" class="channel-avatar" alt="Drops 437">' +
            '<span class="channel-name">DROPS 437</span>' +
            '<span class="channel-badge"' + (dropsUnread > 0 ? '' : ' style="display:none;"') + '>' + (dropsUnread > 9 ? '9+' : dropsUnread) + '</span>' +
        '</button>';
        // Voice Chat Channel (nur sichtbar wenn man im Voice Channel ist)
        try {
        if (voice.channelId) {
            const vname = voice.channelName || 'Voice';
            const vunread = parseInt(localStorage.getItem(unreadKey('voice:' + voice.channelId))||'0',10);
            html += '<button class="channel-item voice-channel-item' + (active === ('voice:' + voice.channelId) ? ' active' : '') + '" data-ch="voice:' + voice.channelId + '" title="Voice: ' + esc(vname) + '">' +
                '<span class="channel-avatar-wrap"><span class="channel-avatar" style="background:var(--neon-green);color:#000;display:flex;align-items:center;justify-content:center;font-weight:bold;">🔊</span>' + (vunread > 0 ? '<span class="channel-badge"' + (vunread > 9 ? '' : ' style="display:none;"') + '>' + (vunread > 9 ? '9+' : vunread) + '</span>' : '') + '</span>' +
                '<span class="channel-name" style="color:var(--neon-green);">' + esc(vname) + '</span>' +
            '</button>';
        }
        } catch (_) {}
        // Separator + neon heading between channels and DMs
        html += '<div class="channel-separator" aria-hidden="true"><span class="channel-separator-line"></span><span class="channel-separator-label neon-heading">DMs</span><span class="channel-separator-line"></span></div>';
        // DM items for all users
        dmUsers.forEach(u => {
            const ch = dmChannelId(user.id, u.id);
            const unread = parseInt(localStorage.getItem(unreadKey(ch))||'0',10);
            const av = u.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(u.nickname||'x');
            const uc = getUserChatColor(u.id, u);
            html += '<button class="channel-item' + (active === ch ? ' active' : '') + '" data-ch="' + ch + '" data-uid="' + u.id + '" title="' + esc(u.nickname) + '">' +
                '<span class="channel-avatar-wrap' + (isUserOnline(u.id) ? ' is-online' : '') + '"><img src="' + av + '" class="channel-avatar" alt="" loading="lazy" decoding="async">' + (isUserOnline(u.id) ? '<span class="online-dot"></span>' : '') +
                '<span class="channel-badge"' + (unread > 0 ? '' : ' style="display:none;"') + '>' + (unread > 9 ? '9+' : unread) + '</span>' +
                '</span>' +
                '<span class="channel-name" style="color:' + uc + '">' + esc(u.nickname) + '</span>' +
            '</button>';
        });
        channelStrip.innerHTML = html;
        channelStrip.querySelectorAll('.channel-item').forEach(btn => {
            btn.onclick = () => switchChannel(btn.dataset.ch);
        });
        updateChannelBadges();
        updateOnlineDots();
    }
    async function switchChannel(ch) {
        if (!isMyChannel(ch)) return;
        currentChannel = ch;
        try { if (window.DMCall && typeof window.DMCall.onChannelChanged === 'function') window.DMCall.onChannelChanged(ch); } catch (_) {}
        try { localStorage.setItem('437core_channel', ch); } catch(_) {}
        try { localStorage.setItem(unreadKey(ch), '0'); } catch(_) {}
        msgWindow = 120;
        if (chatMessages) { chatMessages.classList.add('switching'); chatMessages.dataset.sig = ''; }
        await loadMsgs();
        if (chatMessages) {
            chatMessages.classList.remove('switching');
            chatMessages.classList.add('switched');
            setTimeout(() => { if (chatMessages) chatMessages.classList.remove('switched'); }, 250);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        if (typeof updateDrops437InputState === 'function') updateDrops437InputState();
        const chatHeaderEl = document.getElementById('chatHeader');
        if (chatHeaderEl) chatHeaderEl.classList.toggle('drops437-active', isDrops437Channel(currentChannel));
        const chatMainEl = document.querySelector('.chat-main');
        if (chatMainEl) chatMainEl.dataset.channel = currentChannel;
        renderPinnedBar();
        renderChannelStrip();
        forceShowInput();
    }
    // initial
    if (!isMyChannel(currentChannel)) currentChannel = '437';
    await loadDmUsers();
    renderChannelStrip();
    try { if (window.DMCall && typeof window.DMCall.onChannelChanged === 'function') window.DMCall.onChannelChanged(currentChannel); } catch (_) {}
    // User search (DMs) with avatar+name preview
    const userSearchInput = document.getElementById('userSearchInput');
    const userSearchResults = document.getElementById('userSearchResults');
    function renderUserSearch(q) {
        if (!userSearchResults) return;
        const ql = (q || '').trim().toLowerCase();
        if (!ql) { userSearchResults.classList.remove('open'); userSearchResults.innerHTML = ''; return; }
        const hits = dmUsers.filter(u => (u.nickname || '').toLowerCase().includes(ql));
        if (!hits.length) { userSearchResults.classList.remove('open'); userSearchResults.innerHTML = ''; return; }
        userSearchResults.innerHTML = hits.map(u => {
            const av = u.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(u.nickname || 'x');
            return '<div class="chat-search-result user-search-result" data-uid="' + u.id + '">' +
                '<img src="' + av + '" style="width:22px;height:22px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;">' +
                '<span class="sr-author">' + esc(u.nickname) + '</span>' +
            '</div>';
        }).join('');
        userSearchResults.classList.add('open');
        userSearchResults.querySelectorAll('.user-search-result').forEach(el => {
            el.onclick = () => {
                const uid = el.dataset.uid;
                const ch = dmChannelId(user.id, uid);
                userSearchInput.value = '';
                renderUserSearch('');
                switchChannel(ch);
            };
        });
    }
    if (userSearchInput) {
        userSearchInput.oninput = () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => renderUserSearch(userSearchInput.value), 150);
        };
        userSearchInput.onkeydown = (e) => { if (e.key === 'Escape') { userSearchInput.value = ''; renderUserSearch(''); } };
        document.addEventListener('click', (e) => { if (userSearchResults && !userSearchResults.contains(e.target) && e.target !== userSearchInput) userSearchResults.classList.remove('open'); });
    }
    const loadOlderBtn = document.getElementById('loadOlderBtn');
    if (loadOlderBtn) loadOlderBtn.onclick = async () => {
        if (!hasOlderMsgs) return;
        loadOlderBtn.disabled = true;
        msgWindow = Math.min(msgWindow + 120, 600);
        try {
            await loadMsgs({ preserveScroll: true });
        } finally {
            loadOlderBtn.disabled = false;
        }
    };


    if (chatInput) chatInput.maxLength = 2000;
    async function sendM(){ let c=chatInput.value.trim(); if (c.length > 2000) c = c.slice(0, 2000); if (editingId) {
        if (c) await supabaseClient.from('messages').update({content:c, edited_content:c, edited_at:new Date().toISOString()}).eq('id',editingId).eq('user_id',user.id);
        editingId = null; chatSend.textContent = 'SEND'; chatInput.value=''; loadMsgs(); return;
    }
    if (isDrops437Channel(currentChannel) && !(typeof isAdmin === 'function' && isAdmin())) { alert('Drops 437 ist schreibgeschützt.'); return; }
    if (!c && !attachAnyPending()) return;
    if (isBanned(getMyProfile())) { alert('Du bist gesperrt.'); return; }
    if (attachAnyPending() && !navigator.onLine) { alert('Anhänge können offline nicht gesendet werden.'); return; }
    supabaseClient.channel('t2').send({type:'broadcast',event:'t',payload:{n:user.nickname,o:false}});

    let media_url = null, media_type = null, attachment = null;
    let uploadLabel = '';

    // Audio-Aufnahme behält den bestehenden Pfad (media_url + Player)
    if (pendingFile) {
        const f = pendingFile;
        const sizeLimit = f.type.startsWith('image/') ? 10*1024*1024 : f.type.startsWith('audio/') ? 20*1024*1024 : 50*1024*1024;
        if (f.size > sizeLimit) { alert('Datei zu groß'); return; }
        if (!f.type.startsWith('image/') && !f.type.startsWith('audio/') && !f.type.startsWith('video/')) { alert('Nicht erlaubter Typ'); return; }
        if (previewChip) { previewChip.innerHTML = '<span class="spinner"></span><span>Wird hochgeladen...</span>'; }
        const path = 'media/'+user.id+'/'+Date.now()+'_'+f.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const { error: upErr } = await supabaseClient.storage.from('media').upload(path, f);
        if (upErr) { alert('Upload fehlgeschlagen: '+upErr.message); return; }
        const { data: pub } = await supabaseClient.storage.from('media').getPublicUrl(path);
        media_url = pub.publicUrl; media_type = f.type;
        uploadLabel = 'Sprachnachricht';
    } else if (pendingFiles.length || pendingAttachment) {
        if (previewChip) { previewChip.style.display='inline-flex'; previewChip.innerHTML = '<span class="spinner"></span><span>Wird hochgeladen...</span>'; }
        let items = [];
        if (pendingFiles.length) {
            for (const entry of pendingFiles) {
                try {
                    const up = await attachUploadOne(entry);
                    items.push(up);
                } catch (err) {
                    if (previewChip) { previewChip.style.display='none'; previewChip.innerHTML=''; }
                    alert('Upload fehlgeschlagen: ' + (err && err.message ? err.message : 'Unbekannter Fehler'));
                    renderAttachPreview();
                    return;
                }
            }
        }
        if (pendingAttachment) {
            attachment = pendingAttachment;
            uploadLabel = attachLabel(pendingAttachment);
        } else if (items.length === 1 && items[0].type === 'application/pdf') {
            attachment = { kind: 'document', url: items[0].url, name: items[0].name, size: items[0].size, type: items[0].type };
            uploadLabel = attachLabel(attachment);
        } else if (items.length === 1 && items[0].type.startsWith('image/')) {
            attachment = { kind: 'album', items: items };
            uploadLabel = attachLabel(attachment);
        } else if (items.length && items.every(i => i.type.startsWith('image/') || i.type.startsWith('video/'))) {
            attachment = { kind: 'album', items: items };
            uploadLabel = attachLabel(attachment);
        } else if (items.length) {
            const first = items[0];
            attachment = { kind: 'document', url: first.url, name: first.name, size: first.size, type: first.type };
            uploadLabel = attachLabel(attachment);
        }
        if (previewChip) { previewChip.style.display='none'; previewChip.innerHTML=''; }
        renderAttachPreview();
    }

    const { error: sendErr } = await supabaseClient.from('messages').insert([{user_id:user.id,channel: currentChannel,content:c,media_url,media_type,attachment,reply_to:replyToId}]);
    if (sendErr) {
        if (!navigator.onLine && !attachAnyPending()) {
            try { const q = JSON.parse(localStorage.getItem('437core_outbox')||'[]'); q.push({content:c,media_url,media_type,attachment:null,reply_to:replyToId,ts:Date.now()}); localStorage.setItem('437core_outbox',JSON.stringify(q)); } catch(_){}
            alert('Offline: Nachricht in Warteschlange.');
        } else {
            alert('Senden fehlgeschlagen: ' + (sendErr.message || 'Fehler'));
        }
        if (previewChip) { previewChip.style.display='none'; previewChip.innerHTML=''; }
        renderAttachPreview();
        return;
    }
console.log('%c[437 CORE] %cNachricht gesendet','color:#ff6b9d;font-weight:bold;','color:#ffb347;');
    const sentText = c || uploadLabel || 'Anhang';
    const isDM = currentChannel.startsWith('dm_');
    const recipientId = isDM ? currentChannel.replace('dm_', '').split('_').find(id => id !== user.id) : null;

    // ============ PUSH-BENACHRICHTIGUNGEN AUSLÖSEN ============
    // @Mention: alle erwähnten Nutzer benachrichtigen
    const mentions = sentText.match(/@(\w+)/g) || [];
    if (mentions.length) {
        for (const m of mentions) {
            const nick = m.slice(1);
            const { data: mp } = await supabaseClient.from('profiles').select('id').ilike('nickname', nick).maybeSingle();
            if (mp && mp.id !== user.id) {
                await sendPushNotification(mp.id, 'mention', user.nickname + ' hat dich erwähnt', sentText.slice(0, 120), currentChannel, null, null, user.id, user.avatar_url, user.nickname);
            }
        }
    }

    // Reply: Empfänger der ursprünglichen Nachricht benachrichtigen
    if (replyToId) {
        const orig = (loadedMsgs || []).find(m => String(m.id) === String(replyToId));
        if (orig && orig.user_id !== user.id && orig.user_id !== BOT_USER_ID_CONST) {
            await sendPushNotification(orig.user_id, 'reply', user.nickname + ' hat geantwortet', sentText.slice(0, 120), currentChannel, null, null, user.id, user.avatar_url, user.nickname);
        }
    }

    // DM: Partner benachrichtigen
    if (isDM) {
        const shortOther = currentChannel.replace('dm_', '').split('_').find(id => id !== user.id.slice(0,8));
        let fullRecipientId = null;
        if (shortOther) {
            const profs = (typeof getProfiles === 'function') ? (await getProfiles()) : [];
            const match = (profs || []).find(p => String(p.id).startsWith(shortOther));
            fullRecipientId = match?.id || null;
        }
        if (fullRecipientId) {
            await sendPushNotification(fullRecipientId, 'dm', user.nickname + ' (DM)', sentText.slice(0, 120), null, currentChannel, null, user.id, user.avatar_url, user.nickname);
        }
    }

    // AI reply: if replying to a 437AI message, trigger assistant automatically (without @ mention needed)
    const repliedToAI = replyToId && (loadedMsgs || []).find(m => String(m.id) === String(replyToId) && m.user_id === BOT_USER_ID_CONST);
    if (!c && (media_url || attachment)) { setAiTyping(false); }
    chatInput.value=''; updCounter();
    pendingFile = null;
    clearAttachPreviews();
    if (previewChip) { previewChip.style.display='none'; previewChip.innerHTML=''; }
    // clear reply preview + draft
    replyToId = null;
    const rp = document.getElementById('replyPreview'); if (rp) rp.style.display='none';
    try { localStorage.removeItem(DRAFT_KEY); } catch(_){}
    const di = document.getElementById('draftIndicator'); if (di) di.style.display='none';
    const {data:_m}=await supabaseClient.from('messages').select('id').eq('channel', currentChannel).order('id',{ascending:false}).limit(1); if(_m&&_m[0]) localStorage.setItem(channelKey(currentChannel), String(_m[0].id));
    if (/@437AI\b/i.test(sentText) || repliedToAI) {
        setAiTyping(true);
        fetch(SUPABASE_URL + '/functions/v1/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
            body: JSON.stringify({ user_id: user.id, channel: currentChannel, content: sentText, reply_to_ai: !!repliedToAI })
        }).then(async (r) => {
            if (!r.ok) {
                const txt = await r.text().catch(()=> '');
                console.error('437AI trigger failed', r.status, txt);
            }
        }).catch((err) => console.error('437AI trigger failed', err))
        .finally(() => setTimeout(() => setAiTyping(false), 1500));
    }

    renderPinnedBar();
}
    const voiceNavBtn = document.getElementById('voiceNavBtn');
    if (voiceNavBtn) voiceNavBtn.onclick = () => {
        const sb = document.querySelector('.chat-sidebar');
        sb.classList.toggle('open');
    };
    // long-press to react
    let pressTimer = null;
    function showEmojiPicker(mid, anchor) {
        document.querySelectorAll('.emoji-pop').forEach(p=>p.remove());
        const pop = document.createElement('div'); pop.className='emoji-pop';
        EMOJIS.forEach(em => { const b=document.createElement('button'); b.textContent=em; b.onclick=async()=>{ await supabaseClient.from('message_reactions').insert([{message_id:mid,user_id:user.id,emoji:em}]); pop.remove(); loadMsgs(); }; pop.appendChild(b); });
        const rect = anchor.getBoundingClientRect();
        pop.style.position = 'fixed';
        pop.style.top = (rect.bottom + 8) + 'px';
        pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 260)) + 'px';
        document.body.appendChild(pop);
        setTimeout(()=>document.addEventListener('click',function c(ev){ if(!pop.contains(ev.target)){pop.remove();document.removeEventListener('click',c);} },{once:true}),10);
    }
    chatMessages.addEventListener('touchstart', (e) => {
        const msg = e.target.closest('.message');
        if (!msg) return;
        const mid = msg.dataset.id;
        pressTimer = setTimeout(() => showEmojiPicker(mid, msg), 500);
    });
    chatMessages.addEventListener('touchend', () => { clearTimeout(pressTimer); });
    chatMessages.addEventListener('touchmove', () => { clearTimeout(pressTimer); });
    chatMessages.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const msg = e.target.closest('.message');
        if (!msg) return;
        const mid = msg.dataset.id;
        pressTimer = setTimeout(() => showEmojiPicker(mid, msg), 600);
    });
    chatMessages.addEventListener('mouseup', () => { clearTimeout(pressTimer); });
    chatMessages.addEventListener('dblclick', (e) => {
        const msg = e.target.closest('.message');
        if (!msg) return;
        showEmojiPicker(msg.dataset.id, msg);
    });
    const mediaModal = document.getElementById('mediaModal');
    const mediaModalContent = document.getElementById('mediaModalContent');
    const mediaModalClose = document.getElementById('mediaModalClose');
    if (mediaModalClose) mediaModalClose.onclick = () => { mediaModal.style.display='none'; mediaModalContent.innerHTML=''; lightboxList = []; lightboxIdx = 0; if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch(_){} } };
    document.addEventListener('keydown', (e) => {
        if (!mediaModal || mediaModal.style.display === 'none' || lightboxList.length < 2) return;
        if (e.key === 'ArrowRight') { lightboxIdx = (lightboxIdx + 1) % lightboxList.length; renderLightbox(); }
        else if (e.key === 'ArrowLeft') { lightboxIdx = (lightboxIdx - 1 + lightboxList.length) % lightboxList.length; renderLightbox(); }
    });
    if (mediaModal) mediaModal.onclick = (e) => { if (e.target===mediaModal) { mediaModal.style.display='none'; mediaModalContent.innerHTML=''; if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch(_){} } } };
    chatMessages.addEventListener('click', (e) => {
        const replyBtn = e.target.closest('.reply-btn');
        if (replyBtn) {
            const mid = replyBtn.dataset.reply;
            const msgEl = chatMessages.querySelector('.message[data-id="'+mid+'"]');
            const nick = msgEl ? (msgEl.querySelector('.message-nickname')?.textContent || '') : '';
            // find original message content
            let content = '';
            const origMsg = (loadedMsgs || []).find(m=>String(m.id)===String(mid));
            if (origMsg) content = ((origMsg.edited_content || origMsg.content || '') || attachLabel(origMsg.attachment)).slice(0,60);
            replyToId = mid;
            const rp = document.getElementById('replyPreview');
            const rpt = document.getElementById('replyPreviewText');
            if (rp && rpt) { rpt.textContent = nick + ': ' + content; rp.style.display = 'flex'; }
            const vf = document.getElementById('voiceFixedBtn'); if (vf) vf.style.display = 'none';
            chatInput.focus();
            return;
        }
         const reportBtn = e.target.closest('.report-btn');
         if (reportBtn) {
             const mid = reportBtn.dataset.report;
             const reportModal = document.getElementById('reportModal');
             const reportReason = document.getElementById('reportReason');
             if (reportModal) {
                 if (reportReason) reportReason.value = '';
                 reportModal.style.display = 'flex';
                 reportModal.dataset.mid = mid;
             }
             return;
         }
        const pinBtn = e.target.closest('.pin-btn');
        if (pinBtn) {
            const mid = pinBtn.dataset.pin;
            const msgEl = chatMessages.querySelector('.message[data-id="'+mid+'"]');
            const currentlyPinned = !!(msgEl && msgEl.querySelector('.pin-btn.pinned'));

            if (!currentlyPinned) {
                showPinDurationPicker(pinBtn, mid);
                return;
            }

            (async () => {
                try {
                    await supabaseClient.from('messages').update({ pinned: false, pinned_at: null, pinned_by: null, pinned_until: null }).eq('id', mid);
                    await logAdminAudit('unpin_message', 'message', mid, '');
                    loadMsgs();
                    renderPinnedBar();
                } catch (err) { console.error('unpin failed', err); }
            })();
            return;
        }
        const admDelBtn = e.target.closest('.admin-del-btn');
        if (admDelBtn) {
            const mid = admDelBtn.dataset.admDel;
            if (!confirm('Nachricht wirklich löschen (Admin)?')) return;
            (async () => {
                try {
                    await supabaseClient.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', mid);
                    await logAdminAudit('delete_message', 'message', mid, '');
                    loadMsgs();
                } catch (err) { console.error('admin delete failed', err); alert('Löschen fehlgeschlagen.'); }
            })();
            return;
        }

        // Pin-Duration-Picker anzeigen (wird von pin-btn aufgerufen)
        function showPinDurationPicker(pinBtn, mid) {
            // Bestehende Picker entfernen
            document.querySelectorAll('.pin-duration-picker').forEach(p => p.remove());

            const picker = document.createElement('div');
            picker.className = 'pin-duration-picker open';
            picker.innerHTML = `
                <div class="pd-title">ANPINNEN FÜR...</div>
                <div class="pd-grid">
                    <div class="pd-opt" data-dur="3600000">1 Stunde</div>
                    <div class="pd-opt" data-dur="86400000">24 Stunden</div>
                    <div class="pd-opt" data-dur="604800000">7 Tage</div>
                    <div class="pd-opt active" data-dur="0">Permanent</div>
                </div>
            `;

            // Positioniere Picker über dem Button
            const rect = pinBtn.getBoundingClientRect();
            picker.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
            picker.style.right = (window.innerWidth - rect.right + 8) + 'px';
            document.body.appendChild(picker);

            // Opt-Selection
            picker.querySelectorAll('.pd-opt').forEach(opt => {
                opt.onclick = async (ev) => {
                    ev.stopPropagation();
                    const dur = parseInt(opt.dataset.dur);
                    const now = new Date().toISOString();
                    const until = dur > 0 ? new Date(Date.now() + dur).toISOString() : null;

                    try {
                        await supabaseClient.from('messages').update({
                            pinned: true,
                            pinned_at: now,
                            pinned_by: user.id,
                            pinned_until: until
                        }).eq('id', mid);
                        await logAdminAudit('pin_message', 'message', mid, { duration_ms: dur });
                        loadMsgs();
                        renderPinnedBar();
                    } catch (err) { console.error('pin failed', err); }
                    picker.remove();
                };
            });

            // Schließen bei Outside-Click
            const closePicker = (ev) => {
                if (!picker.contains(ev.target) && ev.target !== pinBtn) {
                    picker.remove();
                    document.removeEventListener('click', closePicker);
                }
            };
            setTimeout(() => document.addEventListener('click', closePicker), 100);
        }
        const rq = e.target.closest('.reply-quote');
        if (rq) {
            const jumpId = rq.dataset.jump;
            if (jumpId) {
                const target = chatMessages.querySelector('.message[data-id="'+jumpId+'"]');
                if (target) { target.scrollIntoView({behavior:'smooth',block:'center'}); target.classList.add('highlight-msg'); setTimeout(()=>target.classList.remove('highlight-msg'),1200); }
            }
            return;
        }
        const profileAv = e.target.closest('[data-profile-uid]');
        if (profileAv) {
            e.preventDefault();
            e.stopPropagation();
            openProfileModal(profileAv.dataset.profileUid);
            return;
        }
        const albumBtn = e.target.closest('[data-album]');
        if (albumBtn) {
            const msgEl = albumBtn.closest('.message');
            const att = msgEl ? attachIndex.get(parseInt(msgEl.dataset.id, 10)) : null;
            if (att && att.kind === 'album') {
                const urls = (att.items || []).filter(i => i && i.url).map(i => i.url);
                openLightbox(urls, parseInt(albumBtn.dataset.album, 10) || 0);
                return;
            }
        }
        const lbNav = e.target.closest('[data-lb]');
        if (lbNav) {
            e.stopPropagation();
            lightboxIdx = lbNav.dataset.lb === 'next'
                ? (lightboxIdx + 1) % lightboxList.length
                : (lightboxIdx - 1 + lightboxList.length) % lightboxList.length;
            renderLightbox();
            return;
        }
        const icsBtn = e.target.closest('[data-ics]');
        if (icsBtn) {
            e.preventDefault();
            const att = attachIndex.get(parseInt(icsBtn.dataset.ics, 10));
            if (att && att.kind === 'event') downloadIcs(icsBtn.dataset.ics, att);
            return;
        }
        const rsvpBtn = e.target.closest('[data-rsvp]');
        if (rsvpBtn) { rsvpEvent(parseInt(rsvpBtn.dataset.msg, 10), rsvpBtn.dataset.rsvp); return; }
        const unvoteBtn = e.target.closest('[data-unvote]');
        if (unvoteBtn) { votePoll(parseInt(unvoteBtn.dataset.unvote, 10), null); return; }
        const voteBtn = e.target.closest('[data-vote]');
        if (voteBtn) { votePoll(parseInt(voteBtn.dataset.vote, 10), parseInt(voteBtn.dataset.opt, 10)); return; }

        const img = e.target.closest('.msg-img');
        const vid = e.target.closest('.msg-vid');
        if (img) { mediaModalContent.innerHTML = '<img src="'+img.src+'" class="modal-media">'; mediaModal.style.display='flex'; return; }
        else if (vid) { mediaModalContent.innerHTML = '<video src="'+vid.src+'" class="modal-media" controls autoplay></video>'; mediaModal.style.display='flex'; return; }
        const editHist = e.target.closest('.edited-tag');
        if (editHist) { showEditHistory(editHist.dataset.editHist, editHist); return; }
        if (e.target.closest('.msg-act, .react-btn, .ap-play, .mention, a, button, audio, video')) return;
        const nick = e.target.closest('.message-nickname');
        const avatar = e.target.closest('.message-avatar');
        if (nick || avatar) {
            const msg = e.target.closest('.message');
            const av = e.target.closest('.message-avatar') || (msg && msg.querySelector('.message-avatar'));
            const uid = av && av.dataset ? av.dataset.userId : null;
            if (uid) openProfileModal(uid);
        }
    });    // custom audio player
    chatMessages.addEventListener('click', (e) => {
        const btn = e.target.closest('.ap-play');
        if (!btn) return;
        const player = btn.closest('.audio-player');
        const src = player.dataset.src;
        let audio = player._audio;
        if (!audio) {
            audio = new Audio(src); player._audio = audio;
            const progress = player.querySelector('.ap-progress');
            const timeEl = player.querySelector('.ap-time');
            const tick = () => {
                if (!audio.paused && !audio.ended) {
                    const p = audio.duration ? (audio.currentTime/audio.duration*100) : 0;
                    progress.style.width = p+'%';
                    timeEl.textContent = fmtTime(audio.currentTime);
                    requestAnimationFrame(tick);
                }
            };
            audio.onplay = () => { btn.textContent='⏸'; requestAnimationFrame(tick); };
            audio.onpause = () => { btn.textContent='▶'; };
            audio.onended = () => { btn.textContent='▶'; progress.style.width='0%'; timeEl.textContent='0:00'; };
        }
        if (audio.paused) { audio.play(); } else { audio.pause(); }
    });
    function fmtTime(s){ const m=Math.floor(s/60); const sec=Math.floor(s%60); return m+':'+String(sec).padStart(2,'0'); }
    if (previewChip) {
        previewChip.addEventListener('click', (e) => {
            const img = e.target.closest('img');
            const vid = e.target.closest('video');
            if (img) { mediaModalContent.innerHTML = '<img src="'+img.src+'" class="modal-media">'; mediaModal.style.display='flex'; }
            else if (vid) { mediaModalContent.innerHTML = '<video src="'+vid.src+'" class="modal-media" controls autoplay></video>'; mediaModal.style.display='flex'; }
        });
    }
chatMessages.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const av = e.target.closest('[data-profile-uid]');
    if (!av) return;
    e.preventDefault();
    openProfileModal(av.dataset.profileUid);
});
chatMessages.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-del]');
    if (editBtn) {
        const id = editBtn.dataset.edit;
        const el = document.getElementById('mt_'+id);
        const cur = el.textContent.replace(' (BEARBEITET)','').trim();
        editingId = id;
        chatInput.value = cur;
        chatInput.focus();
        chatSend.textContent = 'SAVE';
    } else if (delBtn) {
        const id = delBtn.dataset.del;
        confirmText.textContent = 'Nachricht löschen?';
        confirmModal.style.display = 'flex';
        confirmYes.onclick = async () => {
            confirmModal.style.display = 'none';
            await supabaseClient.from('messages').update({deleted_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id);
            loadMsgs();
        };
        confirmNo.onclick = () => { confirmModal.style.display = 'none'; };
    }
    // Report modal wiring
    const reportModal = document.getElementById('reportModal');
    const reportReason = document.getElementById('reportReason');
    const reportCancelBtn = document.getElementById('reportCancelBtn');
    const reportSubmitBtn = document.getElementById('reportSubmitBtn');
    if (reportCancelBtn) reportCancelBtn.onclick = () => { if (reportModal) reportModal.style.display = 'none'; };
    if (reportModal) reportModal.onclick = (e) => { if (e.target === reportModal) reportModal.style.display = 'none'; };
    if (reportSubmitBtn) reportSubmitBtn.onclick = async () => {
        const mid = reportModal ? reportModal.dataset.mid : null;
        if (!mid) { if (reportModal) reportModal.style.display = 'none'; return; }
        const reason = reportReason ? String(reportReason.value || '').trim().slice(0,200) : '';
        try {
            let reporterId = user?.id || null;
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session?.user?.id) reporterId = session.user.id;
            } catch (_) {}
            if (!reporterId) {
                alert('Meldung fehlgeschlagen: Bitte erneut anmelden.');
                if (reportModal) reportModal.style.display = 'none';
                return;
            }
            const resp = await fetch((window.SUPABASE_URL || '') + '/functions/v1/submit-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.SUPABASE_ANON_KEY || '',
                    'Authorization': 'Bearer ' + (window.SUPABASE_ANON_KEY || '')
                },
                body: JSON.stringify({ reporter_id: reporterId, message_id: mid, reason })
            });
            const json = await resp.json().catch(() => ({}));
            if (!resp.ok || json.error) {
                throw new Error(json.error || json.details || ('HTTP ' + resp.status));
            }
            alert('Meldung gesendet.');
        } catch (err) {
            console.error('report failed', err);
            const msg = err?.message || err?.details || 'Meldung fehlgeschlagen.';
            alert('Meldung fehlgeschlagen: ' + msg);
        }
        if (reportModal) reportModal.style.display = 'none';
    };
});

// Long press on mobile for edit/delete
let longPressTimer = null;
chatMessages.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const msg = target.closest('.message');
    if (!msg) return;
    longPressTimer = setTimeout(() => {
        const id = msg.dataset.id;
        if (!id) return;
        const isOwn = msg.classList.contains('own');
        if (!isOwn) return;
        confirmText.textContent = 'Bearbeiten oder Löschen?';
        confirmModal.style.display = 'flex';
        const editAction = async () => {
            confirmModal.style.display = 'none';
            const el = document.getElementById('mt_'+id);
            const cur = el.textContent.replace(' (BEARBEITET)','').trim();
            editingId = id;
            chatInput.value = cur;
            chatInput.focus();
            chatSend.textContent = 'SAVE';
        };
        const delAction = async () => {
            confirmModal.style.display = 'none';
            await supabaseClient.from('messages').update({deleted_at:new Date().toISOString()}).eq('id',id).eq('user_id',user.id);
            loadMsgs();
        };
        confirmYes.onclick = editAction;
        confirmYes.textContent = 'BEARBEITEN';
        confirmNo.onclick = delAction;
        confirmNo.textContent = 'LÖSCHEN';
    }, 600);
}, { passive: true });

chatMessages.addEventListener('touchend', () => { clearTimeout(longPressTimer); });
chatMessages.addEventListener('touchmove', () => { clearTimeout(longPressTimer); });
function showConfirm(text) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmText').textContent = text;
        modal.style.display = 'flex';
        document.getElementById('confirmYes').onclick = () => { modal.style.display='none'; resolve(true); };
        document.getElementById('confirmNo').onclick = () => { modal.style.display='none'; resolve(false); };
    });
}
let editingId = null;
function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._to); t._to = setTimeout(() => { t.style.display = 'none'; }, 3000);
}
const scrollBtn = document.getElementById('scrollBottomBtn');
if (scrollBtn) {
    chatMessages.addEventListener('scroll', () => {
        const nearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 120;
        scrollBtn.style.display = nearBottom ? 'none' : 'block';
    });
    scrollBtn.onclick = () => {
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        const last = loadedMsgs.length ? loadedMsgs[loadedMsgs.length-1].id : null;
        if (last) { try { localStorage.setItem(channelKey(currentChannel), String(last)); } catch(_) {} }
    };
}
// Long-press admin delete on messages
(function setupLongPressDelete() {
    let pressTimer = null;
    let pressTarget = null;
    let startX = 0, startY = 0;
    function clearPress() {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        if (pressTarget) { pressTarget.classList.remove('pressing'); pressTarget = null; }
    }
    function startPress(e, msgEl) {
        if (!isAdmin()) return;
        const uid = msgEl.dataset ? msgEl.dataset.userId : null;
        // only on others' messages (or all if admin wants); here: others' messages
        if (uid === user.id) return;
        pressTarget = msgEl;
        const t = e.touches ? e.touches[0] : e;
        startX = t.clientX; startY = t.clientY;
        msgEl.classList.add('pressing');
        pressTimer = setTimeout(async () => {
            pressTimer = null;
            if (pressTarget) pressTarget.classList.remove('pressing');
            const mid = pressTarget && pressTarget.dataset ? pressTarget.dataset.id : null;
            if (!mid) { pressTarget = null; return; }
            if (navigator.vibrate) { try { navigator.vibrate(40); } catch(_) {} }
            if (!confirm('Nachricht wirklich löschen (Admin)?')) { pressTarget = null; return; }
            try {
                await supabaseClient.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', mid);
                await logAdminAudit('delete_message_longpress', 'message', mid, '');
                loadMsgs();
                renderPinnedBar();
            } catch (err) { console.error('admin delete failed', err); }
            pressTarget = null;
        }, 600);
    }
    chatMessages.addEventListener('mousedown', (e) => {
        const msgEl = e.target.closest('.message');
        if (!msgEl) return;
        // avoid triggering on buttons/inputs
        if (e.target.closest('button, input, textarea, a, .msg-act, .react-btn')) return;
        startPress(e, msgEl);
    });
    chatMessages.addEventListener('mouseup', clearPress);
    chatMessages.addEventListener('mouseleave', clearPress);
    chatMessages.addEventListener('touchstart', (e) => {
        const msgEl = e.target.closest('.message');
        if (!msgEl) return;
        if (e.target.closest('button, input, textarea, a, .msg-act, .react-btn')) return;
        startPress(e, msgEl);
    }, { passive: true });
    chatMessages.addEventListener('touchend', (e) => {
        // cancel if moved too much
        const t = e.changedTouches ? e.changedTouches[0] : null;
        if (t && pressTarget) {
            const dx = Math.abs(t.clientX - startX);
            const dy = Math.abs(t.clientY - startY);
            if (dx > 10 || dy > 10) clearPress();
        }
        clearPress();
    });
    chatMessages.addEventListener('touchmove', (e) => {
        const t = e.touches ? e.touches[0] : null;
        if (t && pressTarget) {
            const dx = Math.abs(t.clientX - startX);
            const dy = Math.abs(t.clientY - startY);
            if (dx > 10 || dy > 10) clearPress();
        }
    }, { passive: true });
    chatMessages.addEventListener('contextmenu', (e) => {
        if (pressTarget) { e.preventDefault(); }
    });
})();
// Swipe-to-reply (mobile)
(function setupSwipeReply() {
    let startX = 0, startY = 0, swipingEl = null, swiping = false;
    function resetSwipe() {
        if (swipingEl) {
            swipingEl.style.transform = '';
            swipingEl.classList.remove('swiping');
            swipingEl = null;
        }
        swiping = false;
    }
    chatMessages.addEventListener('touchstart', (e) => {
        if (e.target.closest('button, input, textarea, a, .msg-act, .react-btn, .mention')) return;
        const msgEl = e.target.closest('.message');
        if (!msgEl) return;
        if (msgEl.querySelector('.message-text')?.textContent?.includes('NACHRICHT GELÖSCHT')) return;
        const t = e.touches[0];
        startX = t.clientX; startY = t.clientY;
        swipingEl = msgEl;
        swiping = false;
    }, { passive: true });
    chatMessages.addEventListener('touchmove', (e) => {
        if (!swipingEl) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
            resetSwipe();
            return;
        }
        if (dx > 5) {
            swiping = true;
            const offset = Math.min(dx, 80);
            swipingEl.style.transform = 'translateX(' + offset + 'px)';
            swipingEl.classList.add('swiping');
        }
    }, { passive: true });
    chatMessages.addEventListener('touchend', (e) => {
        if (!swipingEl) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const el = swipingEl;
        resetSwipe();
        if (swiping && dx >= 40 && Math.abs(dy) < 40) {
            const mid = el.dataset.id;
            if (mid) {
                const nick = (el.querySelector('.message-nickname')?.textContent || '').trim();
                const origMsg = (loadedMsgs || []).find(m => String(m.id) === String(mid));
                let content = origMsg ? (origMsg.edited_content || origMsg.content || '').slice(0, 60) : '';
                if (!content) {
                    const mt = el.querySelector('.message-text');
                    if (mt) content = mt.textContent.slice(0, 60);
                }
                replyToId = mid;
                const rp = document.getElementById('replyPreview');
                const rpt = document.getElementById('replyPreviewText');
                if (rp && rpt) { rpt.textContent = nick + ': ' + content; rp.style.display = 'flex'; }
                const vf2 = document.getElementById('voiceFixedBtn'); if (vf2) vf2.style.display = 'none';
                try { chatInput.focus(); } catch(_) {}
            }
        }
    });
    chatMessages.addEventListener('touchcancel', resetSwipe);
})();
async function flushOutbox() {
    let q = [];
    try { q = JSON.parse(localStorage.getItem('437core_outbox')||'[]'); } catch(_) { q = []; }
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
        try {
            const { error } = await supabaseClient.from('messages').insert([{user_id:user.id,channel: currentChannel,content:item.content,media_url:item.media_url,media_type:item.media_type,attachment:item.attachment||null,reply_to:item.reply_to}]);
            if (error) remaining.push(item);
        } catch (_) { remaining.push(item); }
    }
    try { localStorage.setItem('437core_outbox', JSON.stringify(remaining)); } catch(_) {}
    if (remaining.length < q.length) { loadMsgs(); }
}
// Presence persistence: update last_seen periodically
async function touchLastSeen() {
    try { await supabaseClient.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id); } catch(_) {}
}
setInterval(touchLastSeen, 300000);
touchLastSeen();
window.addEventListener('online', flushOutbox);
flushOutbox();
await getProfiles();
loadMsgs().then(() => { chatMessages.scrollTop = chatMessages.scrollHeight; renderPinnedBar(); });
// Restore UI state when returning to the page (back-forward cache or normal navigation)
window.addEventListener('pageshow', async () => {
    restoreChatUI();
    await loadMsgs();
});
// Wenn der Tab wieder sichtbar wird (z. B. zurück von Einstellungen über Browser-Zurück)
window.addEventListener('focus', async () => {
    restoreChatUI();
    await loadMsgs();
});
supabaseClient.channel('t2').on('broadcast',{event:'t'},({payload})=>{ if(payload.n===user.nickname)return; if(payload.o) typingUsers.add(payload.n); else typingUsers.delete(payload.n); updT(); }).subscribe();
supabaseClient.channel('m1').on('postgres_changes',{event:'*',schema:'public',table:'messages'},(p)=>{ try { if(!p||typeof p!=='object')return; const ch = (p.new&&p.new.channel) || (p.old&&p.old.channel); if (!ch || typeof isMyChannel !== 'function' || !isMyChannel(ch)) return; if (ch === currentChannel) { if (aiTypingTO && p.new && p.new.user_id === '43700000-0000-4000-8000-000000437001') setAiTyping(false); debouncedLoadMsgs(); } else { const k = unreadKey(ch); const n = parseInt(localStorage.getItem(k)||'0',10)+1; localStorage.setItem(k,String(n)); updateChannelBadges(); } } catch(_){} }).subscribe();
supabaseClient.channel('r1').on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},()=>debouncedLoadMsgs()).subscribe();
    try {
        supabaseClient.channel('attach_votes_rt').on('postgres_changes',{event:'*',schema:'public',table:'message_votes'},(p)=>{
            const mid = p && p.new ? p.new.message_id : (p && p.old ? p.old.message_id : null);
            if (mid && (loadedMsgs||[]).some(m => m.id === mid)) debouncedLoadMsgs();
        }).subscribe();
        supabaseClient.channel('attach_rsvps_rt').on('postgres_changes',{event:'*',schema:'public',table:'event_rsvps'},(p)=>{
            const mid = p && p.new ? p.new.message_id : (p && p.old ? p.old.message_id : null);
            if (mid && (loadedMsgs||[]).some(m => m.id === mid)) debouncedLoadMsgs();
        }).subscribe();
    } catch (e) { console.warn('attachment realtime sub failed', e); }
    try { supabaseClient.channel('drops437_videos_rt').on('postgres_changes',{event:'*',schema:'public',table:'drops_437_videos'}, async ()=>{ await loadDrops437Videos(); if (isDrops437Channel(currentChannel)) renderDrops437Channel(); }).subscribe(); } catch(e){ console.warn('drops437 realtime sub failed', e); }
    try { pollDrops437RSS(); } catch(_) {}
if (!drops437PollTimer) drops437PollTimer = setInterval(() => { try { pollDrops437RSS(); } catch(_) {} }, DROPS_437_POLL_MS);

    // ============ MESSAGE SEARCH (client-side, loaded messages only) ============
    let messageFilterQuery = '';
    function applyMessageFilter() {
        const q = (messageFilterQuery || '').trim().toLowerCase();
        const nodes = chatMessages ? chatMessages.querySelectorAll('.message') : [];
        nodes.forEach(el => {
            if (!q) { el.style.display = ''; return; }
            const t = (el.textContent || '').toLowerCase();
            const label = (el._attLabel || '').toLowerCase();
            el.style.display = (t.includes(q) || label.includes(q)) ? '' : 'none';
        });
    }
    window.applyMessageFilter = applyMessageFilter;

    const msgSearchInput = document.getElementById('msgSearchInput');
    const msgSearchClear = document.getElementById('msgSearchClear');
    if (msgSearchInput) {
        msgSearchInput.addEventListener('input', () => { messageFilterQuery = msgSearchInput.value || ''; applyMessageFilter(); });
        msgSearchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { msgSearchInput.value = ''; messageFilterQuery = ''; applyMessageFilter(); msgSearchInput.blur(); e.stopPropagation(); } });
    }
    if (msgSearchClear) msgSearchClear.addEventListener('click', () => { if (msgSearchInput) msgSearchInput.value = ''; messageFilterQuery = ''; applyMessageFilter(); if (msgSearchInput) msgSearchInput.focus(); });

    // ============ KEYBOARD SHORTCUTS ============
    if (!window.__437kb) {
        window.__437kb = true;
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const pairs = [['profileModal','flex'],['mediaModal','flex'],['confirmModal','flex'],['reportModal','flex'],['videoFullscreenModal','flex']];
                let handled = false;
                for (const [id] of pairs) { const el = document.getElementById(id); if (el && el.style.display && el.style.display !== 'none') { el.style.display = 'none'; handled = true; } }
                const usr = document.getElementById('userSearchResults'); if (usr && usr.style.display && usr.style.display !== 'none') { usr.style.display = 'none'; handled = true; }
                const rp = document.getElementById('replyPreview'); if (rp && rp.style.display && rp.style.display !== 'none' && !handled) { if (typeof clearReply === 'function') clearReply(); }
                const ms2 = document.getElementById('msgSearchInput'); if (ms2 && document.activeElement === ms2 && ms2.value) { ms2.value = ''; messageFilterQuery = ''; applyMessageFilter(); handled = true; }
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.key === 'k' || e.key === 'K')) {
                const ci = document.getElementById('chatInput');
                if (ci) { e.preventDefault(); ci.focus(); }
            }
        });
    }
// setInterval(loadMsgs,10000);

// ============ VOICE CHANNEL SYSTEM ============
const voiceList = document.getElementById('voiceList');
const voiceEmojiInput = document.getElementById('voiceEmoji');
const voiceChannelNameInput = document.getElementById('voiceChannelName');
const createVoiceBtn = document.getElementById('createVoiceBtn');
const voiceActive = document.getElementById('voiceActive');
const voiceActiveName = document.getElementById('voiceActiveName');
const voiceTimer = document.getElementById('voiceTimer');
const voiceHistoryBtn = document.getElementById('voiceHistoryBtn');
const voiceHistoryList = null;
const voiceParticipantsDiv = document.getElementById('voiceParticipants');
const muteBtn = document.getElementById('muteBtn');
const camBtn = document.getElementById('camBtn');
const speakerBtn = document.getElementById('speakerBtn');
const screenBtn = document.getElementById('screenBtn');
const videoGrid = document.getElementById('videoGrid');
const voiceNavBtnEl = document.getElementById('voiceNavBtn');
const chatSidebar = document.querySelector('.chat-sidebar');

document.addEventListener('click', (e) => {
    // Fullscreen button click
    if (e.target.classList.contains('fs-btn')) {
        const vid = document.getElementById(e.target.dataset.target);
        if (!vid) return;
        openVideoFullscreen(vid);
    }
    // Click directly on video to open fullscreen
    if (e.target.tagName === 'VIDEO' && e.target.classList.contains('msg-media') === false) {
        openVideoFullscreen(e.target);
    }
});

// Video fullscreen modal
const videoFullscreenModal = document.getElementById('videoFullscreenModal');
const videoFullscreenContent = document.getElementById('videoFullscreenContent');
const videoFullscreenLabel = document.getElementById('videoFullscreenLabel');
const videoFullscreenClose = document.getElementById('videoFullscreenClose');

function openVideoFullscreen(videoEl) {
    if (!videoFullscreenModal || !videoFullscreenContent) return;
    const clone = videoEl.cloneNode(true);
    clone.style.width = 'auto';
    clone.style.height = 'auto';
    clone.style.maxWidth = '100vw';
    clone.style.maxHeight = '100vh';
    clone.controls = true;
    clone.muted = false;
    videoFullscreenContent.innerHTML = '';
    videoFullscreenContent.appendChild(clone);

    // Label
    const labelEl = videoEl.closest('.video-wrapper')?.querySelector('.video-label');
    const labelText = labelEl ? labelEl.textContent : 'Kamera';
    videoFullscreenLabel.textContent = labelText;

    videoFullscreenModal.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeVideoFullscreen() {
    if (!videoFullscreenModal) return;
    videoFullscreenModal.classList.remove('open');
    videoFullscreenContent.innerHTML = '';
    document.body.style.overflow = '';
}

if (videoFullscreenClose) {
    videoFullscreenClose.onclick = closeVideoFullscreen;
}
if (videoFullscreenModal) {
    videoFullscreenModal.onclick = (e) => {
        if (e.target === videoFullscreenModal) closeVideoFullscreen();
    };
}

// ---------- Voice state ----------
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const voice = {
    channelId: null,
    channelName: '',
    startTime: 0,
    timerInterval: null,
    localStream: null,
    isMuted: false,
    isCameraOn: false,
    isSpeakerOn: true,
    isDeafened: false,
    peers: {},
    peerJoinTimes: {},
    webrtcChannel: null,
    remoteStreams: {},
    audioCtx: null,
    renderTimer: null,
    lastRenderKey: '',
    analysers: {},
    speakingPids: new Set(),
    vadInterval: null,
    speakingThreshold: -45,
    effect: 'none',
    preventSleepTimer: null,
    cameraFacingMode: 'user',
    isMobile,
    isScreenSharing: false,
    quality: 'EXZELLENT',
    reconnectCount: 0,
    reconnectTimer: null,
    qualityTimer: null,
    isHost: false,
    historyId: null,
    hadScreen: false,
};

    // Voice-Channel-Wiederherstellung starten (nach voice-Deklaration, um TDZ zu vermeiden)
    restoreVoiceChannel();

    const iceConfig = { iceServers: window.CALL_ICE_SERVERS || [{ urls: 'stun:stun.l.google.com:19302' }] };

// ---------- Permissions ----------
async function requestPermissions(wantCamera) {
    const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: wantCamera
            ? (isMobile ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : true)
            : false,
    };
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        // stop immediately, we just wanted the permission prompt
        stream.getTracks().forEach(t => t.stop());
        return true;
    } catch (err) {
        console.error('Permission denied', err);
        alert('Mikrofon/Kamera-Berechtigung verweigert. Voice-Chat funktioniert nicht ohne Mikrofon.');
        return false;
    }
}

// ---------- Rendering ----------
function renderVoiceChannels(channels, categories) {
    if (!voiceList) return;
    const key = channels.map(c => c.id + '|' + c.name).join('::');
    if (key === voice.lastRenderKey) return;
    voice.lastRenderKey = key;

    // Teilnehmer-Counts parallel laden
    const countMap = {};
    channels.forEach(ch => { countMap[ch.id] = 0; });

    voiceList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    channels.forEach(ch => {
        const inCh = voice.channelId === ch.id;
        const canDelete = isAdmin();
        const item = document.createElement('div');
        item.className = 'voice-item-expanded' + (inCh ? ' active' : '');
        item.innerHTML =
            '<div class="voice-item-header">' +
            '<span>' + esc(ch.name) + '</span>' +
            '<span class="voice-item-count">' + (inCh ? '●' : '') + '</span>' +
            '</div>' +
            '<div class="voice-item-body">' +
            '<div class="voice-preview-list" id="vp_' + ch.id + '"></div>' +
            '<div style="display:flex;gap:6px;align-items:center;">' +
            '<button class="voice-join-btn" data-id="' + ch.id + '" data-name="' + esc(ch.name) + '" ' + (inCh ? 'disabled' : '') + '>' +
            (inCh ? 'VERBUNDEN' : 'BEITRETEN') +
            '</button>' +
            (canDelete ? '<button class="voice-del-btn" data-del="' + ch.id + '" title="Kanal löschen">🗑</button>' : '') +
            '</div>' +
            '</div>';
        const btn = item.querySelector('.voice-join-btn');
        if (!inCh) {
            btn.onclick = async () => {
                const ok = await requestPermissions(false);
                if (!ok) return;
                joinVC(ch.id, ch.name);
            };
        }
        const delBtn = item.querySelector('.voice-del-btn');
        if (delBtn) {
            delBtn.onclick = async () => {
                if (!confirm('Kanal "' + ch.name + '" wirklich löschen? Alle Teilnehmer werden entfernt.')) return;
                try {
                    await supabaseClient.from('voice_participants').delete().eq('channel_id', ch.id);
                    await supabaseClient.from('voice_channels').delete().eq('id', ch.id);
                    if (voice.channelId === ch.id) await leaveVoiceChannel();
                    loadChannels();
                } catch (err) { console.error('Delete channel failed', err); }
            };
        }
        fragment.appendChild(item);
    });
    voiceList.appendChild(fragment);

    // Teilnehmer-Counts asynchron laden und aktualisieren
    channels.forEach(ch => loadChannelCount(ch.id));

    // load participants preview for each channel (non-blocking)
    channels.forEach(ch => loadChannelParticipantsPreview(ch.id));
}

async function loadChannelCount(channelId) {
    try {
        const { count } = await supabaseClient.from('voice_participants').select('*', { count: 'exact', head: true }).eq('channel_id', channelId);
        if (count === null) return;
        voiceList.querySelectorAll('.voice-item-expanded').forEach(item => {
            const joinBtn = item.querySelector('.voice-join-btn');
            if (joinBtn && joinBtn.dataset.id === channelId && !item.classList.contains('active')) {
                const c = item.querySelector('.voice-item-count');
                if (c) c.textContent = count;
            }
        });
    } catch (_) {}
}

async function loadChannelParticipantsPreview(channelId) {
    const listEl = document.getElementById('vp_' + channelId);
    if (!listEl) return;
    try {
        const { data: parts } = await supabaseClient.from('voice_participants')
            .select('user_id')
            .eq('channel_id', channelId);
        if (!parts || !parts.length) {
            listEl.innerHTML = '<span style="color:var(--text-secondary);font-size:0.65rem;">LEER</span>';
            return;
        }
        const ids = parts.map(p => p.user_id);
        const { data: prs } = await supabaseClient.from('profiles').select('id,nickname,avatar_url,bio').in('id', ids);
        listEl.innerHTML = '';
        (prs || []).forEach(p => {
            const wrapper = document.createElement('span');
            wrapper.className = 'voice-preview-user';
            wrapper.title = p.nickname;
            wrapper.innerHTML =
                '<img src="' + (p.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(p.nickname || 'x')) + '" class="voice-preview-avatar" alt="" loading="lazy" decoding="async">' +
                '<span class="voice-preview-name">' + esc(p.nickname) + '</span>';
            listEl.appendChild(wrapper);
        });
        const more = parts.length - (prs || []).length;
        if (more > 0) {
            const span = document.createElement('span');
            span.className = 'voice-preview-more';
            span.textContent = '+' + more;
            listEl.appendChild(span);
        }
    } catch (err) {
        console.error('Preview load failed', err);
    }
}

function renderParticipants(participants) {
    if (!voiceParticipantsDiv) return;
    voiceParticipantsDiv.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const isMod = isAdmin() || voice.isHost;

    participants.forEach(p => {
        const isMe = p.id === user.id;
        const isBanned = p.banned_at && new Date(p.banned_at) > new Date();
        const isMuted = p.muted_until && new Date(p.muted_until) > new Date();
        const div = document.createElement('div');
        div.className = 'voice-participant' + (isMe ? ' me' : '') + (isBanned ? ' banned' : '') + (isMuted ? ' muted' : '');
        div.dataset.uid = p.id;
        let modBtns = '';
        if (isMod && !isMe) {
            modBtns =
                '<button class="voice-mod-kick" data-uid="' + p.id + '" title="Kicken">👢</button>' +
                (isMuted ? '<button class="voice-mod-unmute" data-uid="' + p.id + '" title="Stummschaltung aufheben">🔊</button>' : '<button class="voice-mod-mute" data-uid="' + p.id + '" title="10 Min stummschalten">🔇</button>') +
                '<button class="voice-mod-ban" data-uid="' + p.id + '" title="Bannen">🚫</button>';
        }
        div.innerHTML =
            '<div class="voice-participant-avatar"><img src="' + (p.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(p.nickname || 'x')) + '" loading="lazy" decoding="async" alt=""></div>' +
            '<span>' + esc(p.nickname) + (isMe ? ' (DU)' : '') + (isBanned ? ' <span style="color:var(--neon-pink);font-size:0.65rem;">GEBANNT</span>' : '') + (isMuted ? ' <span style="color:var(--neon-pink);font-size:0.65rem;">GEMUTET</span>' : '') + '</span>' +
            modBtns;
        fragment.appendChild(div);
    });
    voiceParticipantsDiv.appendChild(fragment);

    // Moderation button handlers
    if (isMod) {
        fragment.querySelectorAll('.voice-mod-kick').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); kickUser(btn.dataset.uid); };
        });
        fragment.querySelectorAll('.voice-mod-mute').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); muteUser(btn.dataset.uid, 10 * 60 * 1000); };
        });
        fragment.querySelectorAll('.voice-mod-unmute').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); muteUser(btn.dataset.uid, 0); };
        });
        fragment.querySelectorAll('.voice-mod-ban').forEach(btn => {
            btn.onclick = (e) => { e.stopPropagation(); banUser(btn.dataset.uid); };
        });
    }
}

function isChannelModerator() {
    return isAdmin() || voice.isHost;
}

async function kickUser(uid) {
    if (!voice.channelId) return;
    if (!confirm('Teilnehmer wirklich kicken?')) return;
    try {
        await supabaseClient.from('voice_participants').delete().eq('channel_id', voice.channelId).eq('user_id', uid);
        // Realtime-Event wird über voice_participants subscription gepickt und löst loadParticipants aus
        // Der gekickte User bekommt keinen direkten Befehl; sein Client merkt es an fehlender Teilnahme
    } catch (err) { console.error('Kick failed', err); alert('Kick fehlgeschlagen.'); }
}

async function muteUser(uid, untilMs) {
    if (!voice.channelId) return;
    const mutedUntil = untilMs > 0 ? new Date(Date.now() + untilMs).toISOString() : null;
    try {
        await supabaseClient.from('voice_participants').update({ muted_until: mutedUntil }).eq('channel_id', voice.channelId).eq('user_id', uid);
    } catch (err) { console.error('Mute failed', err); alert('Stummschaltung fehlgeschlagen.'); }
}

async function banUser(uid) {
    if (!voice.channelId) return;
    if (!confirm('Teilnehmer wirklich bannen?')) return;
    try {
        await supabaseClient.from('voice_participants').update({ banned_at: new Date().toISOString(), banned_by: user.id }).eq('channel_id', voice.channelId).eq('user_id', uid);
        await supabaseClient.from('voice_participants').delete().eq('channel_id', voice.channelId).eq('user_id', uid);
    } catch (err) { console.error('Ban failed', err); alert('Ban fehlgeschlagen.'); }
}

// ---------- Voice Call-Verlauf ----------
async function loadVoiceHistory() {
    if (!voice.channelId || !voiceHistoryList) return;
    try {
        const { data: rows } = await supabaseClient.from('voice_call_history')
            .select('*')
            .eq('channel_id', voice.channelId)
            .order('joined_at', { ascending: false })
            .limit(50);
        if (!rows) {
            voiceHistoryList.innerHTML = '<div style="color:var(--text-secondary);font-size:0.75rem;padding:1rem;text-align:center;">NOCH KEINE EINTRÄGE</div>';
            return;
        }
        const ids = [...new Set(rows.map(r => r.user_id))];
        const { data: prs } = await supabaseClient.from('profiles').select('id,nickname,avatar_url').in('id', ids);
        const prsMap = {};
        (prs || []).forEach(p => { prsMap[p.id] = p; });
        voiceHistoryList.innerHTML = '';
        rows.forEach(r => {
            const p = prsMap[r.user_id] || { nickname: 'Unbekannt', avatar_url: '' };
            const dur = r.duration_sec ? String(Math.floor(r.duration_sec / 60)).padStart(2, '0') + ':' + String(r.duration_sec % 60).padStart(2, '0') : '00:00';
            const media = [];
            if (r.had_audio) media.push('🎤');
            if (r.had_video) media.push('📹');
            if (r.had_screen) media.push('🖥️');
            const isMe = r.user_id === user.id;
            const div = document.createElement('div');
            div.className = 'voice-history-entry' + (isMe ? ' me' : '');
            div.innerHTML =
                '<div class="voice-history-avatar"><img src="' + (p.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=' + encodeURIComponent(p.nickname || 'x')) + '" alt="" loading="lazy"></div>' +
                '<div class="voice-history-info">' +
                '<div class="voice-history-name">' + esc(p.nickname) + (isMe ? ' (DU)' : '') + '</div>' +
                '<div class="voice-history-duration">' + dur + ' ' + media.join(' ') + '</div>' +
                '</div>' +
                '<div class="voice-history-time">' + new Date(r.joined_at).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' }) + '</div>';
            voiceHistoryList.appendChild(div);
        });
    } catch (err) { console.error('Voice history load failed', err); voiceHistoryList.innerHTML = '<div style="color:var(--neon-pink);font-size:0.75rem;padding:1rem;text-align:center;">FEHLER BEIM LADEN</div>'; }
}

// ---------- Voice Text-Chat ----------
// ---------- WebRTC ----------
function createPeerConnection(pid) {
    const pc = new RTCPeerConnection(iceConfig);
    voice.peers[pid] = pc;
    voice.peerJoinTimes[pid] = Date.now();

    if (voice.localStream) {
        voice.localStream.getTracks().forEach(t => pc.addTrack(t, voice.localStream));
    }

    pc.onicecandidate = (e) => {
        if (e.candidate && voice.webrtcChannel) {
            voice.webrtcChannel.send({
                type: 'broadcast', event: 'i',
                payload: { from: user.id, to: pid, c: e.candidate }
            });
        }
    };

    pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === 'failed' || s === 'disconnected') {
            scheduleVoiceReconnect();
        } else if (s === 'connected' || s === 'completed') {
            voice.reconnectCount = 0;
        }
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
            scheduleVoiceReconnect();
        }
    };

    pc.ontrack = (e) => {
        const [stream] = e.streams;
        voice.remoteStreams[pid] = stream;
        // Video-Element nur erstellen, wenn der Remote-Stream Video-Tracks hat
        if (stream.getVideoTracks().length > 0) {
            addRemoteVideo(pid, stream);
        }
        // Audio-Element für Remote-Audio erstellen und abspielen (auch bei reinem Audio-Stream)
        setupRemoteAudio(pid, stream);
        setupSpeakerAnalyser(pid, stream);
    };

    return pc;
}

function setupWebRTC() {
    if (voice.webrtcChannel) {
        try { supabaseClient.removeChannel(voice.webrtcChannel); } catch (e) {}
        voice.webrtcChannel = null;
    }
    voice.webrtcChannel = supabaseClient.channel('rtc:' + voice.channelId);

    voice.webrtcChannel
        .on('broadcast', { event: 'o' }, async ({ payload }) => {
            if (payload.to !== user.id) return;
            const pc = voice.peers[payload.from];
            if (!pc) {
                // Neuer Peer: Verbindung aufbauen und Answer senden
                const newPc = createPeerConnection(payload.from);
                try {
                    await newPc.setRemoteDescription(new RTCSessionDescription(payload.o));
                    const ans = await newPc.createAnswer();
                    await newPc.setLocalDescription(ans);
                    voice.webrtcChannel.send({
                        type: 'broadcast', event: 'a',
                        payload: { from: user.id, to: payload.from, a: ans }
                    });
                } catch (err) { console.error('WebRTC answer failed', err); }
            } else if (payload.restart) {
                // Ice-Restart: nur Remote-Description setzen und antworten
                await handleVoiceIceRestartOffer(pc, payload.o, payload.from);
            } else {
                // Bestehender Peer: Renegotiation (z. B. Kamera/Mikrofon nachträglich)
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.o));
                    const ans = await pc.createAnswer();
                    await pc.setLocalDescription(ans);
                    voice.webrtcChannel.send({
                        type: 'broadcast', event: 'a',
                        payload: { from: user.id, to: payload.from, a: ans }
                    });
                } catch (err) { console.error('WebRTC renegotiate answer failed', err); }
            }
        })
        .on('broadcast', { event: 'a' }, async ({ payload }) => {
            if (payload.to !== user.id) return;
            const pc = voice.peers[payload.from];
            if (pc) {
                try { await pc.setRemoteDescription(new RTCSessionDescription(payload.a)); }
                catch (err) { console.error('WebRTC set answer failed', err); }
            }
        })
        .on('broadcast', { event: 'i' }, async ({ payload }) => {
            if (payload.to !== user.id) return;
            const pc = voice.peers[payload.from];
            if (pc && payload.c) {
                try { await pc.addIceCandidate(new RTCIceCandidate(payload.c)); }
                catch (err) { console.error('WebRTC ICE failed', err); }
            }
        })
        .subscribe();
}

function renegotiatePeer(pid) {
    const pc = voice.peers[pid];
    if (!pc || !voice.webrtcChannel) return;
    pc.createOffer().then(offer => pc.setLocalDescription(offer))
        .then(() => voice.webrtcChannel.send({
            type: 'broadcast', event: 'o',
            payload: { from: user.id, to: pid, o: pc.localDescription }
        }))
        .catch(err => console.error('Renegotiate failed', err));
}

function renegotiateAllPeers() {
    Object.keys(voice.peers).forEach(pid => renegotiatePeer(pid));
}

function callPeers() {
    if (!voice.channelId) return;
    supabaseClient.from('voice_participants')
        .select('user_id')
        .eq('channel_id', voice.channelId)
        .then(({ data: parts }) => {
            if (!parts) return;
            parts.forEach(p => {
                if (p.user_id === user.id) return;
                if (voice.peers[p.user_id]) return;
                const pc = createPeerConnection(p.user_id);
                pc.createOffer().then(offer => pc.setLocalDescription(offer))
                    .then(() => voice.webrtcChannel.send({
                        type: 'broadcast', event: 'o',
                        payload: { from: user.id, to: p.user_id, o: pc.localDescription }
                    }))
                    .catch(err => console.error('Call peer failed', err));
            });
        });
}

// ---------- Voice Reconnect ----------
function scheduleVoiceReconnect() {
    const max = (window.CALL_DEFAULTS && window.CALL_DEFAULTS.reconnectAttempts) || 3;
    if (voice.reconnectCount >= max) return;
    voice.reconnectCount += 1;

    // Berechne ob dieser Client Reconnect initiieren soll:
    // Der Teilnehmer mit ältestem Join-Zeitpunkt unter den verbundenen Peers initiiert.
    // Staggered Delay: älterer Joiner = kürzere Verzögerung, um Doppel-Initiierung zu vermeiden.
    const myJoin = voice.peerJoinTimes[user.id] || Date.now();
    let oldestJoin = myJoin;
    Object.values(voice.peers).forEach(pc => {
        // peerJoinTimes ist nach pid keyed; wir suchen den ältesten unter uns und unseren Peers
    });
    Object.keys(voice.peerJoinTimes).forEach(pid => {
        if (voice.peerJoinTimes[pid] < oldestJoin) oldestJoin = voice.peerJoinTimes[pid];
    });

    const isOldest = myJoin <= oldestJoin;
    const delayBase = (window.CALL_DEFAULTS && window.CALL_DEFAULTS.reconnectDelayMs) || 10000;
    // Jeder nicht-älteste wartet etwas länger, damit der älteste zuerst initiiert
    const delay = isOldest ? delayBase : delayBase + 3000;

    if (voice.reconnectTimer) clearTimeout(voice.reconnectTimer);
    voice.reconnectTimer = setTimeout(() => {
        attemptVoiceIceRestart();
    }, delay);
}

async function attemptVoiceIceRestart() {
    if (!voice.channelId) return;
    const pcs = Object.values(voice.peers);
    if (pcs.length === 0) return;
    // Sende iceRestart-Offer an alle verbundenen Peers (Broadcast)
    try {
        const offerPromises = pcs.map(async (pc) => {
            try {
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                voice.webrtcChannel.send({
                    type: 'broadcast', event: 'offer',
                    payload: { from: user.id, to: null, sdp: pc.localDescription, restart: true, target: pidOf(pc) }
                });
            } catch (_) {}
        });
        await Promise.all(offerPromises);
    } catch (_) { scheduleVoiceReconnect(); }
}

function pidOf(pc) {
    for (const [pid, p] of Object.entries(voice.peers)) {
        if (p === pc) return pid;
    }
    return null;
}

// WebRTC 'offer' mit restart: true empfangen (jeder kann initiieren, alle antworten)
async function handleVoiceIceRestartOffer(pc, sdp, fromId) {
    if (!pc) return;
    try {
        pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        voice.webrtcChannel.send({
            type: 'broadcast', event: 'a',
            payload: { from: user.id, to: fromId, a: ans }
        });
    } catch (err) { console.error('Voice ice restart answer failed', err); }
}

function addRemoteVideo(pid, stream) {
    let wrap = document.getElementById('wrap_' + pid);
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'video-wrapper';
        wrap.id = 'wrap_' + pid;
        wrap.innerHTML = '<video id="v_' + pid + '" autoplay playsinline muted remote></video>' +
            '<div class="video-label" id="l_' + pid + '"></div>' +
            '<button class="fs-btn" data-target="v_' + pid + '">⤢</button>';
        videoGrid.appendChild(wrap);
    }
    const v = document.getElementById('v_' + pid);
    v.srcObject = stream;
    v.muted = !voice.isSpeakerOn;
    supabaseClient.from('profiles').select('nickname').eq('id', pid).maybeSingle()
        .then(({ data: pr }) => {
            const el = document.getElementById('l_' + pid);
            if (el) el.textContent = pr?.nickname || pid.slice(0, 6);
        });
    videoGrid.style.display = 'flex';
}

// ---------- Remote audio playback ----------
function setupRemoteAudio(pid, stream) {
    let a = document.getElementById('a_' + pid);
    if (!a) {
        a = document.createElement('audio');
        a.id = 'a_' + pid;
        a.autoplay = true;
        a.playsinline = true;
        a.style.display = 'none';
        document.body.appendChild(a);
    }
    a.srcObject = stream;
    a.muted = voice.isDeafened;
    a.volume = voice.isDeafened ? 0 : 1;
    a.play().catch(() => {});
}

// ---------- Audio analysis (speaking animation) ----------
function initAudioCtx() {
    if (!voice.audioCtx) {
        voice.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (voice.audioCtx.state === 'suspended') {
            voice.audioCtx.resume();
        }
    }
}

function setupSpeakerAnalyser(pid, stream) {
    initAudioCtx();
    if (voice.analysers[pid]) return; // already analysing
    const analyser = voice.audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const source = voice.audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    voice.analysers[pid] = analyser;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const check = () => {
        try {
            analyser.getByteFrequencyData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i];
            const avg = sum / buf.length;
            const isSpeaking = avg > 20;
            const el = document.querySelector('.voice-participant[data-uid="' + pid + '"]');
            if (el) {
                if (isSpeaking) {
                    el.classList.add('speaking');
                    voice.speakingPids.add(pid);
                } else {
                    el.classList.remove('speaking');
                    voice.speakingPids.delete(pid);
                }
            }
        } catch (e) {}
        if (voice.remoteStreams[pid] || pid === user.id) requestAnimationFrame(check);
    };
    check();
}

function setupLocalSpeakerAnalyser() {
    initAudioCtx();
    if (!voice.localStream) return;
    const pid = user.id;
    if (voice.analysers[pid]) return;
    const analyser = voice.audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const source = voice.audioCtx.createMediaStreamSource(voice.localStream);
    source.connect(analyser);
    voice.analysers[pid] = analyser;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const check = () => {
        try {
            analyser.getByteFrequencyData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i];
            const avg = sum / buf.length;
            const isSpeaking = avg > 20 && !voice.isMuted;
            const el = document.querySelector('.voice-participant[data-uid="' + pid + '"]');
            if (el) {
                if (isSpeaking) {
                    el.classList.add('speaking');
                    voice.speakingPids.add(pid);
                } else {
                    el.classList.remove('speaking');
                    voice.speakingPids.delete(pid);
                }
            }
        } catch (e) {}
        if (voice.localStream) requestAnimationFrame(check);
    };
    check();
}

// ---------- Voice Qualitätsstats ----------
function pollVoiceStats() {
    if (!voice.channelId || !voice.webrtcChannel) return;
    let worstLevel = 'EXZELLENT';
    Object.values(voice.peers).forEach(pc => {
        if (!pc || !pc.getStats) return;
        try {
            const stats = pc.getStats();
            stats.forEach((r) => {
                if (r.type === 'candidate-pair' && (r.state === 'succeeded' || r.state === 'in-progress') && r.nominated) {
                    const rtt = typeof r.currentRoundTripTime === 'number' ? r.currentRoundTripTime : 0;
                    if (rtt > 0.4) worstLevel = 'SCHWACH';
                    else if (rtt > 0.18 && worstLevel === 'EXZELLENT') worstLevel = 'GUT';
                }
                if (r.type === 'inbound-rtp' && (r.kind === 'audio' || r.mediaType === 'audio')) {
                    const lost = r.packetsLost != null ? r.packetsLost : 0;
                    const received = r.packetsReceived != null ? r.packetsReceived : 0;
                    const total = lost + received;
                    if (total > 0) {
                        const loss = lost / total;
                        if (loss > 0.08) worstLevel = 'SCHWACH';
                        else if (loss > 0.03 && worstLevel === 'EXZELLENT') worstLevel = 'GUT';
                    }
                }
            });
        } catch (_) {}
    });
    voice.quality = worstLevel;
    const qEl = document.getElementById('voiceQuality');
    if (qEl) {
        qEl.textContent = 'QUALITÄT: ' + worstLevel;
        qEl.className = 'voice-quality ' + worstLevel.toLowerCase();
    }
}

function startVoiceQualityPoll() {
    stopVoiceQualityPoll();
    voice.qualityTimer = setInterval(pollVoiceStats, (window.CALL_DEFAULTS && window.CALL_DEFAULTS.qualityIntervalMs) || 2000);
}
function stopVoiceQualityPoll() {
    if (voice.qualityTimer) {
        clearInterval(voice.qualityTimer);
        voice.qualityTimer = null;
    }
}

// ---------- Local media ----------
async function getLocalMedia(audio, video) {
    return await navigator.mediaDevices.getUserMedia({
        audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
        video: video
            ? (isMobile ? { facingMode: voice.cameraFacingMode, width: { ideal: 640 }, height: { ideal: 480 } } : true)
            : false,
    });
}

function updateLocalVideo() {
    const wrap = document.getElementById('wrap_local');
    const voiceLocalVideo = document.getElementById('voiceLocalVideo');
    if (voice.isCameraOn && voice.localStream) {
        if (!wrap) {
            const w = document.createElement('div');
            w.className = 'video-wrapper';
            w.id = 'wrap_local';
            w.innerHTML = '<video id="localV" autoplay playsinline muted></video>' +
                '<div class="video-label">' + esc(user.nickname) + ' (DU)</div>' +
                '<button class="fs-btn" data-target="localV">⤢</button>';
            videoGrid.appendChild(w);
        }
        document.getElementById('localV').srcObject = voice.localStream;
        videoGrid.style.display = 'flex';
        // Lokale Kamera-Vorschau im Voice-Active-Block (über dem Timer)
        if (voiceLocalVideo) {
            voiceLocalVideo.srcObject = voice.localStream;
            voiceLocalVideo.style.display = 'block';
        }
    } else {
        if (wrap) wrap.remove();
        if (videoGrid.querySelectorAll('.video-wrapper').length === 0) videoGrid.style.display = 'none';
        if (voiceLocalVideo) voiceLocalVideo.style.display = 'none';
    }
}

async function toggleMic() {
    if (voice.isMuted) {
        try {
            if (!voice.localStream) {
                voice.localStream = await getLocalMedia(true, voice.isCameraOn);
            } else {
                // Stream existiert bereits (z. B. nur Video von Kamera) – Audio-Track prüfen
                const existingAudio = voice.localStream.getAudioTracks();
                if (existingAudio.length === 0) {
                    // Kein Audio im Stream: neuen Stream mit Audio holen, vorhandene Video-Tracks übernehmen
                    const newStream = await getLocalMedia(true, voice.isCameraOn);
                    if (voice.isCameraOn) {
                        voice.localStream.getVideoTracks().forEach(t => newStream.addTrack(t));
                    }
                    voice.localStream = newStream;
                } else {
                    voice.localStream.getAudioTracks().forEach(t => { t.enabled = true; });
                }
            }
            const audioTrack = voice.localStream.getAudioTracks()[0];
            if (audioTrack) {
                Object.values(voice.peers).forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track && s.track.kind === 'audio');
                    if (sender) {
                        sender.replaceTrack(audioTrack).catch(() => {});
                    } else {
                        pc.addTrack(audioTrack, voice.localStream);
                        renegotiateAllPeers();
                    }
                });
            }
            setupLocalSpeakerAnalyser();
            voice.isMuted = false;
        } catch (err) {
            console.error('Mic enable failed', err);
            alert('Mikrofon konnte nicht aktiviert werden.');
            return;
        }
    } else {
        if (voice.localStream) {
            voice.localStream.getAudioTracks().forEach(t => { t.enabled = false; });
        }
        voice.isMuted = true;
    }
    muteBtn.classList.toggle('muted', voice.isMuted);
    muteBtn.textContent = voice.isMuted ? '🔇' : '🎤';
    if (isMobile && navigator.vibrate) { try { navigator.vibrate(20); } catch (_) {} }
}

async function toggleCam() {
    if (!voice.isCameraOn) {
        try {
            const vs = await getLocalMedia(false, true);
            if (!voice.localStream) voice.localStream = new MediaStream();
            vs.getVideoTracks().forEach(t => {
                voice.localStream.addTrack(t);
                Object.values(voice.peers).forEach(pc => pc.addTrack(t, voice.localStream));
            });
            renegotiateAllPeers();
            voice.isCameraOn = true;
            updateLocalVideo();
            camBtn.classList.add('active');
        } catch (err) { console.error('Cam enable failed', err); alert('Kamera konnte nicht aktiviert werden.'); }
    } else {
        if (voice.localStream) {
            voice.localStream.getVideoTracks().forEach(t => {
                t.stop();
                voice.localStream.removeTrack(t);
                Object.values(voice.peers).forEach(pc => {
                    const s = pc.getSenders().find(s => s.track === t);
                    if (s) pc.removeTrack(s);
                });
            });
        }
        renegotiateAllPeers();
        updateLocalVideo();
        voice.isCameraOn = false;
        camBtn.classList.remove('active');
    }
}

// ---------- Screen-Sharing Voice ----------
async function toggleVoiceShare() {
    if (!voice.channelId) return;
    if (!voice.isScreenSharing) {
        try {
            let s;
            try {
                s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            } catch (err) {
                s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
            }
            const track = s.getVideoTracks()[0];
            if (!track) { alert('Kein Video-Track vom Bildschirm verfügbar.'); return; }
            const audioTrack = s.getAudioTracks()[0];
            let replaced = false;
            Object.values(voice.peers).forEach(pc => {
                const videoSender = pc.getSenders().find(x => x.track && x.track.kind === 'video');
                if (videoSender) {
                    try { videoSender.replaceTrack(track); replaced = true; } catch (_) {}
                } else {
                    try { pc.addTrack(track, voice.localStream); replaced = true; renegotiateAllPeers(); } catch (_) {}
                }
                if (audioTrack) {
                    const audioSender = pc.getSenders().find(x => x.track && x.track.kind === 'audio');
                    if (audioSender) {
                        try { audioSender.replaceTrack(audioTrack); } catch (_) {}
                    } else {
                        try { pc.addTrack(audioTrack, voice.localStream); } catch (_) {}
                    }
                }
            });
            if (!replaced) {
                Object.values(voice.peers).forEach(pc => {
                    try { pc.addTransceiver('video', { direction: 'sendrecv', streams: [voice.localStream] }); } catch (_) {}
                });
                replaced = true;
            }
            voice.isScreenSharing = true;
            voice.hadScreen = true;
            screenBtn.classList.add('active', 'screen-active');
            const me = user.nickname || '437 Core';
            try { await postVoiceSystemMessage(voice.channelId, '🖥️ ' + esc(me) + ' teilt den Bildschirm'); } catch (_) {}
            track.onended = () => { if (voice.isScreenSharing) toggleVoiceShare(); };
            if (audioTrack) {
                audioTrack.onended = () => { if (voice.isScreenSharing) toggleVoiceShare(); };
            }
        } catch (err) {
            console.error('Screen share failed', err);
            alert('Bildschirmfreigabe nicht möglich.');
        }
    } else {
        let replaced = false;
        Object.values(voice.peers).forEach(pc => {
            const sender = pc.getSenders().find(x => x.track && x.track.kind === 'video');
            if (sender) {
                try { sender.replaceTrack(voice.localStream ? voice.localStream.getVideoTracks()[0] : null); replaced = true; } catch (_) {}
            }
            const audioSender = pc.getSenders().find(x => x.track && x.track.kind === 'audio');
            if (audioSender && voice.localStream) {
                const localAudio = voice.localStream.getAudioTracks()[0];
                if (localAudio) {
                    try { audioSender.replaceTrack(localAudio); } catch (_) {}
                }
            }
        });
        voice.isScreenSharing = false;
        voice.hadScreen = false;
        screenBtn.classList.remove('active', 'screen-active');
        updateLocalVideo();
    }
}

// ---------- Channel lifecycle ----------
function startTimer() {
    stopTimer();
    voice.startTime = Date.now();
    voice.timerInterval = setInterval(() => {
        const diff = Math.floor((Date.now() - voice.startTime) / 1000);
        voiceTimer.textContent = String(Math.floor(diff / 60)).padStart(2, '0') + ':' + String(diff % 60).padStart(2, '0');
    }, 1000);
}

function stopTimer() {
    if (voice.timerInterval) {
        clearInterval(voice.timerInterval);
        voice.timerInterval = null;
    }
}

async function loadChannels() {
    try {
        const { data: chs } = await supabaseClient.from('voice_channels').select('*');
        if (!chs) return;
        renderVoiceChannels(chs, []);
    } catch (err) { console.error('Load channels failed', err); }
}

async function loadParticipants() {
    if (!voice.channelId) return;
    try {
        const { data: parts } = await supabaseClient.from('voice_participants')
            .select('user_id, muted_until, banned_at')
            .eq('channel_id', voice.channelId);
        if (!parts) return;

        if (!parts.some(p => p.user_id === user.id)) {
            leaveVoiceChannel();
            return;
        }

        const ids = parts.map(p => p.user_id);
        const { data: prs } = await supabaseClient.from('profiles').select('id, nickname, avatar_url').in('id', ids);
        renderParticipants((prs || []).map(p => {
            const part = parts.find(pp => pp.user_id === p.id);
            return {
                id: p.id,
                nickname: p.nickname,
                avatar_url: p.avatar_url,
                muted_until: part ? part.muted_until : null,
                banned_at: part ? part.banned_at : null,
            };
        }));
    } catch (err) { console.error('Load participants failed', err); }
}

// ---------- Voice System Messages im Chat ----------
async function postVoiceSystemMessage(channelId, content) {
    if (!channelId || !content || !user || !user.id) {
        if (!user || !user.id) console.warn('postVoiceSystemMessage: user.id not available');
        return;
    }
    try {
        await supabaseClient.from('messages').insert([{
            user_id: user.id,
            channel: 'voice:' + channelId,
            content: String(content),
        }]);
    } catch (err) { console.error('Voice system message failed', err, 'user_id=', user ? user.id : 'NO_USER', 'channelId=', channelId); }
}

async function joinVC(id, name) {
    if (voice.channelId === id) return;
    if (voice.channelId) await leaveVoiceChannel();

    try {
        await supabaseClient.from('voice_participants').upsert([{ channel_id: id, user_id: user.id }], { onConflict: 'channel_id,user_id' });
    } catch (err) { /* may already exist */ }

    voice.channelId = id;
    voice.channelName = name;
    voice.hadScreen = false;
    localStorage.setItem('voiceChannelId', id);
    voiceActiveName.textContent = name;
    voiceActive.style.display = 'block';
    startTimer();
    startVoiceQualityPoll();

    // Call-Verlauf eintragen
    try {
        const { data: hist } = await supabaseClient.from('voice_call_history').insert([{
            channel_id: id,
            user_id: user.id,
            joined_at: new Date().toISOString(),
            had_audio: true,
            had_video: voice.isCameraOn,
            had_screen: false,
        }]).select('id').single();
        if (hist) voice.historyId = hist.id;
    } catch (err) { console.error('Voice history insert failed', err); }

    // System-Nachricht im Voice-Channel-Chat posten (nicht blockierend)
    const me = user.nickname || '437 Core';
    try { await postVoiceSystemMessage(id, '🔊 ' + esc(me) + ' ist dem Voice-Channel beigetreten'); } catch (_) {}

    // Host = Ersteller des Channels
    try {
        const { data: ch } = await supabaseClient.from('voice_channels').select('created_by').eq('id', id).maybeSingle();
        voice.isHost = ch && ch.created_by === user.id;
    } catch (_) { voice.isHost = false; }

    // request mic permission and start local stream (mobile constraints applied)
    try {
        voice.localStream = await getLocalMedia(true, voice.isCameraOn);
        setupLocalSpeakerAnalyser();
    } catch (err) {
        console.error('Local stream failed', err);
        alert('Mikrofon nicht verfügbar. Sie können den Channel trotzdem betreten, aber andere hören Sie nicht.');
    }

    setupWebRTC();
    await callPeers();
    updateLocalVideo();
    loadParticipants();

    // Mobile: prevent screen sleep while in voice
    if (isMobile) {
        startPreventSleep();
    }

    if (chatSidebar) chatSidebar.classList.remove('open');

    // Render channel strip so Voice Chat appears next to DROPS 437
    try { renderChannelStrip(); } catch (_) {}

    // Push-Benachrichtigung an andere Channel-Mitglieder senden
    sendVoiceJoinPush(id, name);
}

async function sendVoiceJoinPush(channelId, channelName) {
    try {
        const { data: parts } = await supabaseClient.from('voice_participants')
            .select('user_id')
            .eq('channel_id', channelId);
        if (!parts) return;
        const otherIds = parts.map(p => p.user_id).filter(pid => pid !== user.id);
        if (otherIds.length === 0) return;
        const me = user.nickname || '437 Core';
        await fetch((window.SUPABASE_URL || '') + '/functions/v1/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_ANON_KEY || '' },
            body: JSON.stringify({
                user_id: otherIds[0],
                type: 'call',
                title: '437 CORE VOICE',
                body: me + ' ist in ' + (channelName || 'Voice-Channel') + ' eingetreten',
                call_id: channelId,
                dm_id: null,
                sender_id: user.id,
                call_kind: 'voice',
            }),
        });
        // Weitere Mitglieder einzeln benachrichtigen (Edge Function akzeptiert einen user_id pro Aufruf)
        for (let i = 1; i < otherIds.length; i++) {
            await fetch((window.SUPABASE_URL || '') + '/functions/v1/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_ANON_KEY || '' },
                body: JSON.stringify({
                    user_id: otherIds[i],
                    type: 'call',
                    title: '437 CORE VOICE',
                    body: me + ' ist in ' + (channelName || 'Voice-Channel') + ' eingetreten',
                    call_id: channelId,
                    dm_id: null,
                    sender_id: user.id,
                    call_kind: 'voice',
                }),
            });
        }
    } catch (_) {}
}

async function leaveVoiceChannel() {
    if (!voice.channelId) return;

    // Mobile: release screen sleep prevention
    stopPreventSleep();
    stopVoiceQualityPoll();

    try {
        await supabaseClient.from('voice_participants').delete()
            .eq('channel_id', voice.channelId)
            .eq('user_id', user.id);
    } catch (err) { console.error('Leave participant failed', err); }

    if (voice.webrtcChannel) {
        try { supabaseClient.removeChannel(voice.webrtcChannel); } catch (err) {}
        voice.webrtcChannel = null;
    }

    Object.values(voice.peers).forEach(pc => pc.close());
    voice.peers = {};

    Object.keys(voice.remoteStreams).forEach(k => {
        const el = document.getElementById('wrap_' + k);
        if (el) el.remove();
        const a = document.getElementById('a_' + k);
        if (a) a.remove();
    });
    voice.remoteStreams = {};

    if (voice.localStream) {
        voice.localStream.getTracks().forEach(t => t.stop());
        voice.localStream = null;
    }
    // Local speaker analyser aufräumen, damit neuer Stream frisch analysiert wird
    if (voice.analysers[user.id]) {
        delete voice.analysers[user.id];
    }
    document.getElementById('wrap_local')?.remove();
    videoGrid.style.display = 'none';

    voice.isCameraOn = false;
    voice.isMuted = false;
    voice.isDeafened = false;
    camBtn.classList.remove('active');
    muteBtn.classList.remove('muted');
    muteBtn.textContent = '🎤';
    stopTimer();

    const cid = voice.channelId;
    const oldVoiceChannel = currentChannel;
    const dur = Math.max(0, Math.floor((Date.now() - voice.startTime) / 1000));
    voice.channelId = null;
    voice.channelName = '';
    localStorage.removeItem('voiceChannelId');
    voiceActive.style.display = 'none';

    // System-Nachricht im Voice-Channel-Chat posten (nicht blockierend)
    const me = user.nickname || '437 Core';
    try { await postVoiceSystemMessage(cid, '🔊 ' + esc(me) + ' hat den Voice-Channel verlassen'); } catch (_) {}

    // Wenn der aktive Channel der Voice-Chat war, zu 437 wechseln
    if (oldVoiceChannel === ('voice:' + cid)) {
        currentChannel = '437';
        try { localStorage.setItem('437core_channel', '437'); } catch(_) {}
    }

    // Call-Verlauf abschließen
    if (voice.historyId) {
        try {
            await supabaseClient.from('voice_call_history').update({
                left_at: new Date().toISOString(),
                duration_sec: dur,
                had_audio: !voice.isMuted,
                had_video: voice.isCameraOn,
                had_screen: voice.hadScreen,
            }).eq('id', voice.historyId);
        } catch (err) { console.error('Voice history update failed', err); }
        voice.historyId = null;
    }

    // Speaking-Status und Analyser für alle Teilnehmer clearen
    voice.speakingPids.clear();
    Object.keys(voice.remoteStreams).forEach(k => delete voice.remoteStreams[k]);
    Object.keys(voice.analysers).forEach(k => { if (k !== user.id) delete voice.analysers[k]; });
    document.querySelectorAll('.voice-participant.speaking').forEach(el => el.classList.remove('speaking'));

    try {
        const { data: rem } = await supabaseClient.from('voice_participants').select('id').eq('channel_id', cid);
        if (!rem || rem.length === 0) {
            await supabaseClient.from('voice_channels').delete().eq('id', cid);
        }
    } catch (err) { console.error('Delete empty channel failed', err); }

    loadChannels();
}

async function createChannel() {
    const name = voiceChannelNameInput.value.trim();
    const emoji = voiceEmojiInput.value.trim();
    if (!name || voice.channelId) return;

    const ok = await requestPermissions(false);
    if (!ok) return;

    createVoiceBtn.disabled = true;
    const dn = emoji ? emoji + ' ' + name : name;
    try {
        const { data } = await supabaseClient.from('voice_channels').insert([{ name: dn, emoji: emoji || '🔊', created_by: user.id }]).select().single();
        createVoiceBtn.disabled = false;
        voiceChannelNameInput.value = '';
        voiceEmojiInput.value = '';
        if (data) {
            await loadChannels();
            await joinVC(data.id, dn);
        }
    } catch (err) {
        createVoiceBtn.disabled = false;
        console.error('Create channel failed', err);
    }
}

    // ---------- Event handlers ----------
muteBtn.onclick = toggleMic;
camBtn.onclick = toggleCam;
// Mobile: long press on camera button switches front/back camera
let camLongPressTimer = null;
camBtn.addEventListener('touchstart', (e) => {
    if (!isMobile) return;
    camLongPressTimer = setTimeout(() => {
        camLongPressTimer = null;
        if (voice.isCameraOn) {
            voice.cameraFacingMode = voice.cameraFacingMode === 'user' ? 'environment' : 'user';
            toggleCam();
            toggleCam();
        }
    }, 500);
}, { passive: true });
camBtn.addEventListener('touchend', () => {
    if (camLongPressTimer) { clearTimeout(camLongPressTimer); camLongPressTimer = null; }
}, { passive: true });
speakerBtn.onclick = () => {
    voice.isDeafened = !voice.isDeafened;
    speakerBtn.classList.toggle('deafened', voice.isDeafened);
    speakerBtn.textContent = voice.isDeafened ? '🔇' : '🔊';
    document.querySelectorAll('video[remote]').forEach(v => { v.muted = voice.isDeafened; v.volume = voice.isDeafened ? 0 : 1; });
    document.querySelectorAll('audio[id^="a_"]').forEach(a => { a.muted = voice.isDeafened; a.volume = voice.isDeafened ? 0 : 1; });
};
screenBtn.onclick = toggleVoiceShare;
leaveVoiceBtn.onclick = leaveVoiceChannel;
createVoiceBtn.onclick = createChannel;
voiceHistoryBtn.onclick = () => {
    const panel = document.getElementById('voiceHistoryPanel');
    const close = document.getElementById('voiceHistoryClose');
    if (!panel || !close) return;
    const show = panel.style.display !== 'block';
    panel.style.display = show ? 'block' : 'none';
    close.onclick = () => { panel.style.display = 'none'; };
    if (show) loadVoiceHistory();
};

// ---------- Wake Lock & Visibility (mobile) ----------
let wakeLock = null;
async function startPreventSleep() {
    stopPreventSleep();
    if (!navigator.wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
    voice.preventSleepTimer = setInterval(async () => {
        if (!wakeLock && navigator.wakeLock) {
            try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
        }
    }, 30000);
}
function stopPreventSleep() {
    if (voice.preventSleepTimer) { clearInterval(voice.preventSleepTimer); voice.preventSleepTimer = null; }
    if (wakeLock) { try { wakeLock.release(); } catch (_) {} wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
    if (!voice.channelId) return;
    if (document.hidden) {
        // Hintergrund: Audio stumm, VAD pausieren, taub erzwingen
        if (voice.localStream) {
            voice.localStream.getAudioTracks().forEach(t => { t.enabled = false; });
        }
        voice.isDeafened = true;
        speakerBtn.classList.add('deafened');
        speakerBtn.textContent = '🔇';
        document.querySelectorAll('video[remote]').forEach(v => { v.muted = true; v.volume = 0; });
        if (voice.vadInterval) { clearInterval(voice.vadInterval); voice.vadInterval = null; }
    } else {
        // Vordergrund: Audio wieder aktivieren
        if (voice.localStream && !voice.isMuted) {
            voice.localStream.getAudioTracks().forEach(t => { t.enabled = true; });
        }
        voice.isDeafened = false;
        speakerBtn.classList.remove('deafened');
        speakerBtn.textContent = '🔊';
        document.querySelectorAll('video[remote]').forEach(v => { v.muted = false; v.volume = 1; });
    }
});

const voiceFixedBtnEl = document.getElementById('voiceFixedBtn');
if (voiceFixedBtnEl) voiceFixedBtnEl.onclick = () => {
    if (chatSidebar) chatSidebar.classList.toggle('open');
};

// ---------- Realtime subscriptions (debounced) ----------
let voiceRealtimeSub = null;
function subscribeVoiceRealtime() {
    if (voiceRealtimeSub) return;
    voiceRealtimeSub = supabaseClient.channel('vc_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_channels' }, () => {
            if (voice.renderTimer) clearTimeout(voice.renderTimer);
            voice.renderTimer = setTimeout(loadChannels, 300);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'voice_participants' }, ({ payload }) => {
            if (!payload) return;
            if (voice.channelId) {
                const chId = payload.new ? payload.new.channel_id : (payload.old ? payload.old.channel_id : null);
                if (chId === voice.channelId) {
                    loadParticipants();
                }
            }
            if (voice.renderTimer) clearTimeout(voice.renderTimer);
            voice.renderTimer = setTimeout(loadChannels, 300);
        })
        .subscribe();
}

// ---------- Cleanup ----------
function cleanupVoice() {
    stopTimer();
    stopVoiceQualityPoll();
    if (voice.reconnectTimer) { clearTimeout(voice.reconnectTimer); voice.reconnectTimer = null; }
    if (voice.channelId) {
        leaveVoiceChannel();
    }
    if (voice.webrtcChannel) {
        try { supabaseClient.removeChannel(voice.webrtcChannel); } catch (err) {}
        voice.webrtcChannel = null;
    }
    Object.values(voice.peers).forEach(pc => pc.close());
    voice.peers = {};
    if (voice.localStream) {
        voice.localStream.getTracks().forEach(t => t.stop());
        voice.localStream = null;
    }
    if (voice.audioCtx) {
        try { voice.audioCtx.close(); } catch (err) {}
        voice.audioCtx = null;
    }
    voice.analysers = {};
    voice.speakingPids.clear();
}

window.addEventListener('beforeunload', cleanupVoice);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        localStorage.setItem('wasAway', '1');
        if (voice.channelId && !voice.isMuted) {
            toggleMic();
        }
    }
    if (!document.hidden) {
        restoreChatUI();
        if (presenceChannel && presenceChannel.state !== 'joined') {
            presenceChannel.track({ user_id: user.id, nickname: user.nickname, online: true });
            updateOnlineDots();
        }
    }
});

// ---------- Init ----------
loadChannels();
subscribeVoiceRealtime();

// ============ PUSH HILFSFUNKTIONEN ============
async function subscribeToPush(userId) {
    try {
        if (!('serviceWorker' in navigator)) return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(getVapidKey())
        });
        const p256dh = sub.keys && sub.keys.p256dh ? sub.keys.p256dh : '';
        const auth = sub.keys && sub.keys.auth ? sub.keys.auth : '';
        await fetch(SUPABASE_URL + '/functions/v1/subscribe-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
            body: JSON.stringify({
                user_id: userId,
                endpoint: sub.endpoint,
                p256dh: p256dh,
                auth: auth
            })
        });
    } catch (err) {
        console.error('Push subscribe failed', err);
    }
}

async function unsubscribeFromPush(userId) {
    try {
        if (!('serviceWorker' in navigator)) return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
            await fetch(SUPABASE_URL + '/functions/v1/subscribe-push', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
                body: JSON.stringify({ user_id: userId, endpoint: sub.endpoint })
            });
            await sub.unsubscribe();
        }
    } catch (err) {
        console.error('Push unsubscribe failed', err);
    }
}

function getVapidKey() {
    return (typeof VAPID_PUBLIC_KEY !== 'undefined') ? VAPID_PUBLIC_KEY : 'BIocxD130JUWfAATOPehBlLSPckHp8oEzTQj2N_W70wd-bKEZrpoBVtBPQQSVgNJcGifegOKOevzs-ybpDt5mYA';
}

function urlBase64ToUint8Array(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64url.length % 4) % 4);
    const rawData = atob(base64 + padding);
    return Uint8Array.from(rawData, c => c.charCodeAt(0));
}

// Sende Push-Benachrichtigung an einen Nutzer (nur wenn Empfänger nicht aktiv)
async function sendPushNotification(recipientId, type, title, body, channel, dmId, messageId, senderId, senderAvatar, senderName) {
    try {
        if (!SUPABASE_URL) return;
        const resp = await fetch(SUPABASE_URL + '/functions/v1/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
            body: JSON.stringify({
                user_id: recipientId,
                type,
                title,
                body,
                channel: channel || null,
                dm_id: dmId || null,
                message_id: messageId || null,
                sender_id: senderId || null,
                sender_avatar: senderAvatar || null,
                sender_name: senderName || null,
            })
        });
        if (!resp.ok) {
            const txt = await resp.text().catch(()=> '');
            console.warn('send-push failed', resp.status, txt);
        }
} catch (err) {
        console.error('sendPushNotification error', err);
    }
}

    async function logAdminAudit(action, targetType, targetId, details) {
        if (typeof isAdmin !== 'function' || !isAdmin() || !user?.id) return;
        try {
            const resp = await fetch((window.SUPABASE_URL || '') + '/functions/v1/admin-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.SUPABASE_ANON_KEY || '',
                    'Authorization': 'Bearer ' + (window.SUPABASE_ANON_KEY || '')
                },
                body: JSON.stringify({
                    action,
                    target_type: targetType || null,
                    target_id: targetId != null ? String(targetId) : null,
                    details: typeof details === 'string' ? details : (details ? JSON.stringify(details) : ''),
                    actor_id: user.id
                })
            });
            if (!resp.ok) console.warn('logAdminAudit failed', await resp.text().catch(() => resp.status));
        } catch (e) {
            console.warn('logAdminAudit error', e);
        }
    }

    function updateMyProfileUI() {
        const avatarEl = document.getElementById('navAvatar');
        const nameEl = document.getElementById('navNickname');
        if (avatarEl && user?.avatar_url) {
            avatarEl.innerHTML = `<img src="${user.avatar_url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        }
        if (nameEl && user?.nickname) nameEl.textContent = user.nickname;
    }

    // ===== REALTIME SUBSCRIPTIONS (Live Updates for main app) =====
(function setupMainAppRealtime() {
    if (!supabaseClient) return;

    const channel = supabaseClient.channel('main-app-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
            console.log('[Realtime Main] messages:', payload);
            if (isDrops437Channel(currentChannel)) return; // Don't interfere with Drops 437
            // Only refresh if the message is in current channel
            if (payload.new?.channel === currentChannel || payload.old?.channel === currentChannel) {
                if (typeof loadMsgs === 'function') loadMsgs({ preserveScroll: true });
            }
            if (typeof updateChannelBadges === 'function') updateChannelBadges();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drops_437_videos' }, (payload) => {
            console.log('[Realtime Main] drops_437_videos:', payload);
            if (isDrops437Channel(currentChannel)) {
                loadDrops437Videos().then(() => renderDrops437Channel());
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drops_437_pinned_videos' }, (payload) => {
            console.log('[Realtime Main] drops_437_pinned_videos:', payload);
            if (isDrops437Channel(currentChannel)) {
                loadDrops437Videos().then(() => renderDrops437Channel());
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drops_437_video_reactions' }, (payload) => {
            console.log('[Realtime Main] drops_437_video_reactions:', payload);
            const vids = [payload.new?.video_id, payload.old?.video_id].filter(v => v !== null && v !== undefined);
            if (!vids.length) return;
            loadDrops437ReactionsFromDB(vids).then(() => {
                if (isDrops437Channel(currentChannel)) vids.forEach(id => syncDrops437ReactionButtons(id));
            }).catch(() => {});
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
            console.log('[Realtime Main] profiles:', payload);
            // Update user info if needed
            if (payload.new?.id === user?.id) {
                user = { ...user, ...payload.new };
                localStorage.setItem('437core_user', JSON.stringify(user));
                updateMyProfileUI();
            }
            // profilesCache aktuell halten (last_seen Fallback für Online-Anzeige)
            if (payload.new?.id && Array.isArray(profilesCache)) {
                const idx = profilesCache.findIndex(p => p.id === payload.new.id);
                if (idx >= 0) profilesCache[idx] = { ...profilesCache[idx], ...payload.new };
            }
            if (payload.eventType === 'INSERT' ||
                (payload.new && payload.old && (payload.new.nickname !== payload.old.nickname || payload.new.avatar_url !== payload.old.avatar_url))) {
                scheduleDmRefresh();
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, (payload) => {
            console.log('[Realtime Main] reports:', payload);
            updateChannelBadges();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_channels' }, (payload) => {
            console.log('[Realtime Main] dm_channels:', payload);
            loadDmUsers();
            updateChannelBadges();
        })
        .subscribe((status) => {
            console.log('[Realtime Main] Subscription status:', status);
        });

    window.__mainAppRealtimeChannel = channel;
})();

    // ============ BRIDGE FUER DM-CALLS ============
    window.__437 = {
        getUser: () => user,
        getChannel: () => currentChannel,
        getProfiles: () => profilesCache,
        getDmUsers: () => dmUsers,
        dmChannelId: (a, b) => dmChannelId(a, b),
        getUserChatColor: (id, prof) => getUserChatColor(id, prof),
        isUserOnline: (id) => isUserOnline(id),
        esc: (s) => esc(s),
        supabase: supabaseClient,
        switchChannel: (ch) => switchChannel(ch),
        renderChannelStrip: () => renderChannelStrip(),
        loadMsgs: (opts) => loadMsgs(opts),
        openProfileModal: (uid) => openProfileModal(uid),
        isBanned: () => isBanned(getMyProfile()),
    };
    try { window.dispatchEvent(new CustomEvent('437:ready')); } catch (_) {}

});
