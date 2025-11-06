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
export default function HealthInfoSection({ form = {}, setForm = () => {}, t, isArabic }) {
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
      <Typography
        variant="h6"
        fontWeight={900}
        sx={{
          mb: 2,
          textAlign: isArabic ? 'right' : 'left',
          color: theme.palette.text.primary,
        }}
      >
        {translate('Health Assessment', 'تقييم الحالة الصحية')}
      </Typography>

      {/* 📋 Card container */}
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 4,
          bgcolor: theme.palette.background.paper,
          boxShadow: theme.shadows[2],
          borderColor: theme.palette.divider,
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
                bgcolor: (th) => th.palette.background.default,
                border: (th) => `1px solid ${th.palette.divider}`,
                transition: '0.25s ease',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  boxShadow: theme.shadows[3],
                  transform: 'translateY(-2px)',
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
