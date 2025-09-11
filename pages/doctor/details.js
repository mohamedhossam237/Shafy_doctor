// /pages/doctor/details.jsx
'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Paper, Stack, Typography, Snackbar, Alert, Box, Button,
  TextField, RadioGroup, FormControlLabel, Radio, MenuItem, Divider, Chip
} from '@mui/material';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

import PhotoUploader from '@/components/doctor/PhotoUploader';
import IdentitySection from '@/components/doctor/IdentitySection';
import SpecialtySection from '@/components/doctor/SpecialtySection';
import EducationBioSection from '@/components/doctor/EducationBioSection';
import ClinicHoursSection from '@/components/doctor/ClinicHoursSection';
import FeesSection from '@/components/doctor/FeesInsuranceSection';
import SocialLinksSection from '@/components/doctor/SocialLinksSection';
import AppLayout from '@/components/AppLayout';
import EditSubspecialtiesDialog from '@/components/Profile/EditSubspecialtiesDialog';
import EditHoursDialog from '@/components/Profile/EditHoursDialog';
import EditCertsDialog from '@/components/Profile/EditCertsDialog';

const REQUIRED_KEYS = [
  'nameEn','nameAr','specialtyEn','specialtyAr','phone',
  'universityEn','universityAr','qualificationEn','qualificationAr',
  'graduationYear','experience','bioEn','bioAr','clinicName','clinicCity','clinicCountry'
];

// simple Egyptian mobile validator (010/011/012/015 + 8 digits)
const isEgMobile = (v) => /^01[0-25]\d{8}$/.test(String(v||'').trim());
const isInstaPayId = (v) => /@/.test(String(v||''));

export default function DoctorDetailsFormPage() {
  const router = useRouter();
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const dir = isArabic ? 'rtl' : 'ltr';
  const L = (en, ar) => (isArabic ? ar : en);

  /* ---------- core form state ---------- */
  const [form, setForm] = React.useState({
    nameEn: '', nameAr: '', email: '', phone: '',
    specialtyEn: '', specialtyAr: '',
    universityEn: '', universityAr: '', qualificationEn: '', qualificationAr: '',
    graduationYear: '', experience: '', bioEn: '', bioAr: '',
    gender: '', nationality: '',
    clinicName: '', clinicAddress: '', clinicCity: '', clinicCountry: '',
    latitude: '', longitude: '',
    consultationFee: '', currency: 'USD', appointmentDurationMin: '20',
    telehealth: false,
    website: '', whatsapp:'', facebook:'', instagram:'', twitter:'', linkedin:'', youtube:'', tiktok:''
  });

  const [languages, setLanguages] = React.useState([]);
  const [images, setImages] = React.useState([]);
  const [subspecialties, setSubspecialties] = React.useState([]);
  const [workingHours, setWorkingHours] = React.useState(null);
  const [certs, setCerts] = React.useState([]);

  const [openSubs, setOpenSubs] = React.useState(false);
  const [openHours, setOpenHours] = React.useState(false);
  const [openCerts, setOpenCerts] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, message: '', severity: 'info' });
  const openSnack = (m, s='info') => setSnack({ open: true, message: m, severity: s });

  /* ---------- Payment state ---------- */
  // 'instapay' | 'wallet'
  const [payType, setPayType] = React.useState('instapay');
  const [instapayId, setInstapayId] = React.useState('');
  const [instapayMobile, setInstapayMobile] = React.useState(''); // NEW
  const [walletProvider, setWalletProvider] = React.useState('vodafone');
  const [walletNumber, setWalletNumber] = React.useState('');
  const [bankName, setBankName] = React.useState('');
  const [paymentNotes, setPaymentNotes] = React.useState('');

  /* ---------- Prefill from logged-in doctor ---------- */
  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        setLoading(true);
        const snap = await getDoc(doc(db, 'doctors', u.uid));
        if (!snap.exists()) { setLoading(false); return; }
        const d = snap.data() || {};

        // identity + clinic + fees
        setForm((f) => ({
          ...f,
          nameEn: d.name_en || d.nameEn || '',
          nameAr: d.name_ar || d.nameAr || '',
          email: d.email || '',
          phone: d.phone || '',
          specialtyEn: d.specialty_en || d.specialtyEn || '',
          specialtyAr: d.specialty_ar || d.specialtyAr || '',
          universityEn: d.university_en || d.universityEn || '',
          universityAr: d.university_ar || d.universityAr || '',
          qualificationEn: d.qualifications_en || d.qualificationEn || '',
          qualificationAr: d.qualifications_ar || d.qualificationAr || '',
          graduationYear: d.graduationYear || '',
          experience: d.experienceYears || d.experience || '',
          bioEn: d.bio_en || d.bioEn || '',
          bioAr: d.bio_ar || d.bioAr || '',
          gender: d.gender || '',
          nationality: d.nationality || '',
          clinicName: d.clinic_name || d.clinicName || '',
          clinicAddress: d.clinic_address || d.clinicAddress || '',
          clinicCity: d.clinic_city || d.clinicCity || '',
          clinicCountry: d.clinic_country || d.clinicCountry || '',
          latitude: d.latitude ?? '',
          longitude: d.longitude ?? '',
          consultationFee: d.consultation_fee ?? '',
          currency: d.currency || 'USD',
          appointmentDurationMin: d.appointment_duration_min ?? '20',
          telehealth: !!d.telehealth,
          website: d.website || '',
          whatsapp: d.whatsapp || '',
          facebook: d.facebook || '',
          instagram: d.instagram || '',
          twitter: d.twitter || '',
          linkedin: d.linkedin || '',
          youtube: d.youtube || '',
          tiktok: d.tiktok || ''
        }));

        setLanguages(Array.isArray(d.languages) ? d.languages : []);
        setImages(Array.isArray(d.profileImages) ? d.profileImages : []);
        setSubspecialties(Array.isArray(d.subspecialties_detail) ? d.subspecialties_detail : []);
        setWorkingHours(d.working_hours || null);
        setCerts(Array.isArray(d.certificates) ? d.certificates : []);

        // payment prefill
        const p = d.payment || {};
        if (p.type) setPayType(p.type);
        setInstapayId(p.instapayId || '');
        setInstapayMobile(p.instapayMobile || '');
        setWalletProvider(p.walletProvider || 'vodafone');
        setWalletNumber(p.walletNumber || '');
        setBankName(p.bankName || '');
        setPaymentNotes(p.notes || '');
      } catch (e) {
        openSnack(e?.message || L('Failed to load profile','تعذر تحميل الملف'), 'error');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []); // run once

  /* ---------- Image upload ---------- */
  const onPickImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_KEY;
    if (!apiKey) return openSnack('Missing imgbb key (NEXT_PUBLIC_IMGBB_KEY)', 'error');
    setLoading(true);
    try {
      const uploaded = [];
      for (const file of files) {
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
      setImages((prev) => [...prev, ...uploaded]);
      openSnack(L('Image uploaded','تم رفع الصورة'), 'success');
    } catch {
      openSnack(L('Image upload failed','فشل في رفع الصورة'), 'error');
    } finally {
      setLoading(false);
      if (e?.target) e.target.value = '';
    }
  };

  /* ---------- Save ---------- */
  const onSave = async () => {
    const missing = REQUIRED_KEYS.find((k) => !String(form[k] ?? '').trim());
    if (missing) return openSnack(L('Please fill in all required fields','يرجى ملء جميع الحقول المطلوبة'), 'warning');
    if (!images.length) return openSnack(L('Please upload at least one photo','يرجى رفع صورة واحدة على الأقل'), 'warning');

    // Payment validation:
    if (payType === 'instapay') {
      // At least one of ID or mobile must be present & valid
      const idOk = instapayId ? isInstaPayId(instapayId) : false;
      const mobOk = instapayMobile ? isEgMobile(instapayMobile) : false;
      if (!idOk && !mobOk) {
        return openSnack(
          L('Add a valid InstaPay ID (name@bank) or an Egyptian mobile number (01xxxxxxxxx).',
            'أضف معرّف إنستا باي صالح (name@bank) أو رقم موبايل مصري صحيح (01xxxxxxxxx).'),
          'warning'
        );
      }
    }
    if (payType === 'wallet' && walletNumber && !isEgMobile(walletNumber)) {
      return openSnack(L('Enter a valid Egyptian wallet number (01xxxxxxxxx).','أدخل رقم محفظة مصري صحيح (01xxxxxxxxx).'), 'warning');
    }

    const user = auth.currentUser;
    if (!user) return openSnack(L('Please sign in','الرجاء تسجيل الدخول'), 'error');

    const payload = {
      // identity
      name_en: form.nameEn.trim(), name_ar: form.nameAr.trim(),
      gender: form.gender, nationality: form.nationality.trim(),
      phone: form.phone.trim(), email: form.email.trim(),
      // specialty
      specialty_en: form.specialtyEn.trim(), specialty_ar: form.specialtyAr.trim(),
      subspecialties: subspecialties.map((s)=>s.id),
      subspecialties_detail: subspecialties,
      // education & bio
      university_en: form.universityEn.trim(), university_ar: form.universityAr.trim(),
      qualifications_en: form.qualificationEn.trim(), qualifications_ar: form.qualificationAr.trim(),
      graduationYear: form.graduationYear.trim(), experienceYears: form.experience.trim(),
      bio_en: form.bioEn.trim(), bio_ar: form.bioAr.trim(),
      languages,
      // clinic
      clinic_name: form.clinicName.trim(), clinic_address: form.clinicAddress.trim(),
      clinic_city: form.clinicCity.trim(), clinic_country: form.clinicCountry.trim(),
      latitude: form.latitude ? Number(form.latitude) : '',
      longitude: form.longitude ? Number(form.longitude) : '',
      // hours
      working_hours: workingHours || {},
      // fees & scheduling
      consultation_fee: form.consultationFee ? Number(form.consultationFee) : '',
      currency: form.currency,
      appointment_duration_min: form.appointmentDurationMin ? Number(form.appointmentDurationMin) : 20,
      telehealth: !!form.telehealth,
      // social & media
      website: form.website.trim(), whatsapp: form.whatsapp.trim(), facebook: form.facebook.trim(),
      instagram: form.instagram.trim(), twitter: form.twitter.trim(), linkedin: form.linkedin.trim(),
      youtube: form.youtube.trim(), tiktok: form.tiktok.trim(),
      certificates: certs,
      profileImages: images,

      /* ---------- Payment (supports both InstaPay ID + mobile) ---------- */
      payment: {
        type: payType, // 'instapay' | 'wallet'
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

    setLoading(true);
    try {
      await setDoc(doc(db, 'doctors', user.uid), payload, { merge: true });
      openSnack(L('Saved','تم الحفظ'), 'success');
      router.replace('/');
    } catch (e) {
      openSnack(e?.message || L('Failed to save','حدث خطأ أثناء الحفظ'), 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- UI ---------- */
  return (
    <AppLayout>
      <Container maxWidth="md" sx={{ py: 4 }} dir={dir}>
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={800}>{L('Doctor Details','تفاصيل الطبيب')}</Typography>

            <PhotoUploader images={images} setImages={setImages} onPickImages={onPickImages} loading={loading} isArabic={isArabic} />

            <IdentitySection
              form={form}
              setForm={setForm}
              isArabic={isArabic}
              languages={languages}
              setLanguages={setLanguages}
            />

            <SpecialtySection
              form={form}
              setForm={setForm}
              subspecialties={subspecialties}
              openSubs={openSubs}
              setOpenSubs={setOpenSubs}
              isArabic={isArabic}
            />

            <EducationBioSection form={form} setForm={setForm} isArabic={isArabic} />

            <ClinicHoursSection
              form={form}
              setForm={setForm}
              workingHours={workingHours}
              setOpenHours={setOpenHours}
              isArabic={isArabic}
            />

            <FeesSection form={form} setForm={setForm} isArabic={isArabic} />

            {/* ---------- Payment details ---------- */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Chip color="primary" label={L('Payment details for bookings','بيانات الدفع لتأكيد الحجز')} />
                </Stack>

                <Typography variant="body2" color="text.secondary">
                  {L(
                    'Patients will transfer the fee and upload a receipt. You can confirm the appointment afterwards.',
                    'سيحوّل المريض الرسوم ويحمّل إيصال التحويل، ثم يمكنك تأكيد الموعد.'
                  )}
                </Typography>

                <RadioGroup row value={payType} onChange={(e) => setPayType(e.target.value)}>
                  <FormControlLabel value="instapay" control={<Radio />} label="InstaPay" />
                  <FormControlLabel value="wallet" control={<Radio />} label={L('Mobile Wallet','محفظة موبايل')} />
                </RadioGroup>

                {payType === 'instapay' && (
                  <Stack spacing={1}>
                    <TextField
                      label={L('InstaPay ID (e.g. name@bank)','معرّف إنستا باي (مثل name@bank)')}
                      placeholder="username@bank"
                      value={instapayId}
                      onChange={(e) => setInstapayId(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label={L('InstaPay mobile (01xxxxxxxxx)','موبايل إنستا باي (01xxxxxxxxx)')}
                      placeholder="01xxxxxxxxx"
                      value={instapayMobile}
                      onChange={(e) => setInstapayMobile(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      label={L('Bank (optional)','اسم البنك (اختياري)')}
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      fullWidth
                    />
                  </Stack>
                )}

                {payType === 'wallet' && (
                  <Stack spacing={1}>
                    <TextField
                      select
                      label={L('Wallet provider','شركة المحفظة')}
                      value={walletProvider}
                      onChange={(e) => setWalletProvider(e.target.value)}
                    >
                      <MenuItem value="vodafone">{L('Vodafone Cash','فودافون كاش')}</MenuItem>
                      <MenuItem value="etisalat">{L('Etisalat Cash','اتصالات كاش')}</MenuItem>
                      <MenuItem value="orange">{L('Orange Money','أورنج موني')}</MenuItem>
                      <MenuItem value="we">{L('WE Pay','وي باي')}</MenuItem>
                    </TextField>
                    <TextField
                      label={L('Wallet number (01xxxxxxxxx)','رقم المحفظة (01xxxxxxxxx)')}
                      placeholder="01xxxxxxxxx"
                      value={walletNumber}
                      onChange={(e) => setWalletNumber(e.target.value)}
                      fullWidth
                    />
                  </Stack>
                )}

                <Divider />

                <TextField
                  label={L('Notes shown to patients (optional)','ملاحظات تُعرض للمريض (اختياري)')}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder={L('Example: Please write your name in the transfer note.','مثال: رجاء كتابة اسمك في ملاحظة التحويل.')}
                  multiline minRows={2}
                />
              </Stack>
            </Paper>

            <SocialLinksSection form={form} setForm={setForm} isArabic={isArabic} />

            <Box sx={{ display:'flex', justifyContent: isArabic ? 'flex-start':'flex-end' }}>
              <Button variant="outlined" onClick={()=>setOpenCerts(true)}>
                {L('Edit Certifications','تعديل الشهادات')}
              </Button>
            </Box>

            <Box sx={{ position: 'sticky', bottom: -16, pt: 1 }}>
              <Paper elevation={3} sx={{ p: 1.5, borderRadius: 2, display:'flex', justifyContent: isArabic?'flex-start':'flex-end' }}>
                <Button onClick={onSave} variant="contained" disabled={loading}>
                  {L('Save & Continue','حفظ ومتابعة')}
                </Button>
              </Paper>
            </Box>
          </Stack>
        </Paper>

        {/* Dialogs */}
        <EditSubspecialtiesDialog
          open={openSubs}
          onClose={()=>setOpenSubs(false)}
          doctorUID={auth.currentUser?.uid || 'temp'}
          isArabic={isArabic}
          initialSelected={subspecialties}
          onSaved={(arr)=>{ setSubspecialties(arr); setOpenSubs(false); }}
        />
        <EditHoursDialog
          open={openHours}
          onClose={()=>setOpenHours(false)}
          doctorUID={auth.currentUser?.uid || 'temp'}
          isArabic={isArabic}
          initialHours={workingHours}
          onSaved={(obj)=>{ setWorkingHours(obj); setOpenHours(false); }}
        />
        <EditCertsDialog
          open={openCerts}
          onClose={()=>setOpenCerts(false)}
          doctorUID={auth.currentUser?.uid || 'temp'}
          isArabic={isArabic}
          initialCerts={certs}
          onSaved={(arr)=>{ setCerts(arr); setOpenCerts(false); }}
        />

        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={()=>setSnack((s)=>({...s,open:false}))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snack.severity} onClose={()=>setSnack((s)=>({...s,open:false}))}>
            {snack.message}
          </Alert>
        </Snackbar>
      </Container>
    </AppLayout>
  );
}
