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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ToggleOnIcon from '@mui/icons-material/ToggleOn';
import ToggleOffIcon from '@mui/icons-material/ToggleOff';
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
      return (s.name_ar || s.label || String(s.id ?? '')).trim();
    })
    .filter(Boolean);
};

const makeId = () => `svc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const makeClinicId = () => `clinic_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

export default function DoctorDetailsPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Force Arabic-only UI
  const isArabic = true;
  const dir = 'rtl';
  const t = (_en, ar) => ar;

  /* ---------- form state (Arabic inputs only) ---------- */
  const [form, setForm] = React.useState({
    bio_ar: '',
    qualifications_ar: '',
    university_ar: '',
    checkupPrice: '',
    followUpPrice: '',           // NEW: follow-up session price
    phone: '',
    specialtyAr: '',
  });

  const [images, setImages] = React.useState([]);
  const [subspecialties, setSubspecialties] = React.useState([]);

  const [openHours, setOpenHours] = React.useState(false);

  // Multi Clinics
  const [clinics, setClinics] = React.useState([]);
  const [newClinic, setNewClinic] = React.useState({ name_ar: '', address_ar: '', phone: '' });
  const [editingClinicId, setEditingClinicId] = React.useState(null);
  const [editClinic, setEditClinic] = React.useState({ name_ar: '', address_ar: '', phone: '' });
  const [hoursClinicId, setHoursClinicId] = React.useState(null);

  // payment
  const [payType, setPayType] = React.useState('instapay');
  const [instapayId, setInstapayId] = React.useState('');
  const [instapayMobile, setInstapayMobile] = React.useState('');
  const [walletProvider, setWalletProvider] = React.useState('vodafone');
  const [walletNumber, setWalletNumber] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [paymentNotes, setPaymentNotes] = React.useState('');

  // specialties dropdown
  const [specialties, setSpecialties] = React.useState([]);
  const [specialtiesLoading, setSpecialtiesLoading] = React.useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = React.useState(null);

  // Extra services
  const [extraServices, setExtraServices] = React.useState([]);
  const [newSvcName, setNewSvcName] = React.useState('');
  const [newSvcPrice, setNewSvcPrice] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [editName, setEditName] = React.useState('');
  const [editPrice, setEditPrice] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (m, s = 'info') => setSnack({ open: true, message: m, severity: s });

  const fileInputRef = React.useRef(null);
  const dropRef = React.useRef(null);

  /* ---------- load specialties (active only) ---------- */
  const loadSpecialties = React.useCallback(async () => {
    try {
      setSpecialtiesLoading(true);
      const qy = query(collection(db, 'specialties'), where('active', '==', true));
      const snap = await getDocs(qy);
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

  /* ---------- prefill (Arabic + images + payment + specialty + extras + clinics) ---------- */
  const loadData = React.useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const spPromise = (specialties.length ? Promise.resolve(specialties) : loadSpecialties());

      const snap = await getDoc(doc(db, 'doctors', user.uid));
      const d = snap.exists() ? (snap.data() || {}) : {};

      setForm((f) => ({
        ...f,
        bio_ar: d.bio_ar || '',
        qualifications_ar: d.qualifications_ar || '',
        university_ar: d.university_ar || '',
        checkupPrice: d.checkupPrice ?? '',
        followUpPrice: d.followUpPrice ?? d.followupPrice ?? '', // back-compat
        phone: d.phone || '',
        specialtyAr: d.specialty_ar || d.specialtyAr || '',
      }));

      setImages(Array.isArray(d.profileImages) ? d.profileImages.filter(Boolean) : []);
      const subs = toSubStrings(d.subspecialties_detail || d.subspecialties || []);
      setSubspecialties(subs);

      // Clinics
      const incomingClinics = Array.isArray(d.clinics) ? d.clinics : [];
      let normalizedClinics = incomingClinics
        .filter(Boolean)
        .map((c) => ({
          id: c.id || makeClinicId(),
          name_ar: (c.name_ar || 'العيادة').trim(),
          address_ar: (c.address_ar || '').trim(),
          phone: (c.phone || '').trim(),
          active: c.active !== false,
          working_hours: c.working_hours || null,
        }));
      if (normalizedClinics.length === 0 && d.working_hours) {
        normalizedClinics = [{
          id: makeClinicId(),
          name_ar: 'العيادة الرئيسية',
          address_ar: '',
          phone: d.phone || '',
          active: true,
          working_hours: d.working_hours,
        }];
      }
      setClinics(normalizedClinics);

      // payment
      const p = d.payment || {};
      if (p.type) setPayType(p.type);
      setInstapayId(p.instapayId || '');
      setInstapayMobile(p.instapayMobile || '');
      setWalletProvider(p.walletProvider || 'vodafone');
      setWalletNumber(p.walletNumber || '');
      setBankName(p.bankName || '');
      setPaymentNotes(p.notes || '');

      // extra services
      const extras = Array.isArray(d.extraServices) ? d.extraServices : [];
      setExtraServices(
        extras
          .filter(Boolean)
          .map((e) => ({
            id: e.id || makeId(),
            name_ar: e.name_ar || e.name || '',
            name_en: e.name_en || '',
            price: Number(e.price || 0) || 0,
            active: e.active !== false,
          }))
      );

      // preselect specialty
      const list = await spPromise;
      const byKey = d.specialty_key ? list.find(s => s.key === d.specialty_key) : null;
      if (byKey) {
        setSelectedSpecialty(byKey);
      } else if (d.specialty_ar) {
        const byAr = list.find(s => (s.label_ar || '').trim() === (d.specialty_ar || '').trim());
        if (byAr) setSelectedSpecialty(byAr);
      }
    } catch (e) {
      console.error(e);
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

  /* ---------- translate Arabic -> English via /api/ask-shafy (with Firebase auth) ---------- */
  const translateToEnglish = async ({ bio_ar, qualifications_ar, university_ar, specialtyAr, subs_ar_list }) => {
    try {
      const idToken = await user?.getIdToken?.();
      const r = await fetch('/api/ask-shafy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          mode: 'translate_ar_to_en',
          items: {
            bio_ar,
            qualifications_ar,
            university_ar,
            specialty_ar: specialtyAr,
            subspecialties_ar: subs_ar_list,
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
      return null;
    }
  };

  /* ---------- save ---------- */
  const onSave = async () => {
    if (!user?.uid) {
      openSnack('الرجاء تسجيل الدخول', 'error');
      return;
    }

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

    // Positive numeric checks for prices
    const checkup = form.checkupPrice ? Number(form.checkupPrice) : 0;
    const followup = form.followUpPrice ? Number(form.followUpPrice) : 0;
    if (checkup < 0 || followup < 0) {
      return openSnack('الأسعار لا يمكن أن تكون سالبة.', 'warning');
    }

    const subs_ar_list = (Array.isArray(subspecialties) ? subspecialties : [])
      .map((s) => String(s || '').trim()).filter(Boolean);

    const hasActiveClinic = clinics.some(c => c.active !== false);
    if (!hasActiveClinic) {
      return openSnack('أضف عيادة واحدة على الأقل أو فعّل عيادة قائمة.', 'warning');
    }

    setLoading(true);
    try {
      const translations = await translateToEnglish({
        bio_ar: String(form.bio_ar || '').trim(),
        qualifications_ar: String(form.qualifications_ar || '').trim(),
        university_ar: String(form.university_ar || '').trim(),
        specialtyAr: String(selectedSpecialty?.label_ar || '').trim(),
        subs_ar_list,
      });

      const bio_en = translations?.bio_en || String(form.bio_ar || '').trim();
      const qualifications_en = translations?.qualifications_en || String(form.qualifications_ar || '').trim();
      const university_en = translations?.university_en || String(form.university_ar || '').trim();

      const specialty_en =
        (selectedSpecialty?.label_en || '').trim() ||
        translations?.specialty_en ||
        String(selectedSpecialty?.label_ar || '').trim();

      const subs_en_list = Array.isArray(translations?.subspecialties_en)
        ? translations.subspecialties_en.map((s) => String(s || '').trim())
        : subs_ar_list;

      const subs_detail = subs_ar_list.map((ar, i) => ({
        id: ar,
        name_ar: ar,
        name_en: subs_en_list?.[i] || ar,
      }));

      const clinicsPayload = clinics.map(c => ({
        id: c.id,
        name_ar: String(c.name_ar || '').trim() || 'العيادة',
        address_ar: String(c.address_ar || '').trim(),
        phone: String(c.phone || '').trim(),
        active: c.active !== false,
        working_hours: c.working_hours || null,
      }));

      const payload = {
        // Arabic sources
        bio_ar: String(form.bio_ar || '').trim(),
        qualifications_ar: String(form.qualifications_ar || '').trim(),
        university_ar: String(form.university_ar || '').trim(),
        specialty_ar: String(selectedSpecialty?.label_ar || '').trim(),

        // English auto
        bio_en,
        qualifications_en,
        university_en,
        specialty_en,

        specialty_key: String(selectedSpecialty?.key || '').trim(),

        // Prices
        checkupPrice: Number.isFinite(checkup) ? checkup : 0,
        followUpPrice: Number.isFinite(followup) ? followup : 0, // NEW: persist follow-up price

        phone: String(form.phone || '').trim(),

        subspecialties: subs_ar_list,
        subspecialties_detail: subs_detail,

        clinics: clinicsPayload,

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

        extraServices: extraServices.map(e => ({
          id: e.id,
          name_ar: e.name_ar || '',
          name_en: e.name_en || '',
          price: Number(e.price || 0) || 0,
          active: e.active !== false,
        })),

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

  /* ---------- Extra Services: CRUD helpers ---------- */
  const persistExtras = async (next) => {
    setExtraServices(next);
    try {
      await updateDoc(doc(db, 'doctors', user.uid), {
        extraServices: next.map(e => ({
          id: e.id,
          name_ar: e.name_ar || '',
          name_en: e.name_en || '',
          price: Number(e.price || 0) || 0,
          active: e.active !== false,
        })),
        updatedAt: serverTimestamp(),
      });
      openSnack('تم تحديث الخدمات الإضافية', 'success');
    } catch {
      await setDoc(doc(db, 'doctors', user.uid), {
        extraServices: next.map(e => ({
          id: e.id,
          name_ar: e.name_ar || '',
          name_en: e.name_en || '',
          price: Number(e.price || 0) || 0,
          active: e.active !== false,
        })),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      openSnack('تم حفظ الخدمات الإضافية', 'success');
    }
  };

  const addExtra = async () => {
    const name = String(newSvcName || '').trim();
    const price = Number(newSvcPrice);
    if (!name) return openSnack('اكتب اسم الخدمة', 'warning');
    if (!Number.isFinite(price) || price <= 0) return openSnack('أدخل سعرًا صحيحًا', 'warning');

    const next = [
      ...extraServices,
      { id: makeId(), name_ar: name, name_en: '', price, active: true }
    ];
    setNewSvcName('');
    setNewSvcPrice('');
    await persistExtras(next);
  };

  const startEdit = (svc) => {
    setEditingId(svc.id);
    setEditName(svc.name_ar || svc.name_en || '');
    setEditPrice(String(svc.price ?? ''));
  };
  const cancelEdit = () => { setEditingId(null); setEditName(''); setEditPrice(''); };

  const saveEdit = async (svc) => {
    const name = String(editName || '').trim();
    const price = Number(editPrice);
    if (!name) return openSnack('اكتب اسم الخدمة', 'warning');
    if (!Number.isFinite(price) || price <= 0) return openSnack('أدخل سعرًا صحيحًا', 'warning');
    const next = extraServices.map(e => e.id === svc.id ? { ...e, name_ar: name, price } : e);
    await persistExtras(next);
    cancelEdit();
  };

  const toggleActive = async (svc) => {
    const next = extraServices.map(e => e.id === svc.id ? { ...e, active: !e.active } : e);
    await persistExtras(next);
  };

  const deleteSvc = async (svc) => {
    const next = extraServices.filter(e => e.id !== svc.id);
    await persistExtras(next);
  };

  /* ---------- Clinics: CRUD helpers ---------- */
  const persistClinics = async (next) => {
    setClinics(next);
    try {
      await updateDoc(doc(db, 'doctors', user.uid), {
        clinics: next.map(c => ({
          id: c.id,
          name_ar: c.name_ar || 'العيادة',
          address_ar: c.address_ar || '',
          phone: c.phone || '',
          active: c.active !== false,
          working_hours: c.working_hours || null,
        })),
        updatedAt: serverTimestamp(),
      });
      openSnack('تم تحديث بيانات العيادات', 'success');
    } catch {
      await setDoc(doc(db, 'doctors', user.uid), {
        clinics: next.map(c => ({
          id: c.id,
          name_ar: c.name_ar || 'العيادة',
          address_ar: c.address_ar || '',
          phone: c.phone || '',
          active: c.active !== false,
          working_hours: c.working_hours || null,
        })),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      openSnack('تم حفظ بيانات العيادات', 'success');
    }
  };

  const addClinic = async () => {
    const name = String(newClinic.name_ar || '').trim();
    const address = String(newClinic.address_ar || '').trim();
    const phone = String(newClinic.phone || '').trim();
    if (!name) return openSnack('اكتب اسم العيادة', 'warning');

    const next = [
      ...clinics,
      { id: makeClinicId(), name_ar: name, address_ar: address, phone, active: true, working_hours: null }
    ];
    setNewClinic({ name_ar: '', address_ar: '', phone: '' });
    await persistClinics(next);
  };

  const startEditClinic = (c) => {
    setEditingClinicId(c.id);
    setEditClinic({ name_ar: c.name_ar || '', address_ar: c.address_ar || '', phone: c.phone || '' });
  };
  const cancelEditClinic = () => { setEditingClinicId(null); setEditClinic({ name_ar: '', address_ar: '', phone: '' }); };

  const saveEditClinic = async (c) => {
    const name = String(editClinic.name_ar || '').trim();
    if (!name) return openSnack('اكتب اسم العيادة', 'warning');
    const next = clinics.map(x => x.id === c.id ? {
      ...x,
      name_ar: name,
      address_ar: String(editClinic.address_ar || '').trim(),
      phone: String(editClinic.phone || '').trim(),
    } : x);
    await persistClinics(next);
    cancelEditClinic();
  };

  const toggleClinicActive = async (c) => {
    const next = clinics.map(x => x.id === c.id ? { ...x, active: !x.active } : x);
    await persistClinics(next);
  };

  const deleteClinic = async (c) => {
    const next = clinics.filter(x => x.id !== c.id);
    await persistClinics(next);
  };

  const openHoursForClinic = (c) => {
    setHoursClinicId(c.id);
    setOpenHours(true);
  };

  const handleHoursSaved = (obj) => {
    setOpenHours(false);
    if (!hoursClinicId) return;
    const next = clinics.map(c => c.id === hoursClinicId ? { ...c, working_hours: obj || {} } : c);
    setHoursClinicId(null);
    persistClinics(next);
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

        {/* Photos */}
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
              {/* NEW: follow-up price */}
              <TextField
                type="number"
                label="سعر المتابعة"
                value={form.followUpPrice}
                onChange={onChange('followUpPrice')}
                helperText="سعر جلسة المتابعة (مختلف عن سعر الكشف)"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="الهاتف (عام)" value={form.phone} onChange={onChange('phone')} fullWidth />
            </Grid>
          </Grid>
        </Paper>

        {/* Specialty & Subspecialties */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<LocalHospitalIcon />} label="التخصص" color="primary" />
          </Stack>

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

          <TextField
            label="التخصصات الفرعية (اكتبها مفصولة بفواصل)"
            value={subspecialties.join('، ')}
            onChange={(e) => {
              const raw = e.target.value;
              const arr = raw.split(/,|،/g).map((s) => s.trim()).filter(Boolean);
              setSubspecialties(arr);
            }}
            fullWidth
            multiline
            minRows={2}
            placeholder="مثال: أسنان الأطفال، التركيبات، علاج الجذور"
          />
        </Paper>

        {/* Clinics */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<LocalHospitalIcon />} label="العيادات" color="primary" />
          </Stack>

          <Grid container spacing={1}>
            <Grid item xs={12} md={4}>
              <TextField
                label="اسم العيادة"
                value={newClinic.name_ar}
                onChange={(e) => setNewClinic((c) => ({ ...c, name_ar: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                label="العنوان"
                value={newClinic.address_ar}
                onChange={(e) => setNewClinic((c) => ({ ...c, address_ar: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={7} md={2}>
              <TextField
                label="هاتف العيادة"
                value={newClinic.phone}
                onChange={(e) => setNewClinic((c) => ({ ...c, phone: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={5} md={1} sx={{ display: 'flex', alignItems: 'stretch' }}>
              <Button
                onClick={addClinic}
                variant="contained"
                sx={{ borderRadius: 2, width: '100%' }}
                disabled={!user?.uid}
              >
                إضافة
              </Button>
            </Grid>
          </Grid>

          <Stack spacing={1.25} sx={{ mt: 1 }}>
            {clinics.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                لا توجد عيادات بعد.
              </Typography>
            ) : (
              clinics.map((c) => {
                const editing = editingClinicId === c.id;
                return (
                  <Paper key={c.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                    {editing ? (
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={12} md={3}>
                          <TextField
                            label="اسم العيادة"
                            value={editClinic.name_ar}
                            onChange={(e) => setEditClinic((v) => ({ ...v, name_ar: e.target.value }))}
                            fullWidth size="small"
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            label="العنوان"
                            value={editClinic.address_ar}
                            onChange={(e) => setEditClinic((v) => ({ ...v, address_ar: e.target.value }))}
                            fullWidth size="small"
                          />
                        </Grid>
                        <Grid item xs={7} md={2}>
                          <TextField
                            label="هاتف العيادة"
                            value={editClinic.phone}
                            onChange={(e) => setEditClinic((v) => ({ ...v, phone: e.target.value }))}
                            fullWidth size="small"
                          />
                        </Grid>
                        <Grid item xs={5} md={1}>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" onClick={() => saveEditClinic(c)}>حفظ</Button>
                            <Button size="small" onClick={cancelEditClinic}>إلغاء</Button>
                          </Stack>
                        </Grid>
                      </Grid>
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                            <Typography fontWeight={800} sx={{ maxWidth: { xs: '100%', md: 400 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.name_ar}
                            </Typography>
                            <Chip
                              label={c.active ? 'مفعل' : 'موقوف'}
                              size="small"
                              color={c.active ? 'success' : 'default'}
                              sx={{ fontWeight: 700 }}
                            />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {c.address_ar || '—'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            هاتف: {c.phone || '—'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {c.working_hours ? 'تم ضبط ساعات العمل' : 'لا توجد ساعات عمل بعد'}
                          </Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton aria-label="تعديل الساعات" onClick={() => openHoursForClinic(c)} title="تعديل ساعات العمل">
                            <AccessTimeIcon />
                          </IconButton>
                          <IconButton aria-label="تبديل الحالة" onClick={() => toggleClinicActive(c)}>
                            {c.active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon />}
                          </IconButton>
                          <IconButton aria-label="تعديل" onClick={() => startEditClinic(c)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton aria-label="حذف" onClick={() => deleteClinic(c)}>
                            <DeleteOutlineIcon color="error" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    )}
                  </Paper>
                );
              })
            )}
          </Stack>

          <Alert severity="info" sx={{ mt: 1 }}>
            يمكن إضافة أكثر من عيادة لكل طبيب، ولكل عيادة ساعات عمل خاصة بها.
          </Alert>
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

        {/* Extra Services */}
        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Chip icon={<MonetizationOnIcon />} label="خدمات إضافية" color="primary" />
          </Stack>

          <Grid container spacing={1}>
            <Grid item xs={12} md={7}>
              <TextField
                label="اسم الخدمة (عربي)"
                value={newSvcName}
                onChange={(e) => setNewSvcName(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={7} md={3}>
              <TextField
                type="number"
                label="السعر"
                value={newSvcPrice}
                onChange={(e) => setNewSvcPrice(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={5} md={2} sx={{ display: 'flex', alignItems: 'stretch' }}>
              <Button
                onClick={addExtra}
                variant="contained"
                sx={{ borderRadius: 2, width: '100%' }}
                disabled={!user?.uid}
              >
                إضافة
              </Button>
            </Grid>
          </Grid>

          <Stack spacing={1} sx={{ mt: 1 }}>
            {extraServices.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                لا توجد خدمات إضافية بعد.
              </Typography>
            ) : (
              extraServices.map((svc) => {
                const editing = editingId === svc.id;
                return (
                  <Paper key={svc.id} variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                    {editing ? (
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={12} md={7}>
                          <TextField
                            label="اسم الخدمة (عربي)"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={7} md={3}>
                          <TextField
                            type="number"
                            label="السعر"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            fullWidth
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={5} md={2}>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" onClick={() => saveEdit(svc)}>حفظ</Button>
                            <Button size="small" onClick={cancelEdit}>إلغاء</Button>
                          </Stack>
                        </Grid>
                      </Grid>
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Typography fontWeight={800} sx={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {svc.name_ar || '—'}
                          </Typography>
                          <Chip
                            label={`${Number(svc.price || 0)} ج.م`}
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                          <Chip
                            label={svc.active ? 'مفعل' : 'موقوف'}
                            size="small"
                            color={svc.active ? 'success' : 'default'}
                            sx={{ fontWeight: 700 }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton aria-label="تبديل الحالة" onClick={() => toggleActive(svc)}>
                            {svc.active ? <ToggleOnIcon color="success" /> : <ToggleOffIcon />}
                          </IconButton>
                          <IconButton aria-label="تعديل" onClick={() => startEdit(svc)}>
                            <EditIcon />
                          </IconButton>
                          <IconButton aria-label="حذف" onClick={() => deleteSvc(svc)}>
                            <DeleteOutlineIcon color="error" />
                          </IconButton>
                        </Stack>
                      </Stack>
                    )}
                  </Paper>
                );
              })
            )}
          </Stack>

          <Alert severity="info" sx={{ mt: 1 }}>
            ستكون هذه الخدمات الإضافية متاحة للمريض ليختار منها أثناء الحجز، وسيظهر إجمالي تقديري.
          </Alert>
        </Paper>

        {/* Save Bar */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button onClick={onSave} variant="contained" disabled={loading || !user?.uid}>
            حفظ ومتابعة
          </Button>
        </Box>

        {/* Hours dialog (per clinic) */}
        <EditHoursDialog
          open={openHours}
          onClose={() => { setOpenHours(false); setHoursClinicId(null); }}
          doctorUID={user?.uid || 'temp'}
          isArabic={true}
          initialHours={clinics.find(c => c.id === hoursClinicId)?.working_hours || null}
          onSaved={handleHoursSaved}
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
