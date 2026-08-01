const CACHE = "interun-1595337";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./roadmap/", "./roadmap/index.html", "./roadmap/manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    // Network-first, and it MUST bypass the HTTP cache. GitHub Pages serves index.html with
    // cache-control: max-age=600, so a plain fetch() is answered from the browser's own cache and
    // faithfully returns a copy up to ten minutes old - "network-first" that is not. Measured: the
    // phone showed a build stamp seven minutes behind what Pages was serving, which reads exactly
    // like "my fix did not work" and cost most of a morning.
    // no-cache revalidates rather than re-downloading: unchanged gets a 304, so this is cheap
    // despite the page being well over a megabyte.
    // ⚠️ fetch(req, init) would throw here - a Request whose mode is "navigate" cannot be
    // reconstructed - so pass the URL.
    const fresh = fetch(req.url, { cache: "no-cache", credentials: "same-origin" });
    // Offline fallback: serve the page that was actually asked for if we have it (e.g. the roadmap),
    // and only then fall back to the app shell.
    e.respondWith(fresh.then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)).catch(() => {}); return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)).catch(() => {}); return res; })));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cl) => {
    for (const c of cl) { if ("focus" in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow((e.notification.data && e.notification.data.url) || "./");
  }));
});
