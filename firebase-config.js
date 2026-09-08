// Firebase setup for merafe-stories
// This file connects our website to our Firebase project (auth + database)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDilukVWwJTWywaqQN6by4624V5moWs6vE",
  authDomain: "merafe-stories.firebaseapp.com",
  projectId: "merafe-stories",
  storageBucket: "merafe-stories.firebasestorage.app",
  messagingSenderId: "483601148364",
  appId: "1:483601148364:web:31f7a892d59f674c951569"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// These are the two tools we'll use throughout the site:
// auth = handles sign up / login
// db = handles storing and reading book data
export const auth = getAuth(app);

// On some networks, Firestore's normal connection method (WebSockets)
// struggles or times out, causing everything to feel slow (this is what
// caused the ~32 second delay we saw). Telling it to auto-detect and use
// long-polling instead skips that slow negotiation and connects reliably
// and faster on networks like this.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});