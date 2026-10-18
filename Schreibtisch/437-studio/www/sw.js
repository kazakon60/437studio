// =========================================================================
// 437 STUDIO | PUSH SERVICE WORKER (ROOT EDITION - COMPLETE)
// =========================================================================

"use strict";

// Installation des Service Workers
self.addEventListener("install", event => {
    console.log("437 STUDIO SW: Service Worker wird installiert...");
    self.skipWaiting();
});

// Aktivierung und sofortige Übernahme der Kontrolle
self.addEventListener("activate", event => {
    console.log("437 STUDIO SW: Service Worker aktiviert.");
    event.waitUntil(self.clients.claim());
});

// Empfang von Push-Nachrichten (wenn die App im Hintergrund oder geschlossen ist)
self.addEventListener("push", event => {
    let notificationData = {
        title: "437 Studio",
        body: "Neue Nachricht im Netzwerk eingetroffen!",
        url: "/messages.html"
    };

    if (event.data) {
        try {
            const parsedData = event.data.json();
            notificationData.title = parsedData.title || notificationData.title;
            notificationData.body = parsedData.body || notificationData.body;
            notificationData.url = parsedData.url || notificationData.url;
        } catch (error) {
            notificationData.body = event.data.text();
        }
    }

    const options = {
        body: notificationData.body,
        icon: "/img/logo.png",
        badge: "/img/logo.png",
        vibrate: [200, 100, 200],
        data: {
            url: notificationData.url
        }
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});

// Klick auf das Benachrichtigungs-Fenster
self.addEventListener("notificationclick", event => {
    event.notification.close();

    const targetUrl = event.notification.data?.url || "/messages.html";

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
            // Prüfen, ob das Fenster bereits offen ist -> Fokus darauf setzen
            for (const client of clientList) {
                if (client.url.includes(targetUrl) && "focus" in client) {
                    return client.focus();
                }
            }
            // Ansonsten ein neues Fenster öffnen
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});