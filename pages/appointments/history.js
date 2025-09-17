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
import PlaceIcon from '@mui/icons-material/Place';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

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

const sanitizeClinics = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter(Boolean)
    .map((c) => ({
      id: c.id || c._id || `c_${Math.random().toString(36).slice(2, 8)}`,
      name_en: String(c.name_en || c.name || '').trim(),
      name_ar: String(c.name_ar || c.name || '').trim(),
      active: c.active !== false,
    }));

/* ---------------- row card ---------------- */

function RowCard({ appt, isArabic, locale, clinicLabel }) {
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

      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
        <EventIcon color="action" />
        <Typography variant="body2" color="text.secondary" noWrap title={fmtDateTime(d, locale)}>
          {fmtDateTime(d, locale)}
        </Typography>
        {clinicLabel ? (
          <Chip
            size="small"
            icon={<PlaceIcon />}
            label={clinicLabel}
            variant="outlined"
            sx={{ borderRadius: 2, ml: 0.5, maxWidth: '60%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
          />
        ) : null}
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

  // clinics for filter
  const [clinics, setClinics] = React.useState([]);
  const [selectedClinicId, setSelectedClinicId] = React.useState('all');
  const [baseCount, setBaseCount] = React.useState(0);
  const [countsByClinic, setCountsByClinic] = React.useState({}); // { clinicId: n }

  const backHref = `/appointments${isArabic ? '?lang=ar' : ''}`;

  // map clinic id -> display name
  const clinicNameById = React.useMemo(() => {
    const map = new Map();
    clinics.forEach((c) => {
      const label = isArabic ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar);
      map.set(c.id, label || (isArabic ? 'عيادة' : 'Clinic'));
    });
    return map;
  }, [clinics, isArabic]);

  const applyFilters = React.useCallback(() => {
    const from = fromStr ? new Date(fromStr + 'T00:00:00') : null;
    const to = toStr ? new Date(toStr + 'T23:59:59') : null;

    // 1) Apply search + date to create base
    const base = rows
      .filter((r) => {
        if (!matchesSearch(r, search)) return false;
        const d = r._dt;
        if (!(d instanceof Date)) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
      });

    // 2) Build counts per clinic based on base
    const cnt = {};
    base.forEach((r) => {
      const cid = r.clinicId || r.clinicID || '';
      cnt[cid] = (cnt[cid] || 0) + 1;
    });
    setCountsByClinic(cnt);
    setBaseCount(base.length);

    // 3) Apply clinic filter
    const byClinic = selectedClinicId === 'all'
      ? base
      : base.filter((r) => (r.clinicId || r.clinicID || '') === selectedClinicId);

    // 4) Sort desc by time
    byClinic.sort((a, b) => (b._dt?.getTime() || 0) - (a._dt?.getTime() || 0));

    setFiltered(byClinic);
  }, [rows, search, fromStr, toStr, selectedClinicId]);

  React.useEffect(() => { applyFilters(); }, [applyFilters]);

  const fetchData = React.useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    try {
      // Load clinics for this doctor (to render chips)
      try {
        const docSnap = await getDoc(doc(db, 'doctors', user.uid));
        if (docSnap.exists()) {
          setClinics(sanitizeClinics(docSnap.data()?.clinics));
        } else {
          setClinics([]);
        }
      } catch {
        setClinics([]);
      }

      // Load all appointments for this doctor (both shapes)
      const col = collection(db, 'appointments');
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

      // Keep items that have a valid datetime
      const withDates = all.filter((r) => r._dt instanceof Date && !Number.isNaN(r._dt.getTime()));

      // Initial sort (desc); clinic chips are based on filtered base, not here
      withDates.sort((a, b) => (b._dt?.getTime() || 0) - (a._dt?.getTime() || 0));

      setRows(withDates);
    } catch (e) {
      console.error(e);
      setError(isArabic ? 'تعذر تحميل السجل' : 'Failed to load history');
      setRows([]);
      setFiltered([]);
      setBaseCount(0);
      setCountsByClinic({});
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

  const allLabel = React.useMemo(() => {
    return (isArabic ? 'الكل' : 'All') + ` (${baseCount})`;
  }, [baseCount, isArabic]);

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
                <Button component={Link} href={`/appointments${isArabic ? '?lang=ar' : ''}`} variant="text">
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

            {/* Clinic filter (toggle chips) */}
            {clinics.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.75,
                  overflowX: 'auto',
                  pb: 0.5,
                  px: 0.5,
                  '&::-webkit-scrollbar': { height: 6 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
                }}
              >
                <Chip
                  clickable
                  onClick={() => setSelectedClinicId('all')}
                  color={selectedClinicId === 'all' ? 'primary' : 'default'}
                  variant={selectedClinicId === 'all' ? 'filled' : 'outlined'}
                  label={allLabel}
                  sx={{ borderRadius: 2, fontWeight: 700, flexShrink: 0 }}
                />
                {clinics.map((c) => {
                  const baseName = isArabic ? (c.name_ar || c.name_en || 'عيادة') : (c.name_en || c.name_ar || 'Clinic');
                  const n = countsByClinic[c.id] || 0;
                  return (
                    <Chip
                      key={c.id}
                      clickable
                      onClick={() => setSelectedClinicId(c.id)}
                      color={selectedClinicId === c.id ? 'primary' : 'default'}
                      variant={selectedClinicId === c.id ? 'filled' : 'outlined'}
                      label={`${baseName} (${n})`}
                      sx={{ borderRadius: 2, fontWeight: 700, flexShrink: 0, maxWidth: '100%' }}
                    />
                  );
                })}
              </Box>
            )}

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
                  {filtered.map((row) => {
                    const cid = row.clinicId || row.clinicID || '';
                    const clinicLabel = cid ? clinicNameById.get(cid) : '';
                    return (
                      <RowCard
                        key={row.id}
                        appt={row}
                        isArabic={isArabic}
                        locale={locale}
                        clinicLabel={clinicLabel}
                      />
                    );
                  })}
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
