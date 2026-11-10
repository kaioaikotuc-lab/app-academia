// Service worker: deixa o app abrir offline (cache do "casco" do app).
// Ao mudar arquivos, aumente a VERSAO para os aparelhos atualizarem.
const VERSAO = "academia-v1.0.2";
const ARQUIVOS = ["./", "index.html", "styles.css", "config.js", "store.js", "app.js", "vendor/supabase.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS))); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // API do Supabase vai direto pela rede
  // rede primeiro (pega atualizações), cache se estiver offline
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => cs[0] ? cs[0].focus() : self.clients.openWindow("./#ativo"))); });
