// /components/patients/AddPatientDialog.jsx
'use client';

import * as React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Grid, Alert, Snackbar,
  CircularProgress, Box, useMediaQuery, Chip, Collapse,
  FormControl, InputLabel, Select, MenuItem, FormHelperText, Divider, IconButton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { useAuth } from '@/providers/AuthProvider';

/* -------------------------------------------------------------------------- */
/*                                   Utils                                    */
/* -------------------------------------------------------------------------- */

const PHONE_RE = /^[\d\s+()-]{8,}$/; // simple global-ish check (UI validation)
const DIGITS = /[^0-9]/g;

/**
 * Normalize a phone string to a stable ID.
 * - Keeps leading '+' if present.
 * - If local format, upgrades based on countryCode heuristic.
 * - Converts leading '00' to '+'.
 * - Fallback returns digits-only (still unique enough for your use-case).
 *
 * Set `countryCode` per deployment (default +974 for Qatar).
 */
function normalizePhoneForId(raw = '', { countryCode = '+974' } = {}) {
  const s = String(raw).trim();
  if (!s) return '';

  // If it already starts with '+', keep only + and digits
  if (s.startsWith('+')) return s.replace(/[^\d+]/g, '');

  // Remove non-digits
  const d = s.replace(DIGITS, '');

  // Qatar heuristic: local 8 digits -> +974########
  if (countryCode === '+974' && d.length === 8) return `${countryCode}${d}`;

  // Egypt heuristic: 11 digits starting with 01 -> +20##########
  if (countryCode === '+20' && d.length === 11 && d.startsWith('01')) {
    return `${countryCode}${d.slice(1)}`; // drop leading 0
  }

  // Convert 00CC... to +CC...
  if (d.startsWith('00')) return `+${d.slice(2)}`;

  // Fallback: just digits
  return d;
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export default function AddPatientDialog({ open, onClose, onSaved, isArabic: isArProp }) {
  const router = useRouter();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();

  // Language / direction
  const isArabic = React.useMemo(() => {
    if (typeof isArProp === 'boolean') return isArProp;
    const q = router?.query || {};
    if (q.lang) return String(q.lang).toLowerCase().startsWith('ar');
    if (q.ar) return q.ar === '1' || String(q.ar).toLowerCase() === 'true';
    return true;
  }, [router?.query, isArProp]);
  const t = (en, ar) => (isArabic ? ar : en);
  const dirProps = { dir: isArabic ? 'rtl' : 'ltr', sx: { textAlign: isArabic ? 'right' : 'left' } };

  // UI state
  const [submitting, setSubmitting] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });
  const [moreOpen, setMoreOpen] = React.useState(false);

  // Form: minimal required (name, phone). Others optional behind "More details"
  const [form, setForm] = React.useState({
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
  });

  const [errors, setErrors] = React.useState({});

  React.useEffect(() => {
    if (!open) {
      setForm({
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

  const validate = () => {
    const next = {};

    if (!form.name?.trim()) next.name = t('Required', 'مطلوب');

    if (!form.phone?.trim()) next.phone = t('Phone is required', 'رقم الهاتف مطلوب');
    else if (!PHONE_RE.test(form.phone)) next.phone = t('Invalid phone', 'رقم هاتف غير صالح');

    // Optional fields: validate only if provided
    if (form.age && (!/^\d{1,3}$/.test(String(form.age)) || Number(form.age) > 120)) {
      next.age = t('Enter a valid age (0–120)', 'أدخل عمرًا صحيحًا (0–120)');
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = t('Invalid email', 'بريد إلكتروني غير صالح');
    }

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

      // Enforce phone as primary key (document ID)
      const phoneId = normalizePhoneForId(form.phone, { countryCode: '+974' }); // change to '+20' if needed
      if (!phoneId || !/^[+0-9]{8,}$/.test(phoneId)) {
        setSnack({ open: true, msg: t('Invalid phone format.', 'صيغة الهاتف غير صالحة.'), severity: 'error' });
        setSubmitting(false);
        return;
      }

      const patientRef = doc(db, 'patients', phoneId);

      // Prevent duplicates
      const existing = await getDoc(patientRef);
      if (existing.exists()) {
        setSnack({
          open: true,
          msg: t('A patient with this phone already exists.', 'يوجد مريض بهذا الرقم بالفعل.'),
          severity: 'warning',
        });
        onSaved?.(patientRef.id);
        onClose?.();
        return;
      }

      const payload = {
        // Required
        name: form.name.trim(),
        phone: form.phone.trim(),     // as entered for display
        phoneId,                      // normalized mirror (primary key)
        // Optional
        age: form.age ? Number(form.age) : null,
        gender: form.gender || null,
        address: form.address?.trim() || null,
        email: form.email?.trim() || null,
        bloodType: form.bloodType || null,
        allergies: form.allergies?.trim() || '',
        conditions: form.conditions?.trim() || '',
        medications: form.medications?.trim() || '',
        notes: form.notes?.trim() || '',
        // Metadata
        lastVisit: null,
        registeredBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(patientRef, payload);

      setSnack({ open: true, msg: t('Patient added successfully.', 'تم إضافة المريض بنجاح.'), severity: 'success' });
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

      <DialogContent {...dirProps} sx={{ pt: 0.5, pb: 1, '& .MuiFormControl-root': { width: '100%' } }}>
        <Stack spacing={1.25}>
          {/* Minimal required fields */}
          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <TextField
                label={t('Full Name *', 'الاسم الكامل *')}
                value={form.name}
                onChange={handleChange('name')}
                error={Boolean(errors.name)}
                helperText={errors.name || ' '}
                autoComplete="name"
                autoFocus
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
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
          </Grid>

          {/* More details (optional) */}
          <Box
            sx={{
              mt: 0.5,
              px: 1,
              py: 0.75,
              border: (t) => `1px dashed ${t.palette.divider}`,
              borderRadius: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ ...(isArabic ? { flexDirection: 'row-reverse' } : {}) }}
              >
                <Chip size="small" color="primary" variant="filled" label=" " sx={{ width: 8, height: 8 }} />
                <Box component="span" sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary' }}>
                  {t('More details (optional)', 'تفاصيل إضافية (اختياري)')}
                </Box>
              </Stack>
              <IconButton
                size="small"
                onClick={() => setMoreOpen((v) => !v)}
                aria-label={t('Toggle more details', 'إظهار/إخفاء التفاصيل')}
              >
                {moreOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>

            <Collapse in={moreOpen} unmountOnExit>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1.25}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('Age', 'العمر')}
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
                  <FormControl fullWidth error={Boolean(errors.gender)}>
                    <InputLabel>{t('Gender', 'النوع')}</InputLabel>
                    <Select
                      label={t('Gender', 'النوع')}
                      value={form.gender}
                      onChange={handleChange('gender')}
                      displayEmpty
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            maxHeight: 320,
                            minWidth: 240,
                            transformOrigin: isArabic ? 'right top' : 'left top',
                          },
                        },
                      }}
                    >
                      <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                      <MenuItem value="male">{t('Male', 'ذكر')}</MenuItem>
                      <MenuItem value="female">{t('Female', 'أنثى')}</MenuItem>
                      <MenuItem value="other">{t('Other', 'أخرى')}</MenuItem>
                    </Select>
                    {errors.gender && <FormHelperText>{errors.gender}</FormHelperText>}
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label={t('Address', 'العنوان')}
                    value={form.address}
                    onChange={handleChange('address')}
                    fullWidth
                  />
                </Grid>

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
                    <InputLabel>{t('Blood Type', 'فصيلة الدم')}</InputLabel>
                    <Select
                      label={t('Blood Type', 'فصيلة الدم')}
                      value={form.bloodType}
                      onChange={handleChange('bloodType')}
                      displayEmpty
                      MenuProps={{
                        PaperProps: {
                          sx: {
                            maxHeight: 320,
                            minWidth: 240,
                            transformOrigin: isArabic ? 'right top' : 'left top',
                          },
                        },
                      }}
                    >
                      <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bt) => (
                        <MenuItem key={bt} value={bt}>{bt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
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

                <Grid item xs={12}>
                  <TextField
                    label={t('Medical Notes', 'ملاحظات طبية')}
                    value={form.notes}
                    onChange={handleChange('notes')}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              </Grid>
            </Collapse>
          </Box>

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
