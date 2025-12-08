'use client';

import * as React from 'react';
import {
  Stack, TextField, Button, Chip, Grid, IconButton, Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';

import BaseDialog from './BaseDialog';

const makeId = () => `svc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

export default function EditServicesDialog({
  open,
  onClose,
  isArabic = false,
  /** pass doctor.extraServices or [] */
  services = [],
  onSaved,
}) {
  const { user } = useAuth();

  // Normalize inbound (strings -> objects) for back-compat
  const normalize = React.useCallback((arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(Boolean)
      .map((x) => {
        if (typeof x === 'string') {
          return { id: makeId(), name_ar: x, name_en: '', price: 0, active: true };
        }
        return {
          id: x.id || makeId(),
          name_ar: x.name_ar || x.name || '',
          name_en: x.name_en || '',
          price: Number(x.price || 0) || 0,
          active: x.active !== false,
        };
      });
  }, []);

  const [list, setList] = React.useState(normalize(services));
  const [name, setName] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [editName, setEditName] = React.useState('');
  const [editPrice, setEditPrice] = React.useState('');

  React.useEffect(() => {
    setList(normalize(services));
  }, [services, normalize]);

  const t = (en, ar) => (isArabic ? ar : en);

  const add = () => {
    const nm = String(name || '').trim();
    const pr = Number(price);
    if (!nm) return;
    if (!Number.isFinite(pr) || pr <= 0) return;
    setList((prev) => [...prev, { id: makeId(), name_ar: nm, name_en: '', price: pr, active: true }]);
    setName('');
    setPrice('');
  };

  const startEdit = (svc) => {
    setEditingId(svc.id);
    setEditName(svc.name_ar || svc.name_en || '');
    setEditPrice(String(svc.price ?? ''));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditPrice('');
  };

  const saveEdit = (svc) => {
    const nm = String(editName || '').trim();
    const pr = Number(editPrice);
    if (!nm) return;
    if (!Number.isFinite(pr) || pr <= 0) return;
    setList((prev) => prev.map((x) => (x.id === svc.id ? { ...x, name_ar: nm, price: pr } : x)));
    cancelEdit();
  };

  const removeAt = (id) => setList((prev) => prev.filter((x) => x.id !== id));

  const onSave = async () => {
    if (!user?.uid) throw new Error('Not signed in');

    // Fetch once to merge safely and keep other fields
    const ref = doc(db, 'doctors', user.uid);
    const snap = await getDoc(ref);
    const base = snap.exists() ? snap.data() : {};

    const payload = {
      extraServices: list.map((e) => ({
        id: e.id || makeId(),
        name_ar: e.name_ar || '',
        name_en: e.name_en || '',
        price: Number(e.price || 0) || 0,
        active: e.active !== false,
      })),
      updatedAt: serverTimestamp(),
    };

    try {
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, payload, { merge: true });
      }
    } catch {
      // fallback merge
      await setDoc(ref, payload, { merge: true });
    }

    onSaved?.();
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      onSave={onSave}
      title={t('Services Offered (with prices)', 'الخدمات المقدّمة (بالأسعار)')}
      isArabic={isArabic}
    >
      <Stack spacing={1.25}>
        {/* Add row */}
        <Grid container spacing={1}>
          <Grid item xs={12} md={7}>
            <TextField
              size="small"
              fullWidth
              label={t('Service name (Arabic)', 'اسم الخدمة (عربي)')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Grid>
          <Grid item xs={7} md={3}>
            <TextField
              size="small"
              fullWidth
              type="number"
              label={t('Price', 'السعر')}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Grid>
          <Grid item xs={5} md={2} sx={{ display: 'flex', alignItems: 'stretch' }}>
            <Button
              onClick={add}
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ borderRadius: 2, width: '100%' }}
            >
              {t('Add', 'إضافة')}
            </Button>
          </Grid>
        </Grid>

        {/* List */}
        <Stack spacing={1}>
          {list.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('No services yet.', 'لا توجد خدمات بعد.')}
            </Typography>
          ) : (
            list.map((svc) => {
              const editing = editingId === svc.id;
              return (
                <Grid key={svc.id} container spacing={1} alignItems="center">
                  {editing ? (
                    <>
                      <Grid item xs={12} md={7}>
                        <TextField
                          size="small"
                          fullWidth
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          label={t('Service name (Arabic)', 'اسم الخدمة (عربي)')}
                        />
                      </Grid>
                      <Grid item xs={7} md={3}>
                        <TextField
                          size="small"
                          fullWidth
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          label={t('Price', 'السعر')}
                        />
                      </Grid>
                      <Grid item xs={5} md={2}>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton aria-label={t('Save', 'حفظ')} onClick={() => saveEdit(svc)}><CheckIcon /></IconButton>
                          <IconButton aria-label={t('Cancel', 'إلغاء')} onClick={cancelEdit}><CloseIcon /></IconButton>
                        </Stack>
                      </Grid>
                    </>
                  ) : (
                    <>
                      <Grid item xs={12} md={9}>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                          <Chip label={svc.name_ar || '—'} sx={{ fontWeight: 800 }} />
                          <Chip label={`${Number(svc.price || 0)} ${isArabic ? 'ج.م' : 'EGP'}`} />
                        </Stack>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton aria-label={t('Edit', 'تعديل')} onClick={() => startEdit(svc)}><EditIcon /></IconButton>
                          <IconButton aria-label={t('Delete', 'حذف')} onClick={() => removeAt(svc.id)}><DeleteOutlineIcon color="error" /></IconButton>
                        </Stack>
                      </Grid>
                    </>
                  )}
                </Grid>
              );
            })
          )}
        </Stack>
      </Stack>
    </BaseDialog>
  );
}
