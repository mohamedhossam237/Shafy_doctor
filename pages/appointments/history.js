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
import HistoryIcon from '@mui/icons-material/History';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
  const status = String(appt?.status || 'pending').toLowerCase();
  const completed = status === 'completed';
  const confirmed = status === 'confirmed';
  const cancelled = status === 'cancelled';

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 2.5,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: '1.5px solid',
        borderColor: 'rgba(255,255,255,0.8)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '5px',
          height: '100%',
          background: completed
            ? 'linear-gradient(180deg, #4caf50 0%, #66bb6a 50%, #81c784 100%)'
            : confirmed
            ? 'linear-gradient(180deg, #2196f3 0%, #42a5f5 50%, #64b5f6 100%)'
            : cancelled
            ? 'linear-gradient(180deg, #9e9e9e 0%, #bdbdbd 50%, #e0e0e0 100%)'
            : 'linear-gradient(180deg, #ff9800 0%, #ffb74d 50%, #ffcc80 100%)',
          transition: 'all 0.4s ease',
          boxShadow: completed
            ? '0 0 20px rgba(76, 175, 80, 0.3)'
            : confirmed
            ? '0 0 20px rgba(33, 150, 243, 0.3)'
            : cancelled
            ? '0 0 20px rgba(158, 158, 158, 0.2)'
            : '0 0 20px rgba(255, 152, 0, 0.3)',
        },
        '&:hover': {
          transform: 'translateY(-4px) scale(1.01)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.08)',
          borderColor: completed
            ? 'rgba(76, 175, 80, 0.3)'
            : confirmed
            ? 'rgba(33, 150, 243, 0.3)'
            : cancelled
            ? 'rgba(158, 158, 158, 0.3)'
            : 'rgba(255, 152, 0, 0.3)',
          '&::before': {
            width: '8px',
            boxShadow: completed
              ? '0 0 30px rgba(76, 175, 80, 0.5)'
              : confirmed
              ? '0 0 30px rgba(33, 150, 243, 0.5)'
              : cancelled
              ? '0 0 30px rgba(158, 158, 158, 0.3)'
              : '0 0 30px rgba(255, 152, 0, 0.5)',
          },
        },
      }}
    >
      {/* Patient Info */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 3,
            background: completed
              ? 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)'
              : confirmed
              ? 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)'
              : cancelled
              ? 'linear-gradient(135deg, #9e9e9e 0%, #bdbdbd 100%)'
              : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            flexShrink: 0,
          }}
        >
          <PersonIcon sx={{ fontSize: 28, color: 'white' }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }} useFlexGap>
            <Typography
              variant="h6"
              fontWeight={700}
              noWrap
              title={appt?.patientName || ''}
              sx={{
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {appt?.patientName || (isArabic ? 'بدون اسم' : 'Unnamed')}
            </Typography>
            {/* Appointment Type Badge */}
            {appt?.appointmentType === 'followup' ? (
              <Chip
                size="small"
                label={isArabic ? 'إعادة كشف' : 'Re-examination'}
                sx={{
                  borderRadius: 2.5,
                  height: 28,
                  bgcolor: 'rgba(156, 39, 176, 0.15)',
                  color: 'secondary.main',
                  fontWeight: 800,
                  border: '2px solid',
                  borderColor: 'secondary.main',
                  fontSize: '0.75rem',
                  boxShadow: '0 2px 8px rgba(156, 39, 176, 0.2)',
                }}
              />
            ) : (
              <Chip
                size="small"
                label={isArabic ? 'كشف' : 'Checkup'}
                sx={{
                  borderRadius: 2.5,
                  height: 28,
                  bgcolor: 'rgba(25, 118, 210, 0.15)',
                  color: 'primary.main',
                  fontWeight: 800,
                  border: '2px solid',
                  borderColor: 'primary.main',
                  fontSize: '0.75rem',
                  boxShadow: '0 2px 8px rgba(25, 118, 210, 0.2)',
                }}
              />
            )}
            {/* Source Badge */}
            {(() => {
              const source = String(appt?.source || '').trim();
              const isDoctorApp = source === 'Doctor_app' || appt?.fromDoctorApp === true;
              const isPatientApp = source === 'patient_app' || appt?.fromPatientApp === true;
              
              // Fallback for old data
              const status = String(appt?.status || '').toLowerCase();
              const isOldDataWithoutSource = !source && !appt?.fromDoctorApp && !appt?.fromPatientApp;
              const isLikelyDoctorApp = isOldDataWithoutSource && status === 'confirmed';
              
              if (isDoctorApp || isLikelyDoctorApp) {
                return (
                  <Chip
                    size="small"
                    icon={<TagIcon sx={{ fontSize: 14 }} />}
                    label={isArabic ? 'تطبيق الطبيب' : 'Doctor App'}
                    sx={{
                      borderRadius: 2.5,
                      height: 28,
                      bgcolor: 'rgba(93, 64, 66, 0.15)',
                      color: '#5D4042',
                      fontWeight: 800,
                      border: '2px solid',
                      borderColor: '#5D4042',
                      fontSize: '0.75rem',
                      boxShadow: '0 2px 8px rgba(93, 64, 66, 0.2)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(93, 64, 66, 0.2)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(93, 64, 66, 0.25)',
                      },
                    }}
                  />
                );
              }
              
              if (isPatientApp) {
                return (
                  <Chip
                    size="small"
                    icon={<TagIcon sx={{ fontSize: 14 }} />}
                    label={isArabic ? 'تطبيق المريض' : 'Patient App'}
                    sx={{
                      borderRadius: 2.5,
                      height: 28,
                      bgcolor: 'rgba(30, 78, 140, 0.15)',
                      color: '#1E4E8C',
                      fontWeight: 800,
                      border: '2px solid',
                      borderColor: '#1E4E8C',
                      fontSize: '0.75rem',
                      boxShadow: '0 2px 8px rgba(30, 78, 140, 0.2)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(30, 78, 140, 0.2)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(30, 78, 140, 0.25)',
                      },
                    }}
                  />
                );
              }
              
              return null;
            })()}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
            <LocalPhoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary" fontWeight={500}>
              {appt?.patientPhone || '—'}
            </Typography>
          </Stack>
        </Box>
      </Stack>

      {/* Date & Clinic */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1 }}>
          <ScheduleIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={500} noWrap title={fmtDateTime(d, locale)}>
              {fmtDateTime(d, locale)}
            </Typography>
          </Box>
        </Stack>
        {clinicLabel ? (
          <Chip
            size="small"
            icon={<LocationOnIcon sx={{ fontSize: 16 }} />}
            label={clinicLabel}
            sx={{
              borderRadius: 2.5,
              height: 28,
              bgcolor: 'rgba(25, 118, 210, 0.08)',
              color: 'primary.main',
              fontWeight: 700,
              border: '1.5px solid',
              borderColor: 'rgba(25, 118, 210, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              maxWidth: '60%',
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
        ) : null}
      </Stack>

      {/* Status & Action */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexShrink: 0 }}>
        <Chip
          icon={<TagIcon sx={{ fontSize: 16 }} />}
          label={
            isArabic
              ? completed
                ? 'منجز'
                : confirmed
                ? 'مؤكد'
                : cancelled
                ? 'ملغي'
                : 'قيد الانتظار'
              : (appt.status || 'pending').toString()
          }
          color={statusColor(appt.status)}
          sx={{
            fontWeight: 800,
            fontSize: '0.75rem',
            height: 32,
            px: 1.5,
            boxShadow: completed
              ? '0 4px 12px rgba(76, 175, 80, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
              : confirmed
              ? '0 4px 12px rgba(33, 150, 243, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
              : cancelled
              ? '0 4px 12px rgba(158, 158, 158, 0.2), inset 0 1px 2px rgba(255,255,255,0.3)'
              : '0 4px 12px rgba(255, 152, 0, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)',
            background: completed
              ? 'linear-gradient(135deg, #4caf50 0%, #66bb6a 50%, #81c784 100%)'
              : confirmed
              ? 'linear-gradient(135deg, #2196f3 0%, #42a5f5 50%, #64b5f6 100%)'
              : cancelled
              ? 'linear-gradient(135deg, #9e9e9e 0%, #bdbdbd 50%, #e0e0e0 100%)'
              : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 50%, #ffcc80 100%)',
            color: 'white',
            border: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        />
        <Button
          component={Link}
          href={href}
          endIcon={<ArrowForwardIosIcon sx={{ fontSize: 16 }} />}
          variant="outlined"
          sx={{
            borderRadius: 2.5,
            textTransform: 'none',
            fontWeight: 800,
            px: 2.5,
            py: 1,
            borderWidth: 2,
            borderColor: 'primary.main',
            color: 'primary.main',
            bgcolor: 'rgba(25, 118, 210, 0.04)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap',
            '&:hover': {
              borderWidth: 2.5,
              borderColor: 'primary.dark',
              bgcolor: 'rgba(25, 118, 210, 0.08)',
              transform: 'translateY(-2px) scale(1.02)',
              boxShadow: '0 6px 20px rgba(25, 118, 210, 0.2)',
            },
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {isArabic ? 'فتح' : 'Open'}
        </Button>
      </Stack>
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
  const rowsRef = React.useRef([]);

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

      // Auto-complete confirmed appointments that have passed their time
      const now = new Date();
      const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
      const toUpdate = withDates.filter((r) => {
        const status = String(r?.status || 'pending').toLowerCase();
        if (status !== 'confirmed') return false;
        const dt = r._dt;
        if (!dt || !(dt instanceof Date)) return false;
        // Check if appointment time has passed (with 5 minutes buffer)
        return dt.getTime() + buffer < now.getTime();
      });

      // Update appointments in Firestore
      if (toUpdate.length > 0) {
        const updatePromises = toUpdate.map((r) =>
          updateDoc(doc(db, 'appointments', r.id), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          }).catch((err) => {
            console.error(`Failed to auto-complete appointment ${r.id}:`, err);
            return null;
          })
        );
        await Promise.all(updatePromises);
        
        // Update local state
        withDates.forEach((r) => {
          if (toUpdate.some((u) => u.id === r.id)) {
            r.status = 'completed';
          }
        });
      }

      setRows(withDates);
      rowsRef.current = withDates;
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

  // Keep ref in sync with state
  React.useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // Auto-check and update confirmed appointments that passed their time (every minute)
  React.useEffect(() => {
    if (!user) return;

    const checkAndUpdate = async () => {
      const currentRows = rowsRef.current;
      if (currentRows.length === 0) return;

      const now = new Date();
      const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds

      const toUpdate = currentRows.filter((r) => {
        const status = String(r?.status || 'pending').toLowerCase();
        if (status !== 'confirmed') return false;
        const dt = r._dt;
        if (!dt || !(dt instanceof Date)) return false;
        return dt.getTime() + buffer < now.getTime();
      });

      // Update in Firestore
      if (toUpdate.length > 0) {
        const updatePromises = toUpdate.map((r) =>
          updateDoc(doc(db, 'appointments', r.id), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          }).catch((err) => {
            console.error(`Failed to auto-complete appointment ${r.id}:`, err);
            return null;
          })
        );
        await Promise.all(updatePromises);

        // Update local state
        setRows((prev) =>
          prev.map((r) => {
            if (toUpdate.some((u) => u.id === r.id)) {
              return { ...r, status: 'completed' };
            }
            return r;
          })
        );
      }
    };

    // Check immediately
    checkAndUpdate();

    // Then check every minute
    const interval = setInterval(checkAndUpdate, 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const clearFilters = () => {
    setSearch('');
    setFromStr('');
    setToStr('');
  };

  const allLabel = React.useMemo(() => {
    return (isArabic ? 'الكل' : 'All') + ` (${baseCount})`;
  }, [baseCount, isArabic]);

  // Statistics
  const stats = React.useMemo(() => {
    const pending = filtered.filter((r) => String(r?.status || 'pending').toLowerCase() === 'pending').length;
    const confirmed = filtered.filter((r) => String(r?.status || 'pending').toLowerCase() === 'confirmed').length;
    const completed = filtered.filter((r) => String(r?.status || 'pending').toLowerCase() === 'completed').length;
    const cancelled = filtered.filter((r) => String(r?.status || 'pending').toLowerCase() === 'cancelled').length;
    return { pending, confirmed, completed, cancelled, total: filtered.length };
  }, [filtered]);

  return (
    <Protected>
      <AppLayout>
        <Box
          sx={{
            position: 'relative',
            minHeight: '100vh',
            pb: 4,
            background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.03) 0%, rgba(66, 165, 245, 0.01) 50%, rgba(255, 152, 0, 0.02) 100%)',
            '&::before': {
              content: '""',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 20% 50%, rgba(25, 118, 210, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(66, 165, 245, 0.06) 0%, transparent 50%), radial-gradient(circle at 40% 20%, rgba(255, 152, 0, 0.05) 0%, transparent 50%)',
              pointerEvents: 'none',
              zIndex: 0,
            },
            '& > *': {
              position: 'relative',
              zIndex: 1,
            },
          }}
        >
          <Container maxWidth="md" sx={{ py: 2 }} dir={dir}>
            <Stack spacing={3} sx={{ mt: 2 }}>
              {/* Header */}
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  borderRadius: 5,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                  backdropFilter: 'blur(30px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                  border: '1.5px solid',
                  borderColor: 'rgba(255,255,255,0.8)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 3s ease-in-out infinite',
                  },
                  '@keyframes shimmer': {
                    '0%': { backgroundPosition: '200% 0' },
                    '100%': { backgroundPosition: '-200% 0' },
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 16px rgba(25, 118, 210, 0.3)',
                      }}
                    >
                      <HistoryIcon sx={{ fontSize: 28, color: 'white' }} />
                    </Box>
                    <Box>
                      <Typography
                        variant="h4"
                        fontWeight={800}
                        sx={{
                          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          mb: 0.5,
                        }}
                      >
                        {t('Appointments History', 'سجل المواعيد')}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: 16 }} />
                        {filtered.length} {t('appointment', 'موعد')}{filtered.length !== 1 ? (isArabic ? 'ات' : 's') : ''}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button
                      component={Link}
                      href={`/appointments${isArabic ? '?lang=ar' : ''}`}
                      variant="outlined"
                      sx={{
                        borderRadius: 2.5,
                        textTransform: 'none',
                        fontWeight: 700,
                        px: 2.5,
                        borderWidth: 2,
                        '&:hover': {
                          borderWidth: 2,
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {t('Today', 'مواعيد اليوم')}
                    </Button>
                    <IconButton
                      onClick={fetchData}
                      title={t('Refresh', 'تحديث')}
                      sx={{
                        borderRadius: 2.5,
                        bgcolor: 'rgba(25, 118, 210, 0.08)',
                        border: '1.5px solid',
                        borderColor: 'rgba(25, 118, 210, 0.2)',
                        '&:hover': {
                          bgcolor: 'rgba(25, 118, 210, 0.12)',
                          transform: 'rotate(180deg)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <RefreshIcon sx={{ color: 'primary.main' }} />
                    </IconButton>
                  </Box>
                </Box>
              </Paper>

              {/* Statistics Cards */}
              {!loading && filtered.length > 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 4,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1.5px solid',
                        borderColor: 'rgba(255,152,0,0.2)',
                        boxShadow: '0 8px 24px rgba(255,152,0,0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: -50,
                          right: -50,
                          width: 120,
                          height: 120,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(255,152,0,0.1) 0%, transparent 70%)',
                        },
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 32px rgba(255,152,0,0.15)',
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 3,
                            background: 'linear-gradient(135deg, #ff9800 0%, #ffb74d 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(255,152,0,0.3)',
                          }}
                        >
                          <PendingActionsIcon sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h4" fontWeight={800} color="warning.main">
                            {stats.pending}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" fontWeight={600}>
                            {t('Pending', 'قيد الانتظار')}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 4,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1.5px solid',
                        borderColor: 'rgba(33,150,243,0.2)',
                        boxShadow: '0 8px 24px rgba(33,150,243,0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: -50,
                          right: -50,
                          width: 120,
                          height: 120,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(33,150,243,0.1) 0%, transparent 70%)',
                        },
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 32px rgba(33,150,243,0.15)',
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 3,
                            background: 'linear-gradient(135deg, #2196f3 0%, #42a5f5 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(33,150,243,0.3)',
                          }}
                        >
                          <EventAvailableIcon sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h4" fontWeight={800} color="info.main">
                            {stats.confirmed}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" fontWeight={600}>
                            {t('Confirmed', 'مؤكد')}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 4,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1.5px solid',
                        borderColor: 'rgba(76,175,80,0.2)',
                        boxShadow: '0 8px 24px rgba(76,175,80,0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: -50,
                          right: -50,
                          width: 120,
                          height: 120,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(76,175,80,0.1) 0%, transparent 70%)',
                        },
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 32px rgba(76,175,80,0.15)',
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 3,
                            background: 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(76,175,80,0.3)',
                          }}
                        >
                          <DoneAllIcon sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h4" fontWeight={800} color="success.main">
                            {stats.completed}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" fontWeight={600}>
                            {t('Completed', 'منجز')}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 4,
                        background: 'linear-gradient(135deg, rgba(25,118,210,0.1) 0%, rgba(66,165,245,0.05) 100%)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1.5px solid',
                        borderColor: 'rgba(25,118,210,0.3)',
                        boxShadow: '0 8px 24px rgba(25,118,210,0.15)',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: -50,
                          right: -50,
                          width: 120,
                          height: 120,
                          borderRadius: '50%',
                          background: 'radial-gradient(circle, rgba(25,118,210,0.15) 0%, transparent 70%)',
                        },
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 32px rgba(25,118,210,0.2)',
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 3,
                            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(25,118,210,0.4)',
                          }}
                        >
                          <CalendarTodayIcon sx={{ fontSize: 28, color: 'white' }} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h4" fontWeight={800} color="primary.main">
                            {stats.total}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" fontWeight={600}>
                            {t('Total', 'إجمالي')}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  </Grid>
                </Grid>
              )}

              {/* Filters */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 4,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  border: '1.5px solid',
                  borderColor: 'rgba(255,255,255,0.8)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                }}
              >
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="medium"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      label={t('Search (name or phone)', 'بحث (الاسم أو الهاتف)')}
                      InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1.5, color: 'primary.main' }} />,
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2.5,
                          bgcolor: 'rgba(255,255,255,0.8)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.95)',
                          },
                          '&.Mui-focused': {
                            bgcolor: 'rgba(255,255,255,1)',
                            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.15)',
                          },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      size="medium"
                      type="date"
                      label={t('From', 'من')}
                      value={fromStr}
                      onChange={(e) => setFromStr(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2.5,
                          bgcolor: 'rgba(255,255,255,0.8)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.95)',
                          },
                          '&.Mui-focused': {
                            bgcolor: 'rgba(255,255,255,1)',
                            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.15)',
                          },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      size="medium"
                      type="date"
                      label={t('To', 'إلى')}
                      value={toStr}
                      onChange={(e) => setToStr(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2.5,
                          bgcolor: 'rgba(255,255,255,0.8)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.95)',
                          },
                          '&.Mui-focused': {
                            bgcolor: 'rgba(255,255,255,1)',
                            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.15)',
                          },
                        },
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1.5, justifyContent: isArabic ? 'flex-start' : 'flex-end' }}>
                      <Button
                        variant="outlined"
                        onClick={clearFilters}
                        sx={{
                          borderRadius: 2.5,
                          textTransform: 'none',
                          fontWeight: 700,
                          px: 2.5,
                          borderWidth: 2,
                          '&:hover': {
                            borderWidth: 2,
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {t('Clear filters', 'مسح المرشحات')}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>

              {/* Clinic filter (toggle chips) */}
              {clinics.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: '1.5px solid',
                    borderColor: 'rgba(255,255,255,0.8)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      overflowX: 'auto',
                      pb: 0.5,
                      px: 0.5,
                      '&::-webkit-scrollbar': { height: 6 },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'primary.main',
                        borderRadius: 3,
                        opacity: 0.3,
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        opacity: 0.5,
                      },
                    }}
                  >
                    <Chip
                      clickable
                      onClick={() => setSelectedClinicId('all')}
                      color={selectedClinicId === 'all' ? 'primary' : 'default'}
                      variant={selectedClinicId === 'all' ? 'filled' : 'outlined'}
                      label={allLabel}
                      sx={{
                        borderRadius: 2.5,
                        fontWeight: 700,
                        flexShrink: 0,
                        height: 36,
                        transition: 'all 0.2s ease',
                        ...(selectedClinicId === 'all' && {
                          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                          color: 'white',
                          boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                          '&:hover': {
                            boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
                            transform: 'translateY(-2px)',
                          },
                        }),
                        ...(selectedClinicId !== 'all' && {
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'primary.50',
                            transform: 'translateY(-2px)',
                          },
                        }),
                      }}
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
                          sx={{
                            borderRadius: 2.5,
                            fontWeight: 700,
                            flexShrink: 0,
                            height: 36,
                            maxWidth: '100%',
                            transition: 'all 0.2s ease',
                            ...(selectedClinicId === c.id && {
                              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                              color: 'white',
                              boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                              '&:hover': {
                                boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
                                transform: 'translateY(-2px)',
                              },
                            }),
                            ...(selectedClinicId !== c.id && {
                              '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: 'primary.50',
                                transform: 'translateY(-2px)',
                              },
                            }),
                          }}
                        />
                      );
                    })}
                  </Box>
                </Paper>
              )}

              {/* Results */}
              {loading ? (
                <Grid container spacing={2}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Grid key={i} item xs={12}>
                      <Skeleton
                        variant="rounded"
                        height={140}
                        sx={{
                          borderRadius: 5,
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1.5px solid',
                          borderColor: 'rgba(255,255,255,0.8)',
                          position: 'relative',
                          overflow: 'hidden',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                            animation: 'shimmer 1.5s infinite',
                          },
                          '@keyframes shimmer': {
                            '0%': { left: '-100%' },
                            '100%': { left: '100%' },
                          },
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              ) : filtered.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 8,
                    textAlign: 'center',
                    borderRadius: 5,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    border: '2px dashed',
                    borderColor: 'rgba(25, 118, 210, 0.2)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: -100,
                      right: -100,
                      width: 300,
                      height: 300,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(25, 118, 210, 0.08) 0%, transparent 70%)',
                      animation: 'pulse 4s ease-in-out infinite',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: -80,
                      left: -80,
                      width: 250,
                      height: 250,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(66, 165, 245, 0.06) 0%, transparent 70%)',
                      animation: 'pulse 4s ease-in-out infinite 2s',
                    },
                    '@keyframes pulse': {
                      '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                      '50%': { transform: 'scale(1.1)', opacity: 0.8 },
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(66, 165, 245, 0.1) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 4,
                      position: 'relative',
                      zIndex: 1,
                      boxShadow: '0 8px 32px rgba(25, 118, 210, 0.2)',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: -4,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
                        opacity: 0.2,
                        filter: 'blur(12px)',
                        zIndex: -1,
                      },
                    }}
                  >
                    <HistoryIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.8 }} />
                  </Box>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    sx={{
                      mb: 1.5,
                      background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {t('No appointments found', 'لا توجد مواعيد')}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mb: 4, maxWidth: 450, mx: 'auto', position: 'relative', zIndex: 1, lineHeight: 1.7 }}
                  >
                    {t('No appointments found for the selected filters.', 'لا توجد مواعيد حسب المرشحات المحددة.')}
                  </Typography>
                </Paper>
              ) : (
                <>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1.5px solid',
                      borderColor: 'rgba(255,255,255,0.8)',
                    }}
                  >
                    <Typography variant="body1" color="text.secondary" fontWeight={600}>
                      {t('Total', 'المجموع')}: <strong style={{ color: 'primary.main' }}>{filtered.length}</strong>
                    </Typography>
                  </Paper>
                  <Stack spacing={2.5}>
                    {filtered.map((row, index) => {
                      const cid = row.clinicId || row.clinicID || '';
                      const clinicLabel = cid ? clinicNameById.get(cid) : '';
                      return (
                        <Box
                          key={row.id}
                          sx={{
                            animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
                            '@keyframes fadeInUp': {
                              '0%': {
                                opacity: 0,
                                transform: 'translateY(20px)',
                              },
                              '100%': {
                                opacity: 1,
                                transform: 'translateY(0)',
                              },
                            },
                          }}
                        >
                          <RowCard
                            appt={row}
                            isArabic={isArabic}
                            locale={locale}
                            clinicLabel={clinicLabel}
                          />
                        </Box>
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
        </Box>
      </AppLayout>
    </Protected>
  );
}
