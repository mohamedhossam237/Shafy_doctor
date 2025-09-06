// components/ClinicHoursSection.jsx
'use client';
import * as React from 'react';
import { Grid, TextField, Button, Typography, Stack, Alert } from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import SectionCard from '@/components/ui/SectionCard';

export default function ClinicHoursSection({
  form, setForm, workingHours, setOpenHours, isArabic, doctorId,
}) {
  const L = (en, ar) => (isArabic ? ar : en);
  const missingDoctor = !doctorId;

  return (
    <SectionCard
      title={L('Clinic Information', 'بيانات العيادة')}
      icon={<BusinessIcon />}
      isArabic={isArabic}
      actions={
        <Button
          variant="outlined"
          onClick={() => setOpenHours(true)}
          disabled={missingDoctor}
        >
          {L('Edit Working Hours','تعديل مواعيد العمل')}
        </Button>
      }
    >
      {missingDoctor && (
        <Alert severity="error" sx={{ mb: 2 }}>
          لا يمكن الحفظ: معرّف الطبيب غير موجود.
        </Alert>
      )}

      <Grid container spacing={2}>
        {[
          ['clinicName', L('Clinic Name','اسم العيادة')],
          ['clinicAddress', L('Address','العنوان')],
          ['clinicCity', L('City','المدينة')],
          ['clinicCountry', L('Country','الدولة')],
          ['latitude', L('Latitude (optional)','خط العرض (اختياري)')],
          ['longitude', L('Longitude (optional)','خط الطول (اختياري)')],
        ].map(([k, label]) => (
          <Grid key={k} item xs={12} md={6}>
            <TextField
              fullWidth
              label={label}
              value={form?.[k] ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              type={k === 'latitude' || k === 'longitude' ? 'number' : 'text'}
              inputProps={k === 'latitude' || k === 'longitude' ? { step: 'any', inputMode: 'decimal' } : undefined}
            />
          </Grid>
        ))}
        <Grid item xs={12}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {workingHours
                ? L('Working hours configured','تم إعداد مواعيد العمل')
                : L('Working hours not set','مواعيد العمل غير مُعدة')}
            </Typography>
          </Stack>
        </Grid>
      </Grid>
    </SectionCard>
  );
}
