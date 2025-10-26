'use client';
import * as React from 'react';
import {
  Box,
  Grid,
  Paper,
  Stack,
  TextField,
  IconButton,
  Button,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import MedicationIcon from '@mui/icons-material/Medication';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { alpha } from '@mui/material/styles';
import SectionWrapper from './SectionWrapper';

/**
 * MedicationsSection — structured list of medicines with dropdown dose, frequency, and duration
 */
export default function MedicationsSection({
  t,
  medicationsList,
  updateMedication,
  addMedication,
  removeMedication,
  drugOptions = [],
  drugLoading,
  debouncedSetQuery,
  isArabic,
}) {
  // --- Local filter function (prevents undefined error) ---
  const filterDrugs = React.useCallback((q = '', list = []) => {
    const n = q.toLowerCase().trim();
    if (!n) return list.slice(0, 100);
    return list
      .filter(
        (d) =>
          d.displayName?.toLowerCase().includes(n) ||
          d.genericName?.toLowerCase().includes(n) ||
          d.brandName?.toLowerCase().includes(n)
      )
      .slice(0, 100);
  }, []);

  // --- Dropdown options ---
  const doseOptions = [
    '250 mg', '500 mg', '750 mg', '1 g', '2 g',
    '5 ml', '10 ml', '1 tablet', '2 tablets', '1 capsule',
  ];

  const frequencyOptions = [
    t('Once daily', 'مرة يوميًا'),
    t('Twice daily (BID)', 'مرتين يوميًا'),
    t('Three times daily (TID)', 'ثلاث مرات يوميًا'),
    t('Every 6 hours', 'كل 6 ساعات'),
    t('Every 8 hours', 'كل 8 ساعات'),
    t('Every 12 hours', 'كل 12 ساعة'),
    t('As needed (PRN)', 'عند اللزوم'),
  ];

  const durationOptions = [
    t('3 days', '3 أيام'),
    t('5 days', '5 أيام'),
    t('7 days', '7 أيام'),
    t('10 days', '10 أيام'),
    t('2 weeks', 'أسبوعين'),
    t('1 month', 'شهر'),
  ];

  return (
    <SectionWrapper
      icon={<MedicationIcon fontSize="small" />}
      title={t(
        'Medications / Prescriptions (optional if image attached)',
        'الأدوية / الوصفات (اختياري عند إرفاق صورة)'
      )}
    >
      <Stack spacing={1.5}>
        {medicationsList.map((m, idx) => (
          <Paper
            key={idx}
            variant="outlined"
            sx={{
              p: 1.25,
              borderRadius: 2,
              borderStyle: 'dashed',
              borderColor: (t2) => alpha(t2.palette.divider, 0.8),
            }}
          >
            <Grid container spacing={1.25} alignItems="center">
              {/* --- Drug Autocomplete --- */}
              <Grid item xs={12} md={3.5}>
                <Autocomplete
                  freeSolo
                  autoHighlight
                  loading={drugLoading}
                  options={filterDrugs('', drugOptions)}
                  value={m.name || ''}
                  onInputChange={(_, v) => {
                    updateMedication(idx, 'name', v || '');
                    debouncedSetQuery?.(v || '');
                  }}
                  getOptionLabel={(opt) => {
                    if (typeof opt === 'string') return opt;
                    const primary =
                      opt.brandName || opt.displayName || opt.genericName || '';
                    const extra = [opt.strength, opt.form, opt.route]
                      .filter(Boolean)
                      .join(' ');
                    return extra ? `${primary} ${extra}` : primary;
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('Medicine name', 'اسم الدواء')}
                      placeholder={t('Type brand or generic…', 'اكتب الاسم التجاري أو العلمي…')}
                      fullWidth
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {drugLoading ? <CircularProgress size={18} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>

              {/* --- Dose Dropdown --- */}
              <Grid item xs={6} md={2}>
                <Autocomplete
                  freeSolo
                  options={doseOptions}
                  value={m.dose || ''}
                  onInputChange={(_, v) => updateMedication(idx, 'dose', v || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('Dose', 'الجرعة')}
                      placeholder="500 mg"
                      fullWidth
                    />
                  )}
                />
              </Grid>

              {/* --- Frequency Dropdown --- */}
              <Grid item xs={6} md={2.5}>
                <Autocomplete
                  freeSolo
                  options={frequencyOptions}
                  value={m.frequency || ''}
                  onInputChange={(_, v) => updateMedication(idx, 'frequency', v || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('Frequency', 'التكرار')}
                      placeholder={t('e.g. BID', 'مثال: مرتين/يوم')}
                      fullWidth
                    />
                  )}
                />
              </Grid>

              {/* --- Duration Dropdown --- */}
              <Grid item xs={6} md={2}>
                <Autocomplete
                  freeSolo
                  options={durationOptions}
                  value={m.duration || ''}
                  onInputChange={(_, v) => updateMedication(idx, 'duration', v || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('Duration', 'المدة')}
                      placeholder={t('7 days', '7 أيام')}
                      fullWidth
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} md={2.8}>
                <TextField
                  label={t('Notes', 'ملاحظات')}
                  fullWidth
                  value={m.notes}
                  onChange={(e) => updateMedication(idx, 'notes', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md="auto">
                <IconButton
                  color="error"
                  onClick={() => removeMedication(idx)}
                  aria-label={t('Remove medicine', 'إزالة الدواء')}
                  sx={{ ml: { md: 0.5 } }}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Grid>
            </Grid>
          </Paper>
        ))}

        <Box>
          <Button
            onClick={addMedication}
            startIcon={<AddCircleOutlineIcon />}
            variant="outlined"
          >
            {t('Add medicine', 'إضافة دواء')}
          </Button>
        </Box>
      </Stack>
    </SectionWrapper>
  );
}
