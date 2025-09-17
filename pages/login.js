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
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';

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

  // ---- role gate helpers ----
  const existsByUid = async (coll, uid) => {
    if (!uid) return { exists: false, data: null };
    const s = await getDoc(doc(db, coll, uid));
    return { exists: s.exists(), data: s.exists() ? s.data() : null };
  };
  const existsByEmail = async (coll, em) => {
    if (!em) return { exists: false, data: null };
    const qy = query(collection(db, coll), where('email', '==', em), limit(1));
    const s = await getDocs(qy);
    if (s.empty) return { exists: false, data: null };
    const d = s.docs[0];
    return { exists: true, data: d.data() };
  };

  /** Doctor-only gate:
   *  allow only if in doctors (uid OR email) AND NOT in patients/assistants (uid/email).
   *  If you prefer to allow doctors even if they also exist as patient/assistant,
   *  set REQUIRE_EXCLUSIVE_ROLE to false.
   */
  const REQUIRE_EXCLUSIVE_ROLE = true;

  const isDoctorOnly = async (uid, emRaw) => {
    const em = (emRaw || '').toLowerCase();

    const [
      dUid, dEmail,
      pUid, pEmail,
      aUid, aEmail,
    ] = await Promise.all([
      existsByUid('doctors', uid), existsByEmail('doctors', em),
      existsByUid('patients', uid), existsByEmail('patients', em),
      existsByUid('assistants', uid), existsByEmail('assistants', em),
    ]);

    const doctorPresent = dUid.exists || dEmail.exists;
    const doctorData = dUid.data || dEmail.data || null;

    const patientPresent = pUid.exists || pEmail.exists;
    const assistantPresent = aUid.exists || aEmail.exists;

    if (!doctorPresent) {
      return { ok: false, reason: patientPresent ? 'patient' : assistantPresent ? 'assistant' : 'unknown', doctorData: null };
    }
    if (REQUIRE_EXCLUSIVE_ROLE && (patientPresent || assistantPresent)) {
      return { ok: false, reason: patientPresent ? 'patient' : 'assistant', doctorData };
    }
    return { ok: true, reason: null, doctorData };
  };

  const signIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      openSnack(isArabic ? 'يرجى ملء جميع الحقول' : 'Please fill all fields', 'warning');
      return;
    }
    setLoading(true);
    try {
      const cred = await emailLogin(email.trim().toLowerCase(), password.trim());
      const uid = cred?.user?.uid;
      const em = cred?.user?.email || email.trim().toLowerCase();

      // role gate
      const gate = await isDoctorOnly(uid, em);
      if (!gate.ok) {
        await signOut().catch(() => {});
        const msg =
          gate.reason === 'patient'
            ? (isArabic ? 'هذا الحساب مخصص للمريض، غير مسموح بالدخول هنا.' : 'This account is a patient account; access is not allowed here.')
            : gate.reason === 'assistant'
              ? (isArabic ? 'هذا الحساب مخصص للمساعد، غير مسموح بالدخول هنا.' : 'This account is an assistant account; access is not allowed here.')
              : (isArabic ? 'لا يوجد حساب طبيب مرتبط بهذه المعلومات.' : 'No doctor account found for these credentials.');
        openSnack(msg, 'error');
        return;
      }

      const isProfileCompleted = gate.doctorData?.profileCompleted === true;
      router.replace(isProfileCompleted ? '/' : '/doctor/details');
    } catch (e2) {
      const code = e2?.code;
      let msg = isArabic ? 'فشل تسجيل الدخول' : 'Login failed';
      if (code === 'auth/invalid-email') msg = isArabic ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
      else if (code === 'auth/user-not-found') msg = isArabic ? 'المستخدم غير موجود' : 'User not found';
      else if (code === 'auth/wrong-password') msg = isArabic ? 'كلمة المرور غير صحيحة' : 'Incorrect password';
      else if (e2?.message) msg = `${isArabic ? 'فشل تسجيل الدخول' : 'Login failed'}: ${e2.message}`;
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
