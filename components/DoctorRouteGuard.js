'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc, getDocs, query, collection, where, limit as qLimit } from 'firebase/firestore';
import { Box, CircularProgress, Typography } from '@mui/material';
import globalCache, { readSessionCache, writeSessionCache } from '@/lib/cache';

// Deduplicate concurrent auth guard checks for the same UID
const inFlightVerify = new Map();

async function verifyDoctorUid(uid, email) {
  if (inFlightVerify.has(uid)) {
    return inFlightVerify.get(uid);
  }

  const promise = (async () => {
    const byUid = await getDoc(doc(db, 'doctors', uid));
    if (byUid.exists()) {
      return { ok: true, profile: { _uid: uid, ...byUid.data() } };
    }

    if (email) {
      const snap = await getDocs(
        query(collection(db, 'doctors'), where('email', '==', email), qLimit(1))
      );
      if (!snap.empty) {
        return { ok: true, profile: { _uid: uid, ...snap.docs[0].data() } };
      }
    }

    return { ok: false, profile: null };
  })().finally(() => {
    inFlightVerify.delete(uid);
  });

  inFlightVerify.set(uid, promise);
  return promise;
}

export default function DoctorRouteGuard({ children }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const routerRef = React.useRef(router);
  routerRef.current = router;

  // Synchronous instant authorization if already verified in memory or sessionStorage
  const isAlreadyVerified = React.useMemo(() => {
    if (!user?.uid) return false;
    if (globalCache.authorizedUid === user.uid) return true;
    const cachedAuth = readSessionCache(`auth_ok_${user.uid}`, 30 * 60 * 1000);
    if (cachedAuth?.ok) {
      globalCache.authorizedUid = user.uid;
      if (cachedAuth.profile && !globalCache.doctorProfile) {
        globalCache.doctorProfile = cachedAuth.profile;
      }
      return true;
    }
    return false;
  }, [user?.uid]);

  const [authorized, setAuthorized] = React.useState(isAlreadyVerified);
  const [guardLoading, setGuardLoading] = React.useState(!isAlreadyVerified);

  React.useEffect(() => {
    if (isAlreadyVerified) {
      setAuthorized(true);
      setGuardLoading(false);
    }
  }, [isAlreadyVerified]);

  React.useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setAuthorized(false);
      setGuardLoading(false);
      const q = { ...routerRef.current.query, lang: routerRef.current.query?.lang || 'ar' };
      routerRef.current.replace({ pathname: '/login', query: q });
      return;
    }

    // Already verified for this session: zero network wait & zero loading flash!
    if (globalCache.authorizedUid === user.uid) {
      setAuthorized(true);
      setGuardLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setGuardLoading(true);
      const uid = user.uid;
      const email = (user.email || '').toLowerCase();

      try {
        const result = await verifyDoctorUid(uid, email);

        if (!cancelled) {
          if (result.ok) {
            globalCache.authorizedUid = uid;
            if (result.profile) {
              globalCache.doctorProfile = result.profile;
            }
            writeSessionCache(`auth_ok_${uid}`, { ok: true, profile: result.profile });
            setAuthorized(true);
          } else {
            globalCache.clear();
            await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
            const q = { ...routerRef.current.query, lang: routerRef.current.query?.lang || 'ar' };
            routerRef.current.replace({ pathname: '/login', query: q });
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Auth Guard Error', e);
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          routerRef.current.replace('/login');
        }
      } finally {
        if (!cancelled) {
          setGuardLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, user?.email, authLoading]);

  if (authLoading || (user && guardLoading && !authorized)) {
    return (
      <Box
        className="shafy-canvas"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2.5,
        }}
      >
        <Box
          sx={{
            width: 68,
            height: 68,
            borderRadius: '20px',
            background: '#ffffff',
            border: '1.5px solid #bfdbfe',
            boxShadow: '0 14px 32px -8px rgba(37, 99, 235, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img src="/logo.png" alt="Shafy" style={{ width: '78%', height: '78%', objectFit: 'contain' }} />
        </Box>
        <CircularProgress size={32} thickness={4} sx={{ color: '#2563eb' }} />
        <Typography variant="body2" sx={{ color: '#475569', fontWeight: 700 }}>
          جارٍ تحميل بوابة الطبيب...
        </Typography>
      </Box>
    );
  }

  if (!authorized) return null;

  return <>{children}</>;
}
