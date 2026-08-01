/* =========================================================
   AETHER — Firestore Sync Bridge
   -----------------------------------------------------------
   This is the actual Step 10/11 engine. It does NOT rewrite
   campaignStore.js's 1,500 lines of mission/blueprint/evidence
   logic. Instead it sits underneath localStorage itself:

     - READ side:  once per browser session, pulls the signed-in
                    operator's data down from Firestore into
                    localStorage before the page's own scripts
                    run, then reloads once so every page renders
                    with the synced data.
     - WRITE side: every localStorage.setItem/removeItem call for
                    an "aether_" key is mirrored to Firestore in
                    the background (debounced), completely
                    transparent to campaignStore.js.
     - OFFLINE:    localStorage is always written first and is
                    the source of truth for the current tab. If
                    Firestore is unreachable, the write is queued
                    and retried — the app keeps working normally.

   Firestore layout: users/{uid}/aether_kv/{key} -> { value, updatedAt }
   Matches the security rule already published: owner-only access.
   ========================================================= */

import { auth, db } from './firebase-config.js';
import {
  collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const _origSetItem   = Storage.prototype.setItem;
const _origRemoveItem = Storage.prototype.removeItem;

const PENDING_KEY = 'aether_sync_pending';
const HYDRATED_FLAG = 'aether_hydrated_session';
let debounceTimers = {};

function isAetherKey(key){
  return typeof key === 'string' && key.indexOf('aether_') === 0 &&
    key !== HYDRATED_FLAG && key !== PENDING_KEY;
}

function loadPendingQueue(){
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || '{}'); }
  catch(e){ return {}; }
}
function savePendingQueue(q){
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(q)); } catch(e){}
}

function queueWrite(uid, key, value){
  const q = loadPendingQueue();
  if (value === null) { q[key] = { deleted: true }; }
  else { q[key] = { value: value }; }
  savePendingQueue(q);

  clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(() => flushKey(uid, key), 500);
}

function flushKey(uid, key){
  const q = loadPendingQueue();
  const entry = q[key];
  if (!entry) return;
  const ref = doc(db, 'users', uid, 'aether_kv', key);

  const done = () => {
    const q2 = loadPendingQueue();
    delete q2[key];
    savePendingQueue(q2);
  };

  if (entry.deleted) {
    deleteDoc(ref).then(done).catch(() => {/* stays queued, retried on next flushAll() */});
  } else {
    setDoc(ref, { value: entry.value, updatedAt: serverTimestamp() })
      .then(done)
      .catch(() => {/* stays queued, retried on next flushAll() */});
  }
}

function flushAll(uid){
  const q = loadPendingQueue();
  Object.keys(q).forEach((key) => flushKey(uid, key));
}

/* Installs the write-through bridge. Safe to call every page load —
   idempotent, only patches once per tab. */
function installWriteBridge(uid){
  if (Storage.prototype.setItem.__aetherPatched) return;

  Storage.prototype.setItem = function(key, value){
    _origSetItem.call(this, key, value);
    if (this === localStorage && isAetherKey(key)) queueWrite(uid, key, value);
  };
  Storage.prototype.setItem.__aetherPatched = true;

  Storage.prototype.removeItem = function(key){
    _origRemoveItem.call(this, key);
    if (this === localStorage && isAetherKey(key)) queueWrite(uid, key, null);
  };

  // Try to flush anything left over from a previous tab/session that
  // didn't get a chance to sync (e.g. was offline).
  flushAll(uid);
  window.addEventListener('online', () => flushAll(uid));
}

/* Pulls the operator's cloud data down into localStorage. Only runs
   once per browser session (sessionStorage flag) so page-to-page
   navigation stays fast — this is the fix for the earlier per-page
   Firebase lag, since only the FIRST page of a session pays the cost. */
function hydrateFromCloud(uid){
  return getDocs(collection(db, 'users', uid, 'aether_kv')).then((snap) => {
    if (snap.empty) {
      // Brand-new account, or first time this device has ever synced.
      // Seed the cloud with whatever is already sitting in localStorage
      // (e.g. the operator's existing local AETHER data) rather than
      // silently discarding it.
      let seeded = false;
      for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if (isAetherKey(k)) { queueWrite(uid, k, localStorage.getItem(k)); seeded = true; }
      }
      return { changed: false, seeded };
    }

    let changed = false;
    snap.forEach((docSnap) => {
      const key = docSnap.id;
      const cloudValue = docSnap.data().value;
      const localValue = localStorage.getItem(key);
      if (cloudValue !== localValue) {
        _origSetItem.call(localStorage, key, cloudValue);
        changed = true;
      }
    });
    return { changed, seeded: false };
  });
}

export function initFirestoreSync(user){
  installWriteBridge(user.uid);

  if (sessionStorage.getItem(HYDRATED_FLAG) === user.uid) {
    // Already hydrated once this session — skip straight to reveal.
    return Promise.resolve();
  }

  return hydrateFromCloud(user.uid).then((result) => {
    sessionStorage.setItem(HYDRATED_FLAG, user.uid);
    if (result.changed) {
      // Local data changed under us — reload once so every page
      // controller script renders with the freshly-synced data.
      window.location.reload();
      return new Promise(() => {}); // hang here; reload is already in flight
    }
  });
}
