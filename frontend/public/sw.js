// RIM-System Service Worker — Web Push Notifications

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Handle incoming push event from server
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: 'RIM System',
      body: event.data.text(),
      url: '/',
      tag: 'rim-notification',
    };
  }

  const title = payload.title || 'RIM System';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192x192.svg',
    badge: payload.badge || '/icons/icon-192x192.svg',
    tag: payload.tag || 'rim-notification',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click — open/focus the correct page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  const fullUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          client.navigate(fullUrl);
          return;
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(fullUrl);
    }),
  );
});
