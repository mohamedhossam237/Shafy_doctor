// /pages/appointments/[id].jsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Box, Container, Paper, Stack, Typography, Button, Chip,
  Divider, CircularProgress, IconButton, Alert, Snackbar, Tooltip
} from '@mui/material';
import { motion } from 'framer-motion';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventIcon from '@mui/icons-material/Event';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PaymentIcon from '@mui/icons-material/Payment';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaceIcon from '@mui/icons-material/Place';
import AppLayout from '@/components/AppLayout';
import AddReportDialog from '@/components/reports/AddReportDialog';
import ReportViewDialog from '@/components/reports/ReportViewDialog';
import UpdateAppointmentDialog from '@/components/reports/UpdateAppointmentDialog';
import ExtraFeeDialog from '@/components/reports/ExtraFeeDialog';
import WhatsAppNotifyDialog from '@/components/reports/WhatsAppNotifyDialog';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, getDocs, query, where,
  updateDoc, serverTimestamp, collection
} from 'firebase/firestore';

/* ---------- helpers ---------- */
const toDate = (v) => (v?.toDate ? v.toDate() : new Date(v));
const toWaDigits = (raw) => String(raw || '').replace(/\D/g, '');
const safeNum = (v) => (Number.isFinite(+v) ? +v : 0);
const currencyLabel = (isAr) => (isAr ? 'ج.م' : 'EGP');

const translateStatus = (status, isAr) => {
  const map = {
    pending: isAr ? 'قيد الانتظار' : 'Pending',
    confirmed: isAr ? 'مؤكد' : 'Confirmed',
    completed: isAr ? 'مكتمل' : 'Completed',
    cancelled: isAr ? 'ملغي' : 'Cancelled',
  };
  return map[status] || status;
};

const fmtDate = (d, isAr = false) => {
  if (!d) return '—';
  const date = toDate(d);
  const locale = isAr ? 'ar-EG' : undefined;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'long', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).format(date);
};

const formatNumber = (n, isAr = false) => {
  const locale = isAr ? 'ar-EG' : 'en-US';
  return new Intl.NumberFormat(locale).format(n || 0);
};

const buildStatusMessage = ({ isAr, appt, newStatus, clinicLabel }) => {
  const when = fmtDate(appt.appointmentDate || appt.date, isAr);
  const dr = appt.doctorName_ar || appt.doctorName_en || '';
  const pt = appt.patientName || '';
  if (isAr) {
    const map = {
      confirmed: `مرحبًا ${pt}، تم تأكيد موعدك مع ${dr} ${clinicLabel ? `في ${clinicLabel}` : ''} بتاريخ ${when}.`,
      completed: `شكرًا ${pt}! تم إنهاء موعدك مع ${dr}.`,
      cancelled: `مرحبًا ${pt}، تم إلغاء موعدك مع ${dr}.`,
      pending: `طلب الموعد قيد المراجعة لزيارة ${dr}.`,
    };
    return map[newStatus] || map.pending;
  }
  const map = {
    confirmed: `Hi ${pt}, your appointment with ${dr} ${clinicLabel ? `at ${clinicLabel}` : ''} on ${when} is confirmed.`,
    completed: `Thank you ${pt}! Your appointment with ${dr} is completed.`,
    cancelled: `Hi ${pt}, your appointment with ${dr} has been cancelled.`,
    pending: `Hi ${pt}, your appointment request with ${dr} is pending review.`,
  };
  return map[newStatus] || map.pending;
};

/* ---------- main ---------- */
export default function AppointmentDetailsPage({ themeMode, setThemeMode }) {
  const router = useRouter();
  const { id } = router.query || {};
  const isAr = router.query?.lang === 'ar';
  const t = (en, ar) => (isAr ? ar : en);

  const [appt, setAppt] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [status, setStatus] = React.useState('pending');
  const [reports, setReports] = React.useState([]);
  const [reportsLoading, setReportsLoading] = React.useState(false);
  const [clinics, setClinics] = React.useState([]);
  const [queueNo, setQueueNo] = React.useState(null);
  const [snack, setSnack] = React.useState({ open: false, severity: 'info', msg: '' });

  // dialogs
  const [reportOpen, setReportOpen] = React.useState(false);
  const [viewReport, setViewReport] = React.useState(null);
  const [updateOpen, setUpdateOpen] = React.useState(false);
  const [extraDialogOpen, setExtraDialogOpen] = React.useState(false);
  const [waOpen, setWaOpen] = React.useState(false);
  const [waMsg, setWaMsg] = React.useState('');
  const [waDigits, setWaDigits] = React.useState('');

  /* ---------- load appointment ---------- */
  React.useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'appointments', String(id)));
        if (!snap.exists()) throw new Error(t('Appointment not found', 'لا يوجد موعد بهذا المعرف'));
        const data = { id: snap.id, ...snap.data() };
        setStatus(data.status || 'pending');
        setQueueNo(data.queueNumber || data.serialNumber || null);

        // ✅ Always use the doctor’s configured checkupPrice initially
        let doctorPrice = data.doctorPrice ?? data.checkupFee ?? 0;
        if (!doctorPrice && (data.doctorId || data.doctorUID)) {
          const docSnap = await getDoc(doc(db, 'doctors', String(data.doctorId || data.doctorUID)));
          if (docSnap.exists()) {
            const dData = docSnap.data();
            doctorPrice = Number(dData.checkupPrice || dData.price || 0);
            await updateDoc(doc(db, 'appointments', snap.id), { doctorPrice });
          }
        }
        setAppt({ ...data, doctorPrice });
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* ---------- load clinics ---------- */
  React.useEffect(() => {
    const run = async () => {
      if (!appt?.doctorId && !appt?.doctorUID) return;
      const snap = await getDoc(doc(db, 'doctors', String(appt.doctorId || appt.doctorUID)));
      if (snap.exists()) setClinics(snap.data().clinics || []);
    };
    run();
  }, [appt?.doctorId, appt?.doctorUID]);

  /* ---------- load reports ---------- */
  React.useEffect(() => {
    const run = async () => {
      if (!id) return;
      setReportsLoading(true);
      const qRef = query(collection(db, 'reports'), where('appointmentId', '==', String(id)));
      const snap = await getDocs(qRef);
      setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setReportsLoading(false);
    };
    run();
  }, [id]);

  /* ---------- update handler (with WhatsApp) ---------- */
  const handleUpdatedAppointment = async (updates) => {
    const clinicId = appt.clinicId || appt.clinicID;
    const clinicLabel = clinics.find((c) => c.id === clinicId)?.[isAr ? 'name_ar' : 'name_en'];
    const msg = buildStatusMessage({
      isAr,
      appt: { ...appt, ...updates },
      newStatus: updates.status || appt.status,
      clinicLabel,
    });
    const digits = toWaDigits(appt.patientPhone);
    setWaMsg(msg);
    setWaDigits(digits);
    setWaOpen(true);

    try {
      await updateDoc(doc(db, 'appointments', id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      setAppt((p) => ({ ...p, ...updates }));
      setSnack({ open: true, severity: 'success', msg: t('Appointment updated and message sent 📩', 'تم تحديث الموعد وإرسال تنبيه واتساب ✅') });
    } catch (e) {
      setSnack({ open: true, severity: 'error', msg: e.message });
    }
  };

  /* ---------- price / fees ---------- */
  const price = appt?.doctorPrice ?? 0;
  const extraFees = appt?.extraFees ?? [];
  const extraTotal = extraFees.reduce((s, f) => s + safeNum(f.amount), 0);
  const grandTotal = price + extraTotal;
  const clinicId = appt?.clinicId || appt?.clinicID;
  const clinicLabel = clinics.find((c) => c.id === clinicId)?.[isAr ? 'name_ar' : 'name_en'];

  /* ---------- UI ---------- */
  if (loading)
    return (
      <AppLayout themeMode={themeMode} setThemeMode={setThemeMode}>
        <Container sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Container>
      </AppLayout>
    );
  if (err)
    return (
      <AppLayout themeMode={themeMode} setThemeMode={setThemeMode}>
        <Container sx={{ py: 4 }}><Alert severity="error">{err}</Alert></Container>
      </AppLayout>
    );

  return (
    <AppLayout themeMode={themeMode} setThemeMode={setThemeMode}>
      <Container
        maxWidth="md"
        sx={{
          py: { xs: 2, md: 4 },
          direction: isAr ? 'rtl' : 'ltr',
          textAlign: isAr ? 'right' : 'left',
          fontFamily: isAr ? 'Cairo, sans-serif' : undefined,
        }}
      >
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}>
          <Box
            sx={{
              p: 3, mb: 3, color: 'white',
              borderRadius: 3,
              background: 'linear-gradient(135deg,#1E4E8C 0%,#A22727 100%)',
              boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack>
                <Typography variant="h5" fontWeight={900}>
                  {t('Appointment Details', 'تفاصيل الموعد')}
                </Typography>
                {queueNo && (
                  <Typography variant="body2" sx={{ mt: 0.3, color: 'rgba(255,255,255,0.9)' }}>
                    {t('Serial Number', 'الرقم التسلسلي')}: #{formatNumber(queueNo, isAr)}
                  </Typography>
                )}
                <Typography variant="body2" color="rgba(255,255,255,0.8)">
                  {t('Status', 'الحالة')}: {translateStatus(status, isAr)}
                </Typography>
              </Stack>
              <Chip
                icon={<CheckCircleIcon />}
                label={translateStatus(status, isAr)}
                sx={{
                  bgcolor:
                    status === 'completed'
                      ? '#4caf50'
                      : status === 'confirmed'
                      ? '#0288d1'
                      : status === 'cancelled'
                      ? '#757575'
                      : '#ff9800',
                  color: '#fff', fontWeight: 700,
                }}
              />
            </Stack>
          </Box>
        </motion.div>

        {/* Main Card */}
        <Paper sx={{ p: 3, borderRadius: 4, boxShadow: '0 3px 15px rgba(0,0,0,0.05)' }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LocalHospitalIcon color="primary" />
              <Typography fontWeight={700}>{t('Doctor', 'الطبيب')}:</Typography>
              <Typography>{isAr ? appt?.doctorName_ar || appt?.doctorName_en : appt?.doctorName_en || appt?.doctorName_ar}</Typography>
            </Stack>

            {clinicLabel && (
              <Stack direction="row" spacing={1} alignItems="center">
                <PlaceIcon color="action" />
                <Typography fontWeight={700}>{t('Clinic', 'العيادة')}:</Typography>
                <Typography>{clinicLabel}</Typography>
              </Stack>
            )}

            <Stack direction="row" spacing={1} alignItems="center">
              <EventIcon color="action" />
              <Typography fontWeight={700}>{t('Date/Time', 'التاريخ / الوقت')}:</Typography>
              <Typography color="text.secondary">{fmtDate(appt.appointmentDate || appt.date, isAr)}</Typography>
            </Stack>

            <Divider />

            <Stack direction="row" spacing={1} alignItems="center">
              <PersonIcon color="action" />
              <Typography fontWeight={700}>{t('Patient', 'المريض')}:</Typography>
              <Typography>{appt.patientName}</Typography>
              {appt.patientPhone && (
                <Tooltip title={t('Send WhatsApp message', 'إرسال واتساب')}>
                  <IconButton
                    color="success"
                    onClick={() => {
                      const msg = buildStatusMessage({ isAr, appt, newStatus: status, clinicLabel });
                      const digits = toWaDigits(appt.patientPhone);
                      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                  >
                    <WhatsAppIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography fontWeight={700}>{t('Payment Details', 'تفاصيل الدفع')}</Typography>
              <Stack direction="row" spacing={1}>
                <PaymentIcon color="primary" />
                <Typography>
                  {t('Checkup Fee', 'رسوم الكشف')}: {formatNumber(price, isAr)} {currencyLabel(isAr)}
                </Typography>
              </Stack>
              <Divider />
              <Typography align={isAr ? 'left' : 'right'} variant="h6" fontWeight={900}>
                {t('Grand Total', 'الإجمالي النهائي')}: {formatNumber(grandTotal, isAr)} {currencyLabel(isAr)}
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setExtraDialogOpen(true)}>
                {t('Add Extra Fee', 'إضافة تكلفة')}
              </Button>
            </Stack>

            <Divider />

            <Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography fontWeight={900}>{t('Reports', 'التقارير')}</Typography>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setReportOpen(true)}>
                  {t('Add Report', 'إضافة تقرير')}
                </Button>
              </Stack>
              {reportsLoading ? (
                <CircularProgress size={20} />
              ) : reports.length === 0 ? (
                <Typography color="text.secondary">{t('No reports yet', 'لا توجد تقارير بعد')}</Typography>
              ) : (
                <Stack spacing={1.25} mt={1}>
                  {reports.map((r) => (
                    <Paper
                      key={r.id}
                      variant="outlined"
                      sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <Stack>
                        <Typography fontWeight={700}>{r.titleAr || r.titleEn || '—'}</Typography>
                        <Typography variant="body2" color="text.secondary">{fmtDate(r.date, isAr)}</Typography>
                      </Stack>
                      <Button onClick={() => setViewReport(r)}>{t('View', 'عرض')}</Button>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>

            <Divider />
            <Stack direction="row" justifyContent="space-between">
              <Button component={Link} href={`/appointments${isAr ? '?lang=ar' : ''}`} startIcon={<ArrowBackIcon />}>
                {t('Back', 'رجوع')}
              </Button>
              <Button variant="contained" startIcon={<ScheduleIcon />} onClick={() => setUpdateOpen(true)}>
                {t('Update Appointment', 'تحديث الموعد')}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {/* Dialogs */}
        <AddReportDialog open={reportOpen} onClose={() => setReportOpen(false)} appointmentId={id} isArabic={isAr} />
        <ReportViewDialog open={Boolean(viewReport)} onClose={() => setViewReport(null)} report={viewReport} isAr={isAr} />
        <UpdateAppointmentDialog
          open={updateOpen}
          onClose={() => setUpdateOpen(false)}
          appointment={appt}
          isAr={isAr}
          onSaved={handleUpdatedAppointment}
        />
        <ExtraFeeDialog open={extraDialogOpen} onClose={() => setExtraDialogOpen(false)} isAr={isAr} />
        <WhatsAppNotifyDialog open={waOpen} onClose={() => setWaOpen(false)} isAr={isAr} message={waMsg} phoneDigits={waDigits} />

        <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          <Alert severity={snack.severity}>{snack.msg}</Alert>
        </Snackbar>
      </Container>
    </AppLayout>
  );
}
