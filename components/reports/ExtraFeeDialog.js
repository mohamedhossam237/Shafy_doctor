'use client';
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Alert
} from '@mui/material';

export default function ExtraFeeDialog({ open, onClose, onSave, initial, isAr }) {
  const t = (en, ar) => (isAr ? ar : en);
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (initial) {
      setTitle(initial.title || '');
      setAmount(String(initial.amount || ''));
      setNote(initial.note || '');
    } else {
      setTitle('');
      setAmount('');
      setNote('');
    }
  }, [initial, open]);

  const handleSave = () => {
    const payload = {
      id: initial?.id || Math.random().toString(36).slice(2, 9),
      title: title.trim(),
      amount: parseFloat(amount) || 0,
      note: note.trim(),
      createdAt: initial?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSave?.(payload);
  };

  const disabled = !title.trim() || !amount;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>
        {initial ? t('Edit Extra Fee', 'تعديل تكلفة إضافية') : t('Add Extra Fee', 'إضافة تكلفة إضافية')}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <TextField label={t('Title', 'العنوان')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label={t('Amount', 'المبلغ')} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label={t('Notes', 'ملاحظات')} value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2} />
          <Alert severity="info">
            {t('This will be added to the appointment total.', 'سيتم إضافة هذه التكلفة إلى إجمالي الموعد.')}
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={disabled}>{t('Save', 'حفظ')}</Button>
      </DialogActions>
    </Dialog>
  );
}
