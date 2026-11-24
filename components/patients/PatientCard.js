'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Paper,
  Stack,
  Avatar,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Box,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import PhoneIcon from '@mui/icons-material/Phone';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import UpdatePatientDialog from './UpdatePatientDialog';

export default function PatientCard({ patient, isArabic, onDeleted, onUpdated }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [openEdit, setOpenEdit] = React.useState(false);
  const menuOpen = Boolean(anchorEl);
  const router = useRouter();

  if (!patient || !patient.id) return null;

  const initials = String(patient?.name || '?')
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const href = `/patients/${patient.id}${isArabic ? '?lang=ar' : '?lang=en'}`;

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'patients', patient.id));
      onDeleted?.(patient.id);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setAnchorEl(null);
    }
  };

  const handleMessageClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const phoneRaw = String(patient.phone || '').replace(/\D/g, '');
      if (!phoneRaw) return;

      const phoneDigits = phoneRaw.replace(/^0+/, '');
      const fullPhone = phoneDigits.startsWith('20') ? `+${phoneDigits}` : `+20${phoneDigits}`;

      const userSnap = await getDoc(doc(db, 'users', fullPhone));
      if (userSnap.exists()) {
        router.push(`/chat/${userSnap.id}`);
      } else {
        const url = `https://wa.me/${fullPhone}?text=${encodeURIComponent(
          isArabic
            ? 'مرحباً، أنا الطبيب من تطبيق شافي.'
            : 'Hello, I am the doctor from Shafy app.'
        )}`;
        window.open(url, '_blank');
      }
    } catch (err) {
      console.error('Message error:', err);
    }
  };

  const genderLabel = (() => {
    const g = (patient.gender || '').toLowerCase();
    if (!isArabic) return patient.gender || '';
    if (g === 'male') return 'ذكر';
    if (g === 'female') return 'أنثى';
    if (g === 'other') return 'أخرى';
    return patient.gender || '';
  })();

  const hasAlerts =
    Boolean(String(patient.allergies || '').trim()) ||
    Boolean(String(patient.conditions || '').trim()) ||
    Boolean(patient.isDiabetic);

  const relationLabel = (() => {
    const r = patient.familyRelation;
    if (!r || r === 'himself') return '';
    if (!isArabic) return r.charAt(0).toUpperCase() + r.slice(1);
    const map = { son: 'ابن', wife: 'زوجة', mom: 'أم', dad: 'أب' };
    return map[r] || r;
  })();

  return (
    <>
      <Link href={href} style={{ textDecoration: 'none', width: '100%', display: 'block', height: '100%', minWidth: 0 }}>
        <Paper
          elevation={0}
          className="glass-panel glass-panel-lift"
          sx={{
            p: 2,
            borderRadius: '18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 1.5,
            height: '100%',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {/* Top Row: Avatar + Name/Phone + Actions */}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Avatar
                variant="rounded"
                sx={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  color: '#ffffff',
                  fontWeight: 900,
                  width: 46,
                  height: 46,
                  borderRadius: '13px',
                  fontSize: '0.98rem',
                  boxShadow: '0 6px 14px -4px rgba(37, 99, 235, 0.36)',
                }}
              >
                {initials}
              </Avatar>
              {hasAlerts && (
                <Box
                  title={isArabic ? 'يوجد تنبيهات طبية أو حساسية' : 'Has clinical alerts'}
                  sx={{
                    position: 'absolute',
                    top: -3,
                    right: -3,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: '#ef4444',
                    border: '2px solid #ffffff',
                  }}
                />
              )}
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={900} noWrap sx={{ color: '#0f172a', lineHeight: 1.25 }}>
                {patient.name || (isArabic ? 'بدون اسم' : 'Unnamed')}
              </Typography>
              {patient.phone && (
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.3 }}>
                  <PhoneIcon sx={{ fontSize: 13, color: '#64748b', flexShrink: 0 }} />
                  <Typography variant="caption" noWrap sx={{ color: '#64748b', fontWeight: 700, direction: 'ltr' }}>
                    {patient.phone}
                  </Typography>
                </Stack>
              )}
            </Box>

            <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
              <Tooltip title={isArabic ? 'رسالة واتساب / محادثة' : 'Send message'}>
                <IconButton
                  size="small"
                  onClick={handleMessageClick}
                  sx={{
                    color: '#059669',
                    bgcolor: '#ecfdf5',
                    '&:hover': { bgcolor: '#d1fae5' },
                  }}
                >
                  <ChatBubbleOutlineIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title={isArabic ? 'خيارات' : 'More'}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
                  }}
                  sx={{ color: '#64748b' }}
                >
                  <MoreVertIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Bottom Meta Chips Row */}
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ pt: 1, borderTop: '1px solid #f1f5f9' }}
          >
            {(Number.isFinite(patient?.age) || patient?.age) && (
              <Chip
                size="small"
                label={`${patient.age} ${isArabic ? 'سنة' : 'yrs'}`}
                sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155' }}
              />
            )}
            {genderLabel && (
              <Chip
                size="small"
                label={genderLabel}
                sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#eff6ff', color: '#1d4ed8' }}
              />
            )}
            {patient.bloodType && (
              <Chip
                size="small"
                icon={<BloodtypeIcon sx={{ fontSize: '13px !important', color: '#dc2626 !important' }} />}
                label={patient.bloodType}
                sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#fef2f2', color: '#b91c1c', fontWeight: 900 }}
              />
            )}
            {relationLabel && (
              <Chip
                size="small"
                label={relationLabel}
                sx={{ height: 22, fontSize: '0.7rem', bgcolor: '#eef2ff', color: '#4338ca' }}
              />
            )}
            {!patient.age && !genderLabel && !patient.bloodType && !relationLabel && (
              <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                {isArabic ? 'اضغط لاستكمال الملف الطبي' : 'Click to view & complete profile'}
              </Typography>
            )}
          </Stack>

          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: isArabic ? 'left' : 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: isArabic ? 'left' : 'right' }}
          >
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setAnchorEl(null);
                setOpenEdit(true);
              }}
            >
              {isArabic ? 'تعديل البيانات' : 'Edit Profile'}
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              sx={{ color: 'error.main' }}
            >
              {isArabic ? 'حذف المريض' : 'Delete'}
            </MenuItem>
          </Menu>
        </Paper>
      </Link>

      <UpdatePatientDialog
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        patient={patient}
        isArabic={isArabic}
        onUpdated={onUpdated}
      />
    </>
  );
}
