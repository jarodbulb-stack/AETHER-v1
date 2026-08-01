/* ============================================================
   AETHER — MUSIC
   Background instrumental cues. Uses plain HTML5 <audio> (not Web
   Audio synthesis, unlike the chime/fanfare) because these are real
   music files the operator supplies.

   Two ways a track gets its source:
   1. A file the operator uploaded through Command Center's
      "Soundtrack Library" -- stored in IndexedDB (works on desktop
      and mobile, no file-system access needed, no server). This is
      checked first.
   2. Falls back to the bundled default at assets/audio/*.mp3 if no
      upload exists yet -- see assets/audio/READ_ME_AUDIO.txt.

   Three moments:
   1. Splash intro  -- starts on the ENTER click (index.html), keeps
      playing across the loading screen and into the login page (this
      is a plain multi-page app, not a single-page app, so "continuing"
      across page loads is simulated by tracking a shared start time in
      sessionStorage and resuming each new page at the correct elapsed
      position), then fades out and stops.
   2. Command Deck intro -- a fresh, separate cue every time the
      Command Deck itself loads. Plays briefly, fades, stops.
   3. Celebration loop -- starts right after the mission-complete
      chime, loops until the operator exits that screen.

   All of this is silent-safe: if a track file isn't there yet, or the
   browser blocks autoplay, playback just quietly doesn't happen --
   nothing else in the app depends on it.

   Usage (playback):
     AetherMusic.startSplashIntro()      -- index.html, on ENTER click
     AetherMusic.continueSplashIntro()   -- loading.html / login.html, on load
     AetherMusic.playDashboardIntro()    -- dashboard.html, on load
     AetherMusic.playCelebrationLoop()   -- aether-celebration.js, after the fanfare
     AetherMusic.stopLoop()              -- aether-celebration.js, on any exit
     AetherMusic.stopAll()               -- loading.html, on sign-out
     AetherMusic.duck() / unduck()       -- called automatically by aether-voice.js
     AetherMusic.isEnabled() / setEnabled(bool)

   Usage (library, Command Center):
     AetherMusic.setCustomTrack(key, file) -> Promise
     AetherMusic.removeCustomTrack(key)    -> Promise
     AetherMusic.getCustomTrackInfo(key)   -> Promise<{name,size,savedAt}|null>
     AetherMusic.previewTrack(key)         -- plays it once, for testing
     AetherMusic.stopPreview()
     AetherMusic.TRACK_KEYS -- ['intro','dashboardIntro','celebrationLoop']
   ============================================================ */
(function(){
  'use strict';

  var TRACKS = {
    intro: 'assets/audio/intro.mp3',
    dashboardIntro: 'assets/audio/dashboard-intro.mp3',
    celebrationLoop: 'assets/audio/celebration-loop.mp3'
  };
  var TRACK_KEYS = Object.keys(TRACKS);

  /* Tune these to taste once the real files are in place. */
  var SPLASH_FADE_START_SEC = 8;   // splash/login intro starts fading out at this mark
  var SPLASH_FADE_DURATION_SEC = 2;
  var DASH_FADE_START_SEC = 6;     // Command Deck intro starts fading out at this mark
  var DASH_FADE_DURATION_SEC = 2;
  var BASE_VOLUME = 0.55;
  var DUCK_VOLUME = 0.16;          // volume music drops to while AETHER is speaking

  var STORAGE_KEY = 'aetherMusicEnabled'; /* not "aether_..." -- local device
    preference, not campaign data (see the same note in aether-voice.js) */
  var SESSION_KEY = 'aetherMusicSplashStart';

  function isEnabled(){
    try{
      var v = localStorage.getItem(STORAGE_KEY);
      return v === null ? true : v === 'true';
    }catch(e){ return true; }
  }
  function setEnabled(on){
    try{ localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false'); }catch(e){}
    if(!on){ stopAll(); }
  }

  /* ---- Custom track library (IndexedDB) --------------------------------
     Stores the operator's own uploaded files as Blobs, keyed by track
     name. IndexedDB (not localStorage) because audio files are too big
     for localStorage's ~5MB limit -- IndexedDB comfortably handles
     several MB per track with room to spare. */
  var DB_NAME = 'aetherMusicLibrary';
  var DB_VERSION = 1;
  var STORE_NAME = 'tracks';
  var dbPromise = null;

  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      if(!window.indexedDB){ reject(new Error('no indexedDB')); return; }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(){ req.result.createObjectStore(STORE_NAME); };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
    return dbPromise;
  }

  function getCustomTrackRecord(key){
    return openDB().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = function(){ resolve(req.result || null); };
        req.onerror = function(){ reject(req.error); };
      });
    }).catch(function(){ return null; });
  }

  /* Cache of object URLs created from stored blobs, so repeated
     playback doesn't re-create a URL every single time. Invalidated
     whenever a track is uploaded or removed. */
  var objectUrlCache = {};
  function invalidateCachedURL(key){
    if(objectUrlCache[key]){
      try{ URL.revokeObjectURL(objectUrlCache[key]); }catch(e){}
      delete objectUrlCache[key];
    }
  }

  function setCustomTrack(key, file){
    if(TRACK_KEYS.indexOf(key) === -1) return Promise.reject(new Error('unknown track key'));
    return openDB().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ blob: file, name: file.name || key, size: file.size, savedAt: Date.now() }, key);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
      });
    }).then(function(){ invalidateCachedURL(key); });
  }

  function removeCustomTrack(key){
    return openDB().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
      });
    }).then(function(){ invalidateCachedURL(key); });
  }

  function getCustomTrackInfo(key){
    return getCustomTrackRecord(key).then(function(record){
      if(!record) return null;
      return { name: record.name, size: record.size, savedAt: record.savedAt };
    });
  }

  /* Resolves to whatever should actually be played for this key right
     now: the operator's uploaded file if one exists, otherwise the
     bundled default path. */
  function resolveTrackURL(key){
    if(objectUrlCache[key]) return Promise.resolve(objectUrlCache[key]);
    return getCustomTrackRecord(key).then(function(record){
      if(record && record.blob){
        var url = URL.createObjectURL(record.blob);
        objectUrlCache[key] = url;
        return url;
      }
      return TRACKS[key];
    }).catch(function(){ return TRACKS[key]; });
  }

  var activeEl = null;   // the currently playing intro/dashboard track (for ducking + fade control)
  var loopEl = null;     // the celebration loop, tracked separately since it can overlap
  var previewEl = null;  // Command Center's "test this track" playback
  var fadeTimer = null;
  var duckLevel = null;  // remembers the pre-duck volume target while ducked

  function clearFadeTimer(){ if(fadeTimer){ clearInterval(fadeTimer); fadeTimer = null; } }

  function fadeOutAndStop(el, durationMs){
    if(!el) return;
    clearFadeTimer();
    var steps = 20;
    var stepMs = Math.max(30, durationMs / steps);
    var startVol = el.volume;
    var i = 0;
    fadeTimer = setInterval(function(){
      i++;
      el.volume = Math.max(0, startVol * (1 - i / steps));
      if(i >= steps){
        clearFadeTimer();
        try{ el.pause(); }catch(e){}
      }
    }, stepMs);
  }

  function stopAll(){
    clearFadeTimer();
    if(activeEl){ try{ activeEl.pause(); }catch(e){} activeEl = null; }
    if(loopEl){ try{ loopEl.pause(); }catch(e){} loopEl = null; }
    stopPreview();
    try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  }

  /* ---- Splash intro: starts on ENTER, continues across the next
     couple of page loads by tracking real elapsed time. ---- */
  function startSplashIntro(){
    if(!isEnabled()) return;
    try{ sessionStorage.setItem(SESSION_KEY, String(Date.now())); }catch(e){}
    resolveTrackURL('intro').then(function(url){
      var el = new Audio(url);
      el.volume = BASE_VOLUME;
      el.play().catch(function(){ /* autoplay blocked or file missing -- stay silent */ });
      activeEl = el;
      scheduleSplashFade(0);
    });
  }

  function continueSplashIntro(){
    if(!isEnabled()) return;
    var startTs;
    try{ startTs = parseInt(sessionStorage.getItem(SESSION_KEY), 10); }catch(e){ return; }
    if(!startTs || isNaN(startTs)) return;

    var elapsedSec = (Date.now() - startTs) / 1000;
    var totalSec = SPLASH_FADE_START_SEC + SPLASH_FADE_DURATION_SEC;
    if(elapsedSec >= totalSec){
      try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
      return; // intro already would have finished by now -- don't restart it
    }

    resolveTrackURL('intro').then(function(url){
      var el = new Audio(url);
      el.volume = BASE_VOLUME;
      try{ el.currentTime = elapsedSec; }catch(e){}
      el.play().catch(function(){});
      activeEl = el;
      scheduleSplashFade(elapsedSec);
    });
  }

  function scheduleSplashFade(alreadyElapsedSec){
    clearFadeTimer();
    var untilFadeMs = Math.max(0, (SPLASH_FADE_START_SEC - alreadyElapsedSec) * 1000);
    fadeTimer = setTimeout(function(){
      fadeOutAndStop(activeEl, SPLASH_FADE_DURATION_SEC * 1000);
    }, untilFadeMs);
  }

  /* ---- Command Deck intro: a fresh, independent cue. ---- */
  function playDashboardIntro(){
    if(!isEnabled()) return;
    resolveTrackURL('dashboardIntro').then(function(url){
      var el = new Audio(url);
      el.volume = BASE_VOLUME;
      el.play().catch(function(){});
      activeEl = el;
      clearFadeTimer();
      fadeTimer = setTimeout(function(){
        fadeOutAndStop(el, DASH_FADE_DURATION_SEC * 1000);
      }, DASH_FADE_START_SEC * 1000);
    });
  }

  /* ---- Celebration loop ---- */
  function playCelebrationLoop(){
    if(!isEnabled()) return;
    if(loopEl){ try{ loopEl.pause(); }catch(e){} }
    resolveTrackURL('celebrationLoop').then(function(url){
      var el = new Audio(url);
      el.loop = true;
      el.volume = BASE_VOLUME;
      el.play().catch(function(){});
      loopEl = el;
    });
  }
  function stopLoop(){
    if(loopEl){ try{ loopEl.pause(); }catch(e){} loopEl = null; }
  }

  /* ---- Command Center preview: play a track once, at normal volume,
     for testing an upload before committing to it. ---- */
  function previewTrack(key){
    stopPreview();
    resolveTrackURL(key).then(function(url){
      var el = new Audio(url);
      el.volume = BASE_VOLUME;
      el.play().catch(function(){});
      previewEl = el;
    });
  }
  function stopPreview(){
    if(previewEl){ try{ previewEl.pause(); }catch(e){} previewEl = null; }
  }

  /* ---- Ducking: called from aether-voice.js so background music
     doesn't fight with AETHER actually talking. ---- */
  function duck(){
    duckLevel = BASE_VOLUME;
    [activeEl, loopEl].forEach(function(el){ if(el) el.volume = DUCK_VOLUME; });
  }
  function unduck(){
    [activeEl, loopEl].forEach(function(el){ if(el) el.volume = duckLevel != null ? duckLevel : BASE_VOLUME; });
    duckLevel = null;
  }

  window.AetherMusic = {
    startSplashIntro: startSplashIntro,
    continueSplashIntro: continueSplashIntro,
    playDashboardIntro: playDashboardIntro,
    playCelebrationLoop: playCelebrationLoop,
    stopLoop: stopLoop,
    stopAll: stopAll,
    duck: duck,
    unduck: unduck,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    setCustomTrack: setCustomTrack,
    removeCustomTrack: removeCustomTrack,
    getCustomTrackInfo: getCustomTrackInfo,
    previewTrack: previewTrack,
    stopPreview: stopPreview,
    TRACK_KEYS: TRACK_KEYS
  };
})();
