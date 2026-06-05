// Neurotek AI — Service Worker (production asset caching)
// Strategy: cache-first for static assets, network-first for navigation.

const CACHE_VERSION = 'nt-v1'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const FONT_CACHE    = `${CACHE_VERSION}-fonts`

// Assets to pre-cache on install (populated by build — these are the shell)
const PRECACHE_URLS = [
  './',
  './index.html',
]

// Install: pre-cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()   // activate immediately
})

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch: routing logic
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET, chrome-extension, and API calls (never cache API)
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) return
  if (url.pathname.startsWith('/api/')) return

  // Fonts: cache-first with long TTL
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
        })
      )
    )
    return
  }

  // Static assets (JS/CSS/images with hash in URL): cache-first
  const isHashed = /\/assets\/[^/]+-[a-f0-9]{8,}\.(js|css|png|svg|woff2?)/.test(url.pathname)
  if (isHashed) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
        })
      )
    )
    return
  }

  // Navigation (HTML shell): network-first, fallback to index.html in cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(STATIC_CACHE).then(cache =>
          cache.match('./index.html') ?? cache.match('./')
        )
      )
    )
    return
  }
})
