// Firebase setup for merafe-stories
// This file connects our website to our Firebase project (auth + database)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-lite.js";

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

// We use the "Lite" version of Firestore instead of the full SDK.
// Lite supports everything we actually use (one-time reads/writes via
// getDocs, addDoc, updateDoc, deleteDoc) but leaves out the real-time
// "live updates" engine we never use — a large chunk of the full SDK's
// size. It also uses simple one-time requests instead of a persistent
// connection, which sidesteps the slow-connection issue we ran into
// earlier with the full SDK on certain networks.
export const db = getFirestore(app);