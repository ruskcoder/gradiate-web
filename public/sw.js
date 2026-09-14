// Offline shell for the installed app. Only same-origin GETs are handled; API
// calls (a different origin, all POST) always go straight to the network.
const CACHE = 'gradiate-v1'
const SHELL = ['/', '/index.html', '/logo-rounded.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

const putInCache = (request, response) => {
  if (response.ok) {
    const copy = response.clone()
    caches.open(CACHE).then((c) => c.put(request, copy))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // SPA navigations: network first, fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => putInCache('/index.html', res))
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => putInCache(request, res)))
    )
    return
  }

  // Everything else (districts.json, icons): network first, cache fallback.
  event.respondWith(
    fetch(request)
      .then((res) => putInCache(request, res))
      .catch(() => caches.match(request))
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const client = clients.find((c) => 'focus' in c)
      return client ? client.focus() : self.clients.openWindow('/dashboard')
    })
  )
})
