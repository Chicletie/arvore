/* Rotina — service worker (offline + atualização) */
var CACHE = "arvore-cache-v1";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  // Mesmo domínio: HTML busca da rede primeiro (pega atualização), resto do cache primeiro
  if (url.origin === self.location.origin) {
    var wantsHtml = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") !== -1;
    if (wantsHtml) {
      e.respondWith(
        fetch(req).then(function (r) {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
          return r;
        }).catch(function () {
          return caches.match("./index.html").then(function (m) { return m || caches.match("./"); });
        })
      );
      return;
    }
    e.respondWith(
      caches.match(req).then(function (m) {
        return m || fetch(req).then(function (r) {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return r;
        });
      })
    );
    return;
  }

  // Google Fonts + SDK do Firebase (gstatic): usa o cache, atualiza em segundo plano
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com" ||
      (url.host === "www.gstatic.com" && url.pathname.indexOf("/firebasejs/") === 0)) {
    e.respondWith(
      caches.match(req).then(function (m) {
        var net = fetch(req).then(function (r) {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return r;
        }).catch(function () { return m; });
        return m || net;
      })
    );
  }
});
