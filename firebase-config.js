/* =========================================================
   AETHER — Firebase Configuration
   -----------------------------------------------------------
   Connects AETHER to its own Firebase project (aether-1e974),
   completely separate from PRISM's project (carent-c4017).

   This file uses the Firebase Modular SDK loaded via CDN —
   no npm, no build step, matches AETHER's plain static-file
   architecture so it keeps working exactly as-is on GitHub
   Pages.

   Include this AFTER the Firebase CDN <script> tags, and
   BEFORE any page script that needs `auth` or `db` (login.html,
   aether-nav.js, campaignStore.js, etc).
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCi8f3GB8u9CkIKiE_lGhBWy3QMKfPx6lo",
  authDomain: "aether-1e974.firebaseapp.com",
  projectId: "aether-1e974",
  storageBucket: "aether-1e974.firebasestorage.app",
  messagingSenderId: "851622260271",
  appId: "1:851622260271:web:675e6fbde0c0ac7a3fa0da"
};

const app = initializeApp(firebaseConfig);

// Exported so every page can import { auth, db } from './firebase-config.js'
export const auth = getAuth(app);
export const db = getFirestore(app);
