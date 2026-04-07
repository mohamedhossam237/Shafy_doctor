import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBSxgaWL6KM3R1XGiI4YR3IHBnzVL75Ubc',
  authDomain: 'shafy-b0d78.firebaseapp.com',
  projectId: 'shafy-b0d78',
  storageBucket: 'shafy-b0d78.firebasestorage.app',
  messagingSenderId: '528676651672',
  appId: '1:528676651672:web:431081f31f9cad81b946ed',
};

// Initialize once
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth with persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
