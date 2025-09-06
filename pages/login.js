// /pages/login.js
'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Box,
  Stack,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LockOutlined from '@mui/icons-material/LockOutlined';

import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const router = useRouter();
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';

  const { emailLogin, signOut } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (message, severity = 'info') => setSnack({ open: true, message, severity });

  const signIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      openSnack(isArabic ? 'يرجى ملء جميع الحقول' : 'Please fill all fields', 'warning');
      return;
    }
    setLoading(true);
    try {
      const cred = await emailLogin(email.trim(), password.trim());
      const uid = cred?.user?.uid;

      const dSnap = await getDoc(doc(db, 'doctors', uid));
      if (!dSnap.exists()) {
        await signOut();
        openSnack(isArabic ? 'المستخدم ليس طبيبًا' : 'User is not a doctor', 'error');
        return;
      }

      const isProfileCompleted = dSnap.data()?.profileCompleted === true;
      router.replace(isProfileCompleted ? '/' : '/doctor/details');
    } catch (e) {
      const code = e?.code;
      let msg = isArabic ? 'فشل تسجيل الدخول' : 'Login failed';
      if (code === 'auth/invalid-email') msg = isArabic ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
      else if (code === 'auth/user-not-found') msg = isArabic ? 'المستخدم غير موجود' : 'User not found';
      else if (code === 'auth/wrong-password') msg = isArabic ? 'كلمة المرور غير صحيحة' : 'Incorrect password';
      else if (e?.message) msg = `${isArabic ? 'فشل تسجيل الدخول' : 'Login failed'}: ${e.message}`;
      openSnack(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Clean white full-page background with centered form
    <Box sx={{ minHeight: '100vh', bgcolor: 'white', display: 'grid', placeItems: 'center' }}>
      <Stack spacing={3} component="form" onSubmit={signIn} sx={{ width: '100%', maxWidth: 400 }}>
        <Stack alignItems="center" spacing={1}>
          <Box
            component="img"
            src="/logo.png"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            alt="logo"
            sx={{ width: 120, height: 120, objectFit: 'contain' }}
          />
          <LockOutlined color="primary" />
          <Typography variant="h5" fontWeight={700}>
            {isArabic ? 'تسجيل الدخول' : 'Sign In'}
          </Typography>
        </Stack>

        <TextField
          label={isArabic ? 'البريد الإلكتروني' : 'Email'}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label={isArabic ? 'كلمة المرور' : 'Password'}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPassword((v) => !v)} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" justifyContent="flex-end">
          <Link href={`/forgot-password${isArabic ? '?lang=ar' : ''}`} style={{ textDecoration: 'none' }}>
            <Typography color="primary" fontWeight={700}>
              {isArabic ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
            </Typography>
          </Link>
        </Stack>

        <Button type="submit" variant="contained" disabled={loading} sx={{ py: 1.2, borderRadius: 2 }}>
          {loading ? (isArabic ? 'جارٍ الدخول...' : 'Signing in...') : (isArabic ? 'تسجيل الدخول' : 'Sign In')}
        </Button>
      </Stack>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
