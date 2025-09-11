// /components/Protected.jsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '@/providers/AuthProvider';

export default function Protected({ children }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // During redirect, render nothing (prevents spinner getting “stuck”)
  if (!user) return null;

  return children;
}
