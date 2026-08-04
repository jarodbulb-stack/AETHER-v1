/* ============================================================
   AETHER — MUSIC
   Background instrumental cues. Uses plain HTML5 <audio> (not Web
   Audio synthesis, unlike the chime/fanfare) because these are real
   music files the operator supplies.

   Two ways a track gets its source:
   1. A file the operator uploaded through Command Center -- either
      "Soundtrack Library" (splash intro / mission-complete loop) or
      "Page Backgrounds" (any content page's own ambient loop) --
      stored in IndexedDB (works on desktop and mobile, no file-system
      access needed, no server). This is checked first.
   2. Falls back to the bundled default at assets/audio/*.mp3 if one
      exists and nothing's been uploaded yet -- see
      assets/audio/READ_ME_AUDIO.txt. Page backgrounds have no bundled
      default at all (11 different tracks isn't something to ship) --
      they're silent until the operator assigns one.

   Three kinds of music:
   1. Splash intro  -- starts on the ENTER click (index.html), loops
      for as long as the operator stays on the splash/loading/login
      pages (this is a plain multi-page app, not a single-page app, so
      "continuing" across page loads is simulated by tracking a shared
      start time in sessionStorage and resuming each new page at the
      correct elapsed position). Only fades out once a page background
      (below) actually takes over on arrival at a real content page.
   2. Page backgrounds -- every real content page (Command Deck
      included -- it's no longer a special case) can carry its own
      quiet, looping ambient track, assigned per-page through Command
      Center's "Page Backgrounds" panel, on/off per page independently
      of the master Music toggle. aether-nav.js triggers this
      centrally on every page's arrival, so nothing has to wire it in
      one by one. Loops for as long as the operator stays on that
      page; naturally stops when the browser tears the page down on
      navigation -- no explicit "stop" needed between pages.
   3. Celebration loop -- starts right after the mission-complete
      chime, loops until the operator exits that screen.

   All of this is silent-safe: if a track file isn't there yet, or the
   browser blocks autoplay, playback just quietly doesn't happen --
   nothing else in the app depends on it.

   Usage (playback):
     AetherMusic.ensureSplashIntroPlaying() -- index.html (on load AND on ENTER), loading.html / login.html (on load)
     AetherMusic.playPageLoop(pageKey)   -- any content page, on load (via aether-nav.js)
     AetherMusic.stopPageLoop()
     AetherMusic.playCelebrationLoop()   -- aether-celebration.js, after the fanfare
     AetherMusic.stopLoop()              -- aether-celebration.js, on any exit
     AetherMusic.stopAll()               -- loading.html, on sign-out
     AetherMusic.duck() / unduck()       -- called automatically by aether-voice.js
     AetherMusic.isEnabled() / setEnabled(bool)                 -- master toggle
     AetherMusic.isPageMusicEnabled(pageKey) / setPageMusicEnabled(pageKey, bool) -- per-page toggle

   Usage (library, Command Center):
     AetherMusic.setCustomTrack(key, file) -> Promise
     AetherMusic.removeCustomTrack(key)    -> Promise
     AetherMusic.getCustomTrackInfo(key)   -> Promise<{name,size,savedAt}|null>
     AetherMusic.previewTrack(key, onEnded?) -- plays it once, for testing
     AetherMusic.stopPreview()
     AetherMusic.pageTrackKey(pageKey)   -- turns 'blueprints.html' into the actual storage key
     AetherMusic.TRACK_KEYS -- ['intro','celebrationLoop']  (the two fixed, non-page slots)
     AetherMusic.PAGE_KEYS  -- the 11 real content pages, in nav order
   ============================================================ */
(function(){
  'use strict';

  var TRACKS = {
    intro: 'assets/audio/intro.mp3',
    celebrationLoop: 'assets/audio/celebration-loop.mp3'
  };
  var TRACK_KEYS = Object.keys(TRACKS);

  /* Every real content page that can carry its own looping background
     track. No bundled default files for these -- entirely dependent
     on what's uploaded per-page through Command Center's "Page
     Backgrounds" panel. Silent (not broken) until something's
     assigned, same philosophy as everywhere else in this module. */
  var PAGE_KEYS = [
    'dashboard.html','life-advancement.html','missions.html','blueprints.html',
    'problems-blockers.html','evidence-vault.html','timeline.html','debrief.html',
    'knowledge-library.html','summit-archive.html','applications.html','command-center.html'
  ];

  /* Tune these to taste once the real files are in place. */
  var PAGE_BG_VOLUME = 0.28; // deliberately quieter than BASE_VOLUME -- this is meant to sit under everything else, not compete with it
  var SPLASH_FADE_DURATION_SEC = 2; // how long the splash/login loop takes to fade once it's told to stop
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

  /* ---- Per-page music on/off. Layered under the master toggle above:
     if AETHER Music is off globally, nothing plays regardless of these
     settings; if it's on, this list lets specific pages opt out (e.g.
     "no background music on Blueprints") without touching every other
     page. Off by default for nobody -- everything's on until the
     operator turns a specific page off. ---- */
  var PAGE_MUSIC_DISABLED_KEY = 'aetherPageMusicDisabled';
  function getDisabledPages(){
    try{ return JSON.parse(localStorage.getItem(PAGE_MUSIC_DISABLED_KEY) || '[]'); }catch(e){ return []; }
  }
  function isPageMusicEnabled(pageKey){
    if(!isEnabled()) return false;
    return getDisabledPages().indexOf(pageKey) === -1;
  }
  function setPageMusicEnabled(pageKey, on){
    var list = getDisabledPages();
    var idx = list.indexOf(pageKey);
    if(on && idx !== -1) list.splice(idx, 1);
    if(!on && idx === -1) list.push(pageKey);
    try{ localStorage.setItem(PAGE_MUSIC_DISABLED_KEY, JSON.stringify(list)); }catch(e){}
  }
  function pageTrackKey(pageKey){ return 'page:' + pageKey; }

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
    if(!key) return Promise.reject(new Error('missing track key'));
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
     bundled default path -- or null if there's neither (the normal
     case for a page background nobody's assigned a track to yet). */
  function resolveTrackURL(key){
    if(objectUrlCache[key]) return Promise.resolve(objectUrlCache[key]);
    return getCustomTrackRecord(key).then(function(record){
      if(record && record.blob){
        var url = URL.createObjectURL(record.blob);
        objectUrlCache[key] = url;
        return url;
      }
      return TRACKS[key] || null;
    }).catch(function(){ return TRACKS[key] || null; });
  }

  var activeEl = null;    // the currently playing intro track (for ducking + fade control)
  var loopEl = null;      // the celebration loop, tracked separately since it can overlap
  var pageLoopEl = null;  // the current page's ambient background loop
  var previewEl = null;   // Command Center's "test this track" playback
  var previewEndedCb = null; // fires when preview stops, however it stops
  var fadeTimer = null;

  function clearFadeTimer(){ if(fadeTimer){ clearInterval(fadeTimer); fadeTimer = null; } }

  /* Smoothly glides an element's volume to a target over durationMs,
     using requestAnimationFrame (syncs to the display refresh, so it
     reads as a genuine fade rather than a handful of audible steps).
     Replaces the old instant volume snap on duck/unduck -- THAT abrupt
     jump between full volume and quiet is what read as "choppy." Also
     used for the slow fade-outs (splash/dashboard intros ending). */
  function rampVolume(el, targetVol, durationMs, onDone){
    if(!el){ if(onDone) onDone(); return; }
    if(el._aetherRampId){ cancelAnimationFrame(el._aetherRampId); el._aetherRampId = null; }
    var startVol = el.volume;
    var startTime = null;
    function step(ts){
      if(startTime === null) startTime = ts;
      var t = Math.min(1, (ts - startTime) / durationMs);
      el.volume = startVol + (targetVol - startVol) * t;
      if(t < 1){
        el._aetherRampId = requestAnimationFrame(step);
      } else {
        el._aetherRampId = null;
        if(onDone) onDone();
      }
    }
    el._aetherRampId = requestAnimationFrame(step);
  }

  function fadeOutAndStop(el, durationMs){
    if(!el) return;
    rampVolume(el, 0, durationMs, function(){ try{ el.pause(); }catch(e){} });
  }

  function stopAll(){
    clearFadeTimer();
    if(activeEl){ try{ activeEl.pause(); }catch(e){} activeEl = null; }
    if(loopEl){ try{ loopEl.pause(); }catch(e){} loopEl = null; }
    if(pageLoopEl){ try{ pageLoopEl.pause(); }catch(e){} pageLoopEl = null; }
    stopPreview();
    try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  }

  /* ---- Splash intro: starts on ENTER, loops for as long as the
     operator is on the splash/login pages -- no fixed fade timer
     anymore, since a track fading out after a few seconds regardless
     of whether the person is still reading/signing in felt premature.
     It keeps playing (looping) across the loading screen and login
     page, and only fades out once playPageLoop() actually fires on
     arrival at a real content page -- see stopSplashLoop() below.
     Position is still tracked via elapsed real time across page loads
     so it feels continuous rather than restarting from 0 on every
     page.

     One function, safe to call from anywhere, any number of times:
     index.html calls it immediately on page load (so it starts the
     instant the splash screen appears, if the browser allows it),
     again on the ENTER click (a guaranteed real gesture, so if
     autoplay was blocked this is what actually starts it), and
     loading.html/login.html call it on their own load to keep it
     going. It's a no-op if something's already actively playing, so
     none of those calls step on each other or restart the track. ---- */
  function ensureSplashIntroPlaying(){
    if(!isEnabled()) return;
    if(activeEl && !activeEl.paused) return; // already going -- nothing to do

    var startTs;
    try{ startTs = parseInt(sessionStorage.getItem(SESSION_KEY), 10); }catch(e){}
    if(!startTs || isNaN(startTs)){
      startTs = Date.now();
      try{ sessionStorage.setItem(SESSION_KEY, String(startTs)); }catch(e){}
    }
    var elapsedSec = (Date.now() - startTs) / 1000;

    resolveTrackURL('intro').then(function(url){
      if(activeEl && !activeEl.paused) return; // a fallback call already won the race
      var el = new Audio(url);
      el.loop = true;
      el.volume = BASE_VOLUME;
      try{ el.currentTime = elapsedSec; }catch(e){} /* if this lands past the
        track's actual length (it's a loop, so that's expected once the
        person has lingered a while), the browser just clamps/wraps it --
        harmless, still sounds like a loop in progress either way. */
      el.play().catch(function(){ /* still blocked -- a later interaction will retry */ });
      activeEl = el;
    });
  }

  /* Fades out and stops whatever splash/login loop is currently
     playing, and stops tracking it -- called right when the Command
     Deck's own intro is about to take over. */
  function stopSplashLoop(){
    try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
    if(activeEl) fadeOutAndStop(activeEl, SPLASH_FADE_DURATION_SEC * 1000);
  }

  /* ---- Command Deck intro: a fresh, independent cue. Fades the
     splash loop out first, so the two don't overlap awkwardly. ---- */
  /* ---- Page background loops: every real content page (Command Deck
     included -- it's no longer a special case) can carry its own
     looping ambient track, quieter than the splash intro, that plays
     for as long as the operator stays on that page. No cross-page
     continuity needed here (unlike the splash intro) -- each page just
     starts its own assigned loop fresh, and it naturally stops when
     the browser tears down the page on navigation. aether-nav.js calls
     this centrally on every page so nothing has to wire it in one by
     one. Fades in gently rather than starting at full volume. ---- */
  function playPageLoop(pageKey){
    stopSplashLoop();
    if(!isPageMusicEnabled(pageKey)) return;
    resolveTrackURL(pageTrackKey(pageKey)).then(function(url){
      if(!url) return; // nothing assigned to this page yet -- silence, not an error
      var el = new Audio(url);
      el.loop = true;
      el.volume = 0;
      el.play().then(function(){
        rampVolume(el, PAGE_BG_VOLUME, 700);
      }).catch(function(){});
      pageLoopEl = el;
    });
  }
  function stopPageLoop(){
    if(pageLoopEl){ try{ pageLoopEl.pause(); }catch(e){} pageLoopEl = null; }
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
     for testing an upload before committing to it. onEnded (optional)
     fires both when the track finishes naturally AND when stopPreview()
     cuts it short -- lets the UI reset its "Stop" button back to
     "Preview" either way, instead of only handling one case. ---- */
  function previewTrack(key, onEnded){
    stopPreview();
    resolveTrackURL(key).then(function(url){
      if(!url){ if(onEnded) onEnded(); return; }
      var el = new Audio(url);
      el.volume = BASE_VOLUME;
      if(onEnded) el.addEventListener('ended', onEnded);
      el.play().catch(function(){});
      previewEl = el;
      previewEndedCb = onEnded || null;
    });
  }
  function stopPreview(){
    if(previewEl){
      try{ previewEl.pause(); }catch(e){}
      previewEl = null;
      if(previewEndedCb){ var cb = previewEndedCb; previewEndedCb = null; cb(); }
    }
  }

  /* ---- Ducking: called from aether-voice.js so background music
     doesn't fight with AETHER actually talking. Ramped, not snapped --
     an instant volume jump on every single spoken line is exactly what
     made the music sound "choppy." 160ms down, 260ms back up (a touch
     slower on the way back so it doesn't feel like it's rushing back
     in before the sentence has really finished landing). Remembers
     each element's own actual volume before ducking (not one shared
     assumption) since a page loop sits quieter than the splash/
     celebration tracks and restoring it to the louder level would
     leave it wrong afterward. ---- */
  function duck(){
    [activeEl, loopEl, pageLoopEl].forEach(function(el){
      if(!el) return;
      if(el._aetherPreDuckVol === undefined) el._aetherPreDuckVol = el.volume;
      rampVolume(el, DUCK_VOLUME, 160);
    });
  }
  function unduck(){
    [activeEl, loopEl, pageLoopEl].forEach(function(el){
      if(!el) return;
      var restoreVol = el._aetherPreDuckVol !== undefined ? el._aetherPreDuckVol : BASE_VOLUME;
      rampVolume(el, restoreVol, 260);
      delete el._aetherPreDuckVol;
    });
  }

  window.AetherMusic = {
    ensureSplashIntroPlaying: ensureSplashIntroPlaying,
    playPageLoop: playPageLoop,
    stopPageLoop: stopPageLoop,
    playCelebrationLoop: playCelebrationLoop,
    stopLoop: stopLoop,
    stopAll: stopAll,
    duck: duck,
    unduck: unduck,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    isPageMusicEnabled: isPageMusicEnabled,
    setPageMusicEnabled: setPageMusicEnabled,
    pageTrackKey: pageTrackKey,
    setCustomTrack: setCustomTrack,
    removeCustomTrack: removeCustomTrack,
    getCustomTrackInfo: getCustomTrackInfo,
    previewTrack: previewTrack,
    stopPreview: stopPreview,
    TRACK_KEYS: TRACK_KEYS,
    PAGE_KEYS: PAGE_KEYS
  };
})();
