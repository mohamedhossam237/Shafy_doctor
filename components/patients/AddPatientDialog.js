'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  Box,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Typography,
  InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import MaleRoundedIcon from '@mui/icons-material/MaleRounded';
import FemaleRoundedIcon from '@mui/icons-material/FemaleRounded';
import MedicalInformationRoundedIcon from '@mui/icons-material/MedicalInformationRounded';
import BloodtypeRoundedIcon from '@mui/icons-material/BloodtypeRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import {
  getDocs,
  addDoc,
  serverTimestamp,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';
import HealthInfoSection from '@/components/patients/HealthInfoSection';

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

const PHONE_RE = /^[\d\s+()-]{8,}$/;
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const QUICK_ALLERGIES_AR = ['بنسلين', 'أسبرين', 'سلفا', 'مكسرات', 'لا يوجد'];
const QUICK_ALLERGIES_EN = ['Penicillin', 'Aspirin', 'Sulfa', 'Peanuts', 'None'];
const QUICK_CONDITIONS_AR = ['سكري', 'ضغط دم مرتفع', 'ربو', 'أمراض قلب', 'غدة درقية'];
const QUICK_CONDITIONS_EN = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'Thyroid'];

function normalizePhoneForStorage(raw = '') {
  const s = String(raw).trim();
  if (!s) return '';
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  const phoneDigits = d.replace(/^0+/, '');
  if (phoneDigits.startsWith('20')) return `+${phoneDigits}`;
  return `+20${phoneDigits}`;
}

function appendCsvToken(current, token) {
  const list = String(current || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (list.some((x) => x.toLowerCase() === token.toLowerCase())) {
    return list.filter((x) => x.toLowerCase() !== token.toLowerCase()).join(', ');
  }
  return [...list, token].join(', ');
}

function hasCsvToken(current, token) {
  return String(current || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .includes(token.toLowerCase());
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  age: '',
  gender: '',
  address: '',
  email: '',
  bloodType: '',
  allergies: '',
  conditions: '',
  medications: '',
  notes: '',
  isDiabetic: false,
  hadSurgeries: false,
  isSmoker: false,
  drinksAlcohol: false,
  familyHistory: false,
  isPregnant: false,
  familyRelation: 'himself',
};

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export default function AddPatientDialog({ open, onClose, onSaved, isArabic: isArProp }) {
  const router = useRouter();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();

  const isArabic = React.useMemo(() => {
    if (typeof isArProp === 'boolean') return isArProp;
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router?.query, isArProp]);

  const t = (en, ar) => (isArabic ? ar : en);

  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });
  const [activeStep, setActiveStep] = React.useState('quick'); // 'quick' | 'medical'
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [relation, setRelation] = React.useState('himself');
  const [linkedTo, setLinkedTo] = React.useState(null);
  const [showRelationPicker, setShowRelationPicker] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  React.useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setSubmitting(false);
      setActiveStep('quick');
      setRelation('himself');
      setLinkedTo(null);
      setShowRelationPicker(false);
    }
  }, [open]);

  const handleChange = (field) => (e) => {
    const v = e?.target?.value ?? '';
    setForm((f) => ({ ...f, [field]: v }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name?.trim()) next.name = t('Required', 'الاسم مطلوب');
    if (!form.phone?.trim()) next.phone = t('Phone is required', 'رقم الهاتف مطلوب');
    else if (!PHONE_RE.test(form.phone)) next.phone = t('Invalid phone', 'رقم هاتف غير صالح');
    if (form.age && (!/^\d{1,3}$/.test(String(form.age)) || Number(form.age) > 120))
      next.age = t('Enter a valid age (0–120)', 'أدخل عمرًا صحيحًا (0–120)');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = t('Invalid email', 'بريد إلكتروني غير صالح');
    setErrors(next);
    if (next.name || next.phone || next.age) setActiveStep('quick');
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!user) {
      setSnack({ open: true, msg: t('You must be signed in.', 'يجب تسجيل الدخول.'), severity: 'error' });
      return;
    }
    if (!validate()) return;

    try {
      setSubmitting(true);
      const normalizedPhone = normalizePhoneForStorage(form.phone);
      const patientsCol = collection(db, 'patients');

      // Run duplicate name & phone checks in parallel
      const [nameSnap, phoneSnap] = await Promise.all([
        getDocs(
          query(
            patientsCol,
            where('associatedDoctors', 'array-contains', user.uid),
            where('name', '==', form.name.trim())
          )
        ),
        getDocs(
          query(
            patientsCol,
            where('associatedDoctors', 'array-contains', user.uid),
            where('phone', '==', normalizedPhone)
          )
        ),
      ]);

      if (!nameSnap.empty) {
        setSnack({
          open: true,
          msg: t('A patient with this name already exists in your list.', 'يوجد مريض بهذا الاسم بالفعل في قائمتك.'),
          severity: 'error',
        });
        setActiveStep('quick');
        setSubmitting(false);
        return;
      }

      if (!phoneSnap.empty && !showRelationPicker) {
        const primary = phoneSnap.docs.find((d) => d.data().familyRelation === 'himself') || phoneSnap.docs[0];
        setLinkedTo(primary.id);
        setShowRelationPicker(true);
        setActiveStep('quick');
        setSubmitting(false);
        return;
      }

      const payload = {
        ...form,
        name: form.name.trim(),
        phone: normalizedPhone,
        age: form.age ? Number(form.age) : null,
        address: form.address?.trim() || null,
        email: form.email?.trim() || null,
        lastVisit: null,
        registeredBy: user.uid,
        associatedDoctors: [user.uid],
        familyRelation: relation,
        linkedTo: linkedTo || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'patients'), payload);

      setSnack({
        open: true,
        msg: t('Patient added successfully.', 'تم إضافة المريض بنجاح.'),
        severity: 'success',
      });
      onSaved?.(docRef.id);
      onClose?.();
    } catch (e) {
      console.error(e);
      setSnack({ open: true, msg: t('Failed to add patient.', 'فشل في إضافة المريض.'), severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const initials = React.useMemo(() => {
    const clean = String(form.name || '').trim();
    if (!clean) return isArabic ? 'م' : 'P';
    return clean
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }, [form.name, isArabic]);

  const allergyChips = isArabic ? QUICK_ALLERGIES_AR : QUICK_ALLERGIES_EN;
  const conditionChips = isArabic ? QUICK_CONDITIONS_AR : QUICK_CONDITIONS_EN;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      PaperProps={{
        sx: {
          borderRadius: fullScreen ? 0 : '24px',
          overflow: 'hidden',
          direction: isArabic ? 'rtl' : 'ltr',
          textAlign: isArabic ? 'right' : 'left',
        },
      }}
    >
      {/* Royal Sapphire Gradient Header with Live Patient Avatar */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0b1936 0%, #15347a 50%, #2563eb 100%)',
          color: '#ffffff',
          padding: '20px 24px 18px',
          position: 'relative',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.75}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.16)',
                border: '2px solid rgba(255,255,255,0.38)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 900,
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              {form.name.trim() ? initials : <PersonAddAlt1RoundedIcon sx={{ fontSize: 26 }} />}
            </div>
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                {form.name.trim() || t('Add New Patient', 'إضافة مريض جديد')}
              </Typography>
              <Typography variant="caption" sx={{ color: '#dbeafe', fontWeight: 600 }}>
                {t('Fast patient registration & clinical profile setup', 'تسجيل سريع لبيانات المريض وإعداد ملفه الطبي')}
              </Typography>
            </Box>
          </Stack>

          <IconButton
            onClick={onClose}
            disabled={submitting}
            sx={{ color: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)', '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }}
          >
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        {/* Segmented Step Pill Switcher */}
        <div
          style={{
            display: 'inline-flex',
            gap: '6px',
            marginTop: '16px',
            background: 'rgba(255,255,255,0.12)',
            padding: '4px',
            borderRadius: '13px',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveStep('quick')}
            className="shafy-tab-pill"
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              background: activeStep === 'quick' ? '#ffffff' : 'transparent',
              color: activeStep === 'quick' ? '#1d4ed8' : '#e2e8f0',
            }}
          >
            <PersonRoundedIcon sx={{ fontSize: 16 }} />
            <span>{t('1. Quick Info & Demographics', '١. البيانات الأساسية')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveStep('medical')}
            className="shafy-tab-pill"
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              background: activeStep === 'medical' ? '#ffffff' : 'transparent',
              color: activeStep === 'medical' ? '#1d4ed8' : '#e2e8f0',
            }}
          >
            <MedicalInformationRoundedIcon sx={{ fontSize: 16 }} />
            <span>{t('2. Medical Background (Optional)', '٢. الملف الطبي والحساسيات')}</span>
          </button>
        </div>
      </div>

      <DialogContent sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#f8fafc' }}>
        {activeStep === 'quick' ? (
          <Stack spacing={2.25}>
            {/* Core Name + Phone Card */}
            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <TextField
                  label={t('Full Name *', 'الاسم الكامل *')}
                  placeholder={t('e.g., Ahmed Mohamed', 'مثال: أحمد محمد')}
                  value={form.name}
                  onChange={handleChange('name')}
                  error={Boolean(errors.name)}
                  helperText={errors.name || ''}
                  autoComplete="name"
                  autoFocus
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonRoundedIcon sx={{ fontSize: 19, color: '#64748b' }} />
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  label={t('Phone Number *', 'رقم الهاتف *')}
                  placeholder="01xxxxxxxxx"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  error={Boolean(errors.phone)}
                  helperText={errors.phone || t('Auto-formatted with +20', 'يُحفظ تلقائياً بصيغة +20')}
                  autoComplete="tel"
                  inputMode="tel"
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneRoundedIcon sx={{ fontSize: 18, color: '#2563eb' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>

              {showRelationPicker && (
                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: '14px',
                    bgcolor: '#fffbeb',
                    border: '1.5px solid #fde68a',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#92400e', mb: 1 }}>
                    {t(
                      'This phone number is already registered. Select family relationship:',
                      'رقم الهاتف هذا مسجل بالفعل. حدد صلة القرابة بصاحب الهاتف:'
                    )}
                  </Typography>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t('Relationship', 'صلة القرابة')}</InputLabel>
                    <Select
                      value={relation}
                      label={t('Relationship', 'صلة القرابة')}
                      onChange={(e) => setRelation(e.target.value)}
                    >
                      <MenuItem value="himself">{t('Himself (New record)', 'نفسه (سجل جديد)')}</MenuItem>
                      <MenuItem value="son">{t('Son / Child', 'ابن / ابنة')}</MenuItem>
                      <MenuItem value="wife">{t('Wife / Spouse', 'زوجة / زوج')}</MenuItem>
                      <MenuItem value="mom">{t('Mother', 'أم')}</MenuItem>
                      <MenuItem value="dad">{t('Father', 'أب')}</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}
            </div>

            {/* Age, Gender Visual Cards & Blood Type Pills */}
            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
              <Stack spacing={2.25}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 0.72fr) minmax(0, 1.28fr)' },
                    gap: 2,
                    alignItems: 'end',
                  }}
                >
                  <TextField
                    label={t('Age (Years)', 'العمر (سنة)')}
                    value={form.age}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
                      setForm((f) => ({ ...f, age: v }));
                      setErrors((prev) => ({ ...prev, age: undefined }));
                    }}
                    error={Boolean(errors.age)}
                    helperText={errors.age || ''}
                    inputMode="numeric"
                    fullWidth
                  />

                  {/* Visual Segmented Gender Selector */}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, display: 'block', mb: 0.75 }}>
                      {t('Gender', 'النوع')}
                    </Typography>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {[
                        { val: 'male', label: t('Male', 'ذكر'), icon: MaleRoundedIcon, color: '#2563eb', bg: '#eff6ff' },
                        { val: 'female', label: t('Female', 'أنثى'), icon: FemaleRoundedIcon, color: '#db2777', bg: '#fdf2f8' },
                      ].map((g) => {
                        const selected = form.gender === g.val;
                        const GIcon = g.icon;
                        return (
                          <button
                            key={g.val}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, gender: selected ? '' : g.val }))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              padding: '11px 14px',
                              borderRadius: '13px',
                              border: `1.5px solid ${selected ? g.color : '#e2e8f0'}`,
                              background: selected ? g.bg : '#ffffff',
                              color: selected ? g.color : '#475569',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all 0.18s ease',
                            }}
                          >
                            <GIcon sx={{ fontSize: 20 }} />
                            <span>{g.label}</span>
                            {selected && <CheckRoundedIcon sx={{ fontSize: 16 }} />}
                          </button>
                        );
                      })}
                    </div>
                  </Box>
                </Box>

                {/* One-Tap Blood Type Pills */}
                <Box>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                    <BloodtypeRoundedIcon sx={{ fontSize: 17, color: '#dc2626' }} />
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                      {t('Blood Type (Quick Select)', 'فصيلة الدم (اختيار سريع)')}
                    </Typography>
                  </Stack>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {BLOOD_TYPES.map((bt) => {
                      const selected = form.bloodType === bt;
                      return (
                        <button
                          key={bt}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, bloodType: selected ? '' : bt }))}
                          style={{
                            minWidth: '52px',
                            padding: '7px 12px',
                            borderRadius: '11px',
                            border: `1.5px solid ${selected ? '#dc2626' : '#e2e8f0'}`,
                            background: selected ? '#fef2f2' : '#ffffff',
                            color: selected ? '#b91c1c' : '#334155',
                            fontWeight: 900,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            transition: 'all 0.16s ease',
                          }}
                        >
                          {bt}
                        </button>
                      );
                    })}
                  </div>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 2,
                  }}
                >
                  <TextField
                    label={t('Address', 'العنوان')}
                    value={form.address}
                    onChange={handleChange('address')}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label={t('Email (Optional)', 'البريد الإلكتروني (اختياري)')}
                    value={form.email}
                    onChange={handleChange('email')}
                    error={Boolean(errors.email)}
                    helperText={errors.email || ''}
                    autoComplete="email"
                    fullWidth
                    size="small"
                  />
                </Box>
              </Stack>
            </div>
          </Stack>
        ) : (
          <Stack spacing={2.25}>
            {/* Allergies & Chronic Conditions with 1-Click Quick Chips */}
            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
              <Stack spacing={2}>
                <Box>
                  <TextField
                    label={t('Allergies', 'الحساسيات الدوائية أو الغذائية')}
                    placeholder={t('e.g., Penicillin, Aspirin...', 'مثال: بنسلين، أسبرين...')}
                    value={form.allergies}
                    onChange={handleChange('allergies')}
                    fullWidth
                    size="small"
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {allergyChips.map((chip) => {
                      const active = hasCsvToken(form.allergies, chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, allergies: appendCsvToken(f.allergies, chip) }))}
                          style={{
                            padding: '4px 11px',
                            borderRadius: '999px',
                            border: `1px solid ${active ? '#ef4444' : '#e2e8f0'}`,
                            background: active ? '#fef2f2' : '#f8fafc',
                            color: active ? '#b91c1c' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {active ? '✓ ' : '+ '}
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </Box>

                <Box>
                  <TextField
                    label={t('Chronic Conditions', 'الأمراض المزمنة')}
                    placeholder={t('e.g., Diabetes, Hypertension...', 'مثال: سكري، ضغط دم...')}
                    value={form.conditions}
                    onChange={handleChange('conditions')}
                    fullWidth
                    size="small"
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {conditionChips.map((chip) => {
                      const active = hasCsvToken(form.conditions, chip);
                      return (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, conditions: appendCsvToken(f.conditions, chip) }))}
                          style={{
                            padding: '4px 11px',
                            borderRadius: '999px',
                            border: `1px solid ${active ? '#d97706' : '#e2e8f0'}`,
                            background: active ? '#fef3c7' : '#f8fafc',
                            color: active ? '#92400e' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {active ? '✓ ' : '+ '}
                          {chip}
                        </button>
                      );
                    })}
                  </div>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 2,
                  }}
                >
                  <TextField
                    label={t('Current Medications', 'الأدوية الحالية')}
                    value={form.medications}
                    onChange={handleChange('medications')}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                  />

                  <TextField
                    label={t('Medical Notes', 'ملاحظات طبية')}
                    value={form.notes}
                    onChange={handleChange('notes')}
                    fullWidth
                    multiline
                    minRows={2}
                    size="small"
                  />
                </Box>
              </Stack>
            </div>

            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
              <HealthInfoSection form={form} setForm={setForm} t={t} isArabic={isArabic} />
            </div>
          </Stack>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Button
          variant="text"
          onClick={() => setActiveStep(activeStep === 'quick' ? 'medical' : 'quick')}
          disabled={submitting}
          sx={{ color: '#2563eb', fontWeight: 800 }}
        >
          {activeStep === 'quick'
            ? t('+ Add Medical Details', '+ إضافة التفاصيل الطبية')
            : t('← Back to Basic Info', '← العودة للبيانات الأساسية')}
        </Button>

        <Stack direction="row" spacing={1.25}>
          <Button variant="outlined" onClick={onClose} disabled={submitting} sx={{ borderRadius: '12px', px: 2.5 }}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <CheckRoundedIcon />}
            sx={{ borderRadius: '12px', px: 3 }}
          >
            {submitting ? t('Saving...', 'جارٍ الحفظ...') : t('Save Patient', 'حفظ المريض')}
          </Button>
        </Stack>
      </DialogActions>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.severity} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
