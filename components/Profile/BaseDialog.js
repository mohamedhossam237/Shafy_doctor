'use client';

import * as React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, Alert, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function BaseDialog({
  open,
  onClose,
  title,
  children,
  onSave,
  savingLabel = 'Saving...',
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  isArabic = false,
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState('');

  const handleSave = async () => {
    try {
      setErr('');
      setSubmitting(true);
      await onSave?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose?.()} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', direction: isArabic ? 'rtl' : 'ltr' }}>
        {title}
        <IconButton onClick={() => !submitting && onClose?.()} disabled={submitting}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ direction: isArabic ? 'rtl' : 'ltr' }}>
        <Stack spacing={1.25}>
          {err && <Alert severity="error">{err}</Alert>}
          {children}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ direction: isArabic ? 'rtl' : 'ltr' }}>
        <Button onClick={onClose} disabled={submitting}>
          {isArabic ? 'إلغاء' : cancelLabel}
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={submitting}>
          {submitting ? (isArabic ? 'جارٍ الحفظ...' : savingLabel) : (isArabic ? 'حفظ' : saveLabel)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
