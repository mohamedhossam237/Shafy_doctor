// /pages/patients/index.js (PatientsIndexPage)
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Stack, Typography, Grid, Snackbar, Alert, Skeleton,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Autocomplete, Box
} from '@mui/material';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, where, addDoc, serverTimestamp
} from 'firebase/firestore';

import PatientSearchBar from '@/components/patients/PatientSearchBar';
import PatientCard from '@/components/patients/PatientCard';
import PatientListEmpty from '@/components/patients/PatientListEmpty';

// ⬇️ NEW: Add Patient Dialog
import AddPatientDialog from '@/components/patients/AddPatientDialog';

export default function PatientsIndexPage() {
  const router = useRouter();
  const { user } = useAuth();

  // ⬇️ Arabic is DEFAULT unless explicitly set to EN (align with AppTopBar & Dashboard)
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router?.query]);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [okMsg, setOkMsg] = React.useState('');
  const [patients, setPatients] = React.useState([]);
  const [queryText, setQueryText] = React.useState('');

  // ⬇️ NEW: Add patient dialog state
  const [openAddPatient, setOpenAddPatient] = React.useState(false);

  // ⬇️ NEW: Compose message dialog state
  const [openMsg, setOpenMsg] = React.useState(false);
  const [msgPatient, setMsgPatient] = React.useState(null); // {id, name}
  const [msgSubject, setMsgSubject] = React.useState('');
  const [msgBody, setMsgBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!user) return; // Protected handles redirect
    (async () => {
      setLoading(true);
      setError('');
      try {
        // NOTE: removed orderBy('name') to avoid composite index requirement
        const qPatients = query(collection(db, 'patients'), where('registeredBy', '==', user.uid));
        const snap = await getDocs(qPatients);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Client-side sort by name (case-insensitive, null-safe)
        rows.sort((a, b) =>
          String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, { sensitivity: 'base' })
        );

        setPatients(rows);
      } catch (e) {
        console.error(e);
        setError(isArabic ? 'حدث خطأ أثناء تحميل البيانات' : 'Failed to load patients');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isArabic]);

  const filtered = React.useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = String(p?.name ?? '').toLowerCase();
      const id = String(p?.id ?? '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [patients, queryText]);

  const goToPatient = (newId) => {
    const pathname = `/patients/${newId}`;
    if (isArabic) {
      router.push({ pathname, query: { lang: 'ar' } });
    } else {
      router.push(pathname);
    }
  };

  // ⬇️ NEW: Submit message to Firestore "messages" collection
  const sendMessage = async () => {
    if (!user?.uid) return;
    if (!msgPatient?.id || !msgBody.trim()) {
      setError(isArabic ? 'اختر مريضًا واكتب الرسالة' : 'Choose a patient and write a message');
      return;
    }
    setSending(true);
    try {
      const payload = {
        type: 'direct',                 // for future filtering (direct / broadcast)
        doctorUID: user.uid,
        doctorName: user.displayName || user.email || null,
        patientId: String(msgPatient.id),
        patientName: msgPatient.name || null,
        subject: msgSubject?.trim() || null,
        body: msgBody?.trim(),
        lang: isArabic ? 'ar' : 'en',
        createdAt: serverTimestamp(),
        // You can add delivery metadata later (seenByPatient, deliveredAt, etc.)
      };
      await addDoc(collection(db, 'messages'), payload);
      setOpenMsg(false);
      setMsgPatient(null);
      setMsgSubject('');
      setMsgBody('');
      setOkMsg(isArabic ? 'تم إرسال الرسالة' : 'Message sent');
    } catch (e) {
      console.error(e);
      setError(isArabic ? 'تعذر إرسال الرسالة' : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // ⬇️ Helper: quick options for Autocomplete
  const patientOptions = React.useMemo(
    () =>
      patients.map((p) => ({
        id: p.id,
        name: p.name || (isArabic ? 'بدون اسم' : 'Unnamed'),
      })),
    [patients, isArabic]
  );

  return (
    <Protected>
      <AppLayout>
        {/* ⬇️ AddPatientDialog mounted once; PatientSearchBar "Add New" opens it */}
        <AddPatientDialog
          open={openAddPatient}
          onClose={() => setOpenAddPatient(false)}
          isArabic={isArabic}
          onSaved={(newId) => goToPatient(newId)}
        />

        {/* ⬇️ NEW: Compose Message Dialog */}
        <Dialog open={openMsg} onClose={() => !sending && setOpenMsg(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 800 }}>
            {isArabic ? 'رسالة إلى المريض' : 'Message Patient'}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Autocomplete
                options={patientOptions}
                value={msgPatient}
                onChange={(_, v) => setMsgPatient(v)}
                getOptionLabel={(o) => o?.name || ''}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={isArabic ? 'اختر المريض' : 'Select patient'}
                    placeholder={isArabic ? 'ابحث بالاسم' : 'Search by name'}
                  />
                )}
              />

              <TextField
                label={isArabic ? 'الموضوع (اختياري)' : 'Subject (optional)'}
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
              />

              <TextField
                label={isArabic ? 'الرسالة' : 'Message'}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                multiline
                minRows={5}
                placeholder={isArabic ? 'اكتب رسالتك هنا…' : 'Type your message…'}
              />

              {/* (Optional) preview of recipient */}
              {msgPatient?.id && (
                <Box sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {isArabic ? 'سيتم إرسال الرسالة إلى: ' : 'Will send to: '}
                  <strong>{msgPatient.name}</strong> (ID: {msgPatient.id})
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenMsg(false)} disabled={sending}>
              {isArabic ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={sendMessage} variant="contained" disabled={sending}>
              {sending ? (isArabic ? 'جارٍ الإرسال…' : 'Sending…') : (isArabic ? 'إرسال' : 'Send')}
            </Button>
          </DialogActions>
        </Dialog>

        <Container maxWidth="lg">
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h5" fontWeight={700}>
                {isArabic ? 'قائمة المرضى' : 'Patient List'}
              </Typography>

              {/* ⬇️ NEW: Message button (opens compose dialog) */}
              <Button variant="contained" onClick={() => setOpenMsg(true)}>
                {isArabic ? 'رسالة جديدة' : 'New Message'}
              </Button>
            </Stack>

            <PatientSearchBar
              isArabic={isArabic}
              value={queryText}
              onChange={(v) => setQueryText(v)}
              // ⬇️ Previously navigated to /patients/new — now opens the dialog
              onAddNew={() => setOpenAddPatient(true)}
            />

            {loading ? (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Grid key={i} item xs={12} sm={6} md={4} lg={3}>
                    <Skeleton variant="rounded" height={118} />
                  </Grid>
                ))}
              </Grid>
            ) : filtered.length === 0 ? (
              <PatientListEmpty isArabic={isArabic} />
            ) : (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {filtered.map((p) => (
                  <Grid key={p.id} item xs={12} sm={6} md={4} lg={3}>
                    <PatientCard patient={p} isArabic={isArabic} />
                  </Grid>
                ))}
              </Grid>
            )}
          </Stack>

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
