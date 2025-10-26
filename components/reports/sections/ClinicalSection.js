'use client';
import * as React from 'react';
import { Grid, TextField } from '@mui/material';
import HealingIcon from '@mui/icons-material/Healing';
import SectionWrapper from './SectionWrapper';

/**
 * ClinicalSection — fields for chief complaint, findings, diagnosis, procedures
 */
export default function ClinicalSection({ t, form, setForm, errors, imgbbURL }) {
  const onChange = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <SectionWrapper
      icon={<HealingIcon fontSize="small" />}
      title={t('Clinical Details (optional if image attached)', 'التفاصيل السريرية (اختياري عند إرفاق صورة)')}
    >
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TextField
            label={t('Chief Complaint', 'الشكوى الرئيسية')}
            fullWidth
            value={form.chiefComplaint}
            onChange={onChange('chiefComplaint')}
            inputProps={{ maxLength: 160 }}
            helperText={`${form.chiefComplaint.length}/160`}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label={`${t('Diagnosis (ICD if available)', 'التشخيص (إن وُجد ICD)')}${!imgbbURL ? ' *' : ''}`}
            fullWidth
            required={!imgbbURL}
            value={form.diagnosis}
            onChange={onChange('diagnosis')}
            error={!imgbbURL && Boolean(errors.diagnosis)}
            helperText={
              !imgbbURL && errors.diagnosis
                ? t('Diagnosis is required (or attach an image)', 'التشخيص مطلوب (أو أرفق صورة)')
                : `${form.diagnosis.length}/200`
            }
            inputProps={{ maxLength: 200 }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label={t('Findings / Examination', 'النتائج / الفحص')}
            fullWidth
            multiline
            minRows={3}
            value={form.findings}
            onChange={onChange('findings')}
            inputProps={{ maxLength: 800 }}
            helperText={`${form.findings.length}/800`}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            label={t('Procedures (CPT if available)', 'الإجراءات (إن وُجد CPT)')}
            fullWidth
            multiline
            minRows={3}
            value={form.procedures}
            onChange={onChange('procedures')}
            inputProps={{ maxLength: 600 }}
            helperText={`${form.procedures.length}/600`}
          />
        </Grid>
      </Grid>
    </SectionWrapper>
  );
}
