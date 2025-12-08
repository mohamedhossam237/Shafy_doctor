// components/Profile/EditClinicsDialog.jsx
'use client';

import * as React from 'react';
import {
  Dialog, DialogContent, Stack, Typography, Alert, Grid, TextField, Button,
  IconButton, Chip, Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlaceIcon from '@mui/icons-material/Place';
import PhoneIcon from '@mui/icons-material/Phone';

import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import EditHoursDialog from '@/components/Profile/EditHoursDialog';

const isEgMobile = (v) => /^01[0-25]\d{8}$/.test(String(v || '').trim());
const makeId = (p='clinic') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

function sanitize(clinics = []) {
  return clinics
    .filter(Boolean)
    .map(c => ({
      id: c.id || makeId(),
      // support both ar/legacy keys
      name_ar: (c.name_ar ?? c.name ?? 'العيادة').toString().trim() || 'العيادة',
      address_ar: (c.address_ar ?? c.address ?? '').toString().trim(),
      phone: (c.phone ?? '').toString().trim(),
      active: c.active !== false,
      working_hours: c.working_hours || null,
    }));
}

export default function EditClinicsDialog({
  open,
  onClose,
  isArabic = true,
  doctorUID,
  clinics = [],
  onSaved,
}) {
  const t = (en, ar) => (isArabic ? ar : en);

  const [list, setList] = React.useState(sanitize(clinics));
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // add/edit
  const [newClinic, setNewClinic] = React.useState({ name_ar: '', address_ar: '', phone: '' });
  const [editingId, setEditingId] = React.useState(null);
  const [edit, setEdit] = React.useState({ name_ar: '', address_ar: '', phone: '' });

  // hours dialog (per clinic)
  const [hoursOpen, setHoursOpen] = React.useState(false);
  const [hoursForId, setHoursForId] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    setList(sanitize(clinics));
    setErr('');
    setBusy(false);
    setEditingId(null);
    setEdit({ name_ar: '', address_ar: '', phone: '' });
    setNewClinic({ name_ar: '', address_ar: '', phone: '' });
  }, [open, clinics]);

  const persist = async (next) => {
    setBusy(true);
    setErr('');
    const payload = sanitize(next);
    try {
      // prefer update; fallback to set/merge if needed
      await updateDoc(doc(db, 'doctors', doctorUID), {
        clinics: payload,
        updatedAt: serverTimestamp(),
      }).catch(async () => {
        await setDoc(doc(db, 'doctors', doctorUID), {
          clinics: payload,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      });
      setList(payload);
      onSaved?.();
    } catch (e) {
      setErr(e?.message || t('Failed to save clinics', 'فشل حفظ بيانات العيادات'));
    } finally {
      setBusy(false);
    }
  };

  const addClinic = async () => {
    const name = String(newClinic.name_ar || '').trim();
    if (!name) { setErr(t('Enter a clinic name.', 'اكتب اسم العيادة.')); return; }
    if (newClinic.phone && !isEgMobile(newClinic.phone)) {
      setErr(t('Enter a valid Egyptian mobile (01xxxxxxxxx).', 'أدخل رقم موبايل مصري صحيح (01xxxxxxxxx).'));
      return;
    }
    const next = [
      ...list,
      {
        id: makeId(),
        name_ar: name,
        address_ar: String(newClinic.address_ar || '').trim(),
        phone: String(newClinic.phone || '').trim(),
        active: true,
        working_hours: null,
      },
    ];
    setNewClinic({ name_ar: '', address_ar: '', phone: '' });
    await persist(next);
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEdit({ name_ar: c.name_ar || '', address_ar: c.address_ar || '', phone: c.phone || '' });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEdit({ name_ar: '', address_ar: '', phone: '' });
  };
  const saveEdit = async (c) => {
    const name = String(edit.name_ar || '').trim();
    if (!name) { setErr(t('Enter a clinic name.', 'اكتب اسم العيادة.')); return; }
    if (edit.phone && !isEgMobile(edit.phone)) {
      setErr(t('Enter a valid Egyptian mobile (01xxxxxxxxx).', 'أدخل رقم موبايل مصري صحيح (01xxxxxxxxx).'));
      return;
    }
    const next = list.map(x => x.id === c.id ? {
      ...x,
      name_ar: name,
      address_ar: String(edit.address_ar || '').trim(),
      phone: String(edit.phone || '').trim(),
    } : x);
    await persist(next);
    cancelEdit();
  };

  const toggleActive = async (c) => {
    const next = list.map(x => x.id === c.id ? { ...x, active: !x.active } : x);
    await persist(next);
  };

  const delClinic = async (c) => {
    const next = list.filter(x => x.id !== c.id);
    await persist(next);
  };

  const openHours = (c) => {
    setHoursForId(c.id);
    setHoursOpen(true);
  };
  const onHoursSaved = async (hoursObj) => {
    setHoursOpen(false);
    if (!hoursForId) return;
    const next = list.map(x => x.id === hoursForId ? { ...x, working_hours: hoursObj || {} } : x);
    setHoursForId(null);
    await persist(next);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={1.25}>
          <Typography variant="h6" fontWeight={900}>
            {t('Clinics', 'العيادات')}
          </Typography>

          {err && <Alert severity="error">{err}</Alert>}

          {/* Add new clinic */}
          <Grid container spacing={1}>
            <Grid item xs={12} md={4}>
              <TextField
                label={t('Clinic name', 'اسم العيادة')}
                value={newClinic.name_ar}
                onChange={(e) => setNewClinic(v => ({ ...v, name_ar: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                label={t('Address', 'العنوان')}
                value={newClinic.address_ar}
                onChange={(e) => setNewClinic(v => ({ ...v, address_ar: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={7} md={2}>
              <TextField
                label={t('Phone', 'الهاتف')}
                value={newClinic.phone}
                onChange={(e) => setNewClinic(v => ({ ...v, phone: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={5} md={1} sx={{ display: 'flex', alignItems: 'stretch' }}>
              <Button variant="contained" onClick={addClinic} disabled={busy} sx={{ borderRadius: 2, width: '100%' }}>
                {t('Add', 'إضافة')}
              </Button>
            </Grid>
          </Grid>

          <Divider sx={{ my: 1 }} />

          {/* List clinics */}
          <Stack spacing={1}>
            {list.length === 0 ? (
              <Alert severity="info">{t('No clinics yet. Add your first clinic above.', 'لا توجد عيادات بعد. أضف أول عيادة من الأعلى.')}</Alert>
            ) : (
              list.map((c) => {
                const editing = editingId === c.id;
                return (
                  <Stack key={c.id} spacing={0.75} sx={{ border: (t) => `1px solid ${t.palette.divider}`, p: 1, borderRadius: 2 }}>
                    {editing ? (
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={12} md={3}>
                          <TextField size="small" label={t('Clinic name', 'اسم العيادة')} value={edit.name_ar} onChange={(e) => setEdit(v => ({ ...v, name_ar: e.target.value }))} fullWidth />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField size="small" label={t('Address', 'العنوان')} value={edit.address_ar} onChange={(e) => setEdit(v => ({ ...v, address_ar: e.target.value }))} fullWidth />
                        </Grid>
                        <Grid item xs={7} md={2}>
                          <TextField size="small" label={t('Phone', 'الهاتف')} value={edit.phone} onChange={(e) => setEdit(v => ({ ...v, phone: e.target.value }))} fullWidth />
                        </Grid>
                        <Grid item xs={5} md={1}>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" onClick={() => saveEdit(c)} disabled={busy}>{t('Save', 'حفظ')}</Button>
                            <Button size="small" onClick={cancelEdit} disabled={busy}>{t('Cancel', 'إلغاء')}</Button>
                          </Stack>
                        </Grid>
                      </Grid>
                    ) : (
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={12} md={8}>
                          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                            <Chip icon={<PlaceIcon />} label={c.name_ar || '—'} sx={{ fontWeight: 800 }} />
                            <Chip label={c.active ? t('Active','مفعل') : t('Inactive','موقوف')} color={c.active ? 'success' : 'default'} />
                            {c.phone && <Chip icon={<PhoneIcon />} label={c.phone} />}
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {c.address_ar || '—'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                            {c.working_hours ? t('Working hours set','تم ضبط ساعات العمل') : t('No hours yet','لا توجد ساعات عمل بعد')}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton onClick={() => openHours(c)} title={t('Edit hours','تعديل الساعات')}>
                              <AccessTimeIcon />
                            </IconButton>
                            <IconButton onClick={() => setEditingId(c.id)} title={t('Edit','تعديل')}>
                              <EditIcon />
                            </IconButton>
                            <IconButton onClick={() => toggleActive(c)} title={t('Toggle status','تبديل الحالة')}>
                              {c.active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon />}
                            </IconButton>
                            <IconButton onClick={() => delClinic(c)} title={t('Delete','حذف')}>
                              <DeleteOutlineIcon color="error" />
                            </IconButton>
                          </Stack>
                        </Grid>
                      </Grid>
                    )}
                  </Stack>
                );
              })
            )}
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={busy}>{t('Close','إغلاق')}</Button>
          </Stack>
        </Stack>
      </DialogContent>

      {/* Per-clinic hours editor (reusing your existing dialog) */}
      <EditHoursDialog
        open={hoursOpen}
        onClose={() => { setHoursOpen(false); setHoursForId(null); }}
        isArabic={isArabic}
        doctorUID={doctorUID || 'temp'}
        initialHours={list.find(x => x.id === hoursForId)?.working_hours || null}
        onSaved={onHoursSaved}
      />
    </Dialog>
  );
}
