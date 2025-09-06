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
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// recharts
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

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

export default function ClinicReportsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Arabic is default unless explicitly overridden
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const [loading, setLoading] = React.useState(true);
  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });

  // summary
  const [totalAppointments, setTotalAppointments] = React.useState(0);
  const [completedSessions, setCompletedSessions] = React.useState(0);
  const [patientsSeen, setPatientsSeen] = React.useState(0);
  const [missedAppointments, setMissedAppointments] = React.useState(0);

  // money
  const [income, setIncome] = React.useState([0, 0, 0, 0]); // consult, procedures, meds, follow-up
  const [checkupPrice, setCheckupPrice] = React.useState(0);
  const [priceInput, setPriceInput] = React.useState('');

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : `${path}${path.includes('?') ? '&' : '?'}lang=en`),
    [isArabic]
  );

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        // Summary doc (like the Flutter version)
        const repRef = doc(db, 'clinic_reports_summary', 'today');
        const repSnap = await getDoc(repRef);
        if (repSnap.exists()) {
          const d = repSnap.data() || {};
          setTotalAppointments(d.totalAppointments ?? 0);
          setCompletedSessions(d.completedSessions ?? 0);
          setPatientsSeen(d.patientsSeen ?? 0);
          setMissedAppointments(d.missedAppointments ?? 0);
          setIncome([
            Number(d.consultRevenue ?? 0),
            Number(d.proceduresRevenue ?? 0),
            Number(d.medsRevenue ?? 0),
            Number(d.followUpRevenue ?? 0),
          ]);
        }

        // Doctor doc for price
        const docRef = doc(db, 'doctors', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const d = docSnap.data() || {};
          setCheckupPrice(Number(d.checkupPrice ?? 0));
        }
      } catch (e) {
        setSnack({ open: true, message: e?.message || 'Failed to load reports', severity: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

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

  const chartData = React.useMemo(() => {
    const labelsEn = ['Consult', 'Procedures', 'Meds', 'Follow-up'];
    const labelsAr = ['استشارة', 'إجراءات', 'أدوية', 'متابعة'];
    return (isArabic ? labelsAr : labelsEn).map((name, i) => ({
      name,
      value: Number(income[i] || 0),
    }));
  }, [income, isArabic]);

  const totalRevenue = React.useMemo(() => income.reduce((a, b) => a + Number(b || 0), 0), [income]);

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
              {/* Summary tiles */}
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    isArabic={isArabic}
                    icon={<CalendarTodayIcon color="primary" />}
                    title={isArabic ? 'إجمالي المواعيد' : 'Total Appointments'}
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
                    title={isArabic ? 'عدد المرضى' : 'Patients Seen'}
                    value={patientsSeen}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <StatCard
                    isArabic={isArabic}
                    icon={<CancelIcon color="warning" />}
                    title={isArabic ? 'المواعيد الفائتة' : 'Missed Appointments'}
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

              {/* Performance note */}
              <Paper sx={{ mt: 2, p: 2, borderRadius: 3 }} elevation={0}>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1 }}>
                  {isArabic ? 'تحليل الأداء' : 'Performance Overview'}
                </Typography>
                <Typography color="text.secondary">
                  {isArabic
                    ? 'شهدت العيادة أداءً جيدًا هذا الأسبوع مع زيادة عدد المرضى وإكمال معظم الجلسات بنجاح.'
                    : 'The clinic performed well this week with a high number of patients and most sessions completed successfully.'}
                </Typography>
              </Paper>

              {/* Financial chart */}
              <Paper sx={{ mt: 2, p: 2, borderRadius: 3 }} elevation={0}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ mb: 1.5 }}
                >
                  <Typography variant="h6" fontWeight={800}>
                    {isArabic ? 'التقارير المالية' : 'Financial Reports'}
                  </Typography>
                  <Typography color="text.secondary">
                    {isArabic
                      ? `إجمالي الإيرادات لهذا الشهر: ${Math.round(totalRevenue)}`
                      : `Total Revenue This Month: QAR ${Math.round(totalRevenue)}`}
                  </Typography>
                </Stack>
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
