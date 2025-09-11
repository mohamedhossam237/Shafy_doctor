'use client';

import * as React from 'react';
import { Grid, TextField } from '@mui/material';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import BaseDialog from './BaseDialog';

export default function EditClinicDialog({ open, onClose, isArabic = false, clinic = {}, onSaved }) {
  const { user } = useAuth();
  const [form, setForm] = React.useState({
    name: clinic?.name || '',
    address: clinic?.address || '',
    city: clinic?.city || '',
    phone: clinic?.phone || '',
    whatsapp: clinic?.whatsapp || '',
    mapUrl: clinic?.mapUrl || '',
  });

  React.useEffect(() => {
    setForm({
      name: clinic?.name || '',
      address: clinic?.address || '',
      city: clinic?.city || '',
      phone: clinic?.phone || '',
      whatsapp: clinic?.whatsapp || '',
      mapUrl: clinic?.mapUrl || '',
    });
  }, [clinic]);

  const t = (en, ar) => (isArabic ? ar : en);
  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');
    await updateDoc(doc(db, 'doctors', user.uid), { clinic: form });
    onSaved?.();
  };

  return (
    <BaseDialog open={open} onClose={onClose} onSave={onSave} title={t('Clinic Details','بيانات العيادة')} isArabic={isArabic}>
      <Grid container spacing={1.25}>
        <Grid item xs={12}><TextField fullWidth label={t('Clinic name','اسم العيادة')} value={form.name} onChange={onChange('name')} /></Grid>
        <Grid item xs={12}><TextField fullWidth label={t('Address','العنوان')} value={form.address} onChange={onChange('address')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label={t('City','المدينة')} value={form.city} onChange={onChange('city')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label={t('Phone','الهاتف')} value={form.phone} onChange={onChange('phone')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label="WhatsApp" value={form.whatsapp} onChange={onChange('whatsapp')} /></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth label={t('Google Maps URL','رابط خرائط جوجل')} value={form.mapUrl} onChange={onChange('mapUrl')} /></Grid>
      </Grid>
    </BaseDialog>
  );
}
