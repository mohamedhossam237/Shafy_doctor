// /pages/doctor/details.jsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Paper, Stack, Typography, Snackbar, Alert, Box, Button, Grid,
  TextField, MenuItem, RadioGroup, FormControlLabel, Radio, Divider, Chip, IconButton
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import EditIcon from '@mui/icons-material/Edit';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';

/* dialogs already used in your project */
import EditSubspecialtiesDialog from '@/components/Profile/EditSubspecialtiesDialog';
import EditHoursDialog from '@/components/Profile/EditHoursDialog';

/* ---------- helpers ---------- */
const isEgMobile = (v) => /^01[0-25]\d{8}$/.test(String(v || '').trim());
const isInstaPayId = (v) => /@/.test(String(v || ''));

/** Normalize a subspecialty item to a safe label (never return an object). */
const makeSubLabelFactory = (isArabic) => (s) => {
  if (s == null) return '';
  if (typeof s === 'string' || typeof s === 'number') return String(s);
  // common shapes: {id, name_en, name_ar}, or {id, label}
  return (
    (isArabic ? s.name_ar : s.name_en) ||
    s.label ||
    String(s.id ?? '')
  );
};

/** Normalize subspecialty detail for saving. */
const normalizeSubDetail = (s) => {
  if (s && typeof s === 'object') {
    return {
      id: s.id,
      name_en: s.name_en ?? s.label ?? String(s.id ?? ''),
      name_ar: s.name_ar ?? s.label ?? String(s.id ?? ''),
    };
  }
  // primitive fallback
  return { id: s, name_en: String(s ?? ''), name_ar: String(s ?? '') };
};

export default function DoctorDetailsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const dir = isArabic ? 'rtl' : 'ltr';
  const t = (en, ar) => (isArabic ? ar : en);
  const subLabel = React.useMemo(() => makeSubLabelFactory(isArabic), [isArabic]);

  /* ---------- form state ---------- */
  const [form, setForm] = React.useState({
    // overview fields (NO gradYear/experience)
    bio_en: '', bio_ar: '',
    qualifications_en: '', qualifications_ar: '',
    university_en: '', university_ar: '',
    checkupPrice: '', phone: '',

    // specialty
    specialtyEn: '', specialtyAr: '',
  });

  const [images, setImages] = React.useState([]);                 // profileImages (URL strings)
  const [subspecialties, setSubspecialties] = React.useState([]); // array of objects or strings
  const [workingHours, setWorkingHours] = React.useState(null);   // object from dialog

  // dialogs
  const [openSubs, setOpenSubs] = React.useState(false);
  const [openHours, setOpenHours] = React.useState(false);

  // payment
  const [payType, setPayType] = React.useState('instapay'); // 'instapay' | 'wallet'
  const [instapayId, setInstapayId] = React.useState('');
  const [instapayMobile, setInstapayMobile] = React.useState('');
  const [walletProvider, setWalletProvider] = React.useState('vodafone');
  const [walletNumber, setWalletNumber] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [paymentNotes, setPaymentNotes] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (m, s = 'info') => setSnack({ open: true, message: m, severity: s });

  const fileInputRef = React.useRef(null);
  const dropRef = React.useRef(null);

  /* ---------- prefill ---------- */
  const loadData = React.useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, 'doctors', user.uid));
      if (!snap.exists()) return;

      const d = snap.data() || {};
      setForm((f) => ({
        ...f,
        bio_en: d.bio_en || '',
        bio_ar: d.bio_ar || '',
        qualifications_en: d.qualifications_en || '',
        qualifications_ar: d.qualifications_ar || '',
        university_en: d.university_en || '',
        university_ar: d.university_ar || '',
        checkupPrice: d.checkupPrice ?? '',
        phone: d.phone || '',

        specialtyEn: d.specialty_en || d.specialtyEn || '',
        specialtyAr: d.specialty_ar || d.specialtyAr || '',
      }));

      setImages(Array.isArray(d.profileImages) ? d.profileImages.filter(Boolean) : []);
      setSubspecialties(Array.isArray(d.subspecialties_detail) ? d.subspecialties_detail.filter(Boolean) : []);
      setWorkingHours(d.working_hours || null);

      const p = d.payment || {};
      if (p.type) setPayType(p.type);
      setInstapayId(p.instapayId || '');
      setInstapayMobile(p.instapayMobile || '');
      setWalletProvider(p.walletProvider || 'vodafone');
      setWalletNumber(p.walletNumber || '');
      setBankName(p.bankName || '');
      setPaymentNotes(p.notes || '');
    } catch (e) {
      openSnack(e?.message || t('Failed to load data', 'تعذر تحميل البيانات'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]); // eslint-disable-line

  React.useEffect(() => { loadData(); }, [loadData]);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ---------- image upload via imgbb ---------- */
  const uploadViaImgbb = async (files) => {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_KEY;
    if (!apiKey) {
      openSnack(t('Missing imgbb key (NEXT_PUBLIC_IMGBB_KEY)', 'مفتاح imgbb غير موجود'), 'error');
      return;
    }
    if (!files || !files.length) return;
    setLoading(true);
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const dataUrl = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(file);
        });
        const base64 = String(dataUrl).split(',')[1];
        const resp = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ image: base64 }),
        });
        const json = await resp.json();
        if (resp.ok && json?.data?.url) uploaded.push(json.data.url);
      }
      if (uploaded.length) {
        await updateDoc(doc(db, 'doctors', user.uid), {
          profileImages: (images?.length ? [...images, ...uploaded] : uploaded),
        }).catch(async () => {
          // if doc may not exist
          await setDoc(doc(db, 'doctors', user.uid), { profileImages: uploaded }, { merge: true });
        });
        setImages((prev) => [...prev, ...uploaded]);
        openSnack(t('Image uploaded', 'تم رفع الصورة'), 'success');
      }
    } catch (e) {
      openSnack(t('Image upload failed', 'فشل في رفع الصورة'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const onPickImages = async (e) => {
    await uploadViaImgbb(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  React.useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    const enter = (e) => { prevent(e); el.dataset.hover = '1'; };
    const leave = (e) => { prevent(e); el.dataset.hover = ''; };
    const drop = (e) => {
      prevent(e);
      el.dataset.hover = '';
      uploadViaImgbb(e.dataTransfer?.files);
    };
    el.addEventListener('dragenter', enter);
    el.addEventListener('dragover', enter);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    return () => {
      el.removeEventListener('dragenter', enter);
      el.removeEventListener('dragover', enter);
      el.removeEventListener('dragleave', leave);
      el.removeEventListener('drop', drop);
    };
  }, [dropRef.current, user?.uid]); // eslint-disable-line

  /* ---------- save ---------- */
  const onSave = async () => {
    if (!user?.uid) {
      openSnack(t('Please sign in', 'الرجاء تسجيل الدخول'), 'error');
      return;
    }

    // Payment validation
    if (payType === 'instapay') {
      const idOk = instapayId ? isInstaPayId(instapayId) : false;
      const mobOk = instapayMobile ? isEgMobile(instapayMobile) : false;
      if (!idOk && !mobOk) {
        return openSnack(
          t(
            'Add a valid InstaPay ID (name@bank) or an Egyptian mobile number (01xxxxxxxxx).',
            'أضف مُعرّف إنستا باي صحيح (name@bank) أو رقم موبايل مصري صحيح (01xxxxxxxxx).'
          ),
          'warning'
        );
      }
    }
    if (payType === 'wallet' && walletNumber && !isEgMobile(walletNumber)) {
      return openSnack(
        t('Enter a valid Egyptian wallet number (01xxxxxxxxx).', 'أدخل رقم محفظة مصري صحيح (01xxxxxxxxx).'),
        'warning'
      );
    }

    const payload = {
      // overview (no graduationYear/experienceYears)
      bio_en: form.bio_en.trim(),
      bio_ar: form.bio_ar.trim(),
      qualifications_en: form.qualifications_en.trim(),
      qualifications_ar: form.qualifications_ar.trim(),
      university_en: form.university_en.trim(),
      university_ar: form.university_ar.trim(),
      checkupPrice: form.checkupPrice ? Number(form.checkupPrice) : 0,
      phone: form.phone.trim(),

      // specialty
      specialty_en: form.specialtyEn.trim(),
      specialty_ar: form.specialtyAr.trim(),

      // subspecialties (keep ids and normalized detail)
      subspecialties: subspecialties.map((s) => (typeof s === 'object' ? s.id : s)),
      subspecialties_detail: subspecialties.map(normalizeSubDetail),

      // hours
      working_hours: workingHours || {},

      // payment
      payment: {
        type: payType,
        instapayId: payType === 'instapay' ? instapayId.trim() : '',
        instapayMobile: payType === 'instapay' ? instapayMobile.trim() : '',
        walletProvider: payType === 'wallet' ? walletProvider : '',
        walletNumber: payType === 'wallet' ? walletNumber.trim() : '',
        bankName: bankName.trim(),
        notes: paymentNotes.trim(),
        updatedAt: serverTimestamp(),
      },

      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    try {
      setLoading(true);
      await setDoc(doc(db, 'doctors', user.uid), payload, { merge: true });
      openSnack(t('Saved', 'تم الحفظ'), 'success');
      router.replace(isArabic ? '/doctor/profile?lang=ar' : '/doctor/profile');
    } catch (e) {
      openSnack(e?.message || t('Failed to save', 'فشل الحفظ'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <Container maxWidth="md" sx={{ py: 3 }} dir={dir}>
        <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Typography variant="h5" fontWeight={900}>{t('Doctor Details', 'تفاصيل الطبيب')}</Typography>
          <IconButton onClick={loadData} aria-label={t('Reload', 'إعادة التحميل')}>
            <RefreshIcon />
          </IconButton>
        </Stack>

        {/* Photos (imgbb) */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction={isArabic ? 'row-reverse' : 'row'} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" color="text.secondary" fontWeight={800}>
              {t('Photos', 'الصور')}
            </Typography>
            <Stack direction={isArabic ? 'row-reverse' : 'row'} spacing={1}>
              <input ref={fileInputRef} type="file" accept="image/*" hidden multiple onChange={onPickImages} />
              <Button
                startIcon={<AddAPhotoIcon />}
                variant="outlined"
                onClick={() => fileInputRef.current?.click()}
                sx={{ borderRadius: 2 }}
                disabled={loading || !user?.uid}
              >
                {t('Upload', 'رفع')}
              </Button>
            </Stack>
          </Stack>

          <Box
            ref={dropRef}
            sx={{
              mt: 1,
              p: 1.5,
              borderRadius: 2,
              border: (th) => `2px dashed ${th.palette.divider}`,
              textAlign: 'center',
              transition: 'border-color .15s ease, background-color .15s ease',
              bgcolor: 'transparent',
              '&[data-hover="1"]': { borderColor: 'primary.main', bgcolor: 'rgba(25,118,210,.06)' },
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('Drag & drop images here, or click “Upload”.', 'اسحب وأفلت الصور هنا أو اضغط "رفع".')}
            </Typography>
          </Box>

          {images?.length ? (
            <Box
              sx={{
                mt: 1.25,
                display: 'grid',
                gap: 1,
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
              }}
            >
              {images.map((src, i) => (
                <Box
                  key={`${src}-${i}`}
                  sx={{
                    position: 'relative',
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: (th) => `1px solid ${th.palette.divider}`,
                    aspectRatio: '1 / 1',
                    backgroundImage: `url(${src})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                  title={src}
                />
              ))}
            </Box>
          ) : null}
        </Paper>

        {/* Overview */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<PersonIcon />} label={t('Overview', 'النظرة العامة')} color="primary" />
          </Stack>
          <Grid container spacing={1.25}>
            <Grid item xs={12} md={6}>
              <TextField label={t('Bio (English)', 'نبذة (إنجليزي)')} value={form.bio_en} onChange={onChange('bio_en')} multiline minRows={3} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label={t('Bio (Arabic)', 'نبذة (عربي)')} value={form.bio_ar} onChange={onChange('bio_ar')} multiline minRows={3} fullWidth />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField label={t('Qualifications (English)', 'المؤهل (إنجليزي)')} value={form.qualifications_en} onChange={onChange('qualifications_en')} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label={t('Qualifications (Arabic)', 'المؤهل (عربي)')} value={form.qualifications_ar} onChange={onChange('qualifications_ar')} fullWidth />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField label={t('University (English)', 'الجامعة (إنجليزي)')} value={form.university_en} onChange={onChange('university_en')} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label={t('University (Arabic)', 'الجامعة (عربي)')} value={form.university_ar} onChange={onChange('university_ar')} fullWidth />
            </Grid>

            <Grid item xs={6} md={3}>
              <TextField type="number" label={t('Checkup Price', 'سعر الكشف')} value={form.checkupPrice} onChange={onChange('checkupPrice')} fullWidth />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField label={t('Phone', 'الهاتف')} value={form.phone} onChange={onChange('phone')} fullWidth />
            </Grid>
          </Grid>
        </Paper>

        {/* Specialty & Subspecialties */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<LocalHospitalIcon />} label={t('Specialty', 'التخصص')} color="primary" />
          </Stack>
          <Grid container spacing={1.25} sx={{ mb: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField label={t('Specialty (English)', 'التخصص (إنجليزي)')} value={form.specialtyEn} onChange={onChange('specialtyEn')} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label={t('Specialty (Arabic)', 'التخصص (عربي)')} value={form.specialtyAr} onChange={onChange('specialtyAr')} fullWidth />
            </Grid>
          </Grid>

          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setOpenSubs(true)}
            sx={{ borderRadius: 2 }}
          >
            {t('Edit Subspecialties', 'تعديل التخصصات الفرعية')}
          </Button>

          {Array.isArray(subspecialties) && subspecialties.length > 0 && (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
              {subspecialties.map((s, i) => {
                const keyVal = typeof s === 'object' ? (s?.id ?? i) : s ?? i;
                return <Chip key={String(keyVal)} label={subLabel(s)} />;
              })}
            </Stack>
          )}
        </Paper>

        {/* Clinic Hours */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<AccessTimeIcon />} label={t('Working Hours', 'ساعات العمل')} color="primary" />
          </Stack>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setOpenHours(true)}
            sx={{ borderRadius: 2 }}
            disabled={!user?.uid}
          >
            {t('Edit Hours', 'تعديل الساعات')}
          </Button>
          {workingHours ? (
            <Box sx={{ mt: 1, color: 'text.secondary' }}>
              <Typography variant="body2">{t('Hours have been configured.', 'تم ضبط الساعات.')}</Typography>
            </Box>
          ) : (
            <Box sx={{ mt: 1, color: 'text.secondary' }}>
              <Typography variant="body2">{t('No hours yet.', 'لا توجد ساعات بعد.')}</Typography>
            </Box>
          )}
        </Paper>

        {/* Payment */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<MonetizationOnIcon />} label={t('Payment for Bookings', 'بيانات الدفع للحجوزات')} color="primary" />
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('Patients transfer the fee and upload a receipt. You confirm afterwards.',
               'سيحوّل المريض الرسوم ويحمّل إيصال التحويل، ثم تؤكد الموعد لاحقاً.')}
          </Typography>

          <RadioGroup row value={payType} onChange={(e) => setPayType(e.target.value)}>
            <FormControlLabel value="instapay" control={<Radio />} label="InstaPay" />
            <FormControlLabel value="wallet" control={<Radio />} label={t('Mobile Wallet','محفظة موبايل')} />
          </RadioGroup>

          {payType === 'instapay' && (
            <Stack spacing={1} sx={{ mt: 1 }}>
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

          {payType === 'wallet' && (
            <Stack spacing={1} sx={{ mt: 1 }}>
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

          <Divider sx={{ my: 1.25 }} />

          <TextField
            label={t('Notes shown to patients (optional)','ملاحظات تُعرض للمريض (اختياري)')}
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            placeholder={t('Example: Please write your name in the transfer note.','مثال: رجاء كتابة اسمك في ملاحظة التحويل.')}
            multiline minRows={2}
            fullWidth
          />
        </Paper>

        {/* Save Bar */}
        <Box sx={{ display: 'flex', justifyContent: isArabic ? 'flex-start' : 'flex-end' }}>
          <Button onClick={onSave} variant="contained" disabled={loading || !user?.uid}>
            {t('Save & Continue', 'حفظ ومتابعة')}
          </Button>
        </Box>

        {/* dialogs */}
        <EditSubspecialtiesDialog
          open={openSubs}
          onClose={() => setOpenSubs(false)}
          doctorUID={user?.uid || 'temp'}
          isArabic={isArabic}
          initialSelected={subspecialties}
          onSaved={(arr) => { setSubspecialties(arr || []); setOpenSubs(false); }}
        />
        <EditHoursDialog
          open={openHours}
          onClose={() => setOpenHours(false)}
          doctorUID={user?.uid || 'temp'}
          isArabic={isArabic}
          initialHours={workingHours}
          onSaved={(obj) => { setWorkingHours(obj || {}); setOpenHours(false); }}
        />

        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
            {snack.message}
          </Alert>
        </Snackbar>
      </Container>
    </AppLayout>
  );
}
