const CACHE = "radio-v1";
const PRECACHE = ["/", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = e.request.url;
  // Never intercept Supabase, YouTube, external APIs or media
  if (
    url.includes("supabase.co") ||
    url.includes("youtube.com") ||
    url.includes("ytimg.com") ||
    url.includes("googleapis.com") ||
    url.includes("dicebear.com") ||
    url.includes("r2.dev") ||
    url.includes("lovable.app")
  ) return;

  // Navigation requests: network-first, offline fallback to cached /
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const network = fetch(e.request)
          .then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});

// Background sync: keep alive for audio context
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
