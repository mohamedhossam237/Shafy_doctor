// /components/AppLayout.jsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Box, Paper, BottomNavigation, BottomNavigationAction, AppBar, Toolbar, IconButton,
  Badge, Avatar, Menu, MenuItem, ListItemIcon,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';

import AppTopBar from '@/components/AppTopBar';

import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection, query, where, onSnapshot, limit as qLimit, collectionGroup,
  // ⬇️ add these for the role gate
  doc, getDoc, getDocs,
} from 'firebase/firestore';

const MOBILE_NAV_H = 64;
const MOBILE_TOP_H = 56;

const pulseAnimation = {
  animation: 'pulse 2.25s infinite ease-in-out',
  '@keyframes pulse': {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.18)' },
    '100%': { transform: 'scale(1)' },
  },
};

const NAV_EN = [
  { label: 'Dashboard',    href: '/',             icon: <SpaceDashboardIcon /> },
  { label: 'Appointments', href: '/appointments', icon: <CalendarMonthIcon /> },
  {
    label: 'Ask Shafy',
    href: '/ask-shafy',
    icon: (
      <Box component="img" src="/Ai_logo.png" alt="Ask Shafy"
           sx={{ width: 40, height: 40, objectFit: 'contain', transition: 'transform 0.3s ease-in-out',
                 '&:hover': { transform: 'scale(1.25)' }, ...pulseAnimation }} />
    ),
  },
  { label: 'Patients', href: '/patients', icon: <PeopleAltIcon /> },
  { label: 'More',     href: '/more',     icon: <MenuIcon /> },
];

const NAV_AR = [
  { label: 'لوحة التحكم', href: '/',             icon: <SpaceDashboardIcon /> },
  { label: 'المواعيد',    href: '/appointments', icon: <CalendarMonthIcon /> },
  { label: 'اسأل شافي',   href: '/ask-shafy',
    icon: (
      <Box component="img" src="/Ai_logo.png" alt="اسأل شافي"
           sx={{ width: 40, height: 40, objectFit: 'contain', transition: 'transform 0.3s ease-in-out',
                 '&:hover': { transform: 'scale(1.25)' }, ...pulseAnimation }} />
    ),
  },
  { label: 'المرضى', href: '/patients', icon: <PeopleAltIcon /> },
  { label: 'المزيد', href: '/more',     icon: <MenuIcon /> },
];

function isActive(pathname, href) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  return pathname.startsWith(href + '/');
}

export default function AppLayout({
  children,
  navItems,
  maxWidth = 'lg',
  disableTopBar = false,
  logoSrc = '/logo.png',
  unread,                        // ← NO DEFAULT HERE
  showBackOnMobile = false,
}) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const router = useRouter();
  const pathname = (router?.asPath || '').split('?')[0];
  const { user } = useAuth();

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar)   return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const computedNav = React.useMemo(() => (isArabic ? NAV_AR : NAV_EN), [isArabic]);
  const effectiveNav = navItems ?? computedNav;

  const activeIndex = React.useMemo(() => {
    const idx = effectiveNav.findIndex((it) => isActive(pathname, it.href));
    return idx >= 0 ? idx : 0;
  }, [pathname, effectiveNav]);

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
  const onBottomChange = (_e, newIndex) => {
    const dest = effectiveNav[newIndex]?.href;
    if (!dest) return;
    const q = { ...router.query, lang: isArabic ? 'ar' : 'en' };
    safeNavigate(dest, q, { shallow: true });
  };
  const go = (href) => {
    const q = { ...router.query, lang: isArabic ? 'ar' : 'en' };
    safeNavigate(href, q, { shallow: true });
  };
  const toggleLang = () => {
    const nextLang = isArabic ? 'en' : 'ar';
    const q = { ...router.query, lang: nextLang };
    safeNavigate(pathname || '/', q, { shallow: true });
  };
  const doLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    const q = { ...router.query, lang: isArabic ? 'ar' : 'en' };
    await router.replace({ pathname: '/login', query: q });
  };

  /* ========= ROLE GATE: doctor-only =========
     If the current session is not a doctor, logout and push to /login.
     Checks doctors by uid, then falls back to email. */
  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // If there is no session yet, nothing to gate.
      if (!user?.uid) return;

      const uid = user.uid;
      const email = (user.email || '').toLowerCase();

      try {
        // Check doctors/{uid}
        const byUid = await getDoc(doc(db, 'doctors', uid));
        let isDoctor = byUid.exists();

        // Fallback: doctors where email == user.email
        if (!isDoctor && email) {
          const snap = await getDocs(
            query(collection(db, 'doctors'), where('email', '==', email), qLimit(1))
          );
          isDoctor = !snap.empty;
        }

        if (!isDoctor && !cancelled) {
          await doLogout(); // logs out + redirects to /login with lang
        }
      } catch {
        if (!cancelled) {
          await doLogout();
        }
      }
    };
    run();
    return () => { cancelled = true; };
    // Re-check when uid or email changes
  }, [user?.uid, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  // ======== LIVE UNREAD COUNTS ========
  const [liveUnread, setLiveUnread] = React.useState({ notifications: 0, messages: 0 });

  // messages: sum unreadCounts[uid]
  React.useEffect(() => {
    if (!user?.uid) { setLiveUnread((u) => ({ ...u, messages: 0 })); return; }
    const qRef = query(
      collection(db, 'messages_threads'),
      where('participants', 'array-contains', user.uid),
      qLimit(500)
    );
    const unsub = onSnapshot(qRef, (snap) => {
      let total = 0;
      snap.forEach((d) => {
        const counts = (d.data() || {}).unreadCounts || {};
        const n = Number(counts[user.uid] || 0);
        if (!Number.isNaN(n)) total += n;
      });
      setLiveUnread((u) => ({ ...u, messages: total }));
    }, () => setLiveUnread((u) => ({ ...u, messages: 0 })));
    return () => unsub();
  }, [user?.uid]);

  // notifications: any 'notifications' subcollection, match current user & unread
  const pathTargetsUser = (docRef, uid) => {
    const p = String(docRef?.path || '');
    return new RegExp(`/(doctors|users|patients|profiles)/${uid}/notifications/`, 'i').test(p);
  };

  React.useEffect(() => {
    if (!user?.uid) { setLiveUnread((u) => ({ ...u, notifications: 0 })); return; }
    const cgRef = collectionGroup(db, 'notifications');
    const unsub = onSnapshot(cgRef, (snap) => {
      let total = 0;
      snap.forEach((d) => {
        const n = d.data() || {};
        const isRead = (typeof n.read === 'boolean' ? n.read : n.isRead) === true;
        const recipientMatch =
          [
            'userUID','userId','doctorUID','doctorId','uid','toUID','toId',
            'recipientUID','recipientId','ownerUID','ownerId',
          ].some((k) => String(n?.[k] || '') === user.uid) || pathTargetsUser(d.ref, user.uid);
        if (!isRead && recipientMatch) total += 1;
      });
      setLiveUnread((u) => ({ ...u, notifications: total }));
    }, () => setLiveUnread((u) => ({ ...u, notifications: 0 })));
    return () => unsub();
  }, [user?.uid]);

  // ✅ use nullish coalescing so live values win unless parent explicitly passes a number
  const effectiveUnread = {
    notifications: unread?.notifications ?? liveUnread.notifications,
    messages: unread?.messages ?? liveUnread.messages,
  };

  // mobile profile menu
  const [anchorEl, setAnchorEl] = React.useState(null);
  const menuOpen = Boolean(anchorEl);
  const openMenu = (e) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  return (
    <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop top bar */}
      {!disableTopBar && isMdUp && (
        <AppTopBar
          key={`top-${effectiveUnread.messages}-${effectiveUnread.notifications}`}
          navItems={effectiveNav}
          logoSrc={logoSrc}
          unreadMessages={effectiveUnread.messages}
          unreadNotifications={effectiveUnread.notifications}
          onNavClick={(href) => go(href)}
          onLangToggle={toggleLang}
          onLogout={doLogout}
          onOpenProfile={() => go('/profile')}
          showBuiltInBadges
        />
      )}

      {/* Mobile top bar */}
      {!disableTopBar && !isMdUp && (
        <AppBar position="fixed" elevation={0} color="inherit"
          sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}`, bgcolor: 'background.paper' }}>
          <Toolbar sx={{ minHeight: MOBILE_TOP_H, gap: 0.5 }}>
            {/* ✅ Logo is now clickable → goes to '/' while keeping current lang */}
            <IconButton
              aria-label={isArabic ? 'الرئيسية' : 'Home'}
              onClick={() => go('/')}
              edge="start"
              sx={{ p: 0.25 }}
            >
              <Box
                component="img"
                src={logoSrc || '/logo.png'}
                alt="Shafy"
                sx={{
                  height: 44,
                  width: 'auto',
                  display: 'block',
                  transform: 'scale(1.35)',
                  transformOrigin: 'center',
                }}
              />
            </IconButton>

            {showBackOnMobile && (
              <IconButton edge="start" onClick={() => router.back()} aria-label={isArabic ? 'رجوع' : 'Back'}>
                <ArrowBackIosNewIcon />
              </IconButton>
            )}
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton aria-label={isArabic ? 'الرسائل' : 'Messages'} onClick={() => go('/messages')}>
                <Badge color="error" badgeContent={effectiveUnread.messages} max={99}>
                  <MailOutlineIcon />
                </Badge>
              </IconButton>
              <IconButton aria-label={isArabic ? 'الإشعارات' : 'Notifications'} onClick={() => go('/notifications')}>
                <Badge color="error" badgeContent={effectiveUnread.notifications} max={99}>
                  <NotificationsNoneIcon />
                </Badge>
              </IconButton>
              <IconButton aria-label={isArabic ? 'الحساب' : 'Account'} onClick={openMenu} size="small">
                <Avatar sx={{ width: 30, height: 30 }}>
                  <PersonIcon fontSize="small" />
                </Avatar>
              </IconButton>
            </Box>
            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={closeMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: isArabic ? 'left' : 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: isArabic ? 'left' : 'right' }}
            >
              <MenuItem onClick={() => { closeMenu(); toggleLang(); }}>
                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                {isArabic ? 'EN' : 'AR'}
              </MenuItem>
              <MenuItem onClick={() => { closeMenu(); go('/account/profile'); }}>
                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                {isArabic ? 'الملف الشخصي' : 'Profile'}
              </MenuItem>
              <MenuItem onClick={() => { closeMenu(); doLogout(); }}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                {isArabic ? 'تسجيل الخروج' : 'Logout'}
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
      )}

      {/* Main content */}
      <Box component="main"
           sx={{ px: { xs: 2, md: 3 }, pt: { xs: disableTopBar || isMdUp ? 2 : `${MOBILE_TOP_H + 8}px`, md: 10 },
                 pb: { xs: `${MOBILE_NAV_H + 8}px`, md: 3 }, maxWidth, mx: 'auto', width: '100%' }}>
        {children}
      </Box>

      {/* Mobile bottom nav */}
      {!isMdUp && (
        <Paper elevation={3}
               sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.appBar,
                     borderTop: (t) => `1px solid ${t.palette.divider}` }}>
          <BottomNavigation value={activeIndex} onChange={onBottomChange} showLabels
                            sx={{ height: MOBILE_NAV_H,
                                  '.MuiBottomNavigationAction-root': { flexDirection: isArabic ? 'row-reverse' : 'column' } }}>
            {effectiveNav.map((it) => (
              <BottomNavigationAction key={it.href} label={it.label} icon={it.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
