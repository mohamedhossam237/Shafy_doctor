'use client';
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert, MenuItem
} from '@mui/material';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function UpdateAppointmentDialog({ open, onClose, appointment, onSaved, isAr }) {
  const t = (en, ar) => (isAr ? ar : en);
  const [dateStr, setDateStr] = React.useState('');
  const [timeStr, setTimeStr] = React.useState('');
  const [status, setStatus] = React.useState('pending');
  const [saving, setSaving] = React.useState(false);

  const statusOptions = [
    { v: 'pending', label: t('Pending', 'قيد الانتظار') },
    { v: 'confirmed', label: t('Confirmed', 'مؤكد') },
    { v: 'completed', label: t('Completed', 'تم') },
    { v: 'cancelled', label: t('Cancelled', 'أُلغي') },
  ];

  React.useEffect(() => {
    if (appointment) {
      setDateStr(appointment.date || '');
      setTimeStr(appointment.time || '');
      setStatus(appointment.status || 'pending');
    }
  }, [appointment]);

  const handleSave = async () => {
    if (!appointment?.id) return;
    setSaving(true);
    const appointmentDate = new Date(`${dateStr}T${timeStr}:00`);
    await updateDoc(doc(db, 'appointments', appointment.id), {
      date: dateStr,
      time: timeStr,
      status,
      appointmentDate,
      updatedAt: serverTimestamp(),
    });
    setSaving(false);
    onSaved?.({ date: dateStr, time: timeStr, status });
    onClose();
  };

  return (
    <Dialog open={open} onClose={!saving ? onClose : undefined} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>{t('Update Appointment', 'تحديث الموعد')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField type="date" label={t('Date', 'التاريخ')} value={dateStr}
            onChange={(e) => setDateStr(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField type="time" label={t('Time', 'الوقت')} value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField select label={t('Status', 'الحالة')} value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((s) => <MenuItem key={s.v} value={s.v}>{s.label}</MenuItem>)}
          </TextField>
          <Alert severity="info">
            {t('Changing date/time will update appointmentDate.', 'تغيير التاريخ/الوقت سيحدث الموعد تلقائيًا.')}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !dateStr || !timeStr}>
          {saving ? t('Saving…', 'جارٍ الحفظ…') : t('Save', 'حفظ')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
