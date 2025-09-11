'use client';

import * as React from 'react';
import { TextField, Grid } from '@mui/material';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import BaseDialog from './BaseDialog';

export default function EditOverviewDialog({ open, onClose, isArabic = false, doctor = {}, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = React.useState({
    bio_en: doctor?.bio_en || '',
    bio_ar: doctor?.bio_ar || '',
    qualifications_en: doctor?.qualifications_en || '',
    qualifications_ar: doctor?.qualifications_ar || '',
    university_en: doctor?.university_en || '',
    university_ar: doctor?.university_ar || '',
    graduationYear: doctor?.graduationYear || '',
    experienceYears: doctor?.experienceYears ?? '',
    checkupPrice: doctor?.checkupPrice ?? '',
    phone: doctor?.phone || '',
  });

  React.useEffect(() => {
    setForm({
      bio_en: doctor?.bio_en || '',
      bio_ar: doctor?.bio_ar || '',
      qualifications_en: doctor?.qualifications_en || '',
      qualifications_ar: doctor?.qualifications_ar || '',
      university_en: doctor?.university_en || '',
      university_ar: doctor?.university_ar || '',
      graduationYear: doctor?.graduationYear || '',
      experienceYears: doctor?.experienceYears ?? '',
      checkupPrice: doctor?.checkupPrice ?? '',
      phone: doctor?.phone || '',
    });
  }, [doctor]);

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');
    const ref = doc(db, 'doctors', user.uid);
    await updateDoc(ref, {
      bio_en: form.bio_en,
      bio_ar: form.bio_ar,
      qualifications_en: form.qualifications_en,
      qualifications_ar: form.qualifications_ar,
      university_en: form.university_en,
      university_ar: form.university_ar,
      graduationYear: form.graduationYear,
      experienceYears: Number(form.experienceYears) || 0,
      checkupPrice: Number(form.checkupPrice) || 0,
      phone: form.phone,
    });
    onSaved?.();
  };

  const t = (en, ar) => (isArabic ? ar : en);
  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      onSave={onSave}
      title={t('Edit Overview', 'تعديل النظرة العامة')}
      isArabic={isArabic}
    >
      <Grid container spacing={1.25}>
        <Grid item xs={12} md={6}>
          <TextField label={t('Bio (English)', 'نبذة (إنجليزي)')} value={form.bio_en} onChange={onChange('bio_en')} multiline minRows={3} fullWidth />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField label={t('Bio (Arabic)', 'نبذة (عربي)')} value={form.bio_ar} onChange={onChange('bio_ar')} multiline minRows={3} fullWidth />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField label={t('Qualifications (English)', 'المؤهل (إنجليزي)')} value={form.qualifications_en} onChange={onChange('qualifications_en')} fullWidth />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField label={t('Qualifications (Arabic)', 'المؤهل (عربي)')} value={form.qualifications_ar} onChange={onChange('qualifications_ar')} fullWidth />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField label={t('University (English)', 'الجامعة (إنجليزي)')} value={form.university_en} onChange={onChange('university_en')} fullWidth />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField label={t('University (Arabic)', 'الجامعة (عربي)')} value={form.university_ar} onChange={onChange('university_ar')} fullWidth />
        </Grid>

        <Grid item xs={6} md={3}>
          <TextField label={t('Graduation Year', 'سنة التخرج')} value={form.graduationYear} onChange={onChange('graduationYear')} fullWidth />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField type="number" label={t('Experience (years)', 'سنوات الخبرة')} value={form.experienceYears} onChange={onChange('experienceYears')} fullWidth />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField type="number" label={t('Checkup Price', 'سعر الكشف')} value={form.checkupPrice} onChange={onChange('checkupPrice')} fullWidth />
        </Grid>
        <Grid item xs={6} md={3}>
          <TextField label={t('Phone', 'الهاتف')} value={form.phone} onChange={onChange('phone')} fullWidth />
        </Grid>
      </Grid>
    </BaseDialog>
  );
}
