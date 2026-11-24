'use client';
import * as React from 'react';
import { Box, TextField, MenuItem, Stack, Button, Typography, InputAdornment } from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MedicalServicesRoundedIcon from '@mui/icons-material/MedicalServicesRounded';
import BloodtypeRoundedIcon from '@mui/icons-material/BloodtypeRounded';
import CakeRoundedIcon from '@mui/icons-material/CakeRounded';
import MaleRoundedIcon from '@mui/icons-material/MaleRounded';
import FemaleRoundedIcon from '@mui/icons-material/FemaleRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import HealthInfoSection from '@/components/patients/HealthInfoSection';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const QUICK_ALLERGIES_AR = ['بنسلين', 'أسبرين', 'سلفا', 'لا يوجد'];
const QUICK_ALLERGIES_EN = ['Penicillin', 'Aspirin', 'Sulfa', 'None'];
const QUICK_CONDITIONS_AR = ['سكري', 'ضغط دم', 'ربو', 'قلب', 'غدة درقية'];
const QUICK_CONDITIONS_EN = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'Thyroid'];

function toggleCsvToken(current, token) {
  const list = String(current || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.some((x) => x.toLowerCase() === token.toLowerCase())) {
    return list.filter((x) => x.toLowerCase() !== token.toLowerCase()).join(', ');
  }
  return [...list, token].join(', ');
}

function hasCsvToken(current, token) {
  return String(current || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .includes(token.toLowerCase());
}

export default function PatientForm({ isArabic = true, initialValues, onSubmit }) {
  const [values, setValues] = React.useState(
    initialValues || {
      name: '',
      age: '',
      gender: '',
      bloodType: '',
      phone: '',
      email: '',
      address: '',
      allergies: '',
      conditions: '',
      medications: '',
      maritalStatus: '',
      lastVisit: '',
      isDiabetic: false,
      hadSurgeries: false,
      isSmoker: false,
      drinksAlcohol: false,
      familyHistory: false,
      isPregnant: false,
    }
  );
  const [submitting, setSubmitting] = React.useState(false);

  const handleChange = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit?.(values, { setSubmitting });
  };

  const label = (en, ar) => (isArabic ? ar : en);
  const allergyChips = isArabic ? QUICK_ALLERGIES_AR : QUICK_ALLERGIES_EN;
  const conditionChips = isArabic ? QUICK_CONDITIONS_AR : QUICK_CONDITIONS_EN;

  return (
    <form onSubmit={submit} dir={isArabic ? 'rtl' : 'ltr'}>
      <Stack spacing={2.5}>
        {/* Section 1: Basic Demographics & Contact */}
        <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #2563eb' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PersonRoundedIcon />
            </div>
            <div>
              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                {label('Basic & Contact Information', 'البيانات الأساسية والتواصل')}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                {label('Identity, demographics, blood type and phone', 'الهوية، العمر، النوع، فصيلة الدم والهاتف')}
              </Typography>
            </div>
          </Stack>

          <Stack spacing={2.25}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <TextField
                fullWidth
                label={label('Patient Name *', 'اسم المريض *')}
                value={values.name}
                onChange={handleChange('name')}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonRoundedIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label={label('Phone Number', 'رقم الهاتف')}
                value={values.phone}
                onChange={handleChange('phone')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneRoundedIcon fontSize="small" sx={{ color: '#2563eb' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 0.72fr) minmax(0, 1.28fr)' },
                gap: 2,
                alignItems: 'end',
              }}
            >
              <TextField
                fullWidth
                label={label('Age', 'العمر')}
                type="number"
                value={values.age}
                onChange={handleChange('age')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CakeRoundedIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, display: 'block', mb: 0.75 }}>
                  {label('Gender', 'النوع')}
                </Typography>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { val: 'male', txt: label('Male', 'ذكر'), icon: MaleRoundedIcon, color: '#2563eb', bg: '#eff6ff' },
                    { val: 'female', txt: label('Female', 'أنثى'), icon: FemaleRoundedIcon, color: '#db2777', bg: '#fdf2f8' },
                  ].map((g) => {
                    const selected = values.gender === g.val;
                    const GIcon = g.icon;
                    return (
                      <button
                        key={g.val}
                        type="button"
                        onClick={() => setValues((v) => ({ ...v, gender: selected ? '' : g.val }))}
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
                        }}
                      >
                        <GIcon sx={{ fontSize: 19 }} />
                        <span>{g.txt}</span>
                      </button>
                    );
                  })}
                </div>
              </Box>
            </Box>

            <Box>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <BloodtypeRoundedIcon sx={{ fontSize: 18, color: '#dc2626' }} />
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                  {label('Blood Type', 'فصيلة الدم')}
                </Typography>
              </Stack>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {BLOOD_TYPES.map((bt) => {
                  const selected = values.bloodType === bt;
                  return (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => setValues((v) => ({ ...v, bloodType: selected ? '' : bt }))}
                      style={{
                        minWidth: '54px',
                        padding: '7px 13px',
                        borderRadius: '11px',
                        border: `1.5px solid ${selected ? '#dc2626' : '#e2e8f0'}`,
                        background: selected ? '#fef2f2' : '#ffffff',
                        color: selected ? '#b91c1c' : '#334155',
                        fontWeight: 900,
                        fontSize: '0.84rem',
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
              <TextField
                fullWidth
                select
                label={label('Marital Status', 'الحالة الاجتماعية')}
                value={values.maritalStatus}
                onChange={handleChange('maritalStatus')}
              >
                <MenuItem value="">{label('Unspecified', 'غير محدد')}</MenuItem>
                <MenuItem value="single">{label('Single', 'أعزب / عزباء')}</MenuItem>
                <MenuItem value="married">{label('Married', 'متزوج / ة')}</MenuItem>
                <MenuItem value="divorced">{label('Divorced', 'مطلق / ة')}</MenuItem>
                <MenuItem value="widowed">{label('Widowed', 'أرمل / ة')}</MenuItem>
              </TextField>
              <TextField
                fullWidth
                label={label('Email', 'البريد الإلكتروني')}
                type="email"
                value={values.email}
                onChange={handleChange('email')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailRoundedIcon fontSize="small" sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            <TextField
              fullWidth
              label={label('Address', 'العنوان')}
              value={values.address}
              onChange={handleChange('address')}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <HomeRoundedIcon fontSize="small" sx={{ color: '#64748b' }} />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </div>

        {/* Section 2: Medical Background & Health Flags */}
        <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #4f46e5' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#eef2ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MedicalServicesRoundedIcon />
            </div>
            <div>
              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                {label('Clinical & Medical Background', 'الخلفية الطبية والأمراض المزمنة')}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                {label('Allergies, chronic conditions, medications & clinical flags', 'الحساسيات، الأمراض المزمنة، الأدوية والمؤشرات الصحية')}
              </Typography>
            </div>
          </Stack>

          <Stack spacing={2.25}>
            <Box>
              <TextField
                fullWidth
                label={label('Allergies', 'الحساسيات')}
                value={values.allergies}
                onChange={handleChange('allergies')}
                placeholder={label('e.g., Penicillin, Peanuts', 'مثال: بنسلين، فول سوداني')}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {allergyChips.map((chip) => {
                  const active = hasCsvToken(values.allergies, chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setValues((v) => ({ ...v, allergies: toggleCsvToken(v.allergies, chip) }))}
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
                fullWidth
                label={label('Chronic Conditions', 'الأمراض المزمنة')}
                value={values.conditions}
                onChange={handleChange('conditions')}
                placeholder={label('e.g., Diabetes, Hypertension', 'مثال: سكري، ضغط دم')}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {conditionChips.map((chip) => {
                  const active = hasCsvToken(values.conditions, chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setValues((v) => ({ ...v, conditions: toggleCsvToken(v.conditions, chip) }))}
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
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1.35fr) minmax(0, 0.85fr)' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <TextField
                fullWidth
                label={label('Current Medications', 'الأدوية الحالية')}
                multiline
                minRows={2}
                value={values.medications}
                onChange={handleChange('medications')}
                placeholder={label('e.g., Metformin, Aspirin', 'مثال: ميتفورمين، أسبرين')}
              />

              <TextField
                fullWidth
                label={label('Last Visit', 'آخر زيارة')}
                type="datetime-local"
                value={values.lastVisit}
                onChange={handleChange('lastVisit')}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EventRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Stack>

          <HealthInfoSection form={values} setForm={setValues} t={label} isArabic={isArabic} />
        </div>

        {/* Sticky Submit Bar */}
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            size="large"
            startIcon={<CheckRoundedIcon />}
            sx={{ borderRadius: '14px', px: 4, py: 1.3 }}
          >
            {submitting ? label('Saving...', 'جارٍ الحفظ...') : label('Save Patient Profile', 'حفظ ملف المريض')}
          </Button>
        </Stack>
      </Stack>
    </form>
  );
}
