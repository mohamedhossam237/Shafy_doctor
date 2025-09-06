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
import { collection, getDocs, query, where } from 'firebase/firestore';

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
          elevation={dense ? 0 : 1}
          sx={{
            p: { xs: 1.25, sm: 1.75 },
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.25, sm: 1.5 },
            transition: 'transform .16s ease, box-shadow .16s ease',
            '&:active': { transform: 'scale(0.995)' },
            boxShadow: dense ? '0 1px 3px rgba(0,0,0,.06)' : '0 2px 10px rgba(0,0,0,.06)',
            flexDirection: isArabic ? 'row-reverse' : 'row',
            minHeight: { xs: 72, sm: 88 },
          }}
        >
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              width: { xs: 40, sm: 52 },
              height: { xs: 40, sm: 52 },
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

  const [loading, setLoading] = React.useState(true);
  const [pharmCount, setPharmCount] = React.useState(null);
  const [labsCount, setLabsCount] = React.useState(null);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const pq = query(collection(db, 'pharmacies'), where('doctorUID', '==', user.uid));
        const ps = await getDocs(pq);
        setPharmCount(ps.size);

        const lq = query(collection(db, 'labs'), where('doctorUID', '==', user.uid));
        const ls = await getDocs(lq);
        setLabsCount(ls.size);
      } catch (e) {
        console.error(e);
        setPharmCount(null);
        setLabsCount(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

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
            <Box
              sx={{
                mt: { xs: 0.5, sm: 1 },
                p: { xs: 1.25, md: 3 },
                borderRadius: 3,
                backgroundImage: (t) => grad(t.palette.primary.light, '#ffffff'),
                border: (t) => `1px solid ${t.palette.divider}`,
              }}
            >
              <Stack
                direction={isArabic ? 'row-reverse' : 'row'}
                alignItems="center"
                justifyContent="space-between"
              >
                <Box>
                  <Typography
                    variant={isXs ? 'h6' : 'h5'}
                    fontWeight={800}
                    sx={{ lineHeight: 1.2 }}
                  >
                    {label('More', 'المزيد')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.25, display: { xs: 'none', sm: 'block' } }}
                  >
                    {label('Profile, support, and connected services', 'الملف الشخصي، الدعم، والخدمات المرتبطة')}
                  </Typography>
                </Box>
                <Chip
                  icon={<RocketLaunchRoundedIcon />}
                  label={label('New & improved', 'تحسينات جديدة')}
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 800 }}
                />
              </Stack>
            </Box>

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
