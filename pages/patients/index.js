'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Stack, Typography, Grid, Snackbar, Alert, Skeleton,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Autocomplete, Box
} from '@mui/material';
import { useTheme, alpha, darken } from '@mui/material/styles';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import MailOutlineIcon from '@mui/icons-material/MailOutline';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, query, where, or, addDoc, serverTimestamp
} from 'firebase/firestore';

import PatientSearchBar from '@/components/patients/PatientSearchBar';
import PatientCard from '@/components/patients/PatientCard';
import PatientListEmpty from '@/components/patients/PatientListEmpty';
import AddPatientDialog from '@/components/patients/AddPatientDialog';

export default function PatientsIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const isArabic = true;

  const [patients, setPatients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [queryText, setQueryText] = React.useState('');
  const [error, setError] = React.useState('');
  const [okMsg, setOkMsg] = React.useState('');
  const [openAddPatient, setOpenAddPatient] = React.useState(false);
  const [openMsg, setOpenMsg] = React.useState(false);
  const [msgPatient, setMsgPatient] = React.useState(null);
  const [msgSubject, setMsgSubject] = React.useState('');
  const [msgBody, setMsgBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const patientsCol = collection(db, 'patients');

      // 🔹 Fetch only patients linked to this doctor
      const q = query(
        patientsCol,
        or(
          where('associatedDoctors', 'array-contains', user.uid),
          where('registeredBy', '==', user.uid)
        )
      );

      const unsub = onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // sort alphabetically
        rows.sort((a, b) =>
          String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, {
            sensitivity: 'base',
          })
        );
        setPatients(rows);
        setLoading(false);
      });
      return () => unsub();
    } catch (err) {
      console.error(err);
      setError(isArabic ? 'حدث خطأ أثناء تحميل المرضى' : 'Error loading patients');
      setLoading(false);
    }
  }, [user?.uid]);

  const filtered = React.useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = String(p?.name ?? '').toLowerCase();
      const phone = String(p?.phone ?? '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [patients, queryText]);

  const goToPatient = (newId) => {
    const pathname = `/patients/${newId}`;
    router.push({ pathname, query: { lang: 'ar' } });
  };

  const sendMessage = async () => {
    if (!user?.uid || !msgPatient?.id || !msgBody.trim()) {
      setError(isArabic ? 'اختر مريضًا واكتب الرسالة' : 'Select patient and write message');
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        type: 'direct',
        doctorUID: user.uid,
        doctorName: user.displayName || user.email,
        patientId: msgPatient.id,
        patientName: msgPatient.name || null,
        subject: msgSubject?.trim() || null,
        body: msgBody?.trim(),
        lang: isArabic ? 'ar' : 'en',
        createdAt: serverTimestamp(),
      });
      setOkMsg(isArabic ? 'تم إرسال الرسالة' : 'Message sent');
      setOpenMsg(false);
      setMsgPatient(null);
      setMsgSubject('');
      setMsgBody('');
    } catch (e) {
      console.error(e);
      setError(isArabic ? 'فشل إرسال الرسالة' : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <Protected>
      <AppLayout>
        <AddPatientDialog
          open={openAddPatient}
          onClose={() => setOpenAddPatient(false)}
          isArabic={isArabic}
          onSaved={(newId) => goToPatient(newId)}
        />

        {/* Message dialog */}
        <Dialog open={openMsg} onClose={() => !sending && setOpenMsg(false)} fullWidth maxWidth="sm">
          <DialogTitle>{isArabic ? 'رسالة إلى المريض' : 'Message Patient'}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Autocomplete
                options={patients}
                getOptionLabel={(o) => o.name || 'بدون اسم'}
                value={msgPatient}
                onChange={(_, v) => setMsgPatient(v)}
                renderInput={(params) => (
                  <TextField {...params} label={isArabic ? 'اختر المريض' : 'Select patient'} />
                )}
              />
              <TextField
                label={isArabic ? 'الموضوع (اختياري)' : 'Subject (optional)'}
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
              />
              <TextField
                label={isArabic ? 'الرسالة' : 'Message'}
                multiline
                minRows={5}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenMsg(false)}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={sendMessage} variant="contained" disabled={sending}>
              {sending ? (isArabic ? 'جارٍ الإرسال...' : 'Sending...') : (isArabic ? 'إرسال' : 'Send')}
            </Button>
          </DialogActions>
        </Dialog>

        <Container maxWidth="lg" sx={{ mt: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" fontWeight={800}>
                {isArabic ? 'قائمة المرضى' : 'Patients List'}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<PersonAddAlt1Icon />}
                  onClick={() => setOpenAddPatient(true)}
                >
                  {isArabic ? 'إضافة مريض' : 'Add Patient'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MailOutlineIcon />}
                  onClick={() => setOpenMsg(true)}
                >
                  {isArabic ? 'رسالة جديدة' : 'New Message'}
                </Button>
              </Stack>
            </Stack>

            <PatientSearchBar
              isArabic={isArabic}
              value={queryText}
              onChange={(v) => setQueryText(v)}
              onAddNew={() => setOpenAddPatient(true)}
            />

            {loading ? (
              <Grid container spacing={2}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Grid key={i} item xs={12} sm={6} md={4} lg={3}>
                    <Skeleton variant="rounded" height={120} />
                  </Grid>
                ))}
              </Grid>
            ) : filtered.length === 0 ? (
              <PatientListEmpty isArabic={isArabic} onAddNew={() => setOpenAddPatient(true)} />
            ) : (
              <Grid container spacing={2}>
                {filtered.map((p) => (
                  <Grid key={p.id} item xs={12} sm={6} md={4} lg={3}>
                    <PatientCard patient={p} isArabic={isArabic} />
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>

          {/* Snackbars */}
          <Snackbar
            open={Boolean(error)}
            autoHideDuration={4000}
            onClose={() => setError('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
          </Snackbar>

          <Snackbar
            open={Boolean(okMsg)}
            autoHideDuration={3000}
            onClose={() => setOkMsg('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="success" onClose={() => setOkMsg('')}>{okMsg}</Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected>
  );
}
