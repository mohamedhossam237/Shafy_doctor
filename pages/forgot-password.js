'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { Container, Paper, Stack, TextField, Typography, Button, Snackbar, Alert } from '@mui/material';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (m, s = 'info') => setSnack({ open: true, message: m, severity: s });

  const sendLink = async (e) => {
    e.preventDefault();
    if (!email) return openSnack(isArabic ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email', 'warning');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      openSnack(isArabic ? 'تم إرسال رابط إعادة التعيين' : 'Reset link sent', 'success');
      setTimeout(() => router.replace(`/login${isArabic ? '?lang=ar' : ''}`), 800);
    } catch (e) {
      const msg = e?.code === 'auth/user-not-found'
        ? (isArabic ? 'البريد الإلكتروني غير مسجل' : 'Email not found')
        : (isArabic ? 'حدث خطأ' : 'An error occurred');
      openSnack(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2} component="form" onSubmit={sendLink}>
          <Typography variant="h5" fontWeight={700}>
            {isArabic ? 'نسيت كلمة المرور' : 'Forgot Password'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isArabic ? 'أدخل بريدك الإلكتروني لتلقي رابط إعادة التعيين' : 'Enter your email to receive a reset link'}
          </Typography>
          <TextField
            label={isArabic ? 'البريد الإلكتروني' : 'Email'}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" disabled={loading} sx={{ py: 1.2, borderRadius: 2 }}>
            {loading ? (isArabic ? 'جارٍ الإرسال...' : 'Sending...') : (isArabic ? 'إرسال الرابط' : 'Send Link')}
          </Button>
        </Stack>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}