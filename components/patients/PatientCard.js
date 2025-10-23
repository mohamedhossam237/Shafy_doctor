'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Paper, Stack, Avatar, Typography, Chip,
  IconButton, Tooltip
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';

export default function PatientCard({ patient, isArabic, onMessage }) {
  // show even if data incomplete, only skip if truly invalid
  if (!patient || !patient.id) return null;

  const initials = String(patient?.name || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const href = `/patients/${patient.id}${isArabic ? '?lang=ar' : ''}`;
  const handleMessageClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onMessage === 'function') {
      onMessage({ id: patient.id, name: patient.name || '—' });
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

        <Tooltip title={isArabic ? 'إرسال رسالة' : 'Send message'}>
          <span>
            <IconButton
              size="small"
              onClick={handleMessageClick}
              aria-label={isArabic ? 'إرسال رسالة' : 'Send message'}
              disabled={!onMessage}
            >
              <ChatBubbleOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </Link>
  );
}
