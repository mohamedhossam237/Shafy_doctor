// /components/doctor/IdentitySection.jsx
'use client';
import * as React from 'react';
import { Grid, TextField, MenuItem } from '@mui/material';
import SectionCard from '@/components/ui/SectionCard';
import PersonIcon from '@mui/icons-material/Person';

const GENDER_OPTIONS = [
  { id: 'male', en: 'Male', ar: 'ذكر' },
  { id: 'female', en: 'Female', ar: 'أنثى' },
];

export default function IdentitySection({ form, setForm, isArabic }) {
  const L = (en, ar) => (isArabic ? ar : en);

  return (
    <SectionCard
      title={L('Identity', 'البيانات الشخصية')}
      icon={<PersonIcon />}
      isArabic={isArabic}
    >
      <Grid container spacing={2}>
        {[
          ['nameEn', 'Full Name'],
          ['nameAr', 'الاسم الكامل'],
          ['email', L('Email', 'البريد الإلكتروني')],
          ['phone', L('Phone Number', 'رقم الهاتف')],
        ].map(([k, label]) => (
          <Grid key={k} item xs={12} md={6}>
            <TextField
              fullWidth
              label={label}
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
            />
          </Grid>
        ))}

        <Grid item xs={12} md={6}>
          <TextField
            select
            fullWidth
            label={L('Gender', 'النوع')}
            value={form.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
          >
            {GENDER_OPTIONS.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {L(g.en, g.ar)}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
    </SectionCard>
  );
}
