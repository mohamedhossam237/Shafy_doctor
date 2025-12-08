'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { Container, Paper, Stack, Typography, Snackbar, Alert, Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import PatientForm from '@/components/patients/PatientForm';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

export default function NewPatientPage() {
  const router = useRouter();
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const { user } = useAuth();

  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (m, s = 'info') => setSnack({ open: true, message: m, severity: s });

  const onSubmit = async (values, { setSubmitting }) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'patients'), {
        name: values.name.trim(),
        age: values.age ? Number(values.age) : null,
        gender: values.gender || null,
        bloodType: values.bloodType || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        allergies: values.allergies || null,
        conditions: values.conditions || null,
        medications: values.medications || null,
        maritalStatus: values.maritalStatus || null,
        lastVisit: values.lastVisit || null,
        registeredBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      openSnack(isArabic ? 'تم إضافة المريض بنجاح' : 'Patient added successfully', 'success');
      setTimeout(() => router.replace(`/patients${isArabic ? '?lang=ar' : ''}`), 600);
    } catch (e) {
      console.error(e);
      openSnack(isArabic ? 'فشل حفظ البيانات' : 'Failed to save patient', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Protected>
      <AppLayout>
        <Container maxWidth="md" sx={{ py: 3 }}>
          {/* Header */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 4,
              background: (t) => `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.1)} 0%, ${alpha(t.palette.background.paper, 1)} 100%)`,
              border: (t) => `1px solid ${t.palette.divider}`,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box sx={{
              position: 'absolute',
              top: -30,
              right: isArabic ? 'auto' : -30,
              left: isArabic ? -30 : 'auto',
              width: 150,
              height: 150,
              borderRadius: '50%',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
              zIndex: 0
            }} />
            <Stack direction="row" spacing={2} alignItems="center" position="relative" zIndex={1}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)'
                }}
              >
                <PersonAddIcon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={900} color="text.primary">
                  {isArabic ? 'إضافة مريض جديد' : 'Add New Patient'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {isArabic ? 'أدخل معلومات المريض الكاملة' : 'Enter complete patient information'}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Form */}
          <Paper sx={{ p: 3, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}` }}>
            <PatientForm isArabic={isArabic} onSubmit={onSubmit} />
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
      </AppLayout>
    </Protected>
  );
}
