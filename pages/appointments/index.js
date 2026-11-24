// /pages/appointments/index.js
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Box,
  Container,
  Stack,
  Typography,
  Paper,
  Avatar,
  Chip,
  Grid,
  Skeleton,
  Snackbar,
  Alert,
  Button,
  Fab,
  IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TagIcon from '@mui/icons-material/Tag';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import PlaceIcon from '@mui/icons-material/Place';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocationOnIcon from '@mui/icons-material/LocationOn';

import Protected from '@/components/Protected';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { getAppointmentTypeInfo, getTodayEgyptDate } from '@/lib/appointmentUtils';
import { toDayKey } from '@/lib/dates';
import globalCache, { readSessionCache, writeSessionCache } from '@/lib/cache';

/* ---------------- utils ---------------- */

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (val?.toDate) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000);
  try { return new Date(val); } catch { return null; }
}

function normStatus(x) {
  const s = String(x || '').toLowerCase().trim();
  if (['complete', 'completed', 'done', 'finished'].includes(s)) return 'completed';
  if (['confirm', 'confirmed'].includes(s)) return 'confirmed';
  if (['cancel', 'cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['no_show', 'noshow', 'missed', 'absent'].includes(s)) return 'no_show';
  if (['pending', 'scheduled', 'new'].includes(s)) return 'pending';
  return s || 'pending';
}

function isToday(d) {
  if (!d) return false;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const formatted = `${year}-${month}-${day}`;
  
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
  const nowDay = String(now.getDate()).padStart(2, '0');
  const today = `${nowYear}-${nowMonth}-${nowDay}`;
  
  return formatted === today;
}

function formatTime(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(d);
}

// Build Date object from either shape:
// - { appointmentDate: Timestamp/ISO }
// - { date: 'YYYY-MM-DD', time: 'HH:MM' }
function apptDate(appt) {
  if (appt?._dt) return appt._dt; // precomputed
  if (appt?.appointmentDate) return toDate(appt.appointmentDate);
  if (appt?.date) {
    const [y, m, d] = String(appt.date).split('-').map((n) => parseInt(n, 10));
    const [hh = 0, mm = 0] = String(appt.time || '00:00').split(':').map((n) => parseInt(n, 10));
    if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
      return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0);
    }
  }
  return null;
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
      // Helper to convert {start, end} object to string "start-end"
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

// Normalize clinics from the doctor document
const sanitizeClinics = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter(Boolean)
    .map((c) => ({
      id: c.id || c._id || `c_${Math.random().toString(36).slice(2, 8)}`,
      name_en: String(c.name_en || c.name || '').trim(),
      name_ar: String(c.name_ar || c.name || '').trim(),
      active: c.active !== false,
    }));

// Get patient ID from appointment (checking all possible field names)
function getPatientId(appt) {
  if (!appt) return null;
  return appt.patientId || appt.patientUID || appt.patientID || appt.patientUid || null;
}

function getRelationLabel(relation, isArabic) {
  if (!relation || relation === 'himself') return '';
  const map = {
    son: isArabic ? 'ابن' : 'Son',
    wife: isArabic ? 'زوجة' : 'Wife',
    mom: isArabic ? 'أم' : 'Mom',
    dad: isArabic ? 'أب' : 'Dad',
  };
  const label = map[relation] || relation;
  return ` (${label})`;
}

/* ---------------- row/card ---------------- */

function AppointmentCard({ appt, isArabic, onConfirm, confirming, detailHref, clinicLabel, hasAmHours }) {
  const router = useRouter();
  const d = apptDate(appt);
  
  // Smart AM/PM Logic:
  // If the doctor/clinic has NO morning hours (hasAmHours === false),
  // then any AM time (0-11) is likely a data entry error or simple format (3:00) meant to be PM.
  // Force it to PM for display.
  // If they DO have AM hours, we respect the original AM time.
  if (d && !hasAmHours) {
    const h = d.getHours();
    if (h < 12) {
       d.setHours(h + 12);
    }
  }

  const status = normStatus(appt?.status);
  const completed = status === 'completed';
  const confirmed = status === 'confirmed';
  const cancelled = status === 'cancelled';
  const statusColor = completed ? 'success' : confirmed ? 'info' : cancelled ? 'default' : 'warning';

  const handleCardClick = (e) => {
    // Don't navigate if clicking on buttons or interactive elements
    if (e.target.closest('button') || e.target.closest('a')) {
      return;
    }
    // Don't navigate for cancelled appointments (reference only)
    if (cancelled) {
      return;
    }
    router.push(detailHref);
  };

  return (
    <Paper
      component="div"
      elevation={0}
      onClick={handleCardClick}
      sx={{
        p: 3.5,
        borderRadius: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        background: cancelled 
          ? '#f8fafc'
          : '#ffffff',
        border: '1px solid',
        borderColor: cancelled ? 'rgba(203,213,225,0.7)' : 'rgba(226,232,240,0.9)',
        boxShadow: cancelled 
          ? '0 4px 14px rgba(15,23,42,0.03)'
          : '0 8px 24px -6px rgba(37,99,235,0.08), 0 2px 6px rgba(15,23,42,0.04)',
        contentVisibility: 'auto',
        containIntrinsicSize: '0 140px',
        transition: 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease, border-color 0.22s ease',
        position: 'relative',
        overflow: 'hidden',
        cursor: cancelled ? 'default' : 'pointer',
        opacity: cancelled ? 0.7 : 1,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '5px',
          height: '100%',
          background: completed 
            ? 'linear-gradient(180deg, #4caf50 0%, #66bb6a 50%, #81c784 100%)'
            : confirmed 
            ? 'linear-gradient(180deg, #2196f3 0%, #42a5f5 50%, #64b5f6 100%)'
            : cancelled
            ? 'linear-gradient(180deg, #9e9e9e 0%, #bdbdbd 50%, #e0e0e0 100%)'
            : 'linear-gradient(180deg, #ff9800 0%, #ffb74d 50%, #ffcc80 100%)',
          transition: 'all 0.4s ease',
          boxShadow: completed
            ? '0 0 20px rgba(76, 175, 80, 0.3)'
            : confirmed
            ? '0 0 20px rgba(33, 150, 243, 0.3)'
            : cancelled
            ? '0 0 20px rgba(158, 158, 158, 0.3)'
            : '0 0 20px rgba(255, 152, 0, 0.3)',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          right: '-50%',
          width: '200%',
          height: '200%',
          background: completed
            ? 'radial-gradient(circle, rgba(76, 175, 80, 0.05) 0%, transparent 70%)'
            : confirmed
            ? 'radial-gradient(circle, rgba(33, 150, 243, 0.05) 0%, transparent 70%)'
            : cancelled
            ? 'radial-gradient(circle, rgba(158, 158, 158, 0.05) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255, 152, 0, 0.05) 0%, transparent 70%)',
          opacity: 0,
          transition: 'opacity 0.4s ease',
        },
        '&:hover': {
          transform: cancelled ? 'none' : 'translateY(-6px) scale(1.01)',
          boxShadow: cancelled 
            ? '0 4px 16px rgba(0,0,0,0.03), 0 1px 4px rgba(0,0,0,0.02)'
            : '0 20px 40px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.08)',
          borderColor: cancelled
            ? 'rgba(200,200,200,0.5)'
            : completed
            ? 'rgba(76, 175, 80, 0.3)'
            : confirmed
            ? 'rgba(33, 150, 243, 0.3)'
            : 'rgba(255, 152, 0, 0.3)',
          '&::before': {
            width: '8px',
            boxShadow: completed
              ? '0 0 30px rgba(76, 175, 80, 0.5)'
              : confirmed
              ? '0 0 30px rgba(33, 150, 243, 0.5)'
              : cancelled
              ? '0 0 30px rgba(158, 158, 158, 0.5)'
              : '0 0 30px rgba(255, 152, 0, 0.5)',
          },
          '&::after': {
            opacity: 1,
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              background: completed
                ? 'linear-gradient(135deg, #4caf50, #66bb6a, #81c784)'
                : confirmed
                ? 'linear-gradient(135deg, #2196f3, #42a5f5, #64b5f6)'
                : 'linear-gradient(135deg, #ff9800, #ffb74d, #ffcc80)',
              opacity: 0.3,
              filter: 'blur(8px)',
              transition: 'all 0.4s ease',
            },
          }}
        >
          <Avatar
            sx={{
              width: 72,
              height: 72,
              background: completed
                ? 'linear-gradient(135deg, #4caf50 0%, #66bb6a 50%, #81c784 100%)'
                : confirmed
                ? 'linear-gradient(135deg, #2196f3 0%, #42a5f5 50%, #64b5f6 100%)'
                : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 50%, #ffcc80 100%)',
              boxShadow: completed
                ? '0 8px 24px rgba(76, 175, 80, 0.4), inset 0 2px 4px rgba(255,255,255,0.3)'
                : confirmed
                ? '0 8px 24px rgba(33, 150, 243, 0.4), inset 0 2px 4px rgba(255,255,255,0.3)'
                : '0 8px 24px rgba(255, 152, 0, 0.4), inset 0 2px 4px rgba(255,255,255,0.3)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              zIndex: 1,
              '&:hover': {
                transform: 'scale(1.15) rotate(10deg)',
                boxShadow: completed
                  ? '0 12px 32px rgba(76, 175, 80, 0.5), inset 0 2px 4px rgba(255,255,255,0.4)'
                  : confirmed
                  ? '0 12px 32px rgba(33, 150, 243, 0.5), inset 0 2px 4px rgba(255,255,255,0.4)'
                  : '0 12px 32px rgba(255, 152, 0, 0.5), inset 0 2px 4px rgba(255,255,255,0.4)',
              },
            }}
          >
            {completed ? (
              <CheckCircleIcon sx={{ fontSize: 36, color: 'white', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
            ) : (
              <AccessTimeIcon sx={{ fontSize: 36, color: 'white', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }} />
            )}
          </Avatar>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            bottom: -6,
            right: -6,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.98) 100%)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1)',
            border: '2.5px solid',
            borderColor: 'rgba(255,255,255,0.9)',
            zIndex: 2,
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'scale(1.2) rotate(360deg)',
              boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
            },
          }}
        >
          <Typography variant="caption" fontWeight={800} fontSize="0.7rem" color={statusColor + '.main'}>
            {cancelled ? '—' : `#${appt._queue ?? '—'}`}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1, flexWrap: 'wrap' }} useFlexGap>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            {(() => {
              const patientId = getPatientId(appt);
              const baseName = appt?.patientName || (isArabic ? 'بدون اسم' : 'Unnamed');
              const relationLabel = getRelationLabel(appt?.familyRelation, isArabic);
              const patientName = `${baseName}${relationLabel}`;
              const patientHref = patientId ? `/patients/${patientId}${isArabic ? '?lang=ar' : ''}` : null;
              
              if (patientHref) {
                return (
                  <Link href={patientHref} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      noWrap
                      title={patientName}
                      sx={{
                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        cursor: 'pointer',
                        '&:hover': {
                          opacity: 0.8,
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      {patientName}
                    </Typography>
                  </Link>
                );
              }
              
              return (
                <Typography
                  variant="h6"
                  fontWeight={700}
                  noWrap
                  title={patientName}
                  sx={{
                    background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {patientName}
                </Typography>
              );
            })()}
          </Box>
          {/* Appointment Type Badge */}
          {(() => {
            const typeInfo = getAppointmentTypeInfo(appt, isArabic);
            return (
              <Chip
                size="small"
                label={typeInfo.label}
                sx={{
                  borderRadius: 2.5,
                  height: 28,
                  bgcolor: typeInfo.bgcolor,
                  color: typeInfo.textColor,
                  fontWeight: 800,
                  border: '2px solid',
                  borderColor: typeInfo.border,
                  fontSize: '0.75rem',
                  boxShadow: `0 2px 8px ${typeInfo.color === 'secondary' ? 'rgba(156, 39, 176, 0.2)' : 'rgba(25, 118, 210, 0.2)'}`,
                }}
              />
            );
          })()}
          {clinicLabel ? (
            <Chip
              size="small"
              icon={<LocationOnIcon sx={{ fontSize: 16 }} />}
              label={clinicLabel}
              sx={{
                borderRadius: 2.5,
                height: 28,
                bgcolor: 'rgba(25, 118, 210, 0.08)',
                color: 'primary.main',
                fontWeight: 700,
                border: '1.5px solid',
                borderColor: 'rgba(25, 118, 210, 0.2)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: 'rgba(25, 118, 210, 0.12)',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(25, 118, 210, 0.15)',
                },
              }}
            />
          ) : null}
          {/* Source Badge */}
          {(() => {
            const source = String(appt?.source || '').trim();
            const isDoctorApp = source === 'Doctor_app' || appt?.fromDoctorApp === true;
            const isPatientApp = source === 'patient_app' || appt?.fromPatientApp === true;
            
            // Fallback for old data: if no source and status is 'confirmed' directly, assume Doctor App
            // (Patient app bookings usually start as 'pending', Doctor app bookings are 'confirmed')
            const status = String(appt?.status || '').toLowerCase();
            const isOldDataWithoutSource = !source && !appt?.fromDoctorApp && !appt?.fromPatientApp;
            const isLikelyDoctorApp = isOldDataWithoutSource && status === 'confirmed';
            
            if (isDoctorApp || isLikelyDoctorApp) {
              return (
                <Chip
                  size="small"
                  icon={<TagIcon sx={{ fontSize: 14 }} />}
                  label={isArabic ? 'تطبيق الطبيب' : 'Doctor App'}
                  sx={{
                    borderRadius: 2.5,
                    height: 28,
                    bgcolor: 'rgba(93, 64, 66, 0.15)',
                    color: '#5D4042',
                    fontWeight: 800,
                    border: '2px solid',
                    borderColor: '#5D4042',
                    fontSize: '0.75rem',
                    boxShadow: '0 2px 8px rgba(93, 64, 66, 0.2)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(93, 64, 66, 0.2)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(93, 64, 66, 0.25)',
                    },
                  }}
                />
              );
            }
            
            if (isPatientApp) {
              return (
                <Chip
                  size="small"
                  icon={<TagIcon sx={{ fontSize: 14 }} />}
                  label={isArabic ? 'تطبيق المريض' : 'Patient App'}
                  sx={{
                    borderRadius: 2.5,
                    height: 28,
                    bgcolor: 'rgba(30, 78, 140, 0.15)',
                    color: '#1E4E8C',
                    fontWeight: 800,
                    border: '2px solid',
                    borderColor: '#1E4E8C',
                    fontSize: '0.75rem',
                    boxShadow: '0 2px 8px rgba(30, 78, 140, 0.2)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'rgba(30, 78, 140, 0.2)',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 4px 12px rgba(30, 78, 140, 0.25)',
                    },
                  }}
                />
              );
            }
            
            return null;
          })()}
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            mt: 1,
            p: 1,
            borderRadius: 2,
            bgcolor: 'rgba(25, 118, 210, 0.04)',
            width: 'fit-content',
          }}
        >
          <ScheduleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="body2" color="primary.main" fontWeight={700} fontSize="0.9rem">
            {formatTime(d)}
          </Typography>
        </Stack>
      </Box>

      <Stack direction="column" spacing={1.5} sx={{ flexShrink: 0, alignItems: 'flex-end' }}>
        <Chip
          label={
            isArabic
              ? completed ? 'منجز' : confirmed ? 'مؤكد' : cancelled ? 'ملغي' : 'قيد الانتظار'
              : completed ? 'Completed' : confirmed ? 'Confirmed' : cancelled ? 'Cancelled' : 'Pending'
          }
          color={completed ? 'success' : confirmed ? 'info' : cancelled ? 'default' : 'warning'}
          sx={{
            fontWeight: 800,
            fontSize: '0.8rem',
            height: 32,
            px: 1.5,
            boxShadow: completed
              ? '0 4px 12px rgba(76, 175, 80, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
              : confirmed
              ? '0 4px 12px rgba(33, 150, 243, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
              : cancelled
              ? '0 4px 12px rgba(158, 158, 158, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)'
              : '0 4px 12px rgba(255, 152, 0, 0.3), inset 0 1px 2px rgba(255,255,255,0.3)',
            background: completed
              ? 'linear-gradient(135deg, #4caf50 0%, #66bb6a 50%, #81c784 100%)'
              : confirmed
              ? 'linear-gradient(135deg, #2196f3 0%, #42a5f5 50%, #64b5f6 100%)'
              : cancelled
              ? 'linear-gradient(135deg, #9e9e9e 0%, #bdbdbd 50%, #e0e0e0 100%)'
              : 'linear-gradient(135deg, #ff9800 0%, #ffb74d 50%, #ffcc80 100%)',
            color: 'white',
            border: 'none',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'scale(1.05)',
              boxShadow: completed
                ? '0 6px 16px rgba(76, 175, 80, 0.4), inset 0 1px 2px rgba(255,255,255,0.4)'
                : confirmed
                ? '0 6px 16px rgba(33, 150, 243, 0.4), inset 0 1px 2px rgba(255,255,255,0.4)'
                : cancelled
                ? '0 6px 16px rgba(158, 158, 158, 0.4), inset 0 1px 2px rgba(255,255,255,0.4)'
                : '0 6px 16px rgba(255, 152, 0, 0.4), inset 0 1px 2px rgba(255,255,255,0.4)',
            },
          }}
        />

        {/* Actions */}
        {!cancelled && (
          <Stack direction="row" spacing={1.5}>
            {!completed && !confirmed && (
              <Button
                variant="contained"
                size="small"
                onClick={() => onConfirm?.(appt.id)}
                disabled={confirming}
                sx={{
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontWeight: 800,
                  px: 2.5,
                  py: 1,
                  background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                  boxShadow: '0 4px 16px rgba(25, 118, 210, 0.4), inset 0 1px 2px rgba(255,255,255,0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                    boxShadow: '0 6px 20px rgba(25, 118, 210, 0.5), inset 0 1px 2px rgba(255,255,255,0.4)',
                    transform: 'translateY(-2px) scale(1.02)',
                  },
                  '&:disabled': {
                    background: 'linear-gradient(135deg, #90caf9 0%, #bbdefb 100%)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {confirming ? (isArabic ? 'جارٍ التأكيد…' : 'Confirming…') : (isArabic ? 'تأكيد' : 'Confirm')}
              </Button>
            )}
            <Button
              component={Link}
              href={detailHref}
              size="small"
              variant="outlined"
              sx={{
                borderRadius: 2.5,
                textTransform: 'none',
                fontWeight: 800,
                px: 2.5,
                py: 1,
                borderWidth: 2,
                borderColor: 'primary.main',
                color: 'primary.main',
                bgcolor: 'rgba(25, 118, 210, 0.04)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                '&:hover': {
                  borderWidth: 2.5,
                  borderColor: 'primary.dark',
                  bgcolor: 'rgba(25, 118, 210, 0.08)',
                  transform: 'translateY(-2px) scale(1.02)',
                  boxShadow: '0 6px 20px rgba(25, 118, 210, 0.2)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {isArabic ? 'فتح' : 'Open'}
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

/* ---------------- page ---------------- */

export default function AppointmentsPage() {
  const router = useRouter();
  const isArabic = React.useMemo(() => {
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router.query]);
  const { user } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [ok, setOk] = React.useState('');
  const [todayRows, setTodayRows] = React.useState([]); // base rows for today (unfiltered)
  const [confirmingId, setConfirmingId] = React.useState(null);
  const todayRowsRef = React.useRef([]);

  // Clinics state (for toggle filter)
  const [clinics, setClinics] = React.useState([]);
  const [selectedClinicId, setSelectedClinicId] = React.useState('all');
  const [hasAmHours, setHasAmHours] = React.useState(true); // Default to true (safe) until loaded

  // Load doctor clinics (doc id == user.uid) & check working hours
  React.useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'doctors', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const arr = sanitizeClinics(data?.clinics);
          setClinics(arr);
          // keep selectedClinicId if still present; else reset to 'all'
          if (selectedClinicId !== 'all' && !arr.some((c) => c.id === selectedClinicId)) {
            setSelectedClinicId('all');
          }

          // Check for AM hours
          const hours = normalizeHoursFromAny(data);
          let foundAm = false;
          // Check all days strings "09:00-17:00"
          Object.values(hours).forEach(rangeStr => {
             if (!rangeStr) return;
             // Split by comma in case of multiple ranges "09:00-12:00,14:00-18:00"
             const ranges = rangeStr.split(',');
             ranges.forEach(r => {
                const start = r.split('-')[0]; // "09:00"
                if (start) {
                   const [h] = start.split(':').map(n => parseInt(n, 10));
                   if (Number.isFinite(h) && h < 12) {
                      foundAm = true;
                   }
                }
             });
          });
          setHasAmHours(foundAm);

        } else {
          setClinics([]);
          setSelectedClinicId('all');
        }
      } catch {
        setClinics([]);
        setSelectedClinicId('all');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Load today's appointments for this doctor
  React.useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const sessionKey = `appts_${user.uid}`;

    const cachedRaw = globalCache.appointments || readSessionCache(sessionKey, 3 * 60 * 1000);
    if (cachedRaw && Array.isArray(cachedRaw)) {
      const hydrated = cachedRaw.map((r) => ({ ...r, _dt: apptDate(r) }));
      setTodayRows(hydrated);
      todayRowsRef.current = hydrated;
      setLoading(false);
    }

    (async () => {
      if (!cachedRaw) {
        setLoading(true);
      }
      setError('');

      try {
        const col = collection(db, 'appointments');
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const [snapOldDate, snapNewDate] = await Promise.all([
          getDocs(query(col, where('doctorUID', '==', user.uid), where('date', '==', todayStr))),
          getDocs(query(col, where('doctorId', '==', user.uid), where('date', '==', todayStr))),
        ]);

        if (cancelled) return;

        const map = new Map();
        [...snapOldDate.docs, ...snapNewDate.docs].forEach((docSnap) => {
          map.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
        const initialRows = Array.from(map.values());

        const uniqueMap = new Map();
        initialRows.forEach((row) => {
          const t = row.time || '00:00';
          const pid = getPatientId(row) || row.patientName || 'unknown';
          const key = `${t}_${pid}`;

          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, row);
          } else {
            const existing = uniqueMap.get(key);
            const statusNew = normStatus(row.status);
            const statusOld = normStatus(existing.status);

            if (statusNew === 'completed' && statusOld !== 'completed') {
              uniqueMap.set(key, row);
            } else if (statusNew === 'confirmed' && statusOld !== 'completed' && statusOld !== 'confirmed') {
              uniqueMap.set(key, row);
            }
          }
        });
        const rows = Array.from(uniqueMap.values());

        const todayOnly = rows
          .map((r) => ({ ...r, _dt: apptDate(r) }))
          .filter((r) => isToday(r._dt));

        // Optimistically mark passed confirmed appointments & persist in background (non-blocking!)
        const now = new Date();
        const buffer = 5 * 60 * 1000;
        const toUpdate = todayOnly.filter((r) => {
          if (normStatus(r?.status) !== 'confirmed') return false;
          const dt = r._dt;
          return dt instanceof Date && dt.getTime() + buffer < now.getTime();
        });

        if (toUpdate.length > 0) {
          const updateIds = new Set(toUpdate.map((u) => u.id));
          todayOnly.forEach((r) => {
            if (updateIds.has(r.id)) r.status = 'completed';
          });
          Promise.all(
            toUpdate.map((r) =>
              updateDoc(doc(db, 'appointments', r.id), {
                status: 'completed',
                updatedAt: serverTimestamp(),
              }).catch(() => null)
            )
          );
        }

        setTodayRows(todayOnly);
        todayRowsRef.current = todayOnly;
        globalCache.appointments = todayOnly;
        writeSessionCache(sessionKey, todayOnly);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError(isArabic ? 'تعذر تحميل المواعيد' : 'Failed to load appointments');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // Keep ref in sync with state
  React.useEffect(() => {
    todayRowsRef.current = todayRows;
  }, [todayRows]);

  // Auto-check and update confirmed appointments that passed their time (every minute)
  React.useEffect(() => {
    if (!user) return;

    const checkAndUpdate = async () => {
      const currentRows = todayRowsRef.current;
      if (currentRows.length === 0) return;

      const now = new Date();
      const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds

      const toUpdate = currentRows.filter((r) => {
        const status = normStatus(r?.status);
        if (status !== 'confirmed') return false;
        const dt = r._dt;
        if (!dt || !(dt instanceof Date)) return false;
        return dt.getTime() + buffer < now.getTime();
      });

      // Update in Firestore
      if (toUpdate.length > 0) {
        const updatePromises = toUpdate.map((r) =>
          updateDoc(doc(db, 'appointments', r.id), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          }).catch((err) => {
            console.error(`Failed to auto-complete appointment ${r.id}:`, err);
            return null;
          })
        );
        await Promise.all(updatePromises);

        // Update local state
        setTodayRows((prev) =>
          prev.map((r) => {
            if (toUpdate.some((u) => u.id === r.id)) {
              return { ...r, status: 'completed' };
            }
            return r;
          })
        );
      }
    };

    // Check immediately
    checkAndUpdate();

    // Then check every minute
    const interval = setInterval(checkAndUpdate, 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  // Derived: counts per clinic and filtered list
  const clinicNameById = React.useMemo(() => {
    const map = new Map();
    clinics.forEach((c) => {
      const label = isArabic ? (c.name_ar || c.name_en) : (c.name_en || c.name_ar);
      map.set(c.id, label || (isArabic ? 'عيادة' : 'Clinic'));
    });
    return map;
  }, [clinics, isArabic]);

  const countsByClinic = React.useMemo(() => {
    const counts = new Map();
    todayRows.forEach((r) => {
      const cid = r.clinicId || r.clinicID || ''; // legacy safety
      counts.set(cid, (counts.get(cid) || 0) + 1);
    });
    return counts;
  }, [todayRows]);

  const filtered = React.useMemo(() => {
    const base = selectedClinicId === 'all'
      ? todayRows
      : todayRows.filter((r) => (r.clinicId || r.clinicID || '') === selectedClinicId);

    // Separate cancelled and active appointments
    const active = base.filter((r) => normStatus(r?.status) !== 'cancelled');
    const cancelled = base.filter((r) => normStatus(r?.status) === 'cancelled');

    // Helper to get effective sort time
    const getSortTime = (r) => {
        let t = r._dt?.getTime() || 0;
        // If sorting needs Smart PM adjustment:
        if (!hasAmHours && r._dt) {
            const h = r._dt.getHours();
            if (h < 12) {
                // Return time shifted by 12h
                return t + (12 * 60 * 60 * 1000);
            }
        }
        return t;
    };

    // sort by time, then assign queue numbers only for active appointments
    const sortedActive = [...active].sort((a, b) => getSortTime(a) - getSortTime(b));
    const withQueue = sortedActive.map((r, i) => ({ ...r, _queue: i + 1 }));
    
    // Append cancelled appointments without queue numbers (for reference only)
    const cancelledWithoutQueue = cancelled.map((r) => ({ ...r, _queue: null }));
    
    // Return active appointments first, then cancelled (sorted by time)
    const sortedCancelled = [...cancelledWithoutQueue].sort((a, b) => getSortTime(a) - getSortTime(b));
    return [...withQueue, ...sortedCancelled];
  }, [todayRows, selectedClinicId, hasAmHours]);

  const newHref = `/appointments/new${isArabic ? '?lang=ar' : ''}`;
  const historyHref = `/appointments/history${isArabic ? '?lang=ar' : ''}`;
  const detailHref = (id) => `/appointments/${id}${isArabic ? '?lang=ar' : ''}`;

  const confirmAppt = async (id) => {
    if (!id) return;
    setConfirmingId(id);
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });
      // reflect in UI
      // Update both in todayRows and filtered (filtered is derived, so only update todayRows)
      setTodayRows((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'confirmed' } : a))
      );
      setOk(isArabic ? 'تم التأكيد' : 'Appointment confirmed');
    } catch (e) {
      console.error(e);
      setError(e?.message || (isArabic ? 'فشل التأكيد' : 'Failed to confirm'));
    } finally {
      setConfirmingId(null);
    }
  };

  // Chip label helper (with count)
  const labelForClinicChip = (c) => {
    const base = isArabic ? (c.name_ar || c.name_en || 'عيادة') : (c.name_en || c.name_ar || 'Clinic');
    const n = countsByClinic.get(c.id) || 0;
    return `${base} (${n})`;
  };

  const allLabel = React.useMemo(() => {
    const total = todayRows.length;
    return (isArabic ? 'الكل' : 'All') + ` (${total})`;
  }, [todayRows.length, isArabic]);

  // Statistics
  const stats = React.useMemo(() => {
    const pending = todayRows.filter((r) => normStatus(r?.status) === 'pending').length;
    const confirmed = todayRows.filter((r) => normStatus(r?.status) === 'confirmed').length;
    const completed = todayRows.filter((r) => normStatus(r?.status) === 'completed').length;
    const cancelled = todayRows.filter((r) => normStatus(r?.status) === 'cancelled').length;
    return { pending, confirmed, completed, cancelled, total: todayRows.length };
  }, [todayRows]);

  return (
    <Protected>
      <AppLayout>
        <Box sx={{ position: 'relative', pb: 4 }}>
          <Container maxWidth={false} disableGutters>
            <Stack spacing={3}>
              {/* Header + actions */}
              <div
                className="glass-panel"
                style={{
                  padding: '22px 26px',
                  borderTop: '4px solid #2563eb',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 54,
                        height: 54,
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 22px -4px rgba(37, 99, 235, 0.42)',
                      }}
                    >
                      <CalendarTodayIcon sx={{ fontSize: 27, color: 'white' }} />
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={900} sx={{ color: '#0f172a', fontSize: { xs: '1.35rem', md: '1.6rem' }, mb: 0.25 }}>
                        {isArabic ? 'مواعيد اليوم' : "Today's Appointments"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                        {filtered.length} {isArabic ? 'مواعيد' : 'appointment'}{filtered.length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                    <Button
                      component={Link}
                      href={historyHref}
                      variant="outlined"
                      startIcon={<HistoryIcon />}
                      sx={{ borderRadius: '13px', px: 2.5, py: 1, bgcolor: '#ffffff' }}
                    >
                      {isArabic ? 'السجل' : 'History'}
                    </Button>
                    <Button
                      component={Link}
                      href={newHref}
                      variant="contained"
                      startIcon={<AddIcon />}
                      sx={{ borderRadius: '13px', px: 2.5, py: 1 }}
                    >
                      {isArabic ? 'موعد جديد' : 'New Appointment'}
                    </Button>
                  </Stack>
                </Box>
              </div>

              {/* Statistics Cards (Physio Accent KPIs) */}
              {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div className="glass-panel glass-panel-lift" style={{ padding: '20px', borderTop: '4px solid #2563eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569' }}>
                        {isArabic ? 'إجمالي المواعيد' : 'Total Appointments'}
                      </span>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CalendarTodayIcon sx={{ fontSize: 21 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{stats.total}</div>
                  </div>

                  <div className="glass-panel glass-panel-lift" style={{ padding: '20px', borderTop: '4px solid #0ea5e9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569' }}>
                        {isArabic ? 'مؤكد' : 'Confirmed'}
                      </span>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <EventAvailableIcon sx={{ fontSize: 21 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{stats.confirmed}</div>
                  </div>

                  <div className="glass-panel glass-panel-lift" style={{ padding: '20px', borderTop: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#475569' }}>
                        {isArabic ? 'منجز' : 'Completed'}
                      </span>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DoneAllIcon sx={{ fontSize: 21 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>{stats.completed}</div>
                  </div>
                </div>
              )}

              {/* Clinic filter (toggle chips) */}
              {clinics.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 4,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    border: '1.5px solid',
                    borderColor: 'rgba(255,255,255,0.8)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      overflowX: 'auto',
                      pb: 0.5,
                      px: 0.5,
                      '&::-webkit-scrollbar': { height: 6 },
                      '&::-webkit-scrollbar-thumb': {
                        bgcolor: 'primary.main',
                        borderRadius: 3,
                        opacity: 0.3,
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        opacity: 0.5,
                      },
                    }}
                  >
                    <Chip
                      clickable
                      onClick={() => setSelectedClinicId('all')}
                      color={selectedClinicId === 'all' ? 'primary' : 'default'}
                      variant={selectedClinicId === 'all' ? 'filled' : 'outlined'}
                      label={allLabel}
                      sx={{
                        borderRadius: 2.5,
                        fontWeight: 700,
                        flexShrink: 0,
                        height: 36,
                        transition: 'all 0.2s ease',
                        ...(selectedClinicId === 'all' && {
                          background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                          color: 'white',
                          boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                          '&:hover': {
                            boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
                            transform: 'translateY(-2px)',
                          },
                        }),
                        ...(selectedClinicId !== 'all' && {
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'primary.50',
                            transform: 'translateY(-2px)',
                          },
                        }),
                      }}
                    />
                    {clinics.map((c) => (
                      <Chip
                        key={c.id}
                        clickable
                        onClick={() => setSelectedClinicId(c.id)}
                        color={selectedClinicId === c.id ? 'primary' : 'default'}
                        variant={selectedClinicId === c.id ? 'filled' : 'outlined'}
                        label={labelForClinicChip(c)}
                        sx={{
                          borderRadius: 2.5,
                          fontWeight: 700,
                          flexShrink: 0,
                          height: 36,
                          transition: 'all 0.2s ease',
                          ...(selectedClinicId === c.id && {
                            background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                            color: 'white',
                            boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)',
                            '&:hover': {
                              boxShadow: '0 6px 16px rgba(25, 118, 210, 0.4)',
                              transform: 'translateY(-2px)',
                            },
                          }),
                          ...(selectedClinicId !== c.id && {
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: 'primary.50',
                              transform: 'translateY(-2px)',
                            },
                          }),
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Loading skeletons */}
              {loading ? (
                <Grid container spacing={2}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Grid key={i} item xs={12}>
                      <Skeleton
                        variant="rounded"
                        height={140}
                        sx={{
                          borderRadius: 5,
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.95) 100%)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: '1.5px solid',
                          borderColor: 'rgba(255,255,255,0.8)',
                          position: 'relative',
                          overflow: 'hidden',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                            animation: 'shimmer 1.5s infinite',
                          },
                          '@keyframes shimmer': {
                            '0%': { left: '-100%' },
                            '100%': { left: '100%' },
                          },
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              ) : filtered.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 8,
                    textAlign: 'center',
                    borderRadius: 5,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.95) 100%)',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    border: '2px dashed',
                    borderColor: 'rgba(25, 118, 210, 0.2)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: -100,
                      right: -100,
                      width: 300,
                      height: 300,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(25, 118, 210, 0.08) 0%, transparent 70%)',
                      animation: 'pulse 4s ease-in-out infinite',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      bottom: -80,
                      left: -80,
                      width: 250,
                      height: 250,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(66, 165, 245, 0.06) 0%, transparent 70%)',
                      animation: 'pulse 4s ease-in-out infinite 2s',
                    },
                    '@keyframes pulse': {
                      '0%, 100%': { transform: 'scale(1)', opacity: 1 },
                      '50%': { transform: 'scale(1.1)', opacity: 0.8 },
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.15) 0%, rgba(66, 165, 245, 0.1) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 4,
                      position: 'relative',
                      zIndex: 1,
                      boxShadow: '0 8px 32px rgba(25, 118, 210, 0.2)',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: -4,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #1976d2, #42a5f5)',
                        opacity: 0.2,
                        filter: 'blur(12px)',
                        zIndex: -1,
                      },
                    }}
                  >
                    <CalendarTodayIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.8 }} />
                  </Box>
                  <Typography
                    variant="h5"
                    fontWeight={800}
                    sx={{
                      mb: 1.5,
                      background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {isArabic ? 'لا توجد مواعيد اليوم' : 'No appointments today'}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                    sx={{ mb: 4, maxWidth: 450, mx: 'auto', position: 'relative', zIndex: 1, lineHeight: 1.7 }}
                  >
                    {isArabic
                      ? 'أنشئ موعداً جديداً من صفحة المريض أو استخدم زر "موعد جديد" أعلاه'
                      : 'Create a new appointment from the patient page or use the "New Appointment" button above'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button
                      component={Link}
                      href={historyHref}
                      variant="outlined"
                      startIcon={<HistoryIcon />}
                      sx={{
                        borderRadius: 2.5,
                        textTransform: 'none',
                        fontWeight: 700,
                        px: 2.5,
                        borderWidth: 2,
                        '&:hover': {
                          borderWidth: 2,
                          transform: 'translateY(-2px)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isArabic ? 'السجل' : 'History'}
                    </Button>
                    <Button
                      component={Link}
                      href={newHref}
                      variant="contained"
                      startIcon={<AddIcon />}
                      sx={{
                        borderRadius: 2.5,
                        textTransform: 'none',
                        fontWeight: 700,
                        px: 2.5,
                        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                        boxShadow: '0 4px 16px rgba(25, 118, 210, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                          boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                          transform: 'translateY(-2px)',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isArabic ? 'موعد جديد' : 'New Appointment'}
                    </Button>
                  </Box>
                </Paper>
              ) : (
                <Stack spacing={2.5}>
                  {filtered.map((appt, index) => {
                    const cid = appt.clinicId || appt.clinicID || '';
                    const clinicLabel = cid ? clinicNameById.get(cid) : '';
                    return (
                      <Box
                        key={appt.id}
                        sx={{
                          animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
                          '@keyframes fadeInUp': {
                            '0%': {
                              opacity: 0,
                              transform: 'translateY(20px)',
                            },
                            '100%': {
                              opacity: 1,
                              transform: 'translateY(0)',
                            },
                          },
                        }}
                      >
                        <AppointmentCard
                          appt={appt}
                          isArabic={isArabic}
                          confirming={confirmingId === appt.id}
                          onConfirm={confirmAppt}
                          detailHref={detailHref(appt.id)}
                          clinicLabel={clinicLabel}
                          hasAmHours={hasAmHours}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Stack>

            {/* Floating Action Button (mobile friendly) */}
            <Fab
              color="primary"
              aria-label="add"
              onClick={() => router.push(newHref)}
              sx={{
                position: 'fixed',
                bottom: 88,
                right: isArabic ? 'auto' : 16,
                left: isArabic ? 16 : 'auto',
                zIndex: 1200,
                display: { xs: 'flex', md: 'none' },
                background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
                boxShadow: '0 8px 24px rgba(25, 118, 210, 0.4)',
                width: 56,
                height: 56,
                '&:hover': {
                  background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
                  boxShadow: '0 12px 32px rgba(25, 118, 210, 0.5)',
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <AddIcon />
            </Fab>

            {/* Snackbars */}
            <Snackbar
              open={Boolean(error)}
              autoHideDuration={4000}
              onClose={() => setError('')}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
            </Snackbar>

            <Snackbar
              open={Boolean(ok)}
              autoHideDuration={2500}
              onClose={() => setOk('')}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Alert severity="success" onClose={() => setOk('')}>{ok}</Alert>
            </Snackbar>
          </Container>
        </Box>
      </AppLayout>
    </Protected>
  );
}
