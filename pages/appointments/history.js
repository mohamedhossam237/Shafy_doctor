// /pages/appointments/history.jsx
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
  Grid,
  TextField,
  Button,
  Chip,
  Snackbar,
  Alert,
  Skeleton,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import EventIcon from '@mui/icons-material/Event';
import PersonIcon from '@mui/icons-material/Person';
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import TagIcon from '@mui/icons-material/Tag';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

/* ---------------- utils (unify date/time across shapes) ---------------- */

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return Number.isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (val?.toDate) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  return null;
}

function apptDate(appt) {
  // shape A: { appointmentDate: Timestamp/Date }
  if (appt?.appointmentDate) return toDate(appt.appointmentDate);

  // shape B: { date: 'YYYY-MM-DD', time: 'HH:mm' }
  if (appt?.date) {
    const [y, m, d] = String(appt.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(appt.time || '00:00').split(':').map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
    }
  }
  // last resort: createdAt
  return toDate(appt?.createdAt) || null;
}

function fmtDateTime(d, locale) {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return 'success';
  if (s === 'confirmed') return 'info';
  if (s === 'cancelled') return 'default';
  return 'warning';
}

function normalizePhone(s) {
  return String(s || '').replace(/[^\d+]/g, '');
}

function matchesSearch(appt, term) {
  if (!term) return true;
  const q = term.trim().toLowerCase();
  if (!q) return true;

  const name = String(appt?.patientName || '').toLowerCase();
  const phone = normalizePhone(appt?.patientPhone);

  return name.includes(q) || phone.includes(q.replace(/[^\d+]/g, ''));
}

/* ---------------- row card ---------------- */

function RowCard({ appt, isArabic, locale }) {
  const d = appt._dt;
  const href = `/appointments/${appt.id}${isArabic ? '?lang=ar' : ''}`;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        justifyContent: 'space-between',
        flexWrap: 'wrap',
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
        <PersonIcon color="action" />
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={800} noWrap title={appt?.patientName || ''}>
            {appt?.patientName || (isArabic ? 'بدون اسم' : 'Unnamed')}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            <LocalPhoneIcon fontSize="inherit" sx={{ mr: .5, verticalAlign: 'text-bottom' }} />
            {appt?.patientPhone || '—'}
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
        <EventIcon color="action" />
        <Typography variant="body2" color="text.secondary" noWrap title={fmtDateTime(d, locale)}>
          {fmtDateTime(d, locale)}
        </Typography>
      </Stack>

      <Chip
        icon={<TagIcon />}
        label={(appt.status || 'pending').toString()}
        color={statusColor(appt.status)}
        sx={{ fontWeight: 700, borderRadius: 2, mr: 1 }}
      />

      <Button
        component={Link}
        href={href}
        endIcon={<ArrowForwardIosIcon />}
        variant="outlined"
        sx={{ whiteSpace: 'nowrap' }}
      >
        {isArabic ? 'فتح' : 'Open'}
      </Button>
    </Paper>
  );
}

/* ---------------- page ---------------- */

export default function AppointmentsHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const isArabic =
    String(router?.query?.lang || router?.query?.ar || '')
      .toLowerCase()
      .startsWith('ar');
  const dir = isArabic ? 'rtl' : 'ltr';
  const locale = isArabic ? 'ar' : undefined;
  const t = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  // data state
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [rows, setRows] = React.useState([]); // all fetched
  const [filtered, setFiltered] = React.useState([]);

  // controls
  const [search, setSearch] = React.useState('');
  const [fromStr, setFromStr] = React.useState(''); // YYYY-MM-DD
  const [toStr, setToStr] = React.useState('');     // YYYY-MM-DD

  const backHref = `/appointments${isArabic ? '?lang=ar' : ''}`;

  const applyFilters = React.useCallback(() => {
    const from = fromStr ? new Date(fromStr + 'T00:00:00') : null;
    const to = toStr ? new Date(toStr + 'T23:59:59') : null;

    const out = rows
      .filter((r) => {
        if (!matchesSearch(r, search)) return false;
        const d = r._dt;
        if (!d) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      })
      .sort((a, b) => (b._dt?.getTime() || 0) - (a._dt?.getTime() || 0));

    setFiltered(out);
  }, [rows, search, fromStr, toStr]);

  React.useEffect(() => { applyFilters(); }, [applyFilters]);

  const fetchData = React.useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    try {
      const col = collection(db, 'appointments');
      // Support both shapes: patient-created uses doctorId, legacy/manual uses doctorUID
      const [snapA, snapB] = await Promise.all([
        getDocs(query(col, where('doctorId', '==', user.uid))),
        getDocs(query(col, where('doctorUID', '==', user.uid))),
      ]);

      // Merge + dedupe
      const map = new Map();
      [...snapA.docs, ...snapB.docs].forEach((d) => {
        const data = d.data();
        map.set(d.id, { id: d.id, ...data });
      });
      const all = Array.from(map.values());

      // Attach normalized date
      all.forEach((r) => {
        r._dt = apptDate(r);
      });

      // Default filter: show all with valid date
      const withDates = all.filter((r) => r._dt instanceof Date && !Number.isNaN(r._dt.getTime()));
      // Initial sort desc
      withDates.sort((a, b) => (b._dt?.getTime() || 0) - (a._dt?.getTime() || 0));

      setRows(withDates);
      // If from/to empty, filtered mirrors rows (use applyFilters effect)
    } catch (e) {
      console.error(e);
      setError(isArabic ? 'تعذر تحميل السجل' : 'Failed to load history');
      setRows([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, isArabic]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => {
    setSearch('');
    setFromStr('');
    setToStr('');
  };

  return (
    <Protected>
      <AppLayout>
        <Container maxWidth="md" sx={{ py: 2 }} dir={dir}>
          <Stack spacing={2}>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="h5" fontWeight={800}>
                {t('Appointments History', 'سجل المواعيد')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button component={Link} href={backHref} variant="text">
                  {t('Today', 'مواعيد اليوم')}
                </Button>
                <IconButton onClick={fetchData} title={t('Refresh', 'تحديث')}>
                  <RefreshIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Filters */}
            <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
              <Grid container spacing={1.25} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    label={t('Search (name or phone)', 'بحث (الاسم أو الهاتف)')}
                    InputProps={{
                      startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, opacity: .6 }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label={t('From', 'من')}
                    value={fromStr}
                    onChange={(e) => setFromStr(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label={t('To', 'إلى')}
                    value={toStr}
                    onChange={(e) => setToStr(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: isArabic ? 'flex-start' : 'flex-end' }}>
                    <Button variant="text" onClick={clearFilters}>
                      {t('Clear filters', 'مسح المرشحات')}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Results */}
            {loading ? (
              <Grid container spacing={1.25}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <Grid key={i} item xs={12}>
                    <Skeleton variant="rounded" height={78} />
                  </Grid>
                ))}
              </Grid>
            ) : filtered.length === 0 ? (
              <Paper sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {t('No appointments found for the selected filters.', 'لا توجد مواعيد حسب المرشحات المحددة.')}
                </Typography>
              </Paper>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t('Total', 'المجموع')}: <strong>{filtered.length}</strong>
                </Typography>
                <Stack spacing={1.25}>
                  {filtered.map((row) => (
                    <RowCard key={row.id} appt={row} isArabic={isArabic} locale={locale} />
                  ))}
                </Stack>
              </>
            )}
          </Stack>

          <Snackbar
            open={Boolean(error)}
            autoHideDuration={3500}
            onClose={() => setError('')}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          </Snackbar>
        </Container>
      </AppLayout>
    </Protected>
  );
}
