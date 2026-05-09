const CACHE_NAME = "statscope-v2";
const PRECACHE_URLS = [
  "/",
  "/standings",
  "/news",
  "/matchup",
  "/portfolio",
  "/track",
  "/about",
  "/methodology",
  "/offline.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Network-first for API and external resources
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api") || url.hostname !== self.location.hostname) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Try cache first
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // If not in cache and request is a navigation request (HTML page),
          // serve offline.html instead
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }
          return null;
        });
      })
  );
});
