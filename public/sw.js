// Essenza Hub — Service Worker for Push Notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || "",
    icon: "/assets/icon-192.png",
    badge: "/assets/favicon.png",
    data: { href: data.href || "/inicio" },
    tag: data.tag || "essenza-notification",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Essenza Hub", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/inicio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(href);
          return;
        }
      }
      return self.clients.openWindow(href);
    })
  );
});
