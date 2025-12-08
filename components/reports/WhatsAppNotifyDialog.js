'use client';
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Alert, Stack, Paper
} from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CloseIcon from '@mui/icons-material/Close';

export default function WhatsAppNotifyDialog({ open, onClose, isAr, message, phoneDigits }) {
  const t = (en, ar) => (isAr ? ar : en);
  const href = phoneDigits
    ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message || '')}`
    : '';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
        <WhatsAppIcon color="success" /> {t('Send WhatsApp Message', 'إرسال رسالة واتساب')}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Alert severity="info">
            {t('This opens WhatsApp with a pre-filled message. You just press “Send”.',
               'سيتم فتح واتساب مع رسالة جاهزة للإرسال. فقط اضغط "إرسال".')}
          </Alert>
          <Typography variant="subtitle2">{t('Preview', 'المعاينة')}:</Typography>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, whiteSpace: 'pre-wrap' }}>
            {message || '—'}
          </Paper>
          {!phoneDigits && (
            <Alert severity="warning">
              {t('No patient phone number available.', 'لا يوجد رقم هاتف للمريض.')}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<CloseIcon />}>{t('Close', 'إغلاق')}</Button>
        <Button
          variant="contained"
          startIcon={<WhatsAppIcon />}
          disabled={!phoneDigits}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Open WhatsApp', 'فتح واتساب')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
