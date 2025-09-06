// /pages/data/index.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box, Container, Paper, Stack, Typography, Button, Divider, Snackbar, Alert
} from '@mui/material';
import PrivacyTipRoundedIcon from '@mui/icons-material/PrivacyTipRounded';
import CloudDownloadRoundedIcon from '@mui/icons-material/CloudDownloadRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';

export default function DataPrivacyPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [isArabic, setIsArabic] = React.useState(true);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });
  const [downloading, setDownloading] = React.useState(false);

  React.useEffect(() => {
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    else setIsArabic(true);
  }, [router?.query]);

  const label = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const downloadData = async () => {
    if (!user?.uid) return;
    setDownloading(true);
    try {
      const doctorUID = user.uid;
      const [patientsSnap, apptsSnap, reportsSnap] = await Promise.all([
        getDocs(query(collection(db, 'patients'), where('registeredBy', '==', doctorUID))),
        getDocs(query(collection(db, 'appointments'), where('doctorUID', '==', doctorUID))),
        getDocs(query(collection(db, 'clinic_reports'), where('doctorUID', '==', doctorUID))),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        doctorUID,
        patients: patientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        appointments: apptsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        clinic_reports: reportsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${doctorUID}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSnack({ open: true, severity: 'success', msg: label('Export ready.', 'تم تجهيز التصدير.') });
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: label('Export failed.', 'فشل التصدير.') });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Protected>
      <AppLayout>
        <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
          <Container maxWidth="md" sx={{ py: 2 }}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack spacing={1}>
                <Stack direction={isArabic ? 'row-reverse' : 'row'} alignItems="center" spacing={1}>
                  <PrivacyTipRoundedIcon color="primary" />
                  <Typography variant="h5" fontWeight={900}>
                    {label('Data & Privacy', 'البيانات والخصوصية')}
                  </Typography>
                </Stack>

                <Divider sx={{ my: 1 }} />

                <Typography variant="body2" color="text.secondary">
                  {label(
                    'Export your data for backup or review. Contact support for deletion requests.',
                    'قم بتصدير بياناتك للاحتفاظ بها أو مراجعتها. اتصل بالدعم لطلبات الحذف.'
                  )}
                </Typography>

                <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} sx={{ mt: 1 }}>
                  <Button
                    startIcon={<CloudDownloadRoundedIcon />}
                    variant="contained"
                    onClick={downloadData}
                    disabled={downloading}
                    sx={{ borderRadius: 2 }}
                  >
                    {downloading ? label('Preparing...', 'جارٍ التحضير...') : label('Download my data (JSON)', 'تنزيل البيانات (JSON)')}
                  </Button>
                  <Button
                    startIcon={<DeleteForeverRoundedIcon />}
                    variant="outlined"
                    color="error"
                    sx={{ borderRadius: 2 }}
                    onClick={() => setSnack({ open: true, severity: 'info', msg: label('Please contact support to process account deletion.', 'يرجى التواصل مع الدعم لحذف الحساب.') })}
                  >
                    {label('Request account deletion', 'طلب حذف الحساب')}
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
