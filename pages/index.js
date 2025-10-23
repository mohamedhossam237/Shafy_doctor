'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Box, Container, Stack, Typography, Grid, Paper, CircularProgress,
  Button, Avatar, Divider, Chip, Skeleton
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
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import AddPatientDialog from '@/components/patients/AddPatientDialog';

/* --------------------------- Helpers --------------------------- */

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

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (val?.toDate) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  return null;
}
function isToday(d) {
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
function formatTime(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
}
function apptDate(appt) {
  if (appt?._dt) return appt._dt;
  if (appt?.appointmentDate) return toDate(appt.appointmentDate);
  if (appt?.date) {
    const [y, m, d] = String(appt.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(appt.time || '00:00')
      .split(':')
      .map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, hh, mm);
    }
  }
  return null;
}

/* --------------------------- UI Components --------------------------- */

function SectionCard({ children, isArabic, tint = 'transparent', sx = {}, ...props }) {
  const theme = useTheme();
  const bgImage = typeof tint === 'function' ? tint(theme) : tint;
  return (
    <Paper
      {...props}
      elevation={0}
      sx={{
        p: { xs: 1.25, sm: 2 },
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
        ...(bgImage && bgImage !== 'transparent' ? { backgroundImage: bgImage } : {}),
        backgroundColor: 'background.paper',
        textAlign: isArabic ? 'right' : 'left',
        boxShadow: '0 6px 18px rgba(0,0,0,.06)',
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
        elevation={0}
        sx={{
          borderRadius: 3,
          border: (t) => `1px solid ${t.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          height: '100%',
          p: 1.75,
          transition: 'all .15s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 20px rgba(0,0,0,.08)',
          },
          textAlign: isArabic ? 'right' : 'left',
        }}
      >
        {isArabic ? (
          <>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800}>
                {count}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {label.ar}
              </Typography>
            </Box>
            <ChevronRightIcon sx={{ color: 'text.disabled', transform: 'rotate(180deg)' }} />
            <Avatar sx={{ bgcolor: 'primary.main', color: 'white' }}>{icon}</Avatar>
          </>
        ) : (
          <>
            <Avatar sx={{ bgcolor: 'primary.main', color: 'white' }}>{icon}</Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800}>
                {count}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
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

function QuickActions({ isArabic, onAddPatient, onAddReport, onOpenClinicReports }) {
  return (
    <SectionCard
      isArabic={isArabic}
      tint={(t) => grad(t.palette.primary.light, '#ffffff')}
    >
      <Stack
        direction={isArabic ? 'row-reverse' : 'row'}
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        spacing={1}
      >
        <Typography fontWeight={800}>
          {isArabic ? 'ابدأ بسرعة' : 'Quick Actions'}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={onAddPatient}>
            {isArabic ? 'إضافة مريض' : 'Add Patient'}
          </Button>
          <Button variant="outlined" startIcon={<AssessmentIcon />} onClick={onAddReport}>
            {isArabic ? 'إضافة تقرير' : 'Add Report'}
          </Button>
          <Button variant="outlined" startIcon={<AnalyticsIcon />} onClick={onOpenClinicReports}>
            {isArabic ? 'تقارير العيادة' : 'Clinic Reports'}
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
          px: 1.75, py: 1.4,
          borderRadius: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.1,
          border: (t) => `1px solid ${t.palette.divider}`,
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        <Avatar sx={{ bgcolor: completed ? 'success.main' : 'warning.main', color: 'white' }}>
          <PeopleAltIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>{patientName}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{formatTime(d)}</Typography>
        </Box>
        <Chip
          size="small"
          label={completed ? (isArabic ? 'منجز' : 'Completed') : (isArabic ? 'قيد الانتظار' : 'Pending')}
          color={completed ? 'success' : 'warning'}
          variant="outlined"
        />
      </Paper>
    </Link>
  );
}

/* --------------------------- Page --------------------------- */

export default function DashboardIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [isArabic, setIsArabic] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [doctorName, setDoctorName] = React.useState('Doctor');
  const [appointments, setAppointments] = React.useState([]);
  const [counts, setCounts] = React.useState({ appointments: 0, patients: 0, reports: 0 });
  const [openAddPatient, setOpenAddPatient] = React.useState(false);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path),
    [isArabic]
  );

  React.useEffect(() => {
    setMounted(true);
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else setIsArabic(true);
  }, [router.query]);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const doctorUID = user.uid;

        // doctor name
        const dSnap = await getDoc(doc(db, 'doctors', doctorUID));
        const dData = dSnap.exists() ? dSnap.data() : {};
        setDoctorName(isArabic ? dData?.name_ar || 'الطبيب' : dData?.name_en || 'Doctor');

        // appointments
        const colAppt = collection(db, 'appointments');
        const [snapOld, snapNew] = await Promise.all([
          getDocs(query(colAppt, where('doctorUID', '==', doctorUID))),
          getDocs(query(colAppt, where('doctorId', '==', doctorUID))),
        ]);
        const apptMap = new Map();
        [...snapOld.docs, ...snapNew.docs].forEach((d) => apptMap.set(d.id, { id: d.id, ...d.data() }));
        const rows = Array.from(apptMap.values()).map((r) => ({ ...r, _dt: apptDate(r) }));
        const todayAll = rows.filter((r) => isToday(r._dt));
        const now = new Date();
        const upcoming = todayAll
          .filter((r) => r._dt && r._dt >= now)
          .sort((a, b) => a._dt - b._dt)
          .slice(0, 4);
        setAppointments(upcoming);

        // ✅ fixed patient count logic (associatedDoctors OR registeredBy)
        const patientsCol = collection(db, 'patients');
        const [snapAssoc, snapReg] = await Promise.all([
          getDocs(query(patientsCol, where('associatedDoctors', 'array-contains', doctorUID))),
          getDocs(query(patientsCol, where('registeredBy', '==', doctorUID))),
        ]);
        const patientMap = new Map();
        [...snapAssoc.docs, ...snapReg.docs].forEach((d) =>
          patientMap.set(d.id, { id: d.id, ...d.data() })
        );
        const patientRows = Array.from(patientMap.values());
        const visiblePatients = patientRows.filter(
          (p) => p?.name && String(p.name).trim() && p?.phone && String(p.phone).trim()
        );
        const visiblePatientsCount = visiblePatients.length;

        // reports
        const colRep = collection(db, 'reports');
        const [repSnapUID, repSnapId] = await Promise.all([
          getDocs(query(colRep, where('doctorUID', '==', doctorUID))),
          getDocs(query(colRep, where('doctorId', '==', doctorUID))),
        ]);
        const repMap = new Map();
        [...repSnapUID.docs, ...repSnapId.docs].forEach((d) => repMap.set(d.id, { id: d.id, ...d.data() }));
        const repRows = Array.from(repMap.values());

        setCounts({
          appointments: todayAll.length,
          patients: visiblePatientsCount,
          reports: repRows.length,
        });
      } catch (e) {
        console.error(e);
        setErr(e?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isArabic]);

  const addPatient = () => setOpenAddPatient(true);
  const addReport = () => router.push(withLang('/patient-reports/new'));
  const openClinicReports = () => router.push(withLang('/clinic-reports'));
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

      <Box dir={isArabic ? 'rtl' : 'ltr'}>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <SectionCard isArabic={isArabic} tint={() => grad('#e9f3ff', '#ffffff')}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'primary.main', color: 'white' }}>Dr</Avatar>
              <Box>
                <Typography variant="overline" color="text.secondary">
                  {todayPretty}
                </Typography>
                <Typography variant="h5" fontWeight={800}>
                  {isArabic ? 'مرحباً بعودتك، د.' : 'Welcome back, Dr.'} {doctorName}
                </Typography>
              </Box>
            </Stack>
          </SectionCard>

          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : err ? (
            <Typography color="error">{err}</Typography>
          ) : (
            <>
              {/* Stats */}
              <Box
                sx={{
                  mt: 2,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
                  gap: 1.5,
                }}
              >
                <StatTile
                  icon={<CalendarTodayIcon />}
                  label={{ en: "Today's Appointments", ar: 'مواعيد اليوم' }}
                  count={counts.appointments}
                  href="/appointments"
                  isArabic={isArabic}
                  withLang={withLang}
                />
                <StatTile
                  icon={<PeopleAltIcon />}
                  label={{ en: 'Patients (You)', ar: 'المرضى (مسجّلين لديك)' }}
                  count={counts.patients}
                  href="/patients"
                  isArabic={isArabic}
                  withLang={withLang}
                />
                <StatTile
                  icon={<AnalyticsIcon />}
                  label={{ en: 'Reports', ar: 'تقارير' }}
                  count={counts.reports}
                  href="/patient-reports"
                  isArabic={isArabic}
                  withLang={withLang}
                />
              </Box>

              {/* Quick Actions */}
              <Box sx={{ mt: 3 }}>
                <QuickActions
                  isArabic={isArabic}
                  onAddPatient={addPatient}
                  onAddReport={addReport}
                  onOpenClinicReports={openClinicReports}
                />
              </Box>

              {/* Appointments */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" fontWeight={800}>
                  {isArabic ? 'المواعيد القادمة اليوم' : 'Upcoming Today'}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Stack spacing={1.25}>
                  {appointments.length === 0 ? (
                    <Typography color="text.secondary">
                      {isArabic ? 'لا توجد مواعيد قادمة اليوم' : 'No upcoming appointments today'}
                    </Typography>
                  ) : (
                    appointments.map((appt) => (
                      <AppointmentItem
                        key={appt.id}
                        appt={appt}
                        isArabic={isArabic}
                        withLang={withLang}
                      />
                    ))
                  )}
                </Stack>
              </Box>
            </>
          )}
        </Container>
      </Box>
    </AppLayout>
  );
}
