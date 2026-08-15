// Minimal service worker. Its only job is to exist: Chrome will not offer the
// install prompt for a PWA without one that registers a fetch handler.
//
// It deliberately caches nothing. Every prompt in the queue is server state, so
// a cached shell would show a stale list after a deploy, and an offline mode
// with no data to show is not worth the invalidation bugs. The fetch listener
// falls through to the network for everything.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', () => {})
