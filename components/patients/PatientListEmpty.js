// /components/patients/PatientListEmpty.jsx
'use client';

import * as React from 'react';
import { Paper, Stack, Typography, Button } from '@mui/material';

export default function PatientListEmpty({ isArabic = true, onAddNew }) {
  const t = (en, ar) => (isArabic ? ar : en);

  const handleClick = (e) => {
    // Prevent any parent <form> from submitting or navigation happening
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (typeof onAddNew === 'function') onAddNew();
  };

  return (
    <Paper
      elevation={1}
      sx={{
        p: 3,
        borderRadius: 2,
        textAlign: 'center',
      }}
    >
      <Stack spacing={1.25} alignItems="center">
        <Typography variant="h6" fontWeight={800}>
          {t('No patients found', 'لا يوجد مرضى')}
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          {t('Add your first patient to get started.', 'أضف أول مريض لبدء المتابعة.')}
        </Typography>
      </Stack>
    </Paper>
  );
}
