// /pages/patients/index.jsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Stack, Typography, Grid, Snackbar, Alert, Skeleton,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Autocomplete, Box, Fade, Divider
} from '@mui/material';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, onSnapshot, query, where, addDoc, serverTimestamp
} from 'firebase/firestore';

import PatientSearchBar from '@/components/patients/PatientSearchBar';
import PatientCard from '@/components/patients/PatientCard';
import PatientListEmpty from '@/components/patients/PatientListEmpty';
import AddPatientDialog from '@/components/patients/AddPatientDialog';

import { useTheme, alpha, darken } from '@mui/material/styles';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import MailOutlineIcon from '@mui/icons-material/MailOutline';

/* -------------------------------------------------------------------------- */
/*                                Helper Utils                                */
/* -------------------------------------------------------------------------- */
const normalizePhone = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const plus = s[0] === '+';
  const digits = s.replace(/\D/g, '');
  return plus ? `+${digits}` : digits;
};

/* -------------------------------------------------------------------------- */
/*                               Main Component                               */
/* -------------------------------------------------------------------------- */
export default function PatientsIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router?.query]);

  const t = (en, ar) => (isArabic ? ar : en);

  /* ------------------------------ Styles ------------------------------ */
  const primaryContainedSx = {
    bgcolor: theme.palette.primary.main,
    color: theme.palette.getContrastText(theme.palette.primary.main),
    boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
    borderRadius: 2,
    fontWeight: 600,
    px: 2.5,
    py: 1,
    textTransform: 'none',
    '&:hover': {
      bgcolor: darken(theme.palette.primary.main, 0.08),
      boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
    },
  };

  const primaryOutlinedSx = {
    borderColor: alpha(theme.palette.primary.main, 0.4),
    color: theme.palette.primary.main,
    borderRadius: 2,
    px: 2.5,
    py: 1,
    fontWeight: 600,
    textTransform: 'none',
    '&:hover': {
      borderColor: theme.palette.primary.main,
      bgcolor: alpha(theme.palette.primary.main, 0.05),
    },
  };

  /* ----------------------------- State ----------------------------- */
  const [patients, setPatients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [okMsg, setOkMsg] = React.useState('');
  const [queryText, setQueryText] = React.useState('');
  const [openAddPatient, setOpenAddPatient] = React.useState(false);
  const [openMsg, setOpenMsg] = React.useState(false);
  const [msgPatient, setMsgPatient] = React.useState(null);
  const [msgSubject, setMsgSubject] = React.useState('');
  const [msgBody, setMsgBody] = React.useState('');
  const [sending, setSending] = React.useState(false);

  /* ---------------------------- Firestore ---------------------------- */
  React.useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'patients'),
      where('associatedDoctors', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) =>
          String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, { sensitivity: 'base' })
        );
        setPatients(rows);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(t('Failed to load patients', 'حدث خطأ أثناء تحميل البيانات'));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  /* ---------------------------- Search Filter ---------------------------- */
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

  /* ------------------------------ Message Logic ------------------------------ */
  const sendMessage = async () => {
    if (!user?.uid) return;
    if (!msgPatient?.id || !msgBody.trim()) {
      setError(t('Choose a patient and write a message', 'اختر مريضًا واكتب الرسالة'));
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
      setOkMsg(t('Message sent', 'تم إرسال الرسالة'));
    } catch (e) {
      console.error(e);
      setError(t('Failed to send message', 'تعذر إرسال الرسالة'));
    } finally {
      setSending(false);
    }
  };

  const goToPatient = (id) => {
    const path = `/patients/${id}`;
    if (isArabic) router.push({ pathname: path, query: { lang: 'ar' } });
    else router.push(path);
  };

  /* ------------------------------ Render ------------------------------ */
  return (
    <Protected>
      <AppLayout>
        <AddPatientDialog
          open={openAddPatient}
          onClose={() => setOpenAddPatient(false)}
          isArabic={isArabic}
          onSaved={(newId) => goToPatient(newId)}
        />

        {/* Message Dialog */}
        <Dialog open={openMsg} onClose={() => !sending && setOpenMsg(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 800 }}>
            {t('Message Patient', 'رسالة إلى المريض')}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <Autocomplete
                options={patients.map((p) => ({ id: p.id, name: p.name || t('Unnamed', 'بدون اسم') }))}
                value={msgPatient}
                onChange={(_, v) => setMsgPatient(v)}
                getOptionLabel={(o) => o?.name || ''}
                renderInput={(params) => (
                  <TextField {...params} label={t('Select patient', 'اختر المريض')} />
                )}
              />
              <TextField
                label={t('Subject (optional)', 'الموضوع (اختياري)')}
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
              />
              <TextField
                label={t('Message', 'الرسالة')}
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                multiline
                minRows={5}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenMsg(false)} disabled={sending}>
              {t('Cancel', 'إلغاء')}
            </Button>
            <Button variant="contained" onClick={sendMessage} disabled={sending}>
              {sending ? t('Sending…', 'جارٍ الإرسال…') : t('Send', 'إرسال')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Page Content */}
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap">
              <Typography variant="h5" fontWeight={800} sx={{ mb: { xs: 1, sm: 0 } }}>
                {t('Patients List', 'قائمة المرضى')}
              </Typography>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<PersonAddAlt1Icon />}
                  onClick={() => setOpenAddPatient(true)}
                  sx={primaryContainedSx}
                >
                  {t('Add Patient', 'إضافة مريض')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<MailOutlineIcon />}
                  onClick={() => setOpenMsg(true)}
                  sx={primaryOutlinedSx}
                >
                  {t('New Message', 'رسالة جديدة')}
                </Button>
              </Stack>
            </Stack>

            <Divider />

            <PatientSearchBar
              isArabic={isArabic}
              value={queryText}
              onChange={(v) => setQueryText(v)}
              onAddNew={() => setOpenAddPatient(true)}
            />

            {/* Loading State */}
            {loading ? (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Grid key={i} item xs={12} sm={6} md={4} lg={3}>
                    <Skeleton variant="rounded" height={130} />
                  </Grid>
                ))}
              </Grid>
            ) : filtered.length === 0 ? (
              <PatientListEmpty isArabic={isArabic} onAddNew={() => setOpenAddPatient(true)} />
            ) : (
              <Fade in timeout={500}>
                <Grid
                  container
                  spacing={2.5}
                  sx={{
                    mt: 1,
                    alignItems: 'stretch',
                    justifyContent: { xs: 'center', md: 'flex-start' },
                  }}
                >
                  {filtered.map((p) => (
                    <Grid
                      key={p.id}
                      item
                      xs={12}
                      sm={6}
                      md={4}
                      lg={3}
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <PatientCard
                        patient={p}
                        isArabic={isArabic}
                        sx={{
                          width: '100%',
                          transition: '0.2s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                          },
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Fade>
            )}
          </Stack>

          {/* Snackbars */}
          <Snackbar open={Boolean(error)} autoHideDuration={4000} onClose={() => setError('')}>
            <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
          </Snackbar>
          <Snackbar open={Boolean(okMsg)} autoHideDuration={3000} onClose={() => setOkMsg('')}>
            <Alert severity="success" onClose={() => setOkMsg('')}>{okMsg}</Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected>
  );
}
