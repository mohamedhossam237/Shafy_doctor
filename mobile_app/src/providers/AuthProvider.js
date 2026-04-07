import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

const AuthContext = createContext({
  user: null,
  loading: true,
  emailLogin: async (email, pass) => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    emailLogin: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
    signOut: () => fbSignOut(auth),
  }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
