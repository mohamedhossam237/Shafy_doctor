// /components/AppTopBar.jsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Tabs,
  Tab,
  IconButton,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
} from '@mui/material';

import MailOutlineIcon from '@mui/icons-material/MailOutline';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import TranslateIcon from '@mui/icons-material/Translate';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

function isActive(pathname, href) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  return pathname.startsWith(href + '/');
}

export default function AppTopBar({
  navItems = [],
  logoSrc = '/logo.png',
  unreadMessages = 0,
  unreadNotifications = 0,

  // handlers from AppLayout
  onNavClick,             // (href) => void
  onLangToggle,           // () => void
  onLogout,               // () => void|Promise<void>
  onOpenProfile,          // () => void
  showBuiltInBadges = true,
}) {
  const router = useRouter();
  const pathname = (router?.asPath || '').split('?')[0];

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar)   return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const activeIndex = React.useMemo(() => {
    const idx = navItems.findIndex((it) => isActive(pathname, it.href));
    return idx >= 0 ? idx : 0;
  }, [pathname, navItems]);

  const pushWithLang = (destPath) => {
    const q = { ...router.query, lang: isArabic ? 'ar' : 'en' };
    router.push({ pathname: destPath, query: q });
  };

  const onTabChange = (_e, newIndex) => {
    const dest = navItems[newIndex]?.href;
    if (!dest || dest === pathname) return;
    if (onNavClick) onNavClick(dest);
    else pushWithLang(dest);
  };

  const handleLangToggle = () => {
    if (onLangToggle) onLangToggle();
    else {
      const q = { ...router.query, lang: isArabic ? 'en' : 'ar' };
      router.push({ pathname, query: q }, undefined, { scroll: false });
    }
  };

  // profile menu
  const [anchorEl, setAnchorEl] = React.useState(null);
  const menuOpen = Boolean(anchorEl);
  const openMenu = (e) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);

  const gotoProfile = () => {
    closeMenu();
    if (onOpenProfile) onOpenProfile();
    else pushWithLang('/profile');
  };

  const doLogout = async () => {
    closeMenu();
    try { await onLogout?.(); } catch {}
  };

  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ direction: isArabic ? 'rtl' : 'ltr' }}>
      <Toolbar sx={{ gap: 2, minHeight: { xs: 56, md: 64 }, overflow: 'visible', position: 'relative' }}>
        {/* Logo (Home) */}
        <Box
          onClick={() => onTabChange(null, 0)}
          sx={{ flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', lineHeight: 0 }}
          aria-label="Home"
          title="Shafy Doctor"
        >
          <Box
            component="img"
            src={logoSrc}
            alt="Shafy Doctor Logo"
            sx={{
              height: 48,
              width: 'auto',
              display: 'block',
              transform: { xs: 'scale(1.6)', md: 'scale(1.9)' },
              transformOrigin: isArabic ? 'right center' : 'left center',
            }}
          />
        </Box>

        {/* Centered Tabs (desktop) */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: 0,
            bottom: 0,
            alignItems: 'center',
            maxWidth: '72%',
          }}
        >
          <Tabs value={activeIndex} onChange={onTabChange} variant="standard" centered
                sx={{ '.MuiTabs-indicator': { height: 3 } }}>
            {navItems.map((item) => (
              <Tab key={item.href} icon={item.icon} iconPosition="start"
                   label={item.label} sx={{ textTransform: 'none', fontWeight: 600, minHeight: 64 }} />
            ))}
          </Tabs>
        </Box>

        {/* Right cluster */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
          ...(isArabic ? { mr: 'auto', ml: 0 } : { ml: 'auto', mr: 0 }),
        }}>
          <Button size="small" onClick={handleLangToggle} variant="outlined" startIcon={<TranslateIcon />}>
            {isArabic ? 'EN' : 'AR'}
          </Button>

          {showBuiltInBadges && (
            <>
              <IconButton aria-label={isArabic ? 'الرسائل' : 'Messages'}
                          onClick={() => (onNavClick ? onNavClick('/messages') : pushWithLang('/messages'))}>
                <Badge color="error" badgeContent={unreadMessages} max={99}>
                  <MailOutlineIcon />
                </Badge>
              </IconButton>

              <IconButton aria-label={isArabic ? 'الإشعارات' : 'Notifications'}
                          onClick={() => (onNavClick ? onNavClick('/notifications') : pushWithLang('/notifications'))}>
                <Badge color="error" badgeContent={unreadNotifications} max={99}>
                  <NotificationsNoneIcon />
                </Badge>
              </IconButton>
            </>
          )}

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
            <MenuItem onClick={gotoProfile}>
              <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
              {isArabic ? 'الملف الشخصي' : 'Profile'}
            </MenuItem>
            <MenuItem onClick={handleLangToggle}>
              <ListItemIcon><TranslateIcon fontSize="small" /></ListItemIcon>
              {isArabic ? 'الإنجليزية' : 'Arabic'}
            </MenuItem>
            <Divider />
            <MenuItem onClick={doLogout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              {isArabic ? 'تسجيل الخروج' : 'Logout'}
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
