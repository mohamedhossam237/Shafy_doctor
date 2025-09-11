// /components/reports/ReportList.js
'use client';
import * as React from 'react';
import Link from 'next/link';
import { Paper, Box, Stack, Avatar, Typography, Chip } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

function fmt(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(dt);
  } catch { return '—'; }
}

export default function ReportList({ rows, isArabic, withLang, emptyText }) {
  if (!rows || rows.length === 0) {
    return (
      <Paper sx={{ p: 2, mt: 2, borderRadius: 2 }}>
        <Typography color="text.secondary">{emptyText}</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={1.25}>
      {rows.map((r) => {
        const href = r.patientID ? withLang(`/patients/${r.patientID}`) : withLang('/patients');
        const title = isArabic ? (r.titleAr || 'تقرير طبي') : (r.titleEn || 'Medical Report');
        const type = (r.type || '').toString().toLowerCase();

        return (
          <Link key={r.id} href={href} style={{ textDecoration: 'none' }}>
            <Paper
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                boxShadow: '0 1px 0 rgba(0,0,0,.03), 0 8px 18px rgba(0,0,0,.06)',
                textAlign: isArabic ? 'right' : 'left',
                flexDirection: isArabic ? 'row-reverse' : 'row',
              }}
            >
              <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                <DescriptionIcon />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={800} noWrap>{title}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {r.date ? fmt(r.date) : '—'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {!!type && <Chip size="small" label={type} variant="outlined" />}
                <ChevronRightIcon
                  sx={{ color: 'text.disabled', transform: isArabic ? 'rotate(180deg)' : 'none' }}
                />
              </Stack>
            </Paper>
          </Link>
        );
      })}
    </Stack>
  );
}
