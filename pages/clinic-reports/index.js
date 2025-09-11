// /pages/clinic-reports/index.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  IconButton,
  Divider,
  Skeleton,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, where, doc, getDoc, updateDoc,
} from 'firebase/firestore';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

// Build Date from:
//  - appointmentDate: Timestamp/ISO
//  - date: 'YYYY-MM-DD' (+ optional time: 'HH:MM')
function apptDate(a) {
  if (a?.appointmentDate) return toDate(a.appointmentDate);
  if (a?.date) {
    const [y, m, d] = String(a.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(a.time || '00:00').split(':').map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
    }
  }
  if (a?.createdAt) return toDate(a.createdAt);
  return null;
}

function normStatus(x) {
  const s = String(x || '').toLowerCase().trim();
  if (['complete', 'completed', 'done', 'finished'].includes(s)) return 'completed';
  if (['confirm', 'confirmed'].includes(s)) return 'confirmed';
  if (['cancel', 'cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['no_show', 'noshow', 'missed', 'absent'].includes(s)) return 'no_show';
  if (['pending', 'scheduled', 'new'].includes(s)) return 'pending';
  return s || 'pending';
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function endOfWeek(d) {
  const s = startOfWeek(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59, 999);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}
function getRangeBounds(range) {
  const now = new Date();
  if (range === 'week') return { start: startOfWeek(now), end: endOfWeek(now) };
  if (range === 'year') return { start: startOfYear(now), end: endOfYear(now) };
  // default month
  return { start: startOfMonth(now), end: endOfMonth(now) };
}
function inRange(d, start, end) {
  if (!d) return false;
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function StatCard({ icon, title, value, isArabic }) {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 3,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        textAlign: isArabic ? 'right' : 'left',
      }}
      elevation={1}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexShrink: 0 }}>
        {icon}
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Stack>
      <Typography variant="h5" fontWeight={800} sx={{ mt: 'auto' }}>
        {value}
      </Typography>
    </Paper>
  );
}

/* ---------------- page ---------------- */

export default function ClinicReportsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : `${path}${path.includes('?') ? '&' : '?'}lang=en`),
    [isArabic]
  );

  const [loading, setLoading] = React.useState(true);
  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });

  // summary (current month)
  const [totalAppointments, setTotalAppointments] = React.useState(0);
  const [completedSessions, setCompletedSessions] = React.useState(0);
  const [patientsSeen, setPatientsSeen] = React.useState(0);
  const [missedAppointments, setMissedAppointments] = React.useState(0);

  // pricing & appointments
  const [checkupPrice, setCheckupPrice] = React.useState(0);
  const [priceInput, setPriceInput] = React.useState('');
  const [allAppts, setAllAppts] = React.useState([]); // normalized: {_dt, _status, raw...}

  // Financial (appointments-only) with period filter
  const [finRange, setFinRange] = React.useState('month'); // 'week' | 'month' | 'year'
  const [apptRevenue, setApptRevenue] = React.useState(0);

  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      setLoading(true);
      try {
        // 1) load doctor price
        try {
          const dref = doc(db, 'doctors', user.uid);
          const dsnap = await getDoc(dref);
          if (dsnap.exists()) {
            const d = dsnap.data() || {};
            setCheckupPrice(Number(d.checkupPrice ?? 0));
          }
        } catch {}

        // 2) load all appointments (no orderBy -> no index needed)
        const col = collection(db, 'appointments');
        const [snapA, snapB] = await Promise.all([
          getDocs(query(col, where('doctorUID', '==', user.uid))),
          getDocs(query(col, where('doctorId', '==', user.uid))),
        ]);
        const map = new Map();
        [...snapA.docs, ...snapB.docs].forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));

        const rows = Array.from(map.values()).map((r) => ({
          ...r,
          _dt: apptDate(r),
          _status: normStatus(r?.status),
        }));
        setAllAppts(rows);

        // 3) compute monthly summary tiles (current calendar month)
        const { start, end } = getRangeBounds('month');
        const monthRows = rows.filter((r) => inRange(r._dt, start, end));

        const total = monthRows.length;
        const completed = monthRows.filter((r) => r._status === 'completed').length;
        const seenSet = new Set(
          monthRows
            .filter((r) => r._status === 'completed')
            .map((r) => r.patientUID || r.patientId || r.patientID || r.patientName || `anon-${r.id}`)
        );

        const now = new Date();
        const missed = monthRows.filter((r) => {
          if (r._status === 'cancelled' || r._status === 'no_show') return true;
          if (r._dt && r._dt < now && r._status !== 'completed') return true;
          return false;
        }).length;

        setTotalAppointments(total);
        setCompletedSessions(completed);
        setPatientsSeen(seenSet.size);
        setMissedAppointments(missed);
      } catch (e) {
        console.error(e);
        setSnack({
          open: true,
          message: e?.message || (isArabic ? 'تعذر تحميل التقارير' : 'Failed to load reports'),
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid, isArabic]);

  // Compute appointments-only revenue for selected range
  React.useEffect(() => {
    if (!allAppts.length) {
      setApptRevenue(0);
      return;
    }
    const { start, end } = getRangeBounds(finRange);

    const tryNum = (...vals) => {
      for (const v of vals) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return 0;
    };

    // Appointment fee detection:
    // Prefer explicit numeric fields on the appointment/billing;
    // otherwise, if completed, fall back to doctor's checkupPrice.
    const feeOf = (a) => {
      const b = a.billing || a.bill || {};
      const n = tryNum(
        a.fee, a.price, a.amount, a.visitFee, a.checkupFee,
        b.total, b.appointment, b.appointmentFee, b.consult, b.consultation,
        a.payment?.amount
      );
      if (n > 0) return n;
      return a._status === 'completed' ? Number(checkupPrice || 0) : 0;
    };

    const sum = allAppts
      .filter((a) => inRange(a._dt, start, end))
      .reduce((acc, a) => acc + feeOf(a), 0);

    setApptRevenue(sum);
  }, [allAppts, finRange, checkupPrice]);

  const updatePrice = async () => {
    if (!user) return;
    const newPrice = parseInt(String(priceInput).trim(), 10);
    if (Number.isNaN(newPrice)) {
      setSnack({ open: true, message: isArabic ? 'أدخل رقماً صحيحاً' : 'Enter a valid number', severity: 'warning' });
      return;
    }
    try {
      await updateDoc(doc(db, 'doctors', user.uid), { checkupPrice: newPrice });
      setCheckupPrice(newPrice);
      setPriceInput('');
      setSnack({ open: true, message: isArabic ? 'تم تحديث السعر' : 'Price updated', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: e?.message || (isArabic ? 'فشل التحديث' : 'Update failed'), severity: 'error' });
    }
  };

  // Chart: single bar = appointments revenue for selected period
  const chartData = React.useMemo(
    () => [{ name: isArabic ? 'المواعيد' : 'Appointments', value: Math.max(0, Number(apptRevenue || 0)) }],
    [apptRevenue, isArabic]
  );

  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container disableGutters maxWidth="lg">
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton component={Link} href={withLang('/')} size="small" sx={{ transform: isArabic ? 'scaleX(-1)' : 'none' }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h5" fontWeight={800}>
                {isArabic ? 'تقارير العيادة' : 'Clinic Reports'}
              </Typography>
            </Stack>
          </Stack>

          {/* Content */}
          {loading ? (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[...Array(4)].map((_, i) => (
                  <Grid key={i} item xs={6} sm={3}>
                    <Skeleton variant="rounded" height={114} />
                  </Grid>
                ))}
              </Grid>
              <Skeleton variant="rounded" height={86} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" height={340} />
            </>
          ) : (
            <>
              {/* Summary tiles (current month) */}
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    isArabic={isArabic}
                    icon={<CalendarTodayIcon color="primary" />}
                    title={isArabic ? 'إجمالي المواعيد (هذا الشهر)' : 'Total Appointments (This Month)'}
                    value={totalAppointments}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    isArabic={isArabic}
                    icon={<CheckCircleIcon color="success" />}
                    title={isArabic ? 'الجلسات المكتملة' : 'Completed Sessions'}
                    value={completedSessions}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    isArabic={isArabic}
                    icon={<PeopleIcon color="info" />}
                    title={isArabic ? 'عدد المرضى (مميز)' : 'Patients Seen (Unique)'}
                    value={patientsSeen}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    isArabic={isArabic}
                    icon={<CancelIcon color="warning" />}
                    title={isArabic ? 'المواعيد الفائتة/الملغاة' : 'Missed/Cancelled'}
                    value={missedAppointments}
                  />
                </Grid>
              </Grid>

              {/* Price + Update */}
              <Paper
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                  gap: 2,
                  flexDirection: { xs: 'column', sm: isArabic ? 'row-reverse' : 'row' },
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
                elevation={0}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <AttachMoneyIcon color="success" />
                  <Typography fontWeight={700}>
                    {isArabic
                      ? `سعر الكشف الحالي: ${checkupPrice} ج.م`
                      : `Current checkup price: QAR ${checkupPrice}`}
                  </Typography>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  <TextField
                    size="small"
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    label={isArabic ? 'تحديث سعر الكشف' : 'Update Checkup Price'}
                    sx={{ minWidth: 220 }}
                  />
                  <Button onClick={updatePrice} variant="contained" startIcon={<SaveIcon />}>
                    {isArabic ? 'حفظ' : 'Save'}
                  </Button>
                </Stack>
              </Paper>

              {/* Financial chart (appointments-only) */}
              <Paper sx={{ mt: 2, p: 2, borderRadius: 3 }} elevation={0}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1.5 }}
                >
                  <Typography variant="h6" fontWeight={800}>
                    {isArabic ? 'التقارير المالية (المواعيد فقط)' : 'Financial Reports (Appointments Only)'}
                  </Typography>

                  {/* Range selector */}
                  <ToggleButtonGroup
                    value={finRange}
                    exclusive
                    onChange={(_, v) => v && setFinRange(v)}
                    size="small"
                  >
                    <ToggleButton value="week">{isArabic ? 'أسبوع' : 'Week'}</ToggleButton>
                    <ToggleButton value="month">{isArabic ? 'شهر' : 'Month'}</ToggleButton>
                    <ToggleButton value="year">{isArabic ? 'سنة' : 'Year'}</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  {isArabic
                    ? `إجمالي الإيرادات للفترة المختارة: ${Math.round(apptRevenue)}`
                    : `Total Revenue for selected period: QAR ${Math.round(apptRevenue)}`}
                </Typography>

                <Divider sx={{ mb: 2 }} />

                <Box sx={{ width: '100%', height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </>
          )}

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
      </Box>
    </AppLayout>
  );
}
