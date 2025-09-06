// /pages/clinic-reports/[reportId].js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box, Container, Paper, Stack, Typography, IconButton, Avatar, Chip, Divider, Button, Skeleton,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

function formatDateTime(iso, isAr) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(isAr ? 'ar' : undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch {
    return isAr ? 'بدون تاريخ' : 'No Date';
  }
}

export default function ClinicReportDetailPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { reportId } = router.query;

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar)   return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : `${path}${path.includes('?') ? '&' : '?'}lang=en`),
    [isArabic]
  );

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    if (!user || !reportId) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'clinic_reports', String(reportId)));
        setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, reportId]);

  const title = data?.title || (isArabic ? 'تقرير طبي' : 'Medical Report');
  const dateStr = data?.createdAt ? formatDateTime(data.createdAt, isArabic) : (isArabic ? 'بدون تاريخ' : 'No Date');
  const type = String(data?.reportType || 'clinic').toLowerCase();
  const typeLabel = isArabic ? (type === 'clinic' ? 'عيادة' : 'أخرى') : (type === 'clinic' ? 'Clinic' : 'Other');
  const details = data?.details || data?.content || (isArabic ? 'تفاصيل التقرير هنا...' : 'Report details go here...');

  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container disableGutters maxWidth="md">
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <IconButton size="small" onClick={() => router.back()} sx={{ transform: isArabic ? 'scaleX(-1)' : 'none' }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h5" fontWeight={800}>{isArabic ? 'تقرير طبي' : 'Medical Report'}</Typography>
          </Stack>

          <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }} elevation={0}>
            {loading ? (
              <>
                <Skeleton variant="rounded" height={72} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={180} />
              </>
            ) : !data ? (
              <Typography color="text.secondary">{isArabic ? 'التقرير غير موجود' : 'Report not found'}</Typography>
            ) : (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
                  <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                    <DescriptionIcon />
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6" fontWeight={800} noWrap title={title}>{title}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                      <EventIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.secondary">{dateStr}</Typography>
                      <Divider flexItem orientation="vertical" sx={{ mx: 1 }} />
                      <Chip size="small" label={typeLabel} variant="outlined" />
                    </Stack>
                  </Box>
                  {!!data?.patientId && (
                    <Button variant="outlined" startIcon={<PersonIcon />} onClick={() => router.push(withLang(`/patients/${data.patientId}`))} sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}>
                      {isArabic ? 'بيانات المريض' : 'Patient Profile'}
                    </Button>
                  )}
                </Stack>

                <Divider sx={{ my: 2 }} />
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{details}</Typography>
              </>
            )}
          </Paper>
        </Container>
      </Box>
    </AppLayout>
  );
}
