// /pages/appointments/index.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Box,
  Container,
  Stack,
  Typography,
  Paper,
  Avatar,
  Chip,
  Grid,
  Skeleton,
  Snackbar,
  Alert,
  Button,
  Fab,
  IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TagIcon from '@mui/icons-material/Tag';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import PlaceIcon from '@mui/icons-material/Place';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';

/* ---------------- utils ---------------- */

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (val?.toDate) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  try { return new Date(val); } catch { return null; }
}

function isToday(d) {
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function formatTime(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
}

// Build Date object from either shape:
// - { appointmentDate: Timestamp/ISO }
// - { date: 'YYYY-MM-DD', time: 'HH:MM' }
function apptDate(appt) {
  if (appt?._dt) return appt._dt; // precomputed
  if (appt?.appointmentDate) return toDate(appt.appointmentDate);
  if (appt?.date) {
    const [y, m, d] = String(appt.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(appt.time || '00:00').split(':').map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
    }
  }
  return null;
}

// Normalize clinics from the doctor document
const sanitizeClinics = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter(Boolean)
    .map((c) => ({
      id: c.id || c._id || `c_${Math.random().toString(36).slice(2, 8)}`,
      name_en: String(c.name_en || c.name || '').trim(),
      name_ar: String(c.name_ar || c.name || '').trim(),
      active: c.active !== false,
    }));

/* ---------------- row/card ---------------- */

function AppointmentCard({ appt, isArabic, onConfirm, confirming, detailHref, clinicLabel }) {
  const d = apptDate(appt);
  const status = String(appt?.status || 'pending').toLowerCase();
  const completed = status === 'completed';
  const confirmed = status === 'confirmed';
  const statusColor = completed ? 'success' : confirmed ? 'info' : 'warning';

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Avatar sx={{ bgcolor: (t) => t.palette[statusColor].light, width: 56, height: 56 }}>
        {completed ? <CheckCircleIcon color={statusColor} /> : <AccessTimeIcon color={statusColor} />}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }} useFlexGap>
          <Chip
            size="small"
            icon={<TagIcon />}
            label={`#${appt._queue ?? '—'}`}
            sx={{ borderRadius: 1.5, fontWeight: 700 }}
          />
          <Typography fontWeight={700} noWrap title={appt?.patientName || ''}>
            {appt?.patientName || (isArabic ? 'بدون اسم' : 'Unnamed')}
          </Typography>
          {/* Clinic badge (optional, only if we can resolve a label) */}
          {clinicLabel ? (
            <Chip
              size="small"
              icon={<PlaceIcon />}
              label={clinicLabel}
              sx={{ borderRadius: 1.5, ml: 0.5 }}
              variant="outlined"
            />
          ) : null}
        </Stack>
        <Typography variant="body2" color="text.secondary" noWrap>
          {(isArabic ? 'الوقت: ' : 'Time: ') + formatTime(d)}
        </Typography>
      </Box>

      <Chip
        label={
          isArabic
            ? completed ? 'منجز' : confirmed ? 'مؤكد' : 'قيد الانتظار'
            : completed ? 'Completed' : confirmed ? 'Confirmed' : 'Pending'
        }
        color={completed ? 'success' : confirmed ? 'info' : 'warning'}
        variant="outlined"
        sx={{ fontWeight: 600, mr: 1 }}
      />

      {/* Actions */}
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        {!completed && !confirmed && (
          <Button
            variant="contained"
            size="small"
            onClick={() => onConfirm?.(appt.id)}
            disabled={confirming}
          >
            {confirming ? (isArabic ? 'جارٍ التأكيد…' : 'Confirming…') : (isArabic ? 'تأكيد' : 'Confirm')}
          </Button>
        )}
        <Button
          component={Link}
          href={detailHref}
          size="small"
          variant="text"
          sx={{ fontWeight: 700 }}
        >
          {isArabic ? 'فتح' : 'Open'}
        </Button>
      </Stack>
    </Paper>
  );
}

/* ---------------- page ---------------- */

export default function AppointmentsPage() {
  const router = useRouter();
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const { user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [ok, setOk] = React.useState('');
  const [todayRows, setTodayRows] = React.useState([]); // base rows for today (unfiltered)
  const [confirmingId, setConfirmingId] = React.useState(null);

  // Clinics state (for toggle filter)
  const [clinics, setClinics] = React.useState([]);
  const [selectedClinicId, setSelectedClinicId] = React.useState('all');

  // Load doctor clinics (doc id == user.uid)
  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'doctors', user.uid));
        if (snap.exists()) {
          const arr = sanitizeClinics(snap.data()?.clinics);
          setClinics(arr);
          // keep selectedClinicId if still present; else reset to 'all'
          if (selectedClinicId !== 'all' && !arr.some((c) => c.id === selectedClinicId)) {
            setSelectedClinicId('all');
          }
        } else {
          setClinics([]);
          setSelectedClinicId('all');
        }
      } catch {
        setClinics([]);
        setSelectedClinicId('all');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Load today's appointments for this doctor
  React.useEffect(() => {
    if (!user) return; // Protected will redirect if not signed in
    (async () => {
      setLoading(true);
      setError('');

      try {
        const col = collection(db, 'appointments');

        // Support both field names: doctorUID (old) and doctorId (patient booking)
        const [snapOld, snapNew] = await Promise.all([
          getDocs(query(col, where('doctorUID', '==', user.uid))),
          getDocs(query(col, where('doctorId', '==', user.uid))),
        ]);

        // Merge and dedupe by id
        const map = new Map();
        [...snapOld.docs, ...snapNew.docs].forEach((d) => {
          map.set(d.id, { id: d.id, ...d.data() });
        });
        const rows = Array.from(map.values());

        // Normalize date and keep only today (do not assign queue here; we’ll do it after filtering)
        const todayOnly = rows
          .map((r) => ({ ...r, _dt: apptDate(r) }))
          .filter((r) => isToday(r._dt));

        setTodayRows(todayOnly);
      } catch (e) {
        console.error(e);
        setError(isArabic ? 'تعذر تحميل المواعيد' : 'Failed to load appointments');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isArabic]);

  // Derived: counts per clinic and filtered list
  const clinicNameById = React.useMemo(() => {
    const map = new Map();
    clinics.forEach((c) => {
      const label = isArabic ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar);
      map.set(c.id, label || (isArabic ? 'عيادة' : 'Clinic'));
    });
    return map;
  }, [clinics, isArabic]);

  const countsByClinic = React.useMemo(() => {
    const counts = new Map();
    todayRows.forEach((r) => {
      const cid = r.clinicId || r.clinicID || ''; // legacy safety
      counts.set(cid, (counts.get(cid) || 0) + 1);
    });
    return counts;
  }, [todayRows]);

  const filtered = React.useMemo(() => {
    const base = selectedClinicId === 'all'
      ? todayRows
      : todayRows.filter((r) => (r.clinicId || r.clinicID || '') === selectedClinicId);

    // sort by time, then assign queue numbers for the *visible* list
    const sorted = [...base].sort((a, b) => (a._dt?.getTime() || 0) - (b._dt?.getTime() || 0));
    return sorted.map((r, i) => ({ ...r, _queue: i + 1 }));
  }, [todayRows, selectedClinicId]);

  const newHref = `/appointments/new${isArabic ? '?lang=ar' : ''}`;
  const historyHref = `/appointments/history${isArabic ? '?lang=ar' : ''}`;
  const detailHref = (id) => `/appointments/${id}${isArabic ? '?lang=ar' : ''}`;

  const confirmAppt = async (id) => {
    if (!id) return;
    setConfirmingId(id);
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });
      // reflect in UI
      // Update both in todayRows and filtered (filtered is derived, so only update todayRows)
      setTodayRows((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a))
      );
      setOk(isArabic ? 'تم التأكيد' : 'Appointment confirmed');
    } catch (e) {
      console.error(e);
      setError(e?.message || (isArabic ? 'فشل التأكيد' : 'Failed to confirm'));
    } finally {
      setConfirmingId(null);
    }
  };

  // Chip label helper (with count)
  const labelForClinicChip = (c) => {
    const base = isArabic ? (c.name_ar || c.name_en || 'عيادة') : (c.name_en || c.name_ar || 'Clinic');
    const n = countsByClinic.get(c.id) || 0;
    return `${base} (${n})`;
  };

  const allLabel = React.useMemo(() => {
    const total = todayRows.length;
    return (isArabic ? 'الكل' : 'All') + ` (${total})`;
  }, [todayRows.length, isArabic]);

  return (
    <Protected>
      <AppLayout>
        <Container maxWidth="md">
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Header + actions */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="h5" fontWeight={700}>
                {isArabic ? 'مواعيد اليوم' : "Today's Appointments"}
              </Typography>

              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                <Button
                  component={Link}
                  href={historyHref}
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                >
                  {isArabic ? 'السجل' : 'History'}
                </Button>
                <Button
                  component={Link}
                  href={newHref}
                  variant="contained"
                  startIcon={<AddIcon />}
                >
                  {isArabic ? 'موعد جديد' : 'New Appointment'}
                </Button>
              </Stack>
            </Box>

            {/* Clinic filter (toggle chips) */}
            {clinics.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.75,
                  overflowX: 'auto',
                  pb: 0.5,
                  px: 0.5,
                  '&::-webkit-scrollbar': { height: 6 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
                }}
              >
                <Chip
                  clickable
                  onClick={() => setSelectedClinicId('all')}
                  color={selectedClinicId === 'all' ? 'primary' : 'default'}
                  variant={selectedClinicId === 'all' ? 'filled' : 'outlined'}
                  label={allLabel}
                  sx={{ borderRadius: 2, fontWeight: 700, flexShrink: 0 }}
                />
                {clinics.map((c) => (
                  <Chip
                    key={c.id}
                    clickable
                    onClick={() => setSelectedClinicId(c.id)}
                    color={selectedClinicId === c.id ? 'primary' : 'default'}
                    variant={selectedClinicId === c.id ? 'filled' : 'outlined'}
                    label={labelForClinicChip(c)}
                    sx={{ borderRadius: 2, fontWeight: 700, flexShrink: 0 }}
                  />
                ))}
              </Box>
            )}

            {/* Loading skeletons */}
            {loading ? (
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Grid key={i} item xs={12}>
                    <Skeleton variant="rounded" height={88} />
                  </Grid>
                ))}
              </Grid>
            ) : filtered.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
                <Typography color="text.secondary">
                  {isArabic ? 'لا توجد مواعيد اليوم' : 'No appointments today'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {isArabic
                    ? 'أنشئ موعداً من صفحة المريض أو المواعيد'
                    : 'Create a new appointment from the patient page or appointments.'}
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button component={Link} href={historyHref} variant="outlined" startIcon={<HistoryIcon />}>
                    {isArabic ? 'السجل' : 'History'}
                  </Button>
                  <Button component={Link} href={newHref} variant="contained" startIcon={<AddIcon />}>
                    {isArabic ? 'موعد جديد' : 'New Appointment'}
                  </Button>
                </Box>
              </Paper>
            ) : (
              <Stack spacing={1.5}>
                {filtered.map((appt) => {
                  const cid = appt.clinicId || appt.clinicID || '';
                  const clinicLabel = cid ? clinicNameById.get(cid) : '';
                  return (
                    <AppointmentCard
                      key={appt.id}
                      appt={appt}
                      isArabic={isArabic}
                      confirming={confirmingId === appt.id}
                      onConfirm={confirmAppt}
                      detailHref={detailHref(appt.id)}
                      clinicLabel={clinicLabel}
                    />
                  );
                })}
              </Stack>
            )}
          </Stack>

          {/* Floating Action Button (mobile friendly) */}
          <Fab
            color="primary"
            aria-label="add"
            onClick={() => router.push(newHref)}
            sx={{
              position: 'fixed',
              bottom: 88,
              right: isArabic ? 'auto' : 16,
              left: isArabic ? 16 : 'auto',
              zIndex: 1200,
              display: { xs: 'flex', md: 'none' },
            }}
          >
            <AddIcon />
          </Fab>

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
            open={Boolean(ok)}
            autoHideDuration={2500}
            onClose={() => setOk('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="success" onClose={() => setOk('')}>{ok}</Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected>
  );
}
