'use client';
import * as React from 'react';
import { Grid, TextField, InputAdornment } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import SectionWrapper from './SectionWrapper';

/**
 * MetaSection — general metadata: title (ar/en), date/time
 */
export default function MetaSection({ t, form, setForm, errors, imgbbURL }) {
  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <SectionWrapper
      icon={<EventIcon fontSize="small" />}
      title={t('Report Meta (optional if image attached)', 'بيانات التقرير (اختياري عند إرفاق صورة)')}
    >
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label={t('Title (Arabic)', 'العنوان (عربي)')}
            fullWidth
            value={form.titleAr}
            onChange={onChange('titleAr')}
            error={!imgbbURL && Boolean(errors.titleAr)}
            helperText={!imgbbURL && errors.titleAr ? t('Enter at least one title', 'أدخل عنواناً واحداً على الأقل') : ' '}
            inputProps={{ maxLength: 80 }}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label={t('Title (English)', 'العنوان (إنجليزي)')}
            fullWidth
            value={form.titleEn}
            onChange={onChange('titleEn')}
            error={!imgbbURL && Boolean(errors.titleEn)}
            helperText={!imgbbURL && errors.titleEn ? t('Enter at least one title', 'أدخل عنواناً واحداً على الأقل') : ' '}
            inputProps={{ maxLength: 80 }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            type="datetime-local"
            label={t('Date', 'التاريخ')}
            value={form.dateStr}
            onChange={onChange('dateStr')}
            fullWidth
            InputLabelProps={{ shrink: true }}
            error={!imgbbURL && Boolean(errors.dateStr)}
            helperText={!imgbbURL && errors.dateStr ? t('Invalid', 'غير صالح') : ' '}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EventIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      </Grid>
    </SectionWrapper>
  );
}
