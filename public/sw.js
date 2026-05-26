self.addEventListener("push", (event) => {
    let payload;
    if (event.data) {
        try {
            payload = event.data.json();
        } catch {
            payload = { title: "AllCodex", body: event.data.text() };
        }
    } else {
        payload = { title: "AllCodex", body: "New notification received." };
    }

    const title = payload.title || "AllCodex";
    const body = payload.body || "";
    const href = payload.href || "/";

    event.waitUntil(
        self.registration.showNotification(title, {
            body: body,
            icon: "/globe.svg",
            badge: "/globe.svg",
            tag: href,
            data: { href: href },
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    const href = event.notification.data?.href ?? "/";
    let targetUrl;
    try {
        targetUrl = new URL(href, self.location.origin);
    } catch {
        targetUrl = new URL("/", self.location.origin);
    }

    // Force matching origin to prevent open redirect vulnerabilities
    if (targetUrl.origin !== self.location.origin) {
        targetUrl = new URL("/", self.location.origin);
    }

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                let clientUrl;
                try {
                    clientUrl = new URL(client.url);
                } catch {
                    continue;
                }

                // Safe origin comparison to prevent attacker.com/?ref=our-origin bypass
                if (clientUrl.origin === self.location.origin && "focus" in client) {
                    if ("navigate" in client) {
                        return client.navigate(targetUrl.href).then((navigatedClient) => {
                            return (navigatedClient || client).focus();
                        });
                    }
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl.href);
            }
        })
    );
});

