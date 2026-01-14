// /pages/appointments/[id].jsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Box, Container, Paper, Stack, Typography, Button, Chip,
  Divider, CircularProgress, Alert, Snackbar
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PaymentIcon from '@mui/icons-material/Payment';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaceIcon from '@mui/icons-material/Place';
import PhoneIcon from '@mui/icons-material/Phone';
import DescriptionIcon from '@mui/icons-material/Description';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AppLayout from '@/components/AppLayout';
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
// Format phone number for WhatsApp: always use +20 for Egyptian numbers
const toWaDigits = (raw) => {
  const phoneRaw = String(raw || '').replace(/\D/g, '');
  if (!phoneRaw) return '';
  
  // Always treat as Egyptian number: +20 (Egypt country code for WhatsApp)
  let phoneDigits = phoneRaw.replace(/^0+/, '');
  if (phoneDigits.startsWith('20')) {
    // Already starts with 20
    return `+${phoneDigits}`;
  } else {
    // Add +20 (Egypt country code for WhatsApp)
    return `+20${phoneDigits}`;
  }
};
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

// Get patient ID from appointment (checking all possible field names)
function getPatientId(appt) {
  if (!appt) return null;
  return appt.patientId || appt.patientUID || appt.patientID || appt.patientUid || null;
}

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
  }, [id, t]);

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
        <Box
          sx={{
            position: 'relative',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.03) 0%, rgba(66, 165, 245, 0.01) 50%, rgba(255, 152, 0, 0.02) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Container sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={60} sx={{ color: 'primary.main' }} />
          </Container>
        </Box>
      </AppLayout>
    );
  if (err)
    return (
      <AppLayout themeMode={themeMode} setThemeMode={setThemeMode}>
        <Box
          sx={{
            position: 'relative',
            minHeight: '100vh',
            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.03) 0%, rgba(66, 165, 245, 0.01) 50%, rgba(255, 152, 0, 0.02) 100%)',
            py: 4,
          }}
        >
          <Container>
            <Alert severity="error" sx={{ borderRadius: 3, p: 3 }}>{err}</Alert>
          </Container>
        </Box>
      </AppLayout>
    );

  const handleWhatsAppContact = () => {
    if (!appt?.patientPhone) return;
    const msg = buildStatusMessage({ isAr, appt, newStatus: status, clinicLabel });
    const digits = toWaDigits(appt.patientPhone);
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <AppLayout themeMode={themeMode} setThemeMode={setThemeMode}>
      <Box
        sx={{
          minHeight: '100vh',
          pb: 4,
          bgcolor: 'background.default',
        }}
      >
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
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap">
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <Typography variant="h5" fontWeight={700}>
                      {t('Appointment Details', 'تفاصيل الموعد')}
                    </Typography>
                    {appt?.appointmentType && (
                      <Chip
                        size="small"
                        label={
                          appt.appointmentType === 'followup'
                            ? (isAr ? 'إعادة كشف' : 'Re-examination')
                            : (isAr ? 'كشف' : 'Checkup')
                        }
                        color={appt.appointmentType === 'followup' ? 'secondary' : 'primary'}
                        sx={{
                          height: 28,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      />
                    )}
                  </Stack>
                  {queueNo && (
                    <Typography variant="body2" color="text.secondary">
                      {t('Serial Number', 'الرقم التسلسلي')}: #{formatNumber(queueNo, isAr)}
                    </Typography>
                  )}
                </Stack>
                <Chip
                  icon={<CheckCircleIcon />}
                  label={translateStatus(status, isAr)}
                  color={
                    status === 'completed' ? 'success' :
                    status === 'confirmed' ? 'info' :
                    status === 'cancelled' ? 'default' : 'warning'
                  }
                  sx={{ fontWeight: 700, height: 36 }}
                />
              </Stack>
            </Paper>

            {/* WhatsApp Contact Button */}
            {appt?.patientPhone && (
              <Button
                fullWidth
                variant="contained"
                startIcon={<WhatsAppIcon />}
                onClick={handleWhatsAppContact}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: '#25D366',
                  fontWeight: 700,
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
                  '&:hover': {
                    bgcolor: '#20BA5A',
                    boxShadow: '0 6px 16px rgba(37, 211, 102, 0.4)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                {t('Contact Patient via WhatsApp', 'التواصل مع المريض عبر واتساب')}
              </Button>
            )}
          </Stack>

          {/* Main Card */}
          <Paper elevation={2} sx={{ p: 3, borderRadius: 3 }}>
            <Stack spacing={3}>
              {/* Basic Information */}
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <LocalHospitalIcon color="primary" />
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      {t('Doctor', 'الطبيب')}
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {isAr ? appt?.doctorName_ar || appt?.doctorName_en : appt?.doctorName_en || appt?.doctorName_ar}
                    </Typography>
                  </Box>
                </Stack>

                {clinicLabel && (
                  <Stack direction="row" spacing={2} alignItems="center">
                    <PlaceIcon color="success" />
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
                        {t('Clinic', 'العيادة')}
                      </Typography>
                      <Typography variant="h6" fontWeight={700}>
                        {clinicLabel}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                <Stack direction="row" spacing={2} alignItems="center">
                  <ScheduleIcon color="warning" />
                  <Box>
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      {t('Date/Time', 'التاريخ / الوقت')}
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {fmtDate(appt.appointmentDate || appt.date, isAr)}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center">
                  <PersonIcon color="secondary" />
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
                        {t('Patient', 'المريض')}
                      </Typography>
                      {appt?.appointmentType && (
                        <Chip
                          size="small"
                          label={
                            appt.appointmentType === 'followup'
                              ? (isAr ? 'إعادة كشف' : 'Re-examination')
                              : (isAr ? 'كشف' : 'Checkup')
                          }
                          color={appt.appointmentType === 'followup' ? 'secondary' : 'primary'}
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        />
                      )}
                    </Stack>
                    {(() => {
                      const patientId = getPatientId(appt);
                      const patientHref = patientId ? `/patients/${patientId}${isAr ? '?lang=ar' : ''}` : null;
                      
                      if (patientHref) {
                        return (
                          <Link href={patientHref} style={{ textDecoration: 'none' }}>
                            <Typography 
                              variant="h6" 
                              fontWeight={700}
                              sx={{
                                cursor: 'pointer',
                                color: 'primary.main',
                                display: 'inline-block',
                                transition: 'all 0.2s ease',
                                borderBottom: '2px solid transparent',
                                '&:hover': {
                                  opacity: 0.85,
                                  borderBottomColor: 'primary.main',
                                  transform: 'translateY(-1px)',
                                },
                              }}
                            >
                              {appt.patientName}
                            </Typography>
                          </Link>
                        );
                      }
                      
                      return (
                        <Typography variant="h6" fontWeight={700}>
                          {appt.patientName}
                        </Typography>
                      );
                    })()}
                    {appt.patientPhone && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon sx={{ fontSize: 14 }} />
                        {appt.patientPhone}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Stack>

              <Divider />

              {/* Payment Details */}
              <Stack spacing={2}>
                <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PaymentIcon color="primary" />
                  {t('Payment Details', 'تفاصيل الدفع')}
                </Typography>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={600}>
                      {t('Checkup Fee', 'رسوم الكشف')}:
                    </Typography>
                    <Typography fontWeight={700} color="primary.main">
                      {formatNumber(price, isAr)} {currencyLabel(isAr)}
                    </Typography>
                  </Stack>
                  {extraFees.length > 0 && (
                    <Stack spacing={1}>
                      {extraFees.map((fee, idx) => (
                        <Stack key={idx} direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="text.secondary">
                            {fee.description || t('Extra Fee', 'تكلفة إضافية')}:
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {formatNumber(safeNum(fee.amount), isAr)} {currencyLabel(isAr)}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                  <Divider />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" fontWeight={700}>
                      {t('Grand Total', 'الإجمالي النهائي')}:
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color="primary.main">
                      {formatNumber(grandTotal, isAr)} {currencyLabel(isAr)}
                    </Typography>
                  </Stack>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setExtraDialogOpen(true)}
                    fullWidth
                    sx={{ mt: 1 }}
                  >
                    {t('Add Extra Fee', 'إضافة تكلفة')}
                  </Button>
                </Stack>
              </Stack>

              <Divider />

              {/* Reports Section */}
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DescriptionIcon color="info" />
                    {t('Reports', 'التقارير')}
                  </Typography>
                  <Button
                    component={Link}
                    href={`/prescription/new?appointmentId=${id}${(appt?.patientId || appt?.patientUID || appt?.patientID) ? `&patientId=${appt.patientId || appt.patientUID || appt.patientID}` : ''}${isAr ? '&lang=ar' : ''}`}
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                  >
                    {t('Add Report', 'إضافة تقرير')}
                  </Button>
                </Stack>
                {reportsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : reports.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', borderRadius: 2 }}>
                    <DescriptionIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">
                      {t('No reports yet', 'لا توجد تقارير بعد')}
                    </Typography>
                  </Paper>
                ) : (
                  <Stack spacing={1.5}>
                    {reports.map((r) => (
                      <Paper
                        key={r.id}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        <Stack spacing={0.5}>
                          <Typography fontWeight={700}>
                            {r.titleAr || r.titleEn || '—'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {fmtDate(r.date, isAr)}
                          </Typography>
                        </Stack>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<VisibilityIcon />}
                          onClick={() => setViewReport(r)}
                        >
                          {t('View', 'عرض')}
                        </Button>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>

              <Divider />

              {/* Action Buttons */}
              <Stack direction="row" spacing={2}>
                <Button
                  component={Link}
                  href={`/appointments${isAr ? '?lang=ar' : ''}`}
                  startIcon={<ArrowBackIcon />}
                  variant="outlined"
                  fullWidth
                >
                  {t('Back', 'رجوع')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<ScheduleIcon />}
                  onClick={() => setUpdateOpen(true)}
                  fullWidth
                >
                  {t('Update Appointment', 'تحديث الموعد')}
                </Button>
              </Stack>
            </Stack>
          </Paper>

        {/* Dialogs */}
        {/* AddReportDialog removed - now using /prescription/new page */}
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
      </Box>
    </AppLayout>
  );
}
