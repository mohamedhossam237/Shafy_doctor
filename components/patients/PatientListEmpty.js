// /components/patients/PatientListEmpty.jsx
'use client';

import * as React from 'react';
import { Paper, Stack, Typography, Button, Box } from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import PeopleIcon from '@mui/icons-material/People';

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
        p: 4,
        borderRadius: 2,
        textAlign: 'center',
        border: '1px dashed',
        borderColor: 'divider',
      }}
    >
      <PeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
      <Stack spacing={2} alignItems="center">
        <Typography variant="h6" fontWeight={700}>
          {t('No patients found', 'لا يوجد مرضى')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('Add your first patient to get started.', 'أضف أول مريض لبدء المتابعة.')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddAlt1Icon />}
          onClick={handleClick}
          sx={{ mt: 1, borderRadius: 2, textTransform: 'none' }}
        >
          {t('Add First Patient', 'إضافة أول مريض')}
        </Button>
      </Stack>
    </Paper>
  );
}
