'use client';
import * as React from 'react';
import { Grid, TextField } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import SectionCard from '@/components/ui/SectionCard';

export default function SocialLinksSection({ form, setForm, isArabic }) {
  const fields = [
    ['website','Website'],
    ['whatsapp','WhatsApp (full link)'],
    ['facebook','Facebook URL'],
    ['instagram','Instagram URL'],
    ['twitter', 'Twitter/X URL'],
    ['linkedin','LinkedIn URL'],
    ['youtube','YouTube URL'],
    ['tiktok','TikTok URL'],
  ];
  return (
    <SectionCard title={isArabic ? 'التواجد الإلكتروني':'Online Presence'} icon={<LinkIcon/>} isArabic={isArabic}>
      <Grid container spacing={2}>
        {fields.map(([k,label])=>(
          <Grid key={k} item xs={12} md={6}>
            <TextField fullWidth label={label} value={form[k]} onChange={(e)=>setForm((f)=>({...f,[k]:e.target.value}))}/>
          </Grid>
        ))}
      </Grid>
    </SectionCard>
  );
}
