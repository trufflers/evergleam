// 1) Paste your Firebase web app config here (Firebase console → Project settings → Your apps).
//    These values are meant to be public; the security lives in firestore.rules.
//    While apiKey is empty the site runs in preview mode and saves only to this browser.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// 2) When messages unlock. Midnight on Christmas morning, Vancouver time.
//    If you change this, change the matching line in firestore.rules too.
export const UNLOCK_AT = "2026-12-25T00:00:00-08:00";
