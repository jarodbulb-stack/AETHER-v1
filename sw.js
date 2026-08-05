/* ============================================================
   AETHER — SERVICE WORKER
   Caches the app shell (every page, script, stylesheet, and image
   that makes AETHER itself work) so the app still loads without a
   network connection. This is separate from -- and doesn't interfere
   with -- Firestore's own offline data sync; this handles the code
   and assets, Firestore already handles the data.

   Strategy: network-first, cache-fallback. Every request tries the
   real network first (so you're always running the latest version
   when online, unlike a cache-first strategy which can get stubbornly
   stale), and only falls back to the cached copy if the network
   request fails -- which is exactly the offline case this exists for.
   The cache is refreshed in the background on every successful
   network fetch, so it stays reasonably current automatically.

   Bump CACHE_NAME any time the core file list changes meaningfully;
   the activate step cleans up any old-named caches automatically.
   ============================================================ */
var CACHE_NAME = 'aether-shell-v2';

var CORE_ASSETS = [
  './',
  './index.html',
  './login.html',
  './loading.html',
  './dashboard.html',
  './life-advancement.html',
  './missions.html',
  './blueprints.html',
  './problems-blockers.html',
  './evidence-vault.html',
  './timeline.html',
  './debrief.html',
  './knowledge-library.html',
  './summit-archive.html',
  './command-center.html',
  './portfolio.html',
  './applications.html',
  './guide.html',
  './daily-command.html',
  './aether-theme.css',
  './aether-shell.css',
  './aether-nav.js',
  './aether-quotes.js',
  './aether-voice.js',
  './aether-music.js',
  './aether-celebration.js',
  './aether-pwa.js',
  './campaignStore.js',
  './intelligenceEngine.js',
  './daily-command.js',
  './great-mountain.js',
  './mission-mountain.js',
  './route-data.js',
  './earth-flicker.js',
  './auth-guard.js',
  './firebase-config.js',
  './firestore-sync.js',
  './aether-banner-clean.png',
  './earth.png',
  './earth-night.png',
  './assets/great-mountain-left.jpg',
  './assets/great-mountain-right.jpg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './manifest.json'
];

self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      /* addAll fails entirely if even one file 404s -- add individually
         instead so one missing/renamed asset doesn't block every other
         file from being cached. */
      return Promise.all(CORE_ASSETS.map(function(url){
        return cache.add(url).catch(function(){ /* skip this one, keep going */ });
      }));
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  var req = event.request;

  /* Only handle same-origin GET requests. Leave Firebase/Firestore
     calls, the Google Fonts / gstatic CDN, POSTs, etc. completely
     alone -- they behave exactly as they would with no service worker
     at all. This app's own offline behavior for real data already
     comes from Firestore's local persistence, not this cache. */
  var url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function(res){
      var resClone = res.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(req, resClone); });
      return res;
    }).catch(function(){
      return caches.match(req).then(function(cached){
        return cached || caches.match('./index.html');
      });
    })
  );
});
