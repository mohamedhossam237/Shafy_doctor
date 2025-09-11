'use client';

import * as React from 'react';
import { Stack, Grid, TextField, IconButton, Button } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import BaseDialog from './BaseDialog';

export default function EditEducationDialog({ open, onClose, isArabic = false, education = [], onSaved }) {
  const { user } = useAuth();
  const [rows, setRows] = React.useState(education?.length ? education : [{ degree: '', school: '', year: '' }]);
  React.useEffect(() => setRows(education?.length ? education : [{ degree: '', school: '', year: '' }]), [education]);

  const t = (en, ar) => (isArabic ? ar : en);

  const update = (i, k, v) => {
    setRows((r) => {
      const next = [...r];
      next[i] = { ...next[i], [k]: v };
      return next;
    });
  };
  const add = () => setRows((r) => [...r, { degree: '', school: '', year: '' }]);
  const remove = (i) => setRows((r) => (r.length <= 1 ? [{ degree: '', school: '', year: '' }] : r.filter((_, idx) => idx !== i)));

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');
    const clean = rows.filter((x) => Object.values(x).some((v) => String(v || '').trim()));
    await updateDoc(doc(db, 'doctors', user.uid), { education: clean });
    onSaved?.();
  };

  return (
    <BaseDialog open={open} onClose={onClose} onSave={onSave} title={t('Education & Training','التعليم والتدريب')} isArabic={isArabic}>
      <Stack spacing={1.25}>
        {rows.map((row, i) => (
          <Grid key={i} container spacing={1}>
            <Grid item xs={12} md={5}><TextField fullWidth label={t('Degree','الدرجة')} value={row.degree} onChange={(e) => update(i, 'degree', e.target.value)} /></Grid>
            <Grid item xs={12} md={5}><TextField fullWidth label={t('School / Institution','المدرسة / المؤسسة')} value={row.school} onChange={(e) => update(i, 'school', e.target.value)} /></Grid>
            <Grid item xs={10} md={1.5}><TextField fullWidth label={t('Year','السنة')} value={row.year} onChange={(e) => update(i, 'year', e.target.value)} /></Grid>
            <Grid item xs={2} md={0.5} sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton color="error" onClick={() => remove(i)}><DeleteOutlineIcon /></IconButton>
            </Grid>
          </Grid>
        ))}
        <Button startIcon={<AddIcon />} onClick={add} variant="outlined" sx={{ alignSelf: isArabic ? 'flex-start' : 'flex-end' }}>
          {t('Add','إضافة')}
        </Button>
      </Stack>
    </BaseDialog>
  );
}
