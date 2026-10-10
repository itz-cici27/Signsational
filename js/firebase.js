// Firebase authentication and cloud sync.
// Progress stays in localStorage by default; signing in also syncs to Firestore.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, signInWithPopup, GoogleAuthProvider,
  onAuthStateChanged, signOut as fbSignOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBp8bDKhDos-lvNixgfZM6DDpQQYQ2iQxM",
  authDomain: "signsational-2026.firebaseapp.com",
  projectId: "signsational-2026",
  storageBucket: "signsational-2026.firebasestorage.app",
  messagingSenderId: "44961153989",
  appId: "1:44961153989:web:d70c472b2c86478fc581ac",
});

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export function signIn() {
  return signInWithPopup(auth, provider);
}

export function signOutUser() {
  return fbSignOut(auth);
}

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

export function currentUser() {
  return auth.currentUser;
}

export async function saveToCloud(progress, shopData) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, "users", user.uid), { progress, shop: shopData }, { merge: true });
  } catch (err) {
    console.error("Cloud save failed:", err);
  }
}

export async function loadFromCloud() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Cloud load failed:", err);
    return null;
  }
}
