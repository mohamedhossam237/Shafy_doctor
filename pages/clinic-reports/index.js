// /pages/clinic-reports/index.js
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
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  Chip,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import { motion } from 'framer-motion';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PeopleIcon from '@mui/icons-material/People';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, where, doc, getDoc, updateDoc,
} from 'firebase/firestore';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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

// Build Date from:
//  - appointmentDate: Timestamp/ISO
//  - date: 'YYYY-MM-DD' (+ optional time: 'HH:MM')
function apptDate(a) {
  if (a?.appointmentDate) return toDate(a.appointmentDate);
  if (a?.date) {
    const [y, m, d] = String(a.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(a.time || '00:00').split(':').map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
    }
  }
  if (a?.createdAt) return toDate(a.createdAt);
  return null;
}

function normStatus(x) {
  const s = String(x || '').toLowerCase().trim();
  if (['complete', 'completed', 'done', 'finished'].includes(s)) return 'completed';
  if (['confirm', 'confirmed'].includes(s)) return 'confirmed';
  if (['cancel', 'cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['no_show', 'noshow', 'missed', 'absent'].includes(s)) return 'no_show';
  if (['pending', 'scheduled', 'new'].includes(s)) return 'pending';
  return s || 'pending';
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}
function endOfWeek(d) {
  const s = startOfWeek(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6, 23, 59, 59, 999);
}
function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
function endOfYear(d) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}
function getRangeBounds(range) {
  const now = new Date();
  if (range === 'week') return { start: startOfWeek(now), end: endOfWeek(now) };
  if (range === 'year') return { start: startOfYear(now), end: endOfYear(now) };
  // default month
  return { start: startOfMonth(now), end: endOfMonth(now) };
}
function inRange(d, start, end) {
  if (!d) return false;
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

const MotionPaper = motion(Paper);

function StatTile({ icon, title, value, isArabic, color = 'primary', delay = 0, trend, trendDir = 'up' }) {
  const theme = useTheme();
  return (
    <MotionPaper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)',
          borderColor: `${color}.main`,
        }
      }}
    >
      <Stack direction={isArabic ? 'row-reverse' : 'row'} justifyContent="space-between" alignItems="flex-start">
        <Avatar
          variant="rounded"
          sx={{
            bgcolor: alpha(theme.palette[color].main, 0.1),
            color: `${color}.main`,
            width: 56,
            height: 56,
            borderRadius: 3
          }}
        >
          {icon}
        </Avatar>
        {trend !== undefined && (
          <Chip
            size="small"
            label={`${trend > 0 ? '+' : ''}${trend}%`}
            color={trendDir === 'up' ? 'success' : 'error'}
            variant="soft"
            sx={{
              bgcolor: alpha(theme.palette[trendDir === 'up' ? 'success' : 'error'].main, 0.1),
              color: `${trendDir === 'up' ? 'success' : 'error'}.main`,
              fontWeight: 700,
              borderRadius: 2
            }}
            icon={trendDir === 'up' ? <TrendingUpIcon fontSize="small" /> : <TrendingUpIcon sx={{ transform: 'rotate(180deg)' }} fontSize="small" />}
          />
        )}
      </Stack>

      <Box sx={{ mt: 3, textAlign: isArabic ? 'right' : 'left' }}>
        <Typography variant="h3" fontWeight={800} sx={{ color: 'text.primary', mb: 0.5 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {title}
        </Typography>
      </Box>
    </MotionPaper>
  );
}

/* ---------------- page ---------------- */

export default function ClinicReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();

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

  const [loading, setLoading] = React.useState(true);
  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });

  // summary (current month)
  const [totalAppointments, setTotalAppointments] = React.useState(0);
  const [completedSessions, setCompletedSessions] = React.useState(0);
  const [patientsSeen, setPatientsSeen] = React.useState(0);
  const [missedAppointments, setMissedAppointments] = React.useState(0);

  // trends
  const [growthStats, setGrowthStats] = React.useState({});
  const [activityData, setActivityData] = React.useState([]);
  const [statusData, setStatusData] = React.useState([]);
  const [topPatients, setTopPatients] = React.useState([]);

  // pricing & appointments
  const [checkupPrice, setCheckupPrice] = React.useState(0);
  const [followUpPrice, setFollowUpPrice] = React.useState(0);
  const [checkupPriceInput, setCheckupPriceInput] = React.useState('');
  const [followUpPriceInput, setFollowUpPriceInput] = React.useState('');
  const [allAppts, setAllAppts] = React.useState([]); // normalized: {_dt, _status, raw...}

  // Financial (appointments-only) with period filter
  const [finRange, setFinRange] = React.useState('week'); // 'week' | 'month' | 'year' - default to week


  // ---------- NEW: Extra Services (doctor-configurable) ----------
  // Will be saved under doctors/{uid}.extraServices : [{id,name_ar,name_en,price,active}]
  const [extras, setExtras] = React.useState([]);
  const [newExtraNameAr, setNewExtraNameAr] = React.useState('');
  const [newExtraNameEn, setNewExtraNameEn] = React.useState('');
  const [newExtraPrice, setNewExtraPrice] = React.useState('');

  const addExtra = () => {
    const name_ar = String(newExtraNameAr || '').trim();
    const name_en = String(newExtraNameEn || '').trim() || name_ar;
    const priceNum = Number(newExtraPrice);
    if (!name_ar || !Number.isFinite(priceNum) || priceNum <= 0) {
      setSnack({
        open: true,
        severity: 'warning',
        message: isArabic ? 'أدخل اسم الخدمة باللغة العربية وسعرًا صحيحًا.' : 'Enter Arabic name and a valid price.',
      });
      return;
    }
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setExtras((prev) => [...prev, { id, name_ar, name_en, price: priceNum, active: true }]);
    setNewExtraNameAr('');
    setNewExtraNameEn('');
    setNewExtraPrice('');
  };

  const updateExtra = (id, patch) => {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const deleteExtra = (id) => {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  };

  const saveExtras = async () => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, 'doctors', user.uid), {
        extraServices: extras,
        updatedAt: new Date().toISOString(),
      });
      setSnack({
        open: true,
        severity: 'success',
        message: isArabic ? 'تم حفظ الخدمات الإضافية' : 'Extra services saved',
      });
    } catch (e) {
      setSnack({
        open: true,
        severity: 'error',
        message: e?.message || (isArabic ? 'تعذر حفظ الخدمات الإضافية' : 'Failed to save extra services'),
      });
    }
  };
  // ---------------------------------------------------------------

  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      setLoading(true);
      try {
        // 1) load doctor price + extra services
        try {
          const dref = doc(db, 'doctors', user.uid);
          const dsnap = await getDoc(dref);
          if (dsnap.exists()) {
            const d = dsnap.data() || {};
            const docCheck = Number(d.checkupPrice ?? 0);
            const docFollow = Number(d.followUpPrice ?? 0);
            setCheckupPrice(docCheck);
            setFollowUpPrice(docFollow);
            // keep inputs prefilled so the doctor sees current prices and can update
            setCheckupPriceInput(String(Number.isFinite(docCheck) ? docCheck : 0));
            setFollowUpPriceInput(String(Number.isFinite(docFollow) ? docFollow : 0));
            // Load extras (if any)
            const ex = Array.isArray(d.extraServices) ? d.extraServices : [];
            // Backward compatibility: if you previously had plain "services" strings,
            // we won't auto-convert them to priced extras here.
            setExtras(
              ex
                .filter(Boolean)
                .map((e) => ({
                  id: e.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  name_ar: e.name_ar || e.name || '',
                  name_en: e.name_en || e.name || e.name_ar || '',
                  price: Number(e.price || 0),
                  active: e.active !== false,
                }))
            );
          }
        } catch { }

        // 2) load all appointments (no orderBy -> no index needed)
        const col = collection(db, 'appointments');
        const [snapA, snapB] = await Promise.all([
          getDocs(query(col, where('doctorUID', '==', user.uid))),
          getDocs(query(col, where('doctorId', '==', user.uid))),
        ]);
        const map = new Map();
        [...snapA.docs, ...snapB.docs].forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));

        const rows = Array.from(map.values()).map((r) => ({
          ...r,
          _dt: apptDate(r),
          _status: normStatus(r?.status),
        }));
        setAllAppts(rows);

        // 3) compute monthly summary tiles (current calendar month)
        const { start, end } = getRangeBounds('month');
        const monthRows = rows.filter((r) => inRange(r._dt, start, end));

        // Previous month for trends
        const prevStart = new Date(start);
        prevStart.setMonth(prevStart.getMonth() - 1);
        const prevEnd = new Date(end);
        prevEnd.setMonth(prevEnd.getMonth() - 1);
        const prevMonthRows = rows.filter((r) => inRange(r._dt, prevStart, prevEnd));

        const now = new Date();
        const calcStats = (rs) => {
          const tot = rs.length;
          // Helper: check if appointment is effectively completed (either explicitly completed, or confirmed and time passed)
          const isEffectivelyCompleted = (r) => {
            if (r._status === 'completed') return true;
            if (r._status === 'confirmed' && r._dt && r._dt < now) return true;
            return false;
          };

          const comp = rs.filter(isEffectivelyCompleted).length;
          const seen = new Set(
            rs.filter(isEffectivelyCompleted)
              .map((r) => r.patientUID || r.patientId || r.patientID || r.patientName || `anon-${r.id}`)
          ).size;
          const miss = rs.filter((r) => {
            if (r._status === 'cancelled' || r._status === 'no_show') return true;
            // Don't count confirmed appointments as missed even if time passed - they're completed!
            if (r._dt && r._dt < now && r._status !== 'completed' && r._status !== 'confirmed') return true;
            return false;
          }).length;
          return { tot, comp, seen, miss };
        };

        const currStats = calcStats(monthRows);
        const prevStats = calcStats(prevMonthRows);

        const getGrowth = (curr, prev) => {
          if (prev === 0) return curr > 0 ? 100 : 0;
          return Math.round(((curr - prev) / prev) * 100);
        };

        setGrowthStats({
          total: getGrowth(currStats.tot, prevStats.tot),
          completed: getGrowth(currStats.comp, prevStats.comp),
          seen: getGrowth(currStats.seen, prevStats.seen),
          missed: getGrowth(currStats.miss, prevStats.miss),
        });

        setTotalAppointments(currStats.tot);
        setCompletedSessions(currStats.comp);
        setPatientsSeen(currStats.seen);
        setMissedAppointments(currStats.miss);

        // 4) Activity Trend (Last 30 days)
        const activityMap = new Map();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Initialize last 30 days with 0
        for (let i = 0; i <= 30; i++) {
          const d = new Date(thirtyDaysAgo);
          d.setDate(d.getDate() + i);
          const key = d.toISOString().split('T')[0];
          activityMap.set(key, 0);
        }

        rows.forEach(r => {
          if (r._dt && r._dt >= thirtyDaysAgo) {
            const key = r._dt.toISOString().split('T')[0];
            if (activityMap.has(key)) {
              activityMap.set(key, activityMap.get(key) + 1);
            }
          }
        });

        setActivityData(Array.from(activityMap.entries()).map(([date, count]) => ({
          date: isArabic ? new Date(date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }) : new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
          count
        })));

        // 5) Status Distribution (All time or filtered)
        const statusCounts = rows.reduce((acc, r) => {
          const s = r._status === 'completed' ? (isArabic ? 'مكتمل' : 'Completed') :
            r._status === 'cancelled' ? (isArabic ? 'ملغي' : 'Cancelled') :
              r._status === 'no_show' ? (isArabic ? 'لم يحضر' : 'No Show') :
                (isArabic ? 'قادم' : 'Upcoming');
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});

        setStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

        // 6) Top Patients
        const patientCounts = rows
          .filter(r => r._status === 'completed')
          .reduce((acc, r) => {
            const name = r.patientName || (isArabic ? 'مريض مجهول' : 'Unknown Patient');
            acc[name] = (acc[name] || 0) + 1;
            return acc;
          }, {});

        setTopPatients(
          Object.entries(patientCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }))
        );

      } catch (e) {
        console.error(e);
        setSnack({
          open: true,
          message: e?.message || (isArabic ? 'تعذر تحميل التقارير' : 'Failed to load reports'),
          severity: 'error',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid, isArabic]);

  // Helpers for revenue calculation
  const tryNum = React.useCallback((...vals) => {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
  }, []);

  const feeOf = React.useCallback((a) => {
    const b = a.billing || a.bill || {};
    const n = tryNum(
      a.fee, a.price, a.amount, a.visitFee, a.checkupFee,
      b.total, b.appointment, b.appointmentFee, b.consult, b.consultation,
      a.payment?.amount
    );
    if (n > 0) return n;
    const isFollowUp = a.appointmentType === 'followup' || a.appointmentType === 'recheck';
    // Count revenue for both completed and confirmed appointments
    return (a._status === 'completed' || a._status === 'confirmed') ? Number((isFollowUp ? followUpPrice : checkupPrice) || 0) : 0;
  }, [checkupPrice, followUpPrice, tryNum]);

  // Chart Data & Revenue Calculation
  const chartData = React.useMemo(() => {
    const { start, end } = getRangeBounds(finRange);
    const filtered = allAppts.filter((a) => inRange(a._dt, start, end));

    const buckets = [];

    if (finRange === 'week') {
      // 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dayName = d.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { weekday: 'short' });
        buckets.push({ name: dayName, value: 0, _date: d });
      }
      filtered.forEach(a => {
        const dayIdx = Math.floor((a._dt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (buckets[dayIdx]) buckets[dayIdx].value += feeOf(a);
      });
    } else if (finRange === 'month') {
      // Weeks in month
      const numWeeks = 5;
      for (let i = 0; i < numWeeks; i++) {
        buckets.push({ name: isArabic ? `أسبوع ${i + 1}` : `Week ${i + 1}`, value: 0 });
      }
      filtered.forEach(a => {
        const dayOfMonth = a._dt.getDate() - 1;
        const weekIdx = Math.floor(dayOfMonth / 7);
        if (buckets[weekIdx]) buckets[weekIdx].value += feeOf(a);
      });
    } else {
      // Year -> 12 months
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), i, 1);
        const monthName = d.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { month: 'short' });
        buckets.push({ name: monthName, value: 0 });
      }
      filtered.forEach(a => {
        const monthIdx = a._dt.getMonth();
        if (buckets[monthIdx]) buckets[monthIdx].value += feeOf(a);
      });
    }

    return buckets;
  }, [allAppts, finRange, isArabic, feeOf]);

  const apptRevenue = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  const completionRate = React.useMemo(() => {
    if (!totalAppointments) return 0;
    return Math.round((completedSessions / totalAppointments) * 100);
  }, [completedSessions, totalAppointments]);

  const missRate = React.useMemo(() => {
    if (!totalAppointments) return 0;
    return Math.round((missedAppointments / totalAppointments) * 100);
  }, [missedAppointments, totalAppointments]);

  const busiestDay = React.useMemo(() => {
    if (!allAppts.length) return null;
    const dayCounts = Array(7).fill(0);
    allAppts.forEach((a) => {
      if (a?._dt instanceof Date && !Number.isNaN(a._dt.getTime())) {
        dayCounts[a._dt.getDay()] += 1;
      }
    });
    const max = Math.max(...dayCounts);
    if (!max) return null;
    const idx = dayCounts.indexOf(max);
    const dayName = new Intl.DateTimeFormat(isArabic ? 'ar-EG' : 'en-US', { weekday: 'long' })
      .format(new Date(Date.UTC(2024, 0, 7 + idx))); // 7 Jan 2024 is Sunday
    return { label: dayName, count: max };
  }, [allAppts, isArabic]);

  const aiInsights = React.useMemo(() => {
    const lines = [];
    const deltaText = (v) => {
      const n = Math.round(Number(v || 0));
      if (!Number.isFinite(n) || n === 0) return isArabic ? 'مستقر مقارنة بالشهر الماضي' : 'flat vs last month';
      return n > 0
        ? (isArabic ? `+${n}% عن الشهر الماضي` : `+${n}% vs last month`)
        : (isArabic ? `${n}% عن الشهر الماضي` : `${n}% vs last month`);
    };

    if (totalAppointments) {
      lines.push(
        isArabic
          ? `العيادة حجزت ${totalAppointments} زيارة هذا الشهر (${deltaText(growthStats.total)}).`
          : `Clinic booked ${totalAppointments} visits this month (${deltaText(growthStats.total)}).`
      );
    }

    if (completionRate || missRate) {
      lines.push(
        isArabic
          ? `معدل الإتمام ${completionRate}٪، الملغاة/الغياب ${missRate}٪ - عزّز التذكير قبل الموعد بساعتين مع تأكيد عبر الرسائل.`
          : `Completion rate ${completionRate}%, missed ${missRate}% - tighten reminders 2h before visits to lift completions.`
      );
    }

    if (apptRevenue) {
      lines.push(
        isArabic
          ? `إيراد المواعيد التقديري: ${Math.round(apptRevenue).toLocaleString()} جنيه خلال الفترة المختارة.`
          : `Estimated appointment revenue: ${Math.round(apptRevenue).toLocaleString()} EGP in the selected window.`
      );
    }

    if (busiestDay) {
      lines.push(
        isArabic
          ? `${busiestDay.label} هو أكثر يوم ازدحاماً (${busiestDay.count} زيارة) - روّج لزيارات منتصف الأسبوع لتخفيف الضغط.`
          : `${busiestDay.label} is the busiest day (${busiestDay.count} visits) - promote mid-week slots to balance load.`
      );
    }

    if (extras.length) {
      const activeExtras = extras.filter((e) => e.active !== false).length;
      lines.push(
        isArabic
          ? `${activeExtras} خدمات إضافية مفعّلة - أبرزها عند الحجز لزيادة متوسط الفاتورة.`
          : `${activeExtras} add-on services active - spotlight them in booking to raise average ticket.`
      );
    }

    // Extra promotion tip
    lines.push(
      isArabic
        ? 'جرّب عرض تحفيزي: خصم 10٪ لمواعيد منتصف الأسبوع أو حزمة فحص + إعادة كشف بسعر موحّد.'
        : 'Try a promo: 10% off mid-week slots or bundle checkup + follow-up at a single price.'
    );

    if (!totalAppointments) {
      lines.push(isArabic ? 'ابدأ بحجز زيارات أكثر لفتح رؤى أعمق حول أداء العيادة.' : 'Book more visits to unlock deeper insights.');
    }

    return lines;
  }, [apptRevenue, busiestDay, completionRate, extras, growthStats.total, isArabic, missRate, totalAppointments]);

  const savePrices = async () => {
    if (!user) return;
    const cPrice = parseInt(String(checkupPriceInput).trim(), 10);
    const fPrice = parseInt(String(followUpPriceInput).trim(), 10);

    if (Number.isNaN(cPrice) || Number.isNaN(fPrice)) {
      setSnack({ open: true, message: isArabic ? 'أدخل أرقاماً صحيحة' : 'Enter valid numbers', severity: 'warning' });
      return;
    }

    try {
      await updateDoc(doc(db, 'doctors', user.uid), {
        checkupPrice: cPrice,
        followUpPrice: fPrice
      });
      setCheckupPrice(cPrice);
      setFollowUpPrice(fPrice);
      setSnack({ open: true, message: isArabic ? 'تم تحديث الأسعار' : 'Prices updated', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, message: e?.message || (isArabic ? 'فشل التحديث' : 'Update failed'), severity: 'error' });
    }
  };



  const formatNum = React.useCallback(
    (n) => Number(n || 0).toLocaleString(isArabic ? 'ar-EG' : undefined),
    [isArabic]
  );

  const generateAiPdf = React.useCallback(() => {
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) {
      setSnack({ open: true, severity: 'warning', message: isArabic ? 'فعّل النوافذ المنبثقة لتوليد التقرير' : 'Enable popups to generate the report' });
      return;
    }

    const heading = isArabic ? 'تقرير العيادة الذكي' : 'AI Clinic Report';
    const sub = isArabic ? 'ملخص شامل مع توصيات ترويجية' : 'Detailed summary with promo recommendations';

    const stats = [
      { label: isArabic ? 'إجمالي الزيارات (الشهر)' : 'Total Visits (month)', value: formatNum(totalAppointments) },
      { label: isArabic ? 'الجلسات المكتملة' : 'Completed Sessions', value: formatNum(completedSessions) },
      { label: isArabic ? 'المرضى الفريدون' : 'Unique Patients', value: formatNum(patientsSeen) },
      { label: isArabic ? 'الملغاة/الغائبة' : 'Missed/Cancelled', value: formatNum(missedAppointments) },
      { label: isArabic ? 'معدل الإتمام' : 'Completion Rate', value: `${completionRate}%` },
      { label: isArabic ? 'إيراد المواعيد' : 'Appointment Revenue', value: `${formatNum(apptRevenue)} EGP` },
    ];

    const listItems = aiInsights.map((l) => `<li>${l}</li>`).join('');
    const statsHtml = stats
      .map(
        (s) => `
        <div class="card">
          <div class="stat-label">${s.label}</div>
          <div class="stat-value">${s.value}</div>
        </div>`
      )
      .join('');

    const html = `
      <!doctype html>
      <html lang="${isArabic ? 'ar' : 'en'}" dir="${isArabic ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8" />
        <title>${heading}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 32px; background: #f7f9fb; color: #0f172a; direction: ${isArabic ? 'rtl' : 'ltr'}; }
          h1 { margin: 0 0 4px; font-size: 26px; }
          h2 { margin: 16px 0 8px; }
          p { margin: 4px 0 12px; color: #475569; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; border: 1px solid #2563eb; color: #2563eb; font-weight: 600; font-size: 12px; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }
          .card { background: white; border-radius: 12px; padding: 14px; border: 1px solid #e2e8f0; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06); }
          .stat-label { font-size: 12px; color: #64748b; margin-bottom: 6px; }
          .stat-value { font-size: 18px; font-weight: 800; color: #0f172a; }
          ul { padding-${isArabic ? 'right' : 'left'}: 18px; }
          li { margin: 6px 0; line-height: 1.5; }
          .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: ${isArabic ? 'left' : 'right'}; }
        </style>
      </head>
      <body>
        <div class="badge">${isArabic ? 'بيانات لحظية' : 'Live Data'}</div>
        <h1>${heading}</h1>
        <p>${sub}</p>

        <div class="stats">
          ${statsHtml}
        </div>

        <h2>${isArabic ? 'أهم الملاحظات' : 'Key Insights'}</h2>
        <ul>${listItems}</ul>

        <h2>${isArabic ? 'توصية ترويجية سريعة' : 'Quick Promotion Tip'}</h2>
        <p>${isArabic ? 'فعّل رسالة تذكير قبل 24 ساعة مع خصم 10٪ لمواعيد منتصف الأسبوع لزيادة الإتمام وتخفيف ضغط يوم الذروة.' : 'Send a 24h reminder and offer 10% off mid-week slots to lift completion and ease peak-day load.'}</p>

        <div class="footer">${isArabic ? 'تم الإنشاء تلقائياً من لوحة تقارير العيادة' : 'Auto-generated from Clinic Reports dashboard'}</div>
        <script>
          setTimeout(() => { window.print(); }, 200);
        </script>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  }, [
    aiInsights,
    apptRevenue,
    completionRate,
    formatNum,
    isArabic,
    missedAppointments,
    patientsSeen,
    totalAppointments,
    completedSessions,
  ]);


  return (
    <AppLayout>
      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ textAlign: isArabic ? 'right' : 'left' }}>
        <Container disableGutters maxWidth="lg">
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton component={Link} href={withLang('/')} size="small" sx={{ transform: isArabic ? 'scaleX(-1)' : 'none' }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h5" fontWeight={800}>
                {isArabic ? 'تقارير العيادة' : 'Clinic Reports'}
              </Typography>
            </Stack>
          </Stack>

          {/* Content */}
          {loading ? (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[...Array(4)].map((_, i) => (
                  <Grid key={i} item xs={6} sm={3}>
                    <Skeleton variant="rounded" height={114} />
                  </Grid>
                ))}
              </Grid>
              <Skeleton variant="rounded" height={86} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" height={340} />
            </>
          ) : (
            <>
              {/* Summary tiles (current month) */}
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <StatTile
                    isArabic={isArabic}
                    icon={<CalendarTodayIcon />}
                    title={isArabic ? 'إجمالي المواعيد (هذا الشهر)' : 'Total Appointments (This Month)'}
                    value={totalAppointments}
                    color="primary"
                    delay={0.1}
                    trend={growthStats.total}
                    trendDir={growthStats.total >= 0 ? 'up' : 'down'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatTile
                    isArabic={isArabic}
                    icon={<CheckCircleIcon />}
                    title={isArabic ? 'الجلسات المكتملة' : 'Completed Sessions'}
                    value={completedSessions}
                    color="success"
                    delay={0.2}
                    trend={growthStats.completed}
                    trendDir={growthStats.completed >= 0 ? 'up' : 'down'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatTile
                    isArabic={isArabic}
                    icon={<PeopleIcon />}
                    title={isArabic ? 'عدد المرضى (مميز)' : 'Patients Seen (Unique)'}
                    value={patientsSeen}
                    color="info"
                    delay={0.3}
                    trend={growthStats.seen}
                    trendDir={growthStats.seen >= 0 ? 'up' : 'down'}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StatTile
                    isArabic={isArabic}
                    icon={<CancelIcon />}
                    title={isArabic ? 'المواعيد الفائتة/الملغاة' : 'Missed/Cancelled'}
                    value={missedAppointments}
                    color="warning"
                    delay={0.4}
                    trend={growthStats.missed}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    elevation={0}
                    sx={{
                      mt: 4,
                      p: 4,
                      borderRadius: 4,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                      <Avatar sx={{ bgcolor: 'success.light', color: 'success.dark' }}>
                        <AttachMoneyIcon />
                      </Avatar>
                      <Typography variant="h6" fontWeight={800}>
                        {isArabic ? '??????? ???????' : 'Pricing Settings'}
                      </Typography>
                    </Stack>

                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label={isArabic ? '??? ????? (??? ????)' : 'Examination Price (New)'}
                          type="number"
                          value={String(
                            checkupPriceInput === '' || checkupPriceInput === null || checkupPriceInput === undefined
                              ? checkupPrice ?? 0
                              : checkupPriceInput
                          )}
                          onChange={(e) => setCheckupPriceInput(e.target.value)}
                          InputProps={{
                            startAdornment: <Typography color="text.secondary" sx={{ mx: 1 }}>EGP</Typography>
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label={isArabic ? '??? ????? ?????' : 'Re-examination Price'}
                          type="number"
                          value={String(
                            followUpPriceInput === '' || followUpPriceInput === null || followUpPriceInput === undefined
                              ? followUpPrice ?? 0
                              : followUpPriceInput
                          )}
                          onChange={(e) => setFollowUpPriceInput(e.target.value)}
                          InputProps={{
                            startAdornment: <Typography color="text.secondary" sx={{ mx: 1 }}>EGP</Typography>
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Button
                          variant="contained"
                          size="large"
                          startIcon={<SaveIcon />}
                          onClick={savePrices}
                          sx={{ px: 4, py: 1.5, borderRadius: 2 }}
                        >
                          {isArabic ? '??? ?????????' : 'Save Changes'}
                        </Button>
                      </Grid>
                    </Grid>
                  </StatTile>

                </Grid>
              </Grid>

              {/* AI clinic brief */}
              <Box sx={{ mt: 2 }}>
                <MotionPaper
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  elevation={0}
                  sx={{
                    p: 4,
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    background: alpha(theme.palette.primary.main, 0.02),
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main' }}>
                        <TrendingUpIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" fontWeight={800}>
                          {isArabic ? 'تقرير العيادة الذكي (AI)' : 'AI Clinic Brief'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {isArabic ? 'ملخص تلقائي لأداء العيادة مع توصيات ترويجية.' : 'Auto summary of clinic performance with promo tips.'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip label={isArabic ? 'بيانات لحظية' : 'Live data'} color="primary" variant="outlined" />
                  </Stack>

                  <Stack component="ul" spacing={1.25} sx={{ listStyle: 'disc', pl: 3, m: 0 }}>
                    {aiInsights.map((line, idx) => (
                      <Typography key={idx} component="li" variant="body2" color="text.primary">
                        {line}
                      </Typography>
                    ))}
                  </Stack>

                  <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
                    <Button onClick={generateAiPdf} size="small" variant="contained" color="primary">
                      {isArabic ? 'توليد تقرير PDF بالذكاء الاصطناعي' : 'Generate AI PDF'}
                    </Button>
                    <Button component={Link} href={withLang('/appointments')} size="small" variant="outlined">
                      {isArabic ? 'عرض المواعيد' : 'View appointments'}
                    </Button>
                    <Button component={Link} href={withLang('/patients')} size="small" variant="contained">
                      {isArabic ? 'المرضى' : 'Patients'}
                    </Button>
                  </Stack>
                </MotionPaper>
              </Box>

              {/* Pricing editor (placed above extra services) */}
              <MotionPaper
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                elevation={0}
                sx={{ mt: 3, p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}
              >
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Avatar sx={{ bgcolor: 'success.light', color: 'success.dark' }}>
                    <AttachMoneyIcon />
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>
                      {isArabic ? 'إعدادات التسعير' : 'Pricing Settings'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {isArabic ? 'تعديل سعر الكشف وسعر إعادة الكشف وسيتم حفظها للطبيب.' : 'Update initial and follow-up prices for this clinic.'}
                    </Typography>
                  </Box>
                </Stack>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label={isArabic ? 'سعر الكشف (حجز جديد)' : 'Examination Price (New)'}
                      type="number"
                      value={String(
                        checkupPriceInput === '' || checkupPriceInput === null || checkupPriceInput === undefined
                          ? checkupPrice ?? 0
                          : checkupPriceInput
                      )}
                      onChange={(e) => setCheckupPriceInput(e.target.value)}
                      InputProps={{
                        startAdornment: <Typography color="text.secondary" sx={{ mx: 1 }}>EGP</Typography>
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label={isArabic ? 'سعر إعادة الكشف' : 'Re-examination Price'}
                      type="number"
                      value={String(
                        followUpPriceInput === '' || followUpPriceInput === null || followUpPriceInput === undefined
                          ? followUpPrice ?? 0
                          : followUpPriceInput
                      )}
                      onChange={(e) => setFollowUpPriceInput(e.target.value)}
                      InputProps={{
                        startAdornment: <Typography color="text.secondary" sx={{ mx: 1 }}>EGP</Typography>
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction="row" justifyContent={isArabic ? 'flex-start' : 'flex-end'}>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<SaveIcon />}
                        onClick={savePrices}
                        sx={{ px: 4, py: 1.5, borderRadius: 2 }}
                      >
                        {isArabic ? 'حفظ التغييرات' : 'Save Changes'}
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </MotionPaper>

              {/* ---------- NEW: Extra Services Editor ---------- */}
              <MotionPaper
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    elevation={0}
                    sx={{ mt: 4, p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                      <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.dark' }}>
                        <TrendingUpIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" fontWeight={800}>
                          {isArabic ? 'الخدمات الإضافية' : 'Extra Services'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {isArabic ? 'خدمات يمكن للمريض اختيارها أثناء الحجز' : 'Services patients can select during booking'}
                        </Typography>
                      </Box>
                    </Stack>

                    {/* Add new extra service */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: 'background.default', borderStyle: 'dashed' }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                        {isArabic ? 'إضافة خدمة جديدة' : 'Add New Service'}
                      </Typography>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                          <TextField
                            label={isArabic ? 'اسم الخدمة (عربي)' : 'Service name (Arabic)'}
                            value={newExtraNameAr}
                            onChange={(e) => setNewExtraNameAr(e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <TextField
                            label={isArabic ? 'اسم الخدمة (إنجليزي)' : 'Service name (English)'}
                            value={newExtraNameEn}
                            onChange={(e) => setNewExtraNameEn(e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <TextField
                            label={isArabic ? 'السعر' : 'Price'}
                            type="number"
                            value={newExtraPrice}
                            onChange={(e) => setNewExtraPrice(e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={6} md={2}>
                          <Button
                            startIcon={<AddIcon />}
                            variant="contained"
                            onClick={addExtra}
                            fullWidth
                            disableElevation
                          >
                            {isArabic ? 'إضافة' : 'Add'}
                          </Button>
                        </Grid>
                      </Grid>
                    </Paper>

                    {/* List / edit existing extras */}
                    {extras.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4, bgcolor: 'background.default', borderRadius: 3 }}>
                        <Typography color="text.secondary">
                          {isArabic ? 'لا توجد خدمات إضافية بعد.' : 'No extra services yet.'}
                        </Typography>
                      </Box>
                    ) : (
                      <Stack spacing={2}>
                        {extras.map((e) => (
                          <Paper
                            key={e.id}
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 3,
                              display: 'flex',
                              flexDirection: { xs: 'column', md: 'row' },
                              gap: 2,
                              alignItems: 'center',
                              transition: 'all 0.2s',
                              '&:hover': { borderColor: 'primary.main', bgcolor: 'background.default' }
                            }}
                          >
                            <Grid container spacing={2} alignItems="center">
                              <Grid item xs={12} sm={4}>
                                <TextField
                                  size="small"
                                  label={isArabic ? 'الاسم (عربي)' : 'Name (Arabic)'}
                                  value={e.name_ar}
                                  onChange={(ev) => updateExtra(e.id, { name_ar: ev.target.value })}
                                  fullWidth
                                  variant="standard"
                                />
                              </Grid>
                              <Grid item xs={12} sm={4}>
                                <TextField
                                  size="small"
                                  label={isArabic ? 'الاسم (إنجليزي)' : 'Name (English)'}
                                  value={e.name_en}
                                  onChange={(ev) => updateExtra(e.id, { name_en: ev.target.value })}
                                  fullWidth
                                  variant="standard"
                                />
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <TextField
                                  size="small"
                                  type="number"
                                  label={isArabic ? 'السعر' : 'Price'}
                                  value={e.price}
                                  onChange={(ev) => updateExtra(e.id, { price: Number(ev.target.value) })}
                                  fullWidth
                                  variant="standard"
                                />
                              </Grid>
                              <Grid item xs={6} sm={2}>
                                <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1}>
                                  <Switch
                                    size="small"
                                    checked={e.active !== false}
                                    onChange={(ev) => updateExtra(e.id, { active: ev.target.checked })}
                                  />
                                  <IconButton size="small" color="error" onClick={() => deleteExtra(e.id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))}
                      </Stack>
                    )}

                    <Stack direction="row" justifyContent={isArabic ? 'flex-start' : 'flex-end'} sx={{ mt: 3 }}>
                      <Button startIcon={<SaveIcon />} variant="contained" onClick={saveExtras} size="large" sx={{ px: 4, borderRadius: 2 }}>
                        {isArabic ? 'حفظ الخدمات' : 'Save Services'}
                      </Button>
                    </Stack>
                  </MotionPaper>
                  {/* ---------- /Extra Services Editor ---------- */}

                  {/* Financial chart (appointments-only) */}
                  <MotionPaper
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                    elevation={0}
                    sx={{ mt: 4, p: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      justifyContent="space-between"
                      spacing={1}
                      sx={{ mb: 3 }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark' }}>
                          <AttachMoneyIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" fontWeight={800}>
                            {isArabic ? 'التقارير المالية' : 'Financial Reports'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {isArabic ? 'إيرادات المواعيد فقط' : 'Appointments revenue only'}
                          </Typography>
                        </Box>
                      </Stack>

                      {/* Range selector */}
                      <ToggleButtonGroup
                        value={finRange}
                        exclusive
                        onChange={(_, v) => v && setFinRange(v)}
                        size="small"
                        sx={{
                          '& .MuiToggleButton-root': {
                            borderRadius: 2,
                            mx: 0.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '&:hover': { bgcolor: 'primary.dark' } }
                          }
                        }}
                      >
                        <ToggleButton value="week">{isArabic ? 'أسبوع' : 'Week'}</ToggleButton>
                        <ToggleButton value="month">{isArabic ? 'شهر' : 'Month'}</ToggleButton>
                        <ToggleButton value="year">{isArabic ? 'سنة' : 'Year'}</ToggleButton>
                      </ToggleButtonGroup>
                    </Stack>

                    <Paper variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3, bgcolor: 'background.default', textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {isArabic ? 'إجمالي الإيرادات للفترة المختارة' : 'Total Revenue for selected period'}
                      </Typography>
                      <Typography variant="h3" fontWeight={800} color="primary">
                        {Math.round(apptRevenue).toLocaleString()} <Typography component="span" variant="h5" color="text.secondary">EGP</Typography>
                      </Typography>
                    </Paper>

                    <Box sx={{ width: '100%', height: 340 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: theme.palette.text.secondary }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: theme.palette.text.secondary }}
                          />
                          <Tooltip
                            cursor={{ fill: alpha(theme.palette.primary.main, 0.1) }}
                            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                          />
                          <Bar dataKey="value" fill={theme.palette.primary.main} radius={[8, 8, 0, 0]} barSize={60} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </MotionPaper>
                </>
          )}

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
        </AppLayout>
        );
}

