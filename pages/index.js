// /pages/index.js
'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Stack,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Button,
  Avatar,
  Divider,
  Chip,
  Skeleton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import AssessmentIcon from '@mui/icons-material/Assessment';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';

import AddPatientDialog from '@/components/patients/AddPatientDialog';

/* --------------------------- utils --------------------------- */

const grad = (from, to) => `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

function formatLongDate(isArabic) {
  const locale = isArabic ? 'ar-EG-u-nu-arab' : undefined;
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date());
  }
}

// ---- shared date helpers (same approach as /pages/appointments and patient_reports) ----
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
// Build Date from either shape: appointmentDate OR {date,time}
function apptDate(appt) {
  if (appt?._dt) return appt._dt;
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

/* --------------------------- UI primitives --------------------------- */

function SectionCard({ children, isArabic, tint = 'transparent', pad = true, sx = {}, ...props }) {
  const theme = useTheme();
  const bgImage = typeof tint === 'function' ? tint(theme) : tint;
  return (
    <Paper
      {...props}
      elevation={0}
      sx={{
        p: pad ? { xs: 1.25, sm: 2 } : 0,
        borderRadius: { xs: 2.5, sm: 3 },
        border: (t) => `1px solid ${t.palette.divider}`,
        ...(bgImage && bgImage !== 'transparent' ? { backgroundImage: bgImage } : {}),
        backgroundColor: 'background.paper',
        textAlign: isArabic ? 'right' : 'left',
        boxShadow: { xs: '0 2px 8px rgba(0,0,0,.045)', sm: '0 6px 18px rgba(0,0,0,.06)' },
        overflow: 'hidden',
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function StatTile({ icon, label, count, href, isArabic, withLang }) {
  return (
    <Link href={withLang(href)} style={{ textDecoration: 'none' }}>
      <Paper
        role="button"
        aria-label={isArabic ? label.ar : label.en}
        elevation={0}
        sx={{
          borderRadius: 3,
          border: (t) => `1px solid ${t.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          minHeight: { xs: 86, sm: 96 },
          height: '100%',
          p: { xs: 1.25, sm: 1.75 },
          transition: 'transform .14s ease, box-shadow .14s ease',
          willChange: 'transform',
          '&:hover': {
            transform: { sm: 'translateY(-3px)' },
            boxShadow: { sm: '0 12px 24px rgba(0,0,0,.10)' },
          },
          textAlign: isArabic ? 'right' : 'left',
          flexDirection: 'row',
        }}
      >
        {isArabic ? (
          <>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                {count}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                title={label.ar}
                sx={{ minWidth: 0 }}
              >
                {label.ar}
              </Typography>
            </Box>
            <ChevronRightIcon sx={{ color: 'text.disabled', transform: 'rotate(180deg)' }} />
            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 44, height: 44, flexShrink: 0 }}>
              {icon}
            </Avatar>
          </>
        ) : (
          <>
            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 44, height: 44, flexShrink: 0 }}>
              {icon}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
                {count}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                title={label.en}
                sx={{ minWidth: 0 }}
              >
                {label.en}
              </Typography>
            </Box>
            <ChevronRightIcon sx={{ color: 'text.disabled' }} />
          </>
        )}
      </Paper>
    </Link>
  );
}

function QuickActions({ isArabic, onAddPatient, onAddReport }) {
  return (
    <SectionCard
      isArabic={isArabic}
      tint={(t) => grad(t.palette.primary.light, '#ffffff')}
      sx={{ border: (t) => `1px solid ${t.palette.divider}` }}
    >
      <Stack
        direction={isArabic ? 'row-reverse' : 'row'}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ width: '100%', columnGap: 12, rowGap: 10, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
      >
        <Stack
          spacing={0.2}
          sx={{
            flex: '1 1 220px',
            minWidth: 0,
            textAlign: isArabic ? 'right' : 'left',
            wordBreak: 'break-word',
            hyphens: 'auto',
          }}
        >
          <Typography variant="subtitle2" color="text.secondary">
            {isArabic ? 'اختصارات سريعة' : 'Quick actions'}
          </Typography>
          <Typography variant="h6" fontWeight={800}>
            {isArabic ? 'ابدأ بسرعة' : 'Get things done fast'}
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            flex: { xs: '1 1 100%', sm: '0 0 auto' },
            width: { xs: '100%', sm: 'auto' },
            minWidth: 0,
          }}
        >
          <Button
            fullWidth
            variant="contained"
            startIcon={<PersonAddAlt1Icon />}
            onClick={onAddPatient}
            sx={{ borderRadius: 2, minHeight: 44 }}
          >
            {isArabic ? 'إضافة مريض' : 'Add Patient'}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AssessmentIcon />}
            onClick={onAddReport}
            sx={{ borderRadius: 2, minHeight: 44 }}
          >
            {isArabic ? 'إضافة تقرير' : 'Add Report'}
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}

function AppointmentItem({ appt, isArabic, withLang }) {
  const d = apptDate(appt);
  const patientName = appt?.patientName || (isArabic ? 'بدون اسم' : 'Unnamed');
  const status = String(appt?.status || '').toLowerCase();
  const completed = status === 'completed';
  const detailHref = appt?.patientId ? withLang(`/patients/${appt.patientId}`) : withLang('/patients');

  return (
    <Link href={detailHref} style={{ textDecoration: 'none' }}>
      <Paper
        elevation={0}
        sx={{
          px: { xs: 1.25, sm: 1.75 },
          py: { xs: 1.1, sm: 1.4 },
          borderRadius: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.1,
          border: (t) => `1px solid ${t.palette.divider}`,
          transition: 'background .12s ease, box-shadow .12s ease',
          '&:hover': { backgroundColor: 'action.hover' },
          textAlign: isArabic ? 'right' : 'left',
          minHeight: 60,
        }}
      >
        <Avatar sx={{ bgcolor: completed ? 'success.main' : 'warning.main', color: 'common.white', width: 36, height: 36 }}>
          <PeopleAltIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} noWrap title={patientName} sx={{ minWidth: 0 }}>
            {patientName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap title={formatTime(d)} sx={{ minWidth: 0 }}>
            {formatTime(d)}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={completed ? (isArabic ? 'منجز' : 'Completed') : (isArabic ? 'قيد الانتظار' : 'Pending')}
          color={completed ? 'success' : 'warning'}
          variant="outlined"
          sx={{ fontWeight: 600, flexShrink: 0 }}
        />
      </Paper>
    </Link>
  );
}

/* --------------------------- page --------------------------- */

export default function DashboardIndexPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [mounted, setMounted] = React.useState(false);
  const [isArabic, setIsArabic] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');

  const [doctorName, setDoctorName] = React.useState('Doctor');
  const [appointments, setAppointments] = React.useState([]); // upcoming 4
  const [counts, setCounts] = React.useState({ appointments: 0, patients: 0, reports: 0 });

  const [openAddPatient, setOpenAddPatient] = React.useState(false);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path),
    [isArabic]
  );

  React.useEffect(() => {
    setMounted(true);
    const q = router?.query || {};
    if (q.lang) {
      setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    } else if (q.ar) {
      setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    } else {
      setIsArabic(true);
    }
  }, [router.query]);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const doctorUID = user.uid;

        // doctor display name
        const dSnap = await getDoc(doc(db, 'doctors', doctorUID));
        const dData = dSnap.exists() ? dSnap.data() : {};
        const name = isArabic ? (dData?.name_ar || 'الطبيب') : (dData?.name_en || 'Doctor');
        setDoctorName(name);

        // ----- appointments (merge doctorUID/doctorId), filter to TODAY, then upcoming 4 -----
        const colAppt = collection(db, 'appointments');
        const [snapOld, snapNew] = await Promise.all([
          getDocs(query(colAppt, where('doctorUID', '==', doctorUID))),
          getDocs(query(colAppt, where('doctorId', '==', doctorUID))),
        ]);
        const map = new Map();
        [...snapOld.docs, ...snapNew.docs].forEach((d) => {
          map.set(d.id, { id: d.id, ...d.data() });
        });
        const rows = Array.from(map.values()).map((r) => ({ ...r, _dt: apptDate(r) }));

        const todayAll = rows.filter((r) => isToday(r._dt));
        const now = new Date();
        const upcoming = todayAll
          .filter((r) => r._dt && r._dt.getTime() >= now.getTime())
          .sort((a, b) => a._dt.getTime() - b._dt.getTime())
          .slice(0, 4);
        setAppointments(upcoming);

        // ----- patients count (registeredBy = doctor) -----
        const patSnap = await getDocs(query(collection(db, 'patients'), where('registeredBy', '==', doctorUID)));

        // ----- reports TODAY (use same source/field as patient_reports: collection 'reports', field 'date') -----
        const repSnap = await getDocs(query(collection(db, 'reports'), where('doctorUID', '==', doctorUID)));
        const repRows = repSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const reportsTodayCount = repRows.filter((r) => isToday(toDate(r?.date))).length;

        setCounts({ appointments: todayAll.length, patients: patSnap.size, reports: reportsTodayCount });
      } catch (e) {
        console.error(e);
        setErr(e?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isArabic]);

  const features = React.useMemo(
    () => [
      { icon: <CalendarTodayIcon />, label: { en: "Today's Appointments", ar: 'مواعيد اليوم' }, count: counts.appointments, href: '/appointments' },
      { icon: <PeopleAltIcon />, label: { en: 'Patients (You)', ar: 'المرضى (مسجّلين لديك)' }, count: counts.patients, href: '/patients' },
      { icon: <AnalyticsIcon />, label: { en: 'Reports', ar: 'تقارير' }, count: counts.reports, href: '/patient-reports' },
    ],
    [counts]
  );

  const addPatient = () => setOpenAddPatient(true);
  const addReport = () => router.push(withLang('/patient-reports/new'));

  if (!mounted) return null;

  const todayPretty = formatLongDate(isArabic);

  return (
    <AppLayout>
      <AddPatientDialog
        open={openAddPatient}
        onClose={() => setOpenAddPatient(false)}
        isArabic={isArabic}
        onSaved={(newId) => router.push(withLang(`/patients/${newId}`))}
      />

      <Box
        dir={isArabic ? 'rtl' : 'ltr'}
        sx={{
          textAlign: isArabic ? 'right' : 'left',
          overflowX: 'hidden',
          width: '100%',
        }}
      >
        <Container
          disableGutters
          maxWidth="lg"
          sx={{
            px: { xs: 1.25, sm: 2.5 },
            pb: { xs: 8, sm: 5 },
            maxWidth: '100%',
          }}
        >
          {/* Welcome card */}
          <SectionCard isArabic={isArabic} tint={() => grad('#e9f3ff', '#ffffff')} sx={{ mt: 1 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              sx={{ columnGap: 12, rowGap: 10 }}
            >
              <Stack direction="row" alignItems="center" sx={{ columnGap: 14, minWidth: 0 }}>
                <Avatar
                  sx={{
                    width: { xs: 52, md: 64 },
                    height: { xs: 52, md: 64 },
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  Dr
                </Avatar>

                <Box sx={{ minWidth: 0, textAlign: isArabic ? 'right' : 'left' }}>
                  <Typography variant="overline" color="text.secondary">
                    {todayPretty}
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{
                      color: '#2D2F41',
                      fontWeight: 800,
                      lineHeight: 1.25,
                      mt: 0.25,
                      fontSize: { xs: '1.25rem', sm: '1.375rem', md: '1.5rem' },
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                    }}
                  >
                    {isArabic ? 'مرحباً بعودتك، د.' : 'Welcome back, Dr.'}{' '}
                    <Box component="span">{doctorName}</Box>
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </SectionCard>

          {loading ? (
            <Box sx={{ py: 3 }}>
              <Grid container columnSpacing={2} rowSpacing={2}>
                {[...Array(3)].map((_, i) => (
                  <Grid key={i} item xs={6} sm={6} md={4}>
                    <Skeleton variant="rounded" height={92} />
                  </Grid>
                ))}
                <Grid item xs={12}><Skeleton variant="rounded" height={88} /></Grid>
                {[...Array(4)].map((_, i) => (
                  <Grid key={i} item xs={12}><Skeleton variant="rounded" height={64} /></Grid>
                ))}
              </Grid>
              <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
                <CircularProgress size={26} />
              </Box>
            </Box>
          ) : err ? (
            <SectionCard isArabic={isArabic} sx={{ my: 3 }}>
              <Typography color="error" fontWeight={700}>
                {isArabic ? 'حدث خطأ' : 'Error'}: {err}
              </Typography>
            </SectionCard>
          ) : (
            <>
              {/* stats tiles */}
              <Box
                sx={{
                  mt: 2,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                  },
                  gap: 1.5,
                  alignItems: 'stretch',
                  width: '100%',
                }}
              >
                {features.map((f) => (
                  <StatTile
                    key={f.label.en}
                    icon={f.icon}
                    label={f.label}
                    count={f.count}
                    href={f.href}
                    isArabic={isArabic}
                    withLang={withLang}
                  />
                ))}
              </Box>

              {/* quick actions */}
              <Box sx={{ mt: 2 }}>
                <QuickActions
                  isArabic={isArabic}
                  onAddPatient={addPatient}
                  onAddReport={addReport}
                />
              </Box>

              {/* Upcoming (today) – max 4 */}
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ mt: 3, mb: 1 }}
                spacing={{ xs: 1, sm: 0 }}
              >
                <Typography variant="h6" fontWeight={800} sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>
                  {isArabic ? 'المواعيد القادمة اليوم' : 'Upcoming Today'}
                </Typography>
                <Button
                  component={Link}
                  href={withLang('/appointments')}
                  size="small"
                  sx={{ fontWeight: 800, alignSelf: { xs: 'stretch', sm: 'auto' } }}
                >
                  {isArabic ? 'عرض الكل' : 'See all'}
                </Button>
              </Stack>

              <Divider />

              <Stack spacing={1.1} sx={{ mt: 2, mb: 1 }}>
                {appointments.length === 0 && (
                  <SectionCard isArabic={isArabic}>
                    <Typography color="text.secondary">
                      {isArabic ? 'لا توجد مواعيد قادمة اليوم' : 'No upcoming appointments today'}
                    </Typography>
                  </SectionCard>
                )}
                {appointments.map((appt) => (
                  <AppointmentItem key={appt.id} appt={appt} isArabic={isArabic} withLang={withLang} />
                ))}
              </Stack>
            </>
          )}
        </Container>
      </Box>
    </AppLayout>
  );
}
