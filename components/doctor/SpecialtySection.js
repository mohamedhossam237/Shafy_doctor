'use client';
import * as React from 'react';
import { Grid, TextField, Button, Typography, Stack } from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import SectionCard from '@/components/ui/SectionCard';

export default function SpecialtySection({
  form, setForm, subspecialties, openSubs, setOpenSubs, isArabic,
}) {
  const L = (en, ar) => (isArabic ? ar : en);
  return (
    <SectionCard
      title={L('Specialty', 'التخصص')}
      icon={<LocalHospitalIcon />}
      isArabic={isArabic}
      actions={
        <Button variant="outlined" onClick={() => setOpenSubs(true)}>
          {L('Edit Subspecialties', 'تعديل التخصصات الفرعية')}
        </Button>
      }
    >
      <Grid container spacing={2}>
        {[
          ['specialtyEn','Specialty'],
          ['specialtyAr','التخصص'],
        ].map(([k, label]) => (
          <Grid key={k} item xs={12} md={6}>
            <TextField fullWidth label={label} value={form[k]} onChange={(e)=>setForm((f)=>({...f,[k]:e.target.value}))}/>
          </Grid>
        ))}
        <Grid item xs={12}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {subspecialties.length
                ? L(`${subspecialties.length} selected`, `تم اختيار ${subspecialties.length}`)
                : L('None selected', 'لا يوجد اختيارات')}
            </Typography>
          </Stack>
        </Grid>
      </Grid>
    </SectionCard>
  );
}
