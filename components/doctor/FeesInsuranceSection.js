// /components/doctor/FeesSection.jsx
'use client';
import * as React from 'react';
import { Grid, TextField, Switch, FormControlLabel, InputAdornment } from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import SectionCard from '@/components/ui/SectionCard';

export default function FeesSection({ form, setForm, isArabic }) {
  const L = (en, ar) => (isArabic ? ar : en);

  // Force currency to EGP on first mount
  React.useEffect(() => {
    if (form.currency !== 'EGP') {
      setForm((f) => ({ ...f, currency: 'EGP' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencyLabel = isArabic ? 'ج.م' : 'EGP';

  return (
    <SectionCard
      title={L('Fees & Scheduling', 'الرسوم وجدولة المواعيد')}
      subtitle={L('Configure consultation price and visit length.', 'اضبط سعر الكشف ومدة الزيارة.')}
      icon={<PaymentsIcon />}
      isArabic={isArabic}
    >
      <Grid container spacing={2}>
        {/* Consultation fee (always EGP) */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={L('Consultation Fee', 'رسوم الكشف')}
            value={form.consultationFee}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                consultationFee: e.target.value.replace(/[^\d.]/g, ''),
              }))
            }
            inputProps={{ inputMode: 'decimal' }}
            InputProps={{
              endAdornment: <InputAdornment position="end">{currencyLabel}</InputAdornment>,
            }}
          />
        </Grid>

        {/* Duration */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label={L('Appointment Duration (min)', 'مدة الكشف (دقائق)')}
            value={form.appointmentDurationMin}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                appointmentDurationMin: e.target.value.replace(/[^\d]/g, ''),
              }))
            }
            inputProps={{ inputMode: 'numeric' }}
          />
        </Grid>

        {/* Telehealth toggle */}
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={!!form.telehealth}
                onChange={(e) => setForm((f) => ({ ...f, telehealth: e.target.checked }))}
              />
            }
            label={L('Offers online/telehealth consultations', 'يوفر استشارات عن بُعد')}
          />
        </Grid>
      </Grid>
    </SectionCard>
  );
}
