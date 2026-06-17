self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || '⚠️ Estoque pendente – Cosechas', {
      body: data.body || 'Há produtos pendentes para contar hoje!',
      icon: '/logo-cosechas.png',
      badge: '/logo-cosechas.png',
      requireInteraction: true,
      vibrate: [400, 150, 400, 150, 400],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
