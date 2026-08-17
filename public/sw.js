// Enough of a cache to open the app on no signal, and no more than that.
//
// "Stash prompts now, paste them later" puts the paste half in exactly the
// places a phone has nothing: a basement office, a train, someone else's wifi.
// So the queue you last looked at has to survive being offline. The reason the
// earlier version of this file cached nothing was a real one — a stale shell
// serving yesterday's list after a deploy — and both halves here are shaped to
// avoid it rather than to hope:
//
//   /assets/* is content-hashed by the bundler, so a cached copy can never be
//   the wrong copy: a changed file is a changed URL. Cache-first.
//
//   Documents are network-first. A deploy is picked up the moment there is
//   signal, and the cached copy is only ever reached when the network does not
//   answer. Because the pages are server-rendered, that copy carries the
//   queue's data with it, which is the whole point.
//
// Everything else — server functions, auth — is left alone and goes to the
// network, so nothing that mutates or authenticates is ever served from here.

const VERSION = 'v1'
const DOCUMENTS = `toprompt-documents-${VERSION}`
const ASSETS = `toprompt-assets-${VERSION}`

// How long a document fetch is given before the cached copy is served instead.
// The failure this exists for is not "offline", which fails fast — it is one
// bar of signal, where a fetch can hang for half a minute.
const DOCUMENT_TIMEOUT_MS = 3000

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !name.endsWith(VERSION))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
)

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function networkFirst(request) {
  const cache = await caches.open(DOCUMENTS)
  // Held onto rather than awaited directly: when the timeout wins, this keeps
  // running and still refreshes the cache, so a slow connection is not also a
  // connection that never updates anything.
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  })

  try {
    return await Promise.race([
      network,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('slow')), DOCUMENT_TIMEOUT_MS),
      ),
    ])
  } catch {
    const hit = await cache.match(request)
    // No cached copy and no network: hand the failure back rather than
    // inventing a response, so the browser shows its own offline page.
    return hit ?? network
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  }
})

// Signing out has to take the cached pages with it. They are server-rendered,
// so each one holds the project names of whoever was signed in when it was
// stored — on a shared or handed-over phone that is the account's data left
// behind after the account has gone.
self.addEventListener('message', (event) => {
  if (event.data !== 'clear-cache') return
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))),
  )
})
