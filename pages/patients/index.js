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

// NEW: Add Patient Dialog
import AddPatientDialog from '@/components/patients/AddPatientDialog';

/* ---------- helpers ---------- */
const normalizePhone = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const plus = s[0] === '+';
  const digits = s.replace(/\D/g, '');
  return plus ? `+${digits}` : digits;
};

export default function PatientsIndexPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Arabic default
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

  // dialogs
  const [openAddPatient, setOpenAddPatient] = React.useState(false);
  const [openMsg, setOpenMsg] = React.useState(false);
  const [msgPatient, setMsgPatient] = React.useState(null);
  const [msgSubject, setMsgSubject] = React.useState('');
  const [msgBody, setMsgBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!user?.uid) return;
    const uid = String(user.uid);

    (async () => {
      setLoading(true);
      setError('');
      try {
        const patientsCol = collection(db, 'patients');

        // A) direct & associated lists
        const [snapRegistered, snapAssoc] = await Promise.all([
          getDocs(query(patientsCol, where('registeredBy', '==', uid))),
          getDocs(query(patientsCol, where('associatedDoctors', 'array-contains', uid))),
        ]);

        const rawDocs = new Map();
        const push = (d) => {
          const data = { id: d.id, ...d.data() };
          // hide any record already merged to the canonical (phone-id) doc
          if (data.mergedInto) return;
          rawDocs.set(d.id, data);
        };
        snapRegistered.docs.forEach(push);
        snapAssoc.docs.forEach(push);

        // B) ensure anyone who booked appears (by phone)
        const apptCol = collection(db, 'appointments');
        const [snapA, snapB] = await Promise.all([
          getDocs(query(apptCol, where('doctorId', '==', uid))),
          getDocs(query(apptCol, where('doctorUID', '==', uid))),
        ]);
        const bookedPhones = new Set();
        const pickPhone = (a) => {
          const p = normalizePhone(a.patientPhone || a.phone || a.patient_phone || a.patientUid || a.patientUID);
          if (p) bookedPhones.add(p);
        };
        [...snapA.docs, ...snapB.docs].forEach(s => pickPhone(s.data()));

        // C) group by normalized phone to de-dupe
        const byPhone = new Map();
        const choose = (prev, cur, phone) => {
          if (!prev) return cur;
          // prefer phone-id doc
          if (prev.id === phone && cur.id !== phone) return prev;
          if (cur.id === phone && prev.id !== phone) return cur;
          // else prefer newer
          const ts = (x) => x.updatedAt?.seconds || x.createdAt?.seconds || 0;
          return ts(cur) >= ts(prev) ? cur : prev;
        };

        for (const row of rawDocs.values()) {
          const phone = normalizePhone(row.phone || row.mobile || row.id);
          const key = phone || row.id;
          byPhone.set(key, choose(byPhone.get(key), row, key));
        }

        for (const phone of bookedPhones) {
          if (!byPhone.has(phone)) {
            byPhone.set(phone, {
              id: phone,
              name: isArabic ? 'بدون اسم' : 'Unnamed',
              phone,
              mobile: phone,
            });
          }
        }

        const rows = Array.from(byPhone.values());
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
      const phone = String(p?.phone ?? p?.mobile ?? '').toLowerCase();
      return name.includes(q) || id.includes(q) || phone.includes(q);
    });
  }, [patients, queryText]);

  const goToPatient = (newId) => {
    const pathname = `/patients/${newId}`;
    if (isArabic) router.push({ pathname, query: { lang: 'ar' } });
    else router.push(pathname);
  };

  // Compose message (unchanged)
  const sendMessage = async () => {
    if (!user?.uid) return;
    if (!msgPatient?.id || !msgBody.trim()) {
      setError(isArabic ? 'اختر مريضًا واكتب الرسالة' : 'Choose a patient and write a message');
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        type: 'direct',
        doctorUID: user.uid,
        doctorName: user.displayName || user.email || null,
        patientId: String(msgPatient.id),
        patientName: msgPatient.name || null,
        subject: msgSubject?.trim() || null,
        body: msgBody?.trim(),
        lang: isArabic ? 'ar' : 'en',
        createdAt: serverTimestamp(),
      });
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
        {/* Add Patient Dialog */}
        <AddPatientDialog
          open={openAddPatient}
          onClose={() => setOpenAddPatient(false)}
          isArabic={isArabic}
          onSaved={(newId) => goToPatient(newId)}
        />

        {/* Compose Message */}
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
              <Button variant="contained" onClick={() => setOpenMsg(true)}>
                {isArabic ? 'رسالة جديدة' : 'New Message'}
              </Button>
            </Stack>

            <PatientSearchBar
              isArabic={isArabic}
              value={queryText}
              onChange={(v) => setQueryText(v)}
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
