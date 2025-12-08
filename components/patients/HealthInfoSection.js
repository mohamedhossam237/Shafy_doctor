'use client';

import * as React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Divider,
  useTheme,
  Button,
  alpha,
  CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

/**
 * HealthInfoSection – Enhanced version
 * Supports both controlled mode (form/setForm) and direct update mode (patient/onUpdate).
 * Replaces Radio buttons with modern toggle cards.
 */
export default function HealthInfoSection({ form, setForm, patient, onUpdate, t, isArabic }) {
  const theme = useTheme();
  const [updating, setUpdating] = React.useState({});

  // 🌍 Translation helper
  const translate = React.useCallback(
    (en, ar) => (typeof t === 'function' ? t(en, ar) : isArabic ? ar : en),
    [t, isArabic]
  );

  // Determine current values
  const values = form || patient || {};
  const isReadOnly = !setForm && !onUpdate;

  // 🧩 State handler
  const handleToggle = (field, val) => async () => {
    // If same value, do nothing (or toggle off if needed, but for Yes/No usually we keep it)
    if (values[field] === val) return;

    if (setForm) {
      // Controlled mode (Add Patient)
      setForm((f) => ({ ...(f || {}), [field]: val }));
    } else if (onUpdate) {
      // Direct update mode (Patient Profile)
      try {
        setUpdating((prev) => ({ ...prev, [field]: true }));
        await onUpdate(field, val);
      } catch (error) {
        console.error('Failed to update:', error);
      } finally {
        setUpdating((prev) => ({ ...prev, [field]: false }));
      }
    }
  };

  // 🩺 Questions list
  const questions = React.useMemo(() => {
    const base = [
      { key: 'isDiabetic', label: translate('Is the patient diabetic?', 'هل المريض مصاب بالسكري؟') },
      { key: 'hadSurgeries', label: translate('Has the patient had surgeries?', 'هل خضع المريض لعمليات؟') },
      { key: 'isSmoker', label: translate('Does the patient smoke?', 'هل المريض مدخن؟') },
      { key: 'drinksAlcohol', label: translate('Does the patient drink alcohol?', 'هل يشرب المريض الكحول؟') },
      { key: 'familyHistory', label: translate('Family history of similar diseases?', 'هل يوجد تاريخ عائلي لأمراض مشابهة؟') },
    ];
    if (values?.gender?.toLowerCase() === 'female') {
      base.push({ key: 'isPregnant', label: translate('Is the patient pregnant?', 'هل المريضة حامل؟') });
    }
    return base;
  }, [translate, values?.gender]);

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
          {questions.map((q, i) => {
            const isYes = values[q.key] === true;
            const isNo = values[q.key] === false;
            const isLoading = updating[q.key];

            return (
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
                    transform: 'translateY(-2px)',
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

                  {/* Custom Toggle UI */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    {isLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <>
                        <Button
                          onClick={handleToggle(q.key, true)}
                          disabled={isReadOnly}
                          variant={isYes ? 'contained' : 'outlined'}
                          color="success"
                          startIcon={isYes ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 700,
                            px: 2,
                            opacity: isNo ? 0.5 : 1,
                            borderColor: isYes ? 'transparent' : 'divider',
                            bgcolor: isYes ? 'success.main' : 'transparent',
                            color: isYes ? 'white' : 'text.secondary',
                            '&:hover': {
                              bgcolor: isYes ? 'success.dark' : alpha(theme.palette.success.main, 0.1),
                              borderColor: 'success.main',
                            }
                          }}
                        >
                          {translate('Yes', 'نعم')}
                        </Button>
                        <Button
                          onClick={handleToggle(q.key, false)}
                          disabled={isReadOnly}
                          variant={isNo ? 'contained' : 'outlined'}
                          color="error"
                          startIcon={isNo ? <CancelIcon /> : <RadioButtonUncheckedIcon />}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            fontWeight: 700,
                            px: 2,
                            opacity: isYes ? 0.5 : 1,
                            borderColor: isNo ? 'transparent' : 'divider',
                            bgcolor: isNo ? 'error.main' : 'transparent',
                            color: isNo ? 'white' : 'text.secondary',
                            '&:hover': {
                              bgcolor: isNo ? 'error.dark' : alpha(theme.palette.error.main, 0.1),
                              borderColor: 'error.main',
                            }
                          }}
                        >
                          {translate('No', 'لا')}
                        </Button>
                      </>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        <Divider sx={{ mt: 3, opacity: 0.4 }} />
      </Paper>
    </Box>
  );
}
