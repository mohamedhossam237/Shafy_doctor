// /hooks/useUID.js
'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebase';

export default function useUID() {
  // undefined = loading, null = signed out, string = uid
  const [uid, setUid] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  return uid;
}
