// /components/patients/AddPatientDialog.jsx
'use client';
import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Grid,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Box,
  Divider,
  useMediaQuery,
  Chip,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';

// ---------- utils ----------
function isValidDateISO(val) {
  if (!val) return true;
  const d = new Date(val);
  return !isNaN(d.getTime());
}
const PHONE_RE = /^[\d\s+()-]{8,}$/; // simple, locale-agnostic

// Calculate age in full years from an ISO yyyy-mm-dd string
function calcAgeFromISO(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const today = new Date();
  let age = today.getFullYear() - y;
  const mdiff = (today.getMonth() + 1) - m;
  if (mdiff < 0 || (mdiff === 0 && today.getDate() < d)) age--;
  return Math.max(0, age);
}

// Compact section header
function SectionTitle({ children, isArabic }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ mt: 1, mb: 0.5, ...(isArabic ? { flexDirection: 'row-reverse' } : {}) }}
    >
      <Chip size="small" color="primary" variant="filled" label=" " sx={{ width: 8, height: 8 }} />
      <Box component="span" sx={{ fontWeight: 800, fontSize: 13, color: 'text.secondary' }}>
        {children}
      </Box>
    </Stack>
  );
}

// Shared menu props for Selects (prevents tiny, clipped menus)
const SELECT_MENU_PROPS = (rtl) => ({
  PaperProps: {
    sx: {
      maxHeight: 320,
      minWidth: 240,
      transformOrigin: rtl ? 'right top' : 'left top',
    },
  },
});

/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSaved?: (docId: string) => void
 *  - isArabic?: boolean  (defaults to true when not provided)
 */
export default function AddPatientDialog({ open, onClose, onSaved, isArabic: isArProp }) {
  const router = useRouter();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Arabic default unless explicitly EN
  const isArabic = React.useMemo(() => {
    if (typeof isArProp === 'boolean') return isArProp;
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router?.query, isArProp]);

  const { user } = useAuth();

  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });

  const [form, setForm] = React.useState({
    // Basics
    name: '',
    phone: '',
    gender: '',
    maritalStatus: '',
    age: '',            // derived, read-only
    dateOfBirth: '',
    email: '',
    // Address
    address: '',
    // Medical
    bloodType: '',
    allergies: '',
    conditions: '',
    medications: '',
    // Notes
    notes: '',
  });

  const [errors, setErrors] = React.useState({});

  const t = (en, ar) => (isArabic ? ar : en);
  const dirProps = { dir: isArabic ? 'rtl' : 'ltr', sx: { textAlign: isArabic ? 'right' : 'left' } };

  React.useEffect(() => {
    if (!open) {
      // reset when closed
      setForm({
        name: '',
        phone: '',
        gender: '',
        maritalStatus: '',
        age: '',
        dateOfBirth: '',
        email: '',
        address: '',
        bloodType: '',
        allergies: '',
        conditions: '',
        medications: '',
        notes: '',
      });
      setErrors({});
      setSubmitting(false);
    }
  }, [open]);

  // When DOB changes, auto-calc age
  const handleDobChange = (e) => {
    const v = e?.target?.value ?? '';
    const age = calcAgeFromISO(v);
    setForm((f) => ({ ...f, dateOfBirth: v, age: v ? String(age) : '' }));
    setErrors((prev) => ({ ...prev, dateOfBirth: undefined })); // clear any DOB error
  };

  const validate = () => {
    const next = {};
    if (!form.name?.trim()) next.name = t('Required', 'مطلوب');
    if (!form.phone?.trim()) next.phone = t('Phone is required', 'رقم الهاتف مطلوب');
    else if (!PHONE_RE.test(form.phone)) next.phone = t('Invalid phone', 'رقم هاتف غير صالح');

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = t('Invalid email', 'بريد إلكتروني غير صالح');

    if (form.dateOfBirth && !isValidDateISO(form.dateOfBirth))
      next.dateOfBirth = t('Invalid date', 'تاريخ غير صالح');

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (field) => (e) => {
    const value = e?.target?.value ?? '';
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!user) {
      setSnack({ open: true, msg: t('You must be signed in.', 'يجب تسجيل الدخول.'), severity: 'error' });
      return;
    }
    if (!validate()) return;

    try {
      setSubmitting(true);

      // Always derive age from DOB on save to be safe
      const derivedAge = form.dateOfBirth ? calcAgeFromISO(form.dateOfBirth) : '';

      const payload = {
        // Basics
        name: form.name.trim(),
        phone: form.phone.trim(),
        gender: form.gender || null,
        maritalStatus: form.maritalStatus || null,
        age: form.dateOfBirth ? derivedAge : null,
        dateOfBirth: form.dateOfBirth || null,
        email: form.email?.trim() || null,
        // Address
        address: form.address?.trim() || null,
        // Medical
        bloodType: form.bloodType || null,
        allergies: form.allergies?.trim() || '',
        conditions: form.conditions?.trim() || '',
        medications: form.medications?.trim() || '',
        // Notes
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
      fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}
    >
      <DialogTitle {...dirProps} sx={{ pb: 1 }}>
        {t('Add Patient', 'إضافة مريض')}
      </DialogTitle>

      <DialogContent
        {...dirProps}
        sx={{
          pt: 0.5,
          pb: 1,
          '& .MuiFormControl-root': { width: '100%' },
        }}
      >
        <Stack spacing={1.5}>
          {/* BASICS */}
          <SectionTitle isArabic={isArabic}>{t('Basics', 'البيانات الأساسية')}</SectionTitle>
          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <TextField
                label={t('Full Name', 'الاسم الكامل')}
                value={form.name}
                onChange={handleChange('name')}
                error={Boolean(errors.name)}
                helperText={errors.name || ' '}
                fullWidth
                autoFocus
                autoComplete="name"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label={t('Phone *', 'الهاتف *')}
                value={form.phone}
                onChange={handleChange('phone')}
                error={Boolean(errors.phone)}
                helperText={errors.phone || ' '}
                fullWidth
                autoComplete="tel"
                inputMode="tel"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth sx={{ minWidth: 240 }}>
                <InputLabel>{t('Gender', 'النوع')}</InputLabel>
                <Select
                  label={t('Gender', 'النوع')}
                  value={form.gender}
                  onChange={handleChange('gender')}
                  MenuProps={SELECT_MENU_PROPS(isArabic)}
                  displayEmpty
                >
                  <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                  <MenuItem value="male">{t('Male', 'ذكر')}</MenuItem>
                  <MenuItem value="female">{t('Female', 'أنثى')}</MenuItem>
                  <MenuItem value="other">{t('Other', 'أخرى')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth sx={{ minWidth: 240 }}>
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

            {/* Age is auto-calculated from DOB and read-only */}
            <Grid item xs={12} sm={6}>
              <TextField
                label={t('Age (auto)', 'العمر (محسوب)')}
                value={form.age}
                onChange={() => {}}
                InputProps={{ readOnly: true }}
                helperText={t('Calculated from date of birth', 'محسوبة من تاريخ الميلاد')}
                fullWidth
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label={t('Date of Birth', 'تاريخ الميلاد')}
                type="date"
                value={form.dateOfBirth}
                onChange={handleDobChange}
                error={Boolean(errors.dateOfBirth)}
                helperText={errors.dateOfBirth || ' '}
                fullWidth
                InputLabelProps={{ shrink: true }}
                autoComplete="bday"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Email"
                value={form.email}
                onChange={handleChange('email')}
                error={Boolean(errors.email)}
                helperText={errors.email || ' '}
                fullWidth
                autoComplete="email"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 0.5 }} />

          {/* ADDRESS */}
          <SectionTitle isArabic={isArabic}>{t('Address', 'العنوان')}</SectionTitle>
          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <TextField
                label={t('Address', 'العنوان')}
                value={form.address}
                onChange={handleChange('address')}
                fullWidth
                autoComplete="street-address"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 0.5 }} />

          {/* MEDICAL */}
          <SectionTitle isArabic={isArabic}>{t('Medical', 'بيانات طبية')}</SectionTitle>
          <Grid container spacing={1.25}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth sx={{ minWidth: 240 }}>
                <InputLabel>{t('Blood Type', 'فصيلة الدم')}</InputLabel>
                <Select
                  label={t('Blood Type', 'فصيلة الدم')}
                  value={form.bloodType}
                  onChange={handleChange('bloodType')}
                  MenuProps={SELECT_MENU_PROPS(isArabic)}
                  displayEmpty
                >
                  <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bt) => (
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

          {/* NOTES */}
          <SectionTitle isArabic={isArabic}>{t('Notes', 'ملاحظات')}</SectionTitle>
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

      {/* Sticky actions on mobile for easier reach */}
      <DialogActions
        sx={{
          px: 2,
          py: 1,
          position: fullScreen ? 'sticky' : 'static',
          bottom: 0,
          bgcolor: 'background.paper',
          borderTop: (t) => `1px solid ${t.palette.divider}`,
          flexDirection: isArabic ? 'row-reverse' : 'row',
          gap: 1,
        }}
      >
        <Button onClick={onClose} disabled={submitting}>
          {t('Cancel', 'إلغاء')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting}>
          {t('Save', 'حفظ')}
        </Button>
      </DialogActions>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
