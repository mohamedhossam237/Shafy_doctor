// /lib/firebase.js

// Firebase (modular SDK)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBSxgaWL6KM3R1XGiI4YR3IHBnzVL75Ubc',
  authDomain: 'shafy-b0d78.firebaseapp.com',
  projectId: 'shafy-b0d78',
  storageBucket: 'shafy-b0d78.firebasestorage.app',
  messagingSenderId: '528676651672',
  appId: '1:528676651672:web:431081f31f9cad81b946ed',
  measurementId: 'G-MXBF5HMSNY',
};

// Initialize once
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Core exports
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with multi-tab IndexedDB persistent cache FIRST in browser
// (Calling getFirestore first would silently create an in-memory-only instance)
let firestoreInstance;
if (typeof window !== 'undefined') {
  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    firestoreInstance = getFirestore(app);
  }
} else {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

// Storage export (SSR-safe)
export const storage = typeof window !== 'undefined' ? getStorage(app) : null;
export function ensureStorage() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Storage is only available in the browser.');
  }
  return getStorage(app);
}

// Initialize Analytics only on client + only if supported
export async function initAnalytics() {
  if (typeof window === 'undefined') return null;
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    const ok = await isSupported();
    return ok ? getAnalytics(app) : null;
  } catch {
    return null;
  }
}

export default app;
