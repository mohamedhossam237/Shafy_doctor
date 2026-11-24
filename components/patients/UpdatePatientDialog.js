'use client';
import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Box,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import MedicalInformationRoundedIcon from '@mui/icons-material/MedicalInformationRounded';
import MaleRoundedIcon from '@mui/icons-material/MaleRounded';
import FemaleRoundedIcon from '@mui/icons-material/FemaleRounded';
import BloodtypeRoundedIcon from '@mui/icons-material/BloodtypeRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import HealthInfoSection from '@/components/patients/HealthInfoSection';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function UpdatePatientDialog({ open, onClose, patient, isArabic = true, onUpdated }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const [form, setForm] = React.useState({});
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState('basics');
  const [snack, setSnack] = React.useState({ open: false, msg: '', severity: 'success' });
  const t = (en, ar) => (isArabic ? ar : en);

  React.useEffect(() => {
    if (patient && open) {
      setForm(patient);
      setTab('basics');
    }
  }, [patient, open]);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!user || !patient?.id) return;
    try {
      setLoading(true);
      const ref = doc(db, 'patients', patient.id);
      const { id: _ignoreId, ...rest } = form;
      await updateDoc(ref, {
        ...rest,
        age: rest.age !== '' && rest.age != null ? Number(rest.age) : null,
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
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
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
      {/* Gradient Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0b1936 0%, #15347a 50%, #2563eb 100%)',
          color: '#ffffff',
          padding: '18px 24px',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6" fontWeight={900}>
              {t('Update Patient Profile', 'تحديث بيانات المريض')}
            </Typography>
            <Typography variant="caption" sx={{ color: '#dbeafe', fontWeight: 600 }}>
              {form.name || t('Edit patient demographics & medical info', 'تعديل البيانات الديموغرافية والطبية')}
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={loading} sx={{ color: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)' }}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <div
          style={{
            display: 'inline-flex',
            gap: '6px',
            marginTop: '14px',
            background: 'rgba(255,255,255,0.12)',
            padding: '4px',
            borderRadius: '13px',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <button
            type="button"
            onClick={() => setTab('basics')}
            className="shafy-tab-pill"
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              background: tab === 'basics' ? '#ffffff' : 'transparent',
              color: tab === 'basics' ? '#1d4ed8' : '#e2e8f0',
            }}
          >
            <PersonRoundedIcon sx={{ fontSize: 16 }} />
            <span>{t('Basics & Contact', 'البيانات الأساسية')}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('medical')}
            className="shafy-tab-pill"
            style={{
              padding: '7px 14px',
              fontSize: '0.82rem',
              background: tab === 'medical' ? '#ffffff' : 'transparent',
              color: tab === 'medical' ? '#1d4ed8' : '#e2e8f0',
            }}
          >
            <MedicalInformationRoundedIcon sx={{ fontSize: 16 }} />
            <span>{t('Medical & Flags', 'الملف الطبي')}</span>
          </button>
        </div>
      </div>

      <DialogContent sx={{ p: { xs: 2, sm: 3 }, bgcolor: '#f8fafc' }}>
        {tab === 'basics' ? (
          <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
            <Stack spacing={2.25}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <TextField label={t('Full Name *', 'الاسم الكامل *')} value={form.name || ''} onChange={handleChange('name')} fullWidth />
                <TextField label={t('Phone', 'الهاتف')} value={form.phone || ''} onChange={handleChange('phone')} fullWidth />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 0.72fr) minmax(0, 1.28fr)' },
                  gap: 2,
                  alignItems: 'end',
                }}
              >
                <TextField label={t('Age', 'العمر')} type="number" value={form.age || ''} onChange={handleChange('age')} fullWidth />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, display: 'block', mb: 0.75 }}>
                    {t('Gender', 'النوع')}
                  </Typography>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { val: 'male', label: t('Male', 'ذكر'), icon: MaleRoundedIcon, color: '#2563eb', bg: '#eff6ff' },
                      { val: 'female', label: t('Female', 'أنثى'), icon: FemaleRoundedIcon, color: '#db2777', bg: '#fdf2f8' },
                    ].map((g) => {
                      const selected = String(form.gender || '').toLowerCase() === g.val;
                      const GIcon = g.icon;
                      return (
                        <button
                          key={g.val}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, gender: g.val }))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            border: `1.5px solid ${selected ? g.color : '#e2e8f0'}`,
                            background: selected ? g.bg : '#ffffff',
                            color: selected ? g.color : '#475569',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <GIcon sx={{ fontSize: 19 }} />
                          <span>{g.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Box>
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                  <BloodtypeRoundedIcon sx={{ fontSize: 17, color: '#dc2626' }} />
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                    {t('Blood Type', 'فصيلة الدم')}
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
                          minWidth: '50px',
                          padding: '7px 12px',
                          borderRadius: '11px',
                          border: `1.5px solid ${selected ? '#dc2626' : '#e2e8f0'}`,
                          background: selected ? '#fef2f2' : '#ffffff',
                          color: selected ? '#b91c1c' : '#334155',
                          fontWeight: 900,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
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
                <TextField label={t('Address', 'العنوان')} value={form.address || ''} onChange={handleChange('address')} fullWidth size="small" />
                <TextField label={t('Email', 'البريد الإلكتروني')} value={form.email || ''} onChange={handleChange('email')} fullWidth size="small" />
              </Box>
            </Stack>
          </div>
        ) : (
          <Stack spacing={2}>
            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
              <Stack spacing={2}>
                <TextField label={t('Allergies', 'الحساسيات')} value={form.allergies || ''} onChange={handleChange('allergies')} fullWidth size="small" />
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 2,
                  }}
                >
                  <TextField label={t('Chronic Conditions', 'الأمراض المزمنة')} value={form.conditions || ''} onChange={handleChange('conditions')} multiline minRows={2} fullWidth size="small" />
                  <TextField label={t('Current Medications', 'الأدوية الحالية')} value={form.medications || ''} onChange={handleChange('medications')} multiline minRows={2} fullWidth size="small" />
                </Box>
                <TextField label={t('Notes', 'ملاحظات')} value={form.notes || ''} onChange={handleChange('notes')} multiline minRows={2} fullWidth size="small" />
              </Stack>
            </div>
            <div style={{ background: '#ffffff', padding: '18px', borderRadius: '18px', border: '1px solid #e2e8f0' }}>
              <HealthInfoSection form={form} setForm={setForm} t={t} isArabic={isArabic} />
            </div>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', gap: 1 }}>
        <Button variant="outlined" onClick={onClose} disabled={loading} sx={{ borderRadius: '12px', px: 2.5 }}>
          {t('Cancel', 'إلغاء')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CheckRoundedIcon />}
          sx={{ borderRadius: '12px', px: 3 }}
        >
          {loading ? t('Saving...', 'جارٍ الحفظ...') : t('Save Changes', 'حفظ التعديلات')}
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
