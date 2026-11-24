// /pages/patient-reports/new.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

import {
  Box,
  Container,
  Stack,
  Typography,
  Button,
  Chip,
  Snackbar,
  Alert,
} from '@mui/material';

import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';

import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';
import AddLabReportDialog from '@/components/reports/AddLabReportDialog';

export default function NewPatientReportPage() {
  const router = useRouter();

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

  const appointmentId = React.useMemo(() => {
    const q = router?.query || {};
    return q.appointmentId ? String(q.appointmentId) : '';
  }, [router.query]);

  const patientId = React.useMemo(() => {
    const q = router?.query || {};
    return q.patientId ? String(q.patientId) : '';
  }, [router.query]);

  const [openLab, setOpenLab] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, severity: 'success', msg: '' });

  const onSaved = React.useCallback(() => {
    setSnack({
      open: true,
      severity: 'success',
      msg: t('Report saved', 'تم حفظ التقرير بنجاح'),
    });
    router.push(withLang('/patient-reports'));
  }, [router, t, withLang]);

  const goPrescription = () => {
    const params = new URLSearchParams();
    params.set('lang', isArabic ? 'ar' : 'en');
    if (appointmentId) params.set('appointmentId', appointmentId);
    if (patientId) params.set('patientId', patientId);
    router.push(`/prescription/new?${params.toString()}`);
  };

  const options = [
    {
      key: 'rx',
      onClick: goPrescription,
      icon: <LocalHospitalRoundedIcon sx={{ fontSize: 32, color: '#ffffff' }} />,
      accent: '#2563eb',
      gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      softBg: '#eff6ff',
      badge: t('Most Used', 'الأكثر استخداماً'),
      title: t('Clinical Report & Prescription', 'وصفة طبية وتقرير سريري'),
      subtitle: t(
        'Full clinical consultation with diagnosis, quick vitals presets, smart drug autocomplete, requested labs, print & WhatsApp.',
        'تقرير سريري وروشتة متكاملة مع التشخيص، العلامات الحيوية السريعة، البحث الذكي للأدوية، الفحوصات، الطباعة ومشاركة واتساب.'
      ),
      features: isArabic
        ? ['اقتراحات ذكية AI', 'جرعات سريعة بضغطة واحدة', 'طباعة وواتساب']
        : ['AI Suggestions', '1-Tap Dose Chips', 'Print & WhatsApp'],
      cta: t('Start Prescription', 'بدء كتابة الوصفة'),
    },
    {
      key: 'lab',
      onClick: () => setOpenLab(true),
      icon: <ScienceRoundedIcon sx={{ fontSize: 32, color: '#ffffff' }} />,
      accent: '#4f46e5',
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      softBg: '#eef2ff',
      badge: t('OCR + AI Fill', 'مسح OCR + ذكاء اصطناعي'),
      title: t('Lab & Diagnostic Report', 'تقرير تحاليل معملية'),
      subtitle: t(
        'Enter lab results with 1-click standard panels (CBC, HbA1c, Lipid, Liver, Kidney) or scan paper labs with OCR & AI auto-fill.',
        'إدخال نتائج التحاليل بقوالب جاهزة (CBC, سكر تراكمي, دهون, كبد, كلى) أو تصوير الورقة واستخراج النتائج تلقائياً بالذكاء الاصطناعي.'
      ),
      features: isArabic
        ? ['قوالب تحاليل جاهزة', 'قراءة الورقة بـ OCR', 'ملء تلقائي AI']
        : ['Quick Lab Panels', 'Paper OCR Scan', 'AI Auto-Fill'],
      cta: t('Open Lab Entry', 'فتح إدخال التحليل'),
    },
  ];

  return (
    <Protected>
      <AppLayout
        title={t('Create Patient Report', 'إضافة تقرير طبي للمريض')}
        subtitle={t('Choose clinical prescription or lab diagnostics entry', 'اختر نوع التقرير السريري أو المعملي لبدء الإدخال السريع')}
      >
        <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
          <Container maxWidth="lg" disableGutters>
            {/* Royal Sapphire Hero Header */}
            <div className="shafy-hero-shell" style={{ padding: '26px 28px', marginBottom: '24px' }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                spacing={2}
                sx={{ position: 'relative', zIndex: 2 }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <div
                    style={{
                      width: '58px',
                      height: '58px',
                      borderRadius: '18px',
                      background: 'rgba(255,255,255,0.16)',
                      border: '1.5px solid rgba(255,255,255,0.34)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <DescriptionRoundedIcon sx={{ fontSize: 30, color: '#ffffff' }} />
                  </div>
                  <Box>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#ffffff', fontSize: { xs: '1.35rem', md: '1.7rem' } }}>
                      {t('Add a New Medical Report', 'إنشاء تقرير طبي جديد')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#dbeafe', mt: 0.4, fontWeight: 600 }}>
                      {t('Select report type to launch the fast clinical entry workspace', 'اختر نوع التقرير لفتح مساحة الإدخال السريع')}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                  {appointmentId && (
                    <Chip
                      label={t(`Appointment: ${appointmentId.slice(0, 8)}`, `مرتبط بموعد: ${appointmentId.slice(0, 8)}`)}
                      sx={{ bgcolor: 'rgba(254,240,138,0.2)', color: '#fef08a', fontWeight: 800, border: '1px solid rgba(254,240,138,0.45)' }}
                    />
                  )}
                  <Button
                    component={Link}
                    href={withLang('/patient-reports')}
                    startIcon={isArabic ? null : <ArrowBackRoundedIcon />}
                    endIcon={isArabic ? <ArrowBackRoundedIcon /> : null}
                    sx={{
                      color: '#ffffff',
                      bgcolor: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '12px',
                      px: 2.2,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                    }}
                  >
                    {t('Back to Reports', 'العودة للتقارير')}
                  </Button>
                </Stack>
              </Stack>
            </div>

            {/* Two Rich Interactive Choice Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '20px' }}>
              {options.map((opt) => (
                <div
                  key={opt.key}
                  role="button"
                  tabIndex={0}
                  onClick={opt.onClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') opt.onClick();
                  }}
                  className="glass-panel glass-panel-lift"
                  style={{
                    padding: '26px',
                    borderTop: `4px solid ${opt.accent}`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '18px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '18px',
                          background: opt.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 10px 24px -6px ${opt.accent}66`,
                        }}
                      >
                        {opt.icon}
                      </div>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 12px',
                          borderRadius: '999px',
                          background: opt.softBg,
                          color: opt.accent,
                          fontSize: '0.75rem',
                          fontWeight: 900,
                        }}
                      >
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />
                        <span>{opt.badge}</span>
                      </span>
                    </div>

                    <Typography variant="h5" fontWeight={900} sx={{ color: '#0f172a', mb: 1 }}>
                      {opt.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.65, fontWeight: 600 }}>
                      {opt.subtitle}
                    </Typography>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
                      {opt.features.map((feat) => (
                        <span
                          key={feat}
                          style={{
                            padding: '4px 11px',
                            borderRadius: '999px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#334155',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                          }}
                        >
                          ✓ {feat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '14px',
                      borderTop: '1px solid #f1f5f9',
                      color: opt.accent,
                      fontWeight: 900,
                      fontSize: '0.92rem',
                    }}
                  >
                    <span>{opt.cta}</span>
                    <ArrowForwardRoundedIcon
                      sx={{ fontSize: 20, transform: isArabic ? 'rotate(180deg)' : 'none' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </Box>

        <AddLabReportDialog
          open={openLab}
          onClose={() => setOpenLab(false)}
          isArabic={isArabic}
          onSaved={onSaved}
          appointmentId={appointmentId}
        />

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
