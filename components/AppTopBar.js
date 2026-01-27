// /components/AppTopBar.jsx
'use client';
import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';

import {
  AppBar,
  Toolbar,
  Button,
  Box,
  IconButton,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  useTheme,
  alpha
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

const NavItem = ({ item, active, isArabic }) => {
  const theme = useTheme();

  return (
    <Link href={item.href} legacyBehavior passHref>
      <Box
        component="a"
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          textDecoration: 'none',
          color: active ? 'primary.main' : 'text.secondary',
          fontWeight: active ? 700 : 500,
          transition: 'color 0.2s',
          '&:hover': {
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            borderRadius: 2,
          },
        }}
      >
        {active && (
          <Box
            component={motion.div}
            layoutId="nav-underline"
            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 3,
              bgcolor: 'primary.main',
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
            }}
          />
        )}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {item.icon}
        </Box>
        <span>{item.label}</span>
      </Box>
    </Link>
  );
};

const AppTopBar = React.memo(function AppTopBar({
  navItems = [],
  logoSrc = '/logo.png',
  unreadMessages = 0,
  unreadNotifications = 0,
  onNavClick,
  onLangToggle,
  onLogout,
  onOpenProfile,
  showBuiltInBadges = true,
}) {
  const router = useRouter();
  const theme = useTheme();
  const pathname = (router?.asPath || '').split('?')[0];

  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar)   return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);

  const pushWithLang = (destPath) => {
    const q = { ...router.query, lang: isArabic ? 'ar' : 'en' };
    router.push({ pathname: destPath, query: q });
  };

  const activeIndex = React.useMemo(() => {
    return navItems.findIndex((it) => isActive(pathname, it.href));
  }, [pathname, navItems]);

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
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        direction: isArabic ? 'rtl' : 'ltr',
        backdropFilter: 'blur(20px)',
        backgroundColor: alpha(theme.palette.background.default, 0.8),
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ gap: 2, minHeight: { xs: 56, md: 70 }, overflow: 'visible', position: 'relative' }}>
        {/* Logo (Home) */}
        {/* Logo (Home) */}
        <Link href="/" legacyBehavior passHref>
          <Box
            component="a"
            sx={{
              flexShrink: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              lineHeight: 0,
              // Apply the scale transforms here on the container
              transform: { xs: 'scale(1.6)', md: 'scale(1.9)' },
              transformOrigin: isArabic ? 'right center' : 'left center',
              transition: 'transform 0.3s ease',
              '&:hover': { transform: { xs: 'scale(1.7)', md: 'scale(2.0)' } }
            }}
            aria-label="Home"
            title="Shafy Doctor"
          >
            <Image
              src={logoSrc}
              alt="Shafy Doctor Logo"
              width={48}
              height={48}
              style={{
                width: 'auto',
                height: '48px',
              }}
              priority
            />
          </Box>
        </Link>



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
            gap: 1
          }}
        >
          {navItems.map((item, index) => (
             <NavItem 
                key={item.href} 
                item={item} 
                active={index === activeIndex} 
                isArabic={isArabic} 
             />
          ))}
        </Box>

        {/* Right cluster */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
          ...(isArabic ? { mr: 'auto', ml: 0 } : { ml: 'auto', mr: 0 }),
        }}>
          <Button 
            size="small" 
            onClick={handleLangToggle} 
            variant="outlined" 
            startIcon={<TranslateIcon />}
            sx={{ 
                borderRadius: 4, 
                textTransform: 'none', 
                border: '1px solid',
                borderColor: 'divider',
                color: 'text.secondary',
                '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.05) }
            }}
          >
            {isArabic ? 'EN' : 'AR'}
          </Button>

          {showBuiltInBadges && (
            <>
              <IconButton aria-label={isArabic ? 'الرسائل' : 'Messages'}
                          onClick={() => pushWithLang('/messages')}>
                <Badge color="error" badgeContent={unreadMessages} max={99}>
                  <MailOutlineIcon />
                </Badge>
              </IconButton>

              <IconButton aria-label={isArabic ? 'الإشعارات' : 'Notifications'}
                          onClick={() => pushWithLang('/notifications')}>
                <Badge color="error" badgeContent={unreadNotifications} max={99}>
                  <NotificationsNoneIcon />
                </Badge>
              </IconButton>
            </>
          )}

          <IconButton 
            aria-label={isArabic ? 'الحساب' : 'Account'} 
            onClick={openMenu} 
            size="small"
            sx={{ 
                ml: 1,
                border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                p: '2px',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
              <PersonIcon fontSize="small" />
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={closeMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: isArabic ? 'left' : 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: isArabic ? 'left' : 'right' }}
            PaperProps={{
                elevation: 0,
                sx: {
                    mt: 1.5,
                    borderRadius: 3,
                    minWidth: 180,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
                }
            }}
          >
            <MenuItem onClick={gotoProfile} sx={{ borderRadius: 1, mx: 1 }}>
              <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
              {isArabic ? 'الملف الشخصي' : 'Profile'}
            </MenuItem>
            <MenuItem onClick={handleLangToggle} sx={{ borderRadius: 1, mx: 1 }}>
              <ListItemIcon><TranslateIcon fontSize="small" /></ListItemIcon>
              {isArabic ? 'الإنجليزية' : 'Arabic'}
            </MenuItem>
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={doLogout} sx={{ borderRadius: 1, mx: 1, color: 'error.main' }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              {isArabic ? 'تسجيل الخروج' : 'Logout'}
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
});

export default AppTopBar;
