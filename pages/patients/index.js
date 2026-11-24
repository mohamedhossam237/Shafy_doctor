'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container,
  Stack,
  Typography,
  Snackbar,
  Alert,
  Skeleton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Box,
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
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';

import dynamic from 'next/dynamic';
import PatientSearchBar from '@/components/patients/PatientSearchBar';
import PatientCard from '@/components/patients/PatientCard';
import PatientListEmpty from '@/components/patients/PatientListEmpty';
import globalCache, { readSessionCache, writeSessionCache } from '@/lib/cache';

const AddPatientDialog = dynamic(() => import('@/components/patients/AddPatientDialog'), {
  ssr: false,
});

export default function PatientsIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    return true;
  }, [router.query]);

  const [patients, setPatients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [queryText, setQueryText] = React.useState('');
  const [quickFilter, setQuickFilter] = React.useState('all'); // 'all' | 'week' | 'alerts'
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
    const sessionKey = `patients_${user.uid}`;
    const cached = globalCache.patients || readSessionCache(sessionKey, 5 * 60 * 1000);

    if (cached && Array.isArray(cached)) {
      setPatients(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let isMounted = true;

    (async () => {
      try {
        const patientsCol = collection(db, 'patients');
        const q1 = query(patientsCol, where('associatedDoctors', 'array-contains', user.uid));
        const q2 = query(patientsCol, where('registeredBy', '==', user.uid));

        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

        if (!isMounted) return;

        const data1 = snap1.docs.map((d) => ({ id: d.id, ...d.data() }));
        const data2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));

        const combined = [...data1, ...data2];
        const unique = Object.values(
          combined.reduce((acc, cur) => {
            acc[cur.id] = cur;
            return acc;
          }, {})
        );

        const withPhone = unique.filter(
          (p) =>
            (typeof p.phone === 'string' && p.phone.trim() !== '') ||
            (typeof p.mobile === 'string' && p.mobile.trim() !== '')
        );

        withPhone.sort((a, b) =>
          String(a?.name ?? '').localeCompare(String(b?.name ?? ''), undefined, { sensitivity: 'base' })
        );

        setPatients(withPhone);
        setLoading(false);
        globalCache.patients = withPhone;
        writeSessionCache(sessionKey, withPhone);
      } catch (err) {
        console.error('Error loading patients:', err);
        if (isMounted) {
          setError(isArabic ? 'حدث خطأ أثناء تحميل المرضى' : 'Error loading patients');
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const stats = React.useMemo(() => {
    const total = patients.length;
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const addedLast24Hours = patients.filter((p) => {
      if (!p.createdAt) return false;
      const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return createdAt >= last24Hours;
    }).length;

    const addedThisWeek = patients.filter((p) => {
      if (!p.createdAt) return false;
      const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return createdAt >= last7Days;
    }).length;

    return { total, addedLast24Hours, addedThisWeek };
  }, [patients]);

  const filtered = React.useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    return patients.filter((p) => {
      if (quickFilter === 'week') {
        if (!p.createdAt) return false;
        const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
        if (createdAt < last7Days) return false;
      } else if (quickFilter === 'alerts') {
        const hasFlags =
          Boolean(String(p.allergies || '').trim()) ||
          Boolean(String(p.conditions || '').trim()) ||
          Boolean(p.isDiabetic) ||
          Boolean(p.isPregnant);
        if (!hasFlags) return false;
      }

      if (!q) return true;
      const name = String(p?.name ?? '').toLowerCase();
      const phone = String(p?.phone ?? '').toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [patients, queryText, quickFilter]);

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
    router.push(`/patients/${id}${isArabic ? '?lang=ar' : '?lang=en'}`);
  };

  const handleDeleted = (deletedId) => {
    setPatients((prev) => {
      const next = prev.filter((p) => p.id !== deletedId);
      globalCache.patients = next;
      if (user?.uid) writeSessionCache(`patients_${user.uid}`, next);
      return next;
    });
    setOkMsg(isArabic ? 'تم حذف المريض' : 'Patient removed');
  };

  const handleUpdated = (updatedId, updatedData) => {
    setPatients((prev) => {
      const next = prev.map((p) => (p.id === updatedId ? { ...p, ...updatedData } : p));
      globalCache.patients = next;
      if (user?.uid) writeSessionCache(`patients_${user.uid}`, next);
      return next;
    });
  };

  return (
    <Protected>
      <AppLayout
        title={isArabic ? 'سجلات المرضى والملفات الطبية' : 'Patients & Medical Records'}
        subtitle={isArabic ? 'إدارة سريعة لملفات المرضى، الحساسيات، والتواصل المباشر' : 'Fast management of patient profiles, alerts & direct messaging'}
      >
        <AddPatientDialog
          open={openAddPatient}
          onClose={() => setOpenAddPatient(false)}
          isArabic={isArabic}
          onSaved={(newId) => goToPatient(newId)}
        />

        <Dialog open={openMsg} onClose={() => !sending && setOpenMsg(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontWeight: 900 }}>{isArabic ? 'رسالة إلى المريض' : 'Message Patient'}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Autocomplete
                options={patients}
                getOptionLabel={(o) => {
                  const name = o.name || (isArabic ? 'بدون اسم' : 'Unnamed');
                  const r = o.familyRelation;
                  if (!r || r === 'himself') return name;
                  const relLabel = (() => {
                    if (!isArabic) return r.charAt(0).toUpperCase() + r.slice(1);
                    const map = { son: 'ابن', wife: 'زوجة', mom: 'أم', dad: 'أب' };
                    return map[r] || r;
                  })();
                  return `${name} (${relLabel})`;
                }}
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
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpenMsg(false)}>{isArabic ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={sendMessage} variant="contained" disabled={sending}>
              {sending ? (isArabic ? 'جارٍ الإرسال...' : 'Sending...') : (isArabic ? 'إرسال' : 'Send')}
            </Button>
          </DialogActions>
        </Dialog>

        <Box sx={{ pb: 4 }}>
          <Container maxWidth={false} disableGutters>
            <Stack spacing={2.5}>
              {/* Header + Actions */}
              <div
                className="glass-panel"
                style={{
                  padding: '20px 24px',
                  borderTop: '4px solid #2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.42)',
                      flexShrink: 0,
                    }}
                  >
                    <PeopleIcon sx={{ fontSize: 26 }} />
                  </div>
                  <Box>
                    <Typography variant="h5" fontWeight={900} sx={{ color: '#0f172a', lineHeight: 1.2 }}>
                      {isArabic ? 'دليل وسجلات المرضى' : 'Patients Directory'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                      {isArabic ? `عرض ${filtered.length} من إجمالي ${patients.length} مريض` : `Showing ${filtered.length} of ${patients.length} patients`}
                    </Typography>
                  </Box>
                </Box>

                <Stack direction="row" spacing={1.25} flexWrap="wrap">
                  <Button
                    variant="contained"
                    startIcon={<PersonAddAlt1Icon />}
                    onClick={() => setOpenAddPatient(true)}
                    sx={{ borderRadius: '13px', px: 2.5, py: 1 }}
                  >
                    {isArabic ? 'إضافة مريض' : 'Add Patient'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<MailOutlineIcon />}
                    onClick={() => setOpenMsg(true)}
                    sx={{ borderRadius: '13px', px: 2.2, py: 1, bgcolor: '#ffffff' }}
                  >
                    {isArabic ? 'رسالة جديدة' : 'New Message'}
                  </Button>
                </Stack>
              </div>

              {/* 3 Equal KPI Cards */}
              {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div className="glass-panel glass-panel-lift" style={{ padding: '18px 20px', borderTop: '4px solid #2563eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569' }}>
                        {isArabic ? 'إجمالي المرضى' : 'Total Patients'}
                      </span>
                      <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PersonIcon sx={{ fontSize: 20 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{stats.total}</div>
                  </div>

                  <div className="glass-panel glass-panel-lift" style={{ padding: '18px 20px', borderTop: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569' }}>
                        {isArabic ? 'أضيف آخر 24 ساعة' : 'Added Last 24 Hours'}
                      </span>
                      <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AccessTimeIcon sx={{ fontSize: 20 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{stats.addedLast24Hours}</div>
                  </div>

                  <div className="glass-panel glass-panel-lift" style={{ padding: '18px 20px', borderTop: '4px solid #6366f1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569' }}>
                        {isArabic ? 'أضيف هذا الأسبوع' : 'Added This Week'}
                      </span>
                      <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUpIcon sx={{ fontSize: 20 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{stats.addedThisWeek}</div>
                  </div>
                </div>
              )}

              {/* Search + Filter Pills */}
              <div
                className="glass-panel"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <PatientSearchBar
                  isArabic={isArabic}
                  value={queryText}
                  onChange={(v) => setQueryText(v)}
                  onAddNew={() => setOpenAddPatient(true)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: isArabic ? `الكل (${patients.length})` : `All (${patients.length})` },
                    { id: 'week', label: isArabic ? `جدد هذا الأسبوع (${stats.addedThisWeek})` : `New This Week (${stats.addedThisWeek})` },
                    { id: 'alerts', label: isArabic ? 'حالات مزمنة / حساسية' : 'Clinical Alerts' },
                  ].map((f) => {
                    const active = quickFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setQuickFilter(f.id)}
                        className="shafy-tab-pill"
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.78rem',
                          background: active ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#f8fafc',
                          color: active ? '#ffffff' : '#475569',
                          borderColor: active ? 'transparent' : '#e2e8f0',
                        }}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rock-Solid Responsive CSS Grid of Equal-Width Patient Cards */}
              {loading ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: '16px',
                  }}
                >
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} variant="rounded" height={124} sx={{ borderRadius: '18px' }} />
                  ))}
                </Box>
              ) : filtered.length === 0 ? (
                <PatientListEmpty isArabic={isArabic} onAddNew={() => setOpenAddPatient(true)} />
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      lg: 'repeat(3, minmax(0, 1fr))',
                    },
                    gap: '16px',
                    alignItems: 'stretch',
                  }}
                >
                  {filtered.map((p) => (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      isArabic={isArabic}
                      onDeleted={handleDeleted}
                      onUpdated={handleUpdated}
                    />
                  ))}
                </Box>
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
        </Box>
      </AppLayout>
    </Protected>
  );
}
