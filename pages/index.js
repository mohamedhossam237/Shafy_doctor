'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Box, Typography, Chip, Button, Alert } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then((mod) => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then((mod) => mod.ResponsiveContainer), { ssr: false });
const Cell = dynamic(() => import('recharts').then((mod) => mod.Cell), { ssr: false });

import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import AnalyticsRoundedIcon from '@mui/icons-material/AnalyticsRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import AttachMoneyRoundedIcon from '@mui/icons-material/AttachMoneyRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { getAppointmentTypeInfo } from '@/lib/appointmentUtils';
import globalCache, { readSessionCache, writeSessionCache } from '@/lib/cache';

const AddPatientDialog = dynamic(() => import('@/components/patients/AddPatientDialog'), {
  ssr: false,
});

/* --------------------------- Helpers --------------------------- */

function formatLongDate(isArabic) {
  const locale = isArabic ? 'ar-EG' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
}

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

function isToday(d) {
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatTime(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
}

function formatAmount(amount) {
  return Number(amount || 0).toLocaleString('en-US-u-nu-latn', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function apptDate(appt) {
  if (appt?._dt) return appt._dt;
  if (appt?.appointmentDate) return toDate(appt.appointmentDate);
  if (appt?.date) {
    const [y, m, d] = String(appt.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(appt.time || '00:00')
      .split(':')
      .map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, hh, mm);
    }
  }
  return null;
}

function getGreeting(isArabic) {
  const hour = new Date().getHours();
  if (hour < 12) return isArabic ? 'صباح الخير' : 'Good Morning';
  if (hour < 18) return isArabic ? 'مساء الخير' : 'Good Afternoon';
  return isArabic ? 'مساء الخير' : 'Good Evening';
}

const normalizeHoursFromAny = (sourceObj) => {
  if (!sourceObj || typeof sourceObj !== 'object') {
    return { sun: '', mon: '', tue: '', wed: '', thu: '', fri: '', sat: '' };
  }
  const src =
    sourceObj.working_hours ||
    sourceObj.workingHours ||
    (sourceObj.clinic && (sourceObj.clinic.working_hours || sourceObj.clinic.workingHours)) ||
    null;
  if (src && typeof src === 'object' && typeof src.sun === 'string') return src;
  if (src && typeof src === 'object' && typeof src.sun === 'object') {
    const out = {};
    for (const k of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
      const day = src[k];
      if (day && day.open !== false) {
        const s = day.start || '09:00';
        const e = day.end || '17:00';
        out[k] = `${s}-${e}`;
      } else {
        out[k] = '';
      }
    }
    return out;
  }
  return { sun: '', mon: '', tue: '', wed: '', thu: '', fri: '', sat: '' };
};

function getTodayHoursLabel(hoursObj, isArabic) {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayKey = keys[new Date().getDay()];
  const raw = hoursObj?.[todayKey];
  if (raw && String(raw).trim()) return String(raw).trim();
  return isArabic ? 'مفتوح حسب المواعيد' : 'Open by schedule';
}

function getPatientId(appt) {
  if (!appt) return null;
  return appt.patientId || appt.patientUID || appt.patientID || appt.patientUid || null;
}

function getRelativeTime(date, isArabic) {
  if (!date) return '';
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
  const rtf = new Intl.RelativeTimeFormat(isArabic ? 'ar' : 'en', { numeric: 'auto' });

  if (diffInSeconds < 60) return isArabic ? 'الآن' : 'Just now';
  if (diffInSeconds < 3600) return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
  if (diffInSeconds < 86400) return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
  if (diffInSeconds < 604800) return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
  return new Date(date).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US');
}

/* --------------------------- Subcomponents --------------------------- */

function KpiCard({ title, value, subtext, icon, accent, softBg, href, withLang, extra }) {
  return (
    <Link href={withLang(href)} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
      <div
        className="glass-panel glass-panel-lift animate-fade-in"
        style={{
          padding: '22px',
          borderTop: `4px solid ${accent}`,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Soft corner glow */}
        <div
          style={{
            position: 'absolute',
            top: '-36px',
            left: '-36px',
            width: '110px',
            height: '110px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${softBg} 0%, transparent 72%)`,
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#475569' }}>{title}</span>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '13px',
              background: softBg,
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 6px 14px -6px ${accent}55`,
            }}
          >
            {icon}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            {value}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.76rem',
              color: accent,
              fontWeight: 800,
              marginTop: '8px',
            }}
          >
            <ArrowOutwardRoundedIcon sx={{ fontSize: 14 }} />
            <span>{subtext}</span>
          </div>
          {extra}
        </div>
      </div>
    </Link>
  );
}

const WeeklyActivityCard = React.memo(function WeeklyActivityCard({ data, isArabic }) {
  const theme = useTheme();
  const totalWeek = data.reduce((acc, item) => acc + (item.count || 0), 0);

  return (
    <div
      className="glass-panel animate-fade-in"
      style={{ padding: '24px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
          paddingBottom: '14px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUpRoundedIcon sx={{ fontSize: 21 }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.04rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              {isArabic ? 'نشاط العيادة الأسبوعي' : 'Weekly Clinic Activity'}
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
              {isArabic ? 'توزيع المواعيد خلال آخر 7 أيام' : 'Appointments distribution across the last 7 days'}
            </span>
          </div>
        </div>

        <span className="badge badge-brand" style={{ padding: '6px 14px', fontSize: '0.78rem' }}>
          {isArabic ? `الإجمالي: ${totalWeek} موعد` : `Total: ${totalWeek} visits`}
        </span>
      </div>

      <div style={{ width: '100%', height: 245 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="shafyTodayBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.92} />
              </linearGradient>
              <linearGradient id="shafyDayBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#dbeafe" stopOpacity={0.75} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
              dy={8}
            />
            <Tooltip
              cursor={{ fill: alpha(theme.palette.primary.main, 0.06), radius: 10 }}
              contentStyle={{
                borderRadius: 14,
                border: '1px solid #bfdbfe',
                boxShadow: '0 14px 30px -8px rgba(37, 99, 235, 0.22)',
                fontWeight: 800,
                fontSize: '0.84rem',
              }}
            />
            <Bar dataKey="count" radius={[10, 10, 6, 6]} maxBarSize={38}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.today ? 'url(#shafyTodayBar)' : 'url(#shafyDayBar)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

/* --------------------------- Main Page --------------------------- */

export default function DashboardIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    return true;
  }, [router.query]);

  const [loading, setLoading] = React.useState(() => !globalCache.dashboard);
  const [err, setErr] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('appointments');

  const [doctorName, setDoctorName] = React.useState(() => globalCache.dashboard?.doctorName || 'الطبيب');
  const [doctorMeta, setDoctorMeta] = React.useState(
    () =>
      globalCache.dashboard?.doctorMeta || {
        specialty: '',
        clinicName: '',
        avatarUrl: null,
        todayHours: '',
      }
  );
  const [appointments, setAppointments] = React.useState(() => globalCache.dashboard?.appointments || []);
  const [hasAmHours, setHasAmHours] = React.useState(() => globalCache.dashboard?.hasAmHours ?? true);
  const [weeklyData, setWeeklyData] = React.useState(() => globalCache.dashboard?.weeklyData || []);
  const [recentPatients, setRecentPatients] = React.useState(() => globalCache.dashboard?.recentPatients || []);
  const [recentReports, setRecentReports] = React.useState(() => globalCache.dashboard?.recentReports || []);
  const [recentArticles, setRecentArticles] = React.useState(() => globalCache.dashboard?.recentArticles || []);
  const [counts, setCounts] = React.useState(
    () => globalCache.dashboard?.counts || { appointments: 0, patients: 0, reports: 0, completedToday: 0 }
  );
  const [revenueDetails, setRevenueDetails] = React.useState(
    () => globalCache.dashboard?.revenueDetails || { total: 0, checkup: 0, followup: 0, additional: 0 }
  );
  const [openAddPatient, setOpenAddPatient] = React.useState(false);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : `${path}${path.includes('?') ? '&' : '?'}lang=en`),
    [isArabic]
  );

  React.useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const doctorUID = user.uid;
    const sessionKey = `dash_${doctorUID}_${isArabic ? 'ar' : 'en'}`;

    // Instant 0ms hydration from memory or sessionStorage cache
    const cached = globalCache.dashboard || readSessionCache(sessionKey, 5 * 60 * 1000);
    if (cached) {
      setDoctorName(cached.doctorName || (isArabic ? 'الطبيب' : 'Doctor'));
      if (cached.doctorMeta) setDoctorMeta(cached.doctorMeta);
      setAppointments(cached.appointments || []);
      setHasAmHours(cached.hasAmHours ?? true);
      setWeeklyData(cached.weeklyData || []);
      setRecentPatients(cached.recentPatients || []);
      setRecentReports(cached.recentReports || []);
      setRecentArticles(cached.recentArticles || []);
      setCounts(cached.counts || { appointments: 0, patients: 0, reports: 0, completedToday: 0 });
      setRevenueDetails(cached.revenueDetails || { total: 0, checkup: 0, followup: 0, additional: 0 });
      setLoading(false);
    }

    (async () => {
      if (!cached) setLoading(true);
      setErr('');
      try {
        // Compute last 7 days synchronously before launching parallel queries
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d;
        });
        const pad = (n) => String(n).padStart(2, '0');
        const dateStrings = last7Days.map(
          (day) => `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
        );

        const colAppt = collection(db, 'appointments');
        const patientsCol = collection(db, 'patients');
        const colRep = collection(db, 'reports');
        const articlesCol = collection(db, 'articles');

        const fetchReportsSafe = async () => {
          try {
            const [r1, r2] = await Promise.all([
              getDocs(query(colRep, where('doctorUID', '==', doctorUID), orderBy('date', 'desc'), limit(6))),
              getDocs(query(colRep, where('doctorId', '==', doctorUID), orderBy('date', 'desc'), limit(6))),
            ]);
            return [...r1.docs, ...r2.docs];
          } catch {
            try {
              const [r1, r2] = await Promise.all([
                getDocs(query(colRep, where('doctorUID', '==', doctorUID), limit(15))),
                getDocs(query(colRep, where('doctorId', '==', doctorUID), limit(15))),
              ]);
              return [...r1.docs, ...r2.docs];
            } catch {
              return [];
            }
          }
        };

        // Fire ALL 8 independent Firestore queries in ONE parallel batch (no waterfall!)
        const [
          dData,
          snapOldDate,
          snapNewDate,
          pSnap,
          patientsCountSnap,
          reportsCountSnap,
          repDocs,
          articlesSnap,
        ] = await Promise.all([
          globalCache.doctorProfile?._uid === doctorUID
            ? Promise.resolve(globalCache.doctorProfile)
            : getDoc(doc(db, 'doctors', doctorUID))
                .then((s) => {
                  const data = s.exists() ? { _uid: doctorUID, ...s.data() } : {};
                  if (s.exists()) globalCache.doctorProfile = data;
                  return data;
                })
                .catch(() => ({})),
          getDocs(query(colAppt, where('doctorUID', '==', doctorUID), where('date', 'in', dateStrings))).catch(() => ({ docs: [] })),
          getDocs(query(colAppt, where('doctorId', '==', doctorUID), where('date', 'in', dateStrings))).catch(() => ({ docs: [] })),
          getDocs(query(patientsCol, where('registeredBy', '==', doctorUID), orderBy('createdAt', 'desc'), limit(5))).catch(() => ({ docs: [] })),
          getCountFromServer(query(patientsCol, where('associatedDoctors', 'array-contains', doctorUID))).catch(() => null),
          getCountFromServer(query(colRep, where('doctorUID', '==', doctorUID))).catch(() => null),
          fetchReportsSafe(),
          getDocs(query(articlesCol, where('authorId', '==', doctorUID), limit(10))).catch(() => ({ docs: [] })),
        ]);

        if (cancelled) return;

        const resolvedName = isArabic
          ? dData?.name_ar || dData?.name_en || 'الطبيب'
          : dData?.name_en || dData?.name_ar || 'Doctor';
        const checkupPrice = Number(dData?.checkupPrice || 0);
        const followUpPrice = Number(dData?.followUpPrice || 0);

        const hours = normalizeHoursFromAny(dData);
        let foundAm = false;
        Object.values(hours).forEach((rangeStr) => {
          if (!rangeStr) return;
          rangeStr.split(',').forEach((r) => {
            const start = r.split('-')[0];
            if (start) {
              const [h] = start.split(':').map((n) => parseInt(n, 10));
              if (Number.isFinite(h) && h < 12) foundAm = true;
            }
          });
        });

        const computedMeta = {
          specialty: isArabic
            ? dData?.specialty_ar || dData?.specialty || 'طبيب معتمد'
            : dData?.specialty_en || dData?.specialty || 'Verified Physician',
          clinicName: isArabic
            ? dData?.clinicName_ar || dData?.clinic?.name_ar || 'عيادة شافي الطبية'
            : dData?.clinicName_en || dData?.clinic?.name_en || 'Shafy Medical Clinic',
          avatarUrl: dData?.profileImage || dData?.photoUrl || dData?.photoURL || dData?.imageUrl || null,
          todayHours: getTodayHoursLabel(hours, isArabic),
        };

        // Process appointments
        const apptMap = new Map();
        [...snapOldDate.docs, ...snapNewDate.docs].forEach((d) =>
          apptMap.set(d.id, { id: d.id, ...d.data() })
        );
        let rows = Array.from(apptMap.values()).map((r) => ({ ...r, _dt: apptDate(r) }));

        const uniqueMapDash = new Map();
        rows.forEach((row) => {
          const t = row.time || '00:00';
          const pid = getPatientId(row) || row.patientName || 'unknown';
          const key = `${t}_${pid}`;
          if (!uniqueMapDash.has(key)) {
            uniqueMapDash.set(key, row);
          } else {
            const existing = uniqueMapDash.get(key);
            const statusNew = String(row.status || '').toLowerCase();
            const statusOld = String(existing.status || '').toLowerCase();
            if (statusNew === 'completed' && statusOld !== 'completed') {
              uniqueMapDash.set(key, row);
            } else if (statusNew === 'confirmed' && statusOld !== 'completed' && statusOld !== 'confirmed') {
              uniqueMapDash.set(key, row);
            }
          }
        });
        rows = Array.from(uniqueMapDash.values());

        const todayAll = rows.filter((r) => isToday(r._dt));
        const completedToday = todayAll.filter((r) => String(r.status || '').toLowerCase() === 'completed').length;
        const nowMs = Date.now();

        const getSortTime = (r) => {
          const t = r._dt?.getTime() || 0;
          if (!foundAm && r._dt && r._dt.getHours() < 12) return t + 12 * 60 * 60 * 1000;
          return t;
        };

        const upcoming = todayAll
          .filter((r) => getSortTime(r) >= nowMs)
          .sort((a, b) => getSortTime(a) - getSortTime(b))
          .slice(0, 6);

        const weeklyStats = last7Days.map((day) => {
          const count = rows.filter((r) => {
            const rd = r._dt;
            return (
              rd &&
              rd.getDate() === day.getDate() &&
              rd.getMonth() === day.getMonth() &&
              rd.getFullYear() === day.getFullYear()
            );
          }).length;
          return {
            day: day.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { weekday: 'short' }),
            count,
            today: isToday(day),
          };
        });

        const loadedPatients = pSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const visiblePatientsCount = patientsCountSnap ? patientsCountSnap.data().count : loadedPatients.length;
        const totalReportsCount = reportsCountSnap ? reportsCountSnap.data().count : 0;

        const repMap = new Map();
        repDocs.forEach((d) => repMap.set(d.id, { id: d.id, ...d.data() }));
        const repRows = Array.from(repMap.values());
        repRows.sort((a, b) => (toDate(b?.date)?.getTime() || 0) - (toDate(a?.date)?.getTime() || 0));
        const topReports = repRows.slice(0, 6);

        const articlesRows = articlesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        articlesRows.sort((a, b) => {
          const aDate = toDate(a.publishedAt || a.createdAt || a.updatedAt);
          const bDate = toDate(b.publishedAt || b.createdAt || b.updatedAt);
          return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
        });
        const topArticles = articlesRows.slice(0, 6);

        const nextCounts = {
          appointments: todayAll.length,
          patients: visiblePatientsCount,
          reports: totalReportsCount,
          completedToday,
        };

        // Today's revenue calculation
        let checkupRevenue = 0;
        let followupRevenue = 0;
        let additionalRevenue = 0;

        todayAll.forEach((r) => {
          const status = String(r.status || '').toLowerCase();
          if (status !== 'completed' && status !== 'confirmed' && status !== 'arrived') return;

          const typeInfo = getAppointmentTypeInfo(r, false);
          const isFollowUp = typeInfo.color === 'secondary';

          let extra = Number(r.additionalFees || 0);
          if (Array.isArray(r.extraFees)) {
            extra += r.extraFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
          } else if (typeof r.extraFees === 'number') {
            extra += r.extraFees;
          }

          let basePrice = Number(r.doctorPrice || r.checkupFee || r.price || r.fee || 0);
          if (basePrice === 0 && r.totalAmount && Number(r.totalAmount) > 0) {
            const totalAmount = Number(r.totalAmount);
            basePrice = extra > 0 ? Math.max(0, totalAmount - extra) : totalAmount;
          }
          if (basePrice === 0) {
            basePrice = isFollowUp ? followUpPrice : checkupPrice;
          }

          if (isFollowUp) followupRevenue += basePrice;
          else checkupRevenue += basePrice;
          additionalRevenue += extra;
        });

        const totalIncome = checkupRevenue + followupRevenue + additionalRevenue;
        const currentRevenueDetails = {
          total: totalIncome,
          checkup: checkupRevenue,
          followup: followupRevenue,
          additional: additionalRevenue,
        };

        // Batch state updates together
        setDoctorName(resolvedName);
        setDoctorMeta(computedMeta);
        setHasAmHours(foundAm);
        setAppointments(upcoming);
        setWeeklyData(weeklyStats);
        setRecentPatients(loadedPatients);
        setRecentReports(topReports);
        setRecentArticles(topArticles);
        setCounts(nextCounts);
        setRevenueDetails(currentRevenueDetails);

        const payload = {
          doctorName: resolvedName,
          doctorMeta: computedMeta,
          appointments: upcoming,
          hasAmHours: foundAm,
          weeklyData: weeklyStats,
          dailyRevenue: totalIncome,
          recentPatients: loadedPatients,
          recentReports: topReports,
          recentArticles: topArticles,
          counts: nextCounts,
          revenueDetails: currentRevenueDetails,
        };
        globalCache.dashboard = payload;
        writeSessionCache(sessionKey, payload);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setErr(e?.message || 'Failed to load dashboard');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, isArabic]);

  const todayPretty = formatLongDate(isArabic);
  const greeting = getGreeting(isArabic);
  const remainingAppts = appointments.filter((a) => String(a.status).toLowerCase() !== 'completed').length;
  const currencyLabel = isArabic ? 'ج.م' : 'EGP';
  const doctorInitial = String(doctorName || 'D')
    .replace(/^(د\.|د |dr\.|dr )/i, '')
    .trim()[0]
    ?.toUpperCase() || 'D';

  const revTotalSafe = Math.max(1, revenueDetails.total || 0);
  const revSegments = [
    {
      label: isArabic ? 'الكشوفات' : 'Checkups',
      value: revenueDetails.checkup,
      pct: Math.round((revenueDetails.checkup / revTotalSafe) * 100),
      color: '#2563eb',
      bg: '#eff6ff',
    },
    {
      label: isArabic ? 'إعادة الكشف' : 'Follow-ups',
      value: revenueDetails.followup,
      pct: Math.round((revenueDetails.followup / revTotalSafe) * 100),
      color: '#0ea5e9',
      bg: '#e0f2fe',
    },
    {
      label: isArabic ? 'خدمات إضافية' : 'Additional',
      value: revenueDetails.additional,
      pct: Math.round((revenueDetails.additional / revTotalSafe) * 100),
      color: '#6366f1',
      bg: '#e0e7ff',
    },
  ];

  return (
    <AppLayout
      title={isArabic ? 'لوحة القيادة الإكلينيكية والإدارية' : 'Clinical & Executive Dashboard'}
      subtitle={`${todayPretty} • ${isArabic ? 'متابعة حية للمواعيد، المرضى، التقارير، والإيرادات' : 'Live clinic telemetry for visits, patients & revenue'}`}
    >
      <AddPatientDialog
        open={openAddPatient}
        onClose={() => setOpenAddPatient(false)}
        isArabic={isArabic}
        onSaved={(newId) => router.push(withLang(`/patients/${newId}`))}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {err && (
          <Alert severity="error" sx={{ borderRadius: 3 }}>
            {err}
          </Alert>
        )}

        {/* ============================================================
            1. EXECUTIVE DOCTOR COMMAND HERO + TELEMETRY STRIP
           ============================================================ */}
        <div className="shafy-hero-shell animate-fade-in">
          {/* Top Identity Row */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '18px',
              marginBottom: '22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
              {/* Doctor Avatar */}
              <div
                style={{
                  width: '66px',
                  height: '66px',
                  borderRadius: '20px',
                  background: doctorMeta.avatarUrl
                    ? '#ffffff'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08))',
                  border: '2px solid rgba(255,255,255,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.55rem',
                  fontWeight: 900,
                  color: '#ffffff',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: '0 12px 28px rgba(0,0,0,0.24)',
                }}
              >
                {doctorMeta.avatarUrl ? (
                  <img
                    src={doctorMeta.avatarUrl}
                    alt={doctorName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{doctorInitial}</span>
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.42rem', fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>
                    {greeting}، {isArabic ? 'د.' : 'Dr.'} {doctorName}
                  </h2>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.72rem',
                      background: '#ffffff',
                      color: '#1d4ed8',
                      padding: '4px 11px',
                      borderRadius: '999px',
                      fontWeight: 900,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    }}
                  >
                    <VerifiedRoundedIcon sx={{ fontSize: 14 }} />
                    <span>{doctorMeta.specialty || (isArabic ? 'طبيب معتمد' : 'Verified')}</span>
                  </span>
                  <span
                    style={{
                      fontSize: '0.73rem',
                      background: remainingAppts > 0 ? '#dcfce7' : 'rgba(255,255,255,0.18)',
                      color: remainingAppts > 0 ? '#166534' : '#ffffff',
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontWeight: 900,
                    }}
                  >
                    {remainingAppts > 0
                      ? isArabic
                        ? `● ${remainingAppts} مواعيد متبقية اليوم`
                        : `● ${remainingAppts} visits remaining today`
                      : isArabic
                      ? '● الجدول مكتمل اليوم'
                      : '● Schedule clear today'}
                  </span>
                </div>

                <p style={{ fontSize: '0.86rem', color: '#dbeafe', marginTop: '6px', marginBottom: 0, fontWeight: 600 }}>
                  <strong>{doctorMeta.clinicName || (isArabic ? 'عيادة شافي الطبية' : 'Shafy Medical Clinic')}</strong> • {todayPretty}
                </p>
              </div>
            </div>

            {/* 4 Quick Executive Action Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '12px',
                width: '100%',
                marginTop: '4px',
              }}
            >
              {/* Action 1: Add Patient (Elevated White Primary Card) */}
              <button
                type="button"
                onClick={() => setOpenAddPatient(true)}
                className="shafy-hero-action"
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid rgba(255,255,255,0.9)',
                  padding: '13px 16px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  textAlign: isArabic ? 'right' : 'left',
                  fontFamily: 'inherit',
                  boxShadow: '0 10px 26px rgba(11, 25, 54, 0.24)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                    color: '#1d4ed8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <PersonAddAlt1RoundedIcon sx={{ fontSize: 21 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#0f172a' }}>
                    {isArabic ? 'إضافة مريض جديد' : 'Add New Patient'}
                  </div>
                  <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#2563eb' }}>
                    {isArabic ? '+ فتح ملف طبي فوري' : '+ Quick medical record'}
                  </div>
                </div>
              </button>

              {/* Action 2: Ask Shafy AI (Golden Luminous Card) */}
              <Link
                href={withLang('/ask-shafy')}
                className="shafy-hero-action"
                style={{
                  background: 'rgba(254, 240, 138, 0.16)',
                  border: '1px solid rgba(253, 224, 71, 0.52)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '13px 16px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'rgba(254, 240, 138, 0.25)',
                    color: '#fef08a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AutoAwesomeRoundedIcon sx={{ fontSize: 21 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#fef08a' }}>
                    {isArabic ? 'المساعد الذكي شافي AI' : 'Ask Shafy AI'}
                  </div>
                  <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#fef9c3' }}>
                    {isArabic ? 'استشارات وتحليل فوري' : 'Instant clinical insights'}
                  </div>
                </div>
              </Link>

              {/* Action 3: New Medical Report */}
              <Link
                href={withLang('/patient-reports/new')}
                className="shafy-hero-action"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '13px 16px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.18)',
                    color: '#bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AssessmentRoundedIcon sx={{ fontSize: 21 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ffffff' }}>
                    {isArabic ? 'تقرير طبي جديد' : 'New Medical Report'}
                  </div>
                  <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#dbeafe' }}>
                    {isArabic ? 'كتابة روشتة أو تقرير' : 'Create clinical report'}
                  </div>
                </div>
              </Link>

              {/* Action 4: Clinic Analytics & Marketing */}
              <Link
                href={withLang('/clinic-reports')}
                className="shafy-hero-action"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '13px 16px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.18)',
                    color: '#93c5fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AnalyticsRoundedIcon sx={{ fontSize: 21 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#ffffff' }}>
                    {isArabic ? 'تقارير وإحصائيات العيادة' : 'Clinic Analytics'}
                  </div>
                  <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#dbeafe' }}>
                    {isArabic ? 'الأداء المالي والزيارات' : 'Revenue & visit metrics'}
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Glassmorphic Telemetry Strip */}
          <div className="shafy-telemetry-bar">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              {/* Telemetry 1: Clinic Schedule */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.96)',
                  padding: '11px 14px',
                  borderRadius: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ScheduleRoundedIcon sx={{ fontSize: 20 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 800 }}>
                    {isArabic ? 'مواعيد العيادة اليوم' : "Today's Clinic Hours"}
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doctorMeta.todayHours || (isArabic ? 'مفتوح حسب الحجز' : 'Open by booking')}
                  </div>
                </div>
              </div>

              {/* Telemetry 2: Completed Today */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.96)',
                  padding: '11px 14px',
                  borderRadius: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 800 }}>
                    {isArabic ? 'إنجاز مواعيد اليوم' : "Today's Progress"}
                  </div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0f172a' }}>
                    {counts.completedToday || 0} / {counts.appointments} {isArabic ? 'زيارة مكتملة' : 'completed'}
                  </div>
                </div>
              </div>

              {/* Telemetry 3: Checkup / Follow-up Split */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.96)',
                  padding: '11px 14px',
                  borderRadius: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LocalHospitalRoundedIcon sx={{ fontSize: 20 }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 800 }}>
                    {isArabic ? 'كشف / إعادة اليوم' : 'Checkup / Follow-up'}
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0369a1' }}>
                    {formatAmount(revenueDetails.checkup)} / {formatAmount(revenueDetails.followup)} {currencyLabel}
                  </div>
                </div>
              </div>

              {/* Telemetry 4: Daily Revenue with Details Link */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.96)',
                  padding: '11px 14px',
                  borderRadius: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AttachMoneyRoundedIcon sx={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.69rem', color: '#64748b', fontWeight: 800 }}>
                      {isArabic ? 'إيرادات اليوم' : "Today's Revenue"}
                    </div>
                    <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#15803d' }}>
                      {formatAmount(revenueDetails.total)} {currencyLabel}
                    </div>
                  </div>
                </div>
                <Link
                  href={withLang('/finance/daily')}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    color: '#1d4ed8',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    padding: '5px 10px',
                    borderRadius: '9px',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isArabic ? 'التفاصيل ←' : 'Details →'}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
            2. CLINICAL PERFORMANCE & OPERATIONS KPI ROW (4 CARDS)
           ============================================================ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px' }}>
          <KpiCard
            title={isArabic ? 'مواعيد اليوم' : "Today's Appointments"}
            value={loading ? '—' : counts.appointments}
            subtext={isArabic ? `${remainingAppts} مواعيد متبقية في الجدول` : `${remainingAppts} upcoming on schedule`}
            icon={<CalendarTodayRoundedIcon sx={{ fontSize: 22 }} />}
            accent="#2563eb"
            softBg="#eff6ff"
            href="/appointments"
            withLang={withLang}
            delay={0.05}
          />
          <KpiCard
            title={isArabic ? 'إجمالي المرضى' : 'Total Patients'}
            value={loading ? '—' : counts.patients}
            subtext={isArabic ? 'ملفات المرضى المسجلة بعيادتك' : 'Registered patients in your clinic'}
            icon={<PeopleAltRoundedIcon sx={{ fontSize: 22 }} />}
            accent="#059669"
            softBg="#ecfdf5"
            href="/patients"
            withLang={withLang}
            delay={0.1}
          />
          <KpiCard
            title={isArabic ? 'إجمالي التقارير الطبية' : 'Medical Reports'}
            value={loading ? '—' : counts.reports}
            subtext={isArabic ? 'تقارير وروشتات موثقة سحابياً' : 'Cloud-synced clinical reports'}
            icon={<AssessmentRoundedIcon sx={{ fontSize: 22 }} />}
            accent="#4f46e5"
            softBg="#eef2ff"
            href="/patient-reports"
            withLang={withLang}
            delay={0.15}
          />
          <KpiCard
            title={isArabic ? 'إيرادات اليوم' : "Today's Revenue"}
            value={loading ? '—' : `${formatAmount(revenueDetails.total)}`}
            subtext={isArabic ? `إجمالي الدخل اليومي (${currencyLabel})` : `Daily clinic income (${currencyLabel})`}
            icon={<AttachMoneyRoundedIcon sx={{ fontSize: 22 }} />}
            accent="#d97706"
            softBg="#fef3c7"
            href="/clinic-reports"
            withLang={withLang}
            delay={0.2}
          />
        </div>

        {/* ============================================================
            3. ORGANIZED CLINICAL WORKSPACE GRID (2 COLUMNS)
           ============================================================ */}
        <div className="shafy-workspace-grid">
          {/* PRIMARY COLUMN: Segmented Schedule/Reports/Articles Panel + Weekly Chart */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Segmented Header with Tab Switcher */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  paddingBottom: '14px',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    background: '#f8fafc',
                    padding: '5px',
                    borderRadius: '14px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('appointments')}
                    className="shafy-tab-pill"
                    style={{
                      background: activeTab === 'appointments' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                      color: activeTab === 'appointments' ? '#ffffff' : '#475569',
                      boxShadow: activeTab === 'appointments' ? '0 6px 14px -4px rgba(37, 99, 235, 0.45)' : 'none',
                    }}
                  >
                    <CalendarTodayRoundedIcon sx={{ fontSize: 16 }} />
                    <span>
                      {isArabic ? 'القادم اليوم' : 'Up Next'} ({appointments.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('reports')}
                    className="shafy-tab-pill"
                    style={{
                      background: activeTab === 'reports' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                      color: activeTab === 'reports' ? '#ffffff' : '#475569',
                      boxShadow: activeTab === 'reports' ? '0 6px 14px -4px rgba(37, 99, 235, 0.45)' : 'none',
                    }}
                  >
                    <AssessmentRoundedIcon sx={{ fontSize: 16 }} />
                    <span>
                      {isArabic ? 'أحدث التقارير' : 'Reports'} ({recentReports.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('articles')}
                    className="shafy-tab-pill"
                    style={{
                      background: activeTab === 'articles' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'transparent',
                      color: activeTab === 'articles' ? '#ffffff' : '#475569',
                      boxShadow: activeTab === 'articles' ? '0 6px 14px -4px rgba(37, 99, 235, 0.45)' : 'none',
                    }}
                  >
                    <ArticleRoundedIcon sx={{ fontSize: 16 }} />
                    <span>
                      {isArabic ? 'المقالات' : 'Articles'} ({recentArticles.length})
                    </span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Link
                    href={withLang(
                      activeTab === 'appointments'
                        ? '/appointments'
                        : activeTab === 'reports'
                        ? '/patient-reports'
                        : '/marketing'
                    )}
                    style={{ fontSize: '0.82rem', color: '#1d4ed8', fontWeight: 800, textDecoration: 'none' }}
                  >
                    {isArabic ? 'عرض الكل ←' : 'View All →'}
                  </Link>
                  <Link
                    href={withLang(
                      activeTab === 'appointments'
                        ? '/appointments/new'
                        : activeTab === 'reports'
                        ? '/patient-reports/new'
                        : '/marketing'
                    )}
                    className="btn btn-primary"
                    style={{ padding: '7px 14px', fontSize: '0.8rem', borderRadius: '11px' }}
                  >
                    <AddCircleRoundedIcon sx={{ fontSize: 16 }} />
                    <span>
                      {activeTab === 'appointments'
                        ? isArabic ? 'موعد جديد' : 'New Visit'
                        : activeTab === 'reports'
                        ? isArabic ? 'تقرير جديد' : 'New Report'
                        : isArabic ? 'إنشاء محتوى' : 'New Post'}
                    </span>
                  </Link>
                </div>
              </div>

              {/* Tab Content */}
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[1, 2, 3, 4].map((idx) => (
                    <div
                      key={idx}
                      className="skeleton-card"
                      style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="skeleton-shimmer" style={{ width: '48px', height: '48px', borderRadius: '13px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                          <div className="skeleton-shimmer" style={{ width: '150px', height: '15px' }} />
                          <div className="skeleton-shimmer" style={{ width: '210px', height: '12px' }} />
                        </div>
                      </div>
                      <div className="skeleton-shimmer" style={{ width: '74px', height: '28px', borderRadius: '999px' }} />
                    </div>
                  ))}
                </div>
              ) : activeTab === 'appointments' ? (
                appointments.length === 0 ? (
                  <div
                    style={{
                      padding: '46px 24px',
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: '18px',
                      border: '1.5px dashed #cbd5e1',
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        margin: '0 auto 12px',
                        borderRadius: '16px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CalendarTodayRoundedIcon sx={{ fontSize: 28 }} />
                    </div>
                    <h4 style={{ fontSize: '1.02rem', fontWeight: 900, color: '#1e293b', marginBottom: '6px' }}>
                      {isArabic ? 'لا توجد مواعيد قادمة اليوم' : 'No upcoming appointments today'}
                    </h4>
                    <p style={{ fontSize: '0.82rem', color: '#64748b', maxWidth: '380px', margin: '0 auto 18px' }}>
                      {isArabic
                        ? 'جميع المواعيد المحجوزة لليوم ستظهر هنا تلقائياً مع تنبيهات الموعد القريب.'
                        : 'All upcoming bookings for today will appear here automatically.'}
                    </p>
                    <Link href={withLang('/appointments/new')} className="btn btn-primary" style={{ padding: '9px 20px', fontSize: '0.85rem' }}>
                      <AddCircleRoundedIcon sx={{ fontSize: 17 }} />
                      <span>{isArabic ? 'حجز موعد جديد' : 'Book New Appointment'}</span>
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {appointments.map((appt) => {
                      const d = apptDate(appt) ? new Date(apptDate(appt).getTime()) : null;
                      if (d && !hasAmHours && d.getHours() < 12) d.setHours(d.getHours() + 12);

                      const status = String(appt?.status || '').toLowerCase();
                      const completed = status === 'completed';
                      const diffMins = d ? Math.floor((d - new Date()) / 60000) : 999;
                      const isStartingSoon = !completed && diffMins > 0 && diffMins <= 60;
                      const typeInfo = getAppointmentTypeInfo(appt, isArabic);
                      const pid = getPatientId(appt);
                      const detailHref = pid ? withLang(`/patients/${pid}`) : withLang('/appointments');

                      const source = String(appt?.source || '').trim();
                      const isDoctorApp =
                        source === 'Doctor_app' ||
                        appt?.fromDoctorApp === true ||
                        (!source && !appt?.fromDoctorApp && !appt?.fromPatientApp && status === 'confirmed');
                      const isPatientApp = source === 'patient_app' || appt?.fromPatientApp === true;

                      return (
                        <div
                          key={appt.id}
                          className="shafy-list-row"
                          style={{
                            borderColor: isStartingSoon ? '#f59e0b' : undefined,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                            <div
                              style={{
                                minWidth: '64px',
                                padding: '8px 10px',
                                borderRadius: '13px',
                                background: completed
                                  ? '#ecfdf5'
                                  : isStartingSoon
                                  ? '#fef3c7'
                                  : 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                                color: completed ? '#059669' : isStartingSoon ? '#b45309' : '#1d4ed8',
                                border: `1px solid ${completed ? '#bbf7d0' : isStartingSoon ? '#fde68a' : '#bfdbfe'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <AccessTimeRoundedIcon sx={{ fontSize: 16 }} />
                              <span style={{ fontSize: '0.74rem', fontWeight: 900, marginTop: '2px' }}>
                                {formatTime(d)}
                              </span>
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <Link
                                  href={detailHref}
                                  style={{
                                    fontSize: '0.96rem',
                                    fontWeight: 900,
                                    color: '#0f172a',
                                    textDecoration: 'none',
                                  }}
                                >
                                  {appt?.patientName || (isArabic ? 'مريض غير محدد' : 'Unnamed Patient')}
                                </Link>
                                {isStartingSoon && (
                                  <span className="badge badge-amber">
                                    {isArabic ? `خلال ${diffMins} د` : `In ${diffMins}m`}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                <Chip
                                  label={typeInfo.label}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.68rem',
                                    bgcolor: typeInfo.bgcolor,
                                    color: typeInfo.textColor,
                                    fontWeight: 800,
                                    border: '1px solid',
                                    borderColor: typeInfo.border,
                                  }}
                                />
                                {isDoctorApp && (
                                  <Chip
                                    size="small"
                                    icon={<TagRoundedIcon sx={{ fontSize: 13 }} />}
                                    label={isArabic ? 'تطبيق الطبيب' : 'Doctor App'}
                                    sx={{
                                      height: 22,
                                      fontSize: '0.68rem',
                                      bgcolor: '#f1f5f9',
                                      color: '#334155',
                                      fontWeight: 800,
                                    }}
                                  />
                                )}
                                {isPatientApp && (
                                  <Chip
                                    size="small"
                                    icon={<TagRoundedIcon sx={{ fontSize: 13 }} />}
                                    label={isArabic ? 'تطبيق المريض' : 'Patient App'}
                                    sx={{
                                      height: 22,
                                      fontSize: '0.68rem',
                                      bgcolor: '#eff6ff',
                                      color: '#1d4ed8',
                                      fontWeight: 800,
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {completed && (
                              <span className="badge badge-emerald">
                                {isArabic ? 'منجز ✓' : 'Done ✓'}
                              </span>
                            )}
                            <Link
                              href={detailHref}
                              className="btn btn-secondary"
                              style={{ padding: '6px 13px', fontSize: '0.78rem', borderRadius: '10px' }}
                            >
                              {isArabic ? 'عرض الملف' : 'Open File'}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : activeTab === 'reports' ? (
                recentReports.length === 0 ? (
                  <div
                    style={{
                      padding: '44px 20px',
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: '18px',
                      border: '1.5px dashed #cbd5e1',
                    }}
                  >
                    <AssessmentRoundedIcon sx={{ fontSize: 36, color: '#94a3b8', mb: 1 }} />
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#1e293b', marginBottom: '6px' }}>
                      {isArabic ? 'لا توجد تقارير طبية مؤخراً' : 'No recent medical reports'}
                    </h4>
                    <Link href={withLang('/patient-reports/new')} className="btn btn-primary" style={{ marginTop: '10px', fontSize: '0.84rem' }}>
                      <AddCircleRoundedIcon sx={{ fontSize: 17 }} />
                      <span>{isArabic ? 'إنشاء تقرير طبي' : 'Create Report'}</span>
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentReports.map((r) => (
                      <Link
                        key={r.id}
                        href={withLang('/patient-reports')}
                        className="shafy-list-row"
                        style={{ textDecoration: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '12px',
                              background: '#eef2ff',
                              color: '#4f46e5',
                              border: '1px solid #c7d2fe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <AssessmentRoundedIcon sx={{ fontSize: 21 }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0f172a' }}>
                              {r.patientName || (isArabic ? 'مريض' : 'Patient')}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                              {r.title || (isArabic ? 'تقرير طبي' : 'Clinical Report')}
                            </div>
                          </div>
                        </div>
                        <span className="badge badge-indigo">
                          {getRelativeTime(toDate(r.date), isArabic)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )
              ) : recentArticles.length === 0 ? (
                <div
                  style={{
                    padding: '44px 20px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '18px',
                    border: '1.5px dashed #cbd5e1',
                  }}
                >
                  <ArticleRoundedIcon sx={{ fontSize: 36, color: '#94a3b8', mb: 1 }} />
                  <h4 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#1e293b', marginBottom: '6px' }}>
                    {isArabic ? 'لا توجد مقالات منشورة بعد' : 'No published articles yet'}
                  </h4>
                  <Link href={withLang('/marketing')} className="btn btn-primary" style={{ marginTop: '10px', fontSize: '0.84rem' }}>
                    <CampaignRoundedIcon sx={{ fontSize: 17 }} />
                    <span>{isArabic ? 'انتقل إلى التسويق' : 'Go to Marketing'}</span>
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentArticles.map((article) => (
                    <Link
                      key={article.id}
                      href={withLang('/marketing')}
                      className="shafy-list-row"
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            background: '#e0f2fe',
                            color: '#0284c7',
                            border: '1px solid #bae6fd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {article.type === 'infographic' ? (
                            <ImageRoundedIcon sx={{ fontSize: 21 }} />
                          ) : (
                            <ArticleRoundedIcon sx={{ fontSize: 21 }} />
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.94rem', fontWeight: 900, color: '#0f172a' }}>
                            {isArabic
                              ? article.title_ar || article.title_en
                              : article.title_en || article.title_ar}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                            {article.type === 'article'
                              ? isArabic ? 'مقال طبي' : 'Medical Article'
                              : isArabic ? 'إنفوجرافيك' : 'Infographic'}
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-brand">
                        {getRelativeTime(
                          toDate(article.publishedAt || article.createdAt || article.updatedAt),
                          isArabic
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Activity Chart */}
            <WeeklyActivityCard data={weeklyData} isArabic={isArabic} />
          </div>

          {/* SECONDARY COLUMN: Recent Patients + Revenue Breakdown & Shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Card 1: Recent Patients */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: '#ecfdf5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PeopleAltRoundedIcon sx={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.04rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      {isArabic ? 'أحدث ملفات المرضى' : 'Recent Patients'}
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                      {isArabic ? 'آخر المرضى المسجلين بالعيادة' : 'Latest registered patient files'}
                    </span>
                  </div>
                </div>
                <Link
                  href={withLang('/patients')}
                  style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 900, textDecoration: 'none' }}
                >
                  {isArabic ? 'كل المرضى ←' : 'All →'}
                </Link>
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="skeleton-card" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between' }}>
                      <div className="skeleton-shimmer" style={{ width: '130px', height: '14px' }} />
                      <div className="skeleton-shimmer" style={{ width: '50px', height: '14px' }} />
                    </div>
                  ))}
                </div>
              ) : recentPatients.length === 0 ? (
                <div
                  style={{
                    padding: '34px 18px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '16px',
                    border: '1.5px dashed #cbd5e1',
                  }}
                >
                  <PeopleAltRoundedIcon sx={{ fontSize: 30, color: '#94a3b8', mb: 1 }} />
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                    {isArabic ? 'لا يوجد مرضى مسجلون مؤخراً' : 'No recent patients yet'}
                  </div>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PersonAddAlt1RoundedIcon />}
                    onClick={() => setOpenAddPatient(true)}
                  >
                    {isArabic ? 'إضافة مريض' : 'Add Patient'}
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentPatients.map((p) => {
                    const initial = String(p.name || '?').trim()[0]?.toUpperCase() || '?';
                    return (
                      <Link
                        key={p.id}
                        href={withLang(`/patients/${p.id}`)}
                        className="shafy-list-row"
                        style={{ padding: '12px 14px', textDecoration: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '11px',
                              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: '0.9rem',
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name || (isArabic ? 'مريض بدون اسم' : 'Unnamed')}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {p.phone || '—'}
                              {p.createdAt && ` • ${getRelativeTime(toDate(p.createdAt), isArabic)}`}
                            </div>
                          </div>
                        </div>
                        <ChevronRightRoundedIcon
                          sx={{
                            fontSize: 20,
                            color: '#94a3b8',
                            transform: isArabic ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Card 2: Today's Revenue Breakdown + Quick Clinic Links */}
            <div
              className="glass-panel"
              style={{
                padding: '24px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(239,246,255,0.55) 100%)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '11px',
                      background: '#fef3c7',
                      color: '#d97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <AccountBalanceWalletRoundedIcon sx={{ fontSize: 20 }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                      {isArabic ? 'تفصيل إيرادات اليوم' : "Today's Revenue Breakdown"}
                    </h4>
                    <span style={{ fontSize: '0.73rem', color: '#64748b', fontWeight: 600 }}>
                      {formatAmount(revenueDetails.total)} {currencyLabel}
                    </span>
                  </div>
                </div>
                <Link
                  href={withLang('/finance/daily')}
                  style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 900, textDecoration: 'none' }}
                >
                  {isArabic ? 'المالية ←' : 'Finance →'}
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {revSegments.map((seg) => (
                  <div
                    key={seg.label}
                    style={{
                      background: '#ffffff',
                      padding: '11px 13px',
                      borderRadius: '13px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155' }}>{seg.label}</span>
                      <span style={{ fontSize: '0.84rem', fontWeight: 900, color: seg.color }}>
                        {formatAmount(seg.value)} {currencyLabel}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${revenueDetails.total > 0 ? Math.max(4, seg.pct) : 0}%`,
                          height: '100%',
                          background: seg.color,
                          borderRadius: '999px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Tools Mini-Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Link
                  href={withLang('/labs')}
                  style={{
                    padding: '11px 12px',
                    borderRadius: '13px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    textDecoration: 'none',
                    color: '#0f172a',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                  }}
                >
                  <BiotechRoundedIcon sx={{ fontSize: 19, color: '#2563eb' }} />
                  <span>{isArabic ? 'المختبرات' : 'Labs'}</span>
                </Link>
                <Link
                  href={withLang('/marketing')}
                  style={{
                    padding: '11px 12px',
                    borderRadius: '13px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    textDecoration: 'none',
                    color: '#0f172a',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                  }}
                >
                  <CampaignRoundedIcon sx={{ fontSize: 19, color: '#4f46e5' }} />
                  <span>{isArabic ? 'التسويق' : 'Marketing'}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
