// /components/Profile/HoursGrid.jsx
import * as React from 'react';
import { Grid, Paper, Typography } from '@mui/material';

export default function HoursGrid({ hours = {}, rtl }) {
  const days = [
    { k: 'mon', en: 'Mon', ar: 'الإثنين' },
    { k: 'tue', en: 'Tue', ar: 'الثلاثاء' },
    { k: 'wed', en: 'Wed', ar: 'الأربعاء' },
    { k: 'thu', en: 'Thu', ar: 'الخميس' },
    { k: 'fri', en: 'Fri', ar: 'الجمعة' },
    { k: 'sat', en: 'Sat', ar: 'السبت' },
    { k: 'sun', en: 'Sun', ar: 'الأحد' },
  ];

  const fmt = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (v.open) return `${v.start || '—'} – ${v.end || '—'}`;
      return rtl ? 'مغلق' : 'Closed';
    }
    if (Array.isArray(v)) return v.join(' • ');
    return v || (rtl ? 'مغلق' : 'Closed');
  };

  return (
    <Grid container spacing={1}>
      {days.map((d) => {
        const v = hours?.[d.k];
        return (
          <Grid item xs={6} sm={4} key={d.k}>
            <Paper variant="outlined" sx={{ p: 1, borderRadius: 2, textAlign: rtl ? 'right' : 'left', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={800}>
                {rtl ? d.ar : d.en}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                {fmt(v)}
              </Typography>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}
