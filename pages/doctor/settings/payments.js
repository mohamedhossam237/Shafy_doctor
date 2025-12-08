// /pages/doctor/settings/payments.jsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Box, Container, Paper, Stack, Typography, TextField, Button, Alert,
  RadioGroup, FormControlLabel, Radio, MenuItem, Divider, Snackbar, Chip,
  IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';

import AppLayout from '@/components/AppLayout';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export default function DoctorPaymentsSettings({ themeMode, setThemeMode }) {
  const router = useRouter();
  const locale = React.useMemo(() => {
    const v = String(router?.query?.lang ?? '').toLowerCase();
    return v.startsWith('en') ? 'en' : 'ar';
  }, [router.query]);
  const isAr = locale === 'ar';
  const t = React.useCallback((en, ar) => (isAr ? ar : en), [isAr]);

  const [uid, setUid] = React.useState(null);
  const [doctorId, setDoctorId] = React.useState(''); // we’ll use the logged-in uid as the doctor id by default
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  // Form state
  const [type, setType] = React.useState('instapay'); // 'instapay' | 'wallet'
  const [instapayId, setInstapayId] = React.useState('');
  const [walletProvider, setWalletProvider] = React.useState('vodafone'); // vodafone | etisalat | orange | we
  const [walletNumber, setWalletNumber] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [notes, setNotes] = React.useState('');

  // auth → use uid as doctor id (override here if you store doctors separately with different IDs)
  React.useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setUid(null); setLoading(false); return; }
      setUid(u.uid);
      setDoctorId(u.uid);
      // fetch current payment config
      try {
        const snap = await getDoc(doc(db, 'doctors', u.uid));
        const d = snap.exists() ? snap.data() : {};
        const p = d?.payment || {};
        if (p.type) setType(p.type);
        if (p.instapayId) setInstapayId(p.instapayId);
        if (p.walletProvider) setWalletProvider(p.walletProvider);
        if (p.walletNumber) setWalletNumber(p.walletNumber);
        if (p.bankName) setBankName(p.bankName);
        if (p.notes) setNotes(p.notes);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const withLang = (href) => ({ pathname: href, query: { ...router.query, lang: isAr ? 'ar' : 'en' } });

  const copy = async (txt) => {
    try { await navigator.clipboard.writeText(String(txt)); 
      setSnack({ open: true, severity: 'success', msg: isAr ? 'تم النسخ!' : 'Copied!' });
    } catch {}
  };

  const onSave = async () => {
    if (!doctorId) return;
    // very light validation
    if (type === 'instapay' && !instapayId.trim()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please enter your InstaPay ID.', 'من فضلك أدخل مُعرّف إنستا باي.') });
      return;
    }
    if (type === 'wallet' && !walletNumber.trim()) {
      setSnack({ open: true, severity: 'warning', msg: t('Please enter your wallet number.', 'من فضلك أدخل رقم المحفظة.') });
      return;
    }

    setSaving(true);
    try {
      const ref = doc(db, 'doctors', doctorId);
      const snapshot = await getDoc(ref);
      const base = snapshot.exists() ? snapshot.data() : {};

      const payment = {
        type,
        instapayId: type === 'instapay' ? instapayId.trim() : '',
        walletProvider: type === 'wallet' ? walletProvider : '',
        walletNumber: type === 'wallet' ? walletNumber.trim() : '',
        bankName: bankName.trim(),
        notes: notes.trim(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, { ...base, payment }, { merge: true });

      setSnack({ open: true, severity: 'success', msg: t('Saved!', 'تم الحفظ!') });
    } catch (e) {
      setSnack({ open: true, severity: 'error', msg: e?.message || t('Failed to save', 'تعذر الحفظ') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout themeMode={themeMode} setThemeMode={setThemeMode}>
      <Container maxWidth="sm" sx={{ py: { xs: 1, md: 2 } }}>
        {/* Back */}
        <Box sx={{ mb: 1 }}>
          <Button onClick={() => router.push(withLang('/'))} startIcon={<ArrowBackIcon />}>
            {t('Back', 'رجوع')}
          </Button>
        </Box>

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderRadius: 3,
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(25,118,210,.10), rgba(25,118,210,.02))',
            '&:before': {
              content: '""', position: 'absolute', inset: 0,
              background: 'radial-gradient(900px 200px at 10% -20%, rgba(25,118,210,.16), transparent)'
            },
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={900}>
              {t('Receive payments for bookings', 'استلام المدفوعات لتأكيد الحجز')}
            </Typography>
            {type === 'instapay'
              ? <Chip icon={<AccountBalanceIcon />} label="InstaPay" color="primary" />
              : <Chip icon={<AccountBalanceWalletIcon />} label={t('Wallet','محفظة')} color="primary" />
            }
          </Stack>

          {!uid && <Alert severity="info">{t('Please sign in as a doctor.', 'يرجى تسجيل الدخول كطبيب.')}</Alert>}

          {!loading && uid && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" fontWeight={900}>
                {t('Choose payment type', 'اختر نوع طريقة الدفع')}
              </Typography>
              <RadioGroup
                row
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <FormControlLabel value="instapay" control={<Radio />} label="InstaPay" />
                <FormControlLabel value="wallet" control={<Radio />} label={t('Mobile Wallet', 'محفظة موبايل')} />
              </RadioGroup>

              {type === 'instapay' && (
                <Stack spacing={1}>
                  <TextField
                    label={t('InstaPay ID (e.g. name@bank)', 'معرّف إنستا باي (مثل name@bank)')}
                    value={instapayId}
                    onChange={(e) => setInstapayId(e.target.value)}
                    placeholder="username@bank"
                    fullWidth
                  />
                  <TextField
                    label={t('Bank (optional)', 'اسم البنك (اختياري)')}
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    fullWidth
                  />
                  {!!instapayId && (
                    <Button
                      variant="outlined"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => copy(instapayId)}
                      sx={{ alignSelf: 'start' }}
                    >
                      {t('Copy InstaPay ID', 'نسخ مُعرّف إنستا باي')}
                    </Button>
                  )}
                </Stack>
              )}

              {type === 'wallet' && (
                <Stack spacing={1}>
                  <TextField
                    select
                    label={t('Wallet provider', 'شركة المحفظة')}
                    value={walletProvider}
                    onChange={(e) => setWalletProvider(e.target.value)}
                  >
                    <MenuItem value="vodafone">{t('Vodafone Cash', 'فودافون كاش')}</MenuItem>
                    <MenuItem value="etisalat">{t('Etisalat Cash', 'اتصالات كاش')}</MenuItem>
                    <MenuItem value="orange">{t('Orange Money', 'أورنج موني')}</MenuItem>
                    <MenuItem value="we">{t('WE Pay', 'وي باي')}</MenuItem>
                  </TextField>
                  <TextField
                    label={t('Wallet number', 'رقم المحفظة')}
                    value={walletNumber}
                    onChange={(e) => setWalletNumber(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    fullWidth
                  />
                  {!!walletNumber && (
                    <Button
                      variant="outlined"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => copy(walletNumber)}
                      sx={{ alignSelf: 'start' }}
                    >
                      {t('Copy wallet number', 'نسخ رقم المحفظة')}
                    </Button>
                  )}
                </Stack>
              )}

              <Divider />

              <TextField
                label={t('Notes shown to patients (optional)', 'ملاحظات تُعرض للمريض (اختياري)')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                multiline minRows={2}
                placeholder={t('Example: Please include your name in transfer note.', 'مثال: يرجى كتابة اسمك في ملاحظة التحويل.')}
              />

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? t('Saving…', 'جارٍ الحفظ…') : t('Save', 'حفظ')}
                </Button>
              </Stack>

              <Alert severity="info">
                {t(
                  'Patients will see these details on the booking page and can upload a payment screenshot. You can then confirm the appointment.',
                  'سيرى المرضى هذه البيانات في صفحة الحجز ويمكنهم رفع صورة التحويل، وبعدها يمكنك تأكيد الموعد.'
                )}
              </Alert>
            </Stack>
          )}
        </Paper>

        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
            {snack.msg}
          </Alert>
        </Snackbar>
      </Container>
    </AppLayout>
  );
}
