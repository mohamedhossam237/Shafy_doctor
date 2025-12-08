'use client';
import * as React from 'react';
import { Grid, TextField } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import SectionCard from '@/components/ui/SectionCard';

export default function SocialLinksSection({ form, setForm, isArabic }) {
  const normalizeWhatsApp = (val) => {
    if (!val) return '';
    const raw = String(val).trim();
    if (raw.startsWith('+')) return raw;
    const digits = raw.replace(/\D+/g, '');
    if (!digits) return '';
    return digits.startsWith('2') ? `+${digits}` : `+2${digits}`;
  };

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
            <TextField
              fullWidth
              label={label}
              value={form[k]}
              onChange={(e)=>{
                const v = k === 'whatsapp' ? normalizeWhatsApp(e.target.value) : e.target.value;
                setForm((f)=>({...f,[k]: v}));
              }}
            />
          </Grid>
        ))}
      </Grid>
    </SectionCard>
  );
}
