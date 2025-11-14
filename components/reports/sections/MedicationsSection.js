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

export default function MedicationsSection({
  t,
  medicationsList,
  updateMedication,
  addMedication,
  removeMedication,
  isArabic,
}) {
  const [drugOptions, setDrugOptions] = React.useState([]);
  const [drugLoading, setDrugLoading] = React.useState(true);

  // Load medicines list
  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/data/medicines.min.json');
        const data = await res.json();
        setDrugOptions(data || []);
      } catch (err) {
        console.error('Error loading drug list', err);
      } finally {
        setDrugLoading(false);
      }
    };
    load();
  }, []);

  // Filter
  const filterDrugs = React.useCallback((q = '', list = []) => {
    const text = q.toLowerCase().trim();
    if (!text) return list.slice(0, 200);

    return list
      .filter(
        (d) =>
          d.displayName?.toLowerCase().includes(text) ||
          d.genericName?.toLowerCase().includes(text) ||
          d.brandName?.toLowerCase().includes(text)
      )
      .slice(0, 200);
  }, []);

  // Label builder
  const getDrugLabel = (opt) => {
    if (typeof opt === 'string') return opt;

    const main = opt.displayName || opt.brandName || opt.genericName || '';
    const extra = [opt.strength, opt.form, opt.route].filter(Boolean).join(' · ');

    return extra ? `${main} — ${extra}` : main;
  };

  const doseOptions = ['250 mg', '500 mg', '1 g', '2 g', '5 ml', '10 ml', '1 tablet', '2 tablets'];
  const freqOptions = [
    t('Once daily', 'مرة يوميًا'),
    t('Twice daily', 'مرتين يوميًا'),
    t('Every 8 hours', 'كل 8 ساعات'),
    t('As needed', 'عند اللزوم'),
  ];
  const durationOptions = [
    t('3 days', '3 أيام'),
    t('5 days', '5 أيام'),
    t('7 days', '7 أيام'),
    t('2 weeks', 'أسبوعين'),
  ];

  return (
    <SectionWrapper
      icon={<MedicationIcon fontSize="small" />}
      title={t('Medications / Prescriptions', 'الأدوية / الوصفات')}
    >
      <Stack spacing={1.5}>
        {medicationsList.map((m, idx) => {
          const filteredList = filterDrugs(m.name, drugOptions);

          return (
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
              <Grid container spacing={1.25} alignItems="start">
                {/* Drug Dropdown */}
                <Grid item xs={12} md={3.8}>
                  <Autocomplete
                    options={filteredList}
                    loading={drugLoading}
                    value={m.name}
                    onChange={(_, v) => {
                      updateMedication(idx, 'name', getDrugLabel(v) || '');

                      // Save preview
                      updateMedication(idx, 'preview', typeof v === 'object' ? v : null);
                    }}
                    onInputChange={(_, v) => {
                      updateMedication(idx, 'name', v);
                    }}
                    getOptionLabel={(opt) => getDrugLabel(opt)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('Medicine name', 'اسم الدواء')}
                        placeholder={t('Type to search…', 'اكتب للبحث…')}
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

                {/* Dose */}
                <Grid item xs={6} md={2}>
                  <Autocomplete
                    freeSolo
                    options={doseOptions}
                    value={m.dose || ''}
                    onInputChange={(_, v) => updateMedication(idx, 'dose', v || '')}
                    renderInput={(params) => (
                      <TextField {...params} label={t('Dose', 'الجرعة')} fullWidth />
                    )}
                  />
                </Grid>

                {/* Frequency */}
                <Grid item xs={6} md={3}>
                  <Autocomplete
                    freeSolo
                    options={freqOptions}
                    value={m.frequency || ''}
                    onInputChange={(_, v) => updateMedication(idx, 'frequency', v || '')}
                    renderInput={(params) => (
                      <TextField {...params} label={t('Frequency', 'التكرار')} fullWidth />
                    )}
                  />
                </Grid>

                {/* Duration */}
                <Grid item xs={6} md={2}>
                  <Autocomplete
                    freeSolo
                    options={durationOptions}
                    value={m.duration || ''}
                    onInputChange={(_, v) => updateMedication(idx, 'duration', v || '')}
                    renderInput={(params) => (
                      <TextField {...params} label={t('Duration', 'المدة')} fullWidth />
                    )}
                  />
                </Grid>

                {/* Notes */}
                <Grid item xs={12} md={2.5}>
                  <TextField
                    label={t('Notes', 'ملاحظات')}
                    fullWidth
                    value={m.notes || ''}
                    onChange={(e) => updateMedication(idx, 'notes', e.target.value)}
                  />
                </Grid>

                {/* Remove */}
                <Grid item xs={12} md="auto">
                  <IconButton color="error" onClick={() => removeMedication(idx)}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </Grid>
              </Grid>

              {/* 📌 Preview Section */}
              {m.preview && (
                <Box
                  sx={{
                    mt: 1.5,
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid #ddd',
                    bgcolor: '#fafafa',
                    fontSize: '0.85rem',
                  }}
                >
                  <strong>{t('Selected:', 'الدواء المختار:')}</strong> {m.preview.displayName}
                  <br />
                  {m.preview.brandName && (
                    <>• {t('Brand:', 'التجاري:')} {m.preview.brandName}<br /></>
                  )}
                  {m.preview.genericName && (
                    <>• {t('Generic:', 'العلمي:')} {m.preview.genericName}<br /></>
                  )}
                  {m.preview.strength && (
                    <>• {t('Strength:', 'التركيز:')} {m.preview.strength}<br /></>
                  )}
                  {m.preview.form && (
                    <>• {t('Form:', 'الهيئة:')} {m.preview.form}<br /></>
                  )}
                  {m.preview.route && (
                    <>• {t('Route:', 'طريقة الإعطاء:')} {m.preview.route}<br /></>
                  )}
                  {m.preview.company && (
                    <>• {t('Company:', 'الشركة:')} {m.preview.company}<br /></>
                  )}
                </Box>
              )}
            </Paper>
          );
        })}

        <Box>
          <Button startIcon={<AddCircleOutlineIcon />} variant="outlined" onClick={addMedication}>
            {t('Add medicine', 'إضافة دواء')}
          </Button>
        </Box>
      </Stack>
    </SectionWrapper>
  );
}
