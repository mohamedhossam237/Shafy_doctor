// /pages/patient_reports/index.js
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
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';

import { alpha } from '@mui/material/styles';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ScienceIcon from '@mui/icons-material/Science';
import MedicationIcon from '@mui/icons-material/Medication';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import AttachmentIcon from '@mui/icons-material/Attachment';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

/* ---------------- utils ---------------- */

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

function normalizePhone(s) {
  return String(s || '').replace(/\D+/g, '');
}

function includesCI(hay, needle) {
  return String(hay || '').toLowerCase().includes(String(needle || '').toLowerCase());
}

function fmtReportDate(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(dt);
}

/* -------------- Details Dialog -------------- */

function ReportDetailsDialog({ open, onClose, report, isArabic, withLang }) {
  if (!report) return null;
  const t = (en, ar) => (isArabic ? ar : en);
  const isLab = String(report?.type || '').toLowerCase() === 'lab';

  const pName = report?.patientName || '—';
  const pId = report?.patientID || '';
  const pPhone = report?.patientPhone || '';

  const attachments = Array.isArray(report?.attachments) ? report.attachments : [];
  const medsList = Array.isArray(report?.medicationsList) ? report.medicationsList : [];
  const testsReqList = Array.isArray(report?.testsRequiredList) ? report.testsRequiredList : [];
  const labTests = Array.isArray(report?.tests) ? report.tests : [];

  const followUpStr = report?.followUp ? fmtReportDate(report.followUp) : '';

  const title =
    report?.titleAr || report?.titleEn || report?.title ||
    (isLab ? t('Lab Report', 'تقرير معملي') : t('Medical Report', 'تقرير طبي'));

  const apptHref = report?.appointmentId ? withLang(`/appointments/${report.appointmentId}`) : null;
  const patientHref = pId ? withLang(`/patients/${pId}`) : null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"
      PaperProps={{ sx: { borderRadius: 3, direction: isArabic ? 'rtl' : 'ltr', textAlign: isArabic ? 'right' : 'left' } }}>
      <DialogTitle sx={{ pb: 1.25 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
          <Chip
            icon={isLab ? <ScienceIcon /> : <LocalHospitalIcon />}
            label={isLab ? t('Lab Report', 'تقرير معملي') : t('Clinical Report', 'تقرير سريري')}
            color={isLab ? 'secondary' : 'primary'}
            sx={{ fontWeight: 800 }}
          />
          <Typography variant="h6" fontWeight={900} sx={{ ml: isArabic ? 0 : 0.5, mr: isArabic ? 0.5 : 0 }}>
            {title}
          </Typography>
          <Chip size="small" label={fmtReportDate(report?.date)} sx={{ ml: isArabic ? 0 : 1, mr: isArabic ? 1 : 0 }} />
          {apptHref && (
            <Button
              component={Link}
              href={apptHref}
              size="small"
              startIcon={<VisibilityIcon />}
              sx={{ ml: isArabic ? 0 : 1, mr: isArabic ? 1 : 0, fontWeight: 700 }}
            >
              {t('Open Appointment', 'فتح الموعد')}
            </Button>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ background: (t2) => alpha(t2.palette.background.paper, 0.5) }}>
        <Stack spacing={2}>
          {/* Patient meta */}
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems="center" flexWrap="wrap">
              <Chip
                icon={<LocalHospitalIcon />}
                label={`${t('Patient', 'المريض')}: ${pName}${pId ? ` · ${pId}` : ''}`}
                variant="outlined"
                sx={{ fontWeight: 700 }}
              />
              <Typography variant="body2" color="text.secondary">
                {pPhone || (isArabic ? 'لا يوجد هاتف' : 'No phone')}
              </Typography>
              {patientHref && (
                <Button component={Link} href={patientHref} size="small" sx={{ fontWeight: 700 }}>
                  {t('Open Patient', 'فتح المريض')}
                </Button>
              )}
            </Stack>
          </Paper>

          {/* CONTENT */}
          {isLab ? (
            <>
              {/* Lab meta */}
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                  <Chip icon={<ScienceIcon />} label={t('Lab Details', 'بيانات المعمل')} sx={{ fontWeight: 800 }} />
                  <Typography variant="body2" color="text.secondary">
                    {t('Lab', 'المعمل')}: <b>{report?.labName || '—'}</b>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('Specimen', 'العينة')}: <b>{report?.specimen || '—'}</b>
                  </Typography>
                  {followUpStr && (
                    <Chip size="small" icon={<CalendarMonthIcon />} label={`${t('Follow-up', 'متابعة')}: ${followUpStr}`} />
                  )}
                </Stack>
              </Paper>

              {/* Tests table */}
              <Paper variant="outlined" sx={{ p: 0, borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ px: 1.25, pt: 1, pb: 0.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ScienceIcon fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={800}>{t('Tests', 'التحاليل')}</Typography>
                  </Stack>
                </Box>
                <Table size="small" aria-label="lab tests table">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('Test', 'الاختبار')}</TableCell>
                      <TableCell>{t('Result', 'النتيجة')}</TableCell>
                      <TableCell>{t('Unit', 'الوحدة')}</TableCell>
                      <TableCell>{t('Reference Range', 'المعدل المرجعي')}</TableCell>
                      <TableCell>{t('Flag', 'دلالة')}</TableCell>
                      <TableCell>{t('Notes', 'ملاحظات')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(labTests.length ? labTests : []).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row?.test || '—'}</TableCell>
                        <TableCell>{row?.result || '—'}</TableCell>
                        <TableCell>{row?.unit || '—'}</TableCell>
                        <TableCell>{row?.refRange || '—'}</TableCell>
                        <TableCell>{row?.flag || '—'}</TableCell>
                        <TableCell>{row?.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {!labTests.length && (
                      <TableRow><TableCell colSpan={6}><Typography color="text.secondary">{t('No tests', 'لا توجد تحاليل')}</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>

              {/* Interpretation & notes */}
              {(report?.interpretation || report?.notes) && (
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack spacing={1}>
                    {!!report?.interpretation && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <NoteAltIcon fontSize="small" />
                        <Typography variant="subtitle2" fontWeight={800}>{t('Interpretation', 'الخلاصة')}</Typography>
                      </Stack>
                    )}
                    {!!report?.interpretation && (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {report.interpretation}
                      </Typography>
                    )}
                    {!!report?.notes && (
                      <>
                        <Divider />
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {report.notes}
                        </Typography>
                      </>
                    )}
                  </Stack>
                </Paper>
              )}
            </>
          ) : (
            <>
              {/* Clinical sections */}
              <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                  <Chip icon={<LocalHospitalIcon />} label={t('Clinical Details', 'التفاصيل السريرية')} sx={{ fontWeight: 800 }} />
                  {report?.diagnosis && (
                    <Chip color="primary" variant="outlined" label={`${t('Diagnosis', 'التشخيص')}: ${report.diagnosis}`} />
                  )}
                  {followUpStr && (
                    <Chip size="small" icon={<CalendarMonthIcon />} label={`${t('Follow-up', 'متابعة')}: ${followUpStr}`} />
                  )}
                </Stack>

                <Grid container spacing={1.25} sx={{ mt: 0.5 }}>
                  {report?.chiefComplaint && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" fontWeight={800}>{t('Chief Complaint', 'الشكوى الرئيسية')}</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{report.chiefComplaint}</Typography>
                    </Grid>
                  )}
                  {report?.findings && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" fontWeight={800}>{t('Findings / Examination', 'النتائج / الفحص')}</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{report.findings}</Typography>
                    </Grid>
                  )}
                  {report?.procedures && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" fontWeight={800}>{t('Procedures', 'الإجراءات')}</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{report.procedures}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>

              {/* Vitals */}
              {(report?.vitals && Object.values(report.vitals).some(v => String(v || '').trim())) && (
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <MonitorHeartIcon fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={800}>{t('Vitals', 'العلامات الحيوية')}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1.25} flexWrap="wrap">
                    {report.vitals.bp ? <Chip label={`${t('BP', 'ضغط')}: ${report.vitals.bp}`} /> : null}
                    {report.vitals.hr ? <Chip label={`${t('HR', 'نبض')}: ${report.vitals.hr}`} /> : null}
                    {report.vitals.temp ? <Chip label={`${t('Temp', 'حرارة')}: ${report.vitals.temp}`} /> : null}
                    {report.vitals.spo2 ? <Chip label={`${t('SpO₂', 'الأكسجين')}: ${report.vitals.spo2}`} /> : null}
                  </Stack>
                </Paper>
              )}

              {/* Medications */}
              {(report?.medications || medsList.length) && (
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <MedicationIcon fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={800}>{t('Medications / Prescriptions', 'الأدوية / الوصفات')}</Typography>
                  </Stack>
                  {medsList.length ? (
                    <Stack spacing={0.5}>
                      {medsList.map((m, i) => (
                        <Typography key={i} variant="body2">
                          • {[m?.name, m?.dose && `(${m.dose})`, m?.frequency, m?.duration && `x ${m.duration}`, m?.notes]
                            .filter(Boolean).join(' ')}
                        </Typography>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {report?.medications || t('None', 'لا يوجد')}
                    </Typography>
                  )}
                </Paper>
              )}

              {/* Required Tests */}
              {(testsReqList.length || report?.testsRequired) && (
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <ScienceIcon fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={800}>{t('Required: Medical tests', 'مطلوب: فحوصات طبية')}</Typography>
                  </Stack>
                  {testsReqList.length ? (
                    <Stack spacing={0.5}>
                      {testsReqList.map((x, i) => (
                        <Typography key={i} variant="body2">• {[x?.name, x?.notes && `- ${x.notes}`].filter(Boolean).join(' ')}</Typography>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {report?.testsRequired || t('None', 'لا يوجد')}
                    </Typography>
                  )}
                </Paper>
              )}

              {/* Notes */}
              {report?.notes && (
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <NoteAltIcon fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={800}>{t('Notes', 'ملاحظات')}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{report.notes}</Typography>
                </Paper>
              )}
            </>
          )}

          {/* Attachments */}
          {attachments.length ? (
            <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <AttachmentIcon fontSize="small" />
                <Typography variant="subtitle2" fontWeight={800}>{t('Attachments', 'المرفقات')}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {attachments.map((url, i) => (
                  <Button
                    key={i}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    variant="outlined"
                    sx={{ borderRadius: 2 }}
                  >
                    {t('Open', 'فتح')} #{i + 1}
                  </Button>
                ))}
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>{t('Close', 'إغلاق')}</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------------- page ---------------- */

export default function PatientReportsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Arabic is default unless explicitly overridden
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : `${path}${path.includes('?') ? '&' : '?'}lang=en`),
    [isArabic]
  );

  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });

  // reports + patients
  const [reportsLoading, setReportsLoading] = React.useState(true);
  const [reports, setReports] = React.useState([]); // all reports by doctor
  const [patientsMap, setPatientsMap] = React.useState({}); // patientID -> { name, phone }

  // filters
  const [dateFrom, setDateFrom] = React.useState(''); // YYYY-MM-DD
  const [dateTo, setDateTo] = React.useState('');     // YYYY-MM-DD
  const [qText, setQText] = React.useState('');       // search by name/phone

  // dialog state
  const [openDetails, setOpenDetails] = React.useState(false);
  const [selectedReport, setSelectedReport] = React.useState(null);

  /* -------- load all doctor reports -------- */
  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setReportsLoading(true);
      try {
        const qRef = query(collection(db, 'reports'), where('doctorUID', '==', user.uid));
        const snap = await getDocs(qRef);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (toDate(b?.date)?.getTime() || 0) - (toDate(a?.date)?.getTime() || 0));
        setReports(rows);
      } catch (e) {
        console.error(e);
        setSnack({ open: true, message: e?.message || (isArabic ? 'تعذر تحميل التقارير' : 'Failed to load reports'), severity: 'error' });
      } finally {
        setReportsLoading(false);
      }
    })();
  }, [user, isArabic]);

  /* -------- load patients (to get phone/name for search) -------- */
  React.useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const pRef = query(collection(db, 'patients'), where('registeredBy', '==', user.uid));
        const snap = await getDocs(pRef);
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data() || {};
          map[d.id] = {
            name: String(data?.name ?? '').trim(),
            phone: data?.phone || data?.mobile || '',
          };
        });
        setPatientsMap(map);
      } catch (e) {
        // soft-fail (search will just use what's inside report)
      }
    })();
  }, [user]);

  /* -------- filters + derived list -------- */
  const filteredReports = React.useMemo(() => {
    let list = reports;

    // by date range (client-side; works with Timestamp or Date/ISO in "date" field)
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    if (from) {
      list = list.filter((r) => {
        const d = toDate(r?.date);
        return d ? d.getTime() >= from.getTime() : false;
      });
    }
    if (to) {
      list = list.filter((r) => {
        const d = toDate(r?.date);
        return d ? d.getTime() <= to.getTime() : false;
      });
    }

    // by search (name or phone)
    const q = qText.trim();
    if (q) {
      const qPhone = normalizePhone(q);
      list = list.filter((r) => {
        const rName = r?.patientName || patientsMap[r?.patientID]?.name || '';
        const rPhone = r?.patientPhone || patientsMap[r?.patientID]?.phone || '';
        if (includesCI(rName, q)) return true;
        if (qPhone && normalizePhone(rPhone).includes(qPhone)) return true;
        return false;
      });
    }

    return list;
  }, [reports, dateFrom, dateTo, qText, patientsMap]);

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setQText('');
  };

  const openApptHref = (r) =>
    r?.appointmentId ? withLang(`/appointments/${r.appointmentId}`) : undefined;

  const onCardClick = (r) => {
    setSelectedReport(r);
    setOpenDetails(true);
  };

  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container disableGutters maxWidth="lg">
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton component={Link} href={withLang('/appointments')} size="small" sx={{ transform: isArabic ? 'scaleX(-1)' : 'none' }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h5" fontWeight={800}>
                {isArabic ? 'تقارير المرضى' : 'Patient Reports'}
              </Typography>
            </Stack>
          </Stack>

          {/* Filters */}
          <Paper sx={{ p: 2, borderRadius: 3 }} elevation={0}>
            <Stack
              direction={{ xs: 'column', md: isArabic ? 'row-reverse' : 'row' }}
              spacing={1.25}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              sx={{ mb: 1.25 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                <DescriptionIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>
                  {isArabic ? 'كل التقارير' : 'All Reports'}
                </Typography>
                <Chip
                  size="small"
                  label={
                    reportsLoading
                      ? (isArabic ? 'جارٍ التحميل…' : 'Loading…')
                      : `${isArabic ? 'النتائج' : 'Results'}: ${filteredReports.length}`
                  }
                  sx={{ ml: isArabic ? 0 : 1, mr: isArabic ? 1 : 0 }}
                />
              </Stack>

              <Stack
                direction={{ xs: 'column', md: isArabic ? 'row-reverse' : 'row' }}
                spacing={1}
                sx={{ width: { xs: '100%', md: 'auto' } }}
              >
                <TextField
                  label={isArabic ? 'من' : 'From'}
                  type="date"
                  size="small"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label={isArabic ? 'إلى' : 'To'}
                  type="date"
                  size="small"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  size="small"
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  label={isArabic ? 'بحث بالاسم/الهاتف' : 'Search name/phone'}
                  placeholder={isArabic ? 'اكتب اسم أو رقم هاتف' : 'Type name or phone'}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, opacity: 0.6 }} fontSize="small" />,
                  }}
                  sx={{ minWidth: 240 }}
                />
                <Button onClick={resetFilters} variant="text">
                  {isArabic ? 'إعادة ضبط' : 'Reset'}
                </Button>
              </Stack>
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {/* Results */}
            {reportsLoading ? (
              <Stack spacing={1.5}>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={84} />
                ))}
              </Stack>
            ) : filteredReports.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                <Typography color="text.secondary">
                  {isArabic ? 'لا توجد تقارير مطابقة للبحث' : 'No reports match your filters'}
                </Typography>
              </Paper>
            ) : (
              <Grid container spacing={1.25}>
                {filteredReports.map((r) => {
                  const pName = r?.patientName || '—';
                  const pPhone = r?.patientPhone || '';
                  const isLab = String(r?.type || '').toLowerCase() === 'lab';
                  const chipIcon = isLab ? <ScienceIcon /> : <LocalHospitalIcon />;
                  const title = r?.titleAr || r?.titleEn || r?.title || (isLab ? (isArabic ? 'تقرير معملي' : 'Lab Report') : (isArabic ? 'تقرير طبي' : 'Medical Report'));
                  return (
                    <Grid key={r.id} item xs={12}>
                      <Paper
                        variant="outlined"
                        onClick={() => onCardClick(r)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onCardClick(r)}
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          flexWrap: 'wrap',
                          cursor: 'pointer',
                          transition: 'background .12s ease, box-shadow .12s ease',
                          '&:hover': { backgroundColor: 'action.hover' },
                        }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                          <Chip
                            icon={chipIcon}
                            label={title}
                            color={isLab ? 'secondary' : 'primary'}
                            variant="outlined"
                            sx={{ borderRadius: 2, fontWeight: 700 }}
                          />
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {fmtReportDate(r?.date)}
                          </Typography>
                        </Stack>

                        <Stack sx={{ flex: 2, minWidth: 0 }}>
                          <Typography fontWeight={800} noWrap title={pName}>
                            {pName}{r?.patientID ? ` · ${r.patientID}` : ''}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {pPhone || (isArabic ? 'لا يوجد هاتف' : 'No phone')}
                            {r?.diagnosis ? ` • ${r.diagnosis}` : ''}
                          </Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: 'center' }}>
                          {r?.followUp && (
                            <Chip
                              size="small"
                              icon={<CalendarMonthIcon />}
                              label={`${isArabic ? 'متابعة' : 'Follow-up'}: ${fmtReportDate(r.followUp)}`}
                            />
                          )}
                          {openApptHref(r) ? (
                            <Button
                              size="small"
                              component={Link}
                              href={openApptHref(r)}
                              startIcon={<VisibilityIcon />}
                              sx={{ fontWeight: 700 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isArabic ? 'فتح الموعد' : 'Open Appointment'}
                            </Button>
                          ) : null}
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>

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

      {/* Details dialog */}
      <ReportDetailsDialog
        open={openDetails}
        onClose={() => setOpenDetails(false)}
        report={selectedReport}
        isArabic={isArabic}
        withLang={withLang}
      />
    </AppLayout>
  );
}
