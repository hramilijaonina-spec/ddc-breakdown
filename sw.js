/* DDC Breakdown — service worker : l'app s'ouvre même sans réseau. */
const VERSION = "ddc-v2";
const SHELL = ["./", "index.html", "adapter.js", "config.js", "manifest.webmanifest",
  "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"];
const CDN = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Courier+Prime:wght@400;700&family=Instrument+Sans:wght@400;500;600&display=swap"
];
const STATIC_HOSTS = ["www.gstatic.com", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all([
    c.addAll(SHELL),
    ...CDN.map(u => fetch(u, { mode: "no-cors" }).then(r => c.put(u, r)).catch(() => {}))
  ])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req) {
  const net = fetch(req).then(res => {
    if (res && res.ok) caches.open(VERSION).then(c => c.put(req, res.clone()));
    return res;
  });
  const fallback = () => caches.match(req, { ignoreSearch: true })
    .then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined))
    .then(r => r || Response.error());
  /* réseau lent : on sert la copie locale au bout de 4 s */
  return Promise.race([net, new Promise(res => setTimeout(() => res(null), 4000))])
    .then(r => r || caches.match(req, { ignoreSearch: true }).then(c => c || net))
    .catch(fallback);
}

function cacheFirst(req) {
  return caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === "opaque")) caches.open(VERSION).then(c => c.put(req, res.clone()));
    return res;
  }));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (STATIC_HOSTS.includes(url.hostname) && !url.pathname.startsWith("/__/")) e.respondWith(cacheFirst(req));
});
