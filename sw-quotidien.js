/* PYROS Quotidien — service worker
   Réseau d'abord sur les pages : la mise à jour arrive toute seule au lancement.
   Change VERSION à chaque déploiement si tu veux forcer un nettoyage complet. */

const VERSION = "2026-08-17-1";
const CACHE   = "pyros-quotidien-" + VERSION;
const ASSETS  = ["./", "./index.html", "./planning-videos.html", "./manifest-quotidien.json", "./icon-192.png"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== location.origin) return;               // météo, polices, Avengers : réseau direct

  const estPage = req.mode === "navigate" ||
                  (req.headers.get("accept") || "").includes("text/html");

  if (estPage) {                                            // ---- pages : réseau d'abord ----
    e.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: "no-store" });
        const c = await caches.open(CACHE);
        c.put(req, net.clone());
        return net;
      } catch (err) {
        return (await caches.match(req)) ||
               (await caches.match("./index.html")) ||
               new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })());
    return;
  }

  e.respondWith((async () => {                              // ---- reste : cache d'abord, maj en fond ----
    const hit = await caches.match(req);
    const net = fetch(req).then(r => {
      if (r && r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
      return r;
    }).catch(() => hit);
    return hit || net;
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const l = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of l) if ("focus" in c) return c.focus();
    if (clients.openWindow) return clients.openWindow("./index.html");
  })());
});
