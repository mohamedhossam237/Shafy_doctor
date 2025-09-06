// /pages/patient-reports/[id].js
'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Avatar, Box, Button, Chip, CircularProgress, Container, Divider,
  Grid, Paper, Skeleton, Stack, Typography
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import EventIcon from '@mui/icons-material/Event';
import CategoryIcon from '@mui/icons-material/Category';
import PaidIcon from '@mui/icons-material/Paid';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const grad = (a, b) => `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;

// Format Firestore Timestamp or ISO to human readable
function fmtDate(val) {
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  } catch { return '—'; }
}

export default function PatientReportDetails() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  // Arabic as default if no ?lang provided
  const isArabic = React.useMemo(
    () => (router?.query?.lang ? router.query.lang === 'ar' : true),
    [router?.query?.lang]
  );
  const withLang = React.useCallback(
    (p) => (isArabic ? `${p}${p.includes('?') ? '&' : '?'}lang=ar` : p),
    [isArabic]
  );

  const [mounted, setMounted] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [row, setRow] = React.useState(null);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!user || !id) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        // Single document fetch (no composite index needed)
        const snap = await getDoc(doc(db, 'reports', String(id)));
        if (!snap.exists()) {
          setErr(isArabic ? 'التقرير غير موجود' : 'Report not found');
          setRow(null);
        } else {
          setRow({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        setErr(e?.message || (isArabic ? 'فشل تحميل التقرير' : 'Failed to load report'));
        setRow(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, id, isArabic]);

  if (!mounted) return null;

  const title = row?.title || (isArabic ? 'تقرير طبي' : 'Medical Report');
  const patientName = row?.patientName || (isArabic ? 'مريض' : 'Patient');
  const patientID = row?.patientID || row?.patientId;
  const dateTxt = row?.date ? fmtDate(row.date) : '—';
  const typeTxt = row?.type
    ? (row.type === 'lab'
        ? (isArabic ? 'مختبر' : 'Lab')
        : row.type === 'doctor'
          ? (isArabic ? 'طبيب' : 'Doctor')
          : (isArabic ? 'غير محدد' : 'Unknown'))
    : (isArabic ? 'غير محدد' : 'Unknown');
  const categoryMap = {
    consult: isArabic ? 'استشارة' : 'Consult',
    procedures: isArabic ? 'إجراءات' : 'Procedures',
    meds: isArabic ? 'أدوية' : 'Meds',
    followUp: isArabic ? 'متابعة' : 'Follow-up'
  };
  const categoryTxt = row?.category ? (categoryMap[row.category] || row.category) : null;
  const fee = typeof row?.fee === 'number' ? row.fee : Number(row?.fee || 0);
  const notes = row?.notes || row?.description;

  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container disableGutters maxWidth="lg">
          {/* Header */}
          <Box
            sx={{
              mt: 1,
              p: { xs: 1.5, md: 2.5 },
              borderRadius: 3,
              backgroundImage: grad('#e8f5e9', '#fff'),
              border: (t) => `1px solid ${t.palette.divider}`,
            }}
          >
            <Stack
              direction={isArabic ? 'row-reverse' : 'row'}
              spacing={1.5}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.25} alignItems="center">
                <Avatar sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}>
                  <AssignmentIcon />
                </Avatar>
                <Typography variant="h6" fontWeight={800} noWrap>
                  {isArabic ? 'تفاصيل التقرير' : 'Report Details'}
                </Typography>
              </Stack>
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={!isArabic ? <ArrowBackIosNewIcon /> : null}
                  endIcon={isArabic ? <ArrowBackIosNewIcon /> : null}
                  onClick={() => router.back()}
                >
                  {isArabic ? 'رجوع' : 'Back'}
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* Loading / Error */}
          {loading ? (
            <Box sx={{ py: 3 }}>
              <Grid container spacing={2}>
                {[...Array(4)].map((_, i) => (
                  <Grid key={i} item xs={12}>
                    <Skeleton variant="rounded" height={80} />
                  </Grid>
                ))}
              </Grid>
              <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
                <CircularProgress />
              </Box>
            </Box>
          ) : err ? (
            <Paper sx={{ p: 3, my: 3, borderRadius: 3 }}>
              <Typography color="error" fontWeight={700} whiteSpace="pre-wrap">
                {isArabic ? 'حدث خطأ' : 'Error'}: {err}
              </Typography>
            </Paper>
          ) : !row ? (
            <Paper sx={{ p: 2, mt: 2, borderRadius: 2 }}>
              <Typography color="text.secondary">
                {isArabic ? 'لا توجد بيانات' : 'No data available'}
              </Typography>
            </Paper>
          ) : (
            <>
              {/* Title */}
              <Paper sx={{ p: { xs: 1.75, md: 2.25 }, borderRadius: 3, mt: 2 }}>
                <Typography variant="h6" fontWeight={900}>
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isArabic ? 'التاريخ: ' : 'Date: '}{dateTxt}
                </Typography>
              </Paper>

              {/* Meta grid */}
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Paper sx={{ p: 2, borderRadius: 3 }}>
                    <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.25} alignItems="center">
                      <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                        <PersonIcon />
                      </Avatar>
                      <Box>
                        <Typography fontWeight={800} noWrap>{patientName}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {isArabic ? 'المريض' : 'Patient'}
                        </Typography>
                      </Box>
                    </Stack>
                    {patientID ? (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          component={Link}
                          href={withLang(`/patients/${patientID}`)}
                          size="small"
                          variant="outlined"
                        >
                          {isArabic ? 'عرض الملف' : 'Open profile'}
                        </Button>
                      </Box>
                    ) : null}
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Paper sx={{ p: 2, borderRadius: 3 }}>
                    <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.25} alignItems="center">
                      <Avatar sx={{ bgcolor: 'info.main', color: 'info.contrastText' }}>
                        <EventIcon />
                      </Avatar>
                      <Box>
                        <Typography fontWeight={800} noWrap>{dateTxt}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {isArabic ? 'التاريخ' : 'Date'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Paper sx={{ p: 2, borderRadius: 3 }}>
                    <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1.25} alignItems="center" flexWrap="wrap">
                      <Avatar sx={{ bgcolor: 'warning.main', color: 'warning.contrastText' }}>
                        <CategoryIcon />
                      </Avatar>
                      <Stack spacing={0.75}>
                        <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
                          <Chip size="small" label={typeTxt} variant="outlined" />
                          {categoryTxt ? <Chip size="small" label={categoryTxt} variant="outlined" /> : null}
                        </Stack>
                        {fee > 0 && (
                          <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} alignItems="center">
                            <PaidIcon fontSize="small" />
                            <Typography variant="body2" fontWeight={700}>
                              {isArabic ? `${fee} ر.ق` : `QAR ${fee}`}
                            </Typography>
                          </Stack>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>

              {/* Notes / details */}
              {(notes && String(notes).trim().length > 0) && (
                <Paper sx={{ p: 2, borderRadius: 3, mt: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 0.5 }}>
                    {isArabic ? 'ملاحظات' : 'Notes'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                  <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                    {String(notes)}
                  </Typography>
                </Paper>
              )}

              {/* Attachments (optional: array of URLs) */}
              {Array.isArray(row?.attachments) && row.attachments.length > 0 && (
                <Paper sx={{ p: 2, borderRadius: 3, mt: 2 }}>
                  <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                    {isArabic ? 'مرفقات' : 'Attachments'}
                  </Typography>
                  <Grid container spacing={1.5}>
                    {row.attachments.map((url, i) => (
                      <Grid key={i} item xs={6} sm={4} md={3}>
                        <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                          <Box
                            sx={{
                              height: 120,
                              borderRadius: 2,
                              overflow: 'hidden',
                              border: (t) => `1px solid ${t.palette.divider}`,
                              backgroundImage: `url(${url})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                        </a>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}
            </>
          )}
        </Container>
      </Box>
    </AppLayout>
  );
}
