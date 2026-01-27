// /pages/patient-report/new.js
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
  Button,
  Chip,
  Snackbar,
  Alert,
  Grid,
  Avatar,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ScienceIcon from '@mui/icons-material/Science';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';

import AddLabReportDialog from '@/components/reports/AddLabReportDialog';

function OptionCard({ onClick, icon, title, subtitle, color = 'primary', isArabic }) {
  return (
    <Paper
      role="button"
      onClick={onClick}
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
        cursor: 'pointer',
        transition: 'transform .14s ease, box-shadow .14s ease, background .14s ease',
        '&:hover': {
          transform: { sm: 'translateY(-3px)' },
          boxShadow: { sm: '0 12px 24px rgba(0,0,0,.10)' },
          background: (t) => alpha(t.palette[color].light, 0.06),
        },
        textAlign: isArabic ? 'right' : 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minHeight: 88,
      }}
    >
      <Avatar sx={{ bgcolor: `${color}.main`, color: 'common.white', width: 48, height: 48 }}>
        {icon}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.15 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {subtitle}
        </Typography>
      </Box>
      <AddCircleOutlineIcon sx={{ color: 'text.disabled', transform: isArabic ? 'rotate(180deg)' : 'none' }} />
    </Paper>
  );
}

export default function NewPatientReportPage() {
  const router = useRouter();

  // Arabic default unless overridden
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : `${path}${path.includes('?') ? '&' : '?'}lang=en`),
    [isArabic]
  );

  // Optional: link report to an appointment via ?appointmentId=...
  const appointmentId = React.useMemo(() => {
    const q = router?.query || {};
    return q.appointmentId ? String(q.appointmentId) : '';
  }, [router.query]);

  const [openLab, setOpenLab] = React.useState(false);

  const [snack, setSnack] = React.useState({ open: false, severity: 'success', msg: '' });

  const onSaved = React.useCallback(
    (saved) => {
      setSnack({
        open: true,
        severity: 'success',
        msg: t('Report saved', 'تم حفظ التقرير'),
      });
      // After save, go to the reports list (keeps lang)
      router.push(withLang('/patient-reports'));
    },
    [router, t, withLang]
  );

  return (
    <Protected>
      <AppLayout>
        <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
          <Container maxWidth="md" sx={{ px: { xs: 1.25, sm: 2 } }}>
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1, mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Button
                  component={Link}
                  href={withLang('/patient-reports')}
                  startIcon={isArabic ? null : <ArrowBackIcon />}
                  endIcon={isArabic ? <ArrowBackIcon /> : null}
                >
                  {t('Back to Reports', 'العودة للتقارير')}
                </Button>
              </Stack>

              {appointmentId ? (
                <Chip
                  color="primary"
                  variant="outlined"
                  label={t(`Linked to appointment: ${appointmentId}`, `مرتبط بموعد: ${appointmentId}`)}
                  sx={{ fontWeight: 700 }}
                />
              ) : null}
            </Stack>

            <Typography variant="h5" fontWeight={900} sx={{ mb: 1 }}>
              {t('Add a new report', 'إضافة تقرير جديد')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t(
                'Choose what you want to add:',
                'اختر نوع التقرير الذي تريد إضافته:'
              )}
            </Typography>

            {/* Two options */}
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <OptionCard
                  onClick={() => {
                    const href = `/prescription/new${isArabic ? '?lang=ar' : ''}${appointmentId ? `&appointmentId=${appointmentId}` : ''}`;
                    router.push(href);
                  }}
                  icon={<LocalHospitalIcon />}
                  title={t('Prescription', 'وصفة طبية')}
                  subtitle={t('Create a medical prescription with medications and required tests.', 'إنشاء وصفة طبية تحتوي على الأدوية والفحوصات المطلوبة.')}
                  color="primary"
                  isArabic={isArabic}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <OptionCard
                  onClick={() => setOpenLab(true)}
                  icon={<ScienceIcon />}
                  title={t('Lab Report', 'تقرير معملي')}
                  subtitle={t('Enter lab tests, units, reference ranges, and attach scans.', 'إدخال التحاليل والوحدات والمدى المرجعي مع إمكانية إرفاق صور التقرير.')}
                  color="secondary"
                  isArabic={isArabic}
                />
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Dialogs */}
        <AddLabReportDialog
          open={openLab}
          onClose={() => setOpenLab(false)}
          isArabic={isArabic}
          onSaved={onSaved}
          appointmentId={appointmentId}
        />

        {/* Snackbar */}
        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} variant="filled">
            {snack.msg}
          </Alert>
        </Snackbar>
      </AppLayout>
    </Protected>
  );
}
