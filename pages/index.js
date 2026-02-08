'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Box, Container, Stack, Typography, Paper, CircularProgress,
  Button, Avatar, Divider, Chip, Grid, IconButton
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false }); // even if unused, if imported
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });


import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WavingHandIcon from '@mui/icons-material/WavingHand';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TagIcon from '@mui/icons-material/Tag';
import ArticleIcon from '@mui/icons-material/Article';
import ImageIcon from '@mui/icons-material/Image';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import AddPatientDialog from '@/components/patients/AddPatientDialog';

/* --------------------------- Helpers --------------------------- */

const grad = (from, to) => `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;

function formatLongDate(isArabic) {
  const locale = isArabic ? 'ar-EG-u-nu-arab' : undefined;
  return new Intl.DateTimeFormat(locale || undefined, {
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
  if (hour < 18) return isArabic ? 'مساء الخير' : 'Good Afternoon';
  return isArabic ? 'مساء الخير' : 'Good Evening';
}

const normalizeHoursFromAny = (sourceObj) => {
  if (!sourceObj || typeof sourceObj !== "object") {
    return { sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" };
  }
  const src =
    sourceObj.working_hours ||
    sourceObj.workingHours ||
    (sourceObj.clinic &&
      (sourceObj.clinic.working_hours || sourceObj.clinic.workingHours)) ||
    null;
  if (src && typeof src === "object" && typeof src.sun === "string") return src;
  if (src && typeof src === "object" && typeof src.sun === "object") {
    const out = {};
    for (const k of ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]) {
      const day = src[k];
      if (day && day.open !== false) {
         const s = day.start || "09:00";
         const e = day.end || "17:00";
         out[k] = `${s}-${e}`;
      } else {
         out[k] = "";
      }
    }
    return out;
  }
  return { sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" };
};

// Get patient ID from appointment (checking all possible field names)
function getPatientId(appt) {
  if (!appt) return null;
  return appt.patientId || appt.patientUID || appt.patientID || appt.patientUid || null;
}

/* --------------------------- UI Components --------------------------- */

// Helper for relative time
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

const MotionPaper = motion(Paper);
const MotionBox = motion(Box);

function WelcomeBanner({ doctorName, isArabic, todayPretty, onAddPatient, onAddReport, onStats, onMarketing, remainingAppts }) {
  const theme = useTheme();
  const greeting = getGreeting(isArabic);

  return (
    <MotionPaper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      elevation={0}
      sx={{
        p: { xs: 3, sm: 4, md: 6 },
        borderRadius: { xs: 3, md: 5 },
        background: `linear-gradient(120deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
      }}
    >
      {/* Decorative circles */}
      <Box sx={{ position: 'absolute', top: -20, right: -20, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
      <Box sx={{ position: 'absolute', bottom: -40, left: 10, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

      {/* Welcome Message */}
      <Stack direction="row" alignItems="center" spacing={{ xs: 2, sm: 3 }} sx={{ position: 'relative', zIndex: 1, mb: { xs: 3, md: 4 } }}>
        <Avatar
          sx={{
            width: { xs: 56, sm: 64, md: 72 },
            height: { xs: 56, sm: 64, md: 72 },
            bgcolor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
          }}
        >
          <WavingHandIcon sx={{ fontSize: { xs: 32, sm: 36, md: 40 } }} />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" sx={{ opacity: 0.9, letterSpacing: 1.5, fontWeight: 600, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
            {todayPretty}
          </Typography>
          <Typography variant="h3" fontWeight={800} sx={{ mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.1)', fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }}>
            {greeting}, {isArabic ? 'د.' : 'Dr.'} {doctorName}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 500, fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}>
            {remainingAppts > 0
              ? (isArabic ? `لديك ${remainingAppts} مواعيد متبقية اليوم` : `You have ${remainingAppts} appointments remaining today`)
              : (isArabic ? 'لا توجد مواعيد متبقية اليوم' : 'No appointments remaining today')}
          </Typography>
        </Box>
      </Stack>

      {/* Quick Actions - Always below message */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2.5}
        sx={{ 
          position: 'relative', 
          zIndex: 1
        }}
      >
        <Button
          onClick={onAddPatient}
          variant="contained"
          sx={{
            bgcolor: 'rgba(255,255,255,0.15)',
            color: 'white',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'none',
            minWidth: { xs: '100%', sm: 130 },
            py: 1.5,
            px: 3,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)', boxShadow: 'none' }
          }}
          startIcon={<PersonAddAlt1Icon />}
        >
          {isArabic ? 'مريض' : 'Patient'}
        </Button>
        <Button
          onClick={onAddReport}
          variant="contained"
          sx={{
            bgcolor: 'rgba(255,255,255,0.15)',
            color: 'white',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'none',
            minWidth: { xs: '100%', sm: 130 },
            py: 1.5,
            px: 3,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)', boxShadow: 'none' }
          }}
          startIcon={<AssessmentIcon />}
        >
          {isArabic ? 'تقرير' : 'Report'}
        </Button>
        <Button
          onClick={onStats}
          variant="contained"
          sx={{
            bgcolor: 'rgba(255,255,255,0.15)',
            color: 'white',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'none',
            minWidth: { xs: '100%', sm: 130 },
            py: 1.5,
            px: 3,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)', boxShadow: 'none' }
          }}
          startIcon={<AnalyticsIcon />}
        >
          {isArabic ? 'إحصائيات' : 'Stats'}
        </Button>
        <Button
          onClick={onMarketing}
          variant="contained"
          sx={{
            bgcolor: 'rgba(255,255,255,0.15)',
            color: 'white',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: 'none',
            minWidth: { xs: '100%', sm: 130 },
            py: 1.5,
            px: 3,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)', boxShadow: 'none' }
          }}
          startIcon={<ArticleIcon />}
        >
          {isArabic ? 'تسويق' : 'Marketing'}
        </Button>
      </Stack>
    </MotionPaper>
  );
}

function RecentArticlesList({ articles, isArabic, withLang }) {
  const theme = useTheme();
  return (
    <MotionPaper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        height: '100%'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArticleIcon color="primary" />
          {isArabic ? 'أحدث المقالات' : 'Latest Articles'}
        </Typography>
        <Link href={withLang('/marketing')} style={{ textDecoration: 'none' }}>
          <Typography variant="body2" color="primary" fontWeight={700} sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
            {isArabic ? 'عرض الكل' : 'View All'}
          </Typography>
        </Link>
      </Stack>
      <Stack spacing={1}>
        {articles.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              textAlign: 'center',
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px dashed',
              borderColor: 'divider',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                mb: 2,
              }}
            >
              <ArticleIcon />
            </Avatar>
            <Typography variant="body1" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>
              {isArabic ? 'لا توجد مقالات بعد' : 'No articles yet'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
              {isArabic ? 'ابدأ بإنشاء محتوى للمدونة عبر صفحة التسويق' : 'Start creating content for the blog via the Marketing page'}
            </Typography>
            <Button
              component={Link}
              href={withLang('/marketing')}
              variant="outlined"
              size="small"
              startIcon={<ArticleIcon />}
              sx={{ textTransform: 'none' }}
            >
              {isArabic ? 'انتقل إلى التسويق' : 'Go to Marketing'}
            </Button>
          </Paper>
        ) : (
          articles.slice(0, 4).map((article) => (
            <Button
              key={article.id}
              component={Link}
              href={withLang('/marketing')}
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                p: 1.5,
                borderRadius: 2,
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.dark', width: 40, height: 40 }}>
                  {article.type === 'infographic' ? <ImageIcon fontSize="small" /> : <ArticleIcon fontSize="small" />}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {isArabic ? (article.title_ar || article.title_en) : (article.title_en || article.title_ar)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {article.type === 'article'
                      ? (isArabic ? 'مقال' : 'Article')
                      : (isArabic ? 'إنفوجرافيك' : 'Infographic')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 70, textAlign: 'end' }}>
                  {getRelativeTime(
                    article.publishedAt?.toDate
                      ? article.publishedAt.toDate()
                      : article.createdAt?.toDate
                      ? article.createdAt.toDate()
                      : article.publishedAt || article.createdAt,
                    isArabic
                  )}
                </Typography>
              </Stack>
            </Button>
          ))
        )}
      </Stack>
    </MotionPaper>
  );
}

function StatTile({ icon, label, count, href, isArabic, withLang, color, delay }) {
  const theme = useTheme();

  return (
    <Link href={withLang(href)} style={{ textDecoration: 'none', width: '100%' }}>
      <MotionPaper
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4, md: 5 },
          borderRadius: { xs: 3, md: 4 },
          height: '100%',
          minHeight: { xs: 140, sm: 160, md: 180 },
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-6px)',
            boxShadow: '0 16px 32px -12px rgba(0,0,0,0.15)',
            borderColor: color,
          }
        }}
      >
        <Stack direction={isArabic ? 'row-reverse' : 'row'} justifyContent="space-between" alignItems="flex-start">
          <Avatar
            variant="rounded"
            sx={{
              bgcolor: alpha(color, 0.1),
              color: color,
              width: { xs: 56, sm: 64, md: 72 },
              height: { xs: 56, sm: 64, md: 72 },
              borderRadius: 3,
              '& svg': {
                fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' }
              }
            }}
          >
            {icon}
          </Avatar>
          <Box
            sx={{
              width: { xs: 32, md: 36 },
              height: { xs: 32, md: 36 },
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: 'text.disabled',
              transition: 'color 0.2s',
              '.MuiPaper-root:hover &': { color: color }
            }}
          >
            <ArrowForwardIcon fontSize="small" sx={{ transform: isArabic ? 'rotate(180deg)' : 'none' }} />
          </Box>
        </Stack>

        <Box sx={{ mt: { xs: 2, sm: 3, md: 4 }, textAlign: isArabic ? 'right' : 'left' }}>
          <Typography variant="h3" fontWeight={800} sx={{ color: 'text.primary', mb: 0.5, fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' } }}>
            {count}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '1rem' } }}>
            {isArabic ? label.ar : label.en}
          </Typography>
        </Box>
      </MotionPaper>
    </Link>
  );
}

function RevenueTile({ revenueDetails, isArabic, withLang, delay }) {
  const theme = useTheme();
  const color = '#e67e22';
  const formatAmount = (amount) => {
    return Number(amount || 0).toLocaleString('en-US-u-nu-latn', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <Link href={withLang('/clinic-reports')} style={{ textDecoration: 'none' }}>
      <MotionPaper
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay }}
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4, md: 5 },
          borderRadius: 4,
          height: '100%',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.3s ease',
          minHeight: { xs: 140, sm: 160, md: 180 },
          '&:hover': {
            transform: 'translateY(-6px)',
            boxShadow: '0 16px 32px -12px rgba(0,0,0,0.15)',
            borderColor: color,
          }
        }}
      >
        <Stack direction={isArabic ? 'row-reverse' : 'row'} justifyContent="space-between" alignItems="flex-start">
          <Avatar
            variant="rounded"
            sx={{
              bgcolor: alpha(color, 0.1),
              color: color,
              width: { xs: 56, sm: 64, md: 72 },
              height: { xs: 56, sm: 64, md: 72 },
              borderRadius: 3
            }}
          >
            <AttachMoneyIcon />
          </Avatar>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              color: 'text.disabled',
              transition: 'color 0.2s',
              '.MuiPaper-root:hover &': { color: color }
            }}
          >
            <ArrowForwardIcon fontSize="small" sx={{ transform: isArabic ? 'rotate(180deg)' : 'none' }} />
          </Box>
        </Stack>

        <Box sx={{ mt: { xs: 2, sm: 3, md: 4 }, textAlign: isArabic ? 'right' : 'left' }}>
          <Typography variant="h3" fontWeight={800} sx={{ color: 'text.primary', mb: 0.5, fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' } }}>
            {formatAmount(revenueDetails.total)}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ fontSize: { xs: '0.875rem', sm: '0.9375rem', md: '1rem' }, mb: 1.5 }}>
            {isArabic ? 'إيرادات اليوم' : "Today's Revenue"}
          </Typography>
          
          {/* Revenue Details */}
          <Stack spacing={0.5} sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction={isArabic ? 'row-reverse' : 'row'} justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                {isArabic ? 'كشف' : 'Checkup'}
              </Typography>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: color }}>
                {formatAmount(revenueDetails.checkup)}
              </Typography>
            </Stack>
            <Stack direction={isArabic ? 'row-reverse' : 'row'} justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                {isArabic ? 'إعادة كشف' : 'Follow-up'}
              </Typography>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: color }}>
                {formatAmount(revenueDetails.followup)}
              </Typography>
            </Stack>
            <Stack direction={isArabic ? 'row-reverse' : 'row'} justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                {isArabic ? 'خدمات إضافية' : 'Additional'}
              </Typography>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, color: color }}>
                {formatAmount(revenueDetails.additional)}
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </MotionPaper>
    </Link>
  );
}

function ActionButton({ icon, label, onClick, color = 'primary', delay }) {
  return (
    <MotionPaper
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
      elevation={0}
      component="button"
      onClick={onClick}
      sx={{
        width: '100%',
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: alpha(color === 'primary' ? '#1976d2' : '#ed6c02', 0.04),
          borderColor: color === 'primary' ? 'primary.main' : 'warning.main',
          transform: 'translateY(-2px)',
        }
      }}
    >
      <Avatar sx={{ bgcolor: alpha(color === 'primary' ? '#1976d2' : '#ed6c02', 0.1), color: color === 'primary' ? 'primary.main' : 'warning.main' }}>
        {icon}
      </Avatar>
      <Typography variant="subtitle2" fontWeight={700}>
        {label}
      </Typography>
    </MotionPaper>
  );
}

function AppointmentItem({ appt, isArabic, withLang, index, isLast, hasAmHours }) {
  const d = apptDate(appt);
  
  if (d && !hasAmHours) {
     const h = d.getHours();
     if (h < 12) d.setHours(h + 12);
  }

  const patientName = appt?.patientName || (isArabic ? 'بدون اسم' : 'Unnamed');
  const status = String(appt?.status || '').toLowerCase();
  const completed = status === 'completed';
  const detailHref = appt?.patientId ? withLang(`/patients/${appt.patientId}`) : withLang('/patients');
  const theme = useTheme();

  // Calculate if starting soon (within 1 hour)
  const now = new Date();
  const diffMins = Math.floor((d - now) / 60000);
  const isStartingSoon = !completed && diffMins > 0 && diffMins <= 60;

  return (
    <Link href={detailHref} style={{ textDecoration: 'none', width: '100%' }}>
      <MotionPaper
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: index * 0.1 }}
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          border: '1px solid',
          borderColor: isStartingSoon ? 'warning.main' : 'divider',
          position: 'relative',
          transition: 'all 0.2s ease',
          bgcolor: isStartingSoon ? alpha(theme.palette.warning.main, 0.02) : 'background.paper',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            transform: 'translateX(4px)',
          },
        }}
      >
        {/* Timeline connector line (visual only, simplified for card view) */}
        {!isLast && (
          <Box
            sx={{
              position: 'absolute',
              left: 30,
              bottom: -20,
              width: 2,
              height: 20,
              bgcolor: 'divider',
              display: { xs: 'none', sm: 'block' } // Hide on mobile if stack is tight
            }}
          />
        )}

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 60,
            p: 1,
            borderRadius: 2,
            bgcolor: completed ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.primary.main, 0.1),
            color: completed ? 'success.main' : 'primary.main',
          }}
        >
          <AccessTimeIcon fontSize="small" />
          <Typography variant="caption" fontWeight={700} sx={{ mt: 0.5 }}>
            {formatTime(d)}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, textAlign: isArabic ? 'right' : 'left' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography 
              variant="subtitle1" 
              fontWeight={700} 
              noWrap 
              sx={{ 
                color: 'primary.main',
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.8,
                  textDecoration: 'underline',
                },
              }}
            >
              {patientName}
            </Typography>
            {isStartingSoon && (
              <Chip
                label={isArabic ? `خلال ${diffMins} دقيقة` : `In ${diffMins}m`}
                size="small"
                color="warning"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary">
              {isArabic ? 'كشف' : 'Consultation'}
            </Typography>
            {appt?.appointmentType === 'followup' && (
              <Chip label={isArabic ? 'إعادة' : 'Re-exam'} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            )}
            {/* Source Badge */}
            {(() => {
              const source = String(appt?.source || '').trim();
              const isDoctorApp = source === 'Doctor_app' || appt?.fromDoctorApp === true;
              const isPatientApp = source === 'patient_app' || appt?.fromPatientApp === true;
              
              // Fallback for old data: if no source and status is 'confirmed' directly, assume Doctor App
              const status = String(appt?.status || '').toLowerCase();
              const isOldDataWithoutSource = !source && !appt?.fromDoctorApp && !appt?.fromPatientApp;
              const isLikelyDoctorApp = isOldDataWithoutSource && status === 'confirmed';
              
              if (isDoctorApp || isLikelyDoctorApp) {
                return (
                  <Chip
                    size="small"
                    icon={<TagIcon sx={{ fontSize: 12 }} />}
                    label={isArabic ? 'تطبيق الطبيب' : 'Doctor App'}
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: 'rgba(93, 64, 66, 0.15)',
                      color: '#5D4042',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: '#5D4042',
                      '& .MuiChip-icon': {
                        fontSize: '0.75rem',
                      },
                    }}
                  />
                );
              }
              
              if (isPatientApp) {
                return (
                  <Chip
                    size="small"
                    icon={<TagIcon sx={{ fontSize: 12 }} />}
                    label={isArabic ? 'تطبيق المريض' : 'Patient App'}
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: 'rgba(30, 78, 140, 0.15)',
                      color: '#1E4E8C',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: '#1E4E8C',
                      '& .MuiChip-icon': {
                        fontSize: '0.75rem',
                      },
                    }}
                  />
                );
              }
              
              return null;
            })()}
          </Stack>
        </Box>

        {completed && (
          <Chip
            size="small"
            label={isArabic ? 'منجز' : 'Done'}
            color="success"
            variant="soft" // If supported, else default
            sx={{ borderRadius: 2, fontWeight: 600 }}
          />
        )}
      </MotionPaper>
    </Link>
  );
}

function WeeklyChart({ data, isArabic }) {
  const theme = useTheme();
  return (
    <MotionPaper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        height: 350,
        position: 'relative'
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={800}>
          {isArabic ? 'نشاط الأسبوع' : 'Weekly Activity'}
        </Typography>
        <Chip
          label={isArabic ? `الإجمالي: ${data.reduce((a, b) => a + b.count, 0)}` : `Total: ${data.reduce((a, b) => a + b.count, 0)}`}
          size="small"
          color="primary"
          variant="soft"
        />
      </Stack>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
            dy={10}
          />
          <Tooltip
            cursor={{ fill: alpha(theme.palette.primary.main, 0.1) }}
            contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
          />
          <Bar dataKey="count" radius={[6, 6, 6, 6]} barSize={32}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.today ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.3)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </MotionPaper>
  );
}

function RecentPatientsList({ patients, isArabic, withLang }) {
  const theme = useTheme();
  return (
    <MotionPaper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      elevation={0}
      sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', height: '100%' }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={800}>
          {isArabic ? 'أحدث المرضى' : 'Recent Patients'}
        </Typography>
        <Link href={withLang('/patients')} style={{ textDecoration: 'none' }}>
          <Typography variant="body2" color="primary" fontWeight={700} sx={{ '&:hover': { textDecoration: 'underline' } }}>
            {isArabic ? 'عرض الكل' : 'View All'}
          </Typography>
        </Link>
      </Stack>
      <Stack spacing={1}>
        {patients.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              textAlign: 'center',
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px dashed',
              borderColor: 'divider',
              minHeight: 160,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                color: 'secondary.main',
                mb: 2,
              }}
            >
              <PeopleAltIcon />
            </Avatar>
            <Typography variant="body1" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>
            {isArabic ? 'لا يوجد مرضى مؤخراً' : 'No recent patients'}
          </Typography>
            <Typography variant="caption" color="text.secondary">
              {isArabic ? 'سيتم عرض المرضى الجدد هنا عند إضافتهم' : 'New patients will appear here when added'}
            </Typography>
          </Paper>
        ) : (
          patients.map((p) => (
            <Button
              key={p.id}
              component={Link}
              href={withLang(`/patients/${p.id}`)}
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                p: 1.5,
                borderRadius: 2,
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                <Avatar sx={{ bgcolor: 'secondary.light', color: 'secondary.dark', width: 40, height: 40 }}>
                  {String(p.name || '?')[0].toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {p.name}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" color="text.secondary">
                      {p.phone || '—'}
                    </Typography>
                    {p.createdAt && (
                      <Typography variant="caption" color="text.disabled">
                        • {getRelativeTime(p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt, isArabic)}
                      </Typography>
                    )}
                  </Stack>
                </Box>
                <ChevronRightIcon fontSize="small" sx={{ color: 'text.disabled', transform: isArabic ? 'rotate(180deg)' : 'none' }} />
              </Stack>
            </Button>
          ))
        )}
      </Stack>
    </MotionPaper>
  );
}

function RecentReportsList({ reports, isArabic, withLang }) {
  const theme = useTheme();
  return (
    <MotionPaper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      elevation={0}
      sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', height: '100%' }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={800}>
          {isArabic ? 'أحدث التقارير' : 'Recent Reports'}
        </Typography>
        <Link href={withLang('/patient-reports')} style={{ textDecoration: 'none' }}>
          <Typography variant="body2" color="primary" fontWeight={700} sx={{ '&:hover': { textDecoration: 'underline' } }}>
            {isArabic ? 'عرض الكل' : 'View All'}
          </Typography>
        </Link>
      </Stack>
      <Stack spacing={1}>
        {reports.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              textAlign: 'center',
              borderRadius: 3,
              bgcolor: 'background.paper',
              border: '1px dashed',
              borderColor: 'divider',
              minHeight: 160,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: alpha(theme.palette.info.main, 0.1),
                color: 'info.main',
                mb: 2,
              }}
            >
              <AssessmentIcon />
            </Avatar>
            <Typography variant="body1" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>
            {isArabic ? 'لا توجد تقارير مؤخراً' : 'No recent reports'}
          </Typography>
            <Typography variant="caption" color="text.secondary">
              {isArabic ? 'سيتم عرض التقارير الجديدة هنا عند إنشائها' : 'New reports will appear here when created'}
            </Typography>
          </Paper>
        ) : (
          reports.map((r) => (
            <Button
              key={r.id}
              component={Link}
              href={withLang('/patient-reports')} // Or specific report dialog if possible, but link to page is safer
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                p: 1.5,
                borderRadius: 2,
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={2} sx={{ width: '100%' }}>
                <Avatar sx={{ bgcolor: 'info.light', color: 'info.dark', width: 40, height: 40 }}>
                  <AssessmentIcon fontSize="small" />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
                    {r.patientName || (isArabic ? 'مريض' : 'Patient')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {r.title || (isArabic ? 'تقرير' : 'Report')}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 70, textAlign: 'end' }}>
                  {getRelativeTime(r.date, isArabic)}
                </Typography>
              </Stack>
            </Button>
          ))
        )}
      </Stack>
    </MotionPaper>
  );
}

/* --------------------------- Page --------------------------- */

export default function DashboardIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isArabic, setIsArabic] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [doctorName, setDoctorName] = React.useState('Doctor');
  const [appointments, setAppointments] = React.useState([]);
  const [hasAmHours, setHasAmHours] = React.useState(true); // Default true
  const [weeklyData, setWeeklyData] = React.useState([]);
  const [dailyRevenue, setDailyRevenue] = React.useState(0);
  const [recentPatients, setRecentPatients] = React.useState([]);
  const [recentReports, setRecentReports] = React.useState([]);
  const [recentArticles, setRecentArticles] = React.useState([]);
  const [counts, setCounts] = React.useState({ appointments: 0, patients: 0, reports: 0 });
  const [revenueDetails, setRevenueDetails] = React.useState({ total: 0, checkup: 0, followup: 0, additional: 0 });
  const [openAddPatient, setOpenAddPatient] = React.useState(false);

  const withLang = React.useCallback(
    (path) => (isArabic ? `${path}${path.includes('?') ? '&' : '?'}lang=ar` : path),
    [isArabic]
  );

  React.useEffect(() => {
    setMounted(true);
    const q = router?.query || {};
    if (q.lang) setIsArabic(String(q.lang).toLowerCase().startsWith('ar'));
    else setIsArabic(true);
  }, [router.query]);

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const doctorUID = user.uid;

        // doctor name and prices
        const dSnap = await getDoc(doc(db, 'doctors', doctorUID));
        const dData = dSnap.exists() ? dSnap.data() : {};
        setDoctorName(isArabic ? dData?.name_ar || 'الطبيب' : dData?.name_en || 'Doctor');
        const checkupPrice = Number(dData.checkupPrice || 0);
        const followUpPrice = Number(dData.followUpPrice || 0);

        // Check AM Hours
        const hours = normalizeHoursFromAny(dData);
        let foundAm = false;
        Object.values(hours).forEach(rangeStr => {
           if (!rangeStr) return;
           const ranges = rangeStr.split(',');
           ranges.forEach(r => {
              const start = r.split('-')[0];
              if (start) {
                 const [h] = start.split(':').map(n => parseInt(n, 10));
                 if (Number.isFinite(h) && h < 12) foundAm = true;
              }
           });
        });
        setHasAmHours(foundAm);

        // appointments
        const colAppt = collection(db, 'appointments');
        const [snapOld, snapNew] = await Promise.all([
          getDocs(query(colAppt, where('doctorUID', '==', doctorUID))),
          getDocs(query(colAppt, where('doctorId', '==', doctorUID))),
        ]);
        const apptMap = new Map();
        [...snapOld.docs, ...snapNew.docs].forEach((d) => apptMap.set(d.id, { id: d.id, ...d.data() }));
        let rows = Array.from(apptMap.values()).map((r) => ({ ...r, _dt: apptDate(r) }));

        // Deduplicate logically: same patient + same time
        const uniqueMapDash = new Map();
        rows.forEach(row => {
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
        const now = new Date();
        
        // Helper to get effective sort time (Smart PM Aware)
        // If sorting needs Smart PM adjustment:
        const getSortTime = (r) => {
            let t = r._dt?.getTime() || 0;
            if (!foundAm && r._dt) { // Use foundAm calculated above
                const h = r._dt.getHours();
                if (h < 12) {
                    return t + (12 * 60 * 60 * 1000);
                }
            }
            return t;
        };

        const upcoming = todayAll
          .filter((r) => {
              // For filtering 'future' appointments, we should also test against the adjusted time
              // But 'r._dt' is raw. Let's compare adjusted vs now.
              // Note: now is correct local time. 
              // If we force 3am -> 3pm, we should compare 3pm vs now.
              const t = getSortTime(r);
              return t >= now.getTime();
          })
          .sort((a, b) => getSortTime(a) - getSortTime(b))
          .slice(0, 4);
        setAppointments(upcoming);

        // Weekly Data (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d;
        });

        const weeklyStats = last7Days.map(day => {
          const dayStr = day.toLocaleDateString('en-CA'); // YYYY-MM-DD
          const count = rows.filter(r => {
            const rd = r._dt;
            return rd && rd.getDate() === day.getDate() && rd.getMonth() === day.getMonth() && rd.getFullYear() === day.getFullYear();
          }).length;
          return {
            day: day.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { weekday: 'short' }),
            count,
            today: isToday(day)
          };
        });
        setWeeklyData(weeklyStats);

        // Recent Patients
        const patientsCol = collection(db, 'patients');
        const pQuery = query(patientsCol, where('registeredBy', '==', doctorUID), orderBy('createdAt', 'desc'), limit(4));
        const pSnap = await getDocs(pQuery);
        setRecentPatients(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Total Patients Count (approximate for now, using previous logic)
        const [snapAssoc, snapReg] = await Promise.all([
          getDocs(query(patientsCol, where('associatedDoctors', 'array-contains', doctorUID))),
          getDocs(query(patientsCol, where('registeredBy', '==', doctorUID))),
        ]);
        const patientMap = new Map();
        [...snapAssoc.docs, ...snapReg.docs].forEach((d) =>
          patientMap.set(d.id, { id: d.id, ...d.data() })
        );
        const visiblePatientsCount = patientMap.size;

        // Recent Reports
        const colRep = collection(db, 'reports');
        const rQuery = query(colRep, where('doctorUID', '==', doctorUID), orderBy('createdAt', 'desc'), limit(5));
        // Note: if 'createdAt' is missing on some reports, this might fail or return empty. 
        // Fallback to client-side sort if needed, but let's try query first.
        // Actually, let's stick to the previous logic of fetching all and sorting client side for reports to be safe, 
        // but limit to 5 for the UI.
        const [repSnapUID, repSnapId] = await Promise.all([
          getDocs(query(colRep, where('doctorUID', '==', doctorUID))),
          getDocs(query(colRep, where('doctorId', '==', doctorUID))),
        ]);
        const repMap = new Map();
        [...repSnapUID.docs, ...repSnapId.docs].forEach((d) => repMap.set(d.id, { id: d.id, ...d.data() }));
        const repRows = Array.from(repMap.values());
        // Sort by date desc
        repRows.sort((a, b) => (toDate(b?.date)?.getTime() || 0) - (toDate(a?.date)?.getTime() || 0));
        setRecentReports(repRows.slice(0, 4));

        // Recent Articles
        try {
          const articlesCol = collection(db, 'articles');
          const articlesQuery = query(articlesCol, where('authorId', '==', doctorUID), limit(10));
          const articlesSnap = await getDocs(articlesQuery);
          const articlesRows = articlesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          // Sort by date desc
          articlesRows.sort((a, b) => {
            const aDate = toDate(a.publishedAt || a.createdAt || a.updatedAt);
            const bDate = toDate(b.publishedAt || b.createdAt || b.updatedAt);
            return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
          });
          setRecentArticles(articlesRows.slice(0, 4));
        } catch (e) {
          console.error('Error loading articles:', e);
          setRecentArticles([]);
        }

        setCounts({
          appointments: todayAll.length,
          patients: visiblePatientsCount,
          reports: repRows.length,
        });

        // Calculate detailed revenue for today
        const todayAppointments = rows.filter(r => isToday(r._dt));
        let checkupRevenue = 0;
        let followupRevenue = 0;
        let additionalRevenue = 0;

        todayAppointments.forEach((r) => {
          // Only count revenue for completed or confirmed appointments
          const status = String(r.status || '').toLowerCase();
          if (status !== 'completed' && status !== 'confirmed') {
            return; // Skip non-revenue appointments
          }

          const appointmentType = String(r.appointmentType || '').toLowerCase();
          const isFollowUp = appointmentType === 'followup' || appointmentType === 'recheck' || appointmentType === 'follow-up';
          
          // Calculate additional fees first
          let extra = Number(r.additionalFees || 0);
          
          // Sum extra fees from extraFees array if exists
          if (Array.isArray(r.extraFees)) {
            extra += r.extraFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
          } else if (typeof r.extraFees === 'number') {
            extra += r.extraFees;
          }
          
          // Get base price (consultation fee)
          let basePrice = Number(r.doctorPrice || r.checkupFee || r.price || r.fee || 0);
          
          // If totalAmount exists and no base price found, extract base from total
          if (basePrice === 0 && r.totalAmount && Number(r.totalAmount) > 0) {
            const totalAmount = Number(r.totalAmount);
            // If we have additional fees, subtract them to get base price
            if (extra > 0) {
              basePrice = Math.max(0, totalAmount - extra);
            } else {
              // No additional fees, so totalAmount is the base price
              basePrice = totalAmount;
            }
          }
          
          // If still no price, use doctor's default price based on type
          if (basePrice === 0) {
            basePrice = isFollowUp ? followUpPrice : checkupPrice;
          }
          
          // Add to revenue based on type
          if (isFollowUp) {
            followupRevenue += basePrice;
          } else {
            checkupRevenue += basePrice;
          }
          additionalRevenue += extra;
        });

        const totalIncome = checkupRevenue + followupRevenue + additionalRevenue;
        setRevenueDetails({
          total: totalIncome,
          checkup: checkupRevenue,
          followup: followupRevenue,
          additional: additionalRevenue,
        });
        setDailyRevenue(totalIncome);
      } catch (e) {
        console.error(e);
        setErr(e?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [user, isArabic]);

  const addPatient = () => setOpenAddPatient(true);
  const addReport = () => router.push(withLang('/patient-reports/new'));
  const openClinicReports = () => router.push(withLang('/clinic-reports'));
  const openMarketing = () => router.push(withLang('/marketing'));

  if (!mounted) return null;

  const todayPretty = formatLongDate(isArabic);

  return (
    <AppLayout>
      <AddPatientDialog
        open={openAddPatient}
        onClose={() => setOpenAddPatient(false)}
        isArabic={isArabic}
        onSaved={(newId) => router.push(withLang(`/patients/${newId}`))}
      />

      <Box dir={isArabic ? 'rtl' : 'ltr'} sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, sm: 3, md: 4 } }}>

          <Box sx={{ mb: 5 }}>
            <WelcomeBanner
              doctorName={doctorName}
              isArabic={isArabic}
              todayPretty={todayPretty}
              onAddPatient={addPatient}
              onAddReport={addReport}
              onStats={openClinicReports}
              onMarketing={openMarketing}
              remainingAppts={appointments.filter(a => String(a.status).toLowerCase() !== 'completed').length}
            />
          </Box>

          {loading ? (
            <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
              <CircularProgress size={60} thickness={4} />
            </Box>
          ) : err ? (
            <Typography color="error" align="center" sx={{ mt: 4 }}>{err}</Typography>
          ) : (
            <Grid container spacing={4} sx={{ mt: 1 }}>

              {/* Stats Row - Centered in One Row */}
              <Grid item xs={12} sx={{ mb: 4 }}>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 3, textAlign: 'center' }}>
                  {isArabic ? 'نظرة عامة' : 'Overview'}
                </Typography>
                <Grid container spacing={3} justifyContent="center" sx={{ maxWidth: { xs: '100%', md: 1400 }, mx: 'auto' }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatTile
                      icon={<CalendarTodayIcon />}
                      label={{ en: "Today's Appts", ar: 'مواعيد اليوم' }}
                      count={counts.appointments}
                      href="/appointments"
                      isArabic={isArabic}
                      withLang={withLang}
                      color={theme.palette.primary.main}
                      delay={0.1}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatTile
                      icon={<PeopleAltIcon />}
                      label={{ en: 'Total Patients', ar: 'إجمالي المرضى' }}
                      count={counts.patients}
                      href="/patients"
                      isArabic={isArabic}
                      withLang={withLang}
                      color="#00b894"
                      delay={0.2}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <StatTile
                      icon={<AnalyticsIcon />}
                      label={{ en: 'Total Reports', ar: 'التقارير' }}
                      count={counts.reports}
                      href="/patient-reports"
                      isArabic={isArabic}
                      withLang={withLang}
                      color="#6c5ce7"
                      delay={0.3}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <RevenueTile
                      revenueDetails={revenueDetails}
                      isArabic={isArabic}
                      withLang={withLang}
                      delay={0.4}
                    />
                  </Grid>
                </Grid>
              </Grid>

              {/* Weekly Chart - Directly under Stats in Separate Row */}
              <Grid item xs={12} sx={{ width: '100%' }}>
                <Box>
                  <WeeklyChart data={weeklyData} isArabic={isArabic} />
                </Box>
              </Grid>

              {/* Upcoming Appointments & Recent Reports - Side by Side */}
              <Grid item xs={12} md={6}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="h6" fontWeight={800}>
                        {isArabic ? 'القادم اليوم' : 'Up Next'}
                      </Typography>
                      <Link href={withLang('/appointments')} style={{ textDecoration: 'none' }}>
                        <Typography variant="body2" color="primary" fontWeight={700} sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                          {isArabic ? 'عرض الكل' : 'View All'}
                        </Typography>
                      </Link>
                    </Stack>

                    <Stack spacing={2}>
                      {appointments.length === 0 ? (
                        <Paper
                          elevation={0}
                          sx={{
                          p: { xs: 3, sm: 4 },
                            textAlign: 'center',
                            borderRadius: 3,
                            bgcolor: 'background.paper',
                            border: '1px dashed',
                          borderColor: 'divider',
                          minHeight: 180,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 56,
                            height: 56,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                            mb: 2,
                          }}
                        >
                          <CalendarTodayIcon />
                        </Avatar>
                        <Typography variant="body1" fontWeight={600} color="text.primary" sx={{ mb: 0.5 }}>
                            {isArabic ? 'لا توجد مواعيد قادمة اليوم' : 'No upcoming appointments today'}
                          </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {isArabic ? 'يمكنك إضافة مواعيد جديدة من صفحة المواعيد' : 'You can add new appointments from the Appointments page'}
                        </Typography>
                        </Paper>
                      ) : (
                        appointments.map((appt, i) => (
                          <AppointmentItem
                            key={appt.id}
                            appt={appt}
                            isArabic={isArabic}
                            withLang={withLang}
                            index={i}
                            isLast={i === appointments.length - 1}
                            hasAmHours={hasAmHours}
                          />
                        ))
                      )}
                    </Stack>
                  </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <RecentReportsList reports={recentReports} isArabic={isArabic} withLang={withLang} />
              </Grid>

              {/* Main Content: Articles & Recent Patients */}
              <Grid item xs={12} md={8}>
                {/* Recent Articles */}
                <RecentArticlesList articles={recentArticles} isArabic={isArabic} withLang={withLang} />
              </Grid>

              <Grid item xs={12} md={4}>
                {/* Recent Patients */}
                <RecentPatientsList patients={recentPatients} isArabic={isArabic} withLang={withLang} />
              </Grid>

            </Grid>
          )}
        </Container>
      </Box>
    </AppLayout>
  );
}

