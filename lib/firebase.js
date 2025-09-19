// /lib/firebase.js

// Firebase (modular SDK)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// === Your provided web config ===
// NOTE: storageBucket usually looks like "<project-id>.appspot.com".
// You’ve set 'shafy-b0d78.firebasestorage.app' — keep it as-is if that’s intentional.
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
export const db = getFirestore(app);

// Storage export (SSR-safe)
// On the server, this will be null; on the client it will be an initialized instance.
// If a caller needs to be certain, use ensureStorage() below.
export const storage = typeof window !== 'undefined' ? getStorage(app) : null;
export function ensureStorage() {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Storage is only available in the browser.');
  }
  return getStorage(app);
}

// Initialize Analytics only on client + only if supported
export async function initAnalytics() {
  if (typeof window === 'undefined') return null; // SSR guard
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics');
    const ok = await isSupported();
    return ok ? getAnalytics(app) : null;
  } catch {
    // In unsupported envs (SSR, some browsers/extensions), just ignore
    return null;
  }
}

export default app;
