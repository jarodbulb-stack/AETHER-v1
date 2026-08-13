/* ============================================================
   AETHER — HERO BACKGROUND LIBRARY
   A small library of the operator's own photos for the Command Deck
   hero -- real cinematic mountain photography instead of the
   procedural SVG mountain, which never looked "epic" no matter how
   it was tuned, and which had its own separate bug: it picked
   whichever mission had the highest progress to visualize, which
   could silently stay locked on an already-completed mission even
   after a new one became Today's Command. Real photos sidestep both
   problems at once -- what's shown rotates on its own daily schedule,
   completely decoupled from which mission is actually active, so
   there's nothing for it to get "stuck" on.

   Storage: IndexedDB, same technique as aether-music.js's custom
   track library -- images as Blobs, resolved to object URLs on
   demand. Local to this device on purpose (not "aether_"-prefixed,
   not synced) -- these are large binary files with no reason to
   round-trip through Firestore, same reasoning as uploaded music.

   Rotation: deterministic by calendar day, not random -- day-of-year
   modulo however many images exist, so it's the same photo all day
   for a consistent look, and it's a real rotation through the whole
   set rather than a coin-flip that could repeat the same photo
   two days running.

   Usage:
     AetherHeroBg.addImage(file)      -> Promise<{id,name,size}>
     AetherHeroBg.removeImage(id)     -> Promise
     AetherHeroBg.listImages()        -> Promise<[{id,name,size,addedAt}]>
     AetherHeroBg.getTodaysImageURL() -> Promise<url|null>
     AetherHeroBg.previewURL(id)      -> Promise<url|null>
   ============================================================ */
(function(){
  'use strict';

  var DB_NAME = 'aetherHeroBgLibrary';
  var STORE_NAME = 'images';
  var dbPromise = null;

  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise = new Promise(function(resolve, reject){
      if(!('indexedDB' in window)){ reject(new Error('IndexedDB unavailable')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(){
        var db = req.result;
        if(!db.objectStoreNames.contains(STORE_NAME)){
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
    return dbPromise;
  }

  function genId(){ return 'bg_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  function addImage(file){
    if(!file) return Promise.reject(new Error('no file'));
    return openDB().then(function(db){
      return new Promise(function(resolve, reject){
        var record = { id: genId(), name: file.name || 'background', size: file.size || 0, addedAt: Date.now(), blob: file };
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = function(){ resolve({ id: record.id, name: record.name, size: record.size }); };
        tx.onerror = function(){ reject(tx.error); };
      });
    });
  }

  function removeImage(id){
    return openDB().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ reject(tx.error); };
      });
    });
  }

  function listImages(){
    return openDB().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = function(){
          var records = (req.result || []).map(function(r){ return { id: r.id, name: r.name, size: r.size, addedAt: r.addedAt }; });
          records.sort(function(a,b){ return a.addedAt - b.addedAt; }); /* stable order = stable rotation sequence */
          resolve(records);
        };
        req.onerror = function(){ reject(req.error); };
      });
    });
  }

  function getRecord(id){
    return openDB().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = function(){ resolve(req.result || null); };
        req.onerror = function(){ reject(req.error); };
      });
    });
  }

  var objectUrlCache = {};
  function urlFor(id, blob){
    if(objectUrlCache[id]) return objectUrlCache[id];
    var url = URL.createObjectURL(blob);
    objectUrlCache[id] = url;
    return url;
  }

  function dayOfYear(){
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var diff = now - start;
    return Math.floor(diff / 86400000);
  }

  /* The same photo all day, a real rotation through the whole set day
     to day, order fixed by upload order so it's predictable rather
     than shuffled. */
  function getTodaysImageURL(){
    return listImages().then(function(images){
      if(!images.length) return null;
      var idx = dayOfYear() % images.length;
      var chosen = images[idx];
      return getRecord(chosen.id).then(function(record){
        if(!record || !record.blob) return null;
        return urlFor(record.id, record.blob);
      });
    }).catch(function(){ return null; });
  }

  function previewURL(id){
    return getRecord(id).then(function(record){
      if(!record || !record.blob) return null;
      return urlFor(record.id, record.blob);
    }).catch(function(){ return null; });
  }

  window.AetherHeroBg = {
    addImage: addImage,
    removeImage: removeImage,
    listImages: listImages,
    getTodaysImageURL: getTodaysImageURL,
    previewURL: previewURL
  };
})();
