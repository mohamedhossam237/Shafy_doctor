// /components/AppLayout.jsx
'use client';
import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  Box,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  AppBar,
  Toolbar,
  IconButton,
  Badge,
  Typography,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
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

const MOBILE_NAV_H = 64;
const MOBILE_TOP_H = 56; // default MUI toolbar height (mobile)

/** Subtle pulse animation + desktop hover for the Ask Shafy icon */
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
      <Box
        component="img"
        src="/Ai_logo.png"
        alt="Ask Shafy"
        sx={{
          width: 40,
          height: 40,
          objectFit: 'contain',
          transition: 'transform 0.3s ease-in-out',
          '&:hover': { transform: 'scale(1.25)' },  // desktop hover
          ...pulseAnimation,                          // gentle pulse (mobile + desktop)
        }}
      />
    ),
  },
  { label: 'Patients', href: '/patients', icon: <PeopleAltIcon /> },
  { label: 'More',     href: '/more',     icon: <MenuIcon /> },
];

const NAV_AR = [
  { label: 'لوحة التحكم', href: '/',             icon: <SpaceDashboardIcon /> },
  { label: 'المواعيد',    href: '/appointments', icon: <CalendarMonthIcon /> },
  {
    label: 'اسأل شافي',
    href: '/ask-shafy',
    icon: (
      <Box
        component="img"
        src="/Ai_logo.png"
        alt="اسأل شافي"
        sx={{
          width: 40,
          height: 40,
          objectFit: 'contain',
          transition: 'transform 0.3s ease-in-out',
          '&:hover': { transform: 'scale(1.25)' },
          ...pulseAnimation,
        }}
      />
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
  unread = { notifications: 0, messages: 0 },
  showBackOnMobile = false,
}) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const router = useRouter();
  const pathname = (router?.asPath || '').split('?')[0];

  // Default = Arabic if not explicitly set to EN
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

  // ---------- Safe navigation helpers ----------
  const buildHref = (pname, queryObj) => {
    const qs = new URLSearchParams(
      Object.entries(queryObj || {}).filter(([, v]) => v !== undefined && v !== '')
    ).toString();
    return qs ? `${pname}?${qs}` : pname;
  };
  const safeNavigate = async (pname, queryObj, opts) => {
    const target = buildHref(pname, queryObj);
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

  // ---------- Language toggle ----------
  const toggleLang = () => {
    const nextLang = isArabic ? 'en' : 'ar';
    const q = { ...router.query, lang: nextLang };
    safeNavigate(pathname || '/', q, { shallow: true });
  };

  // ---------- Profile menu (desktop & mobile) ----------
  const [anchorEl, setAnchorEl] = React.useState(null);
  const menuOpen = Boolean(anchorEl);
  const openMenu = (e) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  const openPatientProfile = () => {
    closeMenu();
    const q = { ...router.query, lang: isArabic ? 'ar' : 'en', role: 'patient' };
    safeNavigate('/account/profile', q, { shallow: false });
  };

  const doLogout = async () => {
    closeMenu();
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    router.replace('/login');
  };

  // Desktop actions (injected into AppTopBar)
  const desktopActions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {/* Language */}
      <Typography
        component="button"
        onClick={toggleLang}
        style={{ all: 'unset', cursor: 'pointer' }}
        aria-label={isArabic ? 'تبديل اللغة' : 'Toggle language'}
      >
        <Box
          sx={{
            border: (t) => `1px solid ${t.palette.primary.main}`,
            color: 'primary.main',
            px: 1.25,
            py: 0.25,
            borderRadius: 1,
            fontWeight: 600,
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          {isArabic ? 'EN' : 'AR'}
        </Box>
      </Typography>

      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

      {/* Messages & Notifications */}
      <IconButton onClick={() => go('/messages')} aria-label={isArabic ? 'الرسائل' : 'Messages'}>
        <Badge color="error" badgeContent={unread?.messages || 0} max={99}>
          <MailOutlineIcon />
        </Badge>
      </IconButton>
      <IconButton onClick={() => go('/notifications')} aria-label={isArabic ? 'الإشعارات' : 'Notifications'}>
        <Badge color="error" badgeContent={unread?.notifications || 0} max={99}>
          <NotificationsNoneIcon />
        </Badge>
      </IconButton>

      {/* Profile avatar */}
      <IconButton aria-label={isArabic ? 'الحساب' : 'Account'} onClick={openMenu} size="small">
        <Avatar sx={{ width: 32, height: 32 }}>
          <PersonIcon fontSize="small" />
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={closeMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: isArabic ? 'left' : 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: isArabic ? 'left' : 'right' }}
      >
        <MenuItem onClick={openPatientProfile}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          {isArabic ? 'فتح الملف (كمريض)' : 'Open Profile (Patient)'}
        </MenuItem>
        {/* Dynamic language label: EN if Arabic, AR if English */}
        <MenuItem onClick={toggleLang}>
          <ListItemIcon>
            <Box sx={{
              border: (t) => `1px solid ${t.palette.primary.main}`,
              px: 1, py: 0.25, borderRadius: 0.75, fontWeight: 700,
              minWidth: 28, textAlign: 'center',
            }}>
              {isArabic ? 'EN' : 'AR'}
            </Box>
          </ListItemIcon>
          {isArabic ? 'الإنجليزية' : 'Arabic'}
        </MenuItem>
        <MenuItem onClick={doLogout}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          {isArabic ? 'تسجيل الخروج' : 'Logout'}
        </MenuItem>
      </Menu>
    </Box>
  );

  return (
    <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop top bar */}
      {!disableTopBar && isMdUp && (
        <AppTopBar navItems={effectiveNav} actionsSlot={desktopActions} hideLang />
      )}

      {/* Mobile top bar: LOGO ALWAYS AT BEGINNING (inline-start) */}
      {!disableTopBar && !isMdUp && (
        <AppBar
          position="fixed"
          elevation={0}
          color="inherit"
          sx={{
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
            bgcolor: 'background.paper',
          }}
        >
          <Toolbar sx={{ minHeight: MOBILE_TOP_H, gap: 0.5 }}>
            {/* Logo at inline-start (beginning) */}
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

            {/* Optional Back next to logo (logo remains first) */}
            {showBackOnMobile && (
              <IconButton
                edge="start"
                onClick={() => router.back()}
                aria-label={isArabic ? 'رجوع' : 'Back'}
              >
                <ArrowBackIosNewIcon />
              </IconButton>
            )}

            {/* Spacer pushes actions to inline-end */}
            <Box sx={{ flex: 1 }} />

            {/* Inline-end actions: messages, notifications, profile */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton aria-label={isArabic ? 'الرسائل' : 'Messages'} onClick={() => go('/messages')}>
                <Badge color="error" badgeContent={unread?.messages || 0} max={99}>
                  <MailOutlineIcon />
                </Badge>
              </IconButton>
              <IconButton aria-label={isArabic ? 'الإشعارات' : 'Notifications'} onClick={() => go('/notifications')}>
                <Badge color="error" badgeContent={unread?.notifications || 0} max={99}>
                  <NotificationsNoneIcon />
                </Badge>
              </IconButton>

              {/* Profile avatar (menu includes EN/AR item) */}
              <IconButton aria-label={isArabic ? 'الحساب' : 'Account'} onClick={openMenu} size="small">
                <Avatar sx={{ width: 30, height: 30 }}>
                  <PersonIcon fontSize="small" />
                </Avatar>
              </IconButton>
            </Box>

            {/* Mobile profile menu (same instance as desktop) */}
            <Menu
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={closeMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: isArabic ? 'left' : 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: isArabic ? 'left' : 'right' }}
            >
              <MenuItem onClick={toggleLang}>
                <ListItemIcon>
                  <Box sx={{
                    border: (t) => `1px solid ${t.palette.primary.main}`,
                    px: 1, py: 0.25, borderRadius: 0.75, fontWeight: 700,
                    minWidth: 28, textAlign: 'center',
                  }}>
                    {isArabic ? 'EN' : 'AR'}
                  </Box>
                </ListItemIcon>
                {isArabic ? 'الإنجليزية' : 'Arabic'}
              </MenuItem>
              <MenuItem onClick={doLogout}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                {isArabic ? 'تسجيل الخروج' : 'Logout'}
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
      )}

      {/* Main content */}
      <Box component="main"
        sx={{
          px: { xs: 2, md: 3 },
          pt: { xs: disableTopBar || isMdUp ? 2 : `${MOBILE_TOP_H + 8}px`, md: 10 },
          pb: { xs: `${MOBILE_NAV_H + 8}px`, md: 3 },
          maxWidth, mx: 'auto', width: '100%',
        }}
      >
        {children}
      </Box>

      {/* Mobile bottom nav */}
      {!isMdUp && (
        <Paper elevation={3} sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: (t) => t.zIndex.appBar, borderTop: (t) => `1px solid ${t.palette.divider}`,
        }}>
          <BottomNavigation value={activeIndex} onChange={onBottomChange} showLabels
            sx={{ height: MOBILE_NAV_H, '.MuiBottomNavigationAction-root': { flexDirection: isArabic ? 'row-reverse' : 'column' } }}
          >
            {effectiveNav.map((it) => (
              <BottomNavigationAction key={it.href} label={it.label} icon={it.icon} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
