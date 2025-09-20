// /components/patients/AddPatientDialog.jsx
'use client';
import * as React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Grid, MenuItem, Alert, Snackbar,
  CircularProgress, Box, Divider, useMediaQuery, Chip,
  FormControl, InputLabel, Select, FormHelperText,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';

// ---- utils ----
const PHONE_RE = /^[\d\s+()-]{8,}$/; // بسيطة وعالميّة

function SectionTitle({ children, isArabic }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}
      sx={{ mt: 1, mb: 0.5, ...(isArabic ? { flexDirection: 'row-reverse' } : {}) }}>
      <Chip size="small" color="primary" variant="filled" label=" " sx={{ width: 8, height: 8 }} />
      <Box component="span" sx={{ fontWeight: 800, fontSize: 13, color: 'text.secondary' }}>
        {children}
      </Box>
    </Stack>
  );
}

const SELECT_MENU_PROPS = (rtl) => ({
  PaperProps: { sx: { maxHeight: 320, minWidth: 240, transformOrigin: rtl ? 'right top' : 'left top' } },
});

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

  const [form, setForm] = React.useState({
    // إلزامي
    name: '',
    age: '',
    phone: '',
    gender: '',
    address: '',
    // اختياري
    maritalStatus: '',
    email: '',
    bloodType: '',
    allergies: '',
    conditions: '',
    medications: '',
    notes: '',
  });

  const [errors, setErrors] = React.useState({});

  React.useEffect(() => {
    if (!open) {
      setForm({
        name: '', age: '', phone: '', gender: '', address: '',
        maritalStatus: '', email: '', bloodType: '', allergies: '',
        conditions: '', medications: '', notes: '',
      });
      setErrors({});
      setSubmitting(false);
    }
  }, [open]);

  const handleChange = (field) => (e) => {
    const v = e?.target?.value ?? '';
    setForm((f) => ({ ...f, [field]: v }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};

    if (!form.name?.trim()) next.name = t('Required', 'مطلوب');
    if (form.age === '') next.age = t('Required', 'مطلوب');
    else if (!/^\d{1,3}$/.test(String(form.age)) || Number(form.age) > 120)
      next.age = t('Enter a valid age (0–120)', 'أدخل عمرًا صحيحًا (0–120)');

    if (!form.phone?.trim()) next.phone = t('Phone is required', 'رقم الهاتف مطلوب');
    else if (!PHONE_RE.test(form.phone)) next.phone = t('Invalid phone', 'رقم هاتف غير صالح');

    if (!form.gender) next.gender = t('Required', 'مطلوب');

    if (!form.address?.trim()) next.address = t('Required', 'مطلوب');

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
      const payload = {
        name: form.name.trim(),
        age: Number(form.age),
        phone: form.phone.trim(),
        gender: form.gender,
        address: form.address.trim(),
        // اختياري
        maritalStatus: form.maritalStatus || null,
        email: form.email?.trim() || null,
        bloodType: form.bloodType || null,
        allergies: form.allergies?.trim() || '',
        conditions: form.conditions?.trim() || '',
        medications: form.medications?.trim() || '',
        notes: form.notes?.trim() || '',
        lastVisit: null,
        registeredBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'patients'), payload);
      setSnack({ open: true, msg: t('Patient added successfully.', 'تم إضافة المريض بنجاح.'), severity: 'success' });
      onSaved?.(ref.id);
      onClose?.();
    } catch (e) {
      console.error(e);
      setSnack({ open: true, msg: t('Failed to add patient.', 'فشل في إضافة المريض.'), severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={useMediaQuery(theme.breakpoints.down('sm'))}
      PaperProps={{ sx: { borderRadius: useMediaQuery(theme.breakpoints.down('sm')) ? 0 : 3 } }}
    >
      <DialogTitle {...dirProps} sx={{ pb: 1 }}>
        {t('Add Patient', 'إضافة مريض')}
      </DialogTitle>

      <DialogContent {...dirProps} sx={{ pt: 0.5, pb: 1, '& .MuiFormControl-root': { width: '100%' } }}>
        <Stack spacing={1.5}>
          {/* أساسيات */}
          <SectionTitle isArabic={isArabic}>{t('Basics', 'البيانات الأساسية')}</SectionTitle>
          <Grid container spacing={1.25}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('Full Name *', 'الاسم الكامل *')}
                value={form.name}
                onChange={handleChange('name')}
                error={Boolean(errors.name)}
                helperText={errors.name || ' '}
                autoComplete="name"
                fullWidth
                autoFocus
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={t('Age *', 'العمر *')}
                value={form.age}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
                  setForm((f) => ({ ...f, age: v }));
                  setErrors((prev) => ({ ...prev, age: undefined }));
                }}
                error={Boolean(errors.age)}
                helperText={errors.age || ' '}
                inputMode="numeric"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={t('Phone *', 'الهاتف *')}
                value={form.phone}
                onChange={handleChange('phone')}
                error={Boolean(errors.phone)}
                helperText={errors.phone || ' '}
                autoComplete="tel"
                inputMode="tel"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={Boolean(errors.gender)}>
                <InputLabel>{t('Gender *', 'النوع *')}</InputLabel>
                <Select
                  label={t('Gender *', 'النوع *')}
                  value={form.gender}
                  onChange={handleChange('gender')}
                  MenuProps={SELECT_MENU_PROPS(isArabic)}
                  displayEmpty
                >
                  <MenuItem value="">{t('Select…', 'اختر…')}</MenuItem>
                  <MenuItem value="male">{t('Male', 'ذكر')}</MenuItem>
                  <MenuItem value="female">{t('Female', 'أنثى')}</MenuItem>
                  <MenuItem value="other">{t('Other', 'أخرى')}</MenuItem>
                </Select>
                {errors.gender && <FormHelperText>{errors.gender}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={t('Address *', 'العنوان *')}
                value={form.address}
                onChange={handleChange('address')}
                error={Boolean(errors.address)}
                helperText={errors.address || ' '}
                autoComplete="street-address"
                fullWidth
              />
            </Grid>

            {/* اختياريّات سريعة */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                value={form.email}
                onChange={handleChange('email')}
                error={Boolean(errors.email)}
                helperText={errors.email || ' '}
                autoComplete="email"
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('Marital Status', 'الحالة الاجتماعية')}</InputLabel>
                <Select
                  label={t('Marital Status', 'الحالة الاجتماعية')}
                  value={form.maritalStatus}
                  onChange={handleChange('maritalStatus')}
                  MenuProps={SELECT_MENU_PROPS(isArabic)}
                  displayEmpty
                >
                  <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                  <MenuItem value="single">{t('Single', 'أعزب')}</MenuItem>
                  <MenuItem value="married">{t('Married', 'متزوج')}</MenuItem>
                  <MenuItem value="divorced">{t('Divorced', 'مطلق')}</MenuItem>
                  <MenuItem value="widowed">{t('Widowed', 'أرمل')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ my: 0.5 }} />

          {/* طبية (اختياري) */}
          <SectionTitle isArabic={isArabic}>{t('Medical (optional)', 'بيانات طبية (اختياري)')}</SectionTitle>
          <Grid container spacing={1.25}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>{t('Blood Type', 'فصيلة الدم')}</InputLabel>
                <Select
                  label={t('Blood Type', 'فصيلة الدم')}
                  value={form.bloodType}
                  onChange={handleChange('bloodType')}
                  MenuProps={SELECT_MENU_PROPS(isArabic)}
                  displayEmpty
                >
                  <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bt) => (
                    <MenuItem key={bt} value={bt}>{bt}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={t('Allergies', 'الحساسيّات')}
                value={form.allergies}
                onChange={handleChange('allergies')}
                placeholder={t('e.g., Penicillin', 'مثال: بنسلين')}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={t('Chronic Conditions', 'الأمراض المزمنة')}
                value={form.conditions}
                onChange={handleChange('conditions')}
                placeholder={t('e.g., Diabetes, Hypertension', 'مثال: سكري، ضغط')}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={t('Current Medications', 'الأدوية الحالية')}
                value={form.medications}
                onChange={handleChange('medications')}
                placeholder={t('e.g., Metformin', 'مثال: ميتفورمين')}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 0.5 }} />

          <SectionTitle isArabic={isArabic}>{t('Notes (optional)', 'ملاحظات (اختياري)')}</SectionTitle>
          <TextField
            label={t('Medical Notes', 'ملاحظات طبية')}
            value={form.notes}
            onChange={handleChange('notes')}
            fullWidth
            multiline
            minRows={3}
          />

          {submitting && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2, py: 1,
          position: fullScreen ? 'sticky' : 'static',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          flexDirection: isArabic ? 'row-reverse' : 'row',
          gap: 1,
        }}
      >
        <Button onClick={onClose} disabled={submitting}>{t('Cancel', 'إلغاء')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting}>{t('Save', 'حفظ')}</Button>
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
