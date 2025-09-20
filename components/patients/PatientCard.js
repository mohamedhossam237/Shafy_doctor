// /components/patients/PatientCard.jsx
'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Paper, Stack, Avatar, Typography, Chip,
  IconButton, Tooltip
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';

export default function PatientCard({ patient, isArabic, onMessage }) {
  // ---- show only if all required basics exist ----
  const hasBasics =
    Boolean(patient?.name?.trim()) &&
    (patient?.age !== undefined && patient?.age !== null && String(patient.age).trim() !== '') &&
    Boolean(patient?.phone?.trim()) &&
    Boolean(patient?.gender?.trim()) &&
    Boolean(patient?.address?.trim());

  if (!hasBasics) return null;

  // ---- UI prep ----
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
      onMessage({
        id: patient.id,
        name: patient.name,
      });
    }
  };

  const genderLabel = (() => {
    const g = (patient.gender || '').toLowerCase();
    if (!isArabic) return patient.gender;
    if (g === 'male') return 'ذكر';
    if (g === 'female') return 'أنثى';
    if (g === 'other') return 'أخرى';
    return patient.gender; // fallback
  })();

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <Paper
        sx={{
          p: 2,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          height: 118,
        }}
      >
        <Avatar sx={{ bgcolor: 'primary.main' }}>{initials}</Avatar>

        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>
            {patient.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {(isArabic ? 'العمر: ' : 'Age: ') + patient.age}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {(isArabic ? 'الهاتف: ' : 'Phone: ') + patient.phone}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap title={patient.address}>
            {(isArabic ? 'العنوان: ' : 'Address: ') + patient.address}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {(isArabic ? 'آخر زيارة: ' : 'Last Visit: ') + (patient.lastVisit || '—')}
          </Typography>
        </Stack>

        {patient.gender && <Chip size="small" label={genderLabel} />}

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
