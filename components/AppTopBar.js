// /components/AppTopBar.jsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import { AppBar, Toolbar, Button, Box, Tabs, Tab } from '@mui/material';

function isActive(pathname, href) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  return pathname.startsWith(href + '/');
}

export default function AppTopBar({
  navItems = [],
  actionsSlot = null,   // custom actions (e.g., lang, notifs, profile menu)
  hideLang = false,     // hide built-in lang button if true
}) {
  const router = useRouter();
  const pathname = (router?.asPath || '').split('?')[0];

  // Arabic is default if not explicitly set to EN
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar)   return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true; // default = Arabic
  }, [router.query]);

  const activeIndex = React.useMemo(() => {
    const idx = navItems.findIndex((it) => isActive(pathname, it.href));
    return idx >= 0 ? idx : 0;
  }, [pathname, navItems]);

  const onTabChange = (_e, newIndex) => {
    const dest = navItems[newIndex]?.href;
    if (!dest || dest === pathname) return;
    const q = { ...router.query, lang: isArabic ? 'ar' : 'en' };
    router.push({ pathname: dest, query: q });
  };

  const toggleLang = () => {
    const q = { ...router.query, lang: isArabic ? 'en' : 'ar' };
    router.push({ pathname, query: q }, undefined, { scroll: false });
  };

  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ direction: isArabic ? 'rtl' : 'ltr' }}>
      <Toolbar sx={{ gap: 2, minHeight: { xs: 56, md: 64 }, overflow: 'visible', position: 'relative' }}>
        {/* Logo (click to go home) */}
        <Box
          onClick={() => onTabChange(null, 0)}
          sx={{ flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', lineHeight: 0 }}
          aria-label="Home"
          title="Shafy Doctor"
        >
          <Box
            component="img"
            src="/logo.png"
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

        {/* Centered Tabs (desktop only) */}
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
          <Tabs
            value={activeIndex}
            onChange={onTabChange}
            variant="standard"
            centered
            sx={{ '.MuiTabs-indicator': { height: 3 } }}
          >
            {navItems.map((item) => (
              <Tab
                key={item.href}
                icon={item.icon}
                iconPosition="start"
                label={item.label}
                sx={{ textTransform: 'none', fontWeight: 600, minHeight: 64 }}
              />
            ))}
          </Tabs>
        </Box>

        {/* Actions — right in EN, left in AR */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexShrink: 0,
            ...(isArabic ? { mr: 'auto', ml: 0 } : { ml: 'auto', mr: 0 }),
          }}
        >
          {!hideLang && (
            <Button size="small" onClick={toggleLang} variant="outlined">
              {isArabic ? 'EN' : 'AR'}
            </Button>
          )}
          {actionsSlot}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
