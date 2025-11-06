'use client';
import React from 'react';
import {
  Paper, Typography, Grid, Chip, Stack, Divider, Box
} from '@mui/material';
import VaccinesIcon from '@mui/icons-material/Vaccines';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import SmokingRoomsIcon from '@mui/icons-material/SmokingRooms';
import LocalDrinkIcon from '@mui/icons-material/LocalDrink';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import ChildFriendlyIcon from '@mui/icons-material/ChildFriendly';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import { alpha } from '@mui/material/styles';

const splitCsv = (v) =>
  Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export default function HealthInfoSection({ patient, isArabic, label }) {
  const fmtNiceDate = (d) => {
    if (!d) return '—';
    const dt = d?.toDate ? d.toDate() : new Date(d);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit'
    }).format(dt);
  };

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => alpha(t.palette.background.paper, 0.98),
      }}
    >
      <Typography variant="h6" fontWeight={900} color="text.primary" sx={{ mb: 1 }}>
        {label('Health Information', 'المعلومات الصحية')}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary">
            {label('Blood Type', 'فصيلة الدم')}
          </Typography>
          <Chip label={patient?.bloodType || '—'} variant="outlined" sx={{ mt: 0.5 }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="caption" color="text.secondary">
            {label('Last Visit Date', 'تاريخ آخر زيارة')}
          </Typography>
          <Chip label={fmtNiceDate(patient?.lastVisitDate)} variant="outlined" sx={{ mt: 0.5 }} />
        </Grid>

        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            {label('Allergies', 'الحساسية')}
          </Typography>
          {splitCsv(patient?.allergies).length ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
              {splitCsv(patient.allergies).map((a, i) => (
                <Chip key={i} label={a} color="warning" variant="outlined" size="small" />
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary">—</Typography>
          )}
        </Grid>

        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            {label('Chronic Conditions', 'الأمراض المزمنة')}
          </Typography>
          {splitCsv(patient?.chronicConditions).length ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
              {splitCsv(patient.chronicConditions).map((c, i) => (
                <Chip key={i} label={c} variant="outlined" size="small" />
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary">—</Typography>
          )}
        </Grid>

        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            {label('Current Medications', 'الأدوية الحالية')}
          </Typography>
          {splitCsv(patient?.currentMedications).length ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
              {splitCsv(patient.currentMedications).map((m, i) => (
                <Chip key={i} label={m} variant="outlined" size="small" />
              ))}
            </Stack>
          ) : (
            <Typography color="text.secondary">—</Typography>
          )}
        </Grid>
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
        {label('Health Conditions', 'الحالات الصحية')}
      </Typography>

      <Stack spacing={1}>
        {[
          ['isDiabetic', label('Is the patient diabetic?', 'هل المريض مصاب بالسكري؟'), <VaccinesIcon />],
          ['hadSurgeries', label('Has the patient had surgeries?', 'هل خضع المريض لعمليات؟'), <LocalHospitalIcon />],
          ['isSmoker', label('Does the patient smoke?', 'هل المريض مدخن؟'), <SmokingRoomsIcon />],
          ['drinksAlcohol', label('Does the patient drink alcohol?', 'هل يشرب المريض الكحول؟'), <LocalDrinkIcon />],
          ['familyHistory', label('Family history of similar diseases?', 'هل يوجد تاريخ عائلي لأمراض مشابهة؟'), <FamilyRestroomIcon />],
        ].map(([key, question, icon]) => (
          <Stack key={key} direction="row" alignItems="center" spacing={2}>
            {icon}
            <Typography sx={{ flex: 1 }}>{question}</Typography>
            <Chip
              label={patient?.[key] ? label('Yes', 'نعم') : label('No', 'لا')}
              color={patient?.[key] ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        ))}

        {patient?.gender?.toLowerCase() === 'female' && (
          <Stack direction="row" alignItems="center" spacing={2}>
            <ChildFriendlyIcon />
            <Typography sx={{ flex: 1 }}>{label('Is the patient pregnant?', 'هل المريضة حامل؟')}</Typography>
            <Chip
              label={patient?.isPregnant ? label('Yes', 'نعم') : label('No', 'لا')}
              color={patient?.isPregnant ? 'success' : 'default'}
              variant="outlined"
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
