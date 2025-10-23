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
      <Link href={href} style={{ textDecoration: 'none', width: '100%' }}>
        <Paper
          sx={{
            p: 2,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1.8,
            height: 130,
            width: '100%',
            boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
            transition: 'all 0.25s ease',
            '&:hover': {
              boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
              transform: 'translateY(-3px)',
            },
          }}
        >
          <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 600 }}>
            {initials}
          </Avatar>

          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>
              {patient.name || (isArabic ? 'بدون اسم' : 'Unnamed')}
            </Typography>
            {patient.phone && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {(isArabic ? 'الهاتف: ' : 'Phone: ') + patient.phone}
              </Typography>
            )}
            {patient.age && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {(isArabic ? 'العمر: ' : 'Age: ') + patient.age}
              </Typography>
            )}
            {patient.address && (
              <Typography variant="caption" color="text.secondary" noWrap title={patient.address}>
                {(isArabic ? 'العنوان: ' : 'Address: ') + patient.address}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" noWrap>
              {(isArabic ? 'آخر زيارة: ' : 'Last Visit: ') + (patient.lastVisit || '—')}
            </Typography>
          </Stack>

          {genderLabel && <Chip size="small" label={genderLabel} />}

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

          {/* Message Button */}
          <Tooltip title={isArabic ? 'إرسال رسالة' : 'Send message'}>
            <IconButton size="small" onClick={handleMessageClick}>
              <ChatBubbleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
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
