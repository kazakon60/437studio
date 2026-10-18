// =========================================================================
// 437 STUDIO | FORUM ENGINE (VOLLSTÄNDIG OPTIMIERT: CACHING & PAGINATION)
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
    loadForumThreadsFast();
});

// Superschnelles Laden durch lokalen Cache + Hintergrund-Aktualisierung
async function loadForumThreadsFast() {
    const container = document.getElementById("forum-threads-container");
    if (!container) return;

    if (!window.supabaseClient) {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ff0055; font-family: monospace;">[FEHLER]: Supabase nicht verbunden.</div>`;
        return;
    }

    // 1. SCHRITT: Sofortige Anzeige aus dem lokalen Cache (falls vorhanden)
    const cachedThreads = localStorage.getItem("437_cached_forum_threads");
    if (cachedThreads) {
        try {
            const parsed = JSON.parse(cachedThreads);
            if (Array.isArray(parsed) && parsed.length > 0) {
                renderThreadsList(parsed, container, false);
            }
        } catch (e) {
            console.warn("Cache-Parse-Fehler:", e);
        }
    } else {
        container.innerHTML = `<div style="text-align: center; padding: 40px; color: #00f0ff; font-family: monospace;"><i class="fas fa-spinner fa-spin"></i> Lade Net-Forum Matrix...</div>`;
    }

    // 2. SCHRITT: Frische Daten von Supabase laden (mit Limit/Pagination auf 20 Threads für maximale Performance)
    const { data: threads, error } = await supabaseClient
        .from("forum_threads")
        .select("*")
        .order("id", { ascending: false })
        .range(0, 19); // Lädt nur die neuesten 20 Beiträge
    
    if (error) {
        console.error("Fehler beim Laden der Threads:", error);
        if (!cachedThreads) {
            container.innerHTML = `<div style="text-align: center; padding: 40px; color: #ff0055; font-family: monospace;">Fehler beim Laden: ${escapeHTML(error.message)}</div>`;
        }
        return;
    }

    if (!threads || threads.length === 0) {
        localStorage.removeItem("437_cached_forum_threads");
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666; font-family: monospace; box-sizing: border-box;">
                <i class="fas fa-terminal" style="font-size: 36px; margin-bottom: 15px; color: #00f0ff;"></i>
                <p style="font-size: 12px;">Keine Beiträge im Netzwerk gefunden. Erstelle als Erster eine Diskussion!</p>
            </div>
        `;
        return;
    }

    // Kommentare für die geladenen Threads abrufen
    for (const thread of threads) {
        const { data: comments } = await supabaseClient
            .from("forum_comments")
            .select("*")
            .eq("thread_id", thread.id)
            .order("id", { ascending: true })
            .limit(50); // Performance-Limit für Kommentare

        thread.comments = comments || [];
    }

    // Im Cache speichern für Blitzstart beim nächsten Seitenaufruf
    localStorage.setItem("437_cached_forum_threads", JSON.stringify(threads));

    // UI mit den frischen Daten aktualisieren
    renderThreadsList(threads, container, true);

    // Timeout-Prüfung ausführen
    if (typeof checkUserTimeoutState === "function") {
        checkUserTimeoutState();
    }
}

function renderThreadsList(threads, container, overwrite = true) {
    if (overwrite) {
        container.innerHTML = "";
    } else if (container.querySelector("i.fa-spinner")) {
        container.innerHTML = "";
    }

    threads.forEach(thread => {
        // Prüfen, ob das Element bereits existiert, um Flackern zu vermeiden
        let existingCard = document.getElementById(`thread-card-${thread.id}`);
        if (existingCard) existingCard.remove();

        renderThreadElement(thread, container, false);
    });
}

function renderThreadElement(thread, container, prepend = false) {
    const isAuthor = currentUser && thread.author && thread.author.toLowerCase() === currentUser.username.toLowerCase();
    const isAdminUser = currentUser && typeof isAdmin === "function" && isAdmin();
    
    let cyberCardHtml = "";
    if (thread.author_char && thread.author_char.enabled && thread.author_char.slots) {
        let perkBadges = thread.author_char.slots.filter(s => s).map(sId => {
            let perkObj = typeof CYBER_PERKS_POOL !== "undefined" ? CYBER_PERKS_POOL.find(p => p.id === sId) : null;
            let perkName = perkObj ? perkObj.name.split('(')[0].trim() : sId;
            let badgeColor = perkObj && perkObj.adminOnly ? "#ff007f" : "#00f0ff";
            return `<span style="font-size:9.5px; background:rgba(0,240,255,0.05); border:1px solid ${badgeColor}; color:${badgeColor}; padding:2px 5px; border-radius:3px; margin-right:4px; display:inline-block; margin-bottom:2px;">⚡ ${escapeHTML(perkName)}</span>`;
        }).join('');

        if (perkBadges) {
            cyberCardHtml = `<div style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px;">${perkBadges}</div>`;
        }
    }

    const threadDiv = document.createElement("div");
    threadDiv.id = `thread-card-${thread.id}`;
    threadDiv.style.cssText = `
        background: #080814; border: 1px solid #1a1a3a; border-radius: 8px;
        padding: 14px; margin-bottom: 15px; font-family: monospace; position: relative;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5); box-sizing: border-box; width: 100%; max-width: 100%; overflow: hidden;
    `;

    const profileUrl = `profile.html?user=${encodeURIComponent(thread.author)}`;

    let threadImageHtml = "";
    if (thread.image) {
        threadImageHtml = `
            <div style="margin: 12px 0; max-height: 300px; overflow: hidden; border-radius: 6px; border: 1px solid #1a1a3a; background: #04040a; box-sizing: border-box; width: 100%;">
                <img src="${thread.image}" loading="lazy" style="width: 100%; height: auto; max-height: 300px; object-fit: contain; display: block;" alt="Beitragsbild">
            </div>
        `;
    }

    const commentsCount = thread.comments ? thread.comments.length : 0;
    let replyFormContent = "";
    const maintenanceActive = typeof isGlobalMaintenanceActive !== 'undefined' && isGlobalMaintenanceActive;

    if (maintenanceActive) {
        replyFormContent = `
            <div style="background: linear-gradient(135deg, rgba(8, 8, 18, 0.95) 0%, rgba(25, 10, 35, 0.95) 100%); border: 1px solid #ff007f; padding: 12px; border-radius: 6px; display: flex; align-items: center; gap: 10px; margin-top: 10px; box-sizing: border-box; width: 100%;">
                <i class="fas fa-lock" style="font-size: 18px; color: #ff0055; flex-shrink: 0;"></i>
                <div style="min-width: 0;">
                    <div style="color: #ff007f; font-weight: bold; font-size: 11px; text-transform: uppercase;">Lockdown Aktiv</div>
                    <div style="color: #aaa; font-size: 10px;">Antworten wegen Wartung gesperrt.</div>
                </div>
            </div>
        `;
    } else {
        replyFormContent = `
            <form onsubmit="handleReplySubmit(event, ${thread.id})" style="margin-top: 12px; background: #05050e; border: 1px solid #1a1a3a; padding: 10px; border-radius: 6px; display: flex; flex-direction: column; gap: 8px; box-sizing: border-box; width: 100%;">
                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;">
                    <input type="text" id="reply-input-${thread.id}" required placeholder="Antwort schreiben..." style="width: 100%; background: #0c0c18; border: 1px solid #333; color: #fff; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 11.5px; outline: none; box-sizing: border-box;">
                    
                    <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box;">
                        <label class="btn btn-neon-blue" style="font-size: 11px; padding: 8px 10px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; margin: 0; flex: 1; box-sizing: border-box;" title="Bild anhängen">
                            <i class="fas fa-image"></i> Bild <input type="file" id="reply-image-${thread.id}" accept="image/*" onchange="previewReplyImage(event, ${thread.id})" style="display: none;">
                        </label>
                        
                        <button type="submit" class="btn btn-neon-green" style="font-size: 11px; padding: 8px 12px; margin: 0; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 1; box-sizing: border-box;"><i class="fas fa-paper-plane"></i> Senden</button>
                    </div>
                </div>

                <div id="reply-preview-box-${thread.id}" style="display: none; align-items: center; justify-content: space-between; background: #0c0c18; border: 1px dashed #00f0ff; padding: 6px 8px; border-radius: 4px; box-sizing: border-box; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; min-width: 0;">
                        <img id="reply-preview-img-${thread.id}" src="" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid #00f0ff; flex-shrink: 0;">
                        <span id="reply-file-name-${thread.id}" style="font-size: 10px; color: #00f0ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></span>
                    </div>
                    <button type="button" onclick="clearReplyImage(${thread.id})" style="background: transparent; border: none; color: #ff0055; cursor: pointer; font-size: 14px; padding: 4px;"><i class="fas fa-times"></i></button>
                </div>
            </form>
        `;
    }

    threadDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 8px; width: 100%; box-sizing: border-box;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex-grow: 1;">
                <a href="${profileUrl}" style="flex-shrink: 0;">
                    <img src="${thread.author_avatar || DEFAULT_AVATAR}" loading="lazy" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid #00f0ff; object-fit: cover;">
                </a>
                <div style="min-width: 0; flex-grow: 1;">
                    <div style="color: #fff; font-weight: bold; font-size: 12.5px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <a href="${profileUrl}" style="color: #00f0ff; text-decoration: none; word-break: break-all;">${escapeHTML(thread.author)}</a>
                        ${["nalix437", "amnesia437"].includes((thread.author || "").toLowerCase()) ? '<span style="color:#ff007f; font-size:9px; border:1px solid #ff007f; padding:1px 4px; border-radius:3px;">ADMIN</span>' : ''}
                    </div>
                    <div style="color: #666; font-size: 10px;">${escapeHTML(thread.date || 'Gerade eben')}</div>
                    ${cyberCardHtml}
                </div>
            </div>
            ${(isAuthor || isAdminUser) ? `<button onclick="deleteForumThread(${thread.id})" style="background: transparent; border: none; color: #ff0055; cursor: pointer; font-size: 15px; padding: 4px; flex-shrink: 0;" title="Löschen"><i class="fas fa-trash-alt"></i></button>` : ''}
        </div>
        
        <h3 style="color: #00f0ff; font-size: 14.5px; margin-bottom: 6px; overflow-wrap: break-word; word-break: break-word;">${escapeHTML(thread.title)}</h3>
        <p style="color: #ccc; font-size: 11.5px; line-height: 1.4; margin-bottom: 10px; white-space: pre-wrap; overflow-wrap: break-word; word-break: break-word;">${escapeHTML(thread.content)}</p>
        ${threadImageHtml}
        
        <div style="border-top: 1px solid #111; padding-top: 10px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <span style="color: #888; font-size: 10.5px;"><i class="fas fa-comments"></i> <span id="comment-count-${thread.id}">${commentsCount}</span> Antworten</span>
            <button onclick="toggleReplyBox(${thread.id})" class="btn btn-neon-blue" style="font-size: 10.5px; padding: 5px 10px;">Antworten</button>
        </div>

        <div id="replies-section-${thread.id}" style="margin-top: 12px; display: none; border-top: 1px dashed #1a1a3a; padding-top: 12px; width: 100%; box-sizing: border-box;">
            <div id="reply-list-${thread.id}">
                ${renderRepliesList(thread.comments, thread.id)}
            </div>
            ${replyFormContent}
        </div>
    `;

    if (prepend) {
        container.prepend(threadDiv);
    } else {
        container.appendChild(threadDiv);
    }
}

let tempReplyImages = {};

function previewReplyImage(event, threadId) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Bitte wähle eine gültige Bilddatei aus.");
        event.target.value = "";
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert("Das Bild ist zu groß. Maximal 2 MB erlaubt.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        tempReplyImages[threadId] = e.target.result;
        
        const previewBox = document.getElementById(`reply-preview-box-${threadId}`);
        const previewImg = document.getElementById(`reply-preview-img-${threadId}`);
        const fileNameSpan = document.getElementById(`reply-file-name-${threadId}`);

        if (previewBox && previewImg && fileNameSpan) {
            previewImg.src = tempReplyImages[threadId];
            fileNameSpan.textContent = file.name;
            previewBox.style.display = "flex";
        }
    };
    reader.readAsDataURL(file);
}

function clearReplyImage(threadId) {
    delete tempReplyImages[threadId];
    const fileInput = document.getElementById(`reply-image-${threadId}`);
    const previewBox = document.getElementById(`reply-preview-box-${threadId}`);
    
    if (fileInput) fileInput.value = "";
    if (previewBox) previewBox.style.display = "none";
}

function renderRepliesList(comments, threadId) {
    if (!comments || comments.length === 0) {
        return '<div style="color: #555; font-size: 10.5px; margin-bottom: 8px;">Noch keine Antworten vorhanden.</div>';
    }
    return comments.map((r) => {
        const replyProfileUrl = `profile.html?user=${encodeURIComponent(r.author)}`;
        let replyImageHtml = r.image ? `<div style="margin-top: 6px; max-height: 180px; overflow: hidden; border-radius: 4px;"><img src="${r.image}" loading="lazy" style="max-width: 100%; max-height: 180px; object-fit: contain;"></div>` : '';
        
        const isReplyAuthor = currentUser && r.author && r.author.toLowerCase() === currentUser.username.toLowerCase();
        const isAdminUser = currentUser && typeof isAdmin === "function" && isAdmin();

        return `
            <div id="comment-row-${r.id}" style="background: rgba(255,255,255,0.02); border-left: 2px solid #00f0ff; padding: 8px 10px; margin-bottom: 8px; border-radius: 0 4px 4px 0; position: relative; box-sizing: border-box; width: 100%; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-bottom: 4px; gap: 6px;">
                    <a href="${replyProfileUrl}" style="color: #00f0ff; font-weight: bold; text-decoration: none; word-break: break-all;">${escapeHTML(r.author)}</a>
                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                        <span>${escapeHTML(r.date || '')}</span>
                        ${(isReplyAuthor || isAdminUser) ? `<button onclick="deleteForumCommentDirect(${r.id},${threadId})" style="background: transparent; border: none; color: #ff0055; cursor: pointer; font-size: 11px; padding: 2px;" title="Löschen"><i class="fas fa-trash-alt"></i></button>` : ''}
                    </div>
                </div>
                <div style="color: #ddd; font-size: 11px; white-space: pre-wrap; line-height: 1.4; overflow-wrap: break-word; word-break: break-word;">${escapeHTML(r.content)}</div>
                ${replyImageHtml}
            </div>
        `;
    }).join('');
}

async function deleteForumCommentDirect(commentId, threadId) {
    if (!confirm("Möchtest du diese Antwort wirklich löschen?") || !supabaseClient) return;

    const { error } = await supabaseClient.from("forum_comments").delete().eq("id", commentId);
    if (!error) {
        const row = document.getElementById(`comment-row-${commentId}`);
        if (row) row.remove();
        localStorage.removeItem("437_cached_forum_threads");
        loadForumThreadsFast();
    } else {
        alert("Fehler beim Löschen der Antwort: " + error.message);
    }
}

function toggleReplyBox(threadId) {
    const box = document.getElementById(`replies-section-${threadId}`);
    if (box) {
        box.style.display = box.style.display === "none" ? "block" : "none";
    }
}

let tempThreadImage = null;

function openCreateDiscussionModal() {
    if (!currentUser) {
        if (typeof redirectToLogin === "function") redirectToLogin();
        return;
    }

    tempThreadImage = null;
    let modal = document.getElementById("create-thread-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "create-thread-modal";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content" style="background: #080814; border: 2px solid #00ff66; box-shadow: 0 0 35px rgba(0, 255, 102, 0.3); border-radius: 8px; width: 100%; max-width: 440px; max-height: 85vh; overflow-y: auto; padding: 16px; position: relative; font-family: monospace; box-sizing: border-box; margin: auto;">
            <span class="close-btn" onclick="document.getElementById('create-thread-modal').remove()" style="position: absolute; top: 10px; right: 12px; font-size: 20px; cursor: pointer; color: #888; z-index: 10; padding: 4px;">&times;</span>
            <h3 style="color: #00ff66; margin-bottom: 12px; font-size: 15px; padding-right: 20px;"><i class="fas fa-edit"></i> Neue Diskussion starten</h3>
            
            <form onsubmit="handleCreateThreadSubmit(event)" style="display: flex; flex-direction: column; gap: 10px; width: 100%; box-sizing: border-box;">
                <div style="width: 100%;">
                    <label style="display: block; font-size: 10.5px; color: #aaa; margin-bottom: 4px;">Titel</label>
                    <input type="text" id="thread-title-input" required placeholder="Thema / Titel..." style="width: 100%; background: #121224; border: 1px solid #333; color: #fff; padding: 9px; border-radius: 4px; font-family: monospace; font-size: 11.5px; box-sizing: border-box; outline: none;">
                </div>
                
                <div style="width: 100%;">
                    <label style="display: block; font-size: 10.5px; color: #aaa; margin-bottom: 4px;">Inhalt</label>
                    <textarea id="thread-content-input" required rows="4" placeholder="Schreibe deine Gedanken..." style="width: 100%; background: #121224; border: 1px solid #333; color: #fff; padding: 9px; border-radius: 4px; font-family: monospace; font-size: 11.5px; resize: vertical; box-sizing: border-box; outline: none;"></textarea>
                </div>
                
                <div style="width: 100%;">
                    <label style="display: block; font-size: 10.5px; color: #aaa; margin-bottom: 4px;">Bild anhängen (Optional, max 2MB)</label>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; width: 100%;">
                        <label class="btn btn-neon-blue" style="font-size: 10.5px; padding: 7px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin: 0;">
                            <i class="fas fa-image"></i> Bild wählen <input type="file" accept="image/*" onchange="previewThreadImage(event)" style="display: none;">
                        </label>
                        <span id="thread-image-name" style="font-size: 10px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;">Kein Bild</span>
                    </div>
                    <div id="thread-image-preview-container" style="margin-top: 8px; display: none; max-height: 110px; overflow: hidden; text-align: center; width: 100%; box-sizing: border-box;">
                        <img id="thread-image-preview" src="" style="max-height: 100px; max-width: 100%; border-radius: 4px; border: 1px solid #00f0ff; object-fit: contain;">
                    </div>
                </div>

                <button type="submit" class="btn btn-neon-green" style="width: 100%; padding: 11px; font-size: 11.5px; margin-top: 4px; cursor: pointer; box-sizing: border-box;">Beitrag veröffentlichen</button>
            </form>
        </div>
    `;
    modal.style.cssText = "position: fixed; inset: 0; background: rgba(3,3,8,0.85); display: flex; align-items: center; justify-content: center; z-index: 2147483647; padding: 10px; box-sizing: border-box;";
}

function previewThreadImage(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Bitte wähle eine gültige Bilddatei aus.");
        event.target.value = "";
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        alert("Das Bild ist zu groß. Maximal 2 MB erlaubt.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        tempThreadImage = e.target.result;
        const nameSpan = document.getElementById("thread-image-name");
        const previewImg = document.getElementById("thread-image-preview");
        const previewContainer = document.getElementById("thread-image-preview-container");

        if (nameSpan) nameSpan.textContent = file.name;
        if (previewImg && previewContainer) {
            previewImg.src = tempThreadImage;
            previewContainer.style.display = "block";
        }
    };
    reader.readAsDataURL(file);
}

async function handleCreateThreadSubmit(event) {
    event.preventDefault();
    
    if (typeof isGlobalMaintenanceActive !== 'undefined' && isGlobalMaintenanceActive) {
        alert("🔒 Wartungsmodus aktiv: Das Erstellen neuer Diskussionen ist vorübergehend gesperrt.");
        return;
    }

    if (!currentUser || !supabaseClient) return;

    const titleInput = document.getElementById("thread-title-input");
    const contentInput = document.getElementById("thread-content-input");
    if (!titleInput || !contentInput) return;

    const newThread = {
        title: titleInput.value.trim(),
        content: contentInput.value.trim(),
        author: currentUser.username,
        author_avatar: currentUser.avatar || DEFAULT_AVATAR,
        author_char: currentUser.cyber_char || { enabled: false },
        image: tempThreadImage || null,
        date: new Date().toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };

    document.getElementById("create-thread-modal")?.remove();

    const { error } = await supabaseClient.from("forum_threads").insert([newThread]);

    if (error) {
        alert("🚨 Supabase Insert-Fehler:\n" + error.message);
        console.error("Supabase Error:", error);
        return;
    }

    if (typeof unlockAchievement === "function") {
        unlockAchievement("forum_pioneer");
    }

    localStorage.removeItem("437_cached_forum_threads");
    loadForumThreadsFast();
}

async function deleteForumThread(threadId) {
    if (!confirm("Bist du sicher?") || !supabaseClient) return;
    
    await supabaseClient.from("forum_comments").delete().eq("thread_id", threadId);
    const { error } = await supabaseClient.from("forum_threads").delete().eq("id", threadId);
    
    if (!error) {
        const card = document.getElementById(`thread-card-${threadId}`);
        if (card) card.remove();
        localStorage.removeItem("437_cached_forum_threads");
        loadForumThreadsFast();
    }
}

async function handleReplySubmit(event, threadId) {
    event.preventDefault();

    if (typeof isGlobalMaintenanceActive !== 'undefined' && isGlobalMaintenanceActive) {
        alert("🔒 Wartungsmodus aktiv: Das Verfassen von Antworten ist vorübergehend gesperrt.");
        return;
    }

    if (!currentUser) { 
        if (typeof redirectToLogin === "function") redirectToLogin(); 
        return; 
    }

    const input = document.getElementById(`reply-input-${threadId}`);
    if (!input || !supabaseClient) return;

    const replyImage = tempReplyImages[threadId] || null;

    const newComment = {
        thread_id: threadId,
        author: currentUser.username,
        content: input.value.trim(),
        image: replyImage,
        date: new Date().toLocaleDateString("de-DE", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    };

    const { error: insertError } = await supabaseClient.from("forum_comments").insert([newComment]);
    
    if (insertError) {
        alert("🚨 Supabase Insert-Fehler (Antwort):\n" + insertError.message);
        return;
    }

    clearReplyImage(threadId);
    input.value = "";
    localStorage.removeItem("437_cached_forum_threads");
    loadForumThreadsFast();
}