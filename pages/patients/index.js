'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Stack, Typography, Grid, Snackbar, Alert, Skeleton,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Autocomplete, Paper, Box
} from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PeopleIcon from '@mui/icons-material/People';
import PersonIcon from '@mui/icons-material/Person';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

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

export default function PatientsIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
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

  /* ------------------------------------------------------------ */
  /* 🔹 Load Patients for Current Doctor (deduplicated + with phone) */
  /* ------------------------------------------------------------ */
  React.useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);

    try {
      const patientsCol = collection(db, 'patients');
      const q1 = query(patientsCol, where('associatedDoctors', 'array-contains', user.uid));
      const q2 = query(patientsCol, where('registeredBy', '==', user.uid));

      const unsub1 = onSnapshot(q1, (snap1) => {
        const data1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() }));

        const unsub2 = onSnapshot(q2, (snap2) => {
          const data2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));

          // 🧩 Merge + deduplicate by ID
          const combined = [...data1, ...data2];
          const unique = Object.values(
            combined.reduce((acc, cur) => {
              acc[cur.id] = cur;
              return acc;
            }, {})
          );

          // ✅ Filter only patients with a valid phone number
          const withPhone = unique.filter(
            (p) => typeof p.phone === 'string' && p.phone.trim() !== ''
          );

          // Sort alphabetically
          withPhone.sort((a, b) =>
            String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, { sensitivity: 'base' })
          );

          setPatients(withPhone);
          setLoading(false);
        });

        return () => {
          unsub1();
          unsub2();
        };
      });
    } catch (err) {
      console.error(err);
      setError(isArabic ? 'حدث خطأ أثناء تحميل المرضى' : 'Error loading patients');
      setLoading(false);
    }
  }, [user?.uid, isArabic]);

  /* ------------------------------------------------------------ */
  /* 🔍 Filter by search text                                    */
  /* ------------------------------------------------------------ */
  const filtered = React.useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const name = String(p?.name ?? '').toLowerCase();
      const phone = String(p?.phone ?? '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [patients, queryText]);

  /* ------------------------------------------------------------ */
  /* 📊 Statistics                                                */
  /* ------------------------------------------------------------ */
  const stats = React.useMemo(() => {
    const total = patients.length;
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Patients added in last 24 hours
    const addedLast24Hours = patients.filter((p) => {
      if (!p.createdAt) return false;
      const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return createdAt >= last24Hours;
    }).length;

    // Patients added this week
    const addedThisWeek = patients.filter((p) => {
      if (!p.createdAt) return false;
      const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return createdAt >= last7Days;
    }).length;

    return {
      total,
      addedLast24Hours,
      addedThisWeek,
    };
  }, [patients]);

  /* ------------------------------------------------------------ */
  /* 📩 Message Sending                                          */
  /* ------------------------------------------------------------ */
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

  const goToPatient = (id) => {
    router.push(`/patients/${id}${isArabic ? '?lang=ar' : ''}`);
  };

  /* ------------------------------------------------------------ */
  /* 🧩 Render UI                                                */
  /* ------------------------------------------------------------ */
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

        {/* Message Dialog */}
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

        {/* Main Content */}
        <Box
          sx={{
            minHeight: '100vh',
            pb: 4,
            bgcolor: 'background.default',
          }}
        >
          <Container maxWidth="lg" sx={{ mt: 3 }}>
            <Stack spacing={3}>
              {/* Header */}
              <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <PeopleIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Typography variant="h5" fontWeight={700}>
                      {isArabic ? 'قائمة المرضى' : 'Patients List'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <Button
                      variant="contained"
                      startIcon={<PersonAddAlt1Icon />}
                      onClick={() => setOpenAddPatient(true)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                      {isArabic ? 'إضافة مريض' : 'Add Patient'}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<MailOutlineIcon />}
                      onClick={() => setOpenMsg(true)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                      {isArabic ? 'رسالة جديدة' : 'New Message'}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>

              {/* Statistics Cards */}
              {!loading && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Paper elevation={1} sx={{ p: 2.5, borderRadius: 2, textAlign: 'center' }}>
                      <PersonIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                      <Typography variant="h4" fontWeight={700} color="primary.main">
                        {stats.total}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
                        {isArabic ? 'إجمالي المرضى' : 'Total Patients'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Paper elevation={1} sx={{ p: 2.5, borderRadius: 2, textAlign: 'center' }}>
                      <AccessTimeIcon sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {stats.addedLast24Hours}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
                        {isArabic ? 'أضيف في آخر 24 ساعة' : 'Added Last 24 Hours'}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Paper elevation={1} sx={{ p: 2.5, borderRadius: 2, textAlign: 'center' }}>
                      <TrendingUpIcon sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
                      <Typography variant="h4" fontWeight={700} color="info.main">
                        {stats.addedThisWeek}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
                        {isArabic ? 'أضيف هذا الأسبوع' : 'Added This Week'}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              )}

              {/* Search Bar */}
              <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
                <PatientSearchBar
                  isArabic={isArabic}
                  value={queryText}
                  onChange={(v) => setQueryText(v)}
                  onAddNew={() => setOpenAddPatient(true)}
                />
              </Paper>

              {/* Content */}
              {loading ? (
                <Grid container spacing={2}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Grid key={i} item xs={12} sm={6} md={4} lg={3}>
                      <Skeleton variant="rounded" height={140} sx={{ borderRadius: 2 }} />
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
        </Box>
      </AppLayout>
    </Protected>
  );
}
