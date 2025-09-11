'use client';

import * as React from 'react';
import { Grid, TextField } from '@mui/material';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import BaseDialog from './BaseDialog';

export default function EditSocialLinksDialog({ open, onClose, isArabic = false, socials = {}, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = React.useState({
    website: socials?.website || '',
    booking: socials?.booking || '',
    facebook: socials?.facebook || '',
    instagram: socials?.instagram || '',
    twitter: socials?.twitter || '',
    linkedin: socials?.linkedin || '',
    youtube: socials?.youtube || '',
  });

  React.useEffect(() => {
    setForm({
      website: socials?.website || '',
      booking: socials?.booking || '',
      facebook: socials?.facebook || '',
      instagram: socials?.instagram || '',
      twitter: socials?.twitter || '',
      linkedin: socials?.linkedin || '',
      youtube: socials?.youtube || '',
    });
  }, [socials]);

  const t = (en, ar) => (isArabic ? ar : en);
  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');
    await updateDoc(doc(db, 'doctors', user.uid), { socials: form });
    onSaved?.();
  };

  return (
    <BaseDialog open={open} onClose={onClose} onSave={onSave} title={t('Online Presence','التواجد الإلكتروني')} isArabic={isArabic}>
      <Grid container spacing={1.25}>
        <Grid item xs={12} md={6}><TextField fullWidth label="Website" value={form.website} onChange={onChange('website')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label={t('Booking Link','رابط الحجز')} value={form.booking} onChange={onChange('booking')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label="Facebook" value={form.facebook} onChange={onChange('facebook')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label="Instagram" value={form.instagram} onChange={onChange('instagram')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label="Twitter / X" value={form.twitter} onChange={onChange('twitter')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label="LinkedIn" value={form.linkedin} onChange={onChange('linkedin')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label="YouTube" value={form.youtube} onChange={onChange('youtube')} /></Grid>
      </Grid>
    </BaseDialog>
  );
}
