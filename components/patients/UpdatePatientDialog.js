'use client';
import * as React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Stack, Grid, Box, Collapse,
  FormControl, InputLabel, Select, MenuItem,
  CircularProgress, Divider, IconButton, Chip, Snackbar, Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';

export default function UpdatePatientDialog({ open, onClose, patient, isArabic, onUpdated }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [form, setForm] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });
  const t = (en, ar) => (isArabic ? ar : en);

  React.useEffect(() => {
    if (patient) setForm(patient);
  }, [patient]);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!user || !patient?.id) return;
    try {
      setLoading(true);
      const ref = doc(db, 'patients', patient.id);
      await updateDoc(ref, {
        ...form,
        updatedAt: serverTimestamp(),
        modifiedBy: user.uid,
      });
      setSnack({ open: true, msg: t('Patient updated successfully.', 'تم تحديث بيانات المريض بنجاح.'), severity: 'success' });
      onUpdated?.(patient.id, form);
      onClose?.();
    } catch (err) {
      console.error(err);
      setSnack({ open: true, msg: t('Update failed.', 'فشل التحديث.'), severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={!loading ? onClose : undefined} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>
        {t('Update Patient', 'تحديث بيانات المريض')}
      </DialogTitle>

      <DialogContent sx={{ '& .MuiFormControl-root': { width: '100%' } }}>
        <Stack spacing={1.25}>
          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <TextField label={t('Full Name *', 'الاسم الكامل *')} value={form.name || ''} onChange={handleChange('name')} />
            </Grid>
            <Grid item xs={12}>
              <TextField label={t('Phone', 'الهاتف')} value={form.phone || ''} onChange={handleChange('phone')} />
            </Grid>
          </Grid>

          {/* More details */}
          <Box
            sx={{
              mt: 1,
              px: 1,
              py: 0.75,
              border: (t) => `1px dashed ${t.palette.divider}`,
              borderRadius: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip size="small" color="primary" variant="filled" label=" " sx={{ width: 8, height: 8 }} />
                <Box sx={{ fontWeight: 700, fontSize: 13, color: 'text.secondary' }}>
                  {t('More details (optional)', 'تفاصيل إضافية (اختياري)')}
                </Box>
              </Stack>
              <IconButton size="small" onClick={() => setMoreOpen((v) => !v)}>
                {moreOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Stack>

            <Collapse in={moreOpen} unmountOnExit>
              <Divider sx={{ my: 1 }} />
              <Grid container spacing={1.25}>
                <Grid item xs={12} sm={6}>
                  <TextField label={t('Age', 'العمر')} value={form.age || ''} onChange={handleChange('age')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('Gender', 'النوع')}</InputLabel>
                    <Select value={form.gender || ''} onChange={handleChange('gender')} label={t('Gender', 'النوع')}>
                      <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                      <MenuItem value="male">{t('Male', 'ذكر')}</MenuItem>
                      <MenuItem value="female">{t('Female', 'أنثى')}</MenuItem>
                      <MenuItem value="other">{t('Other', 'أخرى')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField label={t('Address', 'العنوان')} value={form.address || ''} onChange={handleChange('address')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Email" value={form.email || ''} onChange={handleChange('email')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('Blood Type', 'فصيلة الدم')}</InputLabel>
                    <Select value={form.bloodType || ''} onChange={handleChange('bloodType')}>
                      <MenuItem value="">{t('Unspecified', 'غير محدد')}</MenuItem>
                      {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((bt) => (
                        <MenuItem key={bt} value={bt}>{bt}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField label={t('Allergies', 'الحساسيّات')} value={form.allergies || ''} onChange={handleChange('allergies')} fullWidth />
                </Grid>
                <Grid item xs={12}>
                  <TextField label={t('Chronic Conditions', 'الأمراض المزمنة')} value={form.conditions || ''} onChange={handleChange('conditions')} multiline minRows={2} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label={t('Medications', 'الأدوية')} value={form.medications || ''} onChange={handleChange('medications')} multiline minRows={2} />
                </Grid>
                <Grid item xs={12}>
                  <TextField label={t('Notes', 'ملاحظات')} value={form.notes || ''} onChange={handleChange('notes')} multiline minRows={2} />
                </Grid>
              </Grid>
            </Collapse>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1 }}>
        <Button onClick={onClose} disabled={loading}>{t('Cancel', 'إلغاء')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={18} /> : t('Save', 'حفظ')}
        </Button>
      </DialogActions>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Dialog>
  );
}
