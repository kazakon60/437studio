// =========================================================================
// 437 STUDIO | ULTRA-COMPLEX CYBERPUNK TERMINAL OS v5.0 (OPTIMIZED)
// =========================================================================

let commandHistory = [];
let historyIndex = -1;
let currentPath = "~";
let currentTheme = "#ff007f";

// Virtuelles Dateisystem (VFS)
const virtualFileSystem = {
    "~": {
        type: "dir",
        content: {
            "readme.txt": "Willkommen im 437 Studio Kern-Terminal.\nNutze 'help' für eine Liste aller Sub-Routinen.\nFinde das Easter Egg!",
            "project_x.py": "# TODO: Neon-Metropole ohne Ladezeiten optimieren\nimport core_matrix\ncore_matrix.init()",
            "access_keys.enc": "🔐 [ENCRYPTED_DATA]: 7f8a9b3c4d5e6f7a8b9c0d1e"
        }
    },
    "~/etc": {
        type: "dir",
        content: {
            "system.conf": "HOST=437_STUDIO_HQ\nSECURITY_LEVEL=ROOT_MAX\nENCRYPTION=AES-437-QUANTUM",
            "firewall.rules": "DROP ALL FROM external_node_* WHERE threat_level > 5"
        }
    },
    "~/var/log": {
        type: "dir",
        content: {
            "auth.log": "[SUCCESS] Root login via biometric key at 04:37:12\n[WARN] Failed password attempt from IP 192.437.88.1",
            "kernel.log": "[OK] Quantum RAM loaded: 64 TB\n[OK] Audio Forge Direct-Link established."
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const cliInput = document.getElementById("cli-input");
    if (cliInput) {
        cliInput.addEventListener("keydown", (e) => {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                if (commandHistory.length > 0) {
                    if (historyIndex < commandHistory.length - 1) historyIndex++;
                    cliInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
                }
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    cliInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
                } else if (historyIndex === 0) {
                    historyIndex = -1;
                    cliInput.value = "";
                }
            }
        });
    }
});

function handleCliCommand(event) {
    event.preventDefault();
    const inputField = document.getElementById("cli-input");
    const outputBox = document.getElementById("cli-output");
    const rawInput = inputField.value.trim();
    
    if (!rawInput) return;

    commandHistory.push(rawInput);
    historyIndex = -1;

    const userLine = document.createElement("div");
    userLine.style.color = "#fff";
    userLine.innerHTML = `<span style="color: ${currentTheme};">root@437-Studio:${currentPath}#</span> ${escapeHTML(rawInput)}`;
    outputBox.appendChild(userLine);

    const responseLine = document.createElement("div");
    responseLine.style.marginTop = "4px";

    const adminBadge = document.getElementById('admin-badge');
    const isAdmin = (adminBadge && !adminBadge.classList.contains('hidden')) || 
                    (typeof currentUser !== "undefined" && currentUser && ["nalix437", "amnesia437"].includes(currentUser.username.toLowerCase()));

    const parts = rawInput.split(" ");
    const mainCmd = parts[0].toLowerCase();
    const args = rawInput.slice(parts[0].length).trim();

    switch(mainCmd) {
        // --- CORE & SYSTEM ---
        case "help":
            responseLine.style.color = "#00f0ff";
            let helpText = "VERFÜGBARE KERN-MODULE & BEFEHLE:<br>" +
                "• <strong>Dateisystem:</strong> ls, cd [dir], cat [file], pwd<br>" +
                "• <strong>System & Diag:</strong> top, ps, netstat, hexdump, sysinfo, uptime, ip, firewall<br>" +
                "• <strong>Hacking & Krypto:</strong> scan, decrypt [file], sql-query [table], matrix-rain<br>" +
                "• <strong>Anpassung:</strong> theme [pink/blue/green/gold], clear, time, ping, whoami<br>" +
                "• <strong>Studio & Fun:</strong> nalix, amnesia, roadmap, changelog, credits, hack, coffee, calc, gpzitate";
            
            if (isAdmin) {
                helpText += "<br><br>🔓 <span style='color:#ff007f;'><strong>ADMIN-BEREICH:</strong></span><br>" +
                            "• <strong style='color:#ff007f;'>promote [username]</strong> - User zum Admin erheben";
            }
            responseLine.innerHTML = helpText;
            break;

        case "clear":
            outputBox.innerHTML = "<div>[SYSTEM]: Terminal-Puffer gereinigt. Kernel State gesichert.</div>";
            inputField.value = "";
            outputBox.scrollTop = outputBox.scrollHeight;
            return;

        case "pwd":
            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = currentPath;
            break;

        case "ls":
            const targetDir = virtualFileSystem[currentPath];
            if (targetDir && targetDir.type === "dir") {
                const keys = Object.keys(targetDir.content);
                responseLine.style.color = "#00ff66";
                responseLine.innerHTML = keys.map(k => targetDir.content[k].type === "dir" ? `📁 <strong>${k}/</strong>` : `📄 ${k}`).join("&nbsp;&nbsp;&nbsp;&nbsp;");
            } else {
                responseLine.style.color = "#ff0055";
                responseLine.innerHTML = "[FEHLER]: Ungültiger Verzeichnispfad.";
            }
            break;

        case "cd":
            if (!args || args === "~") {
                currentPath = "~";
                responseLine.style.color = "#00f0ff";
                responseLine.innerHTML = "[OK] Navigiert zu ~";
                break;
            }
            let newPath = args.startsWith("/") ? args : (currentPath === "~" ? `~/${args}` : `${currentPath}/${args}`);
            if (args === "..") {
                currentPath = "~";
                responseLine.style.color = "#00f0ff";
                responseLine.innerHTML = "[OK] Zurück zu ~";
                break;
            }
            if (virtualFileSystem[newPath] && virtualFileSystem[newPath].type === "dir") {
                currentPath = newPath;
                responseLine.style.color = "#00f0ff";
                responseLine.innerHTML = `[OK] Aktives Verzeichnis: ${currentPath}`;
            } else {
                responseLine.style.color = "#ff0055";
                responseLine.innerHTML = `[FEHLER]: Verzeichnis '${escapeHTML(args)}' nicht gefunden.`;
            }
            break;

        case "cat":
            if (!args) {
                responseLine.style.color = "#ffd700";
                responseLine.innerHTML = "[USAGE]: cat [dateiname]";
                break;
            }
            const activeDir = virtualFileSystem[currentPath];
            if (activeDir && activeDir.content[args]) {
                responseLine.style.color = "#fff";
                responseLine.style.whiteSpace = "pre-wrap";
                responseLine.innerHTML = escapeHTML(activeDir.content[args]);
            } else {
                responseLine.style.color = "#ff0055";
                responseLine.innerHTML = `[FEHLER]: Datei '${escapeHTML(args)}' existiert nicht in ${currentPath}.`;
            }
            break;

        case "top":
        case "ps":
            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = `
                PID &nbsp; USER &nbsp;&nbsp; CPU% &nbsp; MEM% &nbsp; COMMAND<br>
                ---------------------------------------------------<br>
                0001 &nbsp; root &nbsp;&nbsp; 0.1 &nbsp;&nbsp; 0.02 &nbsp; /sbin/437_core.daemon<br>
                0437 &nbsp; amnesia 14.8 &nbsp; 1.42 &nbsp; audio_forge_master --live<br>
                0999 &nbsp; nalix &nbsp;&nbsp; 2.2 &nbsp;&nbsp; 0.85 &nbsp; supabase_sync_matrix<br>
                1337 &nbsp; guest &nbsp;&nbsp; 0.0 &nbsp;&nbsp; 0.10 &nbsp; terminal_shell_v5
            `;
            break;

        case "netstat":
            responseLine.style.color = "#00ff66";
            responseLine.innerHTML = `
                Active Internet Connections (servers and established)<br>
                Proto &nbsp; Local Address &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Foreign Address &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; State<br>
                TCP &nbsp;&nbsp;&nbsp; 192.437.0.1:4370 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 127.0.0.1:55214 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ESTABLISHED<br>
                TCP &nbsp;&nbsp;&nbsp; 192.437.0.1:443 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 104.21.88.42:443 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ESTABLISHED
            `;
            break;

        case "hexdump":
        case "memdump":
            responseLine.style.color = "#00ff66";
            responseLine.style.fontFamily = "monospace";
            responseLine.innerHTML = `
                0x00437000:  4e 61 6c 69 78 34 33 37  41 6d 6e 65 73 69 61 34  |Nalix437Amnesia4|
                0x00437010:  73 74 75 64 69 6f 5f 72  6f 6f 74 5f 73 65 63 75  |studio_root_secu|
                0x00437020:  9f 88 e1 00 ff 00 7f 43  70 75 5f 71 75 61 6e 74  |.......Cpu_quant|
            `;
            break;

        case "decrypt":
            if (!args) {
                responseLine.style.color = "#ffd700";
                responseLine.innerHTML = "[USAGE]: decrypt [datei]";
                break;
            }
            responseLine.style.color = "#ffd700";
            responseLine.innerHTML = `[DECRYPT]: Breche Verschlüsselung von '${escapeHTML(args)}' auf...<br>[+] Key-Algorithmus: SHA-437-Quantum<br><span style="color:#00ff66;">[SUCCESS]: Entschlüsselt! Inhalt: "Das Studio schläft nie. Nächster Release im Darknet."</span>`;
            break;

        case "sql-query":
            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = "[DB_CONNECT]: Query ausgeführt gegen Supabase-Table 'users'.<br>Status: <span style='color:#00ff66;'>200 OK (0.014s)</span><br>Rows affected: Active Studio Members verified.";
            break;

        case "scan":
            responseLine.style.color = "#ffd700";
            responseLine.innerHTML = "[SCAN]: Starte Deep-Scan der 437 Subnetze...<br>" +
                                     "&nbsp;&nbsp;[+] Node 192.437.0.1: <span style='color:#00ff66;'>SECURE (Port 80/443)</span><br>" +
                                     "&nbsp;&nbsp;[+] Node 192.437.0.437: <span style='color:#00ff66;'>AUDIO FORGE ACTIVE</span><br>" +
                                     "&nbsp;&nbsp;[+] Cloud DB: <span style='color:#00ff66;'>SYNCHRONISIERT</span>";
            break;

        case "theme":
            if (!args || !["pink", "blue", "green", "gold"].includes(args.toLowerCase())) {
                responseLine.style.color = "#ffd700";
                responseLine.innerHTML = "[USAGE]: theme [pink | blue | green | gold]";
                break;
            }
            const colors = { pink: "#ff007f", blue: "#00f0ff", green: "#00ff66", gold: "#ffd700" };
            currentTheme = colors[args.toLowerCase()];
            document.documentElement.style.setProperty('--cli-accent', currentTheme);
            responseLine.style.color = currentTheme;
            responseLine.innerHTML = `[THEME]: Akzentfarbe auf '${args.toLowerCase()}' gesetzt.`;
            break;

        // --- NEUER BEFEHL: GPZITATE ---
        case "gpzitate":
            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = "[ROUTER]: Öffne geheime Zitate-Matrix...";
            outputBox.appendChild(responseLine);
            inputField.value = "";
            outputBox.scrollTop = outputBox.scrollHeight;
            setTimeout(() => {
                window.location.href = "zitate.html";
            }, 800);
            return;

        // --- ADMIN BEFEHL: PROMOTE ---
        case "promote":
            if (!isAdmin) {
                responseLine.style.color = "#ff0055";
                responseLine.innerHTML = "[ACCESS_DENIED]: Keine Admin-Berechtigung!";
                outputBox.appendChild(responseLine);
                inputField.value = "";
                outputBox.scrollTop = outputBox.scrollHeight;
                break;
            }

            if (!args) {
                responseLine.style.color = "#ffd700";
                responseLine.innerHTML = "[USAGE]: promote [benutzername]";
                outputBox.appendChild(responseLine);
                inputField.value = "";
                outputBox.scrollTop = outputBox.scrollHeight;
                break;
            }

            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = `[SYSTEM]: Suche Benutzer '${escapeHTML(args)}' in der Supabase-Datenbank...`;
            outputBox.appendChild(responseLine);
            inputField.value = "";
            outputBox.scrollTop = outputBox.scrollHeight;

            (async () => {
                try {
                    if (!window.supabaseClient) throw new Error("Supabase-Client nicht initialisiert.");

                    const { data: users, error: searchError } = await window.supabaseClient
                        .from('users')
                        .select('*')
                        .ilike('username', args)
                        .limit(1);

                    if (searchError) throw searchError;

                    if (!users || users.length === 0) {
                        const errLine = document.createElement("div");
                        errLine.style.color = "#ff0055";
                        errLine.style.marginTop = "4px";
                        errLine.innerHTML = `[FEHLER]: Benutzer '${escapeHTML(args)}' wurde nicht gefunden.`;
                        outputBox.appendChild(errLine);
                        outputBox.scrollTop = outputBox.scrollHeight;
                        return;
                    }

                    const targetUser = users[0];

                    const { error: updateError } = await window.supabaseClient
                        .from('users')
                        .update({ is_admin: true })
                        .eq('username', targetUser.username);

                    if (updateError) throw updateError;

                    if (typeof currentUser !== "undefined" && currentUser && currentUser.username.toLowerCase() === targetUser.username.toLowerCase()) {
                        currentUser.is_admin = true;
                        localStorage.setItem("437_session", JSON.stringify(currentUser));
                    }

                    const succLine = document.createElement("div");
                    succLine.style.color = "#00ff66";
                    succLine.style.marginTop = "4px";
                    succLine.innerHTML = `[SUCCESS]: '${escapeHTML(targetUser.username)}' ist nun Administrator!`;
                    outputBox.appendChild(succLine);
                    outputBox.scrollTop = outputBox.scrollHeight;

                } catch (err) {
                    const errLine = document.createElement("div");
                    errLine.style.color = "#ff0055";
                    errLine.style.marginTop = "4px";
                    errLine.innerHTML = `[DB_ERROR]: ${escapeHTML(err.message || 'Unbekannter Fehler')}`;
                    outputBox.appendChild(errLine);
                    outputBox.scrollTop = outputBox.scrollHeight;
                }
            })();
            return;

        case "discord":
            const loggedInZone = document.getElementById('logged-in-zone');
            if (loggedInZone && !loggedInZone.classList.contains('hidden')) {
                responseLine.style.color = "#00ff66";
                responseLine.innerHTML = "[OK]: Öffne Discord-Matrix...";
                setTimeout(() => window.open("https://discord.gg/ZZU9m4eJFZ", "_blank"), 800);
            } else {
                responseLine.style.color = "#ff0055";
                responseLine.innerHTML = "[ACCESS_DENIED]: Du musst eingeloggt sein!";
            }
            break;

        case "sysinfo":
            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = "[SYSINFO]: OS: 437-CyberCore v4.2 | Kernel: Linux 6.4.0-437 | RAM: 64 TB Quantum";
            break;
        case "uptime":
            responseLine.style.color = "#00ff66";
            responseLine.innerHTML = "[UPTIME]: System läuft seit 437 Tagen unter Hochspannung.";
            break;
        case "ip":
            responseLine.style.color = "#ffd700";
            responseLine.innerHTML = "[NETWORK]: Interne IP: 192.437.0.1 | Status: Verschleiert";
            break;
        case "firewall":
            responseLine.style.color = "#00ff66";
            responseLine.innerHTML = "[FIREWALL]: Status: AKTIV. Angriffe abgewehrt: 1.337.";
            break;
        case "status":
            responseLine.style.color = "#00ff66";
            responseLine.innerHTML = "[STATUS]: Alle Systeme von 437 Studio laufen stabil.";
            break;
        case "time":
            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = `[TIME]: ${new Date().toLocaleTimeString()} (Matrix UTC+437)`;
            break;
        case "whoami":
            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = (typeof currentUser !== "undefined" && currentUser) ? `[USER]: ${escapeHTML(currentUser.username)} (Root)` : "[USER]: Gast";
            break;
        case "ping":
            responseLine.style.color = "#00ff66";
            responseLine.innerHTML = "[PING]: Latenz zum Hauptknoten: 12ms.";
            break;
        case "nalix":
            responseLine.style.color = "#00f0ff";
            responseLine.innerHTML = "[DEV]: Nalix437 – Lead Systems Architect.";
            break;
        case "amnesia":
            responseLine.style.color = "#ff007f";
            responseLine.innerHTML = "[DEV]: Amnesia437 – Audio Forge Master.";
            break;
        case "roadmap":
            responseLine.style.color = "#ffd700";
            responseLine.innerHTML = "[ROADMAP]: Q1: Core | Q2: Arcade | Q3: Audio | Q4: Matrix-Vollendung.";
            break;
        case "changelog":
            responseLine.style.color = "#00ff66";
            responseLine.innerHTML = "[CHANGELOG]: v5.0: Virtual File System (VFS), Process Table & Hexdump implementiert.";
            break;
        case "credits":
            responseLine.style.color = "#ffd700";
            responseLine.innerHTML = "[CREDITS]: Nalix437 & Amnesia437.";
            break;
        case "hack":
            responseLine.style.color = "#00ff66";
            responseLine.innerHTML = "[HACK]: Pentagon-Einbruch läuft... Fehlgeschlagen: Zu wenig Quantum-Energie!";
            break;
        case "coffee":
            responseLine.style.color = "#ffd700";
            responseLine.innerHTML = "[COFFEE]: ☕ Frischer Kaffee für die Devs gekocht!";
            break;
        case "matrix-rain":
        case "matrix":
            responseLine.style.color = "#00ff66";
            responseLine.innerHTML = "[MATRIX]: 01001101 01100001 01110100 01110010 01101001 01111000";
            document.body.style.boxShadow = "inset 0 0 60px rgba(0, 255, 102, 0.4)";
            setTimeout(() => { document.body.style.boxShadow = "none"; }, 1000);
            break;
        case "echo":
            responseLine.style.color = "#fff";
            responseLine.innerHTML = `[ECHO]: ${escapeHTML(args)}`;
            break;
        case "calc":
            try {
                const expr = args.replace(/[^0-9+\-*/().]/g, '');
                if (!expr) throw new Error();
                responseLine.style.color = "#00ff66";
                responseLine.innerHTML = `[CALC]: ${escapeHTML(expr)} = <strong>${eval(expr)}</strong>`;
            } catch (e) {
                responseLine.style.color = "#ff0055";
                responseLine.innerHTML = "[CALC_ERROR]: Ungültige Formel (z.B. calc 437 * 2).";
            }
            break;
        case "437":
            if (typeof unlockAchievement === "function") unlockAchievement("hacker_init");
            responseLine.style.color = "#ff0055";
            responseLine.innerHTML = "[SYSTEM_CRITICAL]: KERNOVERFLOW INITIERT...";
            setTimeout(() => {
                document.body.innerHTML = `
                    <div style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:#05000a; color:#ff0055; display:flex; flex-direction:column; justify-content:center; align-items:center; font-family:monospace; text-align:center; padding:20px; z-index:999999;">
                        <h1 style="font-size:50px; text-shadow:0 0 20px #ff0055; margin-bottom:15px;">⚠️ [SYSTEM_COLLAPSE] ⚠️</h1>
                        <p style="color:#00f0ff; font-size:18px; max-width:600px; line-height:1.6; border: 1px dashed #ff0055; padding: 25px; background: rgba(255,0,85,0.05); margin-bottom: 25px;">
                            FATAL_ERROR: Die VFS-Integrität wurde durch Code 437 zerstört.
                        </p>
                        <button onclick="window.location.reload()" class="btn btn-neon-green" style="font-size:16px; padding:12px 30px;">🔄 System Neustarten</button>
                    </div>
                `;
            }, 2500);
            break;

        default:
            responseLine.style.color = "#ff0055";
            responseLine.innerHTML = `[FEHLER]: Befehl '${escapeHTML(mainCmd)}' nicht erkannt. Tippe 'help'.`;
            break;
    }

    outputBox.appendChild(responseLine);
    inputField.value = "";
    outputBox.scrollTop = outputBox.scrollHeight;
}