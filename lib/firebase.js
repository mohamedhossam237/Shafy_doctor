// Firebase (modular SDK)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


// === Your provided web config ===
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


export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);


// Initialize Analytics only on client + only if supported
export async function initAnalytics() {
if (typeof window === 'undefined') return null; // SSR guard
try {
const { getAnalytics, isSupported } = await import('firebase/analytics');
const ok = await isSupported();
return ok ? getAnalytics(app) : null;
} catch (e) {
// In unsupported envs (SSR, some browsers/extensions), just ignore
return null;
}
}