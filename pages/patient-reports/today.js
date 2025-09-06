// /pages/patient-reports/today.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Grid,
  Paper,
  Skeleton,
  CircularProgress,
  Snackbar,
  Fab,
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

import ReportsHeader from '@/components/reports/ReportsHeader';
import ReportList from '@/components/reports/ReportList';
import AddReportDialog from '@/components/reports/AddReportDialog';

// Helpers
function dayBounds(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
function toDate(val) {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate(); // Firestore Timestamp
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return val instanceof Date ? val : null;
}
const withLangFactory = (isArabic) => (p) =>
  isArabic ? `${p}${p.includes('?') ? '&' : '?'}lang=ar` : p;

export default function TodayPatientReports() {
  const router = useRouter();
  const { user } = useAuth();

  // Arabic is default unless ?lang=en
  const isArabic = React.useMemo(
    () => (router?.query?.lang ? router.query.lang === 'ar' : true),
    [router?.query?.lang]
  );
  const withLang = React.useMemo(() => withLangFactory(isArabic), [isArabic]);

  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [tab, setTab] = React.useState(0);

  const [clinicReports, setClinicReports] = React.useState([]);
  const [otherReports, setOtherReports] = React.useState([]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { start, end } = dayBounds();

        // Query only by doctorUID (avoid composite index); filter by date client-side
        const qRef = query(collection(db, 'reports'), where('doctorUID', '==', user.uid));
        const snap = await getDocs(qRef);

        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const todays = rows.filter((r) => {
          const dt = toDate(r.date);
          return dt && dt >= start && dt < end;
        });

        const clinic = [];
        const other = [];
        todays.forEach((r) => {
          const item = {
            id: r.id,
            titleEn: r.titleEn || r.title || 'Medical Report',
            titleAr: r.titleAr || r.title || 'تقرير طبي',
            date: toDate(r.date),
            patientID: r.patientID || r.patientId,
            patientName: r.patientName,
            type: (r.type || r.reportType || '').toString().toLowerCase(),
          };
          if (item.type === 'clinic') clinic.push(item);
          else other.push(item);
        });

        clinic.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
        other.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

        setClinicReports(clinic);
        setOtherReports(other);
      } catch (e) {
        setErr(e?.message || 'Failed to load');
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isArabic]);

  if (!mounted) return null;

  const totalCount = clinicReports.length + otherReports.length;

  const onSaved = (newItem) => {
    if (!newItem) return;
    const type = (newItem.type || newItem.reportType || '').toLowerCase();
    if (type === 'clinic') {
      setClinicReports((prev) => [newItem, ...prev]);
      setTab(0);
    } else {
      setOtherReports((prev) => [newItem, ...prev]);
      setTab(1);
    }
    setSnack({ open: true, msg: isArabic ? 'تم إضافة التقرير' : 'Report added', severity: 'success' });
  };

  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container disableGutters maxWidth="lg">
          <ReportsHeader isArabic={isArabic} totalCount={totalCount} tab={tab} onTabChange={setTab} />

          {loading ? (
            <Box sx={{ py: 3 }}>
              <Grid container spacing={2}>
                {[...Array(6)].map((_, i) => (
                  <Grid key={i} item xs={12}>
                    <Skeleton variant="rounded" height={72} />
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            </Box>
          ) : err ? (
            <Paper sx={{ p: 3, my: 3, borderRadius: 3 }}>
              <Box sx={{ color: 'error.main', fontWeight: 700, whiteSpace: 'pre-wrap' }}>
                {isArabic ? 'حدث خطأ' : 'Error'}: {err}
              </Box>
            </Paper>
          ) : (
            <Box sx={{ mt: 2 }}>
              {tab === 0 ? (
                <ReportList
                  rows={clinicReports}
                  isArabic={isArabic}
                  withLang={withLang}
                  emptyText={isArabic ? 'لا توجد تقارير عيادة اليوم' : 'No clinic reports today'}
                />
              ) : (
                <ReportList
                  rows={otherReports}
                  isArabic={isArabic}
                  withLang={withLang}
                  emptyText={isArabic ? 'لا توجد تقارير أخرى اليوم' : 'No other reports today'}
                />
              )}
            </Box>
          )}
        </Container>

        <Fab
          color="primary"
          aria-label="add"
          onClick={() => setDialogOpen(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: isArabic ? 'auto' : 24,
            left: isArabic ? 24 : 'auto',
            zIndex: (t) => t.zIndex.fab,
          }}
        >
          <AddIcon />
        </Fab>

        <AddReportDialog open={dialogOpen} onClose={() => setDialogOpen(false)} isArabic={isArabic} onSaved={onSaved} />

        <Snackbar
          open={snack.open}
          autoHideDuration={3500}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <MuiAlert
            severity={snack.severity}
            onClose={() => setSnack((s) => ({ ...s, open: false }))}
            variant="filled"
          >
            {snack.msg}
          </MuiAlert>
        </Snackbar>
      </Box>
    </AppLayout>
  );
}
