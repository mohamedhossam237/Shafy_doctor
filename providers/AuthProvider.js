// /providers/AuthProvider.jsx
'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
} from 'firebase/auth';

const AuthCtx = createContext({
  user: null,
  loading: true,
  emailLogin: async (_e, _p) => {},
  googleLogin: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      emailLogin: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
      googleLogin: () => signInWithPopup(auth, googleProvider),
      signOut: () => fbSignOut(auth),
    }),
    [user, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
