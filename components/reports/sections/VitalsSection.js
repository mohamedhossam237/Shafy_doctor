'use client';
import * as React from 'react';
import {
  Grid,
  TextField,
  MenuItem,
  InputAdornment,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SectionWrapper from './SectionWrapper';

export default function VitalsSection({ t, form = {}, setForm }) {
  const [extraFields, setExtraFields] = React.useState([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedField, setSelectedField] = React.useState('');
  const [customField, setCustomField] = React.useState('');

  const vitals = {
    bp: form.vitalsBP || '',
    hr: form.vitalsHR || '',
    temp: form.vitalsTemp || '',
    spo2: form.vitalsSpO2 || '',
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({
      ...prev,
      [`vitals${field.toUpperCase()}`]: e.target.value,
    }));
  };

  // Expanded dropdown ranges for better variety
  const bpOptions = [
    '100/60', '105/65', '110/70', '115/75', '120/80', '125/85', '130/90', '135/95', '140/100'
  ];
  const hrOptions = [
    '55', '60', '65', '70', '75', '80', '85', '90', '95', '100', '110'
  ];
  const tempOptions = [
    '36.0', '36.3', '36.5', '36.7', '37.0', '37.3', '37.5', '37.8', '38.0', '38.5', '39.0'
  ];
  const spo2Options = [
    '90', '92', '93', '94', '95', '96', '97', '98', '99', '100'
  ];

  const availableFields = [
    { key: 'weight', label: t('Weight', 'الوزن'), unit: 'kg' },
    { key: 'height', label: t('Height', 'الطول'), unit: 'cm' },
    { key: 'bmi', label: t('BMI', 'مؤشر كتلة الجسم') },
    { key: 'sugar', label: t('Blood Sugar', 'سكر الدم'), unit: 'mg/dL' },
    { key: 'resp', label: t('Respiratory Pattern', 'نمط التنفس') },
    { key: 'pain', label: t('Pain Level', 'مستوى الألم') },
  ];

  const handleAddField = () => {
    if (selectedField === 'custom' && customField.trim()) {
      setExtraFields((prev) => [
        ...prev,
        { key: customField.toLowerCase().replace(/\s+/g, ''), label: customField, custom: true },
      ]);
    } else {
      const field = availableFields.find((f) => f.key === selectedField);
      if (field && !extraFields.some((ef) => ef.key === field.key)) {
        setExtraFields((prev) => [...prev, field]);
      }
    }
    setDialogOpen(false);
    setSelectedField('');
    setCustomField('');
  };

  // Auto BMI
  React.useEffect(() => {
    const weight = parseFloat(form.vitalsWEIGHT);
    const height = parseFloat(form.vitalsHEIGHT);
    if (weight && height) {
      const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
      setForm((prev) => ({ ...prev, vitalsBMI: bmi }));
    }
  }, [form.vitalsWEIGHT, form.vitalsHEIGHT, setForm]);

  return (
    <SectionWrapper
      icon={<FavoriteIcon fontSize="small" />}
      title={t('Vital Signs', 'العلامات الحيوية')}
    >
      <Grid container spacing={2}>
        {/* --- Blood Pressure --- */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            freeSolo
            options={bpOptions}
            value={vitals.bp || null}
            onChange={(event, newValue) => {
              setForm((prev) => ({
                ...prev,
                vitalsBP: newValue || '',
              }));
            }}
            onInputChange={(event, newInputValue) => {
              setForm((prev) => ({
                ...prev,
                vitalsBP: newInputValue,
              }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('Blood Pressure', 'ضغط الدم')}
                placeholder={t('Blood Pressure', 'ضغط الدم')}
                helperText={t('Optional', 'اختياري')}
                sx={{
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  '& .MuiInputBase-root': { fontSize: 16, height: 56 },
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {params.InputProps.endAdornment}
                      <InputAdornment position="end">mmHg</InputAdornment>
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>

        {/* --- Heart Rate --- */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            freeSolo
            options={hrOptions}
            value={vitals.hr || null}
            onChange={(event, newValue) => {
              setForm((prev) => ({
                ...prev,
                vitalsHR: newValue || '',
              }));
            }}
            onInputChange={(event, newInputValue) => {
              setForm((prev) => ({
                ...prev,
                vitalsHR: newInputValue,
              }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('Heart Rate', 'نبض القلب')}
                placeholder={t('Heart Rate', 'نبض القلب')}
                helperText={t('Optional', 'اختياري')}
                sx={{
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  '& .MuiInputBase-root': { fontSize: 16, height: 56 },
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {params.InputProps.endAdornment}
                      <InputAdornment position="end">bpm</InputAdornment>
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>

        {/* --- Temperature --- */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            freeSolo
            options={tempOptions}
            value={vitals.temp || null}
            onChange={(event, newValue) => {
              setForm((prev) => ({
                ...prev,
                vitalsTemp: newValue || '',
              }));
            }}
            onInputChange={(event, newInputValue) => {
              setForm((prev) => ({
                ...prev,
                vitalsTemp: newInputValue,
              }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('Temperature', 'درجة الحرارة')}
                placeholder={t('Temperature', 'درجة الحرارة')}
                helperText={t('Optional', 'اختياري')}
                sx={{
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  '& .MuiInputBase-root': { fontSize: 16, height: 56 },
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {params.InputProps.endAdornment}
                      <InputAdornment position="end">°C</InputAdornment>
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>

        {/* --- SpO2 --- */}
        <Grid item xs={12} sm={6} md={3}>
          <Autocomplete
            freeSolo
            options={spo2Options}
            value={vitals.spo2 || null}
            onChange={(event, newValue) => {
              setForm((prev) => ({
                ...prev,
                vitalsSpO2: newValue || '',
              }));
            }}
            onInputChange={(event, newInputValue) => {
              setForm((prev) => ({
                ...prev,
                vitalsSpO2: newInputValue,
              }));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('SpO₂', 'نسبة الأوكسجين')}
                placeholder={t('SpO₂', 'نسبة الأوكسجين')}
                helperText={t('Optional', 'اختياري')}
                sx={{
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  '& .MuiInputBase-root': { fontSize: 16, height: 56 },
                }}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {params.InputProps.endAdornment}
                      <InputAdornment position="end">%</InputAdornment>
                    </>
                  ),
                }}
              />
            )}
          />
        </Grid>
      </Grid>

      {/* --- Added Extra Fields --- */}
      {extraFields.length > 0 && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          {extraFields.map((field) => (
            <Grid item xs={12} sm={6} md={3} key={field.key}>
              <TextField
                label={field.label}
                placeholder={field.label}
                value={form[`vitals${field.key.toUpperCase()}`] || ''}
                onChange={handleChange(field.key)}
                fullWidth
                sx={{
                  bgcolor: '#fafafa',
                  borderRadius: 2,
                  '& .MuiInputBase-root': { fontSize: 16, height: 56 },
                }}
                InputProps={{
                  endAdornment: field.unit ? (
                    <InputAdornment position="end">{field.unit}</InputAdornment>
                  ) : null,
                }}
                helperText={t('Optional', 'اختياري')}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* --- Add Field Button --- */}
      <Box sx={{ mt: 3 }}>
        <Button
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => setDialogOpen(true)}
          variant="outlined"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {t('Add Field', 'إضافة حقل جديد')}
        </Button>
      </Box>

      {/* --- Add Field Dialog --- */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{t('Add New Field', 'إضافة حقل جديد')}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('Select Field', 'اختر الحقل')}</InputLabel>
            <Select
              value={selectedField}
              label={t('Select Field', 'اختر الحقل')}
              onChange={(e) => setSelectedField(e.target.value)}
            >
              {availableFields.map((f) => (
                <MenuItem key={f.key} value={f.key}>
                  {f.label}
                </MenuItem>
              ))}
              <MenuItem value="custom">{t('Custom Field', 'حقل مخصص')}</MenuItem>
            </Select>
          </FormControl>

          {selectedField === 'custom' && (
            <TextField
              label={t('Custom Field Name', 'اسم الحقل المخصص')}
              value={customField}
              onChange={(e) => setCustomField(e.target.value)}
              fullWidth
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('Cancel', 'إلغاء')}</Button>
          <Button onClick={handleAddField} variant="contained">
            {t('Add', 'إضافة')}
          </Button>
        </DialogActions>
      </Dialog>
    </SectionWrapper>
  );
}
