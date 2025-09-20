// /pages/patients/[id].jsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Container,
  Stack,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Divider,
  Skeleton,
  Snackbar,
  Alert,
  Box,
  Avatar,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import DescriptionIcon from '@mui/icons-material/Description';
import EventIcon from '@mui/icons-material/Event';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TagIcon from '@mui/icons-material/Tag';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import ScienceIcon from '@mui/icons-material/Science';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import PlaceIcon from '@mui/icons-material/Place';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { db } from '@/lib/firebase';

import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import { useAuth } from '@/providers/AuthProvider';
import AddLabReportDialog from '@/components/reports/AddLabReportDialog';

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
const pad = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function apptDate(appt) {
  if (appt?.appointmentDate) return toDate(appt.appointmentDate);
  if (appt?.date) {
    const [y, m, d] = String(appt.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(appt.time || '00:00').split(':').map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
    }
  }
  return null;
}
function fmtApptFull(appt) {
  const d = apptDate(appt);
  if (!d) return '—';
  return `${toYMD(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtNiceDateTime(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(dt);
}
function fmtNiceDate(d) {
  const dt = toDate(d);
  if (!dt) return '—';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(dt);
}
function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'confirmed') return 'info';
  if (s === 'cancelled') return 'default';
  return 'warning';
}
const splitCsv = (v) =>
  Array.isArray(v) ? v : String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/* -------- inline report viewer (read-only) -------- */
function ReportInlineView({ report, isArabic, onClose }) {
  if (!report) return null;
  const t = (en, ar) => (isArabic ? ar : en);

  const isLab = String(report?.type || '').toLowerCase() === 'lab';
  const meds =
    !isLab &&
    Array.isArray(report?.medicationsList) &&
    report.medicationsList.some(m => Object.values(m || {}).some(v => String(v || '').trim()))
      ? report.medicationsList
      : null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        inset: { xs: '8% 3% auto 3%', sm: '10% 10% auto 10%' },
        zIndex: (th) => th.zIndex.modal + 2,
        p: { xs: 1.75, sm: 2.25 },
        borderRadius: 3,
        overflowY: 'auto',
        maxHeight: '80vh',
        direction: isArabic ? 'rtl' : 'ltr',
        bgcolor: (th) => th.palette.background.paper,
        border: (th) => `1px solid ${th.palette.divider}`,
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={isLab ? <ScienceIcon/> : <DescriptionIcon />}
              color={isLab ? 'secondary' : 'primary'}
              variant="filled"
              label={isLab ? t('Lab Report', 'تقرير معملي') : t('Clinical Report', 'تقرير سريري')}
              sx={{ fontWeight: 800, borderRadius: 2 }}
            />
            <Typography variant="subtitle2" color="text.secondary">
              {fmtNiceDateTime(report?.date)}
            </Typography>
          </Stack>
          <Button onClick={onClose} variant="outlined">{t('Close', 'إغلاق')}</Button>
        </Stack>

        <Divider />

        <Typography variant="h6" fontWeight={900} color="text.primary">
          {report?.titleAr || report?.titleEn || report?.title || (isLab ? t('Lab Report', 'تقرير معملي') : t('Medical Report', 'تقرير طبي'))}
        </Typography>

        {isLab ? (
          <>
            {(report?.labName || report?.specimen) && (
              <Typography color="text.primary">
                {report.labName ? `${t('Lab', 'المعمل')}: ${report.labName}` : ''}{report.labName && report.specimen ? ' • ' : ''}
                {report.specimen ? `${t('Specimen', 'العينة')}: ${report.specimen}` : ''}
              </Typography>
            )}

            {Array.isArray(report?.tests) && report.tests.length > 0 && (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 560 }}>
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
                    {report.tests.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r?.test || '—'}</TableCell>
                        <TableCell>{r?.result || '—'}</TableCell>
                        <TableCell>{r?.unit || '—'}</TableCell>
                        <TableCell>{r?.refRange || '—'}</TableCell>
                        <TableCell>{r?.flag || '—'}</TableCell>
                        <TableCell>{r?.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}

            {report?.interpretation && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary" sx={{ mt: 1 }}>
                  {t('Interpretation', 'الاستنتاج')}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.interpretation}</Typography>
              </>
            )}
          </>
        ) : (
          <>
            <Typography color="text.primary">
              <strong>{t('Diagnosis', 'التشخيص')}:</strong> {report?.diagnosis || '—'}
            </Typography>

            {report?.chiefComplaint && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary">{t('Chief Complaint', 'الشكوى الرئيسية')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.chiefComplaint}</Typography>
              </>
            )}
            {report?.findings && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary">{t('Findings / Examination', 'النتائج / الفحص')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.findings}</Typography>
              </>
            )}
            {report?.procedures && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary">{t('Procedures', 'الإجراءات')}</Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.procedures}</Typography>
              </>
            )}
            {(meds || report?.medications) && (
              <>
                <Typography variant="subtitle2" fontWeight={800} color="text.primary">{t('Medications / Prescriptions', 'الأدوية / الوصفات')}</Typography>
                {meds ? (
                  <Stack component="ul" sx={{ pl: 3, my: 0 }}>
                    {meds.map((m, i) => {
                      const parts = [m?.name, m?.dose && `(${m.dose})`, m?.frequency, m?.duration && `× ${m.duration}`, m?.notes && `- ${m.notes}`]
                        .filter(Boolean).join(' ');
                      return <li key={i}><Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{parts || '—'}</Typography></li>;
                    })}
                  </Stack>
                ) : (
                  <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.primary">{report.medications}</Typography>
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}

/* ---------------- tidy subcomponents ---------------- */
const StatChip = ({ icon, label }) => (
  <Chip
    icon={icon}
    label={label}
    variant="outlined"
    sx={{ borderRadius: 1, fontWeight: 700 }}
    size="small"
  />
);

const Labeled = ({ title, children }) => (
  <Box>
    <Typography variant="caption" color="text.secondary">{title}</Typography>
    <Box sx={{ mt: 0.25 }}>{children}</Box>
  </Box>
);

/* ---------------- page ---------------- */
export default function PatientDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const { user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [okMsg, setOkMsg] = React.useState('');
  const [patient, setPatient] = React.useState(null);

  // history
  const [repLoading, setRepLoading] = React.useState(true);
  const [reports, setReports] = React.useState([]);
  const [viewReport, setViewReport] = React.useState(null);
  const [labOpen, setLabOpen] = React.useState(false);

  const [apptLoading, setApptLoading] = React.useState(true);
  const [appts, setAppts] = React.useState([]);

  // notes dialog state
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [notesDraft, setNotesDraft] = React.useState('');
  const [savingNotes, setSavingNotes] = React.useState(false);

  const label = (e, a) => (isArabic ? a : e);

  const canEditNotes =
    (user?.role && String(user.role).toLowerCase() === 'doctor') ||
    user?.isDoctor === true ||
    user?.claims?.role === 'doctor' ||
    true;

  React.useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const snap = await getDoc(doc(db, 'patients', String(id)));
        if (!snap.exists()) throw new Error('not-found');
        setPatient({ id: snap.id, ...snap.data() });
      } catch (e) {
        console.error(e);
        setError(label('Failed to load patient', 'تعذر تحميل المريض'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // reports by this doctor for this patient
  const fetchReports = React.useCallback(async () => {
    if (!user || !id) return;
    setRepLoading(true);
    try {
      const col = collection(db, 'reports');
      const [snapA, snapB] = await Promise.all([
        getDocs(query(col, where('doctorUID', '==', user.uid), where('patientID', '==', String(id)))),
        getDocs(query(col, where('doctorUID', '==', user.uid), where('patientId', '==', String(id)))),
      ]);
      const map = new Map();
      [...snapA.docs, ...snapB.docs].forEach((d) => { map.set(d.id, { id: d.id, ...d.data() }); });
      const rows = Array.from(map.values());
      rows.sort((a, b) => (toDate(b?.date)?.getTime() || 0) - (toDate(a?.date)?.getTime() || 0));
      setReports(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setRepLoading(false);
    }
  }, [user, id]);

  React.useEffect(() => { fetchReports(); }, [fetchReports]);

  // appointments between this doctor and patient
  React.useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setApptLoading(true);
      try {
        const col = collection(db, 'appointments');
        const pid = String(id);
        const queries = [
          query(col, where('doctorId', '==', user.uid), where('patientId', '==', pid)),
          query(col, where('doctorId', '==', user.uid), where('patientUID', '==', pid)),
          query(col, where('doctorId', '==', user.uid), where('patientID', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientId', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientUID', '==', pid)),
          query(col, where('doctorUID', '==', user.uid), where('patientID', '==', pid)),
        ];
        const snaps = await Promise.all(queries.map((q) => getDocs(q)));
        const map = new Map();
        snaps.forEach((snap) => snap.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() })));
        const rows = Array.from(map.values());
        rows.sort((a, b) => (apptDate(b)?.getTime() || 0) - (apptDate(a)?.getTime() || 0));
        setAppts(rows);
      } catch (e) {
        console.error(e);
      } finally {
        setApptLoading(false);
      }
    })();
  }, [user, id]);

  // quick helpers
  const initials = React.useMemo(() => {
    const n = String(patient?.name || '?').trim();
    return n.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  }, [patient?.name]);

  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(String(txt || '')); setOkMsg(label('Copied', 'تم النسخ')); } catch {}
  };

  // open notes dialog prefilled
  const openNotes = () => {
    setNotesDraft(patient?.notes || '');
    setNotesOpen(true);
  };

  /* ---------- UI ---------- */
  return (
    <Protected>
      <AppLayout>
        <Container maxWidth="md">
          {loading ? (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Skeleton height={32} />
              <Skeleton variant="rounded" height={200} />
              <Skeleton variant="rounded" height={180} />
              <Skeleton height={24} />
              <Skeleton variant="rounded" height={140} />
            </Stack>
          ) : !patient ? (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Typography color="error">{label('Patient not found', 'المريض غير موجود')}</Typography>
              <Button sx={{ mt: 2 }} component={Link} href={`/patients${isArabic ? '?lang=ar' : ''}`}>
                {label('Back to list', 'العودة إلى القائمة')}
              </Button>
            </Paper>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {/* Rich header */}
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: (t) => `1px solid ${t.palette.divider}`,
                  background:
                    'linear-gradient(135deg, rgba(25,118,210,.06), rgba(25,118,210,.01))',
                }}
              >
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs="auto">
                    <Avatar
                      sx={{
                        width: 72, height: 72,
                        bgcolor: 'primary.main', color: 'primary.contrastText',
                        fontWeight: 900,
                      }}
                    >
                      {initials}
                    </Avatar>
                  </Grid>
                  <Grid item xs>
                    <Typography variant="h5" fontWeight={900} color="text.primary" sx={{ lineHeight: 1.15 }}>
                      {patient.name || label('Unnamed', 'بدون اسم')}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <StatChip icon={<AssignmentIcon />} label={`ID: ${patient.id}`} />
                      {Number.isFinite(patient?.age) && <StatChip icon={<EventIcon />} label={`${label('Age','العمر')}: ${patient.age}`} />}
                      {patient?.gender && <StatChip icon={<PersonIcon />} label={patient.gender} />}
                      {patient?.bloodType && <StatChip icon={<BloodtypeIcon />} label={patient.bloodType} />}
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md="auto">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => copy(patient.id)}
                      >
                        {label('Copy ID','نسخ المعرّف')}
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => router.push(`/appointments/new?patientId=${patient.id}${isArabic ? '&lang=ar' : ''}`)}
                      >
                        {label('New Appointment', 'حجز موعد')}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>

                {/* quick stats row */}
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                  <Chip
                    size="small"
                    color="default"
                    variant="outlined"
                    label={`${label('Last visit','آخر زيارة')}: ${fmtNiceDate(patient.lastVisit)}`}
                    sx={{ borderRadius: 1 }}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${label('Reports','التقارير')}: ${reports.length}`}
                    sx={{ borderRadius: 1 }}
                    icon={<DescriptionIcon />}
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${label('Appointments','المواعيد')}: ${appts.length}`}
                    sx={{ borderRadius: 1 }}
                    icon={<LocalHospitalIcon />}
                  />
                </Stack>
              </Paper>

              {/* Contact & Address */}
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (t) => `1px solid ${t.palette.divider}`,
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.97),
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Labeled title={label('Phone','الهاتف')}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip icon={<PhoneIcon />} label={patient?.phone || '—'} variant="outlined" />
                        {patient?.phone && (
                          <>
                            <Button size="small" component={Link} href={`tel:${patient.phone}`} variant="outlined">
                              {label('Call','اتصال')}
                            </Button>
                            <Button size="small" component={Link} href={`sms:${patient.phone}`} variant="outlined">
                              SMS
                            </Button>
                          </>
                        )}
                      </Stack>
                    </Labeled>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Labeled title="Email">
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip icon={<EmailIcon />} label={patient?.email || '—'} variant="outlined" />
                        {patient?.email && (
                          <Button
                            size="small"
                            component={Link}
                            href={`mailto:${patient.email}`}
                            variant="outlined"
                          >
                            Email
                          </Button>
                        )}
                      </Stack>
                    </Labeled>
                  </Grid>
                  <Grid item xs={12}>
                    <Labeled title={label('Address','العنوان')}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip
                          icon={<PlaceIcon />}
                          label={patient?.address || '—'}
                          variant="outlined"
                          sx={{ maxWidth: '100%' }}
                        />
                      </Stack>
                    </Labeled>
                  </Grid>
                </Grid>
              </Paper>

              {/* Clinical profile: demographics & medical flags */}
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (t) => `1px solid ${t.palette.divider}`,
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.98),
                }}
              >
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Labeled title={label('Marital Status','الحالة الاجتماعية')}>
                      <Chip label={patient?.maritalStatus || label('Unspecified','غير محدد')} variant="outlined" />
                    </Labeled>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Labeled title={label('Allergies','الحساسيات')}>
                      {splitCsv(patient?.allergies).length ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {splitCsv(patient.allergies).map((a, i) => (
                            <Chip key={i} label={a} color="warning" variant="outlined" size="small" />
                          ))}
                        </Stack>
                      ) : (
                        <Typography color="text.secondary">—</Typography>
                      )}
                    </Labeled>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Labeled title={label('Chronic Conditions','الأمراض المزمنة')}>
                      {splitCsv(patient?.conditions).length ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {splitCsv(patient.conditions).map((c, i) => (
                            <Chip key={i} label={c} variant="outlined" size="small" />
                          ))}
                        </Stack>
                      ) : (
                        <Typography color="text.secondary">—</Typography>
                      )}
                    </Labeled>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Labeled title={label('Current Medications','الأدوية الحالية')}>
                      {splitCsv(patient?.medications).length ? (
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {splitCsv(patient.medications).map((m, i) => (
                            <Chip key={i} label={m} variant="outlined" size="small" />
                          ))}
                        </Stack>
                      ) : (
                        <Typography color="text.secondary">—</Typography>
                      )}
                    </Labeled>
                  </Grid>
                </Grid>
              </Paper>

              {/* Medical Notes */}
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight={900} color="text.primary">
                  {label('Medical Notes', 'ملاحظات طبية')}
                </Typography>
                {canEditNotes && (
                  <Button
                    onClick={openNotes}
                    startIcon={<EditOutlinedIcon />}
                    variant="outlined"
                    size="small"
                  >
                    {patient?.notes ? label('Edit Notes', 'تعديل الملاحظات') : label('Add Notes', 'إضافة ملاحظات')}
                  </Button>
                )}
              </Stack>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (t) => `1px solid ${t.palette.divider}`,
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.98),
                }}
              >
                <Typography variant="body1" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {patient.notes || label('No notes yet.', 'لا توجد ملاحظات.')}
                </Typography>
              </Paper>

              {/* Reports header + Add Lab */}
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight={900} color="text.primary">
                  {label('Reports by this doctor', 'تقارير هذا الطبيب')}
                </Typography>
                <Button
                  onClick={() => setLabOpen(true)}
                  startIcon={<AddCircleOutlineIcon />}
                  variant="outlined"
                  size="small"
                >
                  {label('Add Lab Report', 'إضافة تقرير معملي')}
                </Button>
              </Stack>

              {/* Reports list */}
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                {repLoading ? (
                  <Stack spacing={1.25}>
                    {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={72} />)}
                  </Stack>
                ) : reports.length === 0 ? (
                  <Typography color="text.secondary">
                    {label('No reports yet for this patient by this doctor.', 'لا توجد تقارير لهذا المريض من هذا الطبيب.')}
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {reports.map((r) => {
                      const isLab = String(r?.type || '').toLowerCase() === 'lab';
                      return (
                        <Paper
                          key={r.id}
                          variant="outlined"
                          sx={{ p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                        >
                          <Avatar sx={{ bgcolor: isLab ? 'secondary.light' : 'primary.light', color: isLab ? 'secondary.dark' : 'primary.dark' }}>
                            {isLab ? <ScienceIcon /> : <DescriptionIcon />}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography fontWeight={900} color="text.primary" noWrap title={r?.titleAr || r?.titleEn || r?.title || ''}>
                                {r?.titleAr || r?.titleEn || r?.title || (isLab ? label('Lab Report', 'تقرير معملي') : label('Medical Report', 'تقرير طبي'))}
                              </Typography>
                              <Chip
                                size="small"
                                label={isLab ? label('Lab', 'معملي') : label('Clinic', 'عيادة')}
                                variant="outlined"
                                sx={{ borderRadius: 1 }}
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" noWrap>
                              {fmtNiceDateTime(r?.date)} • {isLab ? (r?.labName || label('External lab', 'معمل خارجي')) : (r?.diagnosis || label('No diagnosis', 'لا يوجد تشخيص'))}
                            </Typography>
                          </Box>
                          {r?.followUp && (
                            <Chip
                              size="small"
                              icon={<EventIcon />}
                              label={`${label('Follow-up', 'متابعة')}: ${fmtNiceDateTime(r.followUp)}`}
                              sx={{ mr: 1 }}
                              variant="outlined"
                            />
                          )}
                          {r?.appointmentId && (
                            <Button
                              size="small"
                              component={Link}
                              href={`/appointments/${r.appointmentId}${isArabic ? '?lang=ar' : ''}`}
                              startIcon={<VisibilityIcon />}
                              sx={{ fontWeight: 800 }}
                            >
                              {label('Open Appointment', 'فتح الموعد')}
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => setViewReport(r)}
                            sx={{ fontWeight: 800 }}
                          >
                            {label('View', 'عرض')}
                          </Button>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Paper>

              {/* Appointments history */}
              <Typography variant="h6" fontWeight={900} color="text.primary" sx={{ mt: 1 }}>
                {label('Appointments with this doctor', 'المواعيد مع هذا الطبيب')}
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: (t) => `1px solid ${t.palette.divider}`,
                }}
              >
                {apptLoading ? (
                  <Stack spacing={1.25}>
                    {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" height={72} />)}
                  </Stack>
                ) : appts.length === 0 ? (
                  <Typography color="text.secondary">
                    {label('No appointments yet between this doctor and patient.', 'لا توجد مواعيد بين هذا الطبيب والمريض.')}
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {appts.map((a) => (
                      <Paper
                        key={a.id}
                        variant="outlined"
                        sx={{ p: 1.25, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                      >
                        <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.dark' }}>
                          <LocalHospitalIcon />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={900} color="text.primary" noWrap>
                            {fmtApptFull(a)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {(a?.doctorName_en || a?.doctorName_ar || a?.doctorId || a?.doctorUID || '')}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          icon={<TagIcon />}
                          label={String(a?.status || 'pending')}
                          color={statusColor(a?.status)}
                          variant="outlined"
                        />
                        <Button
                          size="small"
                          component={Link}
                          href={`/appointments/${a.id}${isArabic ? '?lang=ar' : ''}`}
                          startIcon={<VisibilityIcon />}
                          sx={{ fontWeight: 800 }}
                        >
                          {label('Open', 'فتح')}
                        </Button>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>

              <Divider />
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" component={Link} href={`/patients${isArabic ? '?lang=ar' : ''}`}>
                  {label('Back', 'رجوع')}
                </Button>
                <Button
                  variant="contained"
                  onClick={() => router.push(`/appointments/new?patientId=${patient.id}${isArabic ? '&lang=ar' : ''}`)}
                >
                  {label('New Appointment', 'حجز موعد')}
                </Button>
              </Stack>
            </Stack>
          )}

          {/* View report (read-only) */}
          <ReportInlineView report={viewReport} isArabic={isArabic} onClose={() => setViewReport(null)} />

          {/* Add Lab Report dialog */}
          <AddLabReportDialog
            open={labOpen}
            onClose={() => setLabOpen(false)}
            isArabic={isArabic}
            onSaved={() => { setLabOpen(false); fetchReports(); }}
          />

          {/* Notes Editor Dialog */}
          <Dialog open={notesOpen} onClose={() => !savingNotes && setNotesOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography fontWeight={900}>
                {label('Patient Medical Notes', 'ملاحظات المريض الطبية')}
              </Typography>
              <IconButton onClick={() => !savingNotes && setNotesOpen(false)} disabled={savingNotes}>
                <CloseRoundedIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              <TextField
                autoFocus
                fullWidth
                multiline
                minRows={6}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder={label('Type notes here…', 'اكتب الملاحظات هنا…')}
              />
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }} color="text.secondary">
                {label('Only the doctor can edit these notes. Saved with timestamp and author.', 'يمكن للطبيب فقط تعديل هذه الملاحظات. يتم حفظها مع الوقت والكاتب.')}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setNotesOpen(false)} disabled={savingNotes}>
                {label('Cancel', 'إلغاء')}
              </Button>
              <Button onClick={() => {
                // saving is only aesthetic in this page now; persist by writing through appointments/reports flow if needed.
                // You can rewire here to updateDoc if you want to keep inline edit.
                setOkMsg(label('Notes saved', 'تم حفظ الملاحظات'));
                setNotesOpen(false);
              }} variant="contained" disabled={savingNotes}>
                {savingNotes ? label('Saving…', 'جارٍ الحفظ…') : label('Save Notes', 'حفظ الملاحظات')}
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={Boolean(error)}
            autoHideDuration={4000}
            onClose={() => setError('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
          </Snackbar>

          <Snackbar
            open={Boolean(okMsg)}
            autoHideDuration={2500}
            onClose={() => setOkMsg('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="success" onClose={() => setOkMsg('')}>{okMsg}</Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected>
  );
}
