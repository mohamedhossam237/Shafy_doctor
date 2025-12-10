'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Paper, Stack, Avatar, Typography, Chip,
  IconButton, Tooltip, Menu, MenuItem
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import UpdatePatientDialog from './UpdatePatientDialog';
import PhoneIcon from '@mui/icons-material/Phone';
export default function PatientCard({ patient, isArabic, onDeleted, onUpdated }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [openEdit, setOpenEdit] = React.useState(false);
  const menuOpen = Boolean(anchorEl);
  const router = useRouter();

  if (!patient || !patient.id) return null;

  const initials = String(patient?.name || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const href = `/patients/${patient.id}${isArabic ? '?lang=ar' : ''}`;

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

  /* -------------------- SMART MESSAGE HANDLER -------------------- */
  const handleMessageClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const phoneRaw = String(patient.phone || '').replace(/\D/g, '');
      if (!phoneRaw) return;

      // 🔹 Always treat as Egyptian number
      const fullPhone = phoneRaw.startsWith('20') ? `+${phoneRaw}` : `+20${phoneRaw.replace(/^0+/, '')}`;

      // Check if user exists in app's "users" collection
      const userSnap = await getDoc(doc(db, 'users', fullPhone));
      if (userSnap.exists()) {
        // Navigate to in-app chat if exists
        router.push(`/chat/${userSnap.id}`);
      } else {
        // Open WhatsApp fallback
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

  return (
    <>
      <Link href={href} style={{ textDecoration: 'none', width: '100%', display: 'block', height: '100%' }}>
        <Paper
          elevation={1}
          sx={{
            p: 2,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            height: '100%',
            minHeight: 120,
            border: '1px solid',
            borderColor: 'divider',
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: 3,
              borderColor: 'primary.main',
              transform: 'translateY(-2px)',
            },
          }}
        >
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              fontWeight: 600,
              width: 48,
              height: 48,
              fontSize: '1rem',
            }}
          >
            {initials}
          </Avatar>

          <Stack sx={{ flex: 1, minWidth: 0 }} spacing={0.5}>
            <Typography variant="subtitle1" fontWeight={700} noWrap color="text.primary">
              {patient.name || (isArabic ? 'بدون اسم' : 'Unnamed')}
            </Typography>
            {patient.phone && (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <PhoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" noWrap>
                  {patient.phone}
                </Typography>
              </Stack>
            )}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {patient.age && (
                <Typography variant="caption" color="text.secondary">
                  {isArabic ? 'العمر: ' : 'Age: '}{patient.age}
                </Typography>
              )}
              {genderLabel && (
                <Chip
                  size="small"
                  label={genderLabel}
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                  }}
                />
              )}
            </Stack>
          </Stack>

          {/* Action Buttons */}
          <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
            {/* Message Button */}
            <Tooltip title={isArabic ? 'إرسال رسالة' : 'Send message'}>
              <IconButton
                size="small"
                onClick={handleMessageClick}
                sx={{
                  color: 'success.main',
                  '&:hover': {
                    bgcolor: 'rgba(76, 175, 80, 0.1)',
                  },
                }}
              >
                <ChatBubbleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Dropdown Menu */}
            <Tooltip title={isArabic ? 'المزيد' : 'More'}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setAnchorEl(e.currentTarget);
                }}
              >
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Stack>
          <Menu
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                setAnchorEl(null);
                setOpenEdit(true);
              }}
            >
              {isArabic ? 'تعديل' : 'Update'}
            </MenuItem>
            <MenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              sx={{ color: 'error.main' }}
            >
              {isArabic ? 'حذف' : 'Delete'}
            </MenuItem>
          </Menu>
        </Paper>
      </Link>

      {/* Update Dialog */}
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
