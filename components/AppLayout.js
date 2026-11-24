// /components/AppLayout.js
'use client';
import * as React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Box, Badge } from '@mui/material';

import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import MailOutlineRoundedIcon from '@mui/icons-material/MailOutlineRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';

import DoctorRouteGuard from '@/components/DoctorRouteGuard';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import globalCache from '@/lib/cache';

function isActivePath(pathname, href) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  return pathname.startsWith(href + '/');
}

const ROUTE_META = [
  {
    match: (p) => p === '/',
    ar: { title: 'لوحة القيادة الإكلينيكية والإدارية', subtitle: 'متابعة حية للمواعيد، المرضى، التقارير، وإيرادات العيادة' },
    en: { title: 'Clinical & Executive Dashboard', subtitle: 'Live overview of appointments, patients, reports & daily revenue' },
  },
  {
    match: (p) => p.startsWith('/appointments/new'),
    ar: { title: 'حجز موعد جديد', subtitle: 'إضافة موعد جديد وتحديد نوع الزيارة والمريض' },
    en: { title: 'New Appointment', subtitle: 'Schedule a new patient visit and consultation type' },
  },
  {
    match: (p) => p.startsWith('/appointments/history'),
    ar: { title: 'سجل المواعيد السابقة', subtitle: 'أرشيف كامل لجميع الحجوزات والزيارات المكتملة' },
    en: { title: 'Appointments History', subtitle: 'Complete archive of previous visits and bookings' },
  },
  {
    match: (p) => p.startsWith('/appointments'),
    ar: { title: 'جدول المواعيد والحجوزات', subtitle: 'إدارة مواعيد اليوم، التأكيدات، وحالات الحضور' },
    en: { title: 'Appointments Schedule', subtitle: 'Manage today’s bookings, confirmations, and visit status' },
  },
  {
    match: (p) => p.startsWith('/patients'),
    ar: { title: 'سجلات المرضى والملفات الطبية', subtitle: 'استعراض وإدارة بيانات المرضى والتاريخ المرضي' },
    en: { title: 'Patients & Medical Records', subtitle: 'Browse and manage patient profiles and medical history' },
  },
  {
    match: (p) => p.startsWith('/patient-reports'),
    ar: { title: 'التقارير الطبية والوصفات', subtitle: 'إنشاء ومراجعة التقارير السريرية والروشتات' },
    en: { title: 'Medical Reports & Prescriptions', subtitle: 'Create and review clinical reports and prescriptions' },
  },
  {
    match: (p) => p.startsWith('/ask-shafy'),
    ar: { title: 'المساعد الطبي الذكي شافي AI', subtitle: 'استشارات ذكية وتحليل فوري لبيانات العيادة والمرضى' },
    en: { title: 'Shafy AI Clinical Copilot', subtitle: 'Intelligent medical insights across patients & schedules' },
  },
  {
    match: (p) => p.startsWith('/clinic-reports'),
    ar: { title: 'تقارير وإحصائيات العيادة', subtitle: 'تحليل الأداء والإيرادات ومؤشرات النمو' },
    en: { title: 'Clinic Analytics & Reports', subtitle: 'Performance metrics, revenue trends, and clinic KPIs' },
  },
  {
    match: (p) => p.startsWith('/finance'),
    ar: { title: 'الإدارة المالية اليومية', subtitle: 'متابعة الإيرادات، الكشوفات، والخدمات الإضافية' },
    en: { title: 'Daily Clinic Finance', subtitle: 'Track daily income, consultations, and extra fees' },
  },
  {
    match: (p) => p.startsWith('/labs'),
    ar: { title: 'المختبرات والفحوصات', subtitle: 'إدارة المعامل الشريكة وطلبات التحاليل' },
    en: { title: 'Partner Labs & Diagnostics', subtitle: 'Manage linked laboratories and diagnostic orders' },
  },
  {
    match: (p) => p.startsWith('/pharmacies'),
    ar: { title: 'الصيدليات المرتبطة', subtitle: 'إدارة الصيدليات الشريكة والوصفات الدوائية' },
    en: { title: 'Linked Pharmacies', subtitle: 'Manage partner pharmacies and prescriptions' },
  },
  {
    match: (p) => p.startsWith('/marketing'),
    ar: { title: 'التسويق والمحتوى الطبي', subtitle: 'إدارة المقالات والإنفوجرافيك وحضورك الرقمي' },
    en: { title: 'Medical Marketing & Content', subtitle: 'Publish articles, infographics, and grow your clinic' },
  },
  {
    match: (p) => p.startsWith('/messages'),
    ar: { title: 'الرسائل والمحادثات', subtitle: 'التواصل المباشر مع المرضى واستفساراتهم' },
    en: { title: 'Messages & Inbox', subtitle: 'Direct communication with your patients' },
  },
  {
    match: (p) => p.startsWith('/notifications'),
    ar: { title: 'الإشعارات والتنبيهات', subtitle: 'آخر التحديثات والحجوزات والتنبيهات الفورية' },
    en: { title: 'Notifications & Alerts', subtitle: 'Latest bookings, updates, and live alerts' },
  },
  {
    match: (p) => p.startsWith('/profile') || p.startsWith('/doctor'),
    ar: { title: 'الملف المهني والعيادة', subtitle: 'تحديث بيانات الطبيب، التخصص، ومواعيد العمل' },
    en: { title: 'Doctor Profile & Clinic', subtitle: 'Manage credentials, clinic details, and working hours' },
  },
  {
    match: (p) => p.startsWith('/more') || p.startsWith('/settings') || p.startsWith('/support') || p.startsWith('/about') || p.startsWith('/feedback') || p.startsWith('/data'),
    ar: { title: 'المزيد والإعدادات', subtitle: 'الحساب، الشبكة الطبية، الدعم، والخصوصية' },
    en: { title: 'More & Settings', subtitle: 'Account, clinical network, support, and privacy' },
  },
];

export default function AppLayout({
  children,
  title,
  subtitle,
  disableTopBar = false,
  logoSrc = '/logo.png',
  unread,
  showBackOnMobile = false,
}) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const pathname = (router?.asPath || '/').split('?')[0] || '/';
  const liveUnread = useUnreadCounts();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [doctorProfile, setDoctorProfile] = React.useState(() => globalCache.doctorProfile || null);

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  // Auto-close mobile drawer on route change
  React.useEffect(() => {
    const handleRouteChange = () => setMobileOpen(false);
    router.events?.on?.('routeChangeComplete', handleRouteChange);
    return () => {
      router.events?.off?.('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  // Load & cache doctor profile for sidebar pill
  React.useEffect(() => {
    if (!user?.uid) return;
    if (globalCache.doctorProfile && globalCache.doctorProfile._uid === user.uid) {
      setDoctorProfile(globalCache.doctorProfile);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'doctors', user.uid));
        if (!cancelled && snap.exists()) {
          const data = { _uid: user.uid, ...snap.data() };
          globalCache.doctorProfile = data;
          setDoctorProfile(data);
        }
      } catch (e) {
        console.warn('Sidebar profile load skipped:', e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid]);

  const withLang = React.useCallback(
    (href) => {
      const langVal = isArabic ? 'ar' : 'en';
      return `${href}${href.includes('?') ? '&' : '?'}lang=${langVal}`;
    },
    [isArabic]
  );

  const safeNavigate = async (pname, queryObj, opts) => {
    const qs = new URLSearchParams(
      Object.entries(queryObj || {}).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    const target = qs ? `${pname}?${qs}` : pname;
    if (decodeURIComponent(router.asPath) === target) return;
    try {
      await router.push({ pathname: pname, query: queryObj }, undefined, opts);
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (msg.includes('Invariant: attempted to hard navigate to the same URL')) return;
      throw err;
    }
  };

  const toggleLang = () => {
    const nextLang = isArabic ? 'en' : 'ar';
    const q = { ...router.query, lang: nextLang };
    safeNavigate(pathname || '/', q, { shallow: true });
  };

  const doLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    try { await signOut(); } catch {}
    globalCache.clear();
    const q = { lang: isArabic ? 'ar' : 'en' };
    await router.replace({ pathname: '/login', query: q });
  };

  const effectiveUnread = {
    notifications: unread?.notifications ?? liveUnread.notifications ?? 0,
    messages: unread?.messages ?? liveUnread.messages ?? 0,
  };

  // Resolve header title & subtitle
  const matchedMeta = React.useMemo(() => {
    const found = ROUTE_META.find((m) => m.match(pathname));
    if (!found) {
      return isArabic
        ? { title: 'بوابة الطبيب شافي', subtitle: 'إدارة العيادة والمرضى بكفاءة عالية' }
        : { title: 'Shafy Doctor Portal', subtitle: 'Intelligent clinic & patient management' };
    }
    return isArabic ? found.ar : found.en;
  }, [pathname, isArabic]);

  const resolvedTitle = title || matchedMeta.title;
  const resolvedSubtitle = subtitle ?? matchedMeta.subtitle;

  const doctorDisplayName = React.useMemo(() => {
    if (doctorProfile) {
      const raw = isArabic
        ? doctorProfile.name_ar || doctorProfile.name_en || doctorProfile.name
        : doctorProfile.name_en || doctorProfile.name_ar || doctorProfile.name;
      if (raw) {
        const clean = String(raw).trim();
        const hasPrefix = /^(د\.|د |dr\.|dr )/i.test(clean);
        return hasPrefix ? clean : `${isArabic ? 'د.' : 'Dr.'} ${clean}`;
      }
    }
    return isArabic ? 'د. طبيب شافي' : 'Dr. Shafy';
  }, [doctorProfile, isArabic]);

  const clinicSubtitle = React.useMemo(() => {
    if (doctorProfile) {
      return (
        (isArabic
          ? doctorProfile.specialty_ar || doctorProfile.clinicName_ar || doctorProfile.specialty
          : doctorProfile.specialty_en || doctorProfile.clinicName_en || doctorProfile.specialty) ||
        (isArabic ? 'عيادة شافي الطبية' : 'Shafy Medical Clinic')
      );
    }
    return isArabic ? 'عيادة شافي الطبية' : 'Shafy Medical Clinic';
  }, [doctorProfile, isArabic]);

  const doctorAvatarUrl =
    doctorProfile?.profileImage ||
    doctorProfile?.photoUrl ||
    doctorProfile?.photoURL ||
    doctorProfile?.imageUrl ||
    doctorProfile?.avatar ||
    null;

  const doctorInitial = React.useMemo(() => {
    const raw = (doctorProfile?.name_ar || doctorProfile?.name_en || doctorProfile?.name || user?.email || 'S')
      .replace(/^(د\.|د |dr\.|dr )/i, '')
      .trim();
    return (raw[0] || (isArabic ? 'د' : 'D')).toUpperCase();
  }, [doctorProfile, user, isArabic]);

  const primaryMenu = React.useMemo(
    () => [
      { label: isArabic ? 'لوحة القيادة الإكلينيكية' : 'Clinical Dashboard', href: '/', icon: SpaceDashboardRoundedIcon },
      { label: isArabic ? 'المواعيد والحجوزات' : 'Appointments', href: '/appointments', icon: CalendarMonthRoundedIcon },
      { label: isArabic ? 'سجلات المرضى' : 'Patients Roster', href: '/patients', icon: PeopleAltRoundedIcon },
      { label: isArabic ? 'التقارير الطبية' : 'Medical Reports', href: '/patient-reports', icon: DescriptionRoundedIcon },
      { label: isArabic ? 'المساعد الذكي شافي AI' : 'Ask Shafy AI', href: '/ask-shafy', icon: AutoAwesomeRoundedIcon, featured: true },
    ],
    [isArabic]
  );

  const secondaryMenu = React.useMemo(
    () => [
      { label: isArabic ? 'إحصائيات وتقارير العيادة' : 'Clinic Analytics', href: '/clinic-reports', icon: BarChartRoundedIcon },
      { label: isArabic ? 'المالية اليومية' : 'Daily Finance', href: '/finance/daily', icon: AccountBalanceWalletRoundedIcon },
      { label: isArabic ? 'المختبرات والفحوصات' : 'Labs & Tests', href: '/labs', icon: BiotechRoundedIcon },
      { label: isArabic ? 'التسويق والمقالات' : 'Marketing & Blog', href: '/marketing', icon: CampaignRoundedIcon },
      { label: isArabic ? 'الرسائل' : 'Messages', href: '/messages', icon: MailOutlineRoundedIcon, badge: effectiveUnread.messages },
      { label: isArabic ? 'الإشعارات' : 'Notifications', href: '/notifications', icon: NotificationsNoneRoundedIcon, badge: effectiveUnread.notifications },
      { label: isArabic ? 'الملف الشخصي والعيادة' : 'Profile & Clinic', href: '/profile', icon: AccountCircleRoundedIcon },
      { label: isArabic ? 'المزيد والإعدادات' : 'More & Settings', href: '/more', icon: GridViewRoundedIcon },
    ],
    [isArabic, effectiveUnread.messages, effectiveUnread.notifications]
  );

  const renderNavItem = (item) => {
    const active = isActivePath(pathname, item.href);
    const Icon = item.icon;
    return (
      <li key={item.href} style={{ marginBottom: '4px' }}>
        <Link
          href={withLang(item.href)}
          onClick={() => setMobileOpen(false)}
          className={`sidebar-nav-link ${active ? 'active' : ''} ${item.featured ? 'ai-featured' : ''}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
            <Icon
              sx={{
                fontSize: 20,
                color: active ? '#1d4ed8' : item.featured ? '#2563eb' : '#64748b',
                flexShrink: 0,
              }}
            />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.label}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {item.featured && !active && (
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 900,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                  color: '#ffffff',
                  letterSpacing: '0.02em',
                }}
              >
                AI
              </span>
            )}
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 900,
                  minWidth: '20px',
                  height: '20px',
                  padding: '0 6px',
                  borderRadius: '999px',
                  background: '#ef4444',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {active && (
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                  boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.2)',
                }}
              />
            )}
          </div>
        </Link>
      </li>
    );
  };

  const LayoutContent = (
    <Box
      dir={isArabic ? 'rtl' : 'ltr'}
      className="shafy-shell shafy-canvas"
      sx={{ textAlign: isArabic ? 'right' : 'left' }}
    >
      <Head>
        <title>{`${resolvedTitle} | Shafy Doctor`}</title>
      </Head>

      {/* Mobile Drawer Backdrop */}
      <div
        className={`mobile-backdrop ${mobileOpen ? 'show' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Persistent Desktop Sidebar / Mobile Slide-over Drawer */}
      <aside className={`sidebar-desktop ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand Header */}
        <div style={{ padding: '18px 18px 16px', borderBottom: '1px solid rgba(226, 232, 240, 0.75)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <Link
              href={withLang('/')}
              onClick={() => setMobileOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', textDecoration: 'none' }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 18px -4px rgba(37, 99, 235, 0.28)',
                  overflow: 'hidden',
                  border: '1.5px solid #bfdbfe',
                  flexShrink: 0,
                }}
              >
                <img
                  src={logoSrc || '/logo.png'}
                  alt="Shafy Doctor"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '1.06rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                  }}
                >
                  {isArabic ? 'شافي للطبيب' : 'Shafy Doctor'}
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {isArabic ? 'البوابة الإكلينيكية الذكية' : 'Smart Clinical Portal'}
                </span>
              </div>
            </Link>

            <button
              type="button"
              className="mobile-menu-close-btn"
              onClick={() => setMobileOpen(false)}
              aria-label={isArabic ? 'إغلاق القائمة' : 'Close menu'}
            >
              <CloseRoundedIcon sx={{ fontSize: 20 }} />
            </button>
          </div>
        </div>

        {/* Doctor Profile Pill in Sidebar */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(226, 232, 240, 0.7)' }}>
          <Link
            href={withLang('/profile')}
            onClick={() => setMobileOpen(false)}
            style={{
              padding: '12px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%)',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textDecoration: 'none',
              boxShadow: '0 4px 14px -6px rgba(37, 99, 235, 0.2)',
              transition: 'transform 0.2s ease',
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '13px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 60%, #4f46e5 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '1.05rem',
                flexShrink: 0,
                overflow: 'hidden',
                border: '2px solid #93c5fd',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              {doctorAvatarUrl ? (
                <img
                  src={doctorAvatarUrl}
                  alt={doctorDisplayName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span>{doctorInitial}</span>
              )}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div
                style={{
                  fontSize: '0.86rem',
                  fontWeight: 900,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {doctorDisplayName}
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#2563eb',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {clinicSubtitle}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.66rem',
                  color: '#059669',
                  fontWeight: 800,
                  marginTop: '2px',
                }}
              >
                <VerifiedRoundedIcon sx={{ fontSize: 13 }} />
                <span>{isArabic ? 'طبيب معتمد بشافي' : 'Verified Shafy Doctor'}</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, padding: '12px 12px 16px', overflowY: 'auto' }}>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '4px 12px 8px',
            }}
          >
            {isArabic ? 'الإدارة الإكلينيكية' : 'Clinical Core'}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px 0' }}>
            {primaryMenu.map(renderNavItem)}
          </ul>

          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '4px 12px 8px',
              borderTop: '1px solid rgba(226, 232, 240, 0.7)',
              paddingTop: '12px',
            }}
          >
            {isArabic ? 'العيادة والأدوات' : 'Clinic & Tools'}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {secondaryMenu.map(renderNavItem)}
          </ul>
        </nav>

        {/* Sidebar Footer: Logout */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid rgba(226, 232, 240, 0.75)' }}>
          <button
            type="button"
            onClick={doLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '13px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#b91c1c',
              fontWeight: 800,
              fontSize: '0.86rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
          >
            <LogoutRoundedIcon sx={{ fontSize: 18 }} />
            <span>{isArabic ? 'تسجيل الخروج' : 'Sign Out'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="main-content-wrapper">
        {/* Sticky Frosted Header Bar */}
        {!disableTopBar && (
          <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <button
                type="button"
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(true)}
                aria-label={isArabic ? 'القائمة الرئيسية' : 'Open menu'}
              >
                <MenuRoundedIcon sx={{ fontSize: 22 }} />
              </button>

              {showBackOnMobile && (
                <button
                  type="button"
                  className="mobile-menu-btn"
                  onClick={() => router.back()}
                  aria-label={isArabic ? 'رجوع' : 'Back'}
                >
                  <ArrowBackIosNewRoundedIcon sx={{ fontSize: 17 }} />
                </button>
              )}

              <div style={{ minWidth: 0 }}>
                <h1
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    lineHeight: 1.2,
                    margin: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {resolvedTitle}
                </h1>
                {resolvedSubtitle && (
                  <p
                    className="app-header-subtitle"
                    style={{
                      fontSize: '0.78rem',
                      color: '#64748b',
                      fontWeight: 600,
                      marginTop: '2px',
                      marginBottom: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {resolvedSubtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Header Right Actions Cluster */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
              {/* Language Switch Pill */}
              <button
                type="button"
                onClick={toggleLang}
                title={isArabic ? 'Switch to English' : 'التبديل للعربية'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                <TranslateRoundedIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                <span>{isArabic ? 'EN' : 'AR'}</span>
              </button>

              {/* Messages Icon */}
              <Link
                href={withLang('/messages')}
                className="header-icon-btn"
                aria-label={isArabic ? 'الرسائل' : 'Messages'}
              >
                <Badge color="error" badgeContent={effectiveUnread.messages} max={99}>
                  <MailOutlineRoundedIcon sx={{ fontSize: 20 }} />
                </Badge>
              </Link>

              {/* Notifications Icon */}
              <Link
                href={withLang('/notifications')}
                className="header-icon-btn"
                aria-label={isArabic ? 'الإشعارات' : 'Notifications'}
              >
                <Badge color="error" badgeContent={effectiveUnread.notifications} max={99}>
                  <NotificationsNoneRoundedIcon sx={{ fontSize: 20 }} />
                </Badge>
              </Link>

              {/* Clinic Pill Badge */}
              <Link
                href={withLang('/profile')}
                className="header-clinic-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.8rem',
                  color: '#1d4ed8',
                  fontWeight: 800,
                  textDecoration: 'none',
                }}
              >
                <img
                  src={logoSrc || '/logo.png'}
                  alt="Shafy"
                  style={{ width: '22px', height: '22px', objectFit: 'contain', borderRadius: '6px', background: '#ffffff' }}
                />
                <span style={{ maxWidth: '135px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doctorDisplayName}
                </span>
              </Link>

              {/* Quick CTA Button */}
              <Link
                href={withLang('/appointments/new')}
                className="btn btn-primary"
                style={{ height: '40px', padding: '0 15px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              >
                <AddCircleRoundedIcon sx={{ fontSize: 17 }} />
                <span>{isArabic ? 'موعد جديد' : 'New Visit'}</span>
              </Link>
            </div>
          </header>
        )}

        {/* Page Body */}
        <main className="app-main">
          <div style={{ maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="mobile-bottom-nav">
          <div className="mobile-bottom-nav-inner">
            <Link
              href={withLang('/')}
              className={`mobile-nav-item ${isActivePath(pathname, '/') ? 'active' : ''}`}
            >
              <SpaceDashboardRoundedIcon sx={{ fontSize: 21 }} />
              <span>{isArabic ? 'الرئيسية' : 'Home'}</span>
            </Link>

            <Link
              href={withLang('/appointments')}
              className={`mobile-nav-item ${isActivePath(pathname, '/appointments') ? 'active' : ''}`}
            >
              <CalendarMonthRoundedIcon sx={{ fontSize: 21 }} />
              <span>{isArabic ? 'المواعيد' : 'Visits'}</span>
            </Link>

            <Link
              href={withLang('/ask-shafy')}
              className={`mobile-nav-item ${isActivePath(pathname, '/ask-shafy') ? 'active' : ''}`}
              style={{
                background: isActivePath(pathname, '/ask-shafy')
                  ? 'linear-gradient(135deg, #2563eb, #4f46e5)'
                  : '#eff6ff',
                color: isActivePath(pathname, '/ask-shafy') ? '#ffffff' : '#1d4ed8',
                border: '1px solid #bfdbfe',
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 21 }} />
              <span>{isArabic ? 'شافي AI' : 'Shafy AI'}</span>
            </Link>

            <Link
              href={withLang('/patients')}
              className={`mobile-nav-item ${isActivePath(pathname, '/patients') ? 'active' : ''}`}
            >
              <PeopleAltRoundedIcon sx={{ fontSize: 21 }} />
              <span>{isArabic ? 'المرضى' : 'Patients'}</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="mobile-nav-item"
            >
              <MenuRoundedIcon sx={{ fontSize: 21 }} />
              <span>{isArabic ? 'المزيد' : 'More'}</span>
            </button>
          </div>
        </nav>
      </div>
    </Box>
  );

  return <DoctorRouteGuard>{LayoutContent}</DoctorRouteGuard>;
}
