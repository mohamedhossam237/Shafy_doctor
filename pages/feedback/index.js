// /pages/feedback/index.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box, Container, Paper, Stack, Typography, TextField, Button, Snackbar, Alert
} from '@mui/material';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';

export default function FeedbackPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isArabic, setIsArabic] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  React.useEffect(() => {
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    else setIsArabic(true);
  }, [router?.query]);

  const label = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const [form, setForm] = React.useState({ subject: '', message: '' });

  const submit = async () => {
    if (!user?.uid) return;
    if (!form.subject.trim() || !form.message.trim()) {
      setSnack({ open: true, severity: 'warning', msg: label('Please fill all fields.', 'يرجى ملء جميع الحقول.') });
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        doctorUID: user.uid,
        subject: form.subject.trim(),
        message: form.message.trim(),
        createdAt: serverTimestamp(),
      });
      setForm({ subject: '', message: '' });
      setSnack({ open: true, severity: 'success', msg: label('Thanks for the feedback!', 'شكراً لملاحظاتك!') });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: label('Submission failed.', 'فشل الإرسال.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Protected>
      <AppLayout>
        <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
          <Container maxWidth="sm" sx={{ py: 2 }}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={1}>
                <Stack direction={isArabic ? 'row-reverse' : 'row'} alignItems="center" spacing={1}>
                  <RateReviewRoundedIcon color="primary" />
                  <Typography variant="h5" fontWeight={900}>
                    {label('Feedback', 'ملاحظات')}
                  </Typography>
                </Stack>

                <TextField
                  label={label('Subject', 'العنوان')}
                  fullWidth
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
                <TextField
                  label={label('Message', 'الرسالة')}
                  fullWidth
                  multiline
                  minRows={4}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />

                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
                  <Button variant="contained" onClick={submit} disabled={submitting} sx={{ borderRadius: 2 }}>
                    {submitting ? label('Sending...', 'جارٍ الإرسال...') : label('Send', 'إرسال')}
                  </Button>
                  <Button variant="outlined" onClick={() => setForm({ subject: '', message: '' })} sx={{ borderRadius: 2 }}>
                    {label('Clear', 'مسح')}
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Container>

          <Snackbar
            open={snack.open}
            autoHideDuration={3000}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} variant="filled">
              {snack.msg}
            </Alert>
          </Snackbar>
        </Box>
      </AppLayout>
    </Protected>
  );
}
