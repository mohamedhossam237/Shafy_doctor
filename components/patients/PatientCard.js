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
  const initials = String(patient?.name || '?')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const href = `/patients/${patient.id}${isArabic ? '?lang=ar' : ''}`;

  const handleMessageClick = (e) => {
    // prevent the card <Link> navigation when clicking the message button
    e.preventDefault();
    e.stopPropagation();
    if (typeof onMessage === 'function') {
      onMessage({
        id: patient.id,
        name: patient.name || (isArabic ? 'بدون اسم' : 'Unnamed'),
      });
    }
  };

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
            {patient.name || (isArabic ? 'بدون اسم' : 'Unnamed')}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            ID: {patient.id}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {(isArabic ? 'آخر زيارة: ' : 'Last Visit: ') + (patient.lastVisit || '—')}
          </Typography>
        </Stack>

        {patient.gender && <Chip size="small" label={patient.gender} />}

        {/* Message icon (only does something if 'onMessage' prop is provided) */}
        <Tooltip title={isArabic ? 'إرسال رسالة' : 'Send message'}>
          <span>
            <IconButton
              size="small"
              onClick={handleMessageClick}
              aria-label={isArabic ? 'إرسال رسالة' : 'Send message'}
              // Disable if no handler passed
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
