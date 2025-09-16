// /pages/doctor/details.jsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Paper, Stack, Typography, Snackbar, Alert, Box, Button, Grid,
  TextField, MenuItem, RadioGroup, FormControlLabel, Radio, Divider, Chip, IconButton, CircularProgress
} from '@mui/material';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import EditIcon from '@mui/icons-material/Edit';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import Autocomplete from '@mui/material/Autocomplete';

import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp,
  collection, getDocs, query, where
} from 'firebase/firestore';

/* dialog used for hours only (we remove the subspecialties dialog) */
import EditHoursDialog from '@/components/Profile/EditHoursDialog';

/* ---------- helpers ---------- */
const isEgMobile = (v) => /^01[0-25]\d{8}$/.test(String(v || '').trim());
const isInstaPayId = (v) => /@/.test(String(v || ''));

/** Convert maybe-array input (strings/objects) to clean array of Arabic strings */
const toSubStrings = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s) => {
      if (!s) return '';
      if (typeof s === 'string' || typeof s === 'number') return String(s).trim();
      // object shape from older version
      return (s.name_ar || s.label || String(s.id ?? '')).trim();
    })
    .filter(Boolean);
};

export default function DoctorDetailsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Force Arabic-only UI
  const isArabic = true;
  const dir = 'rtl';
  const t = (_en, ar) => ar; // UI always Arabic

  /* ---------- form state (Arabic inputs only) ---------- */
  const [form, setForm] = React.useState({
    bio_ar: '',
    qualifications_ar: '',
    university_ar: '',
    checkupPrice: '',
    phone: '',
    specialtyAr: '', // kept for backward compatibility (now driven by selectedSpecialty)
  });

  const [images, setImages] = React.useState([]);                 // profileImages (URL strings)
  const [subspecialties, setSubspecialties] = React.useState([]); // array of Arabic strings only
  const [workingHours, setWorkingHours] = React.useState(null);   // object from dialog

  // dialogs
  const [openHours, setOpenHours] = React.useState(false);

  // payment
  const [payType, setPayType] = React.useState('instapay'); // 'instapay' | 'wallet'
  const [instapayId, setInstapayId] = React.useState('');
  const [instapayMobile, setInstapayMobile] = React.useState('');
  const [walletProvider, setWalletProvider] = React.useState('vodafone');
  const [walletNumber, setWalletNumber] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [paymentNotes, setPaymentNotes] = React.useState('');

  // specialties dropdown
  const [specialties, setSpecialties] = React.useState([]); // [{id,key,label_en,label_ar,active}]
  const [specialtiesLoading, setSpecialtiesLoading] = React.useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = React.useState(null); // one of specialties[] or null

  const [loading, setLoading] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (m, s = 'info') => setSnack({ open: true, message: m, severity: s });

  const fileInputRef = React.useRef(null);
  const dropRef = React.useRef(null);

  /* ---------- load specialties (active only) ---------- */
  const loadSpecialties = React.useCallback(async () => {
    try {
      setSpecialtiesLoading(true);
      // No orderBy here => no composite index needed
      const qy = query(
        collection(db, 'specialties'),
        where('active', '==', true)
      );
      const snap = await getDocs(qy);
      // Client-side Arabic sort to replace orderBy('label_ar')
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.label_ar || '').localeCompare(b.label_ar || '', 'ar', { sensitivity: 'base' })
        );
      setSpecialties(list);
      return list;
    } catch (e) {
      console.error('loadSpecialties error', e);
      openSnack('تعذر تحميل قائمة التخصصات', 'error');
      return [];
    } finally {
      setSpecialtiesLoading(false);
    }
  }, []); // eslint-disable-line

  /* ---------- prefill (load Arabic + images + hours + payment + preselect specialty) ---------- */
  const loadData = React.useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);

      // Load specialties list in parallel
      const spPromise = (specialties.length ? Promise.resolve(specialties) : loadSpecialties());

      const snap = await getDoc(doc(db, 'doctors', user.uid));
      const d = snap.exists() ? (snap.data() || {}) : {};

      setForm((f) => ({
        ...f,
        bio_ar: d.bio_ar || '',
        qualifications_ar: d.qualifications_ar || '',
        university_ar: d.university_ar || '',
        checkupPrice: d.checkupPrice ?? '',
        phone: d.phone || '',
        specialtyAr: d.specialty_ar || d.specialtyAr || '',
      }));

      setImages(Array.isArray(d.profileImages) ? d.profileImages.filter(Boolean) : []);
      // Normalize subspecialties to Arabic strings
      const subs = toSubStrings(d.subspecialties_detail || d.subspecialties || []);
      setSubspecialties(subs);
      setWorkingHours(d.working_hours || null);

      const p = d.payment || {};
      if (p.type) setPayType(p.type);
      setInstapayId(p.instapayId || '');
      setInstapayMobile(p.instapayMobile || '');
      setWalletProvider(p.walletProvider || 'vodafone');
      setWalletNumber(p.walletNumber || '');
      setBankName(p.bankName || '');
      setPaymentNotes(p.notes || '');

      // wait specialties then preselect
      const list = await spPromise;
      // prefer matching by specialty_key if present
      const byKey = d.specialty_key
        ? list.find(s => s.key === d.specialty_key)
        : null;
      if (byKey) {
        setSelectedSpecialty(byKey);
      } else if (d.specialty_ar) {
        // fallback: match by Arabic label
        const byAr = list.find(s => (s.label_ar || '').trim() === (d.specialty_ar || '').trim());
        if (byAr) setSelectedSpecialty(byAr);
      }
    } catch (e) {
      openSnack('تعذر تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, specialties.length, loadSpecialties]); // eslint-disable-line

  React.useEffect(() => { loadData(); }, [loadData]);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /* ---------- image upload via imgbb ---------- */
  const uploadViaImgbb = async (files) => {
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_KEY;
    if (!apiKey) {
      openSnack('مفتاح imgbb غير موجود (NEXT_PUBLIC_IMGBB_KEY)', 'error');
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
          await setDoc(doc(db, 'doctors', user.uid), { profileImages: uploaded }, { merge: true });
        });
        setImages((prev) => [...prev, ...uploaded]);
        openSnack('تم رفع الصورة', 'success');
      }
    } catch {
      openSnack('فشل في رفع الصورة', 'error');
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

  /* ---------- translate Arabic -> English via /api/ask-shafy (mode=translate_ar_to_en) ---------- */
  const translateToEnglish = async ({ bio_ar, qualifications_ar, university_ar, specialtyAr, subs_ar_list }) => {
    try {
      const r = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'translate_ar_to_en',
          items: {
            bio_ar,
            qualifications_ar,
            university_ar,
            specialty_ar: specialtyAr,
            subspecialties_ar: subs_ar_list, // array of strings
          },
          response_format: 'json',
          temperature: 0.1,
          system_extras: [
            'Prefer formal medical wording.',
            'Keep translations concise and professional.',
          ],
          instructions: [
            'Return only valid JSON matching the schema.',
            'Preserve list order for subspecialties.',
          ],
          tags: ['translation','profile']
        }),
      });
      const json = await r.json();
      if (!r.ok || !json?.ok || !json?.translations) {
        throw new Error(json?.error || 'Translation failed');
      }
      return json.translations;
    } catch (e) {
      console.error('translateToEnglish error:', e);
      return null; // caller will fallback
    }
  };

  /* ---------- save (Arabic-only inputs; auto-fill English via translation) ---------- */
  const onSave = async () => {
    if (!user?.uid) {
      openSnack('الرجاء تسجيل الدخول', 'error');
      return;
    }

    // Specialty must be selected from dropdown
    if (!selectedSpecialty) {
      openSnack('برجاء اختيار التخصص من القائمة.', 'warning');
      return;
    }

    // Payment validation
    if (payType === 'instapay') {
      const idOk = instapayId ? isInstaPayId(instapayId) : false;
      const mobOk = instapayMobile ? isEgMobile(instapayMobile) : false;
      if (!idOk && !mobOk) {
        return openSnack(
          'أضف مُعرّف إنستا باي صحيح (name@bank) أو رقم موبايل مصري صحيح (01xxxxxxxxx).',
          'warning'
        );
      }
    }
    if (payType === 'wallet' && walletNumber && !isEgMobile(walletNumber)) {
      return openSnack('أدخل رقم محفظة مصري صحيح (01xxxxxxxxx).', 'warning');
    }

    // Arabic subspecialty list already strings
    const subs_ar_list = (Array.isArray(subspecialties) ? subspecialties : []).map((s) => String(s || '').trim()).filter(Boolean);

    setLoading(true);
    try {
      // 1) Translate all Arabic fields to English
      const translations = await translateToEnglish({
        bio_ar: String(form.bio_ar || '').trim(),
        qualifications_ar: String(form.qualifications_ar || '').trim(),
        university_ar: String(form.university_ar || '').trim(),
        // specialtyAr comes from selectedSpecialty Arabic label
        specialtyAr: String(selectedSpecialty?.label_ar || '').trim(),
        subs_ar_list,
      });

      // Safe fallbacks if translation failed
      const bio_en = translations?.bio_en || String(form.bio_ar || '').trim();
      const qualifications_en = translations?.qualifications_en || String(form.qualifications_ar || '').trim();
      const university_en = translations?.university_en || String(form.university_ar || '').trim();

      // For specialty, prefer canonical English from the selected specialty document
      const specialty_en =
        (selectedSpecialty?.label_en || '').trim() ||
        translations?.specialty_en ||
        String(selectedSpecialty?.label_ar || '').trim();

      const subs_en_list = Array.isArray(translations?.subspecialties_en)
        ? translations.subspecialties_en.map((s) => String(s || '').trim())
        : subs_ar_list;

      // 2) Build subspecialties_detail from strings
      const subs_detail = subs_ar_list.map((ar, i) => ({
        id: ar,                    // use Arabic label as id (stable enough for now)
        name_ar: ar,
        name_en: subs_en_list?.[i] || ar,
      }));

      // 3) Save payload with both Arabic and English + specialty_key
      const payload = {
        // Arabic sources (inputs)
        bio_ar: String(form.bio_ar || '').trim(),
        qualifications_ar: String(form.qualifications_ar || '').trim(),
        university_ar: String(form.university_ar || '').trim(),
        specialty_ar: String(selectedSpecialty?.label_ar || '').trim(),

        // Auto / canonical English
        bio_en,
        qualifications_en,
        university_en,
        specialty_en,

        // Also persist a stable key for joins / filters
        specialty_key: String(selectedSpecialty?.key || '').trim(),

        // General
        checkupPrice: form.checkupPrice ? Number(form.checkupPrice) : 0,
        phone: String(form.phone || '').trim(),

        // subspecialties (Arabic strings) + details
        subspecialties: subs_ar_list,
        subspecialties_detail: subs_detail,

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

      await setDoc(doc(db, 'doctors', user.uid), payload, { merge: true });
      openSnack('تم الحفظ', 'success');
      router.replace('/doctor/profile?lang=ar');
    } catch (e) {
      openSnack(e?.message || 'فشل الحفظ', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <Container maxWidth="md" sx={{ py: 3 }} dir={dir}>
        <Stack direction="row-reverse" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Typography variant="h5" fontWeight={900}>تفاصيل الطبيب</Typography>
          <IconButton onClick={loadData} aria-label="إعادة التحميل">
            <RefreshIcon />
          </IconButton>
        </Stack>

        {/* Photos (imgbb) */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row-reverse" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" color="text.secondary" fontWeight={800}>
              الصور
            </Typography>
            <Stack direction="row-reverse" spacing={1}>
              <input ref={fileInputRef} type="file" accept="image/*" hidden multiple onChange={onPickImages} />
              <Button
                startIcon={<AddAPhotoIcon />}
                variant="outlined"
                onClick={() => fileInputRef.current?.click()}
                sx={{ borderRadius: 2 }}
                disabled={loading || !user?.uid}
              >
                رفع
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
              اسحب وأفلت الصور هنا أو اضغط &quot;رفع&quot;.
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

        {/* Overview (Arabic-only) */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<PersonIcon />} label="النظرة العامة" color="primary" />
          </Stack>
          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <TextField label="نبذة (عربي)" value={form.bio_ar} onChange={onChange('bio_ar')} multiline minRows={3} fullWidth />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField label="المؤهل (عربي)" value={form.qualifications_ar} onChange={onChange('qualifications_ar')} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="الجامعة (عربي)" value={form.university_ar} onChange={onChange('university_ar')} fullWidth />
            </Grid>

            <Grid item xs={6} md={3}>
              <TextField type="number" label="سعر الكشف" value={form.checkupPrice} onChange={onChange('checkupPrice')} fullWidth />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField label="الهاتف" value={form.phone} onChange={onChange('phone')} fullWidth />
            </Grid>
          </Grid>
        </Paper>

        {/* Specialty & Subspecialties (Arabic-only inputs) */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<LocalHospitalIcon />} label="التخصص" color="primary" />
          </Stack>

          {/* Dropdown from Firestore specialties (active), client-sorted by Arabic label */}
          <Autocomplete
            options={specialties}
            loading={specialtiesLoading}
            value={selectedSpecialty}
            onChange={(_e, val) => {
              setSelectedSpecialty(val);
              setForm((f) => ({ ...f, specialtyAr: val?.label_ar || '' }));
            }}
            getOptionLabel={(opt) => (opt?.label_ar || '')}
            isOptionEqualToValue={(opt, val) => opt?.key === val?.key}
            renderInput={(params) => (
              <TextField
                {...params}
                label="اختر التخصص"
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {specialtiesLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            noOptionsText="لا توجد نتائج"
            sx={{ mb: 1.5 }}
          />

          {/* Subspecialties as TextField (comma-separated), replaces dialog/checkboxes */}
          <TextField
            label="التخصصات الفرعية (اكتبها مفصولة بفواصل)"
            value={subspecialties.join('، ')}
            onChange={(e) => {
              // accept both Arabic '،' and English ',' separators
              const raw = e.target.value;
              const arr = raw
                .split(/,|،/g)
                .map((s) => s.trim())
                .filter(Boolean);
              setSubspecialties(arr);
            }}
            fullWidth
            multiline
            minRows={2}
            placeholder="مثال: أسنان الأطفال، التركيبات، علاج الجذور"
          />
        </Paper>

        {/* Clinic Hours */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<AccessTimeIcon />} label="ساعات العمل" color="primary" />
          </Stack>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setOpenHours(true)}
            sx={{ borderRadius: 2 }}
            disabled={!user?.uid}
          >
            تعديل الساعات
          </Button>
          {workingHours ? (
            <Box sx={{ mt: 1, color: 'text.secondary' }}>
              <Typography variant="body2">تم ضبط الساعات.</Typography>
            </Box>
          ) : (
            <Box sx={{ mt: 1, color: 'text.secondary' }}>
              <Typography variant="body2">لا توجد ساعات بعد.</Typography>
            </Box>
          )}
        </Paper>

        {/* Payment */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<MonetizationOnIcon />} label="بيانات الدفع للحجوزات" color="primary" />
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            سيحوّل المريض الرسوم ويحمّل إيصال التحويل، ثم تؤكد الموعد لاحقاً.
          </Typography>

          <RadioGroup row value={payType} onChange={(e) => setPayType(e.target.value)}>
            <FormControlLabel value="instapay" control={<Radio />} label="InstaPay" />
            <FormControlLabel value="wallet" control={<Radio />} label="محفظة موبايل" />
          </RadioGroup>

          {payType === 'instapay' && (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <TextField
                label="معرّف إنستا باي (مثل name@bank)"
                placeholder="username@bank"
                value={instapayId}
                onChange={(e) => setInstapayId(e.target.value)}
                fullWidth
              />
              <TextField
                label="موبايل إنستا باي (01xxxxxxxxx)"
                placeholder="01xxxxxxxxx"
                value={instapayMobile}
                onChange={(e) => setInstapayMobile(e.target.value)}
                fullWidth
              />
              <TextField
                label="اسم البنك (اختياري)"
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
                label="شركة المحفظة"
                value={walletProvider}
                onChange={(e) => setWalletProvider(e.target.value)}
              >
                <MenuItem value="vodafone">فودافون كاش</MenuItem>
                <MenuItem value="etisalat">اتصالات كاش</MenuItem>
                <MenuItem value="orange">أورنج موني</MenuItem>
                <MenuItem value="we">وي باي</MenuItem>
              </TextField>
              <TextField
                label="رقم المحفظة (01xxxxxxxxx)"
                placeholder="01xxxxxxxxx"
                value={walletNumber}
                onChange={(e) => setWalletNumber(e.target.value)}
                fullWidth
              />
            </Stack>
          )}

          <Divider sx={{ my: 1.25 }} />

          <TextField
            label="ملاحظات تُعرض للمريض (اختياري)"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            placeholder="مثال: رجاء كتابة اسمك في ملاحظة التحويل."
            multiline minRows={2}
            fullWidth
          />
        </Paper>

        {/* Save Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button onClick={onSave} variant="contained" disabled={loading || !user?.uid}>
            حفظ ومتابعة
          </Button>
        </Box>

        {/* dialogs */}
        <EditHoursDialog
          open={openHours}
          onClose={() => setOpenHours(false)}
          doctorUID={user?.uid || 'temp'}
          isArabic={true}
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
