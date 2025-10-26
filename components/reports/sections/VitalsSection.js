'use client';
import * as React from 'react';
import { Grid, TextField } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { alpha } from '@mui/material/styles';
import SectionWrapper from './SectionWrapper';

/**
 * VitalsSection — for entering vital signs safely (null-safe)
 */
export default function VitalsSection({ t, form = {}, setForm }) {
  // Ensure vitals object always exists
  const vitals = {
    bp: form.vitalsBP || '',
    hr: form.vitalsHR || '',
    temp: form.vitalsTemp || '',
    spo2: form.vitalsSpO2 || '',
  };

  const handleChange = (field) => (e) => {
    const val = e.target.value;
    setForm((prev) => ({
      ...prev,
      [`vitals${field.toUpperCase()}`]: val,
    }));
  };

  return (
    <SectionWrapper
      icon={<FavoriteIcon fontSize="small" />}
      title={t('Vital Signs', 'العلامات الحيوية')}
    >
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label={t('Blood Pressure', 'ضغط الدم')}
            placeholder="120/80"
            value={vitals.bp}
            onChange={handleChange('bp')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label={t('Heart Rate', 'نبض القلب')}
            placeholder="70 bpm"
            value={vitals.hr}
            onChange={handleChange('hr')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label={t('Temperature', 'درجة الحرارة')}
            placeholder="37 °C"
            value={vitals.temp}
            onChange={handleChange('temp')}
            fullWidth
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            label={t('SpO₂', 'نسبة الأوكسجين')}
            placeholder="98%"
            value={vitals.spo2}
            onChange={handleChange('spo2')}
            fullWidth
          />
        </Grid>
      </Grid>
    </SectionWrapper>
  );
}
