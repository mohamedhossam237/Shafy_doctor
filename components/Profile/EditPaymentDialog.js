// /components/Profile/EditPaymentDialog.jsx
import * as React from 'react';
import {
  Dialog, DialogContent, Stack, Typography, Alert, RadioGroup, FormControlLabel, Radio,
  TextField, MenuItem, Button
} from '@mui/material';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const isEgMobile = (v) => /^01[0-25]\d{8}$/.test(String(v || '').trim());
const isInstaPayId = (v) => /@/.test(String(v || ''));

export default function EditPaymentDialog({ open, onClose, isArabic, doctorUID, initial, onSaved }) {
  const t = (en, ar) => (isArabic ? ar : en);
  const [type, setType] = React.useState(initial?.type || 'instapay');
  const [instapayId, setInstapayId] = React.useState(initial?.instapayId || '');
  const [instapayMobile, setInstapayMobile] = React.useState(initial?.instapayMobile || '');
  const [walletProvider, setWalletProvider] = React.useState(initial?.walletProvider || 'vodafone');
  const [walletNumber, setWalletNumber] = React.useState(initial?.walletNumber || '');
  const [bankName, setBankName] = React.useState(initial?.bankName || '');
  const [notes, setNotes] = React.useState(initial?.notes || '');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setType(initial?.type || 'instapay');
    setInstapayId(initial?.instapayId || '');
    setInstapayMobile(initial?.instapayMobile || '');
    setWalletProvider(initial?.walletProvider || 'vodafone');
    setWalletNumber(initial?.walletNumber || '');
    setBankName(initial?.bankName || '');
    setNotes(initial?.notes || '');
    setErr('');
  }, [open, initial]);

  const save = async () => {
    setErr('');
    if (type === 'instapay') {
      const idOk = instapayId ? isInstaPayId(instapayId) : false;
      const mobOk = instapayMobile ? isEgMobile(instapayMobile) : false;
      if (!idOk && !mobOk) {
        setErr(t('Enter a valid InstaPay ID (name@bank) or Egyptian mobile (01xxxxxxxxx).',
                 'أدخل مُعرّف إنستا باي صحيح (name@bank) أو رقم موبايل مصري صحيح (01xxxxxxxxx).'));
        return;
      }
    }
    if (type === 'wallet' && walletNumber && !isEgMobile(walletNumber)) {
      setErr(t('Enter a valid Egyptian wallet number (01xxxxxxxxx).','أدخل رقم محفظة مصري صحيح (01xxxxxxxxx).'));
      return;
    }

    try {
      setBusy(true);
      await updateDoc(doc(db, 'doctors', doctorUID), {
        payment: {
          type,
          instapayId: type === 'instapay' ? instapayId.trim() : '',
          instapayMobile: type === 'instapay' ? instapayMobile.trim() : '',
          walletProvider: type === 'wallet' ? walletProvider : '',
          walletNumber: type === 'wallet' ? walletNumber.trim() : '',
          bankName: bankName.trim(),
          notes: notes.trim(),
          updatedAt: serverTimestamp(),
        }
      });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || t('Failed to save','فشل الحفظ'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={1.25}>
          <Typography variant="h6" fontWeight={900}>
            {t('Payment details for bookings','بيانات الدفع لتأكيد الحجز')}
          </Typography>

          {err && <Alert severity="error">{err}</Alert>}

          <RadioGroup row value={type} onChange={(e) => setType(e.target.value)}>
            <FormControlLabel value="instapay" control={<Radio />} label="InstaPay" />
            <FormControlLabel value="wallet" control={<Radio />} label={isArabic ? 'محفظة موبايل' : 'Mobile Wallet'} />
          </RadioGroup>

          {type === 'instapay' && (
            <Stack spacing={1}>
              <TextField
                label={t('InstaPay ID (e.g. name@bank)','معرّف إنستا باي (مثل name@bank)')}
                placeholder="username@bank"
                value={instapayId}
                onChange={(e) => setInstapayId(e.target.value)}
                fullWidth
              />
              <TextField
                label={t('InstaPay mobile (01xxxxxxxxx)','موبايل إنستا باي (01xxxxxxxxx)')}
                placeholder="01xxxxxxxxx"
                value={instapayMobile}
                onChange={(e) => setInstapayMobile(e.target.value)}
                fullWidth
              />
              <TextField
                label={t('Bank (optional)','اسم البنك (اختياري)')}
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                fullWidth
              />
            </Stack>
          )}

          {type === 'wallet' && (
            <Stack spacing={1}>
              <TextField
                select
                label={t('Wallet provider','شركة المحفظة')}
                value={walletProvider}
                onChange={(e) => setWalletProvider(e.target.value)}
              >
                <MenuItem value="vodafone">{t('Vodafone Cash','فودافون كاش')}</MenuItem>
                <MenuItem value="etisalat">{t('Etisalat Cash','اتصالات كاش')}</MenuItem>
                <MenuItem value="orange">{t('Orange Money','أورنج موني')}</MenuItem>
                <MenuItem value="we">{t('WE Pay','وي باي')}</MenuItem>
              </TextField>
              <TextField
                label={t('Wallet number (01xxxxxxxxx)','رقم المحفظة (01xxxxxxxxx)')}
                placeholder="01xxxxxxxxx"
                value={walletNumber}
                onChange={(e) => setWalletNumber(e.target.value)}
                fullWidth
              />
            </Stack>
          )}

          <TextField
            label={t('Notes (optional)','ملاحظات (اختياري)')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('Example: Please write your name in the transfer note.','مثال: رجاء كتابة اسمك في ملاحظة التحويل.')}
            multiline minRows={2}
          />

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={onClose} disabled={busy}>{t('Cancel','إلغاء')}</Button>
            <Button onClick={save} disabled={busy} variant="contained">
              {busy ? t('Saving…','جارٍ الحفظ…') : t('Save','حفظ')}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
