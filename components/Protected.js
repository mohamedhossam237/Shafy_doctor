// /components/Protected.jsx
'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '@/providers/AuthProvider';

export default function Protected({ children }) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      routerRef.current.replace('/login');
    }
  }, [loading, user]);

  if (loading) {
    return (
      <Box className="shafy-canvas" sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress size={32} sx={{ color: '#2563eb' }} />
      </Box>
    );
  }

  if (!user) return null;

  return children;
}
