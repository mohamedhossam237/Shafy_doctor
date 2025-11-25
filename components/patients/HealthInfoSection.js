'use client';

import * as React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  useTheme,
} from '@mui/material';

/**
 * HealthInfoSection – Enhanced version (matches EditHealthInfoDialog)
 * Each question appears as a clean, single-row card with hover effect.
 */
export default function HealthInfoSection({ form = {}, setForm = () => { }, t, isArabic }) {
  const theme = useTheme();

  // 🌍 Translation helper
  const translate = React.useCallback(
    (en, ar) => (typeof t === 'function' ? t(en, ar) : isArabic ? ar : en),
    [t, isArabic]
  );

  // 🧩 State handler
  const handleBool = React.useCallback(
    (field) => (e) => {
      const val = e.target.value === 'true';
      if (typeof setForm === 'function') setForm((f) => ({ ...(f || {}), [field]: val }));
    },
    [setForm]
  );

  // 🩺 Questions list
  const questions = React.useMemo(() => {
    const base = [
      { key: 'isDiabetic', label: translate('Is the patient diabetic?', 'هل المريض مصاب بالسكري؟') },
      { key: 'hadSurgeries', label: translate('Has the patient had surgeries?', 'هل خضع المريض لعمليات؟') },
      { key: 'isSmoker', label: translate('Does the patient smoke?', 'هل المريض مدخن؟') },
      { key: 'drinksAlcohol', label: translate('Does the patient drink alcohol?', 'هل يشرب المريض الكحول؟') },
      { key: 'familyHistory', label: translate('Family history of similar diseases?', 'هل يوجد تاريخ عائلي لأمراض مشابهة؟') },
    ];
    if (form?.gender?.toLowerCase() === 'female') {
      base.push({ key: 'isPregnant', label: translate('Is the patient pregnant?', 'هل المريضة حامل؟') });
    }
    return base;
  }, [translate, form?.gender]);

  return (
    <Box sx={{ mt: 3 }}>
      {/* 🩺 Title */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 2,
            background: (t) => `linear-gradient(135deg, ${t.palette.success.main}, ${t.palette.success.dark})`,
            display: 'flex',
            boxShadow: (t) => `0 4px 12px rgba(46, 125, 50, 0.3)`,
          }}
        >
          <Typography sx={{ color: 'white', fontSize: 24, fontWeight: 900 }}>🩺</Typography>
        </Box>
        <Typography
          variant="h6"
          fontWeight={900}
          sx={{
            textAlign: isArabic ? 'right' : 'left',
            color: theme.palette.text.primary,
          }}
        >
          {translate('Health Assessment', 'تقييم الحالة الصحية')}
        </Typography>
      </Stack>

      {/* 📋 Card container */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 4,
          background: (t) => `linear-gradient(135deg, ${t.palette.background.paper} 0%, ${t.palette.grey[50]} 100%)`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          border: (t) => `1px solid ${t.palette.divider}`,
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }
        }}
      >
        <Stack spacing={2.2}>
          {questions.map((q, i) => (
            <Paper
              key={q.key}
              variant="outlined"
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderRadius: 3,
                boxShadow: 'none',
                background: (th) => `linear-gradient(135deg, ${th.palette.background.default} 0%, ${th.palette.grey[50]} 100%)`,
                border: (th) => `2px solid ${th.palette.divider}`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  borderColor: theme.palette.success.main,
                  boxShadow: `0 4px 12px rgba(46, 125, 50, 0.2)`,
                  transform: 'translateY(-3px) scale(1.01)',
                  background: (th) => th.palette.background.paper,
                },
                direction: isArabic ? 'rtl' : 'ltr',
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                spacing={1.5}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  color="text.primary"
                  sx={{
                    flex: 1,
                    textAlign: isArabic ? 'right' : 'left',
                    lineHeight: 1.3,
                  }}
                >
                  {`${i + 1}. ${q.label}`}
                </Typography>

                <RadioGroup
                  row
                  value={String(form?.[q.key] ?? false)}
                  onChange={handleBool(q.key)}
                  sx={{
                    gap: 1.5,
                    justifyContent: isArabic ? 'flex-start' : 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <FormControlLabel
                    value="true"
                    control={<Radio color="success" />}
                    label={translate('Yes', 'نعم')}
                  />
                  <FormControlLabel
                    value="false"
                    control={<Radio color="error" />}
                    label={translate('No', 'لا')}
                  />
                </RadioGroup>
              </Stack>
            </Paper>
          ))}
        </Stack>

        <Divider sx={{ mt: 3, opacity: 0.4 }} />
      </Paper>
    </Box>
  );
}
