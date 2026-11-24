'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { Container, Stack, Typography, Snackbar, Alert, Box } from '@mui/material';
import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import PatientForm from '@/components/patients/PatientForm';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';

export default function NewPatientPage() {
  const router = useRouter();
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);
  const { user } = useAuth();

  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (m, s = 'info') => setSnack({ open: true, message: m, severity: s });

  const onSubmit = async (values, { setSubmitting }) => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, 'patients'), {
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
        isDiabetic: !!values.isDiabetic,
        hadSurgeries: !!values.hadSurgeries,
        isSmoker: !!values.isSmoker,
        drinksAlcohol: !!values.drinksAlcohol,
        familyHistory: !!values.familyHistory,
        isPregnant: !!values.isPregnant,
        registeredBy: user.uid,
        associatedDoctors: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      openSnack(isArabic ? 'تم إضافة المريض بنجاح' : 'Patient added successfully', 'success');
      setTimeout(() => router.replace(`/patients/${docRef.id}${isArabic ? '?lang=ar' : '?lang=en'}`), 500);
    } catch (e) {
      console.error(e);
      openSnack(isArabic ? 'فشل حفظ البيانات' : 'Failed to save patient', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Protected>
      <AppLayout
        title={isArabic ? 'إضافة مريض جديد' : 'Add New Patient'}
        subtitle={isArabic ? 'إنشاء ملف طبي متكامل للمريض في ثوانٍ' : 'Create a complete clinical patient profile in seconds'}
      >
        <Container maxWidth="lg" disableGutters sx={{ pb: 4 }}>
          {/* Royal Sapphire Hero Banner */}
          <div className="shafy-hero-shell" style={{ padding: '24px 28px', marginBottom: '22px' }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ position: 'relative', zIndex: 2 }}>
              <Box
                sx={{
                  width: 58,
                  height: 58,
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.16)',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <PersonAddAlt1RoundedIcon sx={{ fontSize: 30, color: '#ffffff' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{ color: '#ffffff', fontSize: { xs: '1.35rem', md: '1.65rem' } }}>
                  {isArabic ? 'إضافة ملف مريض جديد' : 'New Patient Profile'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#dbeafe', mt: 0.4, fontWeight: 600 }}>
                  {isArabic
                    ? 'أدخل البيانات الأساسية، فصيلة الدم، الحساسيات، وعوامل الخطورة الصحية'
                    : 'Enter demographics, blood type, allergies, and clinical risk flags'}
                </Typography>
              </Box>
            </Stack>
          </div>

          <PatientForm isArabic={isArabic} onSubmit={onSubmit} />

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
