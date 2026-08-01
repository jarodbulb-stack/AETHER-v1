/* =========================================================
   AETHER — Auth Guard + Firestore Sync
   -----------------------------------------------------------
   Include on every protected page (all 12 data pages), right
   after firebase-config.js. Checks the real Firebase session:

     - No one signed in  -> redirect to login.html immediately
     - Signed in         -> sync with Firestore (see
                             firestore-sync.js — Step 10/11),
                             then reveal the page (it was hidden
                             by the inline anti-flash snippet in
                             <head> so a stranger can't see a
                             flash of your data before the
                             redirect kicks in)

   Firebase caches the last-known auth state locally, so on
   repeat visits this resolves almost instantly — it only feels
   slow on the very first check after opening the browser.
   ========================================================= */

import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { initFirestoreSync } from './firestore-sync.js';

onAuthStateChanged(auth, (user) => {
  if (!user) {
    const here = encodeURIComponent(location.pathname.split('/').pop());
    window.location.href = 'login.html?redirect=' + here;
    return;
  }
  initFirestoreSync(user).then(() => {
    // Signed in and synced — reveal the page that the inline snippet hid.
    document.documentElement.classList.remove('aether-auth-pending');
  }).catch(() => {
    // Sync failed (e.g. offline) — still reveal so the operator can keep
    // working from local data rather than being stuck on a blank screen.
    document.documentElement.classList.remove('aether-auth-pending');
  });
});
