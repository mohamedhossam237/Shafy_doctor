'use client';
import * as React from 'react';
import { useRouter } from 'next/router';
import {
  Container, Paper, Stack, Typography, Snackbar, Alert, Box, Button,
} from '@mui/material';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

import PhotoUploader from '@/components/doctor/PhotoUploader';
import IdentitySection from '@/components/doctor/IdentitySection';
import SpecialtySection from '@/components/doctor/SpecialtySection';
import EducationBioSection from '@/components/doctor/EducationBioSection';
import ClinicHoursSection from '@/components/doctor/ClinicHoursSection';
import FeesSection from '@/components/doctor/FeesInsuranceSection';      // <<— new
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

export default function DoctorDetailsFormPage() {
  const router = useRouter();
  const isArabic = router?.query?.lang === 'ar' || router?.query?.ar === '1';
  const dir = isArabic ? 'rtl' : 'ltr';
  const L = (en, ar) => (isArabic ? ar : en);

  const [form, setForm] = React.useState({
    nameEn: '', nameAr: '', email: '', phone: '',
    specialtyEn: '', specialtyAr: '',
    universityEn: '', universityAr: '', qualificationEn: '', qualificationAr: '',
    graduationYear: '', experience: '', bioEn: '', bioAr: '',
    gender: '', nationality: '',
    clinicName: '', clinicAddress: '', clinicCity: '', clinicCountry: '',
    latitude: '', longitude: '',
    consultationFee: '', currency: 'USD', appointmentDurationMin: '20',
    telehealth: false,                                 // keep telehealth
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

  const onSave = async () => {
    const missing = REQUIRED_KEYS.find((k) => !String(form[k] ?? '').trim());
    if (missing) return openSnack(L('Please fill in all required fields','يرجى ملء جميع الحقول المطلوبة'), 'warning');
    if (!images.length) return openSnack(L('Please upload at least one photo','يرجى رفع صورة واحدة على الأقل'), 'warning');

    const user = auth.currentUser;
    if (!user) return openSnack(L('Please sign in','الرجاء تسجيل الدخول'), 'error');

    const payload = {
      // identity
      name_en: form.nameEn.trim(), name_ar: form.nameAr.trim(),
      gender: form.gender, nationality: form.nationality.trim(),
      phone: form.phone.trim(), email: form.email.trim(),
      // specialty
      specialty_en: form.specialtyEn.trim(), specialty_ar: form.specialtyAr.trim(),
      subspecialties: subspecialties.map((s)=>s.id), subspecialties_detail: subspecialties,
      // education & bio
      university_en: form.universityEn.trim(), university_ar: form.universityAr.trim(),
      qualifications_en: form.qualificationEn.trim(), qualifications_ar: form.qualificationAr.trim(),
      graduationYear: form.graduationYear.trim(), experienceYears: form.experience.trim(),
      bio_en: form.bioEn.trim(), bio_ar: form.bioAr.trim(),
      languages,
      // clinic
      clinic_name: form.clinicName.trim(), clinic_address: form.clinicAddress.trim(),
      clinic_city: form.clinicCity.trim(), clinic_country: form.clinicCountry.trim(),
      latitude: form.latitude ? Number(form.latitude) : '', longitude: form.longitude ? Number(form.longitude) : '',
      // hours
      working_hours: workingHours || {},
      // fees & scheduling (no insurance)
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
      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    };

    setLoading(true);
    try {
      await setDoc(doc(db, 'doctors', user.uid), payload, { merge: true });
      openSnack(L('Saved','تم الحفظ'), 'success');
      router.replace('/');
    } catch {
      openSnack(L('Failed to save','حدث خطأ أثناء الحفظ'), 'error');
    } finally {
      setLoading(false);
    }
  };

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

          {/* No insurance UI anymore */}
          <FeesSection form={form} setForm={setForm} isArabic={isArabic} />

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

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={()=>setSnack((s)=>({...s,open:false}))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={()=>setSnack((s)=>({...s,open:false}))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
    </AppLayout>
  );
}
