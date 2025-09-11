// /pages/labs/[id].js
'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Paper,
  Stack,
  Typography,
  Grid,
  TextField,
  InputAdornment,
  Skeleton,
  Button,
  Divider,
  Avatar,
  Chip,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import BiotechIcon from '@mui/icons-material/Biotech';
import PlaceIcon from '@mui/icons-material/Place';
import PhoneIcon from '@mui/icons-material/Phone';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

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

const grad = (from, to) => `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

// Normalize Firestore Timestamp | ISO string | Date to Date
function toDate(val) {
  try {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val?.toDate === 'function') return val.toDate(); // Firestore Timestamp
    const d = new Date(val);
    return isNaN(d) ? null : d;
  } catch {
    return null;
  }
}

function fmtDateTime(date, isArabic) {
  const d = toDate(date);
  if (!d) return isArabic ? 'بدون تاريخ' : 'No date';
  const locale = isArabic ? 'ar-EG-u-nu-arab' : undefined;
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
}

const STATUS_OPTS = [
  { id: '', en: 'All statuses', ar: 'كل الحالات' },
  { id: 'pending', en: 'Pending', ar: 'قيد الانتظار' },
  { id: 'processing', en: 'Processing', ar: 'قيد المعالجة' },
  { id: 'ready', en: 'Ready', ar: 'جاهز' },
  { id: 'completed', en: 'Completed', ar: 'منجز' },
  { id: 'rejected', en: 'Rejected', ar: 'مرفوض' },
];

function statusChipProps(status) {
  const s = String(status || '').toLowerCase();
  switch (s) {
    case 'ready':
    case 'completed':
      return { color: 'success', variant: 'outlined', label: s };
    case 'pending':
      return { color: 'warning', variant: 'outlined', label: s };
    case 'processing':
      return { color: 'info', variant: 'outlined', label: s };
    case 'rejected':
      return { color: 'error', variant: 'outlined', label: s };
    default:
      return { color: 'default', variant: 'outlined', label: s || '—' };
  }
}

function mapReportData(id, data) {
  const d = data || {};
  return {
    id,
    // Names
    testNameEn: d.testNameEn ?? d.test_en ?? d.testName ?? '',
    testNameAr: d.testNameAr ?? d.test_ar ?? d.testName ?? '',
    patientNameEn: d.patientNameEn ?? d.patient_en ?? d.patientName ?? '',
    patientNameAr: d.patientNameAr ?? d.patient_ar ?? d.patientName ?? '',
    // Meta
    status: d.status ?? '',
    referenceNo: d.referenceNo ?? d.reference ?? d.code ?? '',
    sampleId: d.sampleId ?? d.sample ?? '',
    // Times
    createdAt: d.createdAt ?? d.created_at ?? d.created ?? '',
    reportedAt: d.reportedAt ?? d.reported_at ?? d.completedAt ?? d.completed_at ?? '',
    // Files/links
    reportUrl: d.reportUrl ?? d.url ?? d.fileUrl ?? d.pdfUrl ?? '',
    notes: d.notes ?? '',
    price: d.price ?? '',
  };
}

export default function LabReportsPage() {
  const router = useRouter();
  const { id } = router.query;

  // Language: Arabic default unless explicitly set to EN
  const [mounted, setMounted] = React.useState(false);
  const [isArabic, setIsArabic] = React.useState(true);
  React.useEffect(() => {
    setMounted(true);
    const q = router?.query || {};
    if (q.lang) {
      setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    } else if (q.ar) {
      setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    } else {
      setIsArabic(true);
    }
  }, [router.query]);

  const L = (en, ar) => (isArabic ? ar : en);
  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path),
    [isArabic]
  );

  // State
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [lab, setLab] = React.useState(null);
  const [reports, setReports] = React.useState([]);

  const [qText, setQText] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [hasFileOnly, setHasFileOnly] = React.useState(false);

  // Fetch lab + reports
  React.useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        // Lab info
        const snap = await getDoc(doc(db, 'labs', String(id)));
        if (!snap.exists()) {
          setErr(L('Lab not found.', 'المعمل غير موجود.'));
          setLoading(false);
          return;
        }
        const ld = snap.data() || {};
        setLab({
          id: snap.id,
          nameEn: ld.name_en || ld.nameEn || '',
          nameAr: ld.name_ar || ld.nameAr || '',
          addressEn: ld.address_en || ld.addressEn || '',
          addressAr: ld.address_ar || ld.addressAr || '',
          phone: ld.phone || '',
          city: ld.city || '',
          country: ld.country || '',
        });

        // Preferred: subcollection labs/{id}/reports
        let items = [];
        const sub = await getDocs(collection(db, 'labs', String(id), 'reports'));
        if (!sub.empty) {
          items = sub.docs.map((d) => mapReportData(d.id, d.data()));
        } else {
          // Fallback: top-level lab_reports with labId
          const top = await getDocs(
            query(collection(db, 'lab_reports'), where('labId', '==', String(id)))
          );
          items = top.docs.map((d) => mapReportData(d.id, d.data()));
        }
        setReports(items);
      } catch (e) {
        console.error(e);
        setErr(e?.message || L('Failed to load data.', 'تعذّر تحميل البيانات.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter + sort
  const filtered = React.useMemo(() => {
    const t = qText.trim().toLowerCase();

    let out = reports.filter((r) => {
      const nameMix = `${r.testNameEn} ${r.testNameAr} ${r.patientNameEn} ${r.patientNameAr}`.toLowerCase();
      const statusMatch = status ? String(r.status || '').toLowerCase() === status : true;
      const fileMatch = hasFileOnly ? Boolean(r.reportUrl) : true;
      const qMatch = t ? nameMix.includes(t) || String(r.referenceNo).toLowerCase().includes(t) || String(r.sampleId).toLowerCase().includes(t) : true;
      return statusMatch && fileMatch && qMatch;
    });

    // Sort by reportedAt desc, fallback createdAt desc
    out.sort((a, b) => {
      const da = toDate(a.reportedAt) || toDate(a.createdAt) || new Date(0);
      const dbb = toDate(b.reportedAt) || toDate(b.createdAt) || new Date(0);
      return dbb - da;
    });

    return out;
  }, [reports, qText, status, hasFileOnly]);

  if (!mounted) return null;

  const labName = lab ? (isArabic ? lab.nameAr || lab.nameEn : lab.nameEn || lab.nameAr) : '';
  const labAddress = lab
    ? isArabic
      ? lab.addressAr || lab.addressEn
      : lab.addressEn || lab.addressAr
    : '';

  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container disableGutters maxWidth="lg" sx={{ pb: 4 }}>
          {/* Header */}
          <Paper
            sx={{
              mt: 1,
              p: { xs: 1.5, md: 2.5 },
              borderRadius: 3,
              backgroundImage: (t) => grad('#e9f3ff', '#ffffff'),
              border: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              spacing={{ xs: 1.5, md: 2 }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontWeight: 800,
                  }}
                >
                  <BiotechIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1 }}>
                    {labName || L('Lab', 'المعمل')}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                    <PlaceIcon fontSize="small" />
                    <Typography variant="body2">
                      {labAddress || L('No address', 'لا يوجد عنوان')}
                    </Typography>
                    {lab?.city ? (
                      <Chip size="small" label={lab.city} sx={{ ml: 1 }} />
                    ) : null}
                  </Stack>
                </Box>
              </Stack>

              {/* Search & Filters */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                <TextField
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder={L('Search by patient, test, reference…', 'ابحث بالمريض، التحليل، الرقم المرجعي…')}
                  size="small"
                  sx={{ width: { xs: '100%', md: 360 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  select
                  size="small"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  sx={{ minWidth: 160 }}
                  label={L('Status', 'الحالة')}
                >
                  {STATUS_OPTS.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {L(s.en, s.ar)}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Switch
                      checked={hasFileOnly}
                      onChange={(e) => setHasFileOnly(e.target.checked)}
                    />
                  }
                  label={L('With attachment only', 'مع مرفق فقط')}
                />
                <Button
                  component={Link}
                  href={withLang('/labs')}
                  size="small"
                  startIcon={<ArrowBackIcon />}
                  sx={{ fontWeight: 800 }}
                >
                  {L('All Labs', 'كل المعامل')}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* Quick contact bar */}
          {lab && (
            <Paper
              sx={{
                p: 1.25,
                borderRadius: 2,
                mt: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                justifyContent: isArabic ? 'flex-start' : 'flex-end',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <PhoneIcon sx={{ color: 'text.disabled' }} />
                <Typography variant="body2">
                  {lab.phone ? (
                    <Box
                      component="a"
                      href={`tel:${lab.phone}`}
                      sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 700 }}
                    >
                      {lab.phone}
                    </Box>
                  ) : (
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {L('No phone', 'لا يوجد هاتف')}
                    </Box>
                  )}
                </Typography>
              </Stack>
            </Paper>
          )}

          {/* Content */}
          {loading ? (
            <Box sx={{ py: 3 }}>
              <Grid container spacing={2}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <Grid key={i} item xs={12} sm={6} md={4}>
                    <Skeleton variant="rounded" height={140} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : err ? (
            <Paper sx={{ p: 2, borderRadius: 2, mt: 2 }}>
              <Typography color="error" fontWeight={700}>
                {L('Error', 'خطأ')}: {err}
              </Typography>
            </Paper>
          ) : (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
                sx={{ mt: 3, mb: 1 }}
              >
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {L('Reports', 'التقارير')}: {filtered.length}
                </Typography>
              </Stack>
              <Divider />

              {filtered.length === 0 ? (
                <Paper sx={{ p: 3, mt: 2, borderRadius: 2 }}>
                  <Typography color="text.secondary">
                    {qText
                      ? L('No reports match your search.', 'لا توجد تقارير مطابقة لبحثك.')
                      : L('No reports found for this lab.', 'لا توجد تقارير لهذا المعمل.')}
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {filtered.map((r) => {
                    const testName = isArabic ? (r.testNameAr || r.testNameEn) : (r.testNameEn || r.testNameAr);
                    const patient = isArabic ? (r.patientNameAr || r.patientNameEn) : (r.patientNameEn || r.patientNameAr);
                    const created = fmtDateTime(r.createdAt, isArabic);
                    const reported = fmtDateTime(r.reportedAt, isArabic);
                    const chip = statusChipProps(r.status);

                    return (
                      <Grid key={r.id} item xs={12} sm={6} md={4}>
                        <Paper
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            border: (t) => `1px solid ${t.palette.divider}`,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            textAlign: isArabic ? 'right' : 'left',
                          }}
                        >
                          {/* Header: icon left, title to the right */}
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Avatar
                              sx={{
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                width: 40,
                                height: 40,
                                flexShrink: 0,
                              }}
                            >
                              <DescriptionIcon />
                            </Avatar>
                            <Typography
                              variant="subtitle1"
                              fontWeight={800}
                              sx={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                              }}
                              title={testName}
                            >
                              {testName || L('Test', 'تحليل')}
                            </Typography>
                          </Stack>

                          {/* Meta */}
                          <Typography variant="body2" color="text.secondary" title={patient}>
                            {L('Patient', 'المريض')}: {patient || L('N/A', 'غير متوفر')}
                          </Typography>

                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip size="small" {...chip} label={isArabic ? ({
                              pending: 'قيد الانتظار',
                              processing: 'قيد المعالجة',
                              ready: 'جاهز',
                              completed: 'منجز',
                              rejected: 'مرفوض',
                            }[String(r.status || '').toLowerCase()] || '—') : (chip.label)} />
                            {r.referenceNo ? (
                              <Chip size="small" variant="outlined" label={`${L('Ref', 'مرجع')}: ${r.referenceNo}`} />
                            ) : null}
                            {r.sampleId ? (
                              <Chip size="small" variant="outlined" label={`${L('Sample', 'عينة')}: ${r.sampleId}`} />
                            ) : null}
                          </Stack>

                          <Typography variant="caption" color="text.secondary">
                            {L('Created', 'تم الإنشاء')}: {created}
                          </Typography>
                          {r.reportedAt ? (
                            <Typography variant="caption" color="text.secondary">
                              {L('Reported', 'تم الإصدار')}: {reported}
                            </Typography>
                          ) : null}

                          <Box sx={{ flexGrow: 1 }} />

                          {/* Actions */}
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent={isArabic ? 'flex-start' : 'flex-end'}
                          >
                            {r.reportUrl ? (
                              <>
                                <Button
                                  size="small"
                                  variant="contained"
                                  startIcon={<PictureAsPdfIcon />}
                                  component="a"
                                  href={r.reportUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  sx={{ borderRadius: 2 }}
                                >
                                  {L('Open', 'فتح')}
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<CloudDownloadIcon />}
                                  component="a"
                                  href={r.reportUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  sx={{ borderRadius: 2 }}
                                >
                                  {L('Download', 'تنزيل')}
                                </Button>
                              </>
                            ) : (
                              <Button size="small" variant="outlined" disabled startIcon={<PictureAsPdfIcon />}>
                                {L('No file', 'لا يوجد ملف')}
                              </Button>
                            )}
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </>
          )}
        </Container>
      </Box>
    </AppLayout>
  );
}
