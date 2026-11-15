// 1) Paste your Firebase web app config here (Firebase console → Project settings → Your apps).
//    These values are meant to be public; the security lives in firestore.rules.
//    While apiKey is empty the site runs in preview mode and saves only to this browser.
export const firebaseConfig = {
  apiKey: "AIzaSyAoHuZWEkDJ3O22NnY5jmy1WROM6lxjURk",
  authDomain: "evergleam-c91f7.firebaseapp.com",
  projectId: "evergleam-c91f7",
  storageBucket: "evergleam-c91f7.firebasestorage.app",
  messagingSenderId: "207989531381",
  appId: "1:207989531381:web:8f95a98c2c98a616139bbc",
};

// 2) When messages unlock. Midnight on Christmas morning, Vancouver time.
//    If you change this, change the matching line in firestore.rules too.
export const UNLOCK_AT = "2026-12-25T00:00:00+08:00";
