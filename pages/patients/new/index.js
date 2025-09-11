'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { Container, Paper, Stack, Typography, Grid, TextField, MenuItem, Button, Snackbar, Alert } from '@mui/material';
import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import PatientForm from '@/components/patients/PatientForm';

export default function NewPatientPage() {
  const router = useRouter();
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const { user } = useAuth();

  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (m, s='info') => setSnack({ open: true, message: m, severity: s });

  const onSubmit = async (values, { setSubmitting }) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'patients'), {
        name: values.name.trim(),
        age: values.age ? Number(values.age) : null,
        gender: values.gender || null,
        lastVisit: values.lastVisit || null,
        registeredBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      openSnack(isArabic ? 'تم إضافة المريض' : 'Patient added', 'success');
      setTimeout(() => router.replace(`/patients${isArabic ? '?lang=ar' : ''}`), 600);
    } catch (e) {
      console.error(e);
      openSnack(isArabic ? 'فشل حفظ البيانات' : 'Failed to save', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Protected>
      <AppLayout>
        <Container maxWidth="sm">
          <Paper sx={{ p: 3, borderRadius: 2, mt: 2 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              {isArabic ? 'إضافة مريض' : 'Add Patient'}
            </Typography>
            <PatientForm isArabic={isArabic} onSubmit={onSubmit} />
          </Paper>

          <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s)=>({...s, open:false}))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
            <Alert severity={snack.severity} onClose={() => setSnack((s)=>({...s, open:false}))}>{snack.message}</Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected>
  );
}
