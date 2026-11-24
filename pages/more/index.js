// /pages/more/index.js
'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Stack,
  Typography,
  Paper,
  Grid,
  Avatar,
  Skeleton,
  Chip,
  ButtonBase,
  useMediaQuery,
  Divider,
  Button,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import AppLayout from '@/components/AppLayout';
import Protected from '@/components/Protected';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import globalCache from '@/lib/cache';

// Icons
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import ScienceIcon from '@mui/icons-material/Science';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import PrivacyTipRoundedIcon from '@mui/icons-material/PrivacyTipRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';

const grad = (from, to) => `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

function SectionHeader({ title, subtitle, isArabic }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" fontWeight={900}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, opacity: 0.9 }}
        >
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}

function Tile({ href, icon, title, subtitle, count, isArabic, withLang, dense }) {
  return (
    <Link href={withLang(href)} style={{ textDecoration: 'none' }}>
      <ButtonBase
        sx={{
          width: '100%',
          borderRadius: 3,
          textAlign: isArabic ? 'right' : 'left',
          overflow: 'hidden',
        }}
        focusRipple
      >
        <Paper
          elevation={0}
          className="glass-panel glass-panel-lift"
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderRadius: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.25, sm: 1.75 },
            width: '100%',
            flexDirection: isArabic ? 'row-reverse' : 'row',
            minHeight: { xs: 76, sm: 92 },
          }}
        >
          <Avatar
            variant="rounded"
            sx={{
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              color: '#ffffff',
              width: { xs: 42, sm: 50 },
              height: { xs: 42, sm: 50 },
              borderRadius: '14px',
              boxShadow: '0 6px 16px -4px rgba(37, 99, 235, 0.35)',
              flexShrink: 0,
            }}
          >
            {icon}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction={isArabic ? 'row-reverse' : 'row'}
              alignItems="center"
              spacing={1}
              sx={{ minWidth: 0 }}
            >
              <Typography
                variant={dense ? 'subtitle1' : 'h6'}
                fontWeight={800}
                noWrap
                sx={{ lineHeight: 1.1 }}
              >
                {title}
              </Typography>
              {typeof count === 'number' && (
                <Chip
                  size="small"
                  color="primary"
                  variant="outlined"
                  label={count}
                  sx={{ fontWeight: 700, height: 22 }}
                />
              )}
            </Stack>

            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ display: { xs: dense ? 'none' : 'block', sm: 'block' } }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>

          <ChevronRightIcon
            sx={{
              color: 'text.disabled',
              transform: isArabic ? 'rotate(180deg)' : 'none',
              flexShrink: 0,
            }}
          />
        </Paper>
      </ButtonBase>
    </Link>
  );
}

export default function MorePage() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSmDown = useMediaQuery(theme.breakpoints.down('md'));

  // Arabic default unless explicitly EN
  const [isArabic, setIsArabic] = React.useState(true);
  React.useEffect(() => {
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else if (q.ar) setIsArabic(q.ar === '1' || String(q.ar).toLowerCase() === 'true');
    else setIsArabic(true);
  }, [router?.query]);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path),
    [isArabic]
  );

  const label = React.useCallback((en, ar) => (isArabic ? ar : en), [isArabic]);

  const [loading, setLoading] = React.useState(() => !globalCache.moreCounts);
  const [pharmCount, setPharmCount] = React.useState(() => globalCache.moreCounts?.pharmCount ?? null);
  const [labsCount, setLabsCount] = React.useState(() => globalCache.moreCounts?.labsCount ?? null);

  React.useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;

    if (globalCache.moreCounts) {
      setPharmCount(globalCache.moreCounts.pharmCount);
      setLabsCount(globalCache.moreCounts.labsCount);
      setLoading(false);
    }

    (async () => {
      if (!globalCache.moreCounts) setLoading(true);
      try {
        const [pSnap, lSnap] = await Promise.all([
          getCountFromServer(query(collection(db, 'pharmacies'), where('doctorUID', '==', user.uid))),
          getCountFromServer(query(collection(db, 'labs'), where('doctorUID', '==', user.uid))),
        ]);
        if (cancelled) return;
        const pCount = pSnap.data().count;
        const lCount = lSnap.data().count;
        setPharmCount(pCount);
        setLabsCount(lCount);
        globalCache.moreCounts = { pharmCount: pCount, labsCount: lCount };
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  return (
    <Protected>
      <AppLayout>
        <Box
          dir={isArabic ? 'rtl' : 'ltr'}
          sx={{
            textAlign: isArabic ? 'right' : 'left',
            px: { xs: 1.25, sm: 0 },
          }}
        >
          <Container disableGutters maxWidth="lg">
            {/* Header */}
            <div className="shafy-hero-shell" style={{ padding: '24px 28px', marginBottom: '20px' }}>
              <Stack
                direction={isArabic ? 'row-reverse' : 'row'}
                alignItems="center"
                justifyContent="space-between"
                sx={{ position: 'relative', zIndex: 2 }}
              >
                <Box>
                  <Typography
                    variant={isXs ? 'h6' : 'h4'}
                    fontWeight={900}
                    sx={{ lineHeight: 1.2, color: '#ffffff' }}
                  >
                    {label('More & Clinic Tools', 'المزيد وأدوات العيادة')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: '#dbeafe', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}
                  >
                    {label('Profile, support, and connected services', 'الملف الشخصي، الدعم، والخدمات المرتبطة')}
                  </Typography>
                </Box>
                <Chip
                  icon={<RocketLaunchRoundedIcon sx={{ color: '#fef08a !important' }} />}
                  label={label('Shafy Pro', 'شافي برو')}
                  sx={{
                    fontWeight: 900,
                    bgcolor: 'rgba(255,255,255,0.16)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.3)',
                  }}
                />
              </Stack>
            </div>

            <Divider sx={{ my: { xs: 1.25, sm: 2 } }} />

            {/* Account & Profile */}
            <SectionHeader
              title={label('Account & Profile', 'الحساب والملف')}
              subtitle={label('Manage your personal and clinic presence', 'إدارة بياناتك وملف العيادة')}
              isArabic={isArabic}
            />
            {loading ? (
              <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 2 }}>
                {[...Array(3)].map((_, i) => (
                  <Grid key={i} item xs={12} sm={6} md={4}>
                    <Skeleton variant="rounded" height={isXs ? 72 : 96} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Tile
                    href="/profile"
                    icon={<AccountCircleIcon />}
                    title={label('Profile', 'الملف الشخصي')}
                    subtitle={label('Manage your account & clinic info', 'إدارة الحساب ومعلومات العيادة')}
                    isArabic={isArabic}
                    withLang={withLang}
                    dense={isSmDown}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Tile
                    href="/settings"
                    icon={<SettingsRoundedIcon />}
                    title={label('Settings', 'الإعدادات')}
                    subtitle={label('Preferences & app options', 'التفضيلات وخيارات التطبيق')}
                    isArabic={isArabic}
                    withLang={withLang}
                    dense={isSmDown}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Tile
                    href="/notifications"
                    icon={<NotificationsRoundedIcon />}
                    title={label('Notifications', 'الإشعارات')}
                    subtitle={label('View and manage alerts', 'عرض وإدارة التنبيهات')}
                    isArabic={isArabic}
                    withLang={withLang}
                    dense={isSmDown}
                  />
                </Grid>
              </Grid>
            )}

            {/* Clinical Network */}
            <SectionHeader
              title={label('Clinical Network', 'شبكة العمل')}
              subtitle={label('Connected pharmacies & labs', 'الصيدليات والمختبرات المرتبطة')}
              isArabic={isArabic}
            />
            {loading ? (
              <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 2 }}>
                {[...Array(2)].map((_, i) => (
                  <Grid key={i} item xs={12} sm={6} md={4}>
                    <Skeleton variant="rounded" height={isXs ? 72 : 96} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Tile
                    href="/pharmacies"
                    icon={<LocalPharmacyIcon />}
                    title={label('Pharmacies', 'الصيدليات')}
                    subtitle={label('Linked pharmacies & prescriptions', 'الصيدليات المرتبطة والوصفات')}
                    count={typeof pharmCount === 'number' ? pharmCount : undefined}
                    isArabic={isArabic}
                    withLang={withLang}
                    dense={isSmDown}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                  <Tile
                    href="/labs"
                    icon={<ScienceIcon />}
                    title={label('Labs', 'المختبرات')}
                    subtitle={label('Partner labs & test orders', 'المختبرات الشريكة وطلبات الفحوصات')}
                    count={typeof labsCount === 'number' ? labsCount : undefined}
                    isArabic={isArabic}
                    withLang={withLang}
                    dense={isSmDown}
                  />
                </Grid>
              </Grid>
            )}

            {/* Support & Information */}
            <SectionHeader
              title={label('Support & Information', 'الدعم والمعلومات')}
              subtitle={label('Get help and learn about the product', 'الحصول على المساعدة ومعرفة المزيد')}
              isArabic={isArabic}
            />
            <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Tile
                  href="/support"
                  icon={<SupportAgentRoundedIcon />}
                  title={label('Tech Support', 'الدعم الفني')}
                  subtitle={label('Contact support & FAQs', 'التواصل مع الدعم والأسئلة الشائعة')}
                  isArabic={isArabic}
                  withLang={withLang}
                  dense={isSmDown}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Tile
                  href="/about"
                  icon={<InfoRoundedIcon />}
                  title={label('About', 'حول التطبيق')}
                  subtitle={label('Version, team & mission', 'الإصدار والفريق والرسالة')}
                  isArabic={isArabic}
                  withLang={withLang}
                  dense={isSmDown}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Tile
                  href="/feedback"
                  icon={<RateReviewRoundedIcon />}
                  title={label('Feedback', 'ملاحظات')}
                  subtitle={label('Suggest features or report bugs', 'اقتراح الميزات أو الإبلاغ عن أخطاء')}
                  isArabic={isArabic}
                  withLang={withLang}
                  dense={isSmDown}
                />
              </Grid>
            </Grid>

            {/* Data & Privacy */}
            <SectionHeader
              title={label('Data & Privacy', 'البيانات والخصوصية')}
              subtitle={label('Export your data or manage privacy', 'تصدير البيانات أو إدارة الخصوصية')}
              isArabic={isArabic}
            />
            <Grid container spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={4}>
                <Tile
                  href="/data"
                  icon={<PrivacyTipRoundedIcon />}
                  title={label('Data & Privacy', 'البيانات والخصوصية')}
                  subtitle={label('Export data & privacy controls', 'تصدير البيانات وإعدادات الخصوصية')}
                  isArabic={isArabic}
                  withLang={withLang}
                  dense={isSmDown}
                />
              </Grid>
            </Grid>

            {/* Support CTA Banner */}
            <Paper
              sx={{
                mt: 2,
                p: { xs: 1.25, md: 2 },
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.25,
                flexDirection: { xs: 'column', sm: isArabic ? 'row-reverse' : 'row' },
                backgroundImage: (t) => grad('#e3f2fd', '#ffffff'),
                border: (t) => `1px solid ${t.palette.divider}`,
              }}
            >
              <Alert
                severity="info"
                icon={<SupportAgentRoundedIcon />}
                sx={{
                  flex: 1,
                  borderRadius: 2,
                  width: '100%',
                  '& .MuiAlert-message': { width: '100%' },
                }}
              >
                <Stack
                  direction={isArabic ? 'row-reverse' : 'row'}
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography fontWeight={800}>
                    {label('Need help?', 'تحتاج مساعدة؟')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {label('Our support team is here for you.', 'فريق الدعم جاهز لمساعدتك.')}
                  </Typography>
                </Stack>
              </Alert>
              <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
                <Button component={Link} href={withLang('/support')} variant="contained" sx={{ borderRadius: 2 }}>
                  {label('Contact Support', 'تواصل مع الدعم')}
                </Button>
                <Button component={Link} href={withLang('/about')} variant="outlined" sx={{ borderRadius: 2 }}>
                  {label('About', 'حول')}
                </Button>
              </Stack>
            </Paper>

            <Box sx={{ height: { xs: 16, sm: 24 } }} />
          </Container>
        </Box>
      </AppLayout>
    </Protected>
  );
}
