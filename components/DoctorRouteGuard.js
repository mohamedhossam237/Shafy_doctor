'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, getDocs, query, collection, where, limit as qLimit } from 'firebase/firestore';
import { Box, CircularProgress } from '@mui/material';

export default function DoctorRouteGuard({ children }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = React.useState(false);
  const [guardLoading, setGuardLoading] = React.useState(true);

  React.useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // If there is no session, redirect to login page immediately
      const q = { ...router.query, lang: (router.query.lang || 'en') };
      router.replace({ pathname: '/login', query: q });
      return;
    }

    let cancelled = false;
    const run = async () => {
      setGuardLoading(true);
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
      } finally {
        if (!cancelled) {
          setGuardLoading(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user, authLoading, router]);

  if (authLoading || (user && guardLoading && !authorized)) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}
