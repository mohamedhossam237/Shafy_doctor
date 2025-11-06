'use client';

import * as React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Grid, Alert, Snackbar,
  CircularProgress, Box, useMediaQuery, Collapse,
  FormControl, InputLabel, Select, MenuItem,
  Divider, IconButton, Typography, FormLabel,
  RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';

/* ---------------------- Utility Functions ---------------------- */
const PHONE_RE = /^[\d\s+()-]{8,}$/;
const DIGITS = /[^0-9]/g;

function normalizePhoneForId(raw = '', { countryCode = '+974' } = {}) {
  const s = String(raw).trim();
  if (!s) return '';
  if (s.startsWith('+')) return s.replace(/[^\d+]/g, '');
  const d = s.replace(DIGITS, '');
  if (countryCode === '+974' && d.length === 8) return `${countryCode}${d}`;
  if (countryCode === '+20' && d.length === 11 && d.startsWith('01')) return `${countryCode}${d.slice(1)}`;
  if (d.startsWith('00')) return `+${d.slice(2)}`;
  return d;
}

/* ---------------------- Component ---------------------- */
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
  const dirProps = { dir: isArabic ? 'rtl' : 'ltr', sx: { textAlign: isArabic ? 'right' : 'left' } };

  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });
  const [moreOpen, setMoreOpen] = React.useState(false);

  const [form, setForm] = React.useState({
    name: '', phone: '', age: '', gender: '', address: '', email: '',
    bloodType: '', allergies: '', chronicConditions: '', currentMedications: '',
    notes: '', isDiabetic: false, hadSurgeries: false, isSmoker: false,
    drinksAlcohol: false, familyHistory: false, isPregnant: false
  });

  const [errors, setErrors] = React.useState({});

  React.useEffect(() => {
    if (!open) {
      setForm({
        name: '', phone: '', age: '', gender: '', address: '', email: '',
        bloodType: '', allergies: '', chronicConditions: '', currentMedications: '',
        notes: '', isDiabetic: false, hadSurgeries: false, isSmoker: false,
        drinksAlcohol: false, familyHistory: false, isPregnant: false
      });
      setErrors({});
      setSubmitting(false);
      setMoreOpen(false);
    }
  }, [open]);

  const handleChange = (field) => (e) => {
    const v = e?.target?.value ?? '';
    setForm((f) => ({ ...f, [field]: v }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };
  const handleBool = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value === 'true' }));

  const validate = () => {
    const next = {};
    if (!form.name?.trim()) next.name = t('Required', 'مطلوب');
    if (!form.phone?.trim()) next.phone = t('Phone is required', 'رقم الهاتف مطلوب');
    else if (!PHONE_RE.test(form.phone)) next.phone = t('Invalid phone', 'رقم هاتف غير صالح');
    if (form.age && (!/^\d{1,3}$/.test(String(form.age)) || Number(form.age) > 120))
      next.age = t('Enter a valid age (0–120)', 'أدخل عمرًا صحيحًا (0–120)');
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = t('Invalid email', 'بريد إلكتروني غير صالح');
    setErrors(next);
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
      const phoneId = normalizePhoneForId(form.phone, { countryCode: '+974' });
      const patientRef = doc(db, 'patients', phoneId);
      const existing = await getDoc(patientRef);

      // existing patient
      if (existing.exists()) {
        const data = existing.data();
        const assoc = new Set(data.associatedDoctors || []);
        assoc.add(user.uid);
        await setDoc(patientRef, { associatedDoctors: Array.from(assoc), updatedAt: serverTimestamp() }, { merge: true });
        setSnack({ open: true, msg: t('Existing patient linked.', 'تم ربط المريض الموجود.'), severity: 'info' });
        onSaved?.(patientRef.id);
        onClose?.();
        setSubmitting(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        phoneId,
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        address: form.address?.trim() || null,
        email: form.email?.trim() || null,
        bloodType: form.bloodType || null,
        allergies: form.allergies?.trim() || '',
        chronicConditions: form.chronicConditions?.trim() || '',
        currentMedications: form.currentMedications?.trim() || '',
        notes: form.notes?.trim() || '',
        isDiabetic: form.isDiabetic,
        hadSurgeries: form.hadSurgeries,
        isSmoker: form.isSmoker,
        drinksAlcohol: form.drinksAlcohol,
        familyHistory: form.familyHistory,
        isPregnant: form.gender === 'female' ? form.isPregnant : false,
        lastVisitDate: null,
        registeredBy: user.uid,
        associatedDoctors: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(patientRef, payload);
      setSnack({ open: true, msg: t('Patient added successfully.', 'تمت إضافة المريض بنجاح.'), severity: 'success' });
      onSaved?.(patientRef.id);
      onClose?.();
    } catch (e) {
      console.error(e);
      setSnack({ open: true, msg: t('Failed to add patient.', 'فشل في إضافة المريض.'), severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle {...dirProps}>{t('Add Patient', 'إضافة مريض')}</DialogTitle>

      <DialogContent {...dirProps} sx={{ pt: 0.5 }}>
        <Stack spacing={1.5}>
          {/* Basic Fields */}
          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <TextField
                label={t('Full Name *', 'الاسم الكامل *')}
                value={form.name}
                onChange={handleChange('name')}
                error={!!errors.name}
                helperText={errors.name || ' '}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t('Phone *', 'الهاتف *')}
                value={form.phone}
                onChange={handleChange('phone')}
                error={!!errors.phone}
                helperText={errors.phone || ' '}
              />
            </Grid>
          </Grid>

          {/* More Info */}
          <Box sx={{
            mt: 1, p: 1, borderRadius: 2,
            border: (t) => `1px dashed ${t.palette.divider}`,
            bgcolor: (t) => t.palette.action.hover
          }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography fontWeight={700} color="text.secondary">
                {t('Additional Details (optional)', 'تفاصيل إضافية (اختياري)')}
              </Typography>
              <IconButton size="small" onClick={() => setMoreOpen(v => !v)}>
                {moreOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>

            <Collapse in={moreOpen} unmountOnExit>
              <Divider sx={{ my: 2 }} />

              {/* Section 1 — Basic Info */}
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                {t('Basic Information', 'المعلومات الأساسية')}
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <TextField label={t('Age', 'العمر')} value={form.age} onChange={handleChange('age')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('Gender', 'النوع')}</InputLabel>
                    <Select label={t('Gender', 'النوع')} value={form.gender} onChange={handleChange('gender')}>
                      <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                      <MenuItem value="male">{t('Male', 'ذكر')}</MenuItem>
                      <MenuItem value="female">{t('Female', 'أنثى')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}><TextField label={t('Address', 'العنوان')} value={form.address} onChange={handleChange('address')} /></Grid>
                <Grid item xs={12}><TextField label="Email" value={form.email} onChange={handleChange('email')} /></Grid>
              </Grid>

              {/* Section 2 — Medical Info */}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                {t('Medical Information', 'المعلومات الطبية')}
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12}><TextField label={t('Allergies', 'الحساسيّات')} value={form.allergies} onChange={handleChange('allergies')} /></Grid>
                <Grid item xs={12}><TextField label={t('Chronic Conditions', 'الأمراض المزمنة')} value={form.chronicConditions} onChange={handleChange('chronicConditions')} multiline minRows={2} /></Grid>
                <Grid item xs={12}><TextField label={t('Current Medications', 'الأدوية الحالية')} value={form.currentMedications} onChange={handleChange('currentMedications')} multiline minRows={2} /></Grid>
                <Grid item xs={12}><TextField label={t('Medical Notes', 'ملاحظات طبية')} value={form.notes} onChange={handleChange('notes')} multiline minRows={2} /></Grid>
              </Grid>

              {/* Section 3 — Health Conditions */}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                {t('Health Conditions', 'الحالات الصحية')}
              </Typography>

              <Stack spacing={1.5}>
                {[
                  ['isDiabetic', t('Is the patient diabetic?', 'هل المريض مصاب بالسكري؟')],
                  ['hadSurgeries', t('Has the patient had surgeries?', 'هل خضع المريض لعمليات؟')],
                  ['isSmoker', t('Does the patient smoke?', 'هل المريض مدخن؟')],
                  ['drinksAlcohol', t('Does the patient drink alcohol?', 'هل يشرب المريض الكحول؟')],
                  ['familyHistory', t('Family history of similar diseases?', 'هل يوجد تاريخ عائلي لأمراض مشابهة؟')],
                ].map(([key, question]) => (
                  <Box key={key} sx={{
                    p: 1, borderRadius: 2,
                    border: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: (t) => t.palette.background.paper
                  }}>
                    <FormControl fullWidth>
                      <FormLabel sx={{ mb: 0.5, fontWeight: 600 }}>{question}</FormLabel>
                      <RadioGroup
                        row
                        value={form[key]}
                        onChange={handleBool(key)}
                        sx={{ justifyContent: isArabic ? 'flex-end' : 'flex-start' }}
                      >
                        <FormControlLabel value="true" control={<Radio />} label={t('Yes', 'نعم')} />
                        <FormControlLabel value="false" control={<Radio />} label={t('No', 'لا')} />
                      </RadioGroup>
                    </FormControl>
                  </Box>
                ))}

                {form.gender === 'female' && (
                  <Box sx={{
                    p: 1, borderRadius: 2,
                    border: (t) => `1px solid ${t.palette.divider}`,
                    bgcolor: (t) => t.palette.background.paper
                  }}>
                    <FormControl fullWidth>
                      <FormLabel sx={{ mb: 0.5, fontWeight: 600 }}>
                        {t('Is the patient pregnant?', 'هل المريضة حامل؟')}
                      </FormLabel>
                      <RadioGroup
                        row
                        value={form.isPregnant}
                        onChange={handleBool('isPregnant')}
                        sx={{ justifyContent: isArabic ? 'flex-end' : 'flex-start' }}
                      >
                        <FormControlLabel value="true" control={<Radio />} label={t('Yes', 'نعم')} />
                        <FormControlLabel value="false" control={<Radio />} label={t('No', 'لا')} />
                      </RadioGroup>
                    </FormControl>
                  </Box>
                )}
              </Stack>
            </Collapse>
          </Box>

          {submitting && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ gap: 1, px: 2, py: 1 }}>
        <Button onClick={onClose} disabled={submitting}>{t('Cancel', 'إلغاء')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting}>{t('Save', 'حفظ')}</Button>
      </DialogActions>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Dialog>
  );
}
