'use client';

import * as React from 'react';
import { Stack, Grid, TextField, IconButton, Button } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import BaseDialog from './BaseDialog';

export default function EditAwardsDialog({ open, onClose, isArabic = false, awards = [], onSaved }) {
  const { user } = useAuth();
  const [rows, setRows] = React.useState(awards?.length ? awards : [{ title: '', year: '' }]);
  React.useEffect(() => setRows(awards?.length ? awards : [{ title: '', year: '' }]), [awards]);

  const t = (en, ar) => (isArabic ? ar : en);
  const update = (i, k, v) => setRows((r) => { const n = [...r]; n[i] = { ...n[i], [k]: v }; return n; });
  const add = () => setRows((r) => [...r, { title: '', year: '' }]);
  const remove = (i) => setRows((r) => (r.length <= 1 ? [{ title: '', year: '' }] : r.filter((_, idx) => idx !== i)));

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');
    const clean = rows.filter((x) => Object.values(x).some((v) => String(v || '').trim()));
    await updateDoc(doc(db, 'doctors', user.uid), { awards: clean });
    onSaved?.();
  };

  return (
    <BaseDialog open={open} onClose={onClose} onSave={onSave} title={t('Awards','الجوائز')} isArabic={isArabic}>
      <Stack spacing={1.25}>
        {rows.map((row, i) => (
          <Grid key={i} container spacing={1}>
            <Grid item xs={12} md={9}><TextField fullWidth label={t('Title','العنوان')} value={row.title} onChange={(e) => update(i, 'title', e.target.value)} /></Grid>
            <Grid item xs={10} md={2.5}><TextField fullWidth label={t('Year','السنة')} value={row.year} onChange={(e) => update(i, 'year', e.target.value)} /></Grid>
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
