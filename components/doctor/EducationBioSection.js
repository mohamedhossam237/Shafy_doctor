'use client';
import * as React from 'react';
import { Grid, TextField } from '@mui/material';
import SectionCard from '@/components/ui/SectionCard';
import SchoolIcon from '@mui/icons-material/School';

export default function EducationBioSection({ form, setForm, isArabic }) {
  const L = (en, ar) => (isArabic ? ar : en);
  return (
    <SectionCard
      title={L('Education & Qualifications', 'التعليم والمؤهلات')}
      icon={<SchoolIcon />}
      isArabic={isArabic}
    >
      <Grid container spacing={2}>
        {[
          ['universityEn','University/College'],
          ['universityAr','الجامعة'],
          ['qualificationEn','Qualifications'],
          ['qualificationAr','المؤهلات'],
          ['graduationYear', L('Graduation Year','سنة التخرج')],
          ['experience', L('Years of Experience','سنوات الخبرة')],
        ].map(([k, label]) => (
          <Grid key={k} item xs={12} md={6}>
            <TextField fullWidth label={label} value={form[k]} onChange={(e)=>setForm((f)=>({...f,[k]:e.target.value}))}/>
          </Grid>
        ))}
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="Short Bio" multiline minRows={3} value={form.bioEn} onChange={(e)=>setForm((f)=>({...f,bioEn:e.target.value}))}/>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField fullWidth label="نبذة عنك" multiline minRows={3} value={form.bioAr} onChange={(e)=>setForm((f)=>({...f,bioAr:e.target.value}))}/>
        </Grid>
      </Grid>
    </SectionCard>
  );
}
