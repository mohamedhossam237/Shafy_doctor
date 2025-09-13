// /pages/appointments/[id].jsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Box,
  Container,
  Paper,
  Stack,
  Typography,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Avatar,
  Snackbar,
  Alert,
  Grid,
  TextField,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventIcon from '@mui/icons-material/Event';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import NotesIcon from '@mui/icons-material/Notes';
import TagIcon from '@mui/icons-material/Tag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PaymentIcon from '@mui/icons-material/Payment';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ImageIcon from '@mui/icons-material/Image';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import AppLayout from '@/components/AppLayout';
import AddReportDialog from '@/components/reports/AddReportDialog';

import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';

/* ---------------- helpers ---------------- */

const pad = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

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

function fmtDateTime(dt) {
  const d = toDate(dt);
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(d);
}

function apptLocalDate(appt) {
  if (appt?.date) return appt.date;
  const d = toDate(appt?.appointmentDate);
  return d ? toYMD(d) : null;
}

function apptTimeMinutes(appt) {
  if (appt?.time) {
    const [h, m] = String(appt.time).split(':').map((x) => parseInt(x, 10));
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  }
  const d = toDate(appt?.appointmentDate);
  if (!d) return 24 * 60;
  return d.getHours() * 60 + d.getMinutes();
}

function fmtTimeFromMinutes(min) {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${pad(hh)}:${pad(mm)}`;
}

function fmtFullDateTime(appt) {
  const ds = apptLocalDate(appt);
  const mins = apptTimeMinutes(appt);
  const hhmm = fmtTimeFromMinutes(mins);
  return ds ? `${ds} ${hhmm}` : hhmm;
}

function field(appt, a, b) {
  return appt?.[a] || appt?.[b] || '';
}

function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'confirmed') return 'info';
  if (s === 'cancelled') return 'default';
  return 'warning'; // pending / unknown
}

function fmtReportDate(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(dt);
}
const currencyLabel = (isAr) => (isAr ? 'ج.م' : 'EGP');

/* ---------------- mini view dialog for a report ---------------- */

function ReportViewDialog({ open, onClose, report, isAr }) {
  if (!open || !report) return null;

  const t = (en, ar) => (isAr ? ar : en);
  const meds =
    Array.isArray(report?.medicationsList) && report.medicationsList.some(m => Object.values(m || {}).some(v => String(v || '').trim()))
      ? report.medicationsList
      : null;

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        inset: { xs: '8% 3% auto 3%', sm: '10% 10% auto 10%' },
        zIndex: (th) => th.zIndex.modal + 2,
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3,
        overflowY: 'auto',
        maxHeight: '80vh',
        direction: isAr ? 'rtl' : 'ltr',
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<DescriptionIcon />}
              color="primary"
              label={t('Clinical Report', 'تقرير سريري')}
              sx={{ fontWeight: 800, borderRadius: 2 }}
            />
            <Typography variant="subtitle2" color="text.secondary">
              {fmtReportDate(report?.date)}
            </Typography>
          </Stack>
          <Button onClick={onClose} variant="outlined">{t('Close', 'إغلاق')}</Button>
        </Stack>

        <Divider />

        {/* Header meta */}
        <Stack spacing={0.5}>
          <Typography variant="h6" fontWeight={800}>
            {report?.titleAr || report?.titleEn || report?.title || t('Medical Report', 'تقرير طبي')}
          </Typography>
          <Typography color="text.secondary">
            {t('Patient', 'المريض')}: <strong>{report?.patientName || '—'}</strong>
            {report?.patientID ? ` · ${report.patientID}` : ''}
          </Typography>
        </Stack>

        <Divider />

        {/* Clinical sections */}
        <Grid container spacing={1.25}>
          {report?.chiefComplaint && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800}>{t('Chief Complaint', 'الشكوى الرئيسية')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.chiefComplaint}</Typography>
            </Grid>
          )}
          {report?.findings && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800}>{t('Findings / Examination', 'النتائج / الفحص')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.findings}</Typography>
            </Grid>
          )}
          {report?.diagnosis && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800}>{t('Diagnosis', 'التشخيص')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.diagnosis}</Typography>
            </Grid>
          )}
          {report?.procedures && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800}>{t('Procedures', 'الإجراءات')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.procedures}</Typography>
            </Grid>
          )}

          {/* Medications */}
          {(meds || report?.medications) && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800}>{t('Medications / Prescriptions', 'الأدوية / الوصفات')}</Typography>
              {meds ? (
                <Stack component="ul" sx={{ pl: 3, my: 0 }}>
                  {meds.map((m, i) => {
                    const parts = [
                      m?.name,
                      m?.dose && `(${m.dose})`,
                      m?.frequency,
                      m?.duration && `× ${m.duration}`,
                      m?.notes && `- ${m.notes}`,
                    ].filter(Boolean).join(' ');
                    return <li key={i}><Typography sx={{ whiteSpace: 'pre-wrap' }}>{parts || '—'}</Typography></li>;
                  })}
                </Stack>
              ) : (
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.medications}</Typography>
              )}
            </Grid>
          )}

          {/* Vitals */}
          {report?.vitals && Object.values(report.vitals).some(v => String(v || '').trim()) && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800}>{t('Vitals', 'العلامات الحيوية')}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {report.vitals.bp && <Chip label={`${t('BP', 'ضغط')}: ${report.vitals.bp}`} />}
                {report.vitals.hr && <Chip label={`${t('HR', 'نبض')}: ${report.vitals.hr}`} />}
                {report.vitals.temp && <Chip label={`${t('Temp', 'حرارة')}: ${report.vitals.temp}`} />}
                {report.vitals.spo2 && <Chip label={`${t('SpO₂', 'الأكسجين')}: ${report.vitals.spo2}`} />}
              </Stack>
            </Grid>
          )}

          {/* Follow-up */}
          {report?.followUp && (
            <Grid item xs={12}>
              <Chip
                icon={<CalendarMonthIcon />}
                color="info"
                label={`${t('Follow-up', 'متابعة')}: ${fmtReportDate(report.followUp)}`}
                sx={{ borderRadius: 2 }}
              />
            </Grid>
          )}

          {/* Attachments */}
          {Array.isArray(report?.attachments) && report.attachments.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800}>{t('Attachments', 'المرفقات')}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {report.attachments.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <Box
                      sx={{
                        width: 120, height: 80, borderRadius: 1.5, overflow: 'hidden',
                        border: (th) => `1px solid ${th.palette.divider}`,
                        backgroundImage: `url(${url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                  </a>
                ))}
              </Stack>
            </Grid>
          )}

          {/* Notes */}
          {report?.notes && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800}>{t('Additional Notes / Plan', 'ملاحظات إضافية / خطة')}</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.notes}</Typography>
            </Grid>
          )}
        </Grid>
      </Stack>
    </Paper>
  );
}

/* ---------------- Update Appointment Dialog (Doctor) ---------------- */

function UpdateAppointmentDialog({
  open,
  onClose,
  appointment,
  onSaved,
  isAr,
}) {
  const t = (en, ar) => (isAr ? ar : en);
  const [saving, setSaving] = React.useState(false);

  const [dateStr, setDateStr] = React.useState('');
  const [timeStr, setTimeStr] = React.useState('');
  const [status, setStatus] = React.useState('pending');
  const statusOptions = [
    { v: 'pending',    label: t('Pending', 'قيد الانتظار') },
    { v: 'confirmed',  label: t('Confirmed', 'مؤكد') },
    { v: 'completed',  label: t('Completed', 'تم') },
    { v: 'cancelled',  label: t('Cancelled', 'أُلغي') },
  ];

  React.useEffect(() => {
    if (!open || !appointment) return;
    const ds = apptLocalDate(appointment) || toYMD(new Date());
    const mins = apptTimeMinutes(appointment);
    const hh = pad(Math.floor(mins / 60));
    const mm = pad(mins % 60);
    setDateStr(ds);
    setTimeStr(`${hh}:${mm}`);
    setStatus(String(appointment?.status || 'pending'));
  }, [open, appointment]);

  const handleSave = async () => {
    if (!appointment?.id) return;
    if (!dateStr || !timeStr) return;
    setSaving(true);
    try {
      const appointmentDate = new Date(`${dateStr}T${timeStr}:00`);
      await updateDoc(doc(db, 'appointments', appointment.id), {
        date: dateStr,
        time: timeStr,
        appointmentDate,
        status,
        updatedAt: serverTimestamp(),
      });
      onSaved?.({ date: dateStr, time: timeStr, appointmentDate, status });
      onClose?.();
    } catch (e) {
      // surface error inline via alert if needed
      // eslint-disable-next-line no-alert
      alert(e?.message || t('Failed to update appointment', 'تعذر تحديث الموعد'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>
        {t('Update Appointment', 'تحديث الموعد')}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.25}>
          <TextField
            label={t('Date', 'التاريخ')}
            type="date"
            InputLabelProps={{ shrink: true }}
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('Time', 'الوقت')}
            type="time"
            InputLabelProps={{ shrink: true }}
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            fullWidth
          />
          <TextField
            select
            label={t('Status', 'الحالة')}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            fullWidth
          >
            {statusOptions.map((opt) => (
              <MenuItem key={opt.v} value={opt.v}>{opt.label}</MenuItem>
            ))}
          </TextField>
          <Alert severity="info">
            {t('Changing date/time will update the computed appointmentDate as well.',
               'تغيير التاريخ/الوقت سيُحدّث حقل appointmentDate تلقائيًا.')}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('Cancel', 'إلغاء')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !dateStr || !timeStr}>
          {saving ? t('Saving…', 'جارٍ الحفظ…') : t('Save Changes', 'حفظ التغييرات')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------------- page ---------------- */

export default function AppointmentDetailsPage({ themeMode, setThemeMode }) {
  const router = useRouter();
  const { id } = router.query || {};
  const isAr = (String(router?.query?.lang || '').toLowerCase() === 'ar');
  const t = React.useCallback((en, ar) => (isAr ? ar : en), [isAr]);

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [appt, setAppt] = React.useState(null);

  const [queueNo, setQueueNo] = React.useState(null);
  const [savingQueue, setSavingQueue] = React.useState(false);

  const [status, setStatus] = React.useState('pending');
  const [savingStatus, setSavingStatus] = React.useState(false);

  const [snack, setSnack] = React.useState({ open: false, severity: 'info', msg: '' });

  // Reports state
  const [reports, setReports] = React.useState([]);
  const [reportsLoading, setReportsLoading] = React.useState(false);
  const [viewReport, setViewReport] = React.useState(null);

  // add-report dialog control
  const [reportOpen, setReportOpen] = React.useState(false);

  // image preview dialog (payment proof)
  const [proofOpen, setProofOpen] = React.useState(false);

  // update appointment dialog
  const [updateOpen, setUpdateOpen] = React.useState(false);

  const statusOptions = [
    { v: 'pending',    label: t('Pending', 'قيد الانتظار') },
    { v: 'confirmed',  label: t('Confirmed', 'مؤكد') },
    { v: 'completed',  label: t('Completed', 'تم') },
    { v: 'cancelled',  label: t('Cancelled', 'أُلغي') },
  ];

  // Load the appointment
  React.useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const snap = await getDoc(doc(db, 'appointments', String(id)));
        if (!snap.exists()) {
          setErr(t('Appointment not found.', 'لا يوجد موعد بهذا المعرف.'));
          setAppt(null);
          setQueueNo(null);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setAppt(data);
        setStatus(String(data.status || 'pending').toLowerCase());
      } catch (e) {
        setErr(e?.message || t('Failed to load appointment.', 'تعذر تحميل الموعد.'));
        setAppt(null);
        setQueueNo(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  // Fetch reports linked to this appointment
  const fetchReports = React.useCallback(async () => {
    if (!id) return;
    setReportsLoading(true);
    try {
      const qRef = query(collection(db, 'reports'), where('appointmentId', '==', String(id)));
      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (toDate(b?.date)?.getTime() || 0) - (toDate(a?.date)?.getTime() || 0));
      setReports(rows);
    } catch (e) {
      console.error(e);
      setSnack({ open: true, severity: 'error', msg: t('Failed to load reports', 'تعذر تحميل التقارير') });
    } finally {
      setReportsLoading(false);
    }
  }, [id, t]);

  React.useEffect(() => { fetchReports(); }, [fetchReports]);

  // Compute queue number
  React.useEffect(() => {
    if (!appt) return;

    const dateStr = apptLocalDate(appt);
    const docUID = appt?.doctorUID || appt?.doctorId;
    if (!dateStr || !docUID) {
      setQueueNo(null);
      return;
    }

    (async () => {
      try {
        const col = collection(db, 'appointments');
        const [snapA, snapB] = await Promise.all([
          getDocs(query(col, where('doctorId', '==', docUID), where('date', '==', dateStr))),
          getDocs(query(col, where('doctorUID', '==', docUID), where('date', '==', dateStr))),
        ]);

        const map = new Map();
        for (const d of [...snapA.docs, ...snapB.docs]) {
          map.set(d.id, { id: d.id, ...d.data() });
        }
        const all = Array.from(map.values());

        all.sort((a, b) => apptTimeMinutes(a) - apptTimeMinutes(b));

        const idx = all.findIndex((x) => x.id === appt.id);
        setQueueNo(idx === -1 ? null : idx + 1);
      } catch {
        setQueueNo(null);
      }
    })();
  }, [appt]);

  // Persist queue number
  React.useEffect(() => {
    if (!appt || !appt.id) return;
    if (queueNo == null) return;
    if (appt.queueNumber === queueNo) return;

    let cancelled = false;
    (async () => {
      try {
        setSavingQueue(true);
        await setDoc(doc(db, 'appointments', appt.id), { queueNumber: queueNo }, { merge: true });
        if (!cancelled) {
          setAppt((prev) => ({ ...prev, queueNumber: queueNo }));
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSavingQueue(false);
      }
    })();

    return () => { cancelled = true; };
  }, [appt, queueNo]);

  const backHref = `/appointments${isAr ? '?lang=ar' : ''}`;

  // --- status updates from the page quick control ---
  const applyStatus = async (newStatus) => {
    if (!appt?.id) return;
    setSavingStatus(true);
    try {
      await updateDoc(doc(db, 'appointments', appt.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setStatus(newStatus);
      setAppt((prev) => prev ? { ...prev, status: newStatus } : prev);
      setSnack({ open: true, severity: 'success', msg: t('Status updated', 'تم تحديث الحالة') });
    } catch (e) {
      setSnack({ open: true, severity: 'error', msg: e?.message || t('Failed to update status', 'تعذر تحديث الحالة') });
    } finally {
      setSavingStatus(false);
    }
  };

  const quickConfirm = () => {
    if (status !== 'confirmed') applyStatus('confirmed');
  };

  const handleReportSaved = React.useCallback(() => {
    setSnack({ open: true, severity: 'success', msg: t('Report saved', 'تم حفظ التقرير') });
    setReportOpen(false);
    fetchReports();
  }, [fetchReports, t]);

  // Pull normalized payment data (saved by booking page)
  const payment = appt?.payment || {};
  const price = appt?.doctorPrice ?? null;
  const priceCurrency = appt?.doctorPriceCurrency || payment?.currency || 'EGP';
  const paymentProofURL = appt?.paymentProofURL || '';

  return (
    <AppLayout themeMode={themeMode} setThemeMode={setThemeMode}>
      <Container maxWidth="sm" sx={{ py: { xs: 1, md: 2 } }}>
        {/* Back */}
        <Box sx={{ mb: 1, display: 'flex', justifyContent: isAr ? 'flex-end' : 'flex-start' }}>
          <Button component={Link} href={backHref} startIcon={isAr ? null : <ArrowBackIcon />} endIcon={isAr ? <ArrowBackIcon /> : null}>
            {t('Back to list', 'العودة للقائمة')}
          </Button>
        </Box>

        {/* Content */}
        <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
          {loading ? (
            <Stack alignItems="center" spacing={1}><CircularProgress size={24} /></Stack>
          ) : err ? (
            <Alert severity="error">{err}</Alert>
          ) : !appt ? null : (
            <Stack spacing={1.5}>
              {/* Header / Queue number + Status + Actions */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  flexWrap: 'wrap',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 900 }}>
                    #{queueNo ?? '-'}
                  </Avatar>
                  <Stack>
                    <Typography variant="h6" fontWeight={900}>
                      {t('Appointment Details', 'تفاصيل الموعد')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('Queue number for the day', 'الرقم التسلسلي لليوم')}:
                      &nbsp;<strong>{queueNo ?? t('N/A', 'غير متاح')}</strong>
                      {savingQueue && <>&nbsp;•&nbsp;{t('saving…', 'جارٍ الحفظ…')}</>}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                  <Chip
                    icon={<TagIcon />}
                    label={(appt.status || 'pending').toString()}
                    color={statusColor(appt.status)}
                    sx={{ fontWeight: 700, borderRadius: 2 }}
                  />
                  <Chip
                    icon={<DescriptionIcon />}
                    label={
                      reportsLoading
                        ? t('Loading reports…', 'جارٍ تحميل التقارير…')
                        : `${t('Reports', 'التقارير')}: ${reports.length}`
                    }
                    variant="outlined"
                    sx={{ borderRadius: 2 }}
                  />

                  {/* Quick confirm */}
                  {status !== 'confirmed' && status !== 'completed' && status !== 'cancelled' && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CheckCircleIcon />}
                      onClick={quickConfirm}
                      disabled={savingStatus}
                    >
                      {savingStatus ? t('Confirming…', 'جارٍ التأكيد…') : t('Confirm', 'تأكيد')}
                    </Button>
                  )}

                  {/* Add Report */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DescriptionIcon />}
                    onClick={() => setReportOpen(true)}
                  >
                    {t('Add Report', 'إضافة تقرير')}
                  </Button>

                  {/* Update Appointment */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ScheduleIcon />}
                    onClick={() => setUpdateOpen(true)}
                  >
                    {t('Update Appointment', 'تحديث الموعد')}
                  </Button>
                </Stack>
              </Box>

              {/* Status selector */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  select
                  label={t('Status', 'الحالة')}
                  value={status}
                  onChange={(e) => applyStatus(e.target.value)}
                  sx={{ minWidth: 200 }}
                >
                  {statusOptions.map((opt) => (
                    <MenuItem key={opt.v} value={opt.v}>{opt.label}</MenuItem>
                  ))}
                </TextField>
                {savingStatus && <CircularProgress size={18} />}
              </Box>

              <Divider />

              {/* Time & Doctor */}
              <Grid container spacing={1.25}>
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <EventIcon color="action" />
                      <Typography sx={{ fontWeight: 700 }}>
                        {t('Date/Time', 'التاريخ/الوقت')}:
                      </Typography>
                      <Typography color="text.secondary">
                        {fmtFullDateTime(appt)}
                      </Typography>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <LocalHospitalIcon color="action" />
                      <Typography sx={{ fontWeight: 700 }}>
                        {t('Doctor', 'الطبيب')}:
                      </Typography>
                      <Typography color="text.secondary">
                        {field(appt, 'doctorName_en', 'doctorName_ar') || appt?.doctorId || appt?.doctorUID || '—'}
                      </Typography>
                      {field(appt, 'doctorSpecialty_en', 'doctorSpecialty_ar') && (
                        <>
                          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                          <Typography color="text.secondary">
                            {field(appt, 'doctorSpecialty_en', 'doctorSpecialty_ar')}
                          </Typography>
                        </>
                      )}
                    </Stack>
                  </Paper>
                </Grid>

                {/* Patient */}
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <PersonIcon color="action" />
                      <Typography sx={{ fontWeight: 700 }}>
                        {t('Patient', 'المريض')}:
                      </Typography>
                      <Typography color="text.secondary">
                        {appt?.patientName || '—'}
                      </Typography>
                      {appt?.patientPhone && (
                        <>
                          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                          <Typography color="text.secondary">{appt.patientPhone}</Typography>
                        </>
                      )}
                      {appt?.patientEmail && (
                        <>
                          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                          <Typography color="text.secondary">{appt.patientEmail}</Typography>
                        </>
                      )}
                    </Stack>
                  </Paper>
                </Grid>

                {/* Payment & Fees */}
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    <Stack spacing={1.25}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PaymentIcon color="action" />
                        <Typography sx={{ fontWeight: 700 }}>
                          {t('Payment & Fees', 'الدفع والرسوم')}
                        </Typography>
                      </Stack>

                      {/* Fee */}
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <MonetizationOnIcon color="disabled" />
                        <Typography color="text.secondary">
                          {t('Checkup Fee', 'رسوم الكشف')}:
                        </Typography>
                        <Typography fontWeight={800}>
                          {price != null ? `${price} ${currencyLabel(isAr)}` : '—'}
                        </Typography>
                      </Stack>

                      {/* Type */}
                      {payment?.type && (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <PaymentIcon color="disabled" />
                          <Typography color="text.secondary">{t('Payment Type', 'طريقة الدفع')}:</Typography>
                          <Typography>{payment.type}</Typography>
                        </Stack>
                      )}

                      {/* Wallet */}
                      {(payment?.walletNumber || payment?.walletProvider) && (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <AccountBalanceWalletIcon color="disabled" />
                          <Typography color="text.secondary">{t('Wallet', 'المحفظة')}:</Typography>
                          <Typography>
                            {[payment.walletNumber, payment.walletProvider].filter(Boolean).join(' — ') || '—'}
                          </Typography>
                        </Stack>
                      )}

                      {/* Instapay */}
                      {(payment?.instapayId || payment?.instapayMobile) && (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <AccountBalanceIcon color="disabled" />
                          <Typography color="text.secondary">{t('Instapay', 'إنستا باي')}:</Typography>
                          <Typography>
                            {[
                              payment.instapayId && (isAr ? `المعرّف: ${payment.instapayId}` : `ID: ${payment.instapayId}`),
                              payment.instapayMobile && (isAr ? `الموبايل: ${payment.instapayMobile}` : `Mobile: ${payment.instapayMobile}`)
                            ].filter(Boolean).join(' · ') || '—'}
                          </Typography>
                        </Stack>
                      )}

                      {/* Bank */}
                      {payment?.bankName && (
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <AccountBalanceIcon color="disabled" />
                          <Typography color="text.secondary">{t('Bank', 'البنك')}:</Typography>
                          <Typography>{payment.bankName}</Typography>
                        </Stack>
                      )}

                      {/* Payment notes */}
                      {payment?.notes && (
                        <Alert severity="info" sx={{ whiteSpace: 'pre-wrap' }}>
                          {payment.notes}
                        </Alert>
                      )}

                      {/* Payment screenshot (no extra meta) */}
                      <Divider />

                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <ImageIcon color="disabled" />
                          <Typography sx={{ fontWeight: 700 }}>
                            {t('Payment Screenshot', 'صورة التحويل')}
                          </Typography>
                        </Stack>

                        {paymentProofURL ? (
                          <Stack spacing={1}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<OpenInNewIcon />}
                                component="a"
                                href={paymentProofURL}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {t('Open in new tab', 'فتح في تبويب')}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setProofOpen(true)}
                              >
                                {t('Preview', 'معاينة')}
                              </Button>
                            </Box>

                            {/* Thumbnail */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={paymentProofURL}
                              alt="payment proof"
                              onClick={() => setProofOpen(true)}
                              style={{
                                cursor: 'zoom-in',
                                maxWidth: '100%',
                                height: 'auto',
                                maxHeight: 260,
                                borderRadius: 8,
                                border: '1px solid rgba(0,0,0,.12)'
                              }}
                            />
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="center" color="text.secondary">
                            <ImageIcon fontSize="small" />
                            <Typography variant="body2">{t('No payment image attached.', 'لا توجد صورة تحويل مرفقة.')}</Typography>
                          </Stack>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>

                {/* Notes */}
                {(appt?.note || appt?.aiBrief) && (
                  <Grid item xs={12}>
                    <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <NotesIcon color="action" />
                        <Typography sx={{ fontWeight: 700 }}>
                          {t('Notes', 'ملاحظات')}
                        </Typography>
                      </Stack>
                      {appt?.note && (
                        <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                          {appt.note}
                        </Typography>
                      )}
                      {appt?.aiBrief && (
                        <Alert severity="info" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                          <strong>{t('AI Summary:', 'ملخص الذكاء الاصطناعي:')}</strong>{'\n'}{appt.aiBrief}
                        </Alert>
                      )}
                    </Paper>
                  </Grid>
                )}
              </Grid>

              {/* Reports list */}
              <Box>
                <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1 }}>
                  {t('Reports for this appointment', 'التقارير الخاصة بهذا الموعد')}
                </Typography>

                {reportsLoading ? (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center' }}>
                    <CircularProgress size={20} />
                  </Paper>
                ) : reports.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography color="text.secondary">
                      {t('No reports yet. Add one from the button above.', 'لا توجد تقارير حتى الآن. أضف تقريرًا من الزر بالأعلى.')}
                    </Typography>
                  </Paper>
                ) : (
                  <Stack spacing={1}>
                    {reports.map((r) => (
                      <Paper
                        key={r.id}
                        variant="outlined"
                        sx={{ p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark' }}>
                          <DescriptionIcon />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={800} noWrap title={r?.titleAr || r?.titleEn || r?.title || ''}>
                            {r?.titleAr || r?.titleEn || r?.title || t('Medical Report', 'تقرير طبي')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {fmtReportDate(r?.date)} • {r?.diagnosis || t('No diagnosis', 'لا يوجد تشخيص')}
                          </Typography>
                        </Box>
                        {r?.followUp && (
                          <Chip
                            size="small"
                            icon={<CalendarMonthIcon />}
                            label={`${t('Follow-up', 'متابعة')}: ${fmtReportDate(r.followUp)}`}
                            sx={{ mr: 1 }}
                          />
                        )}
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<VisibilityIcon />}
                          onClick={() => setViewReport(r)}
                          sx={{ fontWeight: 700 }}
                        >
                          {t('View', 'عرض')}
                        </Button>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Footer actions */}
              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 0.5 }}>
                <Button component={Link} href={backHref} variant="outlined">
                  {t('Back', 'رجوع')}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<ScheduleIcon />}
                  disabled
                  title={t('Future actions (e.g., reschedule) can go here', 'إجراءات لاحقة مثل إعادة الجدولة تُضاف لاحقاً')}
                >
                  {t('Actions', 'إجراءات')}
                </Button>
              </Stack>
            </Stack>
          )}
        </Paper>

        {/* Add Report Dialog */}
        <AddReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          isArabic={isAr}
          appointmentId={id}
          onSaved={handleReportSaved}
        />

        {/* View Report Dialog (read-only) */}
        <ReportViewDialog
          open={Boolean(viewReport)}
          onClose={() => setViewReport(null)}
          report={viewReport}
          isAr={isAr}
        />

        {/* Payment proof full-size preview */}
        <Dialog open={proofOpen} onClose={() => setProofOpen(false)} fullWidth maxWidth="md">
          <DialogTitle>{t('Payment Screenshot', 'صورة التحويل')}</DialogTitle>
          <DialogContent dividers>
            {paymentProofURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={paymentProofURL}
                alt="payment proof large"
                style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 8 }}
              />
            ) : (
              <Typography color="text.secondary">{t('No image available.', 'لا توجد صورة.')}</Typography>
            )}
          </DialogContent>
          <DialogActions>
            {paymentProofURL && (
              <Button
                startIcon={<OpenInNewIcon />}
                component="a"
                href={paymentProofURL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('Open Original', 'فتح الأصل')}
              </Button>
            )}
            <Button onClick={() => setProofOpen(false)} variant="contained">
              {t('Close', 'إغلاق')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Update Appointment Dialog */}
        <UpdateAppointmentDialog
          open={updateOpen}
          onClose={() => setUpdateOpen(false)}
          appointment={appt}
          isAr={isAr}
          onSaved={(patch) => {
            setSnack({ open: true, severity: 'success', msg: t('Appointment updated', 'تم تحديث الموعد') });
            setAppt((prev) => prev ? { ...prev, ...patch } : prev);
            // If date/time changed, recompute queue later via effect
          }}
        />

        <Snackbar
          open={snack.open}
          autoHideDuration={3500}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
            {snack.msg}
          </Alert>
        </Snackbar>
      </Container>
    </AppLayout>
  );
}
