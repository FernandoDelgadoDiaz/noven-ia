/* Service Worker — NoVen IA Web Push */

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'NoVen IA', {
      body: data.body,
      icon: data.icon ?? '/favicon.svg',
      badge: data.badge ?? '/favicon.svg',
      data: data.data,
      vibrate: [200, 100, 200],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? '/'))
})
