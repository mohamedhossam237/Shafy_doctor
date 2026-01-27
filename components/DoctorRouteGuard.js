'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, getDocs, query, collection, where, limit as qLimit } from 'firebase/firestore';

export default function DoctorRouteGuard({ children }) {
  const { user } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // If there is no session yet, nothing to gate.
      if (!user) return; // Wait for auth to settle. If user is null, AuthProvider might still be loading or unauthed.
                         // Usually AuthProvider handles the "loading" state. 
                         // Assuming user object availability implies we can check role.
      if (!user.uid) return;

      const uid = user.uid;
      const email = (user.email || '').toLowerCase();

      try {
        // Check doctors/{uid}
        const byUid = await getDoc(doc(db, 'doctors', uid));
        let isDoctor = byUid.exists();

        // Fallback: doctors where email == user.email
        if (!isDoctor && email) {
          const snap = await getDocs(
            query(collection(db, 'doctors'), where('email', '==', email), qLimit(1))
          );
          isDoctor = !snap.empty;
        }

        if (!cancelled) {
            if (isDoctor) {
                setAuthorized(true);
            } else {
                // Not authorized
                await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
                const q = { ...router.query, lang: (router.query.lang || 'en') };
                router.replace({ pathname: '/login', query: q });
            }
        }
      } catch (e) {
        if (!cancelled) {
             console.error("Auth Guard Error", e);
             // Safety logout on error
             await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
             router.replace('/login');
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user, router]); // Dependency on user object

  if (!authorized) return null; // Or a loading spinner

  return <>{children}</>;
}
